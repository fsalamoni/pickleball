/**
 * "Hoje" da federação: os números do dia e o que falta para a federação
 * funcionar (Pix, plano, página). Falha numa fonte vira aviso, nunca zero.
 */
import React from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, Building2, CheckCircle2, ExternalLink, Receipt, Trophy, Users, Wallet } from 'lucide-react';
import { financeSummary, formatBrlCents } from '@/modules/federations/domain/charges';
import { memberCounts } from '@/modules/federations/domain/membership';
import { affiliationCounts } from '@/modules/federations/domain/affiliations';
import { pendingSanctions, sanctionedTournaments } from '@/modules/federations/domain/sanction';
import { FED_PERMISSION } from '@/modules/federations/domain/constants';
import { fedModuleOn } from '@/modules/federations/domain/federation';
import { V2Button, V2ErrorState, V2StatCard, V2Surface } from '@/v2/ui/primitives';
import { fedManagePath, fedPublicPath, publicHost } from '../federationUi';
import { t, tn } from '@/core/i18n';

function Passo({ feito, children, to, onIr }) {
  const Icone = feito ? CheckCircle2 : AlertTriangle;
  return (
    <li className="flex items-center gap-3">
      <Icone className={feito ? 'h-5 w-5 text-green-600' : 'h-5 w-5 text-amber-500'} aria-hidden="true" />
      <span className={feito ? 'text-sm text-gray-500 line-through' : 'text-sm font-semibold text-ink'}>{children}</span>
      {!feito && to && <V2Button type="button" size="sm" variant="subtle" onClick={() => onIr(to)}>{t('Configurar')}</V2Button>}
    </li>
  );
}

