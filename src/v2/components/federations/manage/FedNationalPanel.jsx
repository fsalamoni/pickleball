/**
 * CAMADA NACIONAL na Central (Bloco 6, `docs/50` §35).
 *
 * Na CONFEDERAÇÃO, seção "Rede nacional":
 *  - `rede-filiadas`: pedidos para aceitar, convites enviados, as filiadas e o
 *    histórico; o admin convida, aceita, recusa e desliga (com motivo);
 *  - `rede-homologacoes`: as transferências entre estados que a confederação
 *    homologa ou nega (secretaria ou admin);
 *  - `rede-anuidades`: lançar o ano, confirmar o recebimento, reabrir ou
 *    dispensar (financeiro ou admin; o conselho fiscal lê);
 *  - `rede-regras`: homologação e valor da anuidade (admin).
 *
 * Na ESTADUAL, seção "Confederação":
 *  - `confederacao`: pedir filiação, responder convite, cancelar, desfiliar;
 *  - `confederacao-anuidades`: declarar o pagamento da anuidade.
 *
 * Tudo o que muda passa pelo servidor (`federationNational`); a tela só lê o
 * que a regra deixa e repete a validação antes.
 */
import React, { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { ArrowLeftRight, CheckCircle2, Landmark, Network, Receipt, Send, XCircle } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { usePublicFederations } from '@/modules/federations/hooks/useFederations';
import { useConfederationLinks, useDuesOwed, useDuesReceivable, useHomologationAction, useHomologations, useMyNationalLinks, useNationalAction } from '@/modules/federations/hooks/useNational';
import {
  DUES_STATUS, DUES_STATUS_LABELS, LINK_OPEN, LINK_STATUS, LINK_STATUS_LABELS, canHomologate, canManageDues, canManageNetwork,
  canOpenLink, duesAmount, duesState, isConfederation, nationalBodyOf, normalizeNationalConfig, validateNationalConfig,
} from '@/modules/federations/domain/national';
import { TRANSFER_STATUS, TRANSFER_STATUS_LABELS, TRANSFER_STATUS_TONE } from '@/modules/federations/domain/constants';
import { formatBrlCents, parseBrlCents } from '@/modules/federations/domain/charges';
import { isoDate } from '@/modules/federations/domain/membership';
import { V2Badge, V2Button, V2EmptyState, V2ErrorState, V2Field, V2Input, V2Select, V2Skeleton, V2Surface, V2Textarea, V2Toggle } from '@/v2/ui/primitives';
import { t } from '@/core/i18n';
import { quando } from '../federationUi';
import CupManager from '../hosting/CupManager';
import CupTeamEntry from '../hosting/CupTeamEntry';

const dataBR = (iso) => (iso ? String(iso).split('-').reverse().join('/') : '—');
const sigla = (x, campo = 'federation') => x?.[`${campo}_acronym`] || x?.[`${campo}_name`] || '';
const TOM_VINCULO = { pending: 'amber', invited: 'amber', approved: 'green', rejected: 'red', removed: 'red', left: 'neutral', cancelled: 'neutral' };
const TOM_ANUIDADE = { open: 'amber', overdue: 'red', declared: 'blue', paid: 'green', waived: 'neutral' };
const avisar = (msg) => ({ onSuccess: () => toast.success(msg), onError: (e) => toast.error(e.message) });

function Titulo({ titulo, texto }) {
  return <div><h2 className="font-display text-xl font-bold text-ink">{titulo}</h2>{texto && <p className="text-sm text-gray-500">{texto}</p>}</div>;
}

function Carregando({ q, titulo }) {
  if (q.isError) return <V2ErrorState title={titulo} onRetry={() => q.refetch()} />;
  return <V2Skeleton lines={5} />;
}

/** Pede o motivo (sair, desligar, negar, reabrir, dispensar). */
function MotivoDialog({ titulo, descricao, rotulo, pendente, onClose, onConfirmar, extra = null }) {
  const [motivo, setMotivo] = useState('');
  const [erro, setErro] = useState('');
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent sheet className="max-w-md">
        <DialogTitle>{titulo}</DialogTitle>
        <DialogDescription>{descricao}</DialogDescription>
        <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); if (motivo.trim().length < 3) { setErro(t('Diga o motivo (mínimo 3 caracteres).')); return; } onConfirmar(motivo.trim()); }}>
          {extra}
          <V2Field label={t('Motivo')} htmlFor="fed-nacional-motivo" error={erro}><V2Textarea id="fed-nacional-motivo" rows={3} maxLength={500} value={motivo} onChange={(e) => { setMotivo(e.target.value); setErro(''); }} autoFocus /></V2Field>
          <div className="flex justify-end gap-2"><V2Button type="button" variant="ghost" onClick={onClose}>{t('Voltar')}</V2Button><V2Button type="submit" variant="danger" disabled={pendente}>{rotulo}</V2Button></div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function Historico({ itens, render }) {
  const [aberto, setAberto] = useState(false);
  if (!itens.length) return null;
  return (
    <div className="space-y-2">
      <V2Button type="button" variant="ghost" size="sm" onClick={() => setAberto((x) => !x)} aria-expanded={aberto}>{aberto ? t('Esconder o histórico') : t('Ver o histórico ({n})', { n: itens.length })}</V2Button>
      {aberto && <ul className="space-y-2">{itens.map(render)}</ul>}
    </div>
  );
}

