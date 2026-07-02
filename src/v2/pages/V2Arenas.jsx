import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Building2, Clock, LayoutGrid, MapPin, Search } from 'lucide-react';
import { useArenas } from '@/modules/arenas/hooks/useArenas';
import { formatPrice } from '@/modules/arenas/domain/pricing';
import {
  V2Badge,
  V2Button,
  V2EmptyState,
  V2PageIntro,
  V2SearchInput,
  V2Skeleton,
  V2Surface,
} from '@/v2/ui/primitives';

function arenaCover(arena) {
  if (arena.cover_url) return arena.cover_url;
  const first = (arena.photos || [])[0];
  if (!first) return null;
  return typeof first === 'string' ? first : first?.url || null;
}

function arenaHours(arena) {
  const h = arena.hours;
  if (!h) return null;
  if (typeof h === 'string') return h;
  if (h.open && h.close) return `${h.open}–${h.close}`;
  return null;
}

export default function V2Arenas() {
  const { data: arenas = [], isLoading } = useArenas();
  const [search, setSearch] = useState('');

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return arenas
      .filter((a) => (!term ? true : [a.name, a.city, a.state, a.address].filter(Boolean).join(' ').toLowerCase().includes(term)))
      .sort((a, b) => String(a.name || '').localeCompare(String(b.name || ''), 'pt-BR'));
  }, [arenas, search]);

  return (
    <div className="mx-auto max-w-[1400px]">
      <V2PageIntro
        title="Explorar Quadras"
        subtitle="Encontre arenas, veja preços e horários e solicite sua reserva."
        action={<V2Button asChild variant="secondary" size="sm"><Link to="/v2/arenas/criar">Cadastrar arena</Link></V2Button>}
      />

      <V2Surface className="mb-8">
        <V2SearchInput
          icon={Search}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar arena por nome, cidade ou endereço"
        />
        <p className="mt-4 border-t border-gray-100 pt-4 text-sm text-gray-500">
          <span className="font-bold text-ink">{filtered.length}</span> arena(s) disponíveis.
        </p>
      </V2Surface>

      {isLoading ? (
        <div className="grid gap-8 sm:grid-cols-2 xl:grid-cols-3">
          {[1, 2, 3].map((i) => <V2Skeleton key={i} className="h-80 rounded-3xl" />)}
        </div>
      ) : filtered.length === 0 ? (
        <V2Surface>
          <V2EmptyState
            icon={LayoutGrid}
            title="Nenhuma arena encontrada"
            description="Ajuste a busca ou cadastre uma arena para começar a receber reservas."
            action={<V2Button asChild><Link to="/v2/arenas/criar">Cadastrar arena</Link></V2Button>}
          />
        </V2Surface>
      ) : (
        <div className="grid gap-8 sm:grid-cols-2 xl:grid-cols-3">
          {filtered.map((arena) => <ArenaCard key={arena.id} arena={arena} />)}
        </div>
      )}
    </div>
  );
}

function ArenaCard({ arena }) {
  const cover = arenaCover(arena);
  const hours = arenaHours(arena);
  const location = [arena.city, arena.state].filter(Boolean).join(' / ');
  const price = arena.base_price != null ? formatPrice(arena.base_price) : null;

  return (
    <Link
      to={`/v2/arenas/${arena.id}`}
      className="group flex flex-col overflow-hidden rounded-3xl border border-gray-100 bg-paper-pure shadow-organic-sm transition-all hover:shadow-organic"
    >
      <div className="relative h-48 overflow-hidden bg-ink">
        {cover ? (
          <img src={cover} alt="" className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105" />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-white/30"><Building2 className="h-12 w-12" /></div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
        {price && (
          <div className="absolute bottom-4 right-4 rounded-xl border border-white/20 bg-ink/80 px-3 py-1 font-bold text-white backdrop-blur-md">
            {price}
          </div>
        )}
        <div className="absolute bottom-4 left-4 right-24 text-white">
          <p className="font-display text-xl font-bold leading-tight">{arena.name}</p>
          {location && <p className="mt-1 truncate text-sm text-white/80"><MapPin className="mr-1 inline h-3.5 w-3.5" />{location}</p>}
        </div>
      </div>

      <div className="flex flex-1 flex-col p-6">
        <div className="flex flex-wrap gap-2">
          {Number.isFinite(arena.court_count) && arena.court_count > 0 && (
            <V2Badge tone="neutral">{arena.court_count} quadra(s)</V2Badge>
          )}
          {hours && <V2Badge tone="neutral"><Clock className="h-3 w-3" /> {hours}</V2Badge>}
        </div>
        {arena.description && <p className="mt-4 line-clamp-2 text-sm leading-6 text-gray-500">{arena.description}</p>}
        <div className="mt-auto pt-6">
          <span className="btn-press block w-full rounded-full bg-ink py-3.5 text-center text-sm font-bold text-white transition-colors group-hover:bg-acid group-hover:text-ink">
            Ver arena e reservar
          </span>
        </div>
      </div>
    </Link>
  );
}
