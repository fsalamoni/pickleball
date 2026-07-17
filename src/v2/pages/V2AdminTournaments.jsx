import React, { useEffect, useMemo, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { Archive, ArchiveRestore, Trash2, Trophy } from 'lucide-react';
import { toast } from 'sonner';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { useAuth } from '@/core/lib/FirebaseAuthContext';
import { listAllTournaments, deleteTournamentCascading } from '@/modules/admin/services/adminService';
import { archiveTournament, unarchiveTournament } from '@/modules/tournament/services/tournamentService';
import { TOURNAMENT_STATUS_LABELS } from '@/modules/tournament/domain/constants';
import { V2Badge, V2Button, V2EmptyState, V2PageIntro, V2Skeleton, V2StatCard, V2Surface } from '@/v2/ui/primitives';

export default function V2AdminTournaments() {
  const { user, isPlatformAdmin } = useAuth();
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

  useEffect(() => { void load(); }, []);

  const items = tournaments || [];
  const archivedCount = useMemo(() => items.filter((t) => t.archived).length, [items]);
  const activeCount = items.length - archivedCount;

  async function handleArchive(t) {
    try {
      if (t.archived) {
        await unarchiveTournament(t.id, user);
        toast.success('Torneio desarquivado.');
      } else {
        await archiveTournament(t.id, user);
        toast.success('Torneio arquivado.');
      }
      void load();
    } catch (err) { toast.error(err.message); }
  }

  async function handleDelete(t) {
    setDeleting(true);
    try {
      await deleteTournamentCascading(t.id, user);
      toast.success('Torneio removido.');
      setDeleteTarget(null);
      void load();
    } catch (err) { toast.error(err.message); } finally { setDeleting(false); }
  }

  if (!isPlatformAdmin) return <Navigate to="/" replace />;

  return (
    <div className="mx-auto max-w-[1100px]">
      <V2PageIntro title="Gestão de torneios" subtitle="Arquive, reabra ou remova torneios da plataforma." />

      {tournaments && (
        <div className="mb-6 grid grid-cols-2 gap-4 md:grid-cols-3">
          <V2StatCard icon={Trophy} accent="ink" label="Total" value={items.length} />
          <V2StatCard icon={ArchiveRestore} accent="green" label="Ativos" value={activeCount} />
          <V2StatCard icon={Archive} accent="acid" label="Arquivados" value={archivedCount} />
        </div>
      )}

      {error && <V2Surface className="mb-6 border-red-200 bg-red-50"><p className="text-sm text-red-700">{error}</p></V2Surface>}

      {!tournaments ? (
        <V2Skeleton className="h-64 rounded-4xl" />
      ) : items.length === 0 ? (
        <V2Surface><V2EmptyState icon={Trophy} title="Nenhum torneio cadastrado" description="Assim que o primeiro torneio for criado, ele aparece aqui." /></V2Surface>
      ) : (
        <V2Surface className="overflow-hidden p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-paper">
                <tr className="text-left text-gray-500">
                  <th className="px-4 py-3 font-semibold">Nome</th>
                  <th className="px-4 py-3 font-semibold">Cidade</th>
                  <th className="px-4 py-3 font-semibold">Status</th>
                  <th className="px-4 py-3 font-semibold">Owner</th>
                  <th className="px-4 py-3 text-right font-semibold">Ações</th>
                </tr>
              </thead>
              <tbody>
                {items.map((t) => (
                  <tr key={t.id} className="border-t border-gray-100">
                    <td className="px-4 py-3 font-semibold text-ink">
                      {t.name} {t.archived && <V2Badge tone="neutral">Arquivado</V2Badge>}
                    </td>
                    <td className="px-4 py-3 text-gray-500">{t.city || '—'}</td>
                    <td className="px-4 py-3 text-gray-500">{TOURNAMENT_STATUS_LABELS[t.status] || t.status}</td>
                    <td className="px-4 py-3 text-gray-500">{t.creator_name || t.creator_uid}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1.5">
                        <button title={t.archived ? 'Desarquivar' : 'Arquivar'} onClick={() => handleArchive(t)} className="flex h-9 w-9 items-center justify-center rounded-full text-gray-500 hover:bg-paper hover:text-ink">
                          {t.archived ? <ArchiveRestore className="h-4 w-4" /> : <Archive className="h-4 w-4" />}
                        </button>
                        <button title="Excluir" onClick={() => setDeleteTarget(t)} className="flex h-9 w-9 items-center justify-center rounded-full text-red-500 hover:bg-red-50">
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </V2Surface>
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
