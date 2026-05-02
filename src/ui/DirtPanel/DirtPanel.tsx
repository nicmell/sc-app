import {
  useCallback,
  useEffect,
  useState,
  useSyncExternalStore,
} from 'react';
import type { DirtClient } from '@/dirt/DirtClient';
import { parseDirtRepl } from '@/dirt/replParser';
import type { DirtEventLog, DirtStatus } from '@/dirt/types';
import './DirtPanel.css';

const REPL_PLACEHOLDER = 'bd cutoff:800 amp:0.5';

const STATUS_LABELS: Record<DirtStatus, string> = {
  probing: 'probing…',
  alive: 'alive',
  unreachable: 'unreachable',
};

interface DirtPanelProps {
  client: DirtClient;
}

/**
 * SuperDirt control panel.
 *
 * Phase 26 reshape: the connection UI is gone. SuperDirt
 * reachability is decided by the bridge's routing config + whether
 * sclang+SuperDirt is running on the configured port; the panel
 * surfaces the result of the hello probe (Q2 = once on mount) as a
 * status pill and renders the REPL + event log unconditionally.
 *
 * REPL accepts Tidal-ish shorthand (`bd cutoff:800 amp:0.5`),
 * routes it through `parseDirtRepl`, and fires `client.play(event)`.
 * Sends are not gated on status — if the route's misconfigured or
 * SuperDirt's down, the user sees their event in the log but no
 * reply lands.
 */
export function DirtPanel({ client }: DirtPanelProps) {
  const status = useSyncExternalStore(
    (cb) => client.status.subscribe(cb),
    () => client.status.get(),
  );
  const recentEvents = useSyncExternalStore(
    (cb) => client.recentEvents.subscribe(cb),
    () => client.recentEvents.get(),
  );

  return (
    <section className="panel dirt-panel">
      <header>
        <span>Dirt</span>
        <span
          className="status-pill"
          data-variant={
            status === 'alive'
              ? 'ok'
              : status === 'unreachable'
                ? 'error'
                : 'info'
          }
        >
          <span
            className={`dot ${status === 'probing' ? 'pulse' : ''}`}
            aria-hidden="true"
          >
            ●
          </span>
          {STATUS_LABELS[status]}
        </span>
      </header>
      <DirtPanelBody client={client} events={recentEvents} />
    </section>
  );
}

function DirtPanelBody({
  client,
  events,
}: {
  client: DirtClient;
  events: ReadonlyArray<DirtEventLog>;
}) {
  const [repl, setRepl] = useState('');
  const [replError, setReplError] = useState<string | null>(null);
  const now = useNow(1000);

  const onSend = useCallback(() => {
    setReplError(null);
    const trimmed = repl.trim();
    if (trimmed.length === 0) return;
    let event;
    try {
      event = parseDirtRepl(trimmed);
    } catch (err) {
      setReplError(err instanceof Error ? err.message : String(err));
      return;
    }
    client.play(event);
    setRepl('');
  }, [client, repl]);

  const onReplChange = useCallback(
    (value: string) => {
      setRepl(value);
      if (replError !== null) setReplError(null);
    },
    [replError],
  );

  const outgoing = events.filter((e) => e.direction === 'out');
  const incoming = events.filter((e) => e.direction === 'in');

  return (
    <>
      <div className="cluster repl-row">
        <span className="repl-prompt" aria-hidden="true">
          &gt;
        </span>
        <input
          type="text"
          className="repl-input"
          value={repl}
          placeholder={REPL_PLACEHOLDER}
          onChange={(e) => onReplChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              onSend();
            }
          }}
          spellCheck={false}
          autoCapitalize="off"
          autoCorrect="off"
        />
        <button type="button" onClick={onSend} disabled={repl.trim() === ''}>
          Send
        </button>
      </div>
      {replError !== null && <p className="error">{replError}</p>}

      {outgoing.length === 0 ? (
        <p className="empty">no events yet — try a sample name above</p>
      ) : (
        <ul className="recent">
          {outgoing.map((evt, i) => (
            <li key={`${evt.receivedAt}-${i}`}>
              <span className="recent-label">{evt.label}</span>
              <span className="recent-age">
                {formatRelativeTime(now - evt.receivedAt)}
              </span>
            </li>
          ))}
        </ul>
      )}

      {incoming.length > 0 && (
        <details className="replies">
          <summary>Replies ({incoming.length})</summary>
          <ul>
            {incoming.map((evt, i) => (
              <li key={`${evt.receivedAt}-${i}`}>
                <span className="reply-addr">{evt.address}</span>
                {evt.args.length > 0 && (
                  <span className="reply-args">
                    {evt.args.map((a) => formatArg(a)).join(' ')}
                  </span>
                )}
                <span className="reply-age">
                  {formatRelativeTime(now - evt.receivedAt)}
                </span>
              </li>
            ))}
          </ul>
        </details>
      )}
    </>
  );
}

/** Re-renders every `intervalMs` so relative-time displays stay
 *  fresh. */
function useNow(intervalMs: number): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), intervalMs);
    return () => window.clearInterval(id);
  }, [intervalMs]);
  return now;
}

function formatRelativeTime(ms: number): string {
  if (ms < 1000) return 'just now';
  const secs = Math.floor(ms / 1000);
  if (secs < 60) return `${secs}s ago`;
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  return `${hrs}h ago`;
}

function formatArg(arg: unknown): string {
  if (typeof arg === 'string') return JSON.stringify(arg);
  if (typeof arg === 'number') return String(arg);
  return String(arg);
}
