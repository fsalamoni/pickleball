/**
 * A ÁREA DO FILIADO na página da federação — o que é da PESSOA, não do público:
 *
 *   • `FedJoinActions`  a ação da capa para quem ainda não é filiado (Filiar-se);
 *   • `FedMemberStrip`  a faixa "Sua filiação" logo abaixo da capa: situação,
 *                       validade, cobrança a pagar e a carteirinha à mão;
 *   • `FedMyMembership` a aba "Minha filiação": cobranças, documentos, sanções,
 *                       renovação, declaração, transferência e dependentes.
 *
 * As três leem as MESMAS consultas (`useMyMembership`, `useMyFederationCharges`
 * — mesma chave, uma leitura só). Nada disso aparece na prévia "ver como
 * visitante" nem na página sem conta.
 */
import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import { ArrowLeftRight, ChevronRight, FileText, IdCard, Lock, ReceiptText, Users } from 'lucide-react';
import { useAuth } from '@/core/lib/FirebaseAuthContext';
import { useFederationMutation, useMyFederationCharges, useMyMembership } from '@/modules/federations/hooks/useFederations';
import { membershipAction } from '@/modules/federations/services/federationService';
import { LIVE_MEMBER_STATUSES, canRequestMembership, membershipState, renewalOpensOn } from '@/modules/federations/domain/membership';
import { CHARGE_STATUS, MEMBER_STATUS, RENEWAL_WINDOW_DAYS } from '@/modules/federations/domain/constants';
import { isFederationHidden, isFederationOpen, normalizeFederationRules } from '@/modules/federations/domain/federation';
import { isDisciplineSuspended } from '@/modules/federations/domain/discipline';
import { PROFILE_TAB } from '@/modules/federations/domain/profile';
import { V2Button, V2ErrorState, V2Skeleton, V2Surface } from '@/v2/ui/primitives';
import { MemberStatusBadge, quando } from '../federationUi';
import MemberCardDialog from '../MemberCard';
import MembershipDeclarationDialog from '../MembershipDeclaration';
import PixChargeBlock from '../PixChargeBlock';
import FedReceiptDialog from '../FedReceipt';
import { formatBrlCents } from '@/modules/federations/domain/charges';
import { CHARGE_ORIGIN_LABELS } from '@/modules/federations/domain/constants';
import { FedCancelMembership, FedMemberDocuments, FedMySanctions, FedTransferDialog } from '../FedMemberExtras';
import { t, tn } from '@/core/i18n';

/** A filiação e as cobranças abertas desta federação (as mesmas consultas nos três). */
export function useMyFederationStanding(federationId) {
  const mq = useMyMembership(federationId);
  const cq = useMyFederationCharges();
  const pronto = mq.isSuccess && cq.isSuccess;
  const membro = pronto ? mq.data : undefined;
  const cobrancas = pronto ? (cq.data || []).filter((c) => c.federation_id === federationId && [CHARGE_STATUS.OPEN, CHARGE_STATUS.DECLARED].includes(c.status)) : [];
  return {
    mq, cq, pronto, membro, cobrancas,
    isError: mq.isError || cq.isError,
    retry: () => { if (mq.isError) mq.refetch(); if (cq.isError) cq.refetch(); },
    /** Tem filiação ali (inclusive pendente ou suspensa) — a aba "Minha filiação" existe. */
    temFiliacao: pronto && !canRequestMembership(mq.data),
  };
}

/** A carteirinha (o diálogo), com o nome da conta quando a filiação não o gravou. */
function useCartao(member, federation, plano) {
  const { user } = useAuth();
  const [aberto, setAberto] = useState(false);
  const dialogo = aberto ? <MemberCardDialog open onOpenChange={setAberto} member={{ ...member, user_name: member?.user_name || user?.displayName }} federation={federation} plan={plano} /> : null;
  return { abrir: () => setAberto(true), dialogo };
}

