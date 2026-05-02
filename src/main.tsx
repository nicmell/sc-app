import React from 'react';
import ReactDOM from 'react-dom/client';
import { installDebugLog } from './util/debugLog';

// Install the console → on-screen debug log mirror BEFORE any other
// module runs, so every log line from client/worker/transport code is
// captured from the very first call.
installDebugLog();

import { AppShell } from './AppShell';

// @sc-app/ui-foundation provides design tokens, base element
// styles, and semantic component classes. ./app.css adds the
// thin app-level layout chrome on top (dashboard-shell,
// chunk-size-picker). Per-panel CSS is imported by each panel.
import '@sc-app/ui-foundation';
import './app.css';

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <AppShell />
  </React.StrictMode>,
);
