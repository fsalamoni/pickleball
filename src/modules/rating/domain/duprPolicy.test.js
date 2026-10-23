import { describe, it, expect } from 'vitest';
import {
  DEFAULT_DUPR_POLICY, DUPR_BUCKET, DUPR_LEVEL, DUPR_MODE, DUPR_AUDIENCE, DUPR_MATCH_PROBLEM,
  normalizeDuprPolicy, duprBucket, duprSubmissionDecision, duprMatchEligibility, duprReadiness, duprIdentifier,
} from './duprPolicy.js';

const ligada = { mode: 'rules' };

describe('normalizeDuprPolicy', () => {
  it('sem documento: envio desligado e só o admin enxerga', () => {
    const p = normalizeDuprPolicy(null);
    expect(p.mode).toBe(DUPR_MODE.OFF);
    expect(p.audience).toBe(DUPR_AUDIENCE.ADMINS);
    expect(p.optional_default_on).toBe(false);
    expect(p.rules).toEqual(DEFAULT_DUPR_POLICY.rules);
  });

  it('valor desconhecido cai no padrão, nunca estoura', () => {
    const p = normalizeDuprPolicy({ mode: 'x', audience: 'y', grace_minutes: 'abc', rules: { tournament_fixed: 'talvez', fantasma: 'required' } });
    expect(p.mode).toBe('off');
    expect(p.audience).toBe('admins');
    expect(p.grace_minutes).toBe(30);
    expect(p.rules.tournament_fixed).toBe('required');
    expect(p.rules.fantasma).toBeUndefined();
  });

  it('a carência é limitada a 0–1440 minutos', () => {
    expect(normalizeDuprPolicy({ grace_minutes: -5 }).grace_minutes).toBe(0);
    expect(normalizeDuprPolicy({ grace_minutes: 99999 }).grace_minutes).toBe(1440);
    expect(normalizeDuprPolicy({ grace_minutes: 12.6 }).grace_minutes).toBe(13);
  });

  it('o admin pode trocar a regra de um grupo', () => {
    const p = normalizeDuprPolicy({ rules: { game_day_rotation: 'required', tournament_team: 'excluded' } });
    expect(p.rules.game_day_rotation).toBe('required');
    expect(p.rules.tournament_team).toBe('excluded');
  });
});

describe('duprBucket', () => {
  it('torneio de simples/duplas é fixo', () => {
    ['round_robin', 'groups', 'knockout', 'double_knockout', 'swiss'].forEach((s) => {
      expect(duprBucket({ origin: 'tournament', stageType: s })).toBe(DUPR_BUCKET.TOURNAMENT_FIXED);
    });
  });
  it('fase de rotação do torneio é opcional por modalidade', () => {
    ['americano', 'mexicano', 'americano_etapas'].forEach((s) => {
      expect(duprBucket({ origin: 'tournament', stageType: s })).toBe(DUPR_BUCKET.TOURNAMENT_ROTATION);
    });
  });
  it('equipes vencem o tipo da fase', () => {
    expect(duprBucket({ origin: 'tournament', stageType: 'americano', teamConfrontation: true })).toBe(DUPR_BUCKET.TOURNAMENT_TEAM);
  });
  it('dia de jogo: Play fora, o resto é rotação', () => {
    expect(duprBucket({ origin: 'game_day', gameDayFormat: 'play' })).toBe(DUPR_BUCKET.GAME_DAY_PLAY);
    ['americano', 'americano_live', 'mexicano', 'king_of_court', 'novo_formato'].forEach((f) => {
      expect(duprBucket({ origin: 'game_day', gameDayFormat: f })).toBe(DUPR_BUCKET.GAME_DAY_ROTATION);
    });
  });
});

describe('duprSubmissionDecision', () => {
  it('chave geral desligada: nada vai, nem o obrigatório', () => {
    const d = duprSubmissionDecision({ bucket: DUPR_BUCKET.TOURNAMENT_FIXED }, { mode: 'off' });
    expect(d).toMatchObject({ level: DUPR_LEVEL.OFF, submit: false, reason: 'policy_off' });
  });

  it('a regra do dono: torneio de simples/duplas/equipes é obrigatório', () => {
    [DUPR_BUCKET.TOURNAMENT_FIXED, DUPR_BUCKET.TOURNAMENT_TEAM].forEach((bucket) => {
      expect(duprSubmissionDecision({ bucket, creatorChoice: false }, ligada)).toMatchObject({ submit: true, reason: 'required' });
    });
  });

  it('americano: quem cria decide; sem escolha vale o padrão (desligado)', () => {
    [DUPR_BUCKET.TOURNAMENT_ROTATION, DUPR_BUCKET.GAME_DAY_ROTATION].forEach((bucket) => {
      expect(duprSubmissionDecision({ bucket, creatorChoice: true }, ligada)).toMatchObject({ submit: true, reason: 'creator_on' });
      expect(duprSubmissionDecision({ bucket, creatorChoice: false }, ligada)).toMatchObject({ submit: false, reason: 'creator_off' });
      expect(duprSubmissionDecision({ bucket }, ligada)).toMatchObject({ submit: false, reason: 'default_off' });
      expect(duprSubmissionDecision({ bucket }, { ...ligada, optional_default_on: true })).toMatchObject({ submit: true, reason: 'default_on' });
    });
  });

  it('o admin pode tornar obrigatório o que é opcional, e excluir o obrigatório', () => {
    const p = { mode: 'rules', rules: { game_day_rotation: 'required', tournament_team: 'excluded' } };
    expect(duprSubmissionDecision({ bucket: DUPR_BUCKET.GAME_DAY_ROTATION, creatorChoice: false }, p).submit).toBe(true);
    expect(duprSubmissionDecision({ bucket: DUPR_BUCKET.TOURNAMENT_TEAM }, p)).toMatchObject({ submit: false, reason: 'excluded_by_rule' });
  });

  it('Play nunca é elegível, nem por regra', () => {
    expect(duprSubmissionDecision({ bucket: DUPR_BUCKET.GAME_DAY_PLAY, creatorChoice: true }, { mode: 'rules', optional_default_on: true }))
      .toMatchObject({ submit: false, reason: 'play_no_score' });
  });

  it('modo manual: vai para a fila, mas espera o admin liberar', () => {
    const d = duprSubmissionDecision({ bucket: DUPR_BUCKET.TOURNAMENT_FIXED }, { mode: 'manual' });
    expect(d).toMatchObject({ submit: true, needsApproval: true });
    expect(duprSubmissionDecision({ bucket: DUPR_BUCKET.TOURNAMENT_FIXED }, ligada).needsApproval).toBe(false);
  });

  it('grupo desconhecido não vira obrigatório', () => {
    expect(duprSubmissionDecision({ bucket: 'qualquer' }, ligada).submit).toBe(false);
  });
});

