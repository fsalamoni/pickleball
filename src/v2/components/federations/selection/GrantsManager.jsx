/**
 * EDITAIS na Central (Bloco 3): a equipe de competições escreve o edital
 * (critérios, vagas, valor, documentos), publica — vai para o acervo oficial
 * com o módulo ligado e avisa os filiados —, analisa as inscrições quando o
 * prazo fecha, publica o resultado, julga os recursos e encerra. O financeiro
 * registra o pagamento de cada contemplado, que entra nas contas e na
 * transparência. Quem se inscreveu só vê a decisão depois do resultado.
 */
import React, { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Banknote, FileSignature, Pencil, Plus, Send, Trash2 } from 'lucide-react';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { parseBrlCents } from '@/modules/federations/domain/charges';
import { isoDate } from '@/modules/federations/domain/membership';
import {
  APPEAL_STATUS, APPLICATION_STATUS, APPLICATION_STATUS_LABELS, GRANT_DOCS_MAX, GRANT_KINDS, GRANT_KIND_LABELS, GRANT_STATUS, GRANT_STATUS_LABELS,
  grantCanFinalize, grantSlotsLeft, validateGrant,
} from '@/modules/federations/domain/selection';
import { useGrantApplications, useGrants, useSelectionAction } from '@/modules/federations/hooks/useSelection';
import { V2Badge, V2Button, V2EmptyState, V2ErrorState, V2Field, V2Input, V2Select, V2Skeleton, V2Textarea, V2Toggle } from '@/v2/ui/primitives';
import { t, tn } from '@/core/i18n';
import { reais, reaisParaCampo } from '../accounts/accountsUi';
import { GrantFileButton, TOM_EDITAL, TOM_INSCRICAO } from './selectionUi';

const ok = (msg, depois) => ({ onSuccess: (r) => { toast.success(typeof msg === 'function' ? msg(r) : msg); depois?.(r); }, onError: (e) => toast.error(e.message) });
const br = (iso) => (iso ? String(iso).split('-').reverse().join('/') : '');

/* ---------------------------------------------------------------- editor -- */

