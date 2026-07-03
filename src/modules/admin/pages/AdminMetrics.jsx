import { useEffect, useState } from 'react';
import { collection, getCountFromServer } from 'firebase/firestore';
import { BarChart3, Trophy, Users, ListChecks, Flag, Medal } from 'lucide-react';
import { toast } from 'sonner';
import { db, firebaseDisabledReason, firebaseServicesEnabled } from '@/core/config/firebase';
import { AuditLogTable } from '@/components/AuditLogTable';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  PlatformMetricCard,
  PlatformNotice,
  PlatformSectionHeader,
  PlatformSurfaceCard,
} from '@/components/ui/platform-page';
import { Switch } from '@/components/ui/switch';
import { useAuth } from '@/core/lib/FirebaseAuthContext';
import { useFeatureFlags, useFeatureFlag } from '@/core/lib/FeatureFlagsContext';
import { FEATURE_FLAG, FEATURE_FLAG_META } from '@/core/featureFlags';
import { setFeatureFlag } from '@/core/services/platformSettingsService';
import { useRecomputeRatings } from '@/modules/rating/hooks/useRating';

export default function AdminMetrics() {
  const [stats, setStats] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!firebaseServicesEnabled || !db) return undefined;

    let active = true;

    (async () => {
      try {
        const [usersC, tournamentsC, matchesC, regsC] = await Promise.all([
          getCountFromServer(collection(db, 'users')),
          getCountFromServer(collection(db, 'tournaments')),
          getCountFromServer(collection(db, 'tournament_matches')),
          getCountFromServer(collection(db, 'tournament_registrations')),
        ]);
        if (!active) return;
        setStats({
          users: usersC.data().count,
          tournaments: tournamentsC.data().count,
          matches: matchesC.data().count,
          registrations: regsC.data().count,
        });
      } catch (e) {
        if (!active) return;
        setError(e.message);
      }
    })();

    return () => {
      active = false;
    };
  }, []);

  if (!firebaseServicesEnabled) {
    return (
      <div className="mx-auto max-w-5xl space-y-6">
        <PlatformSurfaceCard>
          <PlatformSectionHeader
            eyebrow="Admin geral"
            title="Métricas e controles da plataforma"
            description="Acompanhe volumes, revise auditoria e controle funcionalidades globais quando os serviços do Firebase estiverem disponíveis."
          />
        </PlatformSurfaceCard>
        <PlatformNotice>
          Este ambiente está sem Firebase configurado. Métricas, flags e auditoria não podem ser carregadas aqui.
          {firebaseDisabledReason ? ` ${firebaseDisabledReason}` : ''}
        </PlatformNotice>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <PlatformSurfaceCard>
        <PlatformSectionHeader
          eyebrow="Admin geral"
          title="Métricas e controles da plataforma"
          description="Acompanhe escala de uso, acione recálculos críticos e governe funcionalidades globais em um único painel operacional."
          action={<BarChart3 className="h-6 w-6 text-green-600" />}
        />
      </PlatformSurfaceCard>

      {error && <PlatformNotice className="border-red-200 bg-red-50/80 text-red-900">{error}</PlatformNotice>}

      {!stats ? (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {[1, 2, 3, 4].map((item) => (
            <Skeleton key={item} className="h-32 rounded-[1.5rem]" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <PlatformMetricCard icon={Users} label="Usuários" value={stats.users} description="base total cadastrada" />
          <PlatformMetricCard icon={Trophy} label="Torneios" value={stats.tournaments} description="eventos registrados" />
          <PlatformMetricCard icon={ListChecks} label="Inscrições" value={stats.registrations} description="participações criadas" />
          <PlatformMetricCard icon={Trophy} label="Jogos" value={stats.matches} description="partidas computadas" />
        </div>
      )}
      <FeatureFlagsPanel />
      <RatingsPanel />
      <AuditLogTable />
    </div>
  );
}

function RatingsPanel() {
  const ratingOn = useFeatureFlag(FEATURE_FLAG.PLAYER_RATING);
  const { mutateAsync, isPending } = useRecomputeRatings();
  const [lastResult, setLastResult] = useState(null);

  if (!ratingOn) return null;

  async function handleRecompute() {
    try {
      const result = await mutateAsync();
      setLastResult(result);
      toast.success(
        `Ratings recalculados: ${result.players} atleta(s) a partir de ${result.matchesUsed} jogo(s).`,
      );
    } catch (err) {
      toast.error(err?.message || 'Não foi possível recalcular os ratings.');
    }
  }

  return (
    <PlatformSurfaceCard contentClassName="space-y-4 p-5 sm:p-6">
        <div className="flex items-center gap-2">
          <Medal className="w-5 h-5 text-green-600" />
          <h2 className="text-lg font-semibold font-display text-ink">Rating ELO + Ranking nacional</h2>
        </div>
        <p className="text-xs text-gray-500">
          Recalcula o rating de todos os atletas a partir dos jogos finalizados e atualiza o
          ranking nacional público (/ranking). Faça isso após registrar novos resultados.
        </p>
        <Button onClick={handleRecompute} disabled={isPending}>
          <Medal className="w-4 h-4" />
          <span className="ml-1">{isPending ? 'Recalculando…' : 'Recalcular ratings'}</span>
        </Button>
        {lastResult && (
          <p className="text-xs text-gray-500">
            Último recálculo: {lastResult.players} atleta(s), {lastResult.matchesUsed} de{' '}
            {lastResult.matchesTotal} jogo(s) finalizados utilizados.
          </p>
        )}
    </PlatformSurfaceCard>
  );
}

function FeatureFlagsPanel() {
  const { user } = useAuth();
  const { flags, isLoading } = useFeatureFlags();
  const [pending, setPending] = useState(null);

  async function toggle(flagKey, enabled) {
    setPending(flagKey);
    try {
      await setFeatureFlag(flagKey, enabled, user);
      toast.success(enabled ? 'Funcionalidade ativada.' : 'Funcionalidade desativada.');
    } catch (err) {
      toast.error(err?.message || 'Não foi possível alterar a funcionalidade.');
    } finally {
      setPending(null);
    }
  }

  return (
    <PlatformSurfaceCard contentClassName="space-y-4 p-5 sm:p-6">
        <div className="flex items-center gap-2">
          <Flag className="w-5 h-5 text-green-600" />
          <h2 className="text-lg font-semibold font-display text-ink">Funcionalidades (flags)</h2>
        </div>
        <p className="text-xs text-gray-500">
          Ative ou desative funcionalidades em tempo real para toda a plataforma. Cada flag nasce
          desligada e é puramente aditiva — desligá-la não afeta o que já existe.
        </p>
        <div className="space-y-2">
          {Object.entries(FEATURE_FLAG_META).map(([key, meta]) => (
            <div
              key={key}
              className="flex items-start justify-between gap-4 rounded-[1.25rem] border border-gray-100 bg-white/75 p-3"
            >
              <div>
                <div className="text-sm font-medium text-ink">{meta.label}</div>
                <p className="text-xs text-gray-500 mt-0.5">{meta.description}</p>
              </div>
              <Switch
                checked={Boolean(flags?.[key])}
                disabled={isLoading || pending === key}
                onCheckedChange={(checked) => toggle(key, checked)}
                aria-label={meta.label}
              />
            </div>
          ))}
        </div>
    </PlatformSurfaceCard>
  );
}
