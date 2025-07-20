import React, { useState, useEffect, useContext, useRef, useCallback } from 'react';
import { ethers } from 'ethers';
import { WalletContext } from '../contexts/WalletContext.jsx';
import './HomePage.css';

// Import ABIs
import IWasThereABI_file from '../abis/IWasThere.json'; // This will come from your compiled contract
import ERC20ABI_file from '../abis/ERC20.json'; // This is a standard ERC20 ABI

const IWasThereABI = IWasThereABI_file.abi;
const ERC20ABI = ERC20ABI_file.abi;

// --- Configuration from your .env file ---
// IMPORTANT: Replace with your deployed contract addresses
const iWasThereNFTAddress = import.meta.env.VITE_IWAS_THERE_NFT_ADDRESS;
const usdcAddress = import.meta.env.VITE_USDC_ADDRESS;
// Public RPC URL for reading data without connecting wallet
const publicRpcUrl = import.meta.env.VITE_PUBLIC_POLYGON_RPC_URL || "https://polygon-rpc.com/"; 
const POLYGON_MAINNET_CHAIN_ID = 137; // Polygon Mainnet Chain ID

// --- File Upload Limits for Phase 1 Bundle ---
const MAX_PHOTOS_PER_BUNDLE = 12;
const MAX_VIDEOS_PER_BUNDLE = 2;
const MAX_TOTAL_FILE_SIZE_MB = 25; // Max 25 MB total for all files in the bundle
const MAX_TOTAL_FILE_SIZE_BYTES = MAX_TOTAL_FILE_SIZE_MB * 1024 * 1024;
const PAID_MINT_PRICE_USDC = 2; // Fixed price for paid bundles

