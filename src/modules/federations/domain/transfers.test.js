import { describe, it, expect } from 'vitest';
import { canRequestTransfer, isReleaseOverdue, sortTransfers, transferCooldownDays, transferDeadline, transferReleaseDays, validateTransferInput } from './transfers.js';

const member = { federation_id: 'f1', status: 'active', represented_club_id: 'c1' };

describe('carência e prazo', () => {
  it('padrões e configuração da federação', () => {
    expect(transferCooldownDays(null)).toBe(90);
    expect(transferCooldownDays({ rules: { transfer_cooldown_days: 0 } })).toBe(0);
    expect(transferReleaseDays({ rules: { transfer_release_days: 30 } })).toBe(30);
    expect(transferReleaseDays({ rules: { transfer_release_days: 0 } })).toBe(15);
    expect(transferDeadline('2026-03-01', null)).toBe('2026-03-16');
  });
  it('pode pedir só com filiação viva, sem pendente e fora da carência', () => {
    expect(canRequestTransfer(null).ok).toBe(false);
    expect(canRequestTransfer({ status: 'cancelled' }).ok).toBe(false);
    expect(canRequestTransfer(member, { pending: [{ status: 'pending' }] }).ok).toBe(false);
    expect(canRequestTransfer({ ...member, last_transfer_at: '2026-05-01' }, { hoje: '2026-06-01' }).ok).toBe(false);
    expect(canRequestTransfer({ ...member, last_transfer_at: '2026-05-01' }, { hoje: '2026-06-01', federation: { rules: { transfer_cooldown_days: 10 } } }).ok).toBe(true);
    expect(canRequestTransfer(member, { hoje: '2026-06-01' }).ok).toBe(true);
  });
  it('silêncio além do prazo libera (só troca de federação)', () => {
    expect(isReleaseOverdue({ kind: 'federation', status: 'pending', deadline: '2026-01-10' }, '2026-01-11')).toBe(true);
    expect(isReleaseOverdue({ kind: 'federation', status: 'pending', deadline: '2026-01-10' }, '2026-01-10')).toBe(false);
    expect(isReleaseOverdue({ kind: 'club', status: 'pending', deadline: '2026-01-10' }, '2026-02-10')).toBe(false);
  });
});

describe('validação e ordem', () => {
  it('clube igual ao atual e federação igual à atual reprovam', () => {
    expect(validateTransferInput({ kind: 'club', to_club_id: 'c1' }, { member }).errors.to_club_id).toBeTruthy();
    expect(validateTransferInput({ kind: 'club', to_club_id: 'c2' }, { member }).ok).toBe(true);
    expect(validateTransferInput({ kind: 'federation', to_federation_id: 'f1' }, { member }).errors.to_federation_id).toBeTruthy();
    expect(validateTransferInput({ kind: 'federation', to_federation_id: 'f2', reason: 'mudei' }, { member }).value.reason).toBe('mudei');
    expect(validateTransferInput({ kind: 'x' }).errors.kind).toBeTruthy();
  });
  it('pendentes primeiro, depois as mais recentes', () => {
    const r = sortTransfers([{ status: 'approved', requested_at_ms: 5 }, { status: 'pending', requested_at_ms: 1 }, { status: 'approved', requested_at_ms: 9 }]);
    expect(r.map((x) => `${x.status}${x.requested_at_ms}`)).toEqual(['pending1', 'approved9', 'approved5']);
  });
});
