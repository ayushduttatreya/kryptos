import React, { useState, useEffect, useCallback } from 'react';
import ContactCard from './ContactCard';
import { getContacts, getChannelsStatus, getIdentity, startPoll, stopPoll } from '../../api/backend';

function getRendezvousInfo() {
  const now = new Date();
  const h = now.getUTCHours();
  const m = now.getUTCMinutes();
  const s = now.getUTCSeconds();
  const secsRemaining = 3600 - (m * 60 + s);
  const mm = String(Math.floor(secsRemaining / 60)).padStart(2, '0');
  const ss = String(secsRemaining % 60).padStart(2, '0');
  const pad = n => String(n).padStart(2, '0');
  const label = `${pad(h)}:00 – ${pad((h + 1) % 24)}:00`;
  return { countdown: `${mm}:${ss}`, label };
}

const LeftPanel = ({ selectedContact, onSelectContact, onOpenPairing, contactsVersion }) => {
  const [contacts, setContacts] = useState([]);
  const [channels, setChannels] = useState({ imgur: { status: 'unknown' }, gist: { status: 'unknown' } });
  const [identity, setIdentity] = useState(null);
  const [rendezvous, setRendezvous] = useState(getRendezvousInfo());
  const contactsRef = React.useRef([]);

  const fetchData = useCallback(async () => {
    const [contactsData, channelsData, identityData] = await Promise.all([
      getContacts(),
      getChannelsStatus(),
      getIdentity(),
    ]);
    const loaded = contactsData || [];
    setContacts(loaded);
    contactsRef.current = loaded;
    loaded.forEach(c => startPoll(c.id));
    if (channelsData) setChannels(channelsData);
    if (identityData) setIdentity(identityData);
  }, []);

  useEffect(() => {
    fetchData();
    const pollInterval = setInterval(fetchData, 30000);
    return () => {
      clearInterval(pollInterval);
      contactsRef.current.forEach(c => stopPoll(c.id));
    };
  }, [fetchData, contactsVersion]);

  useEffect(() => {
    const tick = setInterval(() => setRendezvous(getRendezvousInfo()), 1000);
    return () => clearInterval(tick);
  }, []);

  const formatLastSeen = (timestamp) => {
    const diff = Date.now() - timestamp;
    const minutes = Math.floor(diff / 60000);
    if (minutes < 1) return 'just now';
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    return 'Yesterday';
  };

  const pubKeyDisplay = identity
    ? `${identity.publicKey.slice(0, 10)}...${identity.publicKey.slice(-10)}`
    : '···';

  return (
    <div className="w-[260px] bg-bgSecondary border-r border-borderBase flex flex-col shrink-0 h-full">
      <div className="h-[120px] p-4 flex flex-col justify-center border-b border-borderBase shrink-0">
        <h3 className="text-[0.875rem] font-semibold tracking-[0.08em] uppercase text-textMuted mb-2">YOUR NODE</h3>
        <div className="font-mono text-xl text-textPrimary tracking-[0.02em] cursor-pointer hover:text-accent transition-colors">
          {identity?.fingerprint ?? '···'}
        </div>
        <div className="text-[0.7rem] text-textMuted font-mono truncate mt-1">
          {pubKeyDisplay}
        </div>
        <div className="flex items-center space-x-1.5 mt-3">
          <div className="w-1.5 h-1.5 rounded-full bg-success animate-pulse-subtle" />
          <span className="text-[0.75rem] text-textMuted">connected</span>
        </div>
      </div>

      <div className="p-4 border-b border-borderBase shrink-0">
        <h3 className="text-[0.875rem] font-semibold tracking-[0.08em] uppercase text-textMuted mb-2">RENDEZVOUS WINDOW</h3>
        <div className="font-mono text-textPrimary mb-2 text-sm">{rendezvous.label}</div>
        <div className="font-mono text-2xl text-textSecondary">
          {rendezvous.countdown}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 flex flex-col min-h-0">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-[0.875rem] font-semibold tracking-[0.08em] uppercase text-textMuted">CONTACTS</h3>
        </div>
        <button
          onClick={() => onOpenPairing('scan')}
          className="w-full bg-transparent border border-borderBase text-textSecondary text-sm py-1.5 rounded-sm hover:bg-bgElevated transition-colors mb-4 shrink-0"
        >
          + pair new node
        </button>

        <div className="space-y-2 flex-1">
          {contacts.map((contact) => (
            <ContactCard
              key={contact.id}
              active={selectedContact?.id === contact.id}
              name={contact.name}
              msg={contact.lastMessage || 'connection established'}
              time={formatLastSeen(contact.lastSeen)}
              onClick={() => onSelectContact(contact)}
            />
          ))}
        </div>
      </div>

      <div className="h-[100px] border-t border-borderBase p-4 flex flex-col shrink-0 bg-bgSecondary">
        <h3 className="text-[0.875rem] font-semibold tracking-[0.08em] uppercase text-textMuted mb-2">CHANNELS</h3>
        <div className="flex justify-between items-center text-[0.75rem] mb-1">
          <div className="flex items-center">
            <div className={`w-1 h-1 rounded-full mr-1.5 ${channels.imgur?.status === 'reachable' ? 'bg-success' : 'bg-error'}`} />
            <span className="text-textSecondary">Imgur</span>
          </div>
          <span className="text-textMuted">{channels.imgur?.status === 'reachable' ? 'active' : 'down'}</span>
        </div>
        <div className="flex justify-between items-center text-[0.75rem] mb-2">
          <div className="flex items-center">
            <div className={`w-1 h-1 rounded-full mr-1.5 ${channels.gist?.status === 'reachable' ? 'bg-success' : 'bg-error'}`} />
            <span className="text-textSecondary">GitHub Gist</span>
          </div>
          <span className="text-textMuted">{channels.gist?.status === 'reachable' ? 'active' : 'down'}</span>
        </div>
        <div className="h-px bg-borderBase w-full my-1.5" />
        <span className="text-[0.75rem] text-textMuted">Cover traffic: active</span>
      </div>
    </div>
  );
};

export default LeftPanel;
