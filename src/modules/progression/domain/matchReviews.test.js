import { describe, it, expect } from 'vitest';
import {
  reviewableTargets, reviewDocId, validateReview, pendingReviews, aggregateReviews,
  suspiciousPairs, REVIEW_TAGS,
} from './matchReviews.js';

describe('quem dá para avaliar', () => {
  it('os outros jogadores, sem mim, sem repetidos e sem convidado (uid vazio)', () => {
    expect(reviewableTargets({ partnerUids: ['b', 'me'], opponentUids: ['c', 'c', null, 'd'] }, 'me'))
      .toEqual([
        { uid: 'b', relation: 'partner' },
        { uid: 'c', relation: 'opponent' },
        { uid: 'd', relation: 'opponent' },
      ]);
  });

  it('o id é determinístico por jogo e por par', () => {
    expect(reviewDocId('gd_1/2', 'a', 'b')).toBe('gd_1-2__a__b');
  });
});

describe('validateReview', () => {
  const base = { fromUid: 'a', toUid: 'b', matchKey: 'm1' };

  it('recusa autoavaliação, nota fora da faixa e jogo ausente', () => {
    expect(validateReview({ ...base, toUid: 'a', rating: 5 }).ok).toBe(false);
    expect(validateReview({ ...base, rating: 0 }).ok).toBe(false);
    expect(validateReview({ ...base, rating: 6 }).ok).toBe(false);
    expect(validateReview({ fromUid: 'a', toUid: 'b', rating: 5 }).ok).toBe(false);
  });

  it('nota baixa exige motivo; nota alta guarda só elogios', () => {
    expect(validateReview({ ...base, rating: 1 }).ok).toBe(false);
    expect(validateReview({ ...base, rating: 2, issues: ['conduta'] }).ok).toBe(true);
    const alta = validateReview({ ...base, rating: 5, tags: ['pontual', 'inventada'], issues: ['conduta'] });
    expect(alta.value.tags).toEqual(['pontual']);
    expect(alta.value.issues).toEqual([]);
    const baixa = validateReview({ ...base, rating: 1, tags: ['pontual'], issues: ['conduta'] });
    expect(baixa.value.tags).toEqual([]); // não elogia quem acabou de ser mal avaliado
  });

  it('limita a quantidade de tags e não aceita texto livre', () => {
    const r = validateReview({ ...base, rating: 5, comment: 'x'.repeat(500), tags: Object.keys(REVIEW_TAGS) });
    expect(r.value.tags.length).toBeLessThanOrEqual(4);
    expect(r.value.comment).toBeUndefined();
  });
});

describe('pendingReviews', () => {
  const NOW = new Date('2026-10-02T15:00:00Z').getTime();
  const dia = 86_400_000;
  const rec = (matchKey, diasAtras, extra = {}) => ({ matchKey, at: NOW - diasAtras * dia, partnerUids: ['p'], opponentUids: ['o1', 'o2'], ...extra });

  it('só jogos recentes, e só quem ainda não foi avaliado', () => {
    const r = pendingReviews(
      [rec('a', 1), rec('b', 20), rec('c', 2)],
      [{ matchKey: 'c', toUid: 'p' }, { matchKey: 'c', toUid: 'o1' }],
      { now: NOW, uid: 'me', windowDays: 14 },
    );
    expect(r.map((x) => x.matchKey)).toEqual(['a', 'c']);
    expect(r[1].targets.map((t) => t.uid)).toEqual(['o2']);
  });

  it('jogo sem ninguém a avaliar (todos sem conta) some', () => {
    expect(pendingReviews([{ matchKey: 'x', at: NOW - dia, partnerUids: [], opponentUids: [] }], [], { now: NOW, uid: 'me' })).toEqual([]);
  });
});

describe('aggregateReviews', () => {
  const rv = (rating, tags = []) => ({ rating, tags });

  it('a nota só aparece com amostra mínima', () => {
    const poucas = aggregateReviews([rv(5), rv(5), rv(5)]);
    expect(poucas.average).toBeNull();
    expect(poucas.remainingForScore).toBe(2);
    const cinco = aggregateReviews([rv(5), rv(4), rv(5), rv(5), rv(4)]);
    expect(cinco.average).toBe(4.6);
    expect(cinco.publicScore).toBe(true);
    expect(cinco.fiveStarCount).toBe(3);
  });

  it('tag só vira reputação com votos suficientes', () => {
    const r = aggregateReviews([rv(5, ['pontual']), rv(5, ['pontual']), rv(5, ['pontual', 'justo']), rv(5, ['justo'])]);
    expect(r.topTags).toEqual([{ tag: 'pontual', count: 3 }]);
  });

  it('ignora lixo', () => {
    expect(aggregateReviews([{ rating: 9 }, null, { rating: 'x' }]).count).toBe(0);
  });
});

describe('suspiciousPairs', () => {
  it('marca a troca 1★ × 5★ no mesmo jogo (uma vez), e ignora o resto', () => {
    const rs = [
      { matchKey: 'm', fromUid: 'a', toUid: 'b', rating: 1 },
      { matchKey: 'm', fromUid: 'b', toUid: 'a', rating: 5 },
      { matchKey: 'm', fromUid: 'c', toUid: 'd', rating: 4 },
      { matchKey: 'm', fromUid: 'd', toUid: 'c', rating: 5 },
    ];
    const s = suspiciousPairs(rs);
    expect(s).toHaveLength(1);
    expect(s[0]).toMatchObject({ matchKey: 'm', kind: 'retaliation' });
  });
});
