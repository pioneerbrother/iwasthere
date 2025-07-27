//
// Chef,
// This is the final, correct recipe for our restaurant's table setting.
// We are now putting the fork and knife on the table BEFORE we serve the food.
// This will fix the mobile error, once and for all.
// - Your Deputy Chef
//
// File Location: frontend/src/App.jsx
//

import React from 'react';
import { BrowserRouter as Router, Routes, Route, Link } from 'react-router-dom';

// --- THE CRITICAL INGREDIENT ---
// We import the WalletProvider, which is our "fork and knife."
import { WalletProvider } from './contexts/WalletContext';
// --- END OF CRITICAL INGREDIENT ---

import HomePage from './pages/HomePage';
import GalleryPage from './pages/GalleryPage';
// You can import your logo here if you have it as an SVG or PNG
// import logo from './assets/logo.png'; 

function App() {
  return (
    // --- THE PERFECT TABLE SETTING ---
    // We wrap our ENTIRE restaurant (the Router and all the pages)
    // inside the WalletProvider. This ensures that the "fork and knife"
    // are on the table and ready for every single dish we serve.
    <WalletProvider>
      <Router>
        <div className="min-h-screen bg-cream text-warm-brown font-sans flex flex-col items-center p-4">
          <header className="w-full max-w-6xl mx-auto py-4">
            <Link to="/" className="flex items-center justify-center space-x-2">
              {/* <img src={logo} alt="I Was There Logo" className="h-12 w-12" /> */}
              <h1 className="text-3xl font-bold">I Was There</h1>
            </Link>
            <nav className="flex justify-center space-x-6 mt-4">
              <Link to="/" className="text-lg hover:text-sage-green">Home</Link>
              <Link to="/gallery" className="text-lg hover:text-sage-green">My Chronicles</Link>
            </nav>
          </header>

          <main className="w-full flex-grow flex items-center justify-center py-8">
            <Routes>
              <Route path="/" element={<HomePage />} />
              <Route path="/gallery" element={<GalleryPage />} />
            </Routes>
          </main>

          <footer className="w-full max-w-6xl mx-auto py-4 text-center text-warm-brown/70 text-sm">
            <p>© {new Date().getFullYear()} I Was There. All Rights Reserved.</p>
          </footer>
        </div>
      </Router>
    </WalletProvider>
    // --- END OF PERFECT TABLE SETTING ---
  );
}

export default App;