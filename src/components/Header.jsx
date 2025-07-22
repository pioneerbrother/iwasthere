import React from 'react';
import { Link } from 'react-router-dom';
import './Header.css';

function Header() {
  return (
    <header className="app-header">
      <Link to="/" className="logo-container">
        {/* Placeholder for your logo image. Make sure to put i-was-there-logo.png in frontend/public/ */}
        {/* <img src="/i-was-there-logo.png" alt="I Was There Logo" className="logo-img" /> */} 
       
      </Link>
    </header>
  );
}

export default Header;