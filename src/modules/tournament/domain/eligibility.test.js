import { describe, it, expect } from 'vitest';
import {
  evaluatePlayerEligibility,
  evaluateMixedDoublesEligibility,
  evaluateRegistrationEligibility,
} from './eligibility.js';
import {
  AGE_CATEGORY,
  GENDER_CATEGORY,
  MODALITY_FORMAT,
  COMPETITION_GENDER,
  SKILL_LEVEL,
} from './constants.js';

function birthDateForAge(age) {
  const d = new Date();
  d.setFullYear(d.getFullYear() - age);
  // Garante que o aniversário já passou neste ano
  d.setMonth(0);
  d.setDate(1);
  return d.toISOString().slice(0, 10);
}

describe('eligibility', () => {
  describe('idade', () => {
    it('aceita Open para qualquer idade', () => {
      const m = { age_category: AGE_CATEGORY.OPEN, gender_category: GENDER_CATEGORY.OPEN };
      const r = evaluatePlayerEligibility(m, { birth_date: birthDateForAge(12) });
      expect(r.errors).toHaveLength(0);
    });

    it('Sub-19 aceita 18 anos e rejeita 19+', () => {
      const m = { age_category: AGE_CATEGORY.U19, gender_category: GENDER_CATEGORY.OPEN };
      expect(evaluatePlayerEligibility(m, { birth_date: birthDateForAge(18) }).errors).toHaveLength(0);
      expect(evaluatePlayerEligibility(m, { birth_date: birthDateForAge(19) }).errors.length).toBeGreaterThan(0);
    });

    it('35+ rejeita 34 e aceita 35', () => {
      const m = { age_category: AGE_CATEGORY.A35, gender_category: GENDER_CATEGORY.OPEN };
      expect(evaluatePlayerEligibility(m, { birth_date: birthDateForAge(34) }).errors.length).toBeGreaterThan(0);
      expect(evaluatePlayerEligibility(m, { birth_date: birthDateForAge(35) }).errors).toHaveLength(0);
    });

    it('60+ rejeita 50 e aceita 70', () => {
      const m = { age_category: AGE_CATEGORY.A60, gender_category: GENDER_CATEGORY.OPEN };
      expect(evaluatePlayerEligibility(m, { birth_date: birthDateForAge(50) }).errors.length).toBeGreaterThan(0);
      expect(evaluatePlayerEligibility(m, { birth_date: birthDateForAge(70) }).errors).toHaveLength(0);
    });

    it('pede data de nascimento quando categoria != Open', () => {
      const m = { age_category: AGE_CATEGORY.A50, gender_category: GENDER_CATEGORY.OPEN };
      const r = evaluatePlayerEligibility(m, {});
      expect(r.errors[0]).toMatch(/data de nascimento/i);
    });
  });

  describe('gênero (single)', () => {
    it('Masculino exige competition_gender = male', () => {
      const m = { age_category: AGE_CATEGORY.OPEN, gender_category: GENDER_CATEGORY.MALE };
      expect(evaluatePlayerEligibility(m, { competition_gender: COMPETITION_GENDER.MALE }).errors).toHaveLength(0);
      expect(evaluatePlayerEligibility(m, { competition_gender: COMPETITION_GENDER.FEMALE }).errors.length).toBeGreaterThan(0);
      expect(evaluatePlayerEligibility(m, {}).errors.length).toBeGreaterThan(0);
    });

    it('Feminino exige competition_gender = female', () => {
      const m = { age_category: AGE_CATEGORY.OPEN, gender_category: GENDER_CATEGORY.FEMALE };
      expect(evaluatePlayerEligibility(m, { competition_gender: COMPETITION_GENDER.FEMALE }).errors).toHaveLength(0);
      expect(evaluatePlayerEligibility(m, { competition_gender: COMPETITION_GENDER.MALE }).errors.length).toBeGreaterThan(0);
    });

    it('Aberto aceita qualquer gênero', () => {
      const m = { age_category: AGE_CATEGORY.OPEN, gender_category: GENDER_CATEGORY.OPEN };
      expect(evaluatePlayerEligibility(m, {}).errors).toHaveLength(0);
    });
  });

  describe('Duplas Mistas', () => {
    const modality = {
      format: MODALITY_FORMAT.DOUBLES,
      gender_category: GENDER_CATEGORY.MIXED,
      age_category: AGE_CATEGORY.OPEN,
    };

    it('exige um homem + uma mulher', () => {
      const ok = evaluateMixedDoublesEligibility(
        modality,
        { competition_gender: COMPETITION_GENDER.MALE },
        { competition_gender: COMPETITION_GENDER.FEMALE },
      );
      expect(ok.errors).toHaveLength(0);
    });

    it('rejeita dois homens', () => {
      const bad = evaluateMixedDoublesEligibility(
        modality,
        { competition_gender: COMPETITION_GENDER.MALE },
        { competition_gender: COMPETITION_GENDER.MALE },
      );
      expect(bad.errors.length).toBeGreaterThan(0);
    });

    it('avisa quando o parceiro ainda não tem perfil na plataforma', () => {
      const r = evaluateMixedDoublesEligibility(
        modality,
        { competition_gender: COMPETITION_GENDER.MALE },
        null,
      );
      expect(r.warnings.length).toBeGreaterThan(0);
    });
  });

  describe('aviso de nível', () => {
    it('alerta quando o nível do jogador é muito superior ao da modalidade', () => {
      const m = {
        format: MODALITY_FORMAT.SINGLES,
        age_category: AGE_CATEGORY.OPEN,
        gender_category: GENDER_CATEGORY.OPEN,
        skill_level: SKILL_LEVEL.BEGINNER,
      };
      const r = evaluatePlayerEligibility(m, { leveling_level: SKILL_LEVEL.PRO });
      expect(r.warnings.length).toBeGreaterThan(0);
      // Aviso, não erro
      expect(r.errors).toHaveLength(0);
    });
  });

  describe('evaluateRegistrationEligibility (orquestrador)', () => {
    it('combina erros do jogador A e do jogador B em duplas mistas', () => {
      const modality = {
        format: MODALITY_FORMAT.DOUBLES,
        gender_category: GENDER_CATEGORY.MIXED,
        age_category: AGE_CATEGORY.A50,
      };
      const r = evaluateRegistrationEligibility(
        modality,
        { competition_gender: COMPETITION_GENDER.MALE, birth_date: birthDateForAge(40) },
        { competition_gender: COMPETITION_GENDER.FEMALE, birth_date: birthDateForAge(55) },
      );
      // A tem 40, abaixo de 50 → erro
      expect(r.errors.some((e) => /Jogador A.*50/.test(e))).toBe(true);
      // B tem 55, OK
      // Mistas: combinação válida (M + F), nenhum erro adicional
    });
  });
});
