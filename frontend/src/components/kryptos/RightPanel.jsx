import React, { useState, useEffect } from 'react';
import ThreatModelBadge from '../shared/ThreatModelBadge';
import { getStats } from '../../api/backend';

function formatRelative(ts) {
  if (!ts) return 'never';
  const diff = Date.now() - ts;
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return 'Yesterday';
}

const RightPanel = ({ selectedContact, onOpenPairing }) => {
  const [stats, setStats] = useState(null);

  useEffect(() => {
    if (!selectedContact) { setStats(null); return; }
    const fetchStats = () => getStats(selectedContact.id).then(s => { if (s) setStats(s); });
    fetchStats();
    const interval = setInterval(fetchStats, 30000);
    return () => clearInterval(interval);
  }, [selectedContact]);

  const imgurPct = stats ? Math.round(stats.channelUsage.imgur * 100) : 65;
  const gistPct = stats ? Math.round(stats.channelUsage.gist * 100) : 35;

  return (
    <div className="w-[280px] bg-bgSecondary border-l border-borderBase p-5 h-full overflow-y-auto shrink-0 flex flex-col space-y-6">

      <div>
        <h3 className="text-[0.875rem] font-semibold tracking-[0.08em] uppercase text-textMuted mb-2">CONTACT NODE</h3>
        {selectedContact ? (
          <>
            <div className="text-[1rem] font-medium text-textPrimary mb-1">{selectedContact.name}</div>
            <div className="font-mono text-[0.8rem] text-accent mb-2">{selectedContact.fingerprint}</div>
            <div className="text-[0.75rem] text-textMuted">Last seen: {formatRelative(selectedContact.lastSeen)}</div>
          </>
        ) : (
          <div className="text-textMuted text-sm">—</div>
        )}
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
        <div className="text-[0.75rem] text-textMuted mb-4">
          Last ratchet: <span>{stats ? formatRelative(stats.lastRatchet) : '···'}</span>
        </div>
        <button
          disabled
          title="Not yet implemented"
          className="w-full bg-transparent border border-borderBase text-textMuted text-sm py-1.5 rounded-sm opacity-40 cursor-not-allowed"
        >
          Rotate seed
        </button>
      </div>

      <div className="h-px bg-borderBase w-full shrink-0" />

      <div>
        <h3 className="text-[0.875rem] font-semibold tracking-[0.08em] uppercase text-textMuted mb-4">SESSION STATS</h3>
        <div className="grid grid-cols-2 gap-4 mb-5">
          <div>
            <div className="text-[1.25rem] font-medium text-textPrimary">{stats?.sent ?? '—'}</div>
            <div className="text-[0.75rem] text-textMuted mt-1">Sent</div>
          </div>
          <div>
            <div className="text-[1.25rem] font-medium text-textPrimary">{stats?.received ?? '—'}</div>
            <div className="text-[0.75rem] text-textMuted mt-1">Received</div>
          </div>
          <div>
            <div className="text-[1.25rem] font-medium text-textPrimary">2</div>
            <div className="text-[0.75rem] text-textMuted mt-1">Channels active</div>
          </div>
        </div>

        <div className="text-[0.75rem] text-textMuted mb-2">Channel Usage</div>
        <div className="flex h-3 w-full rounded-sm overflow-hidden border border-borderBase">
          <div className="bg-accent h-full" style={{ width: `${imgurPct}%` }} title={`Imgur ${imgurPct}%`} />
          <div className="bg-accentDim h-full" style={{ width: `${gistPct}%` }} title={`Gist ${gistPct}%`} />
        </div>
        <div className="flex justify-between text-[0.65rem] text-textMuted mt-1">
          <span>Imgur</span>
          <span>Gist</span>
        </div>
      </div>

      <div className="h-px bg-borderBase w-full shrink-0" />

      <div>
        <h3 className="text-[0.875rem] font-semibold tracking-[0.08em] uppercase text-textMuted mb-3">PAIR NEW NODE</h3>
        <div className="space-y-2">
          <button
            onClick={() => onOpenPairing('generate')}
            className="w-full bg-transparent border border-borderBase text-textSecondary text-sm py-1.5 rounded-sm hover:bg-bgElevated hover:text-textPrimary transition-colors"
          >
            generate pairing QR
          </button>
          <button
            onClick={() => onOpenPairing('scan')}
            className="w-full bg-transparent border border-borderBase text-textSecondary text-sm py-1.5 rounded-sm hover:bg-bgElevated hover:text-textPrimary transition-colors"
          >
            scan contact QR
          </button>
        </div>
      </div>

      <div className="mt-auto pt-6 pb-2">
        <ThreatModelBadge />
      </div>
    </div>
  );
};

export default RightPanel;
