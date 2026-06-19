import { useEffect, useState } from 'react';
import { collection, getCountFromServer } from 'firebase/firestore';
import { BarChart3, Trophy, Users, ListChecks, Flag } from 'lucide-react';
import { toast } from 'sonner';
import { db } from '@/core/config/firebase';
import { AuditLogTable } from '@/components/AuditLogTable';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import { useAuth } from '@/core/lib/FirebaseAuthContext';
import { useFeatureFlags } from '@/core/lib/FeatureFlagsContext';
import { FEATURE_FLAG_META } from '@/core/featureFlags';
import { setFeatureFlag } from '@/core/services/platformSettingsService';

export default function AdminMetrics() {
  const [stats, setStats] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        const [usersC, tournamentsC, matchesC, regsC] = await Promise.all([
          getCountFromServer(collection(db, 'users')),
          getCountFromServer(collection(db, 'tournaments')),
          getCountFromServer(collection(db, 'tournament_matches')),
          getCountFromServer(collection(db, 'tournament_registrations')),
        ]);
        setStats({
          users: usersC.data().count,
          tournaments: tournamentsC.data().count,
          matches: matchesC.data().count,
          registrations: regsC.data().count,
        });
      } catch (e) {
        setError(e.message);
      }
    })();
  }, []);

  if (error) return <p className="text-red-600 text-sm">{error}</p>;

  return (
    <div className="mx-auto max-w-5xl space-y-4">
      <h1 className="text-2xl font-bold arena-heading flex items-center gap-2">
        <BarChart3 className="w-6 h-6 text-emerald-600" /> Métricas da Plataforma
      </h1>
      {!stats ? (
        <Skeleton className="h-32" />
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <StatCard icon={Users} label="Usuários" value={stats.users} />
          <StatCard icon={Trophy} label="Torneios" value={stats.tournaments} />
          <StatCard icon={ListChecks} label="Inscrições" value={stats.registrations} />
          <StatCard icon={Trophy} label="Jogos" value={stats.matches} />
        </div>
      )}
      <FeatureFlagsPanel />
      <AuditLogTable />
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
    <Card>
      <CardContent className="p-4 space-y-3">
        <div className="flex items-center gap-2">
          <Flag className="w-5 h-5 text-emerald-600" />
          <h2 className="text-lg font-semibold arena-heading">Funcionalidades (flags)</h2>
        </div>
        <p className="text-xs text-slate-500">
          Ative ou desative funcionalidades em tempo real para toda a plataforma. Cada flag nasce
          desligada e é puramente aditiva — desligá-la não afeta o que já existe.
        </p>
        <div className="space-y-2">
          {Object.entries(FEATURE_FLAG_META).map(([key, meta]) => (
            <div
              key={key}
              className="flex items-start justify-between gap-4 rounded-md border border-slate-200 p-3"
            >
              <div>
                <div className="text-sm font-medium text-slate-800">{meta.label}</div>
                <p className="text-xs text-slate-500 mt-0.5">{meta.description}</p>
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
      </CardContent>
    </Card>
  );
}

function StatCard({ icon: Icon, label, value }) {
  return (
    <Card>
      <CardContent className="p-4 flex items-center gap-3">
        <Icon className="w-7 h-7 text-emerald-600" />
        <div>
          <div className="text-2xl font-bold">{value}</div>
          <div className="text-xs text-slate-500">{label}</div>
        </div>
      </CardContent>
    </Card>
  );
}
