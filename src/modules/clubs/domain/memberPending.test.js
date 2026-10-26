import { describe, it, expect } from 'vitest';
import { clubSummary, myClubPending } from './memberPending.js';

const HOJE = '2026-10-25';
const NOW = Date.UTC(2026, 9, 25, 15, 0, 0);
const op = { hoje: HOJE, nowMs: NOW };

const clube = (extra = {}) => ({ club_id: 'c1', club_name: 'Clube Um', aff: { status: 'active', valid_until: '2027-06-01' }, charges: [], sanctions: [], callup_invites: [], elections: [], ...extra });

describe('clubSummary', () => {
  it('conta só o que espera a pessoa', () => {
    const r = clubSummary(clube({
      charges: [{ status: 'open' }, { status: 'declared' }, { status: 'paid' }],
      callup_invites: [{ status: 'invited', expires_at_ms: NOW + 1000 }, { status: 'invited', expires_at_ms: NOW - 1000 }, { status: 'accepted', expires_at_ms: NOW + 1000 }],
      sanctions: [{ status: 'active' }, { status: 'active', appeal: { text: 'x' } }, { status: 'ended' }],
      elections: [{ status: 'voting', voted: false }, { status: 'voting', voted: true }, { status: 'closed', voted: false }],
    }), op);
    expect(r).toMatchObject({ pagar: 1, convocacoes: 1, sancoes: 1, eleicoes: 1, vencendo: false, vencida: false });
  });

  it('filiação vencendo em 30 dias e filiação vencida', () => {
    expect(clubSummary(clube({ aff: { status: 'active', valid_until: '2026-11-10' } }), op).vencendo).toBe(true);
    const v = clubSummary(clube({ aff: { status: 'active', valid_until: '2026-09-01' } }), op);
    expect(v.vencida).toBe(true);
    expect(v.vencendo).toBe(false);
  });

  it('sem filiação (só uma cobrança, por exemplo) não quebra', () => {
    const r = clubSummary(clube({ aff: null, charges: [{ status: 'open' }] }), op);
    expect(r).toMatchObject({ state: '', pagar: 1, vencendo: false, vencida: false });
  });
});

describe('myClubPending', () => {
  it('⭐ fonte que não carregou não vira zero', () => {
    expect(Object.values(myClubPending(undefined, op))).toEqual([undefined, undefined, undefined, undefined, undefined, undefined]);
  });

  it('soma os clubes; sem nada esperando, tudo zero', () => {
    expect(myClubPending([], op)).toEqual({ pagar: 0, vencendo: 0, vencida: 0, convocacoes: 0, sancoes: 0, eleicoes: 0 });
    const r = myClubPending([clube({ charges: [{ status: 'open' }] }), clube({ club_id: 'c2', charges: [{ status: 'open' }, { status: 'open' }], aff: { status: 'active', valid_until: '2026-09-01' } })], op);
    expect(r).toMatchObject({ pagar: 3, vencida: 1 });
  });
});
