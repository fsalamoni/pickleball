import { describe, it, expect } from 'vitest';
import {
  LEAGUE_ORGANIZER, LEAGUE_FLAG_BY_ORGANIZER, leaguesVisible, groupCanCreate, leagueOrganizerOptions, canManageLeague,
} from './leagueAccess.js';
import { LEAGUE_FORMAT, LEAGUE_FORMAT_META, formatAvailable, canMoveStatus, isLeaguePublic, resultRules, isTeamFormat } from './leagueFormats.js';
import { normalizeSeason, roundCalendar, roundsFor, addMonths, isIsoDate, currentRound } from './leagueSeason.js';
import { divisionEligibility, normalizeDivisionRule, MILP_DIVISIONS, teamCompositionError } from './leagueDivisions.js';
import { validateResult, matchWinner, computeLeagueStandings, leagueTiebreakOrder, LEAGUE_DEFAULT_TIEBREAK_ORDER } from './leagueResults.js';

const tudo = Object.fromEntries(Object.values(LEAGUE_FLAG_BY_ORGANIZER).map((k) => [k, true]));

describe('quem vê e quem cria liga', () => {
  it('a área aparece com QUALQUER flag de ligas ligada, ou para o admin', () => {
    expect(leaguesVisible({})).toBe(false);
    expect(leaguesVisible({ leagues_clubs: true })).toBe(true);
    expect(leaguesVisible({}, { isPlatformAdmin: true })).toBe(true);
  });

  it('cada grupo tem a sua flag, independente das outras', () => {
    expect(groupCanCreate(LEAGUE_ORGANIZER.CLUB, { leagues_athletes: true })).toBe(false);
    expect(groupCanCreate(LEAGUE_ORGANIZER.ATHLETE, { leagues_athletes: true })).toBe(true);
    expect(groupCanCreate('inventado', tudo, { isPlatformAdmin: true })).toBe(false);
  });

  it('as opções de organizador saem do que a pessoa FAZ, já filtradas pelas flags', () => {
    const base = {
      user: { uid: 'u1', name: 'Ana' },
      clubs: [{ id: 'c1', name: 'Clube', my_role: 'admin' }, { id: 'c2', name: 'Outro', my_role: 'member' }],
      arenas: [{ id: 'a1', name: 'Arena' }],
      isCoach: true,
      federationRoles: [
        { federation_id: 'f1', federation_name: 'FGP', role: 'competitions', active: true },
        { federation_id: 'f2', federation_name: 'FX', role: 'communication', active: true },
      ],
    };
    const tipos = (o) => o.map((x) => `${x.type}:${x.id}`);
    expect(tipos(leagueOrganizerOptions({ ...base, flags: {} }))).toEqual([]);
    expect(tipos(leagueOrganizerOptions({ ...base, flags: { leagues_clubs: true } }))).toEqual(['club:c1']);
    const todas = tipos(leagueOrganizerOptions({ ...base, flags: tudo }));
    expect(todas).toEqual(expect.arrayContaining(['athlete:u1', 'coach:u1', 'club:c1', 'arena:a1']));
    expect(todas).not.toContain('club:c2');
    expect(todas).not.toContain('federation:f2');
  });

  it('quem gere a liga: a lista de organizadores ou quem responde pelo clube/arena', () => {
    const liga = { admins: ['u1'], organizer: { type: 'club', id: 'c1' } };
    expect(canManageLeague(liga, { uid: 'u1' })).toBe(true);
    expect(canManageLeague(liga, { uid: 'u2' })).toBe(false);
    expect(canManageLeague(liga, { uid: 'u2', clubs: [{ id: 'c1', my_role: 'member' }] })).toBe(false);
    expect(canManageLeague(liga, { uid: 'u2', clubs: [{ id: 'c1', my_role: 'admin' }] })).toBe(true);
    expect(canManageLeague(liga, { uid: 'u9', isPlatformAdmin: true })).toBe(true);
    const deAtleta = { admins: ['u1'], organizer: { type: 'athlete', id: 'u1' } };
    expect(canManageLeague(deAtleta, { uid: 'u3', arenas: [{ id: 'u1' }] })).toBe(false);
    expect(canManageLeague({ admins: [], organizer: { type: 'arena', id: 'a1' } }, { uid: 'u4', arenas: [{ id: 'a1' }] })).toBe(true);
  });
});

