/**
 * /ligas/:leagueId(/:tab) — a página da LIGA, no mesmo desenho da página do
 * torneio (capa, abas e saídas — docs/57 §15): Visão geral, Classificação,
 * Rodadas, Playoff (quando a temporada tem) e Inscritos. A gestão mora numa
 * página própria, `/ligas/:id/gerenciar`, como a do torneio; o antigo
 * `/ligas/:id/gerir` leva até ela.
 * A classificação é derivada dos jogos (nada gravado); toda escrita passa
 * pela função `leagues` no servidor.
 */
import React, { useMemo } from 'react';
import { Link, Navigate, useLocation, useNavigate, useParams } from 'react-router-dom';
import { Ban, CalendarDays, Check, EyeOff, ListOrdered, MapPin, Medal, Send, Share2, ShieldCheck, Swords, Trophy, Users } from 'lucide-react';
import { t, tk } from '@/core/i18n';
import { useClipboard } from '@/core/lib/useClipboard';
import {
  V2BackLink, V2Button, V2EmptyState, V2ErrorState, V2Page, V2Skeleton, V2Surface,
} from '@/v2/ui/primitives';
import { CompetitionHero, HERO_ACTION, HERO_ACTION_PRIMARY, HERO_CHIP, HeroAdminChip } from '@/v2/components/competition/CompetitionHero';
import { CompetitionTabs } from '@/v2/components/competition/CompetitionNav';
import { LEAGUE_ORGANIZER_LABELS } from '@/modules/leagues/domain/leagueAccess';
import { LEAGUE_STATUS_LABELS, formatMeta } from '@/modules/leagues/domain/leagueFormats';
import { SEASON_CADENCE_LABELS, normalizeSeason } from '@/modules/leagues/domain/leagueSeason';
import LeaguesGate from '@/v2/components/leagues/LeaguesGate';
import LeagueOverview from '@/v2/components/leagues/LeagueOverview';
import LeagueStandings from '@/v2/components/leagues/LeagueStandings';
import LeagueRounds from '@/v2/components/leagues/LeagueRounds';
import LeaguePlayoff from '@/v2/components/leagues/LeaguePlayoff';
import LeagueLadder, { LeagueSessions } from '@/v2/components/leagues/LeagueLadder';
import { isLadderFormat } from '@/modules/leagues/domain/leagueLadder';
import LeagueEntries from '@/v2/components/leagues/LeagueEntries';
import { useLeagueData } from '@/v2/components/leagues/useLeagueData';
import { entryNoun, shortDate } from '@/v2/components/leagues/leagueUi';

const ABAS = [
  { value: 'visao', label: tk('Visão geral') },
  { value: 'classificacao', label: tk('Classificação'), icon: Trophy },
  { value: 'rodadas', label: tk('Rodadas'), icon: Swords },
  { value: 'inscritos', label: tk('Inscritos'), icon: Users },
];
const PLAYOFF = { value: 'playoff', label: tk('Playoff'), icon: Medal };
// Na escada as abas são as mesmas, com o nome do que mostram (os links seguem).
const ROTULO_ESCADA = { classificacao: tk('Escada'), rodadas: tk('Sessões') };

export default function V2League() {
  return <LeaguesGate><Liga /></LeaguesGate>;
}

