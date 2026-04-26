import React, { useState } from 'react';
import { Search } from 'lucide-react';

const SearchBar = () => {
  const [isFocused, setIsFocused] = useState(false);

  return (
    <div className={`flex items-center bg-bgSecondary border transition-all duration-150 ease-in-out rounded-sm ${isFocused ? 'border-borderFocus shadow-[0_0_0_3px_var(--accent-dim)] w-64' : 'border-borderBase w-48'}`}>
      <Search size={16} className="text-textMuted ml-3" />
      <input
        type="text"
        placeholder="Search memes..."
        className="bg-transparent border-none outline-none text-sm text-textPrimary py-2 px-3 w-full placeholder-textMuted"
        onFocus={() => setIsFocused(true)}
        onBlur={() => setIsFocused(false)}
      />
    </div>
  );
};

export default SearchBar;