/* ================================================== confederação: filiadas == */

function LinhaVinculo({ link, federation, podeGerir }) {
  const m = useNationalAction(federation.id);
  const [motivo, setMotivo] = useState(null);
  const agir = (action, reason, msg) => m.mutate({ action, linkId: link.id, reason }, { ...avisar(msg), onSettled: () => setMotivo(null) });
  return (
    <li>
      <V2Surface variant="compacto" className="flex flex-wrap items-start justify-between gap-3 p-4">
        <div className="min-w-0">
          <p className="flex flex-wrap items-center gap-2 font-bold text-ink">{link.federation_name}{link.federation_state ? ` · ${link.federation_state}` : ''}<V2Badge tone={TOM_VINCULO[link.status] || 'neutral'}>{t(LINK_STATUS_LABELS[link.status] || link.status)}</V2Badge></p>
          <p className="text-xs text-gray-500">
            {link.status === LINK_STATUS.APPROVED && link.since_ms ? t('filiada desde {data}', { data: quando(link.since_ms) }) : t('atualizado em {data}', { data: quando(link.updated_at_ms) })}
          </p>
          {link.message && LINK_OPEN.includes(link.status) && <p className="mt-1 text-sm text-gray-700">“{link.message}”</p>}
          {link.reason && <p className="mt-1 text-sm text-gray-600">{t('Motivo: {motivo}', { motivo: link.reason })}</p>}
        </div>
        {podeGerir && (
          <div className="flex flex-wrap gap-2">
            {link.status === LINK_STATUS.PENDING && <>
              <V2Button type="button" size="sm" disabled={m.isPending} onClick={() => agir('link_accept', '', t('Federação filiada à confederação.'))}><CheckCircle2 className="h-4 w-4" />{t('Aceitar')}</V2Button>
              <V2Button type="button" size="sm" variant="danger" disabled={m.isPending} onClick={() => agir('link_reject', '', t('Pedido recusado.'))}><XCircle className="h-4 w-4" />{t('Recusar')}</V2Button>
            </>}
            {link.status === LINK_STATUS.INVITED && <V2Button type="button" size="sm" variant="ghost" disabled={m.isPending} onClick={() => agir('link_cancel', '', t('Convite cancelado.'))}>{t('Cancelar o convite')}</V2Button>}
            {link.status === LINK_STATUS.APPROVED && <V2Button type="button" size="sm" variant="ghost" onClick={() => setMotivo('remove')}>{t('Desligar')}</V2Button>}
          </div>
        )}
      </V2Surface>
      {motivo && (
        <MotivoDialog titulo={t('Desligar a {sigla}?', { sigla: sigla(link) })} rotulo={t('Desligar')} pendente={m.isPending} onClose={() => setMotivo(null)}
          descricao={t('A federação deixa de ser filiada e os pontos dela saem do ranking nacional do ano em curso (os anos fechados não mudam). Ela lê o motivo.')}
          onConfirmar={(reason) => agir('link_remove', reason, t('Federação desligada.'))} />
      )}
    </li>
  );
}

