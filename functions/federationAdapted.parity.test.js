/**
 * PARIDADE cliente × servidor do pickleball adaptado: a tela mostra as mesmas
 * categorias, a mesma validação e a mesma conferência que o servidor grava.
 */
import { describe, it, expect } from 'vitest';
import { createRequire } from 'node:module';
import * as c from '@/modules/federations/domain/adapted.js';

const require = createRequire(import.meta.url);
const s = require('./federationAdaptedPolicy.js');

const FEDS = [{}, { adapted_classes: [{ label: 'Cadeira A' }, { id: 'B', label: 'Em pé' }, { label: 'x' }] }];
const CLASSIF = [
  null,
  { status: 'classified', class_id: 'wheelchair', valid_until: '2026-11-10' },
  { status: 'pending', class_id: 'wheelchair', valid_until: '2026-10-01', warned_for: '2026-10-01' },
  { status: 'revoked', class_id: 'standing' },
  { status: 'pending', request: { class_id: 'standing' } },
];
const HOJES = ['2026-10-23', '2026-11-11'];

describe('paridade: pickleball adaptado', () => {
  it('os mesmos enums e tetos', () => {
    expect(s.ADAPTED_LIMITS).toEqual(c.ADAPTED_LIMITS);
    expect(s.CLASS_STATUS).toEqual(c.CLASS_STATUS);
    expect(s.ADAPTED_CHECK).toEqual(c.ADAPTED_CHECK);
    expect(s.DEFAULT_ADAPTED_CLASSES).toEqual(c.DEFAULT_ADAPTED_CLASSES);
  });

  it('categorias, pedido e decisão', () => {
    FEDS.forEach((f) => {
      const classes = c.adaptedClassesOf(f);
      expect(s.adaptedClassesOf(f)).toEqual(classes);
      expect(s.validateAdaptedClasses(f.adapted_classes)).toEqual(c.validateAdaptedClasses(f.adapted_classes));
      [{ class_id: 'wheelchair', note: 'a' }, { class_id: 'b' }, {}].forEach((i) => expect(s.validateClassificationRequest(i, classes)).toEqual(c.validateClassificationRequest(i, classes)));
      [{ decision: 'classify', class_id: 'wheelchair', valid_until: '2027-01-01' }, { decision: 'decline', note: 'ok!' }, { decision: 'classify', valid_until: 'x' }]
        .forEach((i) => expect(s.validateClassificationDecision(i, classes, HOJES[0])).toEqual(c.validateClassificationDecision(i, classes, HOJES[0])));
    });
  });

  it('situação, conferência e aviso', () => {
    CLASSIF.forEach((cl) => HOJES.forEach((h) => {
      expect(s.classificationState(cl, h)).toEqual(c.classificationState(cl, h));
      expect(s.adaptedPlayerCheck('u', cl, 'wheelchair', h)).toBe(c.adaptedPlayerCheck('u', cl, 'wheelchair', h));
      if (cl) expect(s.classificationNotice(cl, h)).toBe(c.classificationNotice(cl, h));
    }));
    expect(s.ownFilePath('federacao/u/a.pdf', 'u')).toBe(c.ownFilePath('federacao/u/a.pdf', 'u'));
    expect(s.canManageAdapted(['admin'])).toBe(c.canManageAdapted(['admin']));
  });
});
