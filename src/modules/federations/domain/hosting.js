/**
 * SEDES E COPA (rodada 3, Bloco 3, `docs/50` §39) — a conta PURA do edital de
 * sede de campeonato (módulo `host_bids`) e da Copa das Federações (módulo
 * `federation_cup`, da confederação).
 *
 *  - Edital de sede: a federação publica o evento com critérios e pesos. Os
 *    clubes e arenas filiados (na confederação: filiados a uma estadual da
 *    rede) mandam a CARTA DE INTENÇÃO até o prazo; a equipe escolhe quem segue
 *    e esses mandam a PROPOSTA completa. A comissão dá nota de 0 a 10 em cada
 *    critério, o total é a média ponderada e o resultado sai publicado (nome
 *    da organização e nota — nunca uid). Vencedor que não é o primeiro da nota
 *    exige motivo.
 *  - Copa das Federações: a confederação abre a competição com as categorias
 *    e o tamanho do elenco; cada estadual da rede inscreve o elenco a partir
 *    dos SEUS filiados em dia, manda, e a confederação aprova ou devolve com
 *    motivo. O elenco aprovado sai na página (nome e categoria).
 *
 * O servidor tem uma CÓPIA (`functions/federationHostingPolicy.js`) com
 * paridade em `federationHosting.parity.test.js`. Estados, ids de critério e
 * de categoria são GRAVADOS: nunca renomeie.
 */
import { t, tk } from '@/core/i18n';

const str = (v, max = 500) => String(v ?? '').replace(/\s+/g, ' ').trim().slice(0, max);
const txt = (v, max) => String(v ?? '').trim().slice(0, max);
const isIso = (v) => /^\d{4}-\d{2}-\d{2}$/.test(String(v || ''));
const lista = (v) => (Array.isArray(v) ? v : []);
const inteiro = (v, min, max, d) => { const n = Math.trunc(Number(v)); return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : d; };
const slug = (v, i, p) => str(v, 24).toLowerCase().replace(/[^a-z0-9_-]/g, '') || `${p}${i + 1}`;

/** Quem cuida dos editais de sede e da Copa: competições e a administração. */
export const canManageHosting = (perms = []) => perms.includes('admin') || perms.includes('competitions');

/** Caminho de arquivo enviado pela própria pessoa (`federacao/{uid}/…`). */
export const ownFilePath = (path, uid) => Boolean(uid) && new RegExp(`^federacao/${String(uid).replace(/[^A-Za-z0-9_-]/g, '')}/[A-Za-z0-9_-]+\\.[a-z]{3,4}$`).test(String(path || ''));

/* ------------------------------------------------------- edital de sede -- */

export const HOST_BID_STATUS = Object.freeze({ DRAFT: 'draft', INTENT: 'intent', PROPOSAL: 'proposal', REVIEW: 'review', RESULT: 'result', CANCELLED: 'cancelled' });
export const HOST_BID_STATUS_LABELS = Object.freeze({
  draft: tk('Rascunho'), intent: tk('Cartas de intenção'), proposal: tk('Propostas'), review: tk('Em avaliação'), result: tk('Resultado publicado'), cancelled: tk('Cancelado'),
});
/** O que o público vê (o rascunho só a equipe). */
export const HOST_BID_PUBLIC = Object.freeze(['intent', 'proposal', 'review', 'result', 'cancelled']);
export const HOST_ENTRY_STAGE = Object.freeze({
  INTENT: 'intent', SHORTLISTED: 'shortlisted', NOT_SHORTLISTED: 'not_shortlisted', PROPOSAL: 'proposal', WITHDRAWN: 'withdrawn', WINNER: 'winner', NOT_SELECTED: 'not_selected',
});
export const HOST_ENTRY_STAGE_LABELS = Object.freeze({
  intent: tk('Carta enviada'), shortlisted: tk('Selecionada para a proposta'), not_shortlisted: tk('Não seguiu para a proposta'), proposal: tk('Proposta enviada'),
  withdrawn: tk('Desistiu'), winner: tk('Escolhida para sediar'), not_selected: tk('Não escolhida'),
});
export const HOST_LIMITS = Object.freeze({
  CRITERIA_MAX: 10, LABEL_MAX: 100, DESCRIPTION_MAX: 300, TEXT_MAX: 4000, INTENT_MAX: 2000, PROPOSAL_MAX: 6000, FILES_MAX: 6, WEIGHT_MAX: 10, SCORE_MAX: 10, NOTE_MAX: 1000, RANKING_MAX: 30,
});
export const DEFAULT_HOST_CRITERIA = Object.freeze([
  { id: 'courts', label: tk('Quadras: quantidade, piso, iluminação e área de aquecimento'), description: '', weight: 3 },
  { id: 'access', label: tk('Acesso, hospedagem e alimentação perto do local'), description: '', weight: 2 },
  { id: 'support', label: tk('Apoio local (poder público, patrocínio, voluntários)'), description: '', weight: 2 },
  { id: 'experience', label: tk('Experiência em organizar eventos'), description: '', weight: 2 },
  { id: 'counterpart', label: tk('Contrapartida financeira e estrutura oferecida'), description: '', weight: 1 },
]);

