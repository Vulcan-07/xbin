import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { io, Socket } from 'socket.io-client';
import Editor from '@monaco-editor/react';
import { Upload, Download, Copy, Users, Power, File as FileIcon, Trash, Lock, Send } from 'lucide-react';
import { format } from 'date-fns';
import { motion, AnimatePresence } from 'framer-motion';
import SkullLogo from './components/SkullLogo';

const SERVER_URL = import.meta.env.VITE_SERVER_URL || `http://${window.location.hostname}:3001`;

interface UserMsg {
    id: string;
    sender: string;
    text: string;
    type: 'chat' | 'system';
    timestamp: number;
}

interface UploadedFile {
    id: string;
    name: string;
    url: string;
    type: string;
    uploader: string;
    clientId: string;
}

const LANGUAGE_TEMPLATES: Record<string, string> = {
    javascript: '// New hacker Tunnel created\n\nconsole.log("Welcome to the mainframe.");',
    typescript: '// New hacker Tunnel created\n\nconst init = (): 0xD3ad => {\n  console.log("Welcome to the mainframe.");\n};\ninit();',
    python: '# New hacker Tunnel created\n\ndef init():\n    print("Welcome to the mainframe.")\n\nif __name__ == "__main__":\n    init()',
    java: 'public class Main {\n    public static 0xD3ad main(String[] args) {\n        System.out.println("Welcome to the mainframe.");\n    }\n}',
    html: '<!DOCTYPE html>\n<html lang="en">\n<head>\n    <meta charset="UTF-8">\n    <title>Mainframe</title>\n</head>\n<body>\n    <h1>Welcome to the mainframe.</h1>\n</body>\n</html>',
    css: '/* New hacker Tunnel */\n\nbody {\n    background-color: #000;\n    color: #0f0;\n    font-family: monospace;\n}',
    json: '{\n  "status": "connected",\n  "system": "mainframe"\n}',
    markdown: '# Welcome to the mainframe\n\n- System connected\n- Access granted\n',
    plaintext: 'Notes and logs...\n'
};

