import React, { useMemo, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { Trophy, Megaphone, Newspaper } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/ui/empty-state';
import { PlatformSectionHeader, PlatformSurfaceCard } from '@/components/ui/platform-page';
import { useAuth } from '@/core/lib/FirebaseAuthContext';
import { useFeatureFlag } from '@/core/lib/FeatureFlagsContext';
import { FEATURE_FLAG } from '@/core/featureFlags';
import ErrorState from '@/components/ErrorState';
import { useFeed } from '../hooks/useFeed.js';
import { useFollowing } from '../hooks/useFollow.js';
import { filterFeedByFollowing, FEED_ITEM_TYPE } from '../domain/feed.js';

function ItemIcon({ type }) {
  const Icon = type === FEED_ITEM_TYPE.TOURNAMENT ? Trophy : Megaphone;
  return (
    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700">
      <Icon className="h-5 w-5" />
    </div>
  );
}

export default function CommunityFeed() {
  const enabled = useFeatureFlag(FEATURE_FLAG.COMMUNITY_FEED);
  const followOn = useFeatureFlag(FEATURE_FLAG.FOLLOW_ATHLETES);
  const { user } = useAuth();
  const { data: items = [], isLoading, isError, refetch } = useFeed();
  const { data: following = [] } = useFollowing(user?.uid, followOn);
  const [onlyFollowing, setOnlyFollowing] = useState(false);

  const followingUids = useMemo(() => new Set(following.map((f) => f.target_uid)), [following]);
  const visible = useMemo(
    () => (followOn && onlyFollowing ? filterFeedByFollowing(items, followingUids) : items),
    [items, followOn, onlyFollowing, followingUids],
  );

  if (!enabled) return <Navigate to="/inicio" replace />;

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <PlatformSurfaceCard>
        <div className="flex items-center justify-between gap-3">
          <PlatformSectionHeader
            eyebrow="Comunidade"
            title="Atividade recente da plataforma"
            description="Acompanhe movimentos recentes de torneios, clubes e da comunidade em uma leitura mais direta."
          />
        {followOn && (
          <button
            type="button"
            onClick={() => setOnlyFollowing((v) => !v)}
            aria-pressed={onlyFollowing}
            className={`rounded-full border px-4 py-2 text-sm font-medium transition-colors ${
              onlyFollowing
                ? 'border-emerald-600 bg-emerald-600 text-white'
                : 'border-emerald-950/15 bg-white/80 text-slate-700 hover:bg-emerald-50'
            }`}
          >
            Só de quem sigo
          </button>
        )}
        </div>
      </PlatformSurfaceCard>

      {isError ? (
        <ErrorState message="Não foi possível carregar as novidades." onRetry={refetch} />
      ) : isLoading ? (
        <Skeleton className="h-64" />
      ) : visible.length === 0 ? (
        <PlatformSurfaceCard contentClassName="p-2">
          <EmptyState
            icon={Newspaper}
            title={onlyFollowing ? 'Nenhuma atividade recente de quem você segue' : 'Nenhuma atividade recente por aqui ainda'}
            description="Assim que novos movimentos acontecerem na comunidade, eles aparecerão aqui em ordem de relevância."
          />
        </PlatformSurfaceCard>
      ) : (
        <div className="space-y-2">
          {visible.map((item) => (
            <Link key={item.id} to={item.link} className="block">
              <Card className="match-surface rounded-[1.5rem] border-white/80 bg-white/85">
                <CardContent className="flex items-center gap-3 p-4">
                  <ItemIcon type={item.type} />
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-medium text-slate-900">{item.title}</div>
                    <div className="truncate text-xs text-slate-500">{item.subtitle}</div>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
