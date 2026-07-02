import React, { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, CalendarDays, Globe, Info, Lock, MapPin, MessageSquare, Pencil, Repeat, Users } from 'lucide-react';
import { useMyMembership, useClubEvent } from '@/modules/clubs/hooks/useClubs';
import { CLUB_EVENT_TYPE, eventTypeLabel, isGameDayEvent, isPrivateEvent } from '@/modules/clubs/domain/constants';
import { EventFormDialog } from '@/modules/clubs/components/ClubEventsTab';
import EventDatesPanel from '@/modules/clubs/components/EventDatesPanel';
import V2EventParticipantsPanel from '@/v2/components/clubs/V2EventParticipantsPanel';
import V2EventChat from '@/v2/components/clubs/V2EventChat';
import { V2Badge, V2Button, V2EmptyState, V2Skeleton, V2Surface } from '@/v2/ui/primitives';
import { cn } from '@/core/lib/utils';

function formatDateTime(value) {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export default function V2EventDetail() {
  const { clubId, eventId } = useParams();
  const { data: membership } = useMyMembership(clubId);
  const { data: event, isLoading, isError } = useClubEvent(eventId);
  const [editOpen, setEditOpen] = useState(false);
  const [tab, setTab] = useState('detalhes');

  if (isLoading) {
    return (
      <div className="mx-auto max-w-[1000px] space-y-6">
        <V2Skeleton className="h-44 rounded-4xl" />
        <V2Skeleton className="h-72 rounded-4xl" />
      </div>
    );
  }

  if (isError || !event) {
    return (
      <div className="mx-auto max-w-[700px]">
        <V2Surface>
          <V2EmptyState
            icon={membership ? CalendarDays : Lock}
            title={membership ? 'Evento não encontrado' : 'Evento indisponível'}
            description={membership
              ? 'O evento que você procura não existe ou foi removido.'
              : 'Este evento é privado ou foi removido. Você precisa de convite ou de ser membro do clube para acessá-lo.'}
            action={<Link to={membership ? `/v2/clubes/${clubId}?tab=events` : `/v2/clubes/${clubId}`} className="rounded-full bg-ink px-6 py-3 text-sm font-bold text-white">{membership ? 'Voltar para eventos' : 'Ir para o clube'}</Link>}
          />
        </V2Surface>
      </div>
    );
  }

  const gameDay = isGameDayEvent(event.type);
  const showGames = gameDay || event.type === CLUB_EVENT_TYPE.TOURNAMENT;
  const isPrivate = isPrivateEvent(event);
  const when = formatDateTime(event.starts_at);

  const tabs = [
    { value: 'detalhes', label: showGames ? 'Detalhes e dias de jogo' : 'Detalhes e datas', icon: Info },
    { value: 'participantes', label: 'Participantes', icon: Users },
    { value: 'conversa', label: 'Conversa', icon: MessageSquare },
  ];

  return (
    <div className="mx-auto max-w-[1000px]">
      <Link to={`/v2/clubes/${clubId}?tab=events`} className="mb-5 inline-flex items-center gap-1.5 text-sm font-semibold text-gray-500 hover:text-ink">
        <ArrowLeft className="h-4 w-4" /> Voltar para eventos
      </Link>

      {/* Hero */}
      <div className="relative overflow-hidden rounded-4xl bg-mesh p-8 shadow-organic">
        <div className="relative z-10 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <V2Badge tone="acid">{eventTypeLabel(event.type)}</V2Badge>
              <span className="inline-flex items-center gap-1 rounded-full bg-white/15 px-3 py-1 text-xs font-bold text-white">
                {isPrivate ? <Lock className="h-3 w-3" /> : <Globe className="h-3 w-3" />} {isPrivate ? 'Privado' : 'Público'}
              </span>
              {event.recurring && <span className="inline-flex items-center gap-1 rounded-full bg-white/15 px-3 py-1 text-xs font-bold text-white"><Repeat className="h-3 w-3" /> Recorrente</span>}
            </div>
            <h1 className="mt-3 font-display text-3xl font-bold text-white">{event.title}</h1>
            <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-gray-300">
              {when && <span className="inline-flex items-center gap-1"><CalendarDays className="h-4 w-4" /> {when}</span>}
              {event.location && <span className="inline-flex items-center gap-1"><MapPin className="h-4 w-4" /> {event.location}</span>}
            </div>
          </div>
          <V2Button variant="ghost" size="sm" onClick={() => setEditOpen(true)} className="border-white/20 bg-white/10 text-white hover:border-white/40">
            <Pencil className="h-4 w-4" /> Editar evento
          </V2Button>
        </div>
        {event.description && <p className="relative z-10 mt-4 max-w-2xl whitespace-pre-wrap text-sm leading-7 text-gray-300">{event.description}</p>}
      </div>

      {/* Tabs */}
      <div className="mt-6 inline-flex flex-wrap gap-1.5 rounded-full border border-gray-100 bg-paper-pure p-1.5 shadow-sm">
        {tabs.map((t) => {
          const Icon = t.icon;
          return (
            <button key={t.value} onClick={() => setTab(t.value)}
              className={cn('inline-flex items-center gap-1.5 rounded-full px-5 py-2.5 text-sm font-semibold transition-colors', tab === t.value ? 'bg-ink text-white shadow-md' : 'text-gray-500 hover:text-ink')}>
              <Icon className="h-4 w-4" /> {t.label}
            </button>
          );
        })}
      </div>

      <div className="mt-6">
        {tab === 'detalhes' && (
          <>
            {event.description && (
              <V2Surface className="mb-4">
                <h3 className="font-display text-base font-bold text-ink">Sobre o evento</h3>
                <p className="mt-1 whitespace-pre-wrap text-sm leading-7 text-gray-600">{event.description}</p>
              </V2Surface>
            )}
            <EventDatesPanel event={event} clubId={clubId} showGames={showGames} />
          </>
        )}
        {tab === 'participantes' && <V2EventParticipantsPanel event={event} clubId={clubId} />}
        {tab === 'conversa' && <V2EventChat eventId={eventId} />}
      </div>

      <EventFormDialog clubId={clubId} event={event} open={editOpen} onClose={() => setEditOpen(false)} />
    </div>
  );
}
