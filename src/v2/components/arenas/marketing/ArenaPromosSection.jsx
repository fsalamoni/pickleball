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
 * Desde a Onda CD cada promoção é um TÍQUETE com a arte que a arena escolheu
 * (ou o Clássico), e o código no canhoto é o botão de copiar.
 *
 * O pedido de reserva oferece as mesmas promoções com um toque; aqui a
 * pessoa descobre que elas existem antes de escolher o horário.
 *
 * Some quando não há promoção divulgada que ainda valha. Não afirma nada
 * quando a leitura falha — a seção só aparece com promoção de verdade.
 */
import React, { useMemo } from 'react';
import { Tag } from 'lucide-react';
import { useArenaModules } from '@/modules/arenas/hooks/useArenaModules';
import { useArenaCoupons } from '@/modules/arenas/hooks/useArenaV3';
import { ARENA_MODULE_ID } from '@/modules/arenas/domain/modules';
import { promoConditions, publicPromos } from '@/modules/arenas/domain/marketing';
import { V2Surface } from '@/v2/ui/primitives';
import CouponArt from './coupons/CouponArt';

export default function ArenaPromosSection({ arena }) {
  const arenaId = arena?.id;
  const { isOn, isLoading } = useArenaModules(arenaId);
  const ligado = isOn(ARENA_MODULE_ID.MARKETING) && isOn(ARENA_MODULE_ID.MARKETING_COUPONS);
  const { data: cupons } = useArenaCoupons(ligado ? arenaId : null);
  const promos = useMemo(() => publicPromos(cupons || []), [cupons]);

  if (isLoading || !ligado || promos.length === 0) return null;

  const temVale = promos.some((p) => !p.bookable);
  const temDesconto = promos.some((p) => p.bookable);

  return (
    <V2Surface className="mt-6">
      <h3 className="flex items-center gap-1.5 font-display text-base font-bold text-ink">
        <Tag className="h-4 w-4" /> Promoções
      </h3>
      <p className="mt-1 text-xs text-gray-500">
        Toque no código para copiar.{' '}
        {temDesconto && 'Desconto na reserva: no pedido, toque na promoção para aplicar — ou cole o código.'}
        {temDesconto && temVale && ' '}
        {temVale && 'Vale: mostre o código na recepção da arena.'}
      </p>
      <ul className="mt-3 grid gap-3 lg:grid-cols-2">
        {promos.map((p) => (
          <li key={p.id} data-promo={p.code}>
            {/* O tíquete da promoção (Onda CD): a arte que a arena escolheu —
                ou o Clássico —, com o código copiável no canhoto. */}
            <CouponArt
              art={p.art}
              code={p.code}
              benefit={p.discount}
              description={p.description}
              kicker={p.bookable ? 'Desconto na reserva' : 'Vale na recepção'}
              copyable
              copyMessage={p.bookable ? 'Código copiado. Use no pedido de reserva.' : 'Código copiado. Mostre na recepção da arena.'}
              notch="bg-paper-pure"
            />
            {(promoConditions(p) || !p.bookable) && (
              <p className="mt-1.5 px-1 text-xs text-gray-500">
                {!p.bookable && <span className="mr-1.5 rounded-full bg-paper px-2 py-0.5 text-[11px] font-bold text-gray-600">vale na recepção</span>}
                {promoConditions(p)}
              </p>
            )}
          </li>
        ))}
      </ul>
    </V2Surface>
  );
}
