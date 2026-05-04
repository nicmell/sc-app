/**
 * Phase 29c — frontend session bootstrap.
 *
 * The bridge (Phase 29a/b) owns the scsynth handshake. The
 * frontend's first action on boot is to either reuse an existing
 * session ID from `sessionStorage` (if alive on the bridge) or
 * mint a fresh one via `POST /api/session`. The response carries
 * everything the dashboard needs (`clientId`, `scsynth`,
 * `sampleRate`, `parentGroupId`); the WS opens with
 * `?session=<id>` and inherits the bridge's pre-bound UDP
 * sockets + `/notify` subscription.
 *
 * Storage key: `sc.session` in `sessionStorage` — per-tab,
 * survives reload, dies on tab close. Cookies are wrong
 * (shared across tabs of the same browser profile, which would
 * collapse two tabs onto the same scsynth clientId and step on
 * each other's IdAllocator ranges).
 */

const STORAGE_KEY = 'sc.session';

/** A single dirt sample bank entry (name + count of samples in
 *  the bank). Surfaced via SessionInfo (Phase 39b: replaces the
 *  per-session `/dirt/listSamples` round-trip). */
export interface DirtSample {
  name: string;
  count: number;
}

/** Cached clock metadata from sclang's bootstrap reply. Phase 39b
 *  replaces the per-session `/clock/hello → /clock/info` round-trip
 *  with this cached snapshot. `null` if sclang isn't reachable. */
export interface SessionClockInfo {
  clockBus: number;
  clockNodeId: number;
  tickRate: number;
  chunkSize: number;
  sampleRate: number;
}

/** Mirror of the Rust [`server::session::SessionInfo`] JSON
 *  shape (camelCase via `#[serde(rename_all)]`).
 *
 *  Phase 39a: `clientId` was renamed to `scsynthClientId` (the
 *  bridge-level scsynth `/notify` clientId, shared across all
 *  sessions). New `subClientId` partitions the bridge's node-ID
 *  space across concurrent sessions. IdAllocator base is
 *  `scsynthClientId * 1_000_000 + subClientId * 100_000 + 1000`.
 *
 *  Phase 39b: `clock`, `numScopeBuffers`, `dirtSamples` carry
 *  cached sclang metadata so the frontend's
 *  ClockController + DirtClient don't need per-session OSC
 *  round-trips. `clock` is `null` if sclang wasn't reachable
 *  at bridge boot. */
export interface SessionInfo {
  sessionId: string;
  scsynthClientId: number;
  subClientId: number;
  scsynth: string;
  sampleRate: number;
  parentGroupId: number;
  scopeMode?: 'shm' | 'osc';
  clock: SessionClockInfo | null;
  numScopeBuffers: number | null;
  dirtSamples: DirtSample[];
}

/** Read-or-create. If `sessionStorage` has an id, try to read it
 *  back from the bridge; on 404 (expired) or network error,
 *  fall through to `POST /api/session`. The new id is persisted
 *  before returning so a reload immediately after this call
 *  finds the same session. Throws on POST failure — callers
 *  render the message in the recovery screen.
 *
 *  Phase 39 hotfix: if the bridge's session was created when
 *  sclang wasn't reachable, `clock` will be null and the
 *  dashboard can't bring up. The caller (AppShell) is in charge
 *  of polling — `awaitSclangReady` below handles that. */
export async function bootstrapSession(): Promise<SessionInfo> {
  const stored = readStoredSessionId();
  if (stored) {
    try {
      const info = await fetchSession(stored);
      if (info) return info;
      // 404 — fall through to POST.
    } catch (err) {
      // Network error — fall through to POST. We'll surface a
      // proper error if POST also fails.
      console.warn('[sc:session] GET /api/session failed; falling back to POST:', err);
    }
  }
  const fresh = await createSession();
  storeSessionId(fresh.sessionId);
  return fresh;
}

