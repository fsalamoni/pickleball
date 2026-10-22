/**
 * Federações PR 3 no servidor (Firestore falso): dependente e menor, CPF,
 * desconto do plano, transferência (clube, federação, liberação pelo prazo),
 * curso → credencial verificável, disciplina (suspensão barra, multa cobra,
 * recurso desfaz), importação e cobrança de curso/multa.
 */
import { describe, it, expect } from 'vitest';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const fed = require('./federations.js');
const transfers = require('./federationTransfers.js');
const courses = require('./federationCourses.js');
const discipline = require('./federationDiscipline.js');
const secretariat = require('./federationSecretariat.js');
const m = require('./federationMembership.js');
const { createFakeDb, createFakeBucket, FakeFieldValue } = require('../tests/fakes/fakeFirestore.cjs');

const NOW = Date.UTC(2026, 9, 18, 15, 0, 0); // 2026-10-18 12:00 em Brasília
const ctx = (db, now = NOW) => ({ db, now, Timestamp: { fromMillis: (ms) => ({ ms }) }, FieldValue: FakeFieldValue, logger: { info() {}, warn() {} } });
const ANA = { uid: 'ana' };
const BIA = { uid: 'bia' };
const SEC = { uid: 'sec' };
const TES = { uid: 'tes' };
const REF = { uid: 'ref' };
const DISC = { uid: 'disc' };
const SEC2 = { uid: 'sec2' };

function cenario() {
  return createFakeDb({
    'platform_settings/global': { feature_flags: { federations: true } },
    'federations/fpp': { name: 'Federação Paulista', acronym: 'FPP', slug: 'fpp', status: 'approved', published: true, member_counter: 0, modules: { courses: true, discipline: true }, rules: { ask_cpf: true, transfer_release_days: 15 } },
    'federations/fgp': { name: 'Federação Gaúcha', acronym: 'FGP', slug: 'fgp', status: 'approved', published: true, member_counter: 0, modules: {}, rules: {} },
    'federation_staff/fpp_sec': { federation_id: 'fpp', user_id: 'sec', role: 'secretary' },
    'federation_staff/fpp_tes': { federation_id: 'fpp', user_id: 'tes', role: 'treasurer' },
    'federation_staff/fpp_ref': { federation_id: 'fpp', user_id: 'ref', role: 'referees' },
    'federation_staff/fpp_disc': { federation_id: 'fpp', user_id: 'disc', role: 'discipline' },
    'federation_staff/fgp_sec2': { federation_id: 'fgp', user_id: 'sec2', role: 'secretary' },
    'federation_plans/anual': { federation_id: 'fpp', name: 'Atleta federado', tier: 'federated', billing: 'annual', validity: 'rolling', price_cents: 10000, active: true, auto_approve: true, discounts: { minor_pct: 50, family_pct: 20, family_from: 2 } },
    'federation_plans/gratis': { federation_id: 'fpp', name: 'Simpatizante', tier: 'registered', billing: 'annual', validity: 'rolling', price_cents: 0, active: true, auto_approve: true },
    'federation_plans/fgp_anual': { federation_id: 'fgp', name: 'Federado', tier: 'federated', billing: 'annual', validity: 'rolling', price_cents: 5000, active: true, auto_approve: true },
    'users/ana': { full_name: 'Ana Souza', birth_date: '1990-05-01', email: 'ana@x.com', phone: '51 9999' },
    'users/bia': { full_name: 'Bia Lima', birth_date: '2011-01-01', email: 'bia@x.com' },
    'users/caio': { full_name: 'Caio', birth_date: '1985-01-01', email: 'caio@x.com' },
  });
}
const doc = (db, path) => db.store.docs.get(path);
const docsDe = (db, col) => [...db.store.docs.entries()].filter(([p]) => p.startsWith(`${col}/`)).map(([p, d]) => ({ id: p.split('/')[1], ...d }));
const avisosPara = (db, uid) => docsDe(db, 'notifications').filter((d) => d.user_id === uid);
const confirmar = async (db, chargeId) => fed.chargeConfirm(ctx(db), TES, { chargeId, action: 'confirm' });

