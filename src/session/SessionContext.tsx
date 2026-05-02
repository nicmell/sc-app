import { createContext, useContext, type ReactNode } from 'react';

/** Phase 29d: app-level connection status, exposed via React
 *  context so any component can read it without prop-drilling.
 *  Currently consumed by AppShell's header chrome and the
 *  panel disabled-state guards (each panel checks its own
 *  nullable prop, but anything that needs to discriminate
 *  between 'disconnected' and 'connecting' specifically can
 *  reach for `useSessionContext()`). */
export type ConnectionStatus = 'connected' | 'connecting' | 'disconnected';

export interface SessionContextValue {
  status: ConnectionStatus;
  /** Bridge-managed session id when connected; `null` while
   *  bootstrapping or disconnected. Useful for "Reset session"
   *  paths that want to call DELETE /api/session/:id directly. */
  sessionId: string | null;
}

const DEFAULT_VALUE: SessionContextValue = {
  status: 'disconnected',
  sessionId: null,
};

const SessionContext = createContext<SessionContextValue>(DEFAULT_VALUE);

export function SessionProvider({
  value,
  children,
}: {
  value: SessionContextValue;
  children: ReactNode;
}) {
  return (
    <SessionContext.Provider value={value}>
      {children}
    </SessionContext.Provider>
  );
}

/** Read the live connection state. Components that mount
 *  outside the AppShell (e.g. the demo page) get the default
 *  `disconnected` value, which is correct for those contexts.*/
export function useSessionContext(): SessionContextValue {
  return useContext(SessionContext);
}