function ConvidarFederacao({ federation, links }) {
  const pubQ = usePublicFederations();
  const m = useNationalAction(federation.id);
  const [alvo, setAlvo] = useState('');
  const [mensagem, setMensagem] = useState('');
  const ocupadas = useMemo(() => new Set(links.filter((l) => l.status === LINK_STATUS.APPROVED || LINK_OPEN.includes(l.status)).map((l) => l.federation_id)), [links]);
  const opcoes = useMemo(() => (pubQ.data || []).filter((x) => !ocupadas.has(x.id) && !canOpenLink(x, federation).error)
    .sort((a, b) => String(a.state || a.name).localeCompare(String(b.state || b.name), 'pt-BR')), [pubQ.data, ocupadas, federation]);
  if (pubQ.isError) return <V2ErrorState inline title={t('Não carregou a lista de federações para convidar')} onRetry={() => pubQ.refetch()} />;
  if (pubQ.isLoading) return null;
  return (
    <V2Surface variant="compacto" className="space-y-3 p-4">
      <p className="font-semibold text-ink">{t('Convidar uma federação')}</p>
      {opcoes.length === 0 ? <p className="text-sm text-gray-500">{t('Nenhuma federação publicada está livre para convidar. Só entram as aprovadas e públicas que não são filiadas a outra confederação.')}</p> : (
        <form className="grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end" onSubmit={(e) => { e.preventDefault(); if (!alvo) return; m.mutate({ action: 'link_invite', targetId: alvo, message: mensagem }, { onSuccess: () => { toast.success(t('Convite enviado. A administração da federação foi avisada.')); setAlvo(''); setMensagem(''); }, onError: (er) => toast.error(er.message) }); }}>
          <V2Field label={t('Federação')} htmlFor="fed-convidar-alvo"><V2Select id="fed-convidar-alvo" value={alvo} onChange={(e) => setAlvo(e.target.value)}><option value="">{t('Escolha')}</option>{opcoes.map((x) => <option key={x.id} value={x.id}>{x.acronym ? `${x.acronym} · ${x.name}` : x.name}</option>)}</V2Select></V2Field>
          <V2Field label={t('Mensagem (opcional)')} htmlFor="fed-convidar-msg"><V2Input id="fed-convidar-msg" maxLength={500} value={mensagem} onChange={(e) => setMensagem(e.target.value)} /></V2Field>
          <V2Button type="submit" disabled={!alvo || m.isPending}><Send className="h-4 w-4" />{t('Convidar')}</V2Button>
        </form>
      )}
    </V2Surface>
  );
}

function FiliadasTab({ federation, perms }) {
  const q = useConfederationLinks(federation.id);
  const podeGerir = canManageNetwork(perms);
  if (!q.isSuccess) return <Carregando q={q} titulo={t('Não carregaram as federações filiadas')} />;
  const links = q.data || [];
  const pedidos = links.filter((l) => l.status === LINK_STATUS.PENDING);
  const convites = links.filter((l) => l.status === LINK_STATUS.INVITED);
  const filiadas = links.filter((l) => l.status === LINK_STATUS.APPROVED);
  const antigos = links.filter((l) => !LINK_OPEN.includes(l.status) && l.status !== LINK_STATUS.APPROVED);
  const linha = (l) => <LinhaVinculo key={l.id} link={l} federation={federation} podeGerir={podeGerir} />;
  return (
    <section className="space-y-4" aria-label={t('Federações filiadas')} data-dica="federacao-aba-rede-filiadas">
      <Titulo titulo={t('Federações filiadas')} texto={t('As federações estaduais filiadas à {sigla}. Os pontos que elas lançam somam no ranking nacional, e cada uma paga a anuidade da rede.', { sigla: federation.acronym || federation.name })} />
      {podeGerir && <ConvidarFederacao federation={federation} links={links} />}
      {pedidos.length > 0 && <div className="space-y-2"><p className="text-sm font-bold text-ink">{t('Pedidos para responder')}</p><ul className="space-y-2">{pedidos.map(linha)}</ul></div>}
      {convites.length > 0 && <div className="space-y-2"><p className="text-sm font-bold text-ink">{t('Convites enviados')}</p><ul className="space-y-2">{convites.map(linha)}</ul></div>}
      {filiadas.length ? <div className="space-y-2"><p className="text-sm font-bold text-ink">{t('Filiadas ({n})', { n: filiadas.length })}</p><ul className="space-y-2">{filiadas.map(linha)}</ul></div>
        : !pedidos.length && !convites.length && <V2EmptyState icon={Network} title={t('Nenhuma federação filiada ainda')} description={podeGerir ? t('Convide as federações estaduais acima, ou espere o pedido delas.') : t('Quem convida e aceita é a administração da confederação.')} />}
      <Historico itens={antigos} render={linha} />
    </section>
  );
}

/* ============================================== confederação: homologação == */

