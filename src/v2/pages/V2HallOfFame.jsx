import React from 'react';
import { Crown, Medal, Sparkles, Trophy, TrendingUp } from 'lucide-react';
import { useFeatureFlag } from '@/core/lib/FeatureFlagsContext';
import { FEATURE_FLAG } from '@/core/featureFlags';
import { useHallOfFame } from '@/modules/progression/hooks/useHallOfFame';
import {
  V2Badge,
  V2Button,
  V2EmptyState,
  V2PageIntro,
  V2Skeleton,
  V2Surface,
} from '@/v2/ui/primitives';
import { TIER_ORDER } from '@/modules/progression/domain/tiers';

/**
 * V2HallOfFame — página pública com o top 50 por XP.
 *
 * Mostra pódio (top 3) + lista do top 50.
 * Gated por GAMIFICATION_V2.
 */
export default function V2HallOfFame() {
  const gamificationOn = useFeatureFlag(FEATURE_FLAG.GAMIFICATION_V2);
  if (!gamificationOn) {
    return (
      <div className="mx-auto max-w-[1000px]">
        <V2PageIntro
          title="Hall da Fama"
          subtitle="Os maiores atletas do PickleRush por XP acumulado."
        />
        <V2Surface>
          <V2EmptyState
            icon={Crown}
            title="Hall da Fama em construção"
            description="A gamificação V2 precisa estar ativa pra ver este ranking."
            action={
              <V2Button asChild>
                <a href="/meu-desempenho">Ir para Meu desempenho</a>
              </V2Button>
            }
          />
        </V2Surface>
      </div>
    );
  }
  return <HallOfFameOn />;
}

function HallOfFameOn() {
  const { data: players = [], isLoading } = useHallOfFame();
  const podium = players.slice(0, 3);
  const rest = players.slice(3);

  return (
    <div className="mx-auto max-w-[1000px]">
      <V2PageIntro
        title="Hall da Fama"
        subtitle="Os 50 maiores atletas do PickleRush por XP acumulado (tier mínimo: Jogador)."
        action={
          <V2Badge tone="amber">
            <Trophy className="h-3.5 w-3.5" /> Top 50
          </V2Badge>
        }
      />

      {isLoading && <V2Skeleton className="h-96 rounded-4xl" />}

      {!isLoading && players.length === 0 && (
        <V2Surface>
          <V2EmptyState
            icon={Sparkles}
            title="Ninguém no Hall ainda"
            description="Conforme os jogadores acumulam XP, eles aparecem aqui. Ative a gamificação e comece a subir!"
          />
        </V2Surface>
      )}

      {/* Pódio */}
      {!isLoading && podium.length > 0 && (
        <V2Surface className="mb-6">
          <h2 className="mb-4 flex items-center gap-2 font-display text-lg font-bold text-ink">
            <Crown className="h-5 w-5 text-amber-500" /> Pódio
          </h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            {podium.map((p, i) => (
              <PodiumCard key={p.uid} player={p} position={i + 1} />
            ))}
          </div>
        </V2Surface>
      )}

      {/* Lista Top 50 */}
      {!isLoading && rest.length > 0 && (
        <V2Surface>
          <h2 className="mb-3 flex items-center gap-2 font-display text-lg font-bold text-ink">
            <TrendingUp className="h-5 w-5" /> Ranking
          </h2>
          <ol className="divide-y divide-gray-100" data-testid="hall-of-fame-list">
            {rest.map((p, i) => (
              <li
                key={p.uid}
                data-testid="hof-row"
                data-uid={p.uid}
                className="flex items-center gap-3 py-2.5"
              >
                <span className="w-10 text-right font-mono text-sm font-bold tabular-nums text-gray-500">
                  #{i + 4}
                </span>
                <span className="flex h-7 w-7 items-center justify-center rounded-2xl bg-gray-100 text-[10px] font-bold text-ink">
                  {p.tier.slice(0, 2).toUpperCase()}
                </span>
                <div className="flex-1">
                  <p className="text-sm font-bold text-ink">UID: {p.uid.slice(0, 8)}…</p>
                  <p className="text-xs text-gray-500">
                    {p.achievementsUnlocked}/{p.achievementsTotal} conquistas
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-bold text-ink tabular-nums">
                    {p.xpTotal.toLocaleString('pt-BR')} XP
                  </p>
                  <p className="text-[10px] text-gray-500">Nível {p.level}</p>
                </div>
              </li>
            ))}
          </ol>
        </V2Surface>
      )}
    </div>
  );
}

function PodiumCard({ player, position }) {
  const colors = {
    1: { bg: 'from-amber-300 to-amber-500', text: 'text-amber-900', icon: Crown },
    2: { bg: 'from-slate-300 to-slate-400', text: 'text-slate-900', icon: Medal },
    3: { bg: 'from-orange-300 to-orange-400', text: 'text-orange-900', icon: Medal },
  };
  const { bg, text, icon: Icon } = colors[position] || colors[3];
  return (
    <div
      data-testid="hof-podium"
      data-position={position}
      className={`relative overflow-hidden rounded-3xl bg-gradient-to-br ${bg} p-4 ${text} shadow-lg`}
    >
      <div className="absolute -right-4 -top-4 opacity-20">
        <Icon className="h-24 w-24" />
      </div>
      <div className="relative">
        <p className="text-xs font-bold uppercase tracking-wider">#{position}</p>
        <p className="mt-1 text-2xl font-bold">{player.tier}</p>
        <p className="mt-1 text-xs opacity-80">UID: {player.uid.slice(0, 8)}…</p>
        <p className="mt-2 text-3xl font-bold tabular-nums">
          {player.xpTotal.toLocaleString('pt-BR')}
        </p>
        <p className="text-[10px] uppercase tracking-wide opacity-80">XP total</p>
        <p className="mt-1 text-xs">
          Nível {player.level} · {player.achievementsUnlocked}/{player.achievementsTotal} conquistas
        </p>
      </div>
    </div>
  );
}
