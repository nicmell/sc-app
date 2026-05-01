import React from 'react';
import ReactDOM from 'react-dom/client';
import { installDebugLog } from './util/debugLog';

// Install the console → on-screen debug log mirror BEFORE any other
// module runs, so every log line from client/worker/transport code is
// captured from the very first call.
installDebugLog();

import { AppShell } from './AppShell';
import './styles.scss';

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <AppShell />
  </React.StrictMode>,
);
