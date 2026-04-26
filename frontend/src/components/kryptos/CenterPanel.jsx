import React, { useState, useEffect } from 'react';
import MessageCard from './MessageCard';
import ComposeArea from './ComposeArea';
import { getMessages, sendMessage } from '../../api/backend';

const CenterPanel = ({ selectedContact }) => {
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!selectedContact) return;
    
    const fetchMessages = async () => {
      setLoading(true);
      const data = await getMessages(selectedContact.id);
      setMessages(data);
      setLoading(false);
    };
    
    fetchMessages();
    // Poll for new messages every 10 seconds
    const interval = setInterval(fetchMessages, 10000);
    return () => clearInterval(interval);
  }, [selectedContact]);

  const handleSend = async (text, priority = false) => {
    if (!selectedContact || !text.trim()) return;
    
    const result = await sendMessage(selectedContact.id, text, priority);
    if (result && result.success) {
      // Refresh messages
      const data = await getMessages(selectedContact.id);
      setMessages(data);
    }
    return result;
  };

  if (!selectedContact) {
    return (
      <div className="flex-1 bg-bgPrimary flex flex-col h-full relative border-r border-borderBase items-center justify-center">
        <div className="text-[10rem] font-mono font-bold text-textPrimary opacity-5 select-none absolute tracking-tighter">
          KRYPTOS
        </div>
        <p className="text-textMuted italic z-10">select a contact to begin transmission</p>
      </div>
    );
  }

  return (
    <div className="flex-1 bg-bgPrimary flex flex-col h-full relative border-r border-borderBase">
      <div className="flex-1 overflow-y-auto p-6 flex flex-col relative space-y-6">
        <div className="flex justify-center my-2">
          <div className="text-[0.75rem] text-textMuted bg-bgSecondary px-3 py-1 rounded-full border border-borderBase">
            {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} · rendezvous window 14:00-15:00
          </div>
        </div>

        {loading && messages.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-textMuted">Loading messages...</div>
          </div>
        ) : (
          messages.map((msg) => (
            <MessageCard 
              key={msg.id}
              sent={msg.sent}
              text={msg.text}
              time={msg.time}
            />
          ))
        )}
      </div>

      <ComposeArea onSend={handleSend} />
    </div>
  );
};

export default CenterPanel;
