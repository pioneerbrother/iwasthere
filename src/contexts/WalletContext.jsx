//
// Şef,
// Bu, yeni yardımcınızın son ve kesin tarifidir. Donan garson sorununu
// çözmek için tasarlanmıştır. Ben sadece onun talimatlarını uyguluyorum.
// - Kalfa
//
// Dosya Konumu: frontend/src/contexts/WalletContext.jsx
//

import React, { useState, useEffect, createContext, useCallback } from 'react';
import { ethers } from 'ethers';

export const WalletContext = createContext();

export const WalletProvider = ({ children }) => {
    const [account, setAccount] = useState(null);
    const [provider, setProvider] = useState(null);
    const [signer, setSigner] = useState(null);
    const [isConnecting, setIsConnecting] = useState(false);
    const [error, setError] = useState('');

    // --- YENİ YARDIMCININ TALİMATI: Adım 1 - "Sessiz Bağlantı" Fonksiyonu ---
    // Bu fonksiyon, kullanıcı etkileşimi olmadan, sayfa yüklendiğinde
    // mevcut bir bağlantıyı sessizce kontrol etmek için kullanılacak.
    const checkExistingConnection = useCallback(async () => {
        if (typeof window.ethereum === 'undefined') return;

        try {
            // 'eth_accounts' metodu, kullanıcı onayı olmadan mevcut hesapları döndürür.
            const accounts = await window.ethereum.request({ method: 'eth_accounts' });

            if (accounts && accounts.length > 0) {
                console.log("Mevcut bağlantı bulundu:", accounts[0]);
                const newAccount = accounts[0];
                const newProvider = new ethers.providers.Web3Provider(window.ethereum);
                const newSigner = newProvider.getSigner();
                setAccount(newAccount);
                setProvider(newProvider);
                setSigner(newSigner);
            }
        } catch (err) {
            console.error("Mevcut bağlantı kontrol edilirken hata:", err);
        }
    }, []);

    // --- YENİ YARDIMCININ TALİMATI: Adım 3 - Güncellenmiş `connectWallet` Fonksiyonu ---
    const connectWallet = useCallback(async () => {
        setIsConnecting(true);
        setError('');

        if (typeof window.ethereum === 'undefined') {
            const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
            if (isMobile) {
                const deepLink = `https://metamask.app.link/dapp/${window.location.host}`;
                window.location.href = deepLink;
                return;
            } else {
                setError("MetaMask eklentisi bulunamadı. Lütfen yükleyin.");
                setIsConnecting(false);
                return;
            }
        }

        try {
            const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });

            if (!accounts || accounts.length === 0) {
                throw new Error("Cüzdan bağlantısı reddedildi.");
            }
            
            const newAccount = accounts[0];
            const newProvider = new ethers.providers.Web3Provider(window.ethereum);
            const newSigner = newProvider.getSigner();
            
            setAccount(newAccount);
            setProvider(newProvider);
            setSigner(newSigner);

        } catch (err) {
            console.error("Bağlantı Hatası:", err);
            setError(err.message || "Cüzdan bağlanamadı.");
        } finally {
            // Bu blok, try veya catch bittikten sonra HER ZAMAN çalışır.
            setIsConnecting(false);
        }
    }, []);

    // --- YENİ YARDIMCININ TALİMATI: Adım 2 - Sayfa Yüklendiğinde Kontrolü Çalıştır ---
    useEffect(() => {
        checkExistingConnection();
    }, [checkExistingConnection]);

    // Olay dinleyicileri için ikinci bir useEffect bloğu
    useEffect(() => {
        if (typeof window.ethereum === 'undefined') return;

        const handleAccountsChanged = (accounts) => {
            console.log("Hesaplar değişti:", accounts);
            if (accounts.length === 0) {
                setAccount(null);
                setProvider(null);
                setSigner(null);
                setError("Cüzdan bağlantısı kesildi.");
            } else {
                // Sadece state'i güncelle, yeniden bağlanma döngüsü yaratma
                setAccount(accounts[0]);
                const newProvider = new ethers.providers.Web3Provider(window.ethereum);
                const newSigner = newProvider.getSigner();
                setProvider(newProvider);
                setSigner(newSigner);
            }
        };

        const handleChainChanged = (_chainId) => {
            console.log("Ağ değişti:", _chainId);
            window.location.reload(); // Ağ değiştiğinde yeniden yüklemek en güvenli yöntemdir.
        };

        window.ethereum.on('accountsChanged', handleAccountsChanged);
        window.ethereum.on('chainChanged', handleChainChanged);

        return () => {
            if (window.ethereum.removeListener) {
                window.ethereum.removeListener('accountsChanged', handleAccountsChanged);
                window.ethereum.removeListener('chainChanged', handleChainChanged);
            }
        };
    }, []);

    return (
        <WalletContext.Provider value={{ account, provider, signer, connectWallet, isConnecting, error }}>
            {children}
        </WalletContext.Provider>
    );
};