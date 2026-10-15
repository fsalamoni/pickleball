import { auth } from '@/core/config/firebase';
import { relatorioDeErro } from '@/core/domain/errorReport';

/**
 * Manda o erro para `/api/erro` → Google Cloud Error Reporting (ver
 * `functions/clientErrors.js`). Só no site publicado: em desenvolvimento e
 * nos testes com emuladores o erro fica no console.
 */
const ATIVO = import.meta.env.PROD && import.meta.env.VITE_FIREBASE_USE_EMULATORS !== 'true';
const VERSAO = import.meta.env.VITE_RELEASE || 'dev';
const MAX_POR_PAGINA = 10;
const enviados = new Set();

export function reportarErro(erro, { fonte = 'app', fatal = false } = {}) {
  if (!ATIVO || typeof window === 'undefined' || enviados.size >= MAX_POR_PAGINA) return;
  const corpo = relatorioDeErro(erro, {
    fonte, fatal, rota: window.location.pathname, versao: VERSAO, uid: auth?.currentUser?.uid,
  });
  if (!corpo) return;
  // O mesmo erro repetido (um laço de renderização) conta uma vez por página.
  const chave = `${corpo.fonte}|${corpo.mensagem}`;
  if (enviados.has(chave)) return;
  enviados.add(chave);
  try {
    const json = JSON.stringify(corpo);
    if (!navigator.sendBeacon?.('/api/erro', json)) {
      fetch('/api/erro', { method: 'POST', body: json, keepalive: true }).catch(() => {});
    }
  } catch { /* relatório de erro nunca derruba nada */ }
}

/** Erros que ninguém capturou: exceção solta e promessa rejeitada sem `catch`. */
export function instalarRelatorioDeErros() {
  if (!ATIVO || typeof window === 'undefined') return;
  window.addEventListener('error', (e) => reportarErro(e.error || e.message, { fonte: 'window.onerror' }));
  window.addEventListener('unhandledrejection', (e) => reportarErro(e.reason, { fonte: 'promessa' }));
}
