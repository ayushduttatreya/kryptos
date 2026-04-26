import React, { useState } from 'react';
import SearchBar from './SearchBar';
import { Menu } from 'lucide-react';

const MemeNavbar = () => {
  const [activeTab, setActiveTab] = useState('Trending');
  const tabs = ['Trending', 'Fresh', 'Saved'];

  return (
    <nav className="fixed top-0 left-0 w-full h-14 bg-bgSecondary border-b border-borderBase flex items-center justify-between px-6 z-50">
      <div className="flex items-center w-48">
        <span className="font-mono text-textMuted font-medium tracking-wider">KRYPTOS</span>
      </div>
      
      <div className="flex space-x-6">
        {tabs.map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`text-sm pb-1 transition-colors duration-150 border-b-2 ${
              activeTab === tab 
                ? 'text-textPrimary border-accent' 
                : 'text-textMuted border-transparent hover:text-textSecondary'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      <div className="flex items-center space-x-4 w-48 justify-end">
        <SearchBar />
        <button className="text-textMuted hover:text-textPrimary transition-colors">
          <Menu size={20} />
        </button>
      </div>
    </nav>
  );
};

export default MemeNavbar;
