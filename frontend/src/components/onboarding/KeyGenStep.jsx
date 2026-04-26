import React, { useState, useEffect } from 'react';

const KeyGenStep = ({ onNext }) => {
  const [generating, setGenerating] = useState(false);
  const [complete, setComplete] = useState(false);
  const [hexString, setHexString] = useState('');

  const targetKey = 'a3f7c2b9';

  useEffect(() => {
    if (!generating) return;

    let interval = setInterval(() => {
      setHexString(Math.random().toString(16).substring(2, 10));
    }, 50);

    setTimeout(() => {
      clearInterval(interval);
      setHexString(targetKey);
      setGenerating(false);
      setComplete(true);
    }, 800);

    return () => clearInterval(interval);
  }, [generating]);

  return (
    <div className="flex flex-col items-center animate-fade-in text-center">
      <h2 className="text-[2rem] font-medium tracking-[-0.03em] mb-4">establish your node</h2>
      <p className="text-textMuted mb-12">Generate your cryptographic identity. This keypair will secure your covert channels and never leaves this device.</p>

      {!generating && !complete && (
        <button 
          onClick={() => setGenerating(true)}
          className="bg-accent text-textInverse px-[18px] py-[10px] rounded-sm font-medium hover:bg-accentHover hover:shadow-accentGlow transition-all duration-120"
        >
          generate keypair
        </button>
      )}

      {(generating || complete) && (
        <div className="flex flex-col items-center h-32 justify-center">
          <div className={`font-mono text-2xl tracking-[0.02em] transition-all duration-300 ${complete ? 'text-accent shadow-accentGlow' : 'text-textSecondary'}`}>
            {hexString}
          </div>
        </div>
      )}

      {complete && (
        <button 
          onClick={onNext}
          className="mt-8 bg-transparent border border-borderBase text-textSecondary px-[18px] py-[10px] rounded-sm font-medium hover:bg-bgElevated hover:text-textPrimary transition-all duration-150 animate-fade-in"
        >
          continue
        </button>
      )}
    </div>
  );
};

export default KeyGenStep;
