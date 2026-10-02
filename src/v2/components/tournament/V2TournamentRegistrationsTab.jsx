import React, { useState } from 'react';
import { toast } from 'sonner';
import { V2Surface, V2Button, V2Badge } from '@/v2/ui/primitives';
import V2Collapsible from '@/v2/components/tournament/V2Collapsible';


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
import { Plus, Check, X, Trash2, ArrowUp, Pencil, UserCheck, Undo2, Download } from 'lucide-react';
import {
  useModalities,
  useRegistrationsByTournament,
  useRegistrationContacts,
  useConfirmRegistrationPayment,
  usePromoteFromWaitlist,
  useCancelRegistration,
  useDeleteRegistration,
  useEditRegistration,
  useLinkRegistrationPlayer,
  useSetRegistrationCheckIn,
} from '@/modules/tournament/hooks/useTournament';
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
import { buildRegistrationsCsv, registrationsCsvFilename } from '@/modules/tournament/domain/registrations_csv';
import {
  countOccupiedRegistrations,
  hasUnlimitedEntries,
  isRegistrationCapacityReached,
} from '@/modules/tournament/domain/capacity';
import { useAuth } from '@/core/lib/FirebaseAuthContext';
import { useAthletes } from '@/modules/athletes/hooks/useAthletes';
import ModalityRegistrationDialog from '@/modules/tournament/components/ModalityRegistrationDialog';
import { registrationIncludesUid } from '@/modules/tournament/domain/teamFormat';
import TeamRegistrationDialog from '@/v2/components/tournament/TeamRegistrationDialog';
import PixPaymentDialog from '@/modules/tournament/components/PixPaymentDialog';
import { tournamentHasPixConfig } from '@/modules/tournament/domain/payment';
import { partnerInviteBadge } from '@/modules/tournament/domain/partnerInvite';
import { resolveRegistrationContact } from '@/modules/tournament/domain/registrationContact';
import { hasCheckedIn, isActiveRegistration } from '@/modules/tournament/domain/checkin';
import { registrationSlotsWithoutAccount } from '@/modules/tournament/domain/registrationAccounts';
import { isTournamentRankingEligible } from '@/modules/tournament/domain/rankingEligibility';

