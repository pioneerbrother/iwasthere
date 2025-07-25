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
const MAX_TOTAL_FILE_SIZE_MB = 1; // This must remain 1MB to prevent server errors
const MAX_TOTAL_FILE_SIZE_BYTES = MAX_TOTAL_FILE_SIZE_MB * 1024 * 1024;
const PAID_MINT_PRICE_USDC = 2; // The fixed price for the entire bundle

function HomePage() {
    const { signer, account, connectWallet, isConnecting } = useContext(WalletContext);
    
    const [isLoading, setIsLoading] = useState(false);
    const [feedback, setFeedback] = useState("Initializing...");
    const [mintedCount, setMintedCount] = useState(0);
    const [maxSupply, setMaxSupply] = useState(0);
    // This is reverted back to the simpler version without totalPrice
    const [fileSelection, setFileSelection] = useState({ count: 0, size: 0 });
    const [isFreeMintAvailable, setIsFreeMintAvailable] = useState(false); // We keep the free mint logic
    const [latestTxHash, setLatestTxHash] = useState('');
    const [description, setDescription] = useState('');
    const [title, setTitle] = useState('');
    const fileInputRef = useRef(null);

    const checkFreeMint = useCallback(async () => {
        if (!account) return;
        try {
            const response = await fetch('/.netlify/functions/checkFreeMint', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ walletAddress: account })
            });
            if (!response.ok) throw new Error("Server error checking mint status.");
            const data = await response.json();
            setIsFreeMintAvailable(data.isAvailable);
            setFeedback(data.message || "Select your media to begin.");
        } catch (error) {
            setFeedback(`Could not check free mint status: ${error.message}`);
        }
    }, [account]);

    useEffect(() => {
        const fetchData = async () => {
            if (!iWasThereNFTAddress || !publicRpcUrl) return;
            try {
                const readOnlyProvider = new ethers.providers.JsonRpcProvider(publicRpcUrl);
                const contract = new ethers.Contract(iWasThereNFTAddress, IWasThereABI, readOnlyProvider);
                const [currentMinted, currentMax] = await Promise.all([contract.mintedCount(), contract.MAX_SUPPLY()]);
                setMintedCount(Number(currentMinted));
                setMaxSupply(Number(currentMax));
            } catch (error) {
                console.error("Could not fetch contract data.", error);
            }
        };
        fetchData();
        if (account) checkFreeMint();
        else setFeedback("Connect your wallet to begin.");
    }, [account, checkFreeMint]);

    const handleFileChange = useCallback((event) => {
        const files = event.target.files ? Array.from(event.target.files) : [];
        const resetInput = () => {
            if (fileInputRef.current) fileInputRef.current.value = "";
            setFileSelection({ count: 0, size: 0 });
        };
        if (files.length === 0) { resetInput(); return; }
        
        const totalSize = files.reduce((acc, file) => acc + file.size, 0);
        const photoCount = files.filter(f => f.type.startsWith('image/')).length;
        const videoCount = files.filter(f => f.type.startsWith('video/')).length;
        
        if (photoCount > MAX_PHOTOS_PER_BUNDLE || videoCount > MAX_VIDEOS_PER_BUNDLE || totalSize > MAX_TOTAL_FILE_SIZE_BYTES) {
            setFeedback(`Error: File limits exceeded.`);
            resetInput();
            return;
        }
        setFileSelection({ count: files.length, size: totalSize });
        setFeedback("Files are ready. Add details and mint your Chronicle.");
        setLatestTxHash('');
    }, []);

    const triggerFileSelect = useCallback(() => { fileInputRef.current?.click(); }, []);

    const handleMint = useCallback(async () => {
        const currentFiles = fileInputRef.current?.files;
        if (!signer || !currentFiles || currentFiles.length === 0) return;
        
        setIsLoading(true);
        setLatestTxHash('');
        setFeedback("Preparing files...");
        try {
            const filesToProcess = Array.from(currentFiles);
            const filesData = await Promise.all(filesToProcess.map(async (file) => ({
                fileName: file.name,
                fileContentBase64: Buffer.from(await file.arrayBuffer()).toString('base64'),
                fileType: file.type
            })));

            setFeedback("Awaiting signature...");
            const messageToSign = `ChronicleMe: Verifying access for ${account} to upload media and request mint.`;
            const signature = await signer.signMessage(messageToSign);
            setFeedback("Uploading files...");
            
            const body = { files: filesData, walletAddress: account, signature, isFreeMint: isFreeMintAvailable, title, description };
            
            const processMintResponse = await fetch('/.netlify/functions/processMint', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body),
            });
            const processMintResult = await processMintResponse.json();
            if (!processMintResponse.ok) throw new Error(processMintResult.error || "Backend failed.");

            if (isFreeMintAvailable) {
                // Free mint logic is handled by the backend
                setFeedback("🎉 Success! Your FREE mint was submitted.");
                setLatestTxHash(processMintResult.transactionHash);
            } else {
                // Paid mint logic with the fixed price
                const metadataCID = processMintResult.metadataCID;
                if (!metadataCID) throw new Error("Failed to get metadata CID from backend.");
                
                const ipfsMetadataCid = `ipfs://${metadataCID}`;
                const iWasThereContract = new ethers.Contract(iWasThereNFTAddress, IWasThereABI, signer);
                const usdcContract = new ethers.Contract(usdcAddress, ERC20ABI, signer);
                
                // --- Reverted to fixed price logic ---
                const fixedPriceWei = ethers.utils.parseUnits(PAID_MINT_PRICE_USDC.toString(), 6);
                
                setFeedback("Approving USDC spend...");
                const allowance = await usdcContract.allowance(account, iWasThereContract.address);
                if (allowance.lt(fixedPriceWei)) {
                    const approveTx = await usdcContract.approve(iWasThereContract.address, fixedPriceWei);
                    setFeedback("Waiting for approval confirmation...");
                    await approveTx.wait(1);
                }
                // --- End of reverted logic ---

                setFeedback("Minting your Chronicle...");
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
    }, [account, signer, title, description, isFreeMintAvailable, checkFreeMint]);

    const mintButtonText = () => {
        if (isLoading) return "Processing...";
        if (isFreeMintAvailable) return "Chronicle FREE Bundle";
        return `Chronicle For ${PAID_MINT_PRICE_USDC} USDC`;
    };

    return (
        <div className="w-full max-w-lg p-10 space-y-6 bg-cream/25 backdrop-blur-2xl rounded-2xl shadow-2xl">
            <div className="text-center">
                <h1 className="text-4xl font-bold">I Was There</h1>
                <p>Immortalize your memories on the blockchain. Forever.</p>
            </div>
            <div className="flex justify-around p-4 bg-cream/20 rounded-xl">
                <div>
                    <span className="text-sm">Minted</span>
                    <p className="text-2xl font-bold">{maxSupply > 0 ? `${mintedCount} / ${maxSupply}` : "..."}</p>
                </div>
                {/* --- Reverted to simple price display --- */}
                <div>
                    <span className="text-sm">Price</span>
                    <p className="text-2xl font-bold">
                        {isFreeMintAvailable ? "FREE" : `${PAID_MINT_PRICE_USDC} USDC`}
                    </p>
                </div>
                {/* --- End of reverted logic --- */}
            </div>
            {!account ? (
                <button onClick={connectWallet} disabled={isConnecting}>{isConnecting ? "..." : "Connect Wallet"}</button>
            ) : (
                <div className="space-y-4">
                    <div onClick={triggerFileSelect} className="flex flex-col items-center justify-center ...">
                        <input type="file" multiple accept="image/*,video/*" onChange={handleFileChange} ref={fileInputRef} className="hidden" />
                        {fileSelection.count === 0 ? (
                            <div className="text-center">
                                <span>🌿</span>
                                <p>Click or drag files here</p>
                                <p>(Max {MAX_TOTAL_FILE_SIZE_MB}MB Total)</p>
                            </div>
                        ) : (
                            <div className="text-center">
                                <p>{fileSelection.count} file(s) selected</p>
                                <p>Total Size: {(fileSelection.size / 1024 / 1024).toFixed(2)} MB</p>
                            </div>
                        )}
                    </div>
                    {fileSelection.count > 0 && (
                        <div className="space-y-4">
                            <input type="text" placeholder="Title..." value={title} onChange={(e) => setTitle(e.target.value)} />
                            <textarea placeholder="Description..." value={description} onChange={(e) => setDescription(e.target.value)} />
                            <button onClick={handleMint} disabled={isLoading}>{mintButtonText()}</button>
                        </div>
                    )}
                </div>
            )}
            {feedback && <p>{feedback}</p>}
            {latestTxHash && <a href={`https://polygonscan.com/tx/${latestTxHash}`} target="_blank">View Transaction</a>}
        </div>
    );
}

export default HomePage;