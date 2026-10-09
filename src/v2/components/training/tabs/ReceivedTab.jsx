/**
 * Aba RECEBIDOS do treino, em duas partes:
 *  - Recebidos: o que o professor mandou (com prazo, primeiro) e o que outros
 *    atletas indicaram. A ação principal é "Pôr no meu treino".
 *  - Enviados: o que eu mandei — para quem, quando, e se já fizeram.
 *
 * Abrir o item marca como lido. Item que sumiu (apagado, ficou privado) é
 * dito, nunca vira um cartão quebrado — mas só com as fontes carregadas.
 */
import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import {
  CalendarPlus, CheckCircle2, Clock, Inbox, NotebookPen, RotateCcw, Send, Trash2,
} from 'lucide-react';
import { cn } from '@/core/lib/utils';
import { instanteEmMs } from '@/core/domain/instant';
import { useShareActions, useTrainingInbox, useTrainingSent } from '@/modules/training/hooks/useTrainingShares';
import { useVisibleTrainingItems } from '@/modules/training/hooks/useTrainingItems';
import { usePeople } from '@/modules/progression/hooks/usePeople';
import { SHARE_KIND, dueLabel, sortInbox } from '@/modules/training/domain/share';
import { todayLocal } from '@/modules/training/domain/dates';
import {
  V2Badge, V2Button, V2EmptyState, V2ErrorState, V2Skeleton, V2Surface,
} from '@/v2/ui/primitives';
import { V2SubTabs } from '@/v2/ui/V2SectionNav';
import ItemCard from '@/v2/components/training/ItemCard';
import { ConfirmDialog, ReasonDialog } from '@/v2/components/training/item/ItemActionDialogs';

const quando = (t) => {
  const ms = instanteEmMs(t);
  return ms ? new Date(ms).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }) : '';
};

const linkBtn = 'inline-flex min-h-[40px] items-center gap-1.5 rounded-full border border-gray-200 px-3 text-sm font-semibold text-ink hover:border-ink';

/** O cartão de um envio recebido. */
function Recebido({ share, item, sumiu, hoje, acoes, onFeito, onRemover }) {
  const doProfessor = share.kind === SHARE_KIND.ALUNO;
  const prazo = doProfessor && !share.done_at ? dueLabel(share.due_date, hoje) : '';
  const atrasado = prazo.startsWith('era para');
  const novo = !share.read_at && !share.done_at;
  const marcarLido = () => { if (novo) acoes.markRead.mutate(share); };
  const fallback = { id: share.item_id, kind: share.item_kind, title: share.item_title || 'Item', author_name: share.from_name, author_role: share.from_role };

  const extra = (
    <div className="space-y-1.5">
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <span className="font-semibold text-gray-600">
          {doProfessor ? `Do professor ${share.from_name}` : `Indicação de ${share.from_name}`}
          {quando(share.created_at) && ` · ${quando(share.created_at)}`}
        </span>
        {novo && <V2Badge tone="acid">Novo</V2Badge>}
        {prazo && (
          <V2Badge tone={atrasado ? 'red' : 'amber'}>
            <Clock className="h-3 w-3" aria-hidden="true" /> {prazo}
          </V2Badge>
        )}
        {share.done_at && (
          <V2Badge tone="green"><CheckCircle2 className="h-3 w-3" aria-hidden="true" /> Feito</V2Badge>
        )}
      </div>
      {share.note && <p className="rounded-2xl bg-gray-50 px-3 py-2 text-sm text-gray-700">“{share.note}”</p>}
      {sumiu && (
        <p className="text-sm text-gray-500">Este item não está mais disponível: o autor o apagou ou mudou quem pode ver.</p>
      )}
    </div>
  );

  return (
    // Abrir o item (pelo link do cartão) já marca como lido.
    <div onClickCapture={marcarLido}>
      <ItemCard
        item={item || fallback}
        extra={extra}
        className={cn(novo && 'border-acid')}
        actions={(
          <>
            {!sumiu && (
              <>
                <Link to={`/treino?aba=planos&adicionar=${encodeURIComponent(share.item_id)}`} className={linkBtn}>
                  <CalendarPlus className="h-4 w-4" aria-hidden="true" /> Pôr no meu treino
                </Link>
                <Link to={`/treino?aba=diario&registrar=${encodeURIComponent(share.item_id)}`} className={linkBtn}>
                  <NotebookPen className="h-4 w-4" aria-hidden="true" /> Registrar que fiz
                </Link>
              </>
            )}
            {share.done_at ? (
              <V2Button
                variant="ghost"
                size="sm"
                disabled={acoes.setDone.isPending}
                onClick={() => acoes.setDone.mutate({ share, done: false }, { onError: () => toast.error('Não foi possível desfazer agora.') })}
              >
                <RotateCcw className="h-4 w-4" aria-hidden="true" /> Desfazer feito
              </V2Button>
            ) : (
              <V2Button variant="ghost" size="sm" onClick={() => onFeito(share)}>
                <CheckCircle2 className="h-4 w-4" aria-hidden="true" /> Feito
              </V2Button>
            )}
            <V2Button variant="ghost" size="sm" onClick={() => onRemover(share)} aria-label={`Remover "${share.item_title}" dos recebidos`}>
              <Trash2 className="h-4 w-4" aria-hidden="true" /> Remover
            </V2Button>
          </>
        )}
      />
    </div>
  );
}

