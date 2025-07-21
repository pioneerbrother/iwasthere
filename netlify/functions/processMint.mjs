import fetch from 'node-fetch';
import FormData from 'form-data';
import { ethers } from 'ethers';
import { getStore } from "@netlify/blobs";

const PINATA_JWT = process.env.PINATA_JWT; // <-- USE THE JWT
const OWNER_PRIVATE_KEY_FOR_FREE_MINTS = process.env.OWNER_PRIVATE_KEY_FOR_FREE_MINTS;
const IWAS_THERE_NFT_ADDRESS = process.env.IWAS_THERE_NFT_ADDRESS;
const POLYGON_RPC_URL = process.env.POLYGON_RPC_URL;

const PINATA_BASE_URL = 'https://api.pinata.cloud/';

// ... (rest of the file is the same until the fetch calls)

export const handler = async function(event, context) {
    // ...
    try {
        // ... (verification logic is the same) ...

        // Loop for uploading files
        for (const fileData of files) {
            // ...
            const pinataFileRes = await fetch(`${PINATA_BASE_URL}pinning/pinFileToIPFS`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${PINATA_JWT}`, // <-- Use JWT
                    ...formData.getHeaders()
                },
                body: formData
            });
            // ...
        }

        // ... (metadata creation is the same) ...

        const pinataMetadataRes = await fetch(`${PINATA_BASE_URL}pinning/pinFileToIPFS`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${PINATA_JWT}`, // <-- Use JWT
                ...metadataFormData.getHeaders()
            },
            body: metadataFormData
        });

        // ... (rest of the function is the same) ...
    } catch (error) {
        // ...
    }
};