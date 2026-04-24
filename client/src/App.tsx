import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Landing from './Landing';
import Session from './Session';

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
