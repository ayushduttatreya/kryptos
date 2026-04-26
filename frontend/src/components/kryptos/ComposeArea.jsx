import React, { useState } from 'react';
import { ArrowRight, Loader } from 'lucide-react';

const CheckCircle = ({ text, done }) => (
  <>
    {done ? (
      <span className="text-success mr-1.5 flex items-center font-sans">✓</span>
    ) : (
      <span className="w-1.5 h-1.5 rounded-full bg-textMuted mr-1.5" />
    )}
    <span className={done ? 'text-success' : ''}>{text}</span>
  </>
);

const ComposeArea = ({ onSend }) => {
  const [text, setText] = useState('');
  const [isPriority, setIsPriority] = useState(false);
  const [sending, setSending] = useState(false);

  const handleSend = async () => {
    if (!text.trim() || sending) return;
    setSending(true);
    const result = await onSend?.(text, isPriority);
    if (result && result.success) {
      setText('');
    }
    setSending(false);
  };

  return (
    <div className="bg-bgSecondary border-t border-borderBase p-4 relative shrink-0">
      {sending && (
        <div className="absolute left-0 right-0 -top-[52px] h-[52px] bg-bgSecondary border-t border-borderAccent px-4 py-3 flex items-center justify-between text-[0.75rem] font-mono shadow-md animate-fade-in z-20">
          <div className="flex items-center space-x-4">
            <div className="flex items-center text-textMuted"><CheckCircle text="encrypting" done /></div>
            <span className="text-borderBase">→</span>
            <div className="flex items-center text-textMuted"><CheckCircle text="sharding" done /></div>
            <span className="text-borderBase">→</span>
            <div className="flex items-center text-textPrimary bg-bgTertiary px-2 py-1 rounded-sm border border-borderAccent"><Loader size={12} className="animate-spin mr-1.5 text-accent"/> embedding</div>
            <span className="text-borderBase">→</span>
            <div className="flex items-center text-textMuted"><CheckCircle text="transmitting" done={false} /></div>
          </div>
        </div>
      )}

      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="encrypt and transmit..."
        className="w-full bg-bgTertiary border border-borderBase rounded-md p-3 text-[0.9375rem] text-textPrimary placeholder-textMuted focus:border-borderFocus focus:shadow-[0_0_0_3px_var(--accent-dim)] outline-none min-h-[80px] max-h-[200px] resize-none transition-all"
      />

      <div className="flex justify-between items-center mt-3">
        <div className="flex items-center space-x-4">
          <span className="text-[0.75rem] text-textMuted font-mono">{text.length} chars</span>
          
          <div className="flex bg-bgTertiary border border-borderBase rounded-full p-0.5">
            <button 
              onClick={() => setIsPriority(false)}
              className={`text-[0.75rem] px-3 py-1 rounded-full transition-all ${!isPriority ? 'bg-bgElevated text-textPrimary' : 'text-textMuted hover:text-textSecondary'}`}
            >
              Normal
            </button>
            <button 
              onClick={() => setIsPriority(true)}
              className={`text-[0.75rem] px-3 py-1 rounded-full transition-all ${isPriority ? 'bg-accentDim border border-accent text-accent' : 'border border-transparent text-textMuted hover:text-textSecondary'}`}
            >
              Priority
            </button>
          </div>
        </div>

        <button 
          onClick={handleSend}
          disabled={!text.trim() || sending}
          className="w-9 h-9 flex items-center justify-center rounded-sm bg-accent text-textInverse hover:bg-accentHover hover:shadow-accentGlow transition-all disabled:opacity-50 disabled:hover:shadow-none"
        >
          <ArrowRight size={18} />
        </button>
      </div>
    </div>
  );
};

export default ComposeArea;
