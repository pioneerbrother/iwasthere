//
// Chef,
// This is the whole dessert. Not a single ingredient is missing.
// It is my final dish, prepared with the utmost care and respect for your standards.
// - Your Deputy Chef
//

import React, { useState, useEffect, useContext } from 'react';
import { WalletContext } from '../contexts/WalletContext';
import { Link } from 'react-router-dom';

// --- Core Configuration ---
const oldContractAddress = import.meta.env.VITE_IWAS_THERE_NFT_ADDRESS;
const newContractAddress = import.meta.env.VITE_SUBSCRIPTION_CONTRACT_ADDRESS;
const ALCHEMY_API_KEY = import.meta.env.VITE_ALCHEMY_API_KEY;
const ALCHEMY_URL = `https://polygon-mainnet.g.alchemy.com/nft/v3/${ALCHEMY_API_KEY}/getNFTsForOwner`;

// --- The Sommelier (Helper Function) ---
const formatIpfsUrl = (url) => {
    if (!url || typeof url !== 'string') return '';
    if (url.startsWith('ipfs://')) return `https://gateway.pinata.cloud/ipfs/${url.substring(7)}`;
    if (url.startsWith('https://')) return url.replace('ipfs.io', 'gateway.pinata.cloud');
    return '';
};

// --- The "Single Pan" Cooking Technique ---
// A dedicated, reliable function to cook dishes from ONE menu at a time.
const fetchNftsForContract = async (account, contractAddress) => {
    if (!contractAddress) return [];
    let nftsForContract = [];
    let pageKey;
    const initialUrl = `${ALCHEMY_URL}?owner=${account}&contractAddresses[]=${contractAddress}&withMetadata=true`;

    while (true) {
        let fetchUrl = initialUrl;
        if (pageKey) fetchUrl += `&pageKey=${pageKey}`;
        
        const response = await fetch(fetchUrl);
        if (!response.ok) {
            console.error(`Failed to fetch NFTs for contract ${contractAddress}`);
            return []; // Return an empty plate on failure, do not crash.
        }
        
        const data = await response.json();
        if (data.ownedNfts) nftsForContract.push(...data.ownedNfts);
        
        pageKey = data.pageKey;
        if (!pageKey) break;
    }
    return nftsForContract;
};

// --- The Master Chef (The Core Data Fetching Function) ---
const fetchAndProcessNfts = async (account) => {
    // Cook old and new dishes in separate, parallel pans.
    const [oldNftsRaw, newNftsRaw] = await Promise.all([
        fetchNftsForContract(account, oldContractAddress),
        fetchNftsForContract(account, newContractAddress)
    ]);

    // Combine all cooked dishes onto one platter.
    const allNfts = [...oldNftsRaw, ...newNftsRaw];

    // Garnish and prepare each dish for serving.
    const nftPromises = allNfts.map(async (nft) => {
        const metadataUrl = formatIpfsUrl(nft.tokenUri);
        if (!metadataUrl) return null;

        try {
            const metadataResponse = await fetch(metadataUrl);
            if (!metadataResponse.ok) return { tokenId: nft.tokenId, contractAddress: nft.contract.address, title: `Chronicle ${nft.tokenId}`, media: [] };
            
            const metadata = await metadataResponse.json();
            let mediaItems = [];

            if (metadata.properties && Array.isArray(metadata.properties.media)) {
                mediaItems = metadata.properties.media.map(item => ({...item, gatewayUrl: formatIpfsUrl(item.gatewayUrl)}));
            } else if (metadata.image) {
                mediaItems.push({ gatewayUrl: formatIpfsUrl(metadata.image), fileName: 'Primary Media' });
            }
            
            return {
                tokenId: nft.tokenId,
                contractAddress: nft.contract.address,
                title: metadata.name || 'Untitled Chronicle',
                description: metadata.description || 'No description.',
                media: mediaItems.filter(Boolean)
            };
        } catch (e) {
            return { tokenId: nft.tokenId, contractAddress: nft.contract.address, title: `Chronicle ${nft.tokenId}`, media: [] };
        }
    });
    
    return Promise.all(nftPromises);
};

