import React, { useMemo } from 'react';
import { Navigate, Link } from 'react-router-dom';
import { ExternalLink, Handshake, Building2, ChevronRight } from 'lucide-react';
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
  const arenasOn = useFeatureFlag(FEATURE_FLAG.ARENAS);
  const { data: links = [], isLoading, isError, refetch } = useAffiliateLinks();
  const active = useMemo(() => sortActiveLinks(links), [links]);

  if (!enabled) return <Navigate to="/" replace />;

  function handleOpen(link) {
    recordEvent('affiliate_click', { id: link.id, category: link.category || 'other' });
    if (typeof window !== 'undefined') window.open(link.url, '_blank', 'noopener,noreferrer');
  }

  return (
    <div className="mx-auto max-w-5xl space-y-4">
        {arenasOn && (
          <Link to="/arenas" className="block">
            <Card className="border-emerald-200 bg-gradient-to-br from-emerald-50 to-white transition-shadow hover:shadow-md">
              <CardContent className="flex items-center gap-3 p-4">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-emerald-600 text-white">
                  <Building2 className="h-5 w-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="font-semibold text-slate-900">Arenas parceiras</div>
                  <div className="text-sm text-slate-600">Encontre quadras, veja preços e horários e reserve sua partida.</div>
                </div>
                <ChevronRight className="h-5 w-5 shrink-0 text-emerald-600" />
              </CardContent>
            </Card>
          </Link>
        )}
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
    </div>
  );
}
