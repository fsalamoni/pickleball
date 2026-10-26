/**
 * Eleições do clube no SERVIDOR (Firestore falso): só a administração monta e publica o edital;
 * o colégio é "um associado, um voto" (plano com direito a voto, em dia, sem suspensão);
 * chapa, apoio, impugnação e defesa pelo calendário; a comissão conduz; o VOTO É SECRETO (a
 * cédula não leva uid e fica numa coleção que ninguém lê); apuração, ata no acervo e a POSSE
 * dos eleitos como cargos do clube; `overview` entrega a cada pessoa só o que ela pode ver.
 */
import { describe, it, expect } from 'vitest';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const ce = require('./clubElections.js');
const P = require('./clubElectionsPolicy.js');
const E = require('./federationElectionsPolicy.js');
const m = require('./federationMembership.js');
const { createFakeDb } = require('../tests/fakes/fakeFirestore.cjs');

const NOW = Date.UTC(2027, 2, 10, 15, 0, 0); // 10/03/2027 12:00 em Brasília
const DIA = 86400000;
const dia = (n) => m.isoDateBR(NOW + n * DIA);
const PRES = { uid: 'pres', name: 'Presidente' };
const ESP = { uid: 'esp', name: 'Comissão' };
const ANA = { uid: 'ana', name: 'Ana Souza' };
const TEO = { uid: 'teo', name: 'Teo Lima' };
const LEO = { uid: 'leo', name: 'Leo Dias' };
const CRIS = { uid: 'cris', name: 'Cris Melo' };
const BIA = { uid: 'bia', name: 'Bia Costa' };
const DAN = { uid: 'dan', name: 'Dan Alves' };
const EVE = { uid: 'eve', name: 'Eve (sem voto)' };
const FORA = { uid: 'fora', name: 'Fora do clube' };

const aff = (uid, nome, extra = {}) => ({ club_id: 'c1', user_id: uid, user_name: nome, status: 'active', votes: true, valid_from: '2026-01-01', valid_until: '', ...extra });

function cenario({ flag = true, associacao = true, extra = {} } = {}) {
  const docs = {
    'platform_settings/global': { feature_flags: { club_association: flag } },
    'clubs/c1': { name: 'Clube Pickle Sul', association: { enabled: associacao, published: true } },
    'club_members/c1_pres': { club_id: 'c1', user_id: 'pres', role: 'admin' },
    'club_members/c1_esp': { club_id: 'c1', user_id: 'esp', role: 'member' },
    'club_x/c1/staff/esp': { club_id: 'c1', user_id: 'esp', perms: ['sports'], term_end_ms: 0 },
  };
  [ANA, TEO, LEO, CRIS, BIA, DAN, EVE].forEach((p) => {
    docs[`club_members/c1_${p.uid}`] = { club_id: 'c1', user_id: p.uid, user_name: p.name, role: 'member' };
    docs[`users/${p.uid}`] = { platform_name: p.name, birth_date: '1990-04-04' };
    docs[`club_x/c1/aff/${p.uid}`] = aff(p.uid, p.name, p.uid === 'eve' ? { votes: false } : {});
  });
  return createFakeDb({ ...docs, ...extra });
}

const ctx = (db, now = NOW) => ({ db, bucket: null, now, Timestamp: { fromMillis: (ms) => ({ ms, toMillis: () => ms }) }, FieldValue: { delete: () => undefined, increment: (n) => n }, logger: { info() {}, warn() {} } });
const chamar = (db, actor, data, now) => ce.elections(ctx(db, now), actor, { clubId: 'c1', ...data });
const doc = (db, path) => db.store.docs.get(path);
const avisosPara = (db, uid) => [...db.store.docs.entries()].filter(([p, d]) => p.startsWith('notifications/') && d.user_id === uid).map(([, d]) => d);
const dePrefixo = (db, prefixo) => [...db.store.docs.entries()].filter(([p]) => p.startsWith(prefixo));

