/**
 * Controle de linhas nas QUADRAS de um dia de jogo (docs/53 §3). Cada quadra
 * liga o seu e tem o seu arranjo — uma quadra pode ter uma câmera e a do lado
 * cinco. Um documento por quadra, `game_days/{id}/line_courts/court-N`, com o
 * liga/desliga e o arranjo; embaixo, as câmeras (`line_cams`) e as marcações
 * (`line_calls`) daquela quadra. Vale igual no dia do atleta, da arena e do
 * clube. Puro.
 */

export const LINE_COURTS = 'line_courts';
export const MAX_LINE_COURTS = 99;
const COURT_ID = /^court-(\d{1,2})$/;

/** O número da quadra no id (`court-3` ⇒ 3); id que não é de quadra ⇒ null. */
export function lineCourtNumber(id) {
  const m = COURT_ID.exec(String(id || ''));
  const n = m ? Number(m[1]) : 0;
  return n >= 1 ? n : null;
}
export const lineCourtId = (n) => `court-${n}`;

/** O "anfitrião" das câmeras e marcações da quadra (ver `hostPath`). */
export const gameDayLineHost = (gdId, courtId) => `game_days/${gdId}/${LINE_COURTS}/${courtId}`;

/** A página do controle de linhas do dia (a lista de quadras) ou de uma quadra. */
export const gameDayLinePage = (gdId, courtId = null) => `/dia-de-jogo/${gdId}/linhas${courtId ? `?quadra=${encodeURIComponent(courtId)}` : ''}`;

const courtOk = (n) => Number.isInteger(n) && n >= 1 && n <= MAX_LINE_COURTS;

/**
 * Quem pode ser câmera no dia: quem organiza (`podeConfigurar`) ou participa
 * (`member_uids`, administradores nomeados). A regra (`lcGdCam`) confere igual.
 */
export function canBeLineCamera(gameDay, uid, podeConfigurar) {
  if (!uid) return false;
  return Boolean(podeConfigurar)
    || (gameDay?.member_uids || []).includes(uid)
    || (gameDay?.admin_uids || []).includes(uid);
}

/**
 * As quadras do dia: as que ele tem (`play_courts`, no mínimo 1), as dos jogos
 * já criados (`court`) e as que já têm configuração — nenhuma some da lista
 * enquanto tiver câmera ligada.
 * @param {{ play_courts?: number }} gameDay
 * @param {{ games?: Array<{ court?: number }>, docs?: Array<{ id: string }> }} [extra]
 * @returns {Array<{ id: string, index: number }>}
 */
export function gameDayLineCourts(gameDay, { games = [], docs = [] } = {}) {
  const nums = new Set();
  const n = Math.min(MAX_LINE_COURTS, Math.max(1, Math.floor(Number(gameDay?.play_courts) || 0)));
  for (let i = 1; i <= n; i += 1) nums.add(i);
  (games || []).forEach((g) => { const c = Number(g?.court); if (courtOk(c)) nums.add(c); });
  (docs || []).forEach((d) => { const c = lineCourtNumber(d?.id); if (c) nums.add(c); });
  return [...nums].sort((a, b) => a - b).map((i) => ({ id: lineCourtId(i), index: i }));
}

/**
 * "Copiar para os meus próximos dias de jogo": o que gravar em cada dia.
 *
 * Os dias que a pessoa CRIOU, de hoje em diante (ou sem data), fora os
 * arquivados e o próprio dia de origem. Em cada um, as quadras que ele tem
 * recebem a configuração da quadra de MESMO número aqui (sem configuração
 * aqui ⇒ desligada). Dia que já passou não ganha câmera; dia de outra pessoa
 * é dela para decidir.
 *
 * @param {{ id: string }} source o dia de origem
 * @param {Array<{ id: string }>} sourceDocs as quadras configuradas no dia de origem
 * @param {Array<object>} gameDays os dias de jogo da pessoa
 * @param {string} uid
 * @param {string} today `AAAA-MM-DD` local
 * @returns {Array<{ gameDayId: string, courts: Array<{ id: string, patch: object }> }>}
 */
export function lineCourtCopyPlan(source, sourceDocs, gameDays, uid, today) {
  if (!uid || !source?.id) return [];
  const conf = new Map((sourceDocs || []).map((d) => [d.id, d]));
  return (gameDays || [])
    .filter((g) => g?.id && g.id !== source.id && g.created_by === uid && g.status !== 'archived')
    .filter((g) => !g.date || String(g.date) >= today)
    .map((g) => ({
      gameDayId: g.id,
      courts: gameDayLineCourts(g).map((c) => {
        const d = conf.get(c.id);
        const patch = { line_control: d?.line_control === true };
        if (d?.line_control_layout) patch.line_control_layout = d.line_control_layout;
        return { id: c.id, patch };
      }),
    }));
}
