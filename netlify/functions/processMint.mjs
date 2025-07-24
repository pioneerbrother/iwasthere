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
    console.log("--- processMint function invoked (v6 Parallel) ---");

    try {
        if (event.httpMethod !== 'POST') {
            return { statusCode: 405, body: JSON.stringify({ error: 'Method Not Allowed' }) };
        }
        
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

        // --- THIS IS THE FIX ---
        // We now upload all files to Pinata in parallel to avoid the 10-second timeout.

        console.log(`Starting parallel upload of ${files.length} files...`);

        const uploadPromises = files.map(fileData => {
            const fileBuffer = Buffer.from(fileData.fileContentBase64, 'base64');
            const formData = new FormData();
            formData.append('file', fileBuffer, { filename: fileData.fileName, contentType: fileData.fileType });

            const pinataMetadata = JSON.stringify({
                name: fileData.fileName,
                keyvalues: { uploader: walletAddress }
            });
            formData.append('pinataMetadata', pinataMetadata);

            return fetch(PINATA_API_URL, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${PINATA_JWT}`, ...formData.getHeaders() },
                body: formData
            }).then(response => {
                if (!response.ok) {
                    return response.text().then(text => {
                        throw new Error(`Pinata file upload failed for ${fileData.fileName}: ${text}`);
                    });
                }
                return response.json();
            }).then(fileResult => ({
                cid: fileResult.IpfsHash,
                fileName: fileData.fileName,
                fileType: fileData.fileType,
                gatewayUrl: `${PINATA_GATEWAY}${fileResult.IpfsHash}`
            }));
        });
        
        // await Promise.all() waits for all the uploads to complete.
        const mediaItems = await Promise.all(uploadPromises);

        console.log("All files uploaded successfully.");
        // --- END OF FIX ---
        
        const nftMetadata = {
            name: title || `Chronicle Bundle by ${walletAddress}`,
            description: description || "A collection of memories chronicled on the blockchain.",
            image: mediaItems[0] ? mediaItems[0].gatewayUrl : null,
            properties: { media: mediaItems }
        };

        const metadataBuffer = Buffer.from(JSON.stringify(nftMetadata));
        const metadataFormData = new FormData();
        metadataFormData.append('file', metadataBuffer, { filename: 'metadata.json', contentType: 'application/json' });
        
        const pinataMetadataForJson = JSON.stringify({ name: `metadata.json` });
        metadataFormData.append('pinataMetadata', pinataMetadataForJson);
        
        const pinataMetadataRes = await fetch(PINATA_API_URL, {
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

        if (isFreeMint) {
            if (!OWNER_PRIVATE_KEY_FOR_FREE_MINTS) throw new Error("Relayer key not configured.");
            
            const provider = new ethers.providers.JsonRpcProvider(POLYGON_RPC_URL);
            const ownerWallet = new ethers.Wallet(OWNER_PRIVATE_KEY_FOR_FREE_MINTS, provider);
            const iWasThereContract = new ethers.Contract(IWAS_THERE_NFT_ADDRESS, IWAS_THERE_ABI_MINIMAL, ownerWallet);

            const tx = await iWasThereContract.mintFree(walletAddress, `ipfs://${metadataCID}`);
            // Fire and Forget
            await freeMintStore.set(walletAddress.toLowerCase(), "used");

            return {
                statusCode: 200,
                body: JSON.stringify({
                    metadataCID,
                    transactionHash: tx.hash,
                    message: "Transaction submitted!"
                })
            };
        } else {
            return {
                statusCode: 200,
                body: JSON.stringify({
                    metadataCID,
                    message: "Upload successful."
                })
            };
        }
    } catch (error) {
        console.error("--- CRITICAL ERROR in processMint function ---", error);
        return { statusCode: 500, body: JSON.stringify({ error: error.message }) };
    }
};