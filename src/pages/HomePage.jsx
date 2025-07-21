import React, { useState, useEffect, useContext, useRef } from 'react';
import { ethers } from 'ethers';
import { WalletContext } from '../contexts/WalletContext.jsx';
import './HomePage.css';

import IWasThereABI from '../abis/IWasThere.json';
import ERC20ABI_file from '../abis/ERC20.json';
const ERC20ABI = ERC20ABI_file.abi;

const iWasThereNFTAddress = import.meta.env.VITE_IWAS_THERE_NFT_ADDRESS;
const usdcAddress = import.meta.env.VITE_USDC_ADDRESS;
const publicRpcUrl = import.meta.env.VITE_PUBLIC_POLYGON_RPC_URL || "https://polygon-rpc.com/";
const POLYGON_MAINNET_CHAIN_ID = 137;

const MAX_PHOTOS_PER_BUNDLE = 12;
const MAX_VIDEOS_PER_BUNDLE = 2;
const MAX_TOTAL_FILE_SIZE_MB = 25;
const MAX_TOTAL_FILE_SIZE_BYTES = MAX_TOTAL_FILE_SIZE_MB * 1024 * 1024;
const PAID_MINT_PRICE_USDC = 2;

function HomePage() {
    const { signer, account, chainId, connectWallet, isConnecting } = useContext(WalletContext);
    
    const [isLoading, setIsLoading] = useState(false);
    const [feedback, setFeedback] = useState("");
    const [mintedCount, setMintedCount] = useState(0);
    const [maxSupply, setMaxSupply] = useState(0);
    const [selectedFiles, setSelectedFiles] = useState([]); // <-- State to hold the selected files
    const [isFreeMintAvailable, setIsFreeMintAvailable] = useState(false);
    
    const fileInputRef = useRef(null);

    // --- Data Fetching and Freemium Check ---
    useEffect(() => {
        // ... (This part is working, no changes needed) ...
    }, [iWasThereNFTAddress, publicRpcUrl]);

    useEffect(() => {
        // ... (Freemium check is working, no changes needed) ...
    }, [account]);

    // --- File Handling ---
    const handleFileChange = (event) => {
        const files = Array.from(event.target.files);
        let totalSize = 0;
        let photoCount = 0;
        let videoCount = 0;

        if (files.length === 0) return;

        for (const file of files) {
            totalSize += file.size;
            if (file.type.startsWith('image/')) photoCount++;
            else if (file.type.startsWith('video/')) videoCount++;
        }

        if (photoCount > MAX_PHOTOS_PER_BUNDLE || videoCount > MAX_VIDEOS_PER_BUNDLE) {
            setFeedback(`Error: Max ${MAX_PHOTOS_PER_BUNDLE} photos and ${MAX_VIDEOS_PER_BUNDLE} videos.`);
            return;
        }

        if (totalSize > MAX_TOTAL_FILE_SIZE_BYTES) {
            setFeedback(`Error: Total file size exceeds ${MAX_TOTAL_FILE_SIZE_MB}MB.`);
            return;
        }
        
        setSelectedFiles(files); // <-- KEY CHANGE: Store valid files in state
        setFeedback("");
    };

    // --- NEW: Function to trigger the hidden file input ---
    const triggerFileSelect = () => {
        fileInputRef.current.click();
    };

    // --- Minting Logic ---
    const handleMint = async () => {
        if (!signer || selectedFiles.length === 0) {
            setFeedback("Please connect your wallet and select files first.");
            return;
        }
        // ... (Rest of the handleMint function is correct, no changes needed) ...
    };

    // --- Render Logic ---
    return (
        <div className="homepage-main-container">
            <div className="mint-card">
                <h1 className="card-title">Chronicle Your Moment</h1>
                <p className="card-subtitle">Immortalize up to {MAX_PHOTOS_PER_BUNDLE} photos and {MAX_VIDEOS_PER_BUNDLE} videos (max {MAX_TOTAL_FILE_SIZE_MB}MB total) of a single event on the blockchain.</p>
                
                <div className="supply-info">{maxSupply > 0 ? `${mintedCount.toLocaleString()} / ${maxSupply.toLocaleString()} CHRONICLED` : "Loading..."}</div>
                <div className="price-info">Price: {isFreeMintAvailable ? "FREE (1-time offer!)" : `${PAID_MINT_PRICE_USDC} USDC per bundle`}</div>

                {/* --- KEY CHANGE: Improved File Upload UI --- */}
                {account && (
                    <div className="file-upload-section">
                        {/* Hidden file input, controlled by a ref */}
                        <input 
                            type="file" 
                            multiple 
                            accept="image/*,video/*" 
                            onChange={handleFileChange} 
                            ref={fileInputRef}
                            style={{ display: 'none' }} 
                        />
                        {/* Visible button to trigger file selection */}
                        <button className="select-files-button" onClick={triggerFileSelect}>
                            Select Your Photos/Videos
                        </button>
                        {/* Display info about selected files */}
                        {selectedFiles.length > 0 && (
                            <p className="selected-files-info">
                                {selectedFiles.length} file(s) selected ({
                                    (selectedFiles.reduce((sum, file) => sum + file.size, 0) / (1024 * 1024)).toFixed(2)
                                } MB)
                            </p>
                        )}
                    </div>
                )}

                {!account ? (
                    <button className="action-button connect-button" onClick={connectWallet} disabled={isConnecting}>
                        {isConnecting ? "Connecting..." : "Connect Wallet"}
                    </button>
                ) : (
                    <button 
                        className="action-button mint-button" 
                        onClick={handleMint} 
                        disabled={isLoading || selectedFiles.length === 0}
                    >
                        {isFreeMintAvailable ? "Chronicle FREE Bundle" : `Chronicle Bundle (${PAID_MINT_PRICE_USDC} USDC)`}
                    </button>
                )}
                
                {feedback && <p className="feedback-text">{feedback}</p>}
            </div>
        </div>
    );
}

export default HomePage;
