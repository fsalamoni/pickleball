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
