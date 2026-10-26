/**
 * O CLUBE ou a ARENA se filia por plano (`/federacoes/:id/filiar?entidade=club:ID`,
 * Etapa 2 do cadastro estruturado). Quem gere a entidade escolhe um dos planos
 * da federação para clubes (ou arenas), diz o cargo com que responde, envia os
 * documentos do plano e aceita os termos; o SERVIDOR confere que a pessoa gere
 * a entidade e cria `federation_members/{fed}_{kind}_{org}`.
 *
 * Com a filiação já existindo, a tela vira a situação dela: pedido, Pix (a
 * cobrança vai para quem pediu, o representante), documentos, certificado,
 * renovação e cancelamento — a mesma régua da pessoa, pelo id da filiação.
 * Outro gestor da entidade pode passar a representá-la (`represent`): as
 * cobranças em aberto e os avisos vão para ele.
 */
import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import { Building2, Check, IdCard } from 'lucide-react';
import { useAuth } from '@/core/lib/FirebaseAuthContext';
import { useMyClubs } from '@/modules/clubs/hooks/useClubs';
import { useMyManagedArenas } from '@/modules/arenas/hooks/useArenas';
import { useFederationMutation, useOrgMemberships } from '@/modules/federations/hooks/useFederations';
import { membershipAction, uploadChosenDocuments } from '@/modules/federations/services/federationService';
import { canRequestMembership, membershipState, renewalOpensOn } from '@/modules/federations/domain/membership';
import { isFreePlan, planBenefitLines, planPeriodLabel } from '@/modules/federations/domain/plans';
import { formatBrlCents } from '@/modules/federations/domain/charges';
import { docLabel, requiredDocs } from '@/modules/federations/domain/privateData';
import { personTypeLabel } from '@/modules/federations/domain/memberTypes';
import { CHARGE_STATUS, MEMBER_STATUS, PLAN_TIER_LABELS, RENEWAL_WINDOW_DAYS } from '@/modules/federations/domain/constants';
import { V2Button, V2EmptyState, V2ErrorState, V2Field, V2Input, V2Skeleton, V2Surface, V2Textarea } from '@/v2/ui/primitives';
import { cn } from '@/core/lib/utils';
import { safeHttpUrl } from '@/core/domain/externalUrl';
import { t, tn } from '@/core/i18n';
import { MemberStatusBadge, quando } from './federationUi';
import PixChargeBlock from './PixChargeBlock';
import MemberCardDialog from './MemberCard';
import { FedCancelMembership, FedMemberDocuments } from './FedMemberExtras';
import DocumentsUploadList from './DocumentsUploadList';

const ABERTAS = [CHARGE_STATUS.OPEN, CHARGE_STATUS.DECLARED];
/** De volta para onde a entidade é gerida (a aba "Federação"). */
const gestaoDa = (kind, orgId) => (kind === 'club' ? `/clubes/${orgId}/gerir?aba=pagina` : `/arenas/${orgId}/gerir?aba=federacao`);

