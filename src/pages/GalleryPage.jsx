import React, { useState, useEffect, useContext } from 'react';
import { WalletContext } from '../contexts/WalletContext';
import { Link } from 'react-router-dom';

const ALCHEMY_API_KEY = import.meta.env.VITE_ALCHEMY_API_KEY;
const IWT_CONTRACT_ADDRESS = import.meta.env.VITE_IWAS_THERE_NFT_ADDRESS;
const ALCHEMY_URL = `https://polygon-mainnet.g.alchemy.com/nft/v3/${ALCHEMY_API_KEY}/getNFTsForOwner`;

// A robust function to always use the reliable Pinata gateway
const formatIpfsUrl = (url) => {
    if (!url) return '';
    // This handles both ipfs:// protocol and older ipfs.io links
    if (url.startsWith('ipfs://')) {
        return `https://gateway.pinata.cloud/ipfs/${url.substring(7)}`;
    }
    return url.replace('ipfs.io', 'gateway.pinata.cloud');
};

function GalleryPage() {
    const { account, connectWallet, isConnecting } = useContext(WalletContext);
    const [nfts, setNfts] = useState([]);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');

    useEffect(() => {
        const fetchNfts = async () => {
            if (!account) { setNfts([]); return; }
            setIsLoading(true);
            setError('');
            try {
                // Fetch all NFTs for the owner from your contract
                const response = await fetch(`${ALCHEMY_URL}?owner=${account}&contractAddresses[]=${IWT_CONTRACT_ADDRESS}&withMetadata=true`);
                if (!response.ok) throw new Error('Failed to fetch NFTs from Alchemy.');
                const data = await response.json();
                
                const formattedNfts = data.ownedNfts
                    // Filter out any NFTs that might be missing the crucial media property
                    .filter(nft => nft.raw?.metadata?.properties?.media && Array.isArray(nft.raw.metadata.properties.media))
                    .map(nft => {
                        console.log(`Processing Token ID #${nft.tokenId}, Media count:`, nft.raw.metadata.properties.media.length);
                        
                        return {
                            tokenId: nft.tokenId,
                            title: nft.name || 'Untitled Chronicle',
                            description: nft.description || 'No description provided.',
                            // --- THIS IS THE KEY FIX ---
                            // Correctly map over the media array and format each URL
                            media: nft.raw.metadata.properties.media.map(item => ({
                                ...item,
                                // Ensure every item has a valid, working gateway URL
                                gatewayUrl: formatIpfsUrl(item.gatewayUrl || `ipfs://${item.cid}`)
                            }))
                        };
                    });

                setNfts(formattedNfts.reverse()); // Show newest first
                if (formattedNfts.length === 0) {
                    setError("You don't own any Chronicles yet, or the metadata is still loading.");
                }
            } catch (err) {
                console.error("Error fetching or processing NFTs:", err);
                setError(err.message);
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
            
            {isLoading && <div className="text-center text-warm-brown">Loading...</div>}
            {error && <div className="text-center text-red-600">{error}</div>}

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                {nfts.map(nft => (
                    <div key={nft.tokenId} className="bg-cream/20 backdrop-blur-md rounded-xl shadow-lg border border-warm-brown/20 flex flex-col overflow-hidden">
                        
                        {/* --- THIS IS THE 2x2 GRID FIX --- */}
                        <div className="grid grid-cols-2 grid-rows-2 h-64">
                            {/* Map over the first 4 media items to create the preview */}
                            {nft.media.slice(0, 4).map((item, index) => (
                                <a href={item.gatewayUrl} target="_blank" rel="noopener noreferrer" key={index} className="bg-cream/10">
                                    <img 
                                        src={item.gatewayUrl} 
                                        alt={item.fileName || 'Chronicle Media'} 
                                        className="w-full h-full object-cover" 
                                    />
                                </a>
                            ))}
                            {/* This creates placeholder boxes if there are fewer than 4 images */}
                            {Array.from({ length: Math.max(0, 4 - nft.media.length) }).map((_, i) => (
                                <div key={`placeholder-${i}`} className="bg-cream/10 flex items-center justify-center">
                                    {/* Conditionally render "No Image" only if it's a true empty slot */}
                                    {i + nft.media.length < 4 && <span className="text-warm-brown/40 text-xs">No Image</span>}
                                </div>
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

export default GalleryPage;