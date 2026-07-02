import React, { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Trash2, UserPlus, Users, Globe, Lock, Send } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { UserAvatar } from '@/components/ui/user-avatar';
import { useAuth } from '@/core/lib/FirebaseAuthContext';
import {
  useEventInvites,
  useInviteToEvent,
  useSetEventResponse,
  useRemoveEventInvite,
  useUpdateEvent,
  useClubMembers,
} from '@/modules/clubs/hooks/useClubs';
import { useAthletes } from '@/modules/athletes/hooks/useAthletes';
import {
  INVITE_STATUS,
  INVITE_SOURCE,
  EVENT_VISIBILITY,
  isPrivateEvent,
} from '@/modules/clubs/domain/constants';
import { V2Badge, V2Button, V2EmptyState, V2Skeleton, V2Surface } from '@/v2/ui/primitives';

export default function V2EventParticipantsPanel({ event, clubId }) {
  const { user } = useAuth();
  const { data: invites = [], isLoading } = useEventInvites(event.id);
  const setResponse = useSetEventResponse(event);
  const removeInvite = useRemoveEventInvite(event.id);
  const updateEvent = useUpdateEvent(event.id);
  const [inviteOpen, setInviteOpen] = useState(false);

  const isPrivate = isPrivateEvent(event);
  const isManager = user?.uid === event.created_by;
  const myInvite = invites.find((i) => i.user_id === user?.uid);
  const myStatus = myInvite?.status;

  const amParticipant = !!myInvite && myStatus !== INVITE_STATUS.INVITED;
  const amInvited = myStatus === INVITE_STATUS.INVITED;

  const handleJoin = async () => {
    try {
      await setResponse.mutateAsync(INVITE_STATUS.GOING);
      toast.success('Você agora participa deste evento.');
    } catch (err) {
      toast.error(err.message || 'Não foi possível participar.');
    }
  };

  const handleLeave = async () => {
    try {
      await removeInvite.mutateAsync(user.uid);
      toast.success('Você saiu do evento.');
    } catch (err) {
      toast.error(err.message || 'Não foi possível sair.');
    }
  };

  const handleRemove = async (userId) => {
    try {
      await removeInvite.mutateAsync(userId);
    } catch (err) {
      toast.error(err.message || 'Não foi possível remover.');
    }
  };

  const handleVisibility = async (visibility) => {
    try {
      await updateEvent.mutateAsync({ visibility });
      toast.success(visibility === EVENT_VISIBILITY.PRIVATE ? 'Evento agora é privado.' : 'Evento agora é público.');
    } catch (err) {
      toast.error(err.message || 'Não foi possível alterar a visibilidade.');
    }
  };

  const counts = {
    participants: invites.filter((i) => i.status !== INVITE_STATUS.INVITED).length,
    invited: invites.filter((i) => i.status === INVITE_STATUS.INVITED).length,
  };

  return (
    <div className="space-y-4">
      {/* Visibilidade */}
      <V2Surface className="p-4 sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            {isPrivate ? <Lock className="h-5 w-5 text-amber-600" /> : <Globe className="h-5 w-5 text-ink" />}
            <div>
              <h3 className="font-display text-sm font-bold text-ink">{isPrivate ? 'Evento privado' : 'Evento público'}</h3>
              <p className="text-xs text-gray-500">
                {isPrivate ? 'Visível apenas para participantes e convidados.' : 'Visível para todos os atletas do clube.'}
              </p>
            </div>
          </div>
          <div className="flex gap-1.5">
            <V2Button size="sm" variant={!isPrivate ? 'primary' : 'ghost'} onClick={() => handleVisibility(EVENT_VISIBILITY.PUBLIC)} disabled={updateEvent.isPending || !isPrivate}>
              <Globe className="h-4 w-4" /> Público
            </V2Button>
            <V2Button size="sm" variant={isPrivate ? 'primary' : 'ghost'} onClick={() => handleVisibility(EVENT_VISIBILITY.PRIVATE)} disabled={updateEvent.isPending || isPrivate}>
              <Lock className="h-4 w-4" /> Privado
            </V2Button>
          </div>
        </div>
      </V2Surface>

      {/* Minha participação */}
      <V2Surface className="p-4 sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="font-display text-sm font-bold text-ink">
              {amParticipant ? 'Você participa deste evento' : amInvited ? 'Você foi convidado' : 'Participe deste evento'}
            </h3>
            <p className="text-xs text-gray-500">Confirme sua presença em cada dia de jogo na aba “Detalhes e dias de jogo”.</p>
          </div>
          {amParticipant ? (
            <V2Button size="sm" variant="ghost" onClick={handleLeave} disabled={removeInvite.isPending || isManager}>Sair do evento</V2Button>
          ) : (
            <V2Button size="sm" onClick={handleJoin} disabled={setResponse.isPending}>{amInvited ? 'Aceitar convite' : 'Participar'}</V2Button>
          )}
        </div>
      </V2Surface>

      {/* Participantes */}
      <V2Surface className="p-4 sm:p-5">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Users className="h-5 w-5 text-ink" />
            <h3 className="font-display text-base font-bold text-ink">Participantes do evento</h3>
          </div>
          <V2Button size="sm" variant="ghost" onClick={() => setInviteOpen(true)}><UserPlus className="h-4 w-4" /> Convidar atletas</V2Button>
        </div>

        <div className="mt-3 flex flex-wrap gap-2">
          <V2Badge tone="green">{counts.participants} participante(s)</V2Badge>
          <V2Badge tone="neutral">{counts.invited} convite(s) pendente(s)</V2Badge>
        </div>

        <div className="mt-4">
          {isLoading ? (
            <V2Skeleton className="h-20 rounded-3xl" />
          ) : invites.length === 0 ? (
            <V2EmptyState icon={Users} title="Sem participantes ainda" description="Convide os atletas do clube para integrarem o evento." />
          ) : (
            <div className="divide-y divide-gray-100">
              {invites.map((inv) => {
                const canRemove = isManager || inv.user_id === user?.uid;
                return (
                  <div key={inv.id} className="flex items-center justify-between gap-3 py-2">
                    <div className="flex min-w-0 items-center gap-2">
                      <UserAvatar name={inv.user_name} photoUrl={inv.user_photo} size="sm" />
                      <div className="min-w-0">
                        <div className="truncate text-sm font-bold text-ink">
                          {inv.user_name}
                          {inv.user_id === event.created_by && <span className="ml-1 text-xs text-ink">(organizador)</span>}
                        </div>
                        {inv.source === INVITE_SOURCE.PLATFORM && <div className="text-[11px] text-gray-400">Convidado da plataforma</div>}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <V2Badge tone={inv.status === INVITE_STATUS.INVITED ? 'neutral' : 'green'}>
                        {inv.status === INVITE_STATUS.INVITED ? 'Convidado' : 'Participante'}
                      </V2Badge>
                      {canRemove && inv.user_id !== event.created_by && (
                        <button onClick={() => handleRemove(inv.user_id)} className="text-gray-400 transition-colors hover:text-red-600" title="Remover">
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </V2Surface>

      <InviteDialog open={inviteOpen} onClose={() => setInviteOpen(false)} event={event} clubId={clubId} invites={invites} />
    </div>
  );
}

function InviteDialog({ open, onClose, event, clubId, invites }) {
  const invite = useInviteToEvent(event);
  const { data: members = [] } = useClubMembers(clubId);
  const { data: athletes = [] } = useAthletes();
  const [search, setSearch] = useState('');

  const invitedIds = useMemo(() => new Set(invites.map((i) => i.user_id)), [invites]);

  const clubPool = useMemo(() => {
    const map = new Map();
    members.forEach((m) => {
      if (!m.user_id || invitedIds.has(m.user_id) || map.has(m.user_id)) return;
      map.set(m.user_id, { user_id: m.user_id, user_name: m.user_name || 'Atleta', user_photo: m.photo_url || '', source: INVITE_SOURCE.CLUB });
    });
    return Array.from(map.values()).sort((a, b) => a.user_name.localeCompare(b.user_name));
  }, [members, invitedIds]);

  const platformPool = useMemo(() => {
    const memberIds = new Set(members.map((m) => m.user_id));
    const map = new Map();
    athletes.forEach((a) => {
      if (!a.id || invitedIds.has(a.id) || memberIds.has(a.id) || map.has(a.id)) return;
      map.set(a.id, { user_id: a.id, user_name: a.platform_name || 'Atleta', user_photo: a.photo_url || '', source: INVITE_SOURCE.PLATFORM });
    });
    return Array.from(map.values()).sort((a, b) => a.user_name.localeCompare(b.user_name));
  }, [athletes, members, invitedIds]);

  const q = search.trim().toLowerCase();
  const f = (p) => !q || p.user_name.toLowerCase().includes(q);

  const handleInvite = async (target) => {
    try {
      await invite.mutateAsync(target);
      toast.success(`Convite enviado para ${target.user_name}.`);
    } catch (err) {
      toast.error(err.message || 'Não foi possível convidar.');
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Convidar atletas</DialogTitle>
          <DialogDescription>
            Convide atletas do clube. Em eventos privados, você também pode convidar outros atletas da plataforma —
            eles recebem uma notificação para responder.
          </DialogDescription>
        </DialogHeader>
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar por nome…"
          className="w-full rounded-2xl border border-gray-200 bg-paper px-4 py-2.5 text-sm text-ink outline-none placeholder:text-gray-400 focus-visible:ring-4 focus-visible:ring-acid/30"
        />
        <div className="max-h-[50vh] space-y-4 overflow-y-auto">
          <Pool title="Atletas do clube" people={clubPool.filter(f)} onInvite={handleInvite} emptyText="Todos os atletas do clube já participam." />
          <Pool title="Outros atletas da plataforma" people={platformPool.filter(f)} onInvite={handleInvite} emptyText="Nenhum outro atleta disponível." />
        </div>
        <DialogFooter>
          <V2Button variant="ghost" onClick={onClose}>Fechar</V2Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Pool({ title, people, onInvite, emptyText }) {
  return (
    <div>
      <h4 className="mb-2 text-xs font-bold uppercase tracking-wide text-gray-400">{title} ({people.length})</h4>
      {people.length === 0 ? (
        <p className="text-sm text-gray-400">{emptyText}</p>
      ) : (
        <div className="space-y-1.5">
          {people.map((p) => (
            <div key={p.user_id} className="flex items-center justify-between gap-2 rounded-2xl border border-gray-100 p-2">
              <div className="flex min-w-0 items-center gap-2">
                <UserAvatar name={p.user_name} photoUrl={p.user_photo} size="sm" />
                <span className="truncate text-sm font-bold text-ink">{p.user_name}</span>
              </div>
              <V2Button size="sm" variant="ghost" onClick={() => onInvite(p)}><Send className="h-3.5 w-3.5" /> Convidar</V2Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
