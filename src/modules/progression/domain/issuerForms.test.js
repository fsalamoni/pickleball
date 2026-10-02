import { describe, it, expect } from 'vitest';
import {
  emptyChallengeForm, formToChallengeInput, challengeToForm, formToRewardInput, rewardToForm, emptyRewardForm, msToDateKey,
} from './issuerForms.js';
import { validateChallenge } from './challenges.js';
import { validateReward } from './rewards.js';

const NOW = new Date('2026-10-15T15:00:00Z');

describe('formulário de desafio', () => {
  it('nasce válido: começa hoje e dura 7 dias', () => {
    const f = { ...emptyChallengeForm(NOW), title: 'Semana das Duplas' };
    const v = validateChallenge(formToChallengeInput(f), { type: 'arena', id: 'a1', uid: 'u' });
    expect(v.ok).toBe(true);
    expect((v.value.endsAt - v.value.startsAt) / 86_400_000).toBe(7);
  });

  it('o dia final VALE: "até 21/10" termina na meia-noite de 22/10', () => {
    const f = { ...emptyChallengeForm(NOW), startDate: '2026-10-15', endDate: '2026-10-21' };
    const i = formToChallengeInput(f);
    expect(new Date(i.endsAt).toISOString()).toBe('2026-10-22T03:00:00.000Z');
    expect(msToDateKey(i.endsAt - 1)).toBe('2026-10-21');
  });

  it('ida e volta: gravado → formulário → entrada dá o mesmo desafio', () => {
    const f = { ...emptyChallengeForm(NOW), title: 'Mês do Iniciante', startDate: '2026-11-01', endDate: '2026-11-30', regionState: 'PR', prizes: [{ label: 'Troféu', xp: 300 }] };
    const v1 = validateChallenge(formToChallengeInput(f), { type: 'platform', id: 'platform', uid: 'u' });
    const volta = challengeToForm(v1.value);
    expect(volta).toMatchObject({ startDate: '2026-11-01', endDate: '2026-11-30', regionState: 'PR', publish: true });
    const v2 = validateChallenge(formToChallengeInput(volta), { type: 'platform', id: 'platform', uid: 'u' });
    expect(v2.value.endsAt).toBe(v1.value.endsAt);
    expect(v2.value.prizes).toEqual(v1.value.prizes);
  });

  it('rascunho volta como rascunho', () => {
    const f = { ...emptyChallengeForm(NOW), title: 'Rascunho aqui', publish: false };
    expect(formToChallengeInput(f).status).toBe('draft');
    expect(challengeToForm({ status: 'draft', startsAt: 1, endsAt: 2 }).publish).toBe(false);
  });

  it('data em branco não vira desafio', () => {
    const f = { ...emptyChallengeForm(NOW), title: 'Sem datas', startDate: '', endDate: '' };
    expect(validateChallenge(formToChallengeInput(f), { type: 'arena', id: 'a', uid: 'u' }).ok).toBe(false);
  });
});

describe('formulário de recompensa', () => {
  it('nasce válido, sem critérios (aberta a todos)', () => {
    const r = validateReward(formToRewardInput({ ...emptyRewardForm(), title: 'Aula experimental' }), { type: 'coach', id: 'c', uid: 'c' });
    expect(r.ok).toBe(true);
    expect(r.value.eligibility).toEqual({});
    expect(r.value.quantity).toBeNull();
  });

  it('critérios em texto viram números; vazio é ignorado', () => {
    const f = { ...emptyRewardForm(), title: 'Hora grátis', minTier: 'Regular', minGames: '20', minStreakWeeks: '', topPercent: '10' };
    const r = validateReward(formToRewardInput(f), { type: 'arena', id: 'a', uid: 'u' });
    expect(r.value.eligibility).toEqual({ minTier: 'Regular', minGames: 20, topPercent: 10 });
  });

  it('a validade vale até o fim do dia e volta como o mesmo dia', () => {
    const f = { ...emptyRewardForm(), title: 'Brinde da casa', validUntil: '2026-12-31', quantity: '15' };
    const i = formToRewardInput(f);
    expect(new Date(i.validUntil).toISOString()).toBe('2027-01-01T03:00:00.000Z');
    const v = validateReward(i, { type: 'club', id: 'x', uid: 'u' });
    expect(rewardToForm(v.value).validUntil).toBe('2026-12-31');
    expect(rewardToForm(v.value).quantity).toBe('15');
  });

  it('pausada volta pausada; o contador de aprovados não é perdido na edição', () => {
    const atual = { approvedCount: 4 };
    const i = formToRewardInput({ ...emptyRewardForm(), title: 'Prioridade na fila', active: false }, atual);
    expect(i.status).toBe('paused');
    expect(i.approvedCount).toBe(4);
  });
});
