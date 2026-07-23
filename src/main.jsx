import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import ErrorBoundary from './components/ErrorBoundary.jsx';
import { registerPwa } from '@core/pwa/registerPwa';
import { firebaseReady, firebaseServicesEnabled, firebaseDisabledReason } from '@/core/config/firebase';
import './index.css';

function BootFallback() {
  return (
    <div className="fixed inset-0 flex items-center justify-center bg-paper">
      <div className="flex flex-col items-center gap-3 text-center">
        <div className="h-10 w-10 animate-spin rounded-full border-2 border-ink border-t-transparent" />
        <p className="text-sm text-gray-500">Inicializando…</p>
      </div>
    </div>
  );
}

function FirebaseUnavailable({ reason }) {
  return (
    <div className="fixed inset-0 flex items-center justify-center bg-paper p-6">
      <div className="max-w-md rounded-3xl border border-red-200 bg-red-50 p-6 text-center">
        <h1 className="font-display text-lg font-bold text-red-700">Firebase indisponível</h1>
        <p className="mt-2 text-sm text-red-600">
          {reason || 'Não foi possível resolver a configuração do Firebase (env vars nem /__/firebase/init.json).'}
        </p>
        <p className="mt-2 text-xs text-red-500">
          O deploy provavelmente falhou no passo de baking das env vars <code>VITE_FIREBASE_*</code>.
        </p>
      </div>
    </div>
  );
}

// Espera Firebase inicializar ANTES de renderizar. Sem isso, o App.jsx
// tenta usar auth/db/etc que são null até o init.json fetch completar
// (quando as env vars não estão baked no build).
firebaseReady.then(() => {
  if (!firebaseServicesEnabled) {
    ReactDOM.createRoot(document.getElementById('root')).render(
      <FirebaseUnavailable reason={firebaseDisabledReason} />,
    );
    return;
  }
  ReactDOM.createRoot(document.getElementById('root')).render(
    <React.StrictMode>
      <ErrorBoundary>
        <App />
      </ErrorBoundary>
    </React.StrictMode>,
  );
});

// Fallback absoluto: se o firebaseReady nunca resolver (bug de rede, init
// pendurado), mostra o spinner depois de 8s em vez de tela em branco.
setTimeout(() => {
  const root = document.getElementById('root');
  if (root && !root.hasChildNodes()) {
    ReactDOM.createRoot(root).render(<BootFallback />);
  }
}, 500);

// Registro do PWA (no-op quando VITE_PWA_ENABLED !== 'true').
registerPwa();
