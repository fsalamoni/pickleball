import React from 'react';
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom';
import {
  Archive, Calendar, CalendarClock, CalendarPlus, Check, Copy, Eye, EyeOff, Hash, Images, MapPin, MonitorPlay, Share2, ShieldCheck, Trophy, Users,
} from 'lucide-react';
import { useFeatureFlag } from '@/core/lib/FeatureFlagsContext';
import { FEATURE_FLAG } from '@/core/featureFlags';
import { MyNextMatchStrip, V2FollowPlayers, V2MyParticipation } from '@/v2/components/tournament/TournamentTimeline';
import { useMeInTournament } from '@/modules/tournament/hooks/usePersonalTimeline';
import { buildICS, icsFilename } from '@/modules/tournament/domain/ics';
import { useClipboard } from '@/core/lib/useClipboard';
import { useTournament, useIsTournamentAdmin, useModalities } from '@/modules/tournament/hooks/useTournament';
import {
  MODALITY_FORMAT_LABELS,
  SKILL_LEVEL_LABELS,
  TOURNAMENT_STATUS,
  TOURNAMENT_STATUS_LABELS,
  TOURNAMENT_VISIBILITY,
  TOURNAMENT_VISIBILITY_LABELS,
} from '@/modules/tournament/domain/constants';
import V2TournamentAdminPanel from '@/v2/components/tournament/V2TournamentAdminPanel';
import { V2TournamentOverview } from '@/v2/components/tournament/V2OverviewBlock';
import { V2TournamentMatches } from '@/v2/components/tournament/V2MatchesBlock';
import { V2TournamentRanking } from '@/v2/components/tournament/V2RankingBlock';
import { V2TournamentGallery } from '@/v2/components/tournament/V2Gallery';
import { V2Badge, V2EmptyState, V2ErrorState, V2Skeleton, V2Surface, V2BackLink, V2Page } from '@/v2/ui/primitives';
import { CompetitionHero, HERO_ACTION, HERO_ACTION_PRIMARY, HERO_CHIP, HeroAdminChip } from '@/v2/components/competition/CompetitionHero';
import { CompetitionTabs } from '@/v2/components/competition/CompetitionNav';
import { t, fmtData } from '@/core/i18n';
import { TournamentSanctionBadge } from '@/v2/components/federations/FedTags';
import ClubTournamentBadge from '@/v2/components/clubs/ClubTournamentBadge';
import { PublishTournamentBanner, RegistrationWindowNote, formatInstant } from '@/v2/components/tournament/RegistrationSchedule';
import { effectiveTournamentStatus } from '@/modules/tournament/domain/registrationWindow';
import TournamentIntegrityNotice from '@/v2/components/federations/integrity/TournamentIntegrityNotice';
import { TournamentRefereeCrew } from '@/v2/components/federations/referees/RefereesPublic';

function parseDate(value) {
  if (!value) return null;
  try {
    const date = typeof value === 'string' ? new Date(`${value}T00:00:00`) : value?.toDate ? value.toDate() : new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
  } catch {
    return null;
  }
}

function formatDate(value) {
  const d = parseDate(value);
  return d ? fmtData(d, { day: '2-digit', month: 'short', year: 'numeric' }) : null;
}

function formatDateRange(start, end) {
  const s = parseDate(start);
  const e = parseDate(end);
  if (!s && !e) return null;
  const fmt = (v) => fmtData(v, { day: '2-digit', month: 'short', year: 'numeric' });
  if (s && e) return s.toDateString() === e.toDateString() ? fmt(s) : `${fmt(s)} a ${fmt(e)}`;
  return fmt(s || e);
}

