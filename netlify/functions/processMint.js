const fetch = require('node-fetch');
const FormData = require('form-data');
const { ethers } = require('ethers'); // Using ethers v5 for compatibility with current Hardhat setup
const { getStore } = require("@netlify/blobs");

const PINATA_API_KEY = process.env.PINATA_API_KEY; 
const PINATA_SECRET_API_KEY = process.env.PINATA_SECRET_API_KEY;
const OWNER_PRIVATE_KEY_FOR_FREE_MINTS = process.env.OWNER_PRIVATE_KEY_FOR_FREE_MINTS; // !! CRITICAL !!
const IWAS_THERE_NFT_ADDRESS = process.env.VITE_IWAS_THERE_NFT_ADDRESS; // Passed via Netlify ENV
const POLYGON_RPC_URL = process.env.POLYGON_RPC_URL || "https://polygon-rpc.com"; // For the backend relayer to connect

const PINATA_BASE_URL = 'https://api.pinata.cloud/';

// Minimal ABI for mintFree and other relevant functions
const IWAS_THERE_ABI_MINIMAL = [
    "function mint(address to, string memory _tokenURI)",
    "function mintFree(address to, string memory _tokenURI)", // The function for free mints
    "function mintPrice() view returns (uint256)",
    "function allowance(address owner, address spender) view returns (uint256)",
    "function approve(address spender, uint256 amount) returns (bool)"
];

