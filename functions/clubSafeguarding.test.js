/**
 * Proteção de menores do clube no SERVIDOR (Firestore falso): o compromisso e a certidão fazem a
 * pessoa "em dia"; só a disciplina confere (e nunca a própria certidão); a conferência apaga o
 * arquivo; o menor tem o responsável registrado (e o adulto não); a varredura avisa o
 * vencimento uma vez só e apaga o responsável de quem completou 18 anos.
 */
import { describe, it, expect } from 'vitest';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const cs = require('./clubSafeguarding.js');
const m = require('./federationMembership.js');
const { createFakeDb } = require('../tests/fakes/fakeFirestore.cjs');

const NOW = Date.UTC(2027, 2, 10, 15, 0, 0);
const hoje = m.isoDateBR(NOW);
const PRES = { uid: 'pres', name: 'Presidente' };
const DISC = { uid: 'disc', name: 'Disciplina' };
const FIN = { uid: 'fin', name: 'Tesouraria' };
const ANA = { uid: 'ana', name: 'Ana' };
const BIA = { uid: 'bia', name: 'Bia' };
const LEO = { uid: 'leo', name: 'Leo' };
const FORA = { uid: 'fora', name: 'Fora do clube' };

function cenario({ flag = true, associacao = true, regras } = {}) {
  return createFakeDb({
    'platform_settings/global': { feature_flags: { club_association: flag } },
    'clubs/c1': { name: 'Clube Pickle Sul', association: { enabled: associacao, published: true, ...(regras ? { safeguarding_rules: regras } : {}) } },
    'club_members/c1_pres': { club_id: 'c1', user_id: 'pres', role: 'admin' },
    'club_members/c1_disc': { club_id: 'c1', user_id: 'disc', role: 'member' },
    'club_members/c1_fin': { club_id: 'c1', user_id: 'fin', role: 'member' },
    'club_members/c1_ana': { club_id: 'c1', user_id: 'ana', role: 'member' },
    'club_members/c1_bia': { club_id: 'c1', user_id: 'bia', role: 'member' },
    'club_members/c1_leo': { club_id: 'c1', user_id: 'leo', role: 'member' },
    'club_x/c1/staff/disc': { club_id: 'c1', user_id: 'disc', perms: ['discipline'], term_end_ms: 0 },
    'club_x/c1/staff/fin': { club_id: 'c1', user_id: 'fin', perms: ['finance'], term_end_ms: 0 },
    'club_x/c1/staff/ana': { club_id: 'c1', user_id: 'ana', perms: ['sports'], term_end_ms: 0 },
    'club_x/c1/aff/bia': { club_id: 'c1', user_id: 'bia', user_name: 'Bia', status: 'active' },
    'club_x/c1/aff/leo': { club_id: 'c1', user_id: 'leo', user_name: 'Leo', status: 'active' },
    'club_x/c1/aff/ana': { club_id: 'c1', user_id: 'ana', user_name: 'Ana', status: 'active' },
    'users/pres': { platform_name: 'Presidente', birth_date: '1975-01-01' },
    'users/disc': { platform_name: 'Disciplina', birth_date: '1980-05-05' },
    'users/ana': { platform_name: 'Ana', birth_date: '1990-04-04' },
    'users/bia': { platform_name: 'Bia', birth_date: '2013-06-01' },
    'users/leo': { platform_name: 'Leo', birth_date: '2009-03-11' },
  });
}

function fakeBucket(arquivos = {}) {
  const files = { ...arquivos };
  return {
    files,
    file: (path) => ({
      async getMetadata() { if (!(path in files)) throw new Error('nao existe'); return [{ size: files[path].length, contentType: 'application/pdf' }]; },
      async download() { return [Buffer.from(files[path])]; },
      async delete() { delete files[path]; },
    }),
  };
}

