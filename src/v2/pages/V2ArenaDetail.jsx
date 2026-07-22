import React, { useState } from 'react';
import { Link, Navigate, useParams } from 'react-router-dom';
import {
  ArrowLeft, Building2, CalendarPlus, Clock, Globe, Instagram, Mail, MapPin,
  MessageCircle, Phone, Settings, Star, Trophy, Users,
  GraduationCap,
} from 'lucide-react';
import { PhotoLightbox } from '@/components/ui/photo-lightbox';
import { useFeatureFlag } from '@/core/lib/FeatureFlagsContext';
import { FEATURE_FLAG } from '@/core/featureFlags';
import { useAuth } from '@/core/lib/FirebaseAuthContext';
import V2ChatLauncherButton from '@/v2/components/chat/V2ChatLauncherButton';
import { V2FavoriteArenaButton, V2ArenaShareButton } from '@/v2/components/arenas/V2ArenaActions';
import V2ArenaReviews from '@/v2/components/arenas/V2ArenaReviews';
import BookingRequestDialog from '@/modules/arenas/components/BookingRequestDialog';
import { formatArenaAddress, arenaContactLinks } from '@/modules/arenas/domain/arena';
import { formatPrice } from '@/modules/arenas/domain/pricing';
import { BOOKING_STATUS, WEEKDAY_SHORT } from '@/modules/arenas/domain/constants';
import { bookingSlots, sortSlots } from '@/modules/arenas/domain/booking';
import { useArena, useMyManagedArenas } from '@/modules/arenas/hooks/useArenas';
import { useArenaBookings } from '@/modules/arenas/hooks/useBookings';
import { useCanArenaUseModule } from '@/modules/arenas/hooks/useArenaV3';
import { useArenaTournaments } from '@/modules/tournament/hooks/useTournament';
import { useArenaCoaches } from '@/modules/coaches/hooks/useCoaches';
import { V2Badge, V2Button, V2EmptyState, V2Skeleton, V2Surface } from '@/v2/ui/primitives';

function arenaPhotoUrl(photo) {
  return typeof photo === 'string' ? photo : photo?.url;
}

function ArenaModuleLinks({ arenaId }) {
  const canOpenMatch = useCanArenaUseModule(arenaId, 'matchmaking_open_match');
  const canMatchmaking = useCanArenaUseModule(arenaId, 'matchmaking_partner_finder');
  const canMembers = useCanArenaUseModule(arenaId, 'members');
  if (!canOpenMatch && !canMatchmaking && !canMembers) return null;
  return (
    <>
      {canOpenMatch && (
        <V2Button asChild variant="secondary" size="sm">
          <Link to={`/arenas/${arenaId}/open-match`}>
            <Trophy className="h-4 w-4" /> Open Match
          </Link>
        </V2Button>
      )}
      {canMatchmaking && (
        <V2Button asChild variant="secondary" size="sm">
          <Link to={`/arenas/${arenaId}/matchmaking`}>
            <Users className="h-4 w-4" /> Matchmaking
          </Link>
        </V2Button>
      )}
      {canMembers && (
        <V2Button asChild variant="secondary" size="sm">
          <Link to={`/arenas/${arenaId}/membros`}>
            <Trophy className="h-4 w-4" /> Membros
          </Link>
        </V2Button>
      )}
    </>
  );
}

function ContactRow({ icon: Icon, href, label }) {
  if (!href) return null;
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 text-sm font-medium text-ink hover:text-ink-lighter">
      <Icon className="h-4 w-4 text-gray-400" /> {label}
    </a>
  );
}

