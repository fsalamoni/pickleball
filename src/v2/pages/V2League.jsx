/**
 * /ligas/:leagueId(/:tab) — a página da LIGA. Abas: Visão geral,
 * Classificação, Rodadas, Inscritos e, para quem organiza, Gerir.
 * A classificação é derivada dos jogos (nada gravado); toda escrita passa
 * pela função `leagues` no servidor.
 */
import React, { useMemo } from 'react';
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom';
import { CalendarDays, Eye, ListOrdered, MapPin, Settings, Swords, Trophy, Users } from 'lucide-react';
import { t, tk } from '@/core/i18n';
import { useAuth } from '@/core/lib/FirebaseAuthContext';
import {
  HERO_TITLE, V2BackLink, V2Badge, V2EmptyState, V2ErrorState, V2Page, V2Skeleton, V2Surface,
} from '@/v2/ui/primitives';
import { V2SubTabs } from '@/v2/ui/V2SectionNav';
import { useMyClubs } from '@/modules/clubs/hooks/useClubs';
import { useMyManagedArenas } from '@/modules/arenas/hooks/useArenas';
import { useMyFederationRoles } from '@/modules/federations/hooks/useFederations';
import { useLeague, useLeagueDivisions, useLeagueEntries, useLeagueMatches } from '@/modules/leagues/hooks/useLeagues';
import { LEAGUE_ORGANIZER_LABELS, canManageLeague } from '@/modules/leagues/domain/leagueAccess';
import { formatMeta } from '@/modules/leagues/domain/leagueFormats';
import { SEASON_CADENCE_LABELS, normalizeSeason } from '@/modules/leagues/domain/leagueSeason';
import LeaguesGate from '@/v2/components/leagues/LeaguesGate';
import LeagueOverview from '@/v2/components/leagues/LeagueOverview';
import LeagueStandings from '@/v2/components/leagues/LeagueStandings';
import LeagueRounds from '@/v2/components/leagues/LeagueRounds';
import LeagueEntries from '@/v2/components/leagues/LeagueEntries';
import LeagueManage from '@/v2/components/leagues/LeagueManage';
import { LeagueStatusBadge, entryNoun, shortDate } from '@/v2/components/leagues/leagueUi';

const ABAS = [
  { value: 'visao', label: tk('Visão geral'), icon: Eye },
  { value: 'classificacao', label: tk('Classificação'), icon: Trophy },
  { value: 'rodadas', label: tk('Rodadas'), icon: Swords },
  { value: 'inscritos', label: tk('Inscritos'), icon: Users },
];
const GERIR = { value: 'gerir', label: tk('Gerir'), icon: Settings };

export default function V2League() {
  return <LeaguesGate><Liga /></LeaguesGate>;
}

