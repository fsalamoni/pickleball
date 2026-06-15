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
import { AlertTriangle, Info } from 'lucide-react';
import { useAuth } from '@/core/lib/FirebaseAuthContext';
import { useCreateRegistration } from '@/modules/tournament/hooks/useTournament';
import { MODALITY_FORMAT } from '@/modules/tournament/domain/constants';
import { LEVEL_OPTIONS } from '@/modules/leveling/data/levels';
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
  const { user, userProfile } = useAuth();
  const createMutation = useCreateRegistration();
  const [form, setForm] = useState({
    player_a_name: '',
    player_a_email: '',
    player_a_level: '',
    player_b_name: '',
    player_b_email: '',
    player_b_level: '',
  });

  useEffect(() => {
    if (!open) return;
    setForm({
      player_a_name: userProfile?.platform_name || user?.displayName || user?.email || '',
      player_a_email: user?.email || '',
      player_a_level: userProfile?.leveling_level || '',
      player_b_name: '',
      player_b_email: '',
      player_b_level: '',
    });
  }, [open, user?.email, user?.displayName, userProfile?.platform_name, userProfile?.leveling_level]);

  const eligibility = useMemo(() => {
    if (!modality) return { errors: [], warnings: [] };
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
  }, [modality, userProfile, isAdmin]);

  if (!modality) return null;
  const blocked = !isAdmin && eligibility.errors.length > 0;

  async function handleSubmit() {
    if (!form.player_a_name.trim()) return toast.error('Informe o nome do jogador A.');
    if (modality.format === MODALITY_FORMAT.DOUBLES && !form.player_b_name.trim()) {
      return toast.error('Informe o nome da dupla (jogador B).');
    }
    if (isAdmin) {
      if (!form.player_a_email.trim() || !form.player_a_level) {
        return toast.error('Informe e-mail e nível do jogador A.');
      }
      if (modality.format === MODALITY_FORMAT.DOUBLES && (!form.player_b_email.trim() || !form.player_b_level)) {
        return toast.error('Informe e-mail e nível do jogador B.');
      }
    }
    if (blocked) {
      return toast.error('Não é possível enviar a inscrição: você não atende aos critérios desta modalidade.');
    }
    try {
      await createMutation.mutateAsync({
        tournament_id: tournament.id,
        modality_id: modality.id,
        invite_code:
          typeof window !== 'undefined'
            ? sessionStorage.getItem(`tournament_access_${tournament.id}`) || ''
            : '',
        player_a: {
          name: form.player_a_name,
          email: form.player_a_email,
          level: form.player_a_level,
          competition_gender: isAdmin ? null : userProfile?.competition_gender || null,
          user_id: isAdmin ? null : user?.uid,
        },
        player_b:
          modality.format === MODALITY_FORMAT.DOUBLES
            ? { name: form.player_b_name, email: form.player_b_email, level: form.player_b_level }
            : null,
      });
      toast.success('Inscrição enviada!');
      onClose();
    } catch (err) {
      toast.error(err.message || 'Falha na inscrição.');
    }
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

          <div>
            <Label>{isAdmin ? 'Nome (Jogador A)' : 'Seu nome (Jogador A)'}</Label>
            <Input
              value={form.player_a_name}
              onChange={(e) => setForm((f) => ({ ...f, player_a_name: e.target.value }))}
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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
          </div>
          {modality.format === MODALITY_FORMAT.DOUBLES && (
            <>
              <div>
                <Label>Parceiro(a) (Jogador B)</Label>
                <Input
                  value={form.player_b_name}
                  onChange={(e) => setForm((f) => ({ ...f, player_b_name: e.target.value }))}
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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
              </div>
            </>
          )}
          {modality.entry_fee_cents > 0 && (
            <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded p-2">
              Taxa: R$ {(modality.entry_fee_cents / 100).toFixed(2).replace('.', ',')} — pagamento será solicitado em seguida.
            </p>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={handleSubmit} disabled={createMutation.isPending || blocked}>
            {createMutation.isPending ? 'Enviando…' : 'Confirmar inscrição'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
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
