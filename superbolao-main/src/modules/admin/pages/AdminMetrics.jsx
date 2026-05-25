import { useEffect, useState } from 'react';
import { collection, getCountFromServer } from 'firebase/firestore';
import { BarChart3, ShieldCheck, Ticket, Users } from 'lucide-react';
import { db } from '@/core/config/firebase';
import { AuditLogTable } from '@/components/AuditLogTable';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

export default function AdminMetrics() {
  const [stats, setStats] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        const [usersC, poolsC, betsC] = await Promise.all([
          getCountFromServer(collection(db, 'users')),
          getCountFromServer(collection(db, 'pools')),
          getCountFromServer(collection(db, 'bets')),
        ]);
        setStats({
          users: usersC.data().count,
          pools: poolsC.data().count,
          bets: betsC.data().count,
        });
      } catch (e) {
        setError(e.message);
      }
    })();
  }, []);

  if (error) return <p className="text-red-600 text-sm">{error}</p>;
  if (!stats) return <Skeleton className="h-32" />;

  return (
    <div className="mx-auto max-w-5xl space-y-4">
      <section className="arena-panel-strong rounded-lg p-5 sm:p-6">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-amber-300 text-slate-950">
            <BarChart3 className="h-5 w-5" />
          </div>
          <div className="max-w-3xl space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wider text-emerald-200">Admin Geral</p>
            <h1 className="text-2xl font-bold text-white sm:text-3xl">Métricas da plataforma</h1>
            <p className="text-sm leading-6 text-emerald-50/85">
              Apenas dados agregados. Palpites individuais permanecem em sigilo até o reveal automático de cada fase.
            </p>
          </div>
        </div>
      </section>

      <Card className="overflow-hidden">
        <CardHeader className="border-b border-emerald-950/10 bg-white/45 p-4 sm:p-5">
          <CardTitle className="text-base text-slate-950">Visão operacional</CardTitle>
          <CardDescription>
            Apenas dados agregados. Palpites individuais permanecem em sigilo até o reveal automático de cada fase.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 p-4 sm:grid-cols-3 sm:p-5">
          <Stat icon={Users} label="Usuários" value={stats.users} />
          <Stat icon={ShieldCheck} label="Bolões" value={stats.pools} />
          <Stat icon={Ticket} label="Palpites registrados" value={stats.bets} />
        </CardContent>
      </Card>

      <AuditLogTable
        title="Log geral da plataforma"
        description="Registros gerais de usuários, bolões, pagamentos, palpites e alterações da plataforma."
      />
    </div>
  );
}

function Stat({ icon: Icon, label, value }) {
  return (
    <div className="rounded-md border border-emerald-950/10 bg-gradient-to-br from-white/90 to-emerald-50/75 p-4 shadow-sm shadow-emerald-950/5">
      <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-md bg-emerald-900 text-emerald-50">
        <Icon className="h-4 w-4" />
      </div>
      <div className="text-xs font-medium text-emerald-800">{label}</div>
      <div className="mt-1 text-3xl font-bold text-slate-950 tabular-nums">{value}</div>
    </div>
  );
}
