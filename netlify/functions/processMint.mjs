const fetch = require('node-fetch');
const FormData = require('form-data');
const { ethers } = require('ethers');
const { getStore } = require("@netlify/blobs");
const { Buffer } = require('buffer');

const PINATA_JWT = process.env.PINATA_JWT;
const OWNER_PRIVATE_KEY_FOR_FREE_MINTS = process.env.OWNER_PRIVATE_KEY_FOR_FREE_MINTS;
const IWAS_THERE_NFT_ADDRESS = process.env.IWAS_THERE_NFT_ADDRESS;
const POLYGON_RPC_URL = process.env.POLYGON_RPC_URL;

const PINATA_API_URL = 'https://api.pinata.cloud/pinning/pinFileToIPFS';
const PINATA_GATEWAY = 'https://gateway.pinata.cloud/ipfs/';

const IWAS_THERE_ABI_MINIMAL = [ "function mintFree(address to, string memory _tokenURI)" ];

exports.handler = async function(event, context) {
    console.log("--- processMint v7 (Resilient) Invoked ---");

    try {
        if (event.httpMethod !== 'POST') {
            return { statusCode: 405, body: JSON.stringify({ error: 'Method Not Allowed' }) };
        }
        
        const { files, walletAddress, signature, isFreeMint, title, description } = JSON.parse(event.body);
        if (!files || !Array.isArray(files) || files.length === 0 || !walletAddress || !signature) {
             throw new Error("Missing/malformed fields.");
        }

        console.log(`Verifying signature for ${walletAddress}`);
        const recoveredAddress = ethers.utils.verifyMessage(`ChronicleMe: Verifying access for ${walletAddress} to upload media and request mint.`, signature);
        if (recoveredAddress.toLowerCase() !== walletAddress.toLowerCase()) {
            throw new Error("Invalid wallet signature.");
        }
        console.log("Signature valid.");

        // (Free mint check remains the same)

        console.log(`Starting parallel upload of ${files.length} files to Pinata...`);
        const uploadPromises = files.map(fileData => {
            const fileBuffer = Buffer.from(fileData.fileContentBase64, 'base64');
            const formData = new FormData();
            formData.append('file', fileBuffer, { filename: fileData.fileName, contentType: fileData.fileType });
            formData.append('pinataMetadata', JSON.stringify({ name: fileData.fileName, keyvalues: { uploader: walletAddress } }));

            return fetch(PINATA_API_URL, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${PINATA_JWT}`, ...formData.getHeaders() },
                body: formData
            }).then(response => response.ok ? response.json() : response.text().then(text => Promise.reject(new Error(`Pinata upload failed for ${fileData.fileName}: ${text}`))))
              .then(result => ({
                cid: result.IpfsHash,
                fileName: fileData.fileName,
                fileType: fileData.fileType,
                gatewayUrl: `${PINATA_GATEWAY}${result.IpfsHash}`
              }));
        });
        
        const mediaItems = await Promise.all(uploadPromises);
        console.log("All files uploaded successfully. Received CIDs:", mediaItems.map(m => m.cid).join(', '));

        const nftMetadata = {
            name: title || `Chronicle Bundle by ${walletAddress.slice(0,6)}`,
            description: description || "A collection of memories chronicled on the blockchain.",
            image: mediaItems[0]?.gatewayUrl || null,
            properties: { media: mediaItems }
        };

        console.log("Uploading final metadata.json...");
        const metadataBuffer = Buffer.from(JSON.stringify(nftMetadata));
        const metadataFormData = new FormData();
        metadataFormData.append('file', metadataBuffer, { filename: 'metadata.json' });
        metadataFormData.append('pinataMetadata', JSON.stringify({ name: 'metadata.json' }));
        
        const pinataMetadataRes = await fetch(PINATA_API_URL, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${PINATA_JWT}`, ...metadataFormData.getHeaders() },
            body: metadataFormData
        });

        if (!pinataMetadataRes.ok) {
            throw new Error(`Pinata metadata upload failed: ${await pinataMetadataRes.text()}`);
        }
        
        const metadataResult = await pinataMetadataRes.json();
        const metadataCID = metadataResult.IpfsHash;

        if (!metadataCID) {
            throw new Error("CRITICAL: Metadata uploaded but Pinata did not return an IpfsHash.");
        }
        console.log(`Metadata uploaded successfully. CID: ${metadataCID}`);

        // This part remains the same
        if (isFreeMint) {
            // ... free mint logic ...
        } else {
            console.log("Returning successful metadata CID to frontend for paid mint.");
            return {
                statusCode: 200,
                body: JSON.stringify({
                    metadataCID, // Ensure this is being sent
                    message: "Upload successful."
                })
            };
        }
    } catch (error) {
        console.error("--- CRITICAL ERROR in processMint function ---", error);
        return { statusCode: 500, body: JSON.stringify({ error: error.message }) };
    }
};