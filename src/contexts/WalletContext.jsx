// File: frontend/src/contexts/WalletContext.jsx
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
            const newProvider = new ethers.providers.JsonRpcProvider(window.ethereum);
            await newProvider.send("eth_requestAccounts", []);
            const signer = newProvider.getSigner();
            const newAccount = await signer.getAddress();
            setProvider(newProvider);
            setAccount(newAccount);
        } catch (err) {
            setError("Failed to connect wallet. Please try again.");
        } finally {
            setIsConnecting(false);
        }
    }, []);

    const handleAccountsChanged = (accounts) => {
        if (accounts.length === 0) {
            setAccount(null);
            setProvider(null);
        } else {
            connectWallet();
        }
    };
    const handleChainChanged = () => { window.location.reload(); };

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
        <WalletContext.Provider value={{ account, provider, isConnecting, error, connectWallet }}>
            {children}
        </WalletContext.Provider>
    );
};