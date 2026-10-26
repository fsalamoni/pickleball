/**
 * ELEIÇÕES DO CLUBE-ASSOCIAÇÃO (Bloco F2) — a parte PURA que difere da federação. A régua do
 * edital, do calendário, da chapa, da cédula, da apuração e do empate é a da federação
 * (`modules/federations/domain/elections.js`, sem cópia). O clube só muda o colégio —
 * "um associado, um voto" — e o texto do edital, que é do clube.
 *
 * ⚠️ `CLUB_WEIGHTS`, `clubNoticeText` e `electedPeople` têm cópia no servidor
 * (`functions/clubElectionsPolicy.js`), com paridade em `functions/clubElections.parity.test.js`.
 */
import { electionDraft } from '@/modules/federations/domain/elections.js';

export const CLUB_WEIGHTS = Object.freeze({ athlete: 1, coach: 0, referee: 0, club: 0, arena: 0 });

/** O rascunho de uma eleição do clube: o colégio já nasce com pesos iguais. */
export function clubElectionDraft(hoje) {
  const base = electionDraft(hoje);
  return { ...base, college: { min_months: 0, weights: { ...CLUB_WEIGHTS } } };
}

const dataBr = (iso) => (iso && /^\d{4}-\d{2}-\d{2}$/.test(iso) ? `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}` : '—');
const ORGAN_TEXT = { board: 'Diretoria', fiscal: 'Conselho fiscal', athletes: 'Representação dos atletas', other: 'Outro órgão' };
const MODE_TEXT = { online: 'pelo aplicativo, com voto secreto', presential: 'presencial, com voto secreto', mixed: 'pelo aplicativo e presencial, com voto secreto' };
const TIE_TEXT = { oldest: 'vence a chapa cujo cabeça é o mais velho', earliest: 'vence a chapa registrada primeiro', runoff: 'há novo turno entre as empatadas' };

/** O texto do EDITAL do clube (a prévia do assistente; o servidor monta o mesmo ao publicar). */
export function clubNoticeText(club, e) {
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

/**
 * Quem foi eleito, com o uid (a posse dá o cargo a essas pessoas):
 * `[{ uid, name, role, position_id, label, organ }]`. Vem do resultado publicado + as chapas da eleição.
 */
export function electedPeople(results = [], positions = [], candidacies = []) {
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

/** Os cargos que a posse oferece a cada eleito: o cargo do clube mais parecido com o que a chapa declarou, para sugerir. */
export function suggestRoleFor(person, roles = []) {
  const nome = String(person?.role || person?.label || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  if (!nome) return '';
  const achado = (roles || []).find((r) => {
    const rn = String(r.name || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
    return rn && (nome.includes(rn) || rn.includes(nome));
  });
  return achado ? achado.id : '';
}
