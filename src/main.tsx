import React from 'react';
import ReactDOM from 'react-dom/client';
import { installDebugLog } from './util/debugLog';

// Install the console → on-screen debug log mirror BEFORE any other
// module runs, so every log line from client/worker/transport code is
// captured from the very first call.
installDebugLog();

import { AppShell } from './AppShell';

// @sc-app/ui-foundation is loaded BEFORE styles.scss so the
// existing dark-theme rules in styles.scss can override / extend
// the foundation defaults during the gradual migration. By the
// end of Phase 28 styles.scss is gone and this is the only entry.
import '@sc-app/ui-foundation';
import './styles.scss';

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <AppShell />
  </React.StrictMode>,
);
