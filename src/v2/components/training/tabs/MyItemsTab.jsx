/**
 * Aba MEUS do treino: o que a pessoa criou, com quem vê cada um e o estado
 * da revisão. Recusado mostra o recado da equipe e "Editar e reenviar".
 *
 * Falha ≠ vazio: com a lista sem carregar, nem "nenhum item" nem os botões de
 * excluir aparecem.
 */
import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import { PenLine, Pencil, Plus, Trash2 } from 'lucide-react';
import { useDeleteTrainingItem, useMyTrainingItems } from '@/modules/training/hooks/useTrainingItems';
import { sortRecent } from '@/modules/training/domain/trainingItem';
import { REVIEW, VISIBILITY } from '@/modules/training/domain/visibility';
import {
  V2Button, V2EmptyState, V2ErrorState, V2FilterChip, V2Skeleton, V2Surface,
} from '@/v2/ui/primitives';
import ItemCard from '@/v2/components/training/ItemCard';
import { ConfirmDialog, mensagemDeErro } from '@/v2/components/training/item/ItemActionDialogs';

/** Estado de um item meu, para o filtro (um valor só por item). */
export function myItemState(item = {}) {
  if (item.hidden === true) return 'oculto';
  if (item.visibility === VISIBILITY.PUBLICO) {
    if (item.review === REVIEW.RECUSADO) return 'recusado';
    if (item.review === REVIEW.APROVADO) return 'aprovado';
    return 'pendente';
  }
  return item.visibility === VISIBILITY.ALUNOS ? 'alunos' : 'privado';
}

const ESTADOS = [
  { value: 'privado', label: 'Só eu' },
  { value: 'alunos', label: 'Meus alunos' },
  { value: 'pendente', label: 'Em revisão' },
  { value: 'aprovado', label: 'Publicados' },
  { value: 'recusado', label: 'Recusados' },
  { value: 'oculto', label: 'Ocultos' },
];

export default function MyItemsTab({ identity, settings }) {
  const mine = useMyTrainingItems(identity.uid);
  const excluir = useDeleteTrainingItem(identity);
  const [estado, setEstado] = useState('');
  const [apagar, setApagar] = useState(null);

  const itens = useMemo(() => sortRecent(mine.data || []), [mine.data]);
  const contagem = useMemo(() => {
    const c = {};
    for (const it of itens) { const e = myItemState(it); c[e] = (c[e] || 0) + 1; }
    return c;
  }, [itens]);

  if (mine.isPending) return <V2Skeleton className="h-64 rounded-4xl" />;
  if (mine.isError) {
    return (
      <V2Surface>
        <V2ErrorState title="Não foi possível carregar os seus itens" onRetry={() => mine.refetch()} />
      </V2Surface>
    );
  }

  const criar = (
    <V2Button asChild>
      <Link to="/treino/novo"><Plus className="h-4 w-4" aria-hidden="true" /> Criar drill ou treino</Link>
    </V2Button>
  );

  if (itens.length === 0) {
    return (
      <V2Surface>
        <V2EmptyState
          icon={PenLine}
          title="Você ainda não criou nada"
          description="Crie o seu drill ou treino: guarde só para você, envie aos seus alunos ou publique na biblioteca."
          action={criar}
        />
      </V2Surface>
    );
  }

  const limite = Number(settings?.max_pending_per_user) || 5;
  const pendentes = contagem.pendente || 0;
  const visiveis = estado ? itens.filter((it) => myItemState(it) === estado) : itens;

  const confirmarExclusao = () => excluir.mutate(apagar, {
    onSuccess: () => { toast.success('Item excluído.'); setApagar(null); },
    onError: (err) => toast.error(mensagemDeErro(err, 'Não foi possível excluir agora. Tente de novo.')),
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-gray-500">
          {itens.length} {itens.length === 1 ? 'item seu' : 'itens seus'}
        </p>
        {criar}
      </div>

      {pendentes > 0 && (
        <p className="rounded-3xl bg-amber-50 p-4 text-sm text-amber-900">
          {pendentes} {pendentes === 1 ? 'item espera' : 'itens esperam'} a revisão da equipe. Dá para ter até {limite} em revisão ao
          mesmo tempo; enquanto isso, só você os vê.
        </p>
      )}

      <div className="flex flex-wrap gap-2" role="group" aria-label="Filtrar pelos estados">
        <V2FilterChip active={!estado} onClick={() => setEstado('')} className="px-3 py-1.5">Todos ({itens.length})</V2FilterChip>
        {ESTADOS.filter((e) => contagem[e.value]).map((e) => (
          <V2FilterChip
            key={e.value}
            active={estado === e.value}
            aria-pressed={estado === e.value}
            onClick={() => setEstado(estado === e.value ? '' : e.value)}
            className="px-3 py-1.5"
          >
            {e.label} ({contagem[e.value]})
          </V2FilterChip>
        ))}
      </div>

      <div className="grid gap-3 md:grid-cols-2" data-dica="treino-meus-lista">
        {visiveis.map((it) => {
          const st = myItemState(it);
          return (
            <ItemCard
              key={it.id}
              item={it}
              showStatus
              extra={(
                <>
                  {st === 'recusado' && it.review_note && (
                    <p className="text-sm text-red-700"><span className="font-semibold">Recado da equipe: </span>{it.review_note}</p>
                  )}
                  {st === 'oculto' && it.hidden_reason && (
                    <p className="text-sm text-red-700"><span className="font-semibold">Motivo: </span>{it.hidden_reason}</p>
                  )}
                </>
              )}
              actions={(
                <>
                  <V2Button asChild variant="secondary" size="sm">
                    <Link to={`/treino/item/${it.id}/editar`}>
                      <Pencil className="h-4 w-4" aria-hidden="true" /> {st === 'recusado' ? 'Editar e reenviar' : 'Editar'}
                    </Link>
                  </V2Button>
                  <V2Button variant="ghost" size="sm" onClick={() => setApagar(it)} aria-label={`Excluir "${it.title}"`}>
                    <Trash2 className="h-4 w-4" aria-hidden="true" /> Excluir
                  </V2Button>
                </>
              )}
            />
          );
        })}
      </div>

      <ConfirmDialog
        open={!!apagar}
        onOpenChange={(o) => { if (!o) setApagar(null); }}
        title="Excluir este item?"
        description={apagar ? `"${apagar.title}" sai da biblioteca e dos envios. Quem já o copiou mantém a própria cópia. Isso não pode ser desfeito.` : ''}
        confirmLabel="Excluir"
        pending={excluir.isPending}
        onConfirm={confirmarExclusao}
      />
    </div>
  );
}
