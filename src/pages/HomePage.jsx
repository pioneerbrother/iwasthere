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
    
    const [isLoading, setIsLoading] = useState(true); // <-- Start in loading state
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
                setFeedback("Configuration error: App is not set up correctly.");
                setIsLoading(false);
                return;
            }
            try {
                // Use ethers.providers.JsonRpcProvider for ethers v5
         const readOnlyProvider = new ethers.JsonRpcProvider(publicRpcUrl);
                const contract = new ethers.Contract(iWasThereNFTAddress, IWasThereABI, readOnlyProvider);
                
                const [currentMinted, currentMax] = await Promise.all([
                    contract.mintedCount(),
                    contract.MAX_SUPPLY()
                ]);
                setMintedCount(Number(currentMinted));
                setMaxSupply(Number(currentMax));
                // After fetching contract data, then check for free mint
                checkFreeMint();
            } catch (error) {
                console.error("Error fetching contract data:", error);
                setFeedback("Could not fetch contract data. The network may be busy.");
                setIsLoading(false);
            }
        };
        fetchData();
    }, [iWasThereNFTAddress, publicRpcUrl, checkFreeMint, account]); // <-- Add account to dependency array

    const handleFileChange = (event) => {
        const files = Array.from(event.target.files);
        // ... (rest of function is the same) ...
    };

    const triggerFileSelect = () => {
        fileInputRef.current.click();
    };

    const handleMint = async () => {
        // ... (rest of function is the same, but ensure it has a finally block) ...
    };

    return (
        <div className="homepage-main-container">
            <div className="mint-card">
                <h1 className="card-title">Chronicle Your Moment</h1>
                <p className="card-subtitle">Immortalize up to {MAX_PHOTOS_PER_BUNDLE} photos and {MAX_VIDEOS_PER_BUNDLE} videos (max {MAX_TOTAL_FILE_SIZE_MB}MB total) of a single event on the blockchain.</p>
                
                <div className="supply-info">
                    {maxSupply > 0 ? `${mintedCount.toLocaleString()} / ${maxSupply.toLocaleString()} CHRONICLED` : "Loading..."}
                </div>
                <div className="price-info">
                    Price: {isFreeMintAvailable ? "FREE (1-time offer!)" : `${PAID_MINT_PRICE_USDC} USDC per bundle`}
                </div>

                {account && (
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
                )}

                {!account ? (
                    <button className="action-button connect-button" onClick={connectWallet} disabled={isConnecting}>
                        {isConnecting ? "Connecting..." : "Connect Wallet"}
                    </button>
                ) : (
                    <button className="action-button mint-button" onClick={handleMint} disabled={isLoading || selectedFiles.length === 0}>
                        {isLoading ? "Processing..." : (isFreeMintAvailable ? "Chronicle FREE Bundle" : `Chronicle Bundle (${PAID_MINT_PRICE_USDC} USDC)`)}
                    </button>
                )}
                
                {feedback && <p className="feedback-text">{feedback}</p>}
            </div>
        </div>
    );
}

export default HomePage;
