/**
 * Clubes e arenas filiados (Central → Filiados → "Clubes e arenas", permissão
 * `members`): os pedidos para aprovar ou recusar e os filiados, com suspender
 * e reintegrar. A decisão grava só estado e motivo (a regra confere).
 */
import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import { Ban, Building2, CheckCircle2, RotateCcw, Users, XCircle } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { decideAffiliation } from '@/modules/federations/services/federationService';
import { useFederationMutation } from '@/modules/federations/hooks/useFederations';
import { affiliationCounts, sortAffiliations } from '@/modules/federations/domain/affiliations';
import { AFFILIATION_STATUS, AFFILIATION_STATUS_LABELS, ORG_KIND_LABELS } from '@/modules/federations/domain/constants';
import { useAuth } from '@/core/lib/FirebaseAuthContext';
import { V2Badge, V2Button, V2EmptyState, V2ErrorState, V2Field, V2FilterChip, V2Skeleton, V2Surface, V2Textarea } from '@/v2/ui/primitives';
import { t } from '@/core/i18n';
import { quando } from '../federationUi';

const TOM = { pending: 'amber', approved: 'green', rejected: 'red', suspended: 'red' };

function MotivoDialog({ acao, aff, onClose }) {
  const { user } = useAuth();
  const [motivo, setMotivo] = useState('');
  const [erro, setErro] = useState('');
  const m = useFederationMutation(() => decideAffiliation(aff, acao, { uid: user?.uid, reason: motivo }));
  const recusar = acao === 'reject';
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent sheet className="max-w-md">
        <DialogTitle>{recusar ? t('Recusar o pedido') : t('Suspender a filiação')}</DialogTitle>
        <DialogDescription>{aff.org_name}. {recusar ? t('Quem pediu lê o motivo e pode pedir de novo.') : t('O selo sai da página até você reintegrar.')}</DialogDescription>
        <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); m.mutate(undefined, { onSuccess: () => { toast.success(recusar ? t('Pedido recusado. Quem pediu foi avisado.') : t('Filiação suspensa. Quem pediu foi avisado.')); onClose(); }, onError: (er) => setErro(er.message) }); }}>
          <V2Field label={t('Motivo')} htmlFor="motivo-org" error={erro}>
            <V2Textarea id="motivo-org" rows={3} maxLength={500} value={motivo} onChange={(e) => { setMotivo(e.target.value); setErro(''); }} autoFocus />
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

