import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Calendar,
  Clock,
  Globe,
  Info,
  MapPin,
  ShieldCheck,
  Sparkles,
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
import ModalityInfoModal from '@/modules/tournament/components/ModalityInfoModal';
import ModalityRegistrationDialog from '@/modules/tournament/components/ModalityRegistrationDialog';
import PixPaymentDialog from '@/modules/tournament/components/PixPaymentDialog';
import { tournamentHasPixConfig } from '@/modules/tournament/domain/payment';
import {
  canRespondToPartnerInvite,
  partnerInviteBadge,
} from '@/modules/tournament/domain/partnerInvite';
import { useRespondPartnerInvite } from '@/modules/tournament/hooks/useTournament';
import { toast } from 'sonner';
import { useFeatureFlag } from '@/core/lib/FeatureFlagsContext';
import { FEATURE_FLAG } from '@/core/featureFlags';
import { V2Badge, V2Button, V2Surface } from '@/v2/ui/primitives';
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

function InfoSurface({ icon: Icon, title, description }) {
  return (
    <div className="rounded-3xl border border-white/10 bg-white/5 p-4 backdrop-blur-sm">
      <div className="flex items-center gap-2 text-sm font-bold text-white">
        <Icon className="h-4 w-4 text-acid" /> {title}
      </div>
      <p className="mt-2 text-sm leading-6 text-white/70">{description}</p>
    </div>
  );
}

function RankingRule({ order, title, description }) {
  return (
    <div className="rounded-3xl border border-white/10 bg-white/5 p-4">
      <div className="font-display text-xs font-bold uppercase tracking-widest text-acid">{order}</div>
      <div className="mt-2 font-display text-lg font-bold text-white">{title}</div>
      <p className="mt-1 text-sm leading-6 text-white/60">{description}</p>
    </div>
  );
}

function SummaryTile({ icon: Icon, label, value, description }) {
  return (
    <div className="rounded-3xl border border-white/10 bg-white/5 p-4 backdrop-blur-sm">
      <div className="flex items-center justify-between gap-3">
        <div className="text-[11px] font-bold uppercase tracking-widest text-white/50">{label}</div>
        <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-acid text-ink">
          <Icon className="h-4.5 w-4.5" />
        </div>
      </div>
      <div className="mt-3 font-display text-xl font-bold text-white">{value}</div>
      <p className="mt-1 text-xs leading-5 text-white/60">{description}</p>
    </div>
  );
}