const temCartao = (m, st) => [MEMBER_STATUS.ACTIVE, MEMBER_STATUS.EXPIRED].includes(st.status) && m?.card_code;

/** A ação da capa para quem ainda não é filiado. */
export function FedJoinActions({ federation }) {
  const s = useMyFederationStanding(federation.id);
  if (!s.pronto || s.temFiliacao) return null;
  if (!isFederationOpen(federation)) {
    return <p className="text-sm text-gray-500">{isFederationHidden(federation) ? t('A filiação abre quando a federação for publicada pelo admin dela.') : t('A filiação abre quando a federação estiver aprovada e ativa.')}</p>;
  }
  return (
    <div className="grid gap-2" data-dica="federacao-filiar">
      <V2Button asChild><Link to={`/federacoes/${federation.id}/filiar`}><IdCard className="h-4 w-4" />{t('Filiar-se')}</Link></V2Button>
      <V2Button asChild variant="ghost"><Link to={`/federacoes/${federation.id}/filiar?dependente=1`}><Users className="h-4 w-4" />{t('Filiar um dependente')}</Link></V2Button>
    </div>
  );
}

/** O selo "só você vê" — a área do filiado não é pública. */
function SoVoce() {
  return <span className="inline-flex items-center gap-1 rounded-full bg-paper px-2 py-0.5 text-2xs font-bold uppercase tracking-wider text-gray-500"><Lock className="h-3 w-3" aria-hidden="true" />{t('Só você vê')}</span>;
}

/**
 * A faixa "Sua filiação" (acima das abas). Sem filiação, só o motivo de um
 * pedido recusado, quando houver. Na aba "Minha filiação" ela some (repetiria).
 */
export function FedMemberStrip({ federation, plans, aba, irPara }) {
  const s = useMyFederationStanding(federation.id);
  const m = s.membro;
  const st = membershipState(m);
  const plano = (plans || []).find((p) => p.id === m?.plan_id) || null;
  const cartao = useCartao(m, federation, plano);
  if (s.isError) return <V2ErrorState inline title={t('Não carregou a sua situação nesta federação')} onRetry={s.retry} />;
  if (!s.pronto || aba === PROFILE_TAB.MINE) return null;
  if (!s.temFiliacao) {
    if (m?.status !== MEMBER_STATUS.REJECTED) return null;
    return <p className="rounded-2xl border border-gray-100 bg-paper px-4 py-3 text-sm text-gray-600">{t('O pedido anterior foi recusado: {motivo}.', { motivo: m.reject_reason || t('sem motivo informado') })}</p>;
  }
  const alerta = s.cobrancas.length
    ? { tom: 'text-amber-800', texto: tn(s.cobrancas.length, '{n} cobrança para pagar', '{n} cobranças para pagar') }
    : st.status === MEMBER_STATUS.SUSPENDED || isDisciplineSuspended(m)
      ? { tom: 'text-red-600', texto: t('Filiação com restrição: veja os detalhes.') }
      : st.status === MEMBER_STATUS.PENDING
        ? { tom: 'text-gray-600', texto: t('Pedido em análise pela secretaria.') }
        : null;
  return (
    <section aria-labelledby="fed-minha-faixa" className="flex flex-col gap-3 rounded-3xl border border-ink/10 bg-paper-pure p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between sm:p-5" data-dica="federacao-minha-filiacao">
      <div className="flex min-w-0 items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-acid/30 text-ink"><IdCard className="h-5 w-5" aria-hidden="true" /></span>
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h2 id="fed-minha-faixa" className="font-display text-lg font-bold text-ink">{t('Sua filiação')}</h2>
            <MemberStatusBadge status={st.status} label={st.label} />
            <SoVoce />
          </div>
          <p className="text-sm text-gray-600">{[m.plan_name, m.member_number ? t('nº {numero}', { numero: m.member_number }) : '', st.validUntil ? t('válida até {data}', { data: quando(st.validUntil) }) : ''].filter(Boolean).join(' · ')}</p>
          {alerta && <p className={`text-sm font-semibold ${alerta.tom}`}>{alerta.texto}</p>}
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        {temCartao(m, st) && <V2Button type="button" onClick={cartao.abrir} data-dica="federacao-carteirinha"><IdCard className="h-4 w-4" />{t('Carteirinha digital')}</V2Button>}
        <V2Button type="button" variant={temCartao(m, st) ? 'ghost' : 'primary'} onClick={() => irPara(PROFILE_TAB.MINE)}>
          {s.cobrancas.length ? t('Pagar') : t('Ver minha filiação')}<ChevronRight className="h-4 w-4" />
        </V2Button>
      </div>
      {cartao.dialogo}
    </section>
  );
}

