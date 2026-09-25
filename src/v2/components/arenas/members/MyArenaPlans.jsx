/**
 * "Planos e saldo nas arenas" — em Minhas reservas.
 *
 * Quem comprou 10 horas de pacote numa arena só sabia quanto restava abrindo
 * a página DAQUELA arena. Aqui fica, de todas as arenas, o que a pessoa tem em
 * cada uma: horas que restam (e quando a primeira vence), saldo, nível e se a
 * mensalidade está em dia. É olhando isso que se decide ONDE reservar.
 *
 * Cada linha obedece aos módulos DAQUELA arena: com o programa de membros
 * desligado ela some (as horas não seriam abatidas lá, e mostrá-las seria
 * prometer o que a reserva não entrega); sem carteira, não se fala em saldo.
 *
 * Some quando não há nada. Falha de leitura NÃO some: vira aviso — senão quem
 * tem horas pagas concluiria que elas sumiram.
 */
import React from 'react';
import { Link } from 'react-router-dom';
import { ChevronRight, Crown } from 'lucide-react';
import { useArena } from '@/modules/arenas/hooks/useArenas';
import { useArenaModules } from '@/modules/arenas/hooks/useArenaModules';
import { useMyArenaPlans } from '@/modules/arenas/hooks/useArenaV3';
import { useArenaPrefetch } from '@/modules/arenas/hooks/useArenaPrefetch';
import { ARENA_MODULE_ID } from '@/modules/arenas/domain/modules';
import { tierProgress } from '@/modules/arenas/domain/memberBenefit';
import { dayISO } from '@/modules/arenas/domain/myArenaPlans';
import { SUBSCRIPTION_STATUS, subscriptionState } from '@/modules/arenas/domain/subscription';
import { formatDateShortBR } from '@/modules/arenas/domain/calendar';
import { formatPrice } from '@/modules/arenas/domain/pricing';
import { V2Badge, V2ErrorState, V2Surface } from '@/v2/ui/primitives';

const TIER_TONE = { bronze: 'amber', silver: 'neutral', gold: 'acid', platinum: 'ink' };

function PlanoNaArena({ plano }) {
  const { data: arena } = useArena(plano.arenaId);
  const { isOn } = useArenaModules(plano.arenaId);
  const prefetch = useArenaPrefetch();
  if (!isOn(ARENA_MODULE_ID.MEMBERS)) return null;
  if (arena?.archived) return null;

  const temPacotes = isOn(ARENA_MODULE_ID.MEMBERS_PACKAGES);
  const temCarteira = isOn(ARENA_MODULE_ID.MEMBERS_WALLET);
  const temNiveis = isOn(ARENA_MODULE_ID.MEMBERS_TIERS);
  const temMensalidade = isOn(ARENA_MODULE_ID.MEMBERS_SUBSCRIPTION);

  const nivel = plano.member && temNiveis ? tierProgress(plano.member).current : null;
  const mensal = temMensalidade && plano.subscription ? subscriptionState(plano.subscription) : null;
  const horas = temPacotes ? plano.hours : 0;
  const saldo = temCarteira ? plano.balance : 0;
  const vence = horas > 0 && plano.nextExpiry ? formatDateShortBR(dayISO(plano.nextExpiry)) : '';

  // Nada que valha nesta arena, com os módulos que ela tem ligados.
  if (!plano.member && horas === 0 && saldo === 0 && !mensal) return null;

  const aquecer = () => prefetch(plano.arenaId, arena);
  return (
    <li>
      <Link
        to={`/arenas/${plano.arenaId}/membros`}
        onMouseEnter={aquecer}
        onFocus={aquecer}
        onTouchStart={aquecer}
        className="flex items-center justify-between gap-3 rounded-2xl border border-gray-100 bg-paper px-4 py-3 hover:border-gray-300"
      >
        <span className="min-w-0">
          <span className="flex flex-wrap items-center gap-2">
            <span className="truncate text-sm font-bold text-ink">{arena?.name || 'Arena'}</span>
            {nivel && <V2Badge tone={TIER_TONE[nivel.id] || 'amber'}>{nivel.name}</V2Badge>}
            {mensal?.status === SUBSCRIPTION_STATUS.OVERDUE && <V2Badge tone="red">Mensalidade em atraso</V2Badge>}
          </span>
          <span className="mt-0.5 block text-xs text-gray-600">
            {[
              horas > 0 ? `${horas}h de pacote${vence ? ` · a primeira vence ${vence}` : ''}` : null,
              saldo > 0 ? `${formatPrice(saldo)} de saldo` : null,
              mensal?.status === SUBSCRIPTION_STATUS.ACTIVE ? 'Mensalidade em dia' : null,
            ].filter(Boolean).join(' · ') || 'Você é membro'}
          </span>
        </span>
        <ChevronRight className="h-4 w-4 shrink-0 text-gray-400" aria-hidden="true" />
      </Link>
    </li>
  );
}

export default function MyArenaPlans() {
  const { data: planos, isError, refetch } = useMyArenaPlans();

  if (isError) {
    return (
      <V2ErrorState
        inline
        className="mb-6"
        title="Não foi possível carregar os seus planos nas arenas"
        description="As suas horas e o seu saldo continuam lá — tente de novo."
        onRetry={() => refetch()}
      />
    );
  }
  if (!planos || planos.length === 0) return null;

  return (
    <V2Surface className="mb-6">
      <h2 className="flex items-center gap-2 font-display text-base font-bold text-ink">
        <Crown className="h-4 w-4" /> Planos e saldo nas arenas
      </h2>
      <p className="mt-1 text-xs text-gray-500">
        As horas de pacote e o saldo são abatidos sozinhos quando a arena confirma a reserva.
      </p>
      <ul className="mt-3 space-y-2">
        {planos.map((p) => <PlanoNaArena key={p.arenaId} plano={p} />)}
      </ul>
    </V2Surface>
  );
}
