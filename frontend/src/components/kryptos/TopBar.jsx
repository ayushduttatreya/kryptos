import React from 'react';
import { Settings, QrCode, LogOut } from 'lucide-react';
import { useAppStore } from '../../store/useAppStore';

const TopBar = () => {
  const { setMode, setGlitching } = useAppStore();

  const handleExit = () => {
    setGlitching(true);
    setTimeout(() => {
      setMode('meme');
      setGlitching(false);
    }, 350);
  };

  return (
    <div className="h-[48px] bg-bgSecondary border-b border-borderBase flex items-center justify-between px-4 shrink-0 z-10">
      <div className="flex items-center space-x-2 w-[240px]">
        <span className="font-mono text-textMuted font-medium tracking-wider">KRYPTOS</span>
        <span className="text-[0.7rem] text-textMuted bg-bgTertiary px-1.5 py-0.5 rounded border border-borderBase">
          research prototype
        </span>
      </div>

      <div className="flex-1 flex justify-center text-textSecondary text-sm items-center">
        <span className="font-medium">Alice</span>
        <span className="mx-2 text-textMuted">·</span>
        <span className="font-mono text-accent text-[0.8125rem]">a3f7c2b9</span>
      </div>

      <div className="flex items-center justify-end space-x-2 w-[240px]">
        <button className="p-1.5 text-textMuted hover:text-textPrimary hover:bg-bgElevated rounded transition-colors">
          <Settings size={16} />
        </button>
        <button className="p-1.5 text-textMuted hover:text-textPrimary hover:bg-bgElevated rounded transition-colors">
          <QrCode size={16} />
        </button>
        <button 
          onClick={handleExit}
          className="p-1.5 text-textMuted hover:text-textPrimary hover:bg-bgElevated rounded transition-colors ml-2"
        >
          <LogOut size={16} />
        </button>
      </div>
    </div>
  );
};

export default TopBar;
