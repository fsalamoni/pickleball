/**
 * Filiados e cadastrados da federação (secretaria, permissão `members`).
 *
 *  - Pedidos: aprovar ou recusar (o servidor decide; a tela só pede).
 *  - Cadastro: uma aba por TIPO (`?tipo=`: Atletas, Professores, Árbitros,
 *    Clubes, Arenas e os tipos criados pelo admin da plataforma), o filtro de
 *    vínculo (`?vinculo=`: filiados × cadastrados) e o de situação
 *    (`?filtro=`; `vencendo` é contrato da faixa "Precisa de você"). Cada
 *    pessoa ou entidade abre a sua PASTA (`?pasta=<id da filiação>`), com
 *    tudo o que é dela aqui: cobranças, comprovantes e recibos, documentos,
 *    cursos, credenciais, pontos, arbitragem, sanções e histórico.
 */
import React, { lazy, Suspense, useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Download, FolderOpen, Inbox, Settings2, Users } from 'lucide-react';
import { useFederationPlatformSettings } from '@/modules/federations/hooks/useFederations';
import { membershipState, memberCounts, sortMembersForStaff } from '@/modules/federations/domain/membership';
import { MEMBER_STATUS, PLAN_TIER_LABELS, FED_PERMISSION } from '@/modules/federations/domain/constants';
import { MEMBER_CATEGORY_LABELS, MEMBER_ENTITY_LABELS, memberTypeName, personTypeLabel } from '@/modules/federations/domain/memberTypes';
import { REGISTRY_ALL, REGISTRY_BOND, REGISTRY_BOND_LABELS, bondCounts, memberBond, plansOfType, registryList, registryTabs } from '@/modules/federations/domain/registry';
import { fedModuleOn } from '@/modules/federations/domain/federation';
import { formatBrlCents } from '@/modules/federations/domain/charges';
import { membersCsv } from '@/modules/federations/domain/exports';
import { V2Avatar, V2Badge, V2Button, V2EmptyState, V2ErrorState, V2FilterChip, V2Skeleton, V2Surface } from '@/v2/ui/primitives';
import { V2SubTabs } from '@/v2/ui/V2SectionNav';
import { t, tn } from '@/core/i18n';
import { MemberStatusBadge, quando } from '../federationUi';
import { DocsStateBadge } from '../FedRegularity';
import { ConvidarPessoas, ConvitesEnviados } from './FedInvites';
import { BuscaLista, MostrarMais, useBuscaLista, useFiltroNaUrl } from './listTools';
import { baixarCsv } from './naoSalvo';
import { MemberActions } from './memberShared';

const FedMemberFolder = lazy(() => import('./FedMemberFolder'));

function MemberRow({ member: mb, federation, pedido = false, onAbrirPasta }) {
  const st = membershipState(mb);
  const nome = mb.org_name || mb.user_name;
  return (
    <li>
      <V2Surface variant="compacto" className="space-y-3 p-4">
        <div className="flex flex-wrap items-start gap-3">
          <V2Avatar name={nome} photoUrl={mb.photo_url} />
          <div className="min-w-0 flex-1">
            <p className="flex flex-wrap items-center gap-2 font-bold text-ink">{nome}<MemberStatusBadge status={st.status} label={st.label} />{mb.guardian_uid && <V2Badge tone="neutral">{t('dependente')}</V2Badge>}{mb.is_minor && !mb.guardian_uid && <V2Badge tone="neutral">{t('menor')}</V2Badge>}{mb.imported && <V2Badge tone="neutral">{t('importado')}</V2Badge>}{mb.docs_state?.state === 'expired' && <DocsStateBadge member={mb} />}{mb.org_kind && <V2Badge tone="blue">{mb.org_kind === 'club' ? t('clube') : t('arena')}</V2Badge>}</p>
            {mb.org_kind && <p className="text-xs text-gray-500">{t('Representante: {nome}', { nome: mb.representative_name || '—' })}{mb.org_city ? ` · ${[mb.org_city, mb.org_state].filter(Boolean).join('/')}` : ''}</p>}
            <p className="text-xs text-gray-500">
              {personTypeLabel(mb)} · {t(PLAN_TIER_LABELS[memberBond(mb)])} · {mb.plan_name}
              {mb.member_number ? ` · ${mb.member_number}` : ''}
              {st.validUntil ? ` · ${t('até {data}', { data: quando(st.validUntil) })}` : ''}
              {pedido ? ` · ${t('pedido em {data}', { data: quando(mb.requested_at) })}` : ''}
            </p>
            {mb.note && <p className="mt-1 text-sm text-gray-700">“{mb.note}”</p>}
            {mb.suspended_reason && st.status === MEMBER_STATUS.SUSPENDED && <p className="mt-1 text-sm text-red-600">{t('Motivo: {motivo}', { motivo: mb.suspended_reason })}</p>}
          </div>
        </div>
        <MemberActions member={mb} federation={federation} pedido={pedido}>
          <V2Button type="button" size="sm" variant="ghost" onClick={() => onAbrirPasta(mb.id)} data-dica="federacao-abrir-pasta"><FolderOpen className="h-4 w-4" />{t('Abrir pasta')}</V2Button>
        </MemberActions>
      </V2Surface>
    </li>
  );
}