export const hostEntryId = (bidId, kind, orgId) => `${bidId}_${kind}_${orgId}`;
export const hostScoreId = (entryId, uid) => `${entryId}_${uid}`;

/** Os critérios do edital (sem critérios = os padrão); id único, peso 1 a 10. */
export function normalizeHostCriteria(raw) {
  const vistos = new Set();
  return (lista(raw).length ? lista(raw) : DEFAULT_HOST_CRITERIA).slice(0, HOST_LIMITS.CRITERIA_MAX).map((c, i) => {
    let id = slug(c?.id, i, 'c');
    if (vistos.has(id)) id = `${id}${i + 1}`;
    vistos.add(id);
    return { id, label: str(c?.label, HOST_LIMITS.LABEL_MAX), description: str(c?.description, HOST_LIMITS.DESCRIPTION_MAX), weight: inteiro(c?.weight, 1, HOST_LIMITS.WEIGHT_MAX, 1) };
  }).filter((c) => c.label.length >= 3);
}

export function normalizeHostBid(input = {}) {
  return {
    title: str(input.title, 120),
    event_name: str(input.event_name, 120),
    event_start: isIso(input.event_start) ? input.event_start : '',
    event_end: isIso(input.event_end) ? input.event_end : '',
    description: txt(input.description, HOST_LIMITS.TEXT_MAX),
    requirements: txt(input.requirements, HOST_LIMITS.TEXT_MAX),
    intent_until: isIso(input.intent_until) ? input.intent_until : '',
    proposal_until: isIso(input.proposal_until) ? input.proposal_until : '',
    criteria: normalizeHostCriteria(input.criteria),
  };
}

/** O edital digitado → o que pode ser gravado. As datas seguem a ordem: intenção, proposta, evento. */
export function validateHostBid(input = {}, hoje) {
  const v = normalizeHostBid(input);
  const errors = {};
  if (v.title.length < 3) errors.title = t('Dê um título ao edital.');
  if (v.event_name.length < 3) errors.event_name = t('Diga qual é o evento.');
  if (v.description.length < 10) errors.description = t('Descreva o evento e o que a sede oferece (mínimo de 10 letras).');
  if (!v.intent_until) errors.intent_until = t('Diga até quando chegam as cartas de intenção.');
  else if (v.intent_until < hoje) errors.intent_until = t('O prazo das cartas não pode ser no passado.');
  if (!v.proposal_until) errors.proposal_until = t('Diga até quando chegam as propostas.');
  else if (v.intent_until && v.proposal_until <= v.intent_until) errors.proposal_until = t('O prazo das propostas vem depois do das cartas.');
  if (!v.event_start) errors.event_start = t('Diga quando o evento começa.');
  else if (v.proposal_until && v.event_start <= v.proposal_until) errors.event_start = t('O evento começa depois do prazo das propostas.');
  if (v.event_end && v.event_start && v.event_end < v.event_start) errors.event_end = t('O evento termina depois de começar.');
  if (Array.isArray(input.criteria) && input.criteria.some((c) => str(c?.label, HOST_LIMITS.LABEL_MAX).length < 3)) errors.criteria = t('Todo critério precisa de um nome (mínimo de 3 letras).');
  else if (!v.criteria.length) errors.criteria = t('Coloque ao menos um critério.');
  return { ok: Object.keys(errors).length === 0, errors, value: v };
}

