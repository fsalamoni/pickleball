/**
 * Onde mora a ESCOLHA da barra lateral: no navegador, por usuário.
 *
 * - Chave: `v2:view:<uid>:menu:lateral` (via `viewPreference`, que nunca lança).
 * - Valor: `{"v":1,"preset":"arena","items":[…]}`. Sem a chave, vale o padrão
 *   do papel; "Restaurar o padrão" APAGA a escolha.
 *
 * Mesmo desenho do início sob medida (`homeCardsPreference`): um armazém com
 * assinantes, para a barra e o cartão de Configurações mudarem juntos.
 */
import { readViewPreference, viewPreferenceKey, writeViewPreference } from '@/core/lib/viewPreference';
import { normalizeSidebarItems } from '@/core/domain/sidebarNav';

/** Id da preferência. ⚠️ Contrato: mudar apaga a escolha de todo mundo. */
export const SIDEBAR_PREF_ID = 'menu:lateral';

const VERSAO = 1;
const ouvintes = new Set();
const memoria = new Map();

/** Texto salvo → `{ preset, items }`, ou `null` (nunca escolheu / ilegível). */
export function parseSidebar(raw) {
  if (!raw) return null;
  try {
    const obj = JSON.parse(raw);
    if (!obj || !Array.isArray(obj.items)) return null;
    return { preset: typeof obj.preset === 'string' ? obj.preset : null, items: normalizeSidebarItems(obj.items) };
  } catch {
    return null;
  }
}

/** Retrato estável: `{ salvo }` — mesmo objeto enquanto o texto guardado não mudar. */
export function sidebarSnapshot(uid) {
  const chave = uid || '';
  const raw = readViewPreference(uid, SIDEBAR_PREF_ID);
  const guardado = memoria.get(chave);
  if (guardado && guardado.raw === raw) return guardado.valor;
  const valor = Object.freeze({ salvo: parseSidebar(raw) });
  memoria.set(chave, { raw, valor });
  return valor;
}

function avisar() {
  ouvintes.forEach((fn) => { try { fn(); } catch { /* um assinante com defeito não impede os outros */ } });
}

export function saveSidebar(uid, preset, items) {
  const ok = writeViewPreference(uid, SIDEBAR_PREF_ID, JSON.stringify({ v: VERSAO, preset, items: normalizeSidebarItems(items) }));
  avisar();
  return ok;
}

export function resetSidebar(uid) {
  const ok = writeViewPreference(uid, SIDEBAR_PREF_ID, null);
  avisar();
  return ok;
}

function aoMudarOutraAba(evento) {
  const sufixo = viewPreferenceKey('x', SIDEBAR_PREF_ID).slice('v2:view:x'.length);
  if (!evento || evento.key === null || String(evento.key).endsWith(sufixo)) avisar();
}

export function subscribeSidebar(fn) {
  ouvintes.add(fn);
  if (ouvintes.size === 1 && typeof window !== 'undefined') window.addEventListener('storage', aoMudarOutraAba);
  return () => {
    ouvintes.delete(fn);
    if (ouvintes.size === 0 && typeof window !== 'undefined') window.removeEventListener('storage', aoMudarOutraAba);
  };
}
