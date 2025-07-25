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
    let allNfts = [];
    let pageKey;
    let hasMore = true;
    while (hasMore) {
        let fetchUrl = `${ALCHEMY_URL}?owner=${account}&contractAddresses[]=${IWT_CONTRACT_ADDRESS}&withMetadata=true`;
        if (pageKey) {
            fetchUrl += `&pageKey=${pageKey}`;
        }
        const response = await fetch(fetchUrl);
        if (!response.ok) {
            throw new Error(`Could not fetch NFT data from Alchemy`);
        }
        const data = await response.json();
        if (data.ownedNfts) {
            allNfts.push(...data.ownedNfts);
        }
        pageKey = data.pageKey;
        if (!pageKey) {
            hasMore = false;
        }
    }
    
    const nftPromises = allNfts.map(async (nft) => {
        const metadataUrl = formatIpfsUrl(nft.tokenUri);
        if (!metadataUrl) {
            return null;
        }
        try {
            const metadataResponse = await fetch(metadataUrl);
            if (!metadataResponse.ok) {
                return { tokenId: nft.tokenId, title: `Chronicle ${nft.tokenId}`, description: "Metadata is pending or failed to load.", media: [] };
            }
            const metadata = await metadataResponse.json();
            
            let mediaItems = [];
            if (metadata.properties && Array.isArray(metadata.properties.media)) {
                mediaItems = metadata.properties.media.map(item => ({
                    ...item,
                    gatewayUrl: formatIpfsUrl(item.gatewayUrl || (item.cid ? `ipfs://${item.cid}` : ''))
                }));
            } else if (metadata.image) {
                mediaItems.push({ gatewayUrl: formatIpfsUrl(metadata.image), fileName: metadata.name || 'Primary Image' });
            }
            
            return {
                tokenId: nft.tokenId,
                title: metadata.name || 'Untitled Chronicle',
                description: metadata.description || 'No description provided.',
                media: mediaItems.filter(item => item && item.gatewayUrl)
            };
        } catch (e) {
            return { tokenId: nft.tokenId, title: `Chronicle ${nft.tokenId}`, description: "The metadata for this item is invalid or corrupted.", media: [] };
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
            if (!account) {
                setNfts([]);
                return;
            }
            setIsLoading(true);
            setError('');
            try {
                const processedNfts = await fetchAndProcessNfts(account);
                const validNfts = (processedNfts || []).filter(Boolean).sort((a, b) => b.tokenId - a.tokenId);
                setNfts(validNfts);
                if (validNfts.length === 0 && !isLoading) {
                    setError("You don't own any Chronicles yet.");
                }
            } catch (err) {
                setError(`A critical error occurred: ${err.message}`);
            } finally {
                setIsLoading(false);
            }
        };
        runFetch();
    }, [account]);

    if (!account) {
        return (
            <div className="text-center p-8">
                <h1 className="text-4xl font-bold text-warm-brown mb-8">My Chronicles</h1>
                <p className="mb-6">Connect your wallet to view your memories.</p>
                <button onClick={connectWallet} disabled={isConnecting} className="bg-sage-green text-white font-bold py-2 px-4 rounded-lg">
                    {isConnecting ? 'Connecting...' : 'Connect Wallet'}
                </button>
            </div>
        );
    }

    if (isLoading) {
        return <div className="text-center text-warm-brown p-8">Loading your chronicles...</div>;
    }

    if (error) {
        return (
            <div className="w-full max-w-6xl mx-auto px-4 text-center">
                <h1 className="text-4xl font-bold text-warm-brown text-center mb-8">My Chronicles</h1>
                <div className="text-red-600 bg-red-100 p-4 rounded-lg">{error}</div>
                <div className="text-center mt-12">
                    <Link to="/" className="font-bold text-sage-green hover:text-forest-green hover:underline">
                        ← Chronicle another moment
                    </Link>
                </div>
            </div>
        );
    }
    
    return (
        <div className="w-full max-w-6xl mx-auto px-4">
            <h1 className="text-4xl font-bold text-warm-brown text-center mb-8">My Chronicles</h1>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                {nfts.map(nft => (
                    <div key={nft.tokenId} className="bg-cream/20 backdrop-blur-md rounded-xl shadow-lg border border-warm-brown/20 flex flex-col overflow-hidden">
                        
                        <div className="aspect-square w-full">
                            {nft.media && nft.media.length > 0 ? (
                                <div className={`grid h-full w-full gap-0.5 ${nft.media.length > 1 ? 'grid-cols-2' : 'grid-cols-1'}`}>
                                    {nft.media.slice(0, 4).map((item, index) => (
                                        <div key={index} 
                                            className={`
                                            ${nft.media.length === 1 ? 'col-span-2 row-span-2' : ''}
                                            ${nft.media.length === 2 ? 'row-span-2' : ''}
                                            ${nft.media.length === 3 && index === 0 ? 'row-span-2' : ''}
                                            bg-cream/10`}>
                                            <a href={item.gatewayUrl} target="_blank" rel="noopener noreferrer" className="block w-full h-full">
                                                <img 
                                                    src={item.gatewayUrl} 
                                                    alt={`${nft.title || 'Chronicle'} ${index + 1}`}
                                                    className="w-full h-full object-cover"
                                                    loading="lazy"
                                                    onError={(e) => { e.target.src = 'https://dummyimage.com/600x600/f0f0f0/999999.png&text=Error'; }}
                                                />
                                            </a>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                               <div className="flex items-center justify-center bg-cream/10 text-warm-brown/70 p-4">No media found</div>
                            )}
                        </div>
                        
                        <div className="p-6 flex-1 flex flex-col">
                            <h2 className="text-2xl font-bold text-warm-brown truncate" title={nft.title}>{nft.title}</h2>
                            <p className="text-sm text-warm-brown/70 mb-4">{nft.description || "No description."}</p>
                            <p className="text-sm text-warm-brown/70 mb-4">Token ID: {nft.tokenId}</p>
                            
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