/**
 * O que a PESSOA filiada faz além de pagar e abrir a carteirinha (PR 3), na
 * página da federação e na Minha área:
 *  - `FedMemberDocuments`: os documentos que o plano exige — enviar (PDF ou
 *    imagem, até 5 MB, para a pasta `federacao/{uid}/`), ver o estado,
 *    apagar enquanto está em análise, reenviar o recusado;
 *  - `FedTransferDialog`: pedir troca de clube representado ou saída para
 *    outra federação (a antiga libera; D9), com carência e prazo da federação;
 *  - `FedMySanctions`: as sanções da pessoa (só ela vê — D11) e o recurso, um só.
 * Tudo que decide é do servidor; a tela pede.
 */
import React, { useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import { ArrowLeftRight, FileUp, Gavel, Trash2 } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { useAuth } from '@/core/lib/FirebaseAuthContext';
import { useMyClubs } from '@/modules/clubs/hooks/useClubs';
import { deleteMyDocument, disciplineAction, membershipAction, transferAction, uploadMemberDocument } from '@/modules/federations/services/federationService';
import { LIVE_MEMBER_STATUSES } from '@/modules/federations/domain/membership';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { useFederationMutation, useMyDocuments, useMySanctions, useMyTransfers, usePublicFederations } from '@/modules/federations/hooks/useFederations';
import { docLabel, requiredDocs, requiredDocsStatus, submittedDocKey, validateDocumentFile } from '@/modules/federations/domain/privateData';
import { canRequestTransfer, isReleaseOverdue, sortTransfers, transferReleaseDays, transferSummary, validateTransferInput } from '@/modules/federations/domain/transfers';
import { canAppeal, sanctionInForce, sortSanctions } from '@/modules/federations/domain/discipline';
import { formatBrlCents } from '@/modules/federations/domain/charges';
import { MEMBER_STATUS, DISCIPLINE_KIND, DISCIPLINE_KIND_LABELS, DISCIPLINE_STATUS_LABELS, DOC_STATUS_LABELS, TRANSFER_KIND, TRANSFER_KIND_LABELS, TRANSFER_STATUS, TRANSFER_STATUS_LABELS } from '@/modules/federations/domain/constants';
import { V2Badge, V2Button, V2ErrorState, V2Field, V2Select, V2Skeleton, V2Surface, V2Textarea } from '@/v2/ui/primitives';
import { t } from '@/core/i18n';
import { quando } from './federationUi';

const TOM_DOC = { pending: 'amber', approved: 'green', rejected: 'red', missing: 'neutral' };

/* ---------------------------------------------- desistir / cancelar a filiação -- */

/**
 * Desistir do pedido (ainda pendente ou esperando o Pix) ou cancelar a
 * filiação — a pessoa, ou o responsável pelo dependente. O servidor já
 * aceitava (`membership` → `cancel`); faltava a porta, e quem pediu na
 * federação errada ficava preso até a secretaria agir.
 */
export function FedCancelMembership({ member, size = 'sm', className = '' }) {
  const [aberto, setAberto] = useState(false);
  const m = useFederationMutation(() => membershipAction({ federationId: member.federation_id, action: 'cancel', memberId: member.id }));
  if (!member || !LIVE_MEMBER_STATUSES.includes(member.status)) return null;
  const pedido = [MEMBER_STATUS.PENDING, MEMBER_STATUS.AWAITING_PAYMENT].includes(member.status);
  const dependente = !member.user_id && member.user_name;
  const confirmar = () => m.mutate(undefined, {
    onSuccess: () => { setAberto(false); toast.success(pedido ? t('Pedido cancelado.') : t('Filiação cancelada.')); },
    onError: (e) => toast.error(e.message),
  });
  return (
    <>
      <V2Button type="button" variant="ghost" size={size} className={className} onClick={() => setAberto(true)}>{pedido ? t('Desistir do pedido') : t('Cancelar a filiação')}</V2Button>
      <ConfirmDialog
        open={aberto}
        onOpenChange={setAberto}
        destructive
        loading={m.isPending}
        title={pedido ? t('Desistir do pedido de filiação?') : dependente ? t('Cancelar a filiação de {nome}?', { nome: member.user_name }) : t('Cancelar a sua filiação?')}
        description={pedido
          ? t('O pedido sai da fila da secretaria e a cobrança dele, se houver, é cancelada. Você pode pedir de novo depois.')
          : t('A filiação termina agora: a carteirinha deixa de valer e as cobranças em aberto são canceladas. O que já foi pago fica com a federação; para voltar, é um pedido novo.')}
        confirmLabel={pedido ? t('Desistir do pedido') : t('Cancelar a filiação')}
        cancelLabel={t('Voltar')}
        onConfirm={confirmar}
      />
    </>
  );
}

/* ------------------------------------------------------------- documentos -- */

function EnviarDocumento({ member, req, rotulo = t('Enviar') }) {
  const { user } = useAuth();
  const input = useRef(null);
  const m = useFederationMutation((file) => uploadMemberDocument({ member, kind: req.kind, docKey: req.key, label: req.label, file, uid: user?.uid }));
  const escolher = (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    const erro = validateDocumentFile(file);
    if (erro) { toast.error(erro); return; }
    m.mutate(file, { onSuccess: () => toast.success(t('Documento enviado. A secretaria confere.')), onError: (er) => toast.error(er.message) });
  };
  return (
    <>
      <V2Button type="button" size="sm" variant="secondary" disabled={m.isPending} onClick={() => input.current?.click()}><FileUp className="h-4 w-4" />{m.isPending ? t('Enviando…') : rotulo}</V2Button>
      <input ref={input} type="file" accept="application/pdf,image/jpeg,image/png,image/webp" className="sr-only" onChange={escolher} aria-label={t('Arquivo do documento: {tipo}', { tipo: docLabel(req) })} />
    </>
  );
}

/**
 * Os documentos de UMA filiação. `plan` diz os exigidos; o que a pessoa
 * enviou além deles também aparece. Sem plano exigindo nada e sem envio, não
 * renderiza — a seção só existe quando há o que fazer ou ver.
 */
export function FedMemberDocuments({ member, plan, compacto = false }) {
  const dq = useMyDocuments({ enabled: Boolean(member) });
  const [apagando, setApagando] = useState(null);
  const apagar = useFederationMutation((docu) => deleteMyDocument(docu));
  const meus = useMemo(() => (dq.data || []).filter((d) => d.member_id === member?.id), [dq.data, member?.id]);
  const exigidos = useMemo(() => requiredDocsStatus(plan, meus), [plan, meus]);
  const chaves = requiredDocs(plan).map((x) => x.key);
  const extras = meus.filter((d) => !chaves.includes(submittedDocKey(d)));
  if (!member) return null;
  if (dq.isError) return <V2ErrorState inline title={t('Não carregaram os seus documentos')} onRetry={() => dq.refetch()} />;
  if (dq.isLoading) return <V2Skeleton lines={2} />;
  if (!exigidos.length && !extras.length) return null;
  const linha = (req, status, docu) => (
    <li key={docu?.id || req.key} className="flex flex-wrap items-center gap-2 text-sm">
      <span className="font-semibold text-ink">{docLabel(req)}</span>
      <V2Badge tone={TOM_DOC[status] || 'neutral'}>{status === 'missing' ? t('Falta enviar') : t(DOC_STATUS_LABELS[status] || status)}</V2Badge>
      {docu?.review?.reason && status === 'rejected' && <span className="text-xs text-red-600">{docu.review.reason}</span>}
      <span className="ml-auto flex items-center gap-1">
        {(status === 'missing' || status === 'rejected') && <EnviarDocumento member={member} req={req} rotulo={status === 'rejected' ? t('Enviar outro') : t('Enviar')} />}
        {docu && status === 'pending' && (
          <V2Button type="button" size="sm" variant="ghost" aria-label={t('Apagar {tipo}', { tipo: docLabel(req) })} disabled={apagar.isPending && apagando === docu.id} onClick={() => { setApagando(docu.id); apagar.mutate(docu, { onSuccess: () => toast.success(t('Documento apagado.')), onError: (e) => toast.error(e.message) }); }}><Trash2 className="h-4 w-4" /></V2Button>
        )}
      </span>
    </li>
  );
  return (
    <div className={compacto ? 'space-y-2' : 'space-y-3'} data-dica="federacao-documentos-meus">
      {!compacto && <p className="text-sm font-semibold text-ink">{t('Documentos do plano')}</p>}
      <ul className="space-y-2">
        {exigidos.map((x) => linha(x, x.status, x.doc))}
        {extras.map((d) => linha({ key: submittedDocKey(d), kind: d.kind, label: d.label || null }, d.status, d))}
      </ul>
      <p className="text-xs text-gray-500">{t('PDF ou imagem até 5 MB. Só você e a secretaria da federação veem o arquivo; ele some quando você exclui a conta.')}</p>
    </div>
  );
}

/* ---------------------------------------------------------- transferência -- */

export function FedTransferDialog({ member, federation, onClose }) {
  const tq = useMyTransfers();
  const fq = usePublicFederations();
  const clubes = useMyClubs();
  const [f, setF] = useState({ kind: TRANSFER_KIND.CLUB, to_club_id: '', to_federation_id: '', reason: '' });
  const [erros, setErros] = useState({});
  const m = useFederationMutation((payload) => transferAction(payload));
  const minhas = (tq.data || []).filter((x) => x.member_id === member.id);
  const pode = canRequestTransfer(member, { pending: minhas, federation });
  const outras = (fq.data || []).filter((x) => x.id !== federation.id);
  const enviar = (e) => {
    e.preventDefault();
    const r = validateTransferInput(f, { member });
    if (!r.ok) { setErros(r.errors); return; }
    const clube = (clubes.data || []).find((c) => (c.club_id || c.id) === r.value.to_club_id);
    const destino = outras.find((x) => x.id === r.value.to_federation_id);
    m.mutate({ action: 'request', federationId: federation.id, memberId: member.id, kind: r.value.kind, toClubId: r.value.to_club_id, toClubName: clube ? (clube.club_name || clube.name || '') : '', toFederationId: r.value.to_federation_id, reason: r.value.reason, toFederationName: destino?.name || '' }, {
      onSuccess: () => { toast.success(t('Transferência pedida. A federação responde pelo sino.')); onClose(); },
      onError: (er) => toast.error(er.message),
    });
  };
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent sheet className="max-w-lg">
        <DialogTitle>{t('Pedir transferência')}</DialogTitle>
        <DialogDescription>{t('Troca de clube representado (a {sigla} decide) ou saída para outra federação (a {sigla} libera; sem resposta em {dias} dias, libera sozinha).', { sigla: federation.acronym || federation.name, dias: transferReleaseDays(federation) })}</DialogDescription>
        {tq.isError && <V2ErrorState inline title={t('Não carregaram as suas transferências')} onRetry={() => tq.refetch()} />}
        {tq.isLoading && <V2Skeleton lines={2} />}
        {tq.isSuccess && !pode.ok && <p className="text-sm font-semibold text-amber-700">{pode.reason}</p>}
        {tq.isSuccess && pode.ok && (
          <form onSubmit={enviar} noValidate className="space-y-4">
            <V2Field label={t('O que você quer trocar')} htmlFor="tr-tipo" error={erros.kind}>
              <V2Select id="tr-tipo" value={f.kind} onChange={(e) => { setF((x) => ({ ...x, kind: e.target.value })); setErros({}); }}>{Object.values(TRANSFER_KIND).map((k) => <option key={k} value={k}>{t(TRANSFER_KIND_LABELS[k])}</option>)}</V2Select>
            </V2Field>
            {f.kind === TRANSFER_KIND.CLUB && (
              <V2Field label={t('Novo clube')} htmlFor="tr-clube" error={erros.to_club_id} hint={t('Só os clubes de que você é membro. "Nenhum" tira o clube atual.')}>
                <V2Select id="tr-clube" value={f.to_club_id} onChange={(e) => { setF((x) => ({ ...x, to_club_id: e.target.value })); setErros({}); }}>
                  <option value="">{t('Nenhum')}</option>
                  {(clubes.data || []).map((c) => <option key={c.club_id || c.id} value={c.club_id || c.id}>{c.club_name || c.name}</option>)}
                </V2Select>
              </V2Field>
            )}
            {f.kind === TRANSFER_KIND.FEDERATION && (
              <V2Field label={t('Federação de destino')} htmlFor="tr-fed" error={erros.to_federation_id}>
                {fq.isError ? <V2ErrorState inline title={t('Não carregaram as federações')} onRetry={() => fq.refetch()} /> : (
                  <V2Select id="tr-fed" value={f.to_federation_id} onChange={(e) => { setF((x) => ({ ...x, to_federation_id: e.target.value })); setErros({}); }}>
                    <option value="">{t('Escolha…')}</option>
                    {outras.map((x) => <option key={x.id} value={x.id}>{x.acronym ? `${x.acronym} · ${x.name}` : x.name}</option>)}
                  </V2Select>
                )}
              </V2Field>
            )}
            <V2Field label={t('Motivo (opcional)')} htmlFor="tr-motivo"><V2Textarea id="tr-motivo" rows={2} maxLength={500} value={f.reason} onChange={(e) => setF((x) => ({ ...x, reason: e.target.value }))} /></V2Field>
            <div className="flex justify-end gap-2"><V2Button type="button" variant="ghost" onClick={onClose}>{t('Voltar')}</V2Button><V2Button type="submit" disabled={m.isPending}><ArrowLeftRight className="h-4 w-4" />{t('Pedir transferência')}</V2Button></div>
          </form>
        )}
        {minhas.length > 0 && (
          <ul className="space-y-1 border-t border-gray-100 pt-3 text-xs text-gray-600">
            {sortTransfers(minhas).slice(0, 5).map((x) => <li key={x.id} className="flex flex-wrap items-center gap-2">{t(TRANSFER_KIND_LABELS[x.kind] || x.kind)} {transferSummary(x)} · {quando(x.requested_at)}<V2Badge tone={{ pending: 'amber', approved: 'green', rejected: 'red' }[x.status] || 'neutral'}>{t(TRANSFER_STATUS_LABELS[x.status] || x.status)}</V2Badge>{isReleaseOverdue(x) && <span>{t('prazo vencido · libera sozinha')}</span>}{x.status === TRANSFER_STATUS.PENDING && <CancelarTransferencia tr={x} />}</li>)}
          </ul>
        )}
      </DialogContent>
    </Dialog>
  );
}