export default function TournamentRegistrationsTab({ tournament, isAdmin }) {
  const { user } = useAuth();
  const { data: modalities = [] } = useModalities(tournament.id);
  const { data: registrations = [] } = useRegistrationsByTournament(tournament.id);
  // P0-02: o e-mail não está mais no documento público da inscrição. Quem
  // organiza continua vendo — a subcoleção privada é lida só aqui, e só por
  // quem tem direito. Espectador não busca nada.
  const { data: contacts } = useRegistrationContacts(registrations, isAdmin);
  const csvOn = true;
  const [openModalityId, setOpenModalityId] = useState(null);
  const openModality = modalities.find((m) => m.id === openModalityId) || null;

  function exportCsv() {
    const content = buildRegistrationsCsv(registrations, {
      modalities,
      statusLabels: REGISTRATION_STATUS_LABELS,
      contacts,
    });
    try {
      const blob = new Blob([content], { type: 'text/csv;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = registrationsCsvFilename(tournament.name);
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      toast.error('Não foi possível gerar o CSV.');
    }
  }

  return (
    <div className="space-y-4">
      {isAdmin && csvOn && registrations.length > 0 && (
        <div className="flex justify-end">
          <V2Button size="sm" variant="secondary" onClick={exportCsv}>
            <Download className="h-4 w-4" /> Exportar inscrições (CSV)
          </V2Button>
        </div>
      )}
      {modalities.length === 0 ? (
        <V2Surface>
          <div className="p-6 text-sm text-gray-500 text-center">
            Aguardando o admin cadastrar modalidades.
          </div>
        </V2Surface>
      ) : (
        modalities.map((modality) => (
          <ModalityRegistrationsBlock
            contacts={contacts}
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

function ModalityRegistrationsBlock({ tournament, modality, registrations, isAdmin, currentUserId, onJoin, contacts }) {
  const { data: allAthletes = [], isSuccess: atletasCarregados, isError: atletasFalharam } = useAthletes();
  const duprByUid = React.useMemo(() => {
    const m = new Map();
    allAthletes.forEach((a) => { if (a.dupr_id) m.set(a.id, a.dupr_id); });
    return m;
  }, [allAthletes]);
  const confirmMutation = useConfirmRegistrationPayment(modality.id);
  const promoteMutation = usePromoteFromWaitlist(modality.id);
  const cancelMutation = useCancelRegistration(modality.id);
  const deleteMutation = useDeleteRegistration(modality.id);
  const checkInMutation = useSetRegistrationCheckIn(modality.id);
  // O check-in é opcional e só confirma presença: a inscrição continua jogando
  // igual (`isActiveRegistration`). Falha não passa calada.
  const setCheckIn = (r, checkedIn) => checkInMutation.mutate({ id: r.id, checkedIn }, {
    onSuccess: () => toast.success(checkedIn
      ? `Check-in feito: ${r.label || r.player_a_name || 'inscrição'}.`
      : 'Check-in desfeito. A inscrição segue confirmada.'),
    onError: (err) => toast.error(err?.message || 'Não foi possível registrar o check-in.'),
  });
  const waitlistOn = true;
  const checkinOn = true;
  const paymentOn = true;
  const partnerInvitesOn = true;
  const [editTarget, setEditTarget] = useState(null);
  const [payOpen, setPayOpen] = useState(false);
  // Inscrição pendente de pagamento do próprio usuário (flag payment_instructions).
  const ownPendingPayment = paymentOn && tournamentHasPixConfig(tournament)
    ? registrations.find((r) => (
        r.status === REGISTRATION_STATUS.PENDING_PAYMENT
        && currentUserId
        && (r.created_by === currentUserId || r.player_a_user_id === currentUserId)
      )) || null
    : null;
  const checkedInCount = registrations.filter(hasCheckedIn).length;
  // Só vale avisar quando o ranking LERIA estas partidas: num torneio em
  // rascunho ou privado nada pontua, com ou sem conta.
  const semContaCount = isTournamentRankingEligible(tournament)
    ? registrations.filter((r) => r.status !== REGISTRATION_STATUS.CANCELLED
      && registrationSlotsWithoutAccount(r).length > 0).length
    : 0;
  const confirmed = registrations.filter(isActiveRegistration).length;
  const occupied = countOccupiedRegistrations(registrations);
  const hasPrivateAccess = typeof window !== 'undefined' && Boolean(sessionStorage.getItem(`tournament_access_${tournament.id}`));
  const isPublic = (tournament.visibility || TOURNAMENT_VISIBILITY.PRIVATE) === TOURNAMENT_VISIBILITY.PUBLIC;
  const alreadyRegistered = registrations.some((r) => registrationIncludesUid(r, currentUserId));
  const canJoin = isAdmin || isPublic || hasPrivateAccess || alreadyRegistered;
  const slotsFull = isRegistrationCapacityReached(occupied, modality.max_entries);

  return (
    <V2Collapsible
      defaultOpen={false}
      persistId={`insc:${modality.id}`}
      title={modality.name}
      subtitle={`${MODALITY_FORMAT_LABELS[modality.format]} · ${hasUnlimitedEntries(modality.max_entries)
        ? `${confirmed} confirmados · vagas abertas`
        : `${confirmed}/${modality.max_entries} confirmados`}${checkinOn && checkedInCount > 0 ? ` · ${checkedInCount} com check-in` : ''}`}
    >
      <div className="mb-3 flex justify-end">
        {canJoin ? (
          <V2Button size="sm" onClick={() => onJoin(modality)} disabled={slotsFull && !alreadyRegistered}>
            <Plus className="w-4 h-4 mr-1" /> {slotsFull && !alreadyRegistered ? 'Modalidade lotada' : isAdmin ? 'Inscrever jogador' : 'Inscrever-se'}
          </V2Button>
        ) : (
          <V2Badge tone="neutral">Privado: exige código</V2Badge>
        )}
      </div>
        {ownPendingPayment && (
          <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
            <span>
              {ownPendingPayment.payment_declared_at
                ? 'Pagamento informado — aguardando confirmação do organizador.'
                : 'Sua inscrição aguarda pagamento.'}
            </span>
            <V2Button size="sm" variant="secondary" onClick={() => setPayOpen(true)}>
              Ver dados de pagamento
            </V2Button>
          </div>
        )}
        {isAdmin && semContaCount > 0 && (
          <div className="mt-3 rounded-2xl border border-amber-200 bg-amber-50/70 p-3 text-sm text-gray-700">
            <p className="font-semibold text-ink">
              {semContaCount} inscrição(ões) com jogador sem conta na plataforma
            </p>
            <p className="mt-1 text-xs leading-5">
              As partidas dessas inscrições <strong>não entram no ranking nem no rating</strong> — de
              ninguém da partida, nem do adversário. Se o jogador tem conta, toque no lápis da
              inscrição e escolha a conta dele: os jogos já lançados passam a contar sozinhos.
            </p>
          </div>
        )}
        {registrations.length > 0 && (
          <div className="mt-3 overflow-x-auto rounded-3xl border border-gray-100">
            <table className="w-full text-sm">
              <thead className="bg-paper">
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
                          people={r.kind === 'team'
                            ? (r.members || []).map((m) => ({ name: m.name, photoUrl: m.photo_url }))
                            : [
                              { name: r.player_a_name, photoUrl: r.player_a_photo },
                              ...(r.player_b_name ? [{ name: r.player_b_name, photoUrl: r.player_b_photo }] : []),
                            ]}
                        />
                        <div className="min-w-0">
                          <div>{r.label || `${r.player_a_name}${r.player_b_name ? ' / ' + r.player_b_name : ''}`}</div>
                          <div className="text-xs text-gray-500">
                            {r.kind === 'team'
                              ? (r.members || []).map((m) => m.name).join(', ')
                              : (() => {
                                const c = resolveRegistrationContact(r, contacts?.get?.(r.id) || null);
                                return [c.player_a_email, c.player_b_email].filter(Boolean).join(' / ');
                              })()}
                            {r.is_provisional ? ` · ${REGISTRATION_PROVISIONAL_LABEL.toLowerCase()}` : ''}
                          </div>
                          {isAdmin && r.status !== REGISTRATION_STATUS.CANCELLED
                            && registrationSlotsWithoutAccount(r).length > 0 && (
                            <div className="mt-0.5 text-[11px] font-medium text-amber-700">
                              {registrationSlotsWithoutAccount(r).map((lado) => (lado === 'a' ? r.player_a_name : r.player_b_name) || `jogador ${lado.toUpperCase()}`).join(' e ')}
                              {' '}sem conta · não pontua no ranking
                            </div>
                          )}
                          {(() => {
                            const duprs = [duprByUid.get(r.player_a_user_id), duprByUid.get(r.player_b_user_id)].filter(Boolean);
                            return duprs.length > 0 ? (
                              <div className="text-xs text-gray-500">DUPR: {duprs.join(' / ')}</div>
                            ) : null;
                          })()}
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-2">
                      <V2Badge tone={isActiveRegistration(r) ? 'green' : 'neutral'}>
                        {REGISTRATION_STATUS_LABELS[r.status] || r.status}
                      </V2Badge>
                      {paymentOn && isAdmin && r.status === REGISTRATION_STATUS.PENDING_PAYMENT && r.payment_declared_at && (
                        <div className="mt-1 text-[11px] font-medium text-amber-700">pagamento informado</div>
                      )}
                      {partnerInvitesOn && (() => {
                        const invite = partnerInviteBadge(r);
                        if (!invite) return null;
                        const toneClass = invite.tone === 'green'
                          ? 'text-green-700'
                          : invite.tone === 'red'
                            ? 'text-red-600'
                            : 'text-amber-700';
                        return <div className={`mt-1 text-[11px] font-medium ${toneClass}`}>{invite.text.toLowerCase()}</div>;
                      })()}
                    </td>
                    {isAdmin && (
                      <td className="px-3 py-2 text-right space-x-1">
                        <V2Button size="icon" variant="ghost" title={r.kind === 'team' ? 'Editar nome e elenco da equipe' : 'Editar dados do(s) jogador(es)'} aria-label="Editar inscrição" onClick={() => setEditTarget(r)}>
                          <Pencil className="w-4 h-4 text-gray-500" />
                        </V2Button>
                        {r.status === REGISTRATION_STATUS.PENDING_PAYMENT && (
                          <V2Button size="icon" variant="ghost" title="Confirmar pagamento" onClick={() => confirmMutation.mutate(r.id)}>
                            <Check className="w-4 h-4 text-green-600" />
                          </V2Button>
                        )}
                        {checkinOn && r.status === REGISTRATION_STATUS.CONFIRMED && (
                          <V2Button size="icon" variant="ghost" title="Fazer check-in" aria-label="Fazer check-in" disabled={checkInMutation.isPending} onClick={() => setCheckIn(r, true)}>
                            <UserCheck className="w-4 h-4 text-green-600" />
                          </V2Button>
                        )}
                        {checkinOn && r.status === REGISTRATION_STATUS.CHECKED_IN && (
                          <V2Button size="icon" variant="ghost" title="Desfazer check-in" aria-label="Desfazer check-in" disabled={checkInMutation.isPending} onClick={() => setCheckIn(r, false)}>
                            <Undo2 className="w-4 h-4 text-amber-600" />
                          </V2Button>
                        )}
                        {waitlistOn && r.status === REGISTRATION_STATUS.WAITLIST && (
                          <V2Button size="icon" variant="ghost" title="Promover da lista de espera" onClick={() => promoteMutation.mutate(r.id)}>
                            <ArrowUp className="w-4 h-4 text-green-600" />
                          </V2Button>
                        )}
                        {r.status !== REGISTRATION_STATUS.CANCELLED && (
                          <V2Button size="icon" variant="ghost" title="Cancelar" onClick={() => cancelMutation.mutate(r.id)}>
                            <X className="w-4 h-4 text-amber-600" />
                          </V2Button>
                        )}
                        <ConfirmDialog
                          title="Remover inscrição?"
                          description="A inscrição será removida permanentemente deste torneio."
                          confirmLabel="Remover"
                          onConfirm={() => deleteMutation.mutate(r.id)}
                          trigger={(
                            <V2Button size="icon" variant="ghost" title="Remover" aria-label="Remover inscrição">
                              <Trash2 className="w-4 h-4 text-red-600" />
                            </V2Button>
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
      {/* Inscrição-EQUIPE: edita nome e elenco no modal de equipes (o formulário
          de jogador A/B não se aplica). */}
      {editTarget && editTarget.kind === 'team' && (
        <TeamRegistrationDialog
          open
          tournament={tournament}
          modality={modality}
          editingTeam={editTarget}
          onClose={() => setEditTarget(null)}
        />
      )}
      {editTarget && editTarget.kind !== 'team' && (
        <RegistrationEditDialog
          registration={editTarget}
          modality={modality}
          registrations={registrations}
          athletes={allAthletes}
          athletesReady={atletasCarregados}
          athletesFailed={atletasFalharam}
          contact={contacts?.get?.(editTarget.id) || null}
          onClose={() => setEditTarget(null)}
        />
      )}

      {ownPendingPayment && payOpen && (
        <PixPaymentDialog
          open
          onClose={() => setPayOpen(false)}
          tournament={tournament}
          modality={modality}
          registrationId={ownPendingPayment.id}
          paymentDeclared={Boolean(ownPendingPayment.payment_declared_at)}
        />
      )}
    </V2Collapsible>
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

/**
 * Escolhe a CONTA de um jogador que foi inscrito só pelo nome. Só aparece para
 * o lado sem conta — trocar a conta de quem já tem uma transferiria resultados
 * de uma pessoa para outra, e isso não se faz por um lápis.
 */
function AccountLinkField({ label, nome, athletes, ready, failed, excluded, onPick, picked }) {
  const [busca, setBusca] = useState(nome || '');
  const pessoas = React.useMemo(() => {
    const q = busca.trim().toLowerCase();
    if (!q) return [];
    return athletes
      .filter((a) => a.id && !excluded.has(a.id))
      .map((a) => ({ user_id: a.id, name: a.platform_name || a.full_name || 'Atleta', photo_url: a.photo_url || '', city: a.city || '' }))
      .filter((a) => a.name.toLowerCase().includes(q))
      .sort((x, y) => x.name.localeCompare(y.name, 'pt-BR'))
      .slice(0, 6);
  }, [athletes, excluded, busca]);

  return (
    <div className="rounded-2xl border border-amber-200 bg-amber-50/60 p-3">
      <Label>{label} — conta na plataforma</Label>
      <p className="mb-2 text-xs text-gray-600">
        Sem conta, as partidas desta inscrição não entram no ranking. Se {nome || 'o jogador'} tem conta, escolha-a.
      </p>
      {picked ? (
        <div className="flex items-center justify-between gap-2 rounded-xl bg-white px-3 py-2 text-sm">
          <span className="font-semibold text-ink">{picked.name}{picked.city ? <span className="font-normal text-gray-400"> · {picked.city}</span> : null}</span>
          <V2Button size="sm" variant="ghost" onClick={() => onPick(null)}>Trocar</V2Button>
        </div>
      ) : (
        <>
          <Input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar atleta pelo nome…" />
          {busca.trim() && (
            <div className="mt-1.5 space-y-1">
              {failed ? (
                <p className="py-2 text-xs text-red-600">A lista de atletas não carregou. Feche e abra de novo para tentar.</p>
              ) : !ready ? (
                // Sem a lista de atletas na mão, "nenhum atleta" seria mentira
                // (docs/27-FALHA-NAO-E-VAZIO.md).
                <p className="py-2 text-xs text-gray-500">A lista de atletas ainda não chegou — feche e abra de novo em instantes.</p>
              ) : pessoas.length === 0 ? (
                <p className="py-2 text-xs text-gray-500">Nenhum atleta com esse nome. Busque só pelo primeiro nome.</p>
              ) : pessoas.map((p) => (
                <button
                  key={p.user_id}
                  type="button"
                  onClick={() => onPick(p)}
                  className="flex w-full items-center justify-between gap-2 rounded-lg border border-gray-100 bg-white px-3 py-1.5 text-left text-sm hover:border-gray-300"
                >
                  <span className="truncate font-medium text-ink">{p.name}</span>
                  {p.city && <span className="shrink-0 text-xs text-gray-400">{p.city}</span>}
                </button>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

function RegistrationEditDialog({
  registration, modality, onClose, contact = null, registrations = [], athletes = [], athletesReady = false, athletesFailed = false,
}) {
  const editMutation = useEditRegistration(modality.id);
  const linkMutation = useLinkRegistrationPlayer(modality.id);
  const semConta = registrationSlotsWithoutAccount(registration);
  const [contas, setContas] = useState({ a: null, b: null });
  // Quem já está em alguma inscrição desta modalidade não pode ser escolhido
  // de novo (seria a mesma pessoa em duas inscrições).
  const jaInscritos = React.useMemo(() => {
    const set = new Set();
    registrations.forEach((r) => {
      if (r.status === REGISTRATION_STATUS.CANCELLED) return;
      if (r.player_a_user_id) set.add(r.player_a_user_id);
      if (r.player_b_user_id) set.add(r.player_b_user_id);
    });
    if (contas.a) set.add(contas.a.user_id);
    if (contas.b) set.add(contas.b.user_id);
    return set;
  }, [registrations, contas]);
  const isDoubles = modality.format === MODALITY_FORMAT.DOUBLES;
  // P0-02: o e-mail vem da subcoleção privada; `resolve` cai no campo público
  // enquanto existirem inscrições legadas.
  const contato = resolveRegistrationContact(registration, contact);
  const [playerA, setPlayerA] = useState({
    name: registration.player_a_name || '',
    email: contato.player_a_email || '',
    level: registration.player_a_level || '',
    competition_gender: registration.player_a_competition_gender || '',
  });
  const [playerB, setPlayerB] = useState({
    name: registration.player_b_name || '',
    email: contato.player_b_email || '',
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
      const vinculos = ['a', 'b'].filter((lado) => contas[lado]);
      for (const lado of vinculos) {
        // eslint-disable-next-line no-await-in-loop
        await linkMutation.mutateAsync({ id: registration.id, slot: lado, athlete: contas[lado] });
      }
      toast.success(vinculos.length > 0
        ? 'Inscrição atualizada e ligada à conta. As partidas dela entram no ranking em instantes.'
        : 'Dados da inscrição atualizados.');
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
          {semConta.includes('a') && (
            <AccountLinkField
              label="Jogador A"
              nome={registration.player_a_name}
              athletes={athletes}
              ready={athletesReady}
              failed={athletesFailed}
              excluded={jaInscritos}
              picked={contas.a}
              onPick={(p) => setContas((c) => ({ ...c, a: p }))}
            />
          )}
          {isDoubles && (
            <div className="space-y-4 border-t pt-3">
              <PlayerFields prefix="Jogador B" value={playerB} onChange={setPlayerB} />
              {semConta.includes('b') && (
                <AccountLinkField
                  label="Jogador B"
                  nome={registration.player_b_name}
                  athletes={athletes}
                  ready={athletesReady}
                  failed={athletesFailed}
                  excluded={jaInscritos}
                  picked={contas.b}
                  onPick={(p) => setContas((c) => ({ ...c, b: p }))}
                />
              )}
            </div>
          )}
        </div>
        <DialogFooter>
          <V2Button variant="ghost" onClick={onClose}>Cancelar</V2Button>
          <V2Button onClick={handleSave} disabled={editMutation.isPending || linkMutation.isPending}>
            {editMutation.isPending || linkMutation.isPending ? 'Salvando…' : 'Salvar'}
          </V2Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
