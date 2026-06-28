import React, { useState } from 'react';
import { toast } from 'sonner';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
import { AvatarGroup } from '@/components/ui/user-avatar';
import { Plus, Check, X, Trash2, ArrowUp, Pencil } from 'lucide-react';
import {
  useModalities,
  useRegistrationsByTournament,
  useConfirmRegistrationPayment,
  usePromoteFromWaitlist,
  useCancelRegistration,
  useDeleteRegistration,
  useEditRegistration,
} from '@/modules/tournament/hooks/useTournament';
import { useFeatureFlag } from '@/core/lib/FeatureFlagsContext';
import { FEATURE_FLAG } from '@/core/featureFlags';
import ConfirmDialog from '@/components/ConfirmDialog';
import { LEVEL_OPTIONS } from '@/modules/leveling/data/levels';
import {
  REGISTRATION_STATUS,
  REGISTRATION_STATUS_LABELS,
  MODALITY_FORMAT,
  MODALITY_FORMAT_LABELS,
  COMPETITION_GENDER_LABELS,
  TOURNAMENT_VISIBILITY,
  REGISTRATION_PROVISIONAL_LABEL,
} from '@/modules/tournament/domain/constants';
import {
  countOccupiedRegistrations,
  hasUnlimitedEntries,
  isRegistrationCapacityReached,
} from '@/modules/tournament/domain/capacity';
import { useAuth } from '@/core/lib/FirebaseAuthContext';
import ModalityRegistrationDialog from './ModalityRegistrationDialog';

export default function TournamentRegistrationsTab({ tournament, isAdmin }) {
  const { user } = useAuth();
  const { data: modalities = [] } = useModalities(tournament.id);
  const { data: registrations = [] } = useRegistrationsByTournament(tournament.id);
  const [openModalityId, setOpenModalityId] = useState(null);
  const openModality = modalities.find((m) => m.id === openModalityId) || null;

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
            onJoin={(m) => setOpenModalityId(m.id)}
          />
        ))
      )}

      <ModalityRegistrationDialog
        modality={openModality}
        tournament={tournament}
        isAdmin={isAdmin}
        open={Boolean(openModality)}
        onClose={() => setOpenModalityId(null)}
      />
    </div>
  );
}