function LinhaHomologacao({ tr, podeDecidir }) {
  const m = useHomologationAction();
  const [confirmar, setConfirmar] = useState(false);
  const [negando, setNegando] = useState(false);
  const aberta = tr.status === TRANSFER_STATUS.HOMOLOGATION;
  return (
    <li>
      <V2Surface variant="compacto" className="space-y-2 p-4">
        <p className="flex flex-wrap items-center gap-2 font-bold text-ink">{tr.user_name}<V2Badge tone={TRANSFER_STATUS_TONE[tr.status] || 'neutral'}>{t(TRANSFER_STATUS_LABELS[tr.status] || tr.status)}</V2Badge></p>
        <p className="text-xs text-gray-500">
          {t('{de} → {para}', { de: tr.federation_acronym || '—', para: tr.to_federation_acronym || tr.to_federation_name || '—' })} · {t('liberada em {data}', { data: quando(tr.released_at_ms) })}
          {aberta && tr.homologation_deadline ? ` · ${t('homologa sozinha em {data}', { data: dataBR(tr.homologation_deadline) })}` : ''}
          {tr.auto_homologated ? ` · ${t('homologada pelo prazo')}` : ''}
        </p>
        {tr.reason && <p className="text-sm text-gray-700">“{tr.reason}”</p>}
        {tr.deny_reason && <p className="text-sm text-red-600">{t('Motivo: {motivo}', { motivo: tr.deny_reason })}</p>}
        {aberta && podeDecidir && (
          <div className="flex flex-wrap gap-2">
            <V2Button type="button" size="sm" disabled={m.isPending} onClick={() => setConfirmar(true)}><CheckCircle2 className="h-4 w-4" />{t('Homologar')}</V2Button>
            <V2Button type="button" size="sm" variant="danger" onClick={() => setNegando(true)}><XCircle className="h-4 w-4" />{t('Negar')}</V2Button>
          </div>
        )}
      </V2Surface>
      <ConfirmDialog open={confirmar} onOpenChange={setConfirmar} loading={m.isPending}
        title={t('Homologar a transferência de {nome}?', { nome: tr.user_name || '' })}
        description={t('A filiação na {de} é encerrada e a pessoa fica livre para se filiar na {para}. Os pontos do ranking ficam onde foram feitos.', { de: tr.federation_acronym || '', para: tr.to_federation_acronym || '' })}
        confirmLabel={t('Homologar')} cancelLabel={t('Voltar')}
        onConfirm={() => m.mutate({ transferId: tr.id, action: 'homologate' }, { ...avisar(t('Transferência homologada. As duas federações e a pessoa foram avisadas.')), onSettled: () => setConfirmar(false) })} />
      {negando && (
        <MotivoDialog titulo={t('Negar a transferência')} rotulo={t('Negar')} pendente={m.isPending} onClose={() => setNegando(false)}
          descricao={t('A pessoa continua filiada na {de}. Ela e as duas federações leem o motivo.', { de: tr.federation_acronym || '' })}
          onConfirmar={(reason) => m.mutate({ transferId: tr.id, action: 'deny', reason }, { ...avisar(t('Transferência negada.')), onSettled: () => setNegando(false) })} />
      )}
    </li>
  );
}

function HomologacoesTab({ federation, perms }) {
  const q = useHomologations(federation.id);
  if (!q.isSuccess) return <Carregando q={q} titulo={t('Não carregaram as transferências para homologar')} />;
  const lista = q.data || [];
  const abertas = lista.filter((x) => x.status === TRANSFER_STATUS.HOMOLOGATION);
  const decididas = lista.filter((x) => x.status !== TRANSFER_STATUS.HOMOLOGATION);
  const dias = normalizeNationalConfig(federation.national_config).homologation_days;
  const linha = (x) => <LinhaHomologacao key={x.id} tr={x} podeDecidir={canHomologate(perms)} />;
  return (
    <section className="space-y-4" aria-label={t('Homologações')} data-dica="federacao-aba-rede-homologacoes">
      <Titulo titulo={t('Transferências entre estados')} texto={t('Quando um atleta troca de federação dentro da rede, a federação de origem libera e a {sigla} homologa. Sem resposta em {dias} dias, a homologação é automática.', { sigla: federation.acronym || federation.name, dias })} />
      {abertas.length ? <ul className="space-y-2">{abertas.map(linha)}</ul> : <V2EmptyState icon={ArrowLeftRight} title={t('Nenhuma transferência esperando homologação')} />}
      <Historico itens={decididas} render={linha} />
    </section>
  );
}

/* ================================================== confederação: anuidade == */

