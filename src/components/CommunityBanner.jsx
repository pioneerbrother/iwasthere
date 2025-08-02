import React from 'react';

// --- ACTION REQUIRED ---
// Replace this placeholder with the real link to your "Photography Chronicles" Facebook group.
const FACEBOOK_GROUP_URL = "https://www.facebook.com/share/g/1FAxNgztJS/";

const CommunityBanner = () => {
  return (
    <div className="w-full bg-gradient-to-r from-sage-green to-forest-green text-center p-2 shadow-md">
    <a 
  href={FACEBOOK_GROUP_URL} 
  target="_blank" 
  rel="noopener noreferrer"
  className="text-sm font-medium text-cream hover:text-white transition-colors duration-300 flex items-center justify-center space-x-2"
>
  <span>A place to share your story. Join our community of photographers & storytellers on Facebook.</span>
  <span className="bg-cream/20 text-white font-bold py-1 px-3 rounded-full text-xs hover:bg-white hover:text-forest-green">
    JOIN NOW
  </span>
</a>
    </div>
  );
};

export default CommunityBanner;