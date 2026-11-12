/**
 * /ligas — a área das LIGAS, ao lado dos torneios e sem se misturar com eles.
 * Duas abas: as ligas abertas a todos e as minhas (onde jogo ou organizo).
 * Só aparece com alguma flag de ligas ligada (ou para o admin da plataforma).
 */
import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { CalendarDays, ListOrdered, MapPin, Plus, Trophy, Users } from 'lucide-react';
import { t } from '@/core/i18n';
import { cn } from '@/core/lib/utils';
import { V2Badge, V2Button, V2EmptyState, V2ErrorState, V2Page, V2PageIntro, V2Skeleton, V2Surface } from '@/v2/ui/primitives';
import { useMyLeagues, usePublicLeagues } from '@/modules/leagues/hooks/useLeagues';
import LeaguesGate from '@/v2/components/leagues/LeaguesGate';
import { formatMeta } from '@/modules/leagues/domain/leagueFormats';
import { LEAGUE_ORGANIZER_LABELS } from '@/modules/leagues/domain/leagueAccess';
import { LeagueStatusBadge, entryNoun, shortDate } from '@/v2/components/leagues/leagueUi';

// Rolando primeiro, depois as abertas, depois o resto (o mais novo antes).
const ORDEM = { running: 0, open: 1, draft: 2, finished: 3, cancelled: 4 };
const ordenar = (lista) => [...(lista || [])].sort((a, b) => (ORDEM[a.status] ?? 9) - (ORDEM[b.status] ?? 9)
  || String(b.season?.start_date || '').localeCompare(String(a.season?.start_date || '')));

export default function V2Leagues() {
  return <LeaguesGate><Ligas /></LeaguesGate>;
}

function Ligas() {
  const [aba, setAba] = useState('public');
  const publicas = usePublicLeagues();
  const minhas = useMyLeagues();
  const q = aba === 'mine' ? minhas : publicas;
  const lista = useMemo(() => ordenar(q.data), [q.data]);

  return (
    <V2Page>
      <V2PageIntro
        title={t('Ligas')}
        subtitle={t('Competição contínua: rodadas no calendário durante semanas ou meses, com classificação por pontos.')}
        action={(
          <div className="flex flex-wrap gap-2">
            <V2Button asChild variant="ghost"><Link to="/torneios/criar">{t('Criar torneio')}</Link></V2Button>
            <V2Button asChild><Link to="/ligas/criar" data-dica="ligas-criar"><Plus className="h-4 w-4" aria-hidden="true" /> {t('Criar liga')}</Link></V2Button>
          </div>
        )}
      />

      <div className="mb-6 inline-flex rounded-full border border-gray-100 bg-paper-pure p-1.5 shadow-sm">
        {[['public', t('Abertas a todos')], ['mine', t('Minhas ligas')]].map(([id, label]) => (
          <button type="button"
            key={id}
            aria-pressed={aba === id}
            onClick={() => setAba(id)}
            className={cn('rounded-full px-6 py-2.5 text-sm font-semibold transition-colors', aba === id ? 'bg-ink text-white shadow-md' : 'text-gray-500 hover:text-ink')}
          >
            {label}
          </button>
        ))}
      </div>

      {q.isLoading ? (
        <div className="grid gap-6 lg:grid-cols-2 xl:grid-cols-3">
          {[1, 2, 3].map((i) => <V2Skeleton key={i} className="h-52 rounded-4xl" />)}
        </div>
      ) : q.isError ? (
        <V2Surface>
          <V2ErrorState
            title={t('Não foi possível carregar as ligas')}
            description={t('A conexão falhou no meio do caminho. Nenhuma liga foi perdida.')}
            onRetry={() => q.refetch()}
          />
        </V2Surface>
      ) : lista.length === 0 ? (
        <V2Surface>
          <V2EmptyState
            icon={ListOrdered}
            title={aba === 'mine' ? t('Você ainda não está em nenhuma liga') : t('Nenhuma liga aberta por enquanto')}
            description={aba === 'mine'
              ? t('Entre numa liga aberta ou crie a sua para jogar a temporada inteira.')
              : t('Assim que uma liga abrir as inscrições, ela aparece aqui.')}
            action={<V2Button asChild><Link to="/ligas/criar">{t('Criar liga')}</Link></V2Button>}
          />
        </V2Surface>
      ) : (
        <div className="grid gap-6 lg:grid-cols-2 xl:grid-cols-3">
          {lista.map((l) => <LeagueCard key={l.id} league={l} />)}
        </div>
      )}
    </V2Page>
  );
}

function LeagueCard({ league }) {
  const meta = formatMeta(league.format);
  const local = league.city ? `${league.city}${league.state ? ` / ${league.state}` : ''}` : t('Local a definir');
  return (
    <Link
      to={`/ligas/${league.id}`}
      className="group flex h-full flex-col rounded-4xl border border-gray-100 bg-paper-pure p-6 shadow-organic-sm transition-all hover:shadow-organic sm:p-7"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-ink text-white transition-colors group-hover:bg-acid group-hover:text-ink">
            <ListOrdered className="h-5 w-5" aria-hidden="true" />
          </span>
          <h3 className="truncate font-display text-lg font-bold text-ink">{league.name}</h3>
        </div>
        <LeagueStatusBadge status={league.status} />
      </div>
      <div className="mt-4 flex items-center gap-2 text-sm text-gray-500">
        <MapPin className="h-4 w-4 shrink-0" aria-hidden="true" /> <span className="truncate">{local}</span>
      </div>
      {league.description && <p className="mt-3 line-clamp-2 text-sm leading-6 text-gray-500">{league.description}</p>}
      <div className="mt-4 flex flex-wrap gap-2">
        {meta && <V2Badge tone="neutral"><Trophy className="h-3 w-3" aria-hidden="true" /> {t(meta.label)}</V2Badge>}
        {league.season?.start_date && <V2Badge tone="neutral"><CalendarDays className="h-3 w-3" aria-hidden="true" /> {t('Desde {data}', { data: shortDate(league.season.start_date) })}</V2Badge>}
        <V2Badge tone="neutral"><Users className="h-3 w-3" aria-hidden="true" /> {league.entries_count || 0} {entryNoun(league.format, true)}</V2Badge>
      </div>
      <div className="mt-auto flex items-center justify-between pt-6 text-sm text-gray-500">
        <span>{t(LEAGUE_ORGANIZER_LABELS[league.organizer?.type] || '')}{league.organizer?.name ? ` · ${league.organizer.name}` : ''}</span>
        <span className="font-bold text-ink transition-transform group-hover:translate-x-1" aria-hidden="true">→</span>
      </div>
    </Link>
  );
}
