/**
 * PICKLEBALL ADAPTADO na aba "Minha filiação" (módulo `adapted`). O filiado
 * em dia pede a classificação numa categoria adaptada enviando o laudo (PDF
 * ou foto, até 5 MB); vê a situação, a data de revisão e baixa o próprio
 * laudo; com o pedido em análise pode desistir. "Só você vê".
 */
import React, { useState } from 'react';
import { toast } from 'sonner';
import { Accessibility, Paperclip } from 'lucide-react';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useAuth } from '@/core/lib/FirebaseAuthContext';
import { fedModuleOn } from '@/modules/federations/domain/federation';
import { isoDate } from '@/modules/federations/domain/membership';
import { ADAPTED_LIMITS, CLASS_STATUS_LABELS, adaptedClassesOf, classificationState, validateClassificationRequest } from '@/modules/federations/domain/adapted';
import { useAdaptedAction, useMyAdaptedClassifications } from '@/modules/federations/hooks/useAdapted';
import { useFederationMutation } from '@/modules/federations/hooks/useFederations';
import { adaptedAction, requestClassification } from '@/modules/federations/services/adaptedService';
import { V2Badge, V2Button, V2ErrorState, V2Field, V2Select, V2Textarea } from '@/v2/ui/primitives';
import { t } from '@/core/i18n';
import { baixarArquivoDoServidor } from '../manage/accounts/accountsForms';

const ok = (msg, depois) => ({ onSuccess: () => { toast.success(msg); depois?.(); }, onError: (e) => toast.error(e.message) });
const br = (iso) => (iso ? String(iso).split('-').reverse().join('/') : '');