function LinhaAnuidade({ d, federation, lado, podeAgir }) {
  const m = useNationalAction(federation.id);
  const hoje = isoDate();
  const estado = duesState(d, hoje);
  const [modo, setModo] = useState(null);
  const [data, setData] = useState(hoje);
  const [nota, setNota] = useState('');
  const fechar = () => setModo(null);
  const agir = (action, extra, msg) => m.mutate({ action, duesId: d.id, ...extra }, { ...avisar(msg), onSettled: fechar });
  const quem = lado === 'conf' ? (d.federation_acronym || d.federation_name) : (d.conf_acronym || d.conf_name);
  return (
    <li>
      <V2Surface variant="compacto" className="flex flex-wrap items-start justify-between gap-3 p-4">
        <div className="min-w-0">
          <p className="flex flex-wrap items-center gap-2 font-bold text-ink">{t('Anuidade {ano}', { ano: d.year })} · {quem}<V2Badge tone={TOM_ANUIDADE[estado] || 'neutral'}>{t(DUES_STATUS_LABELS[estado] || estado)}</V2Badge></p>
          <p className="text-xs text-gray-500">
            {formatBrlCents(d.amount_cents)}
            {d.per_member_cents ? ` · ${t('{fixo} + {porFiliado} × {n} filiados', { fixo: formatBrlCents(d.fixed_cents), porFiliado: formatBrlCents(d.per_member_cents), n: d.member_count || 0 })}` : ''}
            {` · ${t('vence em {data}', { data: dataBR(d.due) })}`}
            {d.paid_at ? ` · ${t('paga em {data}', { data: dataBR(d.paid_at) })}` : ''}
          </p>
          {d.declared_note && d.status === DUES_STATUS.DECLARED && <p className="mt-1 text-sm text-gray-700">“{d.declared_note}”</p>}
          {d.reason && <p className="mt-1 text-sm text-gray-600">{t('Motivo: {motivo}', { motivo: d.reason })}</p>}
        </div>
        {podeAgir && (
          <div className="flex flex-wrap gap-2">
            {lado === 'state' && d.status === DUES_STATUS.OPEN && <V2Button type="button" size="sm" onClick={() => setModo('declare')}><Receipt className="h-4 w-4" />{t('Já paguei')}</V2Button>}
            {lado === 'conf' && [DUES_STATUS.OPEN, DUES_STATUS.DECLARED].includes(d.status) && <>
              <V2Button type="button" size="sm" onClick={() => setModo('confirm')}><CheckCircle2 className="h-4 w-4" />{t('Confirmar o recebimento')}</V2Button>
              <V2Button type="button" size="sm" variant="ghost" onClick={() => setModo('waive')}>{t('Dispensar')}</V2Button>
            </>}
            {lado === 'conf' && d.status !== DUES_STATUS.OPEN && <V2Button type="button" size="sm" variant="ghost" onClick={() => setModo('reopen')}>{t('Reabrir')}</V2Button>}
          </div>
        )}
      </V2Surface>
      {(modo === 'declare' || modo === 'confirm') && (
        <Dialog open onOpenChange={(o) => !o && fechar()}>
          <DialogContent sheet className="max-w-md">
            <DialogTitle>{modo === 'declare' ? t('Declarar o pagamento') : t('Confirmar o recebimento')}</DialogTitle>
            <DialogDescription>{modo === 'declare' ? t('A {conf} confere o recebimento e confirma. Só depois a anuidade conta como paga.', { conf: quem }) : t('{valor} da {fed}. A anuidade entra como receita nas Contas da confederação e como despesa nas da federação.', { valor: formatBrlCents(d.amount_cents), fed: quem })}</DialogDescription>
            <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); if (modo === 'declare') agir('dues_declare', { note: nota }, t('Pagamento declarado. A confederação foi avisada.')); else agir('dues_confirm', { date: data }, t('Recebimento confirmado.')); }}>
              {modo === 'declare'
                ? <V2Field label={t('Observação (opcional)')} htmlFor="fed-anuidade-nota" hint={t('Ex.: data e banco do Pix ou da transferência.')}><V2Input id="fed-anuidade-nota" maxLength={300} value={nota} onChange={(e) => setNota(e.target.value)} /></V2Field>
                : <V2Field label={t('Recebido em')} htmlFor="fed-anuidade-data"><V2Input id="fed-anuidade-data" type="date" max={hoje} value={data} onChange={(e) => setData(e.target.value)} /></V2Field>}
              <div className="flex justify-end gap-2"><V2Button type="button" variant="ghost" onClick={fechar}>{t('Voltar')}</V2Button><V2Button type="submit" disabled={m.isPending}>{t('Confirmar')}</V2Button></div>
            </form>
          </DialogContent>
        </Dialog>
      )}
      {(modo === 'reopen' || modo === 'waive') && (
        <MotivoDialog titulo={modo === 'reopen' ? t('Reabrir a anuidade') : t('Dispensar a anuidade')} rotulo={modo === 'reopen' ? t('Reabrir') : t('Dispensar')} pendente={m.isPending} onClose={fechar}
          descricao={modo === 'reopen' ? t('A anuidade volta a ficar em aberto e sai das Contas das duas federações. A federação lê o motivo.') : t('A federação não paga este ano. Ela lê o motivo.')}
          onConfirmar={(reason) => agir(modo === 'reopen' ? 'dues_reopen' : 'dues_waive', { reason }, modo === 'reopen' ? t('Anuidade reaberta.') : t('Anuidade dispensada.'))} />
      )}
    </li>
  );
}

