/**
 * Ligar o provisório à conta: a troca é COMPLETA (conta, dados e e-mail
 * oficial), a prova do e-mail inventado some e nada troca a conta de ninguém.
 */
import { describe, it, expect } from 'vitest';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { validateLinkRequest, buildLinkPlan, applyRegistrationLink } = require('./registrationLink.js');

const DEL = { del: true };
const TS = { ts: true };
const FieldValue = { delete: () => DEL, serverTimestamp: () => TS };

function fakeDb({ regs = {}, users = {}, admins = [] } = {}) {
  const ops = [];
  const ref = (path) => ({
    path,
    get: async () => {
      const [col, id] = path.split('/');
      const src = col === 'tournament_registrations' ? regs : col === 'users' ? users : null;
      if (col === 'tournament_admins') return { exists: admins.includes(id) };
      return { exists: Boolean(src?.[id]), id, data: () => src?.[id] };
    },
    collection: (sub) => ({ doc: (id) => ref(`${path}/${sub}/${id}`) }),
  });
  return {
    ops,
    collection: (col) => ({
      doc: (id) => ref(`${col}/${id}`),
      where: (campo, _op, valor) => ({
        get: async () => ({
          docs: Object.entries(regs).filter(([, r]) => r[campo] === valor).map(([id, r]) => ({ id, data: () => r })),
        }),
      }),
    }),
    batch: () => ({
      update: (r, d) => ops.push(['update', r.path, d]),
      set: (r, d, o) => ops.push(['set', r.path, d, o]),
      delete: (r) => ops.push(['delete', r.path]),
      commit: async () => ops.push(['commit']),
    }),
  };
}
const auth = (emails = {}) => ({ getUser: async (uid) => { if (!emails[uid]) throw new Error('nf'); return { email: emails[uid] }; } });

const provisorio = {
  tournament_id: 't1', modality_id: 'm1', format: 'doubles', status: 'confirmed',
  user_id: null, player_a_user_id: null, player_a_name: 'João Provisório', player_a_provisional: true,
  player_a_email: 'joao.inventado@tmp.com', player_a_email_lc: 'joao.inventado@tmp.com',
  player_b_user_id: 'u2', player_b_name: 'Bia', player_b_provisional: false, is_provisional: true,
  label: 'João Provisório / Bia',
};
const joao = { platform_name: 'João Silva', level: 'L3', competition_gender: 'male', photo_url: 'f.jpg', email: 'perfil@x.com' };

describe('validateLinkRequest', () => {
  it('exige inscrição, lado a/b e conta', () => {
    expect(validateLinkRequest({}).error).toMatch(/inscrição/);
    expect(validateLinkRequest({ registrationId: 'r', slot: 'c', userId: 'u' }).error).toMatch(/Jogador/);
    expect(validateLinkRequest({ registrationId: 'r', slot: 'a' }).error).toMatch(/atleta/);
    expect(validateLinkRequest({ registrationId: ' r ', slot: 'b', userId: 'u' })).toEqual({ registrationId: 'r', slot: 'b', userId: 'u' });
  });
});

