import React, { useMemo } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Award, ChevronLeft, Gift, MessageCircle, Sparkles } from 'lucide-react';
import { useAuth } from '@/core/lib/FirebaseAuthContext';
import { useFeatureFlag } from '@/core/lib/FeatureFlagsContext';
import { FEATURE_FLAG } from '@/core/featureFlags';
import { useUserProgressionV2 } from '@/modules/progression/hooks/useUserProgressionV2';
import { useUserAchievementsV2 } from '@/modules/achievements/hooks/useUserAchievementsV2';
import { useKudoActions } from '@/modules/progression/hooks/useKudoActions';
import { usePlayerStats } from '@/modules/performance/hooks/usePlayerStats';
import { useNationalRanking } from '@/modules/rating/hooks/useRating';
import { ACHIEVEMENT_FAMILY_META, ACHIEVEMENT_RARITY_META, ACHIEVEMENTS_V2 } from '@/modules/achievements/domain/achievementsV2';
import TierBadge from '@/modules/progression/components/TierBadge';
import KudosButton from '@/modules/progression/components/KudosButton';
import {
  V2Badge,
  V2EmptyState,
  V2PageIntro,
  V2Skeleton,
  V2Surface,
} from '@/v2/ui/primitives';

/**
 * V2PublicAchievements — /conquistas/:uid
 *
 * Perfil público de achievements de outro user. Mostra:
 *  - Tier + nome
 *  - Total de conquistas unlocked (X/83)
 *  - Grid com todas as conquistas (unlocked + locked)
 *  - Botão de dar kudos
 *  - Gated por GAMIFICATION_V2
 */
export default function V2PublicAchievements() {
  const gamificationOn = useFeatureFlag(FEATURE_FLAG.GAMIFICATION_V2);
  if (!gamificationOn) {
    return (
      <div className="mx-auto max-w-[1000px]">
        <V2PageIntro title="Conquistas" subtitle="Veja o perfil de outro atleta." />
        <V2Surface>
          <V2EmptyState
            icon={Award}
            title="Conquistas V2 em construção"
            description="Esta seção estará disponível em breve."
          />
        </V2Surface>
      </div>
    );
  }
  return <V2PublicAchievementsOn />;
}

