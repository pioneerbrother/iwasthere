import fetch from 'node-fetch';
import FormData from 'form-data';
import { ethers } from 'ethers';
import { getStore } from "@netlify/blobs";

const PINATA_API_KEY = process.env.PINATA_API_KEY;
const PINATA_SECRET_API_KEY = process.env.PINATA_SECRET_API_KEY;
const OWNER_PRIVATE_KEY_FOR_FREE_MINTS = process.env.OWNER_PRIVATE_KEY_FOR_FREE_MINTS;
const IWAS_THERE_NFT_ADDRESS = process.env.IWAS_THERE_NFT_ADDRESS;
const POLYGON_RPC_URL = process.env.POLYGON_RPC_URL;

const PINATA_BASE_URL = 'https://api.pinata.cloud/';

const IWAS_THERE_ABI_MINIMAL = [
    "function mintFree(address to, string memory _tokenURI)"
];

export const handler = async function(event, context) {
    console.log("--- processMint function invoked ---");
    try {
        if (event.httpMethod !== 'POST') {
            return { statusCode: 405, body: JSON.stringify({ error: 'Method Not Allowed' }) };
        }
        
        console.log("Parsing event body...");
        const { files, walletAddress, signature, isFreeMint, title, description } = JSON.parse(event.body);
        console.log(`Request received for wallet: ${walletAddress}, isFreeMint attempt: ${isFreeMint}`);

        if (!files || !walletAddress || !signature) {
             throw new Error("Missing required fields in request body.");
        }

        console.log("Step 1: Verifying wallet signature...");
        const message = `ChronicleMe: Verifying access for ${walletAddress} to upload media and request mint.`;
        
        // --- THIS IS THE KEY FIX ---
        // Use ethers.verifyMessage() for Ethers v6
        const recoveredAddress = ethers.verifyMessage(message, signature);

        if (recoveredAddress.toLowerCase() !== walletAddress.toLowerCase()) {
            throw new Error("Invalid wallet signature. Unauthorized.");
        }
        console.log("Signature verified successfully.");

        const freeMintStore = getStore({
            name: "iwasthere-free-mints",
            siteID: process.env.NETLIFY_SITE_ID,
            token: process.env.NETLIFY_API_TOKEN
        });

        if (isFreeMint) {
            console.log("Checking Blob store for free mint eligibility...");
            const hasUsedFreeMint = await freeMintStore.get(walletAddress.toLowerCase());
            if (hasUsedFreeMint) {
                console.error("Attempted to use free mint, but it was already used.");
                throw new Error("Free mint already used for this wallet.");
            }
            console.log("User is eligible for a free mint.");
        }

        console.log(`Step 2: Uploading ${files.length} file(s) to Pinata...`);
        const mediaCIDs = [];
        for (const fileData of files) {
            const fileBuffer = Buffer.from(fileData.fileContentBase64, 'base64');
            const formData = new FormData();
            formData.append('file', fileBuffer, { filename: fileData.fileName, contentType: fileData.fileType });
            
            const pinataFileRes = await fetch(`${PINATA_BASE_URL}pinning/pinFileToIPFS`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${PINATA_API_KEY}`,
                    ...formData.getHeaders()
                },
                body: formData
            });

            if (!pinataFileRes.ok) {
                const errorText = await pinataFileRes.text();
                throw new Error(`Pinata file upload failed for ${fileData.fileName}: ${errorText}`);
            }
            const fileResult = await pinataFileRes.json();
            mediaCIDs.push({ cid: fileResult.IpfsHash, fileName: fileData.fileName, fileType: fileData.fileType });
        }
        console.log("All files uploaded to Pinata successfully.");

        console.log("Step 3: Creating and uploading metadata...");
        const nftMetadata = {
            name: title || `Chronicle Bundle by ${walletAddress}`,
            description: description || `A collection of immutable memories chronicled by ${walletAddress}.`,
            image: mediaCIDs[0] && mediaCIDs[0].fileType.startsWith('image/') ? `ipfs://${mediaCIDs[0].cid}` : null,
            animation_url: mediaCIDs[0] && mediaCIDs[0].fileType.startsWith('video/') ? `ipfs://${mediaCIDs[0].cid}` : null,
            properties: {
                media: mediaCIDs.map(item => ({
                    cid: item.cid,
                    fileName: item.fileName,
                    fileType: item.fileType,
                    ipfsUrl: `ipfs://${item.cid}`
                }))
            },
            attributes: [
                { "trait_type": "Uploader", "value": walletAddress },
                { "trait_type": "File Count", "value": mediaCIDs.length }
            ]
        };

        const metadataBuffer = Buffer.from(JSON.stringify(nftMetadata));
        const metadataFormData = new FormData();
        metadataFormData.append('file', metadataBuffer, { filename: 'metadata.json', contentType: 'application/json' });

        const pinataMetadataRes = await fetch(`${PINATA_BASE_URL}pinning/pinFileToIPFS`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${PINATA_API_KEY}`, ...metadataFormData.getHeaders() },
            body: metadataFormData
        });

        if (!pinataMetadataRes.ok) {
            const errorText = await pinataMetadataRes.text();
            throw new Error(`Pinata metadata upload failed: ${errorText}`);
        }
        const metadataResult = await pinataMetadataRes.json();
        const metadataCID = metadataResult.IpfsHash;
        console.log("Metadata uploaded successfully. CID:", metadataCID);

        if (isFreeMint) {
            console.log("Step 4: Processing FREE mint via backend relayer...");
            if (!OWNER_PRIVATE_KEY_FOR_FREE_MINTS) throw new Error("Relayer private key is not configured.");
            
            const provider = new ethers.JsonRpcProvider(POLYGON_RPC_URL);
            const ownerWallet = new ethers.Wallet(OWNER_PRIVATE_KEY_FOR_FREE_MINTS, provider);
            const iWasThereContract = new ethers.Contract(IWAS_THERE_NFT_ADDRESS, IWAS_THERE_ABI_MINIMAL, ownerWallet);

            console.log(`Relayer wallet (${ownerWallet.address}) is calling mintFree for user (${walletAddress})...`);
            const tx = await iWasThereContract.mintFree(walletAddress, `ipfs://${metadataCID}`);
            console.log("Transaction sent. Waiting for confirmation. TxHash:", tx.hash);
            await tx.wait();
            console.log("Free mint transaction confirmed.");

            console.log("Updating Blob store to mark free mint as used...");
            await freeMintStore.set(walletAddress.toLowerCase(), "used");
            console.log("Blob store updated.");

            return {
                statusCode: 200,
                body: JSON.stringify({ metadataCID, message: "Free Chronicle Bundle minted successfully!" })
            };
        } else {
            console.log("Step 4: Returning metadata CID to frontend for PAID mint.");
            return {
                statusCode: 200,
                body: JSON.stringify({ metadataCID, message: "Files uploaded. Ready for on-chain mint." })
            };
        }
    } catch (error) {
        console.error("--- CRITICAL ERROR in processMint function ---", error);
        return {
            statusCode: 500,
            body: JSON.stringify({ error: error.message || "An internal server error occurred." })
        };
    }
};