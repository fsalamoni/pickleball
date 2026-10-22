/**
 * "Federação" na gestão do CLUBE (`kind="club"`) e na Central da ARENA
 * (`kind="arena"`): pedir filiação a uma federação que recebe clubes e arenas
 * (módulo `affiliations` ligado), acompanhar o pedido, desfazer. Quem gere a
 * organização pede; a federação decide. Flag `federations` desligada ⇒ nada.
 *
 * Federação com PLANO para clubes (ou arenas) — Etapa 2, 2026-10-22: o pedido
 * vira filiação por plano (`/federacoes/:id/filiar?entidade=club:ID`), com
 * cobrança, documentos e certificado; a lista mostra essas filiações e o
 * espelho delas em `federation_affiliations` não aparece duas vezes.
 */
import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import { ArrowRight, Check, Landmark, Send, Trash2, X } from 'lucide-react';
import { useAuth } from '@/core/lib/FirebaseAuthContext';
import { answerAffiliationInvite, requestAffiliation, withdrawAffiliation } from '@/modules/federations/services/federationService';
import { useFederationMutation, useFederationPlans, useFederationsEnabled, useOrgAffiliations, useOrgMemberships, usePublicFederations } from '@/modules/federations/hooks/useFederations';
import { LIVE_MEMBER_STATUSES, membershipState } from '@/modules/federations/domain/membership';
import { MemberStatusBadge, quando } from './federationUi';
import { fedModuleOn } from '@/modules/federations/domain/federation';
import { affiliationState } from '@/modules/federations/domain/affiliations';
import { AFFILIATION_STATUS_LABELS } from '@/modules/federations/domain/constants';
import { V2Badge, V2Button, V2ErrorState, V2Field, V2Select, V2Skeleton, V2Surface, V2Textarea } from '@/v2/ui/primitives';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { t } from '@/core/i18n';

const TOM = { pending: 'amber', approved: 'green', rejected: 'red', suspended: 'red', invited: 'blue' };
// Âncoras das dicas (literais, para o guarda `dicas.test.js` as encontrar).
const DICA = { club: { dica: 'clube-federacao' }, arena: { dica: 'arena-federacao' } };

function Linha({ aff, onWithdraw, onAnswer, pending }) {
  const st = affiliationState(aff);
  if (st.invited) {
    return (
      <li className="space-y-2 rounded-2xl border border-blue-100 bg-blue-50 p-3">
        <p className="flex flex-wrap items-center gap-2 font-semibold text-ink">
          <Link to={`/federacoes/${aff.federation_id}`} className="hover:underline">{aff.federation_name || aff.federation_acronym}</Link>
          <V2Badge tone="blue">{t(AFFILIATION_STATUS_LABELS.invited)}</V2Badge>
        </p>
        <p className="text-sm text-gray-700">{t('A federação convidou para se filiar. Aceito, vira filiado na hora e o selo "Filiado" aparece na página.')}</p>
        {aff.message && <p className="text-sm text-gray-700">“{aff.message}”</p>}
        <div className="flex flex-wrap gap-2">
          <V2Button type="button" size="sm" disabled={pending} onClick={() => onAnswer(aff, true)}><Check className="h-4 w-4" />{t('Aceitar o convite')}</V2Button>
          <V2Button type="button" size="sm" variant="ghost" disabled={pending} onClick={() => onAnswer(aff, false)}><X className="h-4 w-4" />{t('Recusar')}</V2Button>
        </div>
      </li>
    );
  }
  return (
    <li className="flex flex-wrap items-center gap-3 rounded-2xl border border-gray-100 bg-white p-3">
      <div className="min-w-0 flex-1">
        <p className="flex flex-wrap items-center gap-2 font-semibold text-ink">
          <Link to={`/federacoes/${aff.federation_id}`} className="hover:underline">{aff.federation_name || aff.federation_acronym}</Link>
          <V2Badge tone={TOM[aff.status] || 'neutral'}>{t(AFFILIATION_STATUS_LABELS[aff.status] || aff.status)}</V2Badge>
        </p>
        {aff.review?.reason && !st.approved && <p className="text-sm text-red-600">{t('Motivo: {motivo}', { motivo: aff.review.reason })}</p>}
      </div>
      {st.canWithdraw && <V2Button type="button" size="sm" variant="ghost" disabled={pending} onClick={() => onWithdraw(aff)}><Trash2 className="h-4 w-4" />{st.approved ? t('Desfiliar') : t('Retirar pedido')}</V2Button>}
    </li>
  );
}

