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

// Falha de inicialização (storage bloqueado, WebView antigo, rede): em vez de
// ficar no spinner para sempre, mostra a saída — recarregar limpando o cache.
function BootFailed() {
  const recarregar = async () => {
    try {
      const regs = await navigator.serviceWorker?.getRegistrations?.();
      await Promise.all((regs || []).map((r) => r.unregister()));
      const keys = await window.caches?.keys?.();
      await Promise.all((keys || []).map((k) => window.caches.delete(k)));
    } catch { /* segue para o reload mesmo assim */ }
    window.location.reload();
  };
  return (
    <div className="fixed inset-0 flex items-center justify-center bg-paper p-6">
      <div className="max-w-md rounded-3xl border border-gray-200 bg-white p-6 text-center">
        <h1 className="font-display text-lg font-bold text-ink">Não conseguimos abrir o PickleRush</h1>
        <p className="mt-2 text-sm text-gray-500">
          Verifique a conexão e tente de novo. Se continuar, abra no Chrome ou Safari
          (e não pelo navegador de dentro de outro aplicativo) e atualize o navegador.
        </p>
        <button
          type="button"
          onClick={recarregar}
          className="mt-4 rounded-full bg-ink px-5 py-2 text-sm font-semibold text-white"
        >
          Tentar de novo
        </button>
      </div>
    </div>
  );
}

function renderBootFailed() {
  const root = document.getElementById('root');
  if (root) ReactDOM.createRoot(root).render(<BootFailed />);
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
}).catch(renderBootFailed);

// Fallback absoluto: se o firebaseReady demorar, mostra o spinner (0,5 s) e,
// passados 15 s sem nada na tela, a saída de recarregar em vez de girar para sempre.
setTimeout(() => {
  const root = document.getElementById('root');
  if (root && !root.hasChildNodes()) {
    ReactDOM.createRoot(root).render(<BootFallback />);
  }
}, 500);
setTimeout(() => {
  const root = document.getElementById('root');
  if (root && root.querySelector('.animate-spin') && root.textContent.includes('Inicializando')) {
    root.replaceChildren();
    renderBootFailed();
  }
}, 15000);

// Registro do PWA (no-op quando VITE_PWA_ENABLED !== 'true').
registerPwa();
