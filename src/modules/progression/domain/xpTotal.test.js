import { describe, it, expect } from 'vitest';
import { computeTotalXpV2, achievementBonusXp, missionXp } from './xpTotal.js';
import { computeXpV2 } from './progressionV2.js';
import { ACHIEVEMENTS_V2 } from '@/modules/achievements/domain/achievementsV2.js';
import { MISSION_BONUS_XP } from './missions.js';

const comBonus = ACHIEVEMENTS_V2.filter((a) => a.xpBonus > 0);
const A1 = comBonus[0];
const A2 = comBonus[1];

const STATS = {
  tournament_attended: 2, tournament_podium: 1, tournament_title: 0,
  game_played: 10, game_won: 6,
};

describe('achievementBonusXp', () => {
  it('soma o bônus das conquistas registradas', () => {
    expect(achievementBonusXp([A1.id, A2.id])).toBe(A1.xpBonus + A2.xpBonus);
  });

  it('conta cada conquista uma única vez', () => {
    expect(achievementBonusXp([A1.id, A1.id, A1.id])).toBe(A1.xpBonus);
  });

  it('aceita Set (é o formato que vem do hook)', () => {
    expect(achievementBonusXp(new Set([A1.id]))).toBe(A1.xpBonus);
  });

  it('ignora id desconhecido', () => {
    expect(achievementBonusXp(['nao_existe'])).toBe(0);
  });

  it('conquista sem bônus não soma nada', () => {
    const semBonus = ACHIEVEMENTS_V2.find((a) => !a.xpBonus);
    expect(achievementBonusXp([semBonus.id])).toBe(0);
  });

  it('lista vazia ou ausente vale 0', () => {
    expect(achievementBonusXp([])).toBe(0);
    expect(achievementBonusXp(null)).toBe(0);
  });
});

describe('missionXp', () => {
  const doc = (missions, over = {}) => ({ scope: 'daily', missions, bonusClaimed: false, ...over });

  it('soma só o XP das missões concluídas', () => {
    const d = doc([
      { target: 3, current: 3, xp: 30 },
      { target: 2, current: 1, xp: 60 }, // incompleta
    ]);
    expect(missionXp([d])).toBe(30);
  });

  it('inclui o bônus do dia quando todas foram feitas E resgatado', () => {
    const d = doc([{ target: 1, current: 1, xp: 30 }], { bonusClaimed: true });
    expect(missionXp([d])).toBe(30 + MISSION_BONUS_XP.daily);
  });

  it('não dá o bônus se ainda não foi resgatado', () => {
    const d = doc([{ target: 1, current: 1, xp: 30 }], { bonusClaimed: false });
    expect(missionXp([d])).toBe(30);
  });

  it('não dá o bônus se faltou missão, mesmo marcado como resgatado', () => {
    const d = doc([
      { target: 1, current: 1, xp: 30 },
      { target: 5, current: 2, xp: 60 },
    ], { bonusClaimed: true });
    expect(missionXp([d])).toBe(30);
  });

  it('soma vários dias', () => {
    const dias = [
      doc([{ target: 1, current: 1, xp: 30 }]),
      doc([{ target: 1, current: 1, xp: 50 }]),
    ];
    expect(missionXp(dias)).toBe(80);
  });

  it('documento vazio ou malformado não quebra nem soma', () => {
    expect(missionXp([null, {}, { missions: [] }, doc([])])).toBe(0);
    expect(missionXp(null)).toBe(0);
  });
});

describe('computeTotalXpV2', () => {
  it('soma as três parcelas', () => {
    const atividade = computeXpV2(STATS).xpTotal;
    const r = computeTotalXpV2({
      statsSources: STATS,
      unlockedAchievementIds: [A1.id],
      missionDocs: [{ scope: 'daily', missions: [{ target: 1, current: 1, xp: 30 }], bonusClaimed: false }],
    });
    expect(r.breakdown.activity).toBe(atividade);
    expect(r.breakdown.achievements).toBe(A1.xpBonus);
    expect(r.breakdown.missions).toBe(30);
    expect(r.xpTotal).toBe(atividade + A1.xpBonus + 30);
  });

  it('é idempotente: recalcular não infla nada', () => {
    const args = {
      statsSources: STATS,
      unlockedAchievementIds: [A1.id, A2.id],
      missionDocs: [{ scope: 'daily', missions: [{ target: 1, current: 1, xp: 30 }], bonusClaimed: true }],
    };
    const a = computeTotalXpV2(args).xpTotal;
    const b = computeTotalXpV2(args).xpTotal;
    const c = computeTotalXpV2(args).xpTotal;
    expect(a).toBe(b);
    expect(b).toBe(c);
  });

  it('sem conquistas nem missões, é exatamente o XP de atividade (compat V1)', () => {
    const r = computeTotalXpV2({ statsSources: STATS });
    expect(r.xpTotal).toBe(computeXpV2(STATS).xpTotal);
    expect(r.breakdown.achievements).toBe(0);
    expect(r.breakdown.missions).toBe(0);
  });

  it('atleta sem nada tem 0 e não quebra', () => {
    const r = computeTotalXpV2();
    expect(r.xpTotal).toBe(0);
    expect(r.breakdown).toEqual({ activity: 0, achievements: 0, missions: 0, onboarding: 0, grants: 0 });
  });

  it('o total nunca é negativo', () => {
    const r = computeTotalXpV2({ statsSources: { booking_no_show: 100 } });
    expect(r.xpTotal).toBeGreaterThanOrEqual(0);
  });

  it('conquista só vale XP depois de registrada', () => {
    const semRegistro = computeTotalXpV2({ statsSources: STATS }).xpTotal;
    const comRegistro = computeTotalXpV2({
      statsSources: STATS, unlockedAchievementIds: [A1.id],
    }).xpTotal;
    expect(comRegistro).toBe(semRegistro + A1.xpBonus);
  });
});


describe('computeTotalXpV2 — primeiros passos e concessões do servidor', () => {
  it('soma os passos gravados e as concessões válidas, cada um uma vez', () => {
    const r = computeTotalXpV2({
      statsSources: {},
      onboardingDone: { level: 1, photo: 2, inventado: 3 },
      grantDocs: [
        { id: 'u_season_2026-09', uid: 'u', kind: 'season', xp: 500 },
        { id: 'u_season_2026-09', uid: 'u', kind: 'season', xp: 500 },
      ],
      uid: 'u',
    });
    expect(r.breakdown.onboarding).toBe(80);
    expect(r.breakdown.grants).toBe(500);
    expect(r.xpTotal).toBe(580);
  });

  it('recalcular do zero dá o mesmo número (idempotente)', () => {
    const args = { onboardingDone: { club: 1 }, grantDocs: [{ id: 'a', uid: 'u', kind: 'duel', xp: 200 }], uid: 'u' };
    expect(computeTotalXpV2(args)).toEqual(computeTotalXpV2(args));
  });

  it('concessão de outro uid não entra', () => {
    const r = computeTotalXpV2({ grantDocs: [{ id: 'a', uid: 'outro', kind: 'duel', xp: 200 }], uid: 'u' });
    expect(r.breakdown.grants).toBe(0);
  });
});
