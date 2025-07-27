import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import './index.css';

import { Web3ReactProvider } from '@web3-react/core';
import { metaMask, hooks as metaMaskHooks } from './connectors/metaMask';

const connectors = [[metaMask, metaMaskHooks]];

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <Web3ReactProvider connectors={connectors}>
      <App />
    </Web3ReactProvider>
  </React.StrictMode>
);