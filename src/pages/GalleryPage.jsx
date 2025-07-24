import React, { useState, useEffect, useContext } from 'react';
import { WalletContext } from '../contexts/WalletContext';
import { Link } from 'react-router-dom';

const ALCHEMY_API_KEY = import.meta.env.VITE_ALCHEMY_API_KEY;
const IWT_CONTRACT_ADDRESS = import.meta.env.VITE_IWAS_THERE_NFT_ADDRESS;
const ALCHEMY_URL = `https://polygon-mainnet.g.alchemy.com/nft/v3/${ALCHEMY_API_KEY}/getNFTsForOwner`;

// --- FINAL FIX #1: A robust function to always use the reliable Pinata gateway ---
const formatIpfsUrl = (url) => {
    if (!url) return '';
    // Replace any IPFS protocol or old gateway with the reliable Pinata gateway
    return url.replace(/^ipfs:\/\//, 'https://gateway.pinata.cloud/ipfs/').replace('ipfs.io', 'gateway.pinata.cloud');
};

function GalleryPage() {
    const { account, connectWallet, isConnecting } = useContext(WalletContext);
    const [nfts, setNfts] = useState([]);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');

    useEffect(() => {
        const fetchNfts = async () => {
            if (!account) { setNfts([]); return; }
            if (!ALCHEMY_API_KEY || !IWT_CONTRACT_ADDRESS) {
                setError("Configuration error.");
                return;
            }
            setIsLoading(true);
            setError('');
            setNfts([]);

            try {
                const response = await fetch(`${ALCHEMY_URL}?owner=${account}&contractAddresses[]=${IWT_CONTRACT_ADDRESS}&withMetadata=true`);
                if (!response.ok) { throw new Error(`Failed to fetch NFTs`); }
                const data = await response.json();
                
                const formattedNfts = data.ownedNfts
                    .filter(nft => nft.raw?.metadata?.properties?.media)
                    .map(nft => ({
                        tokenId: nft.tokenId,
                        title: nft.name || 'Untitled Chronicle',
                        description: nft.description || 'No description provided.',
                        // --- FINAL FIX #2: Correctly map all media items with the robust formatter ---
                        media: nft.raw.metadata.properties.media.map(item => ({
                            ...item,
                            gatewayUrl: formatIpfsUrl(item.gatewayUrl || item.ipfsUrl)
                        })) || [], 
                    }));

                setNfts(formattedNfts.reverse()); // Show the newest chronicles first
                if (formattedNfts.length === 0) {
                    setError("You don't own any Chronicles yet, or the metadata is still loading.");
                }

            } catch (err) {
                setError(err.message || "An error occurred while fetching your Chronicles.");
            } finally {
                setIsLoading(false);
            }
        };
        fetchNfts();
    }, [account]);

    if (!account) {
        // ... (The 'Connect Wallet' screen is the same)
    }

    return (
        <div className="w-full max-w-6xl mx-auto px-4">
            <h1 className="text-4xl font-bold text-warm-brown text-center mb-8">My Chronicles</h1>
            
            {isLoading && <div className="text-center text-warm-brown/80">Loading your memories...</div>}
            {error && <div className="text-center text-red-500 bg-cream/50 p-4 rounded-lg">{error}</div>}

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                {nfts.map(nft => (
                    <div key={nft.tokenId} className="bg-cream/20 backdrop-blur-md rounded-xl shadow-lg border border-warm-brown/20 overflow-hidden flex flex-col">
                        {/* --- FINAL FIX #3: Display a grid of all media items --- */}
                        <div className="grid grid-cols-2 grid-rows-2 gap-1 flex-grow">
                            {nft.media.slice(0, 4).map((item, index) => (
                                <a href={item.gatewayUrl} target="_blank" rel="noopener noreferrer" key={index} className="bg-cream/10">
                                    <img src={item.gatewayUrl} alt={item.fileName} className="w-full h-32 object-cover" />
                                </a>
                            ))}
                            {/* Fill empty grid cells if less than 4 images */}
                            {Array.from({ length: 4 - nft.media.length }).map((_, i) => <div key={i} className="bg-cream/10"></div>)}
                        </div>
                        <div className="p-6">
                            <h2 className="text-2xl font-bold text-warm-brown truncate">{nft.title}</h2>
                            <p className="text-sm text-warm-brown/70 mb-2">Token ID: {nft.tokenId}</p>
                            <p className="text-sm text-warm-brown/80 italic truncate h-5 mb-4">{nft.description}</p>
                            
                            <div className="mt-4">
                                <h3 className="font-semibold text-warm-brown mb-2">All Media ({nft.media.length}):</h3>
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