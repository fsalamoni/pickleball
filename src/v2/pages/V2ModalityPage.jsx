import React, { useState } from 'react';
import { Link, Navigate, useParams } from 'react-router-dom';
import { ArrowLeft, Calendar, Layers, Plus, ShieldCheck, Target, Trophy, Users, Wallet } from 'lucide-react';
import { useAuth } from '@/core/lib/FirebaseAuthContext';
import { useTournament, useIsTournamentAdmin, useModalities, useRegistrations } from '@/modules/tournament/hooks/useTournament';
import {
  MODALITY_FORMAT_LABELS, SKILL_LEVEL_LABELS, GENDER_CATEGORY_LABELS, AGE_CATEGORY_LABELS,
  REGISTRATION_STATUS, TOURNAMENT_VISIBILITY, TOURNAMENT_STAGE_TYPE_LABELS,
} from '@/modules/tournament/domain/constants';
import { countOccupiedRegistrations, isRegistrationCapacityReached, hasUnlimitedEntries } from '@/modules/tournament/domain/capacity';
import ModalityInfoContent from '@/modules/tournament/components/ModalityInfoContent';
import ModalityRegistrationDialog from '@/modules/tournament/components/ModalityRegistrationDialog';
import ModalityGallery from '@/modules/tournament/components/ModalityGallery';
import { ModalityMatchesBlock } from '@/modules/tournament/components/TournamentMatchesTab';
import { ModalityRankingBlock } from '@/modules/tournament/components/TournamentRankingTab';
import { AvatarGroup } from '@/components/ui/user-avatar';
import { V2Badge, V2Button, V2Skeleton, V2Surface } from '@/v2/ui/primitives';
import { cn } from '@/core/lib/utils';

function competitionLabel(modality) {
  const stages = Array.isArray(modality.stages) ? modality.stages : [];
  if (stages.length > 1) return `${stages.length} fases encadeadas`;
  return TOURNAMENT_STAGE_TYPE_LABELS[stages[0]?.type] || 'Formato competitivo definido';
}

function registerLabelFor({ alreadyRegistered, canRegister, slotsFull, isAdmin }) {
  if (alreadyRegistered) return 'Você já está inscrito';
  if (!canRegister) return 'Torneio privado: exige código';
  if (slotsFull && !isAdmin) return 'Modalidade lotada';
  return isAdmin ? 'Inscrever jogador' : 'Inscrever-se';
}