function HomePage() {
    const { signer, account, chainId, connectWallet, isConnecting } = useContext(WalletContext);
    
    // --- State Management ---
    const [isLoading, setIsLoading] = useState(false);
    const [feedback, setFeedback] = useState("");
    const [mintedCount, setMintedCount] = useState(0);
    const [maxSupply, setMaxSupply] = useState(0);
    const [selectedFiles, setSelectedFiles] = useState([]);
    const [isFreeMintAvailable, setIsFreeMintAvailable] = useState(false); // New state for freemium
    
    const fileInputRef = useRef(null); // Ref to reset file input

    // --- Data Fetching (from read-only provider) ---
    useEffect(() => {
        const fetchData = async () => {
            if (!iWasThereNFTAddress || !publicRpcUrl) {
                console.warn("Missing contract address or RPC URL in .env for read-only provider.");
                setFeedback("Configuration error: Missing contract addresses.");
                return;
            }
            try {
                const readOnlyProvider = new ethers.JsonRpcProvider(publicRpcUrl);
                const contract = new ethers.Contract(iWasThereNFTAddress, IWasThereABI, readOnlyProvider);
                const currentMinted = await contract.mintedCount();
                const currentMax = await contract.MAX_SUPPLY();
                setMintedCount(Number(currentMinted));
                setMaxSupply(Number(currentMax));
            } catch (error) {
                console.error("Error fetching contract data:", error);
                setFeedback("Error fetching contract data. Check console.");
            }
        };

        fetchData();
        const interval = setInterval(fetchData, 15000); // Refresh every 15 seconds
        return () => clearInterval(interval);
    }, [iWasThereNFTAddress, publicRpcUrl]);


    // --- Check Free Mint Eligibility (when account changes or on load) ---
    const checkFreeMint = useCallback(async () => {
        if (!account) {
            setIsFreeMintAvailable(false);
            setFeedback("Connect wallet to check free mint eligibility.");
            return;
        }
        setIsLoading(true);
        setFeedback("Checking free mint eligibility...");
        try {
            // Call the Netlify function to check free mint status
            const response = await fetch('/.netlify/functions/checkFreeMint', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ walletAddress: account })
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || "Failed to check free mint eligibility.");
            }
            const data = await response.json();
            setIsFreeMintAvailable(data.isAvailable);
            setFeedback(data.message);
        } catch (error) {
            console.error("Error checking free mint:", error);
            setFeedback(`Error checking free mint: ${error.message}`);
            setIsFreeMintAvailable(false); // Assume not available on error
        } finally {
            setIsLoading(false);
        }
    }, [account]);

    useEffect(() => {
        checkFreeMint();
    }, [account, checkFreeMint]); // Re-check when account changes


    // --- File Handling ---
    const handleFileChange = (event) => {
        const files = Array.from(event.target.files);
        let totalSize = 0;
        let photoCount = 0;
        let videoCount = 0;
        let validFiles = [];

        if (files.length === 0) {
            setSelectedFiles([]);
            setFeedback("");
            return;
        }
        
        for (const file of files) {
            totalSize += file.size;
            if (file.type.startsWith('image/')) {
                photoCount++;
            } else if (file.type.startsWith('video/')) {
                videoCount++;
            }
            validFiles.push(file);
        }

        if (photoCount > MAX_PHOTOS_PER_BUNDLE || videoCount > MAX_VIDEOS_PER_BUNDLE) {
            setFeedback(`Error: Max ${MAX_PHOTOS_PER_BUNDLE} photos and ${MAX_VIDEOS_PER_BUNDLE} videos per bundle.`);
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
        
        setSelectedFiles(validFiles);
        setFeedback(""); // Clear previous feedback
    };

    // --- Minting Logic ---
    const handleMint = async () => {
        // --- Pre-flight Checks ---
        if (!signer) { setFeedback("Please connect your wallet first."); return; }
        if (chainId !== POLYGON_MAINNET_CHAIN_ID) { 
            setFeedback(`Error: Please switch to the Polygon Mainnet (Chain ID: ${POLYGON_MAINNET_CHAIN_ID}).`); 
            return; 
        }
        if (isLoading) return; // Prevent double click
        if (isSoldOut) { setFeedback("Max supply reached!"); return; }
        if (selectedFiles.length === 0) { setFeedback("Please select at least one file to chronicle."); return; }

        setIsLoading(true);
        setFeedback("1/4: Preparing your files for IPFS upload...");

        try {
            // STEP 1: UPLOAD FILES TO IPFS VIA NETLIFY FUNCTION (AND POTENTIALLY MINT FOR FREE)
            const filesData = await Promise.all(selectedFiles.map(async file => {
                return new Promise((resolve, reject) => {
                    const reader = new FileReader();
                    reader.onloadend = () => resolve({
                        fileName: file.name,
                        fileContentBase64: reader.result.split(',')[1],
                        fileType: file.type
                    });
                    reader.onerror = reject;
                    reader.readAsDataURL(file);
                });
            }));

            setFeedback("2/4: Confirming your wallet for secure upload and mint request...");
            const messageToSign = `ChronicleMe: Verifying access for ${account} to upload media and request mint.`;
            const signature = await signer.signMessage(messageToSign);

            // Call the unified backend function
            const processMintResponse = await fetch('/.netlify/functions/processMint', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    files: filesData,
                    walletAddress: account,
                    signature: signature,
                    isFreeMint: isFreeMintAvailable, // Indicate if this is a free mint attempt
                    title: `Chronicle Bundle by ${account}`,
                    description: `A collection of memories chronicled by ${account}.`
                }),
            });

            if (!processMintResponse.ok) {
                const errorData = await processMintResponse.json();
                throw new Error(errorData.error || "Minting process failed via backend.");
            }

            const processMintResult = await processMintResponse.json();
            const ipfsMetadataCid = `ipfs://${processMintResult.metadataCID}`;
            
            // If it was a free mint, the backend already handled the on-chain transaction.
            if (isFreeMint) {
                setFeedback("🎉 Success! Your FREE Chronicle Bundle is forever on the blockchain!");
            } else {
                // STEP 2: For PAID mints, frontend handles approval and calling `mint`
                setFeedback("3/4: Files uploaded to IPFS. Approving USDC for minting...");
                const iWasThereContract = new ethers.Contract(iWasThereNFTAddress, IWasThereABI, signer);
                const usdcContract = new ethers.Contract(usdcAddress, ERC20ABI, signer);
                
                // Fetch the current mint price from the contract
                const contractMintPrice = await iWasThereContract.mintPrice();

                const allowance = await usdcContract.allowance(account, iWasThereNFTAddress);
                if (allowance < contractMintPrice) {
                    const approveTx = await usdcContract.approve(iWasThereNFTAddress, contractMintPrice);
                    await approveTx.wait();
                    setFeedback("USDC approved. Sending mint transaction...");
                } else {
                    setFeedback("USDC allowance sufficient. Sending mint transaction...");
                }

                // STEP 3: Mint the NFT (Paid)
                const mintTx = await iWasThereContract.mint(account, ipfsMetadataCid);
                setFeedback("Mint transaction sent! Waiting for confirmation...");
                await mintTx.wait();
                setFeedback("🎉 Success! Your Chronicle Bundle is forever on the blockchain!");
            }

            setSelectedFiles([]); // Clear files on success
            if (fileInputRef.current) { // Reset file input
                fileInputRef.current.value = ""; 
            }
            setMintedCount(prevCount => prevCount + 1); // Update count
            checkFreeMint(); // Re-check free mint status after successful operation
            
        } catch (error) {
            console.error("Minting failed:", error);
            const errorMessage = error.reason || error.message || "Transaction failed. See console for details.";
            setFeedback(`Error: ${errorMessage}`);
        } finally {
            setIsLoading(false);
        }
    };

    const isSoldOut = maxSupply > 0 && mintedCount >= maxSupply;

    // --- Render Logic ---
    const mintButtonText = () => {
        if (isSoldOut) return "ALL MOMENTS CHRONICLED";
        if (isLoading) return "Processing...";
        if (selectedFiles.length === 0) return "Select files to Chronicle";
        if (isFreeMintAvailable) return "Chronicle FREE Bundle";
        return `Chronicle Bundle (${PAID_MINT_PRICE_USDC} USDC)`;
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
                        <input 
                            type="file" 
                            multiple 
                            accept="image/*,video/*" 
                            onChange={handleFileChange} 
                            ref={fileInputRef}
                            className="file-input"
                        />
                        {selectedFiles.length > 0 ? (
                            <p className="selected-files-info">
                                Selected: {selectedFiles.length} file(s) ({
                                    (selectedFiles.reduce((sum, file) => sum + file.size, 0) / (1024 * 1024)).toFixed(2)
                                } MB)
                            </p>
                        ) : (
                            <p className="file-prompt-text">Click to select your photos/videos</p>
                        )}
                    </div>
                )}

                {!account ? (
                    <button className="action-button connect-button" onClick={connectWallet} disabled={isConnecting}>
                        {isConnecting ? "Connecting..." : "Connect Wallet to Begin"}
                    </button>
                ) : (
                    <button 
                        className="action-button mint-button" 
                        onClick={handleMint} 
                        disabled={isLoading || isSoldOut || selectedFiles.length === 0 || isConnecting}
                    >
                        {mintButtonText()}
                    </button>
                )}
                
                {feedback && <p className="feedback-text">{feedback}</p>}
            </div>
        </div>
    );
}

export default HomePage;
