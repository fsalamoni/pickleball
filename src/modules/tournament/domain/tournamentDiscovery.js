/**
 * A LISTA de torneios, do jeito que ela é lida (lógica pura).
 *
 * *"…para que elas sempre mostrem o que há no dia ou nos próximos dias,
 * conforme a funcionalidade. E o que já passou, não mostre mais."*
 *
 * A aba "Públicos" misturava tudo, ordenado pela data de início mais distante:
 * o torneio de daqui a seis meses no topo, o de amanhã no meio, e os
 * encerrados do ano passado logo abaixo, com a mesma cara. Agora:
 *  - **atuais**: acontecendo, com inscrição aberta e por começar — do mais
 *    próximo para o mais distante (o que está rolando vem primeiro);
 *  - **encerrados**: encerrados, cancelados e os "esquecidos" (a data passou
 *    sem ninguém encerrar) — do mais recente para o mais antigo, e fora da
 *    lista principal (a tela os mostra só se a pessoa pedir);
 *  - **rascunhos** de outras pessoas não são vitrine: ficam de fora.
 *
 * A régua de "ainda vale" é a MESMA da tela inicial (`tournamentPhase`).
 */
import { TOURNAMENT_PHASE, diaLocal, tournamentPhase } from '../../home/domain/freshness.js';

const ORDEM_ATUAL = [TOURNAMENT_PHASE.LIVE, TOURNAMENT_PHASE.OPEN, TOURNAMENT_PHASE.UPCOMING, TOURNAMENT_PHASE.DRAFT];
const inicio = (t) => diaLocal(t?.starts_at) || '';

/** Atuais primeiro (rolando → abertos → por começar; o mais próximo antes), encerrados depois. */
function compararAtuais(fase) {
  return (a, b) => ORDEM_ATUAL.indexOf(fase.get(a)) - ORDEM_ATUAL.indexOf(fase.get(b))
    || (inicio(a) || '9999').localeCompare(inicio(b) || '9999')
    || String(a.name || '').localeCompare(String(b.name || ''));
}
const compararEncerrados = (a, b) => inicio(b).localeCompare(inicio(a))
  || String(a.name || '').localeCompare(String(b.name || ''));

/**
 * @param {object[]} lista `usePublicTournaments`
 * @param {string} hoje 'YYYY-MM-DD'
 * @returns {{ atuais: object[], encerrados: object[], rascunhos: object[] }}
 */
export function discoverTournaments(lista = [], hoje) {
  const fase = new Map();
  const atuais = [];
  const encerrados = [];
  const rascunhos = [];
  (lista || []).forEach((t) => {
    if (!t) return;
    const f = tournamentPhase(t, hoje);
    fase.set(t, f);
    if (f === TOURNAMENT_PHASE.OVER || f === TOURNAMENT_PHASE.STALE) encerrados.push(t);
    else if (f === TOURNAMENT_PHASE.DRAFT) rascunhos.push(t);
    else atuais.push(t);
  });
  return {
    atuais: atuais.sort(compararAtuais(fase)),
    encerrados: encerrados.sort(compararEncerrados),
    rascunhos,
  };
}

/**
 * "Meus torneios": tudo continua (é o histórico da pessoa), mas o que ainda
 * pede atenção vem primeiro — inclusive o rascunho e o esquecido, que são
 * trabalho de quem organiza.
 */
export function sortMyTournaments(lista = [], hoje) {
  const fase = new Map((lista || []).filter(Boolean).map((t) => [t, tournamentPhase(t, hoje)]));
  const peso = (t) => {
    const f = fase.get(t);
    if (f === TOURNAMENT_PHASE.OVER) return 2;
    return 0;
  };
  const ordemAtual = [TOURNAMENT_PHASE.LIVE, TOURNAMENT_PHASE.STALE, TOURNAMENT_PHASE.OPEN, TOURNAMENT_PHASE.UPCOMING, TOURNAMENT_PHASE.DRAFT];
  return [...fase.keys()].sort((a, b) => peso(a) - peso(b)
    || (peso(a) === 2
      ? compararEncerrados(a, b)
      : ordemAtual.indexOf(fase.get(a)) - ordemAtual.indexOf(fase.get(b))
        || (inicio(a) || '9999').localeCompare(inicio(b) || '9999')));
}
