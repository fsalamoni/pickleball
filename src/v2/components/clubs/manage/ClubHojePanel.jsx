/**
 * "Hoje" da Central do clube: o que falta para a associação funcionar (ligar,
 * plano, Pix, abrir ao público) e o que espera a equipe (pedidos, pagamentos
 * informados, vencimentos). Fonte que falhou mostra "—" e um aviso — nunca zero.
 */
import React from 'react';
import { AlertTriangle, CheckCircle2, CircleDollarSign, Clock, Gavel, MessageSquareWarning, Package, ShieldCheck, Trophy, Users } from 'lucide-react';
import { affiliationCounts, financeSummary, formatBrlCents, normalizeAssociation } from '@/modules/clubs/domain/association';
import { useClubCases, useClubOmbud } from '@/modules/clubs/hooks/useClubDiscipline';
import { useClubAssets } from '@/modules/clubs/hooks/useClubManagement';
import { useClubCallups } from '@/modules/clubs/hooks/useClubSelection';
import { useClubMinors, useClubSgOverview } from '@/modules/clubs/hooks/useClubSafeguarding';
import { minorsWithoutGuardian } from '@/modules/clubs/domain/safeguarding';
import { assetState } from '@/modules/federations/domain/management';
import { isoDate } from '@/modules/federations/domain/membership';
import { termStatus } from '@/modules/clubs/domain/staff';
import { V2Button, V2ErrorState, V2StatCard, V2Surface } from '@/v2/ui/primitives';
import { t, tn } from '@/core/i18n';

function Passo({ feito, children, to, onIr, rotulo }) {
  const Icone = feito ? CheckCircle2 : AlertTriangle;
  return (
    <li className="flex flex-wrap items-center gap-3">
      <Icone className={feito ? 'h-5 w-5 text-green-600' : 'h-5 w-5 text-amber-500'} aria-hidden="true" />
      <span className={feito ? 'text-sm text-gray-500 line-through' : 'text-sm font-semibold text-ink'}>{children}</span>
      {!feito && to && <V2Button type="button" size="sm" variant="subtle" onClick={() => onIr(to)}>{rotulo || t('Configurar')}</V2Button>}
    </li>
  );
}

