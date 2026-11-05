/**
 * O XP da FICHA COMPLETA da Carreira, contra um Firestore falso: o
 * resultado declarado rende 0 (campeão e fase de grupos pagam o mesmo), a
 * mesma ficha não paga duas vezes, apagar ou descompletar zera, o teto do mês
 * vale (os zerados contam), flag e módulo desligados não pagam, e os outros
 * tipos de grant ficam intactos.
 */
import { describe, it, expect } from 'vitest';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const x = require('./careerXp.js');
const { createFakeDb } = require('../tests/fakes/fakeFirestore.cjs');

const NOW = Date.UTC(2026, 10, 4, 15, 0, 0); // 2026-11-04, Brasília
const UID = 'ana111';
const ev = (id, extra = {}) => ({
  uid: UID, name: `Copa ${id}`, start_date: '2026-10-10', status: 'played',
  entries: [{ format: 'doubles', placement: 'champion', partner: { name: 'Bia' } }],
  photos: [{ path: 'carreira/ana111/x.jpg', kind: 'medal' }],
  ...extra,
});
const balanco = (id) => ({ uid: UID, status: 'respondido', source: { type: 'externo', ref_id: id } });

function cenario({ flag = true, gam = null, eventos = {}, balancos = {}, extra = {} } = {}) {
  const seed = {
    'platform_settings/global': { feature_flags: { athlete_career: flag } },
    [`users/${UID}`]: { birth_date: '1990-05-01' },
    ...(gam ? { 'platform_settings/gamification': gam } : {}),
    ...extra,
  };
  Object.entries(eventos).forEach(([id, d]) => { seed[`career_events/${id}`] = d; });
  Object.entries(balancos).forEach(([id, d]) => { seed[`training_debriefs/${UID}_externo_${id}`] = d; });
  const db = createFakeDb(seed);
  return { db, now: NOW };
}
const grant = (ctx, id) => ctx.db.store.docs.get(`user_xp_grants/${UID}_career_${id}`);
const sync = (ctx, id) => x.sync(ctx, { uid: UID, eventId: id });

describe('a ficha completa rende XP pequeno, uma vez', () => {
  it('resultado + foto + balanço ⇒ 25 XP no mês corrente, com id determinístico', async () => {
    const ctx = cenario({ eventos: { [`${UID}_e1`]: ev(`${UID}_e1`) }, balancos: { [`${UID}_e1`]: balanco(`${UID}_e1`) } });
    expect(await sync(ctx, `${UID}_e1`)).toBe('paid');
    expect(grant(ctx, `${UID}_e1`)).toMatchObject({ uid: UID, kind: 'career', xp: 25, month: '2026-11', refId: `${UID}_e1` });
    expect(await sync(ctx, `${UID}_e1`)).toBe('kept');
  });

  it('o resultado declarado rende 0: campeão e fase de grupos pagam igual', async () => {
    const id = `${UID}_e1`;
    const a = cenario({ eventos: { [id]: ev(id) }, balancos: { [id]: balanco(id) } });
    const b = cenario({ eventos: { [id]: ev(id, { entries: [{ format: 'doubles', placement: 'groups' }] }) }, balancos: { [id]: balanco(id) } });
    await sync(a, id); await sync(b, id);
    expect(grant(a, id).xp).toBe(grant(b, id).xp);
    // Só o resultado, sem foto nem balanço: nada.
    const c = cenario({ eventos: { [id]: ev(id, { photos: [] }) } });
    expect(await sync(c, id)).toBe('none');
    expect(grant(c, id)).toBeUndefined();
  });

  it('falta foto, balanço ou colocação; planejado; futuro; torneio da plataforma ⇒ não paga', async () => {
    const id = `${UID}_e1`;
    const casos = [
      [ev(id, { photos: [] }), balanco(id)],
      [ev(id, { photos: [{}] }), balanco(id)],
      [ev(id, { photos: [{ path: 'carreira/outro/x.jpg' }] }), balanco(id)],
      [ev(id), null],
      [ev(id, { entries: [{ format: 'doubles' }] }), balanco(id)],
      [ev(id, { status: 'planned' }), balanco(id)],
      [ev(id, { start_date: '2026-12-01' }), balanco(id)],
      [ev(id, { platform_tournament_id: 'tor9' }), balanco(id)],
      [ev(id, { uid: 'outro' }), balanco(id)],
      [ev(id), { ...balanco(id), status: 'agora_nao' }],
    ];
    for (const [e, b] of casos) {
      const ctx = cenario({ eventos: { [id]: e }, balancos: b ? { [id]: b } : {} });
      expect(await sync(ctx, id)).toBe('none');
    }
  });
});

