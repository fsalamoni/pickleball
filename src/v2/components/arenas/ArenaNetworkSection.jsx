/**
 * "Outras unidades da rede" — a seção da página da arena (módulo `multi_unit`
 * + `multi_unit_network`).
 *
 * A rede existia só do lado da gestão: a arena montava o grupo e o atleta
 * nunca sabia que a unidade onde joga tem irmãs. Aqui ele vê as outras
 * unidades, com o caminho para cada uma — a informação que faz alguém jogar
 * na unidade perto do trabalho quando a de casa está lotada.
 *
 * O que NÃO diz: que o plano vale nas outras unidades. O benefício cruzado é
 * outro módulo (`multi_unit_cross_booking`) e não é conta que a reserva faça
 * hoje — prometer aqui seria prometer o que o preço não entrega.
 *
 * Some quando a rede não tem outra unidade, quando a leitura falha (é
 * informação de cortesia, não afirmação de que não há rede) e para quem não
 * está logado (a regra só deixa conta logada ler as redes).
 */
import React from 'react';
import { Link } from 'react-router-dom';
import { ChevronRight, Network } from 'lucide-react';
import { useAuth } from '@/core/lib/FirebaseAuthContext';
import { useArena } from '@/modules/arenas/hooks/useArenas';
import { useArenaModules } from '@/modules/arenas/hooks/useArenaModules';
import { useArenaNetwork } from '@/modules/arenas/hooks/useArenaV3';
import { useArenaPrefetch } from '@/modules/arenas/hooks/useArenaPrefetch';
import { ARENA_MODULE_ID } from '@/modules/arenas/domain/modules';
import { V2Surface } from '@/v2/ui/primitives';

/** Uma unidade: nome e cidade vêm do documento público da arena. */
function Unidade({ arenaId }) {
  const { data: arena, isError } = useArena(arenaId);
  const prefetch = useArenaPrefetch();
  // Unidade que não carregou ou foi removida some da lista, em vez de virar
  // um link para lugar nenhum.
  if (isError || !arena || arena.archived) return null;
  const aquecer = () => prefetch(arena.id, arena);
  return (
    <li>
      <Link
        to={`/arenas/${arena.id}`}
        onMouseEnter={aquecer}
        onFocus={aquecer}
        onTouchStart={aquecer}
        className="flex items-center justify-between gap-2 rounded-2xl border border-gray-100 bg-paper px-3 py-2.5 hover:border-gray-300"
      >
        <span className="min-w-0">
          <span className="block truncate text-sm font-bold text-ink">{arena.name}</span>
          {(arena.city || arena.neighborhood) && (
            <span className="block truncate text-xs text-gray-500">
              {[arena.neighborhood, arena.city].filter(Boolean).join(' · ')}
            </span>
          )}
        </span>
        <ChevronRight className="h-4 w-4 shrink-0 text-gray-400" />
      </Link>
    </li>
  );
}

export default function ArenaNetworkSection({ arena }) {
  const arenaId = arena?.id;
  const { user } = useAuth();
  const { isOn } = useArenaModules(arenaId);
  const ligado = isOn(ARENA_MODULE_ID.MULTI_UNIT) && isOn(ARENA_MODULE_ID.MULTI_UNIT_NETWORK);
  const { data: rede } = useArenaNetwork(ligado && user?.uid ? arenaId : null);

  const outras = (rede?.arenas || []).filter((id) => id && id !== arenaId);
  if (!ligado || !user?.uid || !rede || outras.length === 0) return null;

  return (
    <V2Surface className="mt-6">
      <h3 className="flex items-center gap-1.5 font-display text-base font-bold text-ink">
        <Network className="h-4 w-4" /> Outras unidades da rede
      </h3>
      <p className="mt-1 text-xs text-gray-500">
        {rede.name ? `Esta arena faz parte da rede “${rede.name}”.` : 'Esta arena faz parte de uma rede.'}
        {' '}Se esta estiver lotada, vale olhar as outras.
      </p>
      <ul className="mt-3 grid gap-2 sm:grid-cols-2">
        {outras.map((id) => <Unidade key={id} arenaId={id} />)}
      </ul>
    </V2Surface>
  );
}
