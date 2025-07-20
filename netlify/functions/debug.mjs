export const handler = async function(event, context) {
    const siteId = process.env.NETLIFY_SITE_ID;
    const apiToken = process.env.NETLIFY_API_TOKEN;
    const ownerKey = process.env.OWNER_PRIVATE_KEY_FOR_FREE_MINTS;
    const contractAddr = process.env.IWAS_THERE_NFT_ADDRESS;

    const response = {
        message: "Checking for critical environment variables...",
        NETLIFY_SITE_ID_IS_SET: !!siteId,
        NETLIFY_API_TOKEN_IS_SET: !!apiToken,
        OWNER_PRIVATE_KEY_IS_SET: !!ownerKey,
        CONTRACT_ADDRESS_IS_SET: !!contractAddr,
    };

    return {
        statusCode: 200,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(response, null, 2)
    };
};