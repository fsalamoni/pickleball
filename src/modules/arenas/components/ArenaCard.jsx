import React from 'react';
import { Link } from 'react-router-dom';
import { MapPin, Star, Building2, Trophy } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { formatArenaAddress } from '../domain/arena.js';
import { formatPrice } from '../domain/pricing.js';
import FavoriteArenaButton from './FavoriteArenaButton.jsx';

/** Card da arena no diretório. */
export default function ArenaCard({ arena }) {
  const address = formatArenaAddress(arena);
  return (
    <Link to={`/arenas/${arena.id}`} className="group block">
      <Card className="h-full overflow-hidden transition-shadow group-hover:shadow-md">
        <div className="relative h-32 w-full bg-emerald-50">
          {arena.cover_url ? (
            <img src={arena.cover_url} alt="" className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-emerald-600">
              <Building2 className="h-10 w-10" />
            </div>
          )}
          <div className="absolute right-2 top-2">
            <FavoriteArenaButton arena={arena} className="h-9 w-9 bg-white/90 hover:bg-white" />
          </div>
        </div>
        <CardContent className="p-4">
          <div className="flex items-start justify-between gap-2">
            <h3 className="min-w-0 truncate font-semibold text-slate-900">{arena.name}</h3>
            {Number.isFinite(arena.rating_avg) && arena.rating_avg != null && (
              <span className="flex shrink-0 items-center gap-1 text-sm font-medium text-amber-600">
                <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" /> {arena.rating_avg}
              </span>
            )}
          </div>
          {address && (
            <p className="mt-1 flex items-center gap-1 text-xs text-slate-500">
              <MapPin className="h-3.5 w-3.5 shrink-0" /> <span className="truncate">{address}</span>
            </p>
          )}
          <div className="mt-3 flex flex-wrap items-center gap-1.5">
            {arena.court_count > 0 && (
              <Badge variant="secondary" className="rounded-full text-[11px]">
                <Trophy className="mr-1 h-3 w-3" /> {arena.court_count} quadra(s)
              </Badge>
            )}
            {arena.base_price != null && (
              <Badge variant="secondary" className="rounded-full text-[11px]">
                a partir de {formatPrice(arena.base_price)}
              </Badge>
            )}
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