export default function V2ModalityPage() {
  const { tournamentId, modalityId } = useParams();
  const { user } = useAuth();
  const { data: tournament, isLoading: loadingT } = useTournament(tournamentId);
  const { data: isAdmin } = useIsTournamentAdmin(tournamentId);
  const { data: modalities = [], isLoading: loadingM } = useModalities(tournamentId);
  const { data: registrations = [] } = useRegistrations(modalityId);
  const [registerOpen, setRegisterOpen] = useState(false);
  const [tab, setTab] = useState('info');

  if (loadingT || loadingM) {
    return <div className="mx-auto max-w-[1200px] space-y-6"><V2Skeleton className="h-64 rounded-4xl" /><V2Skeleton className="h-96 rounded-4xl" /></div>;
  }

  const modality = modalities.find((m) => m.id === modalityId);
  if (!tournament || !modality) {
    return (
      <div className="mx-auto max-w-[700px]">
        <V2Surface className="text-center">
          <Trophy className="mx-auto h-10 w-10 text-gray-300" />
          <h2 className="mt-3 font-display text-lg font-bold text-ink">Modalidade não encontrada</h2>
          <Link to={`/v2/torneios/${tournamentId}`} className="mt-2 inline-block text-sm font-bold text-ink underline">Voltar ao torneio</Link>
        </V2Surface>
      </div>
    );
  }

  const confirmed = registrations.filter((r) => r.status === REGISTRATION_STATUS.CONFIRMED);
  const occupiedCount = countOccupiedRegistrations(registrations);
  const slotsFull = isRegistrationCapacityReached(occupiedCount, modality.max_entries);
  const hasPrivateAccess = typeof window !== 'undefined' && Boolean(sessionStorage.getItem(`tournament_access_${tournament.id}`));
  const isPublic = (tournament.visibility || TOURNAMENT_VISIBILITY.PRIVATE) === TOURNAMENT_VISIBILITY.PUBLIC;
  const canRegister = !!isAdmin || isPublic || hasPrivateAccess;
  const alreadyRegistered = registrations.some((r) => r.user_id === user?.uid || r.player_a_user_id === user?.uid || r.player_b_user_id === user?.uid);
  const registerLabel = registerLabelFor({ alreadyRegistered, canRegister, slotsFull, isAdmin: !!isAdmin });

  const badges = [
    MODALITY_FORMAT_LABELS[modality.format],
    SKILL_LEVEL_LABELS[modality.skill_level],
    GENDER_CATEGORY_LABELS[modality.gender_category],
    AGE_CATEGORY_LABELS[modality.age_category],
  ].filter(Boolean);

  const facts = [
    { icon: Layers, label: 'Formato', value: competitionLabel(modality) },
    { icon: Target, label: 'Perfil', value: SKILL_LEVEL_LABELS[modality.skill_level] },
    { icon: Users, label: 'Inscrições', value: hasUnlimitedEntries(modality.max_entries) ? `${confirmed.length} confirmadas` : `${occupiedCount}/${modality.max_entries} ocupadas` },
    { icon: Wallet, label: 'Taxa', value: Number(modality.entry_fee_cents || 0) > 0 ? `R$ ${(Number(modality.entry_fee_cents) / 100).toFixed(2).replace('.', ',')}` : 'Gratuita' },
  ];

  const tabs = [
    { value: 'info', label: 'Visão geral' },
    { value: 'inscricao', label: 'Inscrição' },
    { value: 'jogos', label: 'Jogos' },
    { value: 'ranking', label: 'Ranking' },
    { value: 'fotos', label: 'Fotos' },
  ];

  return (
    <div className="mx-auto max-w-[1200px]">
      <Link to={`/v2/torneios/${tournamentId}`} className="mb-5 inline-flex items-center gap-1.5 text-sm font-semibold text-gray-500 hover:text-ink">
        <ArrowLeft className="h-4 w-4" /> {tournament.name}
      </Link>

      {/* Hero */}
      <div className="relative overflow-hidden rounded-4xl bg-mesh p-8 shadow-organic">
        <div className="absolute -right-10 -top-10 h-56 w-56 rounded-full bg-acid opacity-20 blur-[80px]" />
        <div className="relative z-10">
          <span className="rounded-full border border-white/10 bg-white/10 px-3 py-1 text-xs font-bold uppercase tracking-wider text-acid">Modalidade do torneio</span>
          <div className="mt-4 flex flex-wrap items-start gap-3">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white/10 text-white backdrop-blur-sm"><Trophy className="h-6 w-6" /></div>
            <div className="min-w-0 flex-1">
              <h1 className="font-display text-3xl font-bold text-white sm:text-4xl">{modality.name}</h1>
              <div className="mt-3 flex flex-wrap gap-2">
                {badges.map((b) => <span key={b} className="rounded-full bg-white/15 px-3 py-1 text-xs font-bold text-white">{b}</span>)}
                {alreadyRegistered && <span className="rounded-full bg-acid px-3 py-1 text-xs font-bold text-ink"><ShieldCheck className="mr-1 inline h-3 w-3" /> Inscrito</span>}
              </div>
            </div>
          </div>

          <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {facts.map(({ icon: Icon, label, value }) => (
              <div key={label} className="rounded-2.5xl border border-white/10 bg-white/10 p-4 backdrop-blur-sm">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[11px] font-bold uppercase tracking-widest text-white/60">{label}</span>
                  <Icon className="h-4 w-4 text-white/70" />
                </div>
                <p className="mt-2 text-sm font-medium text-white">{value}</p>
              </div>
            ))}
          </div>

          <div className="mt-6 flex flex-wrap gap-2">
            <V2Button onClick={() => setRegisterOpen(true)} disabled={alreadyRegistered || !canRegister || (slotsFull && !isAdmin)}>
              <Plus className="h-4 w-4" /> {registerLabel}
            </V2Button>
            <V2Button asChild variant="ghost" className="border-white/20 bg-white/10 text-white hover:border-white/40">
              <Link to={`/v2/torneios/${tournamentId}/jogos`}>Ver jogos do torneio</Link>
            </V2Button>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="mt-6 overflow-x-auto">
        <div className="inline-flex gap-1.5 rounded-full border border-gray-100 bg-paper-pure p-1.5 shadow-sm">
          {tabs.map((t) => (
            <button key={t.value} onClick={() => setTab(t.value)}
              className={cn('whitespace-nowrap rounded-full px-5 py-2.5 text-sm font-semibold transition-colors', tab === t.value ? 'bg-ink text-white shadow-md' : 'text-gray-500 hover:text-ink')}>
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-6">
        {tab === 'info' && <V2Surface contentClassName="p-5 sm:p-6"><ModalityInfoContent modality={modality} tournament={tournament} registrationsCount={confirmed.length} /></V2Surface>}
        {tab === 'inscricao' && (
          <V2Surface>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="font-display text-base font-bold text-ink">Inscrição na modalidade</h3>
                <p className="mt-1 text-sm text-gray-500">{confirmed.length} inscrição(ões) confirmada(s){!isPublic && !hasPrivateAccess && !isAdmin ? ' · torneio privado (use o código)' : ''}</p>
              </div>
              {canRegister ? (
                <V2Button onClick={() => setRegisterOpen(true)} disabled={alreadyRegistered || (slotsFull && !isAdmin)}><Plus className="h-4 w-4" /> {registerLabel}</V2Button>
              ) : <V2Badge tone="neutral">Privado: exige código</V2Badge>}
            </div>
            <div className="mt-5">
              <h4 className="mb-3 flex items-center gap-2 text-sm font-bold text-ink"><Users className="h-4 w-4" /> Inscritos confirmados</h4>
              {confirmed.length === 0 ? (
                <p className="text-sm text-gray-500">Ainda não há inscritos confirmados nesta modalidade.</p>
              ) : (
                <div className="space-y-2">
                  {confirmed.map((r) => (
                    <div key={r.id} className="flex items-center gap-2 rounded-2xl border border-gray-100 bg-paper p-3">
                      <AvatarGroup size="sm" people={[{ name: r.player_a_name, photoUrl: r.player_a_photo }, ...(r.player_b_name ? [{ name: r.player_b_name, photoUrl: r.player_b_photo }] : [])]} />
                      <span className="text-sm text-ink">{r.label || r.player_a_name}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </V2Surface>
        )}
        {tab === 'jogos' && <ModalityMatchesBlock tournament={tournament} modality={modality} isAdmin={false} />}
        {tab === 'ranking' && <ModalityRankingBlock modality={modality} />}
        {tab === 'fotos' && <ModalityGallery tournamentId={tournament.id} modalityId={modality.id} canManage={!!isAdmin} />}
      </div>

      <ModalityRegistrationDialog modality={modality} tournament={tournament} isAdmin={!!isAdmin} open={registerOpen} onClose={() => setRegisterOpen(false)} />
    </div>
  );
}
