import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { io, Socket } from 'socket.io-client';
import Editor from '@monaco-editor/react';
import { Upload, Download, Copy, Users, Power, File as FileIcon, Trash, Skull } from 'lucide-react';
import { format } from 'date-fns';

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
    javascript: '// New hacker session created\n\nconsole.log("Welcome to the mainframe.");',
    typescript: '// New hacker session created\n\nconst init = (): void => {\n  console.log("Welcome to the mainframe.");\n};\ninit();',
    python: '# New hacker session created\n\ndef init():\n    print("Welcome to the mainframe.")\n\nif __name__ == "__main__":\n    init()',
    java: 'public class Main {\n    public static void main(String[] args) {\n        System.out.println("Welcome to the mainframe.");\n    }\n}',
    html: '<!DOCTYPE html>\n<html lang="en">\n<head>\n    <meta charset="UTF-8">\n    <title>Mainframe</title>\n</head>\n<body>\n    <h1>Welcome to the mainframe.</h1>\n</body>\n</html>',
    css: '/* New hacker session */\n\nbody {\n    background-color: #000;\n    color: #0f0;\n    font-family: monospace;\n}',
    json: '{\n  "status": "connected",\n  "system": "mainframe"\n}',
    markdown: '# Welcome to the mainframe\n\n- System connected\n- Access granted\n',
    plaintext: 'Notes and logs...\n'
};

