// File Location: frontend/src/connectors/metaMask.js

// File: frontend/src/connectors/metaMask.js
import { initializeConnector } from '@web3-react/core';
import { MetaMask } from '@web3-react/metamask';

// This is the correct way to export both the connector and its hooks.
export const [metaMask, hooks] = initializeConnector((actions) => new MetaMask({ actions }));