describe('formatos e situação', () => {
  it('todo formato tem metadados e é escolhível; equipe tem um jogo por linha', () => {
    Object.values(LEAGUE_FORMAT).forEach((f) => expect(LEAGUE_FORMAT_META[f]).toBeTruthy());
    expect(formatAvailable(LEAGUE_FORMAT.DIVISIONAL_PAIRS)).toBe(true);
    expect(formatAvailable(LEAGUE_FORMAT.TEAM_MILP)).toBe(true);
    expect(formatAvailable('x')).toBe(false);
    expect(resultRules(LEAGUE_FORMAT.TEAM_MILP)).toEqual({ lines: 4, dreambreaker: true });
    expect(resultRules(LEAGUE_FORMAT.TEAM_MILP_V3)).toEqual({ lines: 3, dreambreaker: false });
    expect(resultRules(LEAGUE_FORMAT.DIVISIONAL_PAIRS)).toEqual({ lines: 0, dreambreaker: false });
    expect(isTeamFormat(LEAGUE_FORMAT.TEAM_V4)).toBe(true);
    expect(isTeamFormat(LEAGUE_FORMAT.LADDER_PAIRS)).toBe(false);
  });

  it('montagem da equipe: MiLP 2+2, v4 mesma categoria, v3 livre', () => {
    const m = (...gs) => gs.map((gender) => ({ gender }));
    expect(teamCompositionError(LEAGUE_FORMAT.TEAM_MILP, m('male', 'female', 'female', 'male'))).toBeNull();
    expect(teamCompositionError(LEAGUE_FORMAT.TEAM_MILP, m('male', 'male', 'male', 'female'))).toBe('team_mix');
    expect(teamCompositionError(LEAGUE_FORMAT.TEAM_MILP, m('male', null, 'female', 'female'))).toBe('gender_unknown');
    expect(teamCompositionError(LEAGUE_FORMAT.TEAM_V4, m('female', 'female', 'female', 'female'))).toBeNull();
    expect(teamCompositionError(LEAGUE_FORMAT.TEAM_V4, m('female', 'female', 'male', 'female'))).toBe('team_same');
    expect(teamCompositionError(LEAGUE_FORMAT.TEAM_MILP_V3, m(null, 'male', 'female'))).toBeNull();
    expect(teamCompositionError(LEAGUE_FORMAT.TEAM_MILP_V3, m('male', 'female'))).toBe('team_size');
    expect(teamCompositionError(LEAGUE_FORMAT.DIVISIONAL_PAIRS, m('male'))).toBeNull();
  });

  it('as transições seguem a ordem natural e cancelada não volta', () => {
    expect(canMoveStatus('draft', 'open')).toBe(true);
    expect(canMoveStatus('draft', 'finished')).toBe(false);
    expect(canMoveStatus('cancelled', 'open')).toBe(false);
    expect(isLeaguePublic({ status: 'draft' })).toBe(false);
    expect(isLeaguePublic({ status: 'open' })).toBe(true);
    expect(isLeaguePublic({ status: 'open', visibility: 'unlisted' })).toBe(false);
  });
});

describe('temporada', () => {
  it('normaliza e volta ao padrão no que é inválido', () => {
    const s = normalizeSeason({ start_date: '2026-02-30', cadence: 'x', legs: 9, playoff: { enabled: true, size: 3 } });
    expect(s.start_date).toBeNull();
    expect(s.cadence).toBe('weekly');
    expect(s.legs).toBe(1);
    expect(s.round_window_days).toBe(7);
    expect(s.playoff).toEqual({ enabled: true, size: 4, third_place: false });
    expect(isIsoDate('2028-02-29')).toBe(true);
  });

  it('rodadas: ímpar folga uma vez por turno, e o returno dobra', () => {
    expect(roundsFor(1)).toBe(0);
    expect(roundsFor(6)).toBe(5);
    expect(roundsFor(5)).toBe(5);
    expect(roundsFor(6, 2)).toBe(10);
  });

  it('semanal: data pulada empurra a rodada para a semana seguinte', () => {
    const cal = roundCalendar({ start_date: '2026-03-03', skip_dates: ['2026-03-10'] }, 3);
    expect(cal.map((r) => r.date)).toEqual(['2026-03-03', '2026-03-17', '2026-03-24']);
    expect(cal[0].deadline).toBe('2026-03-09');
    expect(currentRound(cal, '2026-03-12')?.round).toBe(2);
  });

  it('mensal mantém o dia (com o fim do mês no lugar)', () => {
    expect(addMonths('2026-01-31', 1)).toBe('2026-02-28');
    const cal = roundCalendar({ start_date: '2026-01-15', cadence: 'monthly' }, 2);
    expect(cal.map((r) => r.date)).toEqual(['2026-01-15', '2026-02-15']);
  });

  it('datas escolhidas: o que falta fica "a definir"', () => {
    const cal = roundCalendar({ cadence: 'custom', custom_dates: ['2026-05-02', '2026-04-01'] }, 3);
    expect(cal.map((r) => r.date)).toEqual(['2026-04-01', '2026-05-02', null]);
  });
});

