/**
 * As REGRAS do "indique e ganhe" — o cupom do tipo indicação, na aba
 * Indicações.
 *
 * Mora aqui (e não só em Cupons) porque a indicação é um módulo que liga
 * separado: uma arena com indicações e sem cupons ainda precisa de onde dizer
 * quanto cada lado ganha. O formulário é o MESMO de Cupons (`CouponForm`, tipo
 * indicação) — duas telas editando o mesmo documento com formulários
 * diferentes divergiriam.
 */
import React, { useState } from 'react';
import { Handshake, Pencil, Plus } from 'lucide-react';
import { COUPON_KIND, couponKind, referralRulesText } from '@/modules/arenas/domain/marketing';
import { formatPrice } from '@/modules/arenas/domain/pricing';
import { V2Button, V2ErrorState, V2Skeleton } from '@/v2/ui/primitives';
import CouponForm from './CouponForm';

/**
 * @param {{ arenaId: string, coupons: object[]|undefined, program: object|null,
 *   isLoading: boolean, isError: boolean, onRetry: () => void }} props
 */
export default function ReferralRulesCard({ arenaId, coupons, program, isLoading, isError, onRetry }) {
  const [editando, setEditando] = useState(null); // null | 'novo' | cupom

  if (isLoading) return <V2Skeleton className="h-24 rounded-2xl" />;
  if (isError) {
    return (
      <V2ErrorState
        inline
        title="Não foi possível carregar as regras do programa"
        description="Sem elas, os campos abaixo não vêm preenchidos."
        onRetry={onRetry}
      />
    );
  }

  if (editando) {
    return (
      <CouponForm
        arenaId={arenaId}
        cupom={editando === 'novo' ? null : editando}
        initialKind={COUPON_KIND.REFERRAL}
        referralOn
        onClose={() => setEditando(null)}
      />
    );
  }

  // Um programa desligado (ou vencido) é mostrado para religar, não esquecido.
  const desligado = !program
    ? (coupons || []).find((c) => couponKind(c) === COUPON_KIND.REFERRAL) || null
    : null;

  if (!program) {
    return (
      <div className="rounded-2xl border border-dashed border-gray-300 bg-paper p-4">
        <p className="flex items-center gap-2 font-display text-base font-bold text-ink">
          <Handshake className="h-4 w-4" /> {desligado ? 'O programa está desligado' : 'Defina as regras do programa'}
        </p>
        <p className="mt-1 text-sm text-gray-600">
          {desligado
            ? 'Os atletas continuam vendo o próprio código, mas sem regras valendo a indicação não credita ninguém sozinha.'
            : 'Quanto ganha quem indica, quanto ganha quem chega, se vale só para quem nunca reservou aqui e o limite por pessoa.'}
        </p>
        <V2Button size="sm" className="mt-3" onClick={() => setEditando(desligado || 'novo')}>
          {desligado ? <Pencil className="mr-1.5 h-4 w-4" /> : <Plus className="mr-1.5 h-4 w-4" />}
          {desligado ? 'Revisar e religar' : 'Definir as regras'}
        </V2Button>
      </div>
    );
  }

  const condicoes = [
    program.first_booking_only !== false ? 'Só para quem nunca reservou aqui' : 'Vale para qualquer pessoa indicada',
    program.max_per_referrer ? `até ${program.max_per_referrer} por pessoa` : 'sem limite por pessoa',
    program.min_amount ? `1ª reserva a partir de ${formatPrice(program.min_amount)}` : null,
  ].filter(Boolean);

  return (
    <div className="rounded-2xl border border-gray-100 bg-paper p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-xs font-bold uppercase tracking-widest text-gray-500">Regras valendo</p>
          <p className="mt-1 font-display text-base font-bold text-ink">{referralRulesText(program)}</p>
          <p className="mt-0.5 text-xs text-gray-500">{condicoes.join(' · ')}</p>
          {program.description && <p className="mt-1 text-sm text-gray-600">{program.description}</p>}
        </div>
        <V2Button size="sm" variant="ghost" onClick={() => setEditando(program)}>
          <Pencil className="mr-1 h-3.5 w-3.5" /> Editar regras
        </V2Button>
      </div>
    </div>
  );
}