// --- The Dining Hall (The React Component) ---
function GalleryPage() {
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
                const sortedMenu = (preparedDishes || []).filter(Boolean).sort((a, b) => {
                    const idA = BigInt(a.tokenId);
                    const idB = BigInt(b.tokenId);
                    if (idB > idA) return 1;
                    if (idA > idB) return -1;
                    return 0;
                });
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
                <p className="mb-6">Please connect your wallet to view your immortalized memories.</p>
                <button onClick={connectWallet} disabled={isConnecting} className="bg-sage-green text-white font-bold py-2 px-4 rounded-lg hover:opacity-90 transition-all duration-300 shadow-lg hover:shadow-xl">
                    {isConnecting ? 'Connecting...' : 'Connect Wallet'}
                </button>
            </div>
        );
    }

    if (isLoading) {
        return <div className="text-center text-warm-brown p-8">Gathering your memories from the blockchain...</div>;
    }

    if (error) {
        return (
            <div className="w-full max-w-6xl mx-auto px-4 text-center">
                <h1 className="text-4xl font-bold text-warm-brown mb-8">My Chronicles</h1>
                <div className="text-red-600 bg-red-100 p-4 rounded-lg my-8">
                    <p className="font-bold">An error occurred</p>
                    <p>{error}</p>
                </div>
                <Link to="/" className="font-bold text-sage-green hover:underline">← Chronicle another moment</Link>
            </div>
        );
    }
    
    return (
        <div className="w-full max-w-6xl mx-auto px-4">
            <h1 className="text-4xl font-bold text-warm-brown text-center mb-8">My Chronicles</h1>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                {nfts.map(nft => (
                    <div key={`${nft.contractAddress}-${nft.tokenId}`} className="bg-cream/20 backdrop-blur-md rounded-xl shadow-lg border border-warm-brown/20 flex flex-col overflow-hidden transition-all duration-300 hover:shadow-xl hover:-translate-y-1">
                        <div className="aspect-square w-full bg-cream/10">
                            {nft.media && nft.media.length > 0 ? (
                                <div className={`grid h-full w-full gap-0.5 ${nft.media.length > 1 ? 'grid-cols-2' : 'grid-cols-1'}`}>
                                    {nft.media.slice(0, 4).map((item, index) => (
                                        <div key={index} className={` ${nft.media.length === 1 ? 'col-span-2 row-span-2' : ''} ${nft.media.length === 2 ? 'row-span-2' : ''} ${nft.media.length === 3 && index === 0 ? 'row-span-2' : ''} `}>
                                            <a href={item.gatewayUrl} target="_blank" rel="noopener noreferrer" className="block w-full h-full">
                                                <img src={item.gatewayUrl} alt={`${nft.title || 'Chronicle'} ${index + 1}`} className="w-full h-full object-cover" loading="lazy" onError={(e) => { e.target.src = 'https://dummyimage.com/600x600/f0f0f0/999999.png&text=Error'; }} />
                                            </a>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                               <div className="flex items-center justify-center h-full text-warm-brown/70 p-4">No media found</div>
                            )}
                        </div>
                        <div className="p-6 flex-1 flex flex-col">
                            <h2 className="text-2xl font-bold text-warm-brown truncate" title={nft.title}>{nft.title}</h2>
                            <p className="text-sm text-warm-brown/70 mb-2">Token ID: {nft.tokenId}</p>
                            <p className="text-sm text-warm-brown/80 italic line-clamp-2 mb-4" title={nft.description}>{nft.description}</p>
                            {nft.media && nft.media.length > 0 && (
                                <div className="mt-auto pt-4 border-t border-warm-brown/10">
                                    <h3 className="font-semibold text-warm-brown mb-2">
                                        All Media ({nft.media.length}):
                                    </h3>
                                    <ul className="text-sm space-y-1 max-h-24 overflow-y-auto">
                                        {nft.media.map((item, index) => (
                                            <li key={index}>
                                                <a href={item.gatewayUrl} target="_blank" rel="noopener noreferrer" className="text-sage-green hover:text-forest-green hover:underline truncate block">
                                                    {item.fileName || `Media ${index + 1}`}
                                                </a>
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            )}
                        </div>
                    </div>
                ))}
            </div>
            <div className="text-center mt-12">
                <Link to="/" className="font-bold text-sage-green hover:text-forest-green hover:underline">← Chronicle another moment</Link>
            </div>
        </div>
    );
}

export default GalleryPage;