/** Os prazos estendidos (só para frente, com motivo). */
export function validateHostExtend(bid, input = {}, hoje) {
  const errors = {};
  const intent_until = isIso(input.intent_until) ? input.intent_until : bid.intent_until;
  const proposal_until = isIso(input.proposal_until) ? input.proposal_until : bid.proposal_until;
  if (intent_until < bid.intent_until || proposal_until < bid.proposal_until) errors.dates = t('O prazo só pode ser estendido.');
  else if (intent_until === bid.intent_until && proposal_until === bid.proposal_until) errors.dates = t('Mude ao menos um dos prazos.');
  else if (bid.status === HOST_BID_STATUS.INTENT && intent_until < hoje) errors.dates = t('O prazo das cartas não pode ser no passado.');
  else if (proposal_until <= intent_until) errors.dates = t('O prazo das propostas vem depois do das cartas.');
  else if (bid.event_start && proposal_until >= bid.event_start) errors.dates = t('O prazo das propostas acaba antes de o evento começar.');
  if (str(input.reason, 300).length < 3) errors.reason = t('Diga o motivo.');
  return { ok: Object.keys(errors).length === 0, errors, value: { intent_until, proposal_until, reason: str(input.reason, 300) } };
}

/** O que dá para mandar hoje. */
export function hostBidPhase(bid, hoje) {
  const st = bid?.status;
  return {
    acceptsIntent: st === HOST_BID_STATUS.INTENT && isIso(bid.intent_until) && hoje <= bid.intent_until,
    acceptsProposal: st === HOST_BID_STATUS.PROPOSAL && isIso(bid.proposal_until) && hoje <= bid.proposal_until,
    intentClosed: st === HOST_BID_STATUS.INTENT && isIso(bid.intent_until) && hoje > bid.intent_until,
    proposalClosed: st === HOST_BID_STATUS.PROPOSAL && isIso(bid.proposal_until) && hoje > bid.proposal_until,
  };
}

export function validateHostIntent(input = {}) {
  const text = txt(input.text, HOST_LIMITS.INTENT_MAX);
  return text.length >= 20 ? { ok: true, errors: {}, value: { text } } : { ok: false, errors: { text: t('Escreva a carta de intenção (mínimo de 20 letras).') }, value: { text } };
}

/** A proposta: texto e até 6 arquivos da pasta de quem manda. */
export function validateHostProposal(input = {}, uid = '') {
  const errors = {};
  const text = txt(input.text, HOST_LIMITS.PROPOSAL_MAX);
  if (text.length < 50) errors.text = t('Descreva a proposta (mínimo de 50 letras).');
  const files = [];
  lista(input.files).forEach((f) => {
    if (f && ownFilePath(f.path, uid)) files.push({ path: String(f.path), name: str(f.name, 120) });
    else errors.files = t('Envie o arquivo de novo.');
  });
  if (files.length > HOST_LIMITS.FILES_MAX) errors.files = t('No máximo {n} arquivos.', { n: HOST_LIMITS.FILES_MAX });
  return { ok: Object.keys(errors).length === 0, errors, value: { text, files: files.slice(0, HOST_LIMITS.FILES_MAX) } };
}

/** As notas de um avaliador: uma por critério, inteira de 0 a 10. */
export function validateHostScores(criteria, input = {}) {
  const raw = input && typeof input.scores === 'object' && input.scores ? input.scores : {};
  const scores = {};
  let falta = false;
  normalizeHostCriteria(criteria).forEach((c) => {
    const n = Number(raw[c.id]);
    if (raw[c.id] === '' || raw[c.id] == null || !Number.isInteger(n) || n < 0 || n > HOST_LIMITS.SCORE_MAX) falta = true;
    else scores[c.id] = n;
  });
  const note = txt(input.note, HOST_LIMITS.NOTE_MAX);
  return falta ? { ok: false, errors: { scores: t('Dê uma nota inteira de 0 a 10 em cada critério.') }, value: { scores, note } } : { ok: true, errors: {}, value: { scores, note } };
}

const arred = (n) => Math.round(n * 100) / 100;

/** A nota de UM avaliador: a média ponderada dos critérios (0 a 10). */
export function weightedScore(criteria, scores = {}) {
  const cs = normalizeHostCriteria(criteria);
  const peso = cs.reduce((s, c) => s + c.weight, 0);
  if (!peso) return 0;
  return arred(cs.reduce((s, c) => s + c.weight * (Number(scores[c.id]) || 0), 0) / peso);
}

/**
 * A classificação das propostas: média das notas dos avaliadores, da maior
 * para a menor (empate: o nome). `count` = quantos avaliadores deram nota.
 */
