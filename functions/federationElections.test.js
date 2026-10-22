/**
 * Eleições no SERVIDOR contra um Firestore falso: quem age em cada passo
 * (admin publica, a comissão conduz), o edital e a ata no acervo, as chapas
 * (apoio, impugnação com defesa prévia, julgamento), o colégio congelado, o
 * voto com PESO, o voto duplo recusado e — o requisito central — o SIGILO:
 * nada na cédula, na auditoria nem nos avisos liga a cédula ao eleitor.
 */
import { describe, it, expect } from 'vitest';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const el = require('./federationElections.js');
const { createFakeDb } = require('../tests/fakes/fakeFirestore.cjs');

const T = (y, m, d, h = 15) => Date.UTC(y, m - 1, d, h, 0);
const NOW = T(2026, 10, 22);
const PRES = { uid: 'pres', name: 'Presidente' };
const SEC = { uid: 'sec', name: 'Secretaria' };
const COM = { uid: 'com1', name: 'Carla Comissão' };
const ANA = { uid: 'ana', name: 'Ana' };
const BIA = { uid: 'bia', name: 'Bia' };
const EVA = { uid: 'eva', name: 'Eva' };
const GIL = { uid: 'gil', name: 'Gil' };
const REP = { uid: 'rep', name: 'Representante do clube' };

const membro = (uid, extra = {}) => ({ federation_id: 'fpp', user_id: uid, user_name: uid.toUpperCase(), status: 'active', person_type: 'athlete', valid_from: '2025-01-10', ...extra });

function cenario(mods = { elections: true, official_docs: true }) {
  const seed = {
    'platform_settings/global': { feature_flags: { federations: true } },
    'federations/fpp': { name: 'Federação Paulista', acronym: 'FPP', slug: 'fpp', status: 'approved', published: true, modules: mods, governance: { statute_url: 'https://x.org/estatuto.pdf' } },
    'federation_staff/fpp_pres': { federation_id: 'fpp', user_id: 'pres', role: 'president' },
    'federation_staff/fpp_sec': { federation_id: 'fpp', user_id: 'sec', role: 'secretary' },
    'federation_affiliations/fpp_club_k1': { federation_id: 'fpp', kind: 'club', org_id: 'k1', org_name: 'Clube K1', requested_by: 'rep', status: 'approved', review: { by: 'pres', at_ms: T(2025, 1, 1) } },
    'users/ana': { birth_date: '1980-05-01' },
    'users/eva': { birth_date: '1990-05-01' },
  };
  ['ana', 'bia', 'caio', 'eva', 'fabio', 'gil', 'hugo', 'iris'].forEach((u) => { seed[`federation_members/fpp_${u}`] = membro(u); });
  seed['federation_members/fpp_duda'] = membro('duda', { person_type: 'coach' });
  seed['federation_members/fpp_novo'] = membro('novo', { valid_from: '2026-10-01' });
  seed['federation_members/fpp_dep'] = { ...membro('x'), user_id: null, guardian_uid: 'ana' };
  return { db: createFakeDb(seed) };
}
const ctx = ({ db }, now = NOW) => ({ db, now, Timestamp: { fromMillis: (ms) => ({ ms }) }, logger: { info() {}, warn() {} } });
const chamar = (c, actor, data, now) => el.elections(ctx(c, now), actor, { federationId: 'fpp', ...data });
const doc = (c, path) => c.db.store.docs.get(path);
const docs = (c, prefix) => [...c.db.store.docs.entries()].filter(([p]) => p.startsWith(`${prefix}/`)).map(([p, d]) => ({ id: p.split('/')[1], ...d }));

