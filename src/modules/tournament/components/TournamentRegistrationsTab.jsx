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
} from '@/modules/tournament/domain/constants';
import { useAuth } from '@/core/lib/FirebaseAuthContext';

export default function TournamentRegistrationsTab({ tournament, isAdmin }) {
  const { user, userProfile } = useAuth();
  const { data: modalities = [] } = useModalities(tournament.id);
  const { data: registrations = [] } = useRegistrationsByTournament(tournament.id);
  const [open, setOpen] = useState(false);
  const [selectedModalityId, setSelectedModalityId] = useState('');
  const [form, setForm] = useState({ player_a_name: '', player_b_name: '' });
  const createMutation = useCreateRegistration();

  const selectedModality = modalities.find((m) => m.id === selectedModalityId);

  function openDialog(modality) {
    setSelectedModalityId(modality.id);
    setForm({
      player_a_name: userProfile?.platform_name || user?.displayName || user?.email || '',
      player_b_name: '',
    });
    setOpen(true);
  }

  async function handleSubmit() {
    if (!selectedModality) return;
    if (!form.player_a_name.trim()) return toast.error('Informe o nome do jogador A.');
    if (selectedModality.format === MODALITY_FORMAT.DOUBLES && !form.player_b_name.trim()) {
      return toast.error('Informe o nome da dupla (jogador B).');
    }
    try {
      await createMutation.mutateAsync({
        tournament_id: tournament.id,
        modality_id: selectedModality.id,
        player_a: { name: form.player_a_name, user_id: user?.uid },
        player_b:
          selectedModality.format === MODALITY_FORMAT.DOUBLES
            ? { name: form.player_b_name }
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
            isAdmin={isAdmin}
            onJoin={openDialog}
          />
        ))
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Inscrever-se em {selectedModality?.name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Seu nome (Jogador A)</Label>
              <Input value={form.player_a_name} onChange={(e) => setForm((f) => ({ ...f, player_a_name: e.target.value }))} />
            </div>
            {selectedModality?.format === MODALITY_FORMAT.DOUBLES && (
              <div>
                <Label>Parceiro(a) (Jogador B)</Label>
                <Input value={form.player_b_name} onChange={(e) => setForm((f) => ({ ...f, player_b_name: e.target.value }))} />
              </div>
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

function ModalityRegistrationsBlock({ modality, registrations, isAdmin, onJoin }) {
  const confirmMutation = useConfirmRegistrationPayment(modality.id);
  const cancelMutation = useCancelRegistration(modality.id);
  const deleteMutation = useDeleteRegistration(modality.id);
  const confirmed = registrations.filter((r) => r.status === REGISTRATION_STATUS.CONFIRMED).length;

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
          <Button size="sm" onClick={() => onJoin(modality)}>
            <Plus className="w-4 h-4 mr-1" /> Inscrever-se
          </Button>
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
                    <td className="px-3 py-2">{r.label || `${r.player_a_name}${r.player_b_name ? ' / ' + r.player_b_name : ''}`}</td>
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
