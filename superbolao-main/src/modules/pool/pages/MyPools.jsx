import { Link } from 'react-router-dom';
import { Trophy, Plus, Hash } from 'lucide-react';
import { useMyPools } from '@/modules/pool/hooks/usePools';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { Skeleton } from '@/components/ui/skeleton';

export default function MyPools() {
  const { pools, isLoading } = useMyPools();

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Meus bolões</CardTitle>
          <div className="flex gap-2">
            <Button asChild variant="outline" size="sm">
              <Link to="/boloes/ingressar"><Hash className="w-4 h-4" /> Ingressar</Link>
            </Button>
            <Button asChild size="sm">
              <Link to="/boloes/criar"><Plus className="w-4 h-4" /> Criar</Link>
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-2">
              <Skeleton className="h-20" />
              <Skeleton className="h-20" />
            </div>
          ) : pools.length === 0 ? (
            <EmptyState
              icon={Trophy}
              title="Você ainda não participa de nenhum bolão"
              description="Crie um bolão privado para a sua turma ou entre em um existente com o código de convite."
            />
          ) : (
            <div className="grid sm:grid-cols-2 gap-3">
              {pools.map((p) => (
                <Link
                  key={p.id}
                  to={`/boloes/${p.id}`}
                  className="block p-4 border rounded-lg hover:border-emerald-400 hover:bg-emerald-50/40 transition"
                >
                  <div className="flex items-center justify-between">
                    <div className="font-semibold text-slate-900">{p.name}</div>
                    {(p.userRole === 'owner' || p.userRole === 'admin') && (
                      <Badge variant="success" className="text-[10px]">Admin</Badge>
                    )}
                  </div>
                  <p className="text-sm text-slate-500 mt-1 line-clamp-2">{p.description || 'Sem descrição.'}</p>
                  <div className="mt-3 flex items-center justify-between text-xs text-slate-500">
                    <span>{p.stats?.members_count || 1} membros</span>
                    <span className="font-mono">{p.invite_code}</span>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