describe('buildLinkPlan', () => {
  it('⭐ troca conta, nome, nível, categoria e foto pelos do cadastro; e-mail oficial do Auth', () => {
    const plan = buildLinkPlan({ id: 'r1', ...provisorio }, 'a', 'u1', { user: joao, authUser: { email: 'Joao@Real.com' } });
    expect(plan.updates).toMatchObject({
      player_a_user_id: 'u1', user_id: 'u1', player_a_name: 'João Silva', player_a_level: 'L3',
      player_a_competition_gender: 'male', player_a_photo: 'f.jpg', player_a_provisional: false,
      is_provisional: false, label: 'João Silva / Bia',
    });
    expect(plan.email).toBe('joao@real.com');
    expect(plan.refresh).toBe(false);
  });
  it('sem e-mail no Auth usa o do cadastro; nunca publica o e-mail como nome', () => {
    const plan = buildLinkPlan({ id: 'r1', ...provisorio }, 'a', 'u1', { user: { email: 'ze@x.com' } });
    expect(plan.email).toBe('ze@x.com');
    expect(plan.updates.player_a_name).toBe('ze');
  });
  it('nunca troca a conta de quem já tem OUTRA', () => {
    expect(buildLinkPlan({ id: 'r1', ...provisorio }, 'b', 'u9', { user: joao }).error).toMatch(/outra conta/);
  });
  it('a mesma conta já ligada é "atualizar com o cadastro"', () => {
    const plan = buildLinkPlan({ id: 'r1', ...provisorio }, 'b', 'u2', { user: { platform_name: 'Beatriz' } });
    expect(plan.refresh).toBe(true);
    expect(plan.updates.player_b_name).toBe('Beatriz');
  });
  it('recusa: atleta já na inscrição, já em outra da modalidade, lado B em simples, equipe', () => {
    expect(buildLinkPlan({ id: 'r1', ...provisorio }, 'a', 'u2', { user: joao }).error).toMatch(/nesta inscrição/);
    const others = [{ id: 'r2', status: 'confirmed', player_a_user_id: 'u1', label: 'Outra' }];
    expect(buildLinkPlan({ id: 'r1', ...provisorio }, 'a', 'u1', { user: joao, others }).error).toMatch(/Outra/);
    expect(buildLinkPlan({ id: 'r1', ...provisorio }, 'a', 'u1', { user: joao, others: [{ ...others[0], status: 'cancelled' }] }).error).toBeUndefined();
    expect(buildLinkPlan({ id: 'r1', ...provisorio, format: 'singles' }, 'b', 'u1', { user: joao }).error).toMatch(/jogador B/);
    expect(buildLinkPlan({ id: 'r1', ...provisorio, kind: 'team' }, 'a', 'u1', { user: joao }).error).toMatch(/equipe/);
    expect(buildLinkPlan({ id: 'r1', ...provisorio }, 'a', 'u1', { user: null }).error).toMatch(/Cadastro/);
  });
  it('o outro lado ainda provisório mantém a inscrição provisória', () => {
    const reg = { id: 'r1', ...provisorio, player_b_user_id: null, player_b_provisional: true };
    expect(buildLinkPlan(reg, 'a', 'u1', { user: joao }).updates.is_provisional).toBe(true);
  });
});

describe('applyRegistrationLink', () => {
  it('⭐ num lote: inscrição atualizada sem o e-mail público, contato com o oficial, prova apagada', async () => {
    const db = fakeDb({ regs: { r1: provisorio }, users: { u1: joao }, admins: ['t1_org'] });
    const res = await applyRegistrationLink({ db, auth: auth({ u1: 'joao@real.com' }), FieldValue },
      { registrationId: 'r1', slot: 'a', userId: 'u1' }, { actor: { uid: 'org' } });
    expect(res).toMatchObject({ status: 'ok', name: 'João Silva', refresh: false, previous_name: 'João Provisório' });
    const [upd, set, del, commit] = db.ops;
    expect(upd[1]).toBe('tournament_registrations/r1');
    expect(upd[2]).toMatchObject({ player_a_user_id: 'u1', player_a_email: DEL, player_a_email_lc: DEL, player_a_linked_by: 'org' });
    expect(set[1]).toBe('tournament_registrations/r1/private/contact');
    expect(set[2]).toMatchObject({ player_a_email: 'joao@real.com', player_a_email_lc: 'joao@real.com' });
    expect(set[3]).toEqual({ merge: true });
    expect(del).toEqual(['delete', 'provisional_claims/r1_a']);
    expect(commit).toEqual(['commit']);
  });
  it('quem não organiza o torneio não liga nada', async () => {
    const db = fakeDb({ regs: { r1: provisorio }, users: { u1: joao } });
    const res = await applyRegistrationLink({ db, auth: auth(), FieldValue },
      { registrationId: 'r1', slot: 'a', userId: 'u1' }, { actor: { uid: 'x' } });
    expect(res.status).toBe('denied');
    expect(db.ops).toEqual([]);
  });
  it('o admin da plataforma pode; erro de regra não grava nada', async () => {
    const db = fakeDb({ regs: { r1: provisorio }, users: { u1: joao } });
    const res = await applyRegistrationLink({ db, auth: auth(), FieldValue },
      { registrationId: 'r1', slot: 'b', userId: 'u1' }, { actor: { uid: 'adm', isPlatformAdmin: true } });
    expect(res.status).toBe('error');
    expect(db.ops).toEqual([]);
  });
});
