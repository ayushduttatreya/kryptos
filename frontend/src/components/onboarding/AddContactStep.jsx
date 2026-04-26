import React, { useState } from 'react';
import { QrCode, Keyboard } from 'lucide-react';

const AddContactStep = ({ onNext }) => {
  const [mode, setMode] = useState(null); // 'qr' or 'manual'

  return (
    <div className="flex flex-col items-center animate-fade-in w-full text-center">
      <h2 className="text-[2rem] font-medium tracking-[-0.03em] mb-8">pair your first contact</h2>

      {!mode && (
        <div className="flex space-x-4 w-full">
          <button 
            onClick={() => setMode('qr')}
            className="flex-1 bg-bgTertiary border border-borderBase rounded-md p-6 flex flex-col items-center hover:bg-bgElevated transition-all duration-150"
          >
            <QrCode size={32} className="text-accent mb-4" />
            <span className="text-textPrimary font-medium">Scan QR Code</span>
          </button>
          
          <button 
            onClick={() => setMode('manual')}
            className="flex-1 bg-bgTertiary border border-borderBase rounded-md p-6 flex flex-col items-center hover:bg-bgElevated transition-all duration-150"
          >
            <Keyboard size={32} className="text-accent mb-4" />
            <span className="text-textPrimary font-medium">Enter manually</span>
          </button>
        </div>
      )}

      {mode === 'manual' && (
        <div className="w-full animate-fade-in">
          <p className="text-textMuted mb-6">Enter the 3-word seed phrase provided by your contact.</p>
          <div className="flex space-x-3 mb-8">
            {[1, 2, 3].map(i => (
              <input 
                key={i}
                type="text"
                placeholder={`word ${i}`}
                className="flex-1 bg-bgSecondary border border-borderBase rounded-sm px-3 py-2.5 text-center focus:border-borderFocus focus:shadow-[0_0_0_3px_var(--accent-dim)] outline-none text-textPrimary w-full"
              />
            ))}
          </div>
          <div className="flex justify-between w-full">
            <button 
              onClick={() => setMode(null)}
              className="text-textMuted hover:text-textPrimary text-sm px-4 py-2"
            >
              back
            </button>
            <button 
              onClick={onNext}
              className="bg-accent text-textInverse px-[18px] py-[10px] rounded-sm font-medium hover:bg-accentHover hover:shadow-accentGlow transition-all duration-120"
            >
              pair node
            </button>
          </div>
        </div>
      )}

      {mode === 'qr' && (
        <div className="w-full animate-fade-in flex flex-col items-center">
          <div className="w-64 h-64 bg-bgSecondary border border-borderBase rounded-md flex items-center justify-center mb-8 relative overflow-hidden">
            <div className="absolute inset-0 bg-bgTertiary opacity-50" />
            <div className="w-48 h-48 border-2 border-accent border-dashed rounded-md flex items-center justify-center relative z-10">
              <span className="text-textMuted text-sm">camera feed</span>
            </div>
          </div>
          <div className="flex justify-between w-full">
            <button 
              onClick={() => setMode(null)}
              className="text-textMuted hover:text-textPrimary text-sm px-4 py-2"
            >
              back
            </button>
            <button 
              onClick={onNext}
              className="bg-transparent border border-borderBase text-textSecondary px-[18px] py-[10px] rounded-sm font-medium hover:bg-bgElevated hover:text-textPrimary transition-all duration-150"
            >
              skip for now
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default AddContactStep;