function ModalityRegistrationsBlock({ tournament, modality, registrations, isAdmin, currentUserId, onJoin }) {
  const confirmMutation = useConfirmRegistrationPayment(modality.id);
  const promoteMutation = usePromoteFromWaitlist(modality.id);
  const cancelMutation = useCancelRegistration(modality.id);
  const deleteMutation = useDeleteRegistration(modality.id);
  const waitlistOn = useFeatureFlag(FEATURE_FLAG.TOURNAMENT_WAITLIST);
  const [editTarget, setEditTarget] = useState(null);
  const confirmed = registrations.filter((r) => r.status === REGISTRATION_STATUS.CONFIRMED).length;
  const occupied = countOccupiedRegistrations(registrations);
  const hasPrivateAccess = typeof window !== 'undefined' && Boolean(sessionStorage.getItem(`tournament_access_${tournament.id}`));
  const isPublic = (tournament.visibility || TOURNAMENT_VISIBILITY.PRIVATE) === TOURNAMENT_VISIBILITY.PUBLIC;
  const alreadyRegistered = registrations.some((r) => (
    r.user_id === currentUserId ||
    r.player_a_user_id === currentUserId ||
    r.player_b_user_id === currentUserId
  ));
  const canJoin = isAdmin || isPublic || hasPrivateAccess || alreadyRegistered;
  const slotsFull = isRegistrationCapacityReached(occupied, modality.max_entries);

  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-2 flex-wrap">
          <div>
            <h4 className="font-semibold">{modality.name}</h4>
            <p className="text-xs text-slate-500">
              {MODALITY_FORMAT_LABELS[modality.format]} · {hasUnlimitedEntries(modality.max_entries)
                ? `${confirmed} confirmados · vagas abertas`
                : `${confirmed}/${modality.max_entries} confirmados`}
            </p>
          </div>
          {canJoin ? (
            <Button size="sm" onClick={() => onJoin(modality)} disabled={slotsFull && !alreadyRegistered}>
              <Plus className="w-4 h-4 mr-1" /> {slotsFull && !alreadyRegistered ? 'Modalidade lotada' : isAdmin ? 'Inscrever jogador' : 'Inscrever-se'}
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
                      <div className="flex items-center gap-2">
                        <AvatarGroup
                          size="sm"
                          people={[
                            { name: r.player_a_name, photoUrl: r.player_a_photo },
                            ...(r.player_b_name ? [{ name: r.player_b_name, photoUrl: r.player_b_photo }] : []),
                          ]}
                        />
                        <div className="min-w-0">
                          <div>{r.label || `${r.player_a_name}${r.player_b_name ? ' / ' + r.player_b_name : ''}`}</div>
                          <div className="text-xs text-slate-500">
                            {[r.player_a_email, r.player_b_email].filter(Boolean).join(' / ')}
                            {r.is_provisional ? ` · ${REGISTRATION_PROVISIONAL_LABEL.toLowerCase()}` : ''}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-2">
                      <Badge variant={r.status === REGISTRATION_STATUS.CONFIRMED ? 'success' : 'secondary'}>
                        {REGISTRATION_STATUS_LABELS[r.status]}
                      </Badge>
                    </td>
                    {isAdmin && (
                      <td className="px-3 py-2 text-right space-x-1">
                        <Button size="icon" variant="ghost" title="Editar dados do(s) jogador(es)" aria-label="Editar inscrição" onClick={() => setEditTarget(r)}>
                          <Pencil className="w-4 h-4 text-slate-600" />
                        </Button>
                        {r.status === REGISTRATION_STATUS.PENDING_PAYMENT && (
                          <Button size="icon" variant="ghost" title="Confirmar pagamento" onClick={() => confirmMutation.mutate(r.id)}>
                            <Check className="w-4 h-4 text-emerald-600" />
                          </Button>
                        )}
                        {waitlistOn && r.status === REGISTRATION_STATUS.WAITLIST && (
                          <Button size="icon" variant="ghost" title="Promover da lista de espera" onClick={() => promoteMutation.mutate(r.id)}>
                            <ArrowUp className="w-4 h-4 text-emerald-600" />
                          </Button>
                        )}
                        {r.status !== REGISTRATION_STATUS.CANCELLED && (
                          <Button size="icon" variant="ghost" title="Cancelar" onClick={() => cancelMutation.mutate(r.id)}>
                            <X className="w-4 h-4 text-amber-600" />
                          </Button>
                        )}
                        <ConfirmDialog
                          title="Remover inscrição?"
                          description="A inscrição será removida permanentemente deste torneio."
                          confirmLabel="Remover"
                          onConfirm={() => deleteMutation.mutate(r.id)}
                          trigger={(
                            <Button size="icon" variant="ghost" title="Remover" aria-label="Remover inscrição">
                              <Trash2 className="w-4 h-4 text-red-600" />
                            </Button>
                          )}
                        />
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>

      {editTarget && (
        <RegistrationEditDialog
          registration={editTarget}
          modality={modality}
          onClose={() => setEditTarget(null)}
        />
      )}
    </Card>
  );
}

function PlayerFields({ prefix, value, onChange }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      <div className="sm:col-span-2">
        <Label>{prefix} — Nome</Label>
        <Input value={value.name} onChange={(e) => onChange({ ...value, name: e.target.value })} />
      </div>
      <div>
        <Label>E-mail</Label>
        <Input type="email" value={value.email} onChange={(e) => onChange({ ...value, email: e.target.value })} />
      </div>
      <div>
        <Label>Nível</Label>
        <select
          className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
          value={value.level}
          onChange={(e) => onChange({ ...value, level: e.target.value })}
        >
          <option value="">— sem nível —</option>
          {LEVEL_OPTIONS.map((o) => (
            <option key={o.code} value={o.code}>{o.label}</option>
          ))}
        </select>
      </div>
      <div>
        <Label>Gênero (categoria)</Label>
        <select
          className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
          value={value.competition_gender}
          onChange={(e) => onChange({ ...value, competition_gender: e.target.value })}
        >
          <option value="">— não informado —</option>
          {Object.entries(COMPETITION_GENDER_LABELS).map(([k, label]) => (
            <option key={k} value={k}>{label}</option>
          ))}
        </select>
      </div>
    </div>
  );
}

function RegistrationEditDialog({ registration, modality, onClose }) {
  const editMutation = useEditRegistration(modality.id);
  const isDoubles = modality.format === MODALITY_FORMAT.DOUBLES;
  const [playerA, setPlayerA] = useState({
    name: registration.player_a_name || '',
    email: registration.player_a_email || '',
    level: registration.player_a_level || '',
    competition_gender: registration.player_a_competition_gender || '',
  });
  const [playerB, setPlayerB] = useState({
    name: registration.player_b_name || '',
    email: registration.player_b_email || '',
    level: registration.player_b_level || '',
    competition_gender: registration.player_b_competition_gender || '',
  });

  async function handleSave() {
    if (!playerA.name.trim()) {
      toast.error('Informe o nome do jogador A.');
      return;
    }
    if (isDoubles && !playerB.name.trim()) {
      toast.error('Informe o nome do jogador B.');
      return;
    }
    try {
      await editMutation.mutateAsync({
        id: registration.id,
        input: { format: modality.format, player_a: playerA, player_b: isDoubles ? playerB : null },
      });
      toast.success('Dados da inscrição atualizados.');
      onClose();
    } catch (err) {
      toast.error(err?.message || 'Falha ao salvar os dados.');
    }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Editar dados da inscrição</DialogTitle>
          <DialogDescription>
            Os nomes aparecem por referência nos grupos, jogos e ranking — a edição reflete em todos.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <PlayerFields prefix="Jogador A" value={playerA} onChange={setPlayerA} />
          {isDoubles && (
            <div className="border-t pt-3">
              <PlayerFields prefix="Jogador B" value={playerB} onChange={setPlayerB} />
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={handleSave} disabled={editMutation.isPending}>
            {editMutation.isPending ? 'Salvando…' : 'Salvar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
