import React, { useState } from 'react';
import { ChevronDown } from 'lucide-react';

const MessageCard = ({ sent, text, time }) => {
  const [drawerOpen, setDrawerOpen] = useState(false);

  return (
    <div className={`flex flex-col max-w-[72%] animate-slide-in ${sent ? 'self-end' : 'self-start'}`}>
      <div 
        className={`relative p-3.5 px-4 rounded-md cursor-pointer transition-all bg-bgTertiary border border-borderBase hover:bg-bgElevated hover:border-[rgba(255,255,255,0.09)] ${sent ? 'bg-bgSecondary border-l-2 border-l-accent' : ''}`}
        onClick={() => setDrawerOpen(!drawerOpen)}
      >
        <p className="text-[0.9375rem] text-textPrimary mb-2 leading-relaxed break-words whitespace-pre-wrap">{text}</p>
        
        <div className="flex justify-between items-center text-[0.75rem] text-textMuted mt-3">
          <span>{sent ? 'transmitted · 3 shards · cover injected ✓' : `${time} · recovered via imgur·gist`}</span>
          <ChevronDown size={14} className={`transition-transform duration-200 ${drawerOpen ? 'rotate-180' : ''}`} />
        </div>
      </div>

      {drawerOpen && (
        <div className="mt-1 p-3 bg-bgSecondary border border-borderAccent rounded-md text-[0.8125rem] font-mono text-textMuted animate-fade-in">
          <div className="flex justify-between mb-1">
            <span className="text-textSecondary">Rendezvous ID:</span>
            <span className="text-accent">rz_9f8a...2b1c</span>
          </div>
          <div className="flex justify-between mb-1">
            <span className="text-textSecondary">Encryption:</span>
            <span>XChaCha20-Poly1305</span>
          </div>
          <div className="flex justify-between">
            <span className="text-textSecondary">Shards Found:</span>
            <span>3/3 (Imgur: 2, Gist: 1)</span>
          </div>
        </div>
      )}
    </div>
  );
};

export default MessageCard;
