import React from 'react';
import ReactDOM from 'react-dom/client';
import { installDebugLog } from './util/debugLog';
import { installLogShipper } from './util/logShipper';

// Install the console → on-screen debug log mirror BEFORE any other
// module runs, so every log line from client/worker/transport code is
// captured from the very first call.
installDebugLog();
// Phase 23 — also start shipping log entries to the bridge's
// /api/logs endpoint for daily-rotated file output. No-op until the
// shipper is installed; needs to come AFTER installDebugLog since
// the shipper hooks into debugLog's push channel.
installLogShipper();

import { AppShell } from './AppShell';
import './styles.scss';

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <AppShell />
  </React.StrictMode>,
);
