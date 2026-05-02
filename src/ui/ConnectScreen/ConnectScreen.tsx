import { useEffect, useState } from 'react';
import './ConnectScreen.css';

const ADDRESS_REGEXP = /^([^\s:]+):(\d{1,5})$/;

export interface ConnectScreenProps {
  defaultAddress?: string;
  /** Called when the user submits a valid address. Resolves on success;
   *  rejects (or AppShell supplies `error`) on failure. */
  onConnect: (address: string) => Promise<void>;
  /** Externally-surfaced error (e.g. from a prior connect attempt). */
  error?: string | null;
}

export function ConnectScreen({ defaultAddress, onConnect, error }: ConnectScreenProps) {
  const [address, setAddress] = useState(defaultAddress ?? '127.0.0.1:57110');
  const [connecting, setConnecting] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  const valid = ADDRESS_REGEXP.test(address);

  // When the parent surfaces a new error, stop the "Connecting…" spinner.
  useEffect(() => {
    if (error) setConnecting(false);
  }, [error]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!valid || connecting) return;
    setConnecting(true);
    setLocalError(null);
    try {
      await onConnect(address);
    } catch (err) {
      setLocalError(err instanceof Error ? err.message : String(err));
      setConnecting(false);
    }
  };

  const shownError = error ?? localError;

  return (
    <div className="connect-screen">
      <h1>SC-App</h1>
      <form onSubmit={handleSubmit}>
        <label htmlFor="sc-address">scsynth address</label>
        <input
          id="sc-address"
          value={address}
          onChange={(e) => setAddress(e.currentTarget.value)}
          placeholder="127.0.0.1:57110"
          disabled={connecting}
          autoComplete="off"
          spellCheck={false}
        />
        <button type="submit" disabled={!valid || connecting}>
          {connecting ? 'Connecting…' : 'Connect'}
        </button>
        {shownError && <p className="error">{shownError}</p>}
      </form>
    </div>
  );
}
