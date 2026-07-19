import React, { useEffect, useMemo, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { AlertTriangle, Info, Search, X } from 'lucide-react';
import { useAuth } from '@/core/lib/FirebaseAuthContext';
import { useFeatureFlag } from '@/core/lib/FeatureFlagsContext';
import { FEATURE_FLAG } from '@/core/featureFlags';
import { useCreateRegistration, useRegistrations } from '@/modules/tournament/hooks/useTournament';
import { useAllPlatformUsers } from '@/modules/admin/hooks/usePlatformUsers';
import { MODALITY_FORMAT, COMPETITION_GENDER } from '@/modules/tournament/domain/constants';
import { countOccupiedRegistrations, isRegistrationCapacityReached } from '@/modules/tournament/domain/capacity';
import {
  filterPlatformAthletes,
  platformUserDisplayName,
  platformUserToPlayerFields,
} from '@/modules/tournament/domain/adminAthleteRegistration';
import { UserAvatar } from '@/components/ui/user-avatar';
import { cn } from '@/core/lib/utils';
import { LEVEL_OPTIONS } from '@/modules/leveling/data/levels';
import { formatBrlCents, tournamentHasPixConfig } from '@/modules/tournament/domain/payment';
import { PixPaymentContent } from '@/modules/tournament/components/PixPaymentDialog';

const GENDER_OPTIONS = [
  { value: COMPETITION_GENDER.MALE, label: 'Masculino' },
  { value: COMPETITION_GENDER.FEMALE, label: 'Feminino' },
];
import { evaluateRegistrationEligibility } from '@/modules/tournament/domain/eligibility';

/**
 * Dialog reutilizável de inscrição em uma modalidade.
 *
 * Aplica a validação de elegibilidade (gênero, idade e nível) sobre o perfil
 * do usuário logado antes de permitir o envio. Admins têm permissão de
 * override (apenas mostram os avisos, sem bloquear).
 */
export default function ModalityRegistrationDialog({
  modality,
  tournament,
  open,
  onClose,
  isAdmin = false,
}) {
  const { user, userProfile, isPlatformAdmin } = useAuth();
  const waitlistOn = useFeatureFlag(FEATURE_FLAG.TOURNAMENT_WAITLIST);
  const adminAthleteRegOn = useFeatureFlag(FEATURE_FLAG.ADMIN_ATHLETE_REGISTRATION);
  const paymentOn = useFeatureFlag(FEATURE_FLAG.PAYMENT_INSTRUCTIONS);
  const createMutation = useCreateRegistration();
  // Etapa de pagamento (flag payment_instructions): guarda o id da inscrição
  // recém-criada para exibir as instruções PIX sem fechar o dialog.
  const [paymentRegId, setPaymentRegId] = useState(null);
  const { data: existingRegs = [] } = useRegistrations(modality?.id);
  // Seletor de atletas da plataforma: exclusivo do admin da plataforma, atrás
  // da flag, e apenas quando o modal está aberto em modo admin do torneio.
  const canPickAthletes = Boolean(isAdmin && isPlatformAdmin && adminAthleteRegOn);
  const { data: platformUsers = [] } = useAllPlatformUsers({ enabled: canPickAthletes && open });
  const isFull = modality
    ? isRegistrationCapacityReached(countOccupiedRegistrations(existingRegs), modality.max_entries)
    : false;
  const asWaitlist = isFull && waitlistOn;
  const [form, setForm] = useState({
    player_a_name: '',
    player_a_email: '',
    player_a_level: '',
    player_a_gender: '',
    player_a_user_id: null,
    player_a_photo: null,
    player_b_name: '',
    player_b_email: '',
    player_b_level: '',
    player_b_gender: '',
    player_b_user_id: null,
    player_b_photo: null,
  });

  useEffect(() => {
    if (!open) return;
    setPaymentRegId(null);
    setForm({
      // Com o seletor de atletas ativo, o formulário começa vazio para o admin
      // escolher o atleta na lista. Caso contrário, mantém o autopreenchimento
      // atual (perfil do usuário logado) — comportamento inalterado.
      player_a_name: canPickAthletes ? '' : (userProfile?.platform_name || user?.displayName || user?.email || ''),
      player_a_email: canPickAthletes ? '' : (user?.email || ''),
      player_a_level: canPickAthletes ? '' : (userProfile?.leveling_level || ''),
      player_a_gender: canPickAthletes ? '' : (userProfile?.competition_gender || ''),
      player_a_user_id: null,
      player_a_photo: null,
      player_b_name: '',
      player_b_email: '',
      player_b_level: '',
      player_b_gender: '',
      player_b_user_id: null,
      player_b_photo: null,
    });
  }, [open, canPickAthletes, user?.email, user?.displayName, userProfile?.platform_name, userProfile?.leveling_level, userProfile?.competition_gender]);

  const eligibility = useMemo(() => {
    if (!modality) return { errors: [], warnings: [] };
    if (canPickAthletes) {
      // Com o seletor de atletas, os avisos refletem o ATLETA selecionado (e não
      // o perfil do admin): usa gênero/nível do formulário — que partem do
      // atleta e podem ser ajustados — e a data de nascimento real da conta
      // escolhida para a checagem de idade. Sem atleta escolhido para o jogador
      // A, não há o que avaliar. Admin nunca é bloqueado (tudo vira aviso).
      const selA = form.player_a_user_id ? platformUsers.find((u) => u.uid === form.player_a_user_id) : null;
      if (!selA) return { errors: [], warnings: [] };
      const isDoubles = modality.format === MODALITY_FORMAT.DOUBLES;
      const selB = form.player_b_user_id ? platformUsers.find((u) => u.uid === form.player_b_user_id) : null;
      const profileA = {
        competition_gender: form.player_a_gender || null,
        leveling_level: form.player_a_level || null,
        birth_date: selA.birth_date || null,
      };
      // Jogador B só entra na avaliação quando um atleta foi escolhido para ele.
      const profileB = isDoubles && selB
        ? {
            competition_gender: form.player_b_gender || null,
            leveling_level: form.player_b_level || null,
            birth_date: selB.birth_date || null,
          }
        : undefined;
      const r = evaluateRegistrationEligibility(modality, profileA, profileB);
      return { errors: [], warnings: [...r.errors, ...r.warnings] };
    }
    if (isAdmin) {
      // Admin pode sobrescrever — apresentamos os apontamentos como aviso.
      const r = evaluateRegistrationEligibility(modality, userProfile, undefined);
      return { errors: [], warnings: [...r.errors, ...r.warnings] };
    }
    // O perfil do jogador B só é conhecido quando ele já tem conta na
    // plataforma (caso comum: convite por e-mail, perfil ainda não criado).
    // Passamos `undefined` para sinalizar "desconhecido" e a engine emite
    // aviso quando precisar.
    return evaluateRegistrationEligibility(modality, userProfile, undefined);
  }, [
    modality,
    userProfile,
    isAdmin,
    canPickAthletes,
    platformUsers,
    form.player_a_user_id,
    form.player_b_user_id,
    form.player_a_gender,
    form.player_a_level,
    form.player_b_gender,
    form.player_b_level,
  ]);

  if (!modality) return null;
  const blocked = !isAdmin && eligibility.errors.length > 0;
  const pixReady = paymentOn
    && !isAdmin
    && (modality.entry_fee_cents || 0) > 0
    && tournamentHasPixConfig(tournament);

  function closeAll() {
    setPaymentRegId(null);
    onClose();
  }

  async function handleSubmit() {
    if (!form.player_a_name.trim()) return toast.error('Informe o nome do jogador A.');
    if (modality.format === MODALITY_FORMAT.DOUBLES && !form.player_b_name.trim()) {
      return toast.error('Informe o nome da dupla (jogador B).');
    }
    if (isAdmin) {
      if (!form.player_a_email.trim() || !form.player_a_level) {
        return toast.error('Informe e-mail e nível do jogador A.');
      }
      if (!form.player_a_gender) {
        return toast.error('Informe o gênero do jogador A.');
      }
      if (modality.format === MODALITY_FORMAT.DOUBLES && (!form.player_b_email.trim() || !form.player_b_level)) {
        return toast.error('Informe e-mail e nível do jogador B.');
      }
      if (modality.format === MODALITY_FORMAT.DOUBLES && !form.player_b_gender) {
        return toast.error('Informe o gênero do jogador B.');
      }
    }
    if (blocked) {
      return toast.error('Não é possível enviar a inscrição: você não atende aos critérios desta modalidade.');
    }
    try {
      const registrationId = await createMutation.mutateAsync({
        tournament_id: tournament.id,
        modality_id: modality.id,
        allow_waitlist: asWaitlist,
        invite_code:
          typeof window !== 'undefined'
            ? sessionStorage.getItem(`tournament_access_${tournament.id}`) || ''
            : '',
        player_a: {
          name: form.player_a_name,
          email: form.player_a_email,
          level: form.player_a_level,
          competition_gender: form.player_a_gender || (isAdmin ? null : userProfile?.competition_gender || null),
          // Admin: vincula à conta real do atleta escolhido na lista (quando houver);
          // fora do modo admin, é sempre o próprio usuário logado.
          user_id: isAdmin ? (form.player_a_user_id || null) : user?.uid,
          photo_url: isAdmin ? (form.player_a_photo || null) : (userProfile?.photo_url || user?.photoURL || null),
        },
        player_b:
          modality.format === MODALITY_FORMAT.DOUBLES
            ? {
                name: form.player_b_name,
                email: form.player_b_email,
                level: form.player_b_level,
                competition_gender: form.player_b_gender || null,
                user_id: form.player_b_user_id || null,
                photo_url: form.player_b_photo || null,
              }
            : null,
      });
      toast.success(asWaitlist ? 'Você entrou na lista de espera!' : 'Inscrição enviada!');
      if (!asWaitlist && pixReady && registrationId) {
        // Mantém o dialog aberto na etapa de pagamento (flag payment_instructions).
        setPaymentRegId(registrationId);
      } else {
        onClose();
      }
    } catch (err) {
      toast.error(err.message || 'Falha na inscrição.');
    }
  }

  function selectAthlete(slot, platformUser) {
    const p = platformUserToPlayerFields(platformUser);
    setForm((f) => ({
      ...f,
      [`player_${slot}_name`]: p.name,
      [`player_${slot}_email`]: p.email,
      [`player_${slot}_level`]: p.level,
      [`player_${slot}_gender`]: p.gender,
      [`player_${slot}_user_id`]: p.user_id,
      [`player_${slot}_photo`]: p.photo_url,
    }));
  }

  function clearAthlete(slot) {
    setForm((f) => ({
      ...f,
      [`player_${slot}_name`]: '',
      [`player_${slot}_email`]: '',
      [`player_${slot}_level`]: '',
      [`player_${slot}_gender`]: '',
      [`player_${slot}_user_id`]: null,
      [`player_${slot}_photo`]: null,
    }));
  }

  if (paymentRegId) {
    return (
      <Dialog open={open} onOpenChange={(o) => !o && closeAll()}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Pagamento da inscrição</DialogTitle>
          </DialogHeader>
          <PixPaymentContent
            tournament={tournament}
            modality={modality}
            registrationId={paymentRegId}
            onDone={closeAll}
          />
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {isAdmin ? 'Inscrever participante' : 'Inscrever-se'} em {modality.name}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          {asWaitlist && (
            <div className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
              <div className="flex items-center gap-2 font-medium">
                <Info className="w-4 h-4" /> Modalidade lotada
              </div>
              <p className="mt-1">Você pode entrar na lista de espera e será promovido se abrir uma vaga.</p>
            </div>
          )}
          {eligibility.errors.length > 0 && (
            <div className="rounded-md border border-red-300 bg-red-50 p-3 text-sm text-red-800">
              <div className="flex items-center gap-2 font-medium">
                <AlertTriangle className="w-4 h-4" /> Você não atende a esta modalidade
              </div>
              <ul className="list-disc pl-5 mt-1 space-y-1">
                {eligibility.errors.map((e, i) => (
                  <li key={i}>{e}</li>
                ))}
              </ul>
              {isAdmin && (
                <p className="mt-2 text-xs text-red-900/80">
                  Como administrador você pode prosseguir mesmo assim — confira manualmente os dados.
                </p>
              )}
            </div>
          )}
          {eligibility.warnings.length > 0 && (
            <div className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
              <div className="flex items-center gap-2 font-medium">
                <Info className="w-4 h-4" /> Atenção
              </div>
              <ul className="list-disc pl-5 mt-1 space-y-1">
                {eligibility.warnings.map((w, i) => (
                  <li key={i}>{w}</li>
                ))}
              </ul>
            </div>
          )}

          {canPickAthletes && (
            <AthletePicker
              label="Escolher atleta cadastrado (Jogador A)"
              users={platformUsers}
              selectedUserId={form.player_a_user_id}
              onSelect={(u) => selectAthlete('a', u)}
              onClear={() => clearAthlete('a')}
            />
          )}
          <div>
            <Label>{isAdmin ? 'Nome (Jogador A)' : 'Seu nome (Jogador A)'}</Label>
            <Input
              value={form.player_a_name}
              onChange={(e) => setForm((f) => ({ ...f, player_a_name: e.target.value, player_a_user_id: null, player_a_photo: null }))}
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <Label>E-mail do jogador A</Label>
              <Input
                type="email"
                value={form.player_a_email}
                onChange={(e) => setForm((f) => ({ ...f, player_a_email: e.target.value }))}
                disabled={!isAdmin}
              />
            </div>
            <LevelSelect
              label="Nível do jogador A"
              value={form.player_a_level}
              onChange={(value) => setForm((f) => ({ ...f, player_a_level: value }))}
            />
            <GenderSelect
              label="Gênero do jogador A"
              value={form.player_a_gender}
              onChange={(value) => setForm((f) => ({ ...f, player_a_gender: value }))}
            />
          </div>
          {modality.format === MODALITY_FORMAT.DOUBLES && (
            <>
              {canPickAthletes && (
                <AthletePicker
                  label="Escolher atleta cadastrado (Jogador B)"
                  users={platformUsers}
                  selectedUserId={form.player_b_user_id}
                  onSelect={(u) => selectAthlete('b', u)}
                  onClear={() => clearAthlete('b')}
                />
              )}
              <div>
                <Label>Parceiro(a) (Jogador B)</Label>
                <Input
                  value={form.player_b_name}
                  onChange={(e) => setForm((f) => ({ ...f, player_b_name: e.target.value, player_b_user_id: null, player_b_photo: null }))}
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <Label>E-mail do jogador B</Label>
                  <Input
                    type="email"
                    value={form.player_b_email}
                    onChange={(e) => setForm((f) => ({ ...f, player_b_email: e.target.value }))}
                  />
                </div>
                <LevelSelect
                  label="Nível do jogador B"
                  value={form.player_b_level}
                  onChange={(value) => setForm((f) => ({ ...f, player_b_level: value }))}
                />
                <GenderSelect
                  label="Gênero do jogador B"
                  value={form.player_b_gender}
                  onChange={(value) => setForm((f) => ({ ...f, player_b_gender: value }))}
                />
              </div>
            </>
          )}
          {modality.entry_fee_cents > 0 && (
            <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded p-2">
              {pixReady
                ? `Taxa: ${formatBrlCents(modality.entry_fee_cents)} — as instruções de pagamento (PIX) aparecem após confirmar a inscrição.`
                : `Taxa: ${formatBrlCents(modality.entry_fee_cents)} — pagamento será solicitado em seguida.`}
            </p>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={handleSubmit} disabled={createMutation.isPending || blocked}>
            {createMutation.isPending
              ? 'Enviando…'
              : asWaitlist ? 'Entrar na lista de espera' : 'Confirmar inscrição'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Seletor de atletas cadastrados na plataforma (exclusivo do admin da
 * plataforma). Lista todos os atletas com filtro por nome; ao escolher, os
 * dados do jogador são preenchidos e a inscrição é vinculada à conta real.
 */
function AthletePicker({ label, users, selectedUserId, onSelect, onClear }) {
  const [term, setTerm] = useState('');
  const results = useMemo(() => filterPlatformAthletes(users, term), [users, term]);
  const selected = selectedUserId ? users.find((u) => u.uid === selectedUserId) : null;

  return (
    <div className="rounded-md border border-input bg-paper/40 p-3 space-y-2">
      <div className="flex items-center justify-between gap-2">
        <Label className="text-xs uppercase tracking-wide text-gray-500">{label}</Label>
        {selected && (
          <button
            type="button"
            onClick={onClear}
            className="flex items-center gap-1 text-xs text-gray-500 hover:text-ink"
          >
            <X className="w-3 h-3" /> limpar seleção
          </button>
        )}
      </div>
      {selected ? (
        <div className="flex items-center gap-2 rounded-md border border-acid/40 bg-acid/10 p-2">
          <UserAvatar name={platformUserDisplayName(selected)} photoUrl={selected.photo_url} size="sm" />
          <div className="min-w-0">
            <div className="text-sm font-medium truncate">{platformUserDisplayName(selected)}</div>
            <div className="text-xs text-gray-500 truncate">{selected.email || '—'}</div>
          </div>
        </div>
      ) : (
        <>
          <div className="relative">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <Input
              className="pl-8"
              placeholder="Filtrar atletas por nome…"
              value={term}
              onChange={(e) => setTerm(e.target.value)}
            />
          </div>
          <div className="max-h-48 overflow-y-auto rounded-md border border-gray-100 divide-y">
            {users.length === 0 ? (
              <div className="p-3 text-xs text-gray-500 text-center">Carregando atletas…</div>
            ) : results.length === 0 ? (
              <div className="p-3 text-xs text-gray-500 text-center">Nenhum atleta encontrado.</div>
            ) : (
              results.map((u) => {
                const name = platformUserDisplayName(u);
                return (
                  <button
                    key={u.uid}
                    type="button"
                    onClick={() => onSelect(u)}
                    className={cn('flex w-full items-center gap-2 p-2 text-left hover:bg-paper')}
                  >
                    <UserAvatar name={name} photoUrl={u.photo_url} size="sm" />
                    <div className="min-w-0">
                      <div className="text-sm truncate">{name}</div>
                      <div className="text-xs text-gray-500 truncate">
                        {[u.city, u.state].filter(Boolean).join(' · ') || u.email || '—'}
                      </div>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </>
      )}
    </div>
  );
}

function LevelSelect({ label, value, onChange }) {
  return (
    <div>
      <Label>{label}</Label>
      <select
        className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        <option value="">Selecione</option>
        {LEVEL_OPTIONS.map((option) => (
          <option key={option.code} value={option.code}>{option.label}</option>
        ))}
      </select>
    </div>
  );
}

function GenderSelect({ label, value, onChange }) {
  return (
    <div>
      <Label>{label}</Label>
      <select
        className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        <option value="">Selecione</option>
        {GENDER_OPTIONS.map((option) => (
          <option key={option.value} value={option.value}>{option.label}</option>
        ))}
      </select>
    </div>
  );
}
