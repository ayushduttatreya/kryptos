import React from 'react';
import { useAppStore } from '../../store/useAppStore';

const GlitchTransition = ({ children }) => {
  const isGlitching = useAppStore((state) => state.isGlitching);

  if (!isGlitching) return <>{children}</>;

  return (
    <div className="animate-glitch w-full h-screen bg-bgPrimary overflow-hidden">
      {children}
    </div>
  );
};

export default GlitchTransition;