const ctx = (db, bucket = null, now = NOW) => ({ db, bucket, now, Timestamp: { fromMillis: (ms) => ({ ms }) }, FieldValue: { delete: () => undefined, increment: (n) => n }, logger: { info() {}, warn() {} } });
const chamar = (db, actor, data, { bucket = null, now } = {}) => cs.safeguarding(ctx(db, bucket, now), actor, { clubId: 'c1', ...data });
const doc = (db, path) => db.store.docs.get(path);
const avisosPara = (db, uid) => [...db.store.docs.entries()].filter(([p, d]) => p.startsWith('notifications/') && d.user_id === uid).map(([, d]) => d);
const emitidaHa = (meses) => { const d = new Date(NOW); d.setUTCMonth(d.getUTCMonth() - meses); return m.isoDateBR(d.getTime()); };

async function certidao(db, bucket, actor, issuedAt = emitidaHa(1)) {
  const path = `clube-protecao/${actor.uid}/cert.pdf`;
  bucket.files[path] = 'PDF';
  await chamar(db, actor, { action: 'sg_submit', issuedAt, filePath: path }, { bucket });
  return path;
}

describe('proteção de menores do clube: quem pode', () => {
  it('flag desligada, associação fechada, ação desconhecida e quem não é do clube são recusados', async () => {
    await expect(chamar(cenario({ flag: false }), ANA, { action: 'me' })).rejects.toMatchObject({ code: 'failed-precondition' });
    await expect(chamar(cenario({ associacao: false }), ANA, { action: 'me' })).rejects.toMatchObject({ code: 'failed-precondition' });
    const db = cenario();
    await expect(chamar(db, ANA, { action: 'nada' })).rejects.toMatchObject({ code: 'invalid-argument' });
    await expect(chamar(db, FORA, { action: 'pledge' })).rejects.toMatchObject({ code: 'failed-precondition' });
  });

  it('o quadro, as regras, a conferência e os menores são só da disciplina e da administração', async () => {
    const db = cenario();
    for (const acao of ['sg_overview', 'minors_overview']) {
      // eslint-disable-next-line no-await-in-loop
      await expect(chamar(db, FIN, { action: acao })).rejects.toMatchObject({ code: 'permission-denied' });
      // eslint-disable-next-line no-await-in-loop
      await expect(chamar(db, ANA, { action: acao })).rejects.toMatchObject({ code: 'permission-denied' });
      // eslint-disable-next-line no-await-in-loop
      await expect(chamar(db, DISC, { action: acao })).resolves.toMatchObject({ ok: true });
      // eslint-disable-next-line no-await-in-loop
      await expect(chamar(db, PRES, { action: acao })).resolves.toMatchObject({ ok: true });
    }
    await expect(chamar(db, FIN, { action: 'sg_rules', rules: { background_months: 6 } })).rejects.toMatchObject({ code: 'permission-denied' });
    await expect(chamar(db, FIN, { action: 'sg_verify', userId: 'ana', decision: 'valid' })).rejects.toMatchObject({ code: 'permission-denied' });
    await expect(chamar(db, FIN, { action: 'sg_designate', userId: 'leo' })).rejects.toMatchObject({ code: 'permission-denied' });
  });
});

