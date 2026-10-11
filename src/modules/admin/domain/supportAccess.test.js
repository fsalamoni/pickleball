import { describe, it, expect } from 'vitest';
import { createRequire } from 'node:module';
import { SENSITIVE_FIELDS, REVEAL_REASON_META, REVEAL_TEXT_MIN, maskValue, validateRevealRequest } from './supportAccess.js';

const require = createRequire(import.meta.url);
const servidor = require('../../../../functions/supportAccess.js');

describe('paridade com o servidor', () => {
  it('⭐ campos, categorias e mínimo do motivo são os mesmos dos dois lados', () => {
    expect([...SENSITIVE_FIELDS]).toEqual([...servidor.SENSITIVE_FIELDS]);
    expect(Object.keys(REVEAL_REASON_META).sort()).toEqual([...servidor.REASON_CATEGORIES].sort());
    expect(REVEAL_TEXT_MIN).toBe(servidor.REASON_TEXT_MIN);
  });
});

describe('maskValue', () => {
  it('deixa só o que identifica sem expor', () => {
    expect(maskValue('email', 'ana.silva@gmail.com')).toBe('a********@gmail.com');
    expect(maskValue('phone', '51999887766')).toBe('••••••7766');
    expect(maskValue('birth_date', '1985-03-12')).toBe('••/••/1985');
    expect(maskValue('address', 'Rua X, 10')).toBe('•••••, 10');
    expect(maskValue('email', '')).toBe('');
  });
});

describe('validateRevealRequest', () => {
  it('exige campos da lista, categoria e texto', () => {
    expect(validateRevealRequest({ fields: ['role'], reason_category: 'outro', reason_text: 'x'.repeat(20) }).errors.fields).toBeTruthy();
    expect(validateRevealRequest({ fields: ['email'], reason_category: 'outro', reason_text: 'x'.repeat(20) }).isValid).toBe(true);
  });
});