const EDITAL = {
  title: 'Eleição da diretoria 2027',
  description: 'Mandato de dois anos.',
  positions: [{ label: 'Diretoria', kind: 'slate', organ: 'board', gender_min: 0 }],
  calendar: { notice_on: dia(0), candidacy_from: dia(0), candidacy_to: dia(2), challenge_to: dia(3), defense_to: dia(4), voting_from: dia(5), voting_to: dia(5), result_on: dia(6) },
  college: { min_months: 0 },
  endorsement_pct: 5,
  mode: 'online',
  tie_rule: 'oldest',
  notice_min_days: 0,
  commission: [{ uid: 'esp', name: 'Comissão' }],
};
const CHAPA_A = { position_id: 'c1', name: 'Chapa Ace', platform: 'Mais quadras.', members: [{ uid: 'ana', name: 'Ana Souza', role: 'Presidente', gender: 'f' }, { uid: 'teo', name: 'Teo Lima', role: 'Vice', gender: 'm' }] };
const CHAPA_B = { position_id: 'c1', name: 'Chapa Dink', platform: 'Mais torneios.', members: [{ uid: 'leo', name: 'Leo Dias', role: 'Presidente', gender: 'm' }, { uid: 'cris', name: 'Cris Melo', role: 'Vice', gender: 'f' }] };

async function publicada(db, extra = {}) {
  const { electionId } = await chamar(db, PRES, { action: 'create', election: { ...EDITAL, ...extra } });
  await chamar(db, PRES, { action: 'publish', electionId });
  return electionId;
}
/** A eleição com as duas chapas aceitas (apoiadas e julgadas) e pronta para abrir a votação. */
async function comChapas(db, extra = {}) {
  const electionId = await publicada(db, extra);
  const a = await chamar(db, ANA, { action: 'candidacy_submit', electionId, candidacy: CHAPA_A });
  const b = await chamar(db, LEO, { action: 'candidacy_submit', electionId, candidacy: CHAPA_B });
  await chamar(db, BIA, { action: 'endorse', electionId, candidacyId: a.candidacyId });
  await chamar(db, DAN, { action: 'endorse', electionId, candidacyId: b.candidacyId });
  await chamar(db, ESP, { action: 'judge', electionId, candidacyId: a.candidacyId, decision: 'accept' });
  await chamar(db, ESP, { action: 'judge', electionId, candidacyId: b.candidacyId, decision: 'accept' });
  return { electionId, a: a.candidacyId, b: b.candidacyId };
}
const abreVotacao = E.brMs(dia(5), '09:00');
const fechaVotacao = E.brMs(dia(5), '18:30');