function V2PublicAchievementsOn() {
  const { uid } = useParams();
  const { user: me } = useAuth();
  const { progression } = useUserProgressionV2(uid, !!uid);
  const { unlocked, unlockedIds, isLoading } = useUserAchievementsV2(uid, !!uid);
  const kudos = useKudoActions(me?.uid, !!me);
  const { stats } = usePlayerStats();
  const { data: ranking = [] } = useNationalRanking();

  const meRank = useMemo(
    () => ranking.find((p) => p.id === uid || p.uid === uid) || null,
    [ranking, uid],
  );

  const allAchievements = useMemo(() => [...ACHIEVEMENTS_V2], []);
  const isOwnProfile = me?.uid === uid;

  if (isLoading) {
    return (
      <div className="mx-auto max-w-[1000px]">
        <V2PageIntro title="Conquistas" subtitle="..." />
        <V2Skeleton className="h-96 rounded-4xl" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-[1100px]">
      <V2PageIntro
        title="Conquistas"
        subtitle={isOwnProfile ? 'Seu perfil público' : `Perfil público de UID ${uid?.slice(0, 8)}…`}
        action={
          <Link to="/conquistas" className="inline-flex items-center gap-1 text-sm font-bold text-ink hover:underline">
            <ChevronLeft className="h-4 w-4" /> Voltar
          </Link>
        }
      />

      {/* Header do perfil */}
      <V2Surface className="mb-6">
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex-1">
            <p className="text-xs font-bold uppercase tracking-wide text-gray-500">UID</p>
            <p className="mt-0.5 font-mono text-sm text-ink">{uid}</p>
          </div>
          <div className="flex items-center gap-2">
            <TierBadge xp={progression?.xpTotal || 0} size="sm" />
            <V2Badge tone="amber">
              <Sparkles className="h-3.5 w-3.5" /> {progression?.xpTotal?.toLocaleString('pt-BR') || 0} XP
            </V2Badge>
            <V2Badge tone="green">
              <Award className="h-3.5 w-3.5" /> {unlocked.length}/{progression?.achievementsTotal || 83}
            </V2Badge>
            {meRank && (
              <V2Badge tone="blue">
                #{meRank.position} · {meRank.rating}
              </V2Badge>
            )}
          </div>
        </div>

        {!isOwnProfile && me && (
          <div className="mt-4 border-t border-gray-100 pt-4">
            <KudosButton
              toUid={uid}
              currentUid={me.uid}
              onGive={({ type, message }) => kudos.give({ toUid: uid, type, message, scope: 'universal' })}
              isGiving={kudos.isGiving}
              giveError={kudos.giveError}
              givenToday={kudos.index?.givenToday || 0}
            />
          </div>
        )}
      </V2Surface>

      {/* Stats rápidas (só se for outro user, pra ter contexto) */}
      {stats && me?.uid === uid && (
        <V2Surface className="mb-6">
          <h2 className="mb-3 flex items-center gap-2 font-display text-lg font-bold text-ink">
            <Gift className="h-5 w-5" /> Estatísticas
          </h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
            <Stat label="Torneios" value={stats.tournaments} />
            <Stat label="Jogos" value={stats.played} />
            <Stat label="Vitórias" value={stats.wins} />
            <Stat label="Pódios" value={stats.podiums} />
            <Stat label="Títulos" value={stats.titles} />
          </div>
        </V2Surface>
      )}

      {/* Grid de conquistas por família */}
      {Object.entries(ACHIEVEMENT_FAMILY_META).map(([family, meta]) => {
        const familyAchievements = allAchievements.filter((a) => a.family === family);
        if (familyAchievements.length === 0) return null;
        const unlockedInFamily = familyAchievements.filter((a) => unlockedIds.has(a.id)).length;
        return (
          <V2Surface key={family} className="mb-6">
            <div className="mb-4 flex items-center gap-2">
              <span className="text-2xl" aria-hidden>{meta.icon}</span>
              <div>
                <h2 className="font-display text-lg font-bold text-ink">{meta.name}</h2>
                <p className="text-xs text-gray-500">
                  {unlockedInFamily}/{familyAchievements.length} desbloqueadas
                </p>
              </div>
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {familyAchievements.slice(0, 12).map((a) => (
                <AchievementPublicCard
                  key={a.id}
                  achievement={a}
                  unlocked={unlockedIds.has(a.id)}
                />
              ))}
            </div>
            {familyAchievements.length > 12 && (
              <p className="mt-3 text-center text-xs text-gray-500">
                +{familyAchievements.length - 12} mais
              </p>
            )}
          </V2Surface>
        );
      })}

      {unlocked.length === 0 && (
        <V2Surface>
          <V2EmptyState
            icon={Award}
            title="Nenhuma conquista desbloqueada ainda"
            description="Continue jogando e competindo para desbloquear suas primeiras conquistas!"
          />
        </V2Surface>
      )}
    </div>
  );
}

function Stat({ label, value }) {
  return (
    <div className="rounded-2xl bg-paper p-3 text-center">
      <p className="text-2xl font-bold text-ink tabular-nums">{value}</p>
      <p className="mt-0.5 text-[10px] font-bold uppercase tracking-wide text-gray-500">{label}</p>
    </div>
  );
}

function AchievementPublicCard({ achievement, unlocked }) {
  const rarity = ACHIEVEMENT_RARITY_META[achievement.rarity] || {};
  return (
    <div
      data-testid="public-achievement-card"
      data-achievement-id={achievement.id}
      data-unlocked={String(unlocked)}
      className={`flex items-center gap-3 rounded-2xl border p-3 ${
        unlocked
          ? 'border-amber-200 bg-amber-50'
          : 'border-gray-100 bg-paper opacity-60'
      }`}
    >
      <div className={`flex h-10 w-10 items-center justify-center rounded-2xl ${
        unlocked ? 'bg-amber-200 text-amber-800' : 'bg-gray-200 text-gray-500'
      }`}>
        {unlocked ? <Award className="h-5 w-5" /> : <MessageCircle className="h-5 w-5" />}
      </div>
      <div className="flex-1">
        <p className={`text-sm font-bold ${unlocked ? 'text-ink' : 'text-gray-500'}`}>
          {achievement.name}
        </p>
        <p className="mt-0.5 text-[10px] font-bold uppercase" style={{ color: rarity.color || '#666' }}>
          {rarity.label || achievement.rarity}
        </p>
      </div>
    </div>
  );
}
