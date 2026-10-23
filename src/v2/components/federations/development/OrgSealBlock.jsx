/**
 * O SELO DE CLUBE CERTIFICADO no cartão "Federação" do clube e da arena
 * (módulo `club_seal` da federação). Para cada federação em que a organização
 * está FILIADA, quem a gere vê a situação do selo e pede (ou renova) mandando
 * a evidência de cada critério — texto ou arquivo, que fica na pasta de quem
 * envia e só a equipe da federação abre. O que a plataforma confere sozinha
 * (arena) não pede evidência. A federação decide.
 */
import React, { useState } from 'react';
import { toast } from 'sonner';
import { BadgeCheck, Paperclip, X } from 'lucide-react';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useAuth } from '@/core/lib/FirebaseAuthContext';
import { fedModuleOn } from '@/modules/federations/domain/federation';
import { isoDate } from '@/modules/federations/domain/membership';
import { SEAL_LIMITS, SEAL_STATUS_LABELS, autoApplies, normalizeSealRules, sealState } from '@/modules/federations/domain/development';
import { validateDocumentFile } from '@/modules/federations/domain/privateData';
import { useDevelopmentAction, useOrgSeals } from '@/modules/federations/hooks/useDevelopment';
import { uploadSealFiles } from '@/modules/federations/services/developmentService';
import { V2Badge, V2Button, V2ErrorState, V2Field, V2Textarea } from '@/v2/ui/primitives';
import { t } from '@/core/i18n';

const br = (iso) => (iso ? String(iso).split('-').reverse().join('/') : '');

