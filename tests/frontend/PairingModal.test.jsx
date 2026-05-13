import { describe, test, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import PairingModal from '../../frontend/src/components/kryptos/PairingModal';

vi.mock('../../frontend/src/api/backend', () => ({
  getIdentity: vi.fn().mockResolvedValue({
    publicKey: 'a'.repeat(64),
    handle: 'Alice',
    fingerprint: 'a'.repeat(8),
  }),
  createContact: vi.fn().mockResolvedValue({
    id: 'contact-1',
    name: 'Bob',
    publicKey: 'b'.repeat(64),
    fingerprint: 'b'.repeat(8),
  }),
}));

vi.mock('qrcode.react', () => ({
  QRCodeSVG: ({ value }) => <div data-testid="qr-code" data-value={value} />,
}));

vi.mock('react-qr-reader', () => ({
  QrReader: ({ onResult }) => (
    <button
      data-testid="mock-scanner"
      onClick={() => onResult({ getText: () => JSON.stringify({
        v: 1,
        name: 'Bob',
        publicKey: 'b'.repeat(64),
        fields: ['name', 'publicKey'],
      }) }, null)}
    >
      Simulate Scan
    </button>
  ),
}));

describe('PairingModal — generate tab', () => {
  test('renders in generate mode and shows QR when Generate clicked', async () => {
    render(<PairingModal mode="generate" onClose={vi.fn()} onContactAdded={vi.fn()} />);
    const btn = screen.getByRole('button', { name: /generate/i });
    fireEvent.click(btn);
    await waitFor(() => expect(screen.getByTestId('qr-code')).toBeInTheDocument());
  });

  test('QR payload includes only checked fields', async () => {
    render(<PairingModal mode="generate" onClose={vi.fn()} onContactAdded={vi.fn()} />);
    const githubCheckbox = screen.getByLabelText(/github/i);
    fireEvent.click(githubCheckbox);
    const githubInput = screen.getByPlaceholderText(/github username/i);
    fireEvent.change(githubInput, { target: { value: 'alice' } });
    fireEvent.click(screen.getByRole('button', { name: /generate/i }));
    await waitFor(() => {
      const qr = screen.getByTestId('qr-code');
      const payload = JSON.parse(qr.getAttribute('data-value'));
      expect(payload.githubUser).toBe('alice');
      expect(payload.fields).toContain('githubUser');
    });
  });

  test('closes when ✕ is clicked', () => {
    const onClose = vi.fn();
    render(<PairingModal mode="generate" onClose={onClose} onContactAdded={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: /close/i }));
    expect(onClose).toHaveBeenCalled();
  });
});

describe('PairingModal — scan tab', () => {
  test('switches to scan tab and shows camera', () => {
    render(<PairingModal mode="scan" onClose={vi.fn()} onContactAdded={vi.fn()} />);
    expect(screen.getByTestId('mock-scanner')).toBeInTheDocument();
  });

  test('parses valid QR and pre-fills form', async () => {
    render(<PairingModal mode="scan" onClose={vi.fn()} onContactAdded={vi.fn()} />);
    fireEvent.click(screen.getByTestId('mock-scanner'));
    await waitFor(() => {
      expect(screen.getByDisplayValue('Bob')).toBeInTheDocument();
    });
  });

  test('shows validation error when submitting without required fields', async () => {
    render(<PairingModal mode="scan" onClose={vi.fn()} onContactAdded={vi.fn()} />);
    // Trigger scan to show the form (mock sends valid QR with name 'Bob')
    fireEvent.click(screen.getByTestId('mock-scanner'));
    await waitFor(() => screen.getByDisplayValue('Bob'));
    // Clear the name field so it fails the required-field check
    const nameInput = screen.getByDisplayValue('Bob');
    fireEvent.change(nameInput, { target: { value: '' } });
    // Submit without a name — component sets submitError 'Name and public key are required'
    fireEvent.click(screen.getByRole('button', { name: /add contact/i }));
    await waitFor(() => {
      expect(screen.getByText(/required/i)).toBeInTheDocument();
    });
  });

  test('calls createContact and onContactAdded on submit', async () => {
    const onContactAdded = vi.fn();
    render(<PairingModal mode="scan" onClose={vi.fn()} onContactAdded={onContactAdded} />);
    fireEvent.click(screen.getByTestId('mock-scanner'));
    await waitFor(() => screen.getByDisplayValue('Bob'));
    fireEvent.click(screen.getByRole('button', { name: /add contact/i }));
    await waitFor(() => expect(onContactAdded).toHaveBeenCalled());
  });
});
