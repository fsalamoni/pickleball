/**
 * OS EDITAIS DE SEDE no cartão "Federação" do clube e da arena (Bloco 3b).
 * Quem gere a organização vê os editais abertos das federações em que ela é
 * FILIADA (e das confederações delas), manda a carta de intenção, a proposta
 * quando é selecionada, e acompanha a fase da candidatura. Os arquivos da
 * proposta ficam na pasta de quem envia e só a equipe da federação os abre.
 */
import React, { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { MapPin, Paperclip, X } from 'lucide-react';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useAuth } from '@/core/lib/FirebaseAuthContext';
import { fedModuleOn } from '@/modules/federations/domain/federation';
import { isoDate } from '@/modules/federations/domain/membership';
import { isConfederation, nationalBodyOf } from '@/modules/federations/domain/national';
import { validateDocumentFile } from '@/modules/federations/domain/privateData';
import {
  HOST_BID_STATUS as BS, HOST_ENTRY_STAGE as ES, HOST_ENTRY_STAGE_LABELS, HOST_LIMITS, hostBidPhase, hostEntryId, validateHostIntent, validateHostProposal,
} from '@/modules/federations/domain/hosting';
import { useHostingAction, useOrgHostEntries, usePublicHostBidsOf } from '@/modules/federations/hooks/useHosting';
import { uploadProposalFiles } from '@/modules/federations/services/hostingService';
import { V2Badge, V2Button, V2ErrorState, V2Field, V2Textarea } from '@/v2/ui/primitives';
import { t } from '@/core/i18n';
import { ProposalFileButton, TOM_CANDIDATURA, br, periodo } from './hostingUi';

function IntentDialog({ bid, kind, org, entry, onClose }) {
  const [texto, setTexto] = useState(entry?.intent?.text || '');
  const m = useHostingAction(bid.federation_id);
  const r = validateHostIntent({ text: texto });
  return (
    <ConfirmDialog
      open
      onOpenChange={(o) => { if (!o) onClose(); }}
      loading={m.isPending}
      confirmDisabled={!r.ok}
      title={t('Carta de intenção para {evento}', { evento: bid.event_name })}
      description={t('Diga por que {org} quer sediar e o que tem a oferecer. A equipe da federação escolhe quem segue para a proposta completa.', { org: org.name || '' })}
      confirmLabel={t('Mandar a carta')}
      cancelLabel={t('Voltar')}
      onConfirm={() => m.mutate({ action: 'entry_intent', bidId: bid.id, kind, orgId: org.id, text: texto }, { onSuccess: () => { toast.success(t('Carta enviada. A federação foi avisada.')); onClose(); }, onError: (e) => toast.error(e.message) })}
    >
      <V2Field label={t('Carta')} htmlFor={`sd-carta-${bid.id}`} error={texto && !r.ok ? r.errors.text : undefined}><V2Textarea id={`sd-carta-${bid.id}`} rows={6} maxLength={HOST_LIMITS.INTENT_MAX} value={texto} onChange={(e) => setTexto(e.target.value)} /></V2Field>
    </ConfirmDialog>
  );
}