describe('eleições do clube: quem pode e o edital', () => {
  it('flag desligada, associação fechada e ação desconhecida são recusadas; só a administração monta o edital', async () => {
    await expect(chamar(cenario({ flag: false }), PRES, { action: 'overview' })).rejects.toMatchObject({ code: 'failed-precondition' });
    await expect(chamar(cenario({ associacao: false }), PRES, { action: 'overview' })).rejects.toMatchObject({ code: 'failed-precondition' });
    const db = cenario();
    await expect(chamar(db, PRES, { action: 'nada' })).rejects.toMatchObject({ code: 'invalid-argument' });
    await expect(chamar(db, ESP, { action: 'create', election: EDITAL })).rejects.toMatchObject({ code: 'permission-denied' });
    await expect(chamar(db, ANA, { action: 'create', election: EDITAL })).rejects.toMatchObject({ code: 'permission-denied' });
    await expect(chamar(db, PRES, { action: 'create', election: EDITAL })).resolves.toMatchObject({ ok: true });
  });

  it('o colégio é de pesos iguais, qualquer peso mandado pela tela é ignorado, e a comissão é de membros do clube', async () => {
    const db = cenario();
    const { electionId } = await chamar(db, PRES, { action: 'create', election: { ...EDITAL, college: { min_months: 0, weights: { athlete: 1, club: 6, arena: 6 } } } });
    expect(doc(db, `club_x/c1/elections/${electionId}`).college.weights).toEqual(P.CLUB_WEIGHTS);
    await expect(chamar(db, PRES, { action: 'create', election: { ...EDITAL, commission: [{ uid: 'fora', name: 'Fora' }] } })).rejects.toMatchObject({ code: 'failed-precondition' });
  });

  it('a prévia conta só quem tem plano com voto, em dia e sem suspensão', async () => {
    const db = cenario({ extra: {
      'club_x/c1/aff/dan': aff('dan', 'Dan Alves', { discipline_until_ms: NOW + DIA }),
      'club_x/c1/aff/bia': aff('bia', 'Bia Costa', { valid_until: dia(-3) }),
    } });
    const r = await chamar(db, PRES, { action: 'preview', election: EDITAL });
    // ana, teo, leo, cris: eve não tem voto no plano, dan está suspenso e bia venceu.
    expect(r.balance.voters).toBe(4);
    expect(r.endorsements_needed).toBe(1);
  });

  it('o prazo mínimo de associação (min_months) tira quem entrou há pouco', async () => {
    const db = cenario({ extra: { 'club_x/c1/aff/dan': aff('dan', 'Dan Alves', { valid_from: dia(-10) }) } });
    const r = await chamar(db, PRES, { action: 'preview', election: { ...EDITAL, college: { min_months: 6 } } });
    expect(r.balance.voters).toBe(5);
  });

  it('publicar guarda o edital no acervo (só associados), avisa os associados em dia e não se repete', async () => {
    const db = cenario();
    const { electionId } = await chamar(db, PRES, { action: 'create', election: EDITAL });
    const r = await chamar(db, PRES, { action: 'publish', electionId });
    expect(r.noticeCode).toMatch(/Edital nº 1\/2027|nº 1\/2027/);
    const e = doc(db, `club_x/c1/elections/${electionId}`);
    expect(e).toMatchObject({ status: 'published', public: true, endorsements_needed: 1 });
    const ato = doc(db, `club_x/c1/docs/${e.notice_doc_id}`);
    expect(ato).toMatchObject({ type: 'convocation', status: 'published', visibility: 'members', members: true, pub: false });
    expect(ato.body).toContain('Um associado, um voto');
    expect(avisosPara(db, 'ana').some((n) => /edital de eleição/.test(n.title))).toBe(true);
    expect(avisosPara(db, 'eve').some((n) => /edital de eleição/.test(n.title))).toBe(true); // eve é associada em dia (sem voto no plano): o aviso é de todos
    await expect(chamar(db, PRES, { action: 'publish', electionId })).rejects.toMatchObject({ code: 'failed-precondition' });
  });

  it('sem nenhum plano com direito a voto não há o que publicar', async () => {
    const db = cenario();
    [ANA, TEO, LEO, CRIS, BIA, DAN, EVE].forEach((p) => db.store.docs.set(`club_x/c1/aff/${p.uid}`, aff(p.uid, p.name, { votes: false })));
    const { electionId } = await chamar(db, PRES, { action: 'create', election: EDITAL });
    await expect(chamar(db, PRES, { action: 'publish', electionId })).rejects.toMatchObject({ code: 'failed-precondition', message: expect.stringMatching(/direito a voto/) });
  });
});

