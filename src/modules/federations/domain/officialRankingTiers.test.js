import { describe, it, expect } from 'vitest';
import {
  awardPoints, newTierId, normalizeRankingConfig, normalizeTier, pointsFor, tierById, tierLabel, tierOptions,
  tierShortLabel, tierTableFromChampion, validateTiers,
} from './officialRanking.js';

const FGP = {
  tiers: [
    { id: 'fgp1000', code: 'FGP 1000', group: 'G1', name: 'Estadual', points_by_place: tierTableFromChampion(1000, 16).points_by_place, participation: 10 },
    { id: 'fgp500', code: 'FGP 500', group: 'G2', points_by_place: { 1: 500, 2: 300, 3: 180, 4: 180 }, participation: 5 },
    { id: 'velha', code: 'FGP 250', group: 'G3', points_by_place: { 1: 250 }, active: false },
  ],
};

describe('categorias de torneio da federação', () => {
  it('sem categorias próprias, as três de antes saem derivadas da tabela × peso (nada muda para quem já usa)', () => {
    const cfg = normalizeRankingConfig({ tier_multipliers: { major: 2 } });
    expect(cfg.tiers_explicit).toBe(false);
    expect(cfg.tiers.map((tt) => tt.id)).toEqual(['regional', 'state', 'major']);
    expect(cfg.tiers.every((tt) => tt.legacy)).toBe(true);
    // o campeão do principal = 100 × 2, igual à conta antiga
    expect(tierById({ tier_multipliers: { major: 2 } }, 'major').points_by_place[1]).toBe(200);
    expect(pointsFor({ position: 1, played: 3 }, 'major', { tier_multipliers: { major: 2 } })).toBe(200);
  });

  it('normalizar duas vezes não transforma as derivadas em próprias', () => {
    const uma = normalizeRankingConfig({ best_n: 3 });
    const duas = normalizeRankingConfig(uma);
    expect(duas.tiers_explicit).toBe(false);
    expect(duas).toEqual(uma);
  });

  it('com categorias próprias, a tabela da categoria decide os pontos (sem multiplicador)', () => {
    expect(pointsFor({ position: 1, played: 4 }, 'fgp1000', FGP)).toBe(1000);
    expect(pointsFor({ position: 2, played: 4 }, 'fgp1000', FGP)).toBe(600);
    expect(pointsFor({ position: 5, played: 3 }, 'fgp1000', FGP)).toBe(180);
    expect(pointsFor({ position: 40, played: 1 }, 'fgp1000', FGP)).toBe(10); // fora da tabela: participação
    expect(pointsFor({ position: null, played: 0 }, 'fgp1000', FGP)).toBe(0);
    expect(pointsFor({ position: 3, played: 2 }, 'fgp500', FGP)).toBe(180);
  });

  it('o lançamento guarda sigla, grupo e nome da categoria (o histórico não muda se a federação renomear depois)', () => {
    const [a] = awardPoints({
      result: { status: 'sent', tier: 'fgp1000', date: '2026-08-10', rows: [{ uid: 'ana', name: 'Ana', position: 1, played: 4 }] },
      config: { ...FGP, members_only: false },
    });
    expect(a).toMatchObject({ points: 1000, base_points: 1000, multiplier: 1, tier_code: 'FGP 1000', tier_group: 'G1', tier_name: 'Estadual' });
  });

  it('categoria que não existe mais cai na conta antiga (o resultado já enviado não some)', () => {
    expect(pointsFor({ position: 1, played: 4 }, 'sumiu', FGP)).toBe(100);
  });

  it('normaliza a tabela: preenche buracos com a colocação anterior e corta o que não é válido', () => {
    const tt = normalizeTier({ id: 'x', code: '  FGP 100 ', points_by_place: { 1: 100, 2: '', 4: 30, 70: 1, 0: 5 }, participation: -1 });
    expect(tt.points_by_place).toEqual({ 1: 100, 2: 100, 3: 100, 4: 30 });
    expect(tt.places).toBe(4);
    expect(tt.code).toBe('FGP 100');
    expect(tt.participation).toBe(0);
    expect(tt.active).toBe(true);
    expect(normalizeTier({ id: 'Com Espaço' })).toBeNull();
  });

  it('a tabela pelo campeão segue o padrão dos circuitos', () => {
    const { points_by_place: p, places, participation } = tierTableFromChampion(1000, 32);
    expect([p[1], p[2], p[3], p[4], p[5], p[8], p[9], p[16], p[17], p[32]]).toEqual([1000, 600, 360, 360, 180, 180, 90, 90, 45, 45]);
    expect(places).toBe(32);
    expect(participation).toBe(10);
  });

  it('rótulos e opções', () => {
    const fgp = tierById(FGP, 'fgp1000');
    expect(tierShortLabel(fgp)).toBe('FGP 1000 · G1');
    expect(tierLabel(fgp)).toBe('FGP 1000 · G1 · Estadual');
    expect(tierShortLabel(tierById({}, 'state'))).toBe('Etapa estadual');
    expect(tierOptions(FGP).map((tt) => tt.id)).toEqual(['fgp1000', 'fgp500']);
    expect(tierOptions(FGP, 'velha').map((tt) => tt.id)).toEqual(['fgp1000', 'fgp500', 'velha']);
  });

  it('id novo pela sigla, sem repetir', () => {
    expect(newTierId('FGP 1000')).toBe('fgp_1000');
    expect(newTierId('FGP 1000', ['fgp_1000'])).toBe('fgp_1000_2');
    expect(newTierId('Ação!')).toBe('acao');
    expect(newTierId('')).toBe('categoria');
  });

  it('valida antes de gravar', () => {
    expect(validateTiers(FGP.tiers).ok).toBe(true);
    expect(validateTiers([]).ok).toBe(false);
    expect(validateTiers([{ ...FGP.tiers[0], active: false }]).geral).toMatch(/ativa/);
    const sobe = validateTiers([{ id: 'a', code: 'A', points_by_place: { 1: 100, 2: 120 } }]);
    expect(sobe.erros.a).toMatch(/subir/);
    expect(validateTiers([{ id: 'a', points_by_place: { 1: 100 } }]).erros.a).toMatch(/sigla ou um nome/);
    expect(validateTiers([{ id: 'a', code: 'A', points_by_place: { 1: 0 } }]).erros.a).toMatch(/campeão/);
    expect(validateTiers([{ id: 'a', code: 'A', points_by_place: { 1: 10 }, participation: 20 }]).erros.a).toMatch(/participação/);
    const dup = validateTiers([{ id: 'a', code: 'A', group: 'G1', points_by_place: { 1: 10 } }, { id: 'b', code: 'a', group: 'g1', points_by_place: { 1: 10 } }]);
    expect(dup.erros.b).toMatch(/sigla e grupo/);
  });
});
