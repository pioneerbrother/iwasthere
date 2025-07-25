import React, { useState, useEffect, useContext } from 'react';
import { WalletContext } from '../contexts/WalletContext';
import { Link } from 'react-router-dom';

const ALCHEMY_API_KEY = import.meta.env.VITE_ALCHEMY_API_KEY;
const IWT_CONTRACT_ADDRESS = import.meta.env.VITE_IWAS_THERE_NFT_ADDRESS;
const ALCHEMY_URL = `https://polygon-mainnet.g.alchemy.com/nft/v3/${ALCHEMY_API_KEY}/getNFTsForOwner`;

// These helper functions are correct and remain the same.
const formatIpfsUrl = (url) => { /* ... */ };
const fetchAndProcessNfts = async (account) => { /* ... */ };

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
                const validNfts = processedNfts.filter(Boolean).sort((a, b) => b.tokenId - a.tokenId);
                setNfts(validNfts);
            } catch (err) {
                setError(`A critical error occurred: ${err.message}.`);
            } finally {
                setIsLoading(false);
            }
        };
        runFetch();
    }, [account]);

    if (!account) { /* ... Connect Wallet Button ... */ }

    return (
        <div className="w-full max-w-6xl mx-auto px-4">
            <h1 className="text-4xl font-bold text-center mb-8">My Chronicles</h1>
            
            {isLoading && <div className="text-center">Loading...</div>}
            {error && <div className="text-center text-red-500">{error}</div>}

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                {nfts.map(nft => (
                    <div key={nft.tokenId} className="flex flex-col ...">
                        
                        <div className="aspect-square w-full">
                            {/* Image Grid Logic is correct and remains */}
                        </div>
                        
                        <div className="p-6 flex-1 flex flex-col">
                            <h2 className="text-2xl ...">{nft.title}</h2>
                            <p className="text-sm ...">Token ID: {nft.tokenId}</p>
                            
                            {/* THIS IS THE CLEANED UP SECTION */}
                            {nft.media && nft.media.length > 0 && (
                                <div className="mt-auto">
                                    <h3 className="font-semibold mb-2">
                                        All Media ({nft.media.length}):
                                    </h3>
                                    <ul className="text-sm space-y-1 max-h-24 overflow-y-auto">
                                        {nft.media.map((item, index) => (
                                            <li key={index}>
                                                <a href={item.gatewayUrl} target="_blank" rel="noopener noreferrer" className="hover:underline">
                                                    {item.fileName || `Item ${index + 1}`}
                                                </a>
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            )}
                            {/* END OF CLEANED UP SECTION */}
                        </div>
                    </div>
                ))}
            </div>
            
            <div className="text-center mt-12">
                <Link to="/" className="font-bold ...">← Chronicle another moment</Link>
            </div>
        </div>
    );
}

export default GalleryPage;