function RequestDialog({ federation, classes, inicial, onClose }) {
  const { user } = useAuth();
  const [f, setF] = useState({ class_id: inicial || '', note: '' });
  const [arquivo, setArquivo] = useState(null);
  const m = useFederationMutation(() => requestClassification({ fedId: federation.id, uid: user?.uid, file: arquivo, classId: f.class_id, note: f.note }));
  const r = validateClassificationRequest(f, classes);
  const escolhida = classes.find((c) => c.id === f.class_id);
  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-h-[90dvh] max-w-xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t('Pedir a classificação no pickleball adaptado')}</DialogTitle>
          <DialogDescription>{t('A comissão de competições confere o laudo e avisa pelo sino. O laudo é privado: só você e a comissão o abrem.')}</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <V2Field label={t('Categoria')} htmlFor="ad-pedido-classe" hint={escolhida?.description || undefined}><V2Select id="ad-pedido-classe" value={f.class_id} onChange={(e) => setF((x) => ({ ...x, class_id: e.target.value }))} options={[{ value: '', label: t('Escolha') }, ...classes.map((c) => ({ value: c.id, label: c.label }))]} /></V2Field>
          <V2Field label={t('Laudo médico ou funcional')} htmlFor="ad-pedido-laudo" hint={t('PDF ou foto (JPG, PNG ou WebP), até 5 MB.')}>
            <input id="ad-pedido-laudo" type="file" accept="application/pdf,image/jpeg,image/png,image/webp" className="block w-full text-sm" onChange={(e) => setArquivo(e.target.files?.[0] || null)} />
          </V2Field>
          <V2Field label={t('Recado para a comissão (opcional)')} htmlFor="ad-pedido-nota"><V2Textarea id="ad-pedido-nota" rows={3} maxLength={ADAPTED_LIMITS.NOTE_MAX} value={f.note} onChange={(e) => setF((x) => ({ ...x, note: e.target.value }))} /></V2Field>
        </div>
        <div className="mt-3 flex justify-end gap-2">
          <V2Button type="button" variant="ghost" onClick={onClose}>{t('Cancelar')}</V2Button>
          <V2Button type="button" disabled={!r.ok || !arquivo || m.isPending} onClick={() => m.mutate(undefined, ok(t('Pedido enviado.'), onClose))}>{m.isPending ? t('Enviando…') : t('Enviar pedido')}</V2Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default function MyAdaptedClassification({ federation, memberActive }) {
  const { user } = useAuth();
  const ligado = fedModuleOn(federation, 'adapted');
  const q = useMyAdaptedClassifications(user?.uid, { enabled: ligado });
  const m = useAdaptedAction(federation.id);
  const [dialogo, setDialogo] = useState('');
  const [abrindo, setAbrindo] = useState('');
  if (!ligado) return null;
  const rec = (q.data || []).find((x) => x.federation_id === federation.id) || null;
  const st = classificationState(rec, isoDate());
  const classes = adaptedClassesOf(federation);
  if (q.isError) return <V2ErrorState inline title={t('Não carregou a sua classificação no adaptado')} onRetry={q.refetch} />;
  if (!q.isSuccess || (!rec && !memberActive)) return null;
  const abrir = async (which) => {
    setAbrindo(which);
    try { baixarArquivoDoServidor(await adaptedAction(federation.id, 'report_file', { which })); } catch (e) { toast.error(e.message); } finally { setAbrindo(''); }
  };
  return (
    <section aria-labelledby="fed-meu-adaptado" className="space-y-2 border-t border-gray-100 pt-4" data-dica="federacao-meu-adaptado">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 id="fed-meu-adaptado" className="flex items-center gap-2 font-semibold text-ink"><Accessibility className="h-4 w-4" aria-hidden="true" />{t('Pickleball adaptado')}</h3>
        {rec && <V2Badge tone={st.active ? (st.expiring ? 'amber' : 'green') : st.expired ? 'red' : st.pending ? 'blue' : 'gray'}>{st.active ? t('Classificado') : st.expired ? t('Revisão vencida') : t(CLASS_STATUS_LABELS[rec.status] || rec.status)}</V2Badge>}
      </div>
      {st.class_id ? (
        <p className="text-sm text-gray-600">{[t('Categoria: {c}', { c: rec.class_label || st.class_id }), rec.valid_until ? t('revisão em {d}', { d: br(rec.valid_until) }) : t('sem data de revisão')].join(' · ')}</p>
      ) : !rec || !st.pending ? (
        <p className="text-sm text-gray-600">{t('Joga em cadeira de rodas ou tem alguma deficiência? Peça a classificação para jogar as modalidades adaptadas dos torneios chancelados.')}</p>
      ) : null}
      {st.expired && <p className="text-sm font-semibold text-red-600">{t('A revisão passou: peça a reclassificação com um laudo atualizado.')}</p>}
      {st.expiring && <p className="text-sm font-semibold text-amber-800">{t('A revisão está perto: peça a reclassificação com um laudo atualizado.')}</p>}
      {st.pending && rec.request && <p className="text-sm text-gray-600">{t('Pedido de {c} em análise na comissão.', { c: rec.request.class_label || rec.request.class_id })}</p>}
      {rec?.decision?.note && !st.pending && <p className="text-xs text-gray-500">{t('Última decisão: {m}', { m: rec.decision.note })}</p>}
      <div className="flex flex-wrap gap-2">
        {memberActive && !st.pending && <V2Button type="button" size="sm" variant="secondary" onClick={() => setDialogo('pedir')}>{st.class_id ? t('Pedir reclassificação') : t('Pedir classificação')}</V2Button>}
        {st.pending && <V2Button type="button" size="sm" variant="ghost" onClick={() => setDialogo('desistir')}>{t('Desistir do pedido')}</V2Button>}
        {rec?.report && <V2Button type="button" size="sm" variant="ghost" disabled={abrindo === 'current'} onClick={() => abrir('current')}><Paperclip className="h-4 w-4" />{t('Meu laudo')}</V2Button>}
        {rec?.request?.report && <V2Button type="button" size="sm" variant="ghost" disabled={abrindo === 'request'} onClick={() => abrir('request')}><Paperclip className="h-4 w-4" />{t('Laudo enviado')}</V2Button>}
      </div>
      {dialogo === 'pedir' && <RequestDialog federation={federation} classes={classes} inicial={st.class_id} onClose={() => setDialogo('')} />}
      {dialogo === 'desistir' && (
        <ConfirmDialog
          open
          destructive
          onOpenChange={(o) => { if (!o) setDialogo(''); }}
          loading={m.isPending}
          title={t('Desistir do pedido de classificação?')}
          description={t('O pedido e o laudo enviado são apagados. Se você já era classificado, a classificação continua.')}
          confirmLabel={t('Desistir')}
          cancelLabel={t('Voltar')}
          onConfirm={() => m.mutate({ action: 'withdraw' }, ok(t('Pedido retirado.'), () => setDialogo('')))}
        />
      )}
    </section>
  );
}