function ApplyDialog({ federation, kind, org, regras, onClose }) {
  const { user } = useAuth();
  const m = useDevelopmentAction(federation.id);
  const [textos, setTextos] = useState({});
  const [arquivos, setArquivos] = useState({});
  const [enviando, setEnviando] = useState(false);
  const faltam = regras.criteria.filter((c) => c.required && !autoApplies(c, kind) && !String(textos[c.id] || '').trim() && !arquivos[c.id]);
  const escolher = (id, file) => {
    const erro = file && validateDocumentFile(file);
    if (erro) { toast.error(erro); return; }
    setArquivos((x) => ({ ...x, [id]: file || null }));
  };
  const enviar = async () => {
    setEnviando(true);
    try {
      const subidos = await uploadSealFiles(user?.uid, arquivos);
      const evidence = Object.fromEntries(regras.criteria.map((c) => [c.id, { text: textos[c.id] || '', ...(subidos[c.id] ? { file: { path: subidos[c.id].path, name: subidos[c.id].name } } : {}) }]));
      await m.mutateAsync({ action: 'seal_apply', kind, orgId: org.id, evidence });
      toast.success(t('Pedido enviado. A federação foi avisada.'));
      onClose();
    } catch (e) { toast.error(e.message); } finally { setEnviando(false); }
  };
  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-h-[90dvh] max-w-xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t('Pedir o selo "{nome}" à {sigla}', { nome: regras.name, sigla: federation.acronym || federation.name })}</DialogTitle>
          <DialogDescription>{t('Mostre como a organização cumpre cada critério. Os arquivos ficam guardados na sua pasta e só a equipe da federação os abre.')}</DialogDescription>
        </DialogHeader>
        <ul className="space-y-3">
          {regras.criteria.map((c) => {
            const auto = autoApplies(c, kind);
            return (
              <li key={c.id} className="space-y-2 rounded-xl border border-gray-100 p-3">
                <p className="text-sm font-semibold text-ink">{c.label}{!c.required && <span className="font-normal text-gray-500"> · {t('opcional')}</span>}</p>
                {c.description && <p className="text-xs text-gray-500">{c.description}</p>}
                {auto && <p className="text-xs text-green-700">{t('A plataforma confere sozinha. Se quiser, explique.')}</p>}
                <V2Field label={t('Explicação')} htmlFor={`selo-ev-${c.id}`}><V2Textarea id={`selo-ev-${c.id}`} rows={2} maxLength={SEAL_LIMITS.EVIDENCE_MAX} value={textos[c.id] || ''} onChange={(e) => setTextos((x) => ({ ...x, [c.id]: e.target.value }))} /></V2Field>
                <div className="flex flex-wrap items-center gap-2">
                  <label className="inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-full border border-gray-200 px-3 text-sm text-ink hover:bg-gray-50">
                    <Paperclip className="h-4 w-4" aria-hidden="true" />{arquivos[c.id] ? t('Trocar arquivo') : t('Anexar arquivo (opcional)')}
                    <input type="file" className="sr-only" accept="application/pdf,image/jpeg,image/png,image/webp" onChange={(e) => escolher(c.id, e.target.files?.[0])} />
                  </label>
                  {arquivos[c.id] && (
                    <span className="inline-flex items-center gap-1 text-sm text-gray-700">{arquivos[c.id].name}
                      <button type="button" className="inline-flex h-11 w-11 items-center justify-center rounded-full text-gray-500 hover:bg-gray-100" aria-label={t('Tirar {nome}', { nome: arquivos[c.id].name })} onClick={() => escolher(c.id, null)}><X className="h-4 w-4" /></button>
                    </span>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
        {faltam.length > 0 && <p className="text-xs text-gray-500">{t('Falta evidência em: {lista}.', { lista: faltam.map((c) => c.label).join('; ') })}</p>}
        <div className="mt-3 flex justify-end gap-2">
          <V2Button type="button" variant="ghost" onClick={onClose}>{t('Cancelar')}</V2Button>
          <V2Button type="button" disabled={faltam.length > 0 || enviando} onClick={enviar}>{enviando ? t('Enviando…') : t('Enviar pedido')}</V2Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function SealLine({ federation, kind, org, seal }) {
  const regras = normalizeSealRules(federation.club_seal);
  const st = sealState(seal, isoDate());
  const m = useDevelopmentAction(federation.id);
  const [dialogo, setDialogo] = useState('');
  const sigla = federation.acronym || federation.name;
  return (
    <li className="space-y-2 rounded-2xl border border-gray-100 bg-white p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="flex flex-wrap items-center gap-2 text-sm font-semibold text-ink"><BadgeCheck className="h-4 w-4" aria-hidden="true" />{t('Selo "{nome}" · {sigla}', { nome: regras.name, sigla })}</p>
        {seal && <V2Badge tone={st.valid ? (st.expiring ? 'amber' : 'green') : seal.status === 'applied' ? 'blue' : seal.status === 'revoked' ? 'red' : 'gray'}>{st.valid ? t('Valendo até {d}', { d: br(st.validUntil) }) : seal.status === 'granted' ? t('Vencido') : t(SEAL_STATUS_LABELS[seal.status] || seal.status)}</V2Badge>}
      </div>
      {!seal && <p className="text-sm text-gray-600">{t('Mostre que a organização cumpre os critérios da federação e ganhe o selo na página dela.')}</p>}
      {st.applied && <p className="text-sm text-gray-600">{st.valid ? t('Renovação em análise na federação.') : t('Pedido em análise na federação.')}</p>}
      {seal?.decision?.reason && !st.applied && <p className="text-sm text-red-600">{t('Motivo: {m}', { m: seal.decision.reason })}</p>}
      <div className="flex flex-wrap gap-2">
        {regras.open && st.canApply && <V2Button type="button" size="sm" variant="secondary" onClick={() => setDialogo('pedir')}>{st.valid ? t('Renovar o selo') : t('Pedir o selo')}</V2Button>}
        {st.applied && <V2Button type="button" size="sm" variant="ghost" onClick={() => setDialogo('retirar')}>{t('Retirar o pedido')}</V2Button>}
      </div>
      {dialogo === 'pedir' && <ApplyDialog federation={federation} kind={kind} org={org} regras={regras} onClose={() => setDialogo('')} />}
      {dialogo === 'retirar' && (
        <ConfirmDialog
          open
          onOpenChange={(o) => { if (!o) setDialogo(''); }}
          loading={m.isPending}
          title={t('Retirar o pedido de selo?')}
          description={st.valid ? t('O selo atual segue valendo até {d}.', { d: br(st.validUntil) }) : t('O pedido sai da fila da federação. Dá para pedir de novo.')}
          confirmLabel={t('Retirar')}
          cancelLabel={t('Voltar')}
          onConfirm={() => m.mutate({ action: 'seal_withdraw', kind, orgId: org.id }, { onSuccess: () => { toast.success(t('Pedido retirado.')); setDialogo(''); }, onError: (e) => toast.error(e.message) })}
        />
      )}
    </li>
  );
}

/** `federations`: as federações em que a organização está filiada (documentos com `modules`). */
export default function OrgSealBlock({ kind, org, federations = [] }) {
  const comSelo = federations.filter((f) => fedModuleOn(f, 'club_seal'));
  const q = useOrgSeals(kind, org?.id, { enabled: comSelo.length > 0 });
  if (!comSelo.length) return null;
  if (q.isError) return <V2ErrorState inline title={t('Não carregou o selo de clube certificado')} onRetry={q.refetch} />;
  if (!q.isSuccess) return null;
  return (
    <ul className="space-y-2" aria-label={t('Selo de clube certificado')} data-dica="org-selo-clube">
      {comSelo.map((f) => <SealLine key={f.id} federation={f} kind={kind} org={org} seal={(q.data || []).find((s) => s.federation_id === f.id) || null} />)}
    </ul>
  );
}
