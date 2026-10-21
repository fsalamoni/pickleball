/**
 * Filiados da federação (secretaria, permissão `members`): os PEDIDOS para
 * aprovar ou recusar e a LISTA de filiados (em dia, vencendo, vencidos,
 * suspensos), com suspender e reintegrar. Toda decisão é do servidor
 * (`membershipAction`); a tela só pede.
 */
import React, { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Ban, CheckCircle2, Eye, FileText, IdCard, Inbox, RotateCcw, Users, XCircle } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { useAuth } from '@/core/lib/FirebaseAuthContext';
import { membershipAction, revealMemberPrivate } from '@/modules/federations/services/federationService';
import { useFederationMutation } from '@/modules/federations/hooks/useFederations';
import { membershipState, memberCounts, sortMembersForStaff } from '@/modules/federations/domain/membership';
import { formatCpf } from '@/modules/federations/domain/privateData';
import { isDisciplineSuspended } from '@/modules/federations/domain/discipline';
import { DOC_KIND_LABELS, DOC_STATUS_LABELS, MEMBER_STATUS, PLAN_PERSON_TYPE_LABELS, PLAN_TIER_LABELS } from '@/modules/federations/domain/constants';
import { V2Avatar, V2Badge, V2Button, V2EmptyState, V2ErrorState, V2Field, V2FilterChip, V2Input, V2SearchInput, V2Skeleton, V2Surface, V2Textarea } from '@/v2/ui/primitives';
import { t, tn } from '@/core/i18n';
import { MemberStatusBadge, quando } from '../federationUi';
import MembershipDeclarationDialog from '../MembershipDeclaration';

const normaliza = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

/** Recusar / suspender: o motivo é obrigatório, porque a pessoa vai ler. */
function MotivoDialog({ acao, member, federationId, onClose }) {
  const [motivo, setMotivo] = useState('');
  const [erro, setErro] = useState('');
  const m = useFederationMutation(() => membershipAction({ federationId, action: acao, memberId: member.id, reason: motivo }));
  const recusar = acao === 'reject';
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent sheet className="max-w-md">
        <DialogTitle>{recusar ? t('Recusar o pedido') : t('Suspender a filiação')}</DialogTitle>
        <DialogDescription>{member.user_name}. {recusar ? t('A pessoa lê o motivo e pode pedir de novo.') : t('A carteirinha deixa de verificar até você reintegrar.')}</DialogDescription>
        <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); m.mutate(undefined, { onSuccess: () => { toast.success(recusar ? t('Pedido recusado. A pessoa foi avisada.') : t('Filiação suspensa. A pessoa foi avisada.')); onClose(); }, onError: (er) => setErro(er.message) }); }}>
          <V2Field label={t('Motivo')} htmlFor="motivo-filiacao" error={erro}>
            <V2Textarea id="motivo-filiacao" rows={3} maxLength={500} value={motivo} onChange={(e) => { setMotivo(e.target.value); setErro(''); }} autoFocus />
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

/**
 * A ficha do filiado: o que a secretaria precisa e nada mais. CPF e
 * responsável ficam em `private/data` e só aparecem depois de "Revelar", com
 * motivo — a leitura é registrada na auditoria, como no suporte do admin.
 */
