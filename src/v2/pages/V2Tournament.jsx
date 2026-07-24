import React from 'react';
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom';
import {
  Archive, ArrowLeft, Calendar, CalendarPlus, Check, Copy, Eye, Hash, Images, MapPin, MonitorPlay, Share2, ShieldCheck, Trophy,
} from 'lucide-react';
import { buildICS, icsFilename } from '@/modules/tournament/domain/ics';
import { useClipboard } from '@/core/lib/useClipboard';
import { useFeatureFlag } from '@/core/lib/FeatureFlagsContext';
import { FEATURE_FLAG } from '@/core/featureFlags';
import { useTournament, useIsTournamentAdmin, useModalities } from '@/modules/tournament/hooks/useTournament';
import {
  MODALITY_FORMAT_LABELS,
  SKILL_LEVEL_LABELS,
  TOURNAMENT_STATUS_LABELS,
  TOURNAMENT_VISIBILITY,
  TOURNAMENT_VISIBILITY_LABELS,
} from '@/modules/tournament/domain/constants';
import V2TournamentAdminPanel from '@/v2/components/tournament/V2TournamentAdminPanel';
import { V2TournamentOverview } from '@/v2/components/tournament/V2OverviewBlock';
import { V2TournamentMatches } from '@/v2/components/tournament/V2MatchesBlock';
import { V2TournamentRanking } from '@/v2/components/tournament/V2RankingBlock';
import { V2TournamentGallery } from '@/v2/components/tournament/V2Gallery';
import { V2Badge, V2Button, V2EmptyState, V2Skeleton, V2Surface } from '@/v2/ui/primitives';
import { cn } from '@/core/lib/utils';

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
  return d ? d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' }) : null;
}

function formatDateRange(start, end) {
  const s = parseDate(start);
  const e = parseDate(end);
  if (!s && !e) return null;
  const fmt = (v) => v.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' });
  if (s && e) return s.toDateString() === e.toDateString() ? fmt(s) : `${fmt(s)} a ${fmt(e)}`;
  return fmt(s || e);
}

