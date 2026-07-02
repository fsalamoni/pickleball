import { useEffect, useState } from 'react';
import { Trophy, Archive, Trash2, ArchiveRestore } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { EmptyState } from '@/components/ui/empty-state';
import {
  PlatformMetricCard,
  PlatformNotice,
  PlatformSectionHeader,
  PlatformSurfaceCard,
} from '@/components/ui/platform-page';
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
  const [error, setError] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);

  async function load() {
    try {
      setError(null);
      setTournaments(await listAllTournaments());
    } catch (err) {
      setError(err.message || 'Não foi possível carregar os torneios.');
      toast.error(err.message);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  const items = tournaments || [];
  const archivedCount = items.filter((t) => t.archived).length;
  const activeCount = items.length - archivedCount;

  async function handleArchive(t) {
    try {
      await setTournamentArchived(t.id, !t.archived, user);
      toast.success('Atualizado.');
      void load();
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
      void load();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <PlatformSurfaceCard>
        <PlatformSectionHeader
          eyebrow="Admin torneios"
          title="Governança do catálogo competitivo"
          description="Arquive, reabra ou remova torneios com leitura mais clara do inventário atual da plataforma."
          action={<Trophy className="h-6 w-6 text-emerald-600" />}
        />
      </PlatformSurfaceCard>

      {tournaments && (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
          <PlatformMetricCard label="Total" value={items.length} description="torneios cadastrados" icon={Trophy} />
          <PlatformMetricCard label="Ativos" value={activeCount} description="visíveis no fluxo operacional" icon={ArchiveRestore} />
          <PlatformMetricCard label="Arquivados" value={archivedCount} description="fora do fluxo principal" icon={Archive} />
        </div>
      )}

      {error && <PlatformNotice className="border-red-200 bg-red-50/80 text-red-900">{error}</PlatformNotice>}

      {!tournaments ? (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
          {[1, 2, 3].map((item) => (
            <div key={item} className="h-32 animate-pulse rounded-[1.5rem] bg-slate-200/70" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <PlatformSurfaceCard contentClassName="p-2">
          <EmptyState
            icon={Trophy}
            title="Nenhum torneio cadastrado"
            description="Assim que o primeiro torneio for criado, ele aparecerá aqui para governança administrativa."
          />
        </PlatformSurfaceCard>
      ) : (
        <PlatformSurfaceCard contentClassName="p-0">
          <div className="arena-table-wrap">
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
                {items.map((t) => (
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
          </div>
        </PlatformSurfaceCard>
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
