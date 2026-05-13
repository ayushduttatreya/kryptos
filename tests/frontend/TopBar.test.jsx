import { describe, test, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import TopBar from '../../frontend/src/components/kryptos/TopBar';

vi.mock('../../frontend/src/store/useAppStore', () => ({
  useAppStore: vi.fn(() => ({ setMode: vi.fn(), setGlitching: vi.fn() })),
}));

vi.mock('../../frontend/src/api/backend', () => ({
  getIdentity: vi.fn().mockResolvedValue({
    handle: 'ZeroDay',
    fingerprint: 'deadbeef',
    publicKey: 'd'.repeat(64),
  }),
}));

test('displays real handle and fingerprint from API', async () => {
  render(<TopBar />);
  await waitFor(() => {
    expect(screen.getByText('ZeroDay')).toBeInTheDocument();
    expect(screen.getByText('deadbeef')).toBeInTheDocument();
  });
});

test('shows placeholder while loading', () => {
  render(<TopBar />);
  expect(screen.getAllByText('···').length).toBeGreaterThan(0);
});
