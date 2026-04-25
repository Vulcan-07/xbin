import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Skull, Lock, Zap, Shield, Activity } from 'lucide-react';
import { motion, useMotionValue, useTransform } from 'framer-motion';

export default function Landing() {
  const [loading, setLoading] = useState(false);
  const [password, setPassword] = useState('');
  const [statusText, setStatusText] = useState('NODE STANDBY');
  const [geoData, setGeoData] = useState({ ip: '8.8.8.8', loc: 'MOUNTAIN VIEW, US' });
  const navigate = useNavigate();

  useEffect(() => {
    fetch('https://ipapi.co/json/')
      .then(res => res.json())
      .then(data => {
        if (data.ip) {
          setGeoData({
            ip: data.ip,
            loc: `${data.city ? data.city.toUpperCase() : 'UNKNOWN'}, ${data.country_name ? data.country_name.toUpperCase() : '??'}`
          });
        }
      })
      .catch(() => {
        // Fallback silently to Google
      });
  }, []);

  // Parallax
  const mouseX = useMotionValue(0);
  const mouseY = useMotionValue(0);
  const x = useTransform(mouseX, [-1000, 1000], [-15, 15]);
  const y = useTransform(mouseY, [-1000, 1000], [-15, 15]);

  const handleMouseMove = (e: React.MouseEvent) => {
    mouseX.set(e.clientX - window.innerWidth / 2);
    mouseY.set(e.clientY - window.innerHeight / 2);
  };

  const handleCreateTunnel = async () => {
    try {
      setLoading(true);
      setStatusText('NEGOTIATING HANDSHAKE...');
      const SERVER_URL = import.meta.env.VITE_SERVER_URL || `http://${window.location.hostname}:3001`;

      const res = await fetch(`${SERVER_URL}/api/Tunnels`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: password || undefined })
      });

      const data = await res.json();
      if (data.TunnelId) {
        setStatusText('CONNECTION SECURED. ROUTING...');
        setTimeout(() => navigate(`/${data.TunnelId}`), 600);
      }
    } catch (error) {
      console.error('Failed to create Tunnel:', error);
      setStatusText('CONNECTION SEVERED.');
      setLoading(false);
    }
  };

  return (
    <div onMouseMove={handleMouseMove} className="min-h-[100dvh] flex flex-col items-center justify-center relative bg-cyber-base overflow-hidden selection:bg-cyber-blue/30 font-sans">

      {/* Cinematic Background */}
      <div className="absolute inset-0 z-0 bg-[radial-gradient(circle_at_50%_50%,_#151D2F_0%,_#0B1120_100%)] opacity-80" />

      {/* Slow Moving Digital Mesh */}
      <motion.div
        animate={{ backgroundPosition: ['0px 0px', '40px 40px'] }}
        transition={{ repeat: Infinity, duration: 15, ease: "linear" }}
        className="absolute inset-0 z-0 opacity-10"
        style={{ backgroundImage: 'linear-gradient(rgba(255,255,255,0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.05) 1px, transparent 1px)', backgroundSize: '40px 40px' }}
      />

      {/* Signal Sweep Scanline */}
      <motion.div
        animate={{ top: ['-10%', '110%'] }}
        transition={{ duration: 6, repeat: Infinity, ease: 'linear' }}
        className="absolute left-0 w-full h-32 bg-gradient-to-b from-transparent via-cyber-blue/5 to-transparent z-0 pointer-events-none mix-blend-screen"
      />

      {/* Small UI HUD Elements */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1, duration: 2 }}
        className="absolute top-6 left-6 text-[10px] font-mono text-cyber-text/30 flex flex-col gap-1 tracking-widest uppercase"
      >
        <span className="flex items-center gap-2 animate-pulse"><Activity size={10} className="text-cyber-accent" /> Encrypted Relay Active</span>
        <span>IP: {geoData.ip}</span>
        <span>LOC: {geoData.loc}</span>
      </motion.div>

      {/* Main Content */}
      <motion.div
        style={{ x, y }}
        initial={{ opacity: 0, y: 30, filter: 'blur(10px)' }}
        animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
        transition={{ duration: 1.2, ease: [0.16, 1, 0.3, 1] }}
        className="z-10 text-center max-w-2xl px-6 relative w-full"
      >
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 0.3, duration: 1.5, ease: "easeOut" }}
          className="flex justify-center mb-10 relative"
        >
          {/* Subtle Backglow */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-48 h-48 bg-cyber-blue/10 rounded-full blur-[80px] pointer-events-none" />

          <div className="relative flex justify-center items-center h-[96px]">
            <Skull size={80} className="text-[#00ff41] drop-shadow-[0_0_20px_rgba(0,255,65,0.8)]" />
          </div>
        </motion.div>

        <h1 className="text-4xl md:text-5xl font-medium mb-5 tracking-tight text-transparent bg-clip-text bg-gradient-to-br from-white to-white/40">
          Privacy is an illusion…
        </h1>
        <p className="text-cyber-text text-lg mb-10 font-light tracking-wide max-w-lg mx-auto flex items-center justify-center gap-2">
          <span className="opacity-70">until you build it.</span>
        </p>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6, duration: 1 }}
          className="flex flex-col items-center gap-5"
        >
          <div className="relative group w-72">
            <input
              type="password"
              placeholder="Set access key (optional)"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-cyber-surface/40 backdrop-blur-xl border border-white/5 focus:border-cyber-blue/30 focus:bg-cyber-surface/70 outline-none text-center text-sm text-cyber-textBright px-5 py-4 rounded-xl placeholder:text-cyber-text/40 transition-all duration-300 shadow-[inset_0_2px_10px_rgba(0,0,0,0.2)]"
            />
            <Lock size={14} className="absolute left-5 top-1/2 -translate-y-1/2 text-cyber-text/30 group-focus-within:text-cyber-blue/60 group-focus-within:drop-shadow-[0_0_5px_rgba(59,130,246,0.5)] transition-all" />
          </div>

          <button
            onClick={handleCreateTunnel}
            disabled={loading}
            className="group relative px-8 py-4 bg-white/[0.03] backdrop-blur-md border border-white/10 text-cyber-textBright text-sm font-medium rounded-xl hover:bg-cyber-blue/10 hover:border-cyber-blue/30 hover:text-white transition-all duration-500 disabled:opacity-50 overflow-hidden shadow-[0_4px_20px_rgba(0,0,0,0.3)] hover:shadow-[0_0_30px_rgba(59,130,246,0.15)] w-72 flex items-center justify-center gap-3"
          >
            {/* Edge Lighting Hover Effect */}
            <span className="absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-cyber-blue/40 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />

            {loading ? 'Initializing Transport...' : 'Start Anonymous Tunnel'}
            {!loading && <Zap size={14} className="text-cyber-text/50 group-hover:text-cyber-accent group-hover:scale-110 transition-all duration-500" />}
          </button>

          {/* Subtle System Status Text */}
          <div className="h-4 mt-2">
            <motion.span
              key={statusText}
              initial={{ opacity: 0, filter: 'blur(4px)' }}
              animate={{ opacity: 1, filter: 'blur(0px)' }}
              className="text-[10px] font-mono tracking-[0.2em] text-cyber-text/40 uppercase"
            >
              {statusText}
            </motion.span>
          </div>
        </motion.div>
      </motion.div>

      {/* Footer Branding */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1.5, duration: 2 }}
        className="absolute bottom-8 left-1/2 -translate-x-1/2 flex items-center gap-2 text-[10px] font-mono text-cyber-text/20 tracking-widest"
      >
        <Shield size={10} /> ZERO-FOOTPRINT PROTOCOL
      </motion.div>
    </div>
  );
}