/** O tipo aberto: como a plataforma o define e os planos que a federação oferece para ele. */
function TipoConfig({ tipo, plans, plansQ, podePlanos, federation, onIrParaAba }) {
  const type = tipo.type;
  const planos = plansOfType(plans, tipo.id);
  const entidade = type?.entity === 'club' || type?.entity === 'arena';
  return (
    <V2Surface variant="compacto" className="space-y-3 p-4" data-dica="federacao-tipo-config">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="flex flex-wrap items-center gap-2 font-bold text-ink"><Settings2 className="h-4 w-4" aria-hidden="true" />{t('Como funciona: {tipo}', { tipo: memberTypeName(type) })}{type?.active === false && <V2Badge tone="amber">{t('desligado pela plataforma')}</V2Badge>}</p>
          <p className="text-xs text-gray-500">{t(MEMBER_ENTITY_LABELS[type?.entity] || MEMBER_ENTITY_LABELS.person)} · {t('grupo de voto: {grupo}', { grupo: t(MEMBER_CATEGORY_LABELS[type?.category] || MEMBER_CATEGORY_LABELS.none) })}</p>
        </div>
        {podePlanos && onIrParaAba && <V2Button type="button" size="sm" variant="ghost" onClick={() => onIrParaAba('planos')}>{t('Editar os planos')}</V2Button>}
      </div>
      {type?.active === false && <p className="text-sm text-gray-600">{t('A plataforma desligou este tipo: não dá para criar plano novo, mas quem já tem filiação continua aqui.')}</p>}
      {plansQ?.isError ? <p className="text-sm text-gray-500">{t('Os planos não carregaram.')}</p>
        : !plansQ?.isSuccess ? null
          : !planos.length ? <p className="text-sm text-gray-600">{t('Nenhum plano para este tipo. Sem plano, ninguém consegue pedir a filiação dele: crie em Configurações → Planos.')}</p>
            : (
              <ul className="flex flex-wrap gap-2">{planos.map((p) => (
                <li key={p.id} className={`rounded-full border px-3 py-1 text-xs ${p.active === false ? 'border-gray-100 text-gray-500' : 'border-gray-200 text-ink'}`}>
                  {p.name} · {t(PLAN_TIER_LABELS[p.tier] || PLAN_TIER_LABELS.federated)} · {Number(p.price_cents) > 0 ? formatBrlCents(p.price_cents) : t('gratuito')}{p.active === false ? ` · ${t('pausado')}` : ''}
                </li>
              ))}</ul>
            )}
      {entidade && fedModuleOn(federation, 'affiliations') && onIrParaAba && (
        <p className="text-sm text-gray-600">
          {t('Clubes e arenas com vínculo sem plano (só o selo, sem anuidade) ficam em Vínculos de clubes e arenas.')}{' '}
          <button type="button" className="font-semibold text-ink underline underline-offset-2" onClick={() => onIrParaAba('filiados-orgs')}>{t('Abrir')}</button>
        </p>
      )}
    </V2Surface>
  );
}

