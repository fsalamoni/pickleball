import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { ShieldCheck, UserCheck } from 'lucide-react';
import { useAuth } from '@/core/lib/FirebaseAuthContext';
import {
  approvePoolCreatorRequest,
  denyPoolCreatorRequest,
  watchPendingCreatorRequests,
} from '@/modules/admin/services/adminService';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/ui/empty-state';
import { Skeleton } from '@/components/ui/skeleton';
import { logger } from '@/core/lib/logger';

export default function AdminCreatorRequests() {
  const { user } = useAuth();
  const [requests, setRequests] = useState([]);
  const [responses, setResponses] = useState({});
  const [busyId, setBusyId] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const unsubscribe = watchPendingCreatorRequests(
      (next) => {
        setRequests(next);
        setIsLoading(false);
      },
      (e) => {
        logger.error('AdminCreatorRequests error:', e);
        setError(e.message);
        setIsLoading(false);
      },
    );

    return () => unsubscribe();
  }, []);

  const review = async (request, approved) => {
    setBusyId(request.id);
    try {
      const message = responses[request.id] || '';
      if (approved) {
        await approvePoolCreatorRequest(request, user, message);
        toast.success('Usuário autorizado a criar bolões.');
      } else {
        await denyPoolCreatorRequest(request, user, message);
        toast.success('Solicitação recusada.');
      }
      setResponses((prev) => {
        const next = { ...prev };
        delete next[request.id];
        return next;
      });
    } catch (err) {
      toast.error(err.message || 'Erro ao responder solicitação.');
    } finally {
      setBusyId(null);
    }
  };

  if (error) return <p className="text-red-600 text-sm">{error}</p>;

  return (
    <div className="mx-auto max-w-5xl space-y-4">
      <section className="arena-panel-strong rounded-lg p-5 sm:p-6">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-amber-300 text-slate-950">
            <ShieldCheck className="h-5 w-5" />
          </div>
          <div className="max-w-3xl space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wider text-emerald-200">Admin Geral</p>
            <h1 className="text-2xl font-bold text-white sm:text-3xl">Solicitações de criador</h1>
            <p className="text-sm leading-6 text-emerald-50/85">
              Aprove ou recuse usuários que solicitaram autorização para criar bolões na plataforma.
            </p>
          </div>
        </div>
      </section>

      <Card className="overflow-hidden">
        <CardHeader className="border-b border-emerald-950/10 bg-white/45 p-4 sm:p-5">
          <CardTitle className="text-base text-slate-950">Fila de análise</CardTitle>
          <CardDescription>
            Aprove ou recuse usuários que solicitaram autorização para criar bolões na plataforma.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-4 sm:p-5">
          {isLoading ? (
            <div className="space-y-2">
              <Skeleton className="h-24" />
              <Skeleton className="h-24" />
            </div>
          ) : requests.length === 0 ? (
            <EmptyState
              icon={UserCheck}
              title="Nenhuma solicitação pendente"
              description="Novas solicitações de criação de bolões aparecerão aqui."
            />
          ) : (
            <div className="space-y-3">
              {requests.map((request) => (
                <div key={request.id} className="match-surface space-y-3 p-4">
                  <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2">
                    <div>
                      <div className="font-medium text-slate-900">{request.user_name || request.user_email}</div>
                      <div className="text-sm text-slate-500">{request.user_email}</div>
                    </div>
                    <Badge variant="warning">Pendente</Badge>
                  </div>
                  {request.message && (
                    <div className="rounded-md border border-emerald-950/10 bg-white/65 p-3 text-sm text-slate-700">
                      <strong>Mensagem:</strong> {request.message}
                    </div>
                  )}
                  <Input
                    value={responses[request.id] || ''}
                    onChange={(e) => setResponses((prev) => ({ ...prev, [request.id]: e.target.value }))}
                    maxLength={240}
                    placeholder="Resposta para o usuário (opcional)"
                  />
                  <div className="flex flex-col sm:flex-row gap-2 sm:justify-end">
                    <Button
                      variant="outline"
                      disabled={busyId === request.id}
                      onClick={() => review(request, false)}
                      className="border-slate-300 bg-white/70"
                    >
                      Recusar
                    </Button>
                    <Button disabled={busyId === request.id} onClick={() => review(request, true)} className="bg-emerald-700 hover:bg-emerald-800">
                      Autorizar
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
