import { describe, test, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import RightPanel from '../../frontend/src/components/kryptos/RightPanel';

vi.mock('../../frontend/src/api/backend', () => ({
  getStats: vi.fn().mockResolvedValue({
    sent: 17,
    received: 12,
    channelUsage: { imgur: 0.7, gist: 0.3 },
    lastRatchet: Date.now() - 120000,
  }),
}));

vi.mock('../../frontend/src/components/shared/ThreatModelBadge', () => ({ default: () => <div /> }));

const contact = { id: 'c-1', name: 'Bob', fingerprint: 'deadbeef', lastSeen: Date.now() - 60000 };

test('shows dash when no contact selected', () => {
  render(<RightPanel selectedContact={null} onOpenPairing={vi.fn()} />);
  expect(screen.getAllByText('—').length).toBeGreaterThan(0);
});

test('shows contact name and fingerprint', () => {
  render(<RightPanel selectedContact={contact} onOpenPairing={vi.fn()} />);
  expect(screen.getByText('Bob')).toBeInTheDocument();
  expect(screen.getByText('deadbeef')).toBeInTheDocument();
});

test('shows real sent/received counts from stats API', async () => {
  render(<RightPanel selectedContact={contact} onOpenPairing={vi.fn()} />);
  await waitFor(() => {
    expect(screen.getByText('17')).toBeInTheDocument();
    expect(screen.getByText('12')).toBeInTheDocument();
  });
});

test('shows relative time for ratchet timestamp', async () => {
  render(<RightPanel selectedContact={contact} onOpenPairing={vi.fn()} />);
  await waitFor(() => {
    expect(screen.getByText(/2m ago/)).toBeInTheDocument();
  });
});

test('shows "never" when lastRatchet is null', async () => {
  const { getStats } = await import('../../frontend/src/api/backend');
  getStats.mockResolvedValueOnce({ sent: 0, received: 0, channelUsage: { imgur: 0.5, gist: 0.5 }, lastRatchet: null });
  render(<RightPanel selectedContact={contact} onOpenPairing={vi.fn()} />);
  await waitFor(() => expect(screen.getByText('never')).toBeInTheDocument());
});
