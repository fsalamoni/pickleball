import React from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Trophy,
  MapPin,
  Calendar,
  Hash,
  ShieldAlert,
  Copy,
  Check,
  Share2,
  Eye,
} from 'lucide-react';
import { useTournament, useIsTournamentAdmin } from '@/modules/tournament/hooks/useTournament';
import {
  TOURNAMENT_STATUS,
  TOURNAMENT_STATUS_LABELS,
  TOURNAMENT_VISIBILITY,
  TOURNAMENT_VISIBILITY_LABELS,
} from '@/modules/tournament/domain/constants';
import { useClipboard } from '@/core/lib/useClipboard';
import TournamentOverviewTab from '../components/TournamentOverviewTab';
import TournamentMatchesTab from '../components/TournamentMatchesTab';
import TournamentRankingTab from '../components/TournamentRankingTab';
import TournamentAdminPanel from '../components/TournamentAdminPanel';

// Abas visíveis a qualquer participante. As inscrições e a lista de
// modalidades passaram a viver dentro da própria "Visão geral", com o botão
// de inscrição e o modal de informações em cada cartão de modalidade.
// Ações de gestão ficam exclusivamente na aba "Admin".
const PLAYER_TABS = [
  { value: 'visao-geral', label: 'Visão geral' },
  { value: 'jogos', label: 'Jogos' },
  { value: 'ranking', label: 'Ranking' },
];

// Abas obsoletas que ainda podem aparecer em links salvos. Redirecionamos
// para a nova home da modalidade (visão geral).
const LEGACY_PLAYER_TABS = new Set(['modalidades', 'inscritos']);

const STATUS_TONE = {
  [TOURNAMENT_STATUS.DRAFT]: 'bg-slate-100 text-slate-700 border-slate-200',
  [TOURNAMENT_STATUS.REGISTRATIONS_OPEN]: 'bg-emerald-100 text-emerald-800 border-emerald-200',
  [TOURNAMENT_STATUS.REGISTRATIONS_CLOSED]: 'bg-amber-100 text-amber-900 border-amber-200',
  [TOURNAMENT_STATUS.IN_PROGRESS]: 'bg-blue-100 text-blue-900 border-blue-200',
  [TOURNAMENT_STATUS.FINISHED]: 'bg-slate-200 text-slate-700 border-slate-300',
  [TOURNAMENT_STATUS.CANCELLED]: 'bg-red-100 text-red-800 border-red-200',
};

