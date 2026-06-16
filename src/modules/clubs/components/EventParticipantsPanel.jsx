import React, { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Trash2, UserPlus, Users, Globe, Lock, Send } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/ui/empty-state';
import { UserAvatar } from '@/components/ui/user-avatar';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
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
  RSVP_STATUS,
  RSVP_STATUS_LABELS,
  INVITE_STATUS,
  INVITE_STATUS_LABELS,
  INVITE_SOURCE,
  EVENT_VISIBILITY,
  isPrivateEvent,
} from '@/modules/clubs/domain/constants';

const STATUS_TONE = {
  [INVITE_STATUS.GOING]: 'success',
  [INVITE_STATUS.MAYBE]: 'warning',
  [INVITE_STATUS.NOT_GOING]: 'outline',
  [INVITE_STATUS.INVITED]: 'secondary',
};

export default function EventParticipantsPanel({ event, clubId }) {
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

  const handleResponse = async (status) => {
    try {
      await setResponse.mutateAsync(status);
    } catch (err) {
      toast.error(err.message || 'Não foi possível responder.');
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
    going: invites.filter((i) => i.status === INVITE_STATUS.GOING).length,
    maybe: invites.filter((i) => i.status === INVITE_STATUS.MAYBE).length,
    invited: invites.filter((i) => i.status === INVITE_STATUS.INVITED).length,
  };

  return (
    <div className="space-y-4">
      {/* Visibilidade */}
      <Card className="rounded-xl">
        <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4">
          <div className="flex items-center gap-2">
            {isPrivate ? <Lock className="h-5 w-5 text-amber-600" /> : <Globe className="h-5 w-5 text-emerald-600" />}
            <div>
              <h3 className="text-sm font-semibold text-slate-900">{isPrivate ? 'Evento privado' : 'Evento público'}</h3>
              <p className="text-xs text-slate-500">
                {isPrivate
                  ? 'Visível apenas para participantes e convidados.'
                  : 'Visível para todos os atletas do clube.'}
              </p>
            </div>
          </div>
          <div className="flex gap-1.5">
            <Button
              size="sm"
              variant={!isPrivate ? 'default' : 'outline'}
              onClick={() => handleVisibility(EVENT_VISIBILITY.PUBLIC)}
              disabled={updateEvent.isPending || !isPrivate}
            >
              <Globe className="mr-1.5 h-4 w-4" /> Público
            </Button>
            <Button
              size="sm"
              variant={isPrivate ? 'default' : 'outline'}
              onClick={() => handleVisibility(EVENT_VISIBILITY.PRIVATE)}
              disabled={updateEvent.isPending || isPrivate}
            >
              <Lock className="mr-1.5 h-4 w-4" /> Privado
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Minha resposta */}
      <Card className="rounded-xl">
        <CardContent className="p-4">
          <h3 className="text-sm font-semibold text-slate-900">Sua participação</h3>
          <p className="mb-3 text-xs text-slate-500">Você pode mudar sua resposta a qualquer momento.</p>
          <div className="flex flex-wrap gap-2">
            {Object.values(RSVP_STATUS).map((status) => (
              <Button
                key={status}
                size="sm"
                variant={myStatus === status ? 'default' : 'outline'}
                disabled={setResponse.isPending}
                onClick={() => handleResponse(status)}
              >
                {RSVP_STATUS_LABELS[status]}
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Participantes / convidados */}
      <Card className="rounded-xl">
        <CardContent className="space-y-4 p-4">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Users className="h-5 w-5 text-emerald-600" />
              <h3 className="text-base font-semibold text-slate-900">Participantes do evento</h3>
            </div>
            <Button size="sm" variant="outline" onClick={() => setInviteOpen(true)}>
              <UserPlus className="mr-1.5 h-4 w-4" /> Convidar atletas
            </Button>
          </div>

          <div className="flex flex-wrap gap-2 text-xs">
            <Badge variant="success" className="rounded-full">{counts.going} confirmado(s)</Badge>
            <Badge variant="warning" className="rounded-full">{counts.maybe} talvez</Badge>
            <Badge variant="secondary" className="rounded-full">{counts.invited} aguardando</Badge>
          </div>

          {isLoading ? (
            <Skeleton className="h-20 rounded-lg" />
          ) : invites.length === 0 ? (
            <EmptyState icon={Users} title="Sem participantes ainda" description="Convide os atletas do clube para integrarem o evento." />
          ) : (
            <div className="divide-y divide-slate-100">
              {invites.map((inv) => {
                const canRemove = isManager || inv.user_id === user?.uid;
                return (
                  <div key={inv.id} className="flex items-center justify-between gap-3 py-2">
                    <div className="flex min-w-0 items-center gap-2">
                      <UserAvatar name={inv.user_name} photoUrl={inv.user_photo} size="sm" />
                      <div className="min-w-0">
                        <div className="truncate text-sm font-medium text-slate-800">
                          {inv.user_name}
                          {inv.user_id === event.created_by && <span className="ml-1 text-xs text-emerald-700">(organizador)</span>}
                        </div>
                        {inv.source === INVITE_SOURCE.PLATFORM && (
                          <div className="text-[11px] text-slate-400">Convidado da plataforma</div>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant={STATUS_TONE[inv.status] || 'secondary'} className="rounded-full">
                        {INVITE_STATUS_LABELS[inv.status] || inv.status}
                      </Badge>
                      {canRemove && inv.user_id !== event.created_by && (
                        <button onClick={() => handleRemove(inv.user_id)} className="text-slate-400 transition-colors hover:text-red-600" title="Remover">
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <InviteDialog
        open={inviteOpen}
        onClose={() => setInviteOpen(false)}
        event={event}
        clubId={clubId}
        invites={invites}
      />
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
        <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar por nome…" />
        <div className="max-h-[50vh] space-y-4 overflow-y-auto">
          <Pool title="Atletas do clube" people={clubPool.filter(f)} onInvite={handleInvite} emptyText="Todos os atletas do clube já participam." />
          <Pool title="Outros atletas da plataforma" people={platformPool.filter(f)} onInvite={handleInvite} emptyText="Nenhum outro atleta disponível." />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Fechar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Pool({ title, people, onInvite, emptyText }) {
  return (
    <div>
      <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">{title} ({people.length})</h4>
      {people.length === 0 ? (
        <p className="text-sm text-slate-400">{emptyText}</p>
      ) : (
        <div className="space-y-1.5">
          {people.map((p) => (
            <div key={p.user_id} className="flex items-center justify-between gap-2 rounded-lg border border-slate-100 p-2">
              <div className="flex min-w-0 items-center gap-2">
                <UserAvatar name={p.user_name} photoUrl={p.user_photo} size="sm" />
                <span className="truncate text-sm font-medium text-slate-800">{p.user_name}</span>
              </div>
              <Button size="sm" variant="outline" onClick={() => onInvite(p)}>
                <Send className="mr-1 h-3.5 w-3.5" /> Convidar
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
