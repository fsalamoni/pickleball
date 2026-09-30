import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  REGION_PREF_ID, regionSnapshot, resetRegion, saveRegion, subscribeRegion,
} from './regionPreference.js';

beforeEach(() => { window.localStorage.clear(); });

describe('a escolha da região, no navegador', () => {
  it('sem escolha: `salvo` é null (vale o padrão)', () => {
    expect(regionSnapshot('u1').salvo).toBeNull();
  });

  it('guarda por usuário — num aparelho compartilhado, uma pessoa não herda a da outra', () => {
    saveRegion('u1', { modo: 'estado', origem: 'perfil' });
    expect(regionSnapshot('u1').salvo).toMatchObject({ modo: 'estado' });
    expect(regionSnapshot('u2').salvo).toBeNull();
    expect(window.localStorage.getItem(`v2:view:u1:${REGION_PREF_ID}`)).toContain('"v":1');
  });

  it('o retrato é o MESMO objeto enquanto nada muda (exigência do useSyncExternalStore)', () => {
    saveRegion('u1', { modo: 'todos' });
    expect(regionSnapshot('u1')).toBe(regionSnapshot('u1'));
  });

  it('restaurar apaga a escolha; escolha inválida também', () => {
    saveRegion('u1', { modo: 'raio', raioKm: 25 });
    resetRegion('u1');
    expect(regionSnapshot('u1').salvo).toBeNull();
    saveRegion('u1', { modo: 'marte' });
    expect(window.localStorage.getItem(`v2:view:u1:${REGION_PREF_ID}`)).toBeNull();
  });

  it('avisa quem assina, e para de avisar ao desassinar', () => {
    const fn = vi.fn();
    const sair = subscribeRegion(fn);
    saveRegion('u1', { modo: 'todos' });
    expect(fn).toHaveBeenCalledTimes(1);
    sair();
    saveRegion('u1', { modo: 'estado' });
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('nada vai para o banco: só localStorage', async () => {
    const fonte = (await import('node:fs')).readFileSync('src/core/lib/regionPreference.js', 'utf8');
    expect(fonte).not.toMatch(/firebase|firestore/i);
  });
});
