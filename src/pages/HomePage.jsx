import { Buffer } from 'buffer';
window.Buffer = Buffer;
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
    const [description, setDescription] = useState('');
    const [title, setTitle] = useState(''); // Added state for title
    
    const fileInputRef = useRef(null);

    const checkFreeMint = useCallback(async () => {
        // ... (This function is correct)
    }, [account]);

    useEffect(() => {
        // ... (This useEffect is correct)
    }, [iWasThereNFTAddress, publicRpcUrl, account, checkFreeMint]);

    const handleFileChange = useCallback((event) => {
        const files = Array.from(event.target.files);
        if (files.length === 0) {
            setSelectedFiles([]);
            setFeedback("No files selected.");
            return;
        }

        let totalSize = 0, photoCount = 0, videoCount = 0;
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
        setFeedback("Files selected. Add a title and description, then you're ready to Chronicle.");
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
                body: JSON.stringify({ 
                    files: filesData, 
                    walletAddress: account, 
                    signature, 
                    isFreeMint: isFreeMintAvailable,
                    title: title || `Chronicle by ${account.slice(0,6)}...`, // Pass title
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
            setTitle(''); // Clear title
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
        <div className="w-full max-w-lg p-8 space-y-4 bg-white rounded-2xl shadow-xl">
            <div className="text-center">
                <h1 className="text-4xl font-bold text-dark-text">Chronicle Your Moment</h1>
                <p className="mt-2 text-gray-600">Immortalize your memories on the blockchain. Forever.</p>
            </div>

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
                <button onClick={connectWallet} disabled={isConnecting} className="w-full py-3 font-bold text-dark-text bg-white border-2 border-dark-text rounded-lg">
                    {isConnecting ? "Connecting..." : "Connect Wallet"}
                </button>
            ) : (
                <>
                    <div onClick={triggerFileSelect} className="flex flex-col items-center justify-center w-full p-6 border-2 border-dashed border-gray-300 rounded-lg cursor-pointer">
                        <input type="file" multiple accept="image/*,video/*" onChange={handleFileChange} ref={fileInputRef} className="hidden" />
                        <span className="text-2xl opacity-50">🌿</span>
                        <p className="font-semibold text-dark-text">Click to select files</p>
                        <p className="text-sm text-gray-500">Total Size: {(selectedFiles.reduce((s, f) => s + f.size, 0) / 1024 / 1024).toFixed(2)} MB</p>
                    </div>
                    
                    {selectedFiles.length > 0 && (
                        <div className="space-y-4">
                            <input
                                type="text"
                                className="w-full p-3 border border-gray-300 rounded-lg"
                                placeholder="Title for your Chronicle (e.g., Summer Vacation 2025)"
                                value={title}
                                onChange={(e) => setTitle(e.target.value)}
                            />
                            <textarea
                                className="w-full p-3 border border-gray-300 rounded-lg"
                                rows="3"
                                placeholder="Add a description or note..."
                                value={description}
                                onChange={(e) => setDescription(e.target.value)}
                            />
                            <button onClick={handleMint} disabled={isLoading} className="w-full py-3 font-bold text-white bg-dark-text rounded-lg">
                                {mintButtonText()}
                            </button>
                        </div>
                    )}
                </>
            )}
            
            {feedback && <p className="mt-2 text-center text-sm text-gray-600 min-h-[20px]">{feedback}</p>}
            {latestTxHash && (
                <div className="mt-2 text-center text-sm">
                    <a href={`https://polygonscan.com/tx/${latestTxHash}`} target="_blank" rel="noopener noreferrer" className="font-semibold text-brand-green hover:underline">
                        View Transaction
                    </a>
                </div>
            )}
        </div>
    );
}

export default HomePage;