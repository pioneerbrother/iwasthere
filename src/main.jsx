//
// File: frontend/src/main.jsx
// The final, clean version.
//

import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import './index.css';

// All of the broken web3-react imports are now gone.
// This is the simple, correct foundation.

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)