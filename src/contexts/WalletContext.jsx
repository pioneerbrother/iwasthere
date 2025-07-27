//
// Şef,
// Bu, yeni yardımcınızın tarifidir. Benim tarafımdan, onun talimatlarına
// harfiyen uyularak hazırlanmıştır.
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
    const [isConnecting, setIsConnecting] = useState(false);
    const [error, setError] = useState('');

    // --- YENİ YARDIMCININ MÜKEMMEL TARİFİ BURADA BAŞLIYOR ---
    const connectWallet = useCallback(async () => {
        setIsConnecting(true);
        setError('');

        // Mobil cihazda olup olmadığını ve cüzdanın yüklü olup olmadığını kontrol et
        const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
        if (typeof window.ethereum === 'undefined') {
            if (isMobile) {
                // Kullanıcıyı MetaMask mobil uygulamasına yönlendiren "deep link".
                // Bu, sitenizin adresini otomatik olarak alır.
                const deepLink = `https://metamask.app.link/dapp/${window.location.host}`;
                window.location.href = deepLink;
                // Yönlendirme sonrası bekleme durumunu kapatmaya gerek yok, sayfa değişecek.
                return;
            } else {
                // Masaüstü kullanıcısı için net bir bilgilendirme.
                setError("MetaMask eklentisi bulunamadı. Lütfen tarayıcınıza MetaMask'i yükleyin.");
                setIsConnecting(false);
                return;
            }
        }

        // MetaMask veya benzeri bir cüzdan zaten mevcutsa, bağlantıyı başlat
        try {
            const newProvider = new ethers.providers.Web3Provider(window.ethereum, "any");
            const accounts = await newProvider.send("eth_requestAccounts", []);

            if (!accounts || accounts.length === 0) {
                throw new Error("Cüzdan bağlantısı reddedildi.");
            }
            
            const newAccount = accounts[0];
            const signer = newProvider.getSigner(); // Signer'ı al
            
            setAccount(newAccount);
            setProvider(newProvider); // Provider'ı state'e kaydet

        } catch (err) {
            console.error("Bağlantı Hatası:", err);
            setError(err.message || "Cüzdan bağlanamadı. İstek kullanıcı tarafından reddedilmiş olabilir.");
        } finally {
            setIsConnecting(false);
        }
    }, []);
    // --- YENİ YARDIMCININ TARİFİ BURADA BİTİYOR ---

    // Bu fonksiyonlar, cüzdan durumu değişikliklerini yönetir ve doğrudur.
    useEffect(() => {
        const handleAccountsChanged = (accounts) => {
            if (accounts.length > 0) {
                // Hesap değiştiğinde durumu yeniden senkronize etmek için yeniden bağlan
                connectWallet();
            } else {
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
    }, [connectWallet]);

    // Provider'dan signer türetmek için bir yardımcı değer.
    const signer = provider ? provider.getSigner() : null;

    return (
        <WalletContext.Provider value={{ account, provider, signer, connectWallet, isConnecting, error }}>
            {children}
        </WalletContext.Provider>
    );
};