export default function V2ArenaDetail() {
  const enabled = useFeatureFlag(FEATURE_FLAG.ARENAS);
  const { arenaId } = useParams();
  const { user } = useAuth();
  const { data: arena, isLoading } = useArena(arenaId);
  const { data: managed = [] } = useMyManagedArenas();
  const { data: bookings = [] } = useArenaBookings(arenaId);
  const [bookingOpen, setBookingOpen] = useState(false);

  if (!enabled) return <Navigate to="/" replace />;

  if (isLoading) {
    return (
      <div className="mx-auto max-w-[900px] space-y-4">
        <V2Skeleton className="h-56 rounded-4xl" />
        <V2Skeleton className="h-48 rounded-4xl" />
      </div>
    );
  }

  if (!arena) {
    return (
      <div className="mx-auto max-w-[700px]">
        <V2Surface>
          <V2EmptyState
            icon={Building2}
            title="Arena não encontrada"
            description="A arena que você procura não existe ou foi removida."
            action={<Link to="/arenas" className="rounded-full bg-ink px-6 py-3 text-sm font-bold text-white">Voltar às arenas</Link>}
          />
        </V2Surface>
      </div>
    );
  }

  const cover = arena.cover_url || arenaPhotoUrl((arena.photos || [])[0]);
  const links = arenaContactLinks(arena);
  const canManage = arena.owner_id === user?.uid || managed.some((m) => m.id === arena.id);
  const address = formatArenaAddress(arena);
  const upcomingSlots = sortSlots(
    bookings.filter((b) => b.status === BOOKING_STATUS.CONFIRMED).flatMap((b) => bookingSlots(b)),
  ).slice(0, 8);
  const hasContacts = links.whatsapp || links.phone || links.email || links.instagram || links.website;

  return (
    <div className="mx-auto max-w-[900px]">
      <Link to="/arenas" className="mb-5 inline-flex items-center gap-1.5 text-sm font-semibold text-gray-500 hover:text-ink">
        <ArrowLeft className="h-4 w-4" /> Voltar às arenas
      </Link>

      {/* Hero */}
      <div className="overflow-hidden rounded-4xl border border-gray-100 bg-paper-pure shadow-organic-sm">
        <div className="relative h-52 bg-ink">
          {cover ? (
            <PhotoLightbox src={cover} alt={arena.name} title={arena.name}
              trigger={<img src={cover} alt="" className="h-full w-full cursor-zoom-in object-cover" />} />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-white/25"><Building2 className="h-14 w-14" /></div>
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-ink/70 to-transparent" />
          <div className="absolute bottom-5 left-6 right-6 text-white">
            <h1 className="font-display text-3xl font-bold">{arena.name}</h1>
            {address && <p className="mt-1 flex items-center gap-1.5 text-sm text-white/85"><MapPin className="h-4 w-4" /> {address}</p>}
          </div>
        </div>

        <div className="p-6 sm:p-8">
          <div className="flex flex-wrap items-center gap-2">
            {arena.rating_avg != null && (
              <V2Badge tone="amber"><Star className="h-3 w-3 fill-amber-500" /> {arena.rating_avg} ({arena.rating_count})</V2Badge>
            )}
            {arena.court_count > 0 && <V2Badge tone="neutral"><Trophy className="h-3 w-3" /> {arena.court_count} quadra(s)</V2Badge>}
            {arena.hours && <V2Badge tone="neutral"><Clock className="h-3 w-3" /> {arena.hours}</V2Badge>}
          </div>

          <div className="mt-5 flex flex-wrap items-center gap-2">
            <V2Button onClick={() => setBookingOpen(true)}><CalendarPlus className="h-4 w-4" /> Solicitar reserva</V2Button>
            {arena.owner_id && arena.owner_id !== user?.uid && (
              <V2ChatLauncherButton
                athlete={{ id: arena.owner_id, platform_name: arena.name, photo_url: cover }}
                variant="outline"
                label="Falar com a arena"
              />
            )}
            <V2FavoriteArenaButton arena={arena} />
            <V2ArenaShareButton arena={arena} />
            {canManage && (
              <V2Button asChild variant="ghost" size="sm"><Link to={`/arenas/${arena.id}/gerir`}><Settings className="h-4 w-4" /> Gerir</Link></V2Button>
            )}
            <ArenaModuleLinks arenaId={arena.id} />
          </div>

          {arena.description && <p className="mt-6 whitespace-pre-line text-sm leading-7 text-gray-500">{arena.description}</p>}
        </div>
      </div>

      {/* Sprint 3 ARE-18: Regras da casa (público) */}
      {arena.house_rules_md && (
        <details className="mt-6 rounded-4xl border border-gray-100 bg-paper-pure p-5 shadow-organic-sm">
          <summary className="cursor-pointer text-sm font-bold text-ink">
            📋 Regras da casa
          </summary>
          <p className="mt-3 whitespace-pre-line text-sm leading-7 text-gray-600">{arena.house_rules_md}</p>
        </details>
      )}

      {/* Sprint 4 ARE-14: Torneios da arena */}
      <ArenaTournamentsSection arenaId={arenaId} />

      {/* Sprint 4 ARE-15: Professores residentes */}
      <ArenaCoachesSection arenaId={arenaId} />

      {/* Contact + hours */}
      <div className="mt-6 grid gap-6 sm:grid-cols-2">
        <V2Surface>
          <h3 className="font-display text-base font-bold text-ink">Contato e redes</h3>
          <div className="mt-3 flex flex-col gap-2">
            <ContactRow icon={MessageCircle} href={links.whatsapp} label="WhatsApp" />
            <ContactRow icon={Phone} href={links.phone} label={arena.contact_phone || 'Telefone'} />
            <ContactRow icon={Mail} href={links.email} label={arena.contact_email || 'E-mail'} />
            <ContactRow icon={Instagram} href={links.instagram} label={arena.instagram ? `@${arena.instagram}` : 'Instagram'} />
            <ContactRow icon={Globe} href={links.website} label="Site" />
            {!hasContacts && <p className="text-sm text-gray-400">Sem contatos informados.</p>}
          </div>
        </V2Surface>
        <V2Surface>
          <h3 className="flex items-center gap-1.5 font-display text-base font-bold text-ink"><Clock className="h-4 w-4" /> Funcionamento</h3>
          <p className="mt-3 text-sm text-gray-500">{arena.hours || 'Horário não informado.'}</p>
        </V2Surface>
      </div>

      {upcomingSlots.length > 0 && (
        <V2Surface className="mt-6">
          <p className="text-[11px] font-bold uppercase tracking-widest text-gray-400">Agenda</p>
          <h3 className="mt-1 font-display text-lg font-bold text-ink">Próximos horários confirmados</h3>
          <div className="mt-4 flex flex-wrap gap-2">
            {upcomingSlots.map((slot) => (
              <span key={`${slot.date}_${slot.start}`} className="rounded-full border border-gray-100 bg-paper px-3 py-1.5 text-xs text-gray-600">
                {slot.date} · {slot.start}–{slot.end}
              </span>
            ))}
          </div>
        </V2Surface>
      )}

      {(arena.base_price != null || (arena.price_rules || []).length > 0) && (
        <V2Surface className="mt-6">
          <h3 className="font-display text-base font-bold text-ink">Preços</h3>
          {arena.base_price != null && <p className="mt-2 text-sm text-gray-500">Preço base: <strong className="text-ink">{formatPrice(arena.base_price)}</strong></p>}
          <div className="mt-3 space-y-2">
            {(arena.price_rules || []).map((r) => (
              <div key={r.id} className="flex items-center justify-between rounded-2xl border border-gray-100 bg-paper px-4 py-2.5 text-sm">
                <span className="text-gray-500">
                  {(r.weekdays || []).map((d) => WEEKDAY_SHORT[d]).join(', ')} · {r.start}–{r.end}{r.label ? ` · ${r.label}` : ''}
                </span>
                <strong className="text-ink">{formatPrice(r.price)}</strong>
              </div>
            ))}
          </div>
          <p className="mt-3 text-xs text-gray-400">Valores de referência; o valor final é confirmado pela arena na reserva.</p>
        </V2Surface>
      )}

      {(arena.photos || []).length > 0 && (
        <V2Surface className="mt-6">
          <h3 className="font-display text-base font-bold text-ink">Fotos</h3>
          <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
            {arena.photos.map((p, i) => {
              const url = arenaPhotoUrl(p);
              return (
                <PhotoLightbox key={p.path || i} src={url} alt={`Foto ${i + 1} da arena`}
                  trigger={<img src={url} alt="" className="h-28 w-full cursor-zoom-in rounded-2xl object-cover" />} />
              );
            })}
          </div>
        </V2Surface>
      )}

      <div className="mt-6">
        <V2ArenaReviews arena={arena} />
      </div>

      {bookingOpen && <BookingRequestDialog arena={arena} open={bookingOpen} onOpenChange={setBookingOpen} />}
    </div>
  );
}

function ArenaTournamentsSection({ arenaId }) {
  const { data: tournaments = [], isLoading } = useArenaTournaments(arenaId);
  if (isLoading) return null;
  if (tournaments.length === 0) return null;
  return (
    <V2Surface className="mt-6">
      <h3 className="flex items-center gap-1.5 font-display text-base font-bold text-ink">
        <Trophy className="h-4 w-4" /> Torneios desta arena
      </h3>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        {tournaments.slice(0, 6).map((t) => (
          <Link key={t.id} to={`/torneios/${t.id}`} className="block rounded-2xl border border-gray-100 bg-paper p-3 transition-transform hover:scale-[1.02]">
            <div className="flex items-center gap-2">
              <Trophy className="h-4 w-4 text-amber-500" />
              <h4 className="flex-1 text-sm font-bold text-ink line-clamp-1">{t.name}</h4>
              {t.status && <V2Badge tone="neutral">{t.status}</V2Badge>}
            </div>
            {t.starts_at && (
              <p className="mt-1 text-xs text-gray-500">
                {t.starts_at?.toDate?.()?.toLocaleDateString?.('pt-BR') || t.starts_at}
              </p>
            )}
            {t.city && <p className="text-xs text-gray-400">📍 {t.city}{t.state && `, ${t.state}`}</p>}
          </Link>
        ))}
      </div>
    </V2Surface>
  );
}

function ArenaCoachesSection({ arenaId }) {
  const { data: coaches = [], isLoading } = useArenaCoaches(arenaId);
  if (isLoading) return null;
  if (coaches.length === 0) return null;
  return (
    <V2Surface className="mt-6">
      <h3 className="flex items-center gap-1.5 font-display text-base font-bold text-ink">
        <GraduationCap className="h-4 w-4" /> Professores residentes
      </h3>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        {coaches.slice(0, 6).map((c) => (
          <Link key={c.id} to={`/coaches/${c.id}`} className="flex items-center gap-3 rounded-2xl border border-gray-100 bg-paper p-3 transition-transform hover:scale-[1.02]">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-500 to-amber-500 text-sm font-bold text-white">
              {c.display_name?.[0] || '?'}
            </div>
            <div className="flex-1 min-w-0">
              <h4 className="text-sm font-bold text-ink line-clamp-1">{c.display_name}</h4>
              {c.modalities?.length > 0 && (
                <p className="text-xs text-gray-500 line-clamp-1">{c.modalities.join(' · ')}</p>
              )}
              {c.hourly_rate != null && (
                <p className="text-xs font-bold text-emerald-700">R$ {Number(c.hourly_rate).toFixed(2)}/h</p>
              )}
            </div>
          </Link>
        ))}
      </div>
    </V2Surface>
  );
}