function Liga() {
  const { leagueId, tab } = useParams();
  const navigate = useNavigate();
  const { user, isPlatformAdmin } = useAuth();
  const liga = useLeague(leagueId);
  const divisoes = useLeagueDivisions(leagueId);
  const inscricoes = useLeagueEntries(leagueId);
  const jogos = useLeagueMatches(leagueId);
  const clubs = useMyClubs({ enabled: liga.data?.organizer?.type === 'club' });
  const arenas = useMyManagedArenas();
  const papeis = useMyFederationRoles({ enabled: liga.data?.organizer?.type === 'federation' });

  const gere = canManageLeague(liga.data, {
    uid: user?.uid, isPlatformAdmin, clubs: clubs.data, arenas: arenas.data, federationRoles: papeis.data,
  });
  const abas = useMemo(() => (gere ? [...ABAS, GERIR] : ABAS).map((a) => ({ ...a, label: t(a.label) })), [gere]);
  const aba = abas.some((a) => a.value === tab) ? tab : 'visao';

  if (liga.isLoading) return <V2Page className="space-y-4"><V2Skeleton className="h-48 rounded-4xl" /><V2Skeleton className="h-64" /></V2Page>;
  if (liga.isError) {
    return (
      <V2Page>
        <V2Surface><V2ErrorState title={t('Não foi possível abrir a liga')} description={t('A conexão falhou. A liga continua lá.')} onRetry={() => liga.refetch()} /></V2Surface>
      </V2Page>
    );
  }
  if (!liga.data) {
    return (
      <V2Page>
        <V2Surface>
          <V2EmptyState icon={ListOrdered} title={t('Liga não encontrada')} description={t('O link pode estar incompleto ou a liga foi apagada.')} />
        </V2Surface>
      </V2Page>
    );
  }
  // O rascunho só a organização vê (a regra deixa ler, a tela não mostra).
  if (liga.data.status === 'draft' && !gere && !(clubs.isLoading || papeis.isLoading)) return <Navigate to="/ligas" replace />;
  if (tab === 'gerir' && !gere && !(clubs.isLoading || papeis.isLoading)) return <Navigate to={`/ligas/${leagueId}`} replace />;

  const l = liga.data;
  const season = normalizeSeason(l.season);
  const meta = formatMeta(l.format);
  const local = [l.city && `${l.city}${l.state ? ` / ${l.state}` : ''}`, l.location].filter(Boolean).join(' · ');
  const dados = { league: l, divisions: divisoes, entries: inscricoes, matches: jogos, canManage: gere };

  return (
    <V2Page className="space-y-6">
      <V2BackLink to="/ligas">{t('Voltar às ligas')}</V2BackLink>

      <div className="relative overflow-hidden rounded-4xl bg-mesh p-6 shadow-organic sm:p-8">
        <div className="absolute -right-10 -top-10 h-56 w-56 rounded-full bg-acid opacity-20 blur-[80px]" />
        <div className="relative z-10">
          <div className="flex flex-wrap items-center gap-2">
            <LeagueStatusBadge status={l.status} />
            {meta && <V2Badge tone="acid">{t(meta.label)}</V2Badge>}
            {l.visibility === 'unlisted' && <V2Badge tone="neutral">{t('Só com o link')}</V2Badge>}
          </div>
          <h1 className={`mt-4 ${HERO_TITLE}`}>{l.name}</h1>
          <p className="mt-2 text-sm text-gray-300">
            {t(LEAGUE_ORGANIZER_LABELS[l.organizer?.type] || '')}{l.organizer?.name ? ` · ${l.organizer.name}` : ''}
          </p>
          <div className="mt-5 flex flex-wrap gap-x-6 gap-y-2 text-sm text-gray-300">
            {local && <span className="flex items-center gap-2"><MapPin className="h-4 w-4 text-acid" aria-hidden="true" /> {local}</span>}
            <span className="flex items-center gap-2">
              <CalendarDays className="h-4 w-4 text-acid" aria-hidden="true" />
              {t(SEASON_CADENCE_LABELS[season.cadence])}{season.start_date ? ` · ${t('desde {data}', { data: shortDate(season.start_date) })}` : ''}
            </span>
            <span className="flex items-center gap-2"><Users className="h-4 w-4 text-acid" aria-hidden="true" /> {l.entries_count || 0} {entryNoun(l.format, true)}</span>
          </div>
        </div>
      </div>

      <V2SubTabs
        tabs={abas}
        activeValue={aba}
        onSelect={(a) => navigate(a.value === 'visao' ? `/ligas/${leagueId}` : `/ligas/${leagueId}/${a.value}`, { replace: true })}
        ariaLabel={t('Abas da liga')}
        dica="liga-abas"
      />

      {aba === 'visao' && <LeagueOverview {...dados} onGo={(v) => navigate(`/ligas/${leagueId}/${v}`)} />}
      {aba === 'classificacao' && <LeagueStandings {...dados} />}
      {aba === 'rodadas' && <LeagueRounds {...dados} />}
      {aba === 'inscritos' && <LeagueEntries {...dados} />}
      {aba === 'gerir' && gere && <LeagueManage {...dados} />}

      {aba !== 'gerir' && (
        <p className="text-center text-xs text-gray-500">
          {t('Quer um evento de um fim de semana?')} <Link to="/torneios" className="font-semibold text-ink underline-offset-4 hover:underline">{t('Veja os torneios')}</Link>
        </p>
      )}
    </V2Page>
  );
}
