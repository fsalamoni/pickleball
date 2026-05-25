import React from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Trophy, MapPin, Calendar, Hash } from 'lucide-react';
import { useTournament, useIsTournamentAdmin } from '@/modules/tournament/hooks/useTournament';
import { TOURNAMENT_STATUS_LABELS } from '@/modules/tournament/domain/constants';
import TournamentOverviewTab from '../components/TournamentOverviewTab';
import TournamentModalitiesTab from '../components/TournamentModalitiesTab';
import TournamentRegistrationsTab from '../components/TournamentRegistrationsTab';
import TournamentDrawTab from '../components/TournamentDrawTab';
import TournamentMatchesTab from '../components/TournamentMatchesTab';
import TournamentRankingTab from '../components/TournamentRankingTab';
import TournamentAdminTab from '../components/TournamentAdminTab';

const TABS = [
  { value: 'visao-geral', label: 'Visão geral' },
  { value: 'modalidades', label: 'Modalidades' },
  { value: 'inscritos', label: 'Inscritos' },
  { value: 'sorteio', label: 'Sorteio' },
  { value: 'jogos', label: 'Jogos' },
  { value: 'ranking', label: 'Ranking' },
  { value: 'admin', label: 'Admin', adminOnly: true },
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

  const availableTabs = TABS.filter((t) => !t.adminOnly || isAdmin);

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
          {availableTabs.map((t) => (
            <TabsTrigger key={t.value} value={t.value}>{t.label}</TabsTrigger>
          ))}
        </TabsList>
        <TabsContent value="visao-geral" className="mt-4">
          <TournamentOverviewTab tournament={tournament} isAdmin={isAdmin} />
        </TabsContent>
        <TabsContent value="modalidades" className="mt-4">
          <TournamentModalitiesTab tournament={tournament} isAdmin={isAdmin} />
        </TabsContent>
        <TabsContent value="inscritos" className="mt-4">
          <TournamentRegistrationsTab tournament={tournament} isAdmin={isAdmin} />
        </TabsContent>
        <TabsContent value="sorteio" className="mt-4">
          <TournamentDrawTab tournament={tournament} isAdmin={isAdmin} />
        </TabsContent>
        <TabsContent value="jogos" className="mt-4">
          <TournamentMatchesTab tournament={tournament} isAdmin={isAdmin} />
        </TabsContent>
        <TabsContent value="ranking" className="mt-4">
          <TournamentRankingTab tournament={tournament} />
        </TabsContent>
        {isAdmin && (
          <TabsContent value="admin" className="mt-4">
            <TournamentAdminTab tournament={tournament} />
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}
