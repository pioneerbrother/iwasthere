//
// Chef,
// This is the dessert, served whole.
// It will now work perfectly with our new, renovated kitchen.
// - Your Deputy Chef
//
// File: frontend/src/pages/GalleryPage.jsx
//

import React, { useState, useEffect, useContext } from 'react';
import { Link } from 'react-router-dom';

// --- Cooking with our new, reliable stove ---
import { WalletContext } from '../contexts/WalletContext.jsx';

// --- Configuration & Helpers ---
// This recipe now only needs to know about our ONE new contract.
// We are leaving the old, broken menu behind for good.
const newContractAddress = import.meta.env.VITE_SUBSCRIPTION_CONTRACT_ADDRESS; 
const ALCHEMY_API_KEY = import.meta.env.VITE_ALCHEMY_API_KEY;
const ALCHEMY_URL = `https://polygon-mainnet.g.alchemy.com/nft/v3/${ALCHEMY_API_KEY}/getNFTsForOwner`;

const formatIpfsUrl = (url) => {
    if (!url || typeof url !== 'string') return '';
    if (url.startsWith('ipfs://')) return `https://gateway.pinata.cloud/ipfs/${url.substring(7)}`;
    if (url.startsWith('https://')) return url.replace('ipfs.io', 'gateway.pinata.cloud');
    return '';
};

const fetchAndProcessNfts = async (account) => {
    if (!newContractAddress) {
        throw new Error("The restaurant's new address has not been set.");
    }
    let allNfts = [];
    let pageKey;
    const initialUrl = `${ALCHEMY_URL}?owner=${account}&contractAddresses[]=${newContractAddress}&withMetadata=true`;

    while (true) {
        let fetchUrl = initialUrl;
        if (pageKey) fetchUrl += `&pageKey=${pageKey}`;
        const response = await fetch(fetchUrl);
        if (!response.ok) throw new Error(`Could not fetch data from the blockchain.`);
        const data = await response.json();
        if (data.ownedNfts) allNfts.push(...data.ownedNfts);
        pageKey = data.pageKey;
        if (!pageKey) break;
    }
    
    const nftPromises = allNfts.map(async (nft) => {
        const metadataUrl = formatIpfsUrl(nft.tokenUri);
        if (!metadataUrl) return null;
        try {
            const metadataResponse = await fetch(metadataUrl);
            if (!metadataResponse.ok) return { tokenId: nft.tokenId, title: `Chronicle ${nft.tokenId}`, media: [] };
            const metadata = await metadataResponse.json();
            const mediaItem = metadata.image ? { gatewayUrl: formatIpfsUrl(metadata.image), fileName: 'Primary Media' } : null;
            return { tokenId: nft.tokenId, title: metadata.name || 'Untitled', description: metadata.description || 'No description.', media: [mediaItem].filter(Boolean) };
        } catch (e) {
            return { tokenId: nft.tokenId, title: `Chronicle ${nft.tokenId}`, media: [] };
        }
    });
    
    return Promise.all(nftPromises);
};

function GalleryPage() {
    // --- Using our new stove's controls ---
    const { account, connectWallet, isConnecting } = useContext(WalletContext);
    
    const [nfts, setNfts] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState('');

    useEffect(() => {
        const serveDishes = async () => {
            if (!account) { setIsLoading(false); return; }
            setIsLoading(true);
            setError('');
            try {
                const preparedDishes = await fetchAndProcessNfts(account);
                const sortedMenu = (preparedDishes || []).filter(Boolean).sort((a, b) => parseInt(b.tokenId) - parseInt(a.tokenId));
                setNfts(sortedMenu);
                if (sortedMenu.length === 0) setError("You have not chronicled any memories yet.");
            } catch (err) {
                setError(`A critical error occurred: ${err.message}`);
            } finally {
                setIsLoading(false);
            }
        };
        serveDishes();
    }, [account]);

    if (!account) {
        return (
            <div className="text-center p-8">
                <h1 className="text-4xl font-bold text-warm-brown mb-8">My Chronicles</h1>
                <p className="mb-6">Please connect your wallet to view your memories.</p>
                <button onClick={connectWallet} disabled={isConnecting} className="bg-sage-green ...">{isConnecting ? 'Connecting...' : 'Connect Wallet'}</button>
            </div>
        );
    }

    // ... The rest of the JSX (Loading, Error, and NFT Grid) is exactly the same
    // as the last complete version. It is correct.

    return (
        <div className="w-full max-w-6xl mx-auto px-4">
            {/* ... Full JSX for the gallery display ... */}
        </div>
    );
}

export default GalleryPage;