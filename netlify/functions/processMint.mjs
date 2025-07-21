import { ethers } from 'ethers';
import { getStore } from "@netlify/blobs";

const PINATA_JWT = process.env.PINATA_JWT;
const OWNER_PRIVATE_KEY_FOR_FREE_MINTS = process.env.OWNER_PRIVATE_KEY_FOR_FREE_MINTS;
const IWAS_THERE_NFT_ADDRESS = process.env.IWAS_THERE_NFT_ADDRESS;
const POLYGON_RPC_URL = process.env.POLYGON_RPC_URL;

const PINATA_BASE_URL = 'https://api.pinata.cloud/';

const IWAS_THERE_ABI_MINIMAL = [ "function mintFree(address to, string memory _tokenURI)" ];

export const handler = async (event, context) => {
    try {
        const { files, walletAddress, signature, isFreeMint, title, description } = JSON.parse(event.body);

        const message = `ChronicleMe: Verifying access for ${walletAddress} to upload media and request mint.`;
        const recoveredAddress = ethers.verifyMessage(message, signature);
        if (recoveredAddress.toLowerCase() !== walletAddress.toLowerCase()) {
            throw new Error("Invalid wallet signature.");
        }

        const freeMintStore = getStore({ name: "iwasthere-free-mints", siteID: process.env.NETLIFY_SITE_ID, token: process.env.NETLIFY_API_TOKEN });

        if (isFreeMint) {
            const hasUsedFreeMint = await freeMintStore.get(walletAddress.toLowerCase());
            if (hasUsedFreeMint) { throw new Error("Free mint already used."); }
        }

        const mediaCIDs = [];
        for (const fileData of files) {
            const fileBuffer = Buffer.from(fileData.fileContentBase64, 'base64');
            const fileBlob = new Blob([fileBuffer], { type: fileData.fileType });
            
            const formData = new FormData();
            formData.append('file', fileBlob, fileData.fileName);

            const pinataFileRes = await fetch(`${PINATA_BASE_URL}pinning/pinFileToIPFS`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${PINATA_JWT}` },
                body: formData
            });

            if (!pinataFileRes.ok) throw new Error(await pinataFileRes.text());
            const fileResult = await pinataFileRes.json();
            mediaCIDs.push({ cid: fileResult.IpfsHash, ...fileData });
        }
        
        const nftMetadata = { /* ... your metadata object ... */ };
        const metadataBuffer = Buffer.from(JSON.stringify(nftMetadata));
        const metadataBlob = new Blob([metadataBuffer], { type: 'application/json' });
        
        const metadataFormData = new FormData();
        metadataFormData.append('file', metadataBlob, 'metadata.json');

        const pinataMetadataRes = await fetch(`${PINATA_BASE_URL}pinning/pinFileToIPFS`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${PINATA_JWT}` },
            body: metadataFormData
        });
        if (!pinataMetadataRes.ok) throw new Error(await pinataMetadataRes.text());
        const metadataResult = await pinataMetadataRes.json();
        const metadataCID = metadataResult.IpfsHash;

        if (isFreeMint) {
            if (!OWNER_PRIVATE_KEY_FOR_FREE_MINTS) throw new Error("Relayer key not configured.");
            
            const provider = new ethers.JsonRpcProvider(POLYGON_RPC_URL);
            const ownerWallet = new ethers.Wallet(OWNER_PRIVATE_KEY_FOR_FREE_MINTS, provider);
            const iWasThereContract = new ethers.Contract(IWAS_THERE_NFT_ADDRESS, IWAS_THERE_ABI_MINIMAL, ownerWallet);

            const tx = await iWasThereContract.mintFree(walletAddress, `ipfs://${metadataCID}`);
            await tx.wait();
            await freeMintStore.set(walletAddress.toLowerCase(), "used");
            return { statusCode: 200, body: JSON.stringify({ metadataCID, message: "Free mint successful!" }) };
        } else {
            return { statusCode: 200, body: JSON.stringify({ metadataCID, message: "Upload successful." }) };
        }
    } catch (error) {
        return { statusCode: 500, body: JSON.stringify({ error: error.message }) };
    }
};