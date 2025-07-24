// Located in /netlify/functions/processMint.js
const fetch = require('node-fetch');
const FormData = require('form-data');
const { ethers } = require('ethers');
const { Buffer } = require('buffer');

const PINATA_JWT = process.env.PINATA_JWT;
const PINATA_API_URL = 'https://api.pinata.cloud/pinning/pinFileToIPFS';
const PINATA_GATEWAY = 'https://gateway.pinata.cloud/ipfs/';
const IWAS_THERE_ABI_MINIMAL = ["function mintFree(address to, string memory _tokenURI)"];
const OWNER_PRIVATE_KEY_FOR_FREE_MINTS = process.env.OWNER_PRIVATE_KEY_FOR_FREE_MINTS;
const IWAS_THERE_NFT_ADDRESS = process.env.IWAS_THERE_NFT_ADDRESS;
const POLYGON_RPC_URL = process.env.POLYGON_RPC_URL;


exports.handler = async function(event, context) {
    console.log("--- processMint v10 (DEFINITIVE) Invoked ---");

    try {
        if (event.httpMethod !== 'POST') {
            return { statusCode: 405, body: 'Method Not Allowed' };
        }
        
        // STEP 1: LOG THE RAW INCOMING DATA
        console.log("Raw event body received:", event.body);
        
        const body = JSON.parse(event.body);
        const { files, walletAddress, signature, isFreeMint, title, description } = body;

        // STEP 2: VALIDATE THE INCOMING DATA
        if (!Array.isArray(files) || files.length === 0 || !walletAddress || !signature) {
             const errorMsg = `CRITICAL: Malformed request. Is files an array? ${Array.isArray(files)}. Files count: ${files?.length}. Wallet provided: ${!!walletAddress}.`;
             console.error(errorMsg);
             throw new Error(errorMsg);
        }

        const recoveredAddress = ethers.utils.verifyMessage(`ChronicleMe: Verifying access for ${walletAddress} to upload media and request mint.`, signature);
        if (recoveredAddress.toLowerCase() !== walletAddress.toLowerCase()) {
            throw new Error("Invalid wallet signature.");
        }
        
        // STEP 3: LOG THE EXACT NUMBER OF FILES TO BE PROCESSED
        console.log(`Signature valid. Starting processing for ${files.length} files.`);

        const mediaItems = [];
        // Use a standard `for` loop for maximum safety in serverless environment
        for (let i = 0; i < files.length; i++) {
            const fileData = files[i];
            console.log(`[LOOP ${i + 1}/${files.length}] Uploading ${fileData.fileName}...`);
            
            const fileBuffer = Buffer.from(fileData.fileContentBase64, 'base64');
            const formData = new FormData();
            formData.append('file', fileBuffer, { filename: fileData.fileName, contentType: fileData.fileType });
            
            const response = await fetch(PINATA_API_URL, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${PINATA_JWT}`, ...formData.getHeaders() },
                body: formData
            });

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`Pinata upload failed inside loop for ${fileData.fileName}: ${errorText}`);
            }

            const result = await response.json();
            mediaItems.push({
                cid: result.IpfsHash,
                fileName: fileData.fileName,
                fileType: fileData.fileType,
                gatewayUrl: `${PINATA_GATEWAY}${result.IpfsHash}`
            });
            console.log(`[LOOP ${i + 1}/${files.length}] ...Success. CID: ${result.IpfsHash}`);
        }
        
        // STEP 4: LOG THE FINAL COUNT OF PROCESSED FILES
        console.log(`Loop finished. Total items processed into mediaItems array: ${mediaItems.length}`);

        if (mediaItems.length !== files.length) {
            const errorMsg = `CRITICAL MISMATCH: Should have processed ${files.length} files but only have ${mediaItems.length}.`;
            console.error(errorMsg);
            throw new Error(errorMsg);
        }

        const nftMetadata = {
            name: title || `Chronicle by ${walletAddress.slice(0,6)}...`,
            description: description || "A collection of memories chronicled on the blockchain.",
            image: mediaItems[0]?.gatewayUrl || "",
            properties: { media: mediaItems }
        };

        console.log("Uploading final metadata.json containing", mediaItems.length, "media items...");
        
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
        
        console.log(`Metadata upload successful. CID: ${metadataCID}`);

        if (isFreeMint) {
            // Free mint logic here
        } else {
            return {
                statusCode: 200,
                body: JSON.stringify({ metadataCID, message: "Upload successful." })
            };
        }
    } catch (error) {
        console.error("--- UNRECOVERABLE ERROR in processMint ---", error);
        return { statusCode: 500, body: JSON.stringify({ error: error.message }) };
    }
};