/** O histórico do que a pessoa já pagou aqui (filiação, cursos, multas), cada um com o recibo. */
function FedPayments({ charges, onRecibo }) {
  if (!charges.length) return null;
  const ordenadas = [...charges].sort((a, b) => (b.paid_at_ms || 0) - (a.paid_at_ms || 0));
  return (
    <section aria-labelledby="fed-pagamentos" className="space-y-2 border-t border-gray-100 pt-4">
      <h3 id="fed-pagamentos" className="font-bold text-ink">{t('Pagamentos')}</h3>
      <ul className="divide-y divide-gray-100">
        {ordenadas.map((c) => (
          <li key={c.id} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm">
            <span className="min-w-0">
              <span className="font-semibold text-ink">{[t(CHARGE_ORIGIN_LABELS[c.origin] || CHARGE_ORIGIN_LABELS.membership), c.plan_name].filter(Boolean).join(' · ')}</span>
              <span className="block text-xs text-gray-500">{[formatBrlCents(c.amount_cents), c.paid_at_ms ? t('pago em {data}', { data: quando(c.paid_at_ms) }) : ''].filter(Boolean).join(' · ')}{c.member_name && c.member_name !== c.payer_name ? ` · ${c.member_name}` : ''}</span>
            </span>
            <V2Button type="button" size="sm" variant="ghost" onClick={() => onRecibo(c)}><ReceiptText className="h-4 w-4" />{t('Recibo')}</V2Button>
          </li>
        ))}
      </ul>
    </section>
  );
}

