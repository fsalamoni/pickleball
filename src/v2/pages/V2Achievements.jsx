import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Lock, Sparkles, Trophy } from 'lucide-react';
import { useAuth } from '@/core/lib/FirebaseAuthContext';
import { useFeatureFlag } from '@/core/lib/FeatureFlagsContext';
import { FEATURE_FLAG } from '@/core/featureFlags';
import {
  ACHIEVEMENT_FAMILY,
  ACHIEVEMENT_FAMILY_META,
  ACHIEVEMENT_RARITY,
} from '@/modules/achievements/domain/achievementsV2';
import { useGamificationEngine } from '@/modules/progression/hooks/useGamificationEngine';
import AchievementCardV2 from '@/modules/achievements/components/AchievementCardV2';
import {
  V2Badge,
  V2Button,
  V2EmptyState,
  V2PageIntro,
  V2Skeleton,
  V2Surface,
} from '@/v2/ui/primitives';
import { cn } from '@/core/lib/utils';
import { TermNote } from '@/v2/components/gamification/TermHint';

const FAMILY_TABS = [
  { key: 'all', label: 'Todas' },
  { key: ACHIEVEMENT_FAMILY.CAREER, label: 'Carreira' },
  { key: ACHIEVEMENT_FAMILY.SOCIAL, label: 'Social' },
  { key: ACHIEVEMENT_FAMILY.DISCOVERY, label: 'Descoberta' },
  { key: ACHIEVEMENT_FAMILY.SEASONAL, label: 'Sazonal' },
  { key: ACHIEVEMENT_FAMILY.COMMUNITY, label: 'Comunidade' },
];

const RARITY_FILTERS = [
  { key: 'all', label: 'Todas raridades' },
  { key: ACHIEVEMENT_RARITY.COMMON, label: 'Comum' },
  { key: ACHIEVEMENT_RARITY.UNCOMMON, label: 'Incomum' },
  { key: ACHIEVEMENT_RARITY.RARE, label: 'Rara' },
  { key: ACHIEVEMENT_RARITY.EPIC, label: 'Épica' },
  { key: ACHIEVEMENT_RARITY.LEGENDARY, label: 'Lendária' },
];

export default function V2Achievements() {
  const gamificationOn = useFeatureFlag(FEATURE_FLAG.GAMIFICATION_V2);
  const { user } = useAuth();

  // Se a master flag está OFF, mostra empty state amigável
  if (!gamificationOn) {
    return (
      <div className="mx-auto max-w-[1100px]">
        <V2PageIntro
          title="Conquistas"
          subtitle="Catálogo de troféus, medalhas e marcos da plataforma."
        />
        <V2Surface>
          <V2EmptyState
            icon={Lock}
            title="Conquistas em breve"
            description="O catálogo de conquistas V2 está em construção. Por enquanto, veja as 20 conquistas clássicas em 'Meu desempenho'."
            action={
              <V2Button asChild>
                <Link to="/meu-desempenho">Ir para Meu desempenho</Link>
              </V2Button>
            }
          />
        </V2Surface>
      </div>
    );
  }

  return <V2AchievementsOn user={user} />;
}