function CancelarTransferencia({ tr }) {
  const [aberto, setAberto] = useState(false);
  const m = useFederationMutation(() => transferAction({ action: 'cancel', transferId: tr.id }));
  return (
    <>
      <V2Button type="button" size="sm" variant="ghost" disabled={m.isPending} onClick={() => setAberto(true)}>{t('Cancelar o pedido')}</V2Button>
      <ConfirmDialog
        open={aberto}
        onOpenChange={setAberto}
        destructive
        loading={m.isPending}
        title={t('Cancelar o pedido de transferência?')}
        description={t('O pedido sai da análise da federação e nada muda na sua filiação. Para trocar depois, é preciso fazer um pedido novo.')}
        confirmLabel={t('Cancelar o pedido')}
        cancelLabel={t('Voltar')}
        onConfirm={() => m.mutate(undefined, { onSuccess: () => { setAberto(false); toast.success(t('Transferência cancelada.')); }, onError: (e) => toast.error(e.message) })}
      />
    </>
  );
}

/* ---------------------------------------------------------------- sanções -- */

function Recurso({ s }) {
  const [aberto, setAberto] = useState(false);
  const [texto, setTexto] = useState('');
  const m = useFederationMutation(() => disciplineAction({ action: 'appeal', sanctionId: s.id, text: texto }));
  if (!aberto) return <V2Button type="button" size="sm" variant="secondary" onClick={() => setAberto(true)}>{t('Recorrer')}</V2Button>;
  return (
    <form className="w-full space-y-2" onSubmit={(e) => { e.preventDefault(); if (texto.trim().length < 20) { toast.error(t('Escreva o recurso (mínimo 20 caracteres).')); return; } m.mutate(undefined, { onSuccess: () => { toast.success(t('Recurso enviado. A federação decide e avisa pelo sino.')); setAberto(false); }, onError: (er) => toast.error(er.message) }); }}>
      <V2Field label={t('Seu recurso (uma vez só)')} htmlFor={`rec-${s.id}`}><V2Textarea id={`rec-${s.id}`} rows={3} maxLength={2000} value={texto} onChange={(e) => setTexto(e.target.value)} autoFocus /></V2Field>
      <div className="flex justify-end gap-2"><V2Button type="button" size="sm" variant="ghost" onClick={() => setAberto(false)}>{t('Voltar')}</V2Button><V2Button type="submit" size="sm" disabled={m.isPending}>{t('Enviar recurso')}</V2Button></div>
    </form>
  );
}

