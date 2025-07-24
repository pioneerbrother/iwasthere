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
    console.log("--- processMint function invoked (Definitive Final Version) ---");

    try {
        if (event.httpMethod !== 'POST') {
            return { statusCode: 405, body: JSON.stringify({ error: 'Method Not Allowed' }) };
        }
        
        const { files, walletAddress, signature, isFreeMint, title, description } = JSON.parse(event.body);

        // --- All of your verification and logic here ---
        const message = `ChronicleMe: Verifying access for ${walletAddress} to upload media and request mint.`;
        const recoveredAddress = ethers.utils.verifyMessage(message, signature);
        if (recoveredAddress.toLowerCase() !== walletAddress.toLowerCase()) {
            throw new Error("Invalid wallet signature.");
        }

        const freeMintStore = getStore({ name: "iwasthere-free-mints", siteID: process.env.NETLIFY_SITE_ID, token: process.env.NETLIFY_API_TOKEN });
        if (isFreeMint) {
            const hasUsedFreeMint = await freeMintStore.get(walletAddress.toLowerCase());
            if (hasUsedFreeMint) { throw new Error("Free mint already used."); }
        }

        // --- THIS IS THE CRITICAL FIX ---
        // Initialize the array correctly
        const mediaItems = [];
        // Loop through all the files sent from the frontend
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

            if (!pinataFileRes.ok) throw new Error(await pinataFileRes.text());
            
            const fileResult = await pinataFileRes.json();
            // Push each uploaded file's data into the mediaItems array
            mediaItems.push({
                cid: fileResult.IpfsHash,
                fileName: fileData.fileName,
                fileType: fileData.fileType,
                gatewayUrl: `${PINATA_GATEWAY}${fileResult.IpfsHash}`
            });
        }
        
        const nftMetadata = {
            name: title || `Chronicle Bundle by ${walletAddress}`,
            description: description,
            image: mediaItems.length > 0 ? mediaItems[0].gatewayUrl : null,
            // Assign the full, correct mediaItems array to the properties
            properties: { 
                media: mediaItems 
            }
        };
        
        // ... (The rest of the logic for uploading metadata and minting is correct)
        // ...

    } catch (error) {
        console.error("--- CRITICAL ERROR in processMint function ---", error);
        return { statusCode: 500, body: JSON.stringify({ error: error.message }) };
    }
};
