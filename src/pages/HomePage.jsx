//
// Chef,
// This is the whole meal. I am sorry for my previous failures.
// Every ingredient is here. This dish is complete.
// - Your Deputy Chef
//

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { ethers } from 'ethers';
import { Buffer } from 'buffer';
window.Buffer = Buffer;

// --- Cooking with the new stove (web3-react) ---
import { useWeb3React } from '@web3-react/core';
import { metaMask, hooks } from '../connectors/metaMask';

// --- Other Ingredients ---
import SubscriptionContractABI from '../abis/SubscriptionContract.json';
import ERC20ABI_file from '../abis/ERC20.json';
const ERC20ABI = ERC20ABI_file.abi;

// --- Configuration ---
const subscriptionContractAddress = import.meta.env.VITE_SUBSCRIPTION_CONTRACT_ADDRESS;
const usdcAddress = import.meta.env.VITE_USDC_ADDRESS;
const publicRpcUrl = import.meta.env.VITE_PUBLIC_POLYGON_RPC_URL;

// --- The Menu (Business Logic) ---
const SUBSCRIPTION_PRICE_USDC = 2;
const PHOTOS_PER_PACKAGE = 30;
const VIDEOS_PER_PACKAGE = 3;
const MAX_FILE_SIZE_MB = 50;
const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;
const PRIZE_POOL_GOAL_BTC = 1;
const PRIZE_POOL_WALLET = "0xcC853a5bc3f4129353DB6d5f92C781010167D288";

