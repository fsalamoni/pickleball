import React, { useState, useMemo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { toast } from 'sonner';
import { Plus, Check, X, Trash2 } from 'lucide-react';
import {
  useModalities,
  useRegistrationsByTournament,
  useCreateRegistration,
  useConfirmRegistrationPayment,
  useCancelRegistration,
  useDeleteRegistration,
} from '@/modules/tournament/hooks/useTournament';
import {
  MODALITY_FORMAT,
  REGISTRATION_STATUS,
  REGISTRATION_STATUS_LABELS,
  MODALITY_FORMAT_LABELS,
  TOURNAMENT_VISIBILITY,
  REGISTRATION_PROVISIONAL_LABEL,
} from '@/modules/tournament/domain/constants';
import { useAuth } from '@/core/lib/FirebaseAuthContext';
import { LEVEL_OPTIONS } from '@/modules/leveling/data/levels';

export default function TournamentRegistrationsTab({ tournament, isAdmin }) {
  const { user, userProfile } = useAuth();
  const { data: modalities = [] } = useModalities(tournament.id);
  const { data: registrations = [] } = useRegistrationsByTournament(tournament.id);
  const [open, setOpen] = useState(false);
  const [selectedModalityId, setSelectedModalityId] = useState('');
  const [form, setForm] = useState({
    player_a_name: '',
    player_a_email: '',
    player_a_level: '',
    player_b_name: '',
    player_b_email: '',
    player_b_level: '',
  });
  const createMutation = useCreateRegistration();

  const selectedModality = modalities.find((m) => m.id === selectedModalityId);

  function openDialog(modality) {
    setSelectedModalityId(modality.id);
    setForm({
      player_a_name: userProfile?.platform_name || user?.displayName || user?.email || '',
      player_a_email: user?.email || '',
      player_a_level: userProfile?.leveling_level || '',
      player_b_name: '',
      player_b_email: '',
      player_b_level: '',
    });
    setOpen(true);
  }

  async function handleSubmit() {
    if (!selectedModality) return;
    if (!form.player_a_name.trim()) return toast.error('Informe o nome do jogador A.');
    if (selectedModality.format === MODALITY_FORMAT.DOUBLES && !form.player_b_name.trim()) {
      return toast.error('Informe o nome da dupla (jogador B).');
    }
    if (isAdmin) {
      if (!form.player_a_email.trim() || !form.player_a_level) return toast.error('Informe e-mail e nível do jogador A.');
      if (selectedModality.format === MODALITY_FORMAT.DOUBLES && (!form.player_b_email.trim() || !form.player_b_level)) {
        return toast.error('Informe e-mail e nível do jogador B.');
      }
    }
    try {
      await createMutation.mutateAsync({
        tournament_id: tournament.id,
        modality_id: selectedModality.id,
        invite_code: sessionStorage.getItem(`tournament_access_${tournament.id}`) || '',
        player_a: {
          name: form.player_a_name,
          email: form.player_a_email,
          level: form.player_a_level,
          user_id: isAdmin ? null : user?.uid,
        },
        player_b:
          selectedModality.format === MODALITY_FORMAT.DOUBLES
            ? { name: form.player_b_name, email: form.player_b_email, level: form.player_b_level }
            : null,
      });
      toast.success('Inscrição enviada!');
      setOpen(false);
    } catch (err) {
      toast.error(err.message || 'Falha na inscrição.');
    }
  }

  return (
    <div className="space-y-4">
      {modalities.length === 0 ? (
        <Card>
          <CardContent className="p-6 text-sm text-slate-500 text-center">
            Aguardando o admin cadastrar modalidades.
          </CardContent>
        </Card>
      ) : (
        modalities.map((modality) => (
          <ModalityRegistrationsBlock
            key={modality.id}
            modality={modality}
            registrations={registrations.filter((r) => r.modality_id === modality.id)}
            tournament={tournament}
            isAdmin={isAdmin}
            currentUserId={user?.uid}
            onJoin={openDialog}
          />
        ))
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{isAdmin ? 'Inscrever participante' : 'Inscrever-se'} em {selectedModality?.name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Seu nome (Jogador A)</Label>
              <Input value={form.player_a_name} onChange={(e) => setForm((f) => ({ ...f, player_a_name: e.target.value }))} />
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
            {selectedModality?.format === MODALITY_FORMAT.DOUBLES && (
              <>
                <div>
                  <Label>Parceiro(a) (Jogador B)</Label>
                  <Input value={form.player_b_name} onChange={(e) => setForm((f) => ({ ...f, player_b_name: e.target.value }))} />
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
            {selectedModality?.entry_fee_cents > 0 && (
              <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded p-2">
                Taxa: R$ {(selectedModality.entry_fee_cents / 100).toFixed(2).replace('.', ',')} — pagamento será solicitado em seguida.
              </p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={handleSubmit} disabled={createMutation.isPending}>
              {createMutation.isPending ? 'Enviando…' : 'Confirmar inscrição'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function ModalityRegistrationsBlock({ tournament, modality, registrations, isAdmin, currentUserId, onJoin }) {
  const confirmMutation = useConfirmRegistrationPayment(modality.id);
  const cancelMutation = useCancelRegistration(modality.id);
  const deleteMutation = useDeleteRegistration(modality.id);
  const confirmed = registrations.filter((r) => r.status === REGISTRATION_STATUS.CONFIRMED).length;
  const hasPrivateAccess = typeof window !== 'undefined' && Boolean(sessionStorage.getItem(`tournament_access_${tournament.id}`));
  const isPublic = (tournament.visibility || TOURNAMENT_VISIBILITY.PRIVATE) === TOURNAMENT_VISIBILITY.PUBLIC;
  const alreadyRegistered = registrations.some((r) => (
    r.user_id === currentUserId ||
    r.player_a_user_id === currentUserId ||
    r.player_b_user_id === currentUserId
  ));
  const canJoin = isAdmin || isPublic || hasPrivateAccess || alreadyRegistered;

  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-2 flex-wrap">
          <div>
            <h4 className="font-semibold">{modality.name}</h4>
            <p className="text-xs text-slate-500">
              {MODALITY_FORMAT_LABELS[modality.format]} · {confirmed}/{modality.max_entries} confirmados
            </p>
          </div>
          {canJoin ? (
            <Button size="sm" onClick={() => onJoin(modality)}>
              <Plus className="w-4 h-4 mr-1" /> {isAdmin ? 'Inscrever jogador' : 'Inscrever-se'}
            </Button>
          ) : (
            <Badge variant="secondary">Privado: exige código</Badge>
          )}
        </div>
        {registrations.length > 0 && (
          <div className="mt-3 arena-table-wrap">
            <table className="w-full text-sm">
              <thead className="bg-slate-50">
                <tr className="text-left">
                  <th className="px-3 py-2">Inscrição</th>
                  <th className="px-3 py-2">Status</th>
                  {isAdmin && <th className="px-3 py-2 text-right">Ações</th>}
                </tr>
              </thead>
              <tbody>
                {registrations.map((r) => (
                  <tr key={r.id} className="border-t">
                    <td className="px-3 py-2">
                      <div>{r.label || `${r.player_a_name}${r.player_b_name ? ' / ' + r.player_b_name : ''}`}</div>
                      <div className="text-xs text-slate-500">
                        {[r.player_a_email, r.player_b_email].filter(Boolean).join(' / ')}
                        {r.is_provisional ? ` · ${REGISTRATION_PROVISIONAL_LABEL.toLowerCase()}` : ''}
                      </div>
                    </td>
                    <td className="px-3 py-2">
                      <Badge variant={r.status === REGISTRATION_STATUS.CONFIRMED ? 'success' : 'secondary'}>
                        {REGISTRATION_STATUS_LABELS[r.status]}
                      </Badge>
                    </td>
                    {isAdmin && (
                      <td className="px-3 py-2 text-right space-x-1">
                        {r.status === REGISTRATION_STATUS.PENDING_PAYMENT && (
                          <Button size="icon" variant="ghost" title="Confirmar pagamento" onClick={() => confirmMutation.mutate(r.id)}>
                            <Check className="w-4 h-4 text-emerald-600" />
                          </Button>
                        )}
                        {r.status !== REGISTRATION_STATUS.CANCELLED && (
                          <Button size="icon" variant="ghost" title="Cancelar" onClick={() => cancelMutation.mutate(r.id)}>
                            <X className="w-4 h-4 text-amber-600" />
                          </Button>
                        )}
                        <Button size="icon" variant="ghost" title="Remover" onClick={() => deleteMutation.mutate(r.id)}>
                          <Trash2 className="w-4 h-4 text-red-600" />
                        </Button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
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
