/**
 * Moderação dos comentários (Central → Acervo oficial ou Agenda → Comentários;
 * permissão `docs` ou `admin`): a fila do que pede olhar — comentário ocultado
 * por denúncias (3 pessoas diferentes), ocultado pela equipe e visível com
 * denúncia. Daqui se reabre ou se oculta com motivo; responder e mudar o modo
 * dos comentários fica na página do documento ou do evento, ao lado do texto.
 * A fila vem do servidor (`federationComments`, ação `queue`). O filtro mora
 * na URL (`?filtro=`) e a lista tem busca e "Mostrar mais".
 */
import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import { EyeOff, Flag, MessageSquare, RotateCcw } from 'lucide-react';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { commentAction } from '@/modules/federations/services/federationService';
import { useCommentsQueue, useFederationMutation } from '@/modules/federations/hooks/useFederations';
import { docPublicPath } from '@/modules/federations/domain/acervo';
import { eventPublicPath } from '@/modules/federations/domain/agenda';
import { V2Badge, V2Button, V2EmptyState, V2ErrorState, V2Select, V2Skeleton, V2Surface } from '@/v2/ui/primitives';
import { fmtData, t, tk, tn } from '@/core/i18n';
import { HideDialog } from '../comments/CommentsSection';
import { BuscaLista, MostrarMais, useBuscaLista, useFiltroNaUrl } from './listTools';

const FILTROS = [
  { id: 'all', label: tk('Tudo') },
  { id: 'reports', label: tk('Ocultos por denúncias') },
  { id: 'staff', label: tk('Ocultos pela moderação') },
  { id: 'reported', label: tk('Visíveis com denúncia') },
];
const FILTROS_VALIDOS = FILTROS.map((x) => x.id);
const CAMPOS_COMENTARIO = ['user_name', 'text', 'target_title'];

