import express from 'express';
import http from 'http';
import { Server, Socket } from 'socket.io';
import cors from 'cors';
import dotenv from 'dotenv';
import multer from 'multer';
import { v4 as uuidv4 } from 'uuid';
import path from 'path';
import fs from 'fs';

dotenv.config();

const allowedOrigins = process.env.CLIENT_URL
    ? process.env.CLIENT_URL.split(',').map(o => o.trim())
    : ['*'];

const corsOptions = {
    origin: (origin: string | undefined, cb: (err: Error | null, allow?: boolean) => void) => {
        if (!origin || allowedOrigins.includes('*') || allowedOrigins.includes(origin)) {
            cb(null, true);
        } else {
            cb(new Error('Not allowed by CORS'));
        }
    },
    methods: ['GET', 'POST', 'DELETE'],
    credentials: true,
};

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: corsOptions,
    transports: ['websocket', 'polling'],
});

app.use(cors(corsOptions));
app.use(express.json());

// Serving uploaded files
const UPLOADS_DIR = path.join(__dirname, '../uploads');
if (!fs.existsSync(UPLOADS_DIR)) {
    fs.mkdirSync(UPLOADS_DIR);
}
app.use('/uploads', express.static(UPLOADS_DIR));

// Configure multer for file uploads
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        // We'll store files in subdirectories based on Tunnel
        const TunnelId = req.params.TunnelId as string;
        const TunnelDir = path.join(UPLOADS_DIR, TunnelId);
        if (!fs.existsSync(TunnelDir)) {
            fs.mkdirSync(TunnelDir, { recursive: true });
        }
        cb(null, TunnelDir);
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, uniqueSuffix + '-' + file.originalname);
    }
});

const upload = multer({
    storage: storage,
    limits: { fileSize: 10 * 1024 * 1024 } // 10MB limit
});


// State management
interface Tunnel {
    id: string;
    password?: string;
    creatorClientId: string | null;
    contents: Record<string, string>;
    language: string;
    users: Map<string, string>; // socketId -> displayName
    files: Array<{ id: string, name: string, url: string, type: string, uploader: string, clientId: string }>;
    messages: Array<{ id: string, sender: string, text: string, type: 'chat' | 'system', timestamp: number }>;
    createdAt: number;
}

const Tunnels: Map<string, Tunnel> = new Map();

// Helper to cleanup Tunnels (24h TTL)
const cleanupTunnels = () => {
    const now = Date.now();
    const TTL = 24 * 60 * 60 * 1000;

    Tunnels.forEach((Tunnel, TunnelId) => {
        if (now - Tunnel.createdAt > TTL) {
            deleteTunnel(TunnelId);
        }
    });
};

setInterval(cleanupTunnels, 60 * 60 * 1000); // Check every hour

const deleteTunnel = (TunnelId: string) => {
    Tunnels.delete(TunnelId);
    // Cleanup files
    const TunnelDir = path.join(UPLOADS_DIR, TunnelId);
    if (fs.existsSync(TunnelDir)) {
        fs.rmSync(TunnelDir, { recursive: true, force: true });
    }
    io.to(TunnelId).emit('Tunnel_terminated');
}

// API Routes
app.post('/api/Tunnels', (req, res) => {
    const { password } = req.body || {};
    const TunnelId = uuidv4().substring(0, 8); // Short ID for pastebin style
    Tunnels.set(TunnelId, {
        id: TunnelId,
        password: password || undefined,
        creatorClientId: null, // Will be set on first connect
        contents: { 'javascript': '// New hacker Tunnel created\n\nconsole.log("Welcome to the mainframe.");' },
        language: 'javascript',
        users: new Map(),
        files: [],
        messages: [
            { id: uuidv4(), sender: 'SYSTEM', text: `Tunnel ${TunnelId} initialized.`, type: 'system', timestamp: Date.now() }
        ],
        createdAt: Date.now()
    });
    res.json({ TunnelId });
});