/** A filiação POR PLANO desta entidade numa federação: situação e o caminho para pagar, enviar documentos, renovar. */
function LinhaPorPlano({ member, kind, orgId }) {
  const st = membershipState(member);
  return (
    <li className="flex flex-wrap items-center gap-3 rounded-2xl border border-gray-100 bg-white p-3">
      <div className="min-w-0 flex-1">
        <p className="flex flex-wrap items-center gap-2 font-semibold text-ink">
          <Link to={`/federacoes/${member.federation_id}`} className="hover:underline">{member.federation_name || member.federation_acronym}</Link>
          <MemberStatusBadge status={st.status} label={st.label} />
        </p>
        <p className="text-xs text-gray-500">{[member.plan_name, member.member_number ? t('nº {numero}', { numero: member.member_number }) : '', st.validUntil ? t('válida até {data}', { data: quando(st.validUntil) }) : ''].filter(Boolean).join(' · ')}</p>
      </div>
      <V2Button asChild size="sm" variant="secondary"><Link to={`/federacoes/${member.federation_id}/filiar?entidade=${kind}:${orgId}`}>{t('Abrir a filiação')}<ArrowRight className="h-4 w-4" /></Link></V2Button>
    </li>
  );
}

export default function OrgAffiliationCard({ kind, org }) {
  const ligado = useFederationsEnabled();
  const { user } = useAuth();
  const feds = usePublicFederations({ enabled: ligado });
  const minhas = useOrgAffiliations(kind, org?.id, { enabled: ligado });
  const porPlano = useOrgMemberships(kind, org?.id, { enabled: ligado });
  const [fedId, setFedId] = useState('');
  // A federação escolhida tem plano para esta entidade? Então o pedido é pela filiação por plano.
  const planosQ = useFederationPlans(fedId, { enabled: ligado && Boolean(fedId) });
  const planosDaEntidade = (planosQ.data || []).filter((p) => p.active !== false && p.entity === kind);
  const vivas = (porPlano.data || []).filter((m) => LIVE_MEMBER_STATUSES.includes(m.status) || m.status === 'expired');
  const simples = (minhas.data || []).filter((a) => !a.member_id);
  const [mensagem, setMensagem] = useState('');
  const [confirmar, setConfirmar] = useState(null);
  const pedir = useFederationMutation(() => requestAffiliation({ federation: (feds.data || []).find((f) => f.id === fedId), kind, org, uid: user?.uid, message: mensagem }));
  const retirar = useFederationMutation((aff) => withdrawAffiliation(aff, { uid: user?.uid }));
  const responder = useFederationMutation(({ aff, aceitar }) => answerAffiliationInvite(aff, aceitar, { uid: user?.uid }));
  const onAnswer = (aff, aceitar) => responder.mutate({ aff, aceitar }, {
    onSuccess: () => toast.success(aceitar ? t('Convite aceito: agora é filiado à {sigla}.', { sigla: aff.federation_acronym || aff.federation_name }) : t('Convite recusado.')),
    onError: (e) => toast.error(e.message),
  });
  const opcoes = useMemo(() => (feds.data || []).filter((f) => fedModuleOn(f, 'affiliations'))
    .filter((f) => !(minhas.data || []).some((a) => a.federation_id === f.id && !affiliationState(a).canRequest))
    .filter((f) => !(porPlano.data || []).some((m) => m.federation_id === f.id && LIVE_MEMBER_STATUSES.includes(m.status))), [feds.data, minhas.data, porPlano.data]);
  if (!ligado) return null;
  return (
    <V2Surface className="space-y-4" data-dica={DICA[kind]?.dica}>
      <div className="flex items-start gap-3">
        <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-acid/15 text-ink"><Landmark className="h-5 w-5" aria-hidden="true" /></span>
        <div>
          <h2 className="font-display text-lg font-bold text-ink">{t('Federação')}</h2>
          <p className="text-sm text-gray-500">{kind === 'club' ? t('Filie o clube a uma federação: ele aparece na página dela e ganha o selo "Filiado". A federação aprova.') : t('Filie a arena a uma federação: ela aparece na página da federação e ganha o selo "Filiado". A federação aprova.')}</p>
        </div>
      </div>
      {(minhas.isError || porPlano.isError) && <V2ErrorState inline title={t('Não carregaram as filiações')} onRetry={() => [minhas, porPlano].filter((q) => q.isError).forEach((q) => q.refetch())} />}
      {(minhas.isLoading || porPlano.isLoading) && <V2Skeleton lines={2} />}
      {minhas.isSuccess && porPlano.isSuccess && (vivas.length + simples.length) > 0 && (
        <ul className="space-y-2">
          {vivas.map((m) => <LinhaPorPlano key={m.id} member={m} kind={kind} orgId={org.id} />)}
          {simples.map((a) => <Linha key={a.id} aff={a} pending={retirar.isPending || responder.isPending} onWithdraw={setConfirmar} onAnswer={onAnswer} />)}
        </ul>
      )}
      {/* Desfiliar apaga o vínculo: voltar é um pedido novo, com nova aprovação. Por isso pergunta antes. */}
      <ConfirmDialog
        open={Boolean(confirmar)}
        onOpenChange={(o) => { if (!o) setConfirmar(null); }}
        destructive={Boolean(confirmar && affiliationState(confirmar).approved)}
        loading={retirar.isPending}
        title={confirmar && affiliationState(confirmar).approved
          ? t('Desfiliar da {sigla}?', { sigla: confirmar.federation_acronym || confirmar.federation_name })
          : t('Retirar o pedido à {sigla}?', { sigla: confirmar?.federation_acronym || confirmar?.federation_name || '' })}
        description={confirmar && affiliationState(confirmar).approved
          ? t('Sai da página da federação e perde o selo "Filiado" agora. Para voltar, é um pedido novo, que a federação aprova de novo.')
          : t('O pedido sai da fila da federação. Dá para pedir de novo quando quiser.')}
        confirmLabel={confirmar && affiliationState(confirmar).approved ? t('Desfiliar') : t('Retirar pedido')}
        cancelLabel={t('Voltar')}
        onConfirm={() => {
          const aprovada = affiliationState(confirmar).approved;
          retirar.mutate(confirmar, {
            onSuccess: () => { setConfirmar(null); toast.success(aprovada ? t('Desfiliado da federação.') : t('Pedido retirado.')); },
            onError: (e) => toast.error(e.message),
          });
        }}
      />
      {feds.isError && <V2ErrorState inline title={t('Não carregaram as federações')} onRetry={() => feds.refetch()} />}
      {feds.isSuccess && minhas.isSuccess && porPlano.isSuccess && (opcoes.length === 0
        ? ((vivas.length + simples.length) === 0 && <p className="text-sm text-gray-500">{t('Nenhuma federação recebe filiação de clubes e arenas ainda.')}</p>)
        : (
          <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); if (!fedId) return; pedir.mutate(undefined, { onSuccess: () => { toast.success(t('Pedido enviado. A federação foi avisada.')); setFedId(''); setMensagem(''); }, onError: (er) => toast.error(er.message) }); }}>
            <V2Field label={t('Pedir filiação a')} htmlFor={`fed-${kind}`}>
              <V2Select id={`fed-${kind}`} value={fedId} onChange={(e) => setFedId(e.target.value)} options={[{ value: '', label: t('Escolha a federação') }, ...opcoes.map((f) => ({ value: f.id, label: `${f.acronym} · ${f.name}` }))]} />
            </V2Field>
            {fedId && planosQ.isError && <V2ErrorState inline title={t('Não carregaram os planos da federação')} onRetry={() => planosQ.refetch()} />}
            {fedId && planosQ.isLoading && <V2Skeleton lines={1} />}
            {fedId && planosQ.isSuccess && planosDaEntidade.length > 0 && (
              <div className="space-y-2 rounded-2xl border border-gray-100 p-3">
                <p className="text-sm text-gray-700">{kind === 'club' ? t('Esta federação tem planos para clubes: escolha o plano, envie os documentos e acompanhe a cobrança e o certificado pela plataforma.') : t('Esta federação tem planos para arenas: escolha o plano, envie os documentos e acompanhe a cobrança e o certificado pela plataforma.')}</p>
                <div className="flex justify-end"><V2Button asChild size="sm"><Link to={`/federacoes/${fedId}/filiar?entidade=${kind}:${org.id}`}>{t('Ver os planos e filiar')}<ArrowRight className="h-4 w-4" /></Link></V2Button></div>
              </div>
            )}
            {(!fedId || (planosQ.isSuccess && planosDaEntidade.length === 0)) && (
              <>
                <V2Field label={t('Mensagem (opcional)')} htmlFor={`fed-msg-${kind}`}>
                  <V2Textarea id={`fed-msg-${kind}`} rows={2} maxLength={500} value={mensagem} onChange={(e) => setMensagem(e.target.value)} placeholder={t('ex.: somos 40 associados, jogamos às terças e quintas')} />
                </V2Field>
                <div className="flex justify-end"><V2Button type="submit" size="sm" disabled={!fedId || pedir.isPending}><Send className="h-4 w-4" />{t('Pedir filiação')}</V2Button></div>
              </>
            )}
          </form>
        ))}
    </V2Surface>
  );
}
