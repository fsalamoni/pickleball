/**
 * A DUPLA SEM CONTA da Minha carreira (PR 6), contra um Firestore falso:
 * "Convidar pelo WhatsApp" gera um link de UM uso, com validade, guardando só
 * o hash do token (nenhum telefone); quem abre o link e aceita preenche a
 * dupla VAZIA — nunca troca uma conta que já está lá; o dono não se liga a si
 * mesmo; menor não convida nem é convidado (a resposta é a mesma, nada é
 * gravado); cancelar derruba o link; usado, vencido e inexistente respondem igual.
 */
import { describe, it, expect } from 'vitest';
import { createRequire } from 'node:module';
import { createHash } from 'node:crypto';

const require = createRequire(import.meta.url);
const c = require('./career.js');
const { createFakeDb } = require('../tests/fakes/fakeFirestore.cjs');

const NOW = Date.UTC(2026, 10, 4, 15, 0, 0);
const DIA = 86400000;
const ANA = { uid: 'ana111', name: 'Ana' };
const ZE = { uid: 'zeze555', name: 'Zé' };
const CAU = { uid: 'cau333', name: 'Cau' };
const MENOR = { uid: 'men444', name: 'Menor' };
const EV_ID = 'ana111_ev1';
const NEUTRO = 'Este convite não vale mais. Peça um link novo a quem convidou.';

const evento = (extra = {}) => ({
  uid: 'ana111', name: 'Copa Sul', start_date: '2026-10-10', status: 'played', partner_uids: ['bia222'],
  entries: [
    { format: 'doubles', gender: 'mixed', placement: 'champion', partner: { name: 'Zé Ninguém' } },
    { format: 'doubles', gender: 'male', placement: 'runner_up', partner: { name: 'ze  ninguem' } },
    { format: 'doubles', gender: 'female', partner: { uid: 'bia222', name: 'Bia' } },
  ],
  ...extra,
});

function cenario({ flag = true, anaNasc = '1990-06-01', ev = evento() } = {}) {
  return {
    db: createFakeDb({
      'platform_settings/global': { feature_flags: { athlete_career: flag } },
      'users/ana111': { platform_name: 'Ana Souza', birth_date: anaNasc },
      'users/zeze555': { platform_name: 'José Silva', birth_date: '1988-03-03' },
      'users/cau333': { platform_name: 'Cau', birth_date: '1990-01-01' },
      'users/men444': { platform_name: 'Menor', birth_date: '2012-01-01' },
      [`career_events/${EV_ID}`]: ev,
    }),
  };
}
const ctx = ({ db }, now = NOW) => ({ db, now, Timestamp: { fromMillis: (ms) => ({ ms }) }, logger: { info() {}, warn() {} } });
const chamar = (k, actor, data, now) => c.career(ctx(k, now), actor, data);
const convites = (k) => [...k.db.store.docs.entries()].filter(([p]) => p.startsWith('career_partner_invites/'));
const avisos = (k) => [...k.db.store.docs.entries()].filter(([p]) => p.startsWith('notifications/')).map(([, d]) => d);
const ev = (k) => k.db.store.docs.get(`career_events/${EV_ID}`);
const gerar = (k, actor = ANA) => chamar(k, actor, { action: 'invite_link', eventId: EV_ID, partnerName: 'Zé Ninguém' });
const aceitar = (k, actor, token, now) => chamar(k, actor, { action: 'invite_accept', token }, now);