const quando = (ms) => (ms ? fmtData(new Date(ms), { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '');

/** Em que filtro o item cai. */
export function queueBucket(c) {
  if (c.status === 'hidden') return c.hidden_by === 'staff' ? 'staff' : 'reports';
  return 'reported';
}

function Item({ federation, c, onHide }) {
  const [reabrindo, setReabrindo] = useState(false);
  const reabrir = useFederationMutation(() => commentAction({ federationId: federation.id, action: 'restore', commentId: c.id }));
  const link = c.target_kind === 'doc' ? docPublicPath(federation, c.target_id) : eventPublicPath(federation, { id: c.target_id });
  const bucket = queueBucket(c);
  return (
    <li className="space-y-2 rounded-2xl border border-gray-100 bg-white p-4">
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <span className="font-semibold text-ink">{c.user_name}</span>
        <span className="text-gray-500">{quando(c.created_at_ms)}</span>
        {bucket === 'reports' && <V2Badge tone="red">{t('Oculto por denúncias')}</V2Badge>}
        {bucket === 'staff' && <V2Badge tone="neutral">{t('Oculto pela moderação')}</V2Badge>}
        {c.reports_count > 0 && <V2Badge tone="amber"><Flag className="h-3 w-3" aria-hidden="true" />{tn(c.reports_count, '{n} denúncia', '{n} denúncias', { n: c.reports_count })}</V2Badge>}
      </div>
      <p className="whitespace-pre-line text-sm text-gray-800">{c.text}</p>
      {c.hidden_reason && <p className="text-xs text-gray-500">{t('Motivo: {motivo}', { motivo: c.hidden_reason })}</p>}
      <div className="flex flex-wrap items-center gap-2">
        <Link to={link} className="text-xs font-semibold text-ink underline underline-offset-2">{c.target_title || t('Abrir onde foi escrito')}</Link>
        <span className="flex-1" />
        {c.status === 'hidden'
          ? <V2Button type="button" size="sm" variant="secondary" disabled={reabrir.isPending} onClick={() => setReabrindo(true)} aria-label={t('Reabrir o comentário de {nome}', { nome: c.user_name })}><RotateCcw className="h-4 w-4" />{t('Reabrir')}</V2Button>
          : <V2Button type="button" size="sm" variant="secondary" onClick={() => onHide(c)} aria-label={t('Ocultar o comentário de {nome}', { nome: c.user_name })}><EyeOff className="h-4 w-4" />{t('Ocultar')}</V2Button>}
      </div>
      {/* Reabrir zera as denúncias (o servidor exige três NOVAS para ocultar sozinho de novo): a contagem não volta. */}
      <ConfirmDialog
        open={reabrindo}
        onOpenChange={setReabrindo}
        loading={reabrir.isPending}
        title={t('Reabrir o comentário de {nome}?', { nome: c.user_name })}
        description={t('O comentário volta a aparecer para todos onde foi escrito, e as denúncias são zeradas. Se precisar, dá para ocultar de novo depois.')}
        confirmLabel={t('Reabrir')}
        cancelLabel={t('Voltar')}
        onConfirm={() => reabrir.mutate(undefined, { onSuccess: () => { setReabrindo(false); toast.success(t('Comentário reaberto.')); }, onError: (e) => toast.error(e.message) })}
      />
    </li>
  );
}

export default function FedCommentsPanel({ federation }) {
  const q = useCommentsQueue(federation.id);
  const [filtro, setFiltro] = useFiltroNaUrl('filtro', 'all', FILTROS_VALIDOS);
  const [ocultar, setOcultar] = useState(null);
  const todos = useMemo(() => q.data?.items || [], [q.data]);
  const contagem = useMemo(() => {
    const n = { all: todos.length };
    todos.forEach((c) => { const b = queueBucket(c); n[b] = (n[b] || 0) + 1; });
    return n;
  }, [todos]);
  const itens = useMemo(() => todos.filter((c) => filtro === 'all' || queueBucket(c) === filtro), [todos, filtro]);
  const busca = useBuscaLista(itens, CAMPOS_COMENTARIO);
  return (
    <V2Surface className="space-y-4 p-5" data-dica="federacao-comentarios-moderacao">
      <div className="flex flex-wrap items-end gap-3">
        <div className="min-w-0 flex-1">
          <h2 className="flex items-center gap-2 font-display text-lg font-bold text-ink"><MessageSquare className="h-5 w-5" aria-hidden="true" />{t('Comentários para olhar')}</h2>
          <p className="text-sm text-gray-500">{t('Três denúncias de pessoas diferentes ocultam um comentário sozinhas. Reabrir zera as denúncias; ocultar avisa quem escreveu, com o motivo.')}</p>
        </div>
        <V2Select aria-label={t('Filtrar')} value={filtro} onChange={(e) => setFiltro(e.target.value)} className="w-auto">
          {FILTROS.map((x) => <option key={x.id} value={x.id}>{q.isSuccess ? `${t(x.label)} (${contagem[x.id] || 0})` : t(x.label)}</option>)}
        </V2Select>
      </div>
      {q.isSuccess && itens.length > 0 && <BuscaLista id="com-busca" value={busca.termo} onChange={busca.setTermo} placeholder={t('Buscar por autor, texto ou documento')} total={itens.length} achados={busca.filtrados.length} />}
      {q.isLoading ? <V2Skeleton lines={4} />
        : q.isError ? <V2ErrorState inline onRetry={q.refetch} />
          : itens.length === 0 ? <V2EmptyState title={filtro === 'all' ? t('Nada para olhar agora') : t('Nada neste filtro')} description={t('Os comentários denunciados ou ocultados aparecem aqui.')} />
            : busca.filtrados.length === 0 ? <V2EmptyState title={t('Nenhum comentário com esse termo')} />
              : <ul className="space-y-3">{busca.visiveis.map((c) => <Item key={c.id} federation={federation} c={c} onHide={setOcultar} />)}</ul>}
      {q.isSuccess && <MostrarMais restam={busca.restam} onClick={busca.mostrarMais} />}
      {ocultar && <HideDialog federation={federation} comment={ocultar} onClose={() => setOcultar(null)} />}
    </V2Surface>
  );
}