export default function Session() {
    const { sessionId } = useParams<{ sessionId: string }>();
    const navigate = useNavigate();

    const [socket, setSocket] = useState<Socket | null>(null);
    const [displayName, setDisplayName] = useState(localStorage.getItem(`0x_d3ad_name_${sessionId}`) || '');
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

    // Initialize socket and fetch initial state
    useEffect(() => {
        if (!sessionId) return;

        // Check if session exists
        fetch(`${SERVER_URL}/api/sessions/${sessionId}`)
            .then(res => {
                if (!res.ok) {
                    navigate('/');
                    throw new Error('Session not found');
                }
                return res.json();
            })
            .then(data => {
                setHasPassword(data.hasPassword);
            })
            .catch((err) => {
                console.error(err);
            });

        const newSocket = io(SERVER_URL);
        setSocket(newSocket);

        const savedName = localStorage.getItem(`0x_d3ad_name_${sessionId}`);
        if (savedName) {
            let cId = localStorage.getItem('0x_d3ad_client_id');
            if (!cId) {
                cId = crypto.randomUUID();
                localStorage.setItem('0x_d3ad_client_id', cId);
            }
            newSocket.emit('join_session', { sessionId, displayName: savedName, clientId: cId });
            setIsJoined(true);
        }

        return () => {
            newSocket.disconnect();
        };
    }, [sessionId, navigate]);


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

        socket.on('session_joined', (data) => {
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
            socket.off('session_joined');
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

        socket.on('session_terminated', () => {
            localStorage.removeItem(`0x_d3ad_name_${sessionId}`);
            localStorage.removeItem('0x_d3ad_client_id');
            alert('Session terminated. All local traces securely deleted.');
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
            socket.off('session_terminated');
        };
    }, [socket, isJoined, navigate]);

    // Scroll terminal to bottom
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);


    const handleJoin = (e: React.FormEvent) => {
        e.preventDefault();
        if (!displayName.trim() || !socket) return;

        localStorage.setItem(`0x_d3ad_name_${sessionId}`, displayName.trim());
        let cId = localStorage.getItem('0x_d3ad_client_id');
        if (!cId) {
            cId = crypto.randomUUID();
            localStorage.setItem('0x_d3ad_client_id', cId);
        }

        socket.emit('join_session', { sessionId, displayName: displayName.trim(), clientId: cId, password });
        // We do NOT set isJoined true here anymore! We wait for session_joined event!
    };

    const handleCodeChange = (value: string | undefined) => {
        const newContent = value || '';
        setContent(newContent);
        if (socket) {
            socket.emit('code_change', { sessionId, language, content: newContent });
        }
    };

    const handleLanguageChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const newLang = e.target.value;

        const isCurrentUnchanged = Object.values(LANGUAGE_TEMPLATES).includes(content.trim()) || content.trim() === '';

        if (isCurrentUnchanged) {
            const newTemplate = LANGUAGE_TEMPLATES[newLang] || '';
            setContent(newTemplate);
            if (socket) {
                socket.emit('code_change', { sessionId, language: newLang, content: newTemplate });
            }
        }

        setLanguage(newLang);
        if (socket) {
            socket.emit('language_change', { sessionId, language: newLang });
        }
    };

    const sendTerminalMsg = (e: React.FormEvent) => {
        e.preventDefault();
        if (!chatInput.trim() || !socket) return;

        socket.emit('send_message', { sessionId, text: chatInput });
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
            await fetch(`${SERVER_URL}/api/sessions/${sessionId}/upload`, {
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
            const res = await fetch(`${SERVER_URL}/api/sessions/${sessionId}/files/${fileId}`, {
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

    const terminateSession = () => {
        if (socket && window.confirm('Are you sure you want to terminate this session and delete all data?')) {
            const cId = localStorage.getItem('0x_d3ad_client_id');
            socket.emit('terminate_session', { sessionId, clientId: cId });
        }
    };

    const leaveSession = () => {
        if (window.confirm('Disconnect and leave this session?')) {
            if (socket) socket.disconnect();
            localStorage.removeItem(`0x_d3ad_name_${sessionId}`);
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
            <div className="min-h-screen flex items-center justify-center bg-black crt-flicker">
                <form onSubmit={handleJoin} className="p-8 border-2 border-[#00ff41] bg-[#020202] shadow-[0_0_30px_rgba(0,255,65,0.2)] max-w-md w-full relative group">
                    <div className="absolute top-0 left-0 w-full h-[2px] bg-[#00ff41] shadow-[0_0_10px_#00ff41]" />
                    <div className="flex items-center mb-8 text-[#00ff41]">
                        <Skull className="mr-3" />
                        <h2 className="text-2xl font-bold font-display tracking-widest outline-none">AUTH_REQUIRED</h2>
                    </div>
                    <div className="mb-6">
                        <label className="block text-xs text-hacker-greenDark mb-2 uppercase">ALIAS / IDENTIFIER</label>
                        <input
                            type="text"
                            autoFocus
                            value={displayName}
                            onChange={(e) => setDisplayName(e.target.value)}
                            className="w-full bg-[#000000] border-b-2 border-[#004400] focus:border-[#00ff41] focus:bg-[#051505] outline-none text-[#00ff41] px-3 py-3 font-mono placeholder:text-[#004400] transition-colors"
                            placeholder="e.g. Neo"
                            required
                        />
                    </div>
                    {hasPassword && (
                        <div className="mb-6">
                            <label className="block text-xs text-hacker-greenDark mb-2 uppercase">PASSWORD</label>
                            <input
                                type="password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                className="w-full bg-[#000000] border-b-2 border-[#004400] focus:border-[#00ff41] focus:bg-[#051505] outline-none text-[#00ff41] px-3 py-3 font-mono placeholder:text-[#004400] transition-colors"
                                placeholder="Enter Access Key"
                                required
                            />
                        </div>
                    )}
                    <button type="submit" className="w-full bg-[#00ff41] text-black font-bold font-display tracking-widest py-3 mt-4 hover:bg-[#33ff33] hover:shadow-[0_0_15px_#00ff41] transition-all duration-300">
                        [ INITIATE_HANDSHAKE ]
                    </button>
                </form>
            </div>
        );
    }

    return (
        <div className="h-screen flex flex-col bg-black text-[#00ff41] crt-flicker">
            {/* Header */}
            <header className="h-14 border-b border-[#004400] flex items-center justify-between px-6 bg-[#020202]">
                <div className="flex items-center space-x-6">
                    <div className="font-bold text-white flex items-center font-display text-xl tracking-wider">
                        <Skull size={20} className="mr-2 text-[#00ff41] drop-shadow-[0_0_5px_rgba(0,255,65,0.8)]" />
                        0xD3ad
                    </div>
                    <div className="flex items-center space-x-2 text-xs border border-[#00ff41] px-3 py-1 bg-[#001100]">
                        <span className="text-gray-400 font-display">SESSION:</span>
                        <span className="font-bold text-[#00ff41]">{sessionId}</span>
                        <button onClick={copyUrl} className="ml-2 hover:text-white" title="Copy URL"><Copy size={12} /></button>
                    </div>
                </div>

                <div className="flex items-center space-x-4 text-sm">
                    <div className="flex items-center px-3 py-1 bg-opacity-20 bg-hacker-green text-hacker-green rounded-sm">
                        <Users size={14} className="mr-2" />
                        {users.length} ONLINE
                    </div>

                    {isCreator && (
                        <button onClick={terminateSession} title="Destroy session for everyone" className="flex items-center text-red-500 hover:text-red-400 border border-red-900 px-3 py-1 rounded-sm hover:bg-red-900/30 transition-colors">
                            <Power size={14} className="mr-2" />
                            TERMINATE
                        </button>
                    )}

                    <button onClick={leaveSession} title="Disconnect from session" className="flex items-center text-gray-400 hover:text-white border border-[#004400] px-3 py-1 rounded-sm hover:bg-[#002200] transition-colors">
                        LEAVE
                    </button>
                </div>
            </header>

            {/* Main Content */}
            <div className="flex-1 flex overflow-hidden">

                {/* Left Panel: Editor */}
                <div className="flex-1 flex flex-col border-r border-[#004400] relative bg-[linear-gradient(rgba(0,255,65,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(0,255,65,0.02)_1px,transparent_1px)] bg-[size:20px_20px]">
                    <div className="h-10 border-b border-[#004400] flex items-center justify-between px-4 bg-[#000000] z-10">
                        <select
                            value={language}
                            onChange={handleLanguageChange}
                            className="bg-black text-[#00ff41] border border-[#00ff41] px-2 py-1 text-xs outline-none focus:bg-[#001100] font-display uppercase tracking-widest cursor-pointer"
                        >
                            <option value="javascript">JavaScript</option>
                            <option value="typescript">TypeScript</option>
                            <option value="python">Python</option>
                            <option value="java">Java</option>
                            <option value="html">HTML</option>
                            <option value="css">CSS</option>
                            <option value="json">JSON</option>
                            <option value="markdown">Markdown</option>
                            <option value="plaintext">Notebook</option>
                        </select>
                        <button onClick={copyCode} className="text-xs flex items-center hover:text-white transition-colors">
                            <Copy size={14} className="mr-1" /> Copy Code
                        </button>
                    </div>
                    <div className="flex-1 opacity-95">
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
                                fontFamily: '"Fira Code", monospace',
                                scrollBeyondLastLine: false,
                                smoothScrolling: true,
                                cursorBlinking: "smooth",
                                cursorStyle: 'block'
                            }}
                        />
                    </div>
                </div>

                {/* Right Panel: Chat & Files */}
                <div className="w-[450px] flex flex-col bg-[#000000] relative bg-[linear-gradient(rgba(0,255,65,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(0,255,65,0.02)_1px,transparent_1px)] bg-[size:20px_20px]">

                    {/* Terminal Chat */}
                    <div className="flex-1 flex flex-col min-h-0 border-b border-[#004400] z-10">
                        <div className="h-10 bg-[#001100] border-b border-[#00ff41] flex items-center px-4 text-xs font-bold text-[#00ff41] font-display tracking-widest">
                            SYS_TERM // COMMLINK
                        </div>

                        <div className="flex-1 overflow-y-auto p-4 font-mono text-sm space-y-2 bg-transparent text-[#00ff41] drop-shadow-[0_0_2px_rgba(0,255,65,0.8)]">
                            {messages.map(msg => (
                                <div key={msg.id} className={`${msg.type === 'system' ? 'text-gray-500 italic' : ''}`}>
                                    <span className="opacity-50 mr-2 text-xs">[{format(msg.timestamp, 'HH:mm:ss')}]</span>
                                    {msg.type === 'system' ? (
                                        <span>* {msg.text}</span>
                                    ) : (
                                        <span><span className={msg.sender === displayName ? 'text-[#00ffff]' : 'text-hacker-green'}>{msg.sender}</span>: {msg.text}</span>
                                    )}
                                </div>
                            ))}
                            <div ref={messagesEndRef} />
                        </div>

                        <form onSubmit={sendTerminalMsg} className="p-3 border-t border-[#004400] bg-[#020202] flex items-center">
                            <span className="text-[#00ff41] mr-3 font-bold">root@0xD3ad:~#</span>
                            <input
                                type="text"
                                value={chatInput}
                                onChange={e => setChatInput(e.target.value)}
                                className="flex-1 bg-transparent outline-none text-[#00ff41] placeholder:text-[#004400] font-mono tracking-tight"
                                placeholder="Type cmd..."
                            />
                        </form>
                    </div>

                    {/* Files Area */}
                    <div className="h-1/3 flex flex-col min-h-0 z-10 bg-black/80">
                        <div className="h-10 bg-[#001100] border-y border-[#00ff41] flex items-center justify-between px-4 text-xs font-bold text-[#00ff41] font-display tracking-widest">
                            FILE_SHARE

                            <button
                                onClick={() => fileInputRef.current?.click()}
                                disabled={uploading}
                                className="text-[#00ff41] hover:text-white flex items-center disabled:opacity-50 hover:shadow-[0_0_5px_#00ff41]"
                            >
                                <Upload size={14} className="mr-1" />
                                {uploading ? 'UP...' : 'UPLOAD'}
                            </button>
                            <input
                                type="file"
                                ref={fileInputRef}
                                className="hidden"
                                onChange={handleFileUpload}
                            />
                        </div>

                        <div className="flex-1 overflow-y-auto p-2 space-y-1">
                            {files.length === 0 ? (
                                <div className="text-gray-600 text-xs text-center mt-4">NO_FILES_DETECTED</div>
                            ) : (
                                files.map((file, i) => (
                                    <div key={i} className="flex items-center justify-between p-2 hover:bg-[#001100] border border-transparent hover:border-[#00ff41] text-sm group transition-all">
                                        <div className="flex items-center truncate mr-2 text-gray-300 drop-shadow-[0_0_2px_rgba(255,255,255,0.4)]">
                                            <FileIcon size={14} className="mr-2 text-gray-500" />
                                            <span className="truncate">{file.name}</span>
                                            <span className="ml-2 text-[10px] text-hacker-greenDark truncate max-w-[80px]">[{file.uploader}]</span>
                                        </div>
                                        <div className="flex items-center">
                                            {file.clientId === localStorage.getItem('0x_d3ad_client_id') && (
                                                <button
                                                    onClick={() => deleteFile(file.id)}
                                                    className="text-gray-500 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity mr-3"
                                                    title="Delete File"
                                                >
                                                    <Trash size={16} />
                                                </button>
                                            )}
                                            <button
                                                onClick={() => forceDownload(file.url, file.name)}
                                                className="text-gray-500 hover:text-[#00ff00] opacity-0 group-hover:opacity-100 transition-opacity"
                                                title="Download File"
                                            >
                                                <Download size={16} />
                                            </button>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>

                </div>
            </div>
        </div>
    );
}
