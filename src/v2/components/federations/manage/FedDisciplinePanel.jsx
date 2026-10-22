/**
 * Disciplina da federação (permissão `discipline`, módulo `discipline`):
 *  - SANÇÕES: aplicar (advertência, suspensão com prazo, multa, exclusão) a um
 *    filiado, decidir recursos e encerrar antes do prazo — tudo pelo SERVIDOR
 *    (`disciplineAction`), que grava o efeito na filiação. Só a pessoa e a
 *    federação veem (D11).
 *  - OUVIDORIA: as manifestações recebidas (anônimas ou identificadas), o
 *    estado (recebida → em apuração → concluída) e as anotações internas, que
 *    quem enviou não lê.
 */
import React, { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Gavel, MessageSquareWarning, Plus } from 'lucide-react';
import { useAuth } from '@/core/lib/FirebaseAuthContext';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { disciplineAction, updateReport } from '@/modules/federations/services/federationService';
import { useFederationMutation } from '@/modules/federations/hooks/useFederations';
import { fedModuleOn } from '@/modules/federations/domain/federation';
import { canAppeal, reportProtocol, sanctionInForce, sortReports, sortSanctions, validateSanctionInput } from '@/modules/federations/domain/discipline';
import { formatBrlCents, parseBrlCents } from '@/modules/federations/domain/charges';
import { LIVE_MEMBER_STATUSES } from '@/modules/federations/domain/membership';
import { DISCIPLINE_KIND, DISCIPLINE_KIND_LABELS, DISCIPLINE_STATUS, DISCIPLINE_STATUS_LABELS, REPORT_KIND_LABELS, REPORT_STATUS, REPORT_STATUS_LABELS } from '@/modules/federations/domain/constants';
import { V2Badge, V2Button, V2EmptyState, V2ErrorState, V2Field, V2FilterChip, V2Input, V2SearchInput, V2Select, V2Skeleton, V2Surface, V2Textarea } from '@/v2/ui/primitives';
import { t } from '@/core/i18n';
import { quando } from '../federationUi';
import { BuscaLista, MostrarMais, normalizaBusca as normaliza, useBuscaLista, useFiltroNaUrl } from './listTools';

const cents = parseBrlCents;

/* ------------------------------------------------------------------ sanções -- */

