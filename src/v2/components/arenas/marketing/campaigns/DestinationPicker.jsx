/**
 * "Para onde o banner leva" (Onda CC).
 *
 * Os destinos são uma lista FECHADA de lugares da plataforma — nenhum link é
 * digitado. Só aparecem os destinos cujo módulo a arena ligou (sem a loja, o
 * banner não pode levar a um produto). Quando o destino é UM item (um dia de
 * jogo, um torneio, um produto), a arena escolhe qual, numa lista do que
 * existe — e a lista que não carregou diz que não carregou.
 */
import React, { useMemo } from 'react';
import {
  CalendarDays, Crown, ExternalLink, GraduationCap, LayoutGrid, Package, Swords, Tag, Trophy, Users,
} from 'lucide-react';
import { useArenaModules } from '@/modules/arenas/hooks/useArenaModules';
import { useArenaGameDays } from '@/modules/games/hooks/useArenaGameDays';
import { useArenaTournaments } from '@/modules/tournament/hooks/useTournament';
import { useShopProducts } from '@/modules/arenas/hooks/useArenaV3';
import {
  CAMPAIGN_DESTINATION, CAMPAIGN_DESTINATION_META, availableDestinations,
} from '@/modules/arenas/domain/campaignBanner';
import { sortHouseTournaments } from '@/modules/arenas/domain/houseTournaments';
import { formatDateShortBR } from '@/modules/arenas/domain/calendar';
import { formatPrice } from '@/modules/arenas/domain/pricing';
import { todayISO } from '@/modules/arenas/domain/subscription';
import { V2ErrorState, V2Select } from '@/v2/ui/primitives';
import { cn } from '@/core/lib/utils';

const ICONE = {
  [CAMPAIGN_DESTINATION.DETAILS]: ExternalLink,
  [CAMPAIGN_DESTINATION.BOOKING]: LayoutGrid,
  [CAMPAIGN_DESTINATION.OPEN_MATCH]: Swords,
  [CAMPAIGN_DESTINATION.GAME_DAY]: CalendarDays,
  [CAMPAIGN_DESTINATION.TOURNAMENT]: Trophy,
  [CAMPAIGN_DESTINATION.PRODUCT]: Package,
  [CAMPAIGN_DESTINATION.MEMBERS]: Crown,
  [CAMPAIGN_DESTINATION.CLASSES]: GraduationCap,
  [CAMPAIGN_DESTINATION.PROMOS]: Tag,
  [CAMPAIGN_DESTINATION.RANKING]: Users,
};

/** A lista de itens do destino que pede "qual". */
function useOpcoes(arenaId, alvo) {
  const hoje = todayISO();
  const dias = useArenaGameDays(alvo === 'game_day' ? arenaId : null);
  const torneios = useArenaTournaments(alvo === 'tournament' ? arenaId : null);
  const produtos = useShopProducts(alvo === 'product' ? arenaId : null);
  return useMemo(() => {
    if (alvo === 'game_day') {
      return {
        q: dias,
        opcoes: (dias.data || [])
          .filter((g) => g.status !== 'archived' && String(g.date || '') >= hoje)
          .sort((a, b) => String(a.date).localeCompare(String(b.date)))
          .map((g) => ({ id: g.id, label: `${g.title || 'Dia de jogo'} · ${formatDateShortBR(g.date)}` })),
        vazio: 'Não há dia de jogo marcado a partir de hoje.',
      };
    }
    if (alvo === 'tournament') {
      return {
        q: torneios,
        opcoes: sortHouseTournaments(torneios.data || [])
          .filter((t) => t.status !== 'finished')
          .map((t) => ({ id: t.id, label: t.name || 'Torneio' })),
        vazio: 'Não há torneio da casa com inscrição ou em andamento.',
      };
    }
    if (alvo === 'product') {
      return {
        q: produtos,
        opcoes: (produtos.data || []).map((p) => ({
          id: p.id, label: `${p.name}${Number(p.price) > 0 ? ` · ${formatPrice(p.price)}` : ''}`,
        })),
        vazio: 'Nenhum produto está à venda pelo app. Marque "Vender pelo app" no Mercado.',
      };
    }
    return null;
  }, [alvo, dias, torneios, produtos, hoje]);
}

/**
 * @param {{ arenaId: string, value: { type, target_id, target_label }, onChange: Function }} props
 */
export default function DestinationPicker({ arenaId, value, onChange }) {
  const { isOn } = useArenaModules(arenaId);
  const tipos = availableDestinations(isOn);
  const tipo = value?.type || CAMPAIGN_DESTINATION.DETAILS;
  const alvo = CAMPAIGN_DESTINATION_META[tipo]?.target || null;
  const lista = useOpcoes(arenaId, alvo);

  return (
    <div className="space-y-3">
      <div className="grid gap-2 sm:grid-cols-2" role="radiogroup" aria-label="Para onde o banner leva">
        {tipos.map((t) => {
          const meta = CAMPAIGN_DESTINATION_META[t];
          const Icone = ICONE[t] || ExternalLink;
          const marcado = tipo === t;
          return (
            <button
              key={t}
              type="button"
              role="radio"
              aria-checked={marcado}
              onClick={() => onChange({ type: t, target_id: '', target_label: '' })}
              className={cn(
                'flex items-start gap-2.5 rounded-2xl border p-3 text-left transition',
                marcado ? 'border-ink bg-ink/5' : 'border-gray-200 bg-paper-pure hover:border-gray-300',
              )}
            >
              <Icone className={cn('mt-0.5 h-4 w-4 shrink-0', marcado ? 'text-ink' : 'text-gray-400')} aria-hidden />
              <span className="min-w-0">
                <span className="block text-sm font-bold text-ink">{meta.label}</span>
                <span className="block text-xs text-gray-500">{meta.hint}</span>
              </span>
            </button>
          );
        })}
      </div>

      {lista && (
        lista.q.isError ? (
          <V2ErrorState inline title="Não foi possível carregar a lista"
            description="Sem ela não dá para escolher o destino." onRetry={() => lista.q.refetch?.()} />
        ) : lista.q.isLoading ? (
          <p className="text-xs text-gray-500">Carregando…</p>
        ) : lista.opcoes.length === 0 ? (
          <p className="rounded-2xl bg-amber-50 px-3 py-2 text-xs text-amber-800">{lista.vazio}</p>
        ) : (
          <label className="block">
            <span className="text-sm font-semibold text-ink">Qual?</span>
            <V2Select
              className="mt-1"
              value={value?.target_id || ''}
              onChange={(e) => {
                const escolhido = lista.opcoes.find((o) => o.id === e.target.value);
                onChange({ type: tipo, target_id: escolhido?.id || '', target_label: escolhido?.label || '' });
              }}
            >
              <option value="">Escolha…</option>
              {lista.opcoes.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
            </V2Select>
          </label>
        )
      )}
    </div>
  );
}