/** `vencendo` é contrato: a faixa "Precisa de você" abre `?aba=filiados&filtro=vencendo`. */
const FILTROS = [
  { id: 'todos', label: () => t('Todos'), conta: (c) => c.active + c.awaiting_payment + c.expired + c.suspended },
  { id: MEMBER_STATUS.ACTIVE, label: () => t('Em dia'), conta: (c) => c.active },
  { id: 'vencendo', label: () => t('Vencendo'), conta: (c) => c.expiring },
  { id: MEMBER_STATUS.AWAITING_PAYMENT, label: () => t('Aguardando pagamento'), conta: (c) => c.awaiting_payment },
  { id: MEMBER_STATUS.EXPIRED, label: () => t('Vencidos'), conta: (c) => c.expired },
  { id: MEMBER_STATUS.SUSPENDED, label: () => t('Suspensos'), conta: (c) => c.suspended },
];
const VINCULOS = [REGISTRY_BOND.ALL, REGISTRY_BOND.FEDERATED, REGISTRY_BOND.REGISTERED];
const BUSCA = (m) => `${m.org_name || m.user_name} ${m.member_number} ${m.plan_name} ${m.representative_name || ''}`;

/** A pasta aberta mora em `?pasta=`; abrir EMPILHA no histórico (o "voltar" do aparelho volta à lista). */
function usePasta() {
  const [params, setParams] = useSearchParams();
  const pasta = params.get('pasta');
  const abrir = useCallback((id) => {
    setParams((p) => { const n = new URLSearchParams(p); if (id) n.set('pasta', id); else n.delete('pasta'); return n; }, { replace: !id });
  }, [setParams]);
  return [pasta, abrir];
}