function SancaoForm({ federation, membersQ, onFechar }) {
  const [busca, setBusca] = useState('');
  const [memberId, setMemberId] = useState('');
  const [f, setF] = useState({ kind: DISCIPLINE_KIND.WARNING, reason: '', starts_at: '', ends_at: '', multa: '0,00', tournament_name: '' });
  const [erros, setErros] = useState({});
  const [resumo, setResumo] = useState(null);
  const set = (patch) => { setF((x) => ({ ...x, ...patch })); setErros({}); };
  const m = useFederationMutation((payload) => disciplineAction(payload));
  const termo = normaliza(busca.trim());
  const candidatos = useMemo(() => (membersQ.data || []).filter((mb) => LIVE_MEMBER_STATUSES.includes(mb.status) && (!termo || normaliza(`${mb.user_name} ${mb.member_number || ''}`).includes(termo))).slice(0, 8), [membersQ.data, termo]);
  const alvo = (membersQ.data || []).find((mb) => mb.id === memberId) || null;
  const enviar = (e) => {
    e.preventDefault();
    if (!alvo) { setErros({ member: t('Escolha o filiado.') }); return; }
    const r = validateSanctionInput({ ...f, fine_cents: cents(f.multa || '0') });
    if (!r.ok) { setErros(r.errors); return; }
    setResumo(r.value); // aplicar avisa a pessoa e mexe na filiação: pergunta antes, com o resumo
  };
  const efeito = !resumo ? '' : {
    [DISCIPLINE_KIND.WARNING]: t('Fica registrada na filiação.'),
    [DISCIPLINE_KIND.SUSPENSION]: t('Suspensa de {ini} a {fim}: não se inscreve em torneio "só filiados" e a carteirinha mostra "Suspensa".', { ini: resumo.starts_at ? quando(resumo.starts_at) : t('hoje'), fim: quando(resumo.ends_at) }),
    [DISCIPLINE_KIND.FINE]: t('Uma cobrança de {valor} é criada para a pessoa.', { valor: formatBrlCents(resumo.fine_cents) }),
    [DISCIPLINE_KIND.EXCLUSION]: t('A filiação é encerrada e as cobranças abertas são canceladas.'),
  }[resumo.kind] || '';
  const aplicar = () => m.mutate({ action: 'apply', federationId: federation.id, memberId: alvo.id, ...resumo }, { onSuccess: () => { setResumo(null); toast.success(t('Sanção aplicada. A pessoa foi avisada e pode recorrer.')); onFechar(); }, onError: (er) => toast.error(er.message) });
  return (
    <form onSubmit={enviar} noValidate className="space-y-4" data-dica="federacao-sancao-formulario">
      <V2Field label={t('Filiado')} htmlFor="sa-busca" error={erros.member} required>
        {alvo ? (
          <div className="flex items-center gap-2 text-sm"><span className="font-bold text-ink">{alvo.user_name}</span>{alvo.member_number && <span className="text-gray-500">· {alvo.member_number}</span>}<V2Button type="button" size="sm" variant="ghost" onClick={() => setMemberId('')}>{t('Trocar')}</V2Button></div>
        ) : (
          <>
            <V2SearchInput id="sa-busca" value={busca} onChange={(e) => setBusca(e.target.value)} placeholder={t('Nome ou número')} aria-label={t('Buscar filiado')} />
            {membersQ.isError && <p className="mt-1 text-xs text-red-600">{t('Não carregaram os filiados.')}</p>}
            {termo && candidatos.length > 0 && <ul className="mt-2 divide-y divide-gray-100 rounded-2xl border border-gray-100">{candidatos.map((mb) => <li key={mb.id}><button type="button" className="w-full px-3 py-2 text-left text-sm hover:bg-gray-50" onClick={() => setMemberId(mb.id)}>{mb.user_name}{mb.member_number ? ` · ${mb.member_number}` : ''}</button></li>)}</ul>}
            {termo && membersQ.isSuccess && !candidatos.length && <p className="mt-1 text-xs text-gray-500">{t('Ninguém com esse nome entre os filiados.')}</p>}
          </>
        )}
      </V2Field>
      <div className="grid gap-4 sm:grid-cols-3">
        <V2Field label={t('Tipo')} htmlFor="sa-tipo" error={erros.kind}><V2Select id="sa-tipo" value={f.kind} onChange={(e) => set({ kind: e.target.value })}>{Object.values(DISCIPLINE_KIND).map((v) => <option key={v} value={v}>{t(DISCIPLINE_KIND_LABELS[v])}</option>)}</V2Select></V2Field>
        <V2Field label={t('Início')} htmlFor="sa-ini" error={erros.starts_at} hint={t('Em branco = hoje.')}><V2Input id="sa-ini" type="date" value={f.starts_at} onChange={(e) => set({ starts_at: e.target.value })} /></V2Field>
        {f.kind === DISCIPLINE_KIND.SUSPENSION && <V2Field label={t('Fim da suspensão')} htmlFor="sa-fim" error={erros.ends_at} required><V2Input id="sa-fim" type="date" value={f.ends_at} onChange={(e) => set({ ends_at: e.target.value })} /></V2Field>}
        {f.kind === DISCIPLINE_KIND.FINE && <V2Field label={t('Valor da multa (R$)')} htmlFor="sa-multa" error={erros.fine_cents} required><V2Input id="sa-multa" inputMode="decimal" value={f.multa} onChange={(e) => set({ multa: e.target.value })} /></V2Field>}
      </div>
      <V2Field label={t('Torneio relacionado (opcional)')} htmlFor="sa-torneio"><V2Input id="sa-torneio" maxLength={120} value={f.tournament_name} onChange={(e) => set({ tournament_name: e.target.value })} /></V2Field>
      <V2Field label={t('Motivo')} htmlFor="sa-motivo" error={erros.reason} required hint={t('A pessoa lê este texto no aviso. Mínimo 10 caracteres.')}><V2Textarea id="sa-motivo" rows={3} maxLength={1000} value={f.reason} onChange={(e) => set({ reason: e.target.value })} /></V2Field>
      {f.kind === DISCIPLINE_KIND.SUSPENSION && <p className="text-xs text-gray-500">{t('Suspenso, a pessoa não se inscreve em torneio chancelado "só filiados" e a carteirinha mostra "Suspensa" até o fim do prazo.')}</p>}
      {f.kind === DISCIPLINE_KIND.EXCLUSION && <p className="text-xs text-red-600">{t('A exclusão encerra a filiação e cancela as cobranças abertas. Recurso aceito devolve a filiação.')}</p>}
      <div className="flex justify-end gap-2">
        <V2Button type="button" variant="ghost" onClick={onFechar}>{t('Cancelar')}</V2Button>
        <V2Button type="submit" variant="danger" disabled={m.isPending} data-dica="federacao-sancao-aplicar">{t('Aplicar sanção')}</V2Button>
      </div>
      <ConfirmDialog
        open={Boolean(resumo)}
        onOpenChange={(o) => { if (!o) setResumo(null); }}
        destructive
        loading={m.isPending}
        title={t('{tipo} para {nome}?', { tipo: resumo ? t(DISCIPLINE_KIND_LABELS[resumo.kind]) : '', nome: alvo?.user_name || '' })}
        description={`${efeito} ${t('A pessoa recebe um aviso com o motivo e pode recorrer.')}`}
        confirmLabel={t('Aplicar sanção')}
        cancelLabel={t('Voltar')}
        onConfirm={aplicar}
      />
    </form>
  );
}

