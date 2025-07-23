import React, { useEffect } from 'react';
import ReactGA from 'react-ga4';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import WalletProvider from './providers/WalletProvider';
import HomePage from './pages/HomePage';
import EventDetailPage from './pages/events/EventDetailPage';
import Header from './components/Header';
// We no longer need to import App.css

// --- Google Analytics Initialization ---
const GA_MEASUREMENT_ID = import.meta.env.VITE_GA_MEASUREMENT_ID;
if (GA_MEASUREMENT_ID) {
  ReactGA.initialize(GA_MEASUREMENT_ID);
}

function App() {
  useEffect(() => {
    if (GA_MEASUREMENT_ID) {
      ReactGA.send({ hitType: "pageview", page: window.location.pathname + window.location.search });
    }
  }, []);

  return (
    <WalletProvider>
      <Router>
        <div className="min-h-screen flex flex-col items-center p-4 font-poppins">
          <Header />
          <main className="flex-grow flex items-center justify-center w-full">
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