function Situacao({ federation, plans, member, charges, kind, orgId }) {
  const { user } = useAuth();
  const [cartao, setCartao] = useState(false);
  const renovar = useFederationMutation(() => membershipAction({ federationId: federation.id, action: 'renew', memberId: member.id }));
  const st = membershipState(member);
  const plano = (plans || []).find((p) => p.id === member.plan_id) || null;
  const abertas = (charges || []).filter((c) => c.member_id === member.id && ABERTAS.includes(c.status));
  const representante = (member.representatives || []).find((r) => r.uid === member.representative_uid) || {};
  return (
    <V2Surface className="space-y-4" data-dica="federacao-filiar-entidade-situacao">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-display text-xl font-bold text-ink">{member.org_name || member.user_name}</h2>
          <p className="text-sm text-gray-600">{[member.plan_name, member.member_number ? t('nº {numero}', { numero: member.member_number }) : '', st.validUntil ? t('válida até {data}', { data: quando(st.validUntil) }) : ''].filter(Boolean).join(' · ')}</p>
        </div>
        <MemberStatusBadge status={st.status} label={st.label} />
      </div>
      <p className="text-sm text-gray-600">
        {t('Representante: {nome}', { nome: member.representative_name || '—' })}{representante.role ? ` · ${representante.role}` : ''}
      </p>
      {st.status === MEMBER_STATUS.PENDING && <p className="text-sm text-gray-600">{t('A secretaria da federação analisa o pedido e avisa pelo sino.')}</p>}
      {st.status === MEMBER_STATUS.SUSPENDED && <p className="text-sm text-red-600">{t('Filiação suspensa{motivo}.', { motivo: member.suspended_reason ? `: ${member.suspended_reason}` : '' })}</p>}
      {abertas.map((c) => <PixChargeBlock key={c.id} charge={c} federation={federation} />)}
      {/* A cobrança é de quem pediu: outro gestor vê a situação, não o Pix. */}
      {member.status === MEMBER_STATUS.AWAITING_PAYMENT && member.representative_uid !== user?.uid && (
        <p className="text-sm text-gray-600">{t('A cobrança foi para {nome}, que pediu a filiação. Quando ela for paga e confirmada, a filiação fica ativa.', { nome: member.representative_name || t('o representante') })}</p>
      )}
      {member.representative_uid !== user?.uid && <Representar federation={federation} member={member} />}
      <div className="flex flex-wrap gap-2">
        {[MEMBER_STATUS.ACTIVE, MEMBER_STATUS.EXPIRED].includes(st.status) && member.card_code && (
          <V2Button type="button" onClick={() => setCartao(true)}><IdCard className="h-4 w-4" />{t('Certificado de filiação')}</V2Button>
        )}
        {st.canRenew && abertas.length === 0 && (
          <V2Button type="button" variant="secondary" disabled={renovar.isPending} onClick={() => renovar.mutate(undefined, { onSuccess: () => toast.success(t('Renovação pedida. Pague a cobrança para seguir em dia.')), onError: (e) => toast.error(e.message) })}>
            {st.status === MEMBER_STATUS.EXPIRED ? t('Renovar a filiação') : t('Renovar antes de vencer')}
          </V2Button>
        )}
        <FedCancelMembership member={member} className="text-red-700" />
      </div>
      {renewalOpensOn(member) && <p className="text-sm text-gray-500">{t('A renovação abre em {data}, {n} dias antes de vencer. Você recebe um aviso.', { data: quando(renewalOpensOn(member)), n: RENEWAL_WINDOW_DAYS })}</p>}
      <FedMemberDocuments member={member} plan={plano} />
      <V2Button asChild variant="ghost" size="sm"><Link to={gestaoDa(kind, orgId)}>{kind === 'club' ? t('Voltar à gestão do clube') : t('Voltar à Central da arena')}</Link></V2Button>
      {cartao && <MemberCardDialog open onOpenChange={setCartao} member={member} federation={federation} plan={plano} />}
    </V2Surface>
  );
}

/** Outro gestor assume a representação (o representante saiu ou mudou de cargo). */
function Representar({ federation, member }) {
  const [aberto, setAberto] = useState(false);
  const [cargo, setCargo] = useState('');
  const m = useFederationMutation(() => membershipAction({ federationId: federation.id, action: 'represent', memberId: member.id, representativeRole: cargo.trim() }));
  if (!aberto) {
    return <V2Button type="button" size="sm" variant="secondary" onClick={() => setAberto(true)}>{t('Passar a representar a entidade')}</V2Button>;
  }
  const enviar = (e) => {
    e.preventDefault();
    if (cargo.trim().length < 2) { toast.error(t('Diga o seu cargo na entidade (ex.: presidente, diretor, sócio-gerente).')); return; }
    m.mutate(undefined, { onSuccess: () => { toast.success(t('Agora você representa a entidade nesta filiação.')); setAberto(false); }, onError: (err) => toast.error(err.message) });
  };
  return (
    <form onSubmit={enviar} className="space-y-3 rounded-2xl border border-gray-100 p-3">
      <p className="text-sm text-gray-600">{t('As cobranças em aberto e os avisos da filiação passam a vir para você. {nome} recebe um aviso.', { nome: member.representative_name || t('O representante atual') })}</p>
      <V2Field label={t('Seu cargo na entidade')} htmlFor="om-rep-cargo">
        <V2Input id="om-rep-cargo" value={cargo} maxLength={60} onChange={(e) => setCargo(e.target.value)} placeholder={t('Ex.: presidente')} />
      </V2Field>
      <div className="flex flex-wrap gap-2">
        <V2Button type="submit" size="sm" disabled={m.isPending}>{t('Representar')}</V2Button>
        <V2Button type="button" size="sm" variant="ghost" onClick={() => setAberto(false)}>{t('Cancelar')}</V2Button>
      </div>
    </form>
  );
}

