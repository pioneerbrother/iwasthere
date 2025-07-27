// File: frontend/src/pages/ConnectionTest.jsx
// This is a temporary diagnostic tool.

import React, { useState } from 'react';
import { useWeb3React } from '@web3-react/core';
import { metaMask } from '../connectors/metaMask';

function ConnectionTest() {
    const { account, isActive, connector } = useWeb3React();
    const [feedback, setFeedback] = useState('Ready to test ignition.');

    const handleConnect = async () => {
        setFeedback('Pressing the ignition button...');
        console.log('Attempting to activate connector...');
        try {
            await connector.activate();
            setFeedback('SUCCESS! The engine has started.');
            console.log('Activation successful.');
        } catch (error) {
            setFeedback(`ERROR: The engine failed to start. Check the console.`);
            console.error('Activation failed:', error);
        }
    };

    return (
        <div className="p-10 border-2 border-dashed border-red-500 bg-white space-y-4 text-center">
            <h2 className="text-xl font-bold">Ignition Test</h2>
            
            <button 
                onClick={handleConnect} 
                className="px-6 py-3 bg-blue-600 text-white font-bold rounded-lg"
            >
                Attempt to Connect Wallet
            </button>

            <div className="mt-4 p-4 bg-gray-100 rounded">
                <p><strong>Status:</strong> {feedback}</p>
                <p><strong>Is Wallet Active?</strong> {isActive ? 'Yes' : 'No'}</p>
                <p><strong>Account:</strong> {account ? account : 'Not Connected'}</p>
            </div>
        </div>
    );
}

export default ConnectionTest;