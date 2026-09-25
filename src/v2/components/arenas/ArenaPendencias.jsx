/**
 * "Precisa de você" — o topo da Central da arena.
 *
 * Cada pendência morava na sua aba: reserva para confirmar em Reservas,
 * pedido do app para entregar em Pedidos, falta para marcar em Presença,
 * mensalidade atrasada em Membros. Quem abre a Central não sabe por onde
 * começar, e o que não está na aba aberta espera até alguém lembrar.
 *
 * Aqui elas viram uma linha, e cada item leva à aba que resolve. A conta é
 * `arenaPendingItems` — as MESMAS regras das abas.
 *
 * Não é alarme (é trabalho do dia), por isso não é âmbar: o âmbar é da
 * prontidão, que é o que IMPEDE a arena de receber reserva. E não diz "tudo em
 * dia": consulta que falhou some da conta em vez de virar zero, então a faixa
 * só afirma o que viu.
 */
import React, { useMemo } from 'react';
import { ChevronRight } from 'lucide-react';
import { useArenaBookings } from '@/modules/arenas/hooks/useBookings';
import { useArenaModules } from '@/modules/arenas/hooks/useArenaModules';
import { useArenaSales, useArenaSubscriptions } from '@/modules/arenas/hooks/useArenaV3';
import { ARENA_MODULE_ID } from '@/modules/arenas/domain/modules';
import { arenaPendingItems } from '@/modules/arenas/domain/arenaPending';
import { todayISO } from '@/modules/arenas/domain/subscription';

export default function ArenaPendencias({ arena, onIrParaAba }) {
  const arenaId = arena?.id;
  const { isOn } = useArenaModules(arenaId);
  const loja = isOn(ARENA_MODULE_ID.PDV);
  const presenca = isOn(ARENA_MODULE_ID.IOT) && isOn(ARENA_MODULE_ID.IOT_QR_KIOSK);
  const mensalidade = isOn(ARENA_MODULE_ID.MEMBERS) && isOn(ARENA_MODULE_ID.MEMBERS_SUBSCRIPTION);
  // A mesma consulta das abas (mesma chave de cache): abrir a aba depois não
  // busca de novo.
  const reservasQ = useArenaBookings(arenaId);
  const vendasQ = useArenaSales(loja ? arenaId : null);
  const mensalidadesQ = useArenaSubscriptions(mensalidade ? arenaId : null);

  // `undefined` quando não carregou OU falhou: o item some, não vira zero.
  const bookings = reservasQ.isSuccess ? reservasQ.data : undefined;
  const sales = vendasQ.isSuccess ? vendasQ.data : undefined;
  const subscriptions = mensalidadesQ.isSuccess ? mensalidadesQ.data : undefined;
  const itens = useMemo(
    () => arenaPendingItems(
      { bookings, sales, subscriptions },
      { loja, presenca, mensalidade },
      { hoje: todayISO(), now: new Date() },
    ),
    [bookings, sales, subscriptions, loja, presenca, mensalidade],
  );

  if (itens.length === 0) return null;

  return (
    <section aria-label="Precisa de você" className="mt-5 rounded-3xl border border-gray-100 bg-paper-pure p-4 shadow-sm">
      <p className="text-[11px] font-bold uppercase tracking-widest text-gray-400">Precisa de você</p>
      <ul className="mt-2 flex flex-wrap gap-2">
        {itens.map((i) => (
          <li key={i.id}>
            <button
              type="button"
              onClick={() => onIrParaAba?.(i.aba)}
              className="inline-flex items-center gap-1.5 rounded-full border border-gray-200 bg-paper px-3 py-1.5 text-sm text-ink hover:border-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-ink"
            >
              <strong className="tabular-nums">{i.count}</strong> {i.label}
              <ChevronRight className="h-3.5 w-3.5 text-gray-400" aria-hidden="true" />
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