const TOM_SANCAO = { active: 'red', appealed: 'amber', upheld: 'red', overturned: 'green', ended: 'neutral' };

/** O que deixa de valer quando a sanção é anulada (recurso aceito) ou encerrada antes do prazo — o mesmo efeito no servidor. */
function efeitoDesfeito(kind) {
  return {
    [DISCIPLINE_KIND.WARNING]: t('A advertência deixa de constar como em vigor.'),
    [DISCIPLINE_KIND.SUSPENSION]: t('A suspensão deixa de valer hoje: a pessoa volta a se inscrever em torneio "só filiados" e a carteirinha deixa de mostrar "Suspensa".'),
    [DISCIPLINE_KIND.FINE]: t('A cobrança da multa é cancelada, se ainda não foi paga.'),
    [DISCIPLINE_KIND.EXCLUSION]: t('A filiação volta a valer, com um código novo na carteirinha.'),
  }[kind] || '';
}

function SancaoRow({ s }) {
  const [decisao, setDecisao] = useState(null); // null | 'overturn' | 'uphold' | 'end'
  const [nota, setNota] = useState('');
  const m = useFederationMutation((payload) => disciplineAction({ ...payload, sanctionId: s.id }));
  const vigente = sanctionInForce(s);
  const podeEncerrar = vigente && [DISCIPLINE_STATUS.ACTIVE, DISCIPLINE_STATUS.UPHELD].includes(s.status);
  const abrir = (d) => { setNota(''); setDecisao(d); };
  const tipo = t(DISCIPLINE_KIND_LABELS[s.kind] || s.kind);
  const dialogo = {
    overturn: {
      title: t('Aceitar o recurso de {nome}?', { nome: s.user_name }),
      description: `${t('A sanção ({tipo}) é anulada.', { tipo })} ${efeitoDesfeito(s.kind)} ${t('A pessoa recebe um aviso com a decisão e a observação. Não dá para desfazer.')}`,
      confirmLabel: t('Aceitar recurso'), destructive: false,
      payload: { action: 'decide_appeal', decision: 'overturn' }, ok: t('Recurso aceito: a sanção foi anulada.'),
      notaLabel: t('Observação para a pessoa (opcional)'), notaHint: t('Vai no aviso da decisão.'),
    },
    uphold: {
      title: t('Manter a sanção de {nome}?', { nome: s.user_name }),
      description: t('O recurso é negado e a sanção ({tipo}) continua valendo como foi aplicada. A pessoa não pode recorrer de novo e recebe um aviso com a decisão e a observação.', { tipo }),
      confirmLabel: t('Manter sanção'), destructive: true,
      payload: { action: 'decide_appeal', decision: 'uphold' }, ok: t('Recurso negado: a sanção fica.'),
      notaLabel: t('Observação para a pessoa (opcional)'), notaHint: t('Vai no aviso da decisão.'),
    },
    end: {
      title: t('Encerrar agora a sanção de {nome}?', { nome: s.user_name }),
      description: `${t('A sanção ({tipo}) termina hoje, antes do prazo.', { tipo })} ${efeitoDesfeito(s.kind)} ${t('A pessoa recebe um aviso. Não dá para desfazer.')}`,
      confirmLabel: t('Encerrar agora'), destructive: false,
      payload: { action: 'end' }, ok: t('Sanção encerrada.'),
      notaLabel: t('Observação (opcional)'), notaHint: t('Fica no registro da sanção. Não vai no aviso.'),
    },
  }[decisao];
  return (
    <li>
      <V2Surface variant="compacto" className="space-y-3 p-4">
        <div className="min-w-0">
          <p className="flex flex-wrap items-center gap-2 font-bold text-ink">{s.user_name}<V2Badge tone={TOM_SANCAO[s.status] || 'neutral'}>{t(DISCIPLINE_STATUS_LABELS[s.status] || s.status)}</V2Badge><V2Badge tone="ink">{tipo}</V2Badge></p>
          <p className="text-xs text-gray-500">{t('aplicada em {data}', { data: quando(s.created_at_ms) })}{s.kind === DISCIPLINE_KIND.SUSPENSION ? ` · ${quando(s.starts_at)} – ${quando(s.ends_at)}` : ''}{s.kind === DISCIPLINE_KIND.FINE ? ` · ${formatBrlCents(s.fine_cents)}` : ''}{s.tournament_name ? ` · ${s.tournament_name}` : ''}</p>
          <p className="mt-1 text-sm text-gray-700">{s.reason}</p>
          {s.appeal?.text && <p className="mt-2 rounded-xl bg-gray-50 p-3 text-sm text-gray-700"><span className="font-semibold">{t('Recurso:')}</span> {s.appeal.text}</p>}
          {s.appeal_decision?.note && <p className="mt-1 text-xs text-gray-500">{t('Decisão: {nota}', { nota: s.appeal_decision.note })}</p>}
          {s.end_note && <p className="mt-1 text-xs text-gray-500">{t('Encerrada antes do prazo: {nota}', { nota: s.end_note })}</p>}
        </div>
        {(s.status === DISCIPLINE_STATUS.APPEALED || podeEncerrar) && (
          <div className="flex flex-wrap items-center gap-2">
            {s.status === DISCIPLINE_STATUS.APPEALED && (
              <>
                <V2Button type="button" size="sm" disabled={m.isPending} onClick={() => abrir('overturn')}>{t('Aceitar recurso')}</V2Button>
                <V2Button type="button" size="sm" variant="danger" disabled={m.isPending} onClick={() => abrir('uphold')}>{t('Manter sanção')}</V2Button>
              </>
            )}
            {podeEncerrar && <V2Button type="button" size="sm" variant="ghost" disabled={m.isPending} onClick={() => abrir('end')}>{t('Encerrar agora')}</V2Button>}
          </div>
        )}
        {canAppeal(s) && <p className="text-xs text-gray-500">{t('A pessoa ainda pode recorrer uma vez.')}</p>}
      </V2Surface>
      <ConfirmDialog
        open={Boolean(dialogo)}
        onOpenChange={(o) => { if (!o) setDecisao(null); }}
        loading={m.isPending}
        destructive={dialogo?.destructive}
        title={dialogo?.title}
        description={dialogo?.description}
        confirmLabel={dialogo?.confirmLabel}
        cancelLabel={t('Voltar')}
        onConfirm={() => m.mutate({ ...dialogo.payload, note: nota.trim() }, { onSuccess: () => { toast.success(dialogo.ok); setDecisao(null); }, onError: (e) => toast.error(e.message) })}
      >
        {dialogo && (
          <V2Field label={dialogo.notaLabel} htmlFor={`sa-nota-${s.id}`} hint={dialogo.notaHint}>
            <V2Textarea id={`sa-nota-${s.id}`} rows={2} maxLength={1000} value={nota} onChange={(e) => setNota(e.target.value)} />
          </V2Field>
        )}
      </ConfirmDialog>
    </li>
  );
}

