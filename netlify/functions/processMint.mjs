const fetch = require('node-fetch');
const FormData = require('form-data');
const { ethers } = require('ethers');
const { getStore } = require("@netlify/blobs");

const PINATA_JWT = process.env.PINATA_JWT;
const OWNER_PRIVATE_KEY_FOR_FREE_MINTS = process.env.OWNER_PRIVATE_KEY_FOR_FREE_MINTS;
const IWAS_THERE_NFT_ADDRESS = process.env.IWAS_THERE_NFT_ADDRESS;
const POLYGON_RPC_URL = process.env.POLYGON_RPC_URL;

const PINATA_API_URL = 'https://api.pinata.cloud/pinning/pinFileToIPFS';
const PINATA_GATEWAY = 'https://gateway.pinata.cloud/ipfs/';

const IWAS_THERE_ABI_MINIMAL = [ "function mintFree(address to, string memory _tokenURI)" ];

exports.handler = async function(event, context) {
    console.log("--- processMint function invoked (v5 Final) ---");
    try {
        const { files, walletAddress, signature, isFreeMint, title, description } = JSON.parse(event.body);
        if (!files || !Array.isArray(files) || files.length === 0 || !walletAddress || !signature) {
             throw new Error("Missing or malformed required fields.");
        }

        const message = `ChronicleMe: Verifying access for ${walletAddress} to upload media and request mint.`;
        const recoveredAddress = ethers.utils.verifyMessage(message, signature);
        if (recoveredAddress.toLowerCase() !== walletAddress.toLowerCase()) {
            throw new Error("Invalid wallet signature.");
        }

        const freeMintStore = getStore({ name: "iwasthere-free-mints", siteID: process.env.NETLIFY_SITE_ID, token: process.env.NETLIFY_API_TOKEN });

        if (isFreeMint) {
            const hasUsedFreeMint = await freeMintStore.get(walletAddress.toLowerCase());
            if (hasUsedFreeMint) {
                throw new Error("Free mint already used for this wallet.");
            }
        }

        // --- THIS IS THE KEY FIX: Ensure mediaItems is correctly built ---
        const mediaItems = [];
        for (const fileData of files) {
            const fileBuffer = Buffer.from(fileData.fileContentBase64, 'base64');
            const formData = new FormData();
            formData.append('file', fileBuffer, { filename: fileData.fileName, contentType: fileData.fileType });

            const pinataMetadata = JSON.stringify({ name: fileData.fileName });
            formData.append('pinataMetadata', pinataMetadata);

            const pinataFileRes = await fetch(PINATA_API_URL, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${PINATA_JWT}`, ...formData.getHeaders() },
                body: formData
            });

            if (!pinataFileRes.ok) {
                const errorText = await pinataFileRes.text();
                throw new Error(`Pinata file upload failed: ${errorText}`);
            }
            const fileResult = await pinataFileRes.json();
            mediaItems.push({
                cid: fileResult.IpfsHash,
                fileName: fileData.fileName,
                fileType: fileData.fileType,
                gatewayUrl: `${PINATA_GATEWAY}${fileResult.IpfsHash}`
            });
        }
        
        const nftMetadata = {
            name: title || `Chronicle Bundle by ${walletAddress}`,
            description: description || "A collection of memories chronicled on the blockchain.",
            image: mediaItems.length > 0 ? mediaItems[0].gatewayUrl : null,
            properties: { 
                media: mediaItems // Ensure the full array is assigned here
            }
        };

        const metadataBuffer = Buffer.from(JSON.stringify(nftMetadata));
        const metadataFormData = new FormData();
        metadataFormData.append('file', metadataBuffer, { filename: 'metadata.json' });

        const pinataMetadataRes = await fetch(PINATA_API_URL, { /* ... */ });
        if (!pinataMetadataRes.ok) { throw new Error(await pinataMetadataRes.text()); }
        const metadataResult = await pinataMetadataRes.json();
        const metadataCID = metadataResult.IpfsHash;

        if (isFreeMint) {
            // ... (The rest of the free mint logic is correct)
        } else {
            // ... (The paid mint logic is correct)
        }
    } catch (error) {
        // ... (Error handling is correct)
    }
};