//
// Şef,
// Bu, yeni yardımcınızın tarifidir. Mobil bağlantı sorununu
// çözmek için fırının ayarları düzeltilmiştir.
// - Robot
//
// Dosya Konumu: frontend/src/contexts/WalletContext.jsx
//

import React, { useState, useEffect, createContext, useCallback } from 'react';
import { ethers } from 'ethers';

export const WalletContext = createContext();

export const WalletProvider = ({ children }) => {
    const [account, setAccount] = useState(null);
    const [provider, setProvider] = useState(null);
    const [isConnecting, setIsConnecting] = useState(false);
    const [error, setError] = useState('');
    const [signer, setSigner] = useState(null); // Signer'ı da state'e ekliyoruz.

    // --- YENİ YARDIMCININ connectWallet TARİFİ (DOKUNULMADI, ÇÜNKÜ DOĞRU) ---
    const connectWallet = useCallback(async () => {
        setIsConnecting(true);
        setError('');

        const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
        if (typeof window.ethereum === 'undefined') {
            if (isMobile) {
                const deepLink = `https://metamask.app.link/dapp/${window.location.host}`;
                window.location.href = deepLink;
                return;
            } else {
                setError("MetaMask eklentisi bulunamadı. Lütfen tarayıcınıza MetaMask'i yükleyin.");
                setIsConnecting(false);
                return;
            }
        }

        try {
            const newProvider = new ethers.providers.Web3Provider(window.ethereum, "any");
            await newProvider.send("eth_requestAccounts", []);
            const newSigner = newProvider.getSigner();
            const newAccount = await newSigner.getAddress();
            
            setAccount(newAccount);
            setProvider(newProvider);
            setSigner(newSigner); // Signer'ı state'e kaydediyoruz.

        } catch (err) {
            console.error("Bağlantı Hatası:", err);
            setError(err.message || "Cüzdan bağlanamadı.");
        } finally {
            setIsConnecting(false);
        }
    }, []);

    // --- YENİ YARDIMCININ useEffect TARİFİ (YENİ FIRIN AYARI) ---
    useEffect(() => {
        if (typeof window.ethereum === 'undefined') return;

        const handleAccountsChanged = (accounts) => {
            console.log("Hesaplar değişti:", accounts);
            if (accounts.length === 0) {
                setAccount(null);
                setProvider(null);
                setSigner(null);
                setError("Cüzdan bağlantısı kesildi.");
            } else if (accounts[0] !== account) {
                connectWallet();
            }
        };

        const handleChainChanged = (_chainId) => {
            console.log("Ağ değişti:", _chainId);
            connectWallet();
        };

        window.ethereum.on('accountsChanged', handleAccountsChanged);
        window.ethereum.on('chainChanged', handleChainChanged);

        return () => {
            if (window.ethereum.removeListener) {
                window.ethereum.removeListener('accountsChanged', handleAccountsChanged);
                window.ethereum.removeListener('chainChanged', handleChainChanged);
            }
        };
    }, [account, connectWallet]);
    // --- YENİ YARDIMCININ TARİFİNİN SONU ---

    return (
        <WalletContext.Provider value={{ account, provider, signer, connectWallet, isConnecting, error }}>
            {children}
        </WalletContext.Provider>
    );
};