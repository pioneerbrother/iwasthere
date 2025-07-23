import React, { useEffect } from 'react'; // Import useEffect
import ReactGA from 'react-ga4'; // Import react-ga4
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import WalletProvider from './providers/WalletProvider';
import HomePage from './pages/HomePage';
import EventDetailPage from './pages/events/EventDetailPage';
import Header from './components/Header';
import './App.css';

// --- INITIALIZE GOOGLE ANALYTICS ---
const GA_MEASUREMENT_ID = import.meta.env.VITE_GA_MEASUREMENT_ID;
if (GA_MEASUREMENT_ID) {
  ReactGA.initialize(GA_MEASUREMENT_ID);
}

function App() {
  // Log the initial page view
  useEffect(() => {
    if (GA_MEASUREMENT_ID) {
      ReactGA.send({ hitType: "pageview", page: window.location.pathname + window.location.search });
    }
  }, []);

  return (
    <WalletProvider>
      <Router>
        <div className="app-container">
          <Header />
          <main>
            <Routes>
              <Route path="/" element={<HomePage />} />
              <Route path="/chronicle/:tokenId" element={<EventDetailPage />} /> 
            </Routes>
          </main>
        </div>
      </Router>
    </WalletProvider>
  );
}

export default App;