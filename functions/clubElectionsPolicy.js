/**
 * ELEIÇÕES DO CLUBE-ASSOCIAÇÃO (Bloco F2) — a conta PURA que difere da federação.
 *
 * A régua do edital, do calendário, da chapa, da cédula, da apuração e do empate é a
 * MESMA (`federationElectionsPolicy.js`, que não foi copiada). O clube só muda o
 * colégio: "um associado, um voto" — vota quem tem a filiação ativa, em dia, sem
 * suspensão e num plano que dá direito a voto (`aff.votes`, gravado na ativação a
 * partir do plano), há ao menos `min_months`. Todo voto pesa 1 e a categoria é `athlete`
 * (a federação usa categorias com peso; o clube não), então a prévia, a cédula e a
 * apuração são as de sempre.
 *
 * Os textos do edital e da ata são do clube (registro oficial, em português).
 */
const E = require('./federationElectionsPolicy.js');
const { membershipState } = require('./federationMembership.js');

const CLUB_WEIGHTS = Object.freeze({ athlete: 1, coach: 0, referee: 0, club: 0, arena: 0 });

/** O edital do clube: o colégio é sempre de pesos iguais (só o prazo de associação muda). */
function validateClubElection(input = {}) {
  const col = input.college || {};
  return E.validateElection({ ...input, college: { min_months: col.min_months, weights: CLUB_WEIGHTS } });
}

/** A pessoa (a filiação dela) vota hoje? Mesma conta para montar o colégio e para apoiar/impugnar. */
function clubVoterEligible(aff, { hoje, nowMs, minMonths = 0 }) {
  if (!aff || !aff.user_id || aff.votes !== true) return false;
  if (membershipState(aff, hoje, nowMs).status !== 'active') return false;
  return !(minMonths > 0) || Boolean(aff.valid_from && aff.valid_from <= E.collegeCutoff(hoje, minMonths));
}

/** Pode ser da chapa: associada em dia e sem suspensão (o direito a voto do plano não é exigido). */
const clubCandidateEligible = (aff, { hoje, nowMs }) => Boolean(aff && aff.user_id) && membershipState(aff, hoje, nowMs).status === 'active';

/** O colégio de uma eleição: um voto por associado elegível. Id do eleitor: `{eleição}_{uid}`. */
function buildClubRoll({ affs = [], election, hoje, nowMs }) {
  const minMonths = Number(election && election.college && election.college.min_months) || 0;
  const eid = (election && election.id) || '';
  const vistos = new Set();
  const out = [];
  (affs || []).forEach((a) => {
    if (!clubVoterEligible(a, { hoje, nowMs, minMonths }) || vistos.has(a.user_id)) return;
    vistos.add(a.user_id);
    out.push({ id: `${eid}_${a.user_id}`, user_id: a.user_id, name: String(a.user_name || '').replace(/\s+/g, ' ').trim().slice(0, E.NAME_MAX), category: 'athlete', weight: 1, kind: 'person', org_id: null });
  });
  return out;
}

const dataBr = (iso) => (iso && /^\d{4}-\d{2}-\d{2}$/.test(iso) ? `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}` : '—');
const ORGAN_TEXT = { board: 'Diretoria', fiscal: 'Conselho fiscal', athletes: 'Representação dos atletas', other: 'Outro órgão' };
const MODE_TEXT = { online: 'pelo aplicativo, com voto secreto', presential: 'presencial, com voto secreto', mixed: 'pelo aplicativo e presencial, com voto secreto' };
const TIE_TEXT = { oldest: 'vence a chapa cujo cabeça é o mais velho', earliest: 'vence a chapa registrada primeiro', runoff: 'há novo turno entre as empatadas' };

