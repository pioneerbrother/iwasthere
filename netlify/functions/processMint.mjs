const fetch = require('node-fetch');
const FormData = require('form-data');
const { ethers } = require('ethers');
const { getStore } = require("@netlify/blobs");

const PINATA_JWT = process.env.PINATA_JWT;
const OWNER_PRIVATE_KEY_FOR_FREE_MINTS = process.env.OWNER_PRIVATE_KEY_FOR_FREE_MINTS;
const IWAS_THERE_NFT_ADDRESS = process.env.IWAS_THERE_NFT_ADDRESS;
const POLYGON_RPC_URL = process.env.POLYGON_RPC_URL;

const PINATA_BASE_URL = 'https://api.pinata.cloud/';

const IWAS_THERE_ABI_MINIMAL = [
    "function mintFree(address to, string memory _tokenURI)"
];

exports.handler = async function(event, context) {
    console.log("--- processMint function invoked (v5) ---");

    try {
        if (event.httpMethod !== 'POST') {
            return { statusCode: 405, body: JSON.stringify({ error: 'Method Not Allowed' }) };
        }
        
        const { files, walletAddress, signature, isFreeMint, title, description } = JSON.parse(event.body);
        if (!files || !walletAddress || !signature) {
             throw new Error("Missing required fields.");
        }

        const message = `ChronicleMe: Verifying access for ${walletAddress} to upload media and request mint.`;
        
        // Ethers v5 syntax for verifying a message
        const recoveredAddress = ethers.utils.verifyMessage(message, signature);

        if (recoveredAddress.toLowerCase() !== walletAddress.toLowerCase()) {
            throw new Error("Invalid wallet signature. Unauthorized.");
        }

        const freeMintStore = getStore({
            name: "iwasthere-free-mints",
            siteID: process.env.NETLIFY_SITE_ID,
            token: process.env.NETLIFY_API_TOKEN
        });

        if (isFreeMint) {
            const hasUsedFreeMint = await freeMintStore.get(walletAddress.toLowerCase());
            if (hasUsedFreeMint) {
                throw new Error("Free mint already used for this wallet.");
            }
        }

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

        const nftMetadata = {
            name: title || `Chronicle Bundle by ${walletAddress}`,
            description: description,
            image: mediaCIDs[0] && mediaCIDs[0].fileType.startsWith('image/') ? `ipfs://${mediaCIDs[0].cid}` : null,
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

        if (isFreeMint) {
            if (!OWNER_PRIVATE_KEY_FOR_FREE_MINTS) throw new Error("Relayer private key not configured.");
            
            // Ethers v5 syntax for provider and wallet
            const provider = new ethers.providers.JsonRpcProvider(POLYGON_RPC_URL);
            const ownerWallet = new ethers.Wallet(OWNER_PRIVATE_KEY_FOR_FREE_MINTS, provider);
            const iWasThereContract = new ethers.Contract(IWAS_THERE_NFT_ADDRESS, IWAS_THERE_ABI_MINIMAL, ownerWallet);

            const tx = await iWasThereContract.mintFree(walletAddress, `ipfs://${metadataCID}`);
            await tx.wait();

            await freeMintStore.set(walletAddress.toLowerCase(), "used");

            return {
                statusCode: 200,
                body: JSON.stringify({ metadataCID, message: "Free Chronicle Bundle minted successfully!" })
            };
        } else {
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