function FichaDialog({ member: mb, documentos, onClose }) {
  const { user } = useAuth();
  const [motivo, setMotivo] = useState('');
  const [privado, setPrivado] = useState(null);
  const [erro, setErro] = useState('');
  const revelar = useFederationMutation(() => revealMemberPrivate(mb, { uid: user?.uid, reason: motivo }));
  const docs = (documentos || []).filter((d) => d.member_id === mb.id).sort((a, b) => (b.created_at_ms || 0) - (a.created_at_ms || 0));
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent sheet className="max-w-lg">
        <DialogTitle>{mb.user_name}</DialogTitle>
        <DialogDescription>{mb.plan_name}{mb.member_number ? ` · ${mb.member_number}` : ''}{mb.is_minor ? ` · ${t('menor de idade')}` : ''}{mb.guardian_uid ? ` · ${t('dependente de {nome}', { nome: mb.guardian_name || t('responsável') })}` : ''}</DialogDescription>
        <div className="space-y-4">
          <section className="space-y-2">
            <h3 className="text-sm font-bold text-ink">{t('Dados reservados')}</h3>
            {privado ? (
              <dl className="grid gap-1 text-sm text-gray-700">
                <div className="flex gap-2"><dt className="font-semibold">{t('CPF:')}</dt><dd>{privado.cpf ? formatCpf(privado.cpf) : t('não informado')}</dd></div>
                {privado.birth_date && <div className="flex gap-2"><dt className="font-semibold">{t('Nascimento:')}</dt><dd>{quando(privado.birth_date)}</dd></div>}
                {privado.guardian && <div className="flex gap-2"><dt className="font-semibold">{t('Responsável:')}</dt><dd>{privado.guardian.name}{privado.guardian.contact ? ` · ${privado.guardian.contact}` : ''}</dd></div>}
                {!privado.cpf && !privado.guardian && !privado.birth_date && <p className="text-gray-500">{t('Nada reservado para esta filiação.')}</p>}
              </dl>
            ) : (
              <form className="flex flex-wrap items-end gap-2" onSubmit={(e) => { e.preventDefault(); revelar.mutate(undefined, { onSuccess: (p) => setPrivado(p || {}), onError: (er) => setErro(er.message) }); }}>
                <V2Field label={t('Motivo para ver CPF e responsável')} htmlFor="ficha-motivo" error={erro} className="flex-1" hint={t('Fica registrado na auditoria da federação.')}>
                  <V2Input id="ficha-motivo" maxLength={300} value={motivo} onChange={(e) => { setMotivo(e.target.value); setErro(''); }} />
                </V2Field>
                <V2Button type="submit" size="sm" variant="secondary" disabled={revelar.isPending || motivo.trim().length < 5}><Eye className="h-4 w-4" />{t('Revelar')}</V2Button>
              </form>
            )}
          </section>
          <section className="space-y-2">
            <h3 className="text-sm font-bold text-ink">{t('Documentos enviados')}</h3>
            {documentos === undefined ? <p className="text-sm text-gray-500">{t('Os documentos não carregaram.')}</p>
              : !docs.length ? <p className="text-sm text-gray-500">{t('Nenhum documento enviado. A conferência fica em Filiados → Documentos.')}</p>
                : <ul className="space-y-1 text-sm text-gray-700">{docs.map((d) => <li key={d.id} className="flex flex-wrap items-center gap-2">{t(DOC_KIND_LABELS[d.kind] || DOC_KIND_LABELS.outro)}<V2Badge tone={{ pending: 'amber', approved: 'green', rejected: 'red' }[d.status] || 'neutral'}>{t(DOC_STATUS_LABELS[d.status] || d.status)}</V2Badge><span className="text-xs text-gray-500">{quando(d.created_at)}</span></li>)}</ul>}
          </section>
          {Number(mb.discipline_until_ms) > 0 && isDisciplineSuspended(mb) && <p className="text-sm text-red-600">{t('Suspensão disciplinar até {data}.', { data: quando(mb.discipline_until_ms) })}</p>}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function MemberRow({ member: mb, federation, documentos, pedido = false }) {
  const federationId = federation.id;
  const [motivo, setMotivo] = useState(null);
  const [ficha, setFicha] = useState(false);
  const [declaracao, setDeclaracao] = useState(false);
  const m = useFederationMutation((action) => membershipAction({ federationId, action, memberId: mb.id }));
  const agir = (action, msg) => m.mutate(action, { onSuccess: () => toast.success(msg), onError: (e) => toast.error(e.message) });
  const st = membershipState(mb);
  return (
    <li>
      <V2Surface variant="compacto" className="space-y-3 p-4">
        <div className="flex flex-wrap items-start gap-3">
          <V2Avatar name={mb.user_name} photoUrl={mb.photo_url} />
          <div className="min-w-0 flex-1">
            <p className="flex flex-wrap items-center gap-2 font-bold text-ink">{mb.user_name}<MemberStatusBadge status={st.status} label={st.label} />{mb.guardian_uid && <V2Badge tone="neutral">{t('dependente')}</V2Badge>}{mb.is_minor && !mb.guardian_uid && <V2Badge tone="neutral">{t('menor')}</V2Badge>}{mb.imported && <V2Badge tone="neutral">{t('importado')}</V2Badge>}</p>
            <p className="text-xs text-gray-500">
              {t(PLAN_PERSON_TYPE_LABELS[mb.person_type] || PLAN_PERSON_TYPE_LABELS.athlete)} · {t(PLAN_TIER_LABELS[mb.tier] || PLAN_TIER_LABELS.federated)} · {mb.plan_name}
              {mb.member_number ? ` · ${mb.member_number}` : ''}
              {st.validUntil ? ` · ${t('até {data}', { data: quando(st.validUntil) })}` : ''}
              {pedido ? ` · ${t('pedido em {data}', { data: quando(mb.requested_at) })}` : ''}
            </p>
            {mb.note && <p className="mt-1 text-sm text-gray-700">“{mb.note}”</p>}
            {mb.suspended_reason && st.status === MEMBER_STATUS.SUSPENDED && <p className="mt-1 text-sm text-red-600">{t('Motivo: {motivo}', { motivo: mb.suspended_reason })}</p>}
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <V2Button type="button" size="sm" variant="ghost" onClick={() => setFicha(true)}><IdCard className="h-4 w-4" />{t('Ficha')}</V2Button>
          {!pedido && st.status === MEMBER_STATUS.ACTIVE && mb.card_code && <V2Button type="button" size="sm" variant="ghost" onClick={() => setDeclaracao(true)}><FileText className="h-4 w-4" />{t('Declaração')}</V2Button>}
          {pedido && (
            <>
              <V2Button type="button" size="sm" disabled={m.isPending} onClick={() => agir('approve', t('Pedido aprovado. A pessoa foi avisada.'))}><CheckCircle2 className="h-4 w-4" />{t('Aprovar')}</V2Button>
              <V2Button type="button" size="sm" variant="danger" onClick={() => setMotivo('reject')}><XCircle className="h-4 w-4" />{t('Recusar')}</V2Button>
            </>
          )}
          {!pedido && [MEMBER_STATUS.ACTIVE, MEMBER_STATUS.EXPIRED].includes(st.status) && (
            <V2Button type="button" size="sm" variant="danger" onClick={() => setMotivo('suspend')}><Ban className="h-4 w-4" />{t('Suspender')}</V2Button>
          )}
          {!pedido && st.status === MEMBER_STATUS.SUSPENDED && (
            <V2Button type="button" size="sm" variant="secondary" disabled={m.isPending} onClick={() => agir('reinstate', t('Filiação reintegrada.'))}><RotateCcw className="h-4 w-4" />{t('Reintegrar')}</V2Button>
          )}
        </div>
      </V2Surface>
      {motivo && <MotivoDialog acao={motivo} member={mb} federationId={federationId} onClose={() => setMotivo(null)} />}
      {ficha && <FichaDialog member={mb} documentos={documentos} onClose={() => setFicha(false)} />}
      {declaracao && <MembershipDeclarationDialog open onOpenChange={setDeclaracao} member={mb} federation={federation} />}
    </li>
  );
}

const FILTROS = [
  { id: 'todos', label: () => t('Todos') },
  { id: MEMBER_STATUS.ACTIVE, label: () => t('Em dia') },
  { id: 'expiring', label: () => t('Vencendo') },
  { id: MEMBER_STATUS.AWAITING_PAYMENT, label: () => t('Aguardando pagamento') },
  { id: MEMBER_STATUS.EXPIRED, label: () => t('Vencidos') },
  { id: MEMBER_STATUS.SUSPENDED, label: () => t('Suspensos') },
];

export default function FedMembersPanel({ federation, membersQ, documentsQ, tab }) {
  const documentos = documentsQ?.isSuccess ? documentsQ.data : undefined;
  const [filtro, setFiltro] = useState('todos');
  const [busca, setBusca] = useState('');
  const todos = useMemo(() => sortMembersForStaff(membersQ.data || []), [membersQ.data]);
  const contas = useMemo(() => memberCounts(todos), [todos]);
  if (membersQ.isError) return <V2ErrorState title={t('Não carregaram os filiados')} onRetry={() => membersQ.refetch()} />;
  if (membersQ.isLoading) return <V2Skeleton lines={6} />;

  if (tab === 'pedidos') {
    const pedidos = todos.filter((m) => m.status === MEMBER_STATUS.PENDING);
    return (
      <section className="space-y-4" aria-label={t('Pedidos de filiação')} data-dica="federacao-pedidos">
        <div><h2 className="font-display text-xl font-bold text-ink">{t('Pedidos de filiação')}</h2><p className="text-sm text-gray-500">{t('Aprovado, o plano gratuito ativa na hora; o pago gera a cobrança Pix para a pessoa.')}</p></div>
        {!pedidos.length ? <V2EmptyState icon={Inbox} title={t('Nenhum pedido esperando')} description={t('Quando alguém pedir filiação num plano sem aprovação automática, aparece aqui.')} />
          : <ul className="space-y-3">{pedidos.map((m) => <MemberRow key={m.id} member={m} federation={federation} documentos={documentos} pedido />)}</ul>}
      </section>
    );
  }

  const termo = normaliza(busca.trim());
  const lista = todos.filter((m) => m.status !== MEMBER_STATUS.PENDING && ![MEMBER_STATUS.CANCELLED, MEMBER_STATUS.REJECTED].includes(m.status)).filter((m) => {
    const st = membershipState(m);
    if (filtro === 'expiring') return st.expiring;
    if (filtro !== 'todos' && st.status !== filtro) return false;
    return !termo || normaliza(`${m.user_name} ${m.member_number} ${m.plan_name}`).includes(termo);
  });
  return (
    <section className="space-y-4" aria-label={t('Filiados')} data-dica="federacao-filiados">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div><h2 className="font-display text-xl font-bold text-ink">{t('Filiados')}</h2><p className="text-sm text-gray-500">{tn(contas.active, '{n} em dia', '{n} em dia')} · {tn(contas.expiring, '{n} vencendo em 30 dias', '{n} vencendo em 30 dias')} · {tn(contas.expired, '{n} vencido', '{n} vencidos')}</p></div>
        <V2SearchInput value={busca} onChange={(e) => setBusca(e.target.value)} placeholder={t('Nome, número ou plano')} aria-label={t('Buscar filiado')} className="sm:w-72" />
      </div>
      <div className="flex flex-wrap gap-2">{FILTROS.map((f) => <V2FilterChip key={f.id} active={filtro === f.id} onClick={() => setFiltro(f.id)}>{f.label()}</V2FilterChip>)}</div>
      {!lista.length ? <V2EmptyState icon={Users} title={termo ? t('Ninguém com "{termo}"', { termo: busca.trim() }) : t('Nenhum filiado neste filtro')} />
        : <ul className="space-y-3">{lista.map((m) => <MemberRow key={m.id} member={m} federation={federation} documentos={documentos} />)}</ul>}
    </section>
  );
}
