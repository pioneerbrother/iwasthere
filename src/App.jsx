import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import WalletProvider from './providers/WalletProvider';
import HomePage from './pages/HomePage';
import EventDetailPage from './pages/events/EventDetailPage'; // Placeholder for future event details/gallery
import Header from './components/Header';
import './App.css'; // Global app styles

function App() {
  return (
    <WalletProvider>
      <Router>
        <div className="app-container">
          <Header />
          <main>
            <Routes>
              <Route path="/" element={<HomePage />} />
              {/* This route would be for viewing a specific minted Chronicle NFT */}
              <Route path="/chronicle/:tokenId" element={<EventDetailPage />} /> 
            </Routes>
          </main>
        </div>
      </Router>
    </WalletProvider>
  );
}

export default App;