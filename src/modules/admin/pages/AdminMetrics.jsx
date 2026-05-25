import { useEffect, useState } from 'react';
import { collection, getCountFromServer } from 'firebase/firestore';
import { BarChart3, Trophy, Users, ListChecks } from 'lucide-react';
import { db } from '@/core/config/firebase';
import { AuditLogTable } from '@/components/AuditLogTable';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

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
      <AuditLogTable />
    </div>
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