function V2AchievementsOn({ user }) {
  // O mesmo motor do hub: conquistas medidas com os fatos reais da pessoa.
  const engine = useGamificationEngine(user?.uid, { enabled: !!user, sync: true });
  const isLoading = engine.isLoading;

  const [family, setFamily] = useState('all');
  const [rarity, setRarity] = useState('all');
  const [showUnlockedOnly, setShowUnlockedOnly] = useState(false);

  const filtrar = (lista) => lista.filter((a) => (family === 'all' || a.family === family) && (rarity === 'all' || a.rarity === rarity));
  const result = useMemo(() => {
    const ach = engine.achievements;
    const unlocked = filtrar(ach.unlocked);
    const locked = filtrar(ach.locked);
    const soon = filtrar(ach.soon);
    return { unlocked, locked, soon, total: ach.total, unlockedCount: ach.unlockedCount, byFamily: ach.byFamily };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [engine.achievements, family, rarity]);

  const visibleItems = useMemo(() => {
    const all = [...result.unlocked, ...result.locked];
    if (showUnlockedOnly) return result.unlocked;
    return all;
  }, [result, showUnlockedOnly]);

  if (isLoading) {
    return (
      <div className="mx-auto max-w-[1200px]">
        <V2PageIntro title="Conquistas" subtitle="Catálogo de troféus e marcos." />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3, 4, 5, 6].map((i) => <V2Skeleton key={i} className="h-48 rounded-4xl" />)}
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-[1200px]">
      <V2PageIntro
        title="Conquistas"
        subtitle={`${result.unlockedCount} de ${result.total} desbloqueadas — quanto mais você joga, mais você conquista.`}
        action={
          <V2Badge tone="green">
            <Sparkles className="h-3.5 w-3.5" /> +{result.unlocked.reduce((s, a) => s + (a.xpBonus || 0), 0)} XP bônus
          </V2Badge>
        }
      />
      <TermNote term="conquistas" className="mb-5" />

      {/* Filtros */}
      <V2Surface className="mb-6 space-y-4">
        <div>
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-gray-400">Família</p>
          <div className="flex flex-wrap gap-1.5" role="tablist" aria-label="Filtrar por família">
            {FAMILY_TABS.map((t) => (
              <button
                key={t.key}
                type="button"
                role="tab"
                aria-selected={family === t.key}
                aria-label={`Filtrar por ${t.label}`}
                onClick={() => setFamily(t.key)}
                className={cn(
                  'rounded-full px-4 py-1.5 text-xs font-bold transition-colors',
                  family === t.key ? 'bg-ink text-white' : 'bg-paper text-gray-600 hover:bg-gray-100',
                )}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="flex-1">
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-gray-400">Raridade</p>
            <div className="flex flex-wrap gap-1.5">
              {RARITY_FILTERS.map((r) => (
                <button
                  key={r.key}
                  type="button"
                  onClick={() => setRarity(r.key)}
                  className={cn(
                    'rounded-full px-3 py-1 text-xs font-bold transition-colors',
                    rarity === r.key ? 'bg-ink text-white' : 'bg-paper text-gray-600 hover:bg-gray-100',
                  )}
                >
                  {r.label}
                </button>
              ))}
            </div>
          </div>
          <button
            type="button"
            onClick={() => setShowUnlockedOnly((s) => !s)}
            className={cn(
              'rounded-full px-3 py-1 text-xs font-bold transition-colors',
              showUnlockedOnly ? 'bg-acid text-ink' : 'bg-paper text-gray-600 hover:bg-gray-100',
            )}
          >
            <Trophy className="mr-1 inline h-3.5 w-3.5" />
            Só desbloqueadas
          </button>
        </div>

        {/* Stats por família */}
        <div className="grid grid-cols-2 gap-3 border-t border-gray-100 pt-4 sm:grid-cols-5">
          {Object.entries(ACHIEVEMENT_FAMILY_META).map(([key, meta]) => {
            const f = result.byFamily[key] || { unlocked: 0, total: 0 };
            return (
              <div key={key} className="rounded-2xl bg-paper p-3 text-center">
                <p className="text-lg font-bold text-ink">{f.unlocked}<span className="text-xs text-gray-400">/{f.total}</span></p>
                <p className="mt-0.5 text-[10px] font-semibold uppercase tracking-wide text-gray-500">{meta.name}</p>
              </div>
            );
          })}
        </div>
      </V2Surface>

      {/* Grid */}
      {visibleItems.length === 0 ? (
        <V2Surface>
          <V2EmptyState
            icon={Trophy}
            title="Nenhuma conquista com esses filtros"
            description="Tente outra família ou raridade."
          />
        </V2Surface>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {visibleItems.map((a) => {
            const isUnlocked = result.unlocked.some((u) => u.id === a.id);
            return (
              <AchievementCardV2
                key={a.id}
                achievement={{
                  ...a,
                  unlocked: isUnlocked,
                  progress: isUnlocked ? 1 : (a.progress || 0),
                }}
              />
            );
          })}
        </div>
      )}

      {result.soon.length > 0 && !showUnlockedOnly && (
        <V2Surface className="mt-8" data-testid="achievements-soon">
          <h2 className="font-display text-lg font-bold text-ink">Em breve ({result.soon.length})</h2>
          <p className="mb-4 mt-1 text-sm text-gray-500">
            A plataforma ainda não consegue medir estas — elas não entram na sua conta de “x de y”. Quando o dado existir, elas se destravam sozinhas.
          </p>
          <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {result.soon.map((a) => (
              <li key={a.id} className="flex items-start gap-3 rounded-2xl border border-dashed border-gray-200 p-3">
                <span className="text-2xl opacity-60" aria-hidden="true">{a.icon}</span>
                <div className="min-w-0">
                  <p className="text-sm font-bold text-gray-600">{a.name}</p>
                  <p className="text-xs text-gray-400">{a.description}</p>
                </div>
              </li>
            ))}
          </ul>
        </V2Surface>
      )}
    </div>
  );
}
