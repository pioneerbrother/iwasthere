import React from 'react';
import { useParams } from 'react-router-dom';

function EventDetailPage() {
  const { tokenId } = useParams(); // Get tokenId from URL

  return (
    <div style={{ padding: '20px', textAlign: 'center' }}>
      <h1>Chronicle Viewer</h1>
      <p>This page will display details for Chronicle NFT with Token ID: {tokenId}</p>
      <p>Content will be loaded from IPFS using the token URI.</p>
      <p>Coming Soon!</p>
    </div>
  );
}

export default EventDetailPage;