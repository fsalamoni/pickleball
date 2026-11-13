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
    'users/edu': { platform_name: 'Edu Dias', dupr_rating: 3.5, competition_gender: 'male' },
    'users/fred': { platform_name: 'Fred Paz', dupr_rating: 3.9, gender: 'masculino' },
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

  it('formato desconhecido e liga sem divisão são recusados', async () => {
    const db = banco();
    await expect(chama(db, ANA, { ...base, format: 'team_xyz' })).rejects.toThrow(/indisponível/);
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

  it('a vaga é conferida na transação: divisão completa recusa e a contagem fecha', async () => {
    const db = banco();
    const { leagueId, divisionId } = await ligaAberta(db);
    const divPath = `leagues/${leagueId}/divisions/${divisionId}`;
    db.store.docs.set(divPath, { ...db.store.docs.get(divPath), max_entries: 1 });
    await chama(db, BIA, { action: 'register', leagueId, divisionId, partnerUid: 'duda' });
    await expect(chama(db, ANA, { action: 'register', leagueId, divisionId, partnerUid: 'edu' })).rejects.toThrow(/completa/);
    const lg = db.store.docs.get(`leagues/${leagueId}`);
    expect(lg.entries_count).toBe(1);
    expect(lg.member_uids).toEqual(expect.arrayContaining(['ana', 'bia', 'duda']));
    expect(lg.member_uids).not.toContain('edu');
  });

  it('a organização inscreve quem não tem conta e, como no torneio, fora da faixa vira exceção marcada', async () => {
    const db = banco();
    const { leagueId, divisionId } = await ligaAberta(db);
    await expect(chama(db, BIA, { action: 'entry_add', leagueId, divisionId, players: [{ uid: 'cau' }, { name: 'Zé' }] })).rejects.toThrow(/Só quem organiza/);
    const { entryId } = await chama(db, ANA, { action: 'entry_add', leagueId, divisionId, players: [{ uid: 'cau' }, { name: 'Zé' }] });
    expect(db.store.docs.get(`leagues/${leagueId}/entries/${entryId}`)).toMatchObject({ player_uids: ['cau'], added_by: 'organizer', eligibility: { override: true } });
    const dentro = await chama(db, ANA, { action: 'entry_add', leagueId, divisionId, players: [{ uid: 'bia' }, { uid: 'duda' }] });
    expect(db.store.docs.get(`leagues/${leagueId}/entries/${dentro.entryId}`).eligibility.override).toBe(false);
  });

  it('divisão pela faixa oficial: a numérica confere o DUPR; a descritiva não barra', async () => {
    const db = banco();
    const { leagueId } = await chama(db, ANA, { ...base, divisions: [
      { name: '3,5 a 3,999', rule: { kind: 'bracket', bracket: '3.500-3.999', min: 2, max: 8 } },
      { name: 'Iniciante', rule: { kind: 'bracket', bracket: 'beginner' } },
      { name: 'Inventada', rule: { kind: 'bracket', bracket: '9.9' } },
    ] });
    const divs = docs(db, `leagues/${leagueId}/divisions/`).map(([p, d]) => ({ id: p.split('/').pop(), ...d }));
    expect(divs.map((d) => d.rule)).toEqual([
      { kind: 'bracket', bracket: '3.500-3.999', allow_unrated: true },
      { kind: 'bracket', bracket: 'beginner', allow_unrated: true },
      { kind: 'open' },
    ]);
    await chama(db, ANA, { action: 'status', leagueId, to: 'open' });
    await expect(chama(db, ANA, { action: 'register', leagueId, divisionId: divs[0].id, partnerUid: 'cau' })).rejects.toThrow(/acima da faixa/);
    await expect(chama(db, ANA, { action: 'register', leagueId, divisionId: divs[1].id, partnerUid: 'cau' })).resolves.toHaveProperty('entryId');
  });

  it('a ordem de desempate escolhida é gravada só com critérios conhecidos', async () => {
    const db = banco();
    const { leagueId } = await chama(db, ANA, { ...base, standings: { mode: 'points', tiebreak_order: ['balance', 'x', 'balance', 'head_to_head'] } });
    expect(db.store.docs.get(`leagues/${leagueId}`).standings.tiebreak_order).toEqual(['balance', 'head_to_head']);
  });
});

