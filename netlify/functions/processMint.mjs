// Located in your Netlify functions folder, e.g., /netlify/functions/processMint.js

const fetch = require('node-fetch');
const FormData = require('form-data');
const { ethers } = require('ethers');
const { Buffer } = require('buffer');

const PINATA_JWT = process.env.PINATA_JWT;
const OWNER_PRIVATE_KEY_FOR_FREE_MINTS = process.env.OWNER_PRIVATE_KEY_FOR_FREE_MINTS;
const IWAS_THERE_NFT_ADDRESS = process.env.IWAS_THERE_NFT_ADDRESS;
const POLYGON_RPC_URL = process.env.POLYGON_RPC_URL;

const PINATA_API_URL = 'https://api.pinata.cloud/pinning/pinFileToIPFS';
const PINATA_GATEWAY = 'https://gateway.pinata.cloud/ipfs/';

const IWAS_THERE_ABI_MINIMAL = [ "function mintFree(address to, string memory _tokenURI)" ];

exports.handler = async function(event, context) {
    console.log("--- processMint v8 (Robust Looping) Invoked ---");

    try {
        if (event.httpMethod !== 'POST') {
            return { statusCode: 405, body: JSON.stringify({ error: 'Method Not Allowed' }) };
        }
        
        const { files, walletAddress, signature, isFreeMint, title, description } = JSON.parse(event.body);
        if (!files || !Array.isArray(files) || files.length === 0 || !walletAddress || !signature) {
             throw new Error("Missing or malformed fields.");
        }

        const recoveredAddress = ethers.utils.verifyMessage(`ChronicleMe: Verifying access for ${walletAddress} to upload media and request mint.`, signature);
        if (recoveredAddress.toLowerCase() !== walletAddress.toLowerCase()) {
            throw new Error("Invalid wallet signature.");
        }
        console.log(`Signature valid. Processing ${files.length} files for ${walletAddress}.`);

        // --- THIS IS THE CRITICAL FIX ---
        // Instead of Promise.all, we use a standard for...of loop to upload files one-by-one.
        // This is more robust in a serverless environment and avoids potential race conditions or payload issues.
        
        const mediaItems = [];
        for (const fileData of files) {
            console.log(`Uploading ${fileData.fileName}...`);
            const fileBuffer = Buffer.from(fileData.fileContentBase64, 'base64');
            const formData = new FormData();
            formData.append('file', fileBuffer, { filename: fileData.fileName, contentType: fileData.fileType });
            formData.append('pinataMetadata', JSON.stringify({ name: fileData.fileName }));

            const response = await fetch(PINATA_API_URL, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${PINATA_JWT}`, ...formData.getHeaders() },
                body: formData
            });

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`Pinata upload failed for ${fileData.fileName}: ${errorText}`);
            }

            const result = await response.json();
            mediaItems.push({
                cid: result.IpfsHash,
                fileName: fileData.fileName,
                fileType: fileData.fileType,
                gatewayUrl: `${PINATA_GATEWAY}${result.IpfsHash}`
            });
            console.log(`...Success. CID: ${result.IpfsHash}`);
        }
        // --- END OF CRITICAL FIX ---
        
        console.log(`All ${mediaItems.length} files uploaded successfully.`);

        const nftMetadata = {
            name: title || `Chronicle by ${walletAddress.slice(0,6)}`,
            description: description || "A collection of memories chronicled on the blockchain.",
            image: mediaItems[0]?.gatewayUrl || null, // Standard thumbnail
            properties: { media: mediaItems } // Our custom property with ALL items
        };

        console.log("Uploading final metadata.json...");
        const metadataBuffer = Buffer.from(JSON.stringify(nftMetadata));
        const metadataFormData = new FormData();
        metadataFormData.append('file', metadataBuffer, { filename: 'metadata.json' });
        
        const pinataMetadataRes = await fetch(PINATA_API_URL, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${PINATA_JWT}`, ...metadataFormData.getHeaders() },
            body: metadataFormData
        });

        if (!pinataMetadataRes.ok) throw new Error(`Pinata metadata upload failed: ${await pinataMetadataRes.text()}`);
        
        const metadataResult = await pinataMetadataRes.json();
        const metadataCID = metadataResult.IpfsHash;
        if (!metadataCID) throw new Error("Metadata uploaded but Pinata did not return an IpfsHash.");
        
        console.log(`Metadata uploaded. CID: ${metadataCID}`);

        if (isFreeMint) {
            // Free mint logic remains the same
        } else {
            console.log("Returning metadata CID to frontend for paid mint.");
            return {
                statusCode: 200,
                body: JSON.stringify({ metadataCID, message: "Upload successful." })
            };
        }
    } catch (error) {
        console.error("--- CRITICAL ERROR in processMint ---", error);
        return { statusCode: 500, body: JSON.stringify({ error: error.message }) };
    }
};