/**
 * "Promoções" — a seção da página da arena (módulo `marketing_coupons`).
 *
 * O cupom existia, e a pessoa só o usava se alguém lhe entregasse o código:
 * a promoção da quinta à tarde não chegava a quem abria a página da arena
 * procurando horário. Agora a arena escolhe, cupom a cupom, o que DIVULGAR
 * ("Divulgar na página da arena") — e só esses aparecem aqui, com a regra em
 * uma linha e o código para copiar. Os outros continuam sendo códigos que ela
 * entrega a quem quiser.
 *
 * O pedido de reserva oferece as mesmas promoções com um toque; aqui a
 * pessoa descobre que elas existem antes de escolher o horário.
 *
 * Some quando não há promoção divulgada que ainda valha. Não afirma nada
 * quando a leitura falha — a seção só aparece com promoção de verdade.
 */
import React, { useMemo } from 'react';
import { toast } from 'sonner';
import { Copy, Tag } from 'lucide-react';
import { useArenaModules } from '@/modules/arenas/hooks/useArenaModules';
import { useArenaCoupons } from '@/modules/arenas/hooks/useArenaV3';
import { ARENA_MODULE_ID } from '@/modules/arenas/domain/modules';
import { promoConditions, publicPromos } from '@/modules/arenas/domain/marketing';
import { V2Button, V2Surface } from '@/v2/ui/primitives';

export default function ArenaPromosSection({ arena }) {
  const arenaId = arena?.id;
  const { isOn, isLoading } = useArenaModules(arenaId);
  const ligado = isOn(ARENA_MODULE_ID.MARKETING) && isOn(ARENA_MODULE_ID.MARKETING_COUPONS);
  const { data: cupons } = useArenaCoupons(ligado ? arenaId : null);
  const promos = useMemo(() => publicPromos(cupons || []), [cupons]);

  if (isLoading || !ligado || promos.length === 0) return null;

  const copiar = async (p) => {
    try {
      await navigator.clipboard.writeText(p.code);
      toast.success(p.bookable ? 'Código copiado. Use no pedido de reserva.' : 'Código copiado. Mostre na recepção da arena.');
    } catch {
      toast.error(`Não foi possível copiar. O código é: ${p.code}`);
    }
  };
  const temVale = promos.some((p) => !p.bookable);
  const temDesconto = promos.some((p) => p.bookable);

  return (
    <V2Surface className="mt-6">
      <h3 className="flex items-center gap-1.5 font-display text-base font-bold text-ink">
        <Tag className="h-4 w-4" /> Promoções
      </h3>
      <p className="mt-1 text-xs text-gray-500">
        {temDesconto && 'Desconto na reserva: no pedido, toque na promoção para aplicar — ou digite o código.'}
        {temDesconto && temVale && ' '}
        {temVale && 'Vale: mostre o código na recepção da arena.'}
      </p>
      <ul className="mt-3 space-y-2">
        {promos.map((p) => (
          <li key={p.id} className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-dashed border-gray-300 bg-paper p-3">
            <div className="min-w-0">
              <p className="font-bold text-ink">
                {p.discount}
                {!p.bookable && <span className="ml-1.5 rounded-full bg-paper-pure px-2 py-0.5 text-[11px] font-bold text-gray-600">vale na recepção</span>}
              </p>
              {p.description && <p className="mt-0.5 text-sm text-gray-600">{p.description}</p>}
              {promoConditions(p) && <p className="mt-0.5 text-xs text-gray-500">{promoConditions(p)}</p>}
            </div>
            <V2Button size="sm" variant="ghost" onClick={() => copiar(p)} aria-label={`Copiar o código ${p.code}`}>
              <Copy className="mr-1 h-3.5 w-3.5" /> {p.code}
            </V2Button>
          </li>
        ))}
      </ul>
    </V2Surface>
  );
}
