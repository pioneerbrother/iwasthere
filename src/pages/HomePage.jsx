import { Buffer } from 'buffer';
window.Buffer = Buffer;
import React, { useState, useEffect, useContext, useRef, useCallback } from 'react';
import { ethers } from 'ethers';
import { WalletContext } from '../contexts/WalletContext.jsx';

import IWasThereABI from '../abis/IWasThere.json';
import ERC20ABI_file from '../abis/ERC20.json';
const ERC20ABI = ERC20ABI_file.abi;

const iWasThereNFTAddress = import.meta.env.VITE_IWAS_THERE_NFT_ADDRESS;
const usdcAddress = import.meta.env.VITE_USDC_ADDRESS;
const publicRpcUrl = import.meta.env.VITE_PUBLIC_POLYGON_RPC_URL;
const POLYGON_MAINNET_CHAIN_ID = 137;

const MAX_PHOTOS_PER_BUNDLE = 12;
const MAX_VIDEOS_PER_BUNDLE = 2;
const MAX_TOTAL_FILE_SIZE_MB = 75;
const MAX_TOTAL_FILE_SIZE_BYTES = MAX_TOTAL_FILE_SIZE_MB * 1024 * 1024;
const PAID_MINT_PRICE_USDC = 2;

function HomePage() {
    const { signer, account, chainId, connectWallet, isConnecting } = useContext(WalletContext);
    
    const [isLoading, setIsLoading] = useState(true);
    const [feedback, setFeedback] = useState("Initializing...");
    const [mintedCount, setMintedCount] = useState(0);
    const [maxSupply, setMaxSupply] = useState(0);
    const [selectedFiles, setSelectedFiles] = useState([]);
    const [isFreeMintAvailable, setIsFreeMintAvailable] = useState(false);
    const [latestTxHash, setLatestTxHash] = useState('');
    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    
    const fileInputRef = useRef(null);

    // ... (All of your data fetching and minting logic functions are correct and remain here)

    return (
        <div className="w-full max-w-md p-8 space-y-6 bg-white rounded-2xl shadow-xl text-dark-text">
            
            <div className="text-center">
                <h1 className="text-4xl font-bold text-dark-text">Chronicle Your Moment</h1>
                <p className="mt-2 text-gray-600">Immortalize your memories on the blockchain. Forever.</p>
            </div>

            <div className="space-y-4">
                <div className="flex justify-between p-4 border border-gray-200 rounded-lg">
                    <div className="text-center w-1/2">
                        <span className="text-xs text-gray-500 uppercase">Minted</span>
                        <p className="text-xl font-bold text-dark-text">{maxSupply > 0 ? `${mintedCount.toLocaleString()} / ${maxSupply.toLocaleString()}` : "..."}</p>
                    </div>
                    <div className="text-center w-1/2">
                        <span className="text-xs text-gray-500 uppercase">Price</span>
                        <p className="text-xl font-bold text-dark-text">{isFreeMintAvailable ? "FREE" : `${PAID_MINT_PRICE_USDC} USDC`}</p>
                    </div>
                </div>

                {!account ? (
                    <button onClick={connectWallet} disabled={isConnecting} className="w-full px-4 py-3 font-bold text-dark-text bg-white border-2 border-dark-text rounded-lg hover:bg-gray-100 transition-colors disabled:opacity-50">
                        {isConnecting ? "Connecting..." : "Connect Wallet to Begin"}
                    </button>
                ) : (
                    <div className="space-y-4">
                        <div onClick={() => fileInputRef.current.click()} className="flex flex-col items-center justify-center w-full p-6 border-2 border-dashed border-gray-300 rounded-lg cursor-pointer hover:bg-gray-50 transition-colors">
                            <input type="file" multiple accept="image/*,video/*" onChange={handleFileChange} ref={fileInputRef} className="hidden" />
                            <span className="text-2xl opacity-50">🌿</span>
                            <p className="font-semibold text-dark-text">Click to select files</p>
                            {selectedFiles.length > 0 ? (
                                <p className="text-sm text-gray-500 mt-1">
                                    {selectedFiles.length} file(s) selected ({ (selectedFiles.reduce((s, f) => s + f.size, 0) / 1024 / 1024).toFixed(2) } MB)
                                </p>
                            ) : (
                                <p className="text-sm text-gray-500 mt-1">Up to {MAX_TOTAL_FILE_SIZE_MB}MB total</p>
                            )}
                        </div>
                        
                        {selectedFiles.length > 0 && (
                            <div className="space-y-4">
                                <input
                                    type="text"
                                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-green"
                                    placeholder="Title for your Chronicle (optional)"
                                    value={title}
                                    onChange={(e) => setTitle(e.target.value)}
                                />
                                <textarea
                                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-green"
                                    rows="3"
                                    placeholder="Add a description or note..."
                                    value={description}
                                    onChange={(e) => setDescription(e.target.value)}
                                />
                                <button onClick={handleMint} disabled={isLoading} className="w-full py-3 font-bold text-white bg-dark-text rounded-lg hover:bg-opacity-90 transition-colors disabled:bg-gray-400">
                                    {isLoading ? "Processing..." : (isFreeMintAvailable ? "Chronicle FREE Bundle" : "Chronicle Bundle (2 USDC)")}
                                </button>
                            </div>
                        )}
                    </div>
                )}
            </div>
            
            {feedback && <p className="mt-4 text-center text-sm text-gray-600 min-h-[20px]">{feedback}</p>}
            {latestTxHash && (
                <div className="mt-4 text-center text-sm">
                    <a href={`https://polygonscan.com/tx/${latestTxHash}`} target="_blank" rel="noopener noreferrer" className="font-semibold text-brand-green hover:underline">
                        View Transaction
                    </a>
                </div>
            )}
        </div>
    );
}

export default HomePage;