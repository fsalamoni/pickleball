import React, { useState } from 'react';
import { useParams, Navigate, Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, Trophy, Plus, Info, Users } from 'lucide-react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { AvatarGroup } from '@/components/ui/user-avatar';
import { useAuth } from '@/core/lib/FirebaseAuthContext';
import { useFeatureFlag } from '@/core/lib/FeatureFlagsContext';
import { FEATURE_FLAG } from '@/core/featureFlags';
import {
  useTournament,
  useIsTournamentAdmin,
  useModalities,
  useRegistrations,
} from '@/modules/tournament/hooks/useTournament';
import {
  MODALITY_FORMAT_LABELS,
  SKILL_LEVEL_LABELS,
  GENDER_CATEGORY_LABELS,
  AGE_CATEGORY_LABELS,
  REGISTRATION_STATUS,
  TOURNAMENT_VISIBILITY,
} from '@/modules/tournament/domain/constants';
import {
  countOccupiedRegistrations,
  isRegistrationCapacityReached,
} from '@/modules/tournament/domain/capacity';
import ModalityInfoContent from '../components/ModalityInfoContent';
import ModalityRegistrationDialog from '../components/ModalityRegistrationDialog';
import ModalityGallery from '../components/ModalityGallery';
import { ModalityMatchesBlock } from '../components/TournamentMatchesTab';
import { ModalityRankingBlock } from '../components/TournamentRankingTab';

