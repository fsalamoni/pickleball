/**
 * Painel admin → Federações (flag `federations`): os pedidos de abertura
 * (aprovar vira quem pediu em presidente; recusar exige motivo), as
 * aprovadas (suspender, selo "Verificada", selo "Oficial") e os dados
 * privados da entidade (CNPJ completo, razão social) — só aqui. Quem decide
 * é o servidor (`federationReview`).
 */
import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import { BadgeCheck, Ban, CheckCircle2, ExternalLink, Eye, KeyRound, Landmark, ShieldCheck, XCircle } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { reviewFederation } from '@/modules/federations/services/federationService';
import { useAdminFederations, useFederationAccessLogs, useFederationMutation, useFederationPrivate } from '@/modules/federations/hooks/useFederations';
import { federationReviewActions } from '@/modules/federations/domain/federation';
import { FEDERATION_LEVEL_LABELS, FEDERATION_STATUS, FEDERATION_STATUS_LABELS } from '@/modules/federations/domain/constants';
import { V2Badge, V2Button, V2EmptyState, V2ErrorState, V2Field, V2FilterChip, V2Skeleton, V2Surface, V2Textarea } from '@/v2/ui/primitives';
import { FedBadges, FedLogo, fedManagePath, fedPath, fedPublicPath, quando } from '@/v2/components/federations/federationUi';
import { REVEAL_REASON_META } from '@/modules/admin/domain/supportAccess';
import { fmtData } from '@/core/i18n';
import { t, tn } from '@/core/i18n';

const TONS = { pending: 'amber', approved: 'green', rejected: 'red', suspended: 'neutral' };

function MotivoDialog({ acao, federation, onClose }) {
  const [motivo, setMotivo] = useState('');
  const [erro, setErro] = useState('');
  const m = useFederationMutation(() => reviewFederation({ federationId: federation.id, action: acao, reason: motivo }));
  const recusar = acao === 'reject';
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent sheet className="max-w-md">
        <DialogTitle>{recusar ? t('Recusar o pedido') : t('Suspender a federação')}</DialogTitle>
        <DialogDescription>{federation.name}. {recusar ? t('Quem pediu lê o motivo e pode corrigir e pedir de novo.') : t('A página pública fecha e ninguém se filia até você aprovar de novo.')}</DialogDescription>
        <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); m.mutate(undefined, { onSuccess: () => { toast.success(recusar ? t('Pedido recusado. Quem pediu foi avisado.') : t('Federação suspensa. A equipe foi avisada.')); onClose(); }, onError: (er) => setErro(er.message) }); }}>
          <V2Field label={t('Motivo')} htmlFor="motivo-federacao" error={erro}>
            <V2Textarea id="motivo-federacao" rows={3} maxLength={500} value={motivo} onChange={(e) => { setMotivo(e.target.value); setErro(''); }} autoFocus placeholder={recusar ? t('Ex.: o CNPJ não é de entidade esportiva.') : t('Ex.: cobranças sem a filiação ativada.')} />
          </V2Field>
          <div className="flex justify-end gap-2">
            <V2Button type="button" variant="ghost" onClick={onClose}>{t('Voltar')}</V2Button>
            <V2Button type="submit" variant="danger" disabled={m.isPending}>{recusar ? t('Recusar') : t('Suspender')}</V2Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function DadosPrivados({ federationId }) {
  const q = useFederationPrivate(federationId);
  if (q.isError) return <V2ErrorState inline title={t('Não carregaram os dados da entidade')} onRetry={() => q.refetch()} />;
  if (!q.isSuccess) return <V2Skeleton lines={2} />;
  const d = q.data;
  if (!d) return <p className="text-sm text-gray-500">{t('Sem dados privados gravados.')}</p>;
  return (
    <dl className="grid gap-2 text-sm sm:grid-cols-2">
      <div><dt className="text-xs uppercase tracking-wider text-gray-500">{t('CNPJ')}</dt><dd className="font-mono text-ink">{d.cnpj}</dd></div>
      <div><dt className="text-xs uppercase tracking-wider text-gray-500">{t('Razão social')}</dt><dd className="text-ink">{d.legal_name}</dd></div>
      {d.phone && <div><dt className="text-xs uppercase tracking-wider text-gray-500">{t('Telefone')}</dt><dd className="text-ink">{d.phone}</dd></div>}
      {d.notes && <div className="sm:col-span-2"><dt className="text-xs uppercase tracking-wider text-gray-500">{t('Observações de quem pediu')}</dt><dd className="whitespace-pre-wrap text-ink">{d.notes}</dd></div>}
    </dl>
  );
}

