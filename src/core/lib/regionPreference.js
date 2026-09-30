/**
 * Onde mora a escolha da MINHA REGIÃO: no navegador, por usuário.
 *
 * - Chave: `v2:view:<uid>:regiao` (via `viewPreference`, que nunca lança).
 *   Num tablet de clube duas pessoas usam o mesmo navegador, e uma não herda a
 *   região da outra.
 * - Valor: `{"v":1,"modo":…,"origem":…,"cidade":…,"uf":…,"raioKm":…}`.
 *   Sem a chave vale o padrão (a cidade do perfil e até 50 km) — e acompanha
 *   se o padrão mudar. "Restaurar o padrão" APAGA a escolha.
 * - Da localização do aparelho só se guarda a CIDADE mais próxima, nunca as
 *   coordenadas.
 *
 * Um armazém pequeno com assinantes: toda tela que filtra por região, o
 * seletor e o cartão de Configurações leem a mesma coisa e se atualizam
 * juntos (e outra aba também, pelo evento `storage`). Nada aqui toca o banco.
 */
import { readViewPreference, viewPreferenceKey, writeViewPreference } from './viewPreference';
import { parseRegionPreference, serializeRegionPreference } from '../domain/region.js';

/** Id da preferência. ⚠️ Contrato: mudar apaga a escolha de todo mundo. */
export const REGION_PREF_ID = 'regiao';

const ouvintes = new Set();
/** uid → { raw, valor }: o `useSyncExternalStore` exige o MESMO objeto enquanto nada mudar. */
const memoria = new Map();

/** O retrato estável da escolha: `{ salvo }` (a escolha, ou `null` = padrão). */
export function regionSnapshot(uid) {
  const chave = uid || '';
  const raw = readViewPreference(uid, REGION_PREF_ID);
  const guardado = memoria.get(chave);
  if (guardado && guardado.raw === raw) return guardado.valor;
  const valor = Object.freeze({ salvo: parseRegionPreference(raw) });
  memoria.set(chave, { raw, valor });
  return valor;
}

function avisar() {
  ouvintes.forEach((fn) => {
    try { fn(); } catch { /* um assinante com defeito não impede os outros */ }
  });
}

/** Grava a escolha. Escolha inválida APAGA (volta ao padrão). */
export function saveRegion(uid, pref) {
  const ok = writeViewPreference(uid, REGION_PREF_ID, serializeRegionPreference(pref));
  avisar();
  return ok;
}

/** Apaga a escolha: a pessoa volta ao padrão. */
export function resetRegion(uid) {
  const ok = writeViewPreference(uid, REGION_PREF_ID, null);
  avisar();
  return ok;
}

function aoMudarOutraAba(evento) {
  const sufixo = viewPreferenceKey('x', REGION_PREF_ID).slice('v2:view:x'.length);
  if (!evento || evento.key === null || String(evento.key).endsWith(sufixo)) avisar();
}

/** Assina as mudanças. Devolve a função que desassina. */
export function subscribeRegion(fn) {
  ouvintes.add(fn);
  if (ouvintes.size === 1 && typeof window !== 'undefined') {
    window.addEventListener('storage', aoMudarOutraAba);
  }
  return () => {
    ouvintes.delete(fn);
    if (ouvintes.size === 0 && typeof window !== 'undefined') {
      window.removeEventListener('storage', aoMudarOutraAba);
    }
  };
}