function ProposalDialog({ bid, kind, org, entry, onClose }) {
  const { user } = useAuth();
  const [texto, setTexto] = useState(entry?.proposal?.text || '');
  const [arquivos, setArquivos] = useState([]);
  const [enviando, setEnviando] = useState(false);
  const m = useHostingAction(bid.federation_id);
  const r = validateHostProposal({ text: texto }, user?.uid);
  const escolher = (file) => {
    const erro = file && validateDocumentFile(file);
    if (erro) { toast.error(erro); return; }
    if (file) setArquivos((xs) => [...xs, file].slice(0, HOST_LIMITS.FILES_MAX));
  };
  const enviar = async () => {
    setEnviando(true);
    try {
      const files = await uploadProposalFiles(user?.uid, arquivos);
      await m.mutateAsync({ action: 'entry_proposal', bidId: bid.id, kind, orgId: org.id, text: texto, files });
      toast.success(t('Proposta enviada.'));
      onClose();
    } catch (e) { toast.error(e.message); } finally { setEnviando(false); }
  };
  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-h-[90dvh] max-w-xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t('Proposta para sediar {evento}', { evento: bid.event_name })}</DialogTitle>
          <DialogDescription>{t('Responda a cada critério do edital: a comissão dá nota em cada um. Mandar de novo substitui a proposta anterior.')}</DialogDescription>
        </DialogHeader>
        <ul className="space-y-1 text-xs text-gray-600">{(bid.criteria || []).map((c) => <li key={c.id}>• {c.label}</li>)}</ul>
        <V2Field label={t('Proposta')} htmlFor={`sd-prop-${bid.id}`} error={texto && !r.ok ? r.errors.text : undefined}><V2Textarea id={`sd-prop-${bid.id}`} rows={8} maxLength={HOST_LIMITS.PROPOSAL_MAX} value={texto} onChange={(e) => setTexto(e.target.value)} /></V2Field>
        <div className="space-y-2">
          <p className="text-sm font-semibold text-ink">{t('Anexos (planta, fotos, cartas de apoio)')}</p>
          {arquivos.map((a, i) => (
            <span key={`${a.name}-${i}`} className="flex items-center gap-1 text-sm text-gray-700">{a.name}
              <button type="button" className="inline-flex h-11 w-11 items-center justify-center rounded-full text-gray-500 hover:bg-gray-100" aria-label={t('Tirar {nome}', { nome: a.name })} onClick={() => setArquivos((xs) => xs.filter((_, j) => j !== i))}><X className="h-4 w-4" /></button>
            </span>
          ))}
          {arquivos.length < HOST_LIMITS.FILES_MAX && (
            <label className="inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-full border border-gray-200 px-3 text-sm text-ink hover:bg-gray-50">
              <Paperclip className="h-4 w-4" aria-hidden="true" />{t('Anexar arquivo')}
              <input type="file" className="sr-only" accept="application/pdf,image/jpeg,image/png,image/webp" onChange={(e) => { escolher(e.target.files?.[0]); e.target.value = ''; }} />
            </label>
          )}
          {entry?.proposal?.files?.length > 0 && !arquivos.length && <p className="text-xs text-gray-500">{t('Sem anexo novo, a proposta segue sem anexos. Mande de novo os que quiser manter.')}</p>}
        </div>
        <div className="mt-3 flex justify-end gap-2">
          <V2Button type="button" variant="ghost" onClick={onClose}>{t('Cancelar')}</V2Button>
          <V2Button type="button" disabled={!r.ok || enviando} onClick={enviar}>{enviando ? t('Enviando…') : t('Mandar a proposta')}</V2Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function EditalLinha({ bid, kind, org, entry }) {
  const [dialogo, setDialogo] = useState('');
  const m = useHostingAction(bid.federation_id);
  const fase = hostBidPhase(bid, isoDate());
  const podeCarta = fase.acceptsIntent && (!entry || [ES.INTENT, ES.WITHDRAWN].includes(entry.stage));
  const podeProposta = fase.acceptsProposal && entry && [ES.SHORTLISTED, ES.PROPOSAL].includes(entry.stage);
  const podeRetirar = entry && [BS.INTENT, BS.PROPOSAL, BS.REVIEW].includes(bid.status) && ![ES.WITHDRAWN, ES.NOT_SHORTLISTED].includes(entry.stage);
  return (
    <li className="space-y-2 rounded-2xl border border-gray-100 bg-white p-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="flex items-center gap-2 text-sm font-semibold text-ink"><MapPin className="h-4 w-4" aria-hidden="true" />{t('Edital de sede: {evento} · {sigla}', { evento: bid.event_name, sigla: bid.federation_acronym || bid.federation_name })}</p>
          <p className="text-xs text-gray-500">{[periodo(bid.event_start, bid.event_end), t('cartas até {carta} · propostas até {proposta}', { carta: br(bid.intent_until), proposta: br(bid.proposal_until) })].join(' · ')}</p>
        </div>
        {entry && <V2Badge tone={TOM_CANDIDATURA[entry.stage] || 'neutral'}>{t(HOST_ENTRY_STAGE_LABELS[entry.stage] || entry.stage)}</V2Badge>}
      </div>
      {entry?.stage === ES.SHORTLISTED && <p className="text-sm text-green-700">{t('Selecionada! Mande a proposta completa até {data}.', { data: br(bid.proposal_until) })}</p>}
      {bid.result && entry && <p className="text-sm text-gray-700">{t('Sede escolhida: {org}', { org: bid.result.winner_name })}</p>}
      {entry?.proposal?.files?.length > 0 && <div className="flex flex-wrap gap-1">{entry.proposal.files.map((file, i) => <ProposalFileButton key={file.path} federationId={bid.federation_id} entryId={entry.id} index={i} file={file} />)}</div>}
      <div className="flex flex-wrap gap-2">
        {podeCarta && <V2Button type="button" size="sm" variant="secondary" onClick={() => setDialogo('carta')}>{entry?.stage === ES.INTENT ? t('Editar a carta') : t('Candidatar-se')}</V2Button>}
        {podeProposta && <V2Button type="button" size="sm" onClick={() => setDialogo('proposta')}>{entry.stage === ES.PROPOSAL ? t('Mandar de novo a proposta') : t('Mandar a proposta')}</V2Button>}
        {podeRetirar && <V2Button type="button" size="sm" variant="ghost" onClick={() => setDialogo('retirar')}>{t('Desistir')}</V2Button>}
      </div>
      {dialogo === 'carta' && <IntentDialog bid={bid} kind={kind} org={org} entry={entry} onClose={() => setDialogo('')} />}
      {dialogo === 'proposta' && <ProposalDialog bid={bid} kind={kind} org={org} entry={entry} onClose={() => setDialogo('')} />}
      {dialogo === 'retirar' && (
        <ConfirmDialog
          open
          destructive
          onOpenChange={(o) => { if (!o) setDialogo(''); }}
          loading={m.isPending}
          title={t('Desistir da candidatura?')}
          description={t('A candidatura sai do edital. Com as cartas abertas, dá para mandar de novo.')}
          confirmLabel={t('Desistir')}
          cancelLabel={t('Voltar')}
          onConfirm={() => m.mutate({ action: 'entry_withdraw', bidId: bid.id, kind, orgId: org.id }, { onSuccess: () => { toast.success(t('Candidatura retirada.')); setDialogo(''); }, onError: (e) => toast.error(e.message) })}
        />
      )}
    </li>
  );
}

