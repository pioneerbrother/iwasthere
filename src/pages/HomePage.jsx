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
const MAX_TOTAL_FILE_SIZE_MB = 1; // Keeping the safe limit
const MAX_TOTAL_FILE_SIZE_BYTES = MAX_TOTAL_FILE_SIZE_MB * 1024 * 1024;
const PAID_MINT_PRICE_USDC = 2;

function HomePage() {
    const { signer, account, connectWallet, isConnecting } = useContext(WalletContext);
    
    const [isLoading, setIsLoading] = useState(false);
    const [feedback, setFeedback] = useState("Initializing...");
    const [mintedCount, setMintedCount] = useState(0);
    const [maxSupply, setMaxSupply] = useState(0);
    
    // --- LOGIC CHANGE ---
    // We no longer store the full file objects in state.
    // We only store their count and size for display purposes.
    const [fileSelection, setFileSelection] = useState({ count: 0, size: 0 });
    // --- END LOGIC CHANGE ---
    
    const [isFreeMintAvailable, setIsFreeMintAvailable] = useState(false);
    const [latestTxHash, setLatestTxHash] = useState('');
    const [description, setDescription] = useState('');
    const [title, setTitle] = useState('');
    const fileInputRef = useRef(null);

    // checkFreeMint and the initial useEffect remain the same
    const checkFreeMint = useCallback(async () => { /* ... same as before ... */ }, [account]);
    useEffect(() => { /* ... same as before ... */ }, [account]);

    // --- LOGIC CHANGE: This function now only validates and updates the display info ---
    const handleFileChange = useCallback((event) => {
        const files = event.target.files ? Array.from(event.target.files) : [];
        if (files.length === 0) {
            setFileSelection({ count: 0, size: 0 });
            return;
        }
        
        const totalSize = files.reduce((acc, file) => acc + file.size, 0);
        const photoCount = files.filter(f => f.type.startsWith('image/')).length;
        const videoCount = files.filter(f => f.type.startsWith('video/')).length;
        
        const resetInput = () => {
            if (fileInputRef.current) fileInputRef.current.value = "";
            setFileSelection({ count: 0, size: 0 });
        };

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
    // --- END LOGIC CHANGE ---

    const triggerFileSelect = useCallback(() => { fileInputRef.current?.click(); }, []);

    // --- LOGIC CHANGE: This function now reads files directly from the input ref ---
    const handleMint = useCallback(async () => {
        // Use the ref to get the definitive, current list of files
        const currentFiles = fileInputRef.current?.files;
        if (!signer || !currentFiles || currentFiles.length === 0) {
            setFeedback("Please select files to mint.");
            return;
        }
        
        setIsLoading(true);
        setLatestTxHash('');
        setFeedback("Preparing files...");
        try {
            // Convert the FileList from the ref into an array to be processed
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
            
            const processMintResponse = await fetch('/.netlify/functions/processMint', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ files: filesData, walletAddress: account, signature, isFreeMint, title, description }),
            });
            const processMintResult = await processMintResponse.json();
            if (!processMintResponse.ok) throw new Error(processMintResult.error || "Backend failed.");

            // The rest of the minting logic (paid vs free) remains the same
            // ...

            // Reset everything upon success
            setFileSelection({ count: 0, size: 0 });
            if (fileInputRef.current) fileInputRef.current.value = "";
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
    // --- END LOGIC CHANGE ---

    return (
        <div className="w-full max-w-lg p-10 space-y-6 bg-cream/25 backdrop-blur-2xl rounded-2xl shadow-2xl">
            <div className="text-center">
                <h1 className="text-4xl font-bold">I Was There</h1>
                <p>Immortalize your memories on the blockchain. Forever.</p>
            </div>
            {/* ... other elements like minted count and price ... */}

            {!account ? (
                <button onClick={connectWallet} disabled={isConnecting}>{isConnecting ? "..." : "Connect Wallet"}</button>
            ) : (
                <div className="space-y-4">
                    <div onClick={triggerFileSelect} className="flex flex-col items-center justify-center w-full p-6 border-2 border-dashed ...">
                        <input type="file" multiple accept="image/*,video/*" onChange={handleFileChange} ref={fileInputRef} className="hidden" />
                        
                        {/* --- LOGIC CHANGE: UI now reads from fileSelection state --- */}
                        {fileSelection.count === 0 ? (
                            <div className="text-center">
                                <span>🌿</span>
                                <p>Click or drag files here</p>
                                <p>(Max {MAX_TOTAL_FILE_SIZE_MB}MB Total)</p>
                            </div>
                        ) : (
                            <div className="text-center">
                                <p>{fileSelection.count} file(s) selected</p>
                                <p>Total Size: {(fileSelection.size / 1024 / 1024).toFixed(2)} MB / {MAX_TOTAL_FILE_SIZE_MB} MB</p>
                            </div>
                        )}
                        {/* --- END LOGIC CHANGE --- */}

                    </div>
                    {fileSelection.count > 0 && (
                        <div className="space-y-4">
                            <input type="text" placeholder="Title..." value={title} onChange={(e) => setTitle(e.target.value)} />
                            <textarea placeholder="Description..." value={description} onChange={(e) => setDescription(e.target.value)} />
                            <button onClick={handleMint} disabled={isLoading}>Mint Bundle</button>
                        </div>
                    )}
                </div>
            )}
            {feedback && <p>{feedback}</p>}
            {latestTxHash && <a href={`https://polygonscan.com/tx/${latestTxHash}`}>View Transaction</a>}
        </div>
    );
}

export default HomePage;