/** Phase 39 hotfix: poll `GET /api/session/:id` until the bridge's
 *  cached sclang metadata is populated (`info.clock !== null`).
 *  Each GET on the bridge re-attempts the lazy sclang bootstrap,
 *  so this poll also nudges the bridge to keep trying sclang.
 *
 *  Use case: user starts the bridge before starting sclang. First
 *  POST creates a session with `clock: null`; this loop resolves
 *  once sclang comes up. Caller renders a "waiting for sclang"
 *  banner while the promise is pending.
 *
 *  Resolves with the populated SessionInfo on success; rejects on
 *  timeout. */
export async function awaitSclangReady(
  sessionId: string,
  opts: { timeoutMs?: number; pollMs?: number } = {},
): Promise<SessionInfo> {
  const timeoutMs = opts.timeoutMs ?? 60_000;
  const pollMs = opts.pollMs ?? 1500;
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const info = await fetchSession(sessionId);
      if (info && info.clock !== null) {
        return info;
      }
    } catch (err) {
      console.warn('[sc:session] awaitSclangReady poll error:', err);
    }
    await new Promise((r) => setTimeout(r, pollMs));
  }
  throw new Error(
    `sclang not reachable after ${timeoutMs / 1000}s. ` +
      `Start sclang+SuperDirt and refresh; check the bridge log for bootstrap errors.`,
  );
}

/** GET /api/session/:id. Returns null on 404; throws on other
 *  non-OK responses or network failures. */
async function fetchSession(sessionId: string): Promise<SessionInfo | null> {
  const response = await fetch(`/api/session/${encodeURIComponent(sessionId)}`);
  if (response.status === 404) {
    return null;
  }
  if (!response.ok) {
    const msg = await readErrorMessage(response);
    throw new Error(`GET /api/session/${sessionId} failed: ${msg}`);
  }
  return (await response.json()) as SessionInfo;
}

/** POST /api/session — mint a new session. Throws on non-OK
 *  with the bridge's `{ error }` message verbatim so the
 *  recovery surface can render it. */
async function createSession(): Promise<SessionInfo> {
  const response = await fetch('/api/session', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: '{}',
  });
  if (!response.ok) {
    const msg = await readErrorMessage(response);
    throw new Error(msg);
  }
  return (await response.json()) as SessionInfo;
}

/** DELETE /api/session/:id. Best-effort — we don't block the
 *  user on its result. The bridge runs the cleanup bundle and
 *  drops the session; failure here just means the session
 *  lingers until TTL. */
export async function deleteSession(sessionId: string): Promise<void> {
  try {
    await fetch(`/api/session/${encodeURIComponent(sessionId)}`, {
      method: 'DELETE',
    });
  } catch (err) {
    console.warn('[sc:session] DELETE /api/session failed:', err);
  }
}

/** Drop the stored id without contacting the bridge. Used when
 *  we want a fresh session next bootstrap (e.g. after Reset
 *  Session UI). */
export function clearStoredSession(): void {
  try {
    window.sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    /* sessionStorage can throw in private mode; not load-bearing */
  }
}

function readStoredSessionId(): string | null {
  try {
    return window.sessionStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

function storeSessionId(id: string): void {
  try {
    window.sessionStorage.setItem(STORAGE_KEY, id);
  } catch {
    /* sessionStorage can throw in private mode / sandbox; the
       app still works in-memory, just no reload continuity */
  }
}

/** Pull the bridge's structured error body (`{ error: "..." }`)
 *  out of a non-OK response. Falls back to the HTTP status
 *  line if the body isn't JSON or doesn't have an `error`
 *  field. */
async function readErrorMessage(response: Response): Promise<string> {
  try {
    const body = (await response.json()) as { error?: unknown };
    if (body && typeof body.error === 'string') return body.error;
  } catch {
    /* non-JSON body, fall through */
  }
  return `${response.status} ${response.statusText}`;
}