const FILTROS_SANCAO = ['vigentes', 'recurso', 'todas'];
const CAMPOS_SANCAO = (s) => [s.user_name, s.reason, s.tournament_name, t(DISCIPLINE_KIND_LABELS[s.kind] || '')].join(' ');
const sancaoNoFiltro = (s, filtro) => (filtro === 'todas' ? true : filtro === 'recurso' ? s.status === DISCIPLINE_STATUS.APPEALED : sanctionInForce(s) || s.status === DISCIPLINE_STATUS.APPEALED);

function SancoesTab({ federation, membersQ, sanctionsQ }) {
  const [novo, setNovo] = useState(false);
  const [filtro, setFiltro] = useFiltroNaUrl('filtro', 'vigentes', FILTROS_SANCAO);
  const ligado = fedModuleOn(federation, 'discipline');
  const todas = useMemo(() => sortSanctions(sanctionsQ.data || []), [sanctionsQ.data]);
  const lista = useMemo(() => todas.filter((s) => sancaoNoFiltro(s, filtro)), [todas, filtro]);
  const busca = useBuscaLista(lista, CAMPOS_SANCAO);
  if (sanctionsQ.isError) return <V2ErrorState title={t('Não carregaram as sanções')} onRetry={() => sanctionsQ.refetch()} />;
  if (sanctionsQ.isLoading) return <V2Skeleton lines={5} />;
  const rotulos = { vigentes: t('Em vigor'), recurso: t('Com recurso'), todas: t('Todas') };
  return (
    <section className="space-y-4" aria-label={t('Sanções')} data-dica="federacao-sancoes">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div><h2 className="font-display text-xl font-bold text-ink">{t('Sanções disciplinares')}</h2><p className="text-sm text-gray-500">{t('Só a pessoa e a federação veem. Toda sanção cabe um recurso, decidido aqui.')}</p></div>
        {ligado && !novo && <V2Button type="button" size="sm" variant="danger" onClick={() => setNovo(true)} data-dica="federacao-sancao-nova"><Plus className="h-4 w-4" />{t('Aplicar sanção')}</V2Button>}
      </div>
      {!ligado && <p className="rounded-2xl bg-amber-50 px-4 py-3 text-sm text-amber-900">{t('O módulo de disciplina está desligado: não dá para aplicar sanção nova. As que já existem seguem valendo até a data, e os recursos e o encerramento antecipado continuam aqui.')}</p>}
      {novo && <V2Surface><SancaoForm federation={federation} membersQ={membersQ} onFechar={() => setNovo(false)} /></V2Surface>}
      <div className="flex flex-wrap gap-2">{FILTROS_SANCAO.map((id) => <V2FilterChip key={id} active={filtro === id} onClick={() => setFiltro(id)}>{`${rotulos[id]} (${todas.filter((s) => sancaoNoFiltro(s, id)).length})`}</V2FilterChip>)}</div>
      {lista.length > 0 && <BuscaLista id="sa-lista-busca" value={busca.termo} onChange={busca.setTermo} placeholder={t('Buscar por nome, motivo ou torneio')} total={lista.length} achados={busca.filtrados.length} />}
      {!busca.filtrados.length
        ? <V2EmptyState icon={Gavel} title={busca.termo.trim() && lista.length ? t('Nenhuma sanção com esse termo') : filtro === 'recurso' ? t('Nenhum recurso para decidir') : t('Nenhuma sanção neste filtro')} />
        : <ul className="space-y-3">{busca.visiveis.map((s) => <SancaoRow key={s.id} s={s} />)}</ul>}
      <MostrarMais restam={busca.restam} onClick={busca.mostrarMais} />
    </section>
  );
}

