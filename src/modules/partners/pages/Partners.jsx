import React, { useMemo } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { Trophy, ExternalLink, Handshake } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { useFeatureFlag } from '@/core/lib/FeatureFlagsContext';
import { FEATURE_FLAG } from '@/core/featureFlags';
import { recordEvent } from '@/core/services/observabilityService';
import ErrorState from '@/components/ErrorState';
import { sortActiveLinks, AFFILIATE_CATEGORY_LABELS } from '../domain/affiliate.js';
import { useAffiliateLinks } from '../hooks/useAffiliates.js';

export default function Partners() {
  const enabled = useFeatureFlag(FEATURE_FLAG.AFFILIATE_LINKS);
  const { data: links = [], isLoading, isError, refetch } = useAffiliateLinks();
  const active = useMemo(() => sortActiveLinks(links), [links]);

  if (!enabled) return <Navigate to="/" replace />;

  function handleOpen(link) {
    recordEvent('affiliate_click', { id: link.id, category: link.category || 'other' });
    if (typeof window !== 'undefined') window.open(link.url, '_blank', 'noopener,noreferrer');
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-emerald-50/50 to-white">
      <header className="border-b bg-white/80 backdrop-blur sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between gap-2">
          <Link to="/" className="flex items-center gap-2 font-bold text-emerald-700">
            <Trophy className="w-5 h-5" /> Pickleholics
          </Link>
          <Badge variant="success" className="text-xs">
            <Handshake className="w-3 h-3 mr-1" /> Parceiros
          </Badge>
        </div>
      </header>

      <main className="max-w-5xl mx-auto p-4 space-y-4">
        <Card>
          <CardContent className="p-5">
            <h1 className="text-2xl font-bold arena-heading flex items-center gap-2">
              <Handshake className="w-6 h-6 text-emerald-600" /> Parceiros e ofertas
            </h1>
            <p className="text-sm text-slate-600 mt-1">
              Marcas, lojas e patrocinadores que apoiam a comunidade do pickleball.
            </p>
          </CardContent>
        </Card>

        {isError ? (
          <ErrorState message="Não foi possível carregar os parceiros." onRetry={refetch} />
        ) : isLoading ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3].map((i) => <Skeleton key={i} className="h-44 rounded-xl" />)}
          </div>
        ) : active.length === 0 ? (
          <Card>
            <CardContent className="p-8 text-center text-sm text-slate-500">
              Ainda não há parceiros cadastrados.
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {active.map((link) => (
              <button
                key={link.id}
                type="button"
                onClick={() => handleOpen(link)}
                className="group text-left"
              >
                <Card className="h-full transition-shadow group-hover:shadow-md">
                  <CardContent className="flex h-full flex-col p-4">
                    {link.image_url ? (
                      <img src={link.image_url} alt="" className="mb-3 h-28 w-full rounded-lg object-cover" />
                    ) : (
                      <div className="mb-3 flex h-28 w-full items-center justify-center rounded-lg bg-emerald-50 text-emerald-700">
                        <Handshake className="h-8 w-8" />
                      </div>
                    )}
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold text-slate-900">{link.title}</h3>
                      <ExternalLink className="h-3.5 w-3.5 text-slate-400" />
                    </div>
                    {link.category && (
                      <Badge variant="secondary" className="mt-1 w-fit rounded-full text-[11px]">
                        {AFFILIATE_CATEGORY_LABELS[link.category] || link.category}
                      </Badge>
                    )}
                    {link.description && (
                      <p className="mt-2 text-sm text-slate-600">{link.description}</p>
                    )}
                  </CardContent>
                </Card>
              </button>
            ))}
          </div>
        )}
      </main>

      <footer className="text-center text-xs text-slate-400 py-6">Pickleholics · Parceiros</footer>
    </div>
  );
}
