import React, { useState, useEffect } from 'react';
import ThreatModelBadge from '../shared/ThreatModelBadge';
import { getIdentity } from '../../api/backend';

const RightPanel = ({ selectedContact }) => {
  const [showQr, setShowQr] = useState(false);
  const [identity, setIdentity] = useState(null);

  useEffect(() => {
    const fetchIdentity = async () => {
      const data = await getIdentity();
      if (data) setIdentity(data);
    };
    fetchIdentity();
  }, []);

  return (
    <div className="w-[280px] bg-bgSecondary border-l border-borderBase p-5 h-full overflow-y-auto shrink-0 flex flex-col space-y-6">
      
      <div>
        <h3 className="text-[0.875rem] font-semibold tracking-[0.08em] uppercase text-textMuted mb-2">CONTACT NODE</h3>
        <div className="text-[1rem] font-medium text-textPrimary mb-1">{selectedContact?.name || identity?.handle || 'Alice'}</div>
        <div className="font-mono text-[0.8rem] text-accent mb-2">{selectedContact?.fingerprint || identity?.fingerprint || 'a3f7c2b9'}</div>
        <div className="text-[0.75rem] text-textMuted">Last seen: 2 mins ago</div>
      </div>

      <div className="h-px bg-borderBase w-full shrink-0" />

      <div>
        <h3 className="text-[0.875rem] font-semibold tracking-[0.08em] uppercase text-textMuted mb-2">CRYPTOGRAPHIC STATE</h3>
        <div className="w-full h-1 bg-bgTertiary rounded-full mb-2 overflow-hidden border border-borderBase">
          <div className="h-full w-3/4 bg-success rounded-full" />
        </div>
        <div className="text-[0.75rem] text-textMuted flex justify-between mb-3">
          <span>Seed health</span>
          <span>fresh</span>
        </div>
        <div className="text-[0.75rem] text-textMuted mb-4">Last ratchet: 14:35 today</div>
        
        <button className="w-full bg-transparent border border-borderBase text-textSecondary text-sm py-1.5 rounded-sm hover:bg-bgElevated hover:text-error transition-colors">
          Rotate seed
        </button>
      </div>

      <div className="h-px bg-borderBase w-full shrink-0" />

      <div>
        <h3 className="text-[0.875rem] font-semibold tracking-[0.08em] uppercase text-textMuted mb-4">SESSION STATS</h3>
        <div className="grid grid-cols-2 gap-4 mb-5">
          <div>
            <div className="text-[1.25rem] font-medium text-textPrimary">42</div>
            <div className="text-[0.75rem] text-textMuted mt-1">Sent</div>
          </div>
          <div>
            <div className="text-[1.25rem] font-medium text-textPrimary">38</div>
            <div className="text-[0.75rem] text-textMuted mt-1">Received</div>
          </div>
          <div>
            <div className="text-[1.25rem] font-medium text-textPrimary flex items-baseline">1.2<span className="text-sm text-textMuted ml-1">m</span></div>
            <div className="text-[0.75rem] text-textMuted mt-1">Avg recovery</div>
          </div>
          <div>
            <div className="text-[1.25rem] font-medium text-textPrimary">2</div>
            <div className="text-[0.75rem] text-textMuted mt-1">Channels active</div>
          </div>
        </div>

        <div className="text-[0.75rem] text-textMuted mb-2">Channel Usage</div>
        <div className="flex h-3 w-full rounded-sm overflow-hidden border border-borderBase">
          <div className="bg-accent h-full w-[65%]" title="Imgur 65%" />
          <div className="bg-accentDim h-full w-[35%]" title="Gist 35%" />
        </div>
        <div className="flex justify-between text-[0.65rem] text-textMuted mt-1">
          <span>Imgur</span>
          <span>Gist</span>
        </div>
      </div>

      <div className="h-px bg-borderBase w-full shrink-0" />

      <div>
        <h3 className="text-[0.875rem] font-semibold tracking-[0.08em] uppercase text-textMuted mb-3">PAIR NEW NODE</h3>
        <button 
          onClick={() => setShowQr(!showQr)}
          className="w-full bg-transparent border border-borderBase text-textSecondary text-sm py-1.5 rounded-sm hover:bg-bgElevated hover:text-textPrimary transition-colors"
        >
          {showQr ? 'hide QR' : 'generate pairing QR'}
        </button>
        {showQr && (
          <div className="mt-3 bg-bgTertiary border border-borderAccent p-3 rounded-md flex justify-center animate-fade-in">
            <div className="w-32 h-32 bg-textPrimary rounded flex items-center justify-center">
              <span className="text-bgPrimary text-xs font-mono text-center">QR Code<br/>Placeholder</span>
            </div>
          </div>
        )}
      </div>

      <div className="mt-auto pt-6 pb-2">
        <ThreatModelBadge />
      </div>

    </div>
  );
};

export default RightPanel;