export default function V2Tournament() {
  const { tournamentId, tab = 'visao-geral' } = useParams();
  const navigate = useNavigate();
  const { data: tournament, isLoading } = useTournament(tournamentId);
  const { data: isAdmin } = useIsTournamentAdmin(tournamentId);
  const { data: modalities = [] } = useModalities(tournamentId);
  const modalityPagesOn = useFeatureFlag(FEATURE_FLAG.MODALITY_PAGES);
  const galleryOn = useFeatureFlag(FEATURE_FLAG.TOURNAMENT_GALLERY);
  const calendarExportOn = useFeatureFlag(FEATURE_FLAG.CALENDAR_EXPORT);
  const tvModeOn = useFeatureFlag(FEATURE_FLAG.TOURNAMENT_TV_MODE);
  const { copy, copied } = useClipboard();

  if (isLoading) {
    return (
      <div className="mx-auto max-w-[1200px] space-y-6">
        <V2Skeleton className="h-64 rounded-4xl" />
        <V2Skeleton className="h-96 rounded-4xl" />
      </div>
    );
  }

  if (!tournament) {
    return (
      <div className="mx-auto max-w-[700px]">
        <V2Surface>
          <V2EmptyState icon={Trophy} title="Torneio não encontrado"
            description="Verifique o link ou volte para a lista de torneios."
            action={<Link to="/torneios" className="rounded-full bg-ink px-6 py-3 text-sm font-bold text-white">Voltar aos torneios</Link>} />
        </V2Surface>
      </div>
    );
  }

  const showGallery = modalityPagesOn && galleryOn;
  const isPublic = (tournament.visibility || TOURNAMENT_VISIBILITY.PRIVATE) === TOURNAMENT_VISIBILITY.PUBLIC;
  const publicUrl = typeof window !== 'undefined' ? `${window.location.origin}/p/${tournament.id}` : '';
  const dateRange = formatDateRange(tournament.starts_at, tournament.ends_at);
  const deadline = formatDate(tournament.registration_deadline);
  const location = tournament.city ? `${tournament.city}${tournament.state ? ` / ${tournament.state}` : ''}` : 'Local a definir';

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
      description: tournament.description || 'Torneio de pickleball',
      location: location !== 'Local a definir' ? location : '',
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

  const activeTab = ['visao-geral', 'jogos', 'ranking', 'fotos', 'admin'].includes(tab) ? tab : 'visao-geral';
  const goTab = (v) => navigate(`/torneios/${tournamentId}/${v}`);

  const tabs = [
    { value: 'visao-geral', label: 'Visão geral' },
    { value: 'jogos', label: 'Jogos' },
    { value: 'ranking', label: 'Ranking' },
    ...(showGallery ? [{ value: 'fotos', label: 'Fotos', icon: Images }] : []),
    ...(isAdmin ? [{ value: 'admin', label: 'Admin', icon: ShieldCheck }] : []),
  ];

  return (
    <div className="mx-auto max-w-[1200px]">
      <Link to="/torneios" className="mb-5 inline-flex items-center gap-1.5 text-sm font-semibold text-gray-500 hover:text-ink">
        <ArrowLeft className="h-4 w-4" /> Voltar aos torneios
      </Link>

      {tournament.archived && (
        <div className="mb-5 flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          <Archive className="mt-0.5 h-4 w-4 shrink-0" />
          <div className="flex-1">
            <p className="font-semibold">Este torneio está arquivado.</p>
            <p className="mt-1 text-amber-800/80">
              Saiu das listagens públicas. Você ainda consegue abrir essa página porque é o criador ou admin da plataforma.
              {isAdmin && ' Use o painel Admin para desarquivar quando quiser reativar.'}
            </p>
          </div>
        </div>
      )}

      {/* Hero */}
      <div className="relative overflow-hidden rounded-4xl bg-mesh p-8 shadow-organic">
        <div className="absolute -right-10 -top-10 h-64 w-64 rounded-full bg-acid opacity-20 blur-[80px]" />
        <div className="relative z-10">
          <div className="flex flex-wrap items-start gap-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white/10 text-white backdrop-blur-sm"><Trophy className="h-6 w-6" /></div>
            <div className="min-w-0 flex-1">
              <h1 className="font-display text-3xl font-bold text-white sm:text-4xl">{tournament.name}</h1>
              <p className="mt-2 max-w-2xl text-sm leading-7 text-gray-300">{tournament.description || 'Acompanhe modalidades, jogos, ranking e operação do evento.'}</p>
            </div>
          </div>

          <div className="mt-6 flex flex-wrap items-center gap-2">
            <span className="rounded-full border border-white/10 bg-white/10 px-3 py-1 text-xs font-bold text-white">{TOURNAMENT_STATUS_LABELS[tournament.status] || tournament.status}</span>
            <span className="rounded-full border border-white/10 bg-white/10 px-3 py-1 text-xs font-bold text-white">{TOURNAMENT_VISIBILITY_LABELS[tournament.visibility || TOURNAMENT_VISIBILITY.PRIVATE]}</span>
            {isAdmin && <span className="rounded-full bg-acid px-3 py-1 text-xs font-bold text-ink"><ShieldCheck className="mr-1 inline h-3 w-3" /> Admin</span>}
          </div>

          <div className="mt-6 grid gap-3 sm:grid-cols-3">
            <HeroFact icon={MapPin} label="Local" value={location} />
            <HeroFact icon={Calendar} label="Datas" value={dateRange || 'A definir'} />
            <HeroFact icon={Hash} label="Inscrições até" value={deadline || 'A definir'} />
          </div>

          <div className="mt-6 flex flex-wrap gap-2">
            {tournament.invite_code && (
              <button onClick={() => copy(tournament.invite_code, 'Código copiado!')} className="btn-press inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-4 py-2 text-sm font-semibold text-white">
                {copied ? <Check className="h-4 w-4 text-acid" /> : <Copy className="h-4 w-4" />} Código: <strong>{tournament.invite_code}</strong>
              </button>
            )}
            {isPublic && (
              <button onClick={() => copy(publicUrl, 'Link público copiado!')} className="btn-press inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-4 py-2 text-sm font-semibold text-white">
                <Share2 className="h-4 w-4" /> Compartilhar link
              </button>
            )}
            <a href={`/p/${tournament.id}`} target="_blank" rel="noreferrer" className="btn-press inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-4 py-2 text-sm font-semibold text-white">
              <Eye className="h-4 w-4" /> Visão pública
            </a>
            {tvModeOn && (
              <a href={`/torneios/${tournament.id}/telao`} target="_blank" rel="noreferrer" className="btn-press inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-4 py-2 text-sm font-semibold text-white">
                <MonitorPlay className="h-4 w-4" /> Telão
              </a>
            )}
            {calendarExportOn && toDateSafe(tournament.starts_at) && (
              <button onClick={downloadTournamentIcs} className="btn-press inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-4 py-2 text-sm font-semibold text-white">
                <CalendarPlus className="h-4 w-4" /> Adicionar ao calendário
              </button>
            )}
          </div>
        </div>
      </div>

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

      {/* Tabs */}
      <div className="mt-6 inline-flex flex-wrap gap-1.5 rounded-full border border-gray-100 bg-paper-pure p-1.5 shadow-sm">
        {tabs.map((t) => {
          const Icon = t.icon;
          return (
            <button key={t.value} onClick={() => goTab(t.value)}
              className={cn('inline-flex items-center gap-1.5 rounded-full px-5 py-2.5 text-sm font-semibold transition-colors',
                activeTab === t.value ? 'bg-ink text-white shadow-md' : 'text-gray-500 hover:text-ink')}>
              {Icon && <Icon className="h-4 w-4" />} {t.label}
            </button>
          );
        })}
      </div>

      <div className="mt-6">
        {activeTab === 'visao-geral' && <V2TournamentOverview tournament={tournament} isAdmin={isAdmin} />}
        {activeTab === 'jogos' && <V2TournamentMatches tournament={tournament} />}
        {activeTab === 'ranking' && <V2TournamentRanking tournament={tournament} />}
        {activeTab === 'fotos' && showGallery && <V2TournamentGallery tournamentId={tournament.id} canManage={!!isAdmin} />}
        {activeTab === 'admin' && isAdmin && <V2TournamentAdminPanel tournament={tournament} />}
      </div>

      {!showGallery && <div className="mt-6"><V2TournamentGallery tournamentId={tournament.id} canManage={!!isAdmin} /></div>}
    </div>
  );
}

function HeroFact({ icon: Icon, label, value }) {
  return (
    <div className="rounded-2.5xl border border-white/10 bg-white/10 p-4 backdrop-blur-sm">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[11px] font-bold uppercase tracking-widest text-white/60">{label}</span>
        <Icon className="h-4 w-4 text-white/70" />
      </div>
      <p className="mt-2 text-sm font-medium text-white">{value}</p>
    </div>
  );
}
