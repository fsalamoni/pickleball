import React, { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { collection, getCountFromServer } from 'firebase/firestore';
import { BarChart3, Flag, ListChecks, Medal, Trophy, Users } from 'lucide-react';
import { toast } from 'sonner';
import { db, firebaseDisabledReason, firebaseServicesEnabled } from '@/core/config/firebase';
import { AuditLogTable } from '@/components/AuditLogTable';
import { useAuth } from '@/core/lib/FirebaseAuthContext';
import { useFeatureFlags, useFeatureFlag } from '@/core/lib/FeatureFlagsContext';
import { FEATURE_FLAG, FEATURE_FLAG_META } from '@/core/featureFlags';
import { setFeatureFlag } from '@/core/services/platformSettingsService';
import RankingAutomatico from '@/modules/admin/components/RankingAutomatico';
import { V2Button, V2PageIntro, V2Skeleton, V2StatCard, V2Surface, V2Toggle } from '@/v2/ui/primitives';

export default function V2AdminMetrics() {
  const { isPlatformAdmin } = useAuth();
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
        setStats({ users: usersC.data().count, tournaments: tournamentsC.data().count, matches: matchesC.data().count, registrations: regsC.data().count });
      } catch (e) {
        if (active) setError(e.message);
      }
    })();
    return () => { active = false; };
  }, []);

  if (!isPlatformAdmin) return <Navigate to="/" replace />;

  return (
    <div className="mx-auto max-w-[1100px]">
      <V2PageIntro title="Métricas da plataforma" subtitle="Escala de uso, recálculos críticos e governança de funcionalidades." />

      {!firebaseServicesEnabled ? (
        <V2Surface className="border-amber-200 bg-amber-50">
          <p className="text-sm text-amber-800">Ambiente sem Firebase configurado. Métricas, flags e auditoria não podem ser carregadas aqui.{firebaseDisabledReason ? ` ${firebaseDisabledReason}` : ''}</p>
        </V2Surface>
      ) : (
        <>
          {error && <V2Surface className="mb-6 border-red-200 bg-red-50"><p className="text-sm text-red-700">{error}</p></V2Surface>}

          {!stats ? (
            <div className="grid grid-cols-2 gap-4 md:grid-cols-4">{[1, 2, 3, 4].map((i) => <V2Skeleton key={i} className="h-40 rounded-4xl" />)}</div>
          ) : (
            <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
              <V2StatCard icon={Users} accent="ink" label="Usuários" value={stats.users} />
              <V2StatCard icon={Trophy} accent="acid" label="Torneios" value={stats.tournaments} />
              <V2StatCard icon={ListChecks} accent="blue" label="Inscrições" value={stats.registrations} />
              <V2StatCard icon={Trophy} accent="green" label="Jogos" value={stats.matches} />
            </div>
          )}

          <div className="mt-6"><RankingAutomatico /></div>
          <div className="mt-6"><FeatureFlagsPanel /></div>
          <div className="mt-6"><AuditLogTable /></div>
        </>
      )}
    </div>
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
    <V2Surface>
      <div className="flex items-center gap-2"><Flag className="h-5 w-5 text-ink" /><h2 className="font-display text-lg font-bold text-ink">Funcionalidades (flags)</h2></div>
      <p className="mt-2 text-xs text-gray-500">Ative ou desative funcionalidades em tempo real. Cada flag nasce desligada e é puramente aditiva.</p>
      <div className="mt-4 space-y-2">
        {Object.entries(FEATURE_FLAG_META).map(([key, meta]) => (
          <div key={key} className="flex items-start justify-between gap-4 rounded-2xl border border-gray-100 bg-paper p-4">
            <div className="min-w-0">
              <div className="text-sm font-semibold text-ink">{meta.label}</div>
              <p className="mt-0.5 text-xs text-gray-500">{meta.description}</p>
            </div>
            <V2Toggle checked={Boolean(flags?.[key])} onChange={(v) => !isLoading && pending !== key && toggle(key, v)} />
          </div>
        ))}
      </div>
    </V2Surface>
  );
}
