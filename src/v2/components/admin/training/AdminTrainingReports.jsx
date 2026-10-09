/**
 * Treino → DENÚNCIAS: abertas primeiro (as mais antigas na frente). Por
 * denúncia: o motivo, o texto, ir ao item, ocultar o item (com motivo ao
 * autor), decidir — procedente ou improcedente, sempre com a resolução — e
 * apagar a denúncia. Tudo auditado no serviço.
 */
import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import {
  CheckCircle2, ExternalLink, EyeOff, Flag, RotateCcw, Trash2, XCircle,
} from 'lucide-react';
import { useTrainingAdminActions } from '@/modules/training/hooks/useTrainingAdmin';
import { usePeople } from '@/modules/progression/hooks/usePeople';
import { REPORT_REASONS, REPORT_STATUS_LABELS } from '@/modules/training/services/reportService';
import { podeAfirmarVazio } from '@/core/lib/queryState';
import {
  V2Badge, V2Button, V2EmptyState, V2ErrorState, V2Skeleton, V2Surface,
} from '@/v2/ui/primitives';
import { V2SubTabs } from '@/v2/ui/V2SectionNav';
import { ConfirmDialog, ReasonDialog, mensagemDeErro } from '@/v2/components/training/item/ItemActionDialogs';
import { quandoFoi } from '@/v2/components/training/questions/questionsView';
import { openReportsByItem, sortReports } from './adminTrainingView';

function Denuncia({ r, item, itensOk, nomeDe, abertasDoItem, acoes }) {
  const [pedido, setPedido] = useState(null); // 'ocultar' | 'resolvida' | 'descartada' | 'apagar'
  const falhou = (err) => toast.error(mensagemDeErro(err, 'Não foi possível salvar agora.'));
  const fechar = (a) => !a && setPedido(null);
  const aberta = r.status === 'aberta';
  const decidir = (status) => (texto, fim) => acoes.resolveReport.mutate({ report: r, status, resolution: texto }, {
    onSuccess: () => { toast.success(status === 'resolvida' ? 'Denúncia marcada como procedente.' : 'Denúncia marcada como improcedente.'); fim(); },
    onError: falhou,
  });
  const situacaoDoItem = !itensOk ? null : !item ? 'O item já foi excluído.' : item.hidden ? `O item está oculto${item.hidden_reason ? `: ${item.hidden_reason}` : '.'}` : null;
  return (
    <li>
      <V2Surface className="space-y-3">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="text-[11px] font-bold uppercase tracking-widest text-gray-400">
              {REPORT_REASONS[r.reason] || r.reason}{quandoFoi(r.created_at) ? ` · ${quandoFoi(r.created_at)}` : ''}
            </p>
            <Link to={`/treino/item/${r.item_id}`} className="mt-0.5 inline-flex items-center gap-1.5 font-display text-lg font-bold text-ink hover:underline">
              {item?.title || r.item_title || 'Item'} <ExternalLink className="h-4 w-4 text-gray-400" aria-hidden="true" />
            </Link>
            <p className="text-xs text-gray-500">Denunciado por {nomeDe(r.reporter_uid)}{aberta && abertasDoItem > 1 ? ` · ${abertasDoItem} denúncias abertas deste item` : ''}</p>
          </div>
          <V2Badge tone={aberta ? 'amber' : r.status === 'resolvida' ? 'green' : 'neutral'}>{REPORT_STATUS_LABELS[r.status] || r.status}</V2Badge>
        </div>
        {r.text && <p className="whitespace-pre-line rounded-3xl bg-gray-50 p-3 text-sm text-gray-700">{r.text}</p>}
        {situacaoDoItem && <p className="text-sm text-gray-500">{situacaoDoItem}</p>}
        {!aberta && r.resolution && <p className="text-sm text-gray-700"><span className="font-semibold text-ink">Resolução:</span> {r.resolution}</p>}
        <div className="flex flex-wrap gap-2">
          {aberta && item && !item.hidden && (
            <V2Button size="sm" variant="secondary" onClick={() => setPedido('ocultar')}>
              <EyeOff className="h-4 w-4" aria-hidden="true" /> Ocultar o item
            </V2Button>
          )}
          {aberta ? (
            <>
              <V2Button size="sm" onClick={() => setPedido('resolvida')}><CheckCircle2 className="h-4 w-4" aria-hidden="true" /> Procedente</V2Button>
              <V2Button size="sm" variant="ghost" onClick={() => setPedido('descartada')}><XCircle className="h-4 w-4" aria-hidden="true" /> Improcedente</V2Button>
            </>
          ) : (
            <V2Button
              size="sm"
              variant="ghost"
              disabled={acoes.resolveReport.isPending}
              onClick={() => acoes.resolveReport.mutate({ report: r, status: 'aberta', resolution: '' }, { onSuccess: () => toast.success('Denúncia reaberta.'), onError: falhou })}
            >
              <RotateCcw className="h-4 w-4" aria-hidden="true" /> Reabrir
            </V2Button>
          )}
          <V2Button size="sm" variant="ghost" onClick={() => setPedido('apagar')}><Trash2 className="h-4 w-4" aria-hidden="true" /> Apagar</V2Button>
        </div>
      </V2Surface>

      {item && (
        <ReasonDialog
          open={pedido === 'ocultar'}
          onOpenChange={fechar}
          title="Ocultar o item denunciado"
          description="Ele sai da biblioteca e de quem o recebeu; o autor é avisado com o motivo. A denúncia continua aberta até você decidir."
          label="Motivo (o autor vai ler)"
          confirmLabel="Ocultar"
          required
          pending={acoes.hide.isPending}
          onConfirm={(motivo, fim) => acoes.hide.mutate({ item, hidden: true, reason: motivo }, {
            onSuccess: () => { toast.success('Item ocultado. O autor foi avisado.'); fim(); }, onError: falhou,
          })}
        />
      )}
      <ReasonDialog
        open={pedido === 'resolvida'}
        onOpenChange={fechar}
        title="Denúncia procedente"
        description="Registre o que foi feito (ex.: item ocultado, autor orientado). Fica na auditoria; quem denunciou não é avisado."
        label="Resolução"
        confirmLabel="Marcar procedente"
        required
        pending={acoes.resolveReport.isPending}
        onConfirm={decidir('resolvida')}
      />
      <ReasonDialog
        open={pedido === 'descartada'}
        onOpenChange={fechar}
        title="Denúncia improcedente"
        description="Diga por que o item fica como está. Fica na auditoria."
        label="Resolução"
        confirmLabel="Marcar improcedente"
        required
        pending={acoes.resolveReport.isPending}
        onConfirm={decidir('descartada')}
      />
      <ConfirmDialog
        open={pedido === 'apagar'}
        onOpenChange={fechar}
        title="Apagar esta denúncia?"
        description="Ela some da fila. O item não muda. A exclusão fica registrada na auditoria."
        confirmLabel="Apagar"
        pending={acoes.deleteReport.isPending}
        onConfirm={() => acoes.deleteReport.mutate(r, { onSuccess: () => { toast.success('Denúncia apagada.'); setPedido(null); }, onError: falhou })}
      />
    </li>
  );
}