describe('divisões', () => {
  it('faixa: média da dupla; DUPR desconhecido não barra, a menos que exigido', () => {
    const div = { rule: { kind: 'dupr_range', min: 3.5, max: 4 } };
    expect(divisionEligibility(div, [{ dupr: 3.6 }, { dupr: 4.2 }])).toMatchObject({ ok: true, value: 3.9 });
    expect(divisionEligibility(div, [{ dupr: 4.5 }, { dupr: 4.2 }]).reason).toBe('above');
    expect(divisionEligibility(div, [{ dupr: null }, { dupr: 3.7 }])).toMatchObject({ ok: true, unrated: true });
    const exige = { rule: { ...div.rule, allow_unrated: false } };
    expect(divisionEligibility(exige, [{ dupr: null }, { dupr: 3.7 }]).reason).toBe('missing_dupr');
  });

  it('soma MiLP: sem DUPR vale o padrão; teto individual barra', () => {
    const d16 = MILP_DIVISIONS.four[2];
    const div = { rule: { kind: 'dupr_sum', ...d16 } };
    expect(divisionEligibility(div, [{ dupr: 4 }, { dupr: 4 }, { dupr: 4 }, { dupr: null }])).toMatchObject({ ok: true, value: 16 });
    expect(divisionEligibility(div, [{ dupr: 4.7 }, { dupr: 3 }, { dupr: 3 }, { dupr: 3 }]).reason).toBe('over_individual_cap');
    expect(divisionEligibility(div, [{ dupr: 4.5 }, { dupr: 4.5 }, { dupr: 4.5 }, { dupr: 4 }]).reason).toBe('over_cap');
  });

  it('gênero: mista pede um de cada, categoria desconhecida é dita', () => {
    const mista = { gender: 'mixed' };
    expect(divisionEligibility(mista, [{ gender: 'male' }, { gender: 'female' }]).ok).toBe(true);
    expect(divisionEligibility(mista, [{ gender: 'male' }, { gender: 'male' }]).reason).toBe('gender');
    expect(divisionEligibility({ gender: 'female' }, [{ gender: null }]).reason).toBe('gender_unknown');
  });

  it('faixa oficial: a numérica confere a média do DUPR; a descritiva não barra; a desconhecida vira livre', () => {
    const d = { rule: { kind: 'bracket', bracket: '3.500-3.999' } };
    expect(divisionEligibility(d, [{ dupr: 3.6 }, { dupr: 3.8 }])).toMatchObject({ ok: true, value: 3.7 });
    expect(divisionEligibility(d, [{ dupr: 3.9 }, { dupr: 4.4 }]).reason).toBe('above');
    expect(divisionEligibility({ rule: { kind: 'bracket', bracket: '4.500+' } }, [{ dupr: 7.1 }]).ok).toBe(true);
    expect(divisionEligibility({ rule: { kind: 'bracket', bracket: 'pro' } }, [{ dupr: 2.1 }]).ok).toBe(true);
    expect(divisionEligibility({ rule: { kind: 'bracket', bracket: '3.500-3.999', allow_unrated: false } }, [{ dupr: null }]).reason).toBe('missing_dupr');
    expect(normalizeDivisionRule({ kind: 'bracket', bracket: '4.0' })).toEqual({ kind: 'open' });
    expect(normalizeDivisionRule({ kind: 'bracket', bracket: 'other', label: 'Série B' })).toMatchObject({ label: 'Série B' });
  });

  it('regra estranha vira livre; faixa invertida é desvirada', () => {
    expect(normalizeDivisionRule({ kind: 'x' })).toEqual({ kind: 'open' });
    expect(normalizeDivisionRule({ kind: 'dupr_range', min: 5, max: 4 })).toMatchObject({ min: 4, max: 5 });
  });
});

