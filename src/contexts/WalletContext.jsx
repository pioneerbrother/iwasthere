//
// Chef, this is the new recipe for our restaurant's front door.
// It is a universal key that works on both desktop and mobile.
// - Your Deputy Chef
//
// File Location: frontend/src/contexts/WalletContext.jsx
//

import React, { useState, useEffect, createContext, useCallback } from 'react';
import { ethers } from 'ethers';

export const WalletContext = createContext();

export const WalletProvider = ({ children }) => {
    const [account, setAccount] = useState(null);
    const [signer, setSigner] = useState(null);
    const [provider, setProvider] = useState(null);
    const [isConnecting, setIsConnecting] = useState(false);
    const [error, setError] = useState('');

    // --- THIS IS THE NEW, UNIVERSAL CONNECTION RECIPE ---
    const connectWallet = useCallback(async () => {
        setIsConnecting(true);
        setError('');

        // The key ingredient: We check if the user has a modern Web3 browser (like MetaMask mobile)
        // or an older one with the injected window.ethereum (like desktop MetaMask).
        if (typeof window.ethereum === 'undefined') {
            setError("MetaMask is not installed. Please install MetaMask to use this app.");
            // We can even be smarter and direct them to the app store.
            // window.location.href = "https://metamask.io/download/";
            setIsConnecting(false);
            return;
        }

        try {
            // Use the modern, universal provider.
            const newProvider = new ethers.providers.Web3Provider(window.ethereum, "any");

            // Request permission to connect to the user's accounts.
            await newProvider.send("eth_requestAccounts", []);
            
            const newSigner = newProvider.getSigner();
            const newAccount = await newSigner.getAddress();

            setProvider(newProvider);
            setSigner(newSigner);
            setAccount(newAccount);

        } catch (err) {
            console.error("Error connecting wallet:", err);
            setError("Failed to connect wallet. Please try again.");
            setAccount(null);
            setSigner(null);
            setProvider(null);
        } finally {
            setIsConnecting(false);
        }
    }, []);

    // This function handles what happens if the user changes their account in MetaMask
    const handleAccountsChanged = (accounts) => {
        if (accounts.length === 0) {
            // MetaMask is locked or the user has disconnected.
            setAccount(null);
            setSigner(null);
        } else if (accounts[0] !== account) {
            setAccount(accounts[0]);
            // Re-initialize the signer with the new account
            if (provider) {
                setSigner(provider.getSigner());
            }
        }
    };

    // This function handles what happens if the user changes the network (e.g., from Ethereum to Polygon)
    const handleChainChanged = () => {
        // For simplicity, we just reload the page. This is a standard and safe practice.
        window.location.reload();
    };

    // --- HOOK: Listens for changes in the user's wallet ---
    useEffect(() => {
        if (window.ethereum) {
            window.ethereum.on('accountsChanged', handleAccountsChanged);
            window.ethereum.on('chainChanged', handleChainChanged);

            // Clean up the listeners when the component is unmounted
            return () => {
                window.ethereum.removeListener('accountsChanged', handleAccountsChanged);
                window.ethereum.removeListener('chainChanged', handleChainChanged);
            };
        }
    }, [account, provider]);

    return (
        <WalletContext.Provider value={{
            account,
            signer,
            provider,
            isConnecting,
            error,
            connectWallet
        }}>
            {children}
        </WalletContext.Provider>
    );
};