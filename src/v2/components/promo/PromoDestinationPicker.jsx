/**
 * "Para onde o banner leva" — da plataforma ou do professor (Onda CG).
 *
 * Como na arena, os destinos são uma lista FECHADA de lugares da plataforma:
 * nenhum link é digitado. Quando o destino é UM item (um torneio, um dia de
 * jogo), escolhe-se qual numa lista do que existe e ainda vale — e a lista que
 * não carregou diz que não carregou.
 */
import React, { useMemo } from 'react';
import {
  Award, BookOpen, CalendarDays, CalendarPlus, ExternalLink, GraduationCap, Handshake, LayoutGrid, Medal,
  Newspaper, ShoppingBag, Sparkles, Store, Swords, Tag, Trophy, User, Users,
} from 'lucide-react';
import { useFeatureFlags } from '@/core/lib/FeatureFlagsContext';
import { usePublicTournaments } from '@/modules/tournament/hooks/useTournament';
import { useMyGameDays } from '@/modules/games/hooks/useGameDays';
import { hojeLocal, isTournamentCurrent } from '@/modules/home/domain/freshness';
import { formatDateShortBR } from '@/modules/arenas/domain/calendar';
import {
  PROMO_DESTINATION as D, PROMO_DESTINATIONS_BY_ISSUER, PROMO_DESTINATION_META,
} from '@/modules/promo/domain/promo';
import { V2ErrorState, V2Select } from '@/v2/ui/primitives';
import { cn } from '@/core/lib/utils';
import { t } from '@/core/i18n';

const ICONE = {
  [D.DETAILS]: ExternalLink,
  [D.TOURNAMENTS]: Trophy,
  [D.TOURNAMENT]: Award,
  [D.OPEN_GAMES]: Swords,
  [D.GAME_DAY]: CalendarDays,
  [D.ARENAS]: LayoutGrid,
  [D.COACHES]: GraduationCap,
  [D.RANKING]: Medal,
  [D.DOUBLES]: Users,
  [D.CLUBS]: Users,
  [D.COMMUNITY]: Newspaper,
  [D.PARTNERS]: Handshake,
  [D.PROMOS]: Tag,
  [D.PROFILE]: User,
  [D.BOOK_LESSON]: CalendarPlus,
  [D.CLINICS]: Sparkles,
  [D.STORE]: ShoppingBag,
  [D.CONTENT]: BookOpen,
  [D.MARKET]: Store,
};

function useOpcoes(alvo) {
  const hoje = hojeLocal();
  const torneios = usePublicTournaments({ enabled: alvo === 'tournament' });
  const dias = useMyGameDays({ enabled: alvo === 'game_day' });
  return useMemo(() => {
    if (alvo === 'tournament') {
      return {
        q: torneios,
        opcoes: (torneios.data || [])
          .filter((t) => isTournamentCurrent(t, hoje))
          .map((t) => ({ id: t.id, label: t.name || 'Torneio' })),
        vazio: t('Não há torneio público com inscrição aberta ou em andamento.'),
      };
    }
    if (alvo === 'game_day') {
      return {
        q: dias,
        opcoes: (dias.data || [])
          .filter((g) => g.status !== 'archived' && g.visibility === 'public' && String(g.date || '') >= hoje)
          .sort((a, b) => String(a.date).localeCompare(String(b.date)))
          .map((g) => ({ id: g.id, label: `${g.title || 'Dia de jogo'} · ${formatDateShortBR(g.date)}` })),
        vazio: t('Você não tem dia de jogo PÚBLICO marcado a partir de hoje — só um dia público pode ser divulgado.'),
      };
    }
    return null;
  }, [alvo, torneios, dias, hoje]);
}

/**
 * @param {{ issuerType: string, value: { type, target_id, target_label }, onChange: Function }} props
 */
export default function PromoDestinationPicker({ issuerType, value, onChange }) {
  const { flags = {} } = useFeatureFlags() || {};
  const tipos = (PROMO_DESTINATIONS_BY_ISSUER[issuerType] || [D.DETAILS])
    .filter((t) => !PROMO_DESTINATION_META[t]?.flag || flags[PROMO_DESTINATION_META[t].flag] || value?.type === t);
  const tipo = value?.type || D.DETAILS;
  const alvo = PROMO_DESTINATION_META[tipo]?.target || null;
  const lista = useOpcoes(alvo);

  return (
    <div className="space-y-3">
      <div className="grid gap-2 sm:grid-cols-2" role="radiogroup" aria-label={t('Para onde o banner leva')}>
        {tipos.map((d) => {
          const meta = PROMO_DESTINATION_META[d];
          const Icone = ICONE[d] || ExternalLink;
          const marcado = tipo === d;
          return (
            <button key={d} type="button" role="radio" aria-checked={marcado}
              onClick={() => onChange({ type: d, target_id: '', target_label: '' })}
              className={cn('flex items-start gap-2.5 rounded-2xl border p-3 text-left transition',
                marcado ? 'border-ink bg-ink/5' : 'border-gray-200 bg-paper-pure hover:border-gray-300')}>
              <Icone className={cn('mt-0.5 h-4 w-4 shrink-0', marcado ? 'text-ink' : 'text-gray-400')} aria-hidden />
              <span className="min-w-0">
                <span className="block text-sm font-bold text-ink">{t(meta.label)}</span>
                <span className="block text-xs text-gray-500">{t(meta.hint)}</span>
              </span>
            </button>
          );
        })}
      </div>

      {lista && (
        lista.q.isError ? (
          <V2ErrorState inline title={t('Não foi possível carregar a lista')}
            description={t('Sem ela não dá para escolher o destino.')} onRetry={() => lista.q.refetch?.()} />
        ) : lista.q.isLoading ? (
          <p className="text-xs text-gray-500">{t('Carregando…')}</p>
        ) : lista.opcoes.length === 0 ? (
          <p className="rounded-2xl bg-amber-50 px-3 py-2 text-xs text-amber-800">{lista.vazio}</p>
        ) : (
          <label className="block">
            <span className="text-sm font-semibold text-ink">{t('Qual?')}</span>
            <V2Select className="mt-1" value={value?.target_id || ''}
              onChange={(e) => {
                const escolhido = lista.opcoes.find((o) => o.id === e.target.value);
                onChange({ type: tipo, target_id: escolhido?.id || '', target_label: escolhido?.label || '' });
              }}>
              <option value="">{t('Escolha…')}</option>
              {lista.opcoes.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
            </V2Select>
          </label>
        )
      )}
    </div>
  );
}