/* ---------------------------------------------------------------- ouvidoria -- */

const TOM_REL = { open: 'amber', in_review: 'ink', closed: 'green' };

function RelatoRow({ rep }) {
  const { user } = useAuth();
  const [notas, setNotas] = useState(rep.notes || '');
  const [concluindo, setConcluindo] = useState(false);
  const m = useFederationMutation((payload) => updateReport(rep, { ...payload, uid: user?.uid }));
  const salvar = (status, ok = t('Manifestação atualizada.')) => m.mutate({ status, notes: notas }, { onSuccess: () => { toast.success(ok); setConcluindo(false); }, onError: (e) => toast.error(e.message) });
  const protocolo = reportProtocol(rep.id);
  return (
    <li>
      <V2Surface variant="compacto" className="space-y-3 p-4">
        <div className="min-w-0">
          <p className="flex flex-wrap items-center gap-2 font-bold text-ink">{t('Protocolo {p}', { p: protocolo })}<V2Badge tone={TOM_REL[rep.status] || 'neutral'}>{t(REPORT_STATUS_LABELS[rep.status] || rep.status)}</V2Badge>{rep.anonymous && <V2Badge tone="neutral">{t('anônima')}</V2Badge>}</p>
          <p className="text-xs text-gray-500">{t(REPORT_KIND_LABELS[rep.kind] || REPORT_KIND_LABELS.other)}{rep.tournament_name ? ` · ${rep.tournament_name}` : ''} · {t('recebida em {data}', { data: quando(rep.created_at_ms) })}</p>
          <p className="mt-2 whitespace-pre-wrap text-sm text-gray-700">{rep.body}</p>
        </div>
        {rep.status !== REPORT_STATUS.CLOSED && (
          <div className="space-y-2">
            <V2Field label={t('Anotações internas (quem enviou não lê)')} htmlFor={`rel-notas-${rep.id}`}><V2Textarea id={`rel-notas-${rep.id}`} rows={2} maxLength={2000} value={notas} onChange={(e) => setNotas(e.target.value)} /></V2Field>
            <div className="flex flex-wrap gap-2">
              {rep.status === REPORT_STATUS.OPEN && <V2Button type="button" size="sm" disabled={m.isPending} onClick={() => salvar(REPORT_STATUS.IN_REVIEW)}>{t('Começar a apurar')}</V2Button>}
              {rep.status === REPORT_STATUS.IN_REVIEW && <V2Button type="button" size="sm" variant="secondary" disabled={m.isPending} onClick={() => salvar(REPORT_STATUS.IN_REVIEW)}>{t('Salvar anotações')}</V2Button>}
              <V2Button type="button" size="sm" variant="ghost" disabled={m.isPending} onClick={() => setConcluindo(true)}>{t('Concluir')}</V2Button>
            </div>
          </div>
        )}
        {rep.status === REPORT_STATUS.CLOSED && rep.notes && <p className="text-xs text-gray-500">{rep.notes}</p>}
      </V2Surface>
      <ConfirmDialog
        open={concluindo}
        onOpenChange={setConcluindo}
        loading={m.isPending}
        title={t('Concluir a manifestação {p}?', { p: protocolo })}
        description={t('Quem enviou passa a ver "Concluída" ao consultar o protocolo. As anotações internas são salvas junto e continuam só com a federação. Depois de concluída, a manifestação não volta a ser editada.')}
        confirmLabel={t('Concluir')}
        cancelLabel={t('Voltar')}
        onConfirm={() => salvar(REPORT_STATUS.CLOSED, t('Manifestação concluída.'))}
      />
    </li>
  );
}

