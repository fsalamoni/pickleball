/**
 * Onde mora a ESCOLHA dos cards da tela inicial: no navegador, por usuário.
 *
 * - Chave: `v2:view:<uid>:inicio:cards` (via `viewPreference`, que nunca
 *   lança). Num tablet de clube duas pessoas usam o mesmo navegador, e uma não
 *   herda o início da outra.
 * - Valor: `{"v":1,"cards":[…]}`. A lista VAZIA é gravada de verdade — "não
 *   quero nada no início" é uma escolha, diferente de "nunca escolhi" (que
 *   segue o padrão e acompanha se o padrão mudar).
 * - "Restaurar o padrão" APAGA a escolha: a pessoa volta a acompanhar o padrão.
 *
 * Um armazém pequeno com assinantes: a tela inicial, o seletor dentro dela e o
 * cartão de Configurações leem a mesma coisa e se atualizam juntos (e outra
 * aba também, pelo evento `storage`). Nada aqui toca o banco.
 */
import { readViewPreference, viewPreferenceKey, writeViewPreference } from '@/core/lib/viewPreference';
import { normalizeHomeCards } from '../domain/homeCards.js';

/** Id da preferência. ⚠️ Contrato: mudar apaga a escolha de todo mundo. */
export const HOME_CARDS_PREF_ID = 'inicio:cards';

const VERSAO = 1;
const ouvintes = new Set();
/** uid → { raw, valor }: o `useSyncExternalStore` exige o MESMO objeto enquanto nada mudar. */
const memoria = new Map();

/** Texto salvo → lista escolhida, ou `null` (nunca escolheu / ilegível). */
export function parseHomeCards(raw) {
  if (!raw) return null;
  try {
    const obj = JSON.parse(raw);
    return obj && Array.isArray(obj.cards) ? normalizeHomeCards(obj.cards) : null;
  } catch {
    return null;
  }
}

/**
 * O retrato estável da escolha desta pessoa: `{ salvo }`, em que `salvo` é a
 * lista escolhida ou `null`. Mesmo objeto enquanto o texto guardado não mudar.
 */
export function homeCardsSnapshot(uid) {
  const chave = uid || '';
  const raw = readViewPreference(uid, HOME_CARDS_PREF_ID);
  const guardado = memoria.get(chave);
  if (guardado && guardado.raw === raw) return guardado.valor;
  const valor = Object.freeze({ salvo: parseHomeCards(raw) });
  memoria.set(chave, { raw, valor });
  return valor;
}

function avisar() {
  ouvintes.forEach((fn) => {
    try { fn(); } catch { /* um assinante com defeito não impede os outros */ }
  });
}

/** Grava a escolha (a lista, na ordem). Devolve se gravou. */
export function saveHomeCards(uid, lista) {
  const ok = writeViewPreference(uid, HOME_CARDS_PREF_ID, JSON.stringify({ v: VERSAO, cards: normalizeHomeCards(lista) }));
  avisar();
  return ok;
}

/** Apaga a escolha: a pessoa volta a acompanhar o padrão. */
export function resetHomeCards(uid) {
  const ok = writeViewPreference(uid, HOME_CARDS_PREF_ID, null);
  avisar();
  return ok;
}

/** Outra aba mudou a escolha: avisa quem está nesta. */
function aoMudarOutraAba(evento) {
  const sufixo = viewPreferenceKey('x', HOME_CARDS_PREF_ID).slice('v2:view:x'.length);
  if (!evento || evento.key === null || String(evento.key).endsWith(sufixo)) avisar();
}

/** Assina as mudanças. Devolve a função que desassina. */
export function subscribeHomeCards(fn) {
  ouvintes.add(fn);
  if (ouvintes.size === 1 && typeof window !== 'undefined') window.addEventListener('storage', aoMudarOutraAba);
  return () => {
    ouvintes.delete(fn);
    if (ouvintes.size === 0 && typeof window !== 'undefined') window.removeEventListener('storage', aoMudarOutraAba);
  };
}