describe('equipes (MiLP)', () => {
  const milp = {
    ...base, format: 'team_milp', standings: { mode: 'win_pct' },
    divisions: [{ name: 'DUPR 16', rule: { kind: 'dupr_sum', cap: 16.3, individual_cap: 4.6, unrated_value: 4 } }],
  };
  async function ligaMilp(db) {
    const { leagueId } = await chama(db, ANA, milp);
    await chama(db, ANA, { action: 'status', leagueId, to: 'open' });
    const [[divPath]] = docs(db, `leagues/${leagueId}/divisions/`);
    return { leagueId, divisionId: divPath.split('/').pop() };
  }

  it('a equipe entra com os companheiros, 2 homens e 2 mulheres, dentro da soma', async () => {
    const db = banco();
    const { leagueId, divisionId } = await ligaMilp(db);
    await expect(chama(db, ANA, { action: 'register', leagueId, divisionId, teammateUids: ['bia', 'edu'] })).rejects.toThrow(/3 companheiros/);
    await expect(chama(db, ANA, { action: 'register', leagueId, divisionId, teammateUids: ['bia', 'duda', 'edu'] })).rejects.toThrow(/2 homens e 2 mulheres/);
    await expect(chama(db, ANA, { action: 'register', leagueId, divisionId, teammateUids: ['bia', 'cau', 'edu'] })).rejects.toThrow(/teto individual/);
    const { entryId } = await chama(db, ANA, { action: 'register', leagueId, divisionId, name: 'Os Dinks', teammateUids: ['bia', 'edu', 'fred'] });
    const e = db.store.docs.get(`leagues/${leagueId}/entries/${entryId}`);
    expect(e).toMatchObject({ name: 'Os Dinks', player_uids: ['ana', 'bia', 'edu', 'fred'], eligibility: { value: 15.3, override: false } });
  });

  it('a organização inscreve fora da montagem e fica exceção', async () => {
    const db = banco();
    const { leagueId, divisionId } = await ligaMilp(db);
    const { entryId } = await chama(db, ANA, { action: 'entry_add', leagueId, divisionId, name: 'Mistas', players: [{ uid: 'ana' }, { uid: 'bia' }, { uid: 'duda' }, { name: 'Zé' }] });
    expect(db.store.docs.get(`leagues/${leagueId}/entries/${entryId}`).eligibility.override).toBe(true);
  });

  it('o confronto tem os quatro jogos e o DreamBreaker decide o 2 a 2', async () => {
    const db = banco();
    const { leagueId, divisionId } = await ligaMilp(db);
    await chama(db, ANA, { action: 'register', leagueId, divisionId, name: 'A', teammateUids: ['bia', 'edu', 'fred'] });
    await chama(db, ANA, { action: 'entry_add', leagueId, divisionId, name: 'B', players: [{ name: 'Lia' }, { name: 'Mia' }, { name: 'Rui' }, { name: 'Téo' }] });
    await chama(db, ANA, { action: 'schedule', leagueId, divisionId, start: true });
    const [[jogoPath]] = docs(db, `leagues/${leagueId}/matches/`);
    const matchId = jogoPath.split('/').pop();
    const dois = [{ a: 21, b: 15 }, { a: 18, b: 21 }, { a: 21, b: 19 }, { a: 12, b: 21 }];
    await expect(chama(db, ANA, { action: 'result', leagueId, matchId, games: dois.slice(0, 3) })).rejects.toThrow(/lines/);
    await expect(chama(db, ANA, { action: 'result', leagueId, matchId, games: dois })).rejects.toThrow(/needs_db/);
    await chama(db, ANA, { action: 'result', leagueId, matchId, games: dois, dreambreaker: { a: 21, b: 17 } });
    expect(db.store.docs.get(jogoPath)).toMatchObject({ status: 'done', dreambreaker: { a: 21, b: 17 } });
    await chama(db, ANA, { action: 'result', leagueId, matchId, games: [...dois.slice(0, 3), { a: 21, b: 4 }], dreambreaker: { a: 3, b: 21 } });
    expect(db.store.docs.get(jogoPath).dreambreaker).toBeNull();
    await chama(db, ANA, { action: 'result', leagueId, matchId, clear: true });
    expect(db.store.docs.get(jogoPath)).toMatchObject({ status: 'scheduled', dreambreaker: null, games: [] });
  });

  it('a escalação de cada linha só aceita dois atletas da própria equipe', async () => {
    const db = banco();
    const { leagueId, divisionId } = await ligaMilp(db);
    await chama(db, ANA, { action: 'register', leagueId, divisionId, name: 'A', teammateUids: ['bia', 'edu', 'fred'] });
    await chama(db, ANA, { action: 'entry_add', leagueId, divisionId, name: 'B', players: [{ uid: 'duda' }, { uid: 'cau' }, { name: 'Rui' }, { name: 'Téo' }] });
    await chama(db, ANA, { action: 'schedule', leagueId, divisionId, start: true });
    const [[jogoPath, jogo]] = docs(db, `leagues/${leagueId}/matches/`);
    const matchId = jogoPath.split('/').pop();
    const ladoA = db.store.docs.get(`leagues/${leagueId}/entries/${jogo.side_a}`).name === 'A';
    const da = (aqui, la) => (ladoA ? { a: aqui, b: la } : { a: la, b: aqui });
    const games = [{ a: 21, b: 15 }, { a: 21, b: 18 }, { a: 21, b: 19 }, { a: 12, b: 21 }];
    const errada = [da(['ana', 'cau'], ['duda', 'cau']), null, null, null];
    await expect(chama(db, ANA, { action: 'result', leagueId, matchId, games, lineups: errada })).rejects.toThrow(/dois atletas de cada equipe/);
    await expect(chama(db, ANA, { action: 'result', leagueId, matchId, games, lineups: [null] })).rejects.toThrow(/Escalação inválida/);
    const certa = [da(['ana', 'bia'], ['duda', 'cau']), null, null, null];
    await chama(db, ANA, { action: 'result', leagueId, matchId, games, lineups: certa });
    expect(db.store.docs.get(jogoPath).lineups).toEqual(certa);
    await chama(db, ANA, { action: 'result', leagueId, matchId, games });
    expect(db.store.docs.get(jogoPath).lineups).toBeNull();
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

describe('playoff', () => {
  async function comPlayoff() {
    const db = banco();
    const { leagueId } = await chama(db, ANA, { ...base, season: { start_date: '2026-12-01', playoff: { enabled: true, size: 4, third_place: true } } });
    await chama(db, ANA, { action: 'status', leagueId, to: 'open' });
    const [[divPath]] = docs(db, `leagues/${leagueId}/divisions/`);
    const divisionId = divPath.split('/').pop();
    for (const n of ['A', 'B', 'C', 'D', 'E']) {
      await chama(db, ANA, { action: 'entry_add', leagueId, divisionId, players: [{ name: `${n}1` }, { name: `${n}2` }] });
    }
    await chama(db, ANA, { action: 'schedule', leagueId, divisionId, start: true });
    const ids = docs(db, `leagues/${leagueId}/entries/`).map(([p]) => p.split('/').pop());
    return { db, leagueId, divisionId, ids };
  }
  const doPlayoff = (db, leagueId) => docs(db, `leagues/${leagueId}/matches/`).filter(([, m]) => m.phase === 'playoff');
  const placar = (db, leagueId, m, games) => chama(db, ANA, { action: 'result', leagueId, matchId: m[0].split('/').pop(), games });

  it('monta a chave pela tabela, avança fase a fase e desfaz a seguinte quando o placar muda', async () => {
    const { db, leagueId, divisionId, ids } = await comPlayoff();
    await expect(chama(db, BIA, { action: 'playoff', leagueId, divisionId, seeds: ids })).rejects.toThrow(/Só quem organiza/);
    await expect(chama(db, ANA, { action: 'playoff', leagueId, divisionId, seeds: [...ids, 'outra'] })).rejects.toThrow(/não está ativa/);
    const r = await chama(db, ANA, { action: 'playoff', leagueId, divisionId, seeds: ids });
    expect(r).toEqual({ matches: 2, round: 1 });
    const semis = doPlayoff(db, leagueId).sort((x, y) => x[1].slot - y[1].slot);
    expect(semis.map(([, m]) => [m.side_a, m.side_b])).toEqual([[ids[0], ids[3]], [ids[1], ids[2]]]);
    await expect(chama(db, ANA, { action: 'playoff', leagueId, divisionId })).rejects.toThrow(/Termine os jogos/);
    await placar(db, leagueId, semis[0], [{ a: 11, b: 5 }]);
    await placar(db, leagueId, semis[1], [{ a: 4, b: 11 }]);
    await chama(db, ANA, { action: 'playoff', leagueId, divisionId });
    const fase2 = doPlayoff(db, leagueId).filter(([, m]) => m.round === 2);
    expect(fase2.map(([, m]) => [m.third, m.side_a, m.side_b]).sort()).toEqual([[false, ids[0], ids[2]], [true, ids[3], ids[1]]]);
    // Mudar a semifinal com a final sem placar: a fase 2 sai de novo.
    await placar(db, leagueId, semis[1], [{ a: 11, b: 4 }]);
    expect(doPlayoff(db, leagueId).filter(([, m]) => m.round === 2)).toHaveLength(0);
    await chama(db, ANA, { action: 'playoff', leagueId, divisionId });
    const final = doPlayoff(db, leagueId).find(([, m]) => m.round === 2 && !m.third);
    expect(final[1].side_b).toBe(ids[1]);
    await placar(db, leagueId, final, [{ a: 11, b: 9 }]);
    await expect(placar(db, leagueId, semis[0], [{ a: 2, b: 11 }])).rejects.toThrow(/fase seguinte do playoff já tem placar/);
    const terceiro = doPlayoff(db, leagueId).find(([, m]) => m.third);
    await placar(db, leagueId, terceiro, [{ a: 11, b: 7 }]);
    await expect(chama(db, ANA, { action: 'playoff', leagueId, divisionId })).rejects.toThrow(/já terminou/);
    await expect(chama(db, ANA, { action: 'playoff', leagueId, divisionId, reseed: true, seeds: ids })).rejects.toThrow(/não é refeita/);
  });

  it('só com o playoff ligado na temporada', async () => {
    const db = banco();
    const { leagueId, divisionId } = await ligaAberta(db);
    await chama(db, ANA, { action: 'entry_add', leagueId, divisionId, players: [{ name: 'Mia' }, { name: 'Nina' }] });
    await chama(db, ANA, { action: 'entry_add', leagueId, divisionId, players: [{ name: 'Lia' }, { name: 'Gal' }] });
    await chama(db, ANA, { action: 'schedule', leagueId, divisionId, start: true });
    await expect(chama(db, ANA, { action: 'playoff', leagueId, divisionId, seeds: [] })).rejects.toThrow(/Ligue o playoff/);
  });
});

describe('liga flexível: quem joga lança e o outro lado confirma', () => {
  async function flex() {
    const db = banco();
    const { leagueId } = await chama(db, ANA, { ...base, format: 'flex_pairs' });
    await chama(db, ANA, { action: 'status', leagueId, to: 'open' });
    const [[divPath]] = docs(db, `leagues/${leagueId}/divisions/`);
    const divisionId = divPath.split('/').pop();
    await chama(db, ANA, { action: 'entry_add', leagueId, divisionId, players: [{ uid: 'bia' }, { uid: 'duda' }] });
    await chama(db, ANA, { action: 'entry_add', leagueId, divisionId, players: [{ uid: 'cau' }, { uid: 'edu' }] });
    await chama(db, ANA, { action: 'schedule', leagueId, divisionId, start: true });
    const [[jogoPath]] = docs(db, `leagues/${leagueId}/matches/`);
    return { db, leagueId, matchId: jogoPath.split('/').pop(), jogoPath };
  }
  const avisos = (db, uid, titulo) => docs(db, 'notifications/').filter(([, n]) => n.user_id === uid && JSON.stringify(n).includes(titulo));
  const EDU = { uid: 'edu', name: 'Edu' };

  it('lança, contesta, lança de novo e confirma', async () => {
    const { db, leagueId, matchId, jogoPath } = await flex();
    await expect(chama(db, ANA, { action: 'report', leagueId, matchId, games: [{ a: 11, b: 7 }] })).rejects.toThrow(/Só quem joga/);
    await chama(db, BIA, { action: 'report', leagueId, matchId, games: [{ a: 11, b: 7 }] });
    expect(db.store.docs.get(jogoPath)).toMatchObject({ status: 'reported', games: [], report: { side: 'a', by: 'bia', games: [{ a: 11, b: 7 }] } });
    expect(avisos(db, 'cau', 'Confirme o placar')).toHaveLength(1);
    await expect(chama(db, CAU, { action: 'report', leagueId, matchId, games: [{ a: 7, b: 11 }] })).rejects.toThrow(/outro lado já lançou/);
    await expect(chama(db, DUDA, { action: 'confirm', leagueId, matchId, accept: true })).rejects.toThrow(/outro lado do jogo/);
    await expect(chama(db, CAU, { action: 'confirm', leagueId, matchId, reason: 'x' })).rejects.toThrow(/Diga o que está errado/);
    await chama(db, CAU, { action: 'confirm', leagueId, matchId, reason: 'Foi 11 a 5' });
    expect(db.store.docs.get(jogoPath)).toMatchObject({ status: 'disputed', dispute: { by: 'cau', reason: 'Foi 11 a 5' } });
    expect(avisos(db, 'ana', 'Placar contestado')).toHaveLength(1);
    await chama(db, EDU, { action: 'report', leagueId, matchId, games: [{ a: 11, b: 5 }] });
    await chama(db, BIA, { action: 'confirm', leagueId, matchId, accept: true });
    expect(db.store.docs.get(jogoPath)).toMatchObject({ status: 'done', games: [{ a: 11, b: 5 }], recorded_by: 'edu', confirmed_by: 'bia', report: null });
    await expect(chama(db, BIA, { action: 'report', leagueId, matchId, games: [{ a: 11, b: 2 }] })).rejects.toThrow(/já tem placar/);
  });

  it('conta o que cada um tem a confirmar e, sem resposta no prazo, o placar vale', async () => {
    const { db, leagueId, matchId, jogoPath } = await flex();
    const liga = () => db.store.docs.get(`leagues/${leagueId}`);
    await chama(db, BIA, { action: 'report', leagueId, matchId, games: [{ a: 11, b: 7 }] });
    expect(liga().pending_confirm).toEqual({ cau: 1, edu: 1 });
    const { runAutoConfirm } = require('./leagues');
    expect(await runAutoConfirm({ ...ctx(db), now: NOW + 71 * 3600e3 })).toBe(0);
    expect(await runAutoConfirm({ ...ctx(db), now: NOW + 72 * 3600e3 })).toBe(1);
    expect(db.store.docs.get(jogoPath)).toMatchObject({ status: 'done', games: [{ a: 11, b: 7 }], recorded_by: 'bia', confirmed_by: null, auto_confirmed: true, report: null });
    expect(liga().pending_confirm).toEqual({});
    expect(avisos(db, 'cau', 'Placar valeu')).toHaveLength(1);
    expect(avisos(db, 'bia', 'Placar valeu')).toHaveLength(1);
  });

  it('contestado ou corrigido pela organização sai das pendências', async () => {
    const { db, leagueId, matchId } = await flex();
    const liga = () => db.store.docs.get(`leagues/${leagueId}`);
    await chama(db, BIA, { action: 'report', leagueId, matchId, games: [{ a: 11, b: 7 }] });
    await chama(db, CAU, { action: 'confirm', leagueId, matchId, reason: 'Foi 11 a 5' });
    expect(liga().pending_confirm).toEqual({});
    await chama(db, CAU, { action: 'report', leagueId, matchId, games: [{ a: 5, b: 11 }] });
    expect(liga().pending_confirm).toEqual({ bia: 1, duda: 1 });
    await chama(db, ANA, { action: 'result', leagueId, matchId, games: [{ a: 11, b: 5 }] });
    expect(liga().pending_confirm).toEqual({});
  });

  it('fora da liga flexível o placar é da organização', async () => {
    const db = banco();
    const { leagueId, divisionId } = await ligaAberta(db);
    await chama(db, ANA, { action: 'entry_add', leagueId, divisionId, players: [{ uid: 'bia' }, { uid: 'duda' }] });
    await chama(db, ANA, { action: 'entry_add', leagueId, divisionId, players: [{ uid: 'cau' }, { uid: 'edu' }] });
    await chama(db, ANA, { action: 'schedule', leagueId, divisionId, start: true });
    const [[jogoPath]] = docs(db, `leagues/${leagueId}/matches/`);
    await expect(chama(db, BIA, { action: 'report', leagueId, matchId: jogoPath.split('/').pop(), games: [{ a: 11, b: 7 }] })).rejects.toThrow(/quem lança o placar é a organização/);
  });
});