describe('duprMatchEligibility', () => {
  const ok = { side_a: ['a1', 'a2'], side_b: ['b1', 'b2'], games: [{ a: 11, b: 7 }], winner: 'a' };

  it('partida completa de duplas passa', () => {
    expect(duprMatchEligibility(ok)).toEqual({ ok: true, problems: [] });
  });
  it('simples 1x1 passa; 3 por lado não', () => {
    expect(duprMatchEligibility({ ...ok, side_a: ['a1'], side_b: ['b1'] }).ok).toBe(true);
    expect(duprMatchEligibility({ ...ok, side_a: ['a1', 'a2', 'a3'], side_b: ['b1', 'b2', 'b3'] }).problems).toContain(DUPR_MATCH_PROBLEM.TOO_MANY_PLAYERS);
  });
  it('lado vazio, lados desiguais e jogador repetido', () => {
    expect(duprMatchEligibility({ ...ok, side_b: [] }).problems).toContain(DUPR_MATCH_PROBLEM.NO_PLAYERS);
    expect(duprMatchEligibility({ ...ok, side_a: ['a1'] }).problems).toContain(DUPR_MATCH_PROBLEM.UNEVEN_SIDES);
    expect(duprMatchEligibility({ ...ok, side_b: ['a1', 'b2'] }).problems).toContain(DUPR_MATCH_PROBLEM.REPEATED_PLAYER);
    expect(duprMatchEligibility({ ...ok, side_a: ['a1', null] }).problems).toContain(DUPR_MATCH_PROBLEM.NO_PLAYERS);
  });
  it('sem placar (ou 0 x 0) não vai: W.O. e bye ficam de fora', () => {
    expect(duprMatchEligibility({ ...ok, games: [] }).problems).toContain(DUPR_MATCH_PROBLEM.NO_SCORE);
    expect(duprMatchEligibility({ ...ok, games: [{ a: 0, b: 0 }] }).problems).toContain(DUPR_MATCH_PROBLEM.NO_SCORE);
  });
  it('empate em algum game não vai (regra do DUPR)', () => {
    expect(duprMatchEligibility({ ...ok, games: [{ a: 11, b: 9 }, { a: 8, b: 8 }] }).problems).toContain(DUPR_MATCH_PROBLEM.TIED_GAME);
  });
  it('o vencedor tem de bater com os games', () => {
    expect(duprMatchEligibility({ ...ok, winner: 'b' }).problems).toContain(DUPR_MATCH_PROBLEM.WINNER_MISMATCH);
    expect(duprMatchEligibility({ ...ok, games: [{ a: 11, b: 5 }, { a: 7, b: 11 }, { a: 11, b: 9 }], winner: 'a' }).ok).toBe(true);
  });
});

describe('duprReadiness', () => {
  const links = {
    u1: { dupr_id: '1', entitlements: ['BASIC_L1'] },
    u2: { dupr_id: '2', entitlements: ['basic_l1', 'PREMIUM_L1'] },
    u3: { dupr_id: '3', entitlements: [] },
  };
  it('todos com conta e BASIC_L1: pronto', () => {
    expect(duprReadiness(['u1', 'u2'], links)).toEqual({ ok: true, missing: [], noEntitlement: [] });
  });
  it('separa quem não tem conta de quem não tem a assinatura', () => {
    expect(duprReadiness(['u1', 'u3', 'u9'], links)).toEqual({ ok: false, missing: ['u9'], noEntitlement: ['u3'] });
  });
  it('sem mapa de vínculos ninguém está pronto', () => {
    expect(duprReadiness(['u1'], null).ok).toBe(false);
  });
});

describe('duprIdentifier', () => {
  it('é determinístico e único por origem', () => {
    expect(duprIdentifier('tm', 'abc123')).toBe('pr:tm:abc123');
    expect(duprIdentifier('tm', 'abc123')).toBe(duprIdentifier('tm', 'abc123'));
    expect(duprIdentifier('gd', 'abc123')).not.toBe(duprIdentifier('tm', 'abc123'));
  });
  it('recusa origem ou id inválidos e limpa caracteres estranhos', () => {
    expect(duprIdentifier('xx', 'a')).toBeNull();
    expect(duprIdentifier('tm', '')).toBeNull();
    expect(duprIdentifier('gd', 'a/b c')).toBe('pr:gd:abc');
  });
});
