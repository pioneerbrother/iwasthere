// Located in: /netlify/functions/processMint.js
const fetch = require('node-fetch');
const FormData = require('form-data');
const { ethers } = require('ethers');
const { Buffer } = require('buffer');

// --- Ingredients ---
const PINATA_JWT = process.env.PINATA_JWT;
const PINATA_API_URL = 'https://api.pinata.cloud/pinning/pinFileToIPFS';
const PINATA_GATEWAY = 'https://gateway.pinata.cloud/ipfs/';

/**
 * @title processMint (Single Item Recipe)
 * @author Your Deputy Chef (Gemini)
 * @notice This function has been simplified. Its only job is to prepare one perfect
 * dish at a time. It receives one file, uploads it, creates a clean metadata
 * file for it, and returns the final metadata link to the frontend.
 * All payment and credit logic is now handled by the smart contract.
 */
exports.handler = async function(event, context) {
    console.log("--- processMint (Freemium Model) Invoked ---");

    try {
        if (event.httpMethod !== 'POST') {
            return { statusCode: 405, body: 'Method Not Allowed' };
        }
        
        // --- Step 1: Prepare the ingredients ---
        // We now expect a single 'file' object, not a 'files' array.
        const { file, walletAddress, signature, title, description } = JSON.parse(event.body);

        if (!file || !walletAddress || !signature) {
             throw new Error("Malformed request: Missing file, walletAddress, or signature.");
        }

        // --- Step 2: Authenticate the order ---
        const recoveredAddress = ethers.utils.verifyMessage(`ChronicleMe: Verifying access for ${walletAddress} to upload media and request mint.`, signature);
        if (recoveredAddress.toLowerCase() !== walletAddress.toLowerCase()) {
            throw new Error("Invalid wallet signature.");
        }
        console.log(`Signature valid. Cooking ${file.fileName} for ${walletAddress}.`);

        // --- Step 3: Cook the main ingredient (Upload the file to IPFS) ---
        const fileBuffer = Buffer.from(file.fileContentBase64, 'base64');
        const fileFormData = new FormData();
        fileFormData.append('file', fileBuffer, { filename: file.fileName, contentType: file.fileType });
        
        const pinataFileRes = await fetch(PINATA_API_URL, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${PINATA_JWT}`, ...fileFormData.getHeaders() },
            body: fileFormData
        });

        if (!pinataFileRes.ok) throw new Error(`Pinata file upload failed: ${await pinataFileRes.text()}`);
        const fileResult = await pinataFileRes.json();
        const fileCID = fileResult.IpfsHash;

        // --- Step 4: Prepare the final dish (Create the metadata) ---
        // This is now a simple, standard metadata object.
        const nftMetadata = {
            name: title || file.fileName,
            description: description || "A memory immortalized on the blockchain.",
            // The 'image' property points directly to the single file we just uploaded.
            // This is the standard that MetaMask and OpenSea will read.
            image: `${PINATA_GATEWAY}${fileCID}`
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

        console.log(`Metadata uploaded. Serving CID to frontend: ${metadataCID}`);
        
        // --- Step 5: Serve the dish to the frontend ---
        // The backend's only job is to return the CID.
        return {
            statusCode: 200,
            body: JSON.stringify({ metadataCID })
        };

    } catch (error) {
        console.error("--- A dish was burned in the kitchen ---", error);
        return { statusCode: 500, body: JSON.stringify({ error: error.message }) };
    }
};