function FederationRow({ f }) {
  const [motivo, setMotivo] = useState(null);
  const [privados, setPrivados] = useState(false);
  const m = useFederationMutation((action) => reviewFederation({ federationId: f.id, action }));
  const agir = (action, msg) => m.mutate(action, { onSuccess: () => toast.success(msg), onError: (e) => toast.error(e.message) });
  const acoes = federationReviewActions(f);
  const lugar = [f.city, f.state].filter(Boolean).join('/');
  return (
    <li>
      <V2Surface variant="compacto" className="space-y-3 p-4">
        <div className="flex flex-wrap items-start gap-3">
          <FedLogo federation={f} />
          <div className="min-w-0 flex-1">
            <p className="flex flex-wrap items-center gap-2 font-bold text-ink">{f.name}<V2Badge tone={TONS[f.status] || 'neutral'}>{t(FEDERATION_STATUS_LABELS[f.status] || f.status)}</V2Badge></p>
            <p className="text-xs text-gray-500">{f.acronym} · {t(FEDERATION_LEVEL_LABELS[f.level] || '')}{lugar ? ` · ${lugar}` : ''} · {t('CNPJ {cnpj}', { cnpj: f.cnpj_masked || '—' })} · {t('pedido por {nome} em {data}', { nome: f.created_by_name || '—', data: quando(f.created_at) })}</p>
            <div className="mt-1"><FedBadges federation={f} /></div>
            {f.review?.reason && f.status !== FEDERATION_STATUS.APPROVED && <p className="mt-1 text-sm text-red-600">{t('Motivo: {motivo}', { motivo: f.review.reason })}</p>}
          </div>
        </div>
        {privados && <DadosPrivados federationId={f.id} />}
        <div className="flex flex-wrap gap-2">
          {acoes.includes('approve') && <V2Button type="button" size="sm" disabled={m.isPending} onClick={() => agir('approve', t('Federação aprovada. Quem pediu virou presidente e foi avisado.'))}><CheckCircle2 className="h-4 w-4" />{t('Aprovar')}</V2Button>}
          {acoes.includes('reject') && <V2Button type="button" size="sm" variant="danger" onClick={() => setMotivo('reject')}><XCircle className="h-4 w-4" />{t('Recusar')}</V2Button>}
          {acoes.includes('suspend') && <V2Button type="button" size="sm" variant="danger" onClick={() => setMotivo('suspend')}><Ban className="h-4 w-4" />{t('Suspender')}</V2Button>}
          {acoes.includes('verify') && <V2Button type="button" size="sm" variant="secondary" disabled={m.isPending} onClick={() => agir('verify', t('Selo "Verificada" concedido.'))}><BadgeCheck className="h-4 w-4" />{t('Marcar verificada')}</V2Button>}
          {acoes.includes('unverify') && <V2Button type="button" size="sm" variant="ghost" disabled={m.isPending} onClick={() => agir('unverify', t('Selo "Verificada" retirado.'))}>{t('Tirar "Verificada"')}</V2Button>}
          {acoes.includes('official') && <V2Button type="button" size="sm" variant="secondary" disabled={m.isPending} onClick={() => agir('official', t('Selo "Oficial" concedido.'))}><ShieldCheck className="h-4 w-4" />{t('Marcar oficial')}</V2Button>}
          {acoes.includes('unofficial') && <V2Button type="button" size="sm" variant="ghost" disabled={m.isPending} onClick={() => agir('unofficial', t('Selo "Oficial" retirado.'))}>{t('Tirar "Oficial"')}</V2Button>}
          <V2Button type="button" size="sm" variant="ghost" onClick={() => setPrivados((v) => !v)}><Eye className="h-4 w-4" />{privados ? t('Ocultar dados da entidade') : t('Dados da entidade')}</V2Button>
          <V2Button asChild size="sm" variant="ghost"><Link to={fedPath(f)}>{t('Abrir no app')}</Link></V2Button>
          {f.status === FEDERATION_STATUS.APPROVED && <V2Button asChild size="sm" variant="ghost"><Link to={fedManagePath(f)}><KeyRound className="h-4 w-4" />{t('Entrar na Central (com motivo)')}</Link></V2Button>}
          {f.status === FEDERATION_STATUS.APPROVED && <V2Button asChild size="sm" variant="ghost"><Link to={fedPublicPath(f)} target="_blank" rel="noopener noreferrer"><ExternalLink className="h-4 w-4" />{t('Página pública')}</Link></V2Button>}
        </div>
      </V2Surface>
      {motivo && <MotivoDialog acao={motivo} federation={f} onClose={() => setMotivo(null)} />}
    </li>
  );
}

