// In src/pages/HomePage.jsx

// ... other constants ...

// --- THIS IS THE FIX ---
// The previous value of 4MB could exceed Netlify's 6MB payload limit after base64 encoding.
// 3MB is a much safer limit to prevent the request data from being truncated.
const MAX_TOTAL_FILE_SIZE_MB = 3; 
// --- END OF FIX ---

const MAX_TOTAL_FILE_SIZE_BYTES = MAX_TOTAL_FILE_SIZE_MB * 1024 * 1024;
const PAID_MINT_PRICE_USDC = 2;

function HomePage() {
    // ... rest of the component remains the same ...
}

export default HomePage;