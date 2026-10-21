/**
 * Comentários no acervo e na agenda, no SERVIDOR contra um Firestore falso:
 * quem lê (igual à regra do documento ou evento), comentar com limites,
 * consulta pública com prazo, denúncia que oculta sozinha na terceira pessoa,
 * resposta oficial e ocultação com aviso a quem escreveu, apagar o próprio
 * (com as respostas) e a lista que não entrega uid de ninguém.
 */
import { describe, it, expect } from 'vitest';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const cm = require('./federationComments.js');
const { createFakeDb } = require('../tests/fakes/fakeFirestore.cjs');

const NOW = Date.UTC(2026, 9, 21, 15, 0, 0);
const SEC = { uid: 'sec', name: 'Secretaria' };
const FIN = { uid: 'fin' };
const ANA = { uid: 'ana' };
const BIA = { uid: 'bia' };
const CAU = { uid: 'cau' };
const DUD = { uid: 'dud' };

function cenario({ mods = { calendar: true, official_docs: true }, rules } = {}) {
  return {
    db: createFakeDb({
      'platform_settings/global': { feature_flags: { federations: true } },
      'federations/fpp': { name: 'Federação Paulista', acronym: 'FPP', slug: 'fpp', status: 'approved', modules: mods, ...(rules ? { rules } : {}) },
      'federation_staff/fpp_sec': { federation_id: 'fpp', user_id: 'sec', role: 'secretary' },
      'federation_staff/fpp_fin': { federation_id: 'fpp', user_id: 'fin', role: 'treasurer' },
      'federation_members/fpp_ana': { federation_id: 'fpp', user_id: 'ana', status: 'active' },
      'users/ana': { platform_name: 'Ana Souza' },
      'users/bia': { full_name: 'Bia Lima' },
      'federation_docs/reg': { federation_id: 'fpp', status: 'published', title: 'Regulamento 2027', visibility: 'public' },
      'federation_docs/socios': { federation_id: 'fpp', status: 'published', title: 'Ata reservada', visibility: 'members' },
      'federation_docs/rasc': { federation_id: 'fpp', status: 'draft', title: 'Rascunho', visibility: 'public' },
      'federation_events/ago': { federation_id: 'fpp', status: 'scheduled', title: 'AGO 2026', visibility: 'public' },
    }),
  };
}
const ctx = ({ db }, now = NOW) => ({ db, now, Timestamp: { fromMillis: (ms) => ({ ms }) }, logger: { info() {}, warn() {} } });
const chamar = (c, actor, data, now) => cm.comments(ctx(c, now), actor, { federationId: 'fpp', ...data });
const listar = (c, actor, data, now) => cm.list(ctx(c, now), actor, { federationId: 'fpp', ...data });
const comentarios = (c) => [...c.db.store.docs.entries()].filter(([p]) => p.startsWith('federation_comments/')).map(([p, d]) => ({ id: p.split('/')[1], ...d }));
const avisos = (c) => [...c.db.store.docs.entries()].filter(([p]) => p.startsWith('notifications/')).map(([, d]) => d);
const postar = (c, actor, text = 'Ótima mudança no regulamento.', alvo = { kind: 'doc', targetId: 'reg' }, now) => chamar(c, actor, { action: 'post', ...alvo, text }, now);

