import React, { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Calendar,
  Clock,
  Globe,
  Info,
  MapPin,
  ShieldCheck,
  Trophy,
  Plus,
  Users,
  Wallet,
} from 'lucide-react';
import { useAuth } from '@/core/lib/FirebaseAuthContext';
import { useModalities, useRegistrationsByTournament } from '@/modules/tournament/hooks/useTournament';
import {
  MODALITY_FORMAT_LABELS,
  SKILL_LEVEL_LABELS,
  GENDER_CATEGORY_LABELS,
  AGE_CATEGORY_LABELS,
  RULESET_LABELS,
  TOURNAMENT_STAGE_TYPE_LABELS,
  REGISTRATION_STATUS,
  TOURNAMENT_VISIBILITY,
} from '@/modules/tournament/domain/constants';
import {
  countOccupiedRegistrations,
  getCapacityProgress,
  hasUnlimitedEntries,
  isRegistrationCapacityReached,
} from '@/modules/tournament/domain/capacity';
import ModalityInfoModal from './ModalityInfoModal';
import ModalityRegistrationDialog from './ModalityRegistrationDialog';
import { cn } from '@/core/lib/utils';

function formatDate(value) {
  if (!value) return null;
  try {
    const date = typeof value === 'string'
      ? new Date(`${value}T00:00:00`)
      : value?.toDate
        ? value.toDate()
        : new Date(value);
    if (Number.isNaN(date.getTime())) return null;
    return date.toLocaleDateString('pt-BR');
  } catch {
    return null;
  }
}

function formatBRL(cents) {
  const value = Number(cents || 0) / 100;
  return `R$ ${value.toFixed(2).replace('.', ',')}`;
}

export default function TournamentOverviewTab({ tournament, isAdmin }) {
  const { user } = useAuth();
  const { data: modalities = [] } = useModalities(tournament.id);
  const { data: registrations = [] } = useRegistrationsByTournament(tournament.id);
  const [infoModalityId, setInfoModalityId] = useState(null);
  const [registerModalityId, setRegisterModalityId] = useState(null);

  const confirmedByModality = (mid) =>
    registrations.filter((r) => r.modality_id === mid && r.status === REGISTRATION_STATUS.CONFIRMED).length;

  const startsAt = formatDate(tournament.starts_at);
  const endsAt = formatDate(tournament.ends_at);
  const deadline = formatDate(tournament.registration_deadline);

  const infoModality = modalities.find((m) => m.id === infoModalityId) || null;
  const registerModality = modalities.find((m) => m.id === registerModalityId) || null;

  const hasPrivateAccess =
    typeof window !== 'undefined' && Boolean(sessionStorage.getItem(`tournament_access_${tournament.id}`));
  const isPublic = (tournament.visibility || TOURNAMENT_VISIBILITY.PRIVATE) === TOURNAMENT_VISIBILITY.PUBLIC;
  const confirmedRegistrations = registrations.filter((r) => r.status === REGISTRATION_STATUS.CONFIRMED).length;
  const summaryCards = [
    {
      label: 'Modalidades',
      value: modalities.length,
      icon: Trophy,
    },
    {
      label: 'Inscrições confirmadas',
      value: confirmedRegistrations,
      icon: Users,
    },
    {
      label: 'Acesso',
      value: isPublic ? 'Público' : 'Privado',
      icon: isPublic ? Globe : ShieldCheck,
    },
  ];

  return (
    <div className="space-y-6">
      <Card className="rounded-[2rem] border-white/80 bg-white/82">
        <CardContent className="p-6 sm:p-7">
          <div className="grid gap-3 sm:grid-cols-3">
            {summaryCards.map(({ label, value, icon: Icon }) => (
              <div key={label} className="rounded-[1.35rem] border border-emerald-950/10 bg-secondary/35 p-4">
                <div className="flex items-center justify-between gap-3">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-emerald-700/75">{label}</div>
                  <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-700">
                    <Icon className="h-4.5 w-4.5" />
                  </div>
                </div>
                <div className="mt-3 text-xl font-semibold text-slate-950">{value}</div>
              </div>
            ))}
          </div>

          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            <InfoSurface
              icon={Calendar}
              title="Datas do torneio"
              description={startsAt || endsAt ? (startsAt && endsAt ? (startsAt === endsAt ? startsAt : `${startsAt} a ${endsAt}`) : startsAt || endsAt) : 'Período ainda não definido.'}
            />
            <InfoSurface
              icon={Clock}
              title="Inscrições até"
              description={deadline || 'Prazo ainda não definido pelo admin.'}
            />
            <InfoSurface
              icon={MapPin}
              title="Local da competição"
              description={tournament.venue || 'Quadra ou clube ainda não informado.'}
            />
            <InfoSurface
              icon={Trophy}
              title="Regras e pontuação"
              description={`${RULESET_LABELS[tournament.scoring?.ruleset || tournament.ruleset] || '—'} · ${tournament.scoring?.target_score} pontos · ${tournament.scoring?.sets_per_match} set(s)`}
            />
          </div>

          {tournament.description && (
            <div className="mt-6 rounded-[1.5rem] border border-emerald-950/10 bg-white/75 p-5 text-sm leading-7 text-slate-600">
              {tournament.description}
            </div>
          )}
        </CardContent>
      </Card>

      <section className="space-y-4">
        <div className="flex items-end justify-between gap-3 flex-wrap">
          <h3 className="text-2xl font-semibold text-slate-950">Modalidades</h3>
          {!isPublic && !hasPrivateAccess && !isAdmin && (
            <div className="rounded-full border border-amber-200 bg-amber-50 px-4 py-2 text-xs text-amber-900">
              Torneio privado: use o código recebido em <strong>Ingressar com código</strong> para liberar inscrições.
            </div>
          )}
        </div>

        {modalities.length === 0 ? (
          <Card className="rounded-[1.75rem] border-white/80 bg-white/82">
            <CardContent className="px-6 py-10 text-center text-sm text-slate-500">
              {isAdmin
                ? 'Vá em "Admin" para criar a primeira modalidade e abrir a experiência competitiva do torneio.'
                : 'O admin ainda não cadastrou modalidades para este torneio.'}
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 lg:grid-cols-2">
            {modalities.map((m) => (
              <ModalityCard
                key={m.id}
                modality={m}
                confirmed={confirmedByModality(m.id)}
                tournament={tournament}
                currentUserId={user?.uid}
                allRegistrations={registrations}
                isAdmin={isAdmin}
                onInfo={() => setInfoModalityId(m.id)}
                onRegister={() => setRegisterModalityId(m.id)}
              />
            ))}
          </div>
        )}
      </section>

      <ModalityInfoModal
        modality={infoModality}
        tournament={tournament}
        registrationsCount={infoModality ? confirmedByModality(infoModality.id) : 0}
        open={Boolean(infoModality)}
        onClose={() => setInfoModalityId(null)}
      />
      <ModalityRegistrationDialog
        modality={registerModality}
        tournament={tournament}
        isAdmin={isAdmin}
        open={Boolean(registerModality)}
        onClose={() => setRegisterModalityId(null)}
      />
    </div>
  );
}