/** O texto do EDITAL (vai para o acervo do clube e fica na eleição). */
function noticeText(club, e) {
  const c = e.calendar || {};
  const meses = e.college && e.college.min_months > 0 ? ` há ao menos ${e.college.min_months} mês(es) na abertura da votação` : '';
  const linhas = [
    `${(club && club.name) || ''} — ${e.title}`,
    '',
    `O ${(club && club.name) || 'clube'} convoca as eleições abaixo, nos termos do estatuto.`,
    e.description ? `\n${e.description}` : '',
    '',
    '1. Cargos',
    ...(e.positions || []).map((p, i) => `1.${i + 1}. ${p.label} — ${ORGAN_TEXT[p.organ] || ''}; ${p.kind === 'slate' ? 'por chapa' : `individual, ${p.seats} vaga(s)`}${p.gender_min > 0 ? `; mínimo de ${p.gender_min} de cada sexo` : ''}.`),
    '',
    '2. Calendário (horário de Brasília)',
    `Publicação do edital: ${dataBr(c.notice_on)}`,
    `Registro de chapas: de ${dataBr(c.candidacy_from)} a ${dataBr(c.candidacy_to)}`,
    `Impugnações: até ${dataBr(c.challenge_to)}; defesa: até ${dataBr(c.defense_to)}`,
    `Votação: de ${dataBr(c.voting_from)} às ${c.voting_opens || '08:00'} a ${dataBr(c.voting_to)} às ${c.voting_closes || '18:00'}`,
    `Resultado: ${dataBr(c.result_on)}${c.inauguration_on ? `; posse: ${dataBr(c.inauguration_on)}` : ''}`,
    '',
    '3. Quem vota',
    `Votam os associados em dia, com direito a voto no plano${meses}, sem suspensão disciplinar. Um associado, um voto.`,
    '',
    '4. Registro de chapas',
    e.endorsement_pct > 0 ? `Cada chapa precisa do apoio de ${e.endorsement_pct}% dos associados com direito a voto.` : 'Não se exige apoio mínimo para registrar chapa.',
    'Quem integra a comissão eleitoral não concorre. Quem tiver a candidatura impugnada apresenta defesa no prazo.',
    '',
    '5. Votação e apuração',
    `A votação é ${MODE_TEXT[e.mode] || MODE_TEXT.online}. A apuração soma os votos; brancos e nulos não são votos válidos. Em caso de empate, ${TIE_TEXT[e.tie_rule] || TIE_TEXT.oldest}.`,
    '',
    '6. Comissão eleitoral',
    (e.commission || []).length ? (e.commission || []).map((p) => p.name).join(', ') : 'A administração do clube conduz até a nomeação da comissão.',
  ];
  return linhas.filter((x, i, arr) => !(x === '' && arr[i - 1] === '')).join('\n').trim();
}

/** O texto da ATA do resultado. */
function minutesText(club, e, results = [], totals = {}) {
  const linhas = [
    `${(club && club.name) || ''} — Ata da apuração: ${e.title}`,
    '',
    `Associados com direito a voto: ${totals.voters || 0}. Votaram: ${totals.voted || 0}.`,
    '',
    ...(results || []).flatMap((r) => [
      `${r.label}: válidos ${r.valid}, brancos ${r.blank}, nulos ${r.null}.`,
      ...r.items.map((i) => `— ${i.name}: ${i.weight}${i.elected ? ' (eleita)' : ''}`),
      r.tie ? 'Empate no corte: novo turno, conforme o edital.' : '',
      '',
    ]),
    `Comissão eleitoral: ${(e.commission || []).map((p) => p.name).join(', ') || 'administração do clube'}.`,
  ];
  return linhas.filter((x, i, arr) => !(x === '' && arr[i - 1] === '')).join('\n').trim();
}

/** Quem foi eleito, com o uid (a posse dá o cargo a essas pessoas): `[{ uid, name, role, position_id, label, organ }]`. */
function electedPeople(results = [], positions = [], candidacies = []) {
  const out = [];
  (results || []).forEach((r) => {
    const p = (positions || []).find((x) => x.id === r.position_id);
    (r.items || []).filter((i) => i.elected).forEach((i) => {
      const c = (candidacies || []).find((x) => x.id === i.candidacy_id);
      ((c && c.members) || []).forEach((m) => out.push({ uid: m.uid, name: m.name, role: m.role || '', position_id: r.position_id, label: r.label, organ: p ? p.organ : 'other' }));
    });
  });
  return out;
}

module.exports = { CLUB_WEIGHTS, validateClubElection, clubVoterEligible, clubCandidateEligible, buildClubRoll, noticeText, minutesText, electedPeople };
