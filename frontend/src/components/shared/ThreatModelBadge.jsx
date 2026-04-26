import React from 'react';
import { Info } from 'lucide-react';

const ThreatModelBadge = () => {
  return (
    <div className="bg-bgTertiary border border-borderAccent rounded-md p-3">
      <div className="flex items-center justify-between mb-3">
        <span className="text-[0.875rem] font-semibold tracking-[0.08em] uppercase text-textMuted">PROTECTION SCOPE</span>
        <button className="text-textMuted hover:text-textPrimary transition-colors">
          <Info size={16} />
        </button>
      </div>
      
      <div className="space-y-2 text-sm">
        <div className="flex items-center space-x-2">
          <div className="w-1.5 h-1.5 rounded-full bg-success" />
          <span className="text-textSecondary">Casual observer — protected</span>
        </div>
        <div className="flex items-center space-x-2">
          <div className="w-1.5 h-1.5 rounded-full bg-success" />
          <span className="text-textSecondary">Platform content scan — protected</span>
        </div>
        <div className="flex items-center space-x-2">
          <div className="w-1.5 h-1.5 rounded-full bg-error" />
          <span className="text-textMuted">Active steganalysis — not protected</span>
        </div>
        <div className="flex items-center space-x-2">
          <div className="w-1.5 h-1.5 rounded-full bg-error" />
          <span className="text-textMuted">Behavioral correlation — not protected</span>
        </div>
        <div className="flex items-center space-x-2">
          <div className="w-1.5 h-1.5 rounded-full bg-error" />
          <span className="text-textMuted">Compromised endpoint — not protected</span>
        </div>
      </div>
    </div>
  );
};

export default ThreatModelBadge;
