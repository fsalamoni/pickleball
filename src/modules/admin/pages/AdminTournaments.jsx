import { useEffect, useState } from 'react';
import { Trophy, Archive, Trash2, ArchiveRestore } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { toast } from 'sonner';
import {
  listAllTournaments,
  setTournamentArchived,
  deleteTournamentCascading,
} from '@/modules/admin/services/adminService';
import { useAuth } from '@/core/lib/FirebaseAuthContext';
import { TOURNAMENT_STATUS_LABELS } from '@/modules/tournament/domain/constants';

export default function AdminTournaments() {
  const { user } = useAuth();
  const [tournaments, setTournaments] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);

  async function load() {
    try {
      setTournaments(await listAllTournaments());
    } catch (err) {
      toast.error(err.message);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function handleArchive(t) {
    try {
      await setTournamentArchived(t.id, !t.archived, user);
      toast.success('Atualizado.');
      load();
    } catch (err) {
      toast.error(err.message);
    }
  }

  async function handleDelete(t) {
    setDeleting(true);
    try {
      await deleteTournamentCascading(t.id, user);
      toast.success('Torneio removido.');
      setDeleteTarget(null);
      load();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="max-w-5xl mx-auto space-y-4">
      <h1 className="text-2xl font-bold arena-heading flex items-center gap-2">
        <Trophy className="w-6 h-6 text-emerald-600" /> Torneios da plataforma
      </h1>
      {!tournaments ? (
        <p className="text-sm text-slate-500">Carregando…</p>
      ) : tournaments.length === 0 ? (
        <Card>
          <CardContent className="p-6 text-sm text-slate-500 text-center">Nenhum torneio cadastrado.</CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0 arena-table-wrap">
            <table className="w-full text-sm">
              <thead className="bg-slate-50">
                <tr className="text-left">
                  <th className="px-3 py-2">Nome</th>
                  <th className="px-3 py-2">Cidade</th>
                  <th className="px-3 py-2">Status</th>
                  <th className="px-3 py-2">Owner</th>
                  <th className="px-3 py-2 text-right">Ações</th>
                </tr>
              </thead>
              <tbody>
                {tournaments.map((t) => (
                  <tr key={t.id} className="border-t">
                    <td className="px-3 py-2 font-medium">
                      {t.name} {t.archived && <Badge variant="secondary">Arquivado</Badge>}
                    </td>
                    <td className="px-3 py-2">{t.city || '—'}</td>
                    <td className="px-3 py-2">{TOURNAMENT_STATUS_LABELS[t.status] || t.status}</td>
                    <td className="px-3 py-2">{t.creator_name || t.creator_uid}</td>
                    <td className="px-3 py-2 text-right space-x-1">
                      <Button size="icon" variant="ghost" title={t.archived ? 'Desarquivar' : 'Arquivar'} onClick={() => handleArchive(t)}>
                        {t.archived ? <ArchiveRestore className="w-4 h-4" /> : <Archive className="w-4 h-4" />}
                      </Button>
                      <Button size="icon" variant="ghost" title="Excluir" onClick={() => setDeleteTarget(t)}>
                        <Trash2 className="w-4 h-4 text-red-600" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onOpenChange={(v) => !v && !deleting && setDeleteTarget(null)}
        title={`Excluir torneio "${deleteTarget?.name}"?`}
        description="Esta ação remove DEFINITIVAMENTE o torneio e todos os dados associados (modalidades, inscrições, jogos e ranking). Não há como desfazer."
        confirmLabel="Excluir definitivamente"
        destructive
        loading={deleting}
        onConfirm={() => deleteTarget && handleDelete(deleteTarget)}
      />
    </div>
  );
}
