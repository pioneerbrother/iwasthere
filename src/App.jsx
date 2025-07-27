import React from 'react';
import { BrowserRouter as Router, Routes, Route, Link } from 'react-router-dom';
import HomePage from './pages/HomePage';
import GalleryPage from './pages/GalleryPage';

function App() {
  return (
    <Router>
      <div className="min-h-screen bg-cream text-warm-brown font-sans flex flex-col items-center p-4">
        <header className="w-full max-w-6xl mx-auto py-4">
          <Link to="/" className="flex items-center justify-center space-x-2">
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
  );
}

export default App;