import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Landing from './Landing.tsx';
import Tunnel from './Tunnel.tsx';

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/:TunnelId" element={<Tunnel />} />
      </Routes>
    </Router>
  );
}

export default App;
