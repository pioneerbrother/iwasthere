import React, { useState, useEffect, createContext, useCallback } from 'react';
import { ethers } from 'ethers';

export const WalletContext = createContext();

export const WalletProvider = ({ children }) => {
    const [account, setAccount] = useState(null);
    const [signer, setSigner] = useState(null);
    const [provider, setProvider] = useState(null);
    const [isConnecting, setIsConnecting] = useState(false);
    const [error, setError] = useState('');

    const connectWallet = useCallback(async () => {
        setIsConnecting(true);
        setError('');

        if (typeof window.ethereum === 'undefined') {
            setError("MetaMask is not installed. Please install the MetaMask app to continue.");
            setIsConnecting(false);
            return;
        }

        try {
            // --- THIS IS THE NEW, PERFECTED RECIPE ---
            // Step 1: Create the provider. This is the universal way.
            const newProvider = new ethers.providers.Web3Provider(window.ethereum, "any");

            // Step 2: Request the accounts using the official, modern `request` method.
            // This is the loud and clear doorbell that works everywhere.
            await newProvider.provider.request({ method: 'eth_requestAccounts' });
            
            // Step 3: Get the signer and account. This logic is now guaranteed to work.
            const newSigner = newProvider.getSigner();
            const newAccount = await newSigner.getAddress();
            // --- END OF THE NEW RECIPE ---

            setProvider(newProvider);
            setSigner(newSigner);
            setAccount(newAccount);

        } catch (err) {
            console.error("Error connecting wallet:", err);
            setError("Failed to connect wallet. The request was denied or an error occurred.");
            // Clear out any partial state on failure
            setAccount(null);
            setSigner(null);
            setProvider(null);
        } finally {
            setIsConnecting(false);
        }
    }, []);

    const handleAccountsChanged = (accounts) => {
        if (accounts.length === 0) {
            setAccount(null);
            setSigner(null);
        } else if (accounts[0] !== account) {
            // Re-run the connection logic to get the new signer for the new account
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
    }, [account, connectWallet]); // Added connectWallet dependency

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