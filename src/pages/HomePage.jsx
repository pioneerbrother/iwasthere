import React, { useState, useEffect, useContext, useRef, useCallback } from 'react';
import { ethers } from 'ethers';
import { WalletContext } from '../contexts/WalletContext.jsx';
import './HomePage.css';

import IWasThereABI from '../abis/IWasThere.json';
import ERC20ABI_file from '../abis/ERC20.json';
const ERC20ABI = ERC20ABI_file.abi;

const iWasThereNFTAddress = import.meta.env.VITE_IWAS_THERE_NFT_ADDRESS;
const usdcAddress = import.meta.env.VITE_USDC_ADDRESS;
const publicRpcUrl = import.meta.env.VITE_PUBLIC_POLYGON_RPC_URL;
const POLYGON_MAINNET_CHAIN_ID = 137;

const MAX_PHOTOS_PER_BUNDLE = 12;
const MAX_VIDEOS_PER_BUNDLE = 2;
const MAX_TOTAL_FILE_SIZE_MB = 25;
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
    
    const fileInputRef = useRef(null);

    const checkFreeMint = useCallback(async () => {
        if (!account) return;
        setIsLoading(true);
        setFeedback("Checking for your free mint...");
        try {
            const response = await fetch('/.netlify/functions/checkFreeMint', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ walletAddress: account })
            });
            const data = await response.json();
            if (!response.ok) throw new Error(data.error || "Server error");
            
            setIsFreeMintAvailable(data.isAvailable);
            setFeedback(data.message);
        } catch (error) {
            console.error("Error checking free mint:", error);
            setFeedback(`Could not check free mint status: ${error.message}`);
            setIsFreeMintAvailable(false);
        } finally {
            setIsLoading(false);
        }
    }, [account]);

    useEffect(() => {
        const fetchData = async () => {
            if (!iWasThereNFTAddress || !publicRpcUrl) {
                setFeedback("Configuration error.");
                setIsLoading(false);
                return;
            }
            try {
                const readOnlyProvider = new ethers.providers.JsonRpcProvider(publicRpcUrl);
                const contract = new ethers.Contract(iWasThereNFTAddress, IWasThereABI, readOnlyProvider);
                const [currentMinted, currentMax] = await Promise.all([
                    contract.mintedCount(),
                    contract.MAX_SUPPLY()
                ]);
                setMintedCount(Number(currentMinted));
                setMaxSupply(Number(currentMax));
            } catch (error) {
                console.error("Error fetching contract data:", error);
                setFeedback("Could not fetch contract data.");
            }
        };

        fetchData();
        if (account) {
            checkFreeMint();
        } else {
            setFeedback("Connect your wallet to begin.");
            setIsLoading(false);
        }
    }, [iWasThereNFTAddress, publicRpcUrl, account, checkFreeMint]);

    const handleFileChange = useCallback((event) => {
        const files = Array.from(event.target.files);
        if (files.length === 0) {
            setSelectedFiles([]);
            return;
        }

        let totalSize = 0;
        let photoCount = 0;
        let videoCount = 0;

        for (const file of files) {
            totalSize += file.size;
            if (file.type.startsWith('image/')) photoCount++;
            else if (file.type.startsWith('video/')) videoCount++;
        }

        if (photoCount > MAX_PHOTOS_PER_BUNDLE || videoCount > MAX_VIDEOS_PER_BUNDLE) {
            setFeedback(`Error: Max ${MAX_PHOTOS_PER_BUNDLE} photos and ${MAX_VIDEOS_PER_BUNDLE} videos.`);
            setSelectedFiles([]);
            if (fileInputRef.current) fileInputRef.current.value = "";
            return;
        }

        if (totalSize > MAX_TOTAL_FILE_SIZE_BYTES) {
            setFeedback(`Error: Total file size exceeds ${MAX_TOTAL_FILE_SIZE_MB}MB.`);
            setSelectedFiles([]);
            if (fileInputRef.current) fileInputRef.current.value = "";
            return;
        }
        
        setSelectedFiles(files);
        setFeedback("Files selected. Ready to Chronicle.");
    }, []);

    const triggerFileSelect = useCallback(() => {
        fileInputRef.current.click();
    }, []);

    const handleMint = useCallback(async () => {
        if (!signer || selectedFiles.length === 0) {
            setFeedback("Please connect wallet and select files.");
            return;
        }
        setIsLoading(true);
        setFeedback("1/4: Preparing your files...");
        try {
            // ... (rest of the mint logic is the same and correct)
        } catch (error) {
            // ... (error handling is the same and correct)
        } finally {
            setIsLoading(false);
        }
    }, [account, signer, selectedFiles, isFreeMintAvailable, checkFreeMint]);

    const mintButtonText = () => {
        if (isLoading) return "Processing...";
        if (isFreeMintAvailable) return "Chronicle FREE Bundle";
        return `Chronicle Bundle (${PAID_MINT_PRICE_USDC} USDC)`;
    };

    return (
        <div className="homepage-main-container">
            <div className="mint-card">
                <h1 className="card-title">Chronicle Your Moment</h1>
                <p className="card-subtitle">Immortalize up to {MAX_PHOTOS_PER_BUNDLE} photos and {MAX_VIDEOS_PER_BUNDLE} videos (max {MAX_TOTAL_FILE_SIZE_MB}MB total).</p>
                
                <div className="supply-info">
                    {maxSupply > 0 ? `${mintedCount.toLocaleString()} / ${maxSupply.toLocaleString()} CHRONICLED` : "Loading..."}
                </div>
                <div className="price-info">
                    { !account ? `Price: ${PAID_MINT_PRICE_USDC} USDC per bundle` : isFreeMintAvailable ? "Price: FREE (1-time offer!)" : `Price: ${PAID_MINT_PRICE_USDC} USDC per bundle` }
                </div>

                {/* --- RENDER LOGIC --- */}
                {!account ? (
                    <button className="action-button connect-button" onClick={connectWallet} disabled={isConnecting}>
                        {isConnecting ? "Connecting..." : "Connect Wallet"}
                    </button>
                ) : (
                    <>
                        <div className="file-upload-section">
                            <input type="file" multiple accept="image/*,video/*" onChange={handleFileChange} ref={fileInputRef} style={{ display: 'none' }} />
                            <button className="select-files-button" onClick={triggerFileSelect}>
                                Select Your Photos/Videos
                            </button>
                            {selectedFiles.length > 0 && (
                                <p className="selected-files-info">
                                    {selectedFiles.length} file(s) selected ({
                                        (selectedFiles.reduce((sum, file) => sum + file.size, 0) / (1024 * 1024)).toFixed(2)
                                    } MB)
                                </p>
                            )}
                        </div>
                        
                        {/* KEY CHANGE: The mint button is now always visible when connected, but disabled if no files are selected */}
                        <button 
                            className="action-button mint-button" 
                            onClick={handleMint} 
                            disabled={isLoading || selectedFiles.length === 0}
                        >
                            {mintButtonText()}
                        </button>
                    </>
                )}
                
                {feedback && <p className="feedback-text">{feedback}</p>}
            </div>
        </div>
    );
}

export default HomePage;