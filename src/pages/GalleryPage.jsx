import React, { useState, useEffect, useContext } from 'react';
import { Link } from 'react-router-dom';
import { WalletContext } from '../contexts/WalletContext.jsx';

const newContractAddress = import.meta.env.VITE_SUBSCRIPTION_CONTRACT_ADDRESS; 
const ALCHEMY_API_KEY = import.meta.env.VITE_ALCHEMY_API_KEY;
const ALCHEMY_URL = `https://polygon-mainnet.g.alchemy.com/nft/v3/${ALCHEMY_API_KEY}/getNFTsForOwner`;

const formatIpfsUrl = (url) => {
    if (!url || typeof url !== 'string') return '';
    if (url.startsWith('ipfs://')) return `https://gateway.pinata.cloud/ipfs/${url.substring(7)}`;
    if (url.startsWith('https://')) return url.replace('ipfs.io', 'gateway.pinata.cloud');
    return '';
};

const fetchAndProcessNfts = async (account) => {
    if (!newContractAddress) {
        throw new Error("The restaurant's new address has not been set.");
    }
    let allNfts = [];
    let pageKey;
    const initialUrl = `${ALCHEMY_URL}?owner=${account}&contractAddresses[]=${newContractAddress}&withMetadata=true`;

    while (true) {
        let fetchUrl = initialUrl;
        if (pageKey) fetchUrl += `&pageKey=${pageKey}`;
        const response = await fetch(fetchUrl);
        if (!response.ok) throw new Error(`Could not fetch data from the blockchain.`);
        const data = await response.json();
        if (data.ownedNfts) allNfts.push(...data.ownedNfts);
        pageKey = data.pageKey;
        if (!pageKey) break;
    }
    
    const nftPromises = allNfts.map(async (nft) => {
        const metadataUrl = formatIpfsUrl(nft.tokenUri);
        if (!metadataUrl) return null;
        try {
            const metadataResponse = await fetch(metadataUrl);
            if (!metadataResponse.ok) return { tokenId: nft.tokenId, title: `Chronicle ${nft.tokenId}`, media: [] };
            const metadata = await metadataResponse.json();
            const mediaItem = metadata.image ? { gatewayUrl: formatIpfsUrl(metadata.image), fileName: 'Primary Media' } : null;
            return { tokenId: nft.tokenId, title: metadata.name || 'Untitled', description: metadata.description || 'No description.', media: [mediaItem].filter(Boolean) };
        } catch (e) {
            return { tokenId: nft.tokenId, title: `Chronicle ${nft.tokenId}`, media: [] };
        }
    });
    
    return Promise.all(nftPromises);
};

function GalleryPage() {
    const { account, connectWallet, isConnecting } = useContext(WalletContext);
    const [nfts, setNfts] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState('');

    useEffect(() => {
        const serveDishes = async () => {
            if (!account) { setIsLoading(false); return; }
            setIsLoading(true);
            setError('');
            try {
                const preparedDishes = await fetchAndProcessNfts(account);
                const sortedMenu = (preparedDishes || []).filter(Boolean).sort((a, b) => parseInt(b.tokenId) - parseInt(a.tokenId));
                setNfts(sortedMenu);
                if (sortedMenu.length === 0) setError("You have not chronicled any memories yet.");
            } catch (err) {
                setError(`A critical error occurred: ${err.message}`);
            } finally {
                setIsLoading(false);
            }
        };
        serveDishes();
    }, [account]);

    if (!account) {
        return (
            <div className="text-center p-8">
                <h1 className="text-4xl font-bold text-warm-brown mb-8">My Chronicles</h1>
                <p className="mb-6">Please connect your wallet to view your memories.</p>
                <button onClick={connectWallet} disabled={isConnecting} className="bg-sage-green ...">{isConnecting ? 'Connecting...' : 'Connect Wallet'}</button>
            </div>
        );
    }
    
    if (isLoading) {
        return <div className="text-center text-warm-brown p-8">Gathering your memories from the blockchain...</div>;
    }

    if (error) {
        return (
            <div className="w-full max-w-6xl mx-auto px-4 text-center">
                <h1 className="text-4xl font-bold text-warm-brown mb-8">My Chronicles</h1>
                <div className="text-red-600 bg-red-100 p-4 rounded-lg my-8">
                    <p className="font-bold">An error occurred</p><p>{error}</p>
                </div>
                <Link to="/" className="font-bold text-sage-green hover:underline">← Chronicle another moment</Link>
            </div>
        );
    }
    
    return (
        <div className="w-full max-w-6xl mx-auto px-4">
            <h1 className="text-4xl font-bold text-warm-brown text-center mb-8">My Chronicles</h1>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                {nfts.map(nft => (
                    <div key={`${newContractAddress}-${nft.tokenId}`} className="bg-cream/20 backdrop-blur-md rounded-xl shadow-lg border border-warm-brown/20 flex flex-col overflow-hidden transition-all duration-300 hover:shadow-xl hover:-translate-y-1">
                        <div className="aspect-square w-full bg-cream/10">
                            {nft.media && nft.media.length > 0 ? (
                                <a href={nft.media[0].gatewayUrl} target="_blank" rel="noopener noreferrer" className="block w-full h-full">
                                    <img src={nft.media[0].gatewayUrl} alt={nft.title} className="w-full h-full object-cover" loading="lazy" onError={(e) => { e.target.src = 'https://dummyimage.com/600x600/f0f0f0/999999.png&text=Error'; }} />
                                </a>
                            ) : (
                               <div className="flex items-center justify-center h-full text-warm-brown/70 p-4">No media found</div>
                            )}
                        </div>
                        <div className="p-6 flex-1 flex flex-col">
                            <h2 className="text-2xl font-bold text-warm-brown truncate" title={nft.title}>{nft.title}</h2>
                            <p className="text-sm text-warm-brown/70 mb-2">Token ID: {nft.tokenId}</p>
                            <p className="text-sm text-warm-brown/80 italic line-clamp-2 mb-4" title={nft.description}>{nft.description}</p>
                            <div className="mt-auto pt-4 border-t border-warm-brown/10">
                                <h3 className="font-semibold text-warm-brown mb-2">
                                    All Media ({nft.media.length}):
                                </h3>
                                <ul className="text-sm space-y-1 max-h-24 overflow-y-auto">
                                    {nft.media.map((item, index) => (
                                        <li key={index}>
                                            <a href={item.gatewayUrl} target="_blank" rel="noopener noreferrer" className="text-sage-green hover:text-forest-green hover:underline truncate block">
                                                {`Media ${index + 1}`}
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
                <Link to="/" className="font-bold text-sage-green hover:text-forest-green hover:underline">← Chronicle another moment</Link>
            </div>
        </div>
    );
}

export default GalleryPage;