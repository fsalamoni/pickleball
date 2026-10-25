/**
 * CONTAS da federação na Central (seção Contas, módulo `accounts`): Visão
 * geral · Orçamento · Lançamentos · Prestação de contas. O financeiro (ou o
 * admin) prepara; o conselho fiscal vê tudo em leitura e dá o parecer.
 *
 * As receitas das cobranças pagas entram sozinhas (`accountItems`); a
 * conta é a MESMA do servidor (`functions/federationAccountsPolicy.js`, com
 * paridade). Toda escrita é do servidor (`federationAccounts`). Fonte que
 * falhou vira aviso com "Tentar de novo" — nunca um zero.
 */
import React, { useMemo } from 'react';
import { Eye } from 'lucide-react';
import { useFederationCharges } from '@/modules/federations/hooks/useFederations';
import { useFederationBudgets, useFederationLedger } from '@/modules/federations/hooks/useAccounts';
import { useFederationAssignments } from '@/modules/federations/hooks/useReferees';
import { refereeFeesAsExpenses } from '@/modules/federations/domain/referees';
import { usePublicCallups, usePublicGrants } from '@/modules/federations/hooks/useSelection';
import { callupExpenses, grantExpenses } from '@/modules/federations/domain/selection';
import { useSponsorContracts } from '@/modules/federations/hooks/useManagement';
import { sponsorIncome } from '@/modules/federations/domain/management';
import { useIncentiveProjects } from '@/modules/federations/hooks/useInstitutional';
import { incentiveIncome } from '@/modules/federations/domain/institutional';
import { useDuesOwed, useDuesReceivable, useRepassesIn, useRepassesOut } from '@/modules/federations/hooks/useNational';
import { repasseExpenses, repasseIncome } from '@/modules/federations/domain/split';
import { duesExpenses, duesIncome, isConfederation } from '@/modules/federations/domain/national';
import { fedModuleOn } from '@/modules/federations/domain/federation';
import { FED_PERMISSION } from '@/modules/federations/domain/constants';
import {
  accountItems, canPrepareAccounts, dateBR,
} from '@/modules/federations/domain/accounts';
import { V2ErrorState, V2Skeleton } from '@/v2/ui/primitives';
import { t } from '@/core/i18n';
import AccountsOverview from './AccountsOverview';
import FedBudgetTab from './FedBudgetTab';
import FedLedgerTab from './FedLedgerTab';
import FedReportsTab from './FedReportsTab';