describe('gerar o link (só o dono, só dupla digitada, nunca menor)', () => {
  it('⭐ guarda só o hash do token (é o id), com validade de 14 dias e nenhum telefone', async () => {
    const k = cenario();
    const r = await gerar(k);
    expect(r.token).toMatch(/^[A-Za-z0-9_-]{32}$/);
    expect(r.id).toBe(createHash('sha256').update(r.token).digest('hex'));
    expect(r.expires_at_ms).toBe(NOW + 14 * DIA);
    const [[path, d]] = convites(k);
    expect(path).toBe(`career_partner_invites/${r.id}`);
    expect(d).toMatchObject({ owner_uid: 'ana111', event_id: EV_ID, name_key: 'ze ninguem', partner_name: 'Zé Ninguém', owner_name: 'Ana Souza' });
    const tudo = JSON.stringify([...k.db.store.docs.values()]);
    expect(tudo).not.toContain(r.token);
    expect(tudo).not.toMatch(/phone|telefone/);
  });

  it('gerar de novo derruba o link anterior (um convite por nome)', async () => {
    const k = cenario();
    const a = await gerar(k);
    const b = await gerar(k);
    expect(convites(k).map(([p]) => p)).toEqual([`career_partner_invites/${b.id}`]);
    await expect(aceitar(k, ZE, a.token)).rejects.toMatchObject({ message: NEUTRO });
  });

  it('🔴 torneio de outra pessoa, dupla com conta, nome que não está, planejado e menor: recusado', async () => {
    const k = cenario();
    await expect(gerar(k, CAU)).rejects.toMatchObject({ code: 'permission-denied' });
    await expect(chamar(k, ANA, { action: 'invite_link', eventId: EV_ID, partnerName: 'Bia' })).rejects.toMatchObject({ code: 'failed-precondition' });
    await expect(chamar(k, ANA, { action: 'invite_link', eventId: EV_ID, partnerName: 'Fulano' })).rejects.toMatchObject({ code: 'failed-precondition' });
    await expect(gerar(cenario({ ev: evento({ start_date: '2026-12-01', status: 'planned' }) }))).rejects.toMatchObject({ code: 'failed-precondition' });
    const menor = cenario({ anaNasc: '2010-01-01' });
    await expect(gerar(menor)).rejects.toMatchObject({ code: 'failed-precondition' });
    expect(convites(menor)).toHaveLength(0);
    await expect(gerar(cenario({ flag: false }))).rejects.toMatchObject({ code: 'failed-precondition' });
  });
});

