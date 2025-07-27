// File Location: frontend/src/main.jsx

import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import './index.css';

// --- THE NEW STOVE'S PLUMBING ---
import { MetaMask } from '@web3-react/metamask';
import { Web3ReactProvider } from '@web3-react/core';
import { hooks as metaMaskHooks } from './connectors/metaMask';
// --- END OF NEW PLUMBING ---

// We create an array of all the "plugs" our app will use. For now, it's just MetaMask.
const connectors = [[metaMaskHooks, MetaMask]];

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    {/* We wrap our entire App in the new, professional Web3ReactProvider */}
    <Web3ReactProvider connectors={connectors}>
      <App />
    </Web3ReactProvider>
  </React.StrictMode>
);
