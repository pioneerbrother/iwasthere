import React, { useState, useEffect, createContext, useCallback } from 'react';
import { ethers } from 'ethers';
import { WalletContext } from '../contexts/WalletContext.jsx';

const WalletProvider = ({ children }) => {
    const [account, setAccount] = useState(null);
    const [signer, setSigner] = useState(null);
    const [chainId, setChainId] = useState(null);
    const [provider, setProvider] = useState(null);
    const [isConnecting, setIsConnecting] = useState(false);

    const connectWallet = useCallback(async () => {
        if (typeof window.ethereum === 'undefined') {
            alert("Please install MetaMask to use this application.");
            return;
        }
        setIsConnecting(true);
        try {
            // Ethers v5 syntax for browser provider
            const web3Provider = new ethers.providers.Web3Provider(window.ethereum, "any");
            await web3Provider.send("eth_requestAccounts", []);
            
            const newSigner = web3Provider.getSigner();
            const connectedAccount = await newSigner.getAddress();
            const network = await web3Provider.getNetwork();
            
            setProvider(web3Provider);
            setSigner(newSigner);
            setChainId(Number(network.chainId));
            setAccount(connectedAccount);
            console.log("WalletProvider: Successfully connected.", connectedAccount);
        } catch (error) {
            console.error("WalletProvider: Error connecting wallet.", error);
            if (error.code !== 4001) { 
                alert("An error occurred while connecting your wallet.");
            }
        } finally {
            setIsConnecting(false);
        }
    }, []);

    useEffect(() => {
        if (typeof window.ethereum === 'undefined') return;

        const handleAccountsChanged = (accounts) => {
            if (accounts.length > 0) {
                connectWallet();
            } else {
                setAccount(null);
                setSigner(null);
                setChainId(null);
                setProvider(null);
                console.log("WalletProvider: Wallet disconnected.");
            }
        };

        const handleChainChanged = () => {
            window.location.reload();
        };

        window.ethereum.on('accountsChanged', handleAccountsChanged);
        window.ethereum.on('chainChanged', handleChainChanged);

        return () => {
            window.ethereum.removeListener('accountsChanged', handleAccountsChanged);
            window.ethereum.removeListener('chainChanged', handleChainChanged);
        };
    }, [connectWallet]);

    const value = { account, signer, chainId, provider, isConnecting, connectWallet };

    return (
        <WalletContext.Provider value={value}>
            {children}
        </WalletContext.Provider>
    );
};

export default WalletProvider;