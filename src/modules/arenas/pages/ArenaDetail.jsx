import React, { useState } from 'react';
import { Navigate, useParams, Link } from 'react-router-dom';
import {
  MapPin, Phone, Mail, Instagram, Globe, MessageCircle, Building2,
  Star, CalendarPlus, Settings, Clock, Trophy,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import ErrorState from '@/components/ErrorState';
import { useFeatureFlag } from '@/core/lib/FeatureFlagsContext';
import { FEATURE_FLAG } from '@/core/featureFlags';
import { useAuth } from '@/core/lib/FirebaseAuthContext';
import ChatLauncherButton from '@/modules/chat/components/ChatLauncherButton';
import { formatArenaAddress, arenaContactLinks } from '../domain/arena.js';
import { formatPrice } from '../domain/pricing.js';
import { WEEKDAY_SHORT } from '../domain/constants.js';
import { useArena, useMyManagedArenas } from '../hooks/useArenas.js';
import FavoriteArenaButton from '../components/FavoriteArenaButton.jsx';
import ArenaShareButton from '../components/ArenaShareButton.jsx';
import ArenaReviews from '../components/ArenaReviews.jsx';
import BookingRequestDialog from '../components/BookingRequestDialog.jsx';

function ContactRow({ icon: Icon, href, label }) {
  if (!href) return null;
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 text-sm text-emerald-700 hover:underline">
      <Icon className="h-4 w-4" /> {label}
    </a>
  );
}