describe('PR 3: filiação com CPF, menor e dependente', () => {
  it('a federação que pede CPF exige um válido e guarda só no subdocumento privado', async () => {
    const db = cenario();
    await expect(fed.membership(ctx(db), ANA, { federationId: 'fpp', action: 'request', planId: 'anual' })).rejects.toMatchObject({ code: 'invalid-argument' });
    await expect(fed.membership(ctx(db), ANA, { federationId: 'fpp', action: 'request', planId: 'anual', cpf: '111.111.111-11' })).rejects.toMatchObject({ code: 'invalid-argument' });
    const r = await fed.membership(ctx(db), ANA, { federationId: 'fpp', action: 'request', planId: 'anual', cpf: '529.982.247-25' });
    expect(doc(db, 'federation_members/fpp_ana')).not.toHaveProperty('cpf');
    expect(doc(db, 'federation_members/fpp_ana/private/data')).toMatchObject({ cpf: '52998224725' });
    expect(doc(db, `federation_charges/${r.chargeId}`).amount_cents).toBe(10000);
  });

  it('menor de 18 só com o responsável declarado; menor de 12 só como dependente', async () => {
    const db = cenario();
    await expect(fed.membership(ctx(db), BIA, { federationId: 'fpp', action: 'request', planId: 'gratis' })).rejects.toMatchObject({ code: 'invalid-argument' });
    await fed.membership(ctx(db), BIA, { federationId: 'fpp', action: 'request', planId: 'gratis', cpf: '52998224725', guardian: { name: 'Mãe da Bia', contact: '51 8888', consent: true } });
    expect(doc(db, 'federation_members/fpp_bia')).toMatchObject({ status: 'active', is_minor: true, minor_photo_consent: false });
    expect(doc(db, 'federation_members/fpp_bia/private/data')).toMatchObject({ guardian: { name: 'Mãe da Bia', contact: '51 8888' }, guardian_consent: true });
    // A verificação pública do menor sai sem foto.
    const v = await fed.verify(ctx(db), { code: doc(db, 'federation_members/fpp_bia').card_code });
    expect(v).toMatchObject({ found: true, photo_url: '', status: 'active' });
    db.store.docs.set('users/bia', { full_name: 'Bia', birth_date: '2018-01-01' });
    await expect(fed.membership(ctx(db), { uid: 'bia2' }, { federationId: 'fpp', action: 'request', planId: 'gratis', cpf: '52998224725' })).resolves.toBeTruthy(); // sem nascimento no cadastro: não barra
  });

  it('o dependente é filiado pelo responsável, que paga com o desconto de menor; a 2ª filiação da família tem desconto', async () => {
    const db = cenario();
    const r1 = await fed.membership(ctx(db), ANA, { federationId: 'fpp', action: 'request', planId: 'anual', cpf: '52998224725' });
    await confirmar(db, r1.chargeId);
    const r2 = await fed.membership(ctx(db), ANA, { federationId: 'fpp', action: 'request', planId: 'anual', dependent: { name: 'Pedro Souza', birth_date: '2015-03-10' }, minorPhotoConsent: true });
    expect(r2.memberId).toMatch(/^fpp_dep_/);
    const dep = doc(db, `federation_members/${r2.memberId}`);
    expect(dep).toMatchObject({ user_id: null, guardian_uid: 'ana', is_minor: true, user_name: 'Pedro Souza', status: 'awaiting_payment' });
    expect(doc(db, `federation_members/${r2.memberId}/private/data`)).toMatchObject({ birth_date: '2015-03-10', guardian: { name: 'Ana Souza', contact: '51 9999' } });
    const charge = doc(db, `federation_charges/${r2.chargeId}`);
    expect(charge).toMatchObject({ payer_uid: 'ana', amount_cents: 5000 }); // maior desconto: menor 50% (família seria 20%)
    await confirmar(db, r2.chargeId);
    expect(doc(db, `federation_members/${r2.memberId}`).status).toBe('active');
    expect(avisosPara(db, 'ana').length).toBeGreaterThan(0);
    // O responsável cancela a do dependente pelo id; outra conta não.
    await expect(fed.membership(ctx(db), BIA, { federationId: 'fpp', action: 'cancel', memberId: r2.memberId })).rejects.toMatchObject({ code: 'permission-denied' });
    await fed.membership(ctx(db), ANA, { federationId: 'fpp', action: 'cancel', memberId: r2.memberId });
    expect(doc(db, `federation_members/${r2.memberId}`).status).toBe('cancelled');
  });

  it('quem já é federado em outra federação só entra por transferência; liberada, entra', async () => {
    const db = cenario();
    const r = await fed.membership(ctx(db), ANA, { federationId: 'fpp', action: 'request', planId: 'anual', cpf: '52998224725' });
    await confirmar(db, r.chargeId);
    await expect(fed.membership(ctx(db), ANA, { federationId: 'fgp', action: 'request', planId: 'fgp_anual' })).rejects.toMatchObject({ code: 'failed-precondition' });
    const t = await transfers.transfer(ctx(db), ANA, { action: 'request', federationId: 'fpp', kind: 'federation', toFederationId: 'fgp', reason: 'Mudei para o RS' });
    expect(doc(db, `federation_transfers/${t.transferId}`)).toMatchObject({ status: 'pending', deadline: '2026-11-02', to_federation_acronym: 'FGP' });
    expect(avisosPara(db, 'sec')).toHaveLength(1);
    // Segunda pendente não; a secretaria da OUTRA federação não decide.
    await expect(transfers.transfer(ctx(db), ANA, { action: 'request', federationId: 'fpp', kind: 'club', toClubId: 'c1' })).rejects.toMatchObject({ code: 'already-exists' });
    await expect(transfers.transfer(ctx(db), SEC2, { action: 'approve', transferId: t.transferId })).rejects.toMatchObject({ code: 'permission-denied' });
    // Sem resposta, a varredura libera depois do prazo.
    expect((await transfers.sweep(ctx(db))).liberadas).toBe(0);
    const depois = await transfers.sweep(ctx(db, NOW + 16 * 86400000));
    expect(depois.liberadas).toBe(1);
    expect(doc(db, `federation_transfers/${t.transferId}`)).toMatchObject({ status: 'approved', auto_released: true });
    const antiga = doc(db, 'federation_members/fpp_ana');
    expect(antiga.status).toBe('cancelled');
    expect(doc(db, `federation_card_index/${antiga.card_code}`)).toBeUndefined();
    const nova = await fed.membership(ctx(db), ANA, { federationId: 'fgp', action: 'request', planId: 'fgp_anual' });
    expect(doc(db, 'federation_members/fgp_ana').status).toBe('awaiting_payment');
    expect(nova.chargeId).toBeTruthy();
  });

  it('a troca de clube é decidida pela própria federação e respeita a carência', async () => {
    const db = cenario();
    const r = await fed.membership(ctx(db), ANA, { federationId: 'fpp', action: 'request', planId: 'anual', cpf: '52998224725' });
    await confirmar(db, r.chargeId);
    const t = await transfers.transfer(ctx(db), ANA, { action: 'request', federationId: 'fpp', kind: 'club', toClubId: 'c1', toClubName: 'Clube Um' });
    await transfers.transfer(ctx(db), SEC, { action: 'approve', transferId: t.transferId });
    expect(doc(db, 'federation_members/fpp_ana')).toMatchObject({ represented_club_id: 'c1', represented_club_name: 'Clube Um', last_transfer_at: '2026-10-18' });
    await expect(transfers.transfer(ctx(db), ANA, { action: 'request', federationId: 'fpp', kind: 'club', toClubId: 'c2' })).rejects.toMatchObject({ code: 'failed-precondition' });
  });
});