describe('em dia = compromisso aceito + certidão conferida', () => {
  it('⭐ o caminho todo: aceita, envia, a disciplina confere, o arquivo é apagado e a pessoa fica em dia', async () => {
    const db = cenario();
    const bucket = fakeBucket();
    let eu = await chamar(db, ANA, { action: 'me' });
    expect(eu).toMatchObject({ ok_state: false, required: true, staff: true, pledge: { ok: false } });
    await chamar(db, ANA, { action: 'pledge' });
    expect(doc(db, 'club_x/c1/safeguard/ana')).toMatchObject({ pledge_version: 1, name: 'Ana', user_id: 'ana' });
    const path = await certidao(db, bucket, ANA);
    expect(doc(db, 'club_x/c1/safeguard/ana').pending_background).toMatchObject({ file_path: path });
    expect(avisosPara(db, 'disc').some((n) => /conferir/i.test(n.title))).toBe(true);
    eu = await chamar(db, ANA, { action: 'me' });
    expect(eu.pending).toMatchObject({ issued_at: emitidaHa(1) });
    expect(JSON.stringify(eu)).not.toContain('file_path');
    await chamar(db, DISC, { action: 'sg_verify', userId: 'ana', decision: 'valid' }, { bucket });
    expect(bucket.files[path]).toBeUndefined();
    expect(doc(db, 'club_x/c1/safeguard/ana').pending_background).toBeUndefined();
    eu = await chamar(db, ANA, { action: 'me' });
    expect(eu).toMatchObject({ ok_state: true, pledge: { ok: true }, background: { valid: true } });
    expect(doc(db, 'club_x/c1/safeguard/ana').cleared_until).toBe(eu.until);
    expect(avisosPara(db, 'ana').some((n) => /conferida/i.test(n.title))).toBe(true);
  });

  it('só o compromisso ou só a certidão não bastam', async () => {
    const db = cenario();
    const bucket = fakeBucket();
    await certidao(db, bucket, LEO);
    await chamar(db, DISC, { action: 'sg_verify', userId: 'leo', decision: 'valid' }, { bucket });
    expect(await chamar(db, LEO, { action: 'me' })).toMatchObject({ ok_state: false, pledge: { ok: false }, background: { valid: true } });
    await chamar(db, LEO, { action: 'pledge' });
    expect(await chamar(db, LEO, { action: 'me' })).toMatchObject({ ok_state: true });
  });

  it('subir a versão do compromisso pede novo aceite; a versão nunca desce', async () => {
    const db = cenario();
    const bucket = fakeBucket();
    await chamar(db, LEO, { action: 'pledge' });
    await certidao(db, bucket, LEO);
    await chamar(db, DISC, { action: 'sg_verify', userId: 'leo', decision: 'valid' }, { bucket });
    expect((await chamar(db, LEO, { action: 'me' })).ok_state).toBe(true);
    await chamar(db, DISC, { action: 'sg_rules', rules: { background_months: 12, pledge_version: 2, pledge_text: 'Novo texto' } });
    expect((await chamar(db, LEO, { action: 'me' })).ok_state).toBe(false);
    const r = await chamar(db, DISC, { action: 'sg_rules', rules: { background_months: 12, pledge_version: 1 } });
    expect(r.rules.pledge_version).toBe(2);
    await chamar(db, LEO, { action: 'pledge' });
    expect((await chamar(db, LEO, { action: 'me' })).ok_state).toBe(true);
  });

  it('a certidão tem de ser do Storage da própria pessoa, emitida e ainda válida', async () => {
    const db = cenario();
    const bucket = fakeBucket();
    await expect(chamar(db, ANA, { action: 'sg_submit', issuedAt: emitidaHa(1), filePath: 'clube-protecao/outra/cert.pdf' }, { bucket })).rejects.toMatchObject({ code: 'invalid-argument' });
    await expect(chamar(db, ANA, { action: 'sg_submit', issuedAt: emitidaHa(1), filePath: 'federacao/ana/cert.pdf' }, { bucket })).rejects.toMatchObject({ code: 'invalid-argument' });
    await expect(chamar(db, ANA, { action: 'sg_submit', issuedAt: '2027-12-01', filePath: 'clube-protecao/ana/cert.pdf' }, { bucket })).rejects.toMatchObject({ code: 'invalid-argument' });
    await expect(chamar(db, ANA, { action: 'sg_submit', issuedAt: emitidaHa(20), filePath: 'clube-protecao/ana/cert.pdf' }, { bucket })).rejects.toMatchObject({ code: 'invalid-argument' });
  });

  it('reenviar troca o arquivo pendente e apaga o antigo', async () => {
    const db = cenario();
    const bucket = fakeBucket({ 'clube-protecao/ana/velha.pdf': 'A', 'clube-protecao/ana/nova.pdf': 'B' });
    await chamar(db, ANA, { action: 'sg_submit', issuedAt: emitidaHa(1), filePath: 'clube-protecao/ana/velha.pdf' }, { bucket });
    await chamar(db, ANA, { action: 'sg_submit', issuedAt: emitidaHa(1), filePath: 'clube-protecao/ana/nova.pdf' }, { bucket });
    expect(Object.keys(bucket.files)).toEqual(['clube-protecao/ana/nova.pdf']);
  });
});

