import React, { useState, useEffect, useContext } from 'react';
import { WalletContext } from '../contexts/WalletContext';
import { Link } from 'react-router-dom';

// ... (fetchAndProcessNfts and other functions remain the same as the previous version) ...

// PASTE THE FULL, PAGINATED `fetchAndProcessNfts` FUNCTION FROM THE PREVIOUS MESSAGE HERE

const fetchAndProcessNfts = async (account) => {
    let allNfts = [];
    let pageKey;
    let hasMore = true;
    while (hasMore) {
        let fetchUrl = `https://polygon-mainnet.g.alchemy.com/nft/v3/${import.meta.env.VITE_ALCHEMY_API_KEY}/getNFTsForOwner?owner=${account}&contractAddresses[]=${import.meta.env.VITE_IWAS_THERE_NFT_ADDRESS}&withMetadata=true`;
        if (pageKey) fetchUrl += `&pageKey=${pageKey}`;
        const response = await fetch(fetchUrl);
        if (!response.ok) throw new Error(`Could not fetch NFT data (pageKey: ${pageKey})`);
        const data = await response.json();
        allNfts.push(...data.ownedNfts);
        if (data.pageKey) pageKey = data.pageKey;
        else hasMore = false;
    }
    console.log(`Fetched ${allNfts.length} total NFTs. Processing metadata...`);
    const nftPromises = allNfts.map(async (nft) => {
        const metadataUrl = formatIpfsUrl(nft.tokenUri);
        if (!metadataUrl) return null;
        try {
            const metadataResponse = await fetch(metadataUrl);
            if (!metadataResponse.ok) return { tokenId: nft.tokenId, title: "Metadata Fetch Failed", description: "", media: [] };
            const metadata = await metadataResponse.json();
            let mediaItems = (metadata.properties?.media || []).map(item => ({...item, gatewayUrl: formatIpfsUrl(item.gatewayUrl || (item.cid ? `ipfs://${item.cid}` : '')) }));
            if (mediaItems.length === 0 && metadata.image) mediaItems.push({ gatewayUrl: formatIpfsUrl(metadata.image), fileName: 'Primary Image' });
            return {tokenId: nft.tokenId, title: metadata.name || 'Untitled', description: metadata.description || '', media: mediaItems.filter(item => item.gatewayUrl)};
        } catch (e) {
            return { tokenId: nft.tokenId, title: "Invalid Metadata", description: "", media: [] };
        }
    });
    return Promise.all(nftPromises);
};

const formatIpfsUrl = (url) => {
    if (!url) return '';
    return url.startsWith('ipfs://') ? `https://gateway.pinata.cloud/ipfs/${url.substring(7)}` : url.replace('ipfs.io', 'gateway.pinata.cloud');
};


function GalleryPage() {
    const { account, connectWallet, isConnecting } = useContext(WalletContext);
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
                setNfts(processedNfts.filter(Boolean).sort((a, b) => b.tokenId - a.tokenId));
                if (processedNfts.length === 0) { setError("You don't own any Chronicles yet."); }
            } catch (err) {
                setError(`A critical error occurred: ${err.message}.`);
            } finally {
                setIsLoading(false);
            }
        };
        runFetch();
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
            
            {isLoading && <div className="text-center text-warm-brown">Loading all your chronicles...</div>}
            {error && <div className="text-center text-red-600 bg-red-100 p-4 rounded-lg">{error}</div>}

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                {nfts.map(nft => (
                    <div key={nft.tokenId} className="bg-cream/20 backdrop-blur-md rounded-xl shadow-lg border border-warm-brown/20 flex flex-col overflow-hidden">
                        
                        {/* --- THIS IS THE UPDATED DISPLAY LOGIC --- */}
                        <div className="aspect-square w-full">
                            {nft.media && nft.media.length > 0 ? (
                                <div className={`grid h-full w-full gap-1 ${nft.media.length > 1 ? 'grid-cols-2' : 'grid-cols-1'}`}>
                                    {nft.media.slice(0, 4).map((item, index) => (
                                        <div key={index} className={`
                                            ${nft.media.length === 1 ? 'col-span-2 row-span-2' : ''}
                                            ${nft.media.length === 2 ? 'row-span-2' : ''}
                                            ${nft.media.length === 3 && index === 0 ? 'row-span-2' : ''}
                                            bg-cream/10`}>
                                            <a href={item.gatewayUrl} target="_blank" rel="noopener noreferrer" className="h-full w-full block">
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
                               <div className="aspect-square flex items-center justify-center bg-cream/10 p-4 text-center text-warm-brown/70">
                                    "No media found"
                               </div>
                            )}
                        </div>
                        {/* --- END OF UPDATED LOGIC --- */}
                        
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