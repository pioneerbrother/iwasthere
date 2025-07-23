import React from 'react';
import { Link } from 'react-router-dom';

function Header() {
  return (
    <header className="w-full max-w-lg mx-auto py-4">
      <Link to="/" className="inline-flex items-center gap-x-4 text-cream transition-opacity hover:opacity-80">
        <img 
          src="/assets/logo.png" 
          alt="I Was There Logo" 
          className="h-12 w-12"
        />
        <span className="text-3xl font-bold tracking-tight">
          I Was There
        </span>
      </Link>
        {/* --- NEW LINK TO THE GALLERY --- */}
      <Link to="/gallery" className="font-semibold text-cream hover:opacity-80 transition-opacity">
        My Chronicles
      </Link>
    </header>
  );
}

export default Header;