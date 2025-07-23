import React, { useState, useEffect, useContext } from 'react';
import { WalletContext } from '../contexts/WalletContext';
import { Link } from 'react-router-dom';

// Configuration
const ALCHEMY_API_KEY = import.meta.env.VITE_ALCHEMY_API_KEY;
const IWT_CONTRACT_ADDRESS = import.meta.env.VITE_IWAS_THERE_NFT_ADDRESS;
const ALCHEMY_URL = `https://polygon-mainnet.g.alchemy.com/nft/v3/${ALCHEMY_API_KEY}/getNFTsForOwner`;

// A helper to make IPFS URLs viewable
const formatIpfsUrl = (ipfsUrl) => {
    if (!ipfsUrl) return '';
    // Use a public gateway for displaying images
    return ipfsUrl.replace('ipfs://', 'https://ipfs.io/ipfs/');
};

function GalleryPage() {
    const { account, connectWallet, isConnecting } = useContext(WalletContext);
    const [nfts, setNfts] = useState([]);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');

    useEffect(() => {
        const fetchNfts = async () => {
            if (!account) {
                setNfts([]); // Clear NFTs if wallet disconnects
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
                
                // Process and set the NFTs
                const formattedNfts = data.ownedNfts.map(nft => ({
                    tokenId: nft.tokenId,
                    title: nft.name || 'Untitled Chronicle',
                    description: nft.description || '',
                    // The media array is in rawMetadata.properties.media
                    media: nft.raw.metadata.properties?.media || [], 
                    // The main image for the card
                    displayImage: formatIpfsUrl(nft.raw.metadata.image || nft.raw.metadata.animation_url),
                }));

                setNfts(formattedNfts);
                if (formattedNfts.length === 0) {
                    setError("You don't own any 'I Was There' Chronicles yet.");
                }

            } catch (err) {
                console.error("Error fetching NFTs:", err);
                setError(err.message || "An error occurred while fetching your Chronicles.");
            } finally {
                setIsLoading(false);
            }
        };

        fetchNfts();
    }, [account]); // Re-run whenever the account changes

    // --- Render Logic ---

    if (!account) {
        return (
            <div className="text-center text-warm-brown/90">
                <h1 className="text-4xl font-bold mb-4">Your Chronicles</h1>
                <p className="mb-6">Connect your wallet to view your permanent memories.</p>
                <button onClick={connectWallet} disabled={isConnecting} className="w-full max-w-xs px-4 py-3 font-bold text-cream bg-gradient-to-r from-terracotta to-warm-brown rounded-lg hover:opacity-90 transition-all duration-300 shadow-lg hover:shadow-xl">
                    {isConnecting ? "Connecting..." : "Connect Wallet"}
                </button>
            </div>
        );
    }

    return (
        <div className="w-full max-w-6xl mx-auto px-4">
            <h1 className="text-4xl font-bold text-warm-brown text-center mb-8">My Chronicles</h1>
            
            {isLoading && <div className="text-center text-warm-brown/80">Loading your memories...</div>}
            
            {error && <div className="text-center text-red-500 bg-cream/50 p-4 rounded-lg">{error}</div>}

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                {nfts.map(nft => (
                    <div key={nft.tokenId} className="bg-cream/20 backdrop-blur-md rounded-xl shadow-lg border border-warm-brown/20 overflow-hidden transition-transform duration-300 hover:-translate-y-2">
                        {nft.displayImage ? (
                            <img src={nft.displayImage} alt={nft.title} className="w-full h-56 object-cover" />
                        ) : (
                            <div className="w-full h-56 bg-cream/10 flex items-center justify-center text-warm-brown/50">No Image Preview</div>
                        )}
                        <div className="p-6">
                            <h2 className="text-2xl font-bold text-warm-brown">{nft.title}</h2>
                            <p className="text-sm text-warm-brown/70 mb-4">Token ID: {nft.tokenId}</p>
                            
                            <div className="mt-4">
                                <h3 className="font-semibold text-warm-brown mb-2">Media in this Bundle:</h3>
                                <ul className="text-sm space-y-2">
                                    {nft.media.map((item, index) => (
                                        <li key={index}>
                                            <a 
                                                href={formatIpfsUrl(item.ipfsUrl)} 
                                                target="_blank" 
                                                rel="noopener noreferrer" 
                                                className="text-sage-green hover:text-forest-green hover:underline"
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
             <div className="text-center mt-12">
                <Link to="/" className="font-bold text-sage-green hover:text-forest-green hover:underline">
                    ← Chronicle another moment
                </Link>
            </div>
        </div>
    );
}

export default GalleryPage;