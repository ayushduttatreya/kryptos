import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { QrReader } from 'react-qr-reader';
import { getIdentity, createContact } from '../../api/backend';

const PairingModal = ({ mode: initialMode, onClose, onContactAdded }) => {
  const [mode, setMode] = useState(initialMode || 'generate');
  const [identity, setIdentity] = useState(null);
  const [includeGithub, setIncludeGithub] = useState(false);
  const [includeSeed, setIncludeSeed] = useState(false);
  const [githubUser, setGithubUser] = useState('');
  const [seed, setSeed] = useState('');
  const [qrPayload, setQrPayload] = useState(null);
  const [scannedData, setScannedData] = useState(null);
  const [scanError, setScanError] = useState('');
  const [formData, setFormData] = useState({ name: '', publicKey: '', githubUser: '', seed: '' });
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');

  useEffect(() => {
    getIdentity().then(id => { if (id) setIdentity(id); });
  }, []);

  const handleGenerate = async () => {
    const id = identity || await getIdentity();
    if (!id) return;
    const fields = ['name', 'publicKey'];
    const payload = { v: 1, name: id.handle, publicKey: id.publicKey };
    if (includeGithub && githubUser) { payload.githubUser = githubUser; fields.push('githubUser'); }
    if (includeSeed && seed) { payload.seed = seed; fields.push('seed'); }
    payload.fields = fields;
    setQrPayload(JSON.stringify(payload));
  };

  const handleScan = (result) => {
    if (!result) return;
    try {
      const text = result.getText ? result.getText() : result;
      const parsed = JSON.parse(text);
      if (parsed.v !== 1 || !parsed.publicKey || !/^[0-9a-fA-F]{64}$/.test(parsed.publicKey)) {
        setScanError('Invalid QR: missing or malformed publicKey');
        return;
      }
      setScanError('');
      setScannedData(parsed);
      setFormData({
        name: parsed.name || '',
        publicKey: parsed.publicKey,
        githubUser: parsed.githubUser || '',
        seed: parsed.seed || '',
      });
    } catch {
      setScanError('Invalid QR: could not parse data');
    }
  };

  const handleSubmit = async () => {
    if (!formData.name || !formData.publicKey) {
      setSubmitError('Name and public key are required');
      return;
    }
    setSubmitting(true);
    setSubmitError('');
    const result = await createContact(formData);
    setSubmitting(false);
    if (result) {
      onContactAdded(result);
      onClose();
    } else {
      setSubmitError('Failed to add contact. They may already exist.');
    }
  };

  const modal = (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-bgOverlay">
      <div className="bg-bgSecondary border border-borderBase rounded-md w-[420px] max-h-[90vh] overflow-y-auto p-6 relative">
        <button
          aria-label="close"
          onClick={onClose}
          className="absolute top-4 right-4 text-textMuted hover:text-textPrimary transition-colors"
        >
          <X size={18} />
        </button>

        <h2 className="text-[1rem] font-semibold tracking-[0.06em] uppercase text-textMuted mb-5">Pair Node</h2>

        <div className="flex border border-borderBase rounded-sm mb-6 overflow-hidden">
          {['generate', 'scan'].map(tab => (
            <button
              key={tab}
              onClick={() => { setMode(tab); setQrPayload(null); setScannedData(null); setScanError(''); }}
              className={`flex-1 py-2 text-sm transition-colors ${mode === tab ? 'bg-bgElevated text-textPrimary' : 'text-textMuted hover:text-textSecondary'}`}
            >
              {tab === 'generate' ? 'Show my QR' : 'Scan contact QR'}
            </button>
          ))}
        </div>

        {mode === 'generate' && (
          <div className="space-y-4">
            <p className="text-sm text-textMuted">Choose what to include in your QR code. Name and public key are always included.</p>

            <label className="flex items-center space-x-2 cursor-pointer">
              <input
                type="checkbox"
                checked={includeGithub}
                onChange={e => setIncludeGithub(e.target.checked)}
                aria-label="include github username"
                className="accent-accent"
              />
              <span className="text-sm text-textSecondary">Include GitHub username</span>
            </label>
            {includeGithub && (
              <input
                type="text"
                value={githubUser}
                onChange={e => setGithubUser(e.target.value)}
                placeholder="GitHub username"
                className="w-full bg-bgTertiary border border-borderBase rounded-sm p-2 text-sm text-textPrimary placeholder-textMuted outline-none focus:border-borderFocus"
              />
            )}

            <label className="flex items-center space-x-2 cursor-pointer">
              <input
                type="checkbox"
                checked={includeSeed}
                onChange={e => setIncludeSeed(e.target.checked)}
                aria-label="include rendezvous seed"
                className="accent-accent"
              />
              <span className="text-sm text-textSecondary">Include rendezvous seed</span>
            </label>
            {includeSeed && (
              <input
                type="text"
                value={seed}
                onChange={e => setSeed(e.target.value)}
                placeholder="Shared rendezvous seed"
                className="w-full bg-bgTertiary border border-borderBase rounded-sm p-2 text-sm text-textPrimary placeholder-textMuted outline-none focus:border-borderFocus"
              />
            )}

            <button
              onClick={handleGenerate}
              className="w-full bg-accent text-textInverse py-2 rounded-sm text-sm font-medium hover:bg-accentHover transition-colors"
            >
              Generate
            </button>

            {qrPayload && (
              <div className="flex justify-center mt-4 p-4 bg-white rounded-md">
                <QRCodeSVG value={qrPayload} size={200} />
              </div>
            )}
          </div>
        )}

        {mode === 'scan' && (
          <div className="space-y-4">
            {!scannedData && (
              <>
                <QrReader
                  onResult={handleScan}
                  constraints={{ facingMode: 'user' }}
                  style={{ width: '100%' }}
                />
                {scanError && <p className="text-sm text-error">{scanError}</p>}
              </>
            )}

            {scannedData && (
              <div className="space-y-3">
                <p className="text-sm text-success">QR scanned successfully</p>
                <p className="text-xs text-textMuted">Review the fields below. Invalid or mismatched data will be rejected on submit.</p>

                {['name', 'publicKey', 'githubUser', 'seed'].map(field => (
                  <div key={field}>
                    <label className="text-xs text-textMuted capitalize mb-1 block">{field}</label>
                    <input
                      type="text"
                      value={formData[field]}
                      onChange={e => setFormData(p => ({ ...p, [field]: e.target.value }))}
                      placeholder={field}
                      className="w-full bg-bgTertiary border border-borderBase rounded-sm p-2 text-sm text-textPrimary placeholder-textMuted outline-none focus:border-borderFocus font-mono"
                    />
                  </div>
                ))}

                {submitError && <p className="text-sm text-error">{submitError}</p>}

                <button
                  onClick={handleSubmit}
                  disabled={submitting}
                  className="w-full bg-accent text-textInverse py-2 rounded-sm text-sm font-medium hover:bg-accentHover transition-colors disabled:opacity-50"
                >
                  {submitting ? 'Adding...' : 'Add contact'}
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );

  return createPortal(modal, document.body);
};

export default PairingModal;
