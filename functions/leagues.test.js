/**
 * LIGAS no SERVIDOR, contra um Firestore falso: a flag de CADA grupo vale na
 * criação; só quem responde pelo clube/arena cria em nome dele; inscrição só
 * aberta, sem repetir atleta e dentro da faixa; rodadas não são refeitas com
 * placar lançado; só a organização lança placar; desistência com jogo fica.
 */
import { describe, it, expect } from 'vitest';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { leagues } = require('./leagues.js');
const { createFakeDb } = require('../tests/fakes/fakeFirestore.cjs');

const NOW = Date.UTC(2026, 10, 12, 15, 0, 0);
const ANA = { uid: 'ana', name: 'Ana' };
const BIA = { uid: 'bia', name: 'Bia' };
const CAU = { uid: 'cau', name: 'Cau' };
const DUDA = { uid: 'duda', name: 'Duda' };
const ADM = { uid: 'adm', name: 'Admin', isPlatformAdmin: true };

function banco(flags = { leagues_athletes: true }) {
  return createFakeDb({
    'platform_settings/global': { feature_flags: flags },
    'users/ana': { platform_name: 'Ana Souza', dupr_rating: 3.8, competition_gender: 'female' },
    'users/bia': { platform_name: 'Bia Lima', dupr_rating: 4.1, competition_gender: 'female' },
    'users/cau': { platform_name: 'Cau Reis', dupr_rating: 5.2, competition_gender: 'male' },
    'users/duda': { platform_name: 'Duda Melo', competition_gender: 'female' },
    'users/adm': { platform_name: 'Admin' },
    'clubs/c1': { name: 'Clube Sol' },
    'club_members/c1_ana': { role: 'admin' },
    'club_members/c1_bia': { role: 'member' },
  });
}
const ctx = (db) => ({ db, now: NOW, Timestamp: { fromMillis: (ms) => ({ ms }) }, logger: { info() {}, warn() {} } });
const chama = (db, actor, data) => leagues(ctx(db), actor, data);
const docs = (db, prefixo) => [...db.store.docs.entries()].filter(([p]) => p.startsWith(prefixo) && !p.slice(prefixo.length).includes('/'));

const base = {
  action: 'create', organizer: { type: 'athlete' }, name: 'Liga de Verão', format: 'divisional_pairs',
  season: { start_date: '2026-12-01' },
  divisions: [{ name: '3.5 a 4.0', rule: { kind: 'dupr_range', min: 3.5, max: 4.25 } }],
};

async function ligaAberta(db) {
  const { leagueId } = await chama(db, ANA, base);
  await chama(db, ANA, { action: 'status', leagueId, to: 'open' });
  const [[divPath]] = docs(db, `leagues/${leagueId}/divisions/`);
  return { leagueId, divisionId: divPath.split('/').pop() };
}

describe('criar liga', () => {
  it('flag do grupo desligada recusa; o admin da plataforma cria mesmo assim', async () => {
    const db = banco({});
    await expect(chama(db, ANA, base)).rejects.toThrow(/não está liberada/);
    await expect(chama(db, ADM, base)).resolves.toHaveProperty('leagueId');
  });

  it('a flag de atletas não libera criar em nome do clube', async () => {
    const db = banco({ leagues_athletes: true });
    await expect(chama(db, ANA, { ...base, organizer: { type: 'club', id: 'c1' } })).rejects.toThrow(/não está liberada/);
  });

  it('em nome do clube só quem o administra', async () => {
    const db = banco({ leagues_clubs: true });
    await expect(chama(db, BIA, { ...base, organizer: { type: 'club', id: 'c1' } })).rejects.toThrow(/não responde/);
    const { leagueId } = await chama(db, ANA, { ...base, organizer: { type: 'club', id: 'c1' } });
    const lg = db.store.docs.get(`leagues/${leagueId}`);
    expect(lg).toMatchObject({ status: 'draft', organizer: { type: 'club', id: 'c1', name: 'Clube Sol' }, admins: ['ana'] });
  });

  it('formato "em breve" e liga sem divisão são recusados', async () => {
    const db = banco();
    await expect(chama(db, ANA, { ...base, format: 'team_milp' })).rejects.toThrow(/indisponível/);
    await expect(chama(db, ANA, { ...base, divisions: [] })).rejects.toThrow(/pelo menos uma divisão/);
  });

  it('ação desconhecida e "constructor" não passam', async () => {
    const db = banco();
    await expect(chama(db, ANA, { action: 'constructor' })).rejects.toThrow(/desconhecida/);
  });
});

