/**
 * Clubes e arenas filiados (Central → Filiados e cadastrados → "Vínculos de clubes e arenas", permissão
 * `members`): os pedidos para aprovar ou recusar e os filiados, com suspender
 * e reintegrar. A decisão grava só estado e motivo (a regra confere).
 */
import React, { lazy, Suspense, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import { Ban, Building2, CheckCircle2, RotateCcw, Send, Users, XCircle } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { cancelAffiliationInvite, decideAffiliation } from '@/modules/federations/services/federationService';
import { fedModuleOn, isFederationPublic } from '@/modules/federations/domain/federation';
import { useFederationMutation } from '@/modules/federations/hooks/useFederations';
import { sortAffiliations } from '@/modules/federations/domain/affiliations';
import { AFFILIATION_STATUS, AFFILIATION_STATUS_LABELS, ORG_KIND_LABELS } from '@/modules/federations/domain/constants';
import { useAuth } from '@/core/lib/FirebaseAuthContext';
import { V2Badge, V2Button, V2EmptyState, V2ErrorState, V2Field, V2FilterChip, V2Skeleton, V2Surface, V2Textarea } from '@/v2/ui/primitives';
import { t } from '@/core/i18n';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { quando } from '../federationUi';
import { BuscaLista, MostrarMais, useBuscaLista, useFiltroNaUrl } from './listTools';

const FedOrgInviteDialog = lazy(() => import('./FedOrgInviteDialog'));
const TOM = { pending: 'amber', approved: 'green', rejected: 'red', suspended: 'red', invited: 'blue' };

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
          <V2Field label={t('Motivo')} htmlFor="motivo-org" error={erro} hint={t('Pelo menos 3 caracteres. Quem pediu recebe este texto no aviso.')}>
            <V2Textarea id="motivo-org" rows={3} maxLength={500} value={motivo} onChange={(e) => { setMotivo(e.target.value); setErro(''); }} autoFocus />
          </V2Field>
          <div className="flex justify-end gap-2">
            <V2Button type="button" variant="ghost" onClick={onClose}>{t('Voltar')}</V2Button>
            <V2Button type="submit" variant="danger" disabled={m.isPending || motivo.trim().length < 3}>{recusar ? t('Recusar') : t('Suspender')}</V2Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function OrgRow({ aff }) {
  const { user } = useAuth();
  const [motivo, setMotivo] = useState(null);
  const [aprovando, setAprovando] = useState(false);
  const [cancelando, setCancelando] = useState(false);
  const m = useFederationMutation((action) => decideAffiliation(aff, action, { uid: user?.uid }));
  const cancelar = useFederationMutation(() => cancelAffiliationInvite(aff, { uid: user?.uid }));
  const convite = aff.status === AFFILIATION_STATUS.INVITED;
  // Filiação POR PLANO (Etapa 2): este registro é o espelho do servidor — decide-se em Filiados, na filiação.
  const porPlano = Boolean(aff.member_id);
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
              {t(ORG_KIND_LABELS[aff.kind] || aff.kind)}{aff.org_city ? ` · ${[aff.org_city, aff.org_state].filter(Boolean).join('/')}` : ''} · {porPlano ? [t('plano {nome}', { nome: aff.plan_name || '—' }), aff.member_number ? t('nº {numero}', { numero: aff.member_number }) : '', aff.valid_until ? t('válida até {data}', { data: quando(aff.valid_until) }) : ''].filter(Boolean).join(' · ') : convite || (!aff.requested_at && aff.invited_at) ? t('convidado em {data}', { data: quando(aff.invited_at) }) : t('pedido em {data}', { data: quando(aff.requested_at) })}
            </p>
            {aff.message && <p className="mt-1 text-sm text-gray-700">“{aff.message}”</p>}
            {aff.review?.reason && aff.status !== AFFILIATION_STATUS.APPROVED && <p className="mt-1 text-sm text-red-600">{t('Motivo: {motivo}', { motivo: aff.review.reason })}</p>}
          </div>
        </div>
        {porPlano ? (
          <p className="text-xs text-gray-500">{t('Filiada por plano: aprovar, suspender e cobranças ficam em Filiados, na filiação da entidade.')}</p>
        ) : (
        <div className="flex flex-wrap gap-2">
          {aff.status === AFFILIATION_STATUS.PENDING && (
            <>
              <V2Button type="button" size="sm" disabled={m.isPending} onClick={() => setAprovando(true)}><CheckCircle2 className="h-4 w-4" />{t('Aprovar')}</V2Button>
              <V2Button type="button" size="sm" variant="danger" onClick={() => setMotivo('reject')}><XCircle className="h-4 w-4" />{t('Recusar')}</V2Button>
            </>
          )}
          {aff.status === AFFILIATION_STATUS.APPROVED && <V2Button type="button" size="sm" variant="danger" onClick={() => setMotivo('suspend')}><Ban className="h-4 w-4" />{t('Suspender')}</V2Button>}
          {convite && <V2Button type="button" size="sm" variant="ghost" disabled={cancelar.isPending} onClick={() => setCancelando(true)}><XCircle className="h-4 w-4" />{t('Cancelar convite')}</V2Button>}
          {aff.status === AFFILIATION_STATUS.SUSPENDED && <V2Button type="button" size="sm" variant="secondary" disabled={m.isPending} onClick={() => m.mutate('approve', { onSuccess: () => toast.success(t('Filiação reintegrada.')), onError: (e) => toast.error(e.message) })}><RotateCcw className="h-4 w-4" />{t('Reintegrar')}</V2Button>}
        </div>
        )}
      </V2Surface>
      <ConfirmDialog
        open={aprovando}
        onOpenChange={setAprovando}
        loading={m.isPending}
        title={t('Aprovar a filiação de {nome}?', { nome: aff.org_name || '' })}
        description={aff.kind === 'club'
          ? t('O selo "Filiado" aparece na página do clube, ele entra na lista pública da federação e quem pediu é avisado. Se precisar, dá para suspender depois.')
          : t('O selo "Filiado" aparece na página da arena, ela entra na lista pública da federação e quem pediu é avisado. Se precisar, dá para suspender depois.')}
        confirmLabel={t('Aprovar')}
        cancelLabel={t('Voltar')}
        onConfirm={() => m.mutate('approve', { onSuccess: () => { setAprovando(false); toast.success(t('Filiação aprovada. Quem pediu foi avisado.')); }, onError: (e) => toast.error(e.message) })}
      />
      <ConfirmDialog
        open={cancelando}
        onOpenChange={setCancelando}
        loading={cancelar.isPending}
        title={t('Cancelar o convite a {nome}?', { nome: aff.org_name || '' })}
        description={t('O convite some da tela do clube ou da arena. Dá para convidar de novo depois.')}
        confirmLabel={t('Cancelar convite')}
        cancelLabel={t('Voltar')}
        onConfirm={() => cancelar.mutate(undefined, { onSuccess: () => { setCancelando(false); toast.success(t('Convite cancelado.')); }, onError: (e) => toast.error(e.message) })}
      />
      {motivo && <MotivoDialog acao={motivo} aff={aff} onClose={() => setMotivo(null)} />}
    </li>
  );
}