function Liga() {
  const { leagueId, tab } = useParams();
  const { search } = useLocation();
  const navigate = useNavigate();
  const { copy, copied } = useClipboard();
  const { liga, divisoes, inscricoes, jogos, gere, acessoCarregando } = useLeagueData(leagueId);

  const escada = isLadderFormat(liga.data?.format);
  const comPlayoff = !escada && normalizeSeason(liga.data?.season).playoff.enabled;
  const abas = useMemo(() => {
    const base = comPlayoff ? [...ABAS.slice(0, 3), PLAYOFF, ...ABAS.slice(3)] : ABAS;
    return base.map((a) => ({ ...a, label: t((escada && ROTULO_ESCADA[a.value]) || a.label) }));
  }, [escada, comPlayoff]);
  const aba = abas.some((a) => a.value === tab) ? tab : 'visao';

  // A gestão saiu da página (como no torneio): o link antigo, com a seção, segue valendo.
  if (tab === 'gerir') return <Navigate to={`/ligas/${leagueId}/gerenciar${search}`} replace />;

  if (liga.isLoading) {
    return (
      <V2Page className="space-y-6">
        <V2Skeleton className="h-64 rounded-4xl" />
        <V2Skeleton className="h-96 rounded-4xl" />
      </V2Page>
    );
  }
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
          <V2EmptyState icon={ListOrdered} title={t('Liga não encontrada')} description={t('O link pode estar incompleto ou a liga foi apagada.')}
            action={<Link to="/ligas" className="rounded-full bg-ink px-6 py-3 text-sm font-bold text-white">{t('Voltar às ligas')}</Link>} />
        </V2Surface>
      </V2Page>
    );
  }
  // O rascunho só a organização vê (a regra deixa ler, a tela não mostra).
  if (liga.data.status === 'draft' && !gere && !acessoCarregando) return <Navigate to="/ligas" replace />;

  const l = liga.data;
  const season = normalizeSeason(l.season);
  const meta = formatMeta(l.format);
  const local = [l.city && `${l.city}${l.state ? ` / ${l.state}` : ''}`, l.location].filter(Boolean).join(' · ') || t('Local a definir');
  const temporada = `${t(SEASON_CADENCE_LABELS[season.cadence] || '')}${season.start_date ? ` · ${t('desde {data}', { data: shortDate(season.start_date) })}` : ''}`;
  const organizacao = `${t(LEAGUE_ORGANIZER_LABELS[l.organizer?.type] || '')}${l.organizer?.name ? ` · ${l.organizer.name}` : ''}`;
  const publicUrl = typeof window !== 'undefined' ? `${window.location.origin}/ligas/${l.id}` : '';
  const dados = { league: l, divisions: divisoes, entries: inscricoes, matches: jogos, canManage: gere };
  const goTab = (v) => navigate(v === 'visao' ? `/ligas/${leagueId}` : `/ligas/${leagueId}/${v}`, { replace: true });

  return (
    <V2Page>
      <V2BackLink to="/ligas" className="mb-5">{t('Voltar às ligas')}</V2BackLink>

      {l.status === 'cancelled' && (
        <div className="mb-5 flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          <Ban className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          <div className="flex-1">
            <p className="font-semibold">{t('Esta liga foi cancelada.')}</p>
            <p className="mt-1 text-amber-800/80">{t('Os placares e a classificação ficam guardados para consulta.')}</p>
          </div>
        </div>
      )}

      {gere && l.status === 'draft' && (
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-3xl border border-amber-200 bg-amber-50 p-4 text-amber-900">
          <div className="flex min-w-0 items-start gap-3">
            <EyeOff className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
            <div className="min-w-0 text-sm leading-6">
              <div className="font-semibold">{t('Rascunho: só a organização da liga vê')}</div>
              <p>{t('Monte as divisões e confira a temporada com calma. Quando estiver pronta, abra as inscrições: aí ela aparece para todos.')}</p>
            </div>
          </div>
          <V2Button asChild size="sm">
            <Link to={`/ligas/${l.id}/gerenciar?secao=situacao`}><Send className="h-4 w-4" aria-hidden="true" /> {t('Abrir as inscrições')}</Link>
          </V2Button>
        </div>
      )}

      <CompetitionHero
        icon={ListOrdered}
        title={l.name}
        description={l.description || t('Acompanhe a classificação, as rodadas e os inscritos da temporada.')}
        chips={(
          <>
            <span className={HERO_CHIP}>{t(LEAGUE_STATUS_LABELS[l.status] || l.status || '')}</span>
            {meta && <span className={HERO_CHIP}>{t(meta.label)}</span>}
            <span className={HERO_CHIP}>{l.visibility === 'unlisted' ? t('Só com o link') : t('Na lista de ligas')}</span>
            {gere && <HeroAdminChip />}
          </>
        )}
        facts={[
          { icon: MapPin, label: t('Local'), value: local },
          { icon: CalendarDays, label: t('Temporada'), value: temporada },
          { icon: Users, label: t('Organização'), value: organizacao },
        ]}
        note={(
          <p className="mt-4 flex items-center gap-2 text-sm leading-6 text-gray-300">
            <Users className="h-4 w-4 text-acid" aria-hidden="true" /> {l.entries_count || 0} {entryNoun(l.format, true)}
            {l.status === 'open' && ` · ${t('inscrições abertas')}`}
          </p>
        )}
        actions={(
          <>
            {gere && (
              <Link to={`/ligas/${l.id}/gerenciar`} data-dica="liga-gerenciar" className={HERO_ACTION_PRIMARY}>
                <ShieldCheck className="h-4 w-4" aria-hidden="true" /> {t('Gerenciar liga')}
              </Link>
            )}
            {l.status !== 'draft' && (
              <button type="button" onClick={() => copy(publicUrl, t('Link da liga copiado!'))} className={HERO_ACTION}>
                {copied ? <Check className="h-4 w-4 text-acid" aria-hidden="true" /> : <Share2 className="h-4 w-4" aria-hidden="true" />} {t('Compartilhar link')}
              </button>
            )}
          </>
        )}
      />

      <CompetitionTabs tabs={abas} active={aba} onSelect={goTab} ariaLabel={t('Abas da liga')} dica="liga-abas" className="mt-6" />

      <div className="mt-6">
        {aba === 'visao' && <LeagueOverview {...dados} onGo={(v) => navigate(`/ligas/${leagueId}/${v}`)} />}
        {aba === 'classificacao' && (escada ? <LeagueLadder {...dados} /> : <LeagueStandings {...dados} />)}
        {aba === 'rodadas' && (escada ? <LeagueSessions {...dados} /> : <LeagueRounds {...dados} />)}
        {aba === 'playoff' && <LeaguePlayoff {...dados} />}
        {aba === 'inscritos' && <LeagueEntries {...dados} />}
      </div>
    </V2Page>
  );
}
