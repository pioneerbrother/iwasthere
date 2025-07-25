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

const MAX_PHOTOS_PER_BUNDLE = 12;
const MAX_VIDEOS_PER_BUNDLE = 2;
const MAX_TOTAL_FILE_SIZE_MB = 1;
const MAX_TOTAL_FILE_SIZE_BYTES = MAX_TOTAL_FILE_SIZE_MB * 1024 * 1024;
const PAID_MINT_PRICE_USDC = 2;

function HomePage() {
    const { signer, account, connectWallet, isConnecting } = useContext(WalletContext);
    
    const [isLoading, setIsLoading] = useState(false);
    const [feedback, setFeedback] = useState("Initializing...");
    const [mintedCount, setMintedCount] = useState(0);
    const [maxSupply, setMaxSupply] = useState(0);
    const [fileSelection, setFileSelection] = useState({ count: 0, size: 0 });
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
            if (!response.ok) throw new Error("Server error checking mint status.");
            const data = await response.json();
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
        if (account) checkFreeMint();
        else {
            setFeedback("Connect your wallet to begin.");
            setIsLoading(false);
        }
    }, [iWasThereNFTAddress, publicRpcUrl, account, checkFreeMint]);

    const handleFileChange = useCallback((event) => {
        const files = event.target.files ? Array.from(event.target.files) : [];
        const resetInput = () => {
            if (fileInputRef.current) fileInputRef.current.value = "";
            setFileSelection({ count: 0, size: 0 });
        };

        if (files.length === 0) {
            resetInput();
            return;
        }
        
        const totalSize = files.reduce((acc, file) => acc + file.size, 0);
        const photoCount = files.filter(f => f.type.startsWith('image/')).length;
        const videoCount = files.filter(f => f.type.startsWith('video/')).length;
        
        if (photoCount > MAX_PHOTOS_PER_BUNDLE || videoCount > MAX_VIDEOS_PER_BUNDLE) {
            setFeedback(`Error: Max ${MAX_PHOTOS_PER_BUNDLE} photos and ${MAX_VIDEOS_PER_BUNDLE} videos.`);
            resetInput();
            return;
        }
        if (totalSize > MAX_TOTAL_FILE_SIZE_BYTES) {
            setFeedback(`Error: Total file size exceeds ${MAX_TOTAL_FILE_SIZE_MB}MB.`);
            resetInput();
            return;
        }

        setFileSelection({ count: files.length, size: totalSize });
        setFeedback("Files selected. Add a title and description, then you're ready to Chronicle.");
        setLatestTxHash('');
    }, []);

    const triggerFileSelect = useCallback(() => { fileInputRef.current?.click(); }, []);

    const handleMint = useCallback(async () => {
        const currentFiles = fileInputRef.current?.files;
        if (!signer || !currentFiles || currentFiles.length === 0) {
            setFeedback("Please select files to mint.");
            return;
        }
        
        setIsLoading(true);
        setLatestTxHash('');
        setFeedback("Preparing files...");
        try {
            const filesToProcess = Array.from(currentFiles);
            const filesData = await Promise.all(filesToProcess.map(async (file) => {
                const buffer = await file.arrayBuffer();
                const base64String = Buffer.from(buffer).toString('base64');
                return { fileName: file.name, fileContentBase64: base64String, fileType: file.type };
            }));

            setFeedback("Awaiting signature...");
            const messageToSign = `ChronicleMe: Verifying access for ${account} to upload media and request mint.`;
            const signature = await signer.signMessage(messageToSign);
            setFeedback("Uploading files and creating metadata...");
            
            // --- THIS IS THE FIX ---
            // The key is `isFreeMint`, and the value is the state variable `isFreeMintAvailable`.
            const body = {
                files: filesData,
                walletAddress: account,
                signature,
                isFreeMint: isFreeMintAvailable,
                title,
                description
            };
            // --- END OF FIX ---
            
            const processMintResponse = await fetch('/.netlify/functions/processMint', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body),
            });
            const processMintResult = await processMintResponse.json();
            if (!processMintResponse.ok) throw new Error(processMintResult.error || "Backend failed.");

            if (isFreeMintAvailable) {
                setFeedback("🎉 Success! Your FREE mint was submitted.");
                setLatestTxHash(processMintResult.transactionHash);
            } else {
                const metadataCID = processMintResult.metadataCID;
                if (!metadataCID || !metadataCID.startsWith('Qm')) throw new Error(`Invalid metadata CID from backend.`);
                const ipfsMetadataCid = `ipfs://${metadataCID}`;
                const iWasThereContract = new ethers.Contract(iWasThereNFTAddress, IWasThereABI, signer);
                const usdcContract = new ethers.Contract(usdcAddress, ERC20ABI, signer);
                const contractMintPrice = ethers.BigNumber.from("2000000");
                const allowance = await usdcContract.allowance(account, iWasThereContract.address);
                if (allowance.lt(contractMintPrice)) {
                    setFeedback("Waiting for approval...");
                    const approveTx = await usdcContract.approve(iWasThereContract.address, contractMintPrice);
                    await approveTx.wait(1);
                }
                setFeedback("Minting on blockchain...");
                const mintTx = await iWasThereContract.mint(account, ipfsMetadataCid);
                await mintTx.wait(1);
                setFeedback("🎉 Success! Your Chronicle is on the blockchain!");
                setLatestTxHash(mintTx.hash);
            }
            
            if (fileInputRef.current) fileInputRef.current.value = "";
            setFileSelection({ count: 0, size: 0 });
            setTitle('');
            setDescription('');
            setMintedCount(prev => prev + 1);
            checkFreeMint();
        } catch (error) {
            setFeedback(`Error: ${error.reason || error.message || "An unknown error occurred."}`);
        } finally {
            setIsLoading(false);
        }
    }, [account, signer, isFreeMintAvailable, checkFreeMint, title, description]);

    const mintButtonText = () => {
        if (isLoading) return "Processing...";
        if (isFreeMintAvailable) return "Chronicle FREE Bundle";
        return `Chronicle Bundle (${PAID_MINT_PRICE_USDC} USDC)`;
    };

    return (
        <div className="w-full max-w-lg p-10 space-y-6 bg-cream/25 backdrop-blur-2xl rounded-2xl shadow-2xl border border-warm-brown/30">
            <div className="text-center">
                <h1 className="text-4xl font-bold bg-gradient-to-r from-forest-green via-sage-green to-warm-brown text-transparent bg-clip-text">I Was There</h1>
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
                <button onClick={connectWallet} disabled={isConnecting} className="w-full px-4 py-3 font-bold text-cream bg-gradient-to-r from-terracotta to-warm-brown rounded-lg">
                    {isConnecting ? "Connecting..." : "Connect Wallet to Begin"}
                </button>
            ) : (
                <div className="space-y-4">
                    <div onClick={triggerFileSelect} className="flex flex-col items-center justify-center w-full p-6 border-2 border-dashed border-warm-brown/40 rounded-lg cursor-pointer hover:border-golden-yellow/60">
                        <input type="file" multiple accept="image/*,video/*" onChange={handleFileChange} ref={fileInputRef} className="hidden" />
                        {fileSelection.count === 0 ? (
                            <div className="text-center text-warm-brown/70">
                                <span className="text-4xl opacity-50">🌿</span>
                                <p className="font-semibold">Click or drag files here</p>
                                <p className="text-xs">Up to {MAX_PHOTOS_PER_BUNDLE} photos & {MAX_VIDEOS_PER_BUNDLE} videos</p>
                                <p className="text-xs mt-1">(Max {MAX_TOTAL_FILE_SIZE_MB}MB Total)</p>
                            </div>
                        ) : (
                            <div className="text-center text-warm-brown/90">
                                <p className="font-semibold">{fileSelection.count} file(s) selected</p>
                                <p className="text-sm font-bold text-golden-yellow">Total Size: {(fileSelection.size / 1024 / 1024).toFixed(2)} MB / {MAX_TOTAL_FILE_SIZE_MB} MB</p>
                            </div>
                        )}
                    </div>
                    {fileSelection.count > 0 && (
                        <div className="space-y-4">
                            <input
                                type="text"
                                className="w-full px-4 py-2 border border-warm-brown/30 rounded-lg bg-cream/20 text-warm-brown"
                                placeholder="Title for your Chronicle (optional)"
                                value={title}
                                onChange={(e) => setTitle(e.target.value)}
                            />
                            <textarea
                                className="w-full px-4 py-2 border border-warm-brown/30 rounded-lg bg-cream/20 text-warm-brown"
                                rows="3"
                                placeholder="Add a description or note..."
                                value={description}
                                onChange={(e) => setDescription(e.target.value)}
                            />
                            <button onClick={handleMint} disabled={isLoading} className="w-full px-4 py-3 font-bold text-cream bg-gradient-to-r from-sage-green to-forest-green rounded-lg disabled:opacity-50">
                                {mintButtonText()}
                            </button>
                        </div>
                    )}
                </div>
            )}
            {feedback && <p className="mt-4 text-center text-sm text-warm-brown/80 min-h-[20px]">{feedback}</p>}
            {latestTxHash && (
                <div className="mt-4 text-center text-sm">
                    <a href={`https://polygonscan.com/tx/${latestTxHash}`} target="_blank" rel="noopener noreferrer" className="font-semibold text-sage-green hover:underline">
                        View Transaction
                    </a>
                </div>
            )}
        </div>
    );
}

export default HomePage;