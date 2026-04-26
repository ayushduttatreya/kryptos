import React, { useState } from 'react';
import { useAppStore } from '../store/useAppStore';
import OnboardingFlow from '../components/onboarding/OnboardingFlow';
import TopBar from '../components/kryptos/TopBar';
import LeftPanel from '../components/kryptos/LeftPanel';
import CenterPanel from '../components/kryptos/CenterPanel';
import RightPanel from '../components/kryptos/RightPanel';

const KryptosInterface = () => {
  const onboardingComplete = useAppStore(state => state.onboardingComplete);
  const [selectedContact, setSelectedContact] = useState(null);

  if (!onboardingComplete) {
    return <OnboardingFlow />;
  }

  return (
    <div className="h-screen w-full bg-bgPrimary flex flex-col overflow-hidden text-textPrimary animate-fade-in">
      <TopBar />
      <div className="flex-1 flex overflow-hidden">
        <LeftPanel selectedContact={selectedContact} onSelectContact={setSelectedContact} />
        <CenterPanel selectedContact={selectedContact} />
        <RightPanel selectedContact={selectedContact} />
      </div>
    </div>
  );
};

export default KryptosInterface;