describe('conferência', () => {
  it('não confere a própria certidão; não aceita sem motivo; o motivo vai para a pessoa', async () => {
    const db = cenario();
    const bucket = fakeBucket();
    await certidao(db, bucket, DISC);
    await expect(chamar(db, DISC, { action: 'sg_verify', userId: 'disc', decision: 'valid' }, { bucket })).rejects.toMatchObject({ code: 'permission-denied' });
    await certidao(db, bucket, ANA);
    await expect(chamar(db, DISC, { action: 'sg_verify', userId: 'ana', decision: 'rejected' }, { bucket })).rejects.toMatchObject({ code: 'invalid-argument' });
    await chamar(db, DISC, { action: 'sg_verify', userId: 'ana', decision: 'rejected', reason: 'Ilegível, tire outra foto' }, { bucket });
    expect(bucket.files['clube-protecao/ana/cert.pdf']).toBeUndefined();
    expect((await chamar(db, ANA, { action: 'me' })).last_rejection.reason).toBe('Ilegível, tire outra foto');
    expect(avisosPara(db, 'ana').some((n) => /não foi aceita/i.test(n.title))).toBe(true);
    await expect(chamar(db, DISC, { action: 'sg_verify', userId: 'ana', decision: 'valid' }, { bucket })).rejects.toMatchObject({ code: 'failed-precondition' });
  });

  it('revogar pede motivo, tira a pessoa de "em dia" e avisa', async () => {
    const db = cenario();
    const bucket = fakeBucket();
    await chamar(db, LEO, { action: 'pledge' });
    await certidao(db, bucket, LEO);
    await chamar(db, DISC, { action: 'sg_verify', userId: 'leo', decision: 'valid' }, { bucket });
    await expect(chamar(db, DISC, { action: 'sg_revoke', userId: 'leo' })).rejects.toMatchObject({ code: 'invalid-argument' });
    await chamar(db, DISC, { action: 'sg_revoke', userId: 'leo', reason: 'Nova ocorrência' });
    const eu = await chamar(db, LEO, { action: 'me' });
    expect(eu).toMatchObject({ ok_state: false, revoked_reason: 'Nova ocorrência' });
    expect(doc(db, 'club_x/c1/safeguard/leo').cleared_until).toBe('');
  });

  it('o arquivo em conferência: só a pessoa e a disciplina abrem, e abrir é auditado', async () => {
    const db = cenario();
    const bucket = fakeBucket();
    await certidao(db, bucket, LEO);
    const meu = await chamar(db, LEO, { action: 'sg_file' }, { bucket });
    expect(Buffer.from(meu.base64, 'base64').toString()).toBe('PDF');
    await expect(chamar(db, FIN, { action: 'sg_file', userId: 'leo' }, { bucket })).rejects.toMatchObject({ code: 'permission-denied' });
    const antes = [...db.store.docs.keys()].filter((p) => p.startsWith('audit_logs/')).length;
    await chamar(db, DISC, { action: 'sg_file', userId: 'leo' }, { bucket });
    const logs = [...db.store.docs.entries()].filter(([p]) => p.startsWith('audit_logs/')).map(([, d]) => d);
    expect(logs.length).toBe(antes + 1);
    expect(logs.at(-1).action).toBe('club_safeguarding_file_view');
  });
});

