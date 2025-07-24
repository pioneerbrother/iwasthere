import { Buffer } from 'buffer';
window.Buffer = Buffer;
import React, { useState, useEffect, useContext, useRef, useCallback } from 'react';
import { ethers } from 'ethers';
import { WalletContext } from '../contexts/WalletContext.jsx';
// NO incorrect CSS import here.

import IWasThereABI from '../abis/IWasThere.json';
import ERC20ABI_file from '../abis/ERC20.json';
const ERC20ABI = ERC20ABI_file.abi;

const iWasThereNFTAddress = import.meta.env.VITE_IWAS_THERE_NFT_ADDRESS;
const usdcAddress = import.meta.env.VITE_USDC_ADDRESS;
const publicRpcUrl = import.meta.env.VITE_PUBLIC_POLYGON_RPC_URL;
const POLYGON_MAINNET_CHAIN_ID = 137;

const MAX_PHOTOS_PER_BUNDLE = 12;
const MAX_VIDEOS_PER_BUNDLE = 2;
// --- THIS IS THE FIX ---
// The previous value of 75 was too large for the serverless function's 6MB payload limit.
// 4MB is a safe limit that prevents the request from being truncated.
const MAX_TOTAL_FILE_SIZE_MB = 4;
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
    const [description, setDescription] = useState('');
    const [title, setTitle] = useState('');
    
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
        setFeedback("Files selected. Add a title and description, then you're ready to Chronicle.");
        setLatestTxHash('');
    }, []);

    const triggerFileSelect = useCallback(() => {
        if (fileInputRef.current) fileInputRef.current.click();
    }, []);

    const handleMint = useCallback(async () => {
        if (!signer || selectedFiles.length === 0) return;
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
                body: JSON.stringify({ 
                    files: filesData, 
                    walletAddress: account, 
                    signature, 
                    isFreeMint: isFreeMintAvailable,
                    title: title || `Chronicle by ${account.slice(0,6)}...`,
                    description: description
                }),
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
                    await approveTx.wait(1);
                }
                const mintTx = await iWasThereContract.mint(account, ipfsMetadataCid);
                await mintTx.wait(1);
                setFeedback("🎉 Success! Your Chronicle is on the blockchain!");
                setLatestTxHash(mintTx.hash);
            }
            setSelectedFiles([]);
            setTitle('');
            setDescription('');
            if (fileInputRef.current) fileInputRef.current.value = "";
            setMintedCount(prev => prev + 1);
            checkFreeMint();
        } catch (error) {
            setFeedback(`Error: ${error.reason || error.message || "An unknown error occurred."}`);
        } finally {
            setIsLoading(false);
        }
    }, [account, signer, selectedFiles, isFreeMintAvailable, checkFreeMint, title, description]);

    const mintButtonText = () => {
        if (isLoading) return "Processing...";
        if (isFreeMintAvailable) return "Chronicle FREE Bundle";
        return `Chronicle Bundle (${PAID_MINT_PRICE_USDC} USDC)`;
    };

    return (
        <div className="w-full max-w-lg p-10 space-y-6 bg-cream/25 backdrop-blur-2xl rounded-2xl shadow-2xl border border-warm-brown/30 hover:shadow-terracotta/40 hover:-translate-y-1 transition-all duration-300">
            <div className="text-center">
                <h1 className="text-4xl font-bold bg-gradient-to-r from-forest-green via-sage-green to-warm-brown text-transparent bg-clip-text">Chronicle Your Moment</h1>
                <p className="mt-2 text-warm-brown/90">Immortalize your memories on the blockchain. Forever.</p>
            </div>
            <div className="flex justify-around p-4 bg-cream/20 rounded-xl border border-golden-yellow/30">
                <div className="text-center">
                    <span className="text-sm text-warm-brown/80 uppercase tracking-wider">Minted</span>
                    <p className="text-2xl font-bold text-warm-brown">{maxSupply > 0 ? `${mintedCount.toLocaleString()} / ${maxSupply.toLocaleString()}` : "..."}</p>
                </div>
                <div className="text-center">
                    <span className="text-sm text-warm-brown/80 uppercase tracking-wider">Price</span>
                    <p className="text-2xl font-bold text-warm-brown">{!account ? `${PAID_MINT_PRICE_USDC} USDC` : isFreeMintAvailable ? "FREE!" : `${PAID_MINT_PRICE_USDC} USDC`}</p>
                </div>
            </div>
            {!account ? (
                <button onClick={connectWallet} disabled={isConnecting} className="w-full px-4 py-3 font-bold text-cream bg-gradient-to-r from-terracotta to-warm-brown rounded-lg hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-golden-yellow transition-all duration-300 shadow-lg hover:shadow-xl disabled:bg-gray-500">
                    {isConnecting ? "Connecting..." : "Connect Wallet to Begin"}
                </button>
            ) : (
                <div className="space-y-4">
                    <div onClick={triggerFileSelect} className="flex flex-col items-center justify-center w-full p-6 border-2 border-dashed border-warm-brown/40 rounded-lg cursor-pointer hover:border-golden-yellow/60 hover:bg-golden-yellow/10 transition-colors">
                        <input type="file" multiple accept="image/*,video/*" onChange={handleFileChange} ref={fileInputRef} className="hidden" />
                        {selectedFiles.length === 0 ? (
                            <div className="text-center text-warm-brown/70">
                                <span className="text-4xl opacity-50">🌿</span>
                                <p className="font-semibold">Click or drag files here</p>
                                <p className="text-xs">Up to {MAX_PHOTOS_PER_BUNDLE} photos & {MAX_VIDEOS_PER_BUNDLE} videos</p>
                            </div>
                        ) : (
                            <div className="text-center text-warm-brown/90">
                                <p className="font-semibold">{selectedFiles.length} file(s) selected</p>
                                <p className="text-sm font-bold text-golden-yellow">Total Size: {(selectedFiles.reduce((s, f) => s + f.size, 0) / 1024 / 1024).toFixed(2)} MB / {MAX_TOTAL_FILE_SIZE_MB} MB</p>
                            </div>
                        )}
                    </div>
                    {selectedFiles.length > 0 && (
                        <div className="space-y-4">
                            <input
                                type="text"
                                className="w-full px-4 py-2 border border-warm-brown/30 rounded-lg bg-cream/20 text-warm-brown/90 placeholder-warm-brown/50 focus:outline-none focus:ring-2 focus:ring-golden-yellow"
                                placeholder="Title for your Chronicle (optional)"
                                value={title}
                                onChange={(e) => setTitle(e.target.value)}
                            />
                            <textarea
                                className="w-full px-4 py-2 border border-warm-brown/30 rounded-lg bg-cream/20 text-warm-brown/90 placeholder-warm-brown/50 focus:outline-none focus:ring-2 focus:ring-golden-yellow"
                                rows="3"
                                placeholder="Add a description or note..."
                                value={description}
                                onChange={(e) => setDescription(e.target.value)}
                            />
                            <button onClick={handleMint} disabled={isLoading} className="w-full px-4 py-3 font-bold text-cream bg-gradient-to-r from-sage-green to-forest-green rounded-lg hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-sage-green transition-all duration-300 shadow-lg hover:shadow-xl disabled:bg-gray-500">
                                {mintButtonText()}
                            </button>
                        </div>
                    )}
                </div>
            )}
            {feedback && <p className="mt-4 text-center text-sm text-warm-brown/80 min-h-[20px]">{feedback}</p>}
            {latestTxHash && (
                <div className="mt-4 text-center text-sm">
                    <a href={`https://polygonscan.com/tx/${latestTxHash}`} target="_blank" rel="noopener noreferrer" className="font-semibold text-sage-green hover:text-forest-green">
                        View Transaction on PolygonScan
                    </a>
                </div>
            )}
        </div>
    );
}

export default HomePage;