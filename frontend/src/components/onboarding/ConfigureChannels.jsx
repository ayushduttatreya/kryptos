import React, { useState } from 'react';
import { Check, X } from 'lucide-react';

const ConfigureChannels = ({ onNext }) => {
  const [imgurStatus, setImgurStatus] = useState(null); // 'success', 'error', or null
  const [githubStatus, setGithubStatus] = useState(null);

  const handleTest = (setter) => {
    setter(null);
    setTimeout(() => setter('success'), 600);
  };

  return (
    <div className="flex flex-col items-center animate-fade-in w-full text-left">
      <h2 className="text-[2rem] font-medium tracking-[-0.03em] mb-8 text-center w-full">connect dead drops</h2>
      
      <div className="w-full space-y-6 mb-8">
        <div>
          <label className="block text-[0.875rem] font-semibold tracking-[0.08em] uppercase text-textMuted mb-2">Imgur Client ID</label>
          <div className="flex items-center space-x-3">
            <input 
              type="text" 
              placeholder="e.g. a3b5..."
              className="flex-1 bg-bgSecondary border border-borderBase rounded-sm px-[14px] py-[10px] focus:border-borderFocus focus:shadow-[0_0_0_3px_var(--accent-dim)] outline-none text-textPrimary font-mono text-[0.8125rem]"
            />
            <button 
              onClick={() => handleTest(setImgurStatus)}
              className="text-accent hover:text-accentHover text-sm min-w-[120px] text-right flex items-center justify-end"
            >
              {imgurStatus === 'success' && <Check size={16} className="text-success mr-1" />}
              {imgurStatus === 'error' && <X size={16} className="text-error mr-1" />}
              test connection
            </button>
          </div>
        </div>

        <div>
          <label className="block text-[0.875rem] font-semibold tracking-[0.08em] uppercase text-textMuted mb-2">GitHub Token</label>
          <div className="flex items-center space-x-3">
            <input 
              type="password" 
              placeholder="ghp_..."
              className="flex-1 bg-bgSecondary border border-borderBase rounded-sm px-[14px] py-[10px] focus:border-borderFocus focus:shadow-[0_0_0_3px_var(--accent-dim)] outline-none text-textPrimary font-mono text-[0.8125rem]"
            />
            <button 
              onClick={() => handleTest(setGithubStatus)}
              className="text-accent hover:text-accentHover text-sm min-w-[120px] text-right flex items-center justify-end"
            >
              {githubStatus === 'success' && <Check size={16} className="text-success mr-1" />}
              {githubStatus === 'error' && <X size={16} className="text-error mr-1" />}
              test connection
            </button>
          </div>
        </div>

        <p className="text-textMuted text-[0.75rem]">stored locally in your browser only</p>
      </div>

      <button 
        onClick={onNext}
        className="w-full bg-accent text-textInverse px-[18px] py-[10px] rounded-sm font-medium hover:bg-accentHover hover:shadow-accentGlow transition-all duration-120"
      >
        save configuration
      </button>
    </div>
  );
};

export default ConfigureChannels;
