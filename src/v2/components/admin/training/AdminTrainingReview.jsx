/**
 * Treino → REVISÃO: a fila dos itens públicos esperando a equipe (quem espera
 * há mais tempo primeiro). Cada um com a ficha resumida e o checklist de
 * qualidade; aprovar publica, recusar exige a nota (o autor lê e pode editar
 * e reenviar). O serviço avisa o autor e audita.
 */
import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import { CheckCircle2, CircleDashed, ClipboardCheck, ExternalLink } from 'lucide-react';
import { useTrainingAdminActions } from '@/modules/training/hooks/useTrainingAdmin';
import { itemQuality } from '@/modules/training/domain/trainingItem';
import { REVIEW } from '@/modules/training/domain/visibility';
import { podeAfirmarVazio } from '@/core/lib/queryState';
import {
  V2Badge, V2Button, V2EmptyState, V2ErrorState, V2Skeleton, V2Surface,
} from '@/v2/ui/primitives';
import { AuthorLine, KindIcon } from '@/v2/components/training/ItemCard';
import { ReasonDialog, mensagemDeErro } from '@/v2/components/training/item/ItemActionDialogs';
import { quandoFoi } from '@/v2/components/training/questions/questionsView';
import { ITEM_KIND_LABELS } from '@/modules/training/domain/taxonomy';
import { reviewQueue } from './adminTrainingView';

function NaFila({ item, acoes }) {
  const [recusando, setRecusando] = useState(false);
  const q = itemQuality(item);
  const falhou = (err) => toast.error(mensagemDeErro(err, 'Não foi possível salvar agora.'));
  const enviado = quandoFoi(item.updated_at || item.created_at);
  return (
    <li>
      <V2Surface className="space-y-4">
        <div className="flex gap-3">
          <KindIcon kind={item.kind} />
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-bold uppercase tracking-widest text-gray-400">
              {ITEM_KIND_LABELS[item.kind] || 'Item'}{enviado ? ` · enviado ${enviado}` : ''}
            </p>
            <h3 className="font-display text-lg font-bold text-ink">{item.title}</h3>
            <AuthorLine item={item} />
            {item.reviewed_at && <p className="mt-1 text-xs text-gray-500">Nova versão: já passou pela equipe antes e voltou depois de editado.</p>}
          </div>
        </div>
        {item.summary && <p className="text-sm text-gray-700">{item.summary}</p>}
        {item.objective && <p className="text-sm text-gray-700"><span className="font-semibold text-ink">Objetivo:</span> {item.objective}</p>}
        <div className="rounded-3xl bg-gray-50 p-3">
          <p className="text-sm font-semibold text-ink">Qualidade: {q.score} de {q.total}</p>
          {q.missing.length ? (
            <ul className="mt-1 space-y-0.5">
              {q.missing.map((m) => (
                <li key={m} className="flex items-center gap-1.5 text-sm text-gray-600"><CircleDashed className="h-3.5 w-3.5 shrink-0 text-amber-600" aria-hidden="true" /> Falta: {m}</li>
              ))}
            </ul>
          ) : (
            <p className="mt-1 flex items-center gap-1.5 text-sm text-gray-600"><CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" aria-hidden="true" /> Tem tudo o que um bom item pede.</p>
          )}
          <p className="mt-1 text-xs text-gray-500">O checklist orienta; não impede aprovar.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <V2Button asChild size="sm" variant="ghost">
            <Link to={`/treino/item/${item.id}`}><ExternalLink className="h-4 w-4" aria-hidden="true" /> Ver a ficha inteira</Link>
          </V2Button>
          <V2Button
            size="sm"
            disabled={acoes.review.isPending}
            onClick={() => acoes.review.mutate({ item, decision: REVIEW.APROVADO, note: '' }, {
              onSuccess: () => toast.success('Publicado. O autor foi avisado.'), onError: falhou,
            })}
          >
            Aprovar e publicar
          </V2Button>
          <V2Button size="sm" variant="secondary" onClick={() => setRecusando(true)}>Recusar</V2Button>
        </div>
      </V2Surface>
      <ReasonDialog
        open={recusando}
        onOpenChange={setRecusando}
        title="Recusar a publicação"
        description="O item continua do autor, só não entra na biblioteca. Ele lê a sua nota e pode editar e reenviar."
        label="O que precisa mudar (o autor vai ler)"
        confirmLabel="Recusar"
        required
        maxLength={500}
        pending={acoes.review.isPending}
        onConfirm={(nota, fechar) => acoes.review.mutate({ item, decision: REVIEW.RECUSADO, note: nota }, {
          onSuccess: () => { toast.success('Recusado. O autor foi avisado.'); fechar(); }, onError: falhou,
        })}
      />
    </li>
  );
}

export default function AdminTrainingReview({ identity, settingsQ, itens }) {
  const acoes = useTrainingAdminActions(identity, settingsQ.settings);
  const fila = useMemo(() => reviewQueue(itens.data || []), [itens.data]);

  if (itens.isPending) return <V2Skeleton className="h-64 rounded-4xl" />;
  if (itens.isError) return <V2Surface><V2ErrorState title="A fila de revisão não carregou" onRetry={() => itens.refetch()} /></V2Surface>;

  return (
    <section className="space-y-4" aria-label="Fila de revisão" data-dica="admin-treino-revisao">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="font-display text-xl font-bold text-ink">Fila de revisão</h2>
        <V2Badge tone={fila.length ? 'amber' : 'green'}>{fila.length === 1 ? '1 item' : `${fila.length} itens`}</V2Badge>
      </div>
      <p className="max-w-2xl text-sm text-gray-500">
        Itens públicos que ainda não estão na biblioteca. Quem decide o que passa pela fila são as Configurações (atletas, professores).
      </p>
      {podeAfirmarVazio(itens) && !fila.length ? (
        <V2Surface>
          <V2EmptyState icon={ClipboardCheck} title="Fila vazia" description="Nenhum item esperando a equipe agora. Quando alguém publicar, ele aparece aqui." />
        </V2Surface>
      ) : (
        <ul className="space-y-3">
          {fila.map((item) => <NaFila key={item.id} item={item} acoes={acoes} />)}
        </ul>
      )}
    </section>
  );
}