/** As sanções da pessoa (e dos dependentes) numa federação — ou em todas, sem `federationId`. */
export function FedMySanctions({ federationId = null, titulo = true }) {
  const sq = useMySanctions();
  if (sq.isError) return <V2ErrorState inline title={t('Não carregaram as suas sanções')} onRetry={() => sq.refetch()} />;
  if (!sq.isSuccess) return null;
  const lista = sortSanctions((sq.data || []).filter((s) => !federationId || s.federation_id === federationId));
  if (!lista.length) return null;
  return (
    <V2Surface variant="compacto" className="space-y-3 p-4" data-dica="federacao-minhas-sancoes">
      {titulo && <p className="flex items-center gap-2 font-bold text-ink"><Gavel className="h-4 w-4" aria-hidden="true" />{t('Sanções disciplinares')}</p>}
      <ul className="space-y-3">
        {lista.map((s) => (
          <li key={s.id} className="space-y-2 text-sm">
            <p className="flex flex-wrap items-center gap-2"><span className="font-semibold text-ink">{t(DISCIPLINE_KIND_LABELS[s.kind] || s.kind)}</span>{!federationId && <span className="text-gray-500">{s.federation_acronym}</span>}{s.user_name && s.guardian_uid && <span className="text-gray-500">· {s.user_name}</span>}<V2Badge tone={sanctionInForce(s) ? 'red' : 'neutral'}>{t(DISCIPLINE_STATUS_LABELS[s.status] || s.status)}</V2Badge></p>
            <p className="text-gray-700">{s.reason}</p>
            <p className="text-xs text-gray-500">{quando(s.created_at_ms)}{s.kind === DISCIPLINE_KIND.SUSPENSION ? ` · ${t('até {data}', { data: quando(s.ends_at) })}` : ''}{s.kind === DISCIPLINE_KIND.FINE ? ` · ${formatBrlCents(s.fine_cents)} · ${t('a cobrança está em pagamentos')}` : ''}</p>
            {s.appeal_decision?.note && <p className="text-xs text-gray-600">{t('Decisão: {nota}', { nota: s.appeal_decision.note })}</p>}
            {canAppeal(s) && <Recurso s={s} />}
          </li>
        ))}
      </ul>
      <p className="text-xs text-gray-500">{t('Só você e a federação veem isto.')} <Link to="/ajuda?s=atleta&a=federacoes-filiar" className="underline">{t('Como funciona')}</Link></p>
    </V2Surface>
  );
}
