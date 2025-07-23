import React, { useEffect } from 'react';
import ReactGA from 'react-ga4';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import WalletProvider from './providers/WalletProvider';
import HomePage from './pages/HomePage';
import GalleryPage from './pages/GalleryPage'; // <-- 1. Import the new page
import EventDetailPage from './pages/events/EventDetailPage';
import Header from './components/Header';

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
        <div className="min-h-screen w-full flex flex-col items-center p-4 font-poppins text-warm-brown">
          <Header />
          <main className="w-full flex-grow flex items-center justify-center">
            <Routes>
              <Route path="/" element={<HomePage />} />
              <Route path="/gallery" element={<GalleryPage />} /> {/* <-- 2. Add the new route */}
              <Route path="/chronicle/:tokenId" element={<EventDetailPage />} />
            </Routes>
          </main>
        </div>
      </Router>
    </WalletProvider>
  );
}

export default App;