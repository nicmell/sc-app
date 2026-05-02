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

/** Mirror of the Rust [`server::session::SessionInfo`] JSON
 *  shape (camelCase via `#[serde(rename_all)]`). */
export interface SessionInfo {
  sessionId: string;
  clientId: number;
  scsynth: string;
  sampleRate: number;
  parentGroupId: number;
}

/** Read-or-create. If `sessionStorage` has an id, try to read it
 *  back from the bridge; on 404 (expired) or network error,
 *  fall through to `POST /api/session`. The new id is persisted
 *  before returning so a reload immediately after this call
 *  finds the same session. Throws on POST failure — callers
 *  render the message in the recovery screen. */
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
