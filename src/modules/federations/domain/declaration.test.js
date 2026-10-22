import { describe, it, expect } from 'vitest';
import { buildMembershipDeclaration, declarationResults, DECLARATION_MAX_RESULTS } from './declaration.js';

const HOJE = '2026-10-21';
const fed = { id: 'f1', name: 'Federação Gaúcha', acronym: 'FGP', cnpj_masked: '12.345.678/0001-90', city: 'Porto Alegre', state: 'RS' };
const membro = { id: 'f1_u1', federation_id: 'f1', user_id: 'u1', user_name: 'Ana Souza', status: 'active', valid_from: '2026-01-10', valid_until: '2027-01-09', member_number: 'FGP-2026-000007', person_type: 'athlete', tier: 'federated', plan_name: 'Anual', card_code: 'ABCDEFGH23' };

describe('buildMembershipDeclaration', () => {
  it('filiação em dia: texto com nome, número, categoria e as duas datas; QR da verificação', () => {
    const d = buildMembershipDeclaration({ member: membro, federation: fed, origin: 'https://picklerush.web.app', hoje: HOJE });
    expect(d.canIssue).toBe(true);
    expect(d.body).toContain('Ana Souza');
    expect(d.body).toContain('FGP-2026-000007');
    expect(d.body).toContain('filiado');
    expect(d.body).toContain('10/01/2026');
    expect(d.body).toContain('09/01/2027');
    expect(d.verifyUrl).toBe('https://picklerush.web.app/f/verificar/ABCDEFGH23');
    expect(d.federation.cnpj).toBe('12.345.678/0001-90');
    expect(d.federation.city).toBe('Porto Alegre / RS');
  });

  it('sem início do período, diz só até quando vale', () => {
    const d = buildMembershipDeclaration({ member: { ...membro, valid_from: '' }, federation: fed, hoje: HOJE });
    expect(d.body).toContain('válido até 09/01/2027');
    expect(d.body).not.toContain(' de — a ');
  });

  it.each([
    ['vencida', { status: 'active', valid_until: '2026-10-01' }, 'em dia'],
    ['pendente', { status: 'pending' }, 'em dia'],
    ['cancelada', { status: 'cancelled' }, 'em dia'],
    ['suspensa', { status: 'suspended' }, 'suspensão'],
    ['suspensão disciplinar em vigor', { discipline_until_ms: Date.now() + 86_400_000 }, 'suspensão'],
    ['sem código', { card_code: '' }, 'código'],
  ])('não sai: %s', (_n, extra, trecho) => {
    const d = buildMembershipDeclaration({ member: { ...membro, ...extra }, federation: fed, hoje: HOJE });
    expect(d.canIssue).toBe(false);
    expect(d.block).toContain(trecho);
  });
});

describe('declarationResults', () => {
  const resultados = [
    { id: 'r1', federation_id: 'f1', status: 'sent', tournament_name: 'Aberto de POA', modality_name: 'Duplas A', date: '2026-05-10', rows: [{ uid: 'u1', position: 1 }, { uid: 'u2', position: 2 }] },
    { id: 'r2', federation_id: 'f1', status: 'sent', tournament_name: 'Copa Serra', modality_name: 'Mista', date: '2026-08-01', rows: [{ uid: 'u1', position: 3 }] },
    { id: 'r3', federation_id: 'f1', status: 'rejected', tournament_name: 'Recusado', date: '2026-09-01', rows: [{ uid: 'u1', position: 1 }] },
    { id: 'r4', federation_id: 'outra', status: 'sent', tournament_name: 'De outra federação', date: '2026-09-02', rows: [{ uid: 'u1', position: 1 }] },
  ];

  it('só desta federação, sem os recusados, do mais recente ao mais antigo', () => {
    const r = declarationResults(resultados, { federationId: 'f1', uid: 'u1' });
    expect(r.map((x) => x.id)).toEqual(['r2', 'r1']);
    expect(r[0]).toMatchObject({ tournament: 'Copa Serra', position: 3 });
  });

  it('dependente (sem conta) não tem resultados; teto na folha', () => {
    expect(buildMembershipDeclaration({ member: { ...membro, user_id: null }, federation: fed, results: resultados, hoje: HOJE }).results).toEqual([]);
    const muitos = Array.from({ length: 30 }, (_, i) => ({ id: `x${i}`, federation_id: 'f1', status: 'sent', date: `2026-01-${String(i + 1).padStart(2, '0')}`, rows: [{ uid: 'u1', position: 1 }] }));
    expect(declarationResults(muitos, { federationId: 'f1', uid: 'u1' })).toHaveLength(DECLARATION_MAX_RESULTS);
  });
});