function LancarAno({ federation }) {
  const m = useNationalAction(federation.id);
  const ano = Number(isoDate().slice(0, 4));
  const [year, setYear] = useState(String(ano));
  const cfg = normalizeNationalConfig(federation.national_config);
  const semValor = !cfg.dues_fixed_cents && !cfg.dues_per_member_cents;
  return (
    <V2Surface variant="compacto" className="space-y-3 p-4">
      <p className="font-semibold text-ink">{t('Lançar a anuidade do ano')}</p>
      <p className="text-sm text-gray-500">{semValor ? t('Defina o valor em Regras antes de lançar.') : t('{fixo} por federação + {porFiliado} por filiado ativo, com vencimento em {data}. Cada filiada recebe a dela, com a contagem de filiados do dia; quem já tem a do ano não recebe outra.', { fixo: formatBrlCents(cfg.dues_fixed_cents), porFiliado: formatBrlCents(cfg.dues_per_member_cents), data: dataBR(`${year}-${cfg.dues_due_md}`) })}</p>
      <form className="flex flex-wrap items-end gap-3" onSubmit={(e) => { e.preventDefault(); m.mutate({ action: 'dues_issue', year: Number(year) }, { onSuccess: (r) => toast.success(r?.created ? t('{n} anuidades lançadas.', { n: r.created }) : t('Todas as filiadas já tinham a anuidade deste ano.')), onError: (er) => toast.error(er.message) }); }}>
        <V2Field label={t('Ano')} htmlFor="fed-anuidade-ano"><V2Select id="fed-anuidade-ano" value={year} onChange={(e) => setYear(e.target.value)}>{[ano - 1, ano, ano + 1].map((y) => <option key={y} value={y}>{y}</option>)}</V2Select></V2Field>
        <V2Button type="submit" disabled={semValor || m.isPending}>{t('Lançar')}</V2Button>
      </form>
    </V2Surface>
  );
}

function AnuidadesTab({ federation, perms, lado }) {
  const qConf = useDuesReceivable(federation.id, { enabled: lado === 'conf' });
  const qEst = useDuesOwed(federation.id, { enabled: lado === 'state' });
  const q = lado === 'conf' ? qConf : qEst;
  const podeAgir = canManageDues(perms);
  if (!q.isSuccess) return <Carregando q={q} titulo={t('Não carregaram as anuidades')} />;
  const lista = q.data || [];
  const conf = nationalBodyOf(federation);
  return (
    <section className="space-y-4" aria-label={t('Anuidades')} data-dica={lado === 'conf' ? 'federacao-aba-rede-anuidades' : 'federacao-aba-confederacao-anuidades'}>
      <Titulo titulo={t('Anuidades')} texto={lado === 'conf'
        ? t('O repasse anual das filiadas. A federação paga e declara; você confere e confirma. Confirmada, entra como receita nas Contas.')
        : t('O repasse anual à {conf}. Pague como ela orientar e toque em "Já paguei"; ela confirma o recebimento.', { conf: conf?.acronym || t('confederação') })} />
      {lado === 'conf' && podeAgir && <LancarAno federation={federation} />}
      {lista.length ? <ul className="space-y-2">{lista.map((d) => <LinhaAnuidade key={d.id} d={d} federation={federation} lado={lado} podeAgir={podeAgir} />)}</ul>
        : <V2EmptyState icon={Receipt} title={t('Nenhuma anuidade lançada')} />}
    </section>
  );
}

/* ===================================================== confederação: regras == */