describe('comentários: quem lê e quem comenta', () => {
  it('documento público: qualquer pessoa lê sem conta; comentar grava o nome do cadastro', async () => {
    const c = cenario();
    const r = await postar(c, ANA);
    expect(comentarios(c)[0]).toMatchObject({ id: r.id, user_id: 'ana', user_name: 'Ana Souza', target_key: 'doc_reg', target_title: 'Regulamento 2027', status: 'visible', official: false });
    const sem = await listar(c, null, { kind: 'doc', targetId: 'reg' });
    expect(sem).toMatchObject({ signed_in: false, can_moderate: false, count: 1, state: { open: true } });
    expect(sem.comments[0]).toMatchObject({ user_name: 'Ana Souza', mine: false });
    expect(sem.comments[0]).not.toHaveProperty('user_id');
    expect(sem.comments[0]).not.toHaveProperty('reports_count');
    expect((await listar(c, ANA, { kind: 'doc', targetId: 'reg' })).comments[0].mine).toBe(true);
  });

  it('só filiados: quem não é filiado nem lê nem comenta; o filiado e a equipe sim', async () => {
    const c = cenario();
    await expect(listar(c, null, { kind: 'doc', targetId: 'socios' })).rejects.toMatchObject({ code: 'permission-denied' });
    await expect(postar(c, BIA, 'Quero ver isso', { kind: 'doc', targetId: 'socios' })).rejects.toMatchObject({ code: 'permission-denied' });
    await postar(c, ANA, 'Faltou a pauta 3', { kind: 'doc', targetId: 'socios' });
    expect((await listar(c, FIN, { kind: 'doc', targetId: 'socios' })).count).toBe(1);
  });

  it('rascunho, módulo desligado e documento de outra federação não recebem comentário', async () => {
    const c = cenario();
    await expect(postar(c, ANA, 'Olá a todos', { kind: 'doc', targetId: 'rasc' })).rejects.toMatchObject({ code: 'permission-denied' });
    await expect(postar(cenario({ mods: { calendar: true } }), ANA)).rejects.toMatchObject({ code: 'failed-precondition' });
    await expect(postar(c, ANA, 'Olá a todos', { kind: 'doc', targetId: 'nao-existe' })).rejects.toMatchObject({ code: 'not-found' });
  });

  it('evento da agenda também recebe comentário', async () => {
    const c = cenario();
    await postar(c, BIA, 'Haverá transmissão?', { kind: 'event', targetId: 'ago' });
    expect(comentarios(c)[0]).toMatchObject({ target_key: 'event_ago', user_name: 'Bia Lima' });
  });

  it('texto curto, intervalo de 30 s e teto de 10 por dia', async () => {
    const c = cenario();
    await expect(postar(c, ANA, 'ok')).rejects.toMatchObject({ code: 'invalid-argument' });
    await postar(c, ANA, 'Primeiro comentário');
    await expect(postar(c, ANA, 'Segundo comentário', undefined, NOW + 5000)).rejects.toMatchObject({ code: 'resource-exhausted' });
    for (let i = 1; i < 10; i += 1) await postar(c, ANA, `Comentário ${i}`, undefined, NOW + i * 60000);
    await expect(postar(c, ANA, 'O décimo primeiro', undefined, NOW + 11 * 60000)).rejects.toMatchObject({ code: 'resource-exhausted' });
  });
});

describe('comentários: abertos, fechados e consulta pública', () => {
  it('a equipe fecha e abre consulta com prazo; depois do prazo ninguém comenta e o que foi escrito fica', async () => {
    const c = cenario();
    await expect(chamar(c, FIN, { action: 'settings', kind: 'doc', targetId: 'reg', settings: { mode: 'closed' } })).rejects.toMatchObject({ code: 'permission-denied' });
    await chamar(c, SEC, { action: 'settings', kind: 'doc', targetId: 'reg', settings: { mode: 'closed' } });
    await expect(postar(c, ANA)).rejects.toMatchObject({ code: 'failed-precondition' });
    await expect(chamar(c, SEC, { action: 'settings', kind: 'doc', targetId: 'reg', settings: { mode: 'consultation', until_date: '2026-10-20' } })).rejects.toMatchObject({ code: 'invalid-argument' });
    const r = await chamar(c, SEC, { action: 'settings', kind: 'doc', targetId: 'reg', settings: { mode: 'consultation', until_date: '2026-10-25' } });
    expect(r.state).toMatchObject({ open: true, mode: 'consultation', until_date: '2026-10-25' });
    await postar(c, ANA, 'Sugiro rever o art. 4');
    const depois = Date.UTC(2026, 9, 26, 3, 0, 0);
    await expect(postar(c, BIA, 'Cheguei tarde', undefined, depois)).rejects.toMatchObject({ code: 'failed-precondition' });
    const l = await listar(c, null, { kind: 'doc', targetId: 'reg' }, depois);
    expect(l).toMatchObject({ count: 1, state: { open: false, why: 'ended' } });
  });

  it('a federação que desliga os comentários fecha todos', async () => {
    const c = cenario({ rules: { comments: false } });
    await expect(postar(c, ANA)).rejects.toMatchObject({ code: 'failed-precondition' });
    expect((await listar(c, null, { kind: 'doc', targetId: 'reg' })).state).toMatchObject({ open: false, why: 'disabled' });
  });
});

