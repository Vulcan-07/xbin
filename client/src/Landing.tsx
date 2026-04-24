import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Terminal, Shield, Zap } from 'lucide-react';

export default function Landing() {
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleCreateSession = async () => {
    try {
      setLoading(true);
      const SERVER_URL = import.meta.env.VITE_SERVER_URL || 'http://localhost:3001';
      const res = await fetch(`${SERVER_URL}/api/sessions`, {
        method: 'POST',
      });
      const data = await res.json();
      if (data.sessionId) {
        navigate(`/${data.sessionId}`);
      }
    } catch (error) {
      console.error('Failed to create session:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center relative bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-[#0a1a0a] via-[#000] to-[#000]">
      {/* Background Grid Pattern */}
      <div className="absolute inset-0 z-0 opacity-20 pointer-events-none" style={{ backgroundImage: 'linear-gradient(rgba(0,255,0,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(0,255,0,0.1) 1px, transparent 1px)', backgroundSize: '30px 30px' }} />
      
      <div className="z-10 text-center max-w-2xl px-6">
        <div className="flex justify-center mb-6">
          <Terminal size={64} className="text-hacker-green animate-pulse" />
        </div>
        <h1 className="text-5xl font-bold mb-4 tracking-tighter">
          <span className="text-white">SYS_</span>PASTE
        </h1>
        <p className="text-hacker-greenDark text-lg mb-8" style={{ textShadow: '0 0 5px #00ff0033' }}>
          Real-time collaborative workspace. Ephemeral by design. 
          Auto-destruct sequence engaged at 24.00h.
        </p>

        <button 
          onClick={handleCreateSession}
          disabled={loading}
          className="group relative px-8 py-4 bg-transparent border-2 border-hacker-green text-hacker-green text-xl font-bold rounded-sm uppercase tracking-widest hover:bg-hacker-green hover:text-black transition-all duration-300 disabled:opacity-50"
        >
          {loading ? 'Initializing...' : 'Initialize_Session'}
          
          {/* Glitch Effect on Hover via pseudo elements, kept simple here with glow */}
          <div className="absolute inset-0 opacity-0 group-hover:opacity-100 shadow-[0_0_20px_#00ff00] transition-opacity duration-300 pointer-events-none" />
        </button>

        <div className="mt-16 grid grid-cols-1 md:grid-cols-3 gap-8 text-sm text-left">
          <div className="p-4 border border-[#003300] bg-[#050505]/50 backdrop-blur-sm rounded">
            <Zap className="mb-2 text-[#00ff00]" size={24} />
            <h3 className="font-bold mb-1">Live Sync</h3>
            <p className="text-hacker-greenDark text-xs">Real-time code, chat & terminal synced via WebSockets.</p>
          </div>
          <div className="p-4 border border-[#003300] bg-[#050505]/50 backdrop-blur-sm rounded">
            <Shield className="mb-2 text-[#00ff00]" size={24} />
            <h3 className="font-bold mb-1">Ephemeral</h3>
            <p className="text-hacker-greenDark text-xs">Data vanishes after 24 hrs. Completely trackless.</p>
          </div>
          <div className="p-4 border border-[#003300] bg-[#050505]/50 backdrop-blur-sm rounded">
            <Terminal className="mb-2 text-[#00ff00]" size={24} />
            <h3 className="font-bold mb-1">Terminal UI</h3>
            <p className="text-hacker-greenDark text-xs">Aesthetic designed for hackers, exclusively dark theme.</p>
          </div>
        </div>
      </div>
      
    </div>
  );
}