export default function FedAccountsPanel({ federation, perms, tab, reportsQ, onIrParaAba }) {
  const id = federation.id;
  const budgetsQ = useFederationBudgets(id);
  const ledgerQ = useFederationLedger(id);
  const chargesQ = useFederationCharges(id);
  const hoje = dateBR(Date.now());
  const qs = [budgetsQ, ledgerQ, chargesQ, reportsQ];
  // Diárias pagas da arbitragem: só quem lê as escalas (`courses`/`admin`) — a regra recusa o resto, e a
  // prestação as soma de qualquer jeito no servidor (`despesasDerivadas`).
  const arbitragemOn = fedModuleOn(federation, 'referees');
  const leArbitragem = arbitragemOn && (perms.includes(FED_PERMISSION.COURSES) || perms.includes(FED_PERMISSION.ADMIN));
  const assignmentsQ = useFederationAssignments(id, { enabled: leArbitragem });
  const diarias = leArbitragem && assignmentsQ.isSuccess ? refereeFeesAsExpenses(assignmentsQ.data) : [];
  const semDiarias = arbitragemOn && (!leArbitragem || assignmentsQ.isError);
  // Custos pagos das convocações e pagamentos dos editais: saem do que é PÚBLICO (o rascunho não tem custo pago
  // contado), então todo cargo das contas os vê — inclusive o conselho fiscal.
  const callupsQ = usePublicCallups(federation);
  const grantsQ = usePublicGrants(federation);
  const daSelecao = [...(callupsQ.isSuccess ? callupExpenses(callupsQ.data) : []), ...(grantsQ.isSuccess ? grantExpenses(grantsQ.data) : [])];
  const semSelecao = callupsQ.isError || grantsQ.isError;
  // Anuidade da rede nacional (Bloco 6): a confederação recebe, a estadual paga. Quem lê as contas lê as anuidades (mesma regra).
  const ehConf = isConfederation(federation);
  const duesInQ = useDuesReceivable(id, { enabled: ehConf });
  const duesOutQ = useDuesOwed(id, { enabled: !ehConf });
  const duesQ = ehConf ? duesInQ : duesOutQ;
  // Repasses da cobrança dividida FEITOS (Bloco 6d): despesa de quem repassa, receita da confederação. Mesma regra das contas.
  const repOutQ = useRepassesOut(id);
  const repInQ = useRepassesIn(id, { enabled: ehConf });
  const semAnuidades = duesQ.isError || repOutQ.isError || (ehConf && repInQ.isError);
  const extras = [...diarias, ...daSelecao, ...(!ehConf && duesOutQ.isSuccess ? duesExpenses(duesOutQ.data) : []), ...(repOutQ.isSuccess ? repasseExpenses(repOutQ.data) : [])];
  // Parcelas recebidas dos contratos de patrocínio (módulo `sponsors`): quem lê as contas lê os contratos (mesma regra).
  const contratosOn = fedModuleOn(federation, 'sponsors');
  const contractsQ = useSponsorContracts(id, { enabled: contratosOn });
  // Aportes da Lei de Incentivo (módulo `incentive_projects`): quem lê as contas lê os projetos (mesma regra).
  const incentivoOn = fedModuleOn(federation, 'incentive_projects');
  const projectsQ = useIncentiveProjects(id, { enabled: incentivoOn });
  const patrocinio = [
    ...(contratosOn && contractsQ.isSuccess ? sponsorIncome(contractsQ.data) : []),
    ...(incentivoOn && projectsQ.isSuccess ? incentiveIncome(projectsQ.data) : []),
    ...(ehConf && duesInQ.isSuccess ? duesIncome(duesInQ.data) : []),
    ...(ehConf && repInQ.isSuccess ? repasseIncome(repInQ.data) : []),
  ];
  const semPatrocinio = contratosOn && contractsQ.isError;
  const semIncentivo = incentivoOn && projectsQ.isError;
  const items = useMemo(() => accountItems({ ledger: ledgerQ.data, charges: chargesQ.data, extraExpenses: extras, extraIncome: patrocinio }), [ledgerQ.data, chargesQ.data, extras.length, callupsQ.data, grantsQ.data, assignmentsQ.data, contractsQ.data, projectsQ.data, duesQ.data, repOutQ.data, repInQ.data]); // eslint-disable-line react-hooks/exhaustive-deps
  if (qs.some((q) => q.isError)) return <V2ErrorState title={t('As contas não carregaram')} onRetry={() => qs.forEach((q) => { if (q.isError) q.refetch(); })} />;
  if (qs.some((q) => q.isLoading || !q.isSuccess)) return <V2Skeleton lines={6} />;
  const leitura = !canPrepareAccounts(perms);
  const comum = { federation, perms, items, budgets: budgetsQ.data, ledger: ledgerQ.data, reports: reportsQ.data, hoje };
  return (
    <section className="space-y-4" aria-label={t('Contas da federação')} data-dica="federacao-contas">
      {leitura && (
        <p className="flex items-start gap-2 rounded-2xl border border-gray-100 bg-paper px-4 py-3 text-sm text-gray-700">
          <Eye className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          {t('Você vê as contas em leitura (conselho fiscal). O parecer é dado em Prestação de contas, depois que o financeiro envia.')}
        </p>
      )}
      {semDiarias && (
        <p className="flex items-start gap-2 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <Eye className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          {t('As diárias pagas da arbitragem não aparecem nesta prévia (seu cargo não lê as escalas, ou elas não carregaram). A prestação de contas as soma no envio ao conselho fiscal.')}
        </p>
      )}
      {semAnuidades && (
        <p className="flex items-start gap-2 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <Eye className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          {t('As anuidades ou os repasses da rede não carregaram nesta prévia. A prestação de contas os soma no envio ao conselho fiscal.')}
        </p>
      )}
      {semSelecao && (
        <p className="flex items-start gap-2 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <Eye className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          {t('Os custos das convocações e os pagamentos dos editais não carregaram nesta prévia. A prestação de contas os soma no envio ao conselho fiscal.')}
        </p>
      )}
      {semPatrocinio && (
        <p className="flex items-start gap-2 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <Eye className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          {t('As parcelas recebidas dos contratos de patrocínio não carregaram nesta prévia. A prestação de contas as soma no envio ao conselho fiscal.')}
        </p>
      )}
      {semIncentivo && (
        <p className="flex items-start gap-2 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <Eye className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          {t('Os aportes dos projetos da Lei de Incentivo não carregaram nesta prévia. A prestação de contas os soma no envio ao conselho fiscal.')}
        </p>
      )}
      {tab === 'orcamento' && <AccountsOverview {...comum} onIrParaAba={onIrParaAba} />}
      {tab === 'orcamento-anual' && <FedBudgetTab {...comum} />}
      {tab === 'lancamentos' && <FedLedgerTab {...comum} />}
      {tab === 'prestacao-contas' && <FedReportsTab {...comum} />}
    </section>
  );
}
