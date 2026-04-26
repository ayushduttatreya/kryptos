import React, { useState } from 'react';
import KeyGenStep from './KeyGenStep';
import AddContactStep from './AddContactStep';
import ConfigureChannels from './ConfigureChannels';
import ThreatModelBadge from '../shared/ThreatModelBadge';
import { useAppStore } from '../../store/useAppStore';

const OnboardingFlow = () => {
  const [step, setStep] = useState(1);
  const setMode = useAppStore(state => state.setMode);
  const setOnboardingComplete = useAppStore(state => state.setOnboardingComplete);

  const handleFinish = () => {
    setOnboardingComplete(true);
    setMode('meme'); // Trigger fade back to meme browser as per spec
  };

  return (
    <div className="min-h-screen bg-bgPrimary flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-[480px]">
        {/* Progress indicator */}
        <div className="flex justify-center space-x-3 mb-12">
          {[1, 2, 3, 4].map((i) => (
            <div 
              key={i} 
              className={`w-2 h-2 rounded-full transition-colors duration-300 ${step === i ? 'bg-accent' : 'bg-bgElevated'}`}
            />
          ))}
        </div>

        <div className="min-h-[400px]">
          {step === 1 && <KeyGenStep onNext={() => setStep(2)} />}
          {step === 2 && <AddContactStep onNext={() => setStep(3)} />}
          {step === 3 && <ConfigureChannels onNext={() => setStep(4)} />}
          {step === 4 && (
            <div className="flex flex-col items-center animate-fade-in text-center">
              <h2 className="text-[2rem] font-medium tracking-[-0.03em] mb-4">you're dark</h2>
              <p className="text-textMuted mb-8">your communications are now invisible to casual observers</p>
              
              <div className="w-full mb-10 text-left">
                <ThreatModelBadge />
              </div>

              <button 
                onClick={handleFinish}
                className="bg-accent text-textInverse px-[18px] py-[10px] rounded-sm font-medium hover:bg-accentHover hover:shadow-accentGlow transition-all duration-120"
              >
                enter
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default OnboardingFlow;
