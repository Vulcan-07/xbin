import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Landing from './Landing.tsx';
import Session from './Session.tsx';

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/:sessionId" element={<Session />} />
      </Routes>
    </Router>
  );
}

export default App;
