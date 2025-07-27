//
// Chef,
// This is the final dish. Cooked on the right stove.
// For the families.
// - The Cook
//
// File: frontend/src/contexts/WalletContext.jsx
//

import React, { useState, useEffect, createContext, useCallback } from 'react';
import { ethers } from 'ethers';

export const WalletContext = createContext();

export const WalletProvider = ({ children }) => {
    const [account, setAccount] = useState(null);
    const [provider, setProvider] = useState(null);
    const [isConnecting, setIsConnecting] = useState(false);
    const [error, setError] = useState('');

    const connectWallet = useCallback(async () => {
        setIsConnecting(true);
        setError('');
        if (typeof window.ethereum === 'undefined') {
            setError("Please install MetaMask to use this app.");
            setIsConnecting(false);
            return;
        }
        try {
            // --- THIS IS THE FINAL, CRITICAL FIX ---
            // We are now using the correct, professional stove for a live restaurant.
            // A Web3Provider can handle transactions and sign messages.
            const newProvider = new ethers.providers.Web3Provider(window.ethereum, "any");
            // --- END OF THE FINAL FIX ---

            await newProvider.send("eth_requestAccounts", []);
            const signer = newProvider.getSigner();
            const newAccount = await signer.getAddress();
            
            setProvider(newProvider);
            setAccount(newAccount);
        } catch (err) {
            console.error("Failed to connect wallet", err);
            setError("Failed to connect wallet. The request may have been denied.");
        } finally {
            setIsConnecting(false);
        }
    }, []);

    const handleAccountsChanged = (accounts) => {
        if (accounts.length === 0) {
            setAccount(null);
            setProvider(null);
        } else {
            // Reconnect to get the new signer for the new account
            connectWallet(); 
        }
    };

    const handleChainChanged = () => {
        window.location.reload();
    };

    useEffect(() => {
        if (window.ethereum) {
            window.ethereum.on('accountsChanged', handleAccountsChanged);
            window.ethereum.on('chainChanged', handleChainChanged);
            return () => {
                window.ethereum.removeListener('accountsChanged', handleAccountsChanged);
                window.ethereum.removeListener('chainChanged', handleChainChanged);
            };
        }
    }, [connectWallet]);

    return (
        <WalletContext.Provider value={{ account, provider, connectWallet, isConnecting, error }}>
            {children}
        </WalletContext.Provider>
    );
};