export default function FedMembersPanel({ federation, membersQ, documentsQ, plansQ, transfersQ, perms = [], tab, onIrParaAba }) {
  const { catalog } = useFederationPlatformSettings();
  const [pasta, abrirPasta] = usePasta();
  const todos = useMemo(() => sortMembersForStaff(membersQ.data || []), [membersQ.data]);
  const plans = plansQ?.isSuccess ? plansQ.data : [];
  // Só os tipos que a federação USA (tem gente ou plano): tipo sem nenhum dos dois começa criando o plano em Configurações → Planos.
  const abas = useMemo(() => registryTabs(catalog, todos, plans).filter((a) => a.id === REGISTRY_ALL || a.count || a.plans), [catalog, todos, plans]);
  const [tipo, setTipo] = useFiltroNaUrl('tipo', REGISTRY_ALL, abas.map((a) => a.id));
  const [vinculo, setVinculo] = useFiltroNaUrl('vinculo', REGISTRY_BOND.ALL, VINCULOS);
  const [filtro, setFiltro] = useFiltroNaUrl('filtro', 'todos', FILTROS.map((f) => f.id));
  const doTipo = useMemo(() => registryList(todos, { tipo }), [todos, tipo]);
  const vinculos = useMemo(() => bondCounts(doTipo), [doTipo]);
  const doVinculo = useMemo(() => registryList(doTipo, { vinculo }), [doTipo, vinculo]);
  const contas = useMemo(() => memberCounts(doVinculo), [doVinculo]);
  const doFiltro = useMemo(() => doVinculo.filter((m) => {
    const st = membershipState(m);
    if (filtro === 'vencendo') return st.expiring;
    return filtro === 'todos' || st.status === filtro;
  }), [doVinculo, filtro]);
  const busca = useBuscaLista(doFiltro, BUSCA);
  if (membersQ.isError) return <V2ErrorState title={t('Não carregaram os filiados')} onRetry={() => membersQ.refetch()} />;
  if (membersQ.isLoading) return <V2Skeleton lines={6} />;

  if (pasta) {
    const aberto = todos.find((m) => m.id === pasta);
    if (!aberto) {
      return (
        <V2EmptyState icon={FolderOpen} title={t('Esta pasta não está mais na lista')} description={t('A filiação pode ter sido encerrada ou recusada.')}
          action={<V2Button type="button" size="sm" onClick={() => abrirPasta(null)}>{t('Voltar à lista')}</V2Button>} />
      );
    }
    return (
      <Suspense fallback={<V2Skeleton lines={6} />}>
        <FedMemberFolder key={aberto.id} federation={federation} member={aberto} members={todos} documentsQ={documentsQ} transfersQ={transfersQ} perms={perms} onIrParaAba={onIrParaAba} onAbrirPasta={abrirPasta} />
      </Suspense>
    );
  }

  if (tab === 'pedidos') {
    const pedidos = todos.filter((m) => m.status === MEMBER_STATUS.PENDING);
    return (
      <section className="space-y-4" aria-label={t('Pedidos de filiação')} data-dica="federacao-pedidos">
        <div><h2 className="font-display text-xl font-bold text-ink">{t('Pedidos de filiação')}</h2><p className="text-sm text-gray-500">{t('Aprovado, o plano gratuito ativa na hora; o pago gera a cobrança Pix para a pessoa.')}</p></div>
        {!pedidos.length ? <V2EmptyState icon={Inbox} title={t('Nenhum pedido esperando')} description={t('Quando alguém pedir filiação num plano sem aprovação automática, aparece aqui.')} />
          : <ul className="space-y-3">{pedidos.map((m) => <MemberRow key={m.id} member={m} federation={federation} pedido onAbrirPasta={abrirPasta} />)}</ul>}
        <ConvitesEnviados federation={federation} />
      </section>
    );
  }

  const termo = busca.termo.trim();
  const abaTipo = abas.find((a) => a.id === tipo) || abas[0];
  const nomeTipo = abaTipo.type ? memberTypeName(abaTipo.type) : '';
  return (
    <section className="space-y-4" aria-label={t('Filiados e cadastrados')} data-dica="federacao-filiados">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="font-display text-xl font-bold text-ink">{t('Filiados e cadastrados')}</h2>
          <p className="text-sm text-gray-500">{tn(vinculos.federated, '{n} filiado', '{n} filiados')} · {tn(vinculos.registered, '{n} cadastrado', '{n} cadastrados')} · {tn(contas.expiring, '{n} vencendo em 30 dias', '{n} vencendo em 30 dias')}</p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
          {busca.filtrados.length > 0 && <V2Button type="button" size="sm" variant="secondary" data-dica="federacao-filiados-csv" onClick={() => baixarCsv(membersCsv(busca.filtrados, { catalog }), `filiados-${(federation.acronym || 'federacao').toLowerCase()}.csv`)}><Download className="h-4 w-4" />{t('Baixar planilha (CSV)')}</V2Button>}
          <BuscaLista id="fed-filiados-busca" value={busca.termo} onChange={busca.setTermo} placeholder={t('Buscar por nome, número ou plano')} total={doFiltro.length} achados={busca.filtrados.length} className="sm:w-72" />
        </div>
      </div>
      <V2SubTabs ariaLabel={t('Tipos de filiação')} dica="federacao-tipos" tabs={abas.map((a) => ({ value: a.id, label: `${a.id === REGISTRY_ALL ? t('Todos') : memberTypeName(a.type)} (${a.count})` }))} activeValue={abaTipo.id} onSelect={(x) => setTipo(x.value)} />
      {abaTipo.id !== REGISTRY_ALL && <TipoConfig tipo={abaTipo} plans={plans} plansQ={plansQ} podePlanos={perms.includes(FED_PERMISSION.ADMIN)} federation={federation} onIrParaAba={onIrParaAba} />}
      {abaTipo.id === REGISTRY_ALL && <ConvidarPessoas federation={federation} membros={todos} plansQ={plansQ} />}
      <div className="flex flex-wrap gap-2" role="group" aria-label={t('Vínculo')} data-dica="federacao-vinculo">
        {VINCULOS.map((v) => <V2FilterChip key={v} active={vinculo === v} onClick={() => setVinculo(v)}>{`${t(REGISTRY_BOND_LABELS[v])} (${vinculos[v]})`}</V2FilterChip>)}
      </div>
      <div className="flex flex-wrap gap-2" role="group" aria-label={t('Situação')}>{FILTROS.map((f) => <V2FilterChip key={f.id} active={filtro === f.id} onClick={() => setFiltro(f.id)}>{`${f.label()} (${f.conta(contas)})`}</V2FilterChip>)}</div>
      {!busca.filtrados.length ? (
        <V2EmptyState
          icon={Users}
          title={termo ? t('Ninguém com "{termo}"', { termo }) : nomeTipo ? t('Nenhum cadastro em {tipo} neste filtro', { tipo: nomeTipo }) : t('Nenhum filiado neste filtro')}
          description={termo ? t('Confira a grafia ou limpe a busca.') : filtro === 'todos' && vinculo === REGISTRY_BOND.ALL ? t('Convide pessoas em "Todos" ou importe uma planilha em Importar.') : t('Veja os demais no filtro "Todos".')}
        />
      ) : (
        <>
          <ul className="space-y-3">{busca.visiveis.map((m) => <MemberRow key={m.id} member={m} federation={federation} onAbrirPasta={abrirPasta} />)}</ul>
          <MostrarMais restam={busca.restam} onClick={busca.mostrarMais} />
        </>
      )}
    </section>
  );
}

