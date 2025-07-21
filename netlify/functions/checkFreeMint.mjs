import { getStore } from "@netlify/blobs";

export const handler = async (event, context) => {
    // Only allow POST requests
    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, body: JSON.stringify({ error: 'Method Not Allowed' }) };
    }

    try {
        const { walletAddress } = JSON.parse(event.body);

        if (!walletAddress) {
            return { statusCode: 400, body: JSON.stringify({ error: 'Missing walletAddress in request body.' }) };
        }

        // Manually provide credentials to ensure stability
        const freeMintStore = getStore({
            name: "iwasthere-free-mints",
            siteID: process.env.NETLIFY_SITE_ID,
            token: process.env.NETLIFY_API_TOKEN
        });

        // Check the Blob store for the user's wallet address
        const hasUsedFreeMint = await freeMintStore.get(walletAddress.toLowerCase());

        const isAvailable = !hasUsedFreeMint;
        const message = isAvailable 
            ? "Your free Chronicle Bundle is available!" 
            : "Your free Chronicle Bundle has been used. Subsequent bundles cost 2 USDC.";

        return {
            statusCode: 200,
            body: JSON.stringify({ isAvailable, message })
        };

    } catch (error) {
        console.error("--- CRITICAL ERROR in checkFreeMint function ---", error);
        return { 
            statusCode: 500, 
            body: JSON.stringify({ error: error.message || "An internal server error occurred while checking free mint status." }) 
        };
    }
};