describe('inscrição', () => {
  it('só com a liga aberta; sem repetir atleta; dentro da faixa', async () => {
    const db = banco();
    const { leagueId } = await chama(db, ANA, base);
    const [[divPath]] = docs(db, `leagues/${leagueId}/divisions/`);
    const divisionId = divPath.split('/').pop();
    await expect(chama(db, BIA, { action: 'register', leagueId, divisionId, partnerUid: 'duda' })).rejects.toThrow(/não estão abertas/);
    await chama(db, ANA, { action: 'status', leagueId, to: 'open' });
    const { entryId } = await chama(db, BIA, { action: 'register', leagueId, divisionId, partnerUid: 'duda' });
    const e = db.store.docs.get(`leagues/${leagueId}/entries/${entryId}`);
    expect(e.player_uids).toEqual(['bia', 'duda']);
    expect(e.players[0]).toEqual({ uid: 'bia', name: 'Bia Lima', dupr: 4.1, gender: 'female' });
    expect(JSON.stringify(e)).not.toMatch(/@|phone|birth/);
    expect(db.store.docs.get(`leagues/${leagueId}`).member_uids).toEqual(expect.arrayContaining(['ana', 'bia', 'duda']));
    await expect(chama(db, DUDA, { action: 'register', leagueId, divisionId, partnerUid: 'ana' })).rejects.toThrow(/já está inscrito/);
    await expect(chama(db, ANA, { action: 'register', leagueId, divisionId, partnerUid: 'cau' })).rejects.toThrow(/acima da faixa/);
  });

  it('a organização inscreve quem não tem conta e pode passar por cima da faixa', async () => {
    const db = banco();
    const { leagueId, divisionId } = await ligaAberta(db);
    await expect(chama(db, BIA, { action: 'entry_add', leagueId, divisionId, players: [{ uid: 'cau' }, { name: 'Zé' }] })).rejects.toThrow(/Só quem organiza/);
    await expect(chama(db, ANA, { action: 'entry_add', leagueId, divisionId, players: [{ uid: 'cau' }, { name: 'Zé' }] })).rejects.toThrow(/acima/);
    const { entryId } = await chama(db, ANA, { action: 'entry_add', leagueId, divisionId, override: true, players: [{ uid: 'cau' }, { name: 'Zé' }] });
    expect(db.store.docs.get(`leagues/${leagueId}/entries/${entryId}`)).toMatchObject({ player_uids: ['cau'], eligibility: { override: true } });
  });
});

describe('rodadas e placar', () => {
  async function comRodadas() {
    const db = banco();
    const { leagueId, divisionId } = await ligaAberta(db);
    const pares = [['bia', 'duda'], ['ana', 'duda'], ['ana', 'bia']];
    await chama(db, ANA, { action: 'entry_add', leagueId, divisionId, players: [{ uid: pares[0][0] }, { uid: pares[0][1] }] });
    await chama(db, ANA, { action: 'entry_add', leagueId, divisionId, players: [{ uid: 'ana' }, { name: 'Lia' }] });
    await chama(db, ANA, { action: 'entry_add', leagueId, divisionId, players: [{ name: 'Mia' }, { name: 'Nina' }] });
    const r = await chama(db, ANA, { action: 'schedule', leagueId, divisionId, start: true });
    return { db, leagueId, divisionId, r };
  }

  it('gera o pontos corridos e começa a liga', async () => {
    const { db, leagueId, r } = await comRodadas();
    expect(r.matches).toBe(3);
    expect(docs(db, `leagues/${leagueId}/matches/`)).toHaveLength(3);
    expect(db.store.docs.get(`leagues/${leagueId}`).status).toBe('running');
  });

  it('placar só pela organização; com placar as rodadas não são refeitas', async () => {
    const { db, leagueId, divisionId } = await comRodadas();
    const [[jogoPath]] = docs(db, `leagues/${leagueId}/matches/`);
    const matchId = jogoPath.split('/').pop();
    await expect(chama(db, BIA, { action: 'result', leagueId, matchId, games: [{ a: 11, b: 3 }] })).rejects.toThrow(/Só quem organiza/);
    await expect(chama(db, ANA, { action: 'result', leagueId, matchId, games: [{ a: 11, b: 11 }] })).rejects.toThrow(/inválido/);
    await chama(db, ANA, { action: 'result', leagueId, matchId, games: [{ a: 11, b: 3 }] });
    expect(db.store.docs.get(jogoPath)).toMatchObject({ status: 'done', games: [{ a: 11, b: 3 }] });
    await expect(chama(db, ANA, { action: 'schedule', leagueId, divisionId })).rejects.toThrow(/já tem placar/);
  });

  it('desistência com jogo marcado fica como desistência; o atleta sai sozinho', async () => {
    const { db, leagueId } = await comRodadas();
    const [entryPath] = docs(db, `leagues/${leagueId}/entries/`).find(([, d]) => d.player_uids.includes('bia'));
    const entryId = entryPath.split('/').pop();
    await expect(chama(db, CAU, { action: 'withdraw', leagueId, entryId })).rejects.toThrow(/Só quem organiza/);
    const r = await chama(db, BIA, { action: 'withdraw', leagueId, entryId });
    expect(r.kept).toBe(true);
    expect(db.store.docs.get(entryPath).status).toBe('withdrawn');
    expect(db.store.docs.get(`leagues/${leagueId}`).member_uids).not.toContain('bia');
  });
});