export default function Tunnel() {
    const { TunnelId } = useParams<{ TunnelId: string }>();
    const navigate = useNavigate();

    const [socket, setSocket] = useState<Socket | null>(null);
    const [displayName, setDisplayName] = useState(localStorage.getItem(`0x_d3ad_name_${TunnelId}`) || '');
    const [password, setPassword] = useState('');
    const [hasPassword, setHasPassword] = useState(false);
    const [isJoined, setIsJoined] = useState(false);
    const [isCreator, setIsCreator] = useState(false);
    const [users, setUsers] = useState<string[]>([]);

    const [content, setContent] = useState('');
    const [language, setLanguage] = useState('javascript');

    const [messages, setMessages] = useState<UserMsg[]>([]);
    const [chatInput, setChatInput] = useState('');

    const [files, setFiles] = useState<UploadedFile[]>([]);
    const [uploading, setUploading] = useState(false);

    const messagesEndRef = useRef<HTMLDivElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const langMenuRef = useRef<HTMLDivElement>(null);
    const [showLangMenu, setShowLangMenu] = useState(false);

    const LANGUAGES = [
        { value: 'javascript', label: 'JavaScript' },
        { value: 'typescript', label: 'TypeScript' },
        { value: 'python', label: 'Python' },
        { value: 'java', label: 'Java' },
        { value: 'html', label: 'HTML' },
        { value: 'css', label: 'CSS' },
        { value: 'json', label: 'JSON' },
        { value: 'markdown', label: 'Markdown' },
        { value: 'plaintext', label: 'Notebook' },
    ];

    // Close lang menu on outside click
    useEffect(() => {
        const handler = (e: MouseEvent) => {
            if (langMenuRef.current && !langMenuRef.current.contains(e.target as Node)) {
                setShowLangMenu(false);
            }
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, []);

    // Initialize socket and fetch initial state
    useEffect(() => {
        if (!TunnelId) return;

        // Check if Tunnel exists
        fetch(`${SERVER_URL}/api/Tunnels/${TunnelId}`)
            .then(res => {
                if (!res.ok) {
                    navigate('/');
                    throw new Error('Tunnel not found');
                }
                return res.json();
            })
            .then(data => {
                setHasPassword(data.hasPassword);
            })
            .catch((err) => {
                console.error(err);
            });

        const newSocket = io(SERVER_URL, {
            transports: ['websocket', 'polling'],
        });
        setSocket(newSocket);

        const savedName = localStorage.getItem(`0x_d3ad_name_${TunnelId}`);
        if (savedName) {
            let cId = localStorage.getItem('0x_d3ad_client_id');
            if (!cId) {
                cId = crypto.randomUUID();
                localStorage.setItem('0x_d3ad_client_id', cId);
            }
            newSocket.emit('join_Tunnel', { TunnelId, displayName: savedName, clientId: cId });
            setIsJoined(true);
        }

        return () => {
            newSocket.disconnect();
        };
    }, [TunnelId, navigate]);


    // Central Socket Listeners
    useEffect(() => {
        if (!socket) return;

        socket.on('auth_error', (msg) => {
            alert('Authentication failed: ' + msg);
            setIsJoined(false);
        });

        socket.on('error', (msg) => {
            alert(msg);
            navigate('/');
        });

        socket.on('Tunnel_joined', (data) => {
            setIsCreator(data.isCreator);
            setUsers(data.users);
            setContent(data.content);
            setLanguage(data.language);
            setFiles(data.files);
            setMessages(data.messages);
            setIsJoined(true);
        });

        return () => {
            socket.off('auth_error');
            socket.off('error');
            socket.off('Tunnel_joined');
        }
    }, [socket, navigate]);

    // Joined Socket event listeners
    useEffect(() => {
        if (!socket || !isJoined) return;

        socket.on('users_update', (newUsers) => setUsers(newUsers));

        socket.on('code_update', (data: { language: string, content: string }) => {
            setLanguage((currLang) => {
                if (currLang === data.language) setContent(data.content);
                return currLang;
            });
        });

        socket.on('language_update', (data: { language: string, content: string }) => {
            setLanguage(data.language);
            setContent(data.content);
        });

        socket.on('new_message', (msg) => {
            setMessages(prev => [...prev, msg]);
        });

        socket.on('new_file', (file) => {
            setFiles(prev => [...prev, file]);
        });

        socket.on('clear_terminal', () => {
            setMessages([]);
        });

        socket.on('file_deleted', (fileId: string) => {
            setFiles(prev => prev.filter(f => f.id !== fileId));
        });

        socket.on('Tunnel_terminated', () => {
            localStorage.removeItem(`0x_d3ad_name_${TunnelId}`);
            localStorage.removeItem('0x_d3ad_client_id');
            alert('Tunnel terminated. All local traces securely deleted.');
            navigate('/');
        });

        return () => {
            socket.off('users_update');
            socket.off('code_update');
            socket.off('language_update');
            socket.off('new_message');
            socket.off('new_file');
            socket.off('file_deleted');
            socket.off('clear_terminal');
            socket.off('Tunnel_terminated');
        };
    }, [socket, isJoined, navigate]);

    // Scroll terminal to bottom
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);


    const handleJoin = (e: React.FormEvent) => {
        e.preventDefault();
        if (!displayName.trim() || !socket) return;

        localStorage.setItem(`0x_d3ad_name_${TunnelId}`, displayName.trim());
        let cId = localStorage.getItem('0x_d3ad_client_id');
        if (!cId) {
            cId = crypto.randomUUID();
            localStorage.setItem('0x_d3ad_client_id', cId);
        }

        socket.emit('join_Tunnel', { TunnelId, displayName: displayName.trim(), clientId: cId, password });
        // We do NOT set isJoined true here anymore! We wait for Tunnel_joined event!
    };

    const handleCodeChange = (value: string | undefined) => {
        const newContent = value || '';
        setContent(newContent);
        if (socket) {
            socket.emit('code_change', { TunnelId, language, content: newContent });
        }
    };

    const handleLanguageChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const newLang = e.target.value;

        const isCurrentUnchanged = Object.values(LANGUAGE_TEMPLATES).includes(content.trim()) || content.trim() === '';

        if (isCurrentUnchanged) {
            const newTemplate = LANGUAGE_TEMPLATES[newLang] || '';
            setContent(newTemplate);
            if (socket) {
                socket.emit('code_change', { TunnelId, language: newLang, content: newTemplate });
            }
        }

        setLanguage(newLang);
        if (socket) {
            socket.emit('language_change', { TunnelId, language: newLang });
        }
    };

    const sendTerminalMsg = (e: React.FormEvent) => {
        e.preventDefault();
        if (!chatInput.trim() || !socket) return;

        socket.emit('send_message', { TunnelId, text: chatInput });
        setChatInput('');
    };

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (!e.target.files || e.target.files.length === 0) return;

        const file = e.target.files[0];
        if (file.size > 10 * 1024 * 1024) {
            alert('File size exceeds 10MB limit.');
            return;
        }

        setUploading(true);
        const formData = new FormData();
        formData.append('file', file);
        formData.append('uploader', displayName);
        formData.append('clientId', localStorage.getItem('0x_d3ad_client_id') || '');

        try {
            await fetch(`${SERVER_URL}/api/Tunnels/${TunnelId}/upload`, {
                method: 'POST',
                body: formData
            });
            // State is updated via socket broadcast
        } catch (error) {
            console.error("Upload failed", error);
            alert('Upload failed');
        } finally {
            setUploading(false);
            if (fileInputRef.current) fileInputRef.current.value = '';
        }
    };

    const deleteFile = async (fileId: string) => {
        if (!window.confirm('Are you sure you want to delete this file?')) return;
        const cId = localStorage.getItem('0x_d3ad_client_id') || '';
        try {
            const res = await fetch(`${SERVER_URL}/api/Tunnels/${TunnelId}/files/${fileId}`, {
                method: 'DELETE',
                headers: { 'x-client-id': cId }
            });
            if (!res.ok) {
                const data = await res.json();
                alert(data.error || 'Failed to delete file');
            }
        } catch (err) {
            console.error('Delete failed:', err);
        }
    };

    const terminateTunnel = () => {
        if (socket && window.confirm('Are you sure you want to terminate this Tunnel and delete all data?')) {
            const cId = localStorage.getItem('0x_d3ad_client_id');
            socket.emit('terminate_Tunnel', { TunnelId, clientId: cId });
        }
    };

    const PurgeTunnel = () => {
        if (window.confirm('Disconnect and Purge this Tunnel?')) {
            if (socket) socket.disconnect();
            localStorage.removeItem(`0x_d3ad_name_${TunnelId}`);
            localStorage.removeItem('0x_d3ad_client_id');
            navigate('/');
        }
    };

    const copyCode = () => {
        navigator.clipboard.writeText(content);
    };

    const copyUrl = () => {
        navigator.clipboard.writeText(window.location.href);
    };

    const forceDownload = async (fileUrl: string, fileName: string) => {
        try {
            const response = await fetch(`${SERVER_URL}${fileUrl}`);
            const blob = await response.blob();
            const blobUrl = window.URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = blobUrl;
            link.download = fileName;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            window.URL.revokeObjectURL(blobUrl);
        } catch (err) {
            console.error("Download failed:", err);
            window.open(`${SERVER_URL}${fileUrl}`, '_blank');
        }
    };


    if (!isJoined) {
        return (
            <div className="min-h-[100dvh] flex items-center justify-center bg-cyber-base relative overflow-hidden selection:bg-cyber-blue/30 p-4">
                <div className="absolute inset-0 z-0 opacity-20 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-cyber-blue via-cyber-base to-cyber-base animate-gradient-xy" />

                <form onSubmit={handleJoin} className="relative z-10 p-6 md:p-8 rounded-2xl border border-white/5 bg-cyber-surface/60 backdrop-blur-3xl shadow-[0_0_50px_rgba(59,130,246,0.05)] max-w-md w-full mx-auto">
                    <div className="flex items-center mb-8 text-cyber-textBright">
                        <div className="p-2 bg-cyber-blue/10 rounded-lg mr-4 border border-cyber-blue/20">
                            <Lock size={20} className="text-cyber-blue" />
                        </div>
                        <h2 className="text-xl font-medium tracking-wide">Enter Secure Vault</h2>
                    </div>
                    <div className="mb-6">
                        <label className="block text-xs text-cyber-text mb-2 font-medium">Tunnel Alias</label>
                        <input
                            type="text"
                            autoFocus
                            value={displayName}
                            onChange={(e) => setDisplayName(e.target.value)}
                            className="w-full bg-black/20 border border-white/10 rounded-xl focus:border-cyber-blue/50 focus:bg-black/40 outline-none text-cyber-textBright px-4 py-3 placeholder:text-cyber-text/30 transition-all shadow-inner"
                            placeholder="e.g. Ghost"
                            required
                        />
                    </div>
                    {hasPassword && (
                        <div className="mb-6">
                            <label className="block text-xs text-cyber-text mb-2 font-medium">Access Key</label>
                            <input
                                type="password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                className="w-full bg-black/20 border border-white/10 rounded-xl focus:border-cyber-blue/50 focus:bg-black/40 outline-none text-cyber-textBright px-4 py-3 placeholder:text-cyber-text/30 transition-all shadow-inner"
                                placeholder="Enter Access Key"
                                required
                            />
                        </div>
                    )}
                    <button type="submit" className="w-full bg-cyber-blue/10 border border-cyber-blue/30 text-white font-medium rounded-xl py-3 mt-4 hover:bg-cyber-blue/20 transition-all duration-300 shadow-[0_0_20px_rgba(59,130,246,0.1)]">
                        Establish Connection
                    </button>
                </form>
            </div>
        );
    }

    return (
        <motion.div
            initial={{ opacity: 0, filter: 'blur(5px)' }}
            animate={{ opacity: 1, filter: 'blur(0px)' }}
            transition={{ duration: 0.8 }}
            className="h-[100dvh] flex flex-col bg-cyber-base text-cyber-textBright font-sans selection:bg-cyber-blue/30 p-2 gap-2"
        >

            {/* Header */}
            <header className="h-auto md:h-14 py-3 md:py-0 rounded-xl border border-white/5 flex flex-col md:flex-row items-center justify-between px-4 md:px-6 bg-cyber-surface/40 backdrop-blur-md shadow-sm shrink-0 gap-3 md:gap-0">
                <div className="flex items-center space-x-4 md:space-x-6 w-full md:w-auto justify-between md:justify-start">
                    <div className="font-semibold text-white flex items-center text-lg">
                        <SkullLogo size={20} className="mr-3 text-[#00ff41] drop-shadow-[0_0_5px_rgba(0,255,65,0.8)]" />
                        0xD3ad
                    </div>
                    <div className="flex items-center space-x-2 md:space-x-3 text-xs bg-black/20 border border-white/5 px-3 md:px-4 py-1.5 rounded-lg">
                        <span className="text-cyber-text hidden md:inline">Tunnel</span>
                        <span className="font-mono text-cyber-textBright">{TunnelId}</span>
                        <button onClick={copyUrl} className="ml-1 text-cyber-text hover:text-cyber-blue transition-colors" title="Copy URL">
                            <Copy size={14} />
                        </button>
                    </div>
                </div>

                <div className="flex items-center space-x-2 md:space-x-3 text-xs font-medium w-full md:w-auto justify-end">
                    <div className="flex items-center px-4 py-1.5 bg-cyber-blue/10 border border-cyber-blue/20 text-cyber-blue rounded-lg shadow-[0_0_10px_rgba(59,130,246,0.1)]">
                        <Users size={14} className="mr-2" />
                        {users.length} Active
                    </div>

                    {isCreator && (
                        <button onClick={terminateTunnel} title="Burn Tunnel for everyone" className="flex items-center text-red-400 hover:text-white border border-red-500/30 bg-red-500/10 px-4 py-1.5 rounded-lg hover:bg-red-500/20 transition-colors">
                            <Power size={14} className="mr-2" />
                            Burn
                        </button>
                    )}

                    <button onClick={PurgeTunnel} title="Disconnect from Tunnel" className="flex items-center text-cyber-text hover:text-white border border-white/10 bg-black/20 px-4 py-1.5 rounded-lg hover:bg-white/5 transition-colors">
                        Purge
                    </button>
                </div>
            </header>

            {/* Main Content */}
            <div className="flex-1 flex flex-col md:flex-row gap-2 overflow-y-auto md:overflow-hidden h-full pb-2 md:pb-0 scroll-smooth">

                {/* Left Panel: Editor */}
                <div className="min-h-[50vh] md:min-h-0 flex-1 flex flex-col rounded-xl border border-white/5 relative bg-[#0b101c]/80 overflow-hidden backdrop-blur-md shadow-lg shrink-0">
                    <div className="h-12 border-b border-white/5 flex items-center justify-between px-6 bg-cyber-surface/40 z-10">
                        <div ref={langMenuRef} className="relative">
                            <button
                                onClick={() => setShowLangMenu(p => !p)}
                                className="flex items-center gap-2 bg-black/20 text-cyber-textBright border border-white/10 rounded-md px-3 py-1.5 text-xs outline-none hover:border-cyber-blue/40 cursor-pointer shadow-inner transition-colors"
                            >
                                {LANGUAGES.find(l => l.value === language)?.label ?? 'Language'}
                                <svg className={`w-3 h-3 opacity-50 transition-transform ${showLangMenu ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                            </button>
                            <AnimatePresence>
                            {showLangMenu && (
                                <motion.div
                                    initial={{ opacity: 0, y: -4 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0, y: -4 }}
                                    transition={{ duration: 0.15 }}
                                    className="absolute left-0 top-full mt-1 z-50 min-w-[130px] bg-[#0e1525] border border-white/10 rounded-xl shadow-2xl overflow-hidden backdrop-blur-xl"
                                >
                                    {LANGUAGES.map(lang => (
                                        <button
                                            key={lang.value}
                                            onClick={() => {
                                                handleLanguageChange({ target: { value: lang.value } } as React.ChangeEvent<HTMLSelectElement>);
                                                setShowLangMenu(false);
                                            }}
                                            className={`w-full text-left px-4 py-2 text-xs transition-colors ${
                                                language === lang.value
                                                    ? 'text-cyber-blue bg-cyber-blue/10'
                                                    : 'text-cyber-textBright hover:bg-white/5'
                                            }`}
                                        >
                                            {lang.label}
                                        </button>
                                    ))}
                                </motion.div>
                            )}
                            </AnimatePresence>
                        </div>
                        <button onClick={copyCode} className="text-xs flex items-center text-cyber-text hover:text-white transition-colors bg-white/5 hover:bg-white/10 px-3 py-1.5 rounded-md border border-white/5">
                            <Copy size={14} className="mr-2" /> Copy Code
                        </button>
                    </div>
                    <div className="flex-1 overflow-hidden pt-2">
                        <Editor
                            height="100%"
                            defaultLanguage="javascript"
                            language={language}
                            theme="vs-dark"
                            value={content}
                            onChange={handleCodeChange}
                            options={{
                                minimap: { enabled: false },
                                fontSize: 14,
                                fontFamily: '"JetBrains Mono", monospace',
                                scrollBeyondLastLine: false,
                                smoothScrolling: true,
                                cursorBlinking: "smooth",
                                cursorStyle: 'line',
                                roundedSelection: true,
                                padding: { top: 16 }
                            }}
                        />
                    </div>
                </div>

                {/* Right Panel: Chat & Files */}
                <div className="w-full md:w-[400px] h-[70vh] md:h-auto flex flex-col gap-2 relative shrink-0">

                    {/* Chat Area */}
                    <div className="flex-1 flex flex-col rounded-xl border border-white/5 bg-cyber-surface/30 backdrop-blur-md overflow-hidden shadow-lg min-h-[50%]">
                        <div className="h-12 bg-cyber-surface/50 border-b border-white/5 flex items-center px-6 text-xs font-semibold text-cyber-textBright tracking-wider gap-2 shadow-sm">
                            <SkullLogo size={14} className="text-[#00ff41] drop-shadow-[0_0_5px_rgba(0,255,65,0.8)]" />
                            Void
                        </div>

                        <div className="flex-1 overflow-y-auto p-5 text-sm space-y-4">
                            <AnimatePresence initial={false}>
                                {messages.map(msg => {
                                    const isMe = msg.sender === displayName;
                                    return (
                                        <motion.div
                                            key={msg.id}
                                            initial={{ opacity: 0, y: 10, scale: 0.98 }}
                                            animate={{ opacity: 1, y: 0, scale: 1 }}
                                            className={`flex flex-col ${msg.type === 'system' ? 'items-center' : (isMe ? 'items-end' : 'items-start')}`}
                                        >
                                            {msg.type === 'system' ? (
                                                <div className="text-[10px] uppercase tracking-wider text-cyber-text/50 bg-black/20 px-3 py-1 rounded-full border border-white/5 shadow-sm">
                                                    {msg.text}
                                                </div>
                                            ) : (
                                                <>
                                                    <span className="text-[10px] text-cyber-text/60 mb-1 ml-1 mr-1">
                                                        {isMe ? 'You' : msg.sender} • {format(msg.timestamp, 'HH:mm')}
                                                    </span>
                                                    <div className={`px-4 py-2.5 rounded-2xl max-w-[90%] break-words leading-relaxed shadow-sm ${isMe
                                                        ? 'bg-cyber-blue/20 text-white border border-cyber-blue/20 rounded-tr-sm shadow-[0_0_15px_rgba(59,130,246,0.1)]'
                                                        : 'bg-white/5 text-cyber-textBright border border-white/5 rounded-tl-sm'
                                                        }`}>
                                                        {msg.text}
                                                    </div>
                                                </>
                                            )}
                                        </motion.div>
                                    );
                                })}
                            </AnimatePresence>
                            <div ref={messagesEndRef} />
                        </div>

                        <form onSubmit={sendTerminalMsg} className="p-4 bg-cyber-surface/40 border-t border-white/5 flex items-center gap-2">
                            <input
                                type="text"
                                value={chatInput}
                                onChange={e => setChatInput(e.target.value)}
                                className="flex-1 bg-black/20 border border-white/10 outline-none text-cyber-textBright placeholder:text-cyber-text/40 rounded-xl px-4 py-2.5 text-sm shadow-inner focus:border-cyber-blue/40 transition-colors"
                                placeholder="Message Tunnel..."
                            />
                            <button type="submit" disabled={!chatInput.trim()} className="bg-cyber-blue/10 text-cyber-blue p-2.5 rounded-xl border border-cyber-blue/20 hover:bg-cyber-blue/20 disabled:opacity-50 transition-colors">
                                <Send size={16} />
                            </button>
                        </form>
                    </div>

                    {/* Files Area */}
                    <div className="h-1/3 flex flex-col rounded-xl border border-white/5 bg-cyber-surface/30 backdrop-blur-md overflow-hidden shadow-lg shrink-0">
                        <div className="h-12 bg-cyber-surface/50 border-b border-white/5 flex items-center justify-between px-6 text-xs font-semibold text-cyber-textBright tracking-wider shadow-sm">
                            <div className="flex items-center gap-2">
                                <FileIcon size={14} className="text-cyber-accent" />
                                Payload
                            </div>

                            <button
                                onClick={() => fileInputRef.current?.click()}
                                disabled={uploading}
                                className="text-cyber-blue hover:text-blue-400 bg-cyber-blue/10 hover:bg-cyber-blue/20 border border-cyber-blue/20 px-3 py-1.5 rounded-md flex items-center disabled:opacity-50 transition-colors shadow-sm"
                            >
                                <Upload size={14} className="mr-1.5" />
                                {uploading ? 'UPLOADING...' : 'UPLOAD'}
                            </button>
                            <input
                                type="file"
                                ref={fileInputRef}
                                className="hidden"
                                onChange={handleFileUpload}
                            />
                        </div>

                        <div className="flex-1 overflow-y-auto p-3 space-y-2">
                            {uploading && (
                                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="h-1 bg-cyber-surface/50 rounded-full overflow-hidden w-full relative">
                                    <motion.div animate={{ x: ['-100%', '100%'] }} transition={{ repeat: Infinity, duration: 1 }} className="absolute inset-0 bg-cyber-blue/50 blur-[2px]" />
                                </motion.div>
                            )}
                            {files.length === 0 ? (
                                <div className="text-cyber-text/40 text-xs text-center mt-6 uppercase tracking-wider">NO FILES ATTACHED</div>
                            ) : (
                                <AnimatePresence>
                                    {files.map((file, i) => (
                                        <motion.div
                                            key={file.id || i}
                                            initial={{ opacity: 0, x: 20 }}
                                            animate={{ opacity: 1, x: 0 }}
                                            exit={{ opacity: 0, scale: 0.9 }}
                                            className="flex items-center justify-between p-3 bg-white/5 hover:bg-white/10 border border-white/5 rounded-lg text-sm group transition-colors shadow-sm"
                                        >
                                            <div className="flex items-center truncate mr-3 text-cyber-textBright">
                                                <div className="p-2 bg-black/20 rounded border border-white/5 mr-3 group-hover:text-cyber-blue transition-colors shadow-inner">
                                                    <FileIcon size={14} className="opacity-80" />
                                                </div>
                                                <div className="flex flex-col truncate">
                                                    <span className="truncate text-sm font-medium tracking-tight border-b border-transparent group-hover:border-cyber-text/20 transition-colors pb-[1px] inline-block w-max max-w-full">{file.name}</span>
                                                    <span className="text-[10px] text-cyber-text truncate tracking-wide">Relay: {file.uploader}</span>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                {file.clientId === localStorage.getItem('0x_d3ad_client_id') && (
                                                    <button
                                                        onClick={() => deleteFile(file.id)}
                                                        className="text-cyber-text/50 hover:text-red-400 p-2 rounded-lg hover:bg-red-500/10 transition-all opacity-0 group-hover:opacity-100 scale-95 group-hover:scale-100"
                                                        title="Delete File"
                                                    >
                                                        <Trash size={14} />
                                                    </button>
                                                )}
                                                <button
                                                    onClick={() => forceDownload(file.url, file.name)}
                                                    className="text-cyber-text/50 hover:text-cyber-blue p-2 rounded-lg hover:bg-cyber-blue/10 transition-all opacity-0 group-hover:opacity-100 scale-95 group-hover:scale-100"
                                                    title="Download File"
                                                >
                                                    <Download size={14} />
                                                </button>
                                            </div>
                                        </motion.div>
                                    ))}
                                </AnimatePresence>
                            )}
                        </div>
                    </div>

                </div>
            </div>
        </motion.div>
    );
}
