import React, { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Calendar,
  Clock,
  MapPin,
  Wallet,
  Trophy,
  Info,
  Plus,
  Award,
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

  return (
    <div className="space-y-4">
      <div className="grid md:grid-cols-2 gap-4">
        <Card>
          <CardContent className="p-5 space-y-3">
            <h3 className="font-semibold text-slate-900 flex items-center gap-2">
              <Trophy className="w-4 h-4 text-emerald-600" /> Informações do torneio
            </h3>
            {(startsAt || endsAt) && (
              <p className="text-sm text-slate-700 flex items-center gap-2">
                <Calendar className="w-4 h-4 text-slate-500" />
                <span>
                  <strong>Data:</strong>{' '}
                  {startsAt && endsAt
                    ? startsAt === endsAt ? startsAt : `${startsAt} a ${endsAt}`
                    : startsAt || endsAt}
                </span>
              </p>
            )}
            {deadline && (
              <p className="text-sm text-slate-700 flex items-center gap-2">
                <Clock className="w-4 h-4 text-slate-500" />
                <span><strong>Inscrições até:</strong> {deadline}</span>
              </p>
            )}
            {tournament.venue && (
              <p className="text-sm text-slate-700 flex items-center gap-2">
                <MapPin className="w-4 h-4 text-slate-500" />
                <span><strong>Local:</strong> {tournament.venue}</span>
              </p>
            )}
            <div className="border-t pt-3 space-y-1">
              <p className="text-sm text-slate-700">
                <strong>Regras:</strong> {RULESET_LABELS[tournament.scoring?.ruleset || tournament.ruleset] || '—'}
              </p>
              <p className="text-sm text-slate-700">
                <strong>Pontos por game:</strong> {tournament.scoring?.target_score} (vantagem de 2)
              </p>
              <p className="text-sm text-slate-700">
                <strong>Sets por partida:</strong> {tournament.scoring?.sets_per_match}
              </p>
            </div>
            {tournament.description && (
              <p className="text-sm text-slate-600 border-t pt-3 whitespace-pre-line">{tournament.description}</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-5 space-y-2">
            <h3 className="font-semibold text-slate-900 flex items-center gap-2">
              <Award className="w-4 h-4 text-emerald-600" /> Como funciona a classificação
            </h3>
            <p className="text-sm text-slate-700">
              A posição no ranking é dada pelo <strong>número de vitórias</strong>. Em caso de empate
              valem, nesta ordem:
            </p>
            <ol className="text-sm text-slate-700 list-decimal pl-5 space-y-1">
              <li><strong>Saldo de pontos</strong> (pontos a favor − pontos sofridos)</li>
              <li><strong>Maior número de pontos marcados</strong></li>
              <li><strong>Menor número de pontos sofridos</strong></li>
            </ol>
            <p className="text-xs text-slate-500 pt-1">
              Esse critério vale para todas as modalidades do torneio.
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <h3 className="font-semibold text-slate-900 flex items-center gap-2">
            <Trophy className="w-4 h-4 text-emerald-600" />
            Modalidades ({modalities.length})
          </h3>
          {!isPublic && !hasPrivateAccess && !isAdmin && (
            <p className="text-xs text-slate-500">
              Torneio privado — para se inscrever utilize o código recebido em
              <strong> Ingressar com código</strong>.
            </p>
          )}
        </div>

        {modalities.length === 0 ? (
          <Card>
            <CardContent className="p-6 text-sm text-slate-500 text-center">
              {isAdmin
                ? 'Vá em "Admin" para criar a primeira modalidade.'
                : 'O admin ainda não cadastrou modalidades.'}
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
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
      </div>

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
  const barTone = slotsFull
    ? 'bg-amber-500'
    : (pct ?? 0) >= 80
      ? 'bg-amber-400'
      : 'bg-emerald-500';

  return (
    <Card className={alreadyRegistered ? 'border-emerald-300 bg-emerald-50/30' : ''}>
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h4 className="font-semibold text-slate-900">{modality.name}</h4>
              {alreadyRegistered && (
                <Badge variant="success" className="text-[10px]">Você está inscrito</Badge>
              )}
            </div>
            <div className="text-xs text-slate-500 mt-1 flex flex-wrap gap-1">
              <Badge variant="secondary">{MODALITY_FORMAT_LABELS[modality.format]}</Badge>
              <Badge variant="secondary">{SKILL_LEVEL_LABELS[modality.skill_level]}</Badge>
              <Badge variant="secondary">{GENDER_CATEGORY_LABELS[modality.gender_category]}</Badge>
              <Badge variant="secondary">{AGE_CATEGORY_LABELS[modality.age_category]}</Badge>
              {stageType && (
                <Badge variant="secondary">{TOURNAMENT_STAGE_TYPE_LABELS[stageType]}</Badge>
              )}
            </div>
            <div className="mt-3 max-w-md">
              <div className="flex items-center justify-between text-xs text-slate-600 mb-1">
                <span>
                  {hasUnlimitedEntries(modality.max_entries) ? (
                    <>
                      <strong>{confirmed}</strong> inscritos · vagas abertas
                    </>
                  ) : (
                    <>
                      <strong>{confirmed}</strong> / {modality.max_entries} inscritos
                    </>
                  )}
                </span>
                <span className="inline-flex items-center gap-1">
                  <Wallet className="w-3 h-3" />
                  {fee > 0 ? formatBRL(fee) : 'Gratuita'}
                </span>
              </div>
              {pct !== null ? (
                <div className="h-1.5 w-full rounded-full bg-slate-200 overflow-hidden">
                  <div
                    className={`h-full ${barTone} transition-all duration-300`}
                    style={{ width: `${pct}%` }}
                    role="progressbar"
                    aria-valuenow={confirmed}
                    aria-valuemin={0}
                    aria-valuemax={modality.max_entries}
                  />
                </div>
              ) : (
                <div className="rounded-md border border-dashed border-emerald-300 bg-emerald-50 px-2 py-1 text-[11px] text-emerald-900">
                  Vagas abertas — o sorteio vai considerar o total confirmado no encerramento das inscrições.
                </div>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <Button variant="outline" size="sm" onClick={onInfo}>
              <Info className="w-4 h-4 mr-1" /> Informações
            </Button>
            {alreadyRegistered ? (
              <Badge variant="success">Inscrito</Badge>
            ) : canRegister ? (
              <Button size="sm" onClick={onRegister} disabled={slotsFull}>
                <Plus className="w-4 h-4 mr-1" />
                {slotsFull ? 'Modalidade lotada' : isAdmin ? 'Inscrever jogador' : 'Inscrever-se'}
              </Button>
            ) : (
              <Badge variant="secondary">Privado: exige código</Badge>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