export function V2TournamentOverview({ tournament, isAdmin }) {
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

  const datesText = startsAt || endsAt
    ? (startsAt && endsAt ? (startsAt === endsAt ? startsAt : `${startsAt} a ${endsAt}`) : startsAt || endsAt)
    : 'Período ainda não definido.';

  return (
    <div className="space-y-6">
      <section className="grid grid-cols-1 gap-4 xl:grid-cols-[1.1fr,0.9fr]">
        <V2Surface className="bg-mesh shadow-glow">
          <div className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/10 px-3 py-1 text-xs font-bold text-acid">
            <Sparkles className="h-3.5 w-3.5" /> Visão geral do evento
          </div>
          <h3 className="mt-5 font-display text-3xl font-bold text-white">Tudo o que atletas e organização precisam ler primeiro</h3>
          <p className="mt-3 max-w-2xl text-sm leading-7 text-white/70 sm:text-base">
            Datas, local, regra esportiva e contexto das modalidades do torneio.
          </p>

          <div className="mt-8 grid gap-3 sm:grid-cols-3">
            <SummaryTile icon={Trophy} label="Modalidades" value={modalities.length} description="frentes esportivas ativas neste torneio" />
            <SummaryTile icon={Users} label="Inscrições confirmadas" value={confirmedRegistrations} description="confirmadas no panorama atual do evento" />
            <SummaryTile
              icon={isPublic ? Globe : ShieldCheck}
              label="Acesso"
              value={isPublic ? 'Público' : 'Privado'}
              description={isPublic ? 'qualquer atleta pode explorar e seguir para inscrição' : 'exige código para liberar as modalidades'}
            />
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <InfoSurface icon={Calendar} title="Datas do torneio" description={datesText} />
            <InfoSurface icon={Clock} title="Inscrições até" description={deadline || 'Prazo ainda não definido pelo admin.'} />
            <InfoSurface icon={MapPin} title="Local da competição" description={tournament.venue || 'Quadra ou clube ainda não informado.'} />
            <InfoSurface
              icon={Trophy}
              title="Regras-base do torneio"
              description={`${RULESET_LABELS[tournament.scoring?.ruleset || tournament.ruleset] || '—'} · a pontuação é definida dentro de cada modalidade e fase`}
            />
          </div>

          {tournament.description && (
            <div className="mt-4 rounded-3xl border border-white/10 bg-white/5 p-5 text-sm leading-7 text-white/80 backdrop-blur-sm">
              {tournament.description}
            </div>
          )}
        </V2Surface>

        <div className="rounded-4xl bg-ink p-6 text-white shadow-organic sm:p-8">
          <div className="font-display text-xs font-bold uppercase tracking-widest text-acid">Critério de classificação</div>
          <h3 className="mt-4 font-display text-3xl font-bold leading-tight text-white">Como o ranking é calculado.</h3>
          <p className="mt-3 text-sm leading-7 text-white/60 sm:text-base">
            A plataforma usa o mesmo critério em todas as modalidades do torneio.
          </p>
          <div className="mt-6 space-y-3">
            <RankingRule order="01" title="Vitórias" description="A posição inicial no ranking sempre parte do número de vitórias." />
            <RankingRule order="02" title="Saldo de pontos" description="Empates são resolvidos primeiro pelo saldo entre pontos marcados e sofridos." />
            <RankingRule order="03" title="Pontos marcados e sofridos" description="Se o empate persistir, valem maior pontuação a favor e, por fim, menor pontuação contra." />
          </div>
        </div>
      </section>

      <section className="space-y-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <div className="font-display text-xs font-bold uppercase tracking-widest text-gray-400">Modalidades</div>
            <h3 className="mt-2 font-display text-2xl font-bold text-ink">Escolha onde jogar ou o que acompanhar</h3>
            <p className="mt-1 max-w-3xl text-sm leading-6 text-gray-500">
              Cada card mostra formato, nível, capacidade e ação disponível para cada modalidade.
            </p>
          </div>
          {!isPublic && !hasPrivateAccess && !isAdmin && (
            <div className="rounded-full border border-amber-200 bg-amber-50 px-4 py-2 text-xs text-amber-900">
              Torneio privado: use o código recebido em <strong>Ingressar com código</strong> para liberar inscrições.
            </div>
          )}
        </div>

        {modalities.length === 0 ? (
          <V2Surface className="text-center">
            <p className="py-6 text-sm text-gray-500">
              {isAdmin
                ? 'Vá em "Admin" para criar a primeira modalidade e abrir a experiência competitiva do torneio.'
                : 'O admin ainda não cadastrou modalidades para este torneio.'}
            </p>
          </V2Surface>
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

function ModalityCard({ modality, confirmed, tournament, currentUserId, allRegistrations, isAdmin, onInfo, onRegister }) {
  const fee = Number(modality.entry_fee_cents || 0);
  const stageCount = modality.stages?.length || 0;
  const stageType = modality.stages?.[0]?.type;
  const stageBadgeLabel = stageCount > 1 ? `${stageCount} fases` : (stageType ? TOURNAMENT_STAGE_TYPE_LABELS[stageType] : null);
  const hasPrivateAccess =
    typeof window !== 'undefined' && Boolean(sessionStorage.getItem(`tournament_access_${tournament.id}`));
  const isPublic = (tournament.visibility || TOURNAMENT_VISIBILITY.PRIVATE) === TOURNAMENT_VISIBILITY.PUBLIC;
  const alreadyRegistered = allRegistrations.some(
    (r) => r.modality_id === modality.id
      && (r.user_id === currentUserId || r.player_a_user_id === currentUserId || r.player_b_user_id === currentUserId),
  );
  const canRegister = isAdmin || isPublic || hasPrivateAccess;
  const modalityRegs = allRegistrations.filter((r) => r.modality_id === modality.id);
  const partnerInvitesOn = useFeatureFlag(FEATURE_FLAG.PARTNER_INVITES);
  const paymentOn = useFeatureFlag(FEATURE_FLAG.PAYMENT_INSTRUCTIONS);
  const respondMutation = useRespondPartnerInvite();
  const [payOpen, setPayOpen] = useState(false);
  // Convite de dupla endereçado a mim, ainda pendente (flag partner_invites).
  const inviteForMe = partnerInvitesOn
    ? modalityRegs.find((r) => canRespondToPartnerInvite(r, currentUserId)) || null
    : null;
  const myRegistration = modalityRegs.find(
    (r) => r.user_id === currentUserId || r.player_a_user_id === currentUserId || r.player_b_user_id === currentUserId,
  ) || null;
  const myInviteBadge = partnerInvitesOn && myRegistration ? partnerInviteBadge(myRegistration) : null;
  // Pagamento PIX da própria inscrição pendente (flag payment_instructions).
  const canPayOwn = Boolean(
    paymentOn
    && tournamentHasPixConfig(tournament)
    && myRegistration
    && myRegistration.status === REGISTRATION_STATUS.PENDING_PAYMENT
    && (myRegistration.created_by === currentUserId || myRegistration.player_a_user_id === currentUserId),
  );

  async function handleRespondInvite(accept) {
    if (!inviteForMe) return;
    try {
      await respondMutation.mutateAsync({ id: inviteForMe.id, accept });
      toast.success(accept ? 'Dupla confirmada! Boa sorte no torneio.' : 'Convite recusado.');
    } catch (err) {
      toast.error(err?.message || 'Não foi possível responder ao convite.');
    }
  }
  const occupied = countOccupiedRegistrations(modalityRegs);
  const slotsFull = isRegistrationCapacityReached(occupied, modality.max_entries);
  const waitlistOn = useFeatureFlag(FEATURE_FLAG.TOURNAMENT_WAITLIST);
  const canWaitlist = slotsFull && waitlistOn && !alreadyRegistered && !isAdmin;
  const modalityPagesOn = useFeatureFlag(FEATURE_FLAG.MODALITY_PAGES);
  const modalityHref = `/torneios/${tournament.id}/modalidades/${modality.id}`;
  const pct = getCapacityProgress(confirmed, modality.max_entries);
  const pendingRegistrations = Math.max(occupied - confirmed, 0);
  const barTone = slotsFull ? 'bg-amber-500' : (pct ?? 0) >= 80 ? 'bg-amber-400' : 'bg-acid';

  return (
    <div
      className={cn(
        'flex h-full flex-col rounded-4xl border border-gray-100 bg-paper-pure p-5 shadow-organic-sm sm:p-6',
        alreadyRegistered && 'border-acid/40 bg-acid/5',
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            {modalityPagesOn ? (
              <Link to={modalityHref} className="font-display text-xl font-bold text-ink hover:underline">{modality.name}</Link>
            ) : (
              <h4 className="font-display text-xl font-bold text-ink">{modality.name}</h4>
            )}
            {alreadyRegistered && <V2Badge tone="green">Você está inscrito</V2Badge>}
            {myInviteBadge && <V2Badge tone={myInviteBadge.tone}>{myInviteBadge.text}</V2Badge>}
          </div>
          <div className="mt-3 flex flex-wrap gap-1.5">
            <V2Badge tone="neutral">{MODALITY_FORMAT_LABELS[modality.format]}</V2Badge>
            <V2Badge tone="neutral">{SKILL_LEVEL_LABELS[modality.skill_level]}</V2Badge>
            <V2Badge tone="neutral">{GENDER_CATEGORY_LABELS[modality.gender_category]}</V2Badge>
            <V2Badge tone="neutral">{AGE_CATEGORY_LABELS[modality.age_category]}</V2Badge>
            {stageBadgeLabel && <V2Badge tone="neutral">{stageBadgeLabel}</V2Badge>}
          </div>
        </div>
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-ink text-acid">
          <Trophy className="h-4.5 w-4.5" />
        </div>
      </div>

      {inviteForMe && (
        <div className="mt-4 rounded-3xl border border-acid/40 bg-acid/10 p-4">
          <p className="text-sm font-semibold text-ink">
            {inviteForMe.player_a_name || 'Um atleta'} te convidou para jogar como dupla nesta modalidade.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <V2Button size="sm" disabled={respondMutation.isPending} onClick={() => handleRespondInvite(true)}>
              Aceitar convite
            </V2Button>
            <V2Button size="sm" variant="ghost" disabled={respondMutation.isPending} onClick={() => handleRespondInvite(false)}>
              Recusar
            </V2Button>
          </div>
        </div>
      )}

      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        <div className="rounded-3xl border border-gray-100 bg-paper p-4">
          <div className="text-[11px] font-bold uppercase tracking-widest text-gray-400">Capacidade</div>
          <div className="mt-2 text-sm font-medium text-ink">
            {hasUnlimitedEntries(modality.max_entries)
              ? `${confirmed} inscritos confirmados`
              : `${confirmed} / ${modality.max_entries} inscritos confirmados`}
          </div>
          <div className="mt-3">
            {pct !== null ? (
              <>
                <div className="mb-1 flex items-center justify-between text-[11px] text-gray-500">
                  <span>{slotsFull ? 'Capacidade esgotada' : 'Leitura atual da ocupação'}</span>
                  <span>{pct}%</span>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-gray-100">
                  <div
                    className={cn('h-full transition-all duration-300', barTone)}
                    style={{ width: `${pct}%` }}
                    role="progressbar"
                    aria-valuenow={confirmed}
                    aria-valuemin={0}
                    aria-valuemax={modality.max_entries}
                  />
                </div>
              </>
            ) : (
              <div className="rounded-2xl border border-dashed border-acid/40 bg-acid/10 px-3 py-2 text-[11px] text-ink">
                Vagas abertas sem limite definido para esta modalidade.
              </div>
            )}
          </div>
        </div>

        <div className="rounded-3xl border border-gray-100 bg-paper p-4">
          <div className="text-[11px] font-bold uppercase tracking-widest text-gray-400">Inscrição</div>
          <div className="mt-2 flex items-center gap-2 text-sm font-medium text-ink">
            <Wallet className="h-4 w-4 text-ink" />
            {fee > 0 ? formatBRL(fee) : 'Gratuita'}
          </div>
          <p className="mt-3 text-xs leading-5 text-gray-500">
            {pendingRegistrations > 0
              ? `Há ${pendingRegistrations} inscrição(ões) adicional(is) aguardando confirmação ou processamento.`
              : 'Sem pendências extras registradas no momento.'}
          </p>
        </div>
      </div>

      <div className="mt-auto pt-5">
        <div className="mb-4 text-xs leading-5 text-gray-500">
          {alreadyRegistered
            ? 'Sua participação nesta modalidade já está registrada.'
            : canRegister
              ? slotsFull
                ? 'A modalidade atingiu a capacidade configurada para novas confirmações.'
                : isAdmin
                  ? 'Como admin, você pode adicionar jogadores diretamente por aqui.'
                  : 'Abra o diálogo para concluir sua inscrição nesta modalidade.'
              : 'Modalidade bloqueada até que o código de acesso do torneio privado seja validado.'}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3">
          {modalityPagesOn ? (
            <V2Button asChild variant="ghost" size="sm">
              <Link to={modalityHref}><Info className="h-4 w-4" /> Ver modalidade</Link>
            </V2Button>
          ) : (
            <V2Button variant="ghost" size="sm" onClick={onInfo}><Info className="h-4 w-4" /> Informações</V2Button>
          )}

          <div className="flex flex-wrap items-center gap-2">
            {alreadyRegistered && canPayOwn && (
              <V2Button size="sm" variant="secondary" onClick={() => setPayOpen(true)}>
                <Wallet className="h-4 w-4" />
                {myRegistration?.payment_declared_at ? 'Pagamento informado' : 'Pagar inscrição'}
              </V2Button>
            )}
            {alreadyRegistered ? (
              <V2Badge tone="green">Inscrito</V2Badge>
            ) : canRegister ? (
              <V2Button size="sm" onClick={onRegister} disabled={slotsFull && !canWaitlist}>
                <Plus className="h-4 w-4" />
                {canWaitlist ? 'Entrar na lista de espera' : slotsFull ? 'Modalidade lotada' : isAdmin ? 'Inscrever jogador' : 'Inscrever-se'}
              </V2Button>
            ) : (
              <V2Badge tone="neutral">Privado: exige código</V2Badge>
            )}
          </div>
        </div>
      </div>

      {canPayOwn && payOpen && (
        <PixPaymentDialog
          open
          onClose={() => setPayOpen(false)}
          tournament={tournament}
          modality={modality}
          registrationId={myRegistration.id}
          paymentDeclared={Boolean(myRegistration.payment_declared_at)}
        />
      )}
    </div>
  );
}
