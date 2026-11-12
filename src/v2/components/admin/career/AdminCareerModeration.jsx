/**
 * Painel admin → Carreira → Denúncias de dupla (flag `athlete_career`).
 *
 * A fila vem do SERVIDOR (`career` → `queue`): a regra de `career_partner` só
 * deixa o dono e a dupla lerem, e a fila devolve só o que é preciso para
 * decidir — sem uid. Decidir pede MOTIVO, grava auditoria e avisa quem perdeu
 * algo (a dupla, se a visão sai; quem registrou, se o pedido sai).
 */
import React, { useState } from 'react';
import { toast } from 'sonner';
import { Flag } from 'lucide-react';
import { PARTNER_REPORT_LABEL, PARTNER_STATUS_LABEL } from '@/modules/career/domain/careerPartner.js';
import { aspectLabel } from '@/modules/training/domain/debrief.js';
import { useCareerModerationQueue, useCareerPartnerAction } from '@/modules/career/hooks/useCareer';
import { careerDateLabel } from '@/v2/components/career/careerUi';
import { V2Badge, V2Button, V2Surface, V2EmptyState, V2ErrorState, V2Field, V2Skeleton, V2Textarea } from '@/v2/ui/primitives';
import { fmtData, t, tk } from '@/core/i18n';

const DECISOES = [
  { id: 'dismiss', label: tk('Manter (denúncia sem fundamento)'), variant: 'secondary' },
  { id: 'remove_feedback', label: tk('Retirar a visão da dupla'), variant: 'danger', precisaVisao: true },
  { id: 'remove_link', label: tk('Retirar o pedido inteiro'), variant: 'danger' },
];

function Item({ item }) {
  const acao = useCareerPartnerAction();
  const [motivo, setMotivo] = useState('');
  const sm = item.summary || {};
  const fb = item.feedback;
  // O pedido já foi apagado (registro excluído) e a denúncia segue aberta: sobra o nome do torneio, sem data nem visão.
  const apagado = item.status === 'removed';
  async function decidir(decision) {
    try {
      await acao.mutateAsync({ action: 'moderate', docId: item.id, decision, reason: motivo });
      toast.success(t('Decisão registrada.'));
    } catch (err) {
      toast.error(err?.message || t('Não foi possível concluir. Tente de novo.'));
    }
  }
  const id = `moderar-${item.id}`;
  return (
    <V2Surface className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="font-semibold text-ink">{sm.name || t('Torneio')}</p>
        <V2Badge tone="red">{t(PARTNER_REPORT_LABEL[item.report_reason] || PARTNER_REPORT_LABEL.other)}</V2Badge>
      </div>
      <p className="text-xs text-gray-600">
        {[
          t('{dono} com {dupla}', { dono: item.owner_name || '—', dupla: item.partner_name || '—' }),
          careerDateLabel(sm.start_date, sm.date_precision),
          PARTNER_STATUS_LABEL[item.status] ? t(PARTNER_STATUS_LABEL[item.status]) : '',
          item.reported_by === 'owner' ? t('Denunciado por quem registrou') : t('Denunciado pela dupla'),
          item.reported_at_ms ? fmtData(new Date(item.reported_at_ms), { day: 'numeric', month: 'short' }) : '',
        ].filter(Boolean).join(' · ')}
      </p>
      {apagado && (
        <p className="rounded-2xl border border-gray-200 p-3 text-sm text-gray-700">
          {t('O pedido já foi apagado: não há mais confirmação nem visão para ver. Encerre a denúncia mantendo-a como sem fundamento ou registrando a retirada do pedido.')}
        </p>
      )}
      {item.report_note && <p className="rounded-2xl bg-paper p-3 text-sm text-gray-700">{item.report_note}</p>}
      {fb && (
        <div className="space-y-1 text-sm text-gray-700">
          {(fb.strengths || []).length > 0 && <p>{t('Pontos fortes:')} {fb.strengths.map(aspectLabel).join(', ')}</p>}
          {(fb.improve || []).length > 0 && <p>{t('O que melhorar:')} {fb.improve.map(aspectLabel).join(', ')}</p>}
          {[fb.text_strength, fb.text_improve, fb.text_drill].filter(Boolean).map((x, i) => <p key={i} className="rounded-2xl bg-paper p-2">{x}</p>)}
        </div>
      )}
      <V2Field label={t('Motivo da decisão (vai no aviso a quem perde algo)')} htmlFor={`${id}-motivo`} required>
        <V2Textarea id={`${id}-motivo`} rows={2} maxLength={500} value={motivo} onChange={(e) => setMotivo(e.target.value)} />
      </V2Field>
      <div className="flex flex-wrap gap-2">
        {DECISOES.filter((d) => !d.precisaVisao || (fb && !apagado)).map((d) => (
          <V2Button key={d.id} type="button" size="sm" variant={d.variant} disabled={motivo.trim().length < 5 || acao.isPending} onClick={() => decidir(d.id)}>
            {t(d.label)}
          </V2Button>
        ))}
      </div>
    </V2Surface>
  );
}

export default function AdminCareerModeration() {
  const fila = useCareerModerationQueue();
  if (fila.isPending) return <V2Skeleton className="h-40 rounded-3xl" />;
  if (fila.isError) return <V2ErrorState title={t('Não carregaram as denúncias de dupla')} description={fila.error?.message} onRetry={() => fila.refetch()} />;
  const itens = fila.data || [];
  return (
    <div className="space-y-4" data-dica="admin-carreira-denuncias">
      <p className="text-sm text-gray-600">
        {t('Denúncias sobre a confirmação ou a visão da dupla na Carreira. A visão é privada entre as duas pessoas e nunca entra em ranking, rating nem XP.')}
      </p>
      {itens.length === 0 ? (
        <V2EmptyState icon={Flag} title={t('Nenhuma denúncia de dupla aberta')} />
      ) : (
        itens.map((it) => <Item key={it.id} item={it} />)
      )}
    </div>
  );
}