function OrgRow({ aff }) {
  const { user } = useAuth();
  const [motivo, setMotivo] = useState(null);
  const m = useFederationMutation((action) => decideAffiliation(aff, action, { uid: user?.uid }));
  const Icone = aff.kind === 'club' ? Users : Building2;
  const to = aff.kind === 'club' ? `/clubes/${aff.org_id}` : `/arenas/${aff.org_id}`;
  return (
    <li>
      <V2Surface variant="compacto" className="space-y-3 p-4">
        <div className="flex flex-wrap items-start gap-3">
          {aff.org_logo ? <img src={aff.org_logo} alt="" className="h-10 w-10 rounded-xl object-cover" /> : <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-paper text-gray-500"><Icone className="h-5 w-5" aria-hidden="true" /></span>}
          <div className="min-w-0 flex-1">
            <p className="flex flex-wrap items-center gap-2 font-bold text-ink">
              <Link to={to} className="hover:underline">{aff.org_name}</Link>
              <V2Badge tone={TOM[aff.status] || 'neutral'}>{t(AFFILIATION_STATUS_LABELS[aff.status] || aff.status)}</V2Badge>
            </p>
            <p className="text-xs text-gray-500">
              {t(ORG_KIND_LABELS[aff.kind] || aff.kind)}{aff.org_city ? ` · ${[aff.org_city, aff.org_state].filter(Boolean).join('/')}` : ''} · {t('pedido em {data}', { data: quando(aff.requested_at) })}
            </p>
            {aff.message && <p className="mt-1 text-sm text-gray-700">“{aff.message}”</p>}
            {aff.review?.reason && aff.status !== AFFILIATION_STATUS.APPROVED && <p className="mt-1 text-sm text-red-600">{t('Motivo: {motivo}', { motivo: aff.review.reason })}</p>}
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {aff.status === AFFILIATION_STATUS.PENDING && (
            <>
              <V2Button type="button" size="sm" disabled={m.isPending} onClick={() => m.mutate('approve', { onSuccess: () => toast.success(t('Filiação aprovada. Quem pediu foi avisado.')), onError: (e) => toast.error(e.message) })}><CheckCircle2 className="h-4 w-4" />{t('Aprovar')}</V2Button>
              <V2Button type="button" size="sm" variant="danger" onClick={() => setMotivo('reject')}><XCircle className="h-4 w-4" />{t('Recusar')}</V2Button>
            </>
          )}
          {aff.status === AFFILIATION_STATUS.APPROVED && <V2Button type="button" size="sm" variant="danger" onClick={() => setMotivo('suspend')}><Ban className="h-4 w-4" />{t('Suspender')}</V2Button>}
          {aff.status === AFFILIATION_STATUS.SUSPENDED && <V2Button type="button" size="sm" variant="secondary" disabled={m.isPending} onClick={() => m.mutate('approve', { onSuccess: () => toast.success(t('Filiação reintegrada.')), onError: (e) => toast.error(e.message) })}><RotateCcw className="h-4 w-4" />{t('Reintegrar')}</V2Button>}
        </div>
      </V2Surface>
      {motivo && <MotivoDialog acao={motivo} aff={aff} onClose={() => setMotivo(null)} />}
    </li>
  );
}

export default function FedAffiliationsPanel({ affiliationsQ }) {
  const [filtro, setFiltro] = useState('pending');
  const lista = useMemo(() => sortAffiliations(affiliationsQ.data || []), [affiliationsQ.data]);
  const contas = useMemo(() => affiliationCounts(affiliationsQ.data || []), [affiliationsQ.data]);
  if (affiliationsQ.isError) return <V2ErrorState title={t('Não carregaram os clubes e arenas')} onRetry={() => affiliationsQ.refetch()} />;
  if (!affiliationsQ.isSuccess) return <V2Skeleton lines={5} />;
  const FILTROS = [
    { id: 'pending', label: t('Pedidos'), n: contas.pending },
    { id: 'approved', label: t('Filiados'), n: contas.approved },
    { id: 'club', label: t('Clubes'), n: contas.clubs },
    { id: 'arena', label: t('Arenas'), n: contas.arenas },
    { id: 'todos', label: t('Todos'), n: lista.length },
  ];
  const visiveis = lista.filter((a) => (filtro === 'todos') || (filtro === 'club' || filtro === 'arena' ? a.kind === filtro && a.status === AFFILIATION_STATUS.APPROVED : a.status === filtro));
  return (
    <section className="space-y-4" aria-label={t('Clubes e arenas filiados')} data-dica="federacao-aba-filiados-orgs">
      <p className="text-sm text-gray-600">{t('O clube pede em Gestão do clube → Federação; a arena, na Central → Equipe e parceiros → Federação. Aprovado, o selo "Filiado" aparece na página dele e ele entra na lista pública da federação.')}</p>
      <div className="flex flex-wrap gap-2" role="group" aria-label={t('Filtro')}>
        {FILTROS.map((f) => <V2FilterChip key={f.id} active={filtro === f.id} onClick={() => setFiltro(f.id)}>{f.label}{f.n ? ` · ${f.n}` : ''}</V2FilterChip>)}
      </div>
      {visiveis.length === 0
        ? <V2EmptyState icon={Building2} title={filtro === 'pending' ? t('Nenhum pedido aguardando') : t('Nada aqui ainda')} description={t('Clubes e arenas que pedirem filiação aparecem aqui.')} />
        : <ul className="space-y-3">{visiveis.map((a) => <OrgRow key={a.id} aff={a} />)}</ul>}
    </section>
  );
}
