import { describe, expect, it } from 'vitest';
import { buildMemberCard, dataCurta, verifyPath } from './card.js';

const fed = { name: 'Federação Gaúcha de Pickleball', acronym: 'FGP', branding: { color: '#ffff00' }, official: true };

describe('buildMemberCard', () => {
  it('monta a carteirinha com faixa de situação e link de verificação', () => {
    const c = buildMemberCard({ member: { user_name: 'Ana', status: 'active', valid_until: '2027-03-12', card_code: 'ABCDEFGHJK', member_number: 'FGP-2026-000001', tier: 'federated' }, federation: fed, origin: 'https://x.app', hoje: '2026-10-18' });
    expect(c.band).toMatchObject({ tone: 'green' });
    expect(c.verifyUrl).toBe('https://x.app/f/verificar/ABCDEFGHJK');
    expect(c.hasCard).toBe(true);
    expect(c.validUntilLabel).toBe('12/03/2027');
    expect(c.federation.ink).toBeTruthy();
  });
  it('vencida e suspensa mudam a faixa; pendente não tem carteirinha', () => {
    expect(buildMemberCard({ member: { status: 'active', valid_until: '2026-01-01', card_code: 'ABCDEFGHJK' }, federation: fed, hoje: '2026-10-18' }).band.tone).toBe('amber');
    expect(buildMemberCard({ member: { status: 'suspended', card_code: 'ABCDEFGHJK' }, federation: fed }).band.tone).toBe('red');
    expect(buildMemberCard({ member: { status: 'pending' }, federation: fed }).hasCard).toBe(false);
  });
  it('utilitários', () => {
    expect(verifyPath('A B')).toBe('/f/verificar/A%20B');
    expect(dataCurta('')).toBe('—');
  });
});