export default function AdminTrainingReports({ identity, settingsQ, itens, denuncias }) {
  const acoes = useTrainingAdminActions(identity, settingsQ.settings);
  const [parte, setParte] = useState('abertas');
  const { abertas, outras } = useMemo(() => sortReports(denuncias.data || []), [denuncias.data]);
  const porItem = useMemo(() => openReportsByItem(denuncias.data || []), [denuncias.data]);
  const itemPorId = useMemo(() => new Map((itens.data || []).map((it) => [it.id, it])), [itens.data]);
  const quem = useMemo(() => [...new Set((denuncias.data || []).map((r) => r.reporter_uid).filter(Boolean))], [denuncias.data]);
  const { people } = usePeople(quem);
  const nomeDe = (uid) => people.get(uid)?.name || 'uma conta';

  if (denuncias.isPending) return <V2Skeleton className="h-64 rounded-4xl" />;
  if (denuncias.isError) return <V2Surface><V2ErrorState title="As denúncias não carregaram" onRetry={() => denuncias.refetch()} /></V2Surface>;

  const lista = parte === 'abertas' ? abertas : outras;
  return (
    <section className="space-y-4" aria-label="Denúncias" data-dica="admin-treino-denuncias">
      <V2SubTabs
        tabs={[{ value: 'abertas', label: `Abertas (${abertas.length})` }, { value: 'decididas', label: `Decididas (${outras.length})` }]}
        activeValue={parte}
        onSelect={(t) => setParte(t.value)}
        ariaLabel="Quais denúncias"
      />
      {itens.isError && <V2ErrorState inline title="Os itens não carregaram" description="As denúncias aparecem, mas sem a situação atual de cada item." onRetry={() => itens.refetch()} />}
      {podeAfirmarVazio(denuncias) && !lista.length ? (
        <V2Surface>
          <V2EmptyState
            icon={Flag}
            title={parte === 'abertas' ? 'Nenhuma denúncia aberta' : 'Nenhuma denúncia decidida ainda'}
            description={parte === 'abertas' ? 'Quando alguém denunciar um item, ele aparece aqui. O item continua visível até a equipe decidir.' : 'As denúncias decididas ficam aqui, com a resolução.'}
          />
        </V2Surface>
      ) : (
        <ul className="space-y-3">
          {lista.map((r) => (
            <Denuncia
              key={r.id}
              r={r}
              item={itemPorId.get(r.item_id)}
              itensOk={itens.isSuccess}
              nomeDe={nomeDe}
              abertasDoItem={porItem.get(r.item_id) || 0}
              acoes={acoes}
            />
          ))}
        </ul>
      )}
    </section>
  );
}
