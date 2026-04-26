import React, { useState } from 'react';
import MessageCard from './MessageCard';
import ComposeArea from './ComposeArea';

const CenterPanel = () => {
  const [hasContact, setHasContact] = useState(true); // Toggle to false to see empty state

  if (!hasContact) {
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
            14:32 · rendezvous window 14:00-15:00
          </div>
        </div>

        <MessageCard 
          sent={false}
          text="The package has been successfully embedded. Keys are in the standard location."
          time="14:35"
        />

        <MessageCard 
          sent={true}
          text="ok I'll check the drop"
          time="14:36"
        />
      </div>

      <ComposeArea />
    </div>
  );
};

export default CenterPanel;