describe('desfazer zera, e refazer não paga de novo', () => {
  it('apagar o registro zera o grant (o documento fica)', async () => {
    const id = `${UID}_e1`;
    const ctx = cenario({ eventos: { [id]: ev(id) }, balancos: { [id]: balanco(id) } });
    await sync(ctx, id);
    ctx.db.store.docs.delete(`career_events/${id}`);
    expect(await x.onEvent(ctx, id, ev(id), null)).toBe('revoked');
    expect(grant(ctx, id).xp).toBe(0);
    // Recriar a mesma ficha: o documento zerado está lá, não paga de novo.
    ctx.db.store.docs.set(`career_events/${id}`, ev(id));
    expect(await sync(ctx, id)).toBe('kept');
    expect(grant(ctx, id).xp).toBe(0);
  });

  it('tirar a foto ou apagar o balanço descompleta e zera', async () => {
    const id = `${UID}_e1`;
    const ctx = cenario({ eventos: { [id]: ev(id) }, balancos: { [id]: balanco(id) } });
    await sync(ctx, id);
    ctx.db.store.docs.delete(`training_debriefs/${UID}_externo_${id}`);
    expect(await x.onDebrief(ctx, `${UID}_externo_${id}`, balanco(id), null)).toBe('revoked');
    expect(grant(ctx, id).xp).toBe(0);
  });

  it('trocar o tipo ou o evento do balanço também descompleta e zera', async () => {
    const id = `${UID}_e1`;
    for (const source of [{ type: 'avulso', ref_id: id }, { type: 'externo', ref_id: 'X' }]) {
      const ctx = cenario({ eventos: { [id]: ev(id) }, balancos: { [id]: balanco(id) } });
      await sync(ctx, id);
      const depois = { ...balanco(id), source };
      ctx.db.store.docs.set(`training_debriefs/${UID}_externo_${id}`, depois);
      expect(await x.onDebrief(ctx, `${UID}_externo_${id}`, balanco(id), depois)).toBe('revoked');
      expect(grant(ctx, id).xp).toBe(0);
    }
  });

  it('o balanço respondido depois completa a ficha pelo gatilho do balanço', async () => {
    const id = `${UID}_e1`;
    const ctx = cenario({ eventos: { [id]: ev(id) } });
    expect(await sync(ctx, id)).toBe('none');
    ctx.db.store.docs.set(`training_debriefs/${UID}_externo_${id}`, balanco(id));
    expect(await x.onDebrief(ctx, `${UID}_externo_${id}`, null, balanco(id))).toBe('paid');
    // Balanço de jogo (não de torneio de fora) não faz nada.
    expect(await x.onDebrief(ctx, `${UID}_game_g1`, null, { uid: UID, status: 'respondido', source: { type: 'game', ref_id: 'g1' } })).toBe('none');
  });
});

describe('teto do mês, configuração, flag e módulo', () => {
  const muitas = (n) => {
    const eventos = {}; const balancos = {};
    for (let i = 1; i <= n; i += 1) { const id = `${UID}_e${i}`; eventos[id] = ev(id); balancos[id] = balanco(id); }
    return { eventos, balancos };
  };

  it('4 fichas por mês; a 5ª não paga; os zerados contam no teto', async () => {
    const ctx = cenario(muitas(6));
    for (let i = 1; i <= 4; i += 1) expect(await sync(ctx, `${UID}_e${i}`)).toBe('paid');
    expect(await sync(ctx, `${UID}_e5`)).toBe('capped');
    // Apagar uma paga não abre vaga: o zerado segue contando.
    ctx.db.store.docs.delete(`career_events/${UID}_e1`);
    await sync(ctx, `${UID}_e1`);
    expect(await sync(ctx, `${UID}_e6`)).toBe('capped');
    // No mês seguinte, abre de novo.
    expect(await x.sync({ ...ctx, now: Date.UTC(2026, 11, 2, 15) }, { uid: UID, eventId: `${UID}_e5` })).toBe('paid');
  });

  it('os números saem da configuração do admin', async () => {
    const ctx = cenario({ ...muitas(3), gam: { career: { xpPerRecord: 10, monthlyCap: 2 } } });
    expect(await sync(ctx, `${UID}_e1`)).toBe('paid');
    expect(grant(ctx, `${UID}_e1`).xp).toBe(10);
    await sync(ctx, `${UID}_e2`);
    expect(await sync(ctx, `${UID}_e3`)).toBe('capped');
  });

  it('flag desligada, módulo career_xp desligado ou XP zero ⇒ não paga', async () => {
    for (const opts of [{ flag: false }, { gam: { modules: { career_xp: false } } }, { gam: { career: { xpPerRecord: 0 } } }]) {
      const ctx = cenario({ ...muitas(1), ...opts });
      expect(await sync(ctx, `${UID}_e1`)).toBe('off');
    }
  });

  it('menor de 18 ou nascimento desconhecido ⇒ não paga (ficaria no placar público)', async () => {
    for (const user of [{ birth_date: '2012-01-01' }, {}]) {
      const ctx = cenario({ ...muitas(1), extra: { [`users/${UID}`]: user } });
      expect(await sync(ctx, `${UID}_e1`)).toBe('minor');
      expect(grant(ctx, `${UID}_e1`)).toBeUndefined();
    }
  });

  it('os outros grants da pessoa não mudam', async () => {
    const outro = { uid: UID, kind: 'duel', xp: 200, refId: 'w1' };
    const ctx = cenario({ ...muitas(1), extra: { [`user_xp_grants/${UID}_duel_w1`]: outro } });
    await sync(ctx, `${UID}_e1`);
    ctx.db.store.docs.delete(`career_events/${UID}_e1`);
    await sync(ctx, `${UID}_e1`);
    expect(ctx.db.store.docs.get(`user_xp_grants/${UID}_duel_w1`)).toEqual(outro);
  });
});
