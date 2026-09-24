/**
 * A estrutura de navegação da Central da arena.
 *
 * O que protege:
 *  1. ⭐ nenhuma aba tem o mesmo valor em duas seções — a seção ativa é
 *     achada pela aba, e um valor repetido tornaria a segunda inalcançável;
 *  2. ⭐ com os módulos desligados, a Central é exatamente a de antes;
 *  3. módulo ligado vira SEÇÃO, logo depois de Reservas.
 */
import { describe, it, expect } from 'vitest';
import { buildArenaSections } from './arenaManageSections.js';

const BASE = {
  coachResidentOn: true, linkedClubsOn: true, crmOn: true, opsKpisOn: true, arenaModulesOn: true,
};
const TUDO_LIGADO = { ...BASE, modulos: { membros: true, pacotes: true } };

const valores = (sections) => sections.flatMap((s) => s.tabs.map((t) => t.value));

describe('buildArenaSections', () => {
  it('⭐ nenhum valor de aba se repete, com tudo ligado', () => {
    const v = valores(buildArenaSections(TUDO_LIGADO));
    expect(new Set(v).size).toBe(v.length);
  });

  it('⭐ sem módulos, a Central é a de antes', () => {
    const ids = buildArenaSections(BASE).map((s) => s.id);
    expect(ids).toEqual(['perfil', 'estrutura', 'reservas', 'comercial', 'desempenho', 'equipe', 'configuracoes']);
    expect(valores(buildArenaSections(BASE))).not.toContain('membros');
  });

  it('Membros entra logo depois de Reservas', () => {
    const ids = buildArenaSections(TUDO_LIGADO).map((s) => s.id);
    expect(ids.indexOf('membros')).toBe(ids.indexOf('reservas') + 1);
  });

  it('Pacotes só com o módulo de pacotes', () => {
    const sem = buildArenaSections({ ...BASE, modulos: { membros: true, pacotes: false } });
    const membros = sem.find((s) => s.id === 'membros');
    expect(membros.tabs.map((t) => t.value)).toEqual(['membros']);
    const com = buildArenaSections(TUDO_LIGADO).find((s) => s.id === 'membros');
    expect(com.tabs.map((t) => t.value)).toEqual(['membros', 'planos']);
  });

  it('toda seção tem ao menos uma aba e rótulo', () => {
    buildArenaSections(TUDO_LIGADO).forEach((s) => {
      expect(s.label).toBeTruthy();
      expect(s.tabs.length).toBeGreaterThan(0);
      s.tabs.forEach((t) => expect(t.label).toBeTruthy());
    });
  });
});