/** `pendentes` é contrato: a faixa "Precisa de você" abre `?aba=filiados-orgs&filtro=pendentes`. */
const FILTROS = [
  { id: 'pendentes', label: () => t('Pedidos'), ok: (a) => a.status === AFFILIATION_STATUS.PENDING },
  { id: 'convites', label: () => t('Convites'), ok: (a) => a.status === AFFILIATION_STATUS.INVITED },
  { id: 'filiados', label: () => t('Filiados'), ok: (a) => a.status === AFFILIATION_STATUS.APPROVED },
  { id: 'clubes', label: () => t('Clubes'), ok: (a) => a.kind === 'club' && a.status === AFFILIATION_STATUS.APPROVED },
  { id: 'arenas', label: () => t('Arenas'), ok: (a) => a.kind === 'arena' && a.status === AFFILIATION_STATUS.APPROVED },
  { id: 'todos', label: () => t('Todos'), ok: () => true },
];
const BUSCA = (a) => `${a.org_name} ${a.org_city || ''} ${a.org_state || ''}`;

export default function FedAffiliationsPanel({ federation, affiliationsQ }) {
  const [filtro, setFiltro] = useFiltroNaUrl('filtro', 'pendentes', FILTROS.map((f) => f.id));
  const [convidando, setConvidando] = useState(false);
  // Convidar exige a federação pública com o módulo ligado (a regra confere as duas coisas).
  const podeConvidar = Boolean(federation) && fedModuleOn(federation, 'affiliations') && isFederationPublic(federation);
  const lista = useMemo(() => sortAffiliations(affiliationsQ.data || []), [affiliationsQ.data]);
  const opcao = FILTROS.find((f) => f.id === filtro) || FILTROS[0];
  const doFiltro = useMemo(() => lista.filter(opcao.ok), [lista, opcao]);
  const busca = useBuscaLista(doFiltro, BUSCA);
  if (affiliationsQ.isError) return <V2ErrorState title={t('Não carregaram os clubes e arenas')} onRetry={() => affiliationsQ.refetch()} />;
  if (!affiliationsQ.isSuccess) return <V2Skeleton lines={5} />;
  const termo = busca.termo.trim();
  return (
    <section className="space-y-4" aria-label={t('Clubes e arenas filiados')} data-dica="federacao-aba-filiados-orgs">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <p className="text-sm text-gray-600">{t('O clube pede em Gestão do clube → Federação; a arena, na Central → Equipe e parceiros → Federação. Aprovado, o selo "Filiado" aparece na página dele e ele entra na lista pública da federação. Você também pode convidar: quem gere aceita e vira filiado na hora.')}</p>
        {podeConvidar
          ? <V2Button type="button" size="sm" className="shrink-0" onClick={() => setConvidando(true)} data-dica="federacao-convidar-org"><Send className="h-4 w-4" />{t('Convidar clube ou arena')}</V2Button>
          : federation && <p className="shrink-0 text-xs text-gray-500 sm:max-w-56">{t('Para convidar, a federação precisa estar pública.')}</p>}
      </div>
      {convidando && <Suspense fallback={null}><FedOrgInviteDialog federation={federation} affiliations={lista} onClose={() => setConvidando(false)} /></Suspense>}
      {lista.length > 0 && (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex flex-wrap gap-2" role="group" aria-label={t('Filtro')}>
            {FILTROS.map((f) => <V2FilterChip key={f.id} active={filtro === f.id} onClick={() => setFiltro(f.id)}>{`${f.label()} (${lista.filter(f.ok).length})`}</V2FilterChip>)}
          </div>
          <BuscaLista id="fed-orgs-busca" value={busca.termo} onChange={busca.setTermo} placeholder={t('Buscar por nome ou cidade')} total={doFiltro.length} achados={busca.filtrados.length} className="sm:w-72" />
        </div>
      )}
      {!busca.filtrados.length ? (
        <V2EmptyState
          icon={Building2}
          title={termo ? t('Nenhum clube ou arena com "{termo}"', { termo }) : !lista.length ? t('Nenhum clube ou arena pediu filiação ainda') : filtro === 'pendentes' ? t('Nenhum pedido aguardando') : t('Nada neste filtro')}
          description={termo ? t('Confira a grafia ou limpe a busca.') : !lista.length || filtro === 'pendentes' ? t('Clubes e arenas que pedirem filiação aparecem aqui.') : t('Veja os demais no filtro "Todos".')}
        />
      ) : (
        <>
          <ul className="space-y-3">{busca.visiveis.map((a) => <OrgRow key={a.id} aff={a} />)}</ul>
          <MostrarMais restam={busca.restam} onClick={busca.mostrarMais} />
        </>
      )}
    </section>
  );
}
