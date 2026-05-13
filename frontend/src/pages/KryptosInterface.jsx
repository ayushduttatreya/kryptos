import React, { useState, useCallback } from 'react';
import { useAppStore } from '../store/useAppStore';
import OnboardingFlow from '../components/onboarding/OnboardingFlow';
import TopBar from '../components/kryptos/TopBar';
import LeftPanel from '../components/kryptos/LeftPanel';
import CenterPanel from '../components/kryptos/CenterPanel';
import RightPanel from '../components/kryptos/RightPanel';
import PairingModal from '../components/kryptos/PairingModal';

const KryptosInterface = () => {
  const onboardingComplete = useAppStore(state => state.onboardingComplete);
  const [selectedContact, setSelectedContact] = useState(null);
  const [pairingModalOpen, setPairingModalOpen] = useState(false);
  const [pairingMode, setPairingMode] = useState('generate');
  const [contactsVersion, setContactsVersion] = useState(0);

  const handleOpenPairing = useCallback((mode = 'generate') => {
    setPairingMode(mode);
    setPairingModalOpen(true);
  }, []);

  const handleContactAdded = useCallback(() => {
    setContactsVersion(v => v + 1);
    setPairingModalOpen(false);
  }, []);

  if (!onboardingComplete) {
    return <OnboardingFlow />;
  }

  return (
    <div className="h-screen w-full bg-bgPrimary flex flex-col overflow-hidden text-textPrimary animate-fade-in">
      <TopBar />
      <div className="flex-1 flex overflow-hidden">
        <LeftPanel
          selectedContact={selectedContact}
          onSelectContact={setSelectedContact}
          onOpenPairing={handleOpenPairing}
          contactsVersion={contactsVersion}
        />
        <CenterPanel selectedContact={selectedContact} />
        <RightPanel
          selectedContact={selectedContact}
          onOpenPairing={handleOpenPairing}
        />
      </div>
      {pairingModalOpen && (
        <PairingModal
          mode={pairingMode}
          onClose={() => setPairingModalOpen(false)}
          onContactAdded={handleContactAdded}
        />
      )}
    </div>
  );
};

export default KryptosInterface;