export default function FedHojePanel({ federation, membersQ, chargesQ, plansQ, affiliationsQ, tournamentsQ, perms, onIrParaAba }) {
  const veFiliados = perms.includes(FED_PERMISSION.MEMBERS);
  const veFinancas = perms.includes(FED_PERMISSION.FINANCE);
  const admin = perms.includes(FED_PERMISSION.ADMIN);
  const contas = membersQ.isSuccess ? memberCounts(membersQ.data || []) : null;
  const fin = chargesQ.isSuccess ? financeSummary(chargesQ.data || []) : null;
  const temPix = Boolean(federation.payment?.pix_key);
  const temPlano = plansQ.isSuccess ? (plansQ.data || []).some((p) => p.active !== false) : null;
  const pronta = temPix && temPlano === true;
  const orgs = affiliationsQ?.isSuccess ? affiliationCounts(affiliationsQ.data || []) : null;
  const torneios = tournamentsQ?.isSuccess ? { pendentes: pendingSanctions(tournamentsQ.data || []).length, chancelados: sanctionedTournaments(tournamentsQ.data || []).length } : null;
  return (
    <section className="space-y-6" aria-label={t('Hoje')} data-dica="federacao-hoje">
      {admin && !pronta && (
        <V2Surface className="space-y-3" data-dica="federacao-prontidao">
          <h2 className="font-display text-lg font-bold text-ink">{t('Para a federação receber filiados')}</h2>
          <ul className="space-y-2">
            <Passo feito={temPlano === true} to="planos" onIr={onIrParaAba}>{t('Criar ao menos um plano de filiação')}</Passo>
            <Passo feito={temPix} to="pix" onIr={onIrParaAba}>{t('Informar o Pix que recebe as filiações')}</Passo>
          </ul>
          {plansQ.isError && <V2ErrorState inline title={t('Não deu para conferir os planos')} onRetry={() => plansQ.refetch()} />}
        </V2Surface>
      )}
      {veFiliados && (
        <div>
          <h2 className="mb-3 font-display text-lg font-bold text-ink">{t('Filiados')}</h2>
          {membersQ.isError ? <V2ErrorState inline title={t('Não carregaram os filiados')} onRetry={() => membersQ.refetch()} /> : (
            <div className="grid gap-3 sm:grid-cols-4">
              <V2StatCard icon={Users} label={t('Em dia')} value={contas ? String(contas.active) : '—'} />
              <V2StatCard icon={Users} label={t('Pedidos')} value={contas ? String(contas.pending) : '—'} accent={contas?.pending ? 'acid' : 'ink'} />
              <V2StatCard icon={Users} label={t('Vencendo em 30 dias')} value={contas ? String(contas.expiring) : '—'} />
              <V2StatCard icon={Users} label={t('Vencidos')} value={contas ? String(contas.expired) : '—'} />
            </div>
          )}
        </div>
      )}
      {veFiliados && affiliationsQ && fedModuleOn(federation, 'affiliations') && (
        <div>
          <h2 className="mb-3 font-display text-lg font-bold text-ink">{t('Clubes e arenas')}</h2>
          {affiliationsQ.isError ? <V2ErrorState inline title={t('Não carregaram os clubes e arenas')} onRetry={() => affiliationsQ.refetch()} /> : (
            <div className="grid gap-3 sm:grid-cols-3">
              <V2StatCard icon={Building2} label={t('Pedidos')} value={orgs ? String(orgs.pending) : '—'} accent={orgs?.pending ? 'acid' : 'ink'} />
              <V2StatCard icon={Users} label={t('Clubes filiados')} value={orgs ? String(orgs.clubs) : '—'} />
              <V2StatCard icon={Building2} label={t('Arenas filiadas')} value={orgs ? String(orgs.arenas) : '—'} />
            </div>
          )}
        </div>
      )}
      {perms.includes(FED_PERMISSION.COMPETITIONS) && tournamentsQ && fedModuleOn(federation, 'tournaments') && (
        <div>
          <h2 className="mb-3 font-display text-lg font-bold text-ink">{t('Competições')}</h2>
          {tournamentsQ.isError ? <V2ErrorState inline title={t('Não carregaram os torneios')} onRetry={() => tournamentsQ.refetch()} /> : (
            <div className="grid gap-3 sm:grid-cols-2">
              <V2StatCard icon={Trophy} label={t('Chancelas pedidas')} value={torneios ? String(torneios.pendentes) : '—'} accent={torneios?.pendentes ? 'acid' : 'ink'} />
              <V2StatCard icon={Trophy} label={t('Torneios chancelados')} value={torneios ? String(torneios.chancelados) : '—'} />
            </div>
          )}
        </div>
      )}
      {veFinancas && (
        <div>
          <h2 className="mb-3 font-display text-lg font-bold text-ink">{t('Financeiro')}</h2>
          {chargesQ.isError ? <V2ErrorState inline title={t('Não carregaram as cobranças')} onRetry={() => chargesQ.refetch()} /> : (
            <div className="grid gap-3 sm:grid-cols-3">
              <V2StatCard icon={Receipt} label={t('Para confirmar')} value={fin ? String(fin.declared) : '—'} hint={fin ? formatBrlCents(fin.declared_cents) : ''} accent={fin?.declared ? 'acid' : 'ink'} />
              <V2StatCard icon={Receipt} label={t('Em aberto')} value={fin ? String(fin.open) : '—'} hint={fin ? tn(fin.overdue, '{n} vencida', '{n} vencidas') : ''} />
              <V2StatCard icon={Wallet} label={t('Recebido este mês')} value={fin ? formatBrlCents(fin.paid_month_cents) : '—'} />
            </div>
          )}
        </div>
      )}
      <V2Surface variant="compacto" className="flex flex-wrap items-center justify-between gap-3 p-4">
        <p className="text-sm text-gray-700">{t('Página pública: {url}', { url: `${publicHost()}${fedPublicPath(federation)}` })}</p>
        <div className="flex gap-2">
          <V2Button asChild size="sm" variant="secondary"><Link to={fedPublicPath(federation)} target="_blank" rel="noopener noreferrer"><ExternalLink className="h-4 w-4" />{t('Abrir')}</Link></V2Button>
          {admin && <V2Button asChild size="sm" variant="ghost"><Link to={fedManagePath(federation, 'pagina')}>{t('Editar')}</Link></V2Button>}
        </div>
      </V2Surface>
    </section>
  );
}
