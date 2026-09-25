/**
 * "Planos e saldo nas arenas" — o que a pessoa TEM em cada arena (lógica pura).
 *
 * Quem compra 10 horas de pacote numa arena só descobria quanto restava
 * abrindo a página daquela arena. Aqui as três coleções (membro, carteira,
 * mensalidade) viram uma linha por arena, com o que importa para decidir onde
 * reservar: horas que restam (e quando a primeira vence), saldo, nível e se a
 * mensalidade está em dia.
 *
 * O que conta como "ter algo": ser membro, ter hora de pacote válida, ter
 * saldo, ou ter mensalidade que não foi cancelada. Carteira zerada de quem
 * saiu do programa não vira linha — seria lembrar a pessoa do que ela não tem.
 */
import { instanteEmMs } from '@/core/domain/instant';
import { usableHours } from './memberBenefit.js';
import { SUBSCRIPTION_STATUS } from './subscription.js';

/**
 * @param {{ members?: object[], wallets?: object[], subscriptions?: object[] }} fontes
 * @param {number} [now]
 * @returns {Array<{ arenaId: string, member: object|null, wallet: object|null,
 *   subscription: object|null, hours: number, balance: number, nextExpiry: number|null }>}
 */
export function groupMyArenaPlans({ members = [], wallets = [], subscriptions = [] } = {}, now = Date.now()) {
  const porArena = new Map();
  const linha = (arenaId) => {
    if (!porArena.has(arenaId)) {
      porArena.set(arenaId, { arenaId, member: null, wallet: null, subscription: null });
    }
    return porArena.get(arenaId);
  };
  (members || []).forEach((m) => { if (m?.arena_id) linha(m.arena_id).member = m; });
  (wallets || []).forEach((w) => { if (w?.arena_id) linha(w.arena_id).wallet = w; });
  (subscriptions || []).forEach((s) => { if (s?.arena_id) linha(s.arena_id).subscription = s; });

  return [...porArena.values()]
    .map((l) => {
      const pacotes = Array.isArray(l.wallet?.packages) ? l.wallet.packages : [];
      const validos = pacotes.filter((p) => usableHours(p, now) > 0);
      const vencimentos = validos
        .map((p) => instanteEmMs(p.expires_at))
        .filter((t) => Number.isFinite(t));
      return {
        ...l,
        hours: validos.reduce((a, p) => a + usableHours(p, now), 0),
        balance: Math.max(0, Number(l.wallet?.balance) || 0),
        nextExpiry: vencimentos.length ? Math.min(...vencimentos) : null,
      };
    })
    .filter((l) => (
      l.member
      || l.hours > 0
      || l.balance > 0
      || (l.subscription && l.subscription.status !== SUBSCRIPTION_STATUS.CANCELLED)
    ))
    // Quem tem hora e saldo primeiro: é onde a pessoa ganha ao reservar.
    .sort((a, b) => (b.hours - a.hours) || (b.balance - a.balance) || String(a.arenaId).localeCompare(String(b.arenaId)));
}

/** ms → 'YYYY-MM-DD' no dia LOCAL, para as funções de data da arena. */
export function dayISO(ms) {
  if (!Number.isFinite(ms)) return null;
  const d = new Date(ms);
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}
