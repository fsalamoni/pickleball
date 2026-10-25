/**
 * Paridade da AGENDA DO CLUBE: "quem marca o quê" no servidor (`podeTipo`) é a MESMA
 * conta do cliente (`canManageKind` com `sports` lido como `competitions`), para toda
 * combinação de permissões e todo tipo de evento. Os tipos, a validação e o ICS são os
 * da federação (já cobertos por `federationAgenda.parity.test.js`).
 */
import { describe, it, expect } from 'vitest';
import { createRequire } from 'node:module';
import { canManageKind, kindsFor, EVENT_KINDS } from '../src/modules/federations/domain/agenda.js';
import { clubAgendaPerms, canUseClubAgenda } from '../src/modules/clubs/domain/agenda.js';
import { ALL_CLUB_PERMS } from '../src/modules/clubs/domain/association.js';

const require = createRequire(import.meta.url);
const ca = require('./clubAgenda.js');
const A = require('./federationAgendaPolicy.js');

const subconjuntos = (lista) => lista.reduce((acc, x) => acc.concat(acc.map((s) => [...s, x])), [[]]);

describe('agenda do clube: o servidor e a tela concordam em quem marca o quê', () => {
  it('os tipos do cliente são os do servidor', () => {
    expect(EVENT_KINDS.map((k) => k.id).sort()).toEqual(Object.keys(A.KINDS).sort());
  });

  it('para toda combinação de permissões e todo tipo', () => {
    for (const perms of subconjuntos(ALL_CLUB_PERMS)) {
      for (const kind of Object.keys(A.KINDS)) {
        expect(canManageKind(clubAgendaPerms(perms), kind), `${perms.join('+') || '(nenhuma)'} × ${kind}`).toBe(ca.podeTipo(perms, kind));
      }
      expect(kindsFor(clubAgendaPerms(perms)).length > 0, perms.join('+')).toBe(canUseClubAgenda(perms));
    }
  });
});
