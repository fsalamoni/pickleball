import { describe, expect, it } from 'vitest';
import {
  isConfirmedForRanking,
  normalizePaymentStatus,
  participationPaymentStatusLabel,
  paymentStatusLabel,
} from './paymentStatus';

describe('paymentStatus domain helpers', () => {
  it('normalizes missing and unknown statuses as unpaid', () => {
    expect(normalizePaymentStatus()).toBe('unpaid');
    expect(normalizePaymentStatus(null)).toBe('unpaid');
    expect(normalizePaymentStatus('legacy')).toBe('unpaid');
  });

  it('labels pending legacy statuses without throwing', () => {
    expect(paymentStatusLabel()).toBe('Pendente');
    expect(participationPaymentStatusLabel(null)).toBe('Pagamento pendente');
  });

  it('keeps admins and confirmed members eligible for ranking', () => {
    expect(isConfirmedForRanking({ role: 'admin', payment_status: 'unpaid' })).toBe(true);
    expect(isConfirmedForRanking({ role: 'participant', payment_status: 'confirmed' })).toBe(true);
    expect(isConfirmedForRanking({ role: 'participant', payment_status: null })).toBe(false);
  });
});
