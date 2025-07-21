import fetch from 'node-fetch';
import FormData from 'form-data';
import { ethers } from 'ethers';
import { getStore } from "@netlify/blobs";

// Environment variables are loaded by Netlify
const PINATA_JWT = process.env.PINATA_JWT;
const OWNER_PRIVATE_KEY_FOR_FREE_MINTS = process.env.OWNER_PRIVATE_KEY_FOR_FREE_MINTS;
const IWAS_THERE_NFT_ADDRESS = process.env.IWAS_THERE_NFT_ADDRESS;
const POLYGON_RPC_URL = process.env.POLYGON_RPC_URL;

const PINATA_BASE_URL = 'https://api.pinata.cloud/';

// Minimal ABI for the mintFree function
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
        console.log(`Request for wallet: ${walletAddress}, isFreeMint: ${isFreeMint}`);

        if (!files || !walletAddress || !signature) {
             throw new Error("Missing required fields.");
        }

        console.log("Step 1: Verifying wallet signature...");
        const message = `ChronicleMe: Verifying access for ${walletAddress} to upload media and request mint.`;
        
        // --- FINAL FIX: Use ethers.verifyMessage() for Ethers v6 ---
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
            console.log("Checking Blob store...");
            const hasUsedFreeMint = await freeMintStore.get(walletAddress.toLowerCase());
            if (hasUsedFreeMint) {
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
                headers: { 'Authorization': `Bearer ${PINATA_JWT}`, ...formData.getHeaders() },
                body: formData
            });

            if (!pinataFileRes.ok) {
                const errorText = await pinataFileRes.text();
                throw new Error(`Pinata upload failed: ${errorText}`);
            }
            const fileResult = await pinataFileRes.json();
            mediaCIDs.push({ cid: fileResult.IpfsHash, fileName: fileData.fileName, fileType: fileData.fileType });
        }
        console.log("All files uploaded to Pinata.");

        console.log("Step 3: Creating and uploading metadata...");
        const nftMetadata = {
            name: title || `Chronicle Bundle by ${walletAddress}`,
            description: description,
            image: mediaCIDs[0] && mediaCIDs[0].fileType.startsWith('image/') ? `ipfs://${mediaCIDs[0].cid}` : null,
            animation_url: mediaCIDs[0] && mediaCIDs[0].fileType.startsWith('video/') ? `ipfs://${mediaCIDs[0].cid}` : null,
            properties: {
                media: mediaCIDs.map(item => ({ ipfsUrl: `ipfs://${item.cid}`, ...item }))
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
            headers: { 'Authorization': `Bearer ${PINATA_JWT}`, ...metadataFormData.getHeaders() },
            body: metadataFormData
        });

        if (!pinataMetadataRes.ok) {
            const errorText = await pinataMetadataRes.text();
            throw new Error(`Pinata metadata upload failed: ${errorText}`);
        }
        const metadataResult = await pinataMetadataRes.json();
        const metadataCID = metadataResult.IpfsHash;
        console.log("Metadata uploaded. CID:", metadataCID);

        if (isFreeMint) {
            console.log("Step 4: Processing FREE mint via relayer...");
            if (!OWNER_PRIVATE_KEY_FOR_FREE_MINTS) throw new Error("Relayer private key not configured.");
            
            const provider = new ethers.JsonRpcProvider(POLYGON_RPC_URL);
            const ownerWallet = new ethers.Wallet(OWNER_PRIVATE_KEY_FOR_FREE_MINTS, provider);
            const iWasThereContract = new ethers.Contract(IWAS_THERE_NFT_ADDRESS, IWAS_THERE_ABI_MINIMAL, ownerWallet);

            console.log(`Relayer (${ownerWallet.address}) calling mintFree for user (${walletAddress})...`);
            const tx = await iWasThereContract.mintFree(walletAddress, `ipfs://${metadataCID}`);
            console.log("Tx sent. Waiting for confirmation. Hash:", tx.hash);
            await tx.wait();
            console.log("Free mint tx confirmed.");

            console.log("Updating Blob store...");
            await freeMintStore.set(walletAddress.toLowerCase(), "used");
            console.log("Blob store updated.");

            return {
                statusCode: 200,
                body: JSON.stringify({ metadataCID, message: "Free Chronicle Bundle minted successfully!" })
            };
        } else {
            console.log("Step 4: Returning CID to frontend for PAID mint.");
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