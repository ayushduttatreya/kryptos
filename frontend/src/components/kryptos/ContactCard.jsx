import React from 'react';

const ContactCard = ({ active, name, msg, time, unread, onClick }) => {
  return (
    <div 
      onClick={onClick}
      className={`relative p-3 rounded-md cursor-pointer transition-all duration-150 border flex flex-col ${active ? 'bg-bgTertiary border-borderBase' : 'bg-transparent border-transparent hover:bg-bgTertiary'}`}
    >
      {active && <div className="absolute left-0 top-0 bottom-0 w-1 bg-accent rounded-l-md" />}
      
      <div className={`flex justify-between items-center mb-1 ${active ? 'pl-2' : ''}`}>
        <span className={`font-medium text-sm ${active ? 'text-textPrimary' : 'text-textSecondary'}`}>{name}</span>
        {unread && (
          <span className="bg-accent text-textInverse font-mono text-[0.65rem] px-1.5 py-0.5 rounded-full font-bold">
            {unread}
          </span>
        )}
      </div>
      
      <div className={`flex justify-between items-center text-xs ${active ? 'pl-2' : ''}`}>
        <span className="text-textMuted truncate pr-2 max-w-[140px]">{msg}</span>
        <span className="text-textMuted shrink-0">{time}</span>
      </div>
    </div>
  );
};

export default ContactCard;
