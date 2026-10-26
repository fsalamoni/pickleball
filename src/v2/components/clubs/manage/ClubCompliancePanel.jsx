/**
 * Conformidade do clube (Central → Gerir → Indicadores → Conformidade, só a administração): a
 * lista do que o Código Civil e a boa governança pedem de uma associação, cada item com o
 * estado e o atalho para a aba que resolve. As contas são de `domain/compliance.js`; o quadro
 * é o da federação (`ComplianceBoard`). Zero banco: usa as leituras que a Central já faz, e
 * fonte que falhou vira "não deu para conferir" — nunca reprovado.
 */
import React, { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { ExternalLink, Scale } from 'lucide-react';
import { clubComplianceChecklist } from '@/modules/clubs/domain/compliance';
import { useClubAccountReports, useClubBudgets } from '@/modules/clubs/hooks/useClubAccounts';
import { useClubDocsAll } from '@/modules/clubs/hooks/useClubDocs';
import { useClubEventsAll } from '@/modules/clubs/hooks/useClubAgenda';
import { useClubElectionsOverview } from '@/modules/clubs/hooks/useClubElections';
import { clubDocPath } from '@/modules/clubs/domain/docs';
import { V2Button } from '@/v2/ui/primitives';
import { t } from '@/core/i18n';
import { ComplianceBoard } from '@/v2/components/federations/manage/FedCompliancePanel';

const ORDEM = { attention: 0, unknown: 1, ok: 2 };
const dados = (q) => (q?.isSuccess ? q.data || [] : undefined);

export default function ClubCompliancePanel({ club, staffQ, abas, onIrParaAba }) {
  const docsQ = useClubDocsAll(club.id);
  const eventsQ = useClubEventsAll(club.id);
  const budgetsQ = useClubBudgets(club.id);
  const reportsQ = useClubAccountReports(club.id);
  const electionsQ = useClubElectionsOverview(club.id);
  // O servidor devolve `member: false` a quem não é do clube: sem lista, o item fica "não deu para conferir".
  const eleicoes = electionsQ.isSuccess && electionsQ.data?.member ? electionsQ.data.elections || [] : undefined;

  const itens = useMemo(
    () => clubComplianceChecklist({ staff: dados(staffQ), docs: dados(docsQ), events: dados(eventsQ), budgets: dados(budgetsQ), accountReports: dados(reportsQ), elections: eleicoes })
      .sort((a, b) => ORDEM[a.status] - ORDEM[b.status]),
    [staffQ?.isSuccess, staffQ?.data, docsQ.isSuccess, docsQ.data, eventsQ.isSuccess, eventsQ.data, budgetsQ.isSuccess, budgetsQ.data, reportsQ.isSuccess, reportsQ.data, eleicoes], // eslint-disable-line react-hooks/exhaustive-deps
  );
  const carregando = [staffQ, docsQ, eventsQ, budgetsQ, reportsQ, electionsQ].some((q) => q?.isLoading);

  return (
    <section className="space-y-6" aria-label={t('Conformidade')} data-dica="clube-conformidade">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="flex items-center gap-2 font-display text-xl font-bold text-ink"><Scale className="h-5 w-5" aria-hidden="true" />{t('Conformidade')}</h2>
          <p className="text-sm text-gray-500">{t('O que o Código Civil e a boa governança pedem de uma associação, conferido com o que está na plataforma. É aviso, não trava nada.')}</p>
        </div>
        <V2Button asChild variant="ghost" size="sm">
          <Link to={clubDocPath(club.id)}><ExternalLink className="h-4 w-4" />{t('Ver a transparência como associado')}</Link>
        </V2Button>
      </div>
      <ComplianceBoard itens={itens} carregando={carregando} abas={abas} onIrParaAba={onIrParaAba} />
      <p className="text-xs text-gray-500">{t('"Não deu para conferir" não é reprovação: a plataforma não sabe o que o clube guarda fora dela. Mulheres na direção e atletas nos órgãos não são medidos aqui, porque o cadastro da diretoria não guarda esses dados.')}</p>
    </section>
  );
}