/**
 * `federations`: as federações públicas (com `modules`); `affiliatedIds`: as
 * em que a organização está filiada. As confederações delas entram também.
 */
export default function OrgHostBidsBlock({ kind, org, federations = [], affiliatedIds = [] }) {
  const alvos = useMemo(() => {
    const filiadas = federations.filter((f) => affiliatedIds.includes(f.id));
    const confs = new Set(filiadas.map((f) => nationalBodyOf(f)?.id).filter(Boolean));
    return federations.filter((f) => fedModuleOn(f, 'host_bids') && (affiliatedIds.includes(f.id) || (isConfederation(f) && confs.has(f.id)))).map((f) => f.id);
  }, [federations, affiliatedIds]);
  const qs = usePublicHostBidsOf(alvos);
  const qe = useOrgHostEntries(kind, org?.id, { enabled: alvos.length > 0 });
  if (!alvos.length) return null;
  const erro = [...qs, qe].find((q) => q.isError);
  if (erro) return <V2ErrorState inline title={t('Não carregaram os editais de sede')} onRetry={() => [...qs, qe].filter((q) => q.isError).forEach((q) => q.refetch())} />;
  if (qs.some((q) => !q.isSuccess) || !qe.isSuccess) return null;
  const entradas = qe.data || [];
  const doEdital = (b) => entradas.find((e) => e.id === hostEntryId(b.id, kind, org.id)) || null;
  // Os abertos e os que a organização disputou (até o resultado).
  const editais = qs.flatMap((q) => q.data || []).filter((b) => [BS.INTENT, BS.PROPOSAL, BS.REVIEW].includes(b.status) || (doEdital(b) && b.status === BS.RESULT));
  if (!editais.length) return null;
  return (
    <ul className="space-y-2" aria-label={t('Editais de sede')} data-dica="org-editais-sede">
      {editais.map((b) => <EditalLinha key={b.id} bid={b} kind={kind} org={org} entry={doEdital(b)} />)}
    </ul>
  );
}
