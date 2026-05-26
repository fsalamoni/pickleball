import React, { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Plus, Check, X, Trash2 } from 'lucide-react';
import {
  useModalities,
  useRegistrationsByTournament,
  useConfirmRegistrationPayment,
  useCancelRegistration,
  useDeleteRegistration,
} from '@/modules/tournament/hooks/useTournament';
import {
  REGISTRATION_STATUS,
  REGISTRATION_STATUS_LABELS,
  MODALITY_FORMAT_LABELS,
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
  const cancelMutation = useCancelRegistration(modality.id);
  const deleteMutation = useDeleteRegistration(modality.id);
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
