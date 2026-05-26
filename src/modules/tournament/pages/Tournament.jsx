import React from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Trophy, MapPin, Calendar, Hash, ShieldAlert } from 'lucide-react';
import { useTournament, useIsTournamentAdmin } from '@/modules/tournament/hooks/useTournament';
import {
  TOURNAMENT_STATUS_LABELS,
  TOURNAMENT_VISIBILITY,
  TOURNAMENT_VISIBILITY_LABELS,
} from '@/modules/tournament/domain/constants';
import TournamentOverviewTab from '../components/TournamentOverviewTab';
import TournamentModalitiesTab from '../components/TournamentModalitiesTab';
import TournamentRegistrationsTab from '../components/TournamentRegistrationsTab';
import TournamentMatchesTab from '../components/TournamentMatchesTab';
import TournamentRankingTab from '../components/TournamentRankingTab';
import TournamentAdminPanel from '../components/TournamentAdminPanel';

// Abas visíveis a qualquer participante (admins veem o MESMO conteúdo de
// jogador nestas abas — ações de gestão ficam exclusivamente na aba "Admin").
const PLAYER_TABS = [
  { value: 'visao-geral', label: 'Visão geral' },
  { value: 'modalidades', label: 'Modalidades' },
  { value: 'inscritos', label: 'Inscritos' },
  { value: 'jogos', label: 'Jogos' },
  { value: 'ranking', label: 'Ranking' },
];

export default function Tournament() {
  const { tournamentId, tab = 'visao-geral' } = useParams();
  const navigate = useNavigate();
  const { data: tournament, isLoading } = useTournament(tournamentId);
  const { data: isAdmin } = useIsTournamentAdmin(tournamentId);

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
  if (tab === 'admin' && !isAdmin) {
    navigate(`/torneios/${tournamentId}/visao-geral`, { replace: true });
    return null;
  }

  return (
    <div className="max-w-6xl mx-auto space-y-5">
      <Card>
        <CardContent className="p-5">
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div>
              <h1 className="text-2xl font-bold arena-heading flex items-center gap-2">
                <Trophy className="w-6 h-6 text-emerald-600" /> {tournament.name}
              </h1>
              {tournament.description && (
                <p className="text-sm text-slate-600 mt-1">{tournament.description}</p>
              )}
              <div className="mt-3 flex items-center gap-3 text-xs text-slate-600 flex-wrap">
                {tournament.city && (
                  <span className="inline-flex items-center gap-1">
                    <MapPin className="w-3 h-3" /> {tournament.city}
                    {tournament.state ? ` / ${tournament.state}` : ''}
                  </span>
                )}
                {tournament.invite_code && (
                  <span className="inline-flex items-center gap-1">
                    <Hash className="w-3 h-3" /> Código: <strong>{tournament.invite_code}</strong>
                  </span>
                )}
                <span className="inline-flex items-center gap-1">
                  <Calendar className="w-3 h-3" /> {TOURNAMENT_STATUS_LABELS[tournament.status] || tournament.status}
                </span>
                <span>
                  {TOURNAMENT_VISIBILITY_LABELS[tournament.visibility || TOURNAMENT_VISIBILITY.PRIVATE]}
                </span>
              </div>
            </div>
            {isAdmin && <Badge variant="success">Admin do torneio</Badge>}
          </div>
        </CardContent>
      </Card>

      <Tabs
        value={tab}
        onValueChange={(v) => navigate(`/torneios/${tournamentId}/${v}`)}
        className="w-full"
      >
        <TabsList className="flex flex-wrap h-auto">
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

        {/* Visualização do jogador — admins veem exatamente o mesmo conteúdo aqui.
            Todas as ações de gestão ficam isoladas na aba "Admin". */}
        <TabsContent value="visao-geral" className="mt-4">
          <TournamentOverviewTab tournament={tournament} isAdmin={isAdmin} />
        </TabsContent>
        <TabsContent value="modalidades" className="mt-4">
          <TournamentModalitiesTab tournament={tournament} isAdmin={false} />
        </TabsContent>
        <TabsContent value="inscritos" className="mt-4">
          <TournamentRegistrationsTab tournament={tournament} isAdmin={false} />
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
