/**
 * "Sua arena" na tela inicial — para quem gere (ou quer gerir) uma arena.
 *
 * Cada arena gerida, com os pedidos de reserva esperando resposta e portas
 * DIRETAS para as abas da Central (`?aba=`): sem passar pela lista de arenas e
 * sem procurar a aba certa. A faixa completa "Precisa de você" mora na Central
 * — aqui fica o número que a barra lateral já conta (mesma consulta, em cache).
 *
 * Quem marcou o interesse e ainda não tem arena vê o caminho para cadastrar.
 *
 * ⚠️ Falha não é vazio: com a leitura das arenas falhando, "cadastre a sua
 * arena" convidaria a criar uma DUPLICADA. E a contagem de pedidos, que a
 * barra lateral faz em silêncio (erro vira 0), aqui nunca vira "nenhum pedido"
 * — só o número quando há.
 */
import React from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight, Building2, CalendarClock, CalendarDays, LayoutGrid, Plus,
} from 'lucide-react';
import { useMyArenaSummary } from '@/modules/arenas/hooks/useMyArenaSummary';
import { useMyManagedArenas } from '@/modules/arenas/hooks/useArenas';
import { V2ErrorState, V2Skeleton } from '@/v2/ui/primitives';
import { HomeAction, HomeEmpty, HomeSection } from './HomeSection';

function Porta({ to, icon: Icon, children }) {
  return (
    <Link
      to={to}
      className="btn-press inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-white/20 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-acid/40"
    >
      <Icon className="h-3.5 w-3.5" aria-hidden="true" /> {children}
    </Link>
  );
}

export default function HomeArenaSection({ reason }) {
  const { arenas, pendingByArena, isLoading } = useMyArenaSummary();
  // Mesma consulta do resumo (mesma chave, em cache) — daqui sai o `isError`.
  const geridas = useMyManagedArenas();

  return (
    <HomeSection id="arena" icon={Building2} title={arenas.length > 1 ? 'Suas arenas' : 'Sua arena'} reason={reason}>
      {isLoading ? (
        <V2Skeleton className="h-32 rounded-3xl" />
      ) : geridas.isError ? (
        <V2ErrorState
          inline
          title="Não carregou as suas arenas"
          description="A sua arena continua lá — isso quase sempre se resolve tentando de novo."
          onRetry={geridas.refetch}
        />
      ) : arenas.length === 0 ? (
        <HomeEmpty icon={Building2} actions={<HomeAction to="/arenas/criar" primary><Plus className="h-3.5 w-3.5" aria-hidden="true" /> Cadastrar minha arena</HomeAction>}>
          Cadastre a sua arena para receber reservas, montar dias de jogo e divulgar promoções.
        </HomeEmpty>
      ) : (
        <ul className="grid gap-3">
          {arenas.slice(0, 3).map((a) => {
            const pedidos = pendingByArena?.[a.id] || 0;
            const central = `/arenas/${a.id}/gerir`;
            return (
              <li key={a.id} className="rounded-3xl bg-mesh p-4 text-white">
                <div className="flex items-start justify-between gap-3">
                  <Link to={central} className="group min-w-0 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-acid/40">
                    <span className="block truncate font-display text-lg font-bold">{a.name || 'Arena'}</span>
                    <span className="block text-xs text-gray-300">
                      {[a.city, a.state].filter(Boolean).join(' / ') || 'Central da arena'}
                      {a.my_role === 'owner' ? ' · dona' : ''}
                    </span>
                  </Link>
                  {pedidos > 0 && (
                    <Link
                      to={`${central}?aba=reservas`}
                      className="shrink-0 rounded-full bg-acid px-3 py-1 text-xs font-bold text-ink"
                    >
                      {`${pedidos} ${pedidos === 1 ? 'pedido esperando' : 'pedidos esperando'}`}
                    </Link>
                  )}
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Porta to={`${central}?aba=reservas`} icon={CalendarClock}>Solicitações</Porta>
                  <Porta to={`${central}?aba=calendario`} icon={CalendarDays}>Calendário</Porta>
                  <Porta to={`${central}?aba=quadras`} icon={LayoutGrid}>Quadras</Porta>
                  <Porta to={central} icon={ArrowRight}>Abrir a Central</Porta>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </HomeSection>
  );
}
