import { getStore } from "@netlify/blobs";

export const handler = async function(event, context) {
    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, body: 'Method Not Allowed' };
    }

    try {
        const { walletAddress } = JSON.parse(event.body);

        if (!walletAddress) {
            return { statusCode: 400, body: 'Missing walletAddress.' };
        }

        // Get your Blob store. The name must match what you configured in Netlify UI
       const freeMintStore = getStore({
    name: "iwasthere-free-mints",
    siteID: process.env.NETLIFY_SITE_ID,
    token: process.env.NETLIFY_API_TOKEN
});
        const hasUsedFreeMint = await freeMintStore.get(walletAddress.toLowerCase());

        const isAvailable = hasUsedFreeMint ? false : true;
        const message = isAvailable 
            ? "Your free Chronicle Bundle is available!" 
            : "Your free Chronicle Bundle has been used. Subsequent bundles cost 2 USDC.";

        return {
            statusCode: 200,
            body: JSON.stringify({ isAvailable, message })
        };

    } catch (error) {
        console.error("Error in checkFreeMint function:", error);
        return { statusCode: 500, body: JSON.stringify({ error: error.message || "Internal Server Error" }) };
    }
};