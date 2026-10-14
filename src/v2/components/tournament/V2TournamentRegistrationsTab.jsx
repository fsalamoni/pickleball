import React, { useState } from 'react';
import { toast } from 'sonner';
import { V2Surface, V2Button, V2Badge, V2Select } from '@/v2/ui/primitives';
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
import { t, fmtLista } from '@/core/i18n';

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
      toast.error(t('Não foi possível gerar o CSV.'));
    }
  }

  return (
    <div className="space-y-4">
      {isAdmin && csvOn && registrations.length > 0 && (
        <div className="flex justify-end">
          <V2Button size="sm" variant="secondary" onClick={exportCsv}>
            <Download className="h-4 w-4" /> {t('Exportar inscrições (CSV)')}
          </V2Button>
        </div>
      )}
      {modalities.length === 0 ? (
        <V2Surface>
          <div className="p-6 text-sm text-gray-500 text-center">
            {t('Aguardando o admin cadastrar modalidades.')}
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
      ? t('Check-in feito: {v1}.', { v1: r.label || r.player_a_name || t('inscrição') })
      : t('Check-in desfeito. A inscrição segue confirmada.')),
    onError: (err) => toast.error(err?.message || t('Não foi possível registrar o check-in.')),
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
        ? t('{confirmed} confirmados · vagas abertas', { confirmed })
        : t('{confirmed}/{max_entries} confirmados', { confirmed, max_entries: modality.max_entries })}${checkinOn && checkedInCount > 0 ? t(' · {checkedInCount} com check-in', { checkedInCount }) : ''}`}
    >
      <div className="mb-3 flex justify-end">
        {canJoin ? (
          <V2Button size="sm" onClick={() => onJoin(modality)} disabled={slotsFull && !alreadyRegistered}>
            <Plus className="w-4 h-4 mr-1" /> {slotsFull && !alreadyRegistered ? t('Modalidade lotada') : isAdmin ? t('Inscrever jogador') : t('Inscrever-se')}
          </V2Button>
        ) : (
          <V2Badge tone="neutral">{t('Privado: exige código')}</V2Badge>
        )}
      </div>
        {ownPendingPayment && (
          <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
            <span>
              {ownPendingPayment.payment_declared_at
                ? t('Pagamento informado — aguardando confirmação do organizador.')
                : t('Sua inscrição aguarda pagamento.')}
            </span>
            <V2Button size="sm" variant="secondary" onClick={() => setPayOpen(true)}>
              {t('Ver dados de pagamento')}
            </V2Button>
          </div>
        )}
        {isAdmin && semContaCount > 0 && (
          <div className="mt-3 rounded-2xl border border-amber-200 bg-amber-50/70 p-3 text-sm text-gray-700">
            <p className="font-semibold text-ink">
              {t('{semContaCount} inscrição(ões) com jogador sem conta na plataforma', { semContaCount })}
            </p>
            <p className="mt-1 text-xs leading-5">
              {t('As partidas dessas inscrições')} <strong>{t('não entram no ranking nem no rating')}</strong> {t('— de ninguém da partida, nem do adversário. Se o jogador tem conta, toque no lápis da inscrição e escolha a conta dele: os jogos já lançados passam a contar sozinhos.')}
            </p>
          </div>
        )}
        {registrations.length > 0 && (
          <div className="mt-3 overflow-x-auto rounded-3xl border border-gray-100">
            <table className="w-full text-sm">
              <thead className="bg-paper">
                <tr className="text-left">
                  <th className="px-3 py-2">{t('Inscrição')}</th>
                  <th className="px-3 py-2">{t('Status')}</th>
                  {isAdmin && <th className="px-3 py-2 text-right">{t('Ações')}</th>}
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
                            {r.is_provisional ? ` · ${t(REGISTRATION_PROVISIONAL_LABEL).toLowerCase()}` : ''}
                          </div>
                          {isAdmin && r.status !== REGISTRATION_STATUS.CANCELLED
                            && registrationSlotsWithoutAccount(r).length > 0 && (
                            <div className="mt-0.5 text-2xs font-medium text-amber-700">
                              {fmtLista(registrationSlotsWithoutAccount(r).map((lado) => (lado === 'a' ? r.player_a_name : r.player_b_name) || t('jogador {lado}', { lado: lado.toUpperCase() })))}
                              {' '}{t('sem conta · não pontua no ranking')}
                            </div>
                          )}
                          {(() => {
                            const duprs = [duprByUid.get(r.player_a_user_id), duprByUid.get(r.player_b_user_id)].filter(Boolean);
                            return duprs.length > 0 ? (
                              <div className="text-xs text-gray-500">{t('DUPR:')} {duprs.join(' / ')}</div>
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
                        <div className="mt-1 text-2xs font-medium text-amber-700">{t('pagamento informado')}</div>
                      )}
                      {partnerInvitesOn && (() => {
                        const invite = partnerInviteBadge(r);
                        if (!invite) return null;
                        const toneClass = invite.tone === 'green'
                          ? 'text-green-700'
                          : invite.tone === 'red'
                            ? 'text-red-600'
                            : 'text-amber-700';
                        return <div className={`mt-1 text-2xs font-medium ${toneClass}`}>{invite.text.toLowerCase()}</div>;
                      })()}
                    </td>
                    {isAdmin && (
                      <td className="px-3 py-2 text-right space-x-1">
                        <V2Button size="icon" variant="ghost" title={r.kind === 'team' ? t('Editar nome e elenco da equipe') : t('Editar dados do(s) jogador(es)')} aria-label={t('Editar inscrição')} onClick={() => setEditTarget(r)}>
                          <Pencil className="w-4 h-4 text-gray-500" />
                        </V2Button>
                        {r.status === REGISTRATION_STATUS.PENDING_PAYMENT && (
                          <V2Button size="icon" variant="ghost" title={t('Confirmar pagamento')} onClick={() => confirmMutation.mutate(r.id)}>
                            <Check className="w-4 h-4 text-green-600" />
                          </V2Button>
                        )}
                        {checkinOn && r.status === REGISTRATION_STATUS.CONFIRMED && (
                          <V2Button size="icon" variant="ghost" title={t('Fazer check-in')} aria-label={t('Fazer check-in')} disabled={checkInMutation.isPending} onClick={() => setCheckIn(r, true)}>
                            <UserCheck className="w-4 h-4 text-green-600" />
                          </V2Button>
                        )}
                        {checkinOn && r.status === REGISTRATION_STATUS.CHECKED_IN && (
                          <V2Button size="icon" variant="ghost" title={t('Desfazer check-in')} aria-label={t('Desfazer check-in')} disabled={checkInMutation.isPending} onClick={() => setCheckIn(r, false)}>
                            <Undo2 className="w-4 h-4 text-amber-600" />
                          </V2Button>
                        )}
                        {waitlistOn && r.status === REGISTRATION_STATUS.WAITLIST && (
                          <V2Button size="icon" variant="ghost" title={t('Promover da lista de espera')} onClick={() => promoteMutation.mutate(r.id)}>
                            <ArrowUp className="w-4 h-4 text-green-600" />
                          </V2Button>
                        )}
                        {r.status !== REGISTRATION_STATUS.CANCELLED && (
                          <V2Button size="icon" variant="ghost" title={t('Cancelar')} onClick={() => cancelMutation.mutate(r.id)}>
                            <X className="w-4 h-4 text-amber-600" />
                          </V2Button>
                        )}
                        <ConfirmDialog
                          title={t('Remover inscrição?')}
                          description={t('A inscrição será removida permanentemente deste torneio.')}
                          confirmLabel={t('Remover')}
                          onConfirm={() => deleteMutation.mutate(r.id)}
                          trigger={(
                            <V2Button size="icon" variant="ghost" title={t('Remover')} aria-label={t('Remover inscrição')}>
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
        <Label>{t('{prefix} — Nome', { prefix })}</Label>
        <Input value={value.name} onChange={(e) => onChange({ ...value, name: e.target.value })} />
      </div>
      <div>
        <Label>{t('E-mail')}</Label>
        <Input type="email" value={value.email} onChange={(e) => onChange({ ...value, email: e.target.value })} />
      </div>
      <div>
        <Label>{t('Nível')}</Label>
        <V2Select
          className="h-10 px-3"
          value={value.level}
          onChange={(e) => onChange({ ...value, level: e.target.value })}
        >
          <option value="">{t('— sem nível —')}</option>
          {LEVEL_OPTIONS.map((o) => (
            <option key={o.code} value={o.code}>{o.label}</option>
          ))}
        </V2Select>
      </div>
      <div>
        <Label>{t('Gênero (categoria)')}</Label>
        <V2Select
          className="h-10 px-3"
          value={value.competition_gender}
          onChange={(e) => onChange({ ...value, competition_gender: e.target.value })}
        >
          <option value="">{t('— não informado —')}</option>
          {Object.entries(COMPETITION_GENDER_LABELS).map(([k, label]) => (
            <option key={k} value={k}>{label}</option>
          ))}
        </V2Select>
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
      <Label>{t('{label} — conta na plataforma', { label })}</Label>
      <p className="mb-2 text-xs text-gray-600">
        {t('Sem conta, as partidas desta inscrição não entram no ranking. Se')} {nome || t('o jogador')} {t('tem conta, escolha-a.')}
      </p>
      {picked ? (
        <div className="flex items-center justify-between gap-2 rounded-xl bg-white px-3 py-2 text-sm">
          <span className="font-semibold text-ink">{picked.name}{picked.city ? <span className="font-normal text-gray-400"> · {picked.city}</span> : null}</span>
          <V2Button size="sm" variant="ghost" onClick={() => onPick(null)}>{t('Trocar')}</V2Button>
        </div>
      ) : (
        <>
          <Input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder={t('Buscar atleta pelo nome…')} />
          {busca.trim() && (
            <div className="mt-1.5 space-y-1">
              {failed ? (
                <p className="py-2 text-xs text-red-600">{t('A lista de atletas não carregou. Feche e abra de novo para tentar.')}</p>
              ) : !ready ? (
                // Sem a lista de atletas na mão, "nenhum atleta" seria mentira
                // (docs/27-FALHA-NAO-E-VAZIO.md).
                <p className="py-2 text-xs text-gray-500">{t('A lista de atletas ainda não chegou — feche e abra de novo em instantes.')}</p>
              ) : pessoas.length === 0 ? (
                <p className="py-2 text-xs text-gray-500">{t('Nenhum atleta com esse nome. Busque só pelo primeiro nome.')}</p>
              ) : pessoas.map((p) => (
                <button
                  key={p.user_id}
                  type="button"
                  onClick={() => onPick(p)}
                  className="flex w-full items-center justify-between gap-2 rounded-lg border border-gray-100 bg-white px-3 py-1.5 text-left text-sm hover:border-gray-300"
                >
                  <span className="truncate font-medium text-ink">{p.name}</span>
                  {p.city && <span className="shrink-0 text-xs text-gray-500">{p.city}</span>}
                </button>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

/**
 * Lado que vai receber os dados OFICIAIS do cadastro (ligado agora ou
 * atualizado): no lugar dos campos, diz o que vai acontecer. Os campos não
 * aparecem porque o que se digitasse ali seria sobrescrito — e era exatamente
 * o formulário regravando nome e e-mail provisórios que desfazia a troca.
 */
function OfficialDataNote({ prefix, nome, onUndo }) {
  return (
    <div className="rounded-2xl border border-green-200 bg-green-50/70 p-3 text-sm">
      <p className="font-semibold text-ink">{prefix}: {nome}</p>
      <p className="mt-1 text-xs leading-5 text-gray-600">
        {t('Ao salvar, a inscrição passa a usar os dados do cadastro: conta, nome, e-mail, nível, categoria e foto. O e-mail provisório deixa de valer. Os jogos já lançados passam a contar no ranking.')}
      </p>
      <V2Button size="sm" variant="ghost" className="mt-1" onClick={onUndo}>{t('Desfazer')}</V2Button>
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
  // Lado JÁ ligado a uma conta: "Usar os dados do cadastro" conserta a
  // inscrição ligada antes da troca completa (nome e e-mail provisórios).
  const [atualizar, setAtualizar] = useState({ a: false, b: false });
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
  const oficial = (lado) => Boolean(contas[lado] || atualizar[lado]);
  const salvando = editMutation.isPending || linkMutation.isPending;

  async function handleSave() {
    if (!oficial('a') && !playerA.name.trim()) {
      toast.error(t('Informe o nome do jogador A.'));
      return;
    }
    if (isDoubles && !oficial('b') && !playerB.name.trim()) {
      toast.error(t('Informe o nome do jogador B.'));
      return;
    }
    try {
      // 1) Os lados digitados (nunca o que vai receber os dados oficiais).
      const editaA = !oficial('a');
      const editaB = isDoubles && !oficial('b');
      if (editaA || editaB) {
        await editMutation.mutateAsync({
          id: registration.id,
          input: { format: modality.format, player_a: editaA ? playerA : null, player_b: editaB ? playerB : null },
        });
      }
      // 2) A troca completa, pelo servidor, lado a lado.
      const lados = ['a', 'b'].filter((lado) => oficial(lado));
      const feitos = [];
      for (const lado of lados) {
        const athlete = contas[lado] || { user_id: registration[`player_${lado}_user_id`] };
        // eslint-disable-next-line no-await-in-loop
        feitos.push(await linkMutation.mutateAsync({ id: registration.id, slot: lado, athlete }));
      }
      const ligou = feitos.some((f) => !f?.refresh);
      const semEmail = feitos.some((f) => f && !f.hasEmail);
      toast.success(feitos.length === 0
        ? t('Dados da inscrição atualizados.')
        : t('{v1} com os dados do cadastro ({v2}).{v3}{v4}', { v1: ligou ? t('Inscrição ligada à conta') : t('Inscrição atualizada'), v2: fmtLista(feitos.map((f) => f?.name).filter(Boolean)), v3: ligou ? t(' As partidas dela entram no ranking em instantes.') : '', v4: semEmail ? t(' Este cadastro não tem e-mail: o contato ficou vazio.') : '' }));
      onClose();
    } catch (err) {
      toast.error(err?.message || t('Falha ao salvar os dados.'));
    }
  }

  const ladoComConta = (lado, prefix) => (
    !semConta.includes(lado) && registration[`player_${lado}_user_id`] && !atualizar[lado] ? (
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-gray-100 bg-paper p-3 text-xs text-gray-600">
        <span>{t('{prefix} está ligado a uma conta da plataforma.', { prefix })}</span>
        <V2Button size="sm" variant="secondary" onClick={() => setAtualizar((x) => ({ ...x, [lado]: true }))}>
          {t('Usar os dados do cadastro')}
        </V2Button>
      </div>
    ) : null
  );

  const blocoDoLado = (lado, prefix, value, onChange) => {
    if (contas[lado]) {
      return <OfficialDataNote prefix={prefix} nome={contas[lado].name} onUndo={() => setContas((c) => ({ ...c, [lado]: null }))} />;
    }
    if (atualizar[lado]) {
      return (
        <OfficialDataNote
          prefix={prefix}
          nome={registration[`player_${lado}_name`] || t('conta ligada')}
          onUndo={() => setAtualizar((x) => ({ ...x, [lado]: false }))}
        />
      );
    }
    return (
      <>
        <PlayerFields prefix={prefix} value={value} onChange={onChange} />
        {ladoComConta(lado, prefix)}
        {semConta.includes(lado) && (
          <AccountLinkField
            label={prefix}
            nome={registration[`player_${lado}_name`]}
            athletes={athletes}
            ready={athletesReady}
            failed={athletesFailed}
            excluded={jaInscritos}
            picked={null}
            onPick={(p) => setContas((c) => ({ ...c, [lado]: p }))}
          />
        )}
      </>
    );
  };

  return (
    <Dialog open onOpenChange={(o) => !o && !salvando && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{t('Editar dados da inscrição')}</DialogTitle>
          <DialogDescription>
            {t('Os nomes aparecem por referência nos grupos, jogos e ranking — a edição reflete em todos. Para trocar um inscrito provisório pelo atleta que se cadastrou, escolha a conta dele.')}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          {blocoDoLado('a', t('Jogador A'), playerA, setPlayerA)}
          {isDoubles && (
            <div className="space-y-4 border-t pt-3">
              {blocoDoLado('b', t('Jogador B'), playerB, setPlayerB)}
            </div>
          )}
        </div>
        <DialogFooter>
          <V2Button variant="ghost" onClick={onClose} disabled={salvando}>{t('Cancelar')}</V2Button>
          <V2Button onClick={handleSave} disabled={salvando}>
            {salvando ? t('Salvando…') : t('Salvar')}
          </V2Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
