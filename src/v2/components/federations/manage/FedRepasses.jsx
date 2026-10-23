/**
 * REPASSES da cobrança dividida (Bloco 6d, `docs/50` §46), na aba Recebidos.
 *
 * Quem repassa (financeiro da federação): a parte do clube e da confederação
 * de cada filiação paga, "A repassar" → "Marcar repassado" (ou desfazer, com
 * motivo). A confederação vê o que as filiadas já repassaram. Quem grava é o
 * servidor (`federationSplit`); repassado vira item derivado das contas.
 */
import React, { useState } from 'react';
import { toast } from 'sonner';
import { ArrowRightLeft } from 'lucide-react';
import { useRepassesIn, useRepassesOut, useSplitAction } from '@/modules/federations/hooks/useNational';
import { formatBrlCents } from '@/modules/federations/domain/charges';
import { isConfederation } from '@/modules/federations/domain/national';
import { REPASSE_STATUS, REPASSE_STATUS_LABELS, REPASSE_TO_LABELS } from '@/modules/federations/domain/split';
import { V2Badge, V2Button, V2ErrorState, V2Skeleton, V2Surface, V2Textarea } from '@/v2/ui/primitives';
import { t, tn } from '@/core/i18n';

const dataBR = (iso) => (iso ? String(iso).split('-').reverse().join('/') : '');

function RepasseRow({ r, podeMarcar }) {
  const m = useSplitAction();
  const [desfazendo, setDesfazendo] = useState(false);
  const [motivo, setMotivo] = useState('');
  const agir = (action, msg) => m.mutate({ repasseId: r.id, action, reason: motivo }, { onSuccess: () => { setDesfazendo(false); setMotivo(''); toast.success(msg); }, onError: (e) => toast.error(e.message) });
  const pago = r.status === REPASSE_STATUS.PAID;
  return (
    <li className="rounded-xl border border-gray-100 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="font-medium text-ink">{podeMarcar ? `${t(REPASSE_TO_LABELS[r.to])}: ${r.to_name}` : (r.federation_acronym || r.federation_name)}</p>
          <p className="text-sm text-gray-500">{t('{pct}% de {valor} · plano {plano} · pago em {data}', { pct: r.pct, valor: formatBrlCents(r.base_cents), plano: r.plan_name, data: dataBR(r.charge_paid_at) })}</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="font-semibold text-ink">{formatBrlCents(r.amount_cents)}</span>
          <V2Badge tone={pago ? 'green' : 'amber'}>{pago ? t('Repassado em {data}', { data: dataBR(r.paid_at) }) : t(REPASSE_STATUS_LABELS.pending)}</V2Badge>
        </div>
      </div>
      {podeMarcar && !pago && (
        <div className="mt-2"><V2Button type="button" size="sm" disabled={m.isPending} onClick={() => agir('pay', t('Repasse marcado.'))}>{t('Marcar repassado')}</V2Button></div>
      )}
      {podeMarcar && pago && !desfazendo && (
        <div className="mt-2"><V2Button type="button" size="sm" variant="ghost" onClick={() => setDesfazendo(true)}>{t('Desfazer')}</V2Button></div>
      )}
      {desfazendo && (
        <div className="mt-2 space-y-2">
          <label htmlFor={`repasse-motivo-${r.id}`} className="text-sm font-medium text-ink">{t('Motivo')}</label>
          <V2Textarea id={`repasse-motivo-${r.id}`} rows={2} maxLength={300} value={motivo} onChange={(e) => setMotivo(e.target.value)} />
          <div className="flex gap-2">
            <V2Button type="button" size="sm" disabled={m.isPending || motivo.trim().length < 3} onClick={() => agir('reopen', t('Repasse voltou para "A repassar".'))}>{t('Desfazer o repasse')}</V2Button>
            <V2Button type="button" size="sm" variant="ghost" onClick={() => setDesfazendo(false)}>{t('Voltar')}</V2Button>
          </div>
        </div>
      )}
    </li>
  );
}

function Bloco({ titulo, descricao, consulta, podeMarcar }) {
  if (consulta.isError) return <V2ErrorState inline title={t('Os repasses não carregaram')} onRetry={() => consulta.refetch()} />;
  if (consulta.isLoading) return <V2Skeleton lines={3} />;
  const lista = consulta.data || [];
  if (!lista.length) return null;
  const pendentes = lista.filter((r) => r.status === REPASSE_STATUS.PENDING);
  return (
    <V2Surface className="space-y-3 p-4">
      <div className="flex items-start gap-2">
        <ArrowRightLeft className="mt-1 h-4 w-4 shrink-0 text-gray-500" aria-hidden="true" />
        <div>
          <h3 className="font-display text-lg font-bold text-ink">{titulo}</h3>
          <p className="text-sm text-gray-500">{descricao}</p>
          {podeMarcar && pendentes.length > 0 && <p className="mt-1 text-sm font-medium text-ink">{tn(pendentes.length, '{n} a repassar', '{n} a repassar')} · {formatBrlCents(pendentes.reduce((a, r) => a + (Number(r.amount_cents) || 0), 0))}</p>}
        </div>
      </div>
      <ul className="space-y-2">{lista.map((r) => <RepasseRow key={r.id} r={r} podeMarcar={podeMarcar} />)}</ul>
    </V2Surface>
  );
}

export default function FedRepasses({ federation }) {
  const conf = isConfederation(federation);
  const saida = useRepassesOut(federation.id);
  const entrada = useRepassesIn(federation.id, { enabled: conf });
  return (
    <>
      <Bloco consulta={saida} podeMarcar titulo={t('Repasses')} descricao={t('A parte do clube e da confederação nas filiações pagas, pelas porcentagens do plano. Faça a transferência e marque aqui: o repasse entra nas contas.')} />
      {conf && <Bloco consulta={entrada} podeMarcar={false} titulo={t('Repasses das filiadas')} descricao={t('O que as federações filiadas já repassaram das filiações delas.')} />}
    </>
  );
}
