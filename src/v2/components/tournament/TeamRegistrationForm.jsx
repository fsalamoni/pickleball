/**
 * Inscrição/edição de EQUIPE (nome + elenco completo).
 *
 * O formulário desenha exatamente as VAGAS definidas na modalidade
 * (`team_config`): quantidade de atletas e composição de gênero. Cada vaga é
 * preenchida escolhendo um atleta cadastrado no diretório (com conta/user_id)
 * ou, como no fluxo de duplas, um convidado avulso (só o nome).
 *
 * Atletas com conta pontuam no ranking individual (via espelho das etapas);
 * convidados avulsos contam só para a equipe.
 *
 * Este componente é o CORPO do formulário — quem abre o modal é o
 * `TeamRegistrationDialog`.
 */

import React, { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import { AlertTriangle, Check, Search, UserPlus, X } from 'lucide-react';
import { V2Badge, V2Button, V2Field, V2Input } from '@/v2/ui/primitives';
import { UserAvatar } from '@/components/ui/user-avatar';
import { cn } from '@/core/lib/utils';
import { useAuth } from '@/core/lib/FirebaseAuthContext';
import { listAthletes } from '@/modules/athletes/services/athleteService';
import { COMPETITION_GENDER } from '@/modules/tournament/domain/constants';
import {
  filterPartnerCandidates, publicProfileToPartnerFields,
} from '@/modules/tournament/domain/partnerInvite';
import {
  TEAM_GENDER, TEAM_GENDER_LABELS, TEAM_WIN_RULE,
  buildRosterSlots, assignMembersToSlots, membersFromSlots, rosterProgress,
  validateTeamRoster, validateTeamAgainstExisting, uidsInOtherTeams,
} from '@/modules/tournament/domain/teamFormat';
import {
  useRegisterTeam, useUpdateTeamRoster, useTeamRegistrations,
} from '@/modules/tournament/hooks/useTeams';

/** Gênero competitivo declarado no perfil público do diretório. */
function athleteGender(profile) {
  const g = profile?.competition_gender ?? profile?.gender;
  return g === COMPETITION_GENDER.MALE || g === COMPETITION_GENDER.FEMALE ? g : null;
}

/** O atleta pode ocupar esta vaga? (sem gênero declarado, não bloqueia) */
function fitsSlot(profile, slot) {
  const g = athleteGender(profile);
  return !g || g === slot.gender;
}

/** Uma vaga do elenco: vazia (busca/convidado) ou preenchida. */
function RosterSlot({
  slot, value, candidates, isOpen, term, onTerm, onOpen, onClose, onPick, onGuest, onGuestName, onClear,
}) {
  const filled = Boolean(value);
  const isGuest = filled && !value.user_id;

  return (
    <div className={cn(
      'rounded-3xl border p-3 transition-colors',
      filled ? 'border-acid/40 bg-acid/5' : 'border-dashed border-gray-200 bg-paper',
    )}
    >
      <div className="flex items-center gap-2">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-ink text-[11px] font-bold text-acid">
          {slot.short}
        </span>

        {!filled ? (
          <>
            <div className="min-w-0 flex-1">
              <div className="text-sm font-semibold text-ink">{slot.label}</div>
              <div className="text-xs text-gray-400">Vaga livre</div>
            </div>
            <V2Button size="sm" variant="ghost" onClick={isOpen ? onClose : onOpen}>
              <Search className="h-4 w-4" /> Escolher
            </V2Button>
            <V2Button size="sm" variant="ghost" onClick={onGuest}>Convidado</V2Button>
          </>
        ) : (
          <>
            <UserAvatar name={value.name || 'Atleta'} photoUrl={value.photo_url} size="sm" />
            <div className="min-w-0 flex-1">
              {isGuest ? (
                <input
                  autoFocus
                  value={value.name}
                  onChange={(e) => onGuestName(e.target.value)}
                  maxLength={60}
                  placeholder="Nome do convidado"
                  aria-label={`${slot.label} — nome do convidado`}
                  className="w-full rounded-xl border border-gray-200 bg-paper-pure px-3 py-2 text-sm text-ink outline-none focus:ring-4 focus:ring-gray-100"
                />
              ) : (
                <div className="truncate text-sm font-semibold text-ink">{value.name}</div>
              )}
              <div className="truncate text-xs text-gray-400">
                {slot.label}
                {isGuest ? ' · convidado (sem conta)' : ''}
                {value.level ? ` · nível ${value.level}` : ''}
              </div>
            </div>
            <button
              type="button"
              onClick={onClear}
              aria-label={`Liberar ${slot.label}`}
              className="rounded-full p-1.5 text-gray-400 hover:bg-white hover:text-red-500"
            >
              <X className="h-4 w-4" />
            </button>
          </>
        )}
      </div>

      {!filled && isOpen && (
        <div className="mt-3 space-y-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input
              autoFocus
              value={term}
              onChange={(e) => onTerm(e.target.value)}
              placeholder="Buscar atleta por nome ou cidade…"
              aria-label={`Buscar atleta para ${slot.label}`}
              className="w-full rounded-2xl border border-gray-200 bg-paper-pure py-2.5 pl-9 pr-3 text-sm text-ink outline-none focus:ring-4 focus:ring-gray-100"
            />
          </div>
          <div className="max-h-52 divide-y divide-gray-100 overflow-y-auto rounded-2xl border border-gray-100 bg-paper-pure">
            {candidates.length === 0 ? (
              <p className="p-3 text-center text-xs text-gray-500">
                {term.trim()
                  ? 'Nenhum atleta disponível com esse nome. Use “Convidado” para incluir quem não tem conta.'
                  : 'Digite para buscar entre os atletas cadastrados.'}
              </p>
            ) : candidates.map((profile) => {
              const uid = profile.uid || profile.id;
              return (
                <button
                  key={uid}
                  type="button"
                  onClick={() => onPick(profile)}
                  className="flex w-full items-center gap-2 p-2 text-left hover:bg-paper"
                >
                  <UserAvatar name={profile.platform_name} photoUrl={profile.photo_url} size="sm" />
                  <span className="min-w-0 flex-1 truncate text-sm text-ink">{profile.platform_name}</span>
                  <span className="shrink-0 text-xs text-gray-400">{profile.city || ''}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

export default function TeamRegistrationForm({
  tournament, modality, editingTeam = null, onDone, onCancel,
}) {
  const config = modality.team_config;
  const { user, userProfile } = useAuth();
  const slots = useMemo(() => buildRosterSlots(config), [config]);

  const initial = useMemo(
    () => assignMembersToSlots(editingTeam?.members || [], config),
    [editingTeam, config],
  );
  const [teamName, setTeamName] = useState(editingTeam?.team_name || '');
  const [values, setValues] = useState(initial.filled);
  const [openSlot, setOpenSlot] = useState(null);
  const [term, setTerm] = useState('');

  const registerMutation = useRegisterTeam();
  const updateMutation = useUpdateTeamRoster();
  const saving = registerMutation.isPending || updateMutation.isPending;
  const isEditing = !!editingTeam;

  const { data: directory = [] } = useQuery({ queryKey: ['athletes'], queryFn: listAthletes, staleTime: 60_000 });
  const { data: existingTeams = [] } = useTeamRegistrations(modality.id);

  // Quem já está em OUTRA equipe da modalidade não aparece na busca.
  const blockedUids = useMemo(
    () => uidsInOtherTeams(existingTeams, editingTeam?.id || null),
    [existingTeams, editingTeam?.id],
  );
  const pickedUids = useMemo(() => values.map((v) => v?.user_id).filter(Boolean), [values]);

  const candidates = useMemo(() => {
    if (openSlot == null) return [];
    const slot = slots[openSlot];
    if (!slot) return [];
    return filterPartnerCandidates(directory, {
      term,
      selfUid: null,
      excludedUids: [...pickedUids, ...blockedUids],
    })
      .filter((profile) => profile.hidden !== true && fitsSlot(profile, slot))
      .slice(0, 20);
  }, [openSlot, slots, directory, term, pickedUids, blockedUids]);

  const progress = useMemo(() => rosterProgress(values, config), [values, config]);
  const members = useMemo(() => membersFromSlots(values, config), [values, config]);
  const rosterCheck = useMemo(() => validateTeamRoster(members, config), [members, config]);
  const clashCheck = useMemo(
    () => validateTeamAgainstExisting({
      teamName, members, existingTeams, currentTeamId: editingTeam?.id || null,
    }),
    [teamName, members, existingTeams, editingTeam?.id],
  );
  const problems = [
    ...(progress.complete ? rosterCheck.errors : []),
    ...clashCheck.errors,
  ];

  function setSlot(index, next) {
    setValues((list) => list.map((v, i) => (i === index ? next : v)));
  }

  function pickAthlete(index, profile) {
    const p = publicProfileToPartnerFields(profile);
    setSlot(index, {
      user_id: p.user_id, name: p.name, photo_url: p.photo_url, level: p.level || null,
    });
    setOpenSlot(null);
    setTerm('');
  }

  function addGuest(index) {
    setSlot(index, { user_id: null, name: '', photo_url: null, level: null });
    setOpenSlot(null);
    setTerm('');
  }

  /** "Sou eu": ocupa a primeira vaga livre compatível com o meu gênero. */
  const myGender = athleteGender(userProfile) || athleteGender(user);
  const mySlotIndex = useMemo(() => {
    if (!user?.uid || pickedUids.includes(user.uid) || blockedUids.includes(user.uid)) return -1;
    return slots.findIndex((slot, i) => !values[i] && (!myGender || slot.gender === myGender));
  }, [user?.uid, pickedUids, blockedUids, slots, values, myGender]);

  function addSelf() {
    if (mySlotIndex < 0) return;
    const own = directory.find((p) => (p.uid || p.id) === user.uid);
    if (own) {
      pickAthlete(mySlotIndex, own);
      return;
    }
    setSlot(mySlotIndex, {
      user_id: user.uid,
      name: userProfile?.platform_name || user.displayName || 'Eu',
      photo_url: userProfile?.photo_url || user.photoURL || null,
      level: userProfile?.leveling_level || null,
    });
  }

  async function handleSave() {
    if (!teamName.trim()) {
      toast.error('Dê um nome à equipe.');
      return;
    }
    const roster = validateTeamRoster(members, config);
    if (!roster.valid) {
      toast.error(roster.errors[0] || 'Elenco incompleto.');
      return;
    }
    const clash = validateTeamAgainstExisting({
      teamName, members, existingTeams, currentTeamId: editingTeam?.id || null,
    });
    if (!clash.valid) {
      toast.error(clash.errors[0]);
      return;
    }
    try {
      if (isEditing) {
        await updateMutation.mutateAsync({
          regId: editingTeam.id, input: { team_name: teamName, members }, modality,
        });
        toast.success('Equipe atualizada.');
      } else {
        await registerMutation.mutateAsync({
          tournament, modality, input: { team_name: teamName, members },
        });
        toast.success('Equipe inscrita!');
      }
      onDone?.();
    } catch (err) {
      toast.error(err.message || 'Não foi possível salvar a equipe.');
    }
  }

  const missingHint = config.gender === TEAM_GENDER.MIXED
    ? [
        progress.missingMale > 0 ? `${progress.missingMale} masculina(s)` : null,
        progress.missingFemale > 0 ? `${progress.missingFemale} feminina(s)` : null,
      ].filter(Boolean).join(' e ')
    : `${progress.missing} vaga(s)`;

  return (
    <div className="space-y-4">
      {/* O que a modalidade exige — a regra que o elenco precisa cumprir. */}
      <div className="flex flex-wrap gap-1.5">
        <V2Badge tone="acid">Equipe {TEAM_GENDER_LABELS[config.gender]?.toLowerCase()}</V2Badge>
        <V2Badge tone="neutral">{config.team_size} atletas</V2Badge>
        {config.gender === TEAM_GENDER.MIXED && (
          <V2Badge tone="neutral">{config.male_slots}M + {config.female_slots}F</V2Badge>
        )}
        <V2Badge tone="neutral">{(config.etapas || []).length} etapas/confronto</V2Badge>
        <V2Badge tone="neutral">
          {config.win_rule === TEAM_WIN_RULE.BEST_OF ? `Melhor de ${config.win_target}` : 'Todas as etapas'}
        </V2Badge>
      </div>

      <V2Field label="Nome da equipe" htmlFor="team-name" required hint="É como a equipe aparece nos confrontos e na classificação.">
        <V2Input
          id="team-name"
          value={teamName}
          onChange={(e) => setTeamName(e.target.value)}
          maxLength={80}
          placeholder="Ex.: Fera do Ataque"
        />
      </V2Field>

      <div className="space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="text-sm font-semibold text-ink">
            Elenco ({progress.filled}/{progress.required})
          </span>
          <div className="flex items-center gap-2">
            {mySlotIndex >= 0 && (
              <V2Button size="sm" variant="ghost" onClick={addSelf}>
                <UserPlus className="h-4 w-4" /> Sou eu
              </V2Button>
            )}
            <span className={cn('text-xs font-semibold', progress.complete ? 'text-green-600' : 'text-gray-400')}>
              {progress.complete ? (
                <span className="inline-flex items-center gap-1"><Check className="h-3.5 w-3.5" /> Elenco completo</span>
              ) : `Faltam ${missingHint}`}
            </span>
          </div>
        </div>

        <div className="space-y-2">
          {slots.map((slot, i) => (
            <RosterSlot
              key={slot.key}
              slot={slot}
              value={values[i] || null}
              candidates={openSlot === i ? candidates : []}
              isOpen={openSlot === i}
              term={term}
              onTerm={setTerm}
              onOpen={() => { setOpenSlot(i); setTerm(''); }}
              onClose={() => setOpenSlot(null)}
              onPick={(profile) => pickAthlete(i, profile)}
              onGuest={() => addGuest(i)}
              onGuestName={(name) => setSlot(i, { ...values[i], name })}
              onClear={() => setSlot(i, null)}
            />
          ))}
          {slots.length === 0 && (
            <p className="text-xs text-red-500">
              A modalidade ainda não define o tamanho da equipe. Peça ao organizador para revisar a configuração.
            </p>
          )}
        </div>
      </div>

      {/* Atletas que não cabem mais na composição da modalidade (config mudou). */}
      {initial.extras.length > 0 && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
          <div className="flex items-center gap-1.5 font-semibold">
            <AlertTriangle className="h-3.5 w-3.5" /> A composição da modalidade mudou
          </div>
          <p className="mt-1">
            {initial.extras.map((m) => m.name).join(', ')} não cabe(m) nas vagas atuais e sai(em) do elenco ao salvar.
          </p>
        </div>
      )}

      {problems.length > 0 && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
          {problems.map((msg) => <div key={msg}>• {msg}</div>)}
        </div>
      )}

      <div className="flex flex-wrap justify-end gap-2">
        {(onCancel || onDone) && (
          <V2Button variant="ghost" onClick={onCancel || onDone} disabled={saving}>Cancelar</V2Button>
        )}
        <V2Button onClick={handleSave} disabled={saving || !progress.complete || problems.length > 0}>
          {saving ? 'Salvando…' : isEditing ? 'Salvar equipe' : 'Inscrever equipe'}
        </V2Button>
      </div>
    </div>
  );
}