/**
 * Os acessos do admin da plataforma às Centrais das federações: o registro
 * interno (`admin_access_logs`, só o admin lê). Ninguém da federação vê.
 */
function AcessosAsCentrais() {
  const [aberto, setAberto] = useState(false);
  const q = useFederationAccessLogs({ enabled: aberto });
  const lista = q.data || [];
  return (
    <details className="rounded-2xl border border-gray-100 bg-white p-4" onToggle={(e) => setAberto(e.currentTarget.open)} data-dica="admin-federacoes-acessos">
      <summary className="cursor-pointer font-bold text-ink">{t('Acessos de suporte às Centrais')}</summary>
      <p className="mt-1 text-sm text-gray-500">{t('Cada entrada do admin numa Central de federação, com motivo e prazo. Registro interno: a federação não vê.')}</p>
      <div className="mt-3">
        {q.isError ? <V2ErrorState inline title={t('Não carregou o registro')} onRetry={() => q.refetch()} />
          : q.isLoading ? <V2Skeleton lines={3} />
          : !lista.length ? <p className="text-sm text-gray-500">{t('Nenhum acesso registrado.')}</p>
          : (
            <ul className="divide-y divide-gray-100 text-sm">
              {lista.map((l) => (
                <li key={l.id} className="py-2">
                  <p className="text-ink"><strong>{l.target_name_snapshot || l.target_federation_id}</strong> · {l.admin_email || l.admin_uid} · {fmtData(new Date(l.at_ms), { dateStyle: 'short', timeStyle: 'short' })} · {tn(l.hours || 0, '{n} hora', '{n} horas')}</p>
                  <p className="text-xs text-gray-500">{t(REVEAL_REASON_META[l.reason_category] || l.reason_category || '')}: {l.reason_text}{l.ticket_ref ? ` · ${l.ticket_ref}` : ''}</p>
                </li>
              ))}
            </ul>
          )}
      </div>
    </details>
  );
}

const FILTROS = ['pending', 'approved', 'suspended', 'rejected', 'todas'];

export default function AdminFederationsPanel() {
  const q = useAdminFederations();
  const [filtro, setFiltro] = useState('pending');
  const todas = q.data || [];
  const contas = useMemo(() => Object.fromEntries(FILTROS.map((f) => [f, f === 'todas' ? todas.length : todas.filter((x) => x.status === f).length])), [todas]);
  if (q.isError) return <V2ErrorState title={t('Não carregaram as federações')} onRetry={() => q.refetch()} />;
  if (q.isLoading) return <V2Skeleton lines={6} />;
  const lista = (filtro === 'todas' ? todas : todas.filter((f) => f.status === filtro)).sort((a, b) => String(a.name).localeCompare(String(b.name), 'pt-BR'));
  return (
    <section className="space-y-4" aria-label={t('Federações')} data-dica="admin-federacoes">
      <div>
        <h2 className="font-display text-xl font-bold text-ink">{t('Federações')}</h2>
        <p className="text-sm text-gray-500">{t('Quem pede abre com CNPJ e razão social. Aprovada, quem pediu vira presidente (admin master), monta cargos, planos e Pix e começa a filiar. Para entrar numa Central, o admin informa motivo e prazo. "Verificada" diz que a plataforma conferiu a entidade; "Oficial" é a federação reconhecida da região.')}</p>
      </div>
      <div className="flex flex-wrap gap-2">
        {FILTROS.map((f) => <V2FilterChip key={f} active={filtro === f} onClick={() => setFiltro(f)}>{f === 'todas' ? t('Todas') : t(FEDERATION_STATUS_LABELS[f])} ({contas[f]})</V2FilterChip>)}
      </div>
      {!lista.length ? <V2EmptyState icon={Landmark} title={filtro === 'pending' ? t('Nenhum pedido esperando') : t('Nenhuma federação neste filtro')} description={filtro === 'pending' ? tn(contas.approved, '{n} federação aprovada na plataforma.', '{n} federações aprovadas na plataforma.') : undefined} />
        : <ul className="space-y-3">{lista.map((f) => <FederationRow key={f.id} f={f} />)}</ul>}
      <AcessosAsCentrais />
    </section>
  );
}
