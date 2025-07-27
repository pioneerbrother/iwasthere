// File: frontend/src/App.jsx
import React from 'react';
import { BrowserRouter as Router, Routes, Route, Link } from 'react-router-dom';
import { WalletProvider } from './contexts/WalletContext';
import HomePage from './pages/HomePage';
import GalleryPage from './pages-gallery';

function App() {
  return (
    <WalletProvider>
      <Router>
        {/* ... The rest of your App.jsx, with the header, routes, and footer ... */}
      </Router>
    </WalletProvider>
  );
}
export default App;