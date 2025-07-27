// File: frontend/src/App.jsx
// This is a temporary diagnostic tool.

import React from 'react';
import ConnectionTest from './pages/ConnectionTest';

function App() {
  return (
    <div className="min-h-screen bg-cream text-warm-brown flex flex-col items-center justify-center p-4">
      <h1 className="text-3xl font-bold mb-8">Engine Diagnostic Test</h1>
      <ConnectionTest />
    </div>
  );
}

export default App;