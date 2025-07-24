import React, { useState, useEffect, useContext } from 'react';
import { WalletContext } from '../contexts/WalletContext';
import { Link } from 'react-router-dom';

const ALCHEMY_API_KEY = import.meta.env.VITE_ALCHEMY_API_KEY;
const IWT_CONTRACT_ADDRESS = import.meta.env.VITE_IWAS_THERE_NFT_ADDRESS;
const ALCHEMY_URL = `https://polygon-mainnet.g.alchemy.com/nft/v3/${ALCHEMY_API_KEY}/getNFTsForOwner`;

const formatIpfsUrl = (url) => {
    if (!url || typeof url !== 'string') return '';
    if (url.startsWith('ipfs://')) {
        return `https://gateway.pinata.cloud/ipfs/${url.substring(7)}`;
    }
    if (url.startsWith('https://')) {
        return url.replace('ipfs.io', 'gateway.pinata.cloud');
    }
    return '';
};

const fetchAndProcessNfts = async (account) => {
    const fetchUrl = `${ALCHEMY_URL}?owner=${account}&contractAddresses[]=${IWT_CONTRACT_ADDRESS}&withMetadata=false`;
    const baseNftResponse = await fetch(fetchUrl);
    if (!baseNftResponse.ok) throw new Error("Could not fetch base NFT data");

    const baseNftData = await baseNftResponse.json();
    console.log("Fetched base NFT list:", baseNftData.ownedNfts);

    const nftPromises = baseNftData.ownedNfts.map(async (nft) => {
        // --- THIS IS THE FINAL FIX ---
        // We now correctly read the URI from the 'raw' property.
        const metadataUrl = formatIpfsUrl(nft.tokenUri?.raw); 
        // --- END OF FIX ---

        if (!metadataUrl) {
            console.warn(`Token ID ${nft.tokenId} has a missing or invalid tokenUri.raw`);
            return { tokenId: nft.tokenId, title: "Untitled", description: "Invalid metadata URL", media: [] };
        }

        try {
            const metadataResponse = await fetch(metadataUrl);
            if (!metadataResponse.ok) {
                 return { ...nft, title: nft.name || "Untitled", description: "Metadata fetch failed.", media: [] };
            }
            const metadata = await metadataResponse.json();
            
            return {
                tokenId: nft.tokenId,
                title: metadata.name || 'Untitled Chronicle',
                description: metadata.description || 'No description.',
                media: (metadata.properties?.media || []).map(item => ({
                    ...item,
                    gatewayUrl: formatIpfsUrl(item.gatewayUrl || `ipfs://${item.cid}`)
                }))
            };
        } catch (e) {
            console.error(`Could not parse metadata for token ${nft.tokenId}. URL: ${metadataUrl}`);
            return { 
                tokenId: nft.tokenId,
                title: nft.name || `Chronicle ${nft.tokenId}`, 
                description: "Metadata is currently pending or invalid. Please check back soon.", 
                media: [],
                isPending: true
            };
        }
    });

    return Promise.all(nftPromises);
};


function GalleryPage() {
    const { account, connectWallet, isConnecting } = useContext(WalletContext);
    const [nfts, setNfts] = useState([]);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');

    useEffect(() => {
        const runFetch = async () => {
            if (!account) { setNfts([]); return; }
            if (!ALCHEMY_API_KEY || !IWT_CONTRACT_ADDRESS) { setError("Configuration error."); return; }
            setIsLoading(true);
            setError('');
            try {
                const processedNfts = await fetchAndProcessNfts(account);
                setNfts(processedNfts.filter(Boolean).reverse());
                if (processedNfts.length === 0) { setError("You don't own any Chronicles yet."); }
            } catch (err) {
                console.error("CRITICAL ERROR in runFetch:", err);
                setError(`A critical error occurred: ${err.message}.`);
            } finally {
                setIsLoading(false);
            }
        };
        runFetch();
    }, [account]);

    // --- NO MORE CHANGES NEEDED BELOW THIS LINE ---

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
                    <div key={nft.tokenId} className={`bg-cream/20 backdrop-blur-md rounded-xl shadow-lg border border-warm-brown/20 flex flex-col overflow-hidden ${nft.isPending ? 'opacity-60' : ''}`}>
                        
                        {nft.media && nft.media.length > 0 ? (
                            <div className="grid grid-cols-2 gap-1">
                                {nft.media.map((item, index) => (
                                    <a href={item.gatewayUrl} target="_blank" rel="noopener noreferrer" key={index} className="aspect-square bg-cream/10">
                                        <img 
                                            src={item.gatewayUrl} 
                                            alt={item.fileName || `Chronicle Media ${index + 1}`}
                                            className="w-full h-full object-cover"
                                            loading="lazy"
                                            onError={(e) => { e.target.src = 'https://via.placeholder.com/150/f0f0f0/999999?text=Error'; }}
                                        />
                                    </a>
                                ))}
                            </div>
                        ) : (
                           <div className="aspect-square flex items-center justify-center bg-cream/10 p-4 text-center text-warm-brown/70">
                                {nft.isPending ? "Metadata is processing..." : "No media found"}
                           </div>
                        )}
                        
                        <div className="p-6 flex-1 flex flex-col">
                            <h2 className="text-2xl font-bold text-warm-brown truncate" title={nft.title}>{nft.title}</h2>
                            <p className="text-sm text-warm-brown/70 mb-2">Token ID: {nft.tokenId}</p>
                            <p className="text-sm text-warm-brown/80 italic line-clamp-2 mb-4" title={nft.description}>
                                {nft.description}
                            </p>
                            
                            {nft.media && nft.media.length > 0 && (
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
                            )}
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