export function hostRanking(criteria, entries = [], scores = []) {
  const vale = [HOST_ENTRY_STAGE.PROPOSAL, HOST_ENTRY_STAGE.WINNER, HOST_ENTRY_STAGE.NOT_SELECTED];
  return lista(entries).filter((e) => e && vale.includes(e.stage)).map((e) => {
    const minhas = lista(scores).filter((s) => s && s.entry_id === e.id);
    const total = minhas.length ? arred(minhas.reduce((s, x) => s + weightedScore(criteria, x.scores), 0) / minhas.length) : 0;
    return { entry_id: e.id, org_name: str(e.org_name, 120), org_city: str(e.org_city, 80), org_state: str(e.org_state, 2), total, count: minhas.length };
  }).sort((a, b) => b.total - a.total || a.org_name.localeCompare(b.org_name, 'pt-BR') || a.entry_id.localeCompare(b.entry_id));
}

/** Escolher quem não está no topo da nota exige motivo. */
export function hostResultNeedsReason(ranking = [], winnerId) {
  const top = lista(ranking)[0];
  const w = lista(ranking).find((r) => r.entry_id === winnerId);
  return Boolean(top && w && w.total < top.total);
}

/** O resultado que vai para o público: nome, cidade, nota — sem uid. */
export function hostPublicResult(ranking = [], winnerId) {
  return lista(ranking).slice(0, HOST_LIMITS.RANKING_MAX).map((r) => ({ org_name: r.org_name, org_city: r.org_city, org_state: r.org_state, total: r.total, winner: r.entry_id === winnerId }));
}

/* ------------------------------------------------- Copa das Federações -- */

export const CUP_STATUS = Object.freeze({ DRAFT: 'draft', OPEN: 'open', CLOSED: 'closed', CANCELLED: 'cancelled' });
export const CUP_STATUS_LABELS = Object.freeze({ draft: tk('Rascunho'), open: tk('Inscrições abertas'), closed: tk('Inscrições encerradas'), cancelled: tk('Cancelada') });
export const CUP_PUBLIC = Object.freeze(['open', 'closed', 'cancelled']);
export const CUP_TEAM_STATUS = Object.freeze({ DRAFT: 'draft', SUBMITTED: 'submitted', APPROVED: 'approved', RETURNED: 'returned', WITHDRAWN: 'withdrawn' });
export const CUP_TEAM_STATUS_LABELS = Object.freeze({
  draft: tk('Elenco em montagem'), submitted: tk('Elenco enviado'), approved: tk('Elenco aprovado'), returned: tk('Devolvido para ajuste'), withdrawn: tk('Desistiu'),
});
export const CUP_LIMITS = Object.freeze({ CATEGORIES_MAX: 12, ROSTER_MAX: 20, LABEL_MAX: 60, TEXT_MAX: 3000, ATHLETES_MAX: 120 });

export const cupTeamId = (cupId, fedId) => `${cupId}_${fedId}`;

/** As categorias da Copa: `[{ id, label, roster_max }]` (id gravado no elenco). */
export function normalizeCupCategories(raw) {
  const vistos = new Set();
  return lista(raw).slice(0, CUP_LIMITS.CATEGORIES_MAX).map((c, i) => {
    let id = slug(c?.id, i, 'k');
    if (vistos.has(id)) id = `${id}${i + 1}`;
    vistos.add(id);
    return { id, label: str(c?.label, CUP_LIMITS.LABEL_MAX), roster_max: inteiro(c?.roster_max, 1, CUP_LIMITS.ROSTER_MAX, 2) };
  }).filter((c) => c.label.length >= 2);
}

export function normalizeCup(input = {}) {
  return {
    title: str(input.title, 120),
    year: inteiro(input.year, 2000, 2100, 0),
    starts_at: isIso(input.starts_at) ? input.starts_at : '',
    ends_at: isIso(input.ends_at) ? input.ends_at : '',
    location: str(input.location, 120),
    description: txt(input.description, CUP_LIMITS.TEXT_MAX),
    entries_until: isIso(input.entries_until) ? input.entries_until : '',
    categories: normalizeCupCategories(input.categories),
  };
}

