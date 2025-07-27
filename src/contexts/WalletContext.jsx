// Dosya: frontend/src/contexts/WalletContext.jsx
// Lütfen dosyanın tamamını bu kodla değiştirin.

import React, { useState, useEffect, createContext, useCallback } from 'react';
import { ethers } from 'ethers';

export const WalletContext = createContext();

export const WalletProvider = ({ children }) => {
    const [account, setAccount] = useState(null);
    const [provider, setProvider] = useState(null);
    const [isConnecting, setIsConnecting] = useState(false);
    const [error, setError] = useState('');

    // --- 1. Bağlantı Durumunu Ayarlayan Ana Fonksiyon ---
    // Bu fonksiyon, hem yeni bağlantı hem de mevcut bağlantı için durumu ayarlar.
    const setConnection = useCallback(async (ethereumProvider) => {
        try {
            const ethersProvider = new ethers.providers.Web3Provider(ethereumProvider);
            const signer = ethersProvider.getSigner();
            const signerAccount = await signer.getAddress();

            setProvider(ethersProvider);
            setAccount(signerAccount);
            setError(''); // Başarılı bağlantı sonrası hataları temizle
            console.log("Bağlantı başarıyla kuruldu:", signerAccount);
        } catch (err) {
            console.error("setConnection hatası:", err);
            setError("Cüzdan bilgileri alınamadı.");
        }
    }, []);


    // --- 2. "Connect Wallet" Butonunun Tetiklediği Fonksiyon ---
    const connectWallet = useCallback(async () => {
        // Zaten bağlıysa veya bağlanıyorsa tekrar deneme
        if (account || isConnecting) return;

        setIsConnecting(true);
        setError('');

        if (typeof window.ethereum === 'undefined') {
            const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
            if (isMobile) {
                // Kullanıcıyı MetaMask mobil uygulamasına yönlendir.
                // Bu yönlendirme sonrası sayfa değişeceği için setIsConnecting(false) demeye gerek yok.
                const deepLink = `https://metamask.app.link/dapp/${window.location.host}`;
                window.location.href = deepLink;
            } else {
                setError("MetaMask eklentisi bulunamadı. Lütfen tarayıcınıza yükleyin." );
                setIsConnecting(false);
            }
            return;
        }

        try {
            // 'eth_requestAccounts' cüzdanın açılmasını tetikler ve kullanıcıdan izin ister.
            await window.ethereum.request({ method: 'eth_requestAccounts' });
            // İzin alındıktan sonra bağlantıyı kur.
            await setConnection(window.ethereum);
        } catch (err) {
            console.error("Cüzdan bağlantı isteği reddedildi:", err);
            setError("Cüzdan bağlantı isteği reddedildi.");
        } finally {
            // Her durumda (başarılı veya başarısız) 'Connecting...' durumunu bitir.
            setIsConnecting(false);
        }
    }, [account, isConnecting, setConnection]);


    // --- 3. Olay Dinleyicilerini ve Otomatik Bağlantıyı Yöneten Ana useEffect ---
    useEffect(() => {
        if (typeof window.ethereum === 'undefined') {
            return;
        }

        // Sayfa yüklendiğinde veya cüzdandan geri dönüldüğünde
        // mevcut bir izin olup olmadığını sessizce kontrol et.
        const checkExistingConnection = async () => {
            try {
                const accounts = await window.ethereum.request({ method: 'eth_accounts' });
                if (accounts.length > 0) {
                    console.log("Mevcut yetkilendirme bulundu, bağlantı kuruluyor...");
                    await setConnection(window.ethereum);
                }
            } catch (err) {
                console.error("Mevcut bağlantı kontrolü başarısız:", err);
            }
        };

        checkExistingConnection();

        // Cüzdandaki hesap veya ağ değişikliklerini dinle
        const handleAccountsChanged = (accounts) => {
            if (accounts.length === 0) {
                setAccount(null);
                setProvider(null);
                setError("Cüzdan bağlantısı kesildi.");
            } else {
                // Hesap değişti, bağlantıyı yeniden kur.
                setConnection(window.ethereum);
            }
        };

        const handleChainChanged = () => {
            // Ağ değiştiğinde en güvenli yol bağlantıyı yeniden kurmaktır.
            setConnection(window.ethereum);
        };

        window.ethereum.on('accountsChanged', handleAccountsChanged);
        window.ethereum.on('chainChanged', handleChainChanged);

        // Cleanup: Component kaldırıldığında dinleyicileri temizle
        return () => {
            if (window.ethereum.removeListener) {
                window.ethereum.removeListener('accountsChanged', handleAccountsChanged);
                window.ethereum.removeListener('chainChanged', handleChainChanged);
            }
        };
    }, [setConnection]); // Bu useEffect sadece bir kere çalışmalı ve setConnection'a bağlı olmalı.


    return (
        <WalletContext.Provider value={{ account, provider, connectWallet, isConnecting, error }}>
            {children}
        </WalletContext.Provider>
    );
};
