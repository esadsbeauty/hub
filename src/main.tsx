import React from 'react';
import ReactDOM from 'react-dom/client';
import { App } from './app/App';
import { AuthProvider } from './providers/auth-provider';
import { AppQueryProvider } from './providers/query-provider';
import { AppStateProvider } from './shared/state/app-state';
import { ToastProvider } from './shared/components/feedback/toast';
import './styles/globals.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <AppQueryProvider>
      <AuthProvider>
        <AppStateProvider>
          <ToastProvider>
            <App />
          </ToastProvider>
        </AppStateProvider>
      </AuthProvider>
    </AppQueryProvider>
  </React.StrictMode>,
);