export default function ArenaDetail() {
  const enabled = useFeatureFlag(FEATURE_FLAG.ARENAS);
  const { arenaId } = useParams();
  const { user } = useAuth();
  const { data: arena, isLoading, isError, refetch } = useArena(arenaId);
  const { data: managed = [] } = useMyManagedArenas();
  const [bookingOpen, setBookingOpen] = useState(false);

  if (!enabled) return <Navigate to="/inicio" replace />;
  if (isError) return <div className="mx-auto max-w-3xl"><ErrorState message="Não foi possível carregar a arena." onRetry={refetch} /></div>;
  if (isLoading) return <div className="mx-auto max-w-3xl space-y-4"><Skeleton className="h-40" /><Skeleton className="h-64" /></div>;
  if (!arena) {
    return (
      <div className="mx-auto max-w-md p-6 text-center">
        <Building2 className="mx-auto h-10 w-10 text-slate-300" />
        <h2 className="mt-3 font-semibold">Arena não encontrada</h2>
        <Link to="/arenas" className="mt-1 inline-block text-sm text-emerald-700 underline">Voltar ao diretório</Link>
      </div>
    );
  }

  const links = arenaContactLinks(arena);
  const canManage = arena.owner_id === user?.uid || managed.some((m) => m.id === arena.id);
  const address = formatArenaAddress(arena);

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      {/* Capa + cabeçalho */}
      <Card className="overflow-hidden">
        <div className="h-40 w-full bg-emerald-50 sm:h-52">
          {arena.cover_url ? (
            <img src={arena.cover_url} alt="" className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-emerald-600"><Building2 className="h-12 w-12" /></div>
          )}
        </div>
        <CardContent className="p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <h1 className="text-2xl font-bold text-slate-900">{arena.name}</h1>
              {address && <p className="mt-1 flex items-center gap-1 text-sm text-slate-600"><MapPin className="h-4 w-4" /> {address}</p>}
              <div className="mt-2 flex flex-wrap items-center gap-1.5">
                {arena.rating_avg != null && (
                  <Badge variant="secondary" className="rounded-full"><Star className="mr-1 h-3 w-3 fill-amber-400 text-amber-400" /> {arena.rating_avg} ({arena.rating_count})</Badge>
                )}
                {arena.court_count > 0 && <Badge variant="secondary" className="rounded-full"><Trophy className="mr-1 h-3 w-3" /> {arena.court_count} quadra(s)</Badge>}
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <FavoriteArenaButton arena={arena} />
              <ArenaShareButton arena={arena} />
              {canManage && (
                <Button asChild size="sm" variant="outline">
                  <Link to={`/arenas/${arena.id}/gerir`}><Settings className="h-4 w-4" /> <span className="ml-1">Gerir</span></Link>
                </Button>
              )}
            </div>
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            <Button onClick={() => setBookingOpen(true)}><CalendarPlus className="h-4 w-4" /> <span className="ml-1">Solicitar reserva</span></Button>
            {arena.owner_id && arena.owner_id !== user?.uid && (
              <ChatLauncherButton
                athlete={{ id: arena.owner_id, platform_name: arena.name, photo_url: arena.cover_url }}
                variant="outline"
                label="Falar com a arena"
              />
            )}
          </div>
        </CardContent>
      </Card>

      {arena.description && (
        <Card><CardContent className="p-5"><p className="whitespace-pre-line text-sm text-slate-700">{arena.description}</p></CardContent></Card>
      )}

      {/* Contatos, horários, redes */}
      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <CardContent className="space-y-2 p-5">
            <h3 className="text-sm font-semibold text-slate-800">Contato e redes</h3>
            <div className="flex flex-col gap-1.5">
              <ContactRow icon={MessageCircle} href={links.whatsapp} label="WhatsApp" />
              <ContactRow icon={Phone} href={links.phone} label={arena.contact_phone || 'Telefone'} />
              <ContactRow icon={Mail} href={links.email} label={arena.contact_email || 'E-mail'} />
              <ContactRow icon={Instagram} href={links.instagram} label={`@${arena.instagram}`} />
              <ContactRow icon={Globe} href={links.website} label="Site" />
              {!links.whatsapp && !links.phone && !links.email && !links.instagram && !links.website && (
                <p className="text-sm text-slate-400">Sem contatos informados.</p>
              )}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="space-y-2 p-5">
            <h3 className="flex items-center gap-1 text-sm font-semibold text-slate-800"><Clock className="h-4 w-4" /> Funcionamento</h3>
            <p className="text-sm text-slate-600">{arena.hours || 'Horário não informado.'}</p>
          </CardContent>
        </Card>
      </div>

      {/* Tabela de preços */}
      {(arena.base_price != null || (arena.price_rules || []).length > 0) && (
        <Card>
          <CardContent className="p-5">
            <h3 className="mb-2 text-sm font-semibold text-slate-800">Preços</h3>
            {arena.base_price != null && <p className="text-sm text-slate-600">Preço base: <strong>{formatPrice(arena.base_price)}</strong></p>}
            <div className="mt-2 space-y-1.5">
              {(arena.price_rules || []).map((r) => (
                <div key={r.id} className="flex items-center justify-between rounded-md border border-slate-100 px-3 py-2 text-sm">
                  <span className="text-slate-600">
                    {(r.weekdays || []).map((d) => WEEKDAY_SHORT[d]).join(', ')} · {r.start}–{r.end}
                    {r.label ? ` · ${r.label}` : ''}
                  </span>
                  <strong className="text-emerald-700">{formatPrice(r.price)}</strong>
                </div>
              ))}
            </div>
            <p className="mt-2 text-xs text-slate-400">Valores de referência; o valor final é confirmado pela arena na reserva.</p>
          </CardContent>
        </Card>
      )}

      {/* Fotos */}
      {(arena.photos || []).length > 0 && (
        <Card>
          <CardContent className="p-5">
            <h3 className="mb-2 text-sm font-semibold text-slate-800">Fotos</h3>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {arena.photos.map((p, i) => (
                <img key={p.path || i} src={p.url} alt="" className="h-28 w-full rounded-lg object-cover" />
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <ArenaReviews arena={arena} />

      {bookingOpen && <BookingRequestDialog arena={arena} open={bookingOpen} onOpenChange={setBookingOpen} />}
    </div>
  );
}