app.get('/health', (req, res) => {
    res.status(200).send('OK');
});

app.get('/api/Tunnels/:TunnelId', (req, res) => {
    const Tunnel = Tunnels.get(req.params.TunnelId);
    if (!Tunnel) {
        return res.status(404).json({ error: 'Tunnel not found' });
    }
    res.json({
        id: Tunnel.id,
        hasPassword: !!Tunnel.password,
        usersCount: Tunnel.users.size
    });
});

app.post('/api/Tunnels/:TunnelId/upload', upload.single('file'), (req, res) => {
    const TunnelId = req.params.TunnelId as string;
    const Tunnel = Tunnels.get(TunnelId);

    if (!Tunnel) {
        return res.status(404).json({ error: 'Tunnel not found' });
    }

    if (!req.file) {
        return res.status(400).json({ error: 'No file uploaded' });
    }

    const fileUrl = `/uploads/${TunnelId}/${req.file.filename}`;
    const newFile = {
        id: uuidv4(),
        name: req.file.originalname,
        url: fileUrl,
        type: req.file.mimetype,
        uploader: req.body.uploader || 'Anonymous',
        clientId: req.body.clientId || 'unknown'
    };

    Tunnel.files.push(newFile);

    // Notify room
    io.to(TunnelId).emit('new_file', newFile);

    // System message
    const msg = {
        id: uuidv4(),
        sender: 'SYSTEM',
        text: `File uploaded: ${req.file.originalname}`,
        type: 'system' as const,
        timestamp: Date.now()
    };
    Tunnel.messages.push(msg);
    io.to(TunnelId).emit('new_message', msg);

    res.json(newFile);
});

app.delete('/api/Tunnels/:TunnelId/files/:fileId', (req, res) => {
    const { TunnelId, fileId } = req.params;
    const clientId = req.headers['x-client-id'];

    const Tunnel = Tunnels.get(TunnelId);
    if (!Tunnel) return res.status(404).json({ error: 'Tunnel not found' });

    const fileIndex = Tunnel.files.findIndex(f => f.id === fileId);
    if (fileIndex === -1) return res.status(404).json({ error: 'File not found' });

    if (Tunnel.files[fileIndex].clientId !== clientId) {
        return res.status(403).json({ error: 'Unauthorized to delete this file' });
    }

    const file = Tunnel.files[fileIndex];
    Tunnel.files.splice(fileIndex, 1);

    const filePath = path.join(__dirname, '../', file.url);
    if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
    }

    io.to(TunnelId).emit('file_deleted', fileId);

    const msg = {
        id: uuidv4(),
        sender: 'SYSTEM',
        text: `File deleted: ${file.name}`,
        type: 'system' as const,
        timestamp: Date.now()
    };
    Tunnel.messages.push(msg);
    io.to(TunnelId).emit('new_message', msg);

    res.json({ success: true });
});