describe('comentários: moderação', () => {
  it('três denúncias de pessoas diferentes ocultam; denúncia repetida não conta; a moderação reabre e zera', async () => {
    const c = cenario();
    const { id } = await postar(c, ANA, 'Comentário polêmico');
    await expect(chamar(c, ANA, { action: 'report', commentId: id, reason: 'spam' })).rejects.toMatchObject({ code: 'failed-precondition' });
    await expect(chamar(c, BIA, { action: 'report', commentId: id, reason: 'xx' })).rejects.toMatchObject({ code: 'invalid-argument' });
    await chamar(c, BIA, { action: 'report', commentId: id, reason: 'offensive' });
    expect(await chamar(c, BIA, { action: 'report', commentId: id, reason: 'offensive' })).toMatchObject({ already: true });
    await chamar(c, CAU, { action: 'report', commentId: id, reason: 'spam' });
    expect(await chamar(c, DUD, { action: 'report', commentId: id, reason: 'off_topic' })).toMatchObject({ hidden: true });
    expect(comentarios(c)[0]).toMatchObject({ status: 'hidden', hidden_by: 'reports', reports_count: 3 });
    expect((await listar(c, null, { kind: 'doc', targetId: 'reg' })).comments).toHaveLength(0);
    expect((await listar(c, ANA, { kind: 'doc', targetId: 'reg' })).comments[0]).toMatchObject({ mine: true, status: 'hidden' });
    const fila = await chamar(c, SEC, { action: 'queue' });
    expect(fila.items[0]).toMatchObject({ id, reports_count: 3, hidden_by: 'reports', target_kind: 'doc', target_id: 'reg' });
    await expect(chamar(c, FIN, { action: 'queue' })).rejects.toMatchObject({ code: 'permission-denied' });
    await chamar(c, SEC, { action: 'restore', commentId: id });
    expect(comentarios(c)[0]).toMatchObject({ status: 'visible', reports_count: 0 });
  });

  it('ocultar exige motivo e avisa quem escreveu com ele', async () => {
    const c = cenario();
    const { id } = await postar(c, ANA, 'Com o telefone de alguém');
    await expect(chamar(c, SEC, { action: 'hide', commentId: id, reason: 'curto' })).rejects.toMatchObject({ code: 'invalid-argument' });
    await chamar(c, SEC, { action: 'hide', commentId: id, reason: 'Expõe dado pessoal de terceiro' });
    expect(comentarios(c)[0]).toMatchObject({ status: 'hidden', hidden_by: 'staff', hidden_reason: 'Expõe dado pessoal de terceiro' });
    expect(avisos(c)).toHaveLength(1);
    expect(avisos(c)[0]).toMatchObject({ user_id: 'ana', link: '/f/fpp/acervo/reg' });
  });

  it('resposta oficial leva o nome da federação, avisa o autor e não aceita resposta de resposta', async () => {
    const c = cenario();
    const { id } = await postar(c, ANA, 'Quando sai o calendário?');
    await expect(chamar(c, BIA, { action: 'reply', commentId: id, text: 'Eu também quero saber' })).rejects.toMatchObject({ code: 'permission-denied' });
    const r = await chamar(c, SEC, { action: 'reply', commentId: id, text: 'Sai na próxima semana.' });
    expect(r.notified).toBe(1);
    const resp = comentarios(c).find((x) => x.id === r.id);
    expect(resp).toMatchObject({ official: true, org_name: 'FPP', parent_id: id, target_key: 'doc_reg' });
    await expect(chamar(c, SEC, { action: 'reply', commentId: r.id, text: 'De novo' })).rejects.toMatchObject({ code: 'failed-precondition' });
    await expect(chamar(c, BIA, { action: 'report', commentId: r.id, reason: 'spam' })).rejects.toMatchObject({ code: 'failed-precondition' });
  });

  it('só quem escreveu apaga; apagar leva as respostas e as denúncias junto', async () => {
    const c = cenario();
    const { id } = await postar(c, ANA, 'Vou apagar depois');
    await chamar(c, SEC, { action: 'reply', commentId: id, text: 'Resposta oficial' });
    await chamar(c, BIA, { action: 'report', commentId: id, reason: 'spam' });
    await expect(chamar(c, BIA, { action: 'delete', commentId: id })).rejects.toMatchObject({ code: 'permission-denied' });
    await chamar(c, ANA, { action: 'delete', commentId: id });
    expect(comentarios(c)).toHaveLength(0);
    expect([...c.db.store.docs.keys()].some((p) => p.startsWith('federation_comment_reports/'))).toBe(false);
  });
});