describe('quadro: quem precisa estar em dia', () => {
  it('traz os cargos da diretoria, os designados e quem enviou certidão — com o motivo de cada um', async () => {
    const db = cenario();
    await chamar(db, DISC, { action: 'sg_designate', userId: 'leo', label: 'Treinador da escolinha' });
    expect(avisosPara(db, 'leo').some((n) => /proteção de menores/i.test(n.title))).toBe(true);
    const r = await chamar(db, DISC, { action: 'sg_overview' });
    const por = Object.fromEntries(r.rows.map((x) => [x.user_id, x]));
    expect(por.leo).toMatchObject({ roles: ['designated'], label: 'Treinador da escolinha', required: true, ok: false });
    expect(por.ana).toMatchObject({ roles: ['staff'], required: true });
    expect(por.disc.roles).toEqual(['staff']);
    expect(por.bia).toBeUndefined();
  });

  it('a regra pode dispensar um papel; tirar a designação tira do quadro mas mantém o registro', async () => {
    const db = cenario({ regras: { required_for: ['designated'] } });
    await chamar(db, DISC, { action: 'sg_designate', userId: 'leo' });
    let r = await chamar(db, DISC, { action: 'sg_overview' });
    expect(r.rows.find((x) => x.user_id === 'ana').required).toBe(false);
    expect(r.rows.find((x) => x.user_id === 'leo')).toMatchObject({ required: true, label: 'Voluntário' });
    await chamar(db, DISC, { action: 'sg_designate', userId: 'leo', designated: false });
    r = await chamar(db, DISC, { action: 'sg_overview' });
    expect(r.rows.find((x) => x.user_id === 'leo')).toMatchObject({ required: false, roles: [] });
  });

  it('designar quem não é do clube é recusado', async () => {
    await expect(chamar(cenario(), DISC, { action: 'sg_designate', userId: 'fora' })).rejects.toMatchObject({ code: 'failed-precondition' });
  });

  it('regras: validade entre 1 e 60 meses', async () => {
    const db = cenario();
    await expect(chamar(db, DISC, { action: 'sg_rules', rules: { background_months: 0 } })).rejects.toMatchObject({ code: 'invalid-argument' });
    await expect(chamar(db, DISC, { action: 'sg_rules', rules: { background_months: 61 } })).rejects.toMatchObject({ code: 'invalid-argument' });
    const r = await chamar(db, DISC, { action: 'sg_rules', rules: { required_for: ['staff'], background_months: 24 } });
    expect(r.rules).toMatchObject({ required_for: ['staff'], background_months: 24 });
    expect(doc(db, 'clubs/c1').association.safeguarding_rules.background_months).toBe(24);
  });
});

