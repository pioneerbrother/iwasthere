//
// Bu son. Bu, çalışmak zorunda.
//
// Dosya: frontend/src/contexts/WalletContext.jsx
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
            setError("Lütfen bu uygulamayı kullanmak için MetaMask mobil uygulamasındaki tarayıcıyı kullanın.");
            setIsConnecting(false);
            return;
        }

        try {
            // --- BU, SON VE KESİN ÇÖZÜMDÜR ---
            // Adım 1: Cüzdandan hesapları istemenin en temel, en direkt yolu.
            // Ethers.js katmanı olmadan, doğrudan cüzdanla konuşuyoruz.
            const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });

            if (!accounts || accounts.length === 0) {
                throw new Error("Cüzdan bağlantısı reddedildi.");
            }
            
            const newAccount = accounts[0];
            
            // Adım 2: Bağlantı başarılı OLDUKTAN SONRA, ethers.js'i oluşturuyoruz.
            const newProvider = new ethers.providers.Web3Provider(window.ethereum);
            
            setAccount(newAccount);
            setProvider(newProvider);
            // --- SON ---

        } catch (err) {
            console.error("Bağlantı Hatası:", err);
            setError(err.message || "Cüzdan bağlanamadı. İstek kullanıcı tarafından reddedilmiş olabilir.");
        } finally {
            setIsConnecting(false);
        }
    }, []);

    // Bu fonksiyonlar, cüzdan durumu değişikliklerini yönetmek için gereklidir.
    useEffect(() => {
        const handleAccountsChanged = (accounts) => {
            if (accounts.length > 0 && accounts[0] !== account) {
                // Hesap değiştiğinde durumu yeniden senkronize et
                connectWallet();
            } else if (accounts.length === 0) {
                setAccount(null);
                setProvider(null);
            }
        };

        const handleChainChanged = () => {
            window.location.reload();
        };

        if (window.ethereum) {
            window.ethereum.on('accountsChanged', handleAccountsChanged);
            window.ethereum.on('chainChanged', handleChainChanged);

            return () => {
                window.ethereum.removeListener('accountsChanged', handleAccountsChanged);
                window.ethereum.removeListener('chainChanged', handleChainChanged);
            };
        }
    }, [account, connectWallet]);

    return (
        <WalletContext.Provider value={{ account, provider, connectWallet, isConnecting, error }}>
            {children}
        </WalletContext.Provider>
    );
};