/** A aba "Minha filiação": tudo o que é da pessoa nesta federação. */
export function FedMyMembership({ federation, plans }) {
  const { user } = useAuth();
  const s = useMyFederationStanding(federation.id);
  const [transferindo, setTransferindo] = useState(false);
  const [declaracao, setDeclaracao] = useState(false);
  const [recibo, setRecibo] = useState(null);
  const renovar = useFederationMutation(() => membershipAction({ federationId: federation.id, action: 'renew' }));
  const m = s.membro;
  const st = membershipState(m);
  const plano = (plans || []).find((p) => p.id === m?.plan_id) || null;
  const cartao = useCartao(m, federation, plano);
  if (s.isError) return <V2ErrorState inline title={t('Não carregou a sua situação nesta federação')} onRetry={s.retry} />;
  if (!s.pronto) return <V2Skeleton lines={4} />;
  return (
    <div className="grid gap-6 lg:grid-cols-12">
      <V2Surface as="section" className="space-y-4 lg:col-span-8" aria-labelledby="fed-minha-filiacao">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex flex-wrap items-center gap-2"><h2 id="fed-minha-filiacao" className="font-display text-xl font-bold text-ink">{t('Sua filiação')}</h2><SoVoce /></div>
            <p className="text-sm text-gray-600">{[m.plan_name, m.member_number ? t('nº {numero}', { numero: m.member_number }) : '', st.validUntil ? t('válida até {data}', { data: quando(st.validUntil) }) : ''].filter(Boolean).join(' · ')}</p>
          </div>
          <MemberStatusBadge status={st.status} label={st.label} />
        </div>
        {st.status === MEMBER_STATUS.PENDING && <p className="text-sm text-gray-600">{t('A secretaria da federação analisa o pedido e avisa pelo sino.')}</p>}
        {st.status === MEMBER_STATUS.SUSPENDED && <p className="text-sm text-red-600">{t('Filiação suspensa{motivo}.', { motivo: m.suspended_reason ? `: ${m.suspended_reason}` : '' })}</p>}
        {isDisciplineSuspended(m) && <p className="text-sm text-red-600">{t('Suspensão disciplinar até {data}: sem inscrição em torneio chancelado "só filiados" até lá.', { data: quando(m.discipline_until_ms) })}</p>}
        {s.cobrancas.map((c) => <PixChargeBlock key={c.id} charge={c} federation={federation} />)}
        <div className="flex flex-wrap gap-2">
          {temCartao(m, st) && <V2Button type="button" onClick={cartao.abrir}><IdCard className="h-4 w-4" />{t('Carteirinha digital')}</V2Button>}
          {st.status === MEMBER_STATUS.ACTIVE && m.card_code && normalizeFederationRules(federation.rules).member_declarations && (
            <V2Button type="button" variant="secondary" onClick={() => setDeclaracao(true)} data-dica="federacao-declaracao"><FileText className="h-4 w-4" />{t('Declaração de vínculo')}</V2Button>
          )}
          {st.canRenew && s.cobrancas.length === 0 && (
            <V2Button type="button" variant="secondary" disabled={renovar.isPending} onClick={() => renovar.mutate(undefined, { onSuccess: () => toast.success(t('Renovação pedida. Pague a cobrança para seguir em dia.')), onError: (e) => toast.error(e.message) })}>
              {st.status === MEMBER_STATUS.EXPIRED ? t('Renovar a filiação') : t('Renovar antes de vencer')}
            </V2Button>
          )}
        </div>
        {renewalOpensOn(m) && <p className="text-sm text-gray-500">{t('A renovação abre em {data}, {n} dias antes de vencer. Você recebe um aviso.', { data: quando(renewalOpensOn(m)), n: RENEWAL_WINDOW_DAYS })}</p>}
        <FedMemberDocuments member={m} plan={plano} />
        <FedPayments charges={(s.cq.data || []).filter((c) => c.federation_id === federation.id && c.status === CHARGE_STATUS.PAID)} onRecibo={setRecibo} />
        <FedMySanctions federationId={federation.id} />
      </V2Surface>
      <aside className="space-y-3 lg:col-span-4">
        <V2Surface variant="compacto" className="space-y-2 p-4">
          <p className="text-2xs font-bold uppercase tracking-widest text-gray-500">{t('Outras ações')}</p>
          {LIVE_MEMBER_STATUSES.includes(st.status) && st.status !== MEMBER_STATUS.PENDING && (
            <V2Button type="button" variant="ghost" size="sm" className="w-full justify-start" onClick={() => setTransferindo(true)} data-dica="federacao-transferencia"><ArrowLeftRight className="h-4 w-4" />{t('Transferência')}</V2Button>
          )}
          <V2Button asChild variant="ghost" size="sm" className="w-full justify-start"><Link to={`/federacoes/${federation.id}/filiar?dependente=1`}><Users className="h-4 w-4" />{t('Filiar um dependente')}</Link></V2Button>
          <V2Button asChild variant="ghost" size="sm" className="w-full justify-start"><Link to="/perfil?secao=federacoes">{t('Minhas federações')}</Link></V2Button>
          <FedCancelMembership member={m} className="w-full justify-start text-red-700" />
        </V2Surface>
      </aside>
      {cartao.dialogo}
      {declaracao && <MembershipDeclarationDialog open onOpenChange={setDeclaracao} member={{ ...m, user_name: m.user_name || user?.displayName }} federation={federation} selfService />}
      {recibo && <FedReceiptDialog open onOpenChange={(v) => !v && setRecibo(null)} charge={recibo} federation={federation} />}
      {transferindo && <FedTransferDialog member={m} federation={federation} onClose={() => setTransferindo(false)} />}
    </div>
  );
}