describe('PR 3: cursos e credenciais', () => {
  it('inscrição com preço de filiado, vaga, cobrança confirmada pelo financeiro, aprovação emite credencial verificável', async () => {
    const db = cenario();
    db.store.docs.set('federation_courses/c1', { federation_id: 'fpp', name: 'Arbitragem nível 1', kind: 'referee', level: 'Nível 1', status: 'open', starts_at: '2026-11-10', ends_at: '2026-11-10', seats: 1, enrolled_count: 0, price_cents: 20000, member_price_cents: 8000, issues_credential: true, credential_months: 24, requires_membership: false });
    const r = await fed.membership(ctx(db), ANA, { federationId: 'fpp', action: 'request', planId: 'anual', cpf: '52998224725' });
    await confirmar(db, r.chargeId);
    const e = await courses.course(ctx(db), ANA, { action: 'enroll', courseId: 'c1' });
    expect(doc(db, 'federation_course_enrollments/c1_ana')).toMatchObject({ status: 'awaiting_payment', amount_cents: 8000, is_member: true });
    expect(doc(db, 'federation_courses/c1').enrolled_count).toBe(1);
    expect(doc(db, `federation_charges/${e.chargeId}`)).toMatchObject({ origin: 'course', amount_cents: 8000, enrollment_id: 'c1_ana', payer_uid: 'ana' });
    // Lotado para o próximo (não filiado pagaria 20000).
    await expect(courses.course(ctx(db), { uid: 'caio' }, { action: 'enroll', courseId: 'c1' })).rejects.toMatchObject({ code: 'failed-precondition' });
    // Sem pagamento não há resultado; o financeiro confirma; só `courses` dá o resultado.
    await expect(courses.course(ctx(db), REF, { action: 'pass', courseId: 'c1', userId: 'ana' })).rejects.toMatchObject({ code: 'failed-precondition' });
    await confirmar(db, e.chargeId);
    expect(doc(db, 'federation_course_enrollments/c1_ana').status).toBe('confirmed');
    await expect(courses.course(ctx(db), SEC, { action: 'pass', courseId: 'c1', userId: 'ana' })).rejects.toMatchObject({ code: 'permission-denied' });
    const ok = await courses.course(ctx(db), REF, { action: 'pass', courseId: 'c1', userId: 'ana' });
    const cred = doc(db, `federation_credentials/${ok.credentialId}`);
    expect(cred).toMatchObject({ user_id: 'ana', kind: 'referee', level: 'Nível 1', valid_until: '2028-10-18', status: 'active', public: false });
    const v = await fed.verify(ctx(db), { code: cred.code });
    expect(v).toMatchObject({ found: true, kind: 'credential', name: 'Ana Souza', credential_kind: 'referee', level: 'Nível 1', status: 'active' });
    expect(Object.keys(v)).not.toContain('user_id');
  });

  it('cancelar devolve a vaga e cancela a cobrança; curso só para filiados barra quem não é', async () => {
    const db = cenario();
    db.store.docs.set('federation_courses/c2', { federation_id: 'fpp', name: 'Clínica', kind: 'clinic', status: 'open', starts_at: '2026-12-01', seats: 0, enrolled_count: 0, price_cents: 3000, requires_membership: true });
    await expect(courses.course(ctx(db), { uid: 'caio' }, { action: 'enroll', courseId: 'c2' })).rejects.toMatchObject({ code: 'failed-precondition' });
    db.store.docs.set('federation_courses/c2', { ...doc(db, 'federation_courses/c2'), requires_membership: false });
    const e = await courses.course(ctx(db), { uid: 'caio' }, { action: 'enroll', courseId: 'c2' });
    await courses.course(ctx(db), { uid: 'caio' }, { action: 'cancel', courseId: 'c2' });
    expect(doc(db, 'federation_course_enrollments/c2_caio').status).toBe('cancelled');
    expect(doc(db, 'federation_courses/c2').enrolled_count).toBe(0);
    expect(doc(db, `federation_charges/${e.chargeId}`).status).toBe('cancelled');
  });
  it('a cobrança de curso de quem NÃO é filiado (sem `member_id`) é confirmada e cancelada sem derrubar a função', async () => {
    const db = cenario();
    db.store.docs.set('federation_courses/c3', { federation_id: 'fpp', name: 'Clínica aberta', kind: 'clinic', status: 'open', starts_at: '2026-12-01', seats: 0, enrolled_count: 0, price_cents: 3000, requires_membership: false });
    const e = await courses.course(ctx(db), { uid: 'caio' }, { action: 'enroll', courseId: 'c3' });
    expect(doc(db, `federation_charges/${e.chargeId}`).member_id).toBeNull();
    await confirmar(db, e.chargeId);
    expect(doc(db, 'federation_course_enrollments/c3_caio').status).toBe('confirmed');
    expect(avisosPara(db, 'caio').at(-1).link).toBe('/federacoes/fpp?ancora=fed-cursos');
    const e2 = await courses.course(ctx(db), ANA, { action: 'enroll', courseId: 'c3' });
    await fed.chargeConfirm(ctx(db), TES, { chargeId: e2.chargeId, action: 'cancel', note: 'Desistiu' });
    expect(doc(db, 'federation_course_enrollments/c3_ana').status).toBe('cancelled');
  });

  it('cancelar o CURSO exige motivo e `courses`, cancela inscrições e cobranças abertas e avisa cada inscrito', async () => {
    const db = cenario();
    db.store.docs.set('federation_courses/c4', { federation_id: 'fpp', name: 'Clínica de saque', kind: 'clinic', status: 'open', starts_at: '2026-12-01', seats: 0, enrolled_count: 0, price_cents: 3000, requires_membership: false });
    const pago = await courses.course(ctx(db), ANA, { action: 'enroll', courseId: 'c4' });
    await confirmar(db, pago.chargeId);
    const aberto = await courses.course(ctx(db), { uid: 'caio' }, { action: 'enroll', courseId: 'c4' });
    await expect(courses.course(ctx(db), SEC, { action: 'cancel_course', courseId: 'c4', reason: 'Chuva' })).rejects.toMatchObject({ code: 'permission-denied' });
    await expect(courses.course(ctx(db), REF, { action: 'cancel_course', courseId: 'c4', reason: '' })).rejects.toMatchObject({ code: 'invalid-argument' });
    const r = await courses.course(ctx(db), REF, { action: 'cancel_course', courseId: 'c4', reason: 'Quadra interditada' });
    expect(r).toMatchObject({ enrollments: 2, charges: 1 });
    expect(doc(db, 'federation_courses/c4')).toMatchObject({ status: 'cancelled', cancelled_reason: 'Quadra interditada' });
    expect(doc(db, 'federation_course_enrollments/c4_ana').status).toBe('cancelled');
    expect(doc(db, 'federation_course_enrollments/c4_caio').status).toBe('cancelled');
    expect(doc(db, `federation_charges/${aberto.chargeId}`).status).toBe('cancelled');
    expect(doc(db, `federation_charges/${pago.chargeId}`).status).toBe('paid'); // o pago fica registrado
    expect(avisosPara(db, 'ana').at(-1).message).toContain('devolução');
    expect(avisosPara(db, 'caio').at(-1).message).not.toContain('devolução');
    await expect(courses.course(ctx(db), REF, { action: 'cancel_course', courseId: 'c4', reason: 'De novo' })).rejects.toMatchObject({ code: 'failed-precondition' });
  });
});

