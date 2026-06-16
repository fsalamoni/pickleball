import React, { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  CalendarDays,
  MapPin,
  Pencil,
  Repeat,
  MessageSquare,
  Info,
  Building2,
  Users,
  Globe,
  Lock,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { EmptyState } from '@/components/ui/empty-state';
import { useMyMembership, useClubEvent } from '@/modules/clubs/hooks/useClubs';
import { CLUB_EVENT_TYPE, eventTypeLabel, isGameDayEvent, isPrivateEvent } from '@/modules/clubs/domain/constants';
import { EventFormDialog } from '@/modules/clubs/components/ClubEventsTab';
import EventDatesPanel from '@/modules/clubs/components/EventDatesPanel';
import EventParticipantsPanel from '@/modules/clubs/components/EventParticipantsPanel';
import EventChat from '@/modules/clubs/components/EventChat';

function formatDateTime(value) {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export default function EventDetail() {
  const { clubId, eventId } = useParams();
  const { data: membership } = useMyMembership(clubId);
  const { data: event, isLoading, isError } = useClubEvent(eventId);
  const [editOpen, setEditOpen] = useState(false);
  const [tab, setTab] = useState('detalhes');

  if (isLoading) {
    return (
      <div className="mx-auto max-w-4xl space-y-4">
        <Skeleton className="h-28 rounded-[2rem]" />
        <Skeleton className="h-64 rounded-[2rem]" />
      </div>
    );
  }

  // O acesso é controlado pelas regras do Firestore: o evento só carrega para
  // quem pode vê-lo (membro de evento público, convidado, criador ou admin).
  // Se não carregou, é porque não existe ou o usuário não tem acesso.
  if (isError || !event) {
    return (
      <div className="mx-auto max-w-2xl">
        <EmptyState
          icon={membership ? CalendarDays : Building2}
          title={membership ? 'Evento não encontrado' : 'Evento indisponível'}
          description={
            membership
              ? 'O evento que você procura não existe ou foi removido.'
              : 'Este evento é privado ou foi removido. Você precisa de um convite ou de ser membro do clube para acessá-lo.'
          }
          action={
            <Button asChild>
              <Link to={membership ? `/clubes/${clubId}?tab=events` : `/clubes/${clubId}`}>
                {membership ? 'Voltar para eventos' : 'Ir para o clube'}
              </Link>
            </Button>
          }
        />
      </div>
    );
  }

  const gameDay = isGameDayEvent(event.type);
  // A organização de jogos (sorteio/partidas/resultados) é útil no Dia de jogo
  // e também no Torneio interno do clube.
  const showGames = gameDay || event.type === CLUB_EVENT_TYPE.TOURNAMENT;
  const isPrivate = isPrivateEvent(event);
  const when = formatDateTime(event.starts_at);

  return (
    <div className="mx-auto max-w-4xl space-y-4">
      <Button asChild variant="ghost" size="sm">
        <Link to={`/clubes/${clubId}?tab=events`}><ArrowLeft className="mr-1.5 h-4 w-4" /> Voltar para eventos</Link>
      </Button>

      <section className="arena-panel-strong overflow-hidden rounded-[2rem] p-6 sm:p-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="success" className="rounded-full">{eventTypeLabel(event.type)}</Badge>
              <Badge variant="secondary" className="rounded-full bg-white/15 text-white">
                {isPrivate ? <Lock className="mr-1 h-3 w-3" /> : <Globe className="mr-1 h-3 w-3" />}
                {isPrivate ? 'Privado' : 'Público'}
              </Badge>
              {event.recurring && (
                <Badge variant="secondary" className="rounded-full bg-white/15 text-white">
                  <Repeat className="mr-1 h-3 w-3" /> Recorrente
                </Badge>
              )}
            </div>
            <h1 className="mt-2 text-2xl font-bold text-white sm:text-3xl">{event.title}</h1>
            <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-emerald-50/85">
              {when && <span className="inline-flex items-center gap-1"><CalendarDays className="h-4 w-4" /> {when}</span>}
              {event.location && <span className="inline-flex items-center gap-1"><MapPin className="h-4 w-4" /> {event.location}</span>}
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="shrink-0 border-white/20 bg-white/10 text-white hover:bg-white/15 hover:text-white"
            onClick={() => setEditOpen(true)}
          >
            <Pencil className="mr-1.5 h-4 w-4" /> Editar evento
          </Button>
        </div>
        {event.description && (
          <p className="mt-4 max-w-2xl whitespace-pre-wrap text-sm leading-7 text-emerald-50/85">{event.description}</p>
        )}
      </section>

      <Tabs value={tab} onValueChange={setTab} className="w-full">
        <TabsList className="flex h-auto w-full flex-wrap justify-start gap-1 bg-muted/60 p-1">
          <TabsTrigger value="detalhes">
            <Info className="mr-1.5 h-4 w-4" /> {showGames ? 'Detalhes e dias de jogo' : 'Detalhes e datas'}
          </TabsTrigger>
          <TabsTrigger value="participantes"><Users className="mr-1.5 h-4 w-4" /> Participantes</TabsTrigger>
          <TabsTrigger value="conversa"><MessageSquare className="mr-1.5 h-4 w-4" /> Conversa</TabsTrigger>
        </TabsList>

        <TabsContent value="detalhes" className="mt-4">
          {event.description && (
            <Card className="mb-4 rounded-xl">
              <CardContent className="p-4">
                <h3 className="mb-1 text-sm font-semibold text-slate-900">Sobre o evento</h3>
                <p className="whitespace-pre-wrap text-sm leading-6 text-slate-600">{event.description}</p>
              </CardContent>
            </Card>
          )}
          <EventDatesPanel event={event} clubId={clubId} showGames={showGames} />
        </TabsContent>

        <TabsContent value="participantes" className="mt-4">
          <EventParticipantsPanel event={event} clubId={clubId} />
        </TabsContent>

        <TabsContent value="conversa" className="mt-4">
          <EventChat eventId={eventId} />
        </TabsContent>
      </Tabs>

      <EventFormDialog clubId={clubId} event={event} open={editOpen} onClose={() => setEditOpen(false)} />
    </div>
  );
}
