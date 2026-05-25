import { useState, useEffect } from 'react';
import { collection, query, orderBy, onSnapshot } from 'firebase/firestore';
import { db } from '@/core/config/firebase';
import { toast } from 'sonner';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Shield,
  Trash2,
  RotateCcw,
  ExternalLink,
  Loader2,
} from 'lucide-react';
import { restorePool, permanentDeletePool } from '@/modules/pool/services/poolsService';

/**
 * Painel do Admin Geral para gerenciar todos os bolões da plataforma,
 * incluindo soft-deleted (excluídos pelo admin do bolão).
 *
 * Funcionalidades:
 *  - Visualizar tabela de todos os bolões (ativos e excluídos)
 *  - Restaurar bolões soft-deletados
 *  - Excluir permanentemente bolões (hard delete com cascade)
 */
export default function AdminPools() {
  const [pools, setPools] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  // Modal state
  const [restoreTarget, setRestoreTarget] = useState(null);
  const [permanentDeleteTarget, setPermanentDeleteTarget] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const q = query(collection(db, 'pools'), orderBy('created_at', 'desc'));
    const unsub = onSnapshot(
      q,
      (snap) => {
        setPools(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
        setIsLoading(false);
      },
      (err) => {
        setError(err.message);
        setIsLoading(false);
      },
    );
    return () => unsub();
  }, []);

  const handleRestore = async () => {
    if (!restoreTarget) return;
    setBusy(true);
    try {
      await restorePool(restoreTarget.id);
      toast.success(`Bolão "${restoreTarget.name}" restaurado com sucesso.`);
      setRestoreTarget(null);
    } catch (err) {
      toast.error(err.message || 'Erro ao restaurar bolão.');
    } finally {
      setBusy(false);
    }
  };

  const handlePermanentDelete = async () => {
    if (!permanentDeleteTarget) return;
    setBusy(true);
    try {
      await permanentDeletePool(permanentDeleteTarget.id);
      toast.success(`Bolão "${permanentDeleteTarget.name}" excluído permanentemente.`);
      setPermanentDeleteTarget(null);
    } catch (err) {
      toast.error(err.message || 'Erro ao excluir bolão.');
    } finally {
      setBusy(false);
    }
  };

  const formatDate = (value) => {
    if (!value) return '—';
    const date = value instanceof Date ? value : value.toDate?.() || new Date(value.seconds * 1000);
    if (Number.isNaN(date.getTime())) return '—';
    return date.toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-emerald-600" />
      </div>
    );
  }

  if (error) {
    return (
      <Card>
        <CardContent className="p-6 text-center text-red-600">
          Erro ao carregar bolões: {error}
        </CardContent>
      </Card>
    );
  }

  const activeCount = pools.filter((p) => !p.deleted).length;
  const deletedCount = pools.filter((p) => p.deleted).length;

  return (
    <div className="mx-auto max-w-6xl space-y-4">
      <section className="arena-panel-strong rounded-lg p-5 sm:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-amber-300 text-slate-950">
              <Shield className="h-5 w-5" />
            </div>
            <div className="max-w-3xl space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wider text-emerald-200">Admin Geral</p>
              <h1 className="text-2xl font-bold text-white sm:text-3xl">Gerenciamento de Bolões</h1>
              <p className="text-sm leading-6 text-emerald-50/85">
                {pools.length} bolões no total, com restauração e exclusão permanente disponíveis para manutenção.
              </p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2 sm:w-64">
            <div className="rounded-md border border-emerald-300/20 bg-white/10 p-3 text-white">
              <div className="text-xs text-emerald-100/75">Ativos</div>
              <div className="text-2xl font-bold tabular-nums">{activeCount}</div>
            </div>
            <div className="rounded-md border border-red-300/20 bg-white/10 p-3 text-white">
              <div className="text-xs text-emerald-100/75">Excluídos</div>
              <div className="text-2xl font-bold tabular-nums">{deletedCount}</div>
            </div>
          </div>
        </div>
      </section>

      <Card className="overflow-hidden">
        <CardHeader className="border-b border-emerald-950/10 bg-white/45 p-4 sm:p-5">
          <CardTitle className="text-base text-slate-950">Todos os Bolões</CardTitle>
          <CardDescription>
            Inclui bolões ativos e excluídos (soft-deleted). Ações disponíveis: restaurar ou excluir permanentemente.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {pools.length === 0 ? (
            <p className="text-center text-slate-500 py-8">Nenhum bolão cadastrado.</p>
          ) : (
            <div className="arena-table-wrap rounded-none border-0 shadow-none">
              <table className="min-w-[980px] w-full text-sm">
                <thead>
                  <tr className="border-b border-emerald-900/40 bg-emerald-950 text-left text-emerald-50">
                    <th className="py-3 px-3 font-semibold">Nome</th>
                    <th className="py-3 px-3 font-semibold">Criador</th>
                    <th className="py-3 px-3 font-semibold">Status</th>
                    <th className="py-3 px-3 font-semibold">Membros</th>
                    <th className="py-3 px-3 font-semibold">Criado em</th>
                    <th className="py-3 px-3 font-semibold">Excluído em</th>
                    <th className="py-3 px-3 font-semibold text-right">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-emerald-950/10 bg-white/65">
                  {pools.map((pool) => (
                    <tr
                      key={pool.id}
                      className={`transition-colors hover:bg-emerald-50/70 ${
                        pool.deleted ? 'bg-red-50/60' : ''
                      }`}
                    >
                      <td className="py-3 px-3">
                        <div className="font-medium text-slate-900">{pool.name}</div>
                        <div className="text-xs text-slate-500 font-mono">{pool.invite_code}</div>
                      </td>
                      <td className="py-3 px-3 text-slate-600">
                        {pool.owner_user_id?.slice(0, 8)}…
                      </td>
                      <td className="py-3 px-3">
                        {pool.deleted ? (
                          <Badge variant="destructive" className="text-xs">Excluído</Badge>
                        ) : (
                          <Badge variant="success" className="text-xs">Ativo</Badge>
                        )}
                      </td>
                      <td className="py-3 px-3 text-slate-600">
                        {pool.stats?.members_count ?? '—'}
                      </td>
                      <td className="py-3 px-3 text-slate-500 text-xs">
                        {formatDate(pool.created_at)}
                      </td>
                      <td className="py-3 px-3 text-slate-500 text-xs">
                        {pool.deleted ? formatDate(pool.deleted_at) : '—'}
                      </td>
                      <td className="py-3 px-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => window.open(`/boloes/${pool.id}`, '_blank')}
                            title="Abrir bolão"
                            className="hover:bg-emerald-50"
                          >
                            <ExternalLink className="w-4 h-4" />
                          </Button>
                          {pool.deleted ? (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setRestoreTarget(pool)}
                              className="text-emerald-600 border-emerald-300 hover:bg-emerald-50"
                            >
                              <RotateCcw className="w-4 h-4 mr-1" />
                              Restaurar
                            </Button>
                          ) : null}
                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={() => setPermanentDeleteTarget(pool)}
                          >
                            <Trash2 className="w-4 h-4 mr-1" />
                            Excluir permanente
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Modal de confirmação: Restaurar */}
      <AlertDialog
        open={!!restoreTarget}
        onOpenChange={(open) => !open && setRestoreTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Restaurar bolão?</AlertDialogTitle>
            <AlertDialogDescription>
              O bolão <strong>{restoreTarget?.name}</strong> será restaurado e voltará a
              aparecer para o criador e todos os participantes.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleRestore}
              disabled={busy}
              className="bg-emerald-600 hover:bg-emerald-700"
            >
              {busy ? 'Restaurando…' : 'Sim, restaurar bolão'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Modal de confirmação: Excluir permanentemente */}
      <AlertDialog
        open={!!permanentDeleteTarget}
        onOpenChange={(open) => !open && setPermanentDeleteTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir permanentemente?</AlertDialogTitle>
            <AlertDialogDescription>
              <strong className="text-red-600">Esta ação é irreversível.</strong>
              <br /><br />
              O bolão <strong>{permanentDeleteTarget?.name}</strong> e TODOS os seus dados
              (palpites, membros, pontuações) serão removidos definitivamente do banco de dados.
              <br /><br />
              Não será possível recuperar nenhuma informação após esta exclusão.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handlePermanentDelete}
              disabled={busy}
              className="bg-red-600 hover:bg-red-700 focus:ring-red-600"
            >
              {busy ? 'Excluindo…' : 'Sim, excluir permanentemente'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}