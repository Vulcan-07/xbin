import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Skull } from 'lucide-react';

export default function Landing() {
  const [loading, setLoading] = useState(false);
  const [password, setPassword] = useState('');
  const navigate = useNavigate();

  const handleCreateSession = async () => {
    try {
      setLoading(true);
      const SERVER_URL = import.meta.env.VITE_SERVER_URL || `http://${window.location.hostname}:3001`;
      const res = await fetch(`${SERVER_URL}/api/sessions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: password || undefined })
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
    <div className="min-h-screen flex flex-col items-center justify-center relative bg-[#020202] crt-flicker overflow-hidden">
      {/* Heavy Grid Pattern Overlay */}
      <div className="absolute inset-0 z-0 opacity-40 mix-blend-screen bg-[linear-gradient(rgba(0,255,65,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(0,255,65,0.03)_1px,transparent_1px)] bg-[size:30px_30px]" />

      <div className="z-10 text-center max-w-2xl px-6 relative">
        <div className="absolute -top-32 -left-32 w-64 h-64 bg-[#00ff41] rounded-full blur-[150px] opacity-20 animate-pulse pointer-events-none" />
        <div className="flex justify-center mb-6">
          <Skull size={80} className="text-[#00ff41] drop-shadow-[0_0_15px_rgba(0,255,65,1)] animate-glitch object-contain" />
        </div>
        <h1 className="text-6xl font-bold mb-4 tracking-[0.2em] font-display text-[#00ff41] drop-shadow-[0_0_10px_#00ff41]">
          <span className="text-white">0x</span>D3ad
        </h1>
        <p className="text-[#00ff41]/80 text-xl mb-16 font-mono tracking-widest uppercase" style={{ textShadow: '0 0 5px #00ff41' }}>
          Privacy is an illusion… until you build it
        </p>

        <button
          onClick={handleCreateSession}
          disabled={loading}
          className="group relative px-10 py-5 bg-[#001100] border-2 border-[#00ff41] text-[#00ff41] text-2xl font-bold font-display uppercase tracking-[0.3em] hover:bg-[#00ff41] hover:text-black transition-all duration-300 disabled:opacity-50 overflow-hidden shadow-[0_0_20px_rgba(0,255,65,0.3)] hover:shadow-[0_0_40px_rgba(0,255,65,0.6)]"
        >
          {loading ? 'INITIALIZING_NODE...' : 'INITIALIZE_NODE'}

          {/* Scanline Effect on Button */}
          <div className="absolute inset-0 bg-scanlines opacity-0 group-hover:opacity-100 pointer-events-none" />
          <div className="absolute top-0 left-0 w-full h-1 bg-white opacity-50 group-hover:animate-pulse pointer-events-none mix-blend-overlay" />
        </button>

        <div className="mt-8 flex justify-center relative z-20">
          <input
            type="password"
            placeholder="[OPTIONAL] ACCESS_KEY"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-64 bg-[#000000] border-b-2 border-[#004400] focus:border-[#00ff41] focus:bg-[#001100] outline-none text-center text-sm font-display tracking-widest text-[#00ff41] px-4 py-3 placeholder:text-[#004400] transition-colors shadow-2xl"
          />
        </div>

      </div>

    </div>
  );
}