function Recebidos({ identity }) {
  const inbox = useTrainingInbox(identity.uid);
  const visiveis = useVisibleTrainingItems(identity);
  const acoes = useShareActions();
  const [feito, setFeito] = useState(null);
  const [remover, setRemover] = useState(null);
  const hoje = todayLocal();
  const lista = useMemo(() => sortInbox(inbox.data || []), [inbox.data]);

  if (inbox.isPending) return <V2Skeleton className="h-64 rounded-4xl" />;
  if (inbox.isError) {
    return <V2Surface><V2ErrorState title="Não foi possível carregar o que você recebeu" onRetry={() => inbox.refetch()} /></V2Surface>;
  }
  if (lista.length === 0) {
    return (
      <V2Surface>
        <V2EmptyState
          icon={Inbox}
          title="Nada recebido ainda"
          description="Quando o seu professor enviar um treino, ou outro atleta indicar um drill, ele aparece aqui."
          action={<V2Button asChild variant="secondary"><Link to="/treino?aba=biblioteca">Ver a biblioteca</Link></V2Button>}
        />
      </V2Surface>
    );
  }

  // "Sumiu" só é afirmado com todas as fontes de itens carregadas.
  const fontesProntas = !visiveis.isLoading && !visiveis.incompleto;
  const doProfessor = lista.filter((s) => s.kind === SHARE_KIND.ALUNO && !s.done_at);
  const resto = lista.filter((s) => !doProfessor.includes(s));
  const cartao = (s) => (
    <Recebido
      key={s.id}
      share={s}
      item={visiveis.byId[s.item_id]}
      sumiu={fontesProntas && !visiveis.byId[s.item_id]}
      hoje={hoje}
      acoes={acoes}
      onFeito={setFeito}
      onRemover={setRemover}
    />
  );

  return (
    <div className="space-y-6" data-dica="treino-recebidos-lista">
      {visiveis.incompleto && !visiveis.isLoading && (
        <V2ErrorState
          inline
          title="Parte dos itens não carregou"
          description="Os envios aparecem com o nome; abra cada um para ver o conteúdo."
          onRetry={visiveis.refetch}
        />
      )}
      {doProfessor.length > 0 && (
        <section aria-labelledby="recebidos-professor" className="space-y-3">
          <h2 id="recebidos-professor" className="font-display text-lg font-bold text-ink">Do seu professor</h2>
          <div className="grid gap-3 md:grid-cols-2">{doProfessor.map(cartao)}</div>
        </section>
      )}
      {resto.length > 0 && (
        <section aria-labelledby="recebidos-resto" className="space-y-3">
          <h2 id="recebidos-resto" className="font-display text-lg font-bold text-ink">
            {doProfessor.length > 0 ? 'Indicações e concluídos' : 'Recebidos'}
          </h2>
          <div className="grid gap-3 md:grid-cols-2">{resto.map(cartao)}</div>
        </section>
      )}

      <ReasonDialog
        open={!!feito}
        onOpenChange={(o) => { if (!o) setFeito(null); }}
        title="Marcar como feito"
        description={feito?.kind === SHARE_KIND.ALUNO ? 'Se quiser, deixe um recado: o professor vê que você fez e o que escreveu.' : 'Se quiser, anote como foi.'}
        label="Como foi (opcional)"
        confirmLabel="Marcar como feito"
        maxLength={300}
        pending={acoes.setDone.isPending}
        onConfirm={(nota, fechar) => acoes.setDone.mutate({ share: feito, done: true, note: nota }, {
          onSuccess: () => { toast.success('Marcado como feito.'); fechar(); },
          onError: () => toast.error('Não foi possível salvar agora.'),
        })}
      />
      <ConfirmDialog
        open={!!remover}
        onOpenChange={(o) => { if (!o) setRemover(null); }}
        title="Remover dos recebidos?"
        description={remover?.kind === SHARE_KIND.ALUNO ? 'O professor deixa de ver se você fez este item.' : 'O item continua na biblioteca, se for público.'}
        confirmLabel="Remover"
        pending={acoes.remove.isPending}
        onConfirm={() => acoes.remove.mutate(remover, {
          onSuccess: () => { toast.success('Removido.'); setRemover(null); },
          onError: () => toast.error('Não foi possível remover agora.'),
        })}
      />
    </div>
  );
}