const edital = (extra = {}) => ({
  title: 'Eleições 2027–2030', description: 'Diretoria e conselho fiscal.', mode: 'online', tie_rule: 'oldest', endorsement_pct: 5, notice_min_days: 30,
  positions: [{ label: 'Diretoria executiva', kind: 'slate', organ: 'board' }],
  calendar: { notice_on: '2026-10-22', candidacy_from: '2026-10-23', candidacy_to: '2026-11-06', challenge_to: '2026-11-11', defense_to: '2026-11-16', voting_from: '2026-12-06', voting_to: '2026-12-06', result_on: '2026-12-07', inauguration_on: '2027-01-01', voting_opens: '08:00', voting_closes: '18:00' },
  college: { min_months: 6, weights: { athlete: 1, coach: 1, referee: 1, club: 3, arena: 3 } },
  commission: [{ uid: 'com1', name: 'Carla Comissão' }],
  ...extra,
});
const chapa = (members, name) => ({ position_id: 'c1', name, platform: 'Mais torneios no interior.', members: members.map(([uid, role, gender]) => ({ uid, name: uid.toUpperCase(), role, gender })) });

const ABRE = T(2026, 12, 6, 11);
const FECHA = T(2026, 12, 6, 21);

/** Edital publicado, duas chapas aceitas (A: ana+caio; B: eva+fabio). */
async function ateVotacao(c, extra) {
  const { electionId } = await chamar(c, PRES, { action: 'create', election: edital(extra) });
  await chamar(c, PRES, { action: 'publish', electionId });
  const em = T(2026, 10, 25);
  const a = await chamar(c, ANA, { action: 'candidacy_submit', electionId, candidacy: chapa([['ana', 'Presidente', 'f'], ['caio', 'Vice', 'm']], 'Chapa Avança') }, em);
  const b = await chamar(c, EVA, { action: 'candidacy_submit', electionId, candidacy: chapa([['eva', 'Presidente', 'f'], ['fabio', 'Vice', 'm']], 'Chapa Base') }, em);
  await chamar(c, BIA, { action: 'endorse', electionId, candidacyId: a.candidacyId }, em);
  await chamar(c, GIL, { action: 'endorse', electionId, candidacyId: b.candidacyId }, em);
  const julga = T(2026, 11, 7);
  await chamar(c, COM, { action: 'judge', electionId, candidacyId: a.candidacyId, decision: 'accept' }, julga);
  await chamar(c, COM, { action: 'judge', electionId, candidacyId: b.candidacyId, decision: 'accept' }, julga);
  return { electionId, A: a.candidacyId, B: b.candidacyId };
}

