import React from 'react';
import { Link } from 'react-router-dom';

// We no longer need to import Header.css

function Header() {
  return (
    // The header is a flex container, centered, with padding, and a max-width.
    // It spans the full width of its container.
    <header className="w-full max-w-lg mx-auto py-6">
      <Link to="/" className="inline-flex items-center gap-x-3 text-white transition-opacity hover:opacity-80">
        {/* You can place an SVG or <img> for your logo here */}
        {/* Example SVG icon */}
        <svg 
          xmlns="http://www.w3.org/2000/svg" 
          width="36" 
          height="36" 
          viewBox="0 0 24 24" 
          fill="currentColor"
        >
          <path d="M12,2C6.48,2,2,6.48,2,12s4.48,10,10,10,10-4.48,10-10S17.52,2,12,2z M12,20c-4.41,0-8-3.59-8-8s3.59-8,8-8 s8,3.59,8,8S16.41,20,12,20z M11,15h2v2h-2V15z M11,7h2v6h-2V7z"/>
        </svg>

        {/* The text is large, bold, and has tight letter spacing for a modern look. */}
        <span className="text-3xl font-bold tracking-tight">
          I Was There
        </span>
      </Link>
    </header>
  );
}

export default Header;