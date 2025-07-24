import React, { useState, useEffect, useContext } from 'react';
import { WalletContext } from '../contexts/WalletContext';
import { Link } from 'react-router-dom';

const ALCHEMY_API_KEY = import.meta.env.VITE_ALCHEMY_API_KEY;
const IWT_CONTRACT_ADDRESS = import.meta.env.VITE_IWAS_THERE_NFT_ADDRESS;
const ALCHEMY_URL = `https://polygon-mainnet.g.alchemy.com/nft/v3/${ALCHEMY_API_KEY}/getNFTsForOwner`;

const formatIpfsUrl = (url) => {
    if (!url) return '';
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
            setIsLoading(true);
            setError('');
            try {
                const response = await fetch(`${ALCHEMY_URL}?owner=${account}&contractAddresses[]=${IWT_CONTRACT_ADDRESS}&withMetadata=true`);
                if (!response.ok) throw new Error('Failed to fetch NFTs');
                const data = await response.json();
                
                const formattedNfts = data.ownedNfts
                    .filter(nft => nft.raw?.metadata?.properties?.media)
                    .map(nft => ({
                        tokenId: nft.tokenId,
                        title: nft.name || 'Untitled Chronicle',
                        description: nft.description || 'No description provided.',
                        media: nft.raw.metadata.properties.media.map(item => ({
                            ...item,
                            gatewayUrl: formatIpfsUrl(item.gatewayUrl || `ipfs://${item.cid}`)
                        })) || [], 
                    }));

                setNfts(formattedNfts.reverse());
                if (formattedNfts.length === 0) {
                    setError("You don't own any Chronicles yet.");
                }
            } catch (err) {
                setError(err.message);
            } finally {
                setIsLoading(false);
            }
        };
        fetchNfts();
    }, [account]);

    if (!account) {
        // ... (Connect Wallet screen is the same)
    }

    return (
        <div className="w-full max-w-6xl mx-auto px-4">
            <h1 className="text-4xl font-bold text-warm-brown text-center mb-8">My Chronicles</h1>
            
            {isLoading && <div className="text-center">Loading your memories...</div>}
            {error && <div className="text-center text-red-500">{error}</div>}

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                {nfts.map(nft => (
                    <div key={nft.tokenId} className="bg-cream/20 backdrop-blur-md rounded-xl shadow-lg border border-warm-brown/20 flex flex-col">
                        
                        {/* --- THIS IS THE FINAL FIX --- */}
                        <div className="grid grid-cols-2 grid-rows-2 h-64">
                            {/* Map over the first 4 media items */}
                            {nft.media.slice(0, 4).map((item, index) => (
                                <div key={index} className="bg-cream/10">
                                    <a href={item.gatewayUrl} target="_blank" rel="noopener noreferrer">
                                        <img src={item.gatewayUrl} alt={item.fileName} className="w-full h-full object-cover" />
                                    </a>
                                </div>
                            ))}
                            {/* Create empty placeholder divs if there are fewer than 4 images */}
                            {Array.from({ length: Math.max(0, 4 - nft.media.length) }).map((_, i) => (
                                <div key={`placeholder-${i}`} className="bg-cream/10"></div>
                            ))}
                        </div>
                        
                        <div className="p-6">
                            <h2 className="text-2xl font-bold text-warm-brown truncate">{nft.title}</h2>
                            <p className="text-sm text-warm-brown/70 mb-2">Token ID: {nft.tokenId}</p>
                            <p className="text-sm text-warm-brown/80 italic truncate h-5 mb-4" title={nft.description}>{nft.description}</p>
                            
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