import React, { useState, useEffect, useContext } from 'react';
import { WalletContext } from '../contexts/WalletContext';
import { Link } from 'react-router-dom';

const ALCHEMY_API_KEY = import.meta.env.VITE_ALCHEMY_API_KEY;
const IWT_CONTRACT_ADDRESS = import.meta.env.VITE_IWAS_THERE_NFT_ADDRESS;
const ALCHEMY_URL = `https://polygon-mainnet.g.alchemy.com/nft/v3/${ALCHEMY_API_KEY}/getNFTsForOwner`;

// A robust function to always use a reliable gateway
const formatIpfsUrl = (url) => {
    if (!url) return '';
    if (url.startsWith('ipfs://')) {
        return `https://gateway.pinata.cloud/ipfs/${url.substring(7)}`;
    }
    // Handles cases where a different gateway might have been used
    return url.replace('ipfs.io', 'gateway.pinata.cloud');
};

function GalleryPage() {
    const { account, connectWallet, isConnecting } = useContext(WalletContext);
    const [nfts, setNfts] = useState([]);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');

    useEffect(() => {
        const fetchNfts = async () => {
            if (!account) {
                setNfts([]);
                return;
            }
            if (!ALCHEMY_API_KEY || !IWT_CONTRACT_ADDRESS) {
                setError("Configuration error: Missing API Key or Contract Address.");
                return;
            }

            setIsLoading(true);
            setError('');
            setNfts([]);

            try {
                // Added a cache-busting parameter to ensure we get the latest metadata from Alchemy
                const fetchUrl = `${ALCHEMY_URL}?owner=${account}&contractAddresses[]=${IWT_CONTRACT_ADDRESS}&withMetadata=true&refreshCache=true`;
                const response = await fetch(fetchUrl);
                
                if (!response.ok) {
                    throw new Error(`Failed to fetch NFTs (status: ${response.status})`);
                }
                c// --- DIAGNOSTIC LOGGING ---
console.log("RAW ALCHEMY API RESPONSE:", JSON.stringify(data, null, 2));
// --- END DIAGNOSTIC LOGGING ---onst data = await response.json();

                
                // This logic correctly finds the full media array in the metadata
                const formattedNfts = data.ownedNfts
                    .filter(nft => nft.raw?.metadata?.properties?.media && Array.isArray(nft.raw.metadata.properties.media))
                    .map(nft => {
                        return {
                            tokenId: nft.tokenId,
                            title: nft.name || 'Untitled Chronicle',
                            description: nft.description || 'No description provided.',
                            media: nft.raw.metadata.properties.media.map(item => ({
                                ...item,
                                gatewayUrl: formatIpfsUrl(item.gatewayUrl || `ipfs://${item.cid}`)
                            }))
                        };
                    });

                setNfts(formattedNfts.reverse()); // Show newest chronicles first
                if (formattedNfts.length === 0) {
                    setError("You don't own any Chronicles yet, or the metadata is still loading. Please check back in a moment.");
                }

            } catch (err) {
                console.error("Error fetching or processing NFTs:", err);
                setError(`An error occurred: ${err.message}. The chain data might be syncing.`);
            } finally {
                setIsLoading(false);
            }
        };
        fetchNfts();
    }, [account]);

    if (!account) {
        return (
            <div className="text-center">
                <h1 className="text-4xl font-bold text-warm-brown mb-8">My Chronicles</h1>
                <div className="bg-cream/20 p-8 rounded-xl shadow-lg">
                    <p className="mb-6">Connect your wallet to view your memories.</p>
                    <button onClick={connectWallet} disabled={isConnecting} className="bg-sage-green text-white font-bold py-2 px-4 rounded-lg">
                        {isConnecting ? 'Connecting...' : 'Connect Wallet'}
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="w-full max-w-6xl mx-auto px-4">
            <h1 className="text-4xl font-bold text-warm-brown text-center mb-8">My Chronicles</h1>
            
            {isLoading && <div className="text-center text-warm-brown">Loading your chronicles...</div>}
            {error && <div className="text-center text-red-600 bg-red-100 p-4 rounded-lg">{error}</div>}

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                {nfts.map(nft => (
                    <div key={nft.tokenId} className="bg-cream/20 backdrop-blur-md rounded-xl shadow-lg border border-warm-brown/20 flex flex-col overflow-hidden">
                        
                        {/* --- THIS IS THE FIX --- */}
                        {/* This flexible grid maps over ALL media items and displays them. */}
                        <div className="grid grid-cols-2 gap-1">
                            {nft.media.map((item, index) => (
                                <a href={item.gatewayUrl} target="_blank" rel="noopener noreferrer" key={index} className="aspect-square bg-cream/10">
                                    <img 
                                        src={item.gatewayUrl} 
                                        alt={item.fileName || `Chronicle Media ${index + 1}`}
                                        className="w-full h-full object-cover"
                                        loading="lazy"
                                        // Display a placeholder if an image fails to load
                                        onError={(e) => { e.target.src = 'https://via.placeholder.com/150/f0f0f0/999999?text=Error'; }}
                                    />
                                </a>
                            ))}
                        </div>
                        
                        <div className="p-6 flex-1 flex flex-col">
                            <h2 className="text-2xl font-bold text-warm-brown truncate" title={nft.title}>{nft.title}</h2>
                            <p className="text-sm text-warm-brown/70 mb-2">Token ID: {nft.tokenId}</p>
                            <p className="text-sm text-warm-brown/80 italic line-clamp-2 mb-4" title={nft.description}>
                                {nft.description}
                            </p>
                            
                            <div className="mt-auto">
                                <h3 className="font-semibold text-warm-brown mb-2">
                                    All Media ({nft.media.length}):
                                </h3>
                                <ul className="text-sm space-y-1 max-h-24 overflow-y-auto">
                                    {nft.media.map((item, index) => (
                                        <li key={index}>
                                            <a href={item.gatewayUrl} target="_blank" rel="noopener noreferrer" className="text-sage-green hover:text-forest-green hover:underline truncate block">
                                                {item.fileName || `Item ${index + 1}`}
                                            </a>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        </div>
                    </div>
                ))}
            </div>
            
            <div className="text-center mt-12">
                <Link to="/" className="font-bold text-sage-green hover:text-forest-green hover:underline">
                    ← Chronicle another moment
                </Link>
            </div>
        </div>
    );
}

export default GalleryPage