describe('eleições: edital', () => {
  it('só o admin cria e publica; módulo desligado recusa', async () => {
    const c = cenario();
    await expect(chamar(c, SEC, { action: 'create', election: edital() })).rejects.toMatchObject({ code: 'permission-denied' });
    await expect(chamar(cenario({ official_docs: true }), PRES, { action: 'create', election: edital() })).rejects.toMatchObject({ code: 'failed-precondition' });
    await expect(chamar(c, PRES, { action: 'create', election: edital({ endorsement_pct: 8 }) })).rejects.toMatchObject({ code: 'invalid-argument' });
    const { electionId } = await chamar(c, PRES, { action: 'create', election: edital() });
    expect(doc(c, `federation_elections/${electionId}`)).toMatchObject({ status: 'draft', public: false, commission_uids: ['com1'] });
  });

  it('prévia do colégio: quem vota hoje, o peso de cada grupo e a checagem de 1/3', async () => {
    const c = cenario();
    const r = await chamar(c, PRES, { action: 'preview', election: edital() });
    // 8 atletas há mais de 6 meses (o "novo" não, o dependente não) + 1 professor + o clube (peso 3).
    expect(r.balance).toMatchObject({ voters: 10, total_weight: 12, athletes_ok: true });
    expect(r.balance.by_category.club).toMatchObject({ voters: 1, weight: 3 });
    expect(r.balance.small).toEqual(['coach', 'club']);
    expect(r.endorsements_needed).toBe(1);
    const pesado = await chamar(c, PRES, { action: 'preview', election: edital({ college: { min_months: 6, weights: { athlete: 1, coach: 6, club: 6 } } }) });
    expect(pesado.balance.athletes_ok).toBe(true);
  });

  it('publicar: edital no acervo (numerado), aviso aos filiados, apoios exigidos', async () => {
    const c = cenario();
    const { electionId } = await chamar(c, PRES, { action: 'create', election: edital() });
    const r = await chamar(c, PRES, { action: 'publish', electionId });
    const e = doc(c, `federation_elections/${electionId}`);
    expect(e).toMatchObject({ status: 'published', public: true, endorsements_needed: 1, notice_code: 'Edital de convocação nº 1/2026' });
    expect(doc(c, `federation_docs/${e.notice_doc_id}`)).toMatchObject({ status: 'published', type: 'convocation', visibility: 'public' });
    expect(e.notice_text).toMatch(/1\/3/);
    expect(r.notified).toBe(10);
    await expect(chamar(c, PRES, { action: 'publish', electionId })).rejects.toMatchObject({ code: 'failed-precondition' });
  });

  it('publicado, só calendário/colégio mudam e com motivo; cancelar avisa', async () => {
    const c = cenario();
    const { electionId } = await chamar(c, PRES, { action: 'create', election: edital() });
    await chamar(c, PRES, { action: 'publish', electionId });
    await expect(chamar(c, PRES, { action: 'update', electionId, election: { college: { min_months: 3, weights: { athlete: 2 } } } })).rejects.toMatchObject({ code: 'invalid-argument' });
    await chamar(c, PRES, { action: 'update', electionId, election: { college: { min_months: 3, weights: { athlete: 2, club: 3 } }, positions: [] }, reason: 'Ajuste pedido pela assembleia' });
    const e = doc(c, `federation_elections/${electionId}`);
    expect(e.college.min_months).toBe(3);
    expect(e.positions).toHaveLength(1);
    await chamar(c, PRES, { action: 'cancel', electionId, reason: 'Decisão judicial suspendeu o pleito' });
    expect(doc(c, `federation_elections/${electionId}`).status).toBe('cancelled');
  });
});