export function validateCup(input = {}, hoje) {
  const v = normalizeCup(input);
  const errors = {};
  const ano = Number(String(hoje).slice(0, 4));
  if (v.title.length < 3) errors.title = t('Dê um nome à Copa.');
  if (!v.year || v.year < ano || v.year > ano + 2) errors.year = t('O ano é o atual ou um dos dois próximos.');
  if (!v.starts_at) errors.starts_at = t('Diga quando a Copa começa.');
  if (v.ends_at && v.starts_at && v.ends_at < v.starts_at) errors.ends_at = t('A Copa termina depois de começar.');
  if (!v.entries_until) errors.entries_until = t('Diga até quando as federações inscrevem o elenco.');
  else if (v.entries_until < hoje) errors.entries_until = t('O prazo de inscrição não pode ser no passado.');
  else if (v.starts_at && v.entries_until >= v.starts_at) errors.entries_until = t('As inscrições fecham antes de a Copa começar.');
  if (Array.isArray(input.categories) && input.categories.some((c) => str(c?.label, CUP_LIMITS.LABEL_MAX).length < 2)) errors.categories = t('Toda categoria precisa de um nome.');
  else if (!v.categories.length) errors.categories = t('Coloque ao menos uma categoria.');
  return { ok: Object.keys(errors).length === 0, errors, value: v };
}

export const cupAcceptsTeams = (cup, hoje) => Boolean(cup) && cup.status === CUP_STATUS.OPEN && isIso(cup.entries_until) && hoje <= cup.entries_until;

/**
 * O elenco: `[{ member_id, category_id }]`. A mesma pessoa pode jogar em mais
 * de uma categoria, mas não duas vezes na mesma; cada categoria até o teto.
 */
export function validateCupTeam(cup, input = {}) {
  const cats = normalizeCupCategories(cup?.categories);
  const errors = {};
  const vistos = new Set();
  const athletes = [];
  lista(input.athletes).slice(0, CUP_LIMITS.ATHLETES_MAX).forEach((a) => {
    const member_id = str(a?.member_id, 200);
    const category_id = str(a?.category_id, 24);
    if (!member_id || !cats.some((c) => c.id === category_id)) { errors.athletes = t('Escolha a categoria de cada atleta.'); return; }
    const k = `${member_id}|${category_id}`;
    if (vistos.has(k)) { errors.athletes = t('A mesma pessoa aparece duas vezes na mesma categoria.'); return; }
    vistos.add(k);
    athletes.push({ member_id, category_id });
  });
  const cheia = cats.find((c) => athletes.filter((a) => a.category_id === c.id).length > c.roster_max);
  if (cheia) errors.athletes = t('A categoria {cat} aceita no máximo {n} atletas.', { cat: cheia.label, n: cheia.roster_max });
  if (!athletes.length && !errors.athletes) errors.athletes = t('Coloque ao menos um atleta no elenco.');
  return { ok: Object.keys(errors).length === 0, errors, value: { athletes } };
}

/** A transição do elenco: `{ status }` ou `{ error }`. */
export function cupTeamTransition(status, action) {
  const S = CUP_TEAM_STATUS;
  const mapa = {
    save: [[null, S.DRAFT, S.RETURNED, S.WITHDRAWN], S.DRAFT],
    submit: [[S.DRAFT], S.SUBMITTED],
    withdraw: [[S.DRAFT, S.SUBMITTED, S.RETURNED, S.APPROVED], S.WITHDRAWN],
    approve: [[S.SUBMITTED], S.APPROVED],
    return: [[S.SUBMITTED, S.APPROVED], S.RETURNED],
  };
  const regra = mapa[action];
  if (!regra) return { error: t('Ação desconhecida.') };
  return regra[0].includes(status || null) ? { status: regra[1] } : { error: t('Esta ação não vale para o elenco agora.') };
}

/**
 * O que a página mostra: as federações com elenco aprovado, nome e categoria
 * de cada atleta (sem uid). `key` é opaca (o servidor a deriva da filiação):
 * é por ela que a exclusão de conta acha a linha da pessoa.
 */
export function cupTeamsPublic(cup, teams = []) {
  const cats = normalizeCupCategories(cup?.categories);
  const ordem = (id) => cats.findIndex((c) => c.id === id);
  return lista(teams).filter((x) => x && x.status === CUP_TEAM_STATUS.APPROVED).map((x) => ({
    federation_name: str(x.federation_name, 120),
    acronym: str(x.acronym, 20),
    athletes: lista(x.athletes).filter((a) => ordem(a.category_id) >= 0)
      .map((a) => ({ key: str(a.key, 20), name: str(a.name, 120), category_id: a.category_id }))
      .sort((a, b) => ordem(a.category_id) - ordem(b.category_id) || a.name.localeCompare(b.name, 'pt-BR')),
  })).sort((a, b) => (a.acronym || a.federation_name).localeCompare(b.acronym || b.federation_name, 'pt-BR'));
}
