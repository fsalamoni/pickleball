/**
 * PARIDADE cliente × servidor dos equipamentos homologados (rodada 3, Bloco
 * 1): a tela valida o mesmo que o servidor grava (`federationIntegrityPolicy.js`
 * é cópia da parte de `domain/integrity.js` que o servidor confere).
 */
import { describe, it, expect } from 'vitest';
import { createRequire } from 'node:module';
import * as c from '@/modules/federations/domain/integrity.js';

const require = createRequire(import.meta.url);
const s = require('./federationIntegrityPolicy.js');
const HOJE = '2026-10-23';

describe('paridade: equipamentos homologados', () => {
  it('os mesmos tipos, situações e tetos', () => {
    ['EQUIPMENT_KINDS', 'EQUIPMENT_STATUS'].forEach((k) => expect(s[k], k).toEqual(c[k]));
    ['EQUIPMENT_NOTES_MAX', 'EQUIPMENT_HISTORY_MAX'].forEach((k) => expect(s[k], k).toBe(c[k]));
    expect(Object.keys(c.EQUIPMENT_KIND_LABELS)).toEqual(s.EQUIPMENT_KINDS);
    expect(Object.keys(c.EQUIPMENT_STATUS_LABELS)).toEqual(Object.values(s.EQUIPMENT_STATUS));
  });

  it('o mesmo cadastro e a mesma mudança de situação', () => {
    [{}, { brand: ' Selkirk ', model: 'X', kind: 'ball', notes: 'y'.repeat(900) }, { brand: 'a', kind: 'nada' }]
      .forEach((x) => expect(s.validateEquipment(x)).toEqual(c.validateEquipment(x)));
    const item = { status: 'approved', status_at: '2026-05-01' };
    [[null, {}], [null, { status: 'rejected' }], [item, { status: 'approved' }], [item, { status: 'decertified', reason: 'Falhou no reteste.', date: '2026-04-01' }],
      [item, { status: 'decertified', reason: 'ok', date: '2027-01-01' }], [{ status: 'decertified' }, { status: 'approved' }], [item, { status: 'x' }]]
      .forEach(([i, x]) => expect(s.validateStatusChange(i, x, HOJE)).toEqual(c.validateStatusChange(i, x, HOJE)));
    [['competitions'], ['admin'], ['finance'], null].forEach((p) => expect(s.canManageEquipment(p)).toBe(c.canManageEquipment(p)));
  });
});