describe('eleições: chapas', () => {
  it('registro na janela, filiados ativos, sem membro da comissão e sem repetir pessoa', async () => {
    const c = cenario();
    const { electionId } = await chamar(c, PRES, { action: 'create', election: edital() });
    await chamar(c, PRES, { action: 'publish', electionId });
    const ok = chapa([['ana', 'Presidente', 'f'], ['caio', 'Vice', 'm']], 'Chapa Avança');
    await expect(chamar(c, ANA, { action: 'candidacy_submit', electionId, candidacy: ok })).rejects.toMatchObject({ code: 'failed-precondition' });
    const em = T(2026, 10, 25);
    await expect(chamar(c, ANA, { action: 'candidacy_submit', electionId, candidacy: chapa([['ana', 'P', 'f'], ['com1', 'V', 'f']], 'Com comissão') }, em)).rejects.toMatchObject({ code: 'failed-precondition' });
    await expect(chamar(c, BIA, { action: 'candidacy_submit', electionId, candidacy: ok }, em)).rejects.toMatchObject({ code: 'permission-denied' });
    const r = await chamar(c, ANA, { action: 'candidacy_submit', electionId, candidacy: ok }, em);
    expect(doc(c, `federation_candidacies/${r.candidacyId}`)).toMatchObject({ status: 'submitted', public: false, member_uids: ['ana', 'caio'], endorsement_count: 0 });
    await expect(chamar(c, EVA, { action: 'candidacy_submit', electionId, candidacy: chapa([['eva', 'P', 'f'], ['caio', 'V', 'm']], 'Outra') }, em)).rejects.toMatchObject({ code: 'failed-precondition' });
  });

  it('apoio: um por cargo, só eleitor, conta para aceitar; o admin não julga com comissão nomeada', async () => {
    const c = cenario();
    const { electionId } = await chamar(c, PRES, { action: 'create', election: edital() });
    await chamar(c, PRES, { action: 'publish', electionId });
    const em = T(2026, 10, 25);
    const { candidacyId } = await chamar(c, ANA, { action: 'candidacy_submit', electionId, candidacy: chapa([['ana', 'P', 'f'], ['caio', 'V', 'm']], 'Chapa Avança') }, em);
    await expect(chamar(c, COM, { action: 'judge', electionId, candidacyId, decision: 'accept' }, em)).rejects.toMatchObject({ code: 'failed-precondition' });
    await expect(chamar(c, { uid: 'novo' }, { action: 'endorse', electionId, candidacyId }, em)).rejects.toMatchObject({ code: 'permission-denied' });
    await chamar(c, BIA, { action: 'endorse', electionId, candidacyId }, em);
    await expect(chamar(c, BIA, { action: 'endorse', electionId, candidacyId }, em)).rejects.toMatchObject({ code: 'already-exists' });
    expect(doc(c, `federation_election_endorsements/${electionId}_c1_bia`)).toMatchObject({ user_id: 'bia', candidacy_id: candidacyId });
    await expect(chamar(c, PRES, { action: 'judge', electionId, candidacyId, decision: 'accept' }, em)).rejects.toMatchObject({ code: 'permission-denied' });
    await chamar(c, COM, { action: 'judge', electionId, candidacyId, decision: 'accept' }, em);
    expect(doc(c, `federation_candidacies/${candidacyId}`)).toMatchObject({ status: 'accepted', public: true });
  });

  it('impugnação: julgada só depois da defesa (ou do prazo), e a chapa volta a valer', async () => {
    const c = cenario();
    const { electionId, A } = await ateVotacao(c);
    const em = T(2026, 11, 8);
    await expect(chamar(c, GIL, { action: 'challenge', electionId, candidacyId: A, reason: 'curto' }, em)).rejects.toMatchObject({ code: 'invalid-argument' });
    const { challengeId } = await chamar(c, GIL, { action: 'challenge', electionId, candidacyId: A, reason: 'O vice não tem os seis meses de filiação exigidos.' }, em);
    expect(doc(c, `federation_candidacies/${A}`).status).toBe('challenged');
    await expect(chamar(c, COM, { action: 'judge', electionId, candidacyId: A, challengeId, upheld: false, reason: 'Filiação comprovada' }, em)).rejects.toMatchObject({ code: 'failed-precondition' });
    await chamar(c, ANA, { action: 'defend', electionId, candidacyId: A, challengeId, defense: 'Filiado desde janeiro de 2025, ver carteirinha.' }, em);
    await chamar(c, COM, { action: 'judge', electionId, candidacyId: A, challengeId, upheld: false, reason: 'Filiação comprovada' }, em);
    expect(doc(c, `federation_candidacies/${A}`).status).toBe('accepted');
  });
});

