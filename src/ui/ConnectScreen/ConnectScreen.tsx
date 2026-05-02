import './ConnectScreen.css';

/** Phase 29c — recovery / loading surface. The pre-29 address
 *  input is gone (the bridge owns the scsynth address via
 *  `config.json`); this screen just shows status during boot
 *  and surfaces session-creation errors with a Retry button.
 *
 *  Three modes, picked by `mode`:
 *  - `loading` — bootstrap or handleConnect in flight. No
 *    button; just a spinner-flavoured message. Auto-transitions
 *    when the parent finishes its bootstrap.
 *  - `disconnected` — user clicked Disconnect. "Reconnect"
 *    button triggers a fresh bootstrap.
 *  - `error` — bootstrap failed (scsynth down, network, etc.).
 *    Shows the message inline + Retry button.
 */
export interface ConnectScreenProps {
  mode: 'loading' | 'disconnected' | 'error';
  /** Error message — shown only when `mode === 'error'`. */
  error?: string | null;
  /** Triggers a fresh bootstrap. Wired only when `mode` allows
   *  retry (`disconnected` or `error`). */
  onRetry?: () => void;
}

export function ConnectScreen({ mode, error, onRetry }: ConnectScreenProps) {
  return (
    <div className="connect-screen">
      <h1>SC-App</h1>
      <div className="connect-screen-body">
        {mode === 'loading' && (
          <p className="connect-screen-status">Connecting…</p>
        )}
        {mode === 'disconnected' && (
          <>
            <p className="connect-screen-status">Disconnected.</p>
            <button type="button" onClick={onRetry}>
              Reconnect
            </button>
          </>
        )}
        {mode === 'error' && (
          <>
            <p className="connect-screen-status">
              Couldn't connect to scsynth.
            </p>
            {error && <p className="error">{error}</p>}
            <button type="button" onClick={onRetry}>
              Retry
            </button>
          </>
        )}
      </div>
    </div>
  );
}
