import React from 'react';
import MemeNavbar from '../components/meme/MemeNavbar';
import MemeGrid from '../components/meme/MemeGrid';

const MemeBrowser = () => {
  return (
    <div className="min-h-screen bg-bgPrimary">
      <MemeNavbar />
      <MemeGrid />
      
      {/* Status Bar */}
      <div className="fixed bottom-0 left-0 w-full h-8 bg-bgSecondary border-t border-borderBase flex items-center justify-between px-4 z-50">
        <div className="flex items-center space-x-2">
          <div className="w-1.5 h-1.5 rounded-full bg-success animate-pulse-subtle" />
          <span className="text-textMuted text-xs">syncing...</span>
        </div>
        <span className="text-textMuted text-xs font-mono">v0.4.2</span>
      </div>
    </div>
  );
};

export default MemeBrowser;