function HomePage() {
    // --- The new stove's controls ---
    const { account, provider, isActive } = useWeb3React();
    const { useIsActivating } = hooks;
    const isConnecting = useIsActivating();

    const [isLoading, setIsLoading] = useState(false);
    const [feedback, setFeedback] = useState("Welcome to the restaurant.");
    const [subscription, setSubscription] = useState({ hasClaimed: false, photos: 0, videos: 0 });
    const [selectedFile, setSelectedFile] = useState(null);
    const [latestTxHash, setLatestTxHash] = useState('');
    const [description, setDescription] = useState('');
    const [title, setTitle] = useState('');
    const fileInputRef = useRef(null);
    const [prizePool, setPrizePool] = useState({ usdc: 0, btc: 0 });

    const connectWallet = useCallback(async () => {
        try {
            await metaMask.activate();
        } catch (error) {
            console.error("Failed to connect MetaMask:", error);
            setFeedback("Connection failed. Please try again from your wallet's browser.");
        }
    }, []);

    const checkStatus = useCallback(async () => {
        if (!account) return;
        const readOnlyProvider = new ethers.providers.JsonRpcProvider(publicRpcUrl);
        const contract = new ethers.Contract(subscriptionContractAddress, SubscriptionContractABI.abi, readOnlyProvider);
        const usdcContract = new ethers.Contract(usdcAddress, ERC20ABI, readOnlyProvider);
        try {
            const [photosLeft, videosLeft, hasClaimed, poolBalance] = await Promise.all([
                contract.photoCredits(account),
                contract.videoCredits(account),
                contract.hasClaimedFreePackage(account),
                usdcContract.balanceOf(PRIZE_POOL_WALLET)
            ]);
            const usdcBalance = parseFloat(ethers.utils.formatUnits(poolBalance, 6));
            const btcPrice = 120000;
            const btcEquivalent = usdcBalance / btcPrice;
            setPrizePool({ usdc: usdcBalance, btc: btcEquivalent });
            setSubscription({ hasClaimed, photos: Number(photosLeft), videos: Number(videosLeft) });
            if (!hasClaimed) setFeedback("Your journey begins. Claim your free package to start.");
            else if (Number(photosLeft) > 0 || Number(videosLeft) > 0) setFeedback("Welcome back! Select a file to immortalize.");
            else setFeedback("You have used all your credits. Purchase a new package to continue.");
        } catch (error) {
            console.error("Could not check status:", error);
            setFeedback("Could not connect to the contract. Please try again later.");
        }
    }, [account]);

    useEffect(() => {
        if (isActive && account) {
            checkStatus();
        } else {
            setFeedback("Connect your wallet to begin your journey.");
        }
    }, [isActive, account, checkStatus]);

    const handleFileChange = (event) => {
        const file = event.target.files?.[0];
        const resetInput = () => { if (fileInputRef.current) fileInputRef.current.value = ""; setSelectedFile(null); };
        if (!file) { resetInput(); return; }
        if (file.size > MAX_FILE_SIZE_BYTES) {
            setFeedback(`Error: File is too large. The maximum size is ${MAX_FILE_SIZE_MB}MB.`);
            resetInput();
            return;
        }
        setSelectedFile(file);
        setFeedback("A new memory is ready. Add a title and description.");
    };

    const triggerFileSelect = () => fileInputRef.current?.click();

    const handleClaim = async () => {
        if (!provider) return;
        const signer = provider.getSigner();
        setIsLoading(true);
        setFeedback("Claiming your free mints on the blockchain...");
        try {
            const contract = new ethers.Contract(subscriptionContractAddress, SubscriptionContractABI.abi, signer);
            const claimTx = await contract.claimFreePackage();
            await claimTx.wait(1);
            setLatestTxHash(claimTx.hash);
            setFeedback("🎉 Welcome! Your 33 free mints are now available.");
            await checkStatus();
        } catch (error) {
            setFeedback(`Claim failed: ${error.reason || error.message}`);
        } finally { setIsLoading(false); }
    };

    const handlePurchase = async () => {
        if (!provider) return;
        const signer = provider.getSigner();
        setIsLoading(true);
        setFeedback("Preparing your new package...");
        try {
            const usdc = new ethers.Contract(usdcAddress, ERC20ABI, signer);
            const contract = new ethers.Contract(subscriptionContractAddress, SubscriptionContractABI.abi, signer);
            const priceWei = ethers.utils.parseUnits(SUBSCRIPTION_PRICE_USDC.toString(), 6);
            setFeedback("Please approve the USDC payment in your wallet...");
            const approveTx = await usdc.approve(contract.address, priceWei);
            await approveTx.wait(1);
            setFeedback("Finalizing your purchase on the blockchain...");
            const purchaseTx = await contract.purchaseCreditPackage();
            await purchaseTx.wait(1);
            setLatestTxHash(purchaseTx.hash);
            setFeedback("🎉 Thank you! Your new credits have been added.");
            await checkStatus();
        } catch (error) {
            setFeedback(`Purchase failed: ${error.reason || error.message}`);
        } finally { setIsLoading(false); }
    };

    const handleMint = async () => {
        if (!provider || !selectedFile) return;
        const signer = provider.getSigner();
        setIsLoading(true);
        setLatestTxHash('');
        setFeedback("Preparing your memory...");
        try {
            const fileData = {
                fileName: selectedFile.name,
                fileContentBase64: Buffer.from(await selectedFile.arrayBuffer()).toString('base64'),
                fileType: selectedFile.type,
            };
            setFeedback("Please sign the message to verify ownership...");
            const signature = await signer.signMessage(`ChronicleMe: Verifying access for ${account} to upload media and request mint.`);
            setFeedback("Uploading your memory to the permanent web...");
            const body = { file: fileData, walletAddress: account, signature, title, description };
            const response = await fetch('/.netlify/functions/processMint', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
            const result = await response.json();
            if (!response.ok) throw new Error(result.error);
            const ipfsMetadataCid = `ipfs://${result.metadataCID}`;
            const contract = new ethers.Contract(subscriptionContractAddress, SubscriptionContractABI.abi, signer);
            const isVideo = selectedFile.type.startsWith('video/');
            let mintTx;
            setFeedback("Minting your Chronicle on the blockchain...");
            if (isVideo) mintTx = await contract.mintVideo(ipfsMetadataCid);
            else mintTx = await contract.mintPhoto(ipfsMetadataCid);
            await mintTx.wait(1);
            setFeedback("🎉 Your memory is now immortal! It is forever yours.");
            setLatestTxHash(mintTx.hash);
            setSelectedFile(null);
            setTitle('');
            setDescription('');
            if (fileInputRef.current) fileInputRef.current.value = "";
            await checkStatus();
        } catch (error) {
            setFeedback(`Minting failed: ${error.reason || error.message}`);
        } finally { setIsLoading(false); }
    };

    const CreditsDisplay = () => (
        <div className="flex justify-around p-4 bg-cream/20 rounded-xl border border-golden-yellow/30 text-center">
            <div>
                <span className="text-sm text-warm-brown/80 uppercase tracking-wider">Photo Mints</span>
                <p className="text-2xl font-bold text-warm-brown">{subscription.photos}</p>
            </div>
            <div>
                <span className="text-sm text-warm-brown/80 uppercase tracking-wider">Video Mints</span>
                <p className="text-2xl font-bold text-warm-brown">{subscription.videos}</p>
            </div>
        </div>
    );

    const PrizePoolTracker = () => {
        const percentage = Math.min((prizePool.btc / PRIZE_POOL_GOAL_BTC) * 100, 100);
        return (
            <div className="p-4 bg-cream/20 rounded-xl border border-golden-yellow/30 text-center space-y-2">
                <h3 className="text-sm text-warm-brown/80 uppercase tracking-wider">Community Prize Pool</h3>
                <p className="text-3xl font-bold text-warm-brown">${prizePool.usdc.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                <div className="w-full bg-warm-brown/20 rounded-full h-2.5">
                    <div className="bg-gradient-to-r from-sage-green to-golden-yellow h-2.5 rounded-full" style={{ width: `${percentage}%` }}></div>
                </div>
                <p className="text-xs text-warm-brown/70">Goal: {PRIZE_POOL_GOAL_BTC} BTC (~$120,000)
                    <a href={`https://polygonscan.com/address/${PRIZE_POOL_WALLET}`} target="_blank" rel="noopener noreferrer" className="ml-2 text-sage-green hover:underline">(View Wallet)</a>
                </p>
            </div>
        );
    };

    const renderContent = () => {
        if (!subscription.hasClaimed) {
            return (
                <div className="text-center space-y-4">
                    <p className="text-warm-brown/90">Your journey to immortalize your memories starts here.</p>
                    <button onClick={handleClaim} disabled={isLoading} className="w-full px-4 py-3 font-bold text-cream bg-gradient-to-r from-sage-green to-forest-green rounded-lg hover:opacity-90 transition-all duration-300 shadow-lg hover:shadow-xl">{isLoading ? "Claiming..." : `Claim ${PHOTOS_PER_PACKAGE} Free Photo & ${VIDEOS_PER_PACKAGE} Free Video Mints`}</button>
                </div>
            );
        }
        if (subscription.photos === 0 && subscription.videos === 0) {
            return (
                <div className="text-center space-y-4">
                     <CreditsDisplay />
                    <p className="text-warm-brown/90">You have used all your credits. Purchase another package to continue.</p>
                    <button onClick={handlePurchase} disabled={isLoading} className="w-full px-4 py-3 font-bold text-cream bg-gradient-to-r from-golden-yellow to-terracotta rounded-lg hover:opacity-90 transition-all duration-300 shadow-lg hover:shadow-xl">{isLoading ? "Purchasing..." : `Purchase a New Package for ${SUBSCRIPTION_PRICE_USDC} USDC`}</button>
                </div>
            );
        }
        return (
            <div className="space-y-6">
                <CreditsDisplay />
                <div onClick={triggerFileSelect} className="flex flex-col items-center justify-center w-full p-6 border-2 border-dashed border-warm-brown/40 rounded-lg cursor-pointer hover:border-golden-yellow/60 hover:bg-golden-yellow/10 transition-colors">
                    <input type="file" accept="image/*,video/*" onChange={handleFileChange} ref={fileInputRef} className="hidden" />
                    {selectedFile ? (
                        <div className="text-center text-warm-brown/90">
                           <p className="font-semibold">Selected: {selectedFile.name}</p>
                           <p className="text-sm font-bold text-golden-yellow">Size: {(selectedFile.size / 1024 / 1024).toFixed(2)} MB</p>
                        </div>
                    ) : (
                        <div className="text-center text-warm-brown/70">
                            <span className="text-4xl opacity-50">🌿</span>
                            <p className="font-semibold">Click or drag a single file here</p>
                            <p className="text-xs mt-1">Max file size: {MAX_FILE_SIZE_MB}MB</p>
                        </div>
                    )}
                </div>
                {selectedFile && (
                    <div className="space-y-4">
                        <input type="text" className="w-full px-4 py-2 border border-warm-brown/30 rounded-lg bg-cream/20 text-warm-brown" placeholder="Title for your Chronicle (optional)" value={title} onChange={(e) => setTitle(e.target.value)} />
                        <textarea className="w-full px-4 py-2 border border-warm-brown/30 rounded-lg bg-cream/20 text-warm-brown" rows="3" placeholder="Add a description or note..." value={description} onChange={(e) => setDescription(e.target.value)} />
                        <button onClick={handleMint} disabled={isLoading} className="w-full px-4 py-3 font-bold text-cream bg-gradient-to-r from-sage-green to-forest-green rounded-lg disabled:opacity-50">
                            {isLoading ? "Processing..." : "Mint This Memory (Gas Only)"}
                        </button>
                    </div>
                )}
            </div>
        );
    };

    return (
        <div className="w-full max-w-lg p-10 space-y-8 bg-cream/25 backdrop-blur-2xl rounded-2xl shadow-2xl border border-warm-brown/30 hover:shadow-terracotta/40 hover:-translate-y-1 transition-all duration-300">
            <div className="text-center">
                <h1 className="text-4xl font-bold bg-gradient-to-r from-forest-green via-sage-green to-warm-brown text-transparent bg-clip-text">I Was There</h1>
                <p className="mt-2 text-warm-brown/90">Immortalize your memories on the blockchain. Forever.</p>
            </div>
            
            <PrizePoolTracker />

            {isActive ? renderContent() : (
                <button onClick={connectWallet} disabled={isConnecting} className="w-full px-4 py-3 font-bold text-cream bg-gradient-to-r from-terracotta to-warm-brown rounded-lg hover:opacity-90 transition-all duration-300 shadow-lg hover:shadow-xl">
                    {isConnecting ? "Connecting..." : "Connect Wallet to Begin"}
                </button>
            )}

            <div className="mt-4 text-center text-sm text-warm-brown/80 min-h-[40px]">
                <p>{feedback}</p>
                {latestTxHash && (
                    <a href={`https://polygonscan.com/tx/${latestTxHash}`} target="_blank" rel="noopener noreferrer" className="font-semibold text-sage-green hover:underline">
                        View Transaction
                    </a>
                )}
            </div>
        </div>
    );
}

export default HomePage;