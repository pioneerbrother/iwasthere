const fetch = require('node-fetch');
const FormData = require('form-data');
const { ethers } = require('ethers');
const { getStore } = require("@netlify/blobs");

const PINATA_JWT = process.env.PINATA_JWT;
const OWNER_PRIVATE_KEY_FOR_FREE_MINTS = process.env.OWNER_PRIVATE_KEY_FOR_FREE_MINTS;
const IWAS_THERE_NFT_ADDRESS = process.env.IWAS_THERE_NFT_ADDRESS;
const POLYGON_RPC_URL = process.env.POLYGON_RPC_URL;

const PINATA_BASE_URL = 'https://api.pinata.cloud/';
const PINATA_GATEWAY = 'https://gateway.pinata.cloud/ipfs/'; // <-- Reliable Gateway

const IWAS_THERE_ABI_MINIMAL = [ "function mintFree(address to, string memory _tokenURI)" ];

exports.handler = async function(event, context) {
    try {
        const { files, walletAddress, signature, isFreeMint, title, description } = JSON.parse(event.body);
        if (!files || !walletAddress || !signature) { throw new Error("Missing required fields."); }

        const message = `ChronicleMe: Verifying access for ${walletAddress} to upload media and request mint.`;
        const recoveredAddress = ethers.utils.verifyMessage(message, signature);
        if (recoveredAddress.toLowerCase() !== walletAddress.toLowerCase()) { throw new Error("Invalid wallet signature."); }

        const freeMintStore = getStore({ name: "iwasthere-free-mints", siteID: process.env.NETLIFY_SITE_ID, token: process.env.NETLIFY_API_TOKEN });
        if (isFreeMint) {
            const hasUsedFreeMint = await freeMintStore.get(walletAddress.toLowerCase());
            if (hasUsedFreeMint) { throw new Error("Free mint already used."); }
        }

        const mediaItems = [];
        for (const fileData of files) {
            const fileBuffer = Buffer.from(fileData.fileContentBase64, 'base64');
            const formData = new FormData();
            formData.append('file', fileBuffer, { filename: fileData.fileName, contentType: fileData.fileType });
            
            const pinataFileRes = await fetch(`${PINATA_BASE_URL}pinning/pinFileToIPFS`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${PINATA_JWT}`, ...formData.getHeaders() },
                body: formData
            });
            if (!pinataFileRes.ok) throw new Error(await pinataFileRes.text());
            const fileResult = await pinataFileRes.json();
            mediaItems.push({
                cid: fileResult.IpfsHash,
                fileName: fileData.fileName,
                fileType: fileData.fileType,
                gatewayUrl: `${PINATA_GATEWAY}${fileResult.IpfsHash}` // <-- Add gateway URL
            });
        }
        
        const nftMetadata = {
            name: title || `Chronicle Bundle by ${walletAddress}`,
            description: description || "A collection of memories chronicled on the blockchain.",
            // --- KEY FIX: Use the reliable Pinata Gateway URL for the main image ---
            image: mediaItems[0] ? mediaItems[0].gatewayUrl : null,
            properties: { media: mediaItems } // Store the full array with gateway URLs
        };

        const metadataBuffer = Buffer.from(JSON.stringify(nftMetadata));
        const metadataFormData = new FormData();
        metadataFormData.append('file', metadataBuffer, { filename: 'metadata.json' });
        const pinataMetadataRes = await fetch(`${PINATA_BASE_URL}pinning/pinFileToIPFS`, { /* ... */ });
        if (!pinataMetadataRes.ok) throw new Error(await pinataMetadataRes.text());
        const metadataResult = await pinataMetadataRes.json();
        const metadataCID = metadataResult.IpfsHash;

        if (isFreeMint) {
            const provider = new ethers.providers.JsonRpcProvider(POLYGON_RPC_URL);
            const ownerWallet = new ethers.Wallet(OWNER_PRIVATE_KEY_FOR_FREE_MINTS, provider);
            const iWasThereContract = new ethers.Contract(IWAS_THERE_NFT_ADDRESS, IWAS_THERE_ABI_MINIMAL, ownerWallet);
            const tx = await iWasThereContract.mintFree(walletAddress, `${PINATA_GATEWAY}${metadataCID}`);
            await tx.wait();
            await freeMintStore.set(walletAddress.toLowerCase(), "used");
            return { statusCode: 200, body: JSON.stringify({ metadataCID, transactionHash: tx.hash }) };
        } else {
            return { statusCode: 200, body: JSON.stringify({ metadataCID }) };
        }
    } catch (error) {
        return { statusCode: 500, body: JSON.stringify({ error: error.message }) };
    }
};