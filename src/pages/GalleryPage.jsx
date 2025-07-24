import React, { useState, useEffect, useContext } from 'react';
import { WalletContext } from '../contexts/WalletContext';
import { Link } from 'react-router-dom';

// All the helper and fetch functions at the top of the file remain the same
// You can copy them from our previous conversation, including the paginated fetch.
const ALCHEMY_API_KEY = import.meta.env.VITE_ALCHEMY_API_KEY;
const IWT_CONTRACT_ADDRESS = import.meta.env.VITE_IWAS_THERE_NFT_ADDRESS;
const ALCHEMY_URL = `https://polygon-mainnet.g.alchemy.com/nft/v3/${ALCHEMY_API_KEY}/getNFTsForOwner`;

const formatIpfsUrl = (url) => {
    if (!url || typeof url !== 'string') return '';
    if (url.startsWith('ipfs://')) return `https://gateway.pinata.cloud/ipfs/${url.substring(7)}`;
    if (url.startsWith('https://')) return url.replace('ipfs.io', 'gateway.pinata.cloud');
    return '';
};

const fetchAndProcessNfts = async (account) => {
    let allNfts = [];
    let pageKey;
    let hasMore = true;
    while (hasMore) {
        let fetchUrl = `${ALCHEMY_URL}?owner=${account}&contractAddresses[]=${IWT_CONTRACT_ADDRESS}&withMetadata=true`;
        if (pageKey) fetchUrl += `&pageKey=${pageKey}`;
        const response = await fetch(fetchUrl);
        if (!response.ok) throw new Error(`Could not fetch NFT data (pageKey: ${pageKey})`);
        const data = await response.json();
        allNfts.push(...data.ownedNfts);
        pageKey = data.pageKey;
        if (!pageKey) hasMore = false;
    }
    console.log(`Fetched ${allNfts.length} total NFTs. Processing...`);
    
    const nftPromises = allNfts.map(async (nft) => {
        const metadataUrl = formatIpfsUrl(nft.tokenUri);
        if (!metadataUrl) return null;
        try {
            const metadataResponse = await fetch(metadataUrl);
            if (!metadataResponse.ok) return { tokenId: nft.tokenId, title: "Metadata Fetch Failed", media: [] };
            const metadata = await metadataResponse.json();
            
            // Defensive coding: ensure properties.media is a clean array
            let mediaItems = [];
            if (metadata.properties && Array.isArray(metadata.properties.media)) {
                mediaItems = metadata.properties.media.map(item => ({
                    ...item,
                    gatewayUrl: formatIpfsUrl(item.gatewayUrl || (item.cid ? `ipfs://${item.cid}` : ''))
                }));
            }

            // Backward-compatibility check
            if (mediaItems.length === 0 && metadata.image) {
                mediaItems.push({ gatewayUrl: formatIpfsUrl(metadata.image), fileName: 'Primary Image' });
            }
            
            return {
                tokenId: nft.tokenId,
                title: metadata.name || 'Untitled',
                description: metadata.description || '',
                // Final check to ensure we only return valid items
                media: mediaItems.filter(item => item && item.gatewayUrl)
            };
        } catch (e) {
            return { tokenId: nft.tokenId, title: "Invalid Metadata", media: [] };
        }
    });
    return Promise.all(nftPromises);
};


function GalleryPage() {
    const { account, connectWallet } = useContext(WalletContext);
    const [nfts, setNfts] = useState([]);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');

    useEffect(() => {
        const runFetch = async () => {
            if (!account) { setNfts([]); return; }
            setIsLoading(true);
            setError('');
            try {
                const processedNfts = await fetchAndProcessNfts(account);
                const validNfts = processedNfts.filter(Boolean);
                validNfts.sort((a, b) => b.tokenId - a.tokenId);
                setNfts(validNfts);
                if (validNfts.length === 0) setError("You don't own any Chronicles yet.");
            } catch (err) {
                setError(`A critical error occurred: ${err.message}.`);
            } finally {
                setIsLoading(false);
            }
        };
        runFetch();
    }, [account]);

    if (!account) {
        // ... (return connect wallet button)
    }

    return (
        <div className="w-full max-w-6xl mx-auto px-4">
            <h1 className="text-4xl font-bold text-warm-brown text-center mb-8">My Chronicles</h1>
            
            {isLoading && <div className="text-center text-warm-brown">Loading all your chronicles...</div>}
            {error && <div className="text-center text-red-600 bg-red-100 p-4 rounded-lg">{error}</div>}

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                {nfts.map(nft => (
                    <div key={nft.tokenId} className="bg-cream/20 backdrop-blur-md rounded-xl shadow-lg border border-warm-brown/20 flex flex-col overflow-hidden">
                        
                        {/* Image Grid */}
                        <div className="aspect-square w-full">
                            {nft.media && nft.media.length > 0 ? (
                                <div className={`grid h-full w-full gap-1 ${nft.media.length > 1 ? 'grid-cols-2' : 'grid-cols-1'}`}>
                                    {nft.media.slice(0, 4).map((item, index) => (
                                        <div key={index} className={`...`}>
                                            {/* Your img tag here */}
                                        </div>
                                    ))}
                                </div>
                            ) : (
                               <div className="aspect-square flex items-center justify-center bg-cream/10 text-warm-brown/70">"No media found"</div>
                            )}
                        </div>
                        
                        {/* Text Content */}
                        <div className="p-6 flex-1 flex flex-col">
                            <h2 className="text-2xl font-bold text-warm-brown truncate">{nft.title}</h2>
                            <p className="text-sm text-warm-brown/70 mb-2">Token ID: {nft.tokenId}</p>
                            
                            {/* --- DIAGNOSTIC AND FIX --- */}
                            <div className="mt-auto">
                                <h3 className="font-semibold text-warm-brown mb-2">
                                    All Media ({nft.media?.length || 0}):
                                </h3>
                                {/* Raw Data Viewer */}
                                <pre className="text-xs bg-black/10 p-2 rounded overflow-x-auto">
                                    {JSON.stringify(nft.media, null, 2)}
                                </pre>
                            </div>
                            {/* --- END OF DIAGNOSTIC --- */}
                        </div>
                    </div>
                ))}
            </div>
            
            <div className="text-center mt-12">
                <Link to="/" className="font-bold text-sage-green hover:text-forest-green">← Chronicle another moment</Link>
            </div>
        </div>
    );
}

export default GalleryPage;