exports.handler = async function(event, context) {
    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, body: 'Method Not Allowed' };
    }

    if (!PINATA_API_KEY || !PINATA_SECRET_API_KEY) {
        return { statusCode: 500, body: 'Pinata API keys are not configured as Netlify Environment Variables.' };
    }
    // Only require OWNER_PRIVATE_KEY_FOR_FREE_MINTS if a free mint is attempted
    if (JSON.parse(event.body).isFreeMint && !OWNER_PRIVATE_KEY_FOR_FREE_MINTS) {
        return { statusCode: 500, body: 'Owner private key for free mints is not configured.' };
    }
    if (!IWAS_THERE_NFT_ADDRESS) {
        return { statusCode: 500, body: 'IWasThere NFT contract address is not configured.' };
    }

    try {
        const { files, walletAddress, signature, isFreeMint, title, description } = JSON.parse(event.body);

        if (!files || !Array.isArray(files) || files.length === 0 || !walletAddress || !signature) {
            return { statusCode: 400, body: 'Missing or invalid fields (files array, walletAddress, signature).' };
        }

        // 1. Verify Wallet Signature (Gasless Identity Proof)
        const message = `ChronicleMe: Verifying access for ${walletAddress} to upload media and request mint.`;
        const recoveredAddress = ethers.utils.verifyMessage(message, signature); // Use ethers.utils.verifyMessage for v5

        if (recoveredAddress.toLowerCase() !== walletAddress.toLowerCase()) {
            return { statusCode: 401, body: 'Invalid wallet signature. Unauthorized.' };
        }

        const freeMintStore = getStore("iwasthere-free-mints");
        
        // --- Free Mint Eligibility Check & Consumption ---
        if (isFreeMint) {
            const hasUsedFreeMint = await freeMintStore.get(walletAddress.toLowerCase());
            if (hasUsedFreeMint) {
                // IMPORTANT: This should ideally not happen if frontend check is good, but is a server-side double-check
                return { statusCode: 403, body: 'Free mint already used for this wallet. Please try a paid mint.' };
            }
        }

        // 2. Upload Each File to Pinata Individually
        const mediaCIDs = [];
        for (const fileData of files) {
            const fileBuffer = Buffer.from(fileData.fileContentBase64, 'base64');
            const fileName = fileData.fileName;
            const fileType = fileData.fileType;

            const formData = new FormData();
            formData.append('file', fileBuffer, { filename: fileName, contentType: fileType });
            
            const pinataFileRes = await fetch(`${PINATA_BASE_URL}pinning/pinFileToIPFS`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${PINATA_API_KEY}`,
                    ...formData.getHeaders() // Important for multipart/form-data
                },
                body: formData
            });

            if (!pinataFileRes.ok) {
                const errorText = await pinataFileRes.text();
                console.error(`Pinata file upload failed for ${fileName}:`, errorText);
                throw new Error(`Pinata file upload failed for ${fileName}: ${errorText}`);
            }
            const fileResult = await pinataFileRes.json();
            mediaCIDs.push({ cid: fileResult.IpfsHash, fileName: fileName, fileType: fileType });
        }

        // 3. Create NFT Metadata JSON (linking to all media CIDs)
        const nftMetadata = {
            name: title || `Chronicle Bundle by ${walletAddress}`,
            description: description || `A collection of immutable memories chronicled by ${walletAddress}.`,
            image: mediaCIDs[0] && mediaCIDs[0].fileType.startsWith('image/') ? `ipfs://${mediaCIDs[0].cid}` : undefined,
            animation_url: mediaCIDs[0] && mediaCIDs[0].fileType.startsWith('video/') ? `ipfs://${mediaCIDs[0].cid}` : undefined,
            properties: {
                media: mediaCIDs.map(item => ({
                    cid: item.cid,
                    fileName: item.fileName,
                    fileType: item.fileType,
                    ipfsUrl: `ipfs://${item.cid}`
                })),
                uploader: walletAddress,
                timestamp: new Date().toISOString()
            },
            attributes: [
                { trait_type: "Uploader", value: walletAddress },
                { trait_type: "Timestamp", value: new Date().toISOString() },
                { trait_type: "File Count", value: mediaCIDs.length },
                { trait_type: "Initial Content Type", value: mediaCIDs.length > 0 ? mediaCIDs[0].fileType : "Unknown" }
            ]
        };

        const metadataBuffer = Buffer.from(JSON.stringify(nftMetadata));

        // 4. Upload Metadata JSON to Pinata
        const metadataFormData = new FormData();
        metadataFormData.append('file', metadataBuffer, { filename: 'metadata.json', contentType: 'application/json' });

        const pinataMetadataRes = await fetch(`${PINATA_BASE_URL}pinning/pinFileToIPFS`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${PINATA_API_KEY}`, ...metadataFormData.getHeaders() },
            body: metadataFormData
        });

        if (!pinataMetadataRes.ok) {
            const errorText = await pinataMetadataRes.text();
            console.error("Pinata metadata upload failed:", errorText);
            throw new Error(`Pinata metadata upload failed: ${errorText}`);
        }
        const metadataResult = await pinataMetadataRes.json();
        const metadataCID = metadataResult.IpfsHash;

        // --- Step 5: Conditionally Mint on Blockchain (Backend acts as Relayer for Free Mints) ---
        if (isFreeMint) {
            console.log(`Attempting FREE mint for ${walletAddress} via relayer...`);
            // Set up ethers provider and wallet for the owner/relayer
            const provider = new ethers.providers.JsonRpcProvider(POLYGON_RPC_URL); // Using ethers v5 provider
            const ownerWallet = new ethers.Wallet(OWNER_PRIVATE_KEY_FOR_FREE_MINTS, provider);
            const iWasThereContract = new ethers.Contract(IWAS_THERE_NFT_ADDRESS, IWAS_THERE_ABI_MINIMAL, ownerWallet);

            // Call the mintFree function
            // Add a gas limit or estimate gas to prevent out-of-gas errors
            const gasLimit = await iWasThereContract.estimateGas.mintFree(walletAddress, `ipfs://${metadataCID}`);
            const tx = await iWasThereContract.mintFree(walletAddress, `ipfs://${metadataCID}`, {
                gasLimit: gasLimit.mul(120).div(100) // Add 20% buffer
            });
            await tx.wait(); // Wait for transaction to be mined

            // Mark free mint as used in Blob store ONLY AFTER successful transaction
            await freeMintStore.set(walletAddress.toLowerCase(), "used");

            return {
                statusCode: 200,
                body: JSON.stringify({ metadataCID, mediaCIDs, message: "Free Chronicle Bundle minted successfully!" })
            };

        } else {
            // For PAID mints, the frontend will handle the USDC approval and contract.mint() call.
            // This function simply returns the metadata CID needed for the on-chain mint.
            return {
                statusCode: 200,
                body: JSON.stringify({ metadataCID, mediaCIDs, message: "Files uploaded to IPFS. Ready for on-chain mint." })
            };
        }

    } catch (error) {
        console.error("Serverless function error:", error);
        return { statusCode: 500, body: JSON.stringify({ error: error.message || "Internal Server Error" }) };
    }
};