// Socket handling
io.on('connection', (socket) => {
    console.log('User connected:', socket.id);

    socket.on('join_Tunnel', ({ TunnelId, displayName, clientId, password }) => {
        const Tunnel = Tunnels.get(TunnelId);

        if (!Tunnel) {
            socket.emit('error', 'Tunnel not found');
            return;
        }

        if (Tunnel.password && Tunnel.password !== password) {
            socket.emit('auth_error', 'Invalid password');
            return;
        }

        if (!Tunnel.creatorClientId) {
            Tunnel.creatorClientId = clientId;
        }

        socket.join(TunnelId);
        Tunnel.users.set(socket.id, displayName);

        const isCreator = Tunnel.creatorClientId === clientId;
        socket.emit('Tunnel_joined', {
            isCreator,
            users: Array.from(Tunnel.users.values()),
            content: Tunnel.contents[Tunnel.language] || '',
            language: Tunnel.language,
            files: Tunnel.files,
            messages: Tunnel.messages
        });

        // Notify others
        const joinMsg = {
            id: uuidv4(),
            sender: 'SYSTEM',
            text: `${displayName} connected.`,
            type: 'system' as const,
            timestamp: Date.now()
        };
        Tunnel.messages.push(joinMsg);
        io.to(TunnelId).emit('new_message', joinMsg);

        io.to(TunnelId).emit('users_update', Array.from(Tunnel.users.values()));
    });

    socket.on('code_change', ({ TunnelId, language, content }) => {
        const Tunnel = Tunnels.get(TunnelId);
        if (Tunnel) {
            Tunnel.contents[language] = content;
            socket.to(TunnelId).emit('code_update', { language, content });
        }
    });

    socket.on('language_change', ({ TunnelId, language }) => {
        const Tunnel = Tunnels.get(TunnelId);
        if (Tunnel) {
            Tunnel.language = language;
            const content = Tunnel.contents[language] || '';
            io.to(TunnelId).emit('language_update', { language, content });
        }
    });

    socket.on('send_message', ({ TunnelId, text }) => {
        const Tunnel = Tunnels.get(TunnelId);
        if (Tunnel) {
            const displayName = Tunnel.users.get(socket.id) || 'Unknown User';

            if (text.startsWith('/')) {
                // Command handling
                handleCommand(socket, Tunnel, text);
                return;
            }

            const msg = {
                id: uuidv4(),
                sender: displayName,
                text,
                type: 'chat' as const,
                timestamp: Date.now()
            };
            Tunnel.messages.push(msg);
            io.to(TunnelId).emit('new_message', msg);
        }
    });

    socket.on('terminate_Tunnel', ({ TunnelId, clientId }) => {
        const Tunnel = Tunnels.get(TunnelId);
        if (Tunnel && Tunnel.creatorClientId === clientId) {
            deleteTunnel(TunnelId);
        }
    });


    socket.on('disconnect', () => {
        Tunnels.forEach((Tunnel, TunnelId) => {
            if (Tunnel.users.has(socket.id)) {
                const displayName = Tunnel.users.get(socket.id);
                Tunnel.users.delete(socket.id);

                const PurgeMsg = {
                    id: uuidv4(),
                    sender: 'SYSTEM',
                    text: `${displayName} disconnected.`,
                    type: 'system' as const,
                    timestamp: Date.now()
                };
                Tunnel.messages.push(PurgeMsg);
                io.to(TunnelId).emit('new_message', PurgeMsg);
                io.to(TunnelId).emit('users_update', Array.from(Tunnel.users.values()));

                // If creator Purges, we might want to auto-assign new creator, 
                // or just let it live until TTL. We'll let it live.
            }
        });
        console.log('User disconnected:', socket.id);
    });
});

function handleCommand(socket: Socket, Tunnel: Tunnel, commandText: string) {
    const parts = commandText.split(' ');
    const cmd = parts[0];

    const displayName = Tunnel.users.get(socket.id);

    if (cmd === '/clear') {
        socket.emit('clear_terminal');
    } else if (cmd === '/who') {
        const usersList = Array.from(Tunnel.users.values()).join(', ');
        const sysMsg = { id: uuidv4(), sender: 'SYSTEM', text: `Connected users: ${usersList}`, type: 'system' as const, timestamp: Date.now() };
        socket.emit('new_message', sysMsg);
    } else if (cmd === '/exit') {
        // handleCommand now lacks clientId easily unless passed, we can rely on clientId parameter if needed.
        // Let's pass clientId from client to be safe. We will let terminate_Tunnel handle the core exit.
        socket.emit('new_message', { id: uuidv4(), sender: 'SYSTEM', text: 'To exit, use the TERMINATE button.', type: 'system', timestamp: Date.now() });
    } else {
        const sysMsg = { id: uuidv4(), sender: 'SYSTEM', text: `Unknown command: ${cmd}`, type: 'system' as const, timestamp: Date.now() };
        socket.emit('new_message', sysMsg);
    }
}

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