// `abertas` = sem resposta (recebida e ainda não apurada): é o que a faixa "Precisa de você" conta.
const FILTROS_OUVIDORIA = ['atratar', 'abertas', 'concluidas', 'todas'];
const relatoNoFiltro = (r, filtro) => ({
  atratar: r.status !== REPORT_STATUS.CLOSED,
  abertas: r.status === REPORT_STATUS.OPEN,
  concluidas: r.status === REPORT_STATUS.CLOSED,
  todas: true,
}[filtro]);
const CAMPOS_RELATO = (r) => [reportProtocol(r.id), r.body, r.tournament_name, t(REPORT_KIND_LABELS[r.kind] || '')].join(' ');

function OuvidoriaTab({ reportsQ }) {
  const [filtro, setFiltro] = useFiltroNaUrl('filtro', 'atratar', FILTROS_OUVIDORIA);
  const todas = useMemo(() => sortReports(reportsQ.data || []), [reportsQ.data]);
  const lista = useMemo(() => todas.filter((r) => relatoNoFiltro(r, filtro)), [todas, filtro]);
  const busca = useBuscaLista(lista, CAMPOS_RELATO);
  if (reportsQ.isError) return <V2ErrorState title={t('Não carregou a ouvidoria')} onRetry={() => reportsQ.refetch()} />;
  if (reportsQ.isLoading) return <V2Skeleton lines={5} />;
  const rotulos = { atratar: t('A tratar'), abertas: t('Sem resposta'), concluidas: t('Concluídas'), todas: t('Todas') };
  return (
    <section className="space-y-4" aria-label={t('Ouvidoria')} data-dica="federacao-ouvidoria">
      <div><h2 className="font-display text-xl font-bold text-ink">{t('Ouvidoria')}</h2><p className="text-sm text-gray-500">{t('Manifestações enviadas pela página da federação. A anônima não traz quem enviou, nem para a plataforma. A pessoa acompanha pelo protocolo e vê só o estado.')}</p></div>
      <div className="flex flex-wrap gap-2">{FILTROS_OUVIDORIA.map((id) => <V2FilterChip key={id} active={filtro === id} onClick={() => setFiltro(id)}>{`${rotulos[id]} (${todas.filter((r) => relatoNoFiltro(r, id)).length})`}</V2FilterChip>)}</div>
      {lista.length > 0 && <BuscaLista id="rel-busca" value={busca.termo} onChange={busca.setTermo} placeholder={t('Buscar por protocolo, texto ou torneio')} total={lista.length} achados={busca.filtrados.length} />}
      {!busca.filtrados.length
        ? <V2EmptyState icon={MessageSquareWarning} title={busca.termo.trim() && lista.length ? t('Nenhuma manifestação com esse termo') : t('Nenhuma manifestação neste filtro')} />
        : <ul className="space-y-3">{busca.visiveis.map((r) => <RelatoRow key={r.id} rep={r} />)}</ul>}
      <MostrarMais restam={busca.restam} onClick={busca.mostrarMais} />
    </section>
  );
}


export default function FedDisciplinePanel({ federation, membersQ, sanctionsQ, reportsQ, tab }) {
  if (tab === 'ouvidoria') return <OuvidoriaTab reportsQ={reportsQ} />;
  return <SancoesTab federation={federation} membersQ={membersQ} sanctionsQ={sanctionsQ} />;
}
