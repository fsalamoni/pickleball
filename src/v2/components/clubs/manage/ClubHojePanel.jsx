/**
 * "Hoje" da Central do clube: o que falta para a associação funcionar (ligar,
 * plano, Pix, abrir ao público) e o que espera a equipe (pedidos, pagamentos
 * informados, vencimentos). Fonte que falhou mostra "—" e um aviso — nunca zero.
 */
import React from 'react';
import { AlertTriangle, CheckCircle2, CircleDollarSign, Clock, Users } from 'lucide-react';
import { affiliationCounts, financeSummary, formatBrlCents, normalizeAssociation } from '@/modules/clubs/domain/association';
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
