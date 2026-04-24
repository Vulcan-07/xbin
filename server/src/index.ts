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

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: process.env.CLIENT_URL || '*',
    methods: ['GET', 'POST']
  }
});

app.use(cors());
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
    // We'll store files in subdirectories based on session
    const sessionId = req.params.sessionId as string;
    const sessionDir = path.join(UPLOADS_DIR, sessionId);
    if (!fs.existsSync(sessionDir)) {
      fs.mkdirSync(sessionDir, { recursive: true });
    }
    cb(null, sessionDir);
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
interface Session {
  id: string;
  creatorClientId: string | null;
  contents: Record<string, string>;
  language: string;
  users: Map<string, string>; // socketId -> displayName
  files: Array<{ name: string, url: string, type: string }>;
  messages: Array<{ id: string, sender: string, text: string, type: 'chat' | 'system', timestamp: number }>;
  createdAt: number;
}

const sessions: Map<string, Session> = new Map();

// Helper to cleanup sessions (24h TTL)
const cleanupSessions = () => {
    const now = Date.now();
    const TTL = 24 * 60 * 60 * 1000;
    
    sessions.forEach((session, sessionId) => {
        if (now - session.createdAt > TTL) {
            deleteSession(sessionId);
        }
    });
};

setInterval(cleanupSessions, 60 * 60 * 1000); // Check every hour

const deleteSession = (sessionId: string) => {
    sessions.delete(sessionId);
    // Cleanup files
    const sessionDir = path.join(UPLOADS_DIR, sessionId);
    if (fs.existsSync(sessionDir)) {
        fs.rmSync(sessionDir, { recursive: true, force: true });
    }
    io.to(sessionId).emit('session_terminated');
}

// API Routes
app.post('/api/sessions', (req, res) => {
  const sessionId = uuidv4().substring(0, 8); // Short ID for pastebin style
  sessions.set(sessionId, {
    id: sessionId,
    creatorClientId: null, // Will be set on first connect
    contents: { 'javascript': '// New hacker session created\n\nconsole.log("Welcome to the mainframe.");' },
    language: 'javascript',
    users: new Map(),
    files: [],
    messages: [
        { id: uuidv4(), sender: 'SYSTEM', text: `Session ${sessionId} initialized.`, type: 'system', timestamp: Date.now() }
    ],
    createdAt: Date.now()
  });
  res.json({ sessionId });
});

app.get('/health', (req, res) => {
    res.status(200).send('OK');
});

app.get('/api/sessions/:sessionId', (req, res) => {
    const session = sessions.get(req.params.sessionId);
    if (!session) {
        return res.status(404).json({ error: 'Session not found' });
    }
    res.json({
        id: session.id,
        content: session.contents[session.language] || '',
        language: session.language,
        files: session.files,
        messages: session.messages,
        usersCount: session.users.size
    });
});

app.post('/api/sessions/:sessionId/upload', upload.single('file'), (req, res) => {
    const sessionId = req.params.sessionId as string;
    const session = sessions.get(sessionId);
    
    if (!session) {
        return res.status(404).json({ error: 'Session not found' });
    }

    if (!req.file) {
        return res.status(400).json({ error: 'No file uploaded' });
    }

    const fileUrl = `/uploads/${sessionId}/${req.file.filename}`;
    const newFile = {
        name: req.file.originalname,
        url: fileUrl,
        type: req.file.mimetype
    };

    session.files.push(newFile);
    
    // Notify room
    io.to(sessionId).emit('new_file', newFile);
    
    // System message
    const msg = { 
        id: uuidv4(), 
        sender: 'SYSTEM', 
        text: `File uploaded: ${req.file.originalname}`, 
        type: 'system' as const, 
        timestamp: Date.now() 
    };
    session.messages.push(msg);
    io.to(sessionId).emit('new_message', msg);

    res.json(newFile);
});


// Socket handling
io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  socket.on('join_session', ({ sessionId, displayName, clientId }) => {
    const session = sessions.get(sessionId);
    
    if (!session) {
        socket.emit('error', 'Session not found');
        return;
    }

    if (!session.creatorClientId) {
        session.creatorClientId = clientId;
    }

    socket.join(sessionId);
    session.users.set(socket.id, displayName);

    const isCreator = session.creatorClientId === clientId;
    socket.emit('session_joined', { isCreator, users: Array.from(session.users.values()) });

    // Notify others
    const joinMsg = { 
        id: uuidv4(), 
        sender: 'SYSTEM', 
        text: `${displayName} connected.`, 
        type: 'system' as const, 
        timestamp: Date.now() 
    };
    session.messages.push(joinMsg);
    io.to(sessionId).emit('new_message', joinMsg);
    
    io.to(sessionId).emit('users_update', Array.from(session.users.values()));
  });

  socket.on('code_change', ({ sessionId, language, content }) => {
      const session = sessions.get(sessionId);
      if (session) {
          session.contents[language] = content;
          socket.to(sessionId).emit('code_update', { language, content });
      }
  });

  socket.on('language_change', ({ sessionId, language }) => {
    const session = sessions.get(sessionId);
    if (session) {
        session.language = language;
        const content = session.contents[language] || '';
        io.to(sessionId).emit('language_update', { language, content });
    }
  });

  socket.on('send_message', ({ sessionId, text }) => {
      const session = sessions.get(sessionId);
      if (session) {
          const displayName = session.users.get(socket.id) || 'Unknown User';
          
          if (text.startsWith('/')) {
              // Command handling
              handleCommand(socket, session, text);
              return;
          }

          const msg = { 
            id: uuidv4(), 
            sender: displayName, 
            text, 
            type: 'chat' as const, 
            timestamp: Date.now() 
        };
          session.messages.push(msg);
          io.to(sessionId).emit('new_message', msg);
      }
  });

  socket.on('terminate_session', ({ sessionId, clientId }) => {
      const session = sessions.get(sessionId);
      if (session && session.creatorClientId === clientId) {
          deleteSession(sessionId);
      }
  });


  socket.on('disconnect', () => {
      sessions.forEach((session, sessionId) => {
          if (session.users.has(socket.id)) {
              const displayName = session.users.get(socket.id);
              session.users.delete(socket.id);
              
              const leaveMsg = { 
                id: uuidv4(), 
                sender: 'SYSTEM', 
                text: `${displayName} disconnected.`, 
                type: 'system' as const, 
                timestamp: Date.now() 
            };
              session.messages.push(leaveMsg);
              io.to(sessionId).emit('new_message', leaveMsg);
              io.to(sessionId).emit('users_update', Array.from(session.users.values()));
              
              // If creator leaves, we might want to auto-assign new creator, 
              // or just let it live until TTL. We'll let it live.
          }
      });
      console.log('User disconnected:', socket.id);
  });
});

function handleCommand(socket: Socket, session: Session, commandText: string) {
    const parts = commandText.split(' ');
    const cmd = parts[0];

    const displayName = session.users.get(socket.id);
    
    if (cmd === '/clear') {
        socket.emit('clear_terminal');
    } else if (cmd === '/who') {
        const usersList = Array.from(session.users.values()).join(', ');
        const sysMsg = { id: uuidv4(), sender: 'SYSTEM', text: `Connected users: ${usersList}`, type: 'system' as const, timestamp: Date.now() };
        socket.emit('new_message', sysMsg);
    } else if (cmd === '/exit') {
         // handleCommand now lacks clientId easily unless passed, we can rely on clientId parameter if needed.
         // Let's pass clientId from client to be safe. We will let terminate_session handle the core exit.
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