function RegrasTab({ federation }) {
  const m = useNationalAction(federation.id);
  const atual = normalizeNationalConfig(federation.national_config);
  const [f, setF] = useState(() => ({
    homologate_transfers: atual.homologate_transfers, homologation_days: String(atual.homologation_days),
    fixo: formatBrlCents(atual.dues_fixed_cents), porFiliado: formatBrlCents(atual.dues_per_member_cents),
    dia: atual.dues_due_md.slice(3), mes: atual.dues_due_md.slice(0, 2),
  }));
  const [erros, setErros] = useState({});
  const erro = (k) => (erros[k] ? t(erros[k]) : undefined);
  const exemplo = duesAmount({ dues_fixed_cents: parseBrlCents(f.fixo) || 0, dues_per_member_cents: parseBrlCents(f.porFiliado) || 0 }, 200).amount_cents;
  const salvar = (e) => {
    e.preventDefault();
    const entrada = {
      homologate_transfers: f.homologate_transfers, homologation_days: f.homologation_days,
      dues_fixed_cents: parseBrlCents(f.fixo || '0'), dues_per_member_cents: parseBrlCents(f.porFiliado || '0'),
      dues_due_md: `${String(f.mes).padStart(2, '0')}-${String(f.dia).padStart(2, '0')}`,
    };
    const r = validateNationalConfig(entrada);
    setErros(r.ok ? {} : r.errors);
    if (r.ok) m.mutate({ action: 'config_save', config: r.value }, avisar(t('Regras da rede salvas.')));
  };
  const campo = (k) => (e) => setF((x) => ({ ...x, [k]: e.target.value }));
  return (
    <section className="space-y-4" aria-label={t('Regras da rede')} data-dica="federacao-aba-rede-regras">
      <Titulo titulo={t('Regras da rede')} texto={t('Valem para todas as filiadas. Mudar o valor não altera anuidades já lançadas.')} />
      <V2Surface as="form" variant="compacto" className="space-y-4 p-4" onSubmit={salvar}>
        <V2Toggle id="fed-rede-homologa" checked={f.homologate_transfers} onChange={(v) => setF((x) => ({ ...x, homologate_transfers: v }))} label={t('Homologar as transferências entre estados')} hint={t('Desligado, a troca de federação dentro da rede vale assim que a de origem libera.')} />
        <V2Field label={t('Prazo para homologar (dias)')} htmlFor="fed-rede-dias" error={erro('homologation_days')} hint={t('Sem resposta no prazo, a homologação é automática.')}><V2Input id="fed-rede-dias" type="number" min={1} max={60} value={f.homologation_days} onChange={campo('homologation_days')} /></V2Field>
        <div className="grid gap-3 sm:grid-cols-2">
          <V2Field label={t('Anuidade: valor fixo por federação')} htmlFor="fed-rede-fixo" error={erro('dues_fixed_cents')}><V2Input id="fed-rede-fixo" inputMode="decimal" value={f.fixo} onChange={campo('fixo')} /></V2Field>
          <V2Field label={t('Anuidade: valor por filiado ativo')} htmlFor="fed-rede-porfiliado" error={erro('dues_per_member_cents')}><V2Input id="fed-rede-porfiliado" inputMode="decimal" value={f.porFiliado} onChange={campo('porFiliado')} /></V2Field>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:max-w-xs">
          <V2Field label={t('Vence no dia')} htmlFor="fed-rede-dia" error={erro('dues_due_md')}><V2Input id="fed-rede-dia" type="number" min={1} max={31} value={f.dia} onChange={campo('dia')} /></V2Field>
          <V2Field label={t('do mês')} htmlFor="fed-rede-mes"><V2Input id="fed-rede-mes" type="number" min={1} max={12} value={f.mes} onChange={campo('mes')} /></V2Field>
        </div>
        <p className="text-xs text-gray-500">{t('Exemplo: uma federação com 200 filiados ativos paga {valor}.', { valor: formatBrlCents(exemplo) })}</p>
        <div className="flex justify-end"><V2Button type="submit" disabled={m.isPending}>{t('Salvar')}</V2Button></div>
      </V2Surface>
    </section>
  );
}

/* ============================================ estadual: a confederação dela == */

