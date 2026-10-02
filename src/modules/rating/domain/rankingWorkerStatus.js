/**
 * Estado do recálculo de rankings NO SERVIDOR, legível por gente.
 *
 * O servidor registra cada passada em `platform_settings/ranking_worker`
 * (`functions/platformRankings.js`). Mostrar isso no painel do admin é o que
 * torna visível o defeito que ninguém enxergava: em 2026-09-22 as funções
 * estavam apagadas (o projeto Firebase é compartilhado com outro aplicativo),
 * a última passada era de 18/09, e nada na plataforma dizia isso.
 *
 * Puro: sem React, sem Firebase.
 */

/** Rótulos dos motivos gravados pelos gatilhos (`functions/index.js`). */
export const MOTIVO_LABEL = Object.freeze({
  'tournament-change': 'mudança num torneio',
  'tournament-match': 'resultado de torneio',
  'tournament-registration': 'inscrição de torneio',
  'club-event-game': 'dia de jogo publicado',
  'recuperacao-agendada': 'recuperação agendada',
  'unificacao-de-conta': 'unificação de cadastro',
});

/** Converte Timestamp do Firestore, `{ seconds }`, Date, número ou texto em ms. */
function emMs(valor) {
  if (!valor) return 0;
  if (typeof valor === 'number') return valor;
  if (typeof valor.toMillis === 'function') return valor.toMillis();
  if (typeof valor.seconds === 'number') return valor.seconds * 1000;
  const d = new Date(valor);
  return Number.isNaN(d.getTime()) ? 0 : d.getTime();
}

/**
 * @param {object|null} worker documento `platform_settings/ranking_worker` (ou null)
 * @returns {{
 *   registrado: boolean,
 *   ultimaPassadaMs: number,
 *   motivo: string|null,
 *   emCurso: boolean,
 *   erro: { mensagem: string, ms: number }|null,
 * }}
 */
export function describeRankingWorker(worker) {
  if (!worker || typeof worker !== 'object') {
    return { registrado: false, ultimaPassadaMs: 0, motivo: null, emCurso: false, erro: null };
  }
  const ultimaPassadaMs = emMs(worker.last_run_at);
  const erroMs = emMs(worker.last_error_at);
  const motivoBruto = worker.last_request_reason || null;
  return {
    registrado: ultimaPassadaMs > 0,
    ultimaPassadaMs,
    motivo: motivoBruto ? (MOTIVO_LABEL[motivoBruto] || motivoBruto) : null,
    emCurso: emMs(worker.running_since) > 0,
    // Um erro antigo, seguido de passada bem-sucedida, já foi superado: mostrar
    // assusta à toa e ensina a ignorar o aviso quando ele importar.
    erro: worker.last_error && erroMs > ultimaPassadaMs
      ? { mensagem: String(worker.last_error), ms: erroMs }
      : null,
  };
}

/**
 * Data e hora em pt-BR, no fuso de Brasília — explícitos, para não depender da
 * configuração da máquina de quem abre o painel.
 * @param {number} ms
 */
export function formatarMomento(ms) {
  if (!ms) return '';
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo',
  }).format(new Date(ms));
}

/** Por que o torneio inteiro ficou fora — dito como a pessoa resolve. */
export const TORNEIO_FORA_LABEL = Object.freeze({
  rascunho: 'em rascunho (publique o torneio)',
  privado: 'privado (só torneio público conta)',
  cancelado: 'cancelado',
  arquivado: 'arquivado',
  apagado: 'apagado',
  outro: 'fora do ranking',
});

/**
 * O que ficou FORA dos rankings na última passada do servidor, e por quê
 * (`last_result.excluded`, gravado por `functions/platformRankings.js`).
 *
 * É a resposta para "lancei vários jogos e o atleta não aparece". O servidor
 * só registra CONTAGENS e ids — o documento é de leitura pública.
 *
 * @param {object|null} worker documento `platform_settings/ranking_worker`
 * @returns {null | {
 *   usadas: number,
 *   fora: number,
 *   linhas: Array<{ chave: string, quantidade: number, texto: string }>,
 *   torneios: Array<{ id: string|null, nome: string|null, motivo: string, partidasFora: number, inscricoesSemConta: number, texto: string }>,
 *   semPlacar: number,
 * }} `null` quando a passada ainda não registrou o relatório (servidor antigo).
 */
export function describeRankingExclusions(worker) {
  const ex = worker?.last_result?.excluded;
  if (!ex || typeof ex !== 'object') return null;
  const n = (v) => Math.max(0, Number(v) || 0);
  const t = ex.torneio || {};
  const d = ex.dia_de_jogo || {};
  const pt = t.por_motivo || {};
  const pd = d.por_motivo || {};
  const foraDoTorneio = t.torneio_fora || {};

  const linhas = [];
  const add = (chave, quantidade, texto) => {
    if (n(quantidade) > 0) linhas.push({ chave, quantidade: n(quantidade), texto });
  };
  add('sem_conta', pt.sem_conta,
    'partida(s) de torneio com jogador SEM CONTA na plataforma (inscrito só pelo nome, provisório ou vaga). Vincule a conta na inscrição.');
  Object.entries(foraDoTorneio).forEach(([motivo, q]) => {
    add(`torneio_${motivo}`, q, `partida(s) de torneio ${TORNEIO_FORA_LABEL[motivo] || TORNEIO_FORA_LABEL.outro}.`);
  });
  add('sem_vencedor_torneio', pt.sem_vencedor, 'partida(s) de torneio encerrada(s) sem vencedor.');
  add('jogo_incompleto', pd.jogo_incompleto, 'jogo(s) de dia de jogo publicados com atleta sem conta.');
  add('sem_vencedor_dia', pd.sem_vencedor, 'jogo(s) de dia de jogo sem vencedor.');

  const torneios = (Array.isArray(ex.torneios) ? ex.torneios : []).map((x) => ({
    id: x?.id || null,
    nome: x?.nome || null,
    motivo: x?.motivo || 'outro',
    partidasFora: n(x?.partidas_fora),
    inscricoesSemConta: n(x?.inscricoes_sem_conta),
    texto: x?.motivo === 'sem_conta'
      ? `${n(x?.inscricoes_sem_conta)} inscrição(ões) sem conta`
      : (TORNEIO_FORA_LABEL[x?.motivo] || TORNEIO_FORA_LABEL.outro),
  }));

  return {
    usadas: n(t.usadas) + n(d.usadas),
    fora: linhas.reduce((s, l) => s + l.quantidade, 0),
    linhas,
    torneios,
    semPlacar: n(ex.sem_placar),
  };
}
