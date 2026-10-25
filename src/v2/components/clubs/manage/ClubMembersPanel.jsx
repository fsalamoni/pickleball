/**
 * "Associados" da Central do clube: a secretaria. A fila põe primeiro o que
 * espera decisão (pedidos), depois quem vence; cada linha tem as ações que
 * cabem ao estado (aprovar/recusar, suspender/reativar). Toda decisão vai ao
 * SERVIDOR, que muda a filiação, avisa a pessoa e registra na auditoria.
 * Fonte que falhou é "Tentar de novo" — nunca "nenhum associado".
 */
import React, { Suspense, lazy, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { FileText, Search, Upload, UserPlus, Users } from 'lucide-react';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { affiliationCounts, dataCurta, isFreePlan, membershipState, MEMBER_STATUS, sortAffiliationsForStaff } from '@/modules/clubs/domain/association';
import { useAssociationAction } from '@/modules/clubs/hooks/useClubAssociation';
import { useClubMembers } from '@/modules/clubs/hooks/useClubs';
import { V2Avatar, V2Button, V2EmptyState, V2ErrorState, V2Field, V2FilterChip, V2Select, V2SearchInput, V2Skeleton, V2StatCard, V2Surface, V2Textarea, V2Toggle } from '@/v2/ui/primitives';
import { MemberStatusBadge } from '@/v2/components/federations/federationUi';
import { podeAfirmarVazio } from '@/core/lib/queryState';
import { useSearchParams } from 'react-router-dom';
import { t, tk } from '@/core/i18n';

// Os diálogos pesados só baixam quando alguém os abre.
const ClubImportDialog = lazy(() => import('./ClubImportDialog'));
const ClubDeclarationDialog = lazy(() => import('@/v2/components/clubs/association/ClubDeclarationDialog'));

const FILTROS = [
  { id: 'todos', label: tk('Todos') },
  { id: 'pending', label: tk('Pedidos') },
  { id: 'awaiting_payment', label: tk('Aguardando pagamento') },
  { id: 'active', label: tk('Em dia') },
  { id: 'expiring', label: tk('Vencendo') },
  { id: 'expired', label: tk('Vencidos') },
  { id: 'suspended', label: tk('Suspensos') },
];

function passa(aff, filtro) {
  if (filtro === 'todos') return true;
  const st = membershipState(aff);
  if (filtro === 'expiring') return st.expiring;
  return st.status === filtro;
}

function GrantDialog({ open, onOpenChange, clubId, plansQ, afiliados }) {
  const membrosQ = useClubMembers(clubId);
  const agir = useAssociationAction(clubId);
  const [uid, setUid] = useState('');
  const [planId, setPlanId] = useState('');
  const [pago, setPago] = useState(false);
  const ativos = (plansQ.data || []).filter((p) => p.active !== false);
  const plano = ativos.find((p) => p.id === planId);
  const comFiliacao = new Set((afiliados || []).filter((a) => !['cancelled', 'rejected'].includes(a.status)).map((a) => a.user_id));
  const candidatos = (membrosQ.data || []).filter((m) => m.user_id && !comFiliacao.has(m.user_id));

  function enviar(e) {
    e.preventDefault();
    agir.mutate({ action: 'grant', userId: uid, planId, paid: pago }, {
      onSuccess: () => { toast.success(t('Associação criada.')); onOpenChange(false); setUid(''); setPlanId(''); setPago(false); },
      onError: (er) => toast.error(er.message),
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90dvh] max-w-md overflow-y-auto" sheet>
        <DialogHeader>
          <DialogTitle>{t('Associar uma pessoa')}</DialogTitle>
          <DialogDescription>{t('Para quem já é do clube e entra direto num plano. Plano pago gera a cobrança Pix, a não ser que você marque que já foi pago.')}</DialogDescription>
        </DialogHeader>
        {membrosQ.isError && <V2ErrorState inline title={t('Não carregaram os membros do clube')} onRetry={() => membrosQ.refetch()} />}
        {plansQ.isError && <V2ErrorState inline title={t('Não carregaram os planos')} onRetry={() => plansQ.refetch()} />}
        <form onSubmit={enviar} className="space-y-4">
          <V2Field label={t('Pessoa')} htmlFor="grant-pessoa" required>
            <V2Select id="grant-pessoa" value={uid} onChange={(e) => setUid(e.target.value)} required>
              <option value="">{membrosQ.isLoading ? t('Carregando…') : t('Escolha um membro do clube')}</option>
              {candidatos.map((m) => <option key={m.user_id} value={m.user_id}>{m.user_name || m.user_id}</option>)}
            </V2Select>
          </V2Field>
          <V2Field label={t('Plano')} htmlFor="grant-plano" required>
            <V2Select id="grant-plano" value={planId} onChange={(e) => setPlanId(e.target.value)} required>
              <option value="">{plansQ.isLoading ? t('Carregando…') : t('Escolha o plano')}</option>
              {ativos.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </V2Select>
          </V2Field>
          {plano && !isFreePlan(plano) && <V2Toggle id="grant-pago" checked={pago} onChange={setPago} label={t('Já foi pago fora da plataforma')} hint={t('Marcado, a associação entra em dia e fica registrado que a cobrança foi paga.')} />}
          <div className="flex justify-end gap-2">
            <V2Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>{t('Cancelar')}</V2Button>
            <V2Button type="submit" disabled={!uid || !planId || agir.isPending}>{agir.isPending ? t('Associando…') : t('Associar')}</V2Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function Linha({ aff, onAcao, ocupado }) {
  const st = membershipState(aff);
  const status = st.status || aff.status;
  return (
    <li className="flex flex-wrap items-center gap-3 rounded-2xl border border-gray-100 bg-paper-pure px-4 py-3">
      <V2Avatar name={aff.user_name} photoUrl={aff.photo_url} size="sm" />
      <div className="min-w-0 flex-1">
        <p className="truncate font-semibold text-ink">{aff.user_name || t('Associado')}</p>
        <p className="truncate text-xs text-gray-500">
          {[aff.plan_name, aff.member_number, aff.valid_until ? t('até {data}', { data: dataCurta(aff.valid_until) }) : (aff.free ? t('sem vencimento') : '')].filter(Boolean).join(' · ')}
        </p>
        {aff.note && <p className="truncate text-xs text-gray-500">“{aff.note}”</p>}
      </div>
      <MemberStatusBadge status={status} />
      <div className="flex flex-wrap gap-1.5">
        {aff.status === MEMBER_STATUS.PENDING && (
          <>
            <V2Button type="button" size="sm" disabled={ocupado} onClick={() => onAcao('approve', aff)}>{t('Aprovar')}</V2Button>
            <V2Button type="button" size="sm" variant="ghost" disabled={ocupado} onClick={() => onAcao('reject', aff)}>{t('Recusar')}</V2Button>
          </>
        )}
        {[MEMBER_STATUS.ACTIVE, MEMBER_STATUS.EXPIRED].includes(aff.status) && (
          <V2Button type="button" size="sm" variant="ghost" disabled={ocupado} onClick={() => onAcao('suspend', aff)}>{t('Suspender')}</V2Button>
        )}
        {aff.status === MEMBER_STATUS.SUSPENDED && (
          <V2Button type="button" size="sm" variant="secondary" disabled={ocupado} onClick={() => onAcao('reinstate', aff)}>{t('Reativar')}</V2Button>
        )}
        {status === MEMBER_STATUS.ACTIVE && aff.card_code && (
          <V2Button type="button" size="sm" variant="ghost" onClick={() => onAcao('declaration', aff)} aria-label={t('Emitir declaração de {nome}', { nome: aff.user_name || t('Associado') })}><FileText className="h-4 w-4" />{t('Declaração')}</V2Button>
        )}
      </div>
    </li>
  );
}

export default function ClubMembersPanel({ club, affiliationsQ, plansQ, perms }) {
  const clubId = club.id;
  const agir = useAssociationAction(clubId);
  const [params, setParams] = useSearchParams();
  const filtro = FILTROS.some((f) => f.id === params.get('filtro')) ? params.get('filtro') : 'todos';
  const [busca, setBusca] = useState('');
  const [pergunta, setPergunta] = useState(null); // { acao, aff }
  const [motivo, setMotivo] = useState('');
  const [associar, setAssociar] = useState(false);
  const [importar, setImportar] = useState(false);
  const [declaracao, setDeclaracao] = useState(null); // a filiação de quem recebe a declaração
  const lista = useMemo(() => (affiliationsQ.isSuccess ? sortAffiliationsForStaff(affiliationsQ.data || []) : []), [affiliationsQ.isSuccess, affiliationsQ.data]);
  const contagem = useMemo(() => (affiliationsQ.isSuccess ? affiliationCounts(affiliationsQ.data || []) : null), [affiliationsQ.isSuccess, affiliationsQ.data]);
  const visiveis = lista.filter((a) => passa(a, filtro) && (!busca.trim() || String(a.user_name || '').toLowerCase().includes(busca.trim().toLowerCase())));

  function setFiltro(id) {
    setParams((atual) => { const n = new URLSearchParams(atual); if (id === 'todos') n.delete('filtro'); else n.set('filtro', id); return n; }, { replace: true });
  }
  function acao(a, aff) {
    if (a === 'declaration') { setDeclaracao(aff); return; }
    if (a === 'approve') {
      agir.mutate({ action: 'approve', userId: aff.user_id }, { onSuccess: () => toast.success(t('Pedido aprovado.')), onError: (er) => toast.error(er.message) });
      return;
    }
    setMotivo('');
    if (a === 'reinstate') { agir.mutate({ action: 'reinstate', userId: aff.user_id }, { onSuccess: () => toast.success(t('Associação reativada.')), onError: (er) => toast.error(er.message) }); return; }
    setPergunta({ acao: a, aff });
  }
  function confirmar() {
    const { acao: a, aff } = pergunta;
    agir.mutate({ action: a, userId: aff.user_id, reason: motivo }, {
      onSuccess: () => { toast.success(a === 'reject' ? t('Pedido recusado.') : t('Associação suspensa.')); setPergunta(null); },
      onError: (er) => toast.error(er.message),
    });
  }

  const podeAssociar = perms.includes('admin') || perms.includes('members');
  const semAfiliados = affiliationsQ.isSuccess && podeAfirmarVazio(affiliationsQ) && lista.length === 0;

  return (
    <section className="space-y-5" aria-label={t('Associados')} data-dica="clube-associados">
      {contagem && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <V2StatCard icon={Users} label={t('Em dia')} value={String(contagem.active)} />
          <V2StatCard icon={Users} label={t('Pedidos')} value={String(contagem.pending)} accent={contagem.pending ? 'acid' : 'ink'} />
          <V2StatCard icon={Users} label={t('Vencendo em 30 dias')} value={String(contagem.expiring)} />
          <V2StatCard icon={Users} label={t('Vencidos')} value={String(contagem.expired)} />
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-1.5" role="group" aria-label={t('Filtrar por situação')}>
          {FILTROS.map((f) => <V2FilterChip key={f.id} active={filtro === f.id} onClick={() => setFiltro(f.id)}>{t(f.label)}</V2FilterChip>)}
        </div>
        {podeAssociar && (
          <div className="flex flex-wrap gap-2">
            <V2Button type="button" size="sm" variant="secondary" onClick={() => setImportar(true)} data-dica="clube-importar-abrir"><Upload className="h-4 w-4" />{t('Importar lista')}</V2Button>
            <V2Button type="button" size="sm" onClick={() => setAssociar(true)}><UserPlus className="h-4 w-4" />{t('Associar uma pessoa')}</V2Button>
          </div>
        )}
      </div>
      <V2SearchInput icon={Search} value={busca} onChange={(e) => setBusca(e.target.value)} placeholder={t('Buscar associado pelo nome')} aria-label={t('Buscar associado pelo nome')} />

      {affiliationsQ.isLoading && <V2Skeleton lines={5} />}
      {affiliationsQ.isError && <V2ErrorState title={t('Não carregaram os associados')} onRetry={() => affiliationsQ.refetch()} />}
      {semAfiliados && (
        <V2Surface><V2EmptyState icon={Users} title={t('Nenhum associado ainda')} description={t('Quando alguém pedir associação — ou você associar um membro do clube — aparece aqui.')} /></V2Surface>
      )}
      {affiliationsQ.isSuccess && lista.length > 0 && (
        visiveis.length === 0
          ? <p className="text-sm text-gray-500">{t('Nenhum associado nesse filtro.')}</p>
          : <ul className="space-y-2">{visiveis.map((a) => <Linha key={a.id} aff={a} onAcao={acao} ocupado={agir.isPending} />)}</ul>
      )}

      <ConfirmDialog
        open={Boolean(pergunta)}
        onOpenChange={(o) => { if (!o) setPergunta(null); }}
        destructive
        title={pergunta?.acao === 'reject' ? t('Recusar o pedido?') : t('Suspender a associação?')}
        description={pergunta?.acao === 'reject' ? t('A pessoa é avisada com o motivo e pode corrigir e pedir de novo.') : t('A carteirinha passa a mostrar "Suspensa" e o código muda. A pessoa é avisada com o motivo.')}
        confirmLabel={pergunta?.acao === 'reject' ? t('Recusar') : t('Suspender')}
        loading={agir.isPending}
        confirmDisabled={motivo.trim().length < 3}
        onConfirm={confirmar}
      >
        <V2Field label={t('Motivo (a pessoa lê)')} htmlFor="club-aff-motivo" required>
          <V2Textarea id="club-aff-motivo" rows={3} maxLength={500} value={motivo} onChange={(e) => setMotivo(e.target.value)} />
        </V2Field>
      </ConfirmDialog>
      <GrantDialog open={associar} onOpenChange={setAssociar} clubId={clubId} plansQ={plansQ} afiliados={affiliationsQ.data} />
      <Suspense fallback={null}>
        {importar && <ClubImportDialog open onOpenChange={setImportar} clubId={clubId} plansQ={plansQ} />}
        {declaracao && <ClubDeclarationDialog open onOpenChange={(o) => { if (!o) setDeclaracao(null); }} aff={declaracao} club={club} />}
      </Suspense>
    </section>
  );
}