function Enviados({ identity }) {
  const sent = useTrainingSent(identity.uid);
  const acoes = useShareActions();
  const [cancelar, setCancelar] = useState(null);
  const lista = useMemo(() => [...(sent.data || [])].sort((a, b) => instanteEmMs(b.created_at) - instanteEmMs(a.created_at)), [sent.data]);
  const { people } = usePeople(lista.slice(0, 40).map((s) => s.to_uid));

  if (sent.isPending) return <V2Skeleton className="h-64 rounded-4xl" />;
  if (sent.isError) {
    return <V2Surface><V2ErrorState title="Não foi possível carregar o que você enviou" onRetry={() => sent.refetch()} /></V2Surface>;
  }
  if (lista.length === 0) {
    return (
      <V2Surface>
        <V2EmptyState
          icon={Send}
          title="Você ainda não enviou nada"
          description={identity.isCoach
            ? 'Abra um item e toque em "Enviar" para mandar aos seus alunos, com prazo e recado.'
            : 'Abra um item e toque em "Indicar" para mandar a outros atletas.'}
          action={<V2Button asChild variant="secondary"><Link to="/treino?aba=biblioteca">Ver a biblioteca</Link></V2Button>}
        />
      </V2Surface>
    );
  }

  const feitos = lista.filter((s) => s.done_at).length;
  return (
    <div className="space-y-3">
      <p className="text-sm text-gray-500">{lista.length} {lista.length === 1 ? 'envio' : 'envios'} · {feitos} {feitos === 1 ? 'feito' : 'feitos'}</p>
      <ul className="divide-y divide-gray-100 rounded-3xl border border-gray-100 bg-paper-pure">
        {lista.map((s) => {
          const nome = people.get(s.to_uid)?.name || 'Atleta';
          return (
            <li key={s.id} className="flex flex-wrap items-start justify-between gap-3 p-4">
              <div className="min-w-0 flex-1">
                <Link to={`/treino/item/${s.item_id}`} className="font-semibold text-ink hover:underline">{s.item_title || 'Item'}</Link>
                <p className="text-sm text-gray-500">
                  {s.kind === SHARE_KIND.ALUNO ? 'Enviado ao aluno' : 'Indicado a'} {nome}
                  {quando(s.created_at) && ` · ${quando(s.created_at)}`}
                  {s.due_date && ` · prazo ${s.due_date.split('-').reverse().slice(0, 2).join('/')}`}
                </p>
                {s.done_at && s.done_note && <p className="mt-1 text-sm text-gray-700">“{s.done_note}”</p>}
              </div>
              <div className="flex items-center gap-2">
                {s.done_at
                  ? <V2Badge tone="green"><CheckCircle2 className="h-3 w-3" aria-hidden="true" /> Feito</V2Badge>
                  : <V2Badge tone="neutral">{s.read_at ? 'Visto' : 'Não visto'}</V2Badge>}
                {!s.done_at && (
                  <V2Button variant="ghost" size="icon" aria-label={`Cancelar o envio de "${s.item_title}" para ${nome}`} onClick={() => setCancelar(s)}>
                    <Trash2 className="h-4 w-4" aria-hidden="true" />
                  </V2Button>
                )}
              </div>
            </li>
          );
        })}
      </ul>
      <ConfirmDialog
        open={!!cancelar}
        onOpenChange={(o) => { if (!o) setCancelar(null); }}
        title="Cancelar este envio?"
        description="O item sai da caixa de quem recebeu."
        confirmLabel="Cancelar envio"
        pending={acoes.remove.isPending}
        onConfirm={() => acoes.remove.mutate(cancelar, {
          onSuccess: () => { toast.success('Envio cancelado.'); setCancelar(null); },
          onError: () => toast.error('Não foi possível cancelar agora.'),
        })}
      />
    </div>
  );
}

const PARTES = [
  { value: 'recebidos', label: 'Recebidos' },
  { value: 'enviados', label: 'Enviados' },
];

export default function ReceivedTab({ identity, params, irPara }) {
  const parte = params.get('parte') === 'enviados' ? 'enviados' : 'recebidos';
  return (
    <div className="space-y-4">
      <V2SubTabs tabs={PARTES} activeValue={parte} ariaLabel="Recebidos ou enviados" onSelect={(t) => irPara('recebidos', { parte: t.value === 'enviados' ? 'enviados' : '' })} />
      {parte === 'enviados' ? <Enviados identity={identity} /> : <Recebidos identity={identity} />}
    </div>
  );
}