function StatusPill({ status }) {
  const tone = STATUS_TONE[status] || 'bg-slate-100 text-slate-700 border-slate-200';
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-xs font-medium ${tone}`}>
      <Calendar className="w-3 h-3" /> {TOURNAMENT_STATUS_LABELS[status] || status}
    </span>
  );
}

export default function Tournament() {
  const { tournamentId, tab = 'visao-geral' } = useParams();
  const navigate = useNavigate();
  const { data: tournament, isLoading } = useTournament(tournamentId);
  const { data: isAdmin } = useIsTournamentAdmin(tournamentId);
  const { copy, copied } = useClipboard();

  if (isLoading) {
    return (
      <div className="max-w-6xl mx-auto space-y-4">
        <Skeleton className="h-24" />
        <Skeleton className="h-72" />
      </div>
    );
  }

  if (!tournament) {
    return (
      <div className="max-w-md mx-auto">
        <Card>
          <CardContent className="p-6 text-center">
            <Trophy className="w-10 h-10 mx-auto text-slate-300" />
            <h2 className="mt-3 font-semibold">Torneio não encontrado</h2>
            <p className="text-sm text-slate-600 mt-1">
              Verifique o link ou volte para <Link to="/inicio" className="text-emerald-700 underline">seus torneios</Link>.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Redireciona automaticamente abas obsoletas (ex.: /sorteio) para a área correta.
  if (tab === 'sorteio') {
    navigate(`/torneios/${tournamentId}/${isAdmin ? 'admin' : 'jogos'}`, { replace: true });
    return null;
  }
  if (LEGACY_PLAYER_TABS.has(tab)) {
    navigate(`/torneios/${tournamentId}/visao-geral`, { replace: true });
    return null;
  }
  if (tab === 'admin' && !isAdmin) {
    navigate(`/torneios/${tournamentId}/visao-geral`, { replace: true });
    return null;
  }

  const isPublic = (tournament.visibility || TOURNAMENT_VISIBILITY.PRIVATE) === TOURNAMENT_VISIBILITY.PUBLIC;
  const publicUrl =
    typeof window !== 'undefined' ? `${window.location.origin}/p/${tournament.id}` : '';

  return (
    <div className="max-w-6xl mx-auto space-y-5">
      <Card>
        <CardContent className="p-5">
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div className="min-w-0 flex-1">
              <h1 className="text-2xl font-bold arena-heading flex items-center gap-2">
                <Trophy className="w-6 h-6 text-emerald-600" /> {tournament.name}
              </h1>
              {tournament.description && (
                <p className="text-sm text-slate-600 mt-1">{tournament.description}</p>
              )}
              <div className="mt-3 flex items-center gap-2 text-xs text-slate-600 flex-wrap">
                {tournament.city && (
                  <span className="inline-flex items-center gap-1">
                    <MapPin className="w-3 h-3" /> {tournament.city}
                    {tournament.state ? ` / ${tournament.state}` : ''}
                  </span>
                )}
                <StatusPill status={tournament.status} />
                <Badge variant="secondary" className="text-xs">
                  {TOURNAMENT_VISIBILITY_LABELS[tournament.visibility || TOURNAMENT_VISIBILITY.PRIVATE]}
                </Badge>
              </div>
            </div>
            <div className="flex flex-col items-end gap-2">
              {isAdmin && <Badge variant="success">Admin do torneio</Badge>}
            </div>
          </div>

          <div className="mt-4 flex items-center gap-2 flex-wrap border-t pt-3">
            {tournament.invite_code && (
              <Button
                variant="outline"
                size="sm"
                title="Copiar código de convite"
                onClick={() => copy(tournament.invite_code, 'Código copiado para a área de transferência.')}
              >
                {copied ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
                <span className="ml-1">
                  Código: <strong className="tabular-nums">{tournament.invite_code}</strong>
                </span>
              </Button>
            )}
            {isPublic && (
              <Button
                variant="outline"
                size="sm"
                title="Copiar link público para espectadores"
                onClick={() => copy(publicUrl, 'Link público copiado!')}
              >
                <Share2 className="w-4 h-4" />
                <span className="ml-1">Compartilhar link público</span>
              </Button>
            )}
            <Button asChild variant="ghost" size="sm">
              <Link to={`/p/${tournament.id}`} target="_blank" rel="noreferrer">
                <Eye className="w-4 h-4 mr-1" /> Visão pública
              </Link>
            </Button>
          </div>
        </CardContent>
      </Card>

      <Tabs
        value={tab}
        onValueChange={(v) => navigate(`/torneios/${tournamentId}/${v}`)}
        className="w-full"
      >
        <div className="overflow-x-auto -mx-2 px-2 sm:mx-0 sm:px-0">
          <TabsList className="inline-flex h-auto whitespace-nowrap">
            {PLAYER_TABS.map((t) => (
              <TabsTrigger key={t.value} value={t.value}>{t.label}</TabsTrigger>
            ))}
            {isAdmin && (
              <TabsTrigger
                value="admin"
                // Destaque visual claro de que é área administrativa.
                className="bg-amber-200/70 text-amber-950 hover:bg-amber-200 data-[state=active]:bg-amber-500 data-[state=active]:text-white data-[state=active]:shadow-sm ml-1"
              >
                <ShieldAlert className="w-4 h-4 mr-1" /> Admin
              </TabsTrigger>
            )}
          </TabsList>
        </div>

        {/* Visualização do jogador — admins veem exatamente o mesmo conteúdo aqui.
            Todas as ações de gestão ficam isoladas na aba "Admin". As
            modalidades (com inscrição e informações) ficam dentro da visão
            geral. */}
        <TabsContent value="visao-geral" className="mt-4">
          <TournamentOverviewTab tournament={tournament} isAdmin={isAdmin} />
        </TabsContent>
        <TabsContent value="jogos" className="mt-4">
          <TournamentMatchesTab tournament={tournament} isAdmin={false} />
        </TabsContent>
        <TabsContent value="ranking" className="mt-4">
          <TournamentRankingTab tournament={tournament} />
        </TabsContent>

        {isAdmin && (
          <TabsContent value="admin" className="mt-4">
            <TournamentAdminPanel tournament={tournament} />
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}