function GrantEditor({ federation, grant, onClose }) {
  const aberto = grant?.status === GRANT_STATUS.OPEN;
  const [f, setF] = useState(() => ({
    title: grant?.title || '', kind: grant?.kind || 'travel', description: grant?.description || '', criteria: grant?.criteria || '',
    valor: reaisParaCampo(grant?.amount_cents), slots: String(grant?.slots || 1), opens_at: grant?.opens_at || '', closes_at: grant?.closes_at || '',
    appeal_days: String(grant?.appeal_days || 5), members_only: grant ? grant.members_only !== false : true, required_docs: (grant?.required_docs || []).map((d) => d.label),
  }));
  const [motivo, setMotivo] = useState('');
  const set = (k, v) => setF((x) => ({ ...x, [k]: v }));
  const m = useSelectionAction(federation.id);
  const payload = { ...f, amount_cents: parseBrlCents(f.valor) || 0, slots: Number(f.slots), appeal_days: Number(f.appeal_days), required_docs: f.required_docs.filter((d) => d.trim()) };
  const r = validateGrant(payload);
  const podeSalvar = aberto ? f.closes_at > (grant.closes_at || '') && motivo.trim().length >= 3 : r.ok;
  const salvar = () => m.mutate(
    aberto ? { action: 'grant_save', grantId: grant.id, closes_at: f.closes_at, reason: motivo } : { action: 'grant_save', grantId: grant?.id, ...payload },
    ok(aberto ? t('Prazo prorrogado.') : t('Edital salvo.'), onClose),
  );
  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-h-[90dvh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{aberto ? t('Prorrogar as inscrições') : grant ? t('Editar edital') : t('Novo edital')}</DialogTitle>
          <DialogDescription>{aberto ? t('Com o edital publicado, as regras não mudam: só dá para estender o prazo de inscrição, com o motivo registrado.') : t('O edital nasce como rascunho. Publicado, as regras ficam como foram anunciadas.')}</DialogDescription>
        </DialogHeader>
        {aberto ? (
          <div className="space-y-3">
            <V2Field label={t('Novo fim das inscrições')} htmlFor="ed-prorroga" hint={t('Hoje termina em {data}.', { data: br(grant.closes_at) })}><V2Input id="ed-prorroga" type="date" min={grant.closes_at} value={f.closes_at} onChange={(e) => set('closes_at', e.target.value)} /></V2Field>
            <V2Field label={t('Motivo')} htmlFor="ed-prorroga-motivo" hint={t('Fica no histórico do edital. Mínimo 3 caracteres.')}><V2Input id="ed-prorroga-motivo" value={motivo} maxLength={300} onChange={(e) => setMotivo(e.target.value)} /></V2Field>
          </div>
        ) : (
          <div className="space-y-3">
            <V2Field label={t('Título')} htmlFor="ed-titulo" hint={t('Ex.: Auxílio-viagem para o Brasileiro 2027')}><V2Input id="ed-titulo" value={f.title} maxLength={120} onChange={(e) => set('title', e.target.value)} /></V2Field>
            <div className="grid gap-3 sm:grid-cols-3">
              <V2Field label={t('Tipo de apoio')} htmlFor="ed-tipo"><V2Select id="ed-tipo" value={f.kind} onChange={(e) => set('kind', e.target.value)} options={GRANT_KINDS.map((k) => ({ value: k, label: t(GRANT_KIND_LABELS[k]) }))} /></V2Field>
              <V2Field label={t('Vagas')} htmlFor="ed-vagas"><V2Input id="ed-vagas" type="number" min={1} max={500} value={f.slots} onChange={(e) => set('slots', e.target.value)} /></V2Field>
              <V2Field label={t('Valor por contemplado (R$)')} htmlFor="ed-valor" hint={t('Em branco se não for em dinheiro.')}><V2Input id="ed-valor" inputMode="decimal" value={f.valor} onChange={(e) => set('valor', e.target.value)} /></V2Field>
            </div>
            <V2Field label={t('Descrição')} htmlFor="ed-descricao"><V2Textarea id="ed-descricao" rows={4} maxLength={4000} value={f.description} onChange={(e) => set('description', e.target.value)} /></V2Field>
            <V2Field label={t('Critérios de seleção')} htmlFor="ed-criterios" hint={t('Como as inscrições são avaliadas e o desempate. Vai no texto oficial.')}><V2Textarea id="ed-criterios" rows={4} maxLength={4000} value={f.criteria} onChange={(e) => set('criteria', e.target.value)} /></V2Field>
            <div className="grid gap-3 sm:grid-cols-3">
              <V2Field label={t('Inscrições a partir de')} htmlFor="ed-abre" hint={t('Em branco: a partir da publicação.')}><V2Input id="ed-abre" type="date" value={f.opens_at} onChange={(e) => set('opens_at', e.target.value)} /></V2Field>
              <V2Field label={t('Inscrições até')} htmlFor="ed-fecha" error={r.errors.closes_at === 'before_open' ? t('O fim vem depois do começo.') : undefined}><V2Input id="ed-fecha" type="date" value={f.closes_at} onChange={(e) => set('closes_at', e.target.value)} /></V2Field>
              <V2Field label={t('Dias para recurso')} htmlFor="ed-recurso"><V2Input id="ed-recurso" type="number" min={1} max={15} value={f.appeal_days} onChange={(e) => set('appeal_days', e.target.value)} /></V2Field>
            </div>
            <V2Toggle id="ed-filiados" checked={f.members_only} onChange={(v) => set('members_only', v)} label={t('Só filiados em dia')} hint={t('Desligado, qualquer atleta com conta na plataforma pode se inscrever.')} />
            <div className="space-y-2">
              <p className="text-sm font-semibold text-ink">{t('Documentos pedidos')}</p>
              {f.required_docs.map((d, i) => (
                <div key={i} className="flex items-end gap-2">
                  <V2Field label={t('Documento {n}', { n: i + 1 })} htmlFor={`ed-doc-${i}`} className="flex-1"><V2Input id={`ed-doc-${i}`} value={d} maxLength={80} onChange={(e) => set('required_docs', f.required_docs.map((x, j) => (j === i ? e.target.value : x)))} /></V2Field>
                  <V2Button type="button" size="sm" variant="ghost" aria-label={t('Tirar documento {n}', { n: i + 1 })} onClick={() => set('required_docs', f.required_docs.filter((_, j) => j !== i))}><Trash2 className="h-4 w-4" /></V2Button>
                </div>
              ))}
              <V2Button type="button" size="sm" variant="ghost" disabled={f.required_docs.length >= GRANT_DOCS_MAX} onClick={() => set('required_docs', [...f.required_docs, ''])}><Plus className="h-4 w-4" />{t('Pedir documento')}</V2Button>
            </div>
          </div>
        )}
        <div className="mt-3 flex justify-end gap-2">
          <V2Button type="button" variant="ghost" onClick={onClose}>{t('Cancelar')}</V2Button>
          <V2Button type="button" disabled={!podeSalvar || m.isPending} onClick={salvar}>{aberto ? t('Prorrogar') : t('Salvar')}</V2Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/* -------------------------------------------------------------- inscrição -- */

function Decidir({ federation, app, slotsLeft }) {
  const [decisao, setDecisao] = useState(app.status === APPLICATION_STATUS.SUBMITTED ? '' : app.status);
  const [motivo, setMotivo] = useState(app.decision?.reason || '');
  const [nota, setNota] = useState(app.decision?.score == null ? '' : String(app.decision.score));
  const m = useSelectionAction(federation.id);
  const semVaga = decisao === APPLICATION_STATUS.APPROVED && app.status !== APPLICATION_STATUS.APPROVED && slotsLeft <= 0;
  const opcoes = [{ value: '', label: t('Escolha') }, ...[APPLICATION_STATUS.APPROVED, APPLICATION_STATUS.WAITLISTED, APPLICATION_STATUS.REJECTED].map((s) => ({ value: s, label: t(APPLICATION_STATUS_LABELS[s]) }))];
  const pronto = decisao && (decisao === APPLICATION_STATUS.APPROVED || motivo.trim().length >= 3) && !semVaga;
  return (
    <div className="grid items-end gap-2 sm:grid-cols-[11rem_1fr_6rem_auto]">
      <V2Field label={t('Decisão')} htmlFor={`ed-dec-${app.id}`}><V2Select id={`ed-dec-${app.id}`} value={decisao} onChange={(e) => setDecisao(e.target.value)} options={opcoes} /></V2Field>
      <V2Field label={decisao === APPLICATION_STATUS.APPROVED ? t('Observação (opcional)') : t('Motivo')} htmlFor={`ed-mot-${app.id}`} error={semVaga ? t('As vagas já estão preenchidas.') : undefined}><V2Input id={`ed-mot-${app.id}`} value={motivo} maxLength={500} onChange={(e) => setMotivo(e.target.value)} /></V2Field>
      <V2Field label={t('Nota')} htmlFor={`ed-nota-${app.id}`}><V2Input id={`ed-nota-${app.id}`} type="number" min={0} max={100} value={nota} onChange={(e) => setNota(e.target.value)} /></V2Field>
      <V2Button type="button" size="sm" disabled={!pronto || m.isPending} onClick={() => m.mutate({ action: 'grant_decide', applicationId: app.id, decision: decisao, reason: motivo, score: nota }, ok(t('Decisão registrada.')))}>{t('Registrar')}</V2Button>
    </div>
  );
}

function JulgarRecurso({ federation, app }) {
  const [acao, setAcao] = useState(null);
  const [motivo, setMotivo] = useState('');
  const m = useSelectionAction(federation.id);
  return (
    <div className="space-y-1 rounded-xl bg-amber-50 p-2">
      <p className="text-xs font-semibold text-amber-900">{t('Recurso pendente')}</p>
      <p className="whitespace-pre-line text-xs text-amber-900">{app.appeal.text}</p>
      <div className="flex gap-2">
        <V2Button type="button" size="sm" onClick={() => { setMotivo(''); setAcao('aceitar'); }}>{t('Dar provimento')}</V2Button>
        <V2Button type="button" size="sm" variant="ghost" onClick={() => { setMotivo(''); setAcao('negar'); }}>{t('Negar')}</V2Button>
      </div>
      {acao && (
        <ConfirmDialog
          open
          onOpenChange={(o) => { if (!o) setAcao(null); }}
          loading={m.isPending}
          confirmDisabled={motivo.trim().length < 3}
          title={acao === 'aceitar' ? t('Dar provimento ao recurso de {nome}?', { nome: app.user_name }) : t('Negar o recurso de {nome}?', { nome: app.user_name })}
          description={acao === 'aceitar' ? t('A pessoa passa a contemplada e entra no resultado publicado.') : t('A decisão fica como está. A pessoa recebe o motivo.')}
          confirmLabel={acao === 'aceitar' ? t('Dar provimento') : t('Negar recurso')}
          cancelLabel={t('Voltar')}
          onConfirm={() => m.mutate({ action: 'grant_appeal_decide', applicationId: app.id, accept: acao === 'aceitar', reason: motivo }, ok(t('Recurso julgado.'), () => setAcao(null)))}
        >
          <V2Field label={t('Fundamento')} htmlFor={`ed-rec-${app.id}`} hint={t('A pessoa lê este texto. Mínimo 3 caracteres.')}><V2Input id={`ed-rec-${app.id}`} value={motivo} maxLength={300} onChange={(e) => setMotivo(e.target.value)} /></V2Field>
        </ConfirmDialog>
      )}
    </div>
  );
}

function Pagar({ federation, grant, app }) {
  const [valor, setValor] = useState(reaisParaCampo(grant.amount_cents));
  const [data, setData] = useState(isoDate());
  const [desfazendo, setDesfazendo] = useState(false);
  const m = useSelectionAction(federation.id);
  if (app.payment) {
    return (
      <div className="flex flex-wrap items-center gap-2 text-xs text-green-700">
        {t('Pago {valor} em {data}.', { valor: reais(app.payment.amount_cents), data: br(app.payment.paid_at) })}
        <V2Button type="button" size="sm" variant="ghost" onClick={() => setDesfazendo(true)}>{t('Desfazer')}</V2Button>
        <ConfirmDialog
          open={desfazendo}
          onOpenChange={setDesfazendo}
          destructive
          loading={m.isPending}
          title={t('Desfazer o pagamento?')}
          description={t('A despesa sai das contas. Use só para corrigir um registro errado.')}
          confirmLabel={t('Desfazer pagamento')}
          cancelLabel={t('Voltar')}
          onConfirm={() => m.mutate({ action: 'grant_pay', applicationId: app.id, undo: true }, ok(t('Pagamento desfeito.'), () => setDesfazendo(false)))}
        />
      </div>
    );
  }
  return (
    <div className="flex flex-wrap items-end gap-2">
      <V2Field label={t('Valor pago (R$)')} htmlFor={`ed-pg-v-${app.id}`}><V2Input id={`ed-pg-v-${app.id}`} inputMode="decimal" className="w-28" value={valor} onChange={(e) => setValor(e.target.value)} /></V2Field>
      <V2Field label={t('Pago em')} htmlFor={`ed-pg-d-${app.id}`}><V2Input id={`ed-pg-d-${app.id}`} type="date" max={isoDate()} value={data} onChange={(e) => setData(e.target.value)} /></V2Field>
      <V2Button type="button" size="sm" disabled={!(parseBrlCents(valor) > 0) || !data || m.isPending} onClick={() => m.mutate({ action: 'grant_pay', applicationId: app.id, amount_cents: parseBrlCents(valor), paid_at: data }, ok(t('Pagamento registrado.')))}>
        <Banknote className="h-4 w-4" />{t('Registrar pagamento')}
      </V2Button>
    </div>
  );
}

function Inscricao({ federation, grant, app, papel, slotsLeft }) {
  const [verTexto, setVerTexto] = useState(false);
  const emAnalise = grant.status === GRANT_STATUS.REVIEW && app.status !== APPLICATION_STATUS.WITHDRAWN;
  const comResultado = [GRANT_STATUS.RESULT, GRANT_STATUS.FINAL].includes(grant.status);
  return (
    <li className="space-y-2 py-3 text-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="font-semibold text-ink">{app.user_name}{app.member_id ? '' : <span className="font-normal text-gray-500"> · {t('não filiado')}</span>}</span>
        <span className="flex items-center gap-2">
          {app.decision?.score != null && <span className="text-xs text-gray-500">{t('nota {n}', { n: app.decision.score })}</span>}
          <V2Badge tone={TOM_INSCRICAO[app.status] || 'neutral'}>{t(APPLICATION_STATUS_LABELS[app.status] || app.status)}</V2Badge>
        </span>
      </div>
      <div>
        <button type="button" className="text-xs font-semibold text-gray-600 underline" aria-expanded={verTexto} onClick={() => setVerTexto((v) => !v)}>{verTexto ? t('Esconder a justificativa') : t('Ler a justificativa')}</button>
        {verTexto && <p className="mt-1 whitespace-pre-line text-xs text-gray-700">{app.text}</p>}
      </div>
      <div className="flex flex-wrap gap-1">{Object.entries(app.files || {}).map(([k, f]) => <GrantFileButton key={k} applicationId={app.id} fileKey={k} file={f} />)}</div>
      {app.decision?.reason && !emAnalise && <p className="text-xs text-gray-600">{t('Motivo: {motivo}', { motivo: app.decision.reason })}</p>}
      {papel.equipe && emAnalise && <Decidir key={app.updated_at_ms} federation={federation} app={app} slotsLeft={slotsLeft} />}
      {papel.equipe && app.appeal?.status === APPEAL_STATUS.PENDING && <JulgarRecurso federation={federation} app={app} />}
      {app.appeal && app.appeal.status !== APPEAL_STATUS.PENDING && <p className="text-xs text-gray-600">{app.appeal.status === APPEAL_STATUS.ACCEPTED ? t('Recurso aceito: {motivo}', { motivo: app.appeal.reason || '' }) : t('Recurso negado: {motivo}', { motivo: app.appeal.reason || '' })}</p>}
      {papel.financeiro && comResultado && app.status === APPLICATION_STATUS.APPROVED && <Pagar federation={federation} grant={grant} app={app} />}
      {!papel.financeiro && app.payment && <p className="text-xs text-green-700">{t('Pago {valor} em {data}.', { valor: reais(app.payment.amount_cents), data: br(app.payment.paid_at) })}</p>}
    </li>
  );
}

/* ---------------------------------------------------------------- detalhe -- */

function GrantDetail({ federation, grant, papel, onEdit, onClose }) {
  const q = useGrantApplications(federation.id, grant.id, { enabled: grant.status !== GRANT_STATUS.DRAFT });
  const [acao, setAcao] = useState(null);
  const [motivo, setMotivo] = useState('');
  const [filtro, setFiltro] = useState('todas');
  const m = useSelectionAction(federation.id);
  const apps = useMemo(() => [...(q.data || [])].sort((a, b) => String(a.user_name).localeCompare(String(b.user_name), 'pt-BR')), [q.data]);
  const ativas = apps.filter((a) => a.status !== APPLICATION_STATUS.WITHDRAWN);
  const semDecisao = ativas.filter((a) => a.status === APPLICATION_STATUS.SUBMITTED).length;
  const vagas = grantSlotsLeft(grant, apps);
  const rascunho = grant.status === GRANT_STATUS.DRAFT;
  const visiveis = filtro === 'todas' ? apps : apps.filter((a) => (filtro === 'recurso' ? a.appeal?.status === APPEAL_STATUS.PENDING : a.status === filtro));
  const executar = () => {
    if (acao === 'publicar') m.mutate({ action: 'grant_publish', grantId: grant.id }, ok((r) => (r?.noticeCode ? t('Publicado no acervo como {codigo}.', { codigo: r.noticeCode }) : t('Edital publicado.')), () => setAcao(null)));
    if (acao === 'resultado') m.mutate({ action: 'grant_result', grantId: grant.id }, ok((r) => tn(r?.approved || 0, 'Resultado publicado: {n} contemplado.', 'Resultado publicado: {n} contemplados.'), () => setAcao(null)));
    if (acao === 'encerrar') m.mutate({ action: 'grant_finalize', grantId: grant.id }, ok(t('Edital encerrado.'), () => setAcao(null)));
    if (acao === 'cancelar') m.mutate({ action: 'grant_cancel', grantId: grant.id, reason: motivo }, ok(rascunho ? t('Rascunho apagado.') : t('Edital cancelado.'), () => { setAcao(null); onClose(); }));
  };
  const textos = {
    publicar: { title: t('Publicar o edital?'), description: federation.modules?.official_docs === true ? t('O edital entra no acervo oficial, aparece na página da federação e os filiados recebem um aviso. As regras não mudam mais.') : t('O edital aparece na página da federação e os filiados recebem um aviso. As regras não mudam mais.'), label: t('Publicar') },
    resultado: { title: t('Publicar o resultado?'), description: t('Os contemplados aparecem na página da federação, todos recebem um aviso e começa o prazo de recurso de {n} dia(s).', { n: grant.appeal_days || 5 }), label: t('Publicar resultado') },
    encerrar: { title: t('Encerrar o edital?'), description: t('O resultado vira definitivo. Os pagamentos continuam sendo registrados.'), label: t('Encerrar') },
    cancelar: { title: rascunho ? t('Apagar o rascunho?') : t('Cancelar o edital?'), description: rascunho ? t('Ninguém viu o edital: o rascunho some.') : t('Quem se inscreveu recebe um aviso com o motivo.'), label: rascunho ? t('Apagar') : t('Cancelar edital') },
  };
  const filtros = [
    { value: 'todas', label: t('Todas') },
    ...Object.values(APPLICATION_STATUS).map((s) => ({ value: s, label: t(APPLICATION_STATUS_LABELS[s]) })),
    { value: 'recurso', label: t('Com recurso pendente') },
  ];
  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-h-[90dvh] max-w-3xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{grant.title}</DialogTitle>
          <DialogDescription>{[t(GRANT_KIND_LABELS[grant.kind] || ''), tn(grant.slots || 1, '{n} vaga', '{n} vagas'), grant.amount_cents ? reais(grant.amount_cents) : '', grant.closes_at ? t('inscrições até {data}', { data: br(grant.closes_at) }) : ''].filter(Boolean).join(' · ')}</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <V2Badge tone={TOM_EDITAL[grant.status] || 'neutral'}>{t(GRANT_STATUS_LABELS[grant.status] || grant.status)}</V2Badge>
            {grant.notice_code && <span className="text-sm text-gray-600">{t('Acervo: {codigo}', { codigo: grant.notice_code })}</span>}
            {grant.appeal_until && grant.status === GRANT_STATUS.RESULT && <span className="text-sm text-gray-600">{t('recurso até {data}', { data: br(grant.appeal_until) })}</span>}
            {!rascunho && q.isSuccess && <span className="text-sm text-gray-600">{tn(ativas.length, '{n} inscrição', '{n} inscrições')} · {tn(vagas, '{n} vaga livre', '{n} vagas livres')}</span>}
          </div>
          {grant.cancel_reason && <p className="text-sm text-gray-600">{t('Motivo do cancelamento: {motivo}', { motivo: grant.cancel_reason })}</p>}
          {papel.equipe && (
            <div className="flex flex-wrap gap-2">
              {[GRANT_STATUS.DRAFT, GRANT_STATUS.OPEN].includes(grant.status) && <V2Button type="button" size="sm" variant="secondary" onClick={onEdit}><Pencil className="h-4 w-4" />{rascunho ? t('Editar') : t('Prorrogar inscrições')}</V2Button>}
              {rascunho && <V2Button type="button" size="sm" onClick={() => setAcao('publicar')}><Send className="h-4 w-4" />{t('Publicar')}</V2Button>}
              {grant.status === GRANT_STATUS.REVIEW && <V2Button type="button" size="sm" disabled={!q.isSuccess || semDecisao > 0} onClick={() => setAcao('resultado')}>{t('Publicar resultado')}</V2Button>}
              {grant.status === GRANT_STATUS.RESULT && <V2Button type="button" size="sm" variant="secondary" disabled={!q.isSuccess || !grantCanFinalize(grant, apps, isoDate())} onClick={() => setAcao('encerrar')}>{t('Encerrar')}</V2Button>}
              {![GRANT_STATUS.FINAL, GRANT_STATUS.CANCELLED].includes(grant.status) && !(grant.payments || []).length && <V2Button type="button" size="sm" variant="ghost" onClick={() => { setMotivo(''); setAcao('cancelar'); }}>{rascunho ? t('Apagar rascunho') : t('Cancelar edital')}</V2Button>}
            </div>
          )}
          {grant.status === GRANT_STATUS.OPEN && <p className="text-sm text-gray-600">{t('As inscrições fecham sozinhas no fim do prazo e o edital passa para análise.')}</p>}
          {grant.status === GRANT_STATUS.REVIEW && semDecisao > 0 && <p className="text-sm text-amber-800">{tn(semDecisao, 'Falta decidir {n} inscrição para publicar o resultado.', 'Faltam decidir {n} inscrições para publicar o resultado.')}</p>}
          {grant.status === GRANT_STATUS.RESULT && q.isSuccess && !grantCanFinalize(grant, apps, isoDate()) && <p className="text-sm text-gray-600">{t('O edital encerra depois do prazo de recurso, com todos os recursos julgados.')}</p>}
          {!rascunho && (
            <section className="space-y-2">
              <div className="flex flex-wrap items-end justify-between gap-2">
                <p className="text-sm font-semibold text-ink">{t('Inscrições')}</p>
                {apps.length > 0 && <V2Field label={t('Mostrar')} htmlFor={`ed-filtro-${grant.id}`}><V2Select id={`ed-filtro-${grant.id}`} value={filtro} onChange={(e) => setFiltro(e.target.value)} options={filtros} /></V2Field>}
              </div>
              {q.isError && <V2ErrorState inline title={t('Não carregaram as inscrições')} onRetry={() => q.refetch()} />}
              {q.isLoading && <V2Skeleton lines={3} />}
              {q.isSuccess && !apps.length && <p className="text-sm text-gray-500">{t('Ninguém se inscreveu ainda.')}</p>}
              {q.isSuccess && apps.length > 0 && !visiveis.length && <p className="text-sm text-gray-500">{t('Nenhuma inscrição neste filtro.')}</p>}
              {visiveis.length > 0 && <ul className="divide-y divide-gray-100 rounded-2xl border border-gray-100 px-3">{visiveis.map((a) => <Inscricao key={a.id} federation={federation} grant={grant} app={a} papel={papel} slotsLeft={vagas} />)}</ul>}
            </section>
          )}
        </div>
        {acao && (
          <ConfirmDialog
            open
            destructive={acao === 'cancelar'}
            onOpenChange={(o) => { if (!o) setAcao(null); }}
            loading={m.isPending}
            confirmDisabled={acao === 'cancelar' && !rascunho && motivo.trim().length < 3}
            title={textos[acao].title}
            description={textos[acao].description}
            confirmLabel={textos[acao].label}
            cancelLabel={t('Voltar')}
            onConfirm={executar}
          >
            {acao === 'cancelar' && !rascunho && <V2Field label={t('Motivo')} htmlFor="ed-motivo" hint={t('Quem se inscreveu lê este texto. Mínimo 3 caracteres.')}><V2Input id="ed-motivo" value={motivo} maxLength={300} onChange={(e) => setMotivo(e.target.value)} /></V2Field>}
          </ConfirmDialog>
        )}
      </DialogContent>
    </Dialog>
  );
}

/* ------------------------------------------------------------------ lista -- */

export default function GrantsManager({ federation, papel }) {
  const q = useGrants(federation.id);
  const [editando, setEditando] = useState(null);
  const [abertoId, setAbertoId] = useState(null);
  const lista = useMemo(() => [...(q.data || [])].sort((a, b) => (b.created_at_ms || 0) - (a.created_at_ms || 0)), [q.data]);
  const aberto = lista.find((g) => g.id === abertoId) || null;
  if (q.isError) return <V2ErrorState title={t('Não carregaram os editais')} onRetry={() => q.refetch()} />;
  if (q.isLoading) return <V2Skeleton lines={5} />;
  return (
    <div className="space-y-3" data-dica="federacao-aba-editais">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-gray-600">{t('Apoio ao atleta com regra pública: auxílio-viagem, bolsa, material. O pagamento entra nas contas e na transparência.')}</p>
        {papel.equipe && <V2Button type="button" size="sm" onClick={() => setEditando({})} data-dica="federacao-novo-edital"><Plus className="h-4 w-4" />{t('Novo edital')}</V2Button>}
      </div>
      {!lista.length && <V2EmptyState icon={FileSignature} title={t('Nenhum edital ainda')} description={papel.equipe ? t('Crie o primeiro para abrir inscrições de apoio ao atleta.') : t('Quando a equipe de competições publicar um, os contemplados aparecem aqui para pagamento.')} />}
      <ul className="space-y-2">
        {lista.map((g) => (
          <li key={g.id}>
            <button type="button" onClick={() => setAbertoId(g.id)} className="w-full rounded-2xl border border-gray-100 bg-white p-3 text-left hover:border-gray-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink">
              <span className="flex flex-wrap items-center gap-2 font-semibold text-ink">{g.title}<V2Badge tone={TOM_EDITAL[g.status] || 'neutral'}>{t(GRANT_STATUS_LABELS[g.status] || g.status)}</V2Badge></span>
              <span className="mt-0.5 block text-xs text-gray-500">{[t(GRANT_KIND_LABELS[g.kind] || ''), tn(g.slots || 1, '{n} vaga', '{n} vagas'), g.closes_at ? t('inscrições até {data}', { data: br(g.closes_at) }) : '', (g.payments || []).length ? tn(g.payments.length, '{n} pagamento', '{n} pagamentos') : ''].filter(Boolean).join(' · ')}</span>
            </button>
          </li>
        ))}
      </ul>
      {editando && <GrantEditor federation={federation} grant={editando.id ? editando : null} onClose={() => setEditando(null)} />}
      {aberto && !editando && <GrantDetail federation={federation} grant={aberto} papel={papel} onEdit={() => setEditando(aberto)} onClose={() => setAbertoId(null)} />}
    </div>
  );
}
