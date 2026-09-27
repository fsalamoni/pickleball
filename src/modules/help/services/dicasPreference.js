/**
 * Onde moram as escolhas das DICAS: no navegador, por usuário. Nada vai ao
 * banco — é conveniência de interface, como a aparência e os cards do início.
 *
 * | O quê                         | Onde                                          |
 * |-------------------------------|-----------------------------------------------|
 * | dicas ligadas?                | `v2:view:<uid>:dicas:ligadas` = '1' / '0'     |
 * | guias concluídos              | `v2:view:<uid>:dicas:feitos` = JSON de ids    |
 * | pontos de dica já vistos      | `v2:view:<uid>:dicas:vistos` = JSON de ids    |
 * | o guia em andamento (e passo) | sessionStorage `picklerush:dicas:guia:<uid>`  |
 *
 * O guia em andamento fica na SESSÃO (a aba): recarregar a página continua de
 * onde parou, e uma aba nova não herda um guia pela metade de outra.
 *
 * As dicas nascem DESLIGADAS: elas aparecem quando a pessoa quer, nunca de
 * surpresa depois que ela fez alguma coisa.
 *
 * Um armazém pequeno com assinantes, lido por `useSyncExternalStore`: o botão
 * do topo, o painel, os pontos na tela e o cartão de Configurações andam
 * juntos (e outra aba também, pelo evento `storage`). Nunca lança.
 */
import { readViewPreference, viewPreferenceKey, writeViewPreference } from '@/core/lib/viewPreference';

/** Ids das preferências. ⚠️ Contrato: mudar apaga a escolha de todo mundo. */
export const DICAS_PREF = Object.freeze({
  LIGADAS: 'dicas:ligadas',
  FEITOS: 'dicas:feitos',
  VISTOS: 'dicas:vistos',
});

const GUIA_PREFIXO = 'picklerush:dicas:guia:';
const LIMITE_LISTA = 200;

const ouvintes = new Set();
/** uid → { chaveBruta, valor }: o retrato é o MESMO objeto enquanto nada mudar. */
const memoria = new Map();

function sessao() {
  try {
    return typeof window !== 'undefined' ? window.sessionStorage || null : null;
  } catch {
    return null;
  }
}

/** Texto salvo → lista de ids (strings), sem repetição. Ilegível vira vazio. */
export function parseLista(raw) {
  if (!raw) return [];
  try {
    const v = JSON.parse(raw);
    if (!Array.isArray(v)) return [];
    return [...new Set(v.filter((x) => typeof x === 'string' && x))].slice(0, LIMITE_LISTA);
  } catch {
    return [];
  }
}

/** Texto salvo → o guia em andamento, ou `null`. */
export function parseGuiaAtivo(raw) {
  if (!raw) return null;
  try {
    const v = JSON.parse(raw);
    if (!v || typeof v.id !== 'string' || !v.id) return null;
    const passo = Number.isInteger(v.passo) && v.passo >= 0 ? v.passo : 0;
    return { id: v.id, passo };
  } catch {
    return null;
  }
}

function lerGuia(uid) {
  try {
    return sessao()?.getItem(GUIA_PREFIXO + (uid || 'anon')) || null;
  } catch {
    return null;
  }
}

/**
 * O retrato das dicas desta pessoa. Mesmo objeto enquanto nada mudar
 * (exigência do `useSyncExternalStore`, senão a tela renderiza em laço).
 * @returns {{ ligadas: boolean, feitos: string[], vistos: string[], guia: { id: string, passo: number }|null }}
 */
export function dicasSnapshot(uid) {
  const brutos = [
    readViewPreference(uid, DICAS_PREF.LIGADAS),
    readViewPreference(uid, DICAS_PREF.FEITOS),
    readViewPreference(uid, DICAS_PREF.VISTOS),
    lerGuia(uid),
  ];
  const chaveBruta = brutos.map((b) => b ?? '∅').join('\u0001');
  const chave = uid || '';
  const guardado = memoria.get(chave);
  if (guardado && guardado.chaveBruta === chaveBruta) return guardado.valor;
  const valor = Object.freeze({
    ligadas: brutos[0] === '1',
    feitos: Object.freeze(parseLista(brutos[1])),
    vistos: Object.freeze(parseLista(brutos[2])),
    guia: parseGuiaAtivo(brutos[3]),
  });
  memoria.set(chave, { chaveBruta, valor });
  return valor;
}

function avisar() {
  ouvintes.forEach((fn) => {
    try { fn(); } catch { /* um assinante com defeito não impede os outros */ }
  });
}

/** Liga ou desliga as dicas. */
export function setDicasLigadas(uid, ligadas) {
  const ok = writeViewPreference(uid, DICAS_PREF.LIGADAS, ligadas ? '1' : '0');
  avisar();
  return ok;
}

function acrescentar(uid, pref, id) {
  if (!id) return false;
  const atual = parseLista(readViewPreference(uid, pref));
  if (atual.includes(id)) return true;
  const ok = writeViewPreference(uid, pref, JSON.stringify([...atual, id].slice(-LIMITE_LISTA)));
  avisar();
  return ok;
}

/** Guia concluído — o painel mostra o ✓. */
export function marcarGuiaFeito(uid, guiaId) {
  return acrescentar(uid, DICAS_PREF.FEITOS, guiaId);
}

/** Ponto de dica já visto — ele para de pulsar (e continua lá). */
export function marcarPontoVisto(uid, pontoId) {
  return acrescentar(uid, DICAS_PREF.VISTOS, pontoId);
}

/** "Mostrar de novo os pontos que já vi." */
export function recomecarPontos(uid) {
  const ok = writeViewPreference(uid, DICAS_PREF.VISTOS, null);
  avisar();
  return ok;
}

/** Começa (ou move) o guia em andamento. `null` encerra. */
export function setGuiaAtivo(uid, guia) {
  const s = sessao();
  try {
    if (s) {
      const chave = GUIA_PREFIXO + (uid || 'anon');
      if (guia && guia.id) s.setItem(chave, JSON.stringify({ id: guia.id, passo: guia.passo || 0 }));
      else s.removeItem(chave);
    }
  } catch { /* armazenamento bloqueado: o guia vive só nesta tela */ }
  avisar();
  return Boolean(s);
}

/** Outra aba mudou uma preferência das dicas: avisa quem está nesta. */
function aoMudarOutraAba(evento) {
  const sufixos = Object.values(DICAS_PREF).map((p) => viewPreferenceKey('x', p).slice('v2:view:x'.length));
  if (!evento || evento.key === null || sufixos.some((s) => String(evento.key).endsWith(s))) avisar();
}

/** Assina as mudanças. Devolve a função que desassina. */
export function subscribeDicas(fn) {
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
