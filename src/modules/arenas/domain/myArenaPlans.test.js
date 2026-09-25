/**
 * "Planos e saldo nas arenas".
 *
 * O que protege:
 *  1. ⭐ uma linha por arena, juntando membro, carteira e mensalidade;
 *  2. ⭐ horas com a carteira como o BANCO devolve (Timestamp) — o defeito da
 *     Onda BQ zerava tudo;
 *  3. o vencimento mais próximo entre os pacotes que ainda valem;
 *  4. carteira zerada de quem não é mais membro não vira linha;
 *  5. quem tem hora e saldo vem primeiro.
 */
import { describe, it, expect } from 'vitest';
import { Timestamp } from 'firebase/firestore';
import { groupMyArenaPlans } from './myArenaPlans.js';

const AGORA = Date.UTC(2026, 8, 25, 12);
const DIA = 86_400_000;
const pacote = (over = {}) => ({
  pkg_id: 'dez', total_hours: 10, used_hours: 0, expires_at: Timestamp.fromMillis(AGORA + 30 * DIA), ...over,
});

describe('groupMyArenaPlans', () => {
  it('⭐ junta membro, carteira e mensalidade da mesma arena numa linha', () => {
    const r = groupMyArenaPlans({
      members: [{ arena_id: 'a1', user_id: 'u1', points: 120 }],
      wallets: [{ arena_id: 'a1', user_id: 'u1', balance: 15, packages: [pacote({ used_hours: 4 })] }],
      subscriptions: [{ arena_id: 'a1', user_id: 'u1', status: 'active' }],
    }, AGORA);
    expect(r).toHaveLength(1);
    expect(r[0]).toMatchObject({ arenaId: 'a1', hours: 6, balance: 15 });
    expect(r[0].member.points).toBe(120);
    expect(r[0].subscription.status).toBe('active');
  });

  it('⭐ o vencimento mais próximo é o dos pacotes que ainda valem', () => {
    const r = groupMyArenaPlans({
      wallets: [{
        arena_id: 'a1',
        packages: [
          pacote({ expires_at: Timestamp.fromMillis(AGORA - DIA) }), // vencido: não conta
          pacote({ expires_at: Timestamp.fromMillis(AGORA + 40 * DIA) }),
          pacote({ expires_at: Timestamp.fromMillis(AGORA + 5 * DIA), total_hours: 2 }),
        ],
      }],
    }, AGORA);
    expect(r[0].hours).toBe(12);
    expect(r[0].nextExpiry).toBe(AGORA + 5 * DIA);
  });

  it('pacote sem validade não inventa vencimento', () => {
    const r = groupMyArenaPlans({ wallets: [{ arena_id: 'a1', packages: [pacote({ expires_at: null })] }] }, AGORA);
    expect(r[0].nextExpiry).toBeNull();
  });

  it('carteira zerada de quem não é mais membro: nenhuma linha', () => {
    const r = groupMyArenaPlans({
      wallets: [{ arena_id: 'a1', balance: 0, packages: [pacote({ used_hours: 10 })] }],
      subscriptions: [{ arena_id: 'a2', status: 'cancelled' }],
    }, AGORA);
    expect(r).toEqual([]);
  });

  it('quem tem hora e saldo vem primeiro', () => {
    const r = groupMyArenaPlans({
      members: [{ arena_id: 'sem-nada' }],
      wallets: [
        { arena_id: 'so-saldo', balance: 30 },
        { arena_id: 'com-horas', packages: [pacote()] },
      ],
    }, AGORA);
    expect(r.map((l) => l.arenaId)).toEqual(['com-horas', 'so-saldo', 'sem-nada']);
  });

  it('sem nada: lista vazia (e não quebra com entradas estranhas)', () => {
    expect(groupMyArenaPlans()).toEqual([]);
    expect(groupMyArenaPlans({ members: [null, {}], wallets: [{ balance: 5 }] })).toEqual([]);
  });
});

describe('dayISO', () => {
  it('ms vira o dia local; sem instante, null', async () => {
    const { dayISO } = await import('./myArenaPlans.js');
    expect(dayISO(new Date(2026, 10, 12, 23, 30).getTime())).toBe('2026-11-12');
    expect(dayISO(null)).toBeNull();
  });
});
