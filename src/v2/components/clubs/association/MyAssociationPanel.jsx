/**
 * A minha associação neste clube: situação, validade, carteirinha, a cobrança
 * que espera pagamento e o que posso fazer (renovar, cancelar o pedido,
 * encerrar). Lê só os documentos da própria pessoa; fonte que falha vira
 * "Tentar de novo", nunca "você não é associado".
 */
import React, { Suspense, lazy, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { FileText, IdCard, RefreshCw } from 'lucide-react';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { buildClubCard, dataCurta, myAssociationView, planPriceLabel } from '@/modules/clubs/domain/association';
import { useAssociationAction, useMyAffiliation, useMyClubCharges } from '@/modules/clubs/hooks/useClubAssociation';
import { V2Button, V2ErrorState, V2Skeleton, V2Surface } from '@/v2/ui/primitives';
import { MemberStatusBadge } from '@/v2/components/federations/federationUi';
import ClubChargeBlock from './ClubChargeBlock';
import { t, tk } from '@/core/i18n';

const ClubDeclarationDialog = lazy(() => import('./ClubDeclarationDialog'));
const MemberCardDialog = lazy(() => import('@/v2/components/federations/MemberCard'));

const TEXTO_SITUACAO = {
  pending: tk('A secretaria do clube está analisando o seu pedido. Você recebe um aviso quando for decidido.'),
  awaiting_payment: tk('Falta o pagamento. Pague o Pix abaixo; o financeiro confirma e a carteirinha é liberada.'),
  active: tk('Sua associação está em dia.'),
  expired: tk('Sua associação venceu. Renove para voltar a ter as vantagens.'),
  suspended: tk('Sua associação está suspensa pelo clube. Fale com a secretaria.'),
  rejected: tk('O clube não aprovou o pedido. Você pode corrigir e pedir de novo.'),
  cancelled: tk('Esta associação foi encerrada. Você pode se associar de novo.'),
};

export default function MyAssociationPanel({ club, plan = null }) {
  const clubId = club.id;
  const mine = useMyAffiliation(clubId);
  const charges = useMyClubCharges(clubId, { enabled: mine.isSuccess && Boolean(mine.data) });
  const agir = useAssociationAction(clubId);
  const [cartao, setCartao] = useState(false);
  const [encerrar, setEncerrar] = useState(false);
  const [declaracao, setDeclaracao] = useState(false);
  const aff = mine.data;
  const view = useMemo(() => (aff ? myAssociationView(aff, charges.data || []) : null), [aff, charges.data]);
  // O pai decide se mostra os planos (quem pode pedir de novo); aqui só a situação.
  const cardModel = useMemo(() => (aff ? buildClubCard({ aff, club, plan, origin: typeof window !== 'undefined' ? window.location.origin : '' }) : null), [aff, club, plan]);

  if (mine.isLoading) return <V2Skeleton className="h-40 rounded-3xl" />;
  if (mine.isError) return <V2ErrorState inline title={t('Não carregou a sua associação')} onRetry={() => mine.refetch()} />;
  if (!aff || !view) return null;

  const fazer = (extra, ok) => agir.mutate(extra, { onSuccess: () => toast.success(ok), onError: (er) => toast.error(er.message) });
  const emAndamento = ['pending', 'awaiting_payment'].includes(aff.status);

  return (
    <section className="space-y-4" aria-label={t('Minha associação')} data-dica="clube-minha-associacao">
      <V2Surface className="space-y-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-gray-500">{t('Minha associação')}</p>
            <h3 className="font-display text-xl font-bold text-ink">{aff.plan_name || t('Associado')}</h3>
            {aff.member_number && <p className="font-mono text-sm text-gray-600">{aff.member_number}</p>}
          </div>
          <MemberStatusBadge status={view.kind} />
        </div>
        <p className="text-sm text-gray-700">{t(TEXTO_SITUACAO[view.kind] || TEXTO_SITUACAO.active)}</p>
        {aff.status === 'rejected' && aff.reject_reason && <p className="text-sm text-red-700">{t('Motivo informado pelo clube: {motivo}', { motivo: aff.reject_reason })}</p>}
        {(aff.valid_until || aff.free) && (
          <p className="text-sm text-gray-600">
            {aff.valid_until ? t('Válida até {data}', { data: dataCurta(aff.valid_until) }) : t('Plano gratuito, sem vencimento.')}
            {plan && ` · ${planPriceLabel(plan)}`}
          </p>
        )}
        <div className="flex flex-wrap gap-2">
          {view.hasCard && <V2Button type="button" size="sm" onClick={() => setCartao(true)} data-dica="clube-carteirinha"><IdCard className="h-4 w-4" />{t('Abrir a carteirinha')}</V2Button>}
          {aff.status === 'active' && aff.card_code && <V2Button type="button" size="sm" variant="ghost" onClick={() => setDeclaracao(true)} data-dica="clube-declaracao"><FileText className="h-4 w-4" />{t('Declaração de associação')}</V2Button>}
          {view.canRenew && (
            <V2Button type="button" size="sm" variant="secondary" disabled={agir.isPending} onClick={() => fazer({ action: 'renew' }, t('Renovação pedida. Pague o Pix para estender a validade.'))}>
              <RefreshCw className="h-4 w-4" />{t('Renovar agora')}
            </V2Button>
          )}
          {(emAndamento || ['active', 'expired'].includes(aff.status)) && (
            <V2Button type="button" size="sm" variant="ghost" onClick={() => setEncerrar(true)}>{emAndamento ? t('Cancelar o pedido') : t('Encerrar a associação')}</V2Button>
          )}
        </div>
        {charges.isError && <V2ErrorState inline title={t('Não carregaram as suas cobranças')} onRetry={() => charges.refetch()} />}
      </V2Surface>

      {view.openCharge && <ClubChargeBlock charge={view.openCharge} club={club} />}

      <ConfirmDialog
        open={encerrar}
        onOpenChange={setEncerrar}
        destructive
        title={emAndamento ? t('Cancelar o pedido de associação?') : t('Encerrar a sua associação?')}
        description={emAndamento ? t('O pedido e a cobrança em aberto são cancelados. Você pode pedir de novo quando quiser.') : t('A carteirinha deixa de valer e as vantagens de associado acabam. Você continua no clube como membro.')}
        confirmLabel={emAndamento ? t('Cancelar o pedido') : t('Encerrar associação')}
        cancelLabel={t('Voltar')}
        loading={agir.isPending}
        onConfirm={() => { setEncerrar(false); fazer({ action: 'cancel' }, emAndamento ? t('Pedido cancelado.') : t('Associação encerrada.')); }}
      />
      {declaracao && (
        <Suspense fallback={null}>
          <ClubDeclarationDialog open onOpenChange={setDeclaracao} aff={aff} club={club} />
        </Suspense>
      )}
      {cartao && cardModel && (
        <Suspense fallback={null}>
          <MemberCardDialog
            open={cartao}
            onOpenChange={setCartao}
            cardOverride={cardModel}
            fileSlug={club.name?.split(' ')[0] || 'clube'}
            title={t('Carteirinha de associado')}
            description={t('Mostre na quadra ou no clube. O QR abre a verificação pública: nome, clube, plano e validade — nada mais.')}
            shareText={t('Minha carteirinha do {clube}: nº {numero}. Verifique em {url}', { clube: club.name, numero: cardModel.number, url: cardModel.verifyUrl })}
          />
        </Suspense>
      )}
    </section>
  );
}
