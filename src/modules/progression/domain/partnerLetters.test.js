import { describe, it, expect } from 'vitest';
import { letterTargets, letterDocId, validateLetter, letterForRecipient, LETTER_MAX } from './partnerLetters.js';

describe('partnerLetters', () => {
  it('só o parceiro de dupla (nunca adversário, nem eu, nem convidado sem conta)', () => {
    expect(letterTargets({ partnerUids: ['p', 'me', null, 'p'], opponentUids: ['o'] }, 'me')).toEqual(['p']);
  });

  it('valida: frase mínima, limite e sem link', () => {
    const base = { fromUid: 'a', toUid: 'b', matchKey: 'm' };
    expect(validateLetter({ ...base, text: '  ' }).ok).toBe(false);
    expect(validateLetter({ ...base, text: 'veja https://golpe.com' }).ok).toBe(false);
    expect(validateLetter({ ...base, toUid: 'a', text: 'oi pessoal' }).ok).toBe(false);
    const ok = validateLetter({ ...base, text: `Obrigado   pela parceria ${'x'.repeat(400)}` });
    expect(ok.ok).toBe(true);
    expect(ok.value.text.length).toBeLessThanOrEqual(LETTER_MAX);
    expect(ok.value.showName).toBe(false); // anônima por padrão
  });

  it('o id é por jogo e par', () => {
    expect(letterDocId('gd_1', 'a', 'b')).toBe('gd_1__a__b');
  });

  it('anonimato é real: a visão do destinatário não carrega o autor', () => {
    const v = letterForRecipient({ id: 'x', text: 'obrigado', fromUid: 'segredo', showName: false }, 'Ana');
    expect(JSON.stringify(v)).not.toContain('segredo');
    expect(v.from).toBe('Um parceiro de dupla');
    expect(letterForRecipient({ id: 'x', text: 't', showName: true }, 'Ana').from).toBe('Ana');
  });
});