describe('o menor e o responsável legal', () => {
  const RESP = { name: 'Carla Souza', relation: 'mother', phone: '(51) 99999-0000', consent: true, image_consent: false, note: 'Alergia a amendoim' };

  it('⭐ o menor registra o responsável; o adulto não; sem data de nascimento não dá', async () => {
    const db = cenario();
    await chamar(db, BIA, { action: 'guardian_save', guardian: RESP });
    expect(doc(db, 'club_x/c1/minors/bia')).toMatchObject({ user_id: 'bia', registered_by: 'bia', guardian: { name: 'Carla Souza', relation: 'mother', phone: '51999990000', consent: true, image_consent: false } });
    expect((await chamar(db, BIA, { action: 'me' })).minor).toMatchObject({ is_minor: true, age: 13, guardian: { name: 'Carla Souza' } });
    await expect(chamar(db, ANA, { action: 'guardian_save', guardian: RESP })).rejects.toMatchObject({ code: 'failed-precondition' });
    db.store.docs.set('users/bia', { platform_name: 'Bia' });
    await expect(chamar(db, BIA, { action: 'guardian_save', guardian: RESP })).rejects.toMatchObject({ code: 'failed-precondition' });
  });

  it('valida o responsável: nome, parentesco, telefone com DDD e a autorização', async () => {
    const db = cenario();
    for (const ruim of [{ ...RESP, name: 'Al' }, { ...RESP, relation: 'tio' }, { ...RESP, phone: '1234' }, { ...RESP, consent: 'sim' }]) {
      // eslint-disable-next-line no-await-in-loop
      await expect(chamar(db, BIA, { action: 'guardian_save', guardian: ruim })).rejects.toMatchObject({ code: 'invalid-argument' });
    }
  });

  it('a secretaria e a disciplina registram pelo menor; outro associado não', async () => {
    const db = cenario();
    await expect(chamar(db, FIN, { action: 'guardian_save', userId: 'leo', guardian: RESP })).rejects.toMatchObject({ code: 'permission-denied' });
    await expect(chamar(db, LEO, { action: 'guardian_save', userId: 'bia', guardian: RESP })).rejects.toMatchObject({ code: 'permission-denied' });
    await chamar(db, DISC, { action: 'guardian_save', userId: 'leo', guardian: RESP });
    expect(doc(db, 'club_x/c1/minors/leo')).toMatchObject({ registered_by: 'disc' });
  });

  it('a disciplina vê os associados menores e quem ainda não tem responsável', async () => {
    const db = cenario();
    await chamar(db, BIA, { action: 'guardian_save', guardian: RESP });
    const r = await chamar(db, DISC, { action: 'minors_overview' });
    const por = Object.fromEntries(r.rows.map((x) => [x.user_id, x]));
    expect(Object.keys(por).sort()).toEqual(['bia', 'leo']);
    expect(por.bia).toMatchObject({ age: 13, guardian: { name: 'Carla Souza', consent: true } });
    expect(por.leo).toMatchObject({ age: 17, guardian: null });
  });
});

describe('varredura diária', () => {
  it('avisa a certidão que vence em 30 dias uma vez só e refaz a data de liberação', async () => {
    const db = cenario();
    const venceEm = m.isoDateBR(NOW + 10 * 86400000);
    db.store.docs.set('club_x/c1/safeguard/leo', { club_id: 'c1', user_id: 'leo', name: 'Leo', pledge_version: 1, cleared_until: 'velho', background: { status: 'valid', valid_until: venceEm } });
    const r1 = await cs.sweep(ctx(db));
    expect(r1.warned).toBe(1);
    expect(avisosPara(db, 'leo').filter((n) => /vence em/i.test(n.title))).toHaveLength(1);
    expect(doc(db, 'club_x/c1/safeguard/leo').cleared_until).toBe(venceEm);
    const r2 = await cs.sweep(ctx(db));
    expect(r2.warned).toBe(0);
    expect(avisosPara(db, 'leo').filter((n) => /vence em/i.test(n.title))).toHaveLength(1);
  });

  it('apaga o responsável de quem completou 18 anos; o menor segue', async () => {
    const db = cenario();
    db.store.docs.set('club_x/c1/minors/ana', { club_id: 'c1', user_id: 'ana', guardian: { name: 'Mãe' } });
    db.store.docs.set('club_x/c1/minors/bia', { club_id: 'c1', user_id: 'bia', guardian: { name: 'Mãe da Bia' } });
    const r = await cs.sweep(ctx(db));
    expect(r.minors_cleared).toBe(1);
    expect(doc(db, 'club_x/c1/minors/ana')).toBeUndefined();
    expect(doc(db, 'club_x/c1/minors/bia')).toBeTruthy();
  });

  it('flag desligada ou clube sem associação: nada', async () => {
    expect(await cs.sweep(ctx(cenario({ flag: false })))).toMatchObject({ skipped: 'flag' });
    const db = cenario({ associacao: false });
    db.store.docs.set('club_x/c1/minors/ana', { club_id: 'c1', user_id: 'ana', guardian: { name: 'Mãe' } });
    await cs.sweep(ctx(db));
    expect(doc(db, 'club_x/c1/minors/ana')).toBeTruthy();
  });
});
