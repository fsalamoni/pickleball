/**
 * CONTAS do clube na Central (seção Contas, Bloco D1): Visão geral · Orçamento ·
 * Lançamentos · Prestação de contas. O financeiro (ou a administração) prepara;
 * o conselho fiscal vê tudo em leitura e dá o parecer.
 *
 * É a tela da federação com o clube no lugar dela: as abas são as MESMAS
 * (`federations/manage/accounts`, pelo escopo `clubAccountsEntity`) e a conta é a
 * mesma do servidor. A receita das cobranças pagas da associação entra sozinha;
 * toda escrita é do servidor (`clubAccounts`). Fonte que falhou vira erro com
 * "Tentar de novo" — nunca um zero.
 */
import React, { useMemo } from 'react';
import { Eye } from 'lucide-react';
import { useClubBudgets, useClubLedger, useClubAccountReports } from '@/modules/clubs/hooks/useClubAccounts';
import { useClubCharges } from '@/modules/clubs/hooks/useClubAssociation';
import { accountItems, canPrepareAccounts, dateBR } from '@/modules/federations/domain/accounts';
import { V2ErrorState, V2Skeleton } from '@/v2/ui/primitives';
import { t } from '@/core/i18n';
import AccountsOverview from '@/v2/components/federations/manage/accounts/AccountsOverview';
import FedBudgetTab from '@/v2/components/federations/manage/accounts/FedBudgetTab';
import FedLedgerTab from '@/v2/components/federations/manage/accounts/FedLedgerTab';
import FedReportsTab from '@/v2/components/federations/manage/accounts/FedReportsTab';
import { clubAccountsEntity } from '@/v2/components/federations/manage/accounts/accountsScope';

export default function ClubAccountsPanel({ club, perms, tab, onIrParaAba }) {
  const id = club.id;
  const entity = useMemo(() => clubAccountsEntity(club), [club.id, club.name]); // eslint-disable-line react-hooks/exhaustive-deps
  const budgetsQ = useClubBudgets(id);
  const ledgerQ = useClubLedger(id);
  const reportsQ = useClubAccountReports(id);
  // As cobranças pagas: o financeiro e o conselho fiscal as leem (a regra confere).
  const chargesQ = useClubCharges(id);
  const hoje = dateBR(Date.now());
  const qs = [budgetsQ, ledgerQ, reportsQ, chargesQ];
  const items = useMemo(() => accountItems({ ledger: ledgerQ.data, charges: chargesQ.data }), [ledgerQ.data, chargesQ.data]);
  if (qs.some((q) => q.isError)) return <V2ErrorState title={t('As contas não carregaram')} onRetry={() => qs.forEach((q) => { if (q.isError) q.refetch(); })} />;
  if (qs.some((q) => q.isLoading || !q.isSuccess)) return <V2Skeleton lines={6} />;
  const leitura = !canPrepareAccounts(perms);
  const comum = { federation: entity, perms, items, budgets: budgetsQ.data, ledger: ledgerQ.data, reports: reportsQ.data, hoje };
  return (
    <section className="space-y-4" aria-label={t('Contas do clube')} data-dica="clube-contas">
      {leitura && (
        <p className="flex items-start gap-2 rounded-2xl border border-gray-100 bg-paper px-4 py-3 text-sm text-gray-700">
          <Eye className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          {t('Você vê as contas em leitura (conselho fiscal). O parecer é dado em Prestação de contas, depois que o financeiro envia.')}
        </p>
      )}
      {tab === 'contas' && <AccountsOverview {...comum} onIrParaAba={() => onIrParaAba('orcamento')} />}
      {tab === 'orcamento' && <FedBudgetTab {...comum} />}
      {tab === 'lancamentos' && <FedLedgerTab {...comum} />}
      {tab === 'prestacao' && <FedReportsTab {...comum} />}
    </section>
  );
}