describe('placar e classificação', () => {
  it('valida o placar por game e o W.O.', () => {
    expect(validateResult({ games: [{ a: 11, b: 7 }] })).toMatchObject({ ok: true, winner: 'a' });
    expect(validateResult({ games: [{ a: 11, b: 11 }] }).error).toBe('tie_game');
    expect(validateResult({ games: [{ a: 11, b: 7 }, { a: 5, b: 11 }] }).error).toBe('draw');
    expect(validateResult({ games: [{ a: -1, b: 7 }] }).error).toBe('invalid');
    // Confronto de equipe: os jogos exatos e o DreamBreaker no 2 a 2.
    const regras = { lines: 4, dreambreaker: true };
    const dois = [{ a: 21, b: 9 }, { a: 9, b: 21 }, { a: 21, b: 19 }, { a: 19, b: 21 }];
    expect(validateResult({ games: dois.slice(0, 3) }, regras).error).toBe('lines');
    expect(validateResult({ games: dois }, regras).error).toBe('needs_db');
    expect(validateResult({ games: dois, dreambreaker: { a: 20, b: 20 } }, regras).error).toBe('db_tie');
    expect(validateResult({ games: dois, dreambreaker: { a: 15, b: 21 } }, regras)).toMatchObject({ ok: true, winner: 'b', dreambreaker: { a: 15, b: 21 } });
    expect(matchWinner({ games: dois, dreambreaker: { a: 15, b: 21 } })).toBe('b');
    expect(matchWinner({ games: dois })).toBeNull();
    expect(validateResult({ games: [...dois.slice(0, 3), { a: 21, b: 1 }], dreambreaker: { a: 1, b: 21 } }, regras)).toMatchObject({ winner: 'a', dreambreaker: null });
    expect(validateResult({})).toMatchObject({ ok: false, error: 'empty' });
    expect(validateResult({ wo_winner: 'b' })).toMatchObject({ ok: true, winner: 'b', games: [] });
    expect(matchWinner({ games: [] })).toBeNull();
  });

  const E = (id) => ({ id, name: id.toUpperCase() });
  const J = (a, b, games, wo) => ({ side_a: a, side_b: b, games: games || [], wo_winner: wo || null });

  it('pontos: vitória 3, derrota 1, W.O. 0; confronto direto decide entre dois', () => {
    const rows = computeLeagueStandings([E('a'), E('b'), E('c')], [
      J('a', 'b', [{ a: 11, b: 9 }]),
      J('b', 'c', [{ a: 11, b: 2 }]),
      J('c', 'a', null, 'b'),
    ]);
    expect(rows.map((r) => r.entry_id)).toEqual(['a', 'b', 'c']);
    expect(rows[0]).toMatchObject({ points: 6, wins: 2 });
    expect(rows[2]).toMatchObject({ points: 1, wo_losses: 1 });
  });

  it('dois empatados: vale quem venceu o confronto, mesmo com saldo pior', () => {
    const rows = computeLeagueStandings([E('a'), E('b'), E('c'), E('d')], [
      J('a', 'b', [{ a: 11, b: 9 }]),
      J('c', 'a', [{ a: 11, b: 2 }]),
      J('b', 'd', [{ a: 11, b: 0 }]),
      J('c', 'd', [{ a: 11, b: 0 }]),
    ]);
    // a e b: 1 vitória e 1 derrota cada; b tem saldo melhor, mas a venceu b.
    expect(rows.map((r) => r.entry_id)).toEqual(['c', 'a', 'b', 'd']);
  });

  it('desempate configurável: a ordem escolhida (padrão do torneio) vale', () => {
    const jogos = [
      J('a', 'b', [{ a: 11, b: 9 }]),
      J('c', 'a', [{ a: 11, b: 2 }]),
      J('b', 'd', [{ a: 11, b: 0 }]),
      J('c', 'd', [{ a: 11, b: 0 }]),
    ];
    const ents = [E('a'), E('b'), E('c'), E('d')];
    // Saldo primeiro: b (+9) passa a (−7) mesmo tendo perdido o confronto.
    expect(computeLeagueStandings(ents, jogos, { tiebreak_order: ['balance', 'head_to_head'] }).map((r) => r.entry_id))
      .toEqual(['c', 'b', 'a', 'd']);
    expect(leagueTiebreakOrder([])).toEqual(LEAGUE_DEFAULT_TIEBREAK_ORDER);
    expect(leagueTiebreakOrder(['x', 'sets', 'sets'])).toEqual(['sets']);
  });

  it('três empatados: mini-tabela só entre eles (o círculo cai no saldo)', () => {
    const ents = [E('a'), E('b'), E('c')];
    const rows = computeLeagueStandings(ents, [
      J('a', 'b', [{ a: 11, b: 9 }]),
      J('b', 'c', [{ a: 11, b: 3 }]),
      J('c', 'a', [{ a: 11, b: 10 }]),
    ]);
    // Cada um 1V 1D e 1 vitória na mini-tabela; saldo de games igual; saldo: b +6, c −7, a +1.
    expect(rows.map((r) => r.entry_id)).toEqual(['b', 'a', 'c']);
  });

  it('aproveitamento; desistente vai para o fim', () => {
    const rows = computeLeagueStandings([E('a'), { ...E('b'), status: 'withdrawn' }, E('c')], [
      J('b', 'a', [{ a: 11, b: 1 }]),
      J('a', 'c', [{ a: 11, b: 1 }]),
    ], { mode: 'win_pct' });
    expect(rows.map((r) => r.entry_id)).toEqual(['a', 'c', 'b']);
    expect(rows[0].win_pct).toBe(0.5);
  });
});
