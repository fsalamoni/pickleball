/**
 * PARIDADE cliente × servidor do tipo de filiação: o que a tela de planos
 * mostra (pessoa, clube, arena; o grupo do colégio) é o que o servidor confere
 * no pedido.
 */
import { describe, it, expect } from 'vitest';
import { createRequire } from 'node:module';
import { memberTypeCatalog, memberTypeOf } from '@/modules/federations/domain/memberTypes.js';

const require = createRequire(import.meta.url);
const s = require('./federationMemberTypes.js');

const CATALOGOS = [
  undefined,
  { member_types: [] },
  { member_types: [{ id: 'athlete', label: 'Jogador', active: true }, { id: 'referee', active: false }] },
  { member_types: [
    { id: 'dirigente', label: 'Dirigente', entity: 'person', category: 'none' },
    { id: 'escola', label: 'Escola de pickleball', entity: 'club', category: 'athlete' },
    { id: 'tecnico', label: 'Técnico', entity: 'person', category: 'coach', active: false },
    { id: 'Ruim!', label: 'x' },
    { id: 'club', entity: 'person', category: 'athlete' },
  ] },
];
const PLANOS = [
  {}, { person_type: 'athlete' }, { person_type: 'coach' }, { person_type: 'referee' }, { person_type: 'club' }, { person_type: 'arena' },
  { person_type: 'dirigente' }, { person_type: 'escola' }, { person_type: 'tecnico' },
  { person_type: 'sumiu', person_type_label: 'Antigo', entity: 'arena', person_category: 'coach' },
  { person_type: 'sumiu2', person_type_label: 'Outro', entity: 'person', person_category: 'referee' },
  { person_type: 'sumiu3' },
];

describe('tipo de filiação: cliente × servidor', () => {
  it('a mesma entidade, o mesmo grupo e o mesmo liga/desliga', () => {
    CATALOGOS.forEach((cfg) => {
      const cat = memberTypeCatalog(cfg);
      PLANOS.forEach((p) => {
        const c = memberTypeOf(cat, p);
        const v = s.resolveMemberType(cfg, p);
        expect({ id: v.id, entity: v.entity, category: v.category, active: v.active, label: v.label }, JSON.stringify([cfg, p]))
          .toEqual({ id: c.id, entity: c.entity, category: c.category, active: c.active, label: c.label });
      });
    });
  });
});
