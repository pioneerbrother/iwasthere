import fetch from 'node-fetch';
import FormData from 'form-data';
import { ethers } from 'ethers';
import { getStore } from "@netlify/blobs";

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
        // ... (The top part of your function is the same: body parsing, signature check, blob store, pinata uploads)

        if (isFreeMint) {
            console.log("Step 4: Processing FREE mint via backend relayer...");
            if (!OWNER_PRIVATE_KEY_FOR_FREE_MINTS) throw new Error("Relayer private key not configured.");
            
            const provider = new ethers.providers.JsonRpcProvider(POLYGON_RPC_URL);
            const ownerWallet = new ethers.Wallet(OWNER_PRIVATE_KEY_FOR_FREE_MINTS, provider);
            const iWasThereContract = new ethers.Contract(IWAS_THERE_NFT_ADDRESS, IWAS_THERE_ABI_MINIMAL, ownerWallet);

            console.log(`Relayer wallet (${ownerWallet.address}) is calling mintFree for user (${walletAddress})...`);

            // --- FINAL FIX: Add Manual Gas Overrides ---
            // This prevents the transaction from hanging on gas estimation.
            const gasPrice = await provider.getGasPrice();
            const txOverrides = {
                gasLimit: ethers.utils.hexlify(300000), // Set a generous gas limit (300,000)
                gasPrice: gasPrice.mul(120).div(100), // Increase current gas price by 20% to ensure it gets mined
            };
            
            console.log("Sending transaction with manual gas overrides:", txOverrides);
            const tx = await iWasThereContract.mintFree(walletAddress, `ipfs://${metadataCID}`, txOverrides);
            
            console.log("Transaction sent. Waiting for confirmation. TxHash:", tx.hash);
            await tx.wait(); // This should no longer hang
            console.log("Free mint transaction confirmed.");

            console.log("Updating Blob store to mark free mint as used...");
            await freeMintStore.set(walletAddress.toLowerCase(), "used");
            console.log("Blob store updated.");

            return {
                statusCode: 200,
                body: JSON.stringify({ metadataCID, message: "Free Chronicle Bundle minted successfully!" })
            };
        } else {
            // ... (paid mint logic is the same)
        }
    } catch (error) {
        console.error("--- CRITICAL ERROR in processMint function ---", error);
        return {
            statusCode: 500,
            body: JSON.stringify({ error: error.message || "An internal server error occurred." })
        };
    }
};