function Formulario({ federation, plans, kind, org, onEnviado }) {
  const { user } = useAuth();
  const candidatos = (plans || []).filter((p) => p.active !== false && p.entity === kind);
  const [planId, setPlanId] = useState(candidatos.length === 1 ? candidatos[0].id : '');
  const [cargo, setCargo] = useState('');
  const [nota, setNota] = useState('');
  const [termos, setTermos] = useState(false);
  const [arquivos, setArquivos] = useState({});
  const [enviandoDocs, setEnviandoDocs] = useState(false);
  const [erro, setErro] = useState('');
  const m = useFederationMutation((payload) => membershipAction(payload));
  const plano = candidatos.find((p) => p.id === planId) || null;
  const docs = requiredDocs(plano);
  const estatuto = safeHttpUrl(federation?.governance?.statute_url);
  const pagaDepois = Boolean(plano && !isFreePlan(plano) && !plano.auto_approve);

  if (!candidatos.length) {
    return <V2EmptyState icon={Building2} title={kind === 'club' ? t('Esta federação não tem plano para clubes') : t('Esta federação não tem plano para arenas')} description={t('Fale com a secretaria da federação ou peça a filiação simples pela gestão da entidade.')} />;
  }

  const enviar = (e) => {
    e.preventDefault();
    if (!plano) { setErro(t('Escolha um plano.')); return; }
    if (cargo.trim().length < 2) { setErro(t('Diga o seu cargo na entidade (ex.: presidente, diretor, sócio-gerente).')); return; }
    if (!termos) { setErro(t('Para se filiar é preciso aceitar os termos.')); return; }
    setErro('');
    m.mutate({ federationId: federation.id, action: 'request', planId: plano.id, org: { kind, id: org.id }, representativeRole: cargo.trim(), note: nota, publicBadge: true, showInDirectory: false }, {
      onSuccess: async (r) => {
        toast.success(t('Pedido de filiação enviado.'));
        if (r?.memberId && docs.some((d) => arquivos[d.key])) {
          setEnviandoDocs(true);
          const up = await uploadChosenDocuments({ docs, arquivos, member: { id: r.memberId, federation_id: federation.id, org_kind: kind, org_id: org.id }, uid: user?.uid });
          setEnviandoDocs(false);
          if (up.falhas.length) toast.error(t('Não deu para enviar: {lista}. Envie depois nesta mesma tela.', { lista: up.falhas.join(', ') }), { duration: 12000 });
          else toast.success(tn(up.total, 'Documento enviado. A secretaria confere.', '{n} documentos enviados. A secretaria confere.'));
        }
        onEnviado?.();
      },
      onError: (er) => { setErro(er.message); toast.error(er.message); },
    });
  };

  return (
    <form onSubmit={enviar} noValidate className="space-y-6" data-dica="federacao-filiar-entidade">
      <V2Surface className="space-y-4">
        <h2 className="font-display text-lg font-bold text-ink">{t('1. O plano')}</h2>
        <ul className="grid gap-3 sm:grid-cols-2" role="radiogroup" aria-label={t('Planos')}>
          {candidatos.map((p) => {
            const ativo = p.id === planId;
            return (
              <li key={p.id}>
                <button type="button"
                  role="radio"
                  aria-checked={ativo}
                  onClick={() => { setPlanId(p.id); setErro(''); }}
                  className={cn('flex h-full w-full flex-col rounded-3xl border-2 p-4 text-left transition-colors focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-acid/30', ativo ? 'border-ink bg-paper-pure' : 'border-gray-100 bg-paper-pure hover:border-gray-200')}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-display text-lg font-bold text-ink">{p.name}</p>
                      <p className="text-xs uppercase tracking-widest text-gray-500">{personTypeLabel(p)} · {t(PLAN_TIER_LABELS[p.tier] || PLAN_TIER_LABELS.federated)}</p>
                    </div>
                    {ativo && <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-ink text-acid"><Check className="h-4 w-4" aria-hidden="true" /></span>}
                  </div>
                  <p className="mt-2">
                    <span className="font-display text-xl font-bold text-ink">{isFreePlan(p) ? t('Grátis') : formatBrlCents(p.price_cents)}</span>
                    {!isFreePlan(p) && <span className="ml-1 text-xs text-gray-500">{planPeriodLabel(p)}</span>}
                  </p>
                  {p.description && <p className="mt-2 text-sm text-gray-600">{p.description}</p>}
                  {planBenefitLines(p).length > 0 && <ul className="mt-2 space-y-1 text-sm text-gray-700">{planBenefitLines(p).map((b) => <li key={b} className="flex gap-2"><span aria-hidden="true">•</span>{b}</li>)}</ul>}
                  {requiredDocs(p).length > 0 && <p className="mt-2 text-xs text-gray-500">{t('Exige documentos: {lista}', { lista: requiredDocs(p).map(docLabel).join(', ') })}</p>}
                </button>
              </li>
            );
          })}
        </ul>
      </V2Surface>

      {docs.length > 0 && (
        <DocumentsUploadList
          docs={docs}
          arquivos={arquivos}
          onChange={setArquivos}
          titulo={t('Documentos da entidade')}
          descricao={t('PDF ou imagem, até 5 MB cada. Os gestores da entidade e a secretaria da federação veem a lista. O que faltar agora dá para enviar depois, nesta mesma tela.')}
        />
      )}

      <V2Surface className="space-y-4">
        <h2 className="font-display text-lg font-bold text-ink">{t('2. Quem responde pela entidade')}</h2>
        <p className="text-sm text-gray-600">{t('Você fica como representante: recebe os avisos e a cobrança da filiação. Os outros gestores veem a situação.')}</p>
        <V2Field label={t('Seu cargo na entidade')} htmlFor="fo-cargo" required hint={t('Ex.: presidente, diretor, sócio-gerente.')}>
          <V2Input id="fo-cargo" maxLength={60} value={cargo} onChange={(e) => { setCargo(e.target.value); setErro(''); }} className="sm:max-w-sm" />
        </V2Field>
        <V2Field label={t('Observação para a secretaria')} htmlFor="fo-nota">
          <V2Textarea id="fo-nota" rows={2} maxLength={300} value={nota} onChange={(e) => setNota(e.target.value)} />
        </V2Field>
        <label htmlFor="fo-termos" className="flex items-start gap-3 text-sm text-gray-700">
          <input id="fo-termos" type="checkbox" className="mt-1 h-5 w-5 accent-ink" checked={termos} onChange={(e) => setTermos(e.target.checked)} />
          <span>{t('Li e aceito os')} <Link to="/legal/termos-filiacao" target="_blank" rel="noopener noreferrer" className="font-bold text-ink underline">{t('Termos de Filiação')}</Link>{' '}{t('e o')}{' '}{estatuto ? <a href={estatuto} target="_blank" rel="noopener noreferrer nofollow" className="font-bold text-ink underline">{t('estatuto da federação')}</a> : t('estatuto da federação')}{' '}{t('em nome da entidade, e declaro que posso representá-la.')}</span>
        </label>
        {erro && <p role="alert" className="text-sm font-medium text-red-600">{erro}</p>}
      </V2Surface>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm text-gray-600">{plano ? (isFreePlan(plano) ? t('Plano gratuito') : t('Total: {valor} {periodo}', { valor: formatBrlCents(plano.price_cents), periodo: planPeriodLabel(plano) })) : t('Escolha um plano')}</p>
          {pagaDepois && <p className="text-xs text-gray-500">{t('Você paga depois que a secretaria aprovar.')}</p>}
        </div>
        <V2Button type="submit" disabled={m.isPending || enviandoDocs || !plano}>{enviandoDocs ? t('Enviando os documentos…') : m.isPending ? t('Enviando…') : plano && !isFreePlan(plano) && !pagaDepois ? t('Pedir filiação e gerar o Pix') : t('Pedir filiação')}</V2Button>
      </div>
    </form>
  );
}

export default function OrgMembershipJoin({ federation, plans, kind, orgId, charges }) {
  const clubes = useMyClubs({ enabled: kind === 'club' });
  const arenas = useMyManagedArenas();
  const fq = useOrgMemberships(kind, orgId);
  const lista = kind === 'club' ? clubes : arenas;
  if (lista.isError || fq.isError) return <V2ErrorState onRetry={() => [lista, fq].filter((q) => q.isError).forEach((q) => q.refetch())} />;
  if (!lista.isSuccess || !fq.isSuccess) return <V2Skeleton className="h-96" />;
  const org = kind === 'club'
    ? (lista.data || []).find((c) => c.id === orgId && c.my_role === 'admin')
    : (lista.data || []).find((a) => a.id === orgId);
  if (!org) {
    return <V2EmptyState icon={Building2} title={kind === 'club' ? t('Só quem administra o clube pede a filiação dele') : t('Só quem gere a arena pede a filiação dela')} description={t('Peça a um dos gestores da entidade.')} />;
  }
  const atual = (fq.data || []).find((x) => x.federation_id === federation.id);
  if (atual && !canRequestMembership(atual)) return <Situacao federation={federation} plans={plans} member={atual} charges={charges} kind={kind} orgId={orgId} />;
  return (
    <div className="space-y-4">
      <V2Surface variant="compacto" className="flex items-center gap-3 p-4">
        <Building2 className="h-5 w-5 text-ink" aria-hidden="true" />
        <p className="text-sm text-gray-700">{kind === 'club' ? t('Filiando o clube {nome}', { nome: org.name }) : t('Filiando a arena {nome}', { nome: org.name })}</p>
      </V2Surface>
      <Formulario federation={federation} plans={plans} kind={kind} org={org} onEnviado={() => fq.refetch()} />
    </div>
  );
}
