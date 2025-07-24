import React, { useState, useEffect, useContext } from 'react';
import { WalletContext } from '../contexts/WalletContext';
import { Link } from 'react-router-dom';

const ALCHEMY_API_KEY = import.meta.env.VITE_ALCHEMY_API_KEY;
const IWT_CONTRACT_ADDRESS = import.meta.env.VITE_IWAS_THERE_NFT_ADDRESS;
const ALCHEMY_URL = `https://polygon-mainnet.g.alchemy.com/nft/v3/${ALCHEMY_API_KEY}/getNFTsForOwner`;

// A robust function to always use the reliable Pinata gateway
const formatIpfsUrl = (url ) => {
    if (!url) return '';
    // Handle Pinata's gateway format which might already be correct
    if (url.includes('gateway.pinata.cloud')) {
        return url;
    }
    if (url.startsWith('ipfs://')) {
        return `https://gateway.pinata.cloud/ipfs/${url.substring(7 )}`;
    }
    // Replace other common gateways just in case
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
                const response = await fetch(`${ALCHEMY_URL}?owner=${account}&contractAddresses[]=${IWT_CONTRACT_ADDRESS}&withMetadata=true`);
                
                if (!response.ok) {
                    throw new Error(`Failed to fetch NFTs. Status: ${response.status}`);
                }

                const data = await response.json();
                
                const formattedNfts = data.ownedNfts
                    .filter(nft => nft.raw?.metadata?.properties?.media)
                    .map(nft => {
                        console.log(`Processing Token ID #${nft.tokenId}, Media count:`, nft.raw.metadata.properties.media.length);
                        
                        // Correctly map all media items
                        const allMedia = nft.raw.metadata.properties.media.map(item => ({
                            ...item,
                            gatewayUrl: formatIpfsUrl(item.gatewayUrl || `ipfs://${item.cid}`)
                        }));

                        return {
                            tokenId: nft.tokenId,
                            title: nft.name || 'Untitled Chronicle',
                            description: nft.description || 'No description provided.',
                            media: allMedia, // Use the fully mapped array
                        };
                    });

                setNfts(formattedNfts.reverse()); // Show newest first
                if (formattedNfts.length === 0) {
                    setError("You don't own any 'I Was There' Chronicles yet, or the metadata is still loading.");
                }

            } catch (err) {
                console.error("Error fetching or processing NFTs:", err);
                setError(err.message || "An error occurred while fetching your Chronicles.");
            } finally {
                setIsLoading(false);
            }
        };

        fetchNfts();
    }, [account]);

    if (!account) {
        return (
            <div className="w-full max-w-4xl mx-auto px-4 text-center">
                <h1 className="text-4xl font-bold text-warm-brown mb-8">My Chronicles</h1>
                <div className="bg-cream/20 backdrop-blur-md rounded-xl shadow-lg border border-warm-brown/20 p-8">
                    <p className="text-warm-brown mb-6">Connect your wallet to view your Chronicles</p>
                    <button 
                        onClick={connectWallet}
                        disabled={isConnecting}
                        className="bg-sage-green hover:bg-forest-green text-white font-bold py-3 px-6 rounded-lg transition-colors disabled:opacity-50"
                    >
                        {isConnecting ? 'Connecting...' : 'Connect Wallet'}
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="w-full max-w-6xl mx-auto px-4">
            <h1 className="text-4xl font-bold text-warm-brown text-center mb-8">My Chronicles</h1>
            
            {isLoading && (
                <div className="text-center">
                    <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-warm-brown"></div>
                    <p className="mt-2 text-warm-brown">Loading your memories...</p>
                </div>
            )}
            
            {error && (
                <div className="text-center">
                    <div className="bg-red-50 border border-red-200 rounded-lg p-4 inline-block">
                        <p className="text-red-600">{error}</p>
                    </div>
                </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                {nfts.map(nft => (
                    <div key={nft.tokenId} className="bg-cream/20 backdrop-blur-md rounded-xl shadow-lg border border-warm-brown/20 flex flex-col overflow-hidden hover:shadow-xl transition-shadow duration-300">
                        
                        <div className="grid grid-cols-2 grid-rows-2 h-64 gap-0.5 bg-warm-brown/10">
                            {/* Display up to the first 4 images */}
                            {nft.media.slice(0, 4).map((item, index) => (
                                <div key={index} className="relative overflow-hidden bg-cream/10 group">
                                    <a href={item.gatewayUrl} target="_blank" rel="noopener noreferrer" className="block w-full h-full">
                                        <img 
                                            src={item.gatewayUrl} 
                                            alt={item.fileName || `Media ${index + 1}`}
                                            className="w-full h-full object-cover transition-transform group-hover:scale-105"
                                            loading="lazy"
                                        />
                                        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors"></div>
                                    </a>
                                </div>
                            ))}
                            
                            {/* Render placeholders for empty slots */}
                            {Array.from({ length: Math.max(0, 4 - nft.media.length) }).map((_, i) => (
                                <div key={`placeholder-${i}`} className="bg-cream/10 flex items-center justify-center">
                                    <div className="text-warm-brown/40 text-xs">No Image</div>
                                </div>
                            ))}
                        </div>
                        
                        <div className="p-6 flex-1 flex flex-col">
                            <h2 className="text-2xl font-bold text-warm-brown truncate mb-1" title={nft.title}>{nft.title}</h2>
                            <p className="text-sm text-warm-brown/70 mb-2">Token ID: {nft.tokenId}</p>
                            <p className="text-sm text-warm-brown/80 italic line-clamp-2 mb-4 flex-1" title={nft.description}>
                                {nft.description}
                            </p>
                            
                            <div className="mt-auto">
                                <h3 className="font-semibold text-warm-brown mb-2">
                                    All Media ({nft.media.length} {nft.media.length === 1 ? 'item' : 'items'}):
                                </h3>
                                <ul className="text-sm space-y-1 max-h-24 overflow-y-auto">
                                    {nft.media.map((item, index) => (
                                        <li key={index}>
                                            <a 
                                                href={item.gatewayUrl} 
                                                target="_blank" 
                                                rel="noopener noreferrer" 
                                                className="text-sage-green hover:text-forest-green hover:underline truncate block transition-colors"
                                                title={item.fileName || `Item ${index + 1}`}
                                            >
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
            
            {nfts.length > 0 && (
                <div className="text-center mt-12">
                    <Link 
                        to="/" 
                        className="inline-flex items-center font-bold text-sage-green hover:text-forest-green hover:underline transition-colors"
                    >
                        ← Chronicle another moment
                    </Link>
                </div>
            )}
        </div>
    );
}

export default GalleryPage;