export default function V2Tournament() {
  const { tournamentId, tab = 'visao-geral' } = useParams();
  const navigate = useNavigate();
  const { data: tournament, isLoading, isError, error, refetch } = useTournament(tournamentId);
  const { data: isAdmin } = useIsTournamentAdmin(tournamentId);
  // "Minha participação" e "Acompanhar" (docs/55): com a flag desligada,
  // nenhuma consulta a mais é feita (o id nulo desliga as três).
  const personalOn = useFeatureFlag(FEATURE_FLAG.TOURNAMENT_PERSONAL_VIEW);
  const { eu } = useMeInTournament(personalOn ? tournamentId : null);
  const { data: modalities = [] } = useModalities(tournamentId);
  const modalityPagesOn = true;
  const galleryOn = true;
  const calendarExportOn = true;
  const tvModeOn = true;
  const adminConsoleOn = true;
  const { copy, copied } = useClipboard();

  if (isLoading) {
    return (
      <V2Page className="space-y-6">
        <V2Skeleton className="h-64 rounded-4xl" />
        <V2Skeleton className="h-96 rounded-4xl" />
      </V2Page>
    );
  }

  // ⚠️ FALHA não é ausência. "Torneio não encontrado — verifique o link" numa
  // queda de rede manda o organizador conferir um link que está certo e
  // concluir que apagaram o torneio.
  // Rascunho (ou arquivado) de outra pessoa: a regra recusa a leitura. Não é
  // queda de rede — tentar de novo não muda nada —, então a tela diz o que é.
  if (isError && error?.code === 'permission-denied') {
    return (
      <V2Page>
        <V2Surface>
          <V2EmptyState icon={EyeOff} title={t('Este torneio ainda não está disponível')}
            description={t('A organização ainda não o publicou, ou ele foi arquivado. Quando for publicado, este mesmo link passa a abrir.')}
            action={<Link to="/torneios" className="rounded-full bg-ink px-6 py-3 text-sm font-bold text-white">{t('Voltar aos torneios')}</Link>} />
        </V2Surface>
      </V2Page>
    );
  }
  if (isError) {
    return (
      <V2Page>
        <V2Surface>
          <V2ErrorState
            title={t('Não foi possível carregar o torneio')}
            description={t('A conexão falhou no meio do caminho. Ele continua lá — tente de novo.')}
            onRetry={refetch}
          />
        </V2Surface>
      </V2Page>
    );
  }
  if (!tournament) {
    return (
      <V2Page>
        <V2Surface>
          <V2EmptyState icon={Trophy} title={t('Torneio não encontrado')}
            description={t('Verifique o link ou volte para a lista de torneios.')}
            action={<Link to="/torneios" className="rounded-full bg-ink px-6 py-3 text-sm font-bold text-white">{t('Voltar aos torneios')}</Link>} />
        </V2Surface>
      </V2Page>
    );
  }

  const showGallery = modalityPagesOn && galleryOn;
  const isPublic = (tournament.visibility || TOURNAMENT_VISIBILITY.PRIVATE) === TOURNAMENT_VISIBILITY.PUBLIC;
  const publicUrl = typeof window !== 'undefined' ? `${window.location.origin}/p/${tournament.id}` : '';
  const dateRange = formatDateRange(tournament.starts_at, tournament.ends_at);
  const deadline = formatInstant(tournament.registration_closes_ms) || formatDate(tournament.registration_deadline);
  const isDraft = tournament.status === TOURNAMENT_STATUS.DRAFT;
  const statusAgora = effectiveTournamentStatus(tournament);
  const location = tournament.city ? `${tournament.city}${tournament.state ? ` / ${tournament.state}` : ''}` : t('Local a definir');

  const toDateSafe = (v) => {
    if (!v) return null;
    if (typeof v.toDate === 'function') return v.toDate();
    const d = new Date(v);
    return Number.isNaN(d.getTime()) ? null : d;
  };
  const downloadTournamentIcs = () => {
    const start = toDateSafe(tournament.starts_at);
    if (!start) return;
    const end = toDateSafe(tournament.ends_at) || new Date(start.getTime() + 2 * 60 * 60 * 1000);
    const content = buildICS({
      uid: `tournament-${tournament.id}@picklerush`,
      start, end,
      title: tournament.name,
      description: tournament.description || t('Torneio de pickleball'),
      location: location !== t('Local a definir') ? location : '',
      url: publicUrl,
    });
    if (!content) return;
    const blob = new Blob([content], { type: 'text/calendar;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = icsFilename(tournament.name);
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // Console dedicado ligado: a gestão sai da página pública. Um /admin direto
  // redireciona para a página de gestão.
  if (adminConsoleOn && isAdmin && tab === 'admin') {
    return <Navigate to={`/torneios/${tournamentId}/gerenciar`} replace />;
  }

  const abasPessoais = personalOn ? ['minha-participacao', 'acompanhar'] : [];
  const activeTab = ['visao-geral', 'jogos', 'ranking', 'fotos', 'admin', ...abasPessoais].includes(tab) ? tab : 'visao-geral';
  const goTab = (v) => navigate(`/torneios/${tournamentId}/${v}`);

  const tabs = [
    // Quem está inscrito vê a própria linha do tempo primeiro na barra.
    ...(personalOn && eu ? [{ value: 'minha-participacao', label: t('Minha participação'), icon: CalendarClock }] : []),
    { value: 'visao-geral', label: t('Visão geral') },
    { value: 'jogos', label: t('Jogos') },
    { value: 'ranking', label: t('Ranking') },
    ...(personalOn ? [{ value: 'acompanhar', label: t('Acompanhar'), icon: Users }] : []),
    ...(showGallery ? [{ value: 'fotos', label: t('Fotos'), icon: Images }] : []),
    // Aba "Admin" embutida só quando o console dedicado está desligado.
    ...(isAdmin && !adminConsoleOn ? [{ value: 'admin', label: t('Admin'), icon: ShieldCheck }] : []),
  ];

  return (
    <V2Page>
      <V2BackLink to="/torneios" className="mb-5">{t('Voltar aos torneios')}</V2BackLink>

      {tournament.archived && (
        <div className="mb-5 flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          <Archive className="mt-0.5 h-4 w-4 shrink-0" />
          <div className="flex-1">
            <p className="font-semibold">{t('Este torneio está arquivado.')}</p>
            <p className="mt-1 text-amber-800/80">
              {t('Saiu das listagens públicas. Você ainda consegue abrir essa página porque é o criador ou admin da plataforma.')}
              {isAdmin && t(' Use o painel Admin para desarquivar quando quiser reativar.')}
            </p>
          </div>
        </div>
      )}

      {isAdmin && isDraft && <div className="mb-5"><PublishTournamentBanner tournament={tournament} /></div>}

      <CompetitionHero
        icon={Trophy}
        title={tournament.name}
        description={tournament.description || t('Acompanhe modalidades, jogos, ranking e operação do evento.')}
        chips={(
          <>
            <span className={HERO_CHIP}>{TOURNAMENT_STATUS_LABELS[statusAgora] || statusAgora}</span>
            <span className={HERO_CHIP}>{TOURNAMENT_VISIBILITY_LABELS[tournament.visibility || TOURNAMENT_VISIBILITY.PRIVATE]}</span>
            {isAdmin && <HeroAdminChip />}
            <TournamentSanctionBadge tournament={tournament} />
            <ClubTournamentBadge tournament={tournament} />
          </>
        )}
        facts={[
          { icon: MapPin, label: t('Local'), value: location },
          { icon: Calendar, label: t('Datas'), value: dateRange || t('A definir') },
          { icon: Hash, label: t('Inscrições até'), value: deadline || t('A definir') },
        ]}
        note={<RegistrationWindowNote tournament={tournament} className="mt-4 text-sm leading-6 text-gray-300" />}
        actions={(
          <>
            {adminConsoleOn && isAdmin && (
              <Link to={`/torneios/${tournament.id}/gerenciar`} data-dica="torneio-gerenciar" className={HERO_ACTION_PRIMARY}>
                <ShieldCheck className="h-4 w-4" /> {t('Gerenciar torneio')}
              </Link>
            )}
            {tournament.invite_code && (
              <button type="button" onClick={() => copy(tournament.invite_code, t('Código copiado!'))} className={HERO_ACTION}>
                {copied ? <Check className="h-4 w-4 text-acid" /> : <Copy className="h-4 w-4" />} {t('Código:')} <strong>{tournament.invite_code}</strong>
              </button>
            )}
            {isPublic && !isDraft && (
              <button type="button" onClick={() => copy(publicUrl, t('Link público copiado!'))} className={HERO_ACTION}>
                <Share2 className="h-4 w-4" /> {t('Compartilhar link')}
              </button>
            )}
            <a href={`/p/${tournament.id}`} target="_blank" rel="noopener noreferrer" className={HERO_ACTION}>
              <Eye className="h-4 w-4" /> {t('Visão pública')}
            </a>
            {tvModeOn && (
              <a href={`/torneios/${tournament.id}/telao`} target="_blank" rel="noopener noreferrer" className={HERO_ACTION}>
                <MonitorPlay className="h-4 w-4" /> {t('Telão')}
              </a>
            )}
            {calendarExportOn && toDateSafe(tournament.starts_at) && (
              <button type="button" onClick={downloadTournamentIcs} className={HERO_ACTION}>
                <CalendarPlus className="h-4 w-4" /> {t('Adicionar ao calendário')}
              </button>
            )}
          </>
        )}
      />

      <TournamentIntegrityNotice tournament={tournament} className="mt-6" />

      {/* Modalities */}
      {modalities.length > 0 && (
        <div className="mt-6 flex flex-wrap gap-2">
          {modalities.map((m) => (
            <Link key={m.id} to={`/torneios/${tournamentId}/modalidades/${m.id}`}>
              <V2Badge tone="neutral">
                {m.name} · {MODALITY_FORMAT_LABELS[m.format] || m.format}{m.skill_level ? ` · ${SKILL_LEVEL_LABELS[m.skill_level] || m.skill_level}` : ''}
              </V2Badge>
            </Link>
          ))}
        </div>
      )}

      <TournamentRefereeCrew tournament={tournament} className="mt-6" />

      {personalOn && eu && activeTab !== 'minha-participacao' && (
        <MyNextMatchStrip tournament={tournament} onOpen={() => goTab('minha-participacao')} />
      )}

      <CompetitionTabs tabs={tabs} active={activeTab} onSelect={goTab} ariaLabel={t('Abas do torneio')} dica="torneio-abas" className="mt-6" />

      <div className="mt-6">
        {activeTab === 'visao-geral' && <V2TournamentOverview tournament={tournament} isAdmin={isAdmin} />}
        {activeTab === 'jogos' && <V2TournamentMatches tournament={tournament} />}
        {activeTab === 'ranking' && <V2TournamentRanking tournament={tournament} />}
        {activeTab === 'minha-participacao' && <V2MyParticipation tournament={tournament} onGoOverview={() => goTab('visao-geral')} />}
        {activeTab === 'acompanhar' && <V2FollowPlayers tournament={tournament} />}
        {activeTab === 'fotos' && showGallery && <V2TournamentGallery tournamentId={tournament.id} canManage={!!isAdmin} />}
        {activeTab === 'admin' && isAdmin && !adminConsoleOn && <V2TournamentAdminPanel tournament={tournament} />}
      </div>

      {!showGallery && <div className="mt-6"><V2TournamentGallery tournamentId={tournament.id} canManage={!!isAdmin} /></div>}
    </V2Page>
  );
}
