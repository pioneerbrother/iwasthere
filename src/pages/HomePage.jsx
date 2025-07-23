import { Buffer } from 'buffer';
window.Buffer = Buffer;
import React, { useState, useEffect, useContext, useRef, useCallback } from 'react';
import { ethers } from 'ethers';
import { WalletContext } from '../contexts/WalletContext.jsx';
import './HomePage_nature_final.css'; // <-- CORRECT, FINAL CSS IMPORT

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
        if (files.length === 0) { setSelectedFiles([]); return; }
        let totalSize = 0, photoCount = 0, videoCount = 0;
        for (const file of files) {
            totalSize += file.size;
            if (file.type.startsWith('image/')) photoCount++;
            else if (file.type.startsWith('video/')) videoCount++;
        }
        if (photoCount > MAX_PHOTOS_PER_BUNDLE || videoCount > MAX_VIDEOS_PER_BUNDLE) {
            setFeedback(`Error: Max ${MAX_PHOTOS_PER_BUNDLE} photos and ${MAX_VIDEOS_PER_BUNDLE} videos.`);
            setSelectedFiles([]);
            return;
        }
        if (totalSize > MAX_TOTAL_FILE_SIZE_BYTES) {
            setFeedback(`Error: Total file size exceeds ${MAX_TOTAL_FILE_SIZE_MB}MB.`);
            setSelectedFiles([]);
            return;
        }
        setSelectedFiles(files);
        setFeedback("Files selected. Ready to Chronicle.");
        setLatestTxHash('');
    }, []);

    const triggerFileSelect = useCallback(() => {
        if (fileInputRef.current) fileInputRef.current.click();
    }, []);

    const handleMint = useCallback(async () => {
        if (!signer || selectedFiles.length === 0) {
            setFeedback("Please connect wallet and select files.");
            return;
        }
        setIsLoading(true);
        setLatestTxHash('');
        setFeedback("Processing...");
        try {
            const filesData = await Promise.all(selectedFiles.map(async (file) => {
                const buffer = await file.arrayBuffer();
                const base64String = Buffer.from(buffer).toString('base64');
                return { fileName: file.name, fileContentBase64: base64String, fileType: file.type };
            }));
            const messageToSign = `ChronicleMe: Verifying access for ${account} to upload media and request mint.`;
            const signature = await signer.signMessage(messageToSign);
            const processMintResponse = await fetch('/.netlify/functions/processMint', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ files: filesData, walletAddress: account, signature, isFreeMint: isFreeMintAvailable }),
            });
            const processMintResult = await processMintResponse.json();
            if (!processMintResponse.ok) { throw new Error(processMintResult.error || "Backend process failed."); }

            if (isFreeMintAvailable) {
                setFeedback("🎉 Success! Your FREE mint was submitted.");
                setLatestTxHash(processMintResult.transactionHash);
            } else {
                const ipfsMetadataCid = `ipfs://${processMintResult.metadataCID}`;
                setFeedback("Approving USDC...");
                const iWasThereContract = new ethers.Contract(iWasThereNFTAddress, IWasThereABI, signer);
                const usdcContract = new ethers.Contract(usdcAddress, ERC20ABI, signer);
                const contractMintPrice = ethers.BigNumber.from("2000000");
                const allowance = await usdcContract.allowance(account, iWasThereContract.address);
                if (allowance.lt(contractMintPrice)) {
                    const approveTx = await usdcContract.approve(iWasThereContract.address, contractMintPrice);
                    setFeedback("Confirming approval...");
                    await approveTx.wait(1);
                }
                setFeedback("Sending final mint transaction...");
                const mintTx = await iWasThereContract.mint(account, ipfsMetadataCid);
                await mintTx.wait(1);
                setFeedback("🎉 Success! Your Chronicle is on the blockchain!");
                setLatestTxHash(mintTx.hash);
            }
            setSelectedFiles([]);
            if (fileInputRef.current) fileInputRef.current.value = "";
            setMintedCount(prev => prev + 1);
            checkFreeMint();
        } catch (error) {
            setFeedback(`Error: ${error.reason || error.message || "An unknown error occurred."}`);
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
                
                {!account ? (
                    <button onClick={connectWallet} disabled={isConnecting} className="action-button connect-button">
                        {isConnecting ? "Connecting..." : "Connect Wallet"}
                    </button>
                ) : (
                    <>
                        <div className="file-upload-section" onClick={triggerFileSelect}>
                            <input type="file" multiple accept="image/*,video/*" onChange={handleFileChange} ref={fileInputRef} className="file-input" />
                            {selectedFiles.length === 0 ? (
                                <div className="file-prompt-text">
                                    Click or drag files here
                                </div>
                            ) : (
                                <div className="selected-files-details">
                                    <p>{selectedFiles.length} file(s) selected</p>
                                    <p className="size-tracker">
                                        Total Size: <strong>{(selectedFiles.reduce((s, f) => s + f.size, 0) / 1024 / 1024).toFixed(2)} MB / {MAX_TOTAL_FILE_SIZE_MB} MB</strong>
                                    </p>
                                </div>
                            )}
                        </div>
                        
                        {selectedFiles.length > 0 && (
                            <button onClick={handleMint} disabled={isLoading} className="action-button mint-button">
                                {mintButtonText()}
                            </button>
                        )}
                    </>
                )}
                
                <p className={feedback.startsWith('Error:') ? "feedback-text" : "status-text"}>{feedback}</p>
                
                {latestTxHash && (
                    <div className="tx-link">
                        <a href={`https://polygonscan.com/tx/${latestTxHash}`} target="_blank" rel="noopener noreferrer">
                            View Transaction on PolygonScan
                        </a>
                    </div>
                )}
            </div>
        </div>
    );
}

export default HomePage;