describe('eleições do clube: chapas', () => {
  it('registra a chapa só no prazo, só com associados em dia, uma chapa por pessoa e fora da comissão', async () => {
    const db = cenario({ extra: { 'club_x/c1/aff/cris': aff('cris', 'Cris Melo', { status: 'expired' }) } });
    const electionId = await publicada(db);
    await expect(chamar(db, FORA, { action: 'candidacy_submit', electionId, candidacy: CHAPA_A })).rejects.toMatchObject({ code: 'permission-denied' });
    await expect(chamar(db, LEO, { action: 'candidacy_submit', electionId, candidacy: CHAPA_B })).rejects.toMatchObject({ code: 'failed-precondition', message: expect.stringMatching(/Cris Melo/) });
    const ok = await chamar(db, ANA, { action: 'candidacy_submit', electionId, candidacy: CHAPA_A });
    expect(doc(db, `club_x/c1/candidacies/${ok.candidacyId}`)).toMatchObject({ status: 'submitted', public: false, member_uids: ['ana', 'teo'] });
    await expect(chamar(db, TEO, { action: 'candidacy_submit', electionId, candidacy: { ...CHAPA_A, name: 'Outra' } })).rejects.toMatchObject({ code: 'failed-precondition', message: expect.stringMatching(/outra chapa/) });
    await expect(chamar(db, ANA, { action: 'candidacy_submit', electionId, candidacy: { ...CHAPA_A, members: [...CHAPA_A.members.slice(0, 1), { uid: 'esp', name: 'Comissão', role: 'Vice', gender: 'm' }] } })).rejects.toMatchObject({ code: 'failed-precondition' });
    await expect(chamar(db, ANA, { action: 'candidacy_submit', electionId, candidacy: CHAPA_A }, NOW + 3 * DIA)).rejects.toMatchObject({ code: 'failed-precondition', message: expect.stringMatching(/não está aberto/) });
  });

  it('o apoio vem de quem vota, uma vez por cargo, e a chapa só é aceita com os apoios do edital', async () => {
    const db = cenario();
    const electionId = await publicada(db);
    const { candidacyId } = await chamar(db, ANA, { action: 'candidacy_submit', electionId, candidacy: CHAPA_A });
    await expect(chamar(db, ESP, { action: 'judge', electionId, candidacyId, decision: 'accept' })).rejects.toMatchObject({ message: expect.stringMatching(/apoios exigidos/) });
    await expect(chamar(db, EVE, { action: 'endorse', electionId, candidacyId })).rejects.toMatchObject({ code: 'permission-denied' });
    await expect(chamar(db, TEO, { action: 'endorse', electionId, candidacyId })).rejects.toMatchObject({ code: 'failed-precondition' });
    await expect(chamar(db, BIA, { action: 'endorse', electionId, candidacyId })).resolves.toMatchObject({ ok: true, count: 1, needed: 1 });
    await expect(chamar(db, BIA, { action: 'endorse', electionId, candidacyId })).rejects.toMatchObject({ code: 'already-exists' });
    await expect(chamar(db, ANA, { action: 'judge', electionId, candidacyId, decision: 'accept' })).rejects.toMatchObject({ code: 'permission-denied' });
    await expect(chamar(db, ESP, { action: 'judge', electionId, candidacyId, decision: 'accept' })).resolves.toMatchObject({ status: 'accepted' });
    expect(doc(db, `club_x/c1/candidacies/${candidacyId}`).public).toBe(true);
  });

  it('impugnação, defesa e julgamento: a chapa só segue depois de a comissão decidir', async () => {
    const db = cenario();
    const { electionId, b } = await comChapas(db);
    await expect(chamar(db, EVE, { action: 'challenge', electionId, candidacyId: b, reason: 'Eve não tem direito a voto no plano.' })).rejects.toMatchObject({ code: 'permission-denied' });
    await expect(chamar(db, BIA, { action: 'challenge', electionId, candidacyId: b, reason: 'curto' })).rejects.toMatchObject({ code: 'invalid-argument' });
    const { challengeId } = await chamar(db, BIA, { action: 'challenge', electionId, candidacyId: b, reason: 'A chapa usou o nome do clube em propaganda.' });
    expect(doc(db, `club_x/c1/candidacies/${b}`).status).toBe('challenged');
    await expect(chamar(db, ESP, { action: 'open_voting', electionId }, abreVotacao)).rejects.toMatchObject({ message: expect.stringMatching(/impugnações sem julgamento|em análise/) });
    await expect(chamar(db, DAN, { action: 'defend', electionId, candidacyId: b, challengeId, defense: 'Não somos nós que a fizemos.' })).rejects.toMatchObject({ code: 'permission-denied' });
    await chamar(db, LEO, { action: 'defend', electionId, candidacyId: b, challengeId, defense: 'Não somos nós que a fizemos, foi um apoiador.' });
    await expect(chamar(db, ESP, { action: 'judge', electionId, candidacyId: b, challengeId, upheld: false, reason: 'Defesa aceita.' })).resolves.toMatchObject({ status: 'accepted' });
  });
});

describe('eleições do clube: votação secreta, apuração, ata e posse', () => {
  async function votada() {
    const db = cenario();
    const base = await comChapas(db);
    const { electionId, a, b } = base;
    await expect(chamar(db, ESP, { action: 'open_voting', electionId }, NOW)).rejects.toMatchObject({ message: expect.stringMatching(/hora de abrir/) });
    await expect(chamar(db, ANA, { action: 'open_voting', electionId }, abreVotacao)).rejects.toMatchObject({ code: 'permission-denied' });
    const aberta = await chamar(db, ESP, { action: 'open_voting', electionId }, abreVotacao);
    expect(aberta.voters).toBe(6); // ana, teo, leo, cris, bia, dan (eve não tem voto no plano)
    const voto = (p, escolha) => chamar(db, p, { action: 'vote', electionId, choices: { c1: escolha } }, abreVotacao + 1800000);
    await voto(ANA, a); await voto(TEO, a); await voto(BIA, a); await voto(DAN, a); await voto(LEO, b); await voto(CRIS, 'blank');
    return { db, electionId, a, b };
  }

  it('o voto é secreto: a cédula não leva uid nem hora, o eleitor só mostra que votou, e voto duplo ou de fora é recusado', async () => {
    const db = cenario();
    const { electionId, a } = await comChapas(db);
    await chamar(db, ESP, { action: 'open_voting', electionId }, abreVotacao);
    await expect(chamar(db, EVE, { action: 'vote', electionId, choices: { c1: a } }, abreVotacao)).rejects.toMatchObject({ code: 'permission-denied' });
    await expect(chamar(db, FORA, { action: 'vote', electionId, choices: { c1: a } }, abreVotacao)).rejects.toMatchObject({ code: 'permission-denied' });
    await expect(chamar(db, ANA, { action: 'vote', electionId, choices: { c1: 'inventada' } }, abreVotacao)).rejects.toMatchObject({ code: 'invalid-argument' });
    const r = await chamar(db, ANA, { action: 'vote', electionId, choices: { c1: a } }, abreVotacao);
    expect(r.receipt).toMatch(/^[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{4}$/);
    await expect(chamar(db, ANA, { action: 'vote', electionId, choices: { c1: a } }, abreVotacao)).rejects.toMatchObject({ code: 'already-exists' });
    const cedulas = dePrefixo(db, 'club_ballots/');
    expect(cedulas).toHaveLength(1);
    const [, cedula] = cedulas[0];
    expect(Object.keys(cedula).sort()).toEqual(['choices', 'club_id', 'election_id', 'weight']);
    expect(JSON.stringify(cedula)).not.toMatch(/ana|user|at_ms/);
    expect(doc(db, `club_x/c1/voters/${electionId}_ana`)).toMatchObject({ receipt: r.receipt, channel: 'online' });
    expect(JSON.stringify([...db.store.docs.values()].filter((d) => d.action === 'club_election_vote'))).not.toContain(a);
    await expect(chamar(db, ANA, { action: 'vote', electionId, choices: { c1: a } }, fechaVotacao)).rejects.toMatchObject({ code: 'failed-precondition' });
  });

  it('fecha, apura (brancos e nulos não são válidos), publica a ata no acervo e avisa', async () => {
    const { db, electionId, a } = await votada();
    await expect(chamar(db, ESP, { action: 'close_voting', electionId }, abreVotacao + 3600000)).rejects.toMatchObject({ message: expect.stringMatching(/ainda não terminou/) });
    await chamar(db, ESP, { action: 'close_voting', electionId }, fechaVotacao);
    const apurado = await chamar(db, ESP, { action: 'count', electionId }, fechaVotacao);
    expect(apurado.results[0]).toMatchObject({ valid: 5, blank: 1, total: 6 });
    expect(apurado.results[0].items.find((i) => i.candidacy_id === a)).toMatchObject({ weight: 4, elected: true });
    const r = await chamar(db, ESP, { action: 'publish_result', electionId }, fechaVotacao);
    expect(r.notified).toBeGreaterThan(0);
    const e = doc(db, `club_x/c1/elections/${electionId}`);
    expect(e).toMatchObject({ status: 'closed', governance_applied: false, voted_count: 6 });
    expect(doc(db, `club_x/c1/docs/${e.minutes_doc_id}`)).toMatchObject({ type: 'minutes', visibility: 'members' });
    expect(e.minutes_text).toContain('Chapa Ace: 4 (eleita)');
  });

  it('a posse dá o cargo do clube SÓ a quem foi eleito, só pela administração, e o resultado vem antes', async () => {
    const { db, electionId } = await votada();
    await expect(chamar(db, PRES, { action: 'apply_governance', electionId, appointments: [{ userId: 'ana', roleId: 'president' }] }, fechaVotacao)).rejects.toMatchObject({ code: 'failed-precondition' });
    await chamar(db, ESP, { action: 'close_voting', electionId }, fechaVotacao);
    await chamar(db, ESP, { action: 'publish_result', electionId }, fechaVotacao);
    await expect(chamar(db, ESP, { action: 'apply_governance', electionId, appointments: [{ userId: 'ana', roleId: 'president' }] }, fechaVotacao)).rejects.toMatchObject({ code: 'permission-denied' });
    await expect(chamar(db, PRES, { action: 'apply_governance', electionId, appointments: [{ userId: 'leo', roleId: 'president' }] }, fechaVotacao)).rejects.toMatchObject({ message: expect.stringMatching(/só de quem foi eleito/) });
    await expect(chamar(db, PRES, { action: 'apply_governance', electionId, appointments: [] }, fechaVotacao)).rejects.toMatchObject({ code: 'invalid-argument' });
    await expect(chamar(db, PRES, { action: 'apply_governance', electionId, appointments: [{ userId: 'ana', roleId: 'inexistente' }] }, fechaVotacao)).rejects.toMatchObject({ code: 'not-found' });
    const r = await chamar(db, PRES, { action: 'apply_governance', electionId, appointments: [{ userId: 'ana', roleId: 'president' }, { userId: 'teo', roleId: 'vice' }] }, fechaVotacao);
    expect(r.appointed).toBe(2);
    expect(doc(db, 'club_x/c1/staff/ana')).toMatchObject({ role_id: 'president', is_master: true });
    expect(doc(db, 'club_x/c1/staff/teo')).toMatchObject({ role_id: 'vice' });
    expect(doc(db, `club_x/c1/elections/${electionId}`)).toMatchObject({ governance_applied: true });
    expect(avisosPara(db, 'teo').some((n) => /Vice-presidente|vice/i.test(n.title))).toBe(true);
  });

  it('eleição presencial: o app não recebe voto; a mesa é lançada depois de encerrar, com os totais fechando com quem votou', async () => {
    const db = cenario();
    const { electionId, a, b } = await comChapas(db, { mode: 'presential' });
    await chamar(db, ESP, { action: 'open_voting', electionId }, abreVotacao);
    await expect(chamar(db, ANA, { action: 'vote', electionId, choices: { c1: a } }, abreVotacao)).rejects.toMatchObject({ code: 'failed-precondition' });
    await expect(chamar(db, ESP, { action: 'record_presential', electionId, voterIds: [`${electionId}_ana`], totals: { c1: { [a]: 1 } } }, abreVotacao)).rejects.toMatchObject({ code: 'failed-precondition' });
    await chamar(db, ESP, { action: 'close_voting', electionId }, fechaVotacao);
    await expect(chamar(db, ESP, { action: 'publish_result', electionId }, fechaVotacao)).rejects.toMatchObject({ message: expect.stringMatching(/votação presencial/) });
    await expect(chamar(db, ESP, { action: 'record_presential', electionId, voterIds: [`${electionId}_ana`, `${electionId}_teo`], totals: { c1: { [a]: 1 } } }, fechaVotacao)).rejects.toMatchObject({ message: expect.stringMatching(/totais somam 1/) });
    await expect(chamar(db, ESP, { action: 'record_presential', electionId, voterIds: [`${electionId}_fora`], totals: { c1: {} } }, fechaVotacao)).rejects.toMatchObject({ code: 'invalid-argument' });
    const r = await chamar(db, ESP, { action: 'record_presential', electionId, voterIds: [`${electionId}_ana`, `${electionId}_teo`, `${electionId}_bia`], totals: { c1: { [a]: 2, [b]: 1 } } }, fechaVotacao);
    expect(r).toMatchObject({ voters: 3, weight: 3 });
    await expect(chamar(db, ESP, { action: 'record_presential', electionId, voterIds: [`${electionId}_dan`], totals: { c1: { [a]: 1 } } }, fechaVotacao)).rejects.toMatchObject({ message: expect.stringMatching(/já foi lançada/) });
    const res = await chamar(db, ESP, { action: 'publish_result', electionId }, fechaVotacao);
    expect(res.results[0].items.find((i) => i.candidacy_id === a)).toMatchObject({ weight: 2, elected: true });
    expect(dePrefixo(db, 'club_ballots/')).toHaveLength(0);
  });
});

describe('eleições do clube: cada pessoa lê só o que pode (overview)', () => {
  it('quem não é do clube não vê nada; o associado vê o edital publicado e as chapas aceitas, não o rascunho nem o colégio', async () => {
    const db = cenario();
    const { electionId } = await chamar(db, PRES, { action: 'create', election: EDITAL });
    expect((await chamar(db, FORA, { action: 'overview' }))).toMatchObject({ member: false, elections: [], candidacies: [] });
    expect((await chamar(db, ANA, { action: 'overview' })).elections).toHaveLength(0); // rascunho: só administração e comissão
    expect((await chamar(db, ESP, { action: 'overview' })).elections).toHaveLength(1); // a comissão vê
    await chamar(db, PRES, { action: 'publish', electionId });
    const a = await chamar(db, ANA, { action: 'candidacy_submit', electionId, candidacy: CHAPA_A });
    const v = await chamar(db, DAN, { action: 'overview' });
    expect(v.elections).toHaveLength(1);
    expect(v.candidacies).toHaveLength(0); // chapa em análise não é pública
    expect(v.voters).toHaveLength(0);
    const dona = await chamar(db, ANA, { action: 'overview' });
    expect(dona.candidacies).toHaveLength(1); // a própria chapa ela vê
    expect(dona.mine.candidacies[0].id).toBe(a.candidacyId);
    const comissao = await chamar(db, ESP, { action: 'overview' });
    expect(comissao.candidacies).toHaveLength(1);
    // nada de Timestamp no que volta ao navegador
    expect(JSON.stringify(comissao)).not.toContain('toMillis');
  });

  it('o colégio congelado vai só à comissão (e à administração sem comissão); cada um vê a própria linha', async () => {
    const db = cenario();
    const { electionId } = await comChapas(db);
    await chamar(db, ESP, { action: 'open_voting', electionId }, abreVotacao);
    const com = await chamar(db, ESP, { action: 'overview' }, abreVotacao);
    expect(com.voters).toHaveLength(6);
    const adm = await chamar(db, PRES, { action: 'overview' }, abreVotacao);
    expect(adm.voters).toHaveLength(0); // há comissão: a administração lê a eleição, não o colégio
    const eu = await chamar(db, DAN, { action: 'overview' }, abreVotacao);
    expect(eu.voters).toHaveLength(0);
    expect(eu.mine.voters).toHaveLength(1);
    expect(eu.mine.voters[0]).toMatchObject({ user_id: 'dan', voted_at_ms: null });
  });
});

describe('eleições do clube: a política pura', () => {
  it('o colégio e o direito a voto seguem a mesma conta', () => {
    const hoje = '2027-03-10';
    const roll = P.buildClubRoll({ affs: [aff('a', 'A'), aff('b', 'B', { votes: false }), aff('c', 'C', { status: 'pending' }), aff('d', 'D', { valid_until: '2027-03-01' }), aff('a', 'A de novo')], election: { id: 'e1', college: { min_months: 0 } }, hoje, nowMs: NOW });
    expect(roll).toEqual([{ id: 'e1_a', user_id: 'a', name: 'A', category: 'athlete', weight: 1, kind: 'person', org_id: null }]);
    expect(P.clubCandidateEligible(aff('b', 'B', { votes: false }), { hoje, nowMs: NOW })).toBe(true);
    expect(P.clubVoterEligible(aff('b', 'B', { votes: false }), { hoje, nowMs: NOW })).toBe(false);
  });

  it('quem foi eleito sai com o uid, para a posse', () => {
    const positions = [{ id: 'c1', label: 'Diretoria', kind: 'slate', organ: 'board' }];
    const candidacies = [{ id: 'x', members: [{ uid: 'ana', name: 'Ana', role: 'Presidente' }, { uid: 'teo', name: 'Teo', role: 'Vice' }] }, { id: 'y', members: [{ uid: 'leo', name: 'Leo', role: 'Presidente' }] }];
    const results = [{ position_id: 'c1', label: 'Diretoria', items: [{ candidacy_id: 'x', elected: true }, { candidacy_id: 'y', elected: false }] }];
    expect(P.electedPeople(results, positions, candidacies).map((p) => [p.uid, p.role, p.organ])).toEqual([['ana', 'Presidente', 'board'], ['teo', 'Vice', 'board']]);
  });
});