describe('aceitar o link (uma vez, só preenche o vazio)', () => {
  it('⭐ preenche as duplas digitadas com a conta, consome o link, abre o pedido e avisa o dono', async () => {
    const k = cenario();
    const { token } = await gerar(k);
    const peek = await chamar(k, ZE, { action: 'invite_peek', token });
    expect(peek).toMatchObject({ valid: true, owner_name: 'Ana Souza', partner_name: 'Zé Ninguém', event_name: 'Copa Sul' });
    expect(await aceitar(k, ZE, token)).toEqual({ docId: `${EV_ID}__zeze555` });
    const e = ev(k);
    expect(e.entries[0].partner).toEqual({ uid: 'zeze555', name: 'Zé Ninguém' });
    expect(e.entries[1].partner).toEqual({ uid: 'zeze555', name: 'ze  ninguem' });
    expect(e.entries[2].partner).toEqual({ uid: 'bia222', name: 'Bia' });
    expect(e.partner_uids).toEqual(['bia222', 'zeze555']);
    expect(convites(k)).toHaveLength(0);
    const pedido = k.db.store.docs.get(`career_partner/${EV_ID}__zeze555`);
    expect(pedido).toMatchObject({ owner_uid: 'ana111', partner_uid: 'zeze555', status: 'invited', entry_indexes: [0, 1], partner_name: 'José Silva' });
    const [a] = avisos(k);
    expect(a).toMatchObject({ user_id: 'ana111', type: 'career', origin: 'server', link: `/carreira?evento=${encodeURIComponent(EV_ID)}` });
  });

  it('⭐ o link vale UMA vez: o segundo uso (até da mesma pessoa) recebe a resposta neutra', async () => {
    const k = cenario();
    const { token } = await gerar(k);
    await aceitar(k, ZE, token);
    await expect(aceitar(k, ZE, token)).rejects.toMatchObject({ code: 'failed-precondition', message: NEUTRO });
    await expect(aceitar(k, CAU, token)).rejects.toMatchObject({ message: NEUTRO });
    expect(ev(k).entries[0].partner.uid).toBe('zeze555');
  });

  it('⭐ vencido, inexistente e malformado respondem igual', async () => {
    const k = cenario();
    const { token } = await gerar(k);
    await expect(aceitar(k, ZE, token, NOW + 15 * DIA)).rejects.toMatchObject({ message: NEUTRO });
    await expect(aceitar(k, ZE, 'A'.repeat(32))).rejects.toMatchObject({ message: NEUTRO });
    await expect(aceitar(k, ZE, 'curto')).rejects.toMatchObject({ message: NEUTRO });
    expect(await chamar(k, ZE, { action: 'invite_peek', token }, NOW + 15 * DIA)).toEqual({ valid: false });
    expect(await chamar(k, ZE, { action: 'invite_peek', token: 'A'.repeat(32) })).toEqual({ valid: false });
    expect(ev(k).entries[0].partner.uid).toBeUndefined();
  });

  it('🔴 nunca troca uma conta: a dupla que já ganhou conta (pelo dono) recusa o link', async () => {
    const k = cenario();
    const { token } = await gerar(k);
    const atual = ev(k);
    k.db.store.docs.set(`career_events/${EV_ID}`, {
      ...atual, entries: atual.entries.map((e, i) => (i < 2 ? { ...e, partner: { uid: 'cau333', name: 'Cau' } } : e)),
    });
    await expect(aceitar(k, ZE, token)).rejects.toMatchObject({ message: NEUTRO });
    expect(ev(k).entries[0].partner).toEqual({ uid: 'cau333', name: 'Cau' });
    expect(k.db.store.docs.has(`career_partner/${EV_ID}__zeze555`)).toBe(false);
  });

  it('🔴 o dono não se liga a si mesmo', async () => {
    const k = cenario();
    const { token } = await gerar(k);
    expect(await chamar(k, ANA, { action: 'invite_peek', token })).toEqual({ valid: false, own: true });
    await expect(aceitar(k, ANA, token)).rejects.toMatchObject({ code: 'failed-precondition' });
    expect(ev(k).entries[0].partner.uid).toBeUndefined();
    expect(convites(k)).toHaveLength(1);
  });

  it('🔴 menor não é convidado: a mesma resposta neutra, nada gravado e o link segue para a dupla certa', async () => {
    const k = cenario();
    const { token } = await gerar(k);
    const antes = JSON.stringify([...k.db.store.docs.entries()]);
    expect(await chamar(k, MENOR, { action: 'invite_peek', token })).toEqual({ valid: false });
    await expect(aceitar(k, MENOR, token)).rejects.toMatchObject({ message: NEUTRO });
    expect(JSON.stringify([...k.db.store.docs.entries()])).toBe(antes);
    expect(await aceitar(k, ZE, token)).toEqual({ docId: `${EV_ID}__zeze555` });
  });

  it('🔴 a moderação retirou o pedido (remove_link): o link não o faz renascer', async () => {
    const k = cenario();
    const { token } = await gerar(k);
    k.db.store.docs.set(`career_partner_reports/${EV_ID}__zeze555__partner`, { moderation: { decision: 'remove_link' } });
    expect(await chamar(k, ZE, { action: 'invite_peek', token })).toEqual({ valid: false });
    await expect(aceitar(k, ZE, token)).rejects.toMatchObject({ message: NEUTRO });
    expect(k.db.store.docs.has(`career_partner/${EV_ID}__zeze555`)).toBe(false);
    expect(ev(k).entries[0].partner.uid).toBeUndefined();
  });

  it('🔴 a data virou futura depois do link: o aceite recusa (só torneio já jogado)', async () => {
    const k = cenario();
    const { token } = await gerar(k);
    k.db.store.docs.set(`career_events/${EV_ID}`, { ...ev(k), start_date: '2026-12-01' });
    await expect(aceitar(k, ZE, token)).rejects.toMatchObject({ message: NEUTRO });
    expect(convites(k)).toHaveLength(1);
  });

  it('gerar um link novo leva junto os convites já vencidos do torneio', async () => {
    const k = cenario();
    const velho = await gerar(k);
    k.db.store.docs.set(`career_partner_invites/${velho.id}`, { ...k.db.store.docs.get(`career_partner_invites/${velho.id}`), name_key: 'outro', expires_at_ms: NOW - 1 });
    const novo = await gerar(k);
    expect(convites(k).map(([p]) => p)).toEqual([`career_partner_invites/${novo.id}`]);
  });

  it('o registro apagado leva os convites (gatilho)', async () => {
    const k = cenario();
    await gerar(k);
    const antes = ev(k);
    k.db.store.docs.delete(`career_events/${EV_ID}`);
    await c.eventWritten(ctx(k), EV_ID, antes, null);
    expect(convites(k)).toHaveLength(0);
  });
});

describe('cancelar (só o dono)', () => {
  it('⭐ o link cancelado para de valer; outra pessoa não cancela', async () => {
    const k = cenario();
    const { id, token } = await gerar(k);
    await expect(chamar(k, CAU, { action: 'invite_cancel', id })).rejects.toMatchObject({ code: 'permission-denied' });
    expect(await chamar(k, ANA, { action: 'invite_cancel', id })).toEqual({ id });
    expect(convites(k)).toHaveLength(0);
    await expect(aceitar(k, ZE, token)).rejects.toMatchObject({ message: NEUTRO });
    expect(await chamar(k, ANA, { action: 'invite_cancel', id })).toEqual({ id });
  });
});