export default function ClubHojePanel({ club, affiliationsQ, chargesQ, plansQ, pixQ, staffQ, perms, onIrParaAba }) {
  const admin = perms.includes('admin');
  const veMembros = admin || perms.includes('members');
  const veFinancas = admin || perms.includes('finance');
  const veEquipe = admin || perms.includes('staff');
  const veDisciplina = admin || perms.includes('discipline');
  // Mesmas chaves do painel de Disciplina: abrir uma aba depois não consulta de novo.
  const casosQ = useClubCases(club.id, { enabled: veDisciplina });
  const ouvidoriaQ = useClubOmbud(club.id, { enabled: veDisciplina });
  const recursos = casosQ.isSuccess ? (casosQ.data || []).filter((s) => s.status === 'appealed').length : null;
  const manifestacoes = ouvidoriaQ.isSuccess ? (ouvidoriaQ.data || []).filter((r) => r.status !== 'closed').length : null;
  // Proteção de menores: certidões para conferir e menores sem responsável (mesmas chaves do painel).
  const protecaoQ = useClubSgOverview(club.id, { enabled: veDisciplina });
  const menoresQ = useClubMinors(club.id, { enabled: veDisciplina });
  const certidoes = protecaoQ.isSuccess ? (protecaoQ.data?.rows || []).filter((r) => r.pending).length : null;
  const semResponsavel = menoresQ.isSuccess ? minorsWithoutGuardian(menoresQ.data?.rows) : null;
  // Seleção: convites sem resposta nas convocações abertas (a diretoria esportiva).
  const veSelecao = admin || perms.includes('sports');
  const convocQ = useClubCallups(club.id, { enabled: veSelecao });
  const aguardando = convocQ.isSuccess ? (convocQ.data?.rows || []).filter((x) => x.status === 'open').reduce((n, x) => n + ((x.counts || {}).invited || 0), 0) : null;
  // Devolução atrasada: só quem cuida do patrimônio; fonte que falhou é dita, nunca zero.
  const vePatrimonio = admin || perms.includes('finance') || perms.includes('sports');
  const bensQ = useClubAssets(club.id, { enabled: vePatrimonio });
  const atrasadas = bensQ.isSuccess ? (bensQ.data || []).filter((b) => b.status !== 'retired').reduce((n, b) => n + assetState(b, isoDate()).overdue.length, 0) : 0;
  // Só o que vence em 30 dias ou já venceu e ainda não foi varrido (a varredura desfaz o cargo e avisa).
  const acabando = staffQ?.isSuccess
    ? (staffQ.data || []).map((s) => ({ s, st: termStatus(s) })).filter(({ st }) => st.kind === 'ending' || st.kind === 'expired')
    : [];
  const cfg = normalizeAssociation(club);
  const afs = affiliationsQ?.isSuccess ? affiliationCounts(affiliationsQ.data || []) : null;
  const fin = chargesQ?.isSuccess ? financeSummary(chargesQ.data || []) : null;
  const temPlano = plansQ?.isSuccess ? (plansQ.data || []).some((p) => p.active !== false) : null;
  const temPix = pixQ?.isSuccess ? Boolean(pixQ.data?.pix_key) : null;
  const pronta = cfg.enabled && cfg.published && temPlano === true;

  return (
    <section className="space-y-6" aria-label={t('Hoje')} data-dica="clube-hoje">
      {admin && !pronta && (
        <V2Surface className="space-y-3" data-dica="clube-prontidao">
          <h2 className="font-display text-lg font-bold text-ink">{t('Para o clube receber associados')}</h2>
          <ul className="space-y-2.5">
            <Passo feito={cfg.enabled} to="config" onIr={onIrParaAba} rotulo={t('Ligar')}>{t('Ligar a associação do clube')}</Passo>
            <Passo feito={temPlano === true} to="planos" onIr={onIrParaAba} rotulo={t('Criar plano')}>{t('Criar ao menos um plano (pode ser gratuito)')}</Passo>
            <Passo feito={temPix === true} to="pix" onIr={onIrParaAba} rotulo={t('Informar Pix')}>{t('Informar o Pix que recebe as mensalidades (se houver plano pago)')}</Passo>
            <Passo feito={cfg.published} to="config" onIr={onIrParaAba} rotulo={t('Abrir')}>{t('Abrir ao público')}</Passo>
          </ul>
          {plansQ?.isError && <V2ErrorState inline title={t('Não deu para conferir os planos')} onRetry={() => plansQ.refetch()} />}
        </V2Surface>
      )}

      {veMembros && (
        <div>
          <h2 className="mb-3 font-display text-lg font-bold text-ink">{t('Associados')}</h2>
          {affiliationsQ?.isError ? <V2ErrorState inline title={t('Não carregaram os associados')} onRetry={() => affiliationsQ.refetch()} /> : (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <V2StatCard icon={Users} label={t('Em dia')} value={afs ? String(afs.active) : '—'} />
              <V2StatCard icon={Users} label={t('Pedidos')} value={afs ? String(afs.pending) : '—'} accent={afs?.pending ? 'acid' : 'ink'} />
              <V2StatCard icon={Clock} label={t('Vencendo em 30 dias')} value={afs ? String(afs.expiring) : '—'} />
              <V2StatCard icon={Users} label={t('Aguardando pagamento')} value={afs ? String(afs.awaiting_payment) : '—'} />
            </div>
          )}
          {afs?.pending > 0 && <V2Button type="button" size="sm" className="mt-3" onClick={() => onIrParaAba('associados', 'pending')}>{t('Ver os pedidos')}</V2Button>}
        </div>
      )}

      {veDisciplina && (
        <div data-dica="clube-hoje-disciplina">
          <h2 className="mb-3 font-display text-lg font-bold text-ink">{t('Disciplina')}</h2>
          {(casosQ.isError || ouvidoriaQ.isError) && <V2ErrorState inline title={t('Não deu para conferir a disciplina')} onRetry={() => { casosQ.refetch(); ouvidoriaQ.refetch(); }} />}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <V2StatCard icon={Gavel} label={t('Recursos para decidir')} value={recursos == null ? '—' : String(recursos)} accent={recursos ? 'acid' : 'ink'} />
            <V2StatCard icon={MessageSquareWarning} label={t('Manifestações abertas')} value={manifestacoes == null ? '—' : String(manifestacoes)} accent={manifestacoes ? 'acid' : 'ink'} />
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            {recursos > 0 && <V2Button type="button" size="sm" onClick={() => onIrParaAba('sancoes')}>{t('Decidir recursos')}</V2Button>}
            {manifestacoes > 0 && <V2Button type="button" size="sm" variant="subtle" onClick={() => onIrParaAba('ouvidoria')}>{t('Abrir a ouvidoria')}</V2Button>}
          </div>
        </div>
      )}

      {veDisciplina && (protecaoQ.isError || menoresQ.isError || certidoes > 0 || semResponsavel > 0) && (
        <div data-dica="clube-hoje-protecao">
          <h2 className="mb-3 font-display text-lg font-bold text-ink">{t('Proteção de menores')}</h2>
          {(protecaoQ.isError || menoresQ.isError) && <V2ErrorState inline title={t('Não deu para conferir a proteção de menores')} onRetry={() => { protecaoQ.refetch(); menoresQ.refetch(); }} />}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <V2StatCard icon={ShieldCheck} label={t('Certidões para conferir')} value={certidoes == null ? '—' : String(certidoes)} accent={certidoes ? 'acid' : 'ink'} />
            <V2StatCard icon={Users} label={t('Menores sem responsável')} value={semResponsavel == null ? '—' : String(semResponsavel)} accent={semResponsavel ? 'acid' : 'ink'} />
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            {certidoes > 0 && <V2Button type="button" size="sm" onClick={() => onIrParaAba('protecao')}>{t('Conferir certidões')}</V2Button>}
            {semResponsavel > 0 && <V2Button type="button" size="sm" variant="subtle" onClick={() => onIrParaAba('menores')}>{t('Ver os menores')}</V2Button>}
          </div>
        </div>
      )}

      {veSelecao && (convocQ.isError || aguardando > 0) && (
        <div data-dica="clube-hoje-selecao">
          <h2 className="mb-3 font-display text-lg font-bold text-ink">{t('Seleção')}</h2>
          {convocQ.isError ? <V2ErrorState inline title={t('Não deu para conferir as convocações')} onRetry={() => convocQ.refetch()} /> : (
            <>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <V2StatCard icon={Trophy} label={t('Convites sem resposta')} value={String(aguardando)} accent="acid" />
              </div>
              <div className="mt-3 flex flex-wrap gap-2"><V2Button type="button" size="sm" onClick={() => onIrParaAba('selecao')}>{t('Ver as convocações')}</V2Button></div>
            </>
          )}
        </div>
      )}

      {vePatrimonio && (bensQ.isError || atrasadas > 0) && (
        <div data-dica="clube-hoje-patrimonio">
          <h2 className="mb-3 font-display text-lg font-bold text-ink">{t('Patrimônio')}</h2>
          {bensQ.isError ? <V2ErrorState inline title={t('Não deu para conferir o patrimônio')} onRetry={() => bensQ.refetch()} /> : (
            <>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <V2StatCard icon={Package} label={t('Devoluções atrasadas')} value={String(atrasadas)} accent="acid" />
              </div>
              <V2Button type="button" size="sm" className="mt-3" onClick={() => onIrParaAba('patrimonio')}>{t('Ver os empréstimos')}</V2Button>
            </>
          )}
        </div>
      )}

      {veEquipe && (staffQ?.isError ? <V2ErrorState inline title={t('Não carregaram os mandatos')} onRetry={() => staffQ.refetch()} /> : acabando.length > 0 && (
        <V2Surface className="space-y-3" data-dica="clube-mandatos">
          <h2 className="font-display text-lg font-bold text-ink">{t('Mandatos acabando')}</h2>
          <ul className="space-y-1.5 text-sm text-gray-700">
            {acabando.map(({ s, st }) => (
              <li key={s.user_id || s.id}>
                <span className="font-semibold text-ink">{s.user_name || t('Pessoa')}</span> · {s.role_name || t('Cargo')} · {st.kind === 'expired' ? t('mandato encerrado') : tn(st.days, 'acaba em {n} dia', 'acaba em {n} dias')}
              </li>
            ))}
          </ul>
          <V2Button type="button" size="sm" variant="subtle" onClick={() => onIrParaAba('equipe')}>{t('Abrir a diretoria')}</V2Button>
        </V2Surface>
      ))}

      {veFinancas && (
        <div>
          <h2 className="mb-3 font-display text-lg font-bold text-ink">{t('Financeiro')}</h2>
          {chargesQ?.isError ? <V2ErrorState inline title={t('Não carregaram as cobranças')} onRetry={() => chargesQ.refetch()} /> : (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <V2StatCard icon={Clock} label={t('Aguardando confirmação')} value={fin ? String(fin.declared) : '—'} hint={fin ? formatBrlCents(fin.declared_cents) : undefined} accent={fin?.declared ? 'acid' : 'ink'} />
              <V2StatCard icon={CircleDollarSign} label={t('Em aberto')} value={fin ? String(fin.open) : '—'} hint={fin ? formatBrlCents(fin.open_cents) : undefined} />
              <V2StatCard icon={CircleDollarSign} label={t('Recebido no mês')} value={fin ? formatBrlCents(fin.paid_month_cents) : '—'} />
              <V2StatCard icon={CircleDollarSign} label={t('Mês anterior')} value={fin ? formatBrlCents(fin.paid_prev_month_cents) : '—'} />
            </div>
          )}
          {fin?.declared > 0 && <V2Button type="button" size="sm" className="mt-3" onClick={() => onIrParaAba('cobrancas')}>{t('Confirmar pagamentos')}</V2Button>}
        </div>
      )}
    </section>
  );
}
