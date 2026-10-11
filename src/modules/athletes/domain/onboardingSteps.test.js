import { describe, it, expect } from 'vitest';
import { adiamentoVale, deveAbrir, passosPara, podeAdiar, soFaltaAdiavel, tituloDoRetorno } from './onboardingSteps.js';

const DIA = 24 * 60 * 60 * 1000;

describe('passosPara', () => {
  it('só os passos com algo faltando; nada faltando ⇒ todos', () => {
    expect(passosPara(['level'])).toEqual(['nivel']);
    expect(passosPara(['city', 'interests'])).toEqual(['pessoal', 'interesses']);
    expect(passosPara([])).toEqual(['pessoal', 'jogo', 'interesses', 'nivel']);
  });
});

describe('adiar', () => {
  it('⭐ só os interesses podem ficar para depois; o nível nunca', () => {
    expect(podeAdiar('interesses')).toBe(true);
    expect(podeAdiar('nivel')).toBe(false);
    expect(soFaltaAdiavel(['interests'])).toBe(true);
    expect(soFaltaAdiavel(['interests', 'level'])).toBe(false);
    expect(soFaltaAdiavel([])).toBe(false);
  });
  it('o adiamento vale 7 dias; data inválida não vale', () => {
    const agora = Date.parse('2026-10-11T12:00:00Z');
    expect(adiamentoVale(new Date(agora - 6 * DIA).toISOString(), agora)).toBe(true);
    expect(adiamentoVale(new Date(agora - 8 * DIA).toISOString(), agora)).toBe(false);
    expect(adiamentoVale(null, agora)).toBe(false);
    expect(adiamentoVale('ontem', agora)).toBe(false);
  });
  it('deveAbrir: adiado e só faltando interesses ⇒ não abre; qualquer essencial ⇒ abre', () => {
    const agora = Date.parse('2026-10-11T12:00:00Z');
    const ontem = new Date(agora - DIA).toISOString();
    expect(deveAbrir(['interests'], ontem, agora)).toBe(false);
    expect(deveAbrir(['interests'], null, agora)).toBe(true);
    expect(deveAbrir(['interests', 'level'], ontem, agora)).toBe(true);
    expect(deveAbrir([], ontem, agora)).toBe(false);
  });
});

describe('tituloDoRetorno', () => {
  it('diz logo o que falta quando é uma coisa só', () => {
    expect(tituloDoRetorno(['nivel'])).toBe('Falta só o seu nível');
    expect(tituloDoRetorno(['interesses'])).toMatch(/Falta só/);
    expect(tituloDoRetorno(['jogo', 'nivel'])).toBe('Faltam alguns dados no seu cadastro');
  });
});