function RegistrationTab({ tournament, modality, isAdmin, onRegister }) {
  const { data: registrations = [] } = useRegistrations(modality.id);
  const confirmed = registrations.filter((r) => r.status === REGISTRATION_STATUS.CONFIRMED);
  const hasPrivateAccess =
    typeof window !== 'undefined' && Boolean(sessionStorage.getItem(`tournament_access_${tournament.id}`));
  const isPublic = (tournament.visibility || TOURNAMENT_VISIBILITY.PRIVATE) === TOURNAMENT_VISIBILITY.PUBLIC;
  const canRegister = isAdmin || isPublic || hasPrivateAccess;
  const occupied = countOccupiedRegistrations(registrations);
  const slotsFull = isRegistrationCapacityReached(occupied, modality.max_entries);

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4">
          <div>
            <div className="text-sm font-semibold text-slate-800">Inscrição na modalidade</div>
            <p className="text-xs text-slate-500">
              {confirmed.length} inscrição(ões) confirmada(s)
              {!isPublic && !hasPrivateAccess && !isAdmin ? ' · torneio privado (use o código para liberar)' : ''}
            </p>
          </div>
          {canRegister ? (
            <Button onClick={onRegister} disabled={slotsFull && !isAdmin}>
              <Plus className="h-4 w-4" />
              <span className="ml-1">{slotsFull && !isAdmin ? 'Modalidade lotada' : isAdmin ? 'Inscrever jogador' : 'Inscrever-se'}</span>
            </Button>
          ) : (
            <Badge variant="secondary">Privado: exige código</Badge>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4">
          <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-800">
            <Users className="h-4 w-4 text-emerald-600" /> Inscritos confirmados
          </h3>
          {confirmed.length === 0 ? (
            <p className="text-sm text-slate-500">Ainda não há inscritos confirmados nesta modalidade.</p>
          ) : (
            <div className="space-y-2">
              {confirmed.map((r) => (
                <div key={r.id} className="flex items-center gap-2 rounded-md border border-slate-100 p-2">
                  <AvatarGroup
                    size="sm"
                    people={[
                      { name: r.player_a_name, photoUrl: r.player_a_photo },
                      ...(r.player_b_name ? [{ name: r.player_b_name, photoUrl: r.player_b_photo }] : []),
                    ]}
                  />
                  <span className="text-sm text-slate-700">{r.label || r.player_a_name}</span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default function ModalityPage() {
  const enabled = useFeatureFlag(FEATURE_FLAG.MODALITY_PAGES);
  const { tournamentId, modalityId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { data: tournament, isLoading } = useTournament(tournamentId);
  const { data: isAdmin } = useIsTournamentAdmin(tournamentId);
  const { data: modalities = [] } = useModalities(tournamentId);
  const [registerOpen, setRegisterOpen] = useState(false);

  if (!enabled) return <Navigate to={`/torneios/${tournamentId}/visao-geral`} replace />;

  if (isLoading) {
    return <div className="mx-auto max-w-4xl space-y-4"><Skeleton className="h-24" /><Skeleton className="h-64" /></div>;
  }

  const modality = modalities.find((m) => m.id === modalityId);
  if (!tournament || !modality) {
    return (
      <div className="mx-auto max-w-md p-6 text-center">
        <Trophy className="mx-auto h-10 w-10 text-slate-300" />
        <h2 className="mt-3 font-semibold">Modalidade não encontrada</h2>
        <Link to={`/torneios/${tournamentId}/visao-geral`} className="mt-1 inline-block text-sm text-emerald-700 underline">
          Voltar ao torneio
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl space-y-4">
      <Link to={`/torneios/${tournamentId}/visao-geral`} className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-800">
        <ArrowLeft className="h-4 w-4" /> {tournament.name}
      </Link>

      <Card>
        <CardContent className="flex flex-wrap items-start justify-between gap-3 p-5">
          <div className="min-w-0">
            <h1 className="flex items-center gap-2 text-2xl font-bold text-slate-900">
              <Trophy className="h-6 w-6 text-emerald-600" /> {modality.name}
            </h1>
            <div className="mt-2 flex flex-wrap gap-1.5">
              <Badge variant="secondary">{MODALITY_FORMAT_LABELS[modality.format]}</Badge>
              <Badge variant="secondary">{SKILL_LEVEL_LABELS[modality.skill_level]}</Badge>
              <Badge variant="secondary">{GENDER_CATEGORY_LABELS[modality.gender_category]}</Badge>
              <Badge variant="secondary">{AGE_CATEGORY_LABELS[modality.age_category]}</Badge>
            </div>
          </div>
          <Button onClick={() => setRegisterOpen(true)}>
            <Plus className="h-4 w-4" /> <span className="ml-1">Inscrever-se</span>
          </Button>
        </CardContent>
      </Card>

      <Tabs defaultValue="info">
        <div className="overflow-x-auto -mx-1 px-1">
          <TabsList className="inline-flex h-auto min-w-full justify-start gap-2 rounded-[1.25rem] bg-secondary/45 p-2 sm:min-w-0">
            <TabsTrigger value="info">Informações</TabsTrigger>
            <TabsTrigger value="inscricao">Inscrição</TabsTrigger>
            <TabsTrigger value="jogos">Jogos</TabsTrigger>
            <TabsTrigger value="ranking">Ranking</TabsTrigger>
            <TabsTrigger value="fotos">Fotos</TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="info" className="mt-4">
          <Card><CardContent className="p-5">
            <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-800"><Info className="h-4 w-4 text-emerald-600" /> Informações gerais</h2>
            <ModalityInfoContent
              modality={modality}
              tournament={tournament}
              registrationsCount={0}
            />
          </CardContent></Card>
        </TabsContent>

        <TabsContent value="inscricao" className="mt-4">
          <RegistrationTab tournament={tournament} modality={modality} isAdmin={!!isAdmin} onRegister={() => setRegisterOpen(true)} />
        </TabsContent>

        <TabsContent value="jogos" className="mt-4">
          <ModalityMatchesBlock tournament={tournament} modality={modality} isAdmin={false} />
        </TabsContent>

        <TabsContent value="ranking" className="mt-4">
          <ModalityRankingBlock modality={modality} />
        </TabsContent>

        <TabsContent value="fotos" className="mt-4">
          <ModalityGallery tournamentId={tournament.id} modalityId={modality.id} canManage={!!isAdmin} />
        </TabsContent>
      </Tabs>

      <ModalityRegistrationDialog
        modality={modality}
        tournament={tournament}
        isAdmin={!!isAdmin}
        open={registerOpen}
        onClose={() => setRegisterOpen(false)}
      />

      {isAdmin && (
        <p className="text-center text-xs text-slate-400">
          A administração (sorteio de grupos/jogos e resultados) continua na aba{' '}
          <button type="button" className="underline" onClick={() => navigate(`/torneios/${tournamentId}/admin`)}>Admin</button> do torneio.
        </p>
      )}
    </div>
  );
}