describe('PR 3: disciplina', () => {
  async function filiada(db) {
    const r = await fed.membership(ctx(db), ANA, { federationId: 'fpp', action: 'request', planId: 'anual', cpf: '52998224725' });
    await confirmar(db, r.chargeId);
  }
  it('suspensão grava o prazo na filiação (a carteirinha mostra suspensa), recurso aceito desfaz', async () => {
    const db = cenario();
    await filiada(db);
    await expect(discipline.discipline(ctx(db), SEC, { action: 'apply', federationId: 'fpp', userId: 'ana', kind: 'suspension', reason: 'Conduta antidesportiva na final', starts_at: '2026-10-18', ends_at: '2026-11-30' })).rejects.toMatchObject({ code: 'permission-denied' });
    const s = await discipline.discipline(ctx(db), DISC, { action: 'apply', federationId: 'fpp', userId: 'ana', kind: 'suspension', reason: 'Conduta antidesportiva na final', starts_at: '2026-10-18', ends_at: '2026-11-30' });
    const mem = doc(db, 'federation_members/fpp_ana');
    expect(mem.discipline_until_ms).toBe(m.endOfDayBrMs('2026-11-30'));
    expect(m.membershipState(mem, '2026-10-18', NOW)).toMatchObject({ status: 'suspended', disciplined: true });
    expect((await fed.verify(ctx(db), { code: mem.card_code })).status).toBe('suspended');
    expect(avisosPara(db, 'ana').some((a) => /Suspens/.test(a.title))).toBe(true);
    // Recurso: só a pessoa, uma vez; a disciplina decide.
    await expect(discipline.discipline(ctx(db), BIA, { action: 'appeal', sanctionId: s.sanctionId, text: 'Não fui eu, foi o meu parceiro de dupla.' })).rejects.toMatchObject({ code: 'permission-denied' });
    await discipline.discipline(ctx(db), ANA, { action: 'appeal', sanctionId: s.sanctionId, text: 'Não fui eu, foi o meu parceiro de dupla.' });
    expect(doc(db, `federation_sanctions/${s.sanctionId}`).status).toBe('appealed');
    expect(avisosPara(db, 'disc')).toHaveLength(1);
    await discipline.discipline(ctx(db), DISC, { action: 'decide_appeal', sanctionId: s.sanctionId, decision: 'overturn', note: 'Vídeo confirma.' });
    expect(doc(db, `federation_sanctions/${s.sanctionId}`).status).toBe('overturned');
    expect(doc(db, 'federation_members/fpp_ana').discipline_until_ms).toBe(0);
    expect(m.membershipState(doc(db, 'federation_members/fpp_ana'), '2026-10-18', NOW).status).toBe('active');
  });
  it('multa vira cobrança e a confirmação quita; exclusão encerra a filiação', async () => {
    const db = cenario();
    await filiada(db);
    const f1 = await discipline.discipline(ctx(db), DISC, { action: 'apply', federationId: 'fpp', userId: 'ana', kind: 'fine', reason: 'Abandono de partida oficial', fine_cents: 15000 });
    expect(doc(db, `federation_charges/${f1.chargeId}`)).toMatchObject({ origin: 'fine', amount_cents: 15000, sanction_id: f1.sanctionId, payer_uid: 'ana' });
    await confirmar(db, f1.chargeId);
    expect(doc(db, `federation_sanctions/${f1.sanctionId}`).fine_paid_at_ms).toBe(NOW);
    const ex = await discipline.discipline(ctx(db), DISC, { action: 'apply', federationId: 'fpp', userId: 'ana', kind: 'exclusion', reason: 'Reincidência grave comprovada' });
    const mem = doc(db, 'federation_members/fpp_ana');
    expect(mem.status).toBe('cancelled');
    expect(doc(db, `federation_card_index/${mem.card_code}`)).toBeUndefined();
    await discipline.discipline(ctx(db), DISC, { action: 'end', sanctionId: ex.sanctionId, note: 'Revisto pela diretoria' });
    const volta = doc(db, 'federation_members/fpp_ana');
    expect(volta.status).toBe('active');
    // Desfeita a exclusão, a carteirinha volta a VERIFICAR: código novo, no índice.
    expect(volta.card_code).toBeTruthy();
    expect(volta.card_code).not.toBe(mem.card_code);
    expect((await fed.verify(ctx(db), { code: volta.card_code })).status).toBe('active');
  });
  it('duas suspensões sobrepostas: encerrar uma mantém a outra; a futura só vale a partir de `starts_at` (varredura)', async () => {
    const db = cenario();
    await filiada(db);
    const sus = (over) => discipline.discipline(ctx(db), DISC, { action: 'apply', federationId: 'fpp', userId: 'ana', kind: 'suspension', reason: 'Motivo com mais de dez letras', starts_at: '2026-10-18', ends_at: '2026-11-30', ...over });
    const a = await sus({});
    const b = await sus({ ends_at: '2026-12-31' });
    expect(doc(db, 'federation_members/fpp_ana')).toMatchObject({ discipline_until_ms: m.endOfDayBrMs('2026-12-31'), discipline_sanction_id: b.sanctionId });
    await discipline.discipline(ctx(db), DISC, { action: 'end', sanctionId: b.sanctionId, note: 'x' });
    // 🐞 Antes: desfazer B zerava o prazo e A, ainda em vigor, deixava de valer.
    expect(doc(db, 'federation_members/fpp_ana')).toMatchObject({ discipline_until_ms: m.endOfDayBrMs('2026-11-30'), discipline_sanction_id: a.sanctionId });
    await discipline.discipline(ctx(db), DISC, { action: 'end', sanctionId: a.sanctionId, note: 'x' });
    expect(doc(db, 'federation_members/fpp_ana').discipline_until_ms).toBe(0);
    // Futura: nada muda hoje; a varredura do dia aplica.
    const fut = await sus({ starts_at: '2026-11-01', ends_at: '2026-11-15' });
    expect(doc(db, 'federation_members/fpp_ana').discipline_until_ms).toBe(0);
    expect(doc(db, `federation_sanctions/${fut.sanctionId}`).applied_at_ms).toBeNull();
    expect(await discipline.sweep(ctx(db))).toEqual({ aplicadas: 0 });
    const dia = Date.UTC(2026, 10, 2, 15, 0, 0); // 2026-11-02
    expect(await discipline.sweep(ctx(db, dia))).toEqual({ aplicadas: 1 });
    expect(doc(db, 'federation_members/fpp_ana').discipline_until_ms).toBe(m.endOfDayBrMs('2026-11-15'));
    expect(doc(db, `federation_sanctions/${fut.sanctionId}`).applied_at_ms).toBe(dia);
    expect(await discipline.sweep(ctx(db, dia))).toEqual({ aplicadas: 0 });
  });
  it('recurso só com uphold/overturn; filiação encerrada não recebe sanção', async () => {
    const db = cenario();
    await filiada(db);
    const s = await discipline.discipline(ctx(db), DISC, { action: 'apply', federationId: 'fpp', userId: 'ana', kind: 'warning', reason: 'Motivo com mais de dez letras' });
    await discipline.discipline(ctx(db), ANA, { action: 'appeal', sanctionId: s.sanctionId, text: 'Recurso com pelo menos vinte letras.' });
    await expect(discipline.discipline(ctx(db), DISC, { action: 'decide_appeal', sanctionId: s.sanctionId, decision: 'talvez' })).rejects.toMatchObject({ code: 'invalid-argument' });
    await expect(discipline.discipline(ctx(db), DISC, { action: 'decide_appeal', sanctionId: s.sanctionId })).rejects.toMatchObject({ code: 'invalid-argument' });
    expect(doc(db, `federation_sanctions/${s.sanctionId}`).status).toBe('appealed');
    await fed.membership(ctx(db), ANA, { federationId: 'fpp', action: 'cancel' });
    await expect(discipline.discipline(ctx(db), DISC, { action: 'apply', federationId: 'fpp', userId: 'ana', kind: 'warning', reason: 'Motivo com mais de dez letras' })).rejects.toMatchObject({ code: 'failed-precondition' });
  });
});