function ModalityCard({
  modality,
  confirmed,
  tournament,
  currentUserId,
  allRegistrations,
  isAdmin,
  onInfo,
  onRegister,
}) {
  const fee = Number(modality.entry_fee_cents || 0);
  const stageType = modality.stages?.[0]?.type;
  const hasPrivateAccess =
    typeof window !== 'undefined' && Boolean(sessionStorage.getItem(`tournament_access_${tournament.id}`));
  const isPublic = (tournament.visibility || TOURNAMENT_VISIBILITY.PRIVATE) === TOURNAMENT_VISIBILITY.PUBLIC;
  const alreadyRegistered = allRegistrations.some(
    (r) =>
      r.modality_id === modality.id &&
      (r.user_id === currentUserId ||
        r.player_a_user_id === currentUserId ||
        r.player_b_user_id === currentUserId),
  );
  const canRegister = isAdmin || isPublic || hasPrivateAccess;
  const occupied = countOccupiedRegistrations(allRegistrations.filter((r) => r.modality_id === modality.id));
  const slotsFull = isRegistrationCapacityReached(occupied, modality.max_entries);
  const pct = getCapacityProgress(confirmed, modality.max_entries);
  const pendingRegistrations = Math.max(occupied - confirmed, 0);
  const barTone = slotsFull
    ? 'bg-amber-500'
    : (pct ?? 0) >= 80
      ? 'bg-amber-400'
      : 'bg-emerald-500';

  return (
    <Card
      className={cn(
        'match-surface h-full rounded-[1.75rem] border-white/80 bg-white/85',
        alreadyRegistered && 'border-emerald-300 bg-emerald-50/50 shadow-[0_20px_44px_-30px_rgba(5,150,105,0.45)]',
      )}
    >
      <CardContent className="flex h-full flex-col p-5 sm:p-6">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h4 className="text-xl font-semibold text-slate-950">{modality.name}</h4>
              {alreadyRegistered && (
                <Badge variant="success" className="rounded-full px-3 py-1 text-[10px] uppercase tracking-[0.14em] shadow-none">Você está inscrito</Badge>
              )}
            </div>
            <div className="mt-3 flex flex-wrap gap-1.5 text-xs text-slate-500">
              <Badge variant="secondary">{MODALITY_FORMAT_LABELS[modality.format]}</Badge>
              <Badge variant="secondary">{SKILL_LEVEL_LABELS[modality.skill_level]}</Badge>
              <Badge variant="secondary">{GENDER_CATEGORY_LABELS[modality.gender_category]}</Badge>
              <Badge variant="secondary">{AGE_CATEGORY_LABELS[modality.age_category]}</Badge>
              {stageType && <Badge variant="secondary">{TOURNAMENT_STAGE_TYPE_LABELS[stageType]}</Badge>}
            </div>
          </div>

          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-700">
            <Trophy className="h-4.5 w-4.5" />
          </div>
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          <div className="rounded-[1.25rem] border border-emerald-950/10 bg-white/80 p-4">
            <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-emerald-700/75">Capacidade</div>
            <div className="mt-2 text-sm font-medium text-slate-950">
              {hasUnlimitedEntries(modality.max_entries)
                ? `${confirmed} inscritos confirmados`
                : `${confirmed} / ${modality.max_entries} inscritos confirmados`}
            </div>
            <div className="mt-3">
              {pct !== null ? (
                <>
                  <div className="mb-1 flex items-center justify-between text-[11px] text-slate-600">
                    <span>{slotsFull ? 'Esgotada' : 'Ocupação'}</span>
                    <span>{pct}%</span>
                  </div>
                  <div className="h-2 w-full overflow-hidden rounded-full bg-slate-200">
                    <div
                      className={`h-full ${barTone} transition-all duration-300`}
                      style={{ width: `${pct}%` }}
                      role="progressbar"
                      aria-valuenow={confirmed}
                      aria-valuemin={0}
                      aria-valuemax={modality.max_entries}
                    />
                  </div>
                </>
              ) : (
                <div className="rounded-[1rem] border border-dashed border-emerald-300 bg-emerald-50 px-3 py-2 text-[11px] text-emerald-900">
                  Vagas abertas sem limite definido para esta modalidade.
                </div>
              )}
            </div>
          </div>

          <div className="rounded-[1.25rem] border border-emerald-950/10 bg-white/80 p-4">
            <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-emerald-700/75">Inscrição</div>
            <div className="mt-2 flex items-center gap-2 text-sm font-medium text-slate-950">
              <Wallet className="h-4 w-4 text-emerald-700" />
              {fee > 0 ? formatBRL(fee) : 'Gratuita'}
            </div>
            {pendingRegistrations > 0 && (
              <p className="mt-3 text-xs leading-5 text-slate-600">
                {pendingRegistrations} aguardando confirmação.
              </p>
            )}
          </div>
        </div>

        <div className="mt-auto pt-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <Button variant="outline" size="sm" onClick={onInfo}>
              <Info className="w-4 h-4 mr-1" /> Informações
            </Button>

            <div className="flex items-center gap-2 flex-wrap">
              {alreadyRegistered ? (
                <Badge variant="success" className="rounded-full px-3 py-1 shadow-none">Inscrito</Badge>
              ) : canRegister ? (
                <Button size="sm" onClick={onRegister} disabled={slotsFull}>
                  <Plus className="w-4 h-4 mr-1" />
                  {slotsFull ? 'Modalidade lotada' : isAdmin ? 'Inscrever jogador' : 'Inscrever-se'}
                </Button>
              ) : (
                <Badge variant="secondary" className="rounded-full px-3 py-1 shadow-none">Privado: exige código</Badge>
              )}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function InfoSurface({ icon: Icon, title, description }) {
  return (
    <div className="rounded-[1.35rem] border border-emerald-950/10 bg-white/75 p-4">
      <div className="flex items-center gap-2 text-sm font-semibold text-slate-950">
        <Icon className="h-4 w-4 text-emerald-700" /> {title}
      </div>
      <p className="mt-2 text-sm leading-6 text-slate-600">{description}</p>
    </div>
  );
}
