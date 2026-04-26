import React, { useEffect } from 'react';
import { useKonamiCode } from './hooks/useKonamiCode';
import { useAppStore } from './store/useAppStore';
import MemeBrowser from './pages/MemeBrowser';
import KryptosInterface from './pages/KryptosInterface';
import GlitchTransition from './components/shared/GlitchTransition';

function App() {
  const { success, setSuccess } = useKonamiCode();
  const { mode, setMode, isGlitching, setGlitching } = useAppStore();

  useEffect(() => {
    if (success && mode === 'meme') {
      setGlitching(true);
      setTimeout(() => {
        setMode('kryptos');
        setGlitching(false);
        setSuccess(false);
      }, 350); // match glitch animation duration
    }
  }, [success, mode, setMode, setGlitching, setSuccess]);

  return (
    <div className="min-h-screen bg-bgPrimary text-textPrimary">
      <GlitchTransition>
        <div className={isGlitching ? 'opacity-50' : 'animate-fade-in'}>
          {mode === 'meme' ? <MemeBrowser /> : <KryptosInterface />}
        </div>
      </GlitchTransition>
    </div>
  );
}

export default App;
