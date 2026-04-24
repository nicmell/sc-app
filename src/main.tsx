import React from 'react';
import ReactDOM from 'react-dom/client';
import { AppShell } from './scope/AppShell';
import './styles.scss';

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <AppShell />
  </React.StrictMode>,
);
