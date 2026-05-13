import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import LeftPanel from '../../frontend/src/components/kryptos/LeftPanel';

vi.mock('../../frontend/src/api/backend', () => ({
  getContacts: vi.fn().mockResolvedValue([]),
  getChannelsStatus: vi.fn().mockResolvedValue({ imgur: { status: 'reachable' }, gist: { status: 'reachable' } }),
  getIdentity: vi.fn().mockResolvedValue({ handle: 'Specter', fingerprint: 'cafe1234', publicKey: 'c'.repeat(64) }),
}));

test('shows real fingerprint from identity API', async () => {
  render(<LeftPanel selectedContact={null} onSelectContact={vi.fn()} onOpenPairing={vi.fn()} contactsVersion={0} />);
  await screen.findByText('cafe1234');
});

test('shows truncated public key from identity API', async () => {
  render(<LeftPanel selectedContact={null} onSelectContact={vi.fn()} onOpenPairing={vi.fn()} contactsVersion={0} />);
  await screen.findByText(/cccccccccc\.\.\.cccccccccc/);
});

test('rendezvous window label shows correct hour range', () => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-05-13T14:42:15Z'));
  render(<LeftPanel selectedContact={null} onSelectContact={vi.fn()} onOpenPairing={vi.fn()} contactsVersion={0} />);
  expect(screen.getByText('14:00 – 15:00')).toBeInTheDocument();
  vi.useRealTimers();
});

test('rendezvous countdown shows MM:SS format', () => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-05-13T14:42:15Z'));
  render(<LeftPanel selectedContact={null} onSelectContact={vi.fn()} onOpenPairing={vi.fn()} contactsVersion={0} />);
  // 3600 - (42*60 + 15) = 1065s → 17:45
  expect(screen.getByText('17:45')).toBeInTheDocument();
  vi.useRealTimers();
});