describe('PR 3: secretaria', () => {
  it('importa quem tem conta como filiado ativo, pula quem já é, guarda quem não tem conta', async () => {
    const db = cenario();
    const r = await fed.membership(ctx(db), ANA, { federationId: 'fpp', action: 'request', planId: 'gratis', cpf: '52998224725' });
    expect(r.memberId).toBe('fpp_ana');
    await expect(secretariat.importMembers(ctx(db), TES, { federationId: 'fpp', planId: 'anual', rows: [{ email: 'caio@x.com' }] })).rejects.toMatchObject({ code: 'permission-denied' });
    const out = await secretariat.importMembers(ctx(db), SEC, { federationId: 'fpp', planId: 'anual', rows: [
      { name: 'Caio', email: 'CAIO@x.com', member_number: 'FPP-2019-000042', valid_until: '2027-03-31' },
      { name: 'Ana', email: 'ana@x.com' },
      { name: 'Zé', email: 'ze@naotem.com' },
      { email: 'invalido' },
    ] });
    expect(out).toMatchObject({ imported: 1, pending: 1 });
    expect(out.skipped).toHaveLength(2);
    const caio = doc(db, 'federation_members/fpp_caio');
    expect(caio).toMatchObject({ status: 'active', member_number: 'FPP-2019-000042', valid_until: '2027-03-31', imported: true, plan_id: 'anual' });
    expect(caio).not.toHaveProperty('email');
    expect(doc(db, `federation_imports/${out.importId}`).pending).toEqual([{ email: 'ze@naotem.com', name: 'Zé', member_number: '', valid_until: '' }]);
    expect(avisosPara(db, 'caio')).toHaveLength(1);
  });
  it('quem estava sem conta recebe o CONVITE ao criar a conta; aceito, entra ativo sem cobrança com os dados da lista', async () => {
    const db = cenario();
    const out = await secretariat.importMembers(ctx(db), SEC, { federationId: 'fpp', planId: 'anual', rows: [{ name: 'Zé', email: 'Ze@naotem.com', member_number: 'FPP-7', valid_until: '2027-02-28' }] });
    expect(doc(db, `federation_imports/${out.importId}`)).toMatchObject({ pending_emails: ['ze@naotem.com'], invited_emails: [] });
    // Conta de outro e-mail: nada.
    expect(await secretariat.onUserCreated(ctx(db), 'outro', { email: 'outro@x.com' })).toEqual({ invited: 0 });
    db.store.docs.set('users/ze', { full_name: 'José', email: 'ZE@naotem.com', birth_date: '1980-01-01' });
    expect(await secretariat.onUserCreated(ctx(db), 'ze', doc(db, 'users/ze'))).toEqual({ invited: 1 });
    expect(doc(db, 'federation_members/fpp_ze')).toBeUndefined(); // ninguém vira filiado sem aceitar
    expect(doc(db, 'federation_invites/fpp_ze')).toMatchObject({ status: 'pending', source: 'import', plan_id: 'anual', member_number: 'FPP-7', valid_until: '2027-02-28', invited_by: 'sec' });
    expect(doc(db, `federation_imports/${out.importId}`)).toMatchObject({ pending_emails: [], invited_emails: ['ze@naotem.com'] });
    expect(avisosPara(db, 'ze')).toHaveLength(1);
    expect(await secretariat.onUserCreated(ctx(db), 'ze', doc(db, 'users/ze'))).toEqual({ invited: 0 }); // não repete
    const r = await fed.membership(ctx(db), { uid: 'ze' }, { federationId: 'fpp', action: 'request', planId: 'anual', cpf: '52998224725' });
    expect(r.chargeId).toBeNull();
    expect(doc(db, 'federation_members/fpp_ze')).toMatchObject({ status: 'active', member_number: 'FPP-7', valid_until: '2027-02-28', imported: true, invited: true });
    expect(doc(db, 'federation_invites/fpp_ze').status).toBe('accepted');
    expect(docsDe(db, 'federation_charges')).toHaveLength(0);
  });
  it('federação oculta não convida: o e-mail segue pendente', async () => {
    const db = cenario();
    const out = await secretariat.importMembers(ctx(db), SEC, { federationId: 'fpp', planId: 'anual', rows: [{ name: 'Zé', email: 'ze@naotem.com' }] });
    db.store.docs.set('federations/fpp', { ...doc(db, 'federations/fpp'), published: false });
    expect(await secretariat.onUserCreated(ctx(db), 'ze', { email: 'ze@naotem.com' })).toEqual({ invited: 0 });
    expect(doc(db, `federation_imports/${out.importId}`).pending_emails).toEqual(['ze@naotem.com']);
  });
  it('o documento só chega à secretaria/dono, pela função, com o conteúdo', async () => {
    const db = cenario();
    db.store.docs.set('federation_documents_submitted/d1', { federation_id: 'fpp', user_id: 'ana', member_id: 'fpp_ana', kind: 'identidade', storage_path: 'federacao/ana/abc123.pdf', status: 'pending' });
    const bucket = createFakeBucket(['federacao/ana/abc123.pdf']);
    bucket.file = (name) => ({
      getMetadata: async () => [{ contentType: 'application/pdf', size: 12 }],
      download: async () => [Buffer.from(`conteudo:${name}`)],
    });
    const c = { ...ctx(db), bucket };
    await expect(secretariat.document(c, TES, { documentId: 'd1' })).rejects.toMatchObject({ code: 'permission-denied' });
    const r = await secretariat.document(c, SEC, { documentId: 'd1' });
    expect(r).toMatchObject({ contentType: 'application/pdf', kind: 'identidade' });
    expect(Buffer.from(r.base64, 'base64').toString()).toBe('conteudo:federacao/ana/abc123.pdf');
    expect(docsDe(db, 'audit_logs').some((a) => a.action === 'federation_document_view')).toBe(true);
    await expect(secretariat.document(c, ANA, { documentId: 'd1' })).resolves.toMatchObject({ ok: true });
  });
  it('o comprovante do "Já paguei" chega ao pagador e a quem lê cobranças, com registro', async () => {
    const db = cenario();
    db.store.docs.set('federation_charges/c1', { federation_id: 'fpp', payer_uid: 'ana', member_id: 'fpp_ana', status: 'declared', declared_proof: { path: 'federacao/ana/pix123.pdf', name: 'pix.pdf' } });
    db.store.docs.set('federation_charges/c2', { federation_id: 'fpp', payer_uid: 'ana', status: 'open' });
    const bucket = createFakeBucket(['federacao/ana/pix123.pdf']);
    bucket.file = (name) => ({ getMetadata: async () => [{ contentType: 'application/pdf', size: 12 }], download: async () => [Buffer.from(`conteudo:${name}`)] });
    const c = { ...ctx(db), bucket };
    // Arbitragem e disciplina não leem cobranças; financeiro e secretaria leem.
    await expect(secretariat.document(c, REF, { chargeId: 'c1' })).rejects.toMatchObject({ code: 'permission-denied' });
    await expect(secretariat.document(c, DISC, { chargeId: 'c1' })).rejects.toMatchObject({ code: 'permission-denied' });
    const r = await secretariat.document(c, TES, { chargeId: 'c1' });
    expect(Buffer.from(r.base64, 'base64').toString()).toBe('conteudo:federacao/ana/pix123.pdf');
    await expect(secretariat.document(c, SEC, { chargeId: 'c1' })).resolves.toMatchObject({ kind: 'proof' });
    expect(docsDe(db, 'audit_logs').filter((a) => a.action === 'federation_charge_proof_view')).toHaveLength(2);
    // O pagador abre o próprio, sem registro; cobrança sem comprovante diz que não há.
    await expect(secretariat.document(c, ANA, { chargeId: 'c1' })).resolves.toMatchObject({ ok: true });
    expect(docsDe(db, 'audit_logs').filter((a) => a.action === 'federation_charge_proof_view')).toHaveLength(2);
    await expect(secretariat.document(c, ANA, { chargeId: 'c2' })).rejects.toMatchObject({ code: 'not-found' });
  });
});