describe('eleições: votação, peso e sigilo', () => {
  async function votar(c) {
    const ids = await ateVotacao(c);
    const { electionId, A, B } = ids;
    await expect(chamar(c, COM, { action: 'open_voting', electionId }, ABRE - 60000)).rejects.toMatchObject({ code: 'failed-precondition' });
    const ab = await chamar(c, COM, { action: 'open_voting', electionId }, ABRE);
    expect(ab.voters).toBe(10);
    await chamar(c, ANA, { action: 'vote', electionId, choices: { c1: A } }, ABRE + 1000);
    await chamar(c, BIA, { action: 'vote', electionId, choices: { c1: A } }, ABRE + 2000);
    const r = await chamar(c, REP, { action: 'vote', electionId, voterId: `${electionId}_club_k1`, choices: { c1: B } }, ABRE + 3000);
    await chamar(c, GIL, { action: 'vote', electionId, choices: { c1: 'blank' } }, ABRE + 4000);
    return { ...ids, receipt: r.receipt };
  }

  it('colégio congelado na abertura (o dependente e o recém-filiado ficam de fora)', async () => {
    const c = cenario();
    const { electionId } = await ateVotacao(c);
    await chamar(c, COM, { action: 'open_voting', electionId }, ABRE);
    const voters = docs(c, 'federation_election_voters');
    expect(voters.map((v) => v.id).sort()).toContain(`${electionId}_club_k1`);
    expect(voters.find((v) => v.user_id === 'novo')).toBeUndefined();
    expect(voters.find((v) => v.id === `${electionId}_club_k1`)).toMatchObject({ user_id: 'rep', weight: 3, category: 'club', voted_at_ms: null });
    expect(doc(c, `federation_elections/${electionId}`)).toMatchObject({ status: 'voting', college_frozen: { voters: 10, total_weight: 12 } });
  });

  it('voto duplo é recusado; quem não está no colégio não vota; fora do horário, não', async () => {
    const c = cenario();
    const { electionId, A } = await votar(c);
    await expect(chamar(c, ANA, { action: 'vote', electionId, choices: { c1: A } }, ABRE + 9000)).rejects.toMatchObject({ code: 'already-exists' });
    await expect(chamar(c, { uid: 'novo' }, { action: 'vote', electionId, choices: { c1: A } }, ABRE + 9000)).rejects.toMatchObject({ code: 'permission-denied' });
    await expect(chamar(c, { uid: 'caio' }, { action: 'vote', electionId, choices: { c1: 'zzz' } }, ABRE + 9000)).rejects.toMatchObject({ code: 'invalid-argument' });
    await expect(chamar(c, { uid: 'caio' }, { action: 'vote', electionId, choices: { c1: A } }, FECHA)).rejects.toMatchObject({ code: 'failed-precondition' });
    expect(docs(c, 'federation_ballots')).toHaveLength(4);
    expect(doc(c, `federation_elections/${electionId}`)).toMatchObject({ voted_count: 4, voted_weight: 6 });
  });

  it('SIGILO: a cédula não tem uid, horário nem id derivável; auditoria e avisos não dizem em quem', async () => {
    const c = cenario();
    const { electionId, receipt } = await votar(c);
    const ballots = docs(c, 'federation_ballots');
    const uids = ['ana', 'bia', 'rep', 'gil', `${electionId}_ana`, `${electionId}_club_k1`];
    ballots.forEach((b) => {
      expect(Object.keys(b).sort()).toEqual(['choices', 'election_id', 'id', 'weight']);
      expect(b.id).toMatch(/^[0-9a-f]{32}$/);
      const bruto = JSON.stringify(b);
      uids.forEach((u) => expect(bruto).not.toContain(`"${u}"`));
    });
    // O eleitor não guarda o id da cédula: só "votou", o canal e o comprovante.
    const ana = doc(c, `federation_election_voters/${electionId}_ana`);
    expect(Object.keys(ana).sort()).toEqual(['category', 'channel', 'election_id', 'federation_id', 'kind', 'name', 'org_id', 'receipt', 'user_id', 'voted_at_ms', 'weight']);
    expect(ballots.some((b) => JSON.stringify(b).includes(ana.receipt))).toBe(false);
    expect(receipt).toMatch(/^[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{4}$/);
    // Auditoria: "votou", sem escolha.
    const votos = docs(c, 'audit_logs').filter((l) => l.action === 'federation_election_vote');
    expect(votos).toHaveLength(4);
    votos.forEach((l) => {
      expect(Object.keys(l.details).sort()).toEqual(['election_id', 'federation_id']);
      expect(JSON.stringify(l)).not.toMatch(/choices|blank|Chapa/);
    });
    // Nenhum aviso sai do voto.
    expect(docs(c, 'notifications').some((n) => /vot(ou|o registrado)/i.test(n.title))).toBe(false);
  });

  it('o PESO vale na apuração e no resultado; a ata vai ao acervo; a governança só pelo admin', async () => {
    const c = cenario();
    const { electionId, A, B } = await votar(c);
    await expect(chamar(c, COM, { action: 'close_voting', electionId }, FECHA - 60000)).rejects.toMatchObject({ code: 'failed-precondition' });
    await chamar(c, COM, { action: 'close_voting', electionId }, FECHA);
    const prev = await chamar(c, COM, { action: 'count', electionId }, FECHA + 1000);
    const pos = prev.results[0];
    expect(pos).toMatchObject({ total: 6, valid: 5, blank: 1, null: 0 });
    expect(pos.items.find((i) => i.candidacy_id === B)).toMatchObject({ weight: 3, elected: true });
    expect(pos.items.find((i) => i.candidacy_id === A)).toMatchObject({ weight: 2, elected: false });
    expect(doc(c, `federation_elections/${electionId}`).results).toBeUndefined();
    await expect(chamar(c, COM, { action: 'publish_result', electionId, applyGovernance: true }, FECHA + 2000)).rejects.toMatchObject({ code: 'permission-denied' });
    await chamar(c, COM, { action: 'publish_result', electionId }, FECHA + 2000);
    const e = doc(c, `federation_elections/${electionId}`);
    expect(e).toMatchObject({ status: 'closed', minutes_code: 'Ata nº 1/2026', totals: { voted: 4, voted_weight: 6 } });
    expect(doc(c, `federation_docs/${e.minutes_doc_id}`).body).toMatch(/Chapa Base: 3 \(eleita\)/);
    await chamar(c, PRES, { action: 'apply_governance', electionId, mandateEnd: '2030-12-31' }, FECHA + 3000);
    expect(doc(c, 'federations/fpp').governance).toMatchObject({ statute_url: 'https://x.org/estatuto.pdf', board: [{ role: 'Presidente', name: 'EVA' }, { role: 'Vice', name: 'FABIO' }], women_count: 1, mandate: { start: '2027-01-01', end: '2030-12-31' } });
  });

  it('empate pela regra do edital: o cabeça de chapa mais velho', async () => {
    const c = cenario();
    const { electionId, A } = await ateVotacao(c);
    await chamar(c, COM, { action: 'open_voting', electionId }, ABRE);
    await chamar(c, BIA, { action: 'vote', electionId, choices: { c1: A } }, ABRE + 1);
    const { B } = { B: docs(c, 'federation_candidacies').find((x) => x.name === 'Chapa Base').id };
    await chamar(c, GIL, { action: 'vote', electionId, choices: { c1: B } }, ABRE + 2);
    await chamar(c, COM, { action: 'close_voting', electionId }, FECHA);
    const r = await chamar(c, COM, { action: 'count', electionId }, FECHA + 1);
    expect(r.results[0].items.find((i) => i.elected).candidacy_id).toBe(A);
  });

  it('votação mista: a mesa lança quem votou e os totais, que precisam fechar com o peso', async () => {
    const c = cenario();
    const { electionId, A, B } = await ateVotacao(c, { mode: 'mixed' });
    await chamar(c, COM, { action: 'open_voting', electionId }, ABRE);
    await chamar(c, ANA, { action: 'vote', electionId, choices: { c1: A } }, ABRE + 1);
    await chamar(c, COM, { action: 'close_voting', electionId }, FECHA);
    await expect(chamar(c, COM, { action: 'publish_result', electionId }, FECHA + 1)).rejects.toMatchObject({ code: 'failed-precondition' });
    const ids = [`${electionId}_ana`];
    await expect(chamar(c, COM, { action: 'record_presential', electionId, voterIds: ids, totals: { c1: { [B]: 1 } } }, FECHA + 1)).rejects.toMatchObject({ code: 'failed-precondition' });
    const mesa = [`${electionId}_hugo`, `${electionId}_club_k1`];
    await expect(chamar(c, COM, { action: 'record_presential', electionId, voterIds: mesa, totals: { c1: { [B]: 3 } } }, FECHA + 1)).rejects.toMatchObject({ code: 'invalid-argument' });
    await chamar(c, COM, { action: 'record_presential', electionId, voterIds: mesa, totals: { c1: { [B]: 3, null: 1 } } }, FECHA + 1);
    expect(doc(c, `federation_election_voters/${electionId}_hugo`)).toMatchObject({ channel: 'presential', receipt: null });
    const r = await chamar(c, COM, { action: 'publish_result', electionId }, FECHA + 2);
    expect(r.results[0]).toMatchObject({ total: 5, null: 1 });
    expect(r.results[0].items.find((i) => i.elected).candidacy_id).toBe(B);
  });
});