function MinhaConfederacaoTab({ federation, perms }) {
  const q = useMyNationalLinks(federation.id);
  const pubQ = usePublicFederations();
  const m = useNationalAction(federation.id);
  const [alvo, setAlvo] = useState('');
  const [mensagem, setMensagem] = useState('');
  const [saindo, setSaindo] = useState(null);
  const podeGerir = canManageNetwork(perms);
  const confs = useMemo(() => (pubQ.data || []).filter((x) => isConfederation(x) && x.id !== federation.id), [pubQ.data, federation.id]);
  if (!q.isSuccess) return <Carregando q={q} titulo={t('Não carregou o vínculo com a confederação')} />;
  const links = q.data || [];
  const ativo = links.find((l) => l.status === LINK_STATUS.APPROVED) || links.find((l) => LINK_OPEN.includes(l.status));
  const antigos = links.filter((l) => l !== ativo);
  const nb = nationalBodyOf(federation);
  const agir = (action, extra, msg) => m.mutate({ action, ...extra }, { ...avisar(msg), onSettled: () => setSaindo(null) });
  return (
    <section className="space-y-4" aria-label={t('Confederação')} data-dica="federacao-aba-confederacao">
      <Titulo titulo={t('Confederação')} texto={t('A federação pode se filiar a UMA confederação nacional. Filiada, os pontos do ranking daqui somam no ranking nacional, as transferências para outros estados da rede passam pela homologação dela e há uma anuidade de repasse.')} />
      {ativo ? (
        <V2Surface variant="compacto" className="space-y-3 p-4">
          <p className="flex flex-wrap items-center gap-2 font-bold text-ink"><Landmark className="h-4 w-4" aria-hidden="true" />{ativo.conf_name}<V2Badge tone={TOM_VINCULO[ativo.status] || 'neutral'}>{t(LINK_STATUS_LABELS[ativo.status] || ativo.status)}</V2Badge></p>
          {ativo.status === LINK_STATUS.APPROVED && <p className="text-sm text-gray-600">{t('Filiada desde {data}. O selo "Filiada à {conf}" aparece na página pública.', { data: quando(nb?.since_ms || ativo.since_ms), conf: ativo.conf_acronym || ativo.conf_name })}</p>}
          {ativo.message && LINK_OPEN.includes(ativo.status) && <p className="text-sm text-gray-700">“{ativo.message}”</p>}
          {podeGerir && (
            <div className="flex flex-wrap gap-2">
              {ativo.status === LINK_STATUS.INVITED && <>
                <V2Button type="button" size="sm" disabled={m.isPending} onClick={() => agir('link_accept', { linkId: ativo.id }, t('Federação filiada à confederação.'))}><CheckCircle2 className="h-4 w-4" />{t('Aceitar o convite')}</V2Button>
                <V2Button type="button" size="sm" variant="danger" disabled={m.isPending} onClick={() => agir('link_reject', { linkId: ativo.id }, t('Convite recusado.'))}><XCircle className="h-4 w-4" />{t('Recusar')}</V2Button>
              </>}
              {ativo.status === LINK_STATUS.PENDING && <V2Button type="button" size="sm" variant="ghost" disabled={m.isPending} onClick={() => agir('link_cancel', { linkId: ativo.id }, t('Pedido cancelado.'))}>{t('Cancelar o pedido')}</V2Button>}
              {ativo.status === LINK_STATUS.APPROVED && <V2Button type="button" size="sm" variant="ghost" onClick={() => setSaindo(ativo)}>{t('Desfiliar')}</V2Button>}
            </div>
          )}
        </V2Surface>
      ) : podeGerir ? (
        pubQ.isError ? <V2ErrorState inline title={t('Não carregou a lista de confederações')} onRetry={() => pubQ.refetch()} />
          : pubQ.isLoading ? <V2Skeleton lines={2} />
            : confs.length === 0 ? <V2EmptyState icon={Landmark} title={t('Nenhuma confederação publicada na plataforma')} description={t('Quem marca uma federação como confederação é a plataforma.')} />
              : (
                <V2Surface as="form" variant="compacto" className="grid gap-3 p-4 sm:grid-cols-[1fr_1fr_auto] sm:items-end" onSubmit={(e) => { e.preventDefault(); if (alvo) agir('link_request', { confId: alvo, message: mensagem }, t('Pedido enviado. A confederação foi avisada.')); }}>
                  <V2Field label={t('Confederação')} htmlFor="fed-pedir-conf"><V2Select id="fed-pedir-conf" value={alvo} onChange={(e) => setAlvo(e.target.value)}><option value="">{t('Escolha')}</option>{confs.map((x) => <option key={x.id} value={x.id}>{x.acronym ? `${x.acronym} · ${x.name}` : x.name}</option>)}</V2Select></V2Field>
                  <V2Field label={t('Mensagem (opcional)')} htmlFor="fed-pedir-msg"><V2Input id="fed-pedir-msg" maxLength={500} value={mensagem} onChange={(e) => setMensagem(e.target.value)} /></V2Field>
                  <V2Button type="submit" disabled={!alvo || m.isPending}><Send className="h-4 w-4" />{t('Pedir filiação')}</V2Button>
                </V2Surface>
              )
      ) : <V2EmptyState icon={Landmark} title={t('A federação não é filiada a uma confederação')} description={t('Quem pede a filiação é a administração da federação.')} />}
      <Historico itens={antigos} render={(l) => <li key={l.id} className="text-sm text-gray-600">{l.conf_name} · <V2Badge tone={TOM_VINCULO[l.status] || 'neutral'}>{t(LINK_STATUS_LABELS[l.status] || l.status)}</V2Badge> · {quando(l.updated_at_ms)}{l.reason ? ` · ${t('Motivo: {motivo}', { motivo: l.reason })}` : ''}</li>} />
      {saindo && (
        <MotivoDialog titulo={t('Desfiliar da {conf}?', { conf: saindo.conf_acronym || saindo.conf_name })} rotulo={t('Desfiliar')} pendente={m.isPending} onClose={() => setSaindo(null)}
          descricao={t('Os pontos daqui saem do ranking nacional do ano em curso (os anos fechados não mudam) e as anuidades em aberto continuam devidas. A confederação lê o motivo.')}
          onConfirmar={(reason) => agir('link_leave', { linkId: saindo.id, reason }, t('Federação desfiliada.'))} />
      )}
    </section>
  );
}

/** `tab` é o valor da aba (`rede-*` na confederação, `confederacao*` na estadual). */
export default function FedNationalPanel({ federation, perms, tab }) {
  if (tab === 'rede-filiadas') return <FiliadasTab federation={federation} perms={perms} />;
  if (tab === 'rede-homologacoes') return <HomologacoesTab federation={federation} perms={perms} />;
  if (tab === 'rede-anuidades') return <AnuidadesTab federation={federation} perms={perms} lado="conf" />;
  if (tab === 'rede-regras') return <RegrasTab federation={federation} />;
  if (tab === 'confederacao-anuidades') return <AnuidadesTab federation={federation} perms={perms} lado="state" />;
  if (tab === 'copa') return <CupManager federation={federation} />;
  if (tab === 'copa-inscricao') return <CupTeamEntry federation={federation} />;
  return <MinhaConfederacaoTab federation={federation} perms={perms} />;
}
