/**
 * PICKLEBALL ADAPTADO na Central (Competições → Adaptado, módulo `adapted`).
 * A comissão de competições e o admin definem as categorias adaptadas da
 * federação e decidem os pedidos de classificação: abrem o laudo (o servidor
 * registra quem abriu), classificam com revisão opcional, recusam ou cancelam
 * com motivo. Quem pediu não decide o próprio pedido.
 */
import React, { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Accessibility, Paperclip, Plus, Settings2, Trash2 } from 'lucide-react';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { useAuth } from '@/core/lib/FirebaseAuthContext';
import { isoDate } from '@/modules/federations/domain/membership';
import { ADAPTED_LIMITS, CLASS_STATUS_LABELS, adaptedClassesOf, classificationState, validateAdaptedClasses, validateClassificationDecision } from '@/modules/federations/domain/adapted';
import { useAdaptedAction, useAdaptedClassifications } from '@/modules/federations/hooks/useAdapted';
import { adaptedAction } from '@/modules/federations/services/adaptedService';
import { V2Badge, V2Button, V2EmptyState, V2ErrorState, V2Field, V2Input, V2Select, V2Skeleton, V2Surface, V2Textarea } from '@/v2/ui/primitives';
import { t, tn } from '@/core/i18n';
import { baixarArquivoDoServidor } from '../manage/accounts/accountsForms';

const ok = (msg, depois) => ({ onSuccess: () => { toast.success(msg); depois?.(); }, onError: (e) => toast.error(e.message) });
const br = (iso) => (iso ? String(iso).split('-').reverse().join('/') : '');

function ClassesEditor({ federation }) {
  const m = useAdaptedAction(federation.id);
  const atuais = adaptedClassesOf(federation);
  const [lista, setLista] = useState(() => atuais);
  const r = validateAdaptedClasses(lista);
  const set = (i, k, v) => setLista((xs) => xs.map((c, j) => (j === i ? { ...c, [k]: v } : c)));
  return (
    <details className="rounded-2xl border border-gray-200 bg-white p-4" data-dica="federacao-adaptado-categorias">
      <summary className="flex cursor-pointer items-center gap-2 font-semibold text-ink"><Settings2 className="h-4 w-4" aria-hidden="true" />{t('Categorias adaptadas')}<span className="text-sm font-normal text-gray-500">· {atuais.map((c) => c.label).join(', ')}</span></summary>
      <div className="mt-3 space-y-3">
        {lista.map((c, i) => (
          <div key={c.id || i} className="space-y-2 rounded-xl border border-gray-100 p-3">
            <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
              <V2Input aria-label={t('Nome da categoria')} maxLength={ADAPTED_LIMITS.LABEL_MAX} value={c.label} onChange={(e) => set(i, 'label', e.target.value)} />
              <V2Button type="button" variant="ghost" aria-label={t('Tirar a categoria {nome}', { nome: c.label })} onClick={() => setLista((xs) => xs.filter((_, j) => j !== i))}><Trash2 className="h-4 w-4" /></V2Button>
            </div>
            <V2Input aria-label={t('Quem joga nesta categoria')} placeholder={t('Quem joga nesta categoria')} maxLength={ADAPTED_LIMITS.DESC_MAX} value={c.description} onChange={(e) => set(i, 'description', e.target.value)} />
          </div>
        ))}
        {r.errors.classes && <p className="text-xs text-red-600">{r.errors.classes}</p>}
        {lista.length < ADAPTED_LIMITS.CLASSES_MAX && <V2Button type="button" size="sm" variant="secondary" onClick={() => setLista((xs) => [...xs, { id: '', label: '', description: '' }])}><Plus className="h-4 w-4" />{t('Acrescentar categoria')}</V2Button>}
        <p className="text-xs text-gray-500">{t('O código de cada categoria nasce do nome e fica gravado nas classificações e nas modalidades: renomear uma categoria existente mantém o código; tirar uma categoria não apaga quem já foi classificado nela.')}</p>
        <div className="flex justify-end"><V2Button type="button" disabled={!r.ok || m.isPending} onClick={() => m.mutate({ action: 'classes_save', classes: lista }, ok(t('Categorias salvas.')))}>{t('Salvar categorias')}</V2Button></div>
      </div>
    </details>
  );
}

function ClassificationCard({ federation, rec, hoje, classes, meuUid }) {
  const m = useAdaptedAction(federation.id);
  const st = classificationState(rec, hoje);
  const pedido = rec.request;
  const [form, setForm] = useState({ class_id: pedido?.class_id || '', valid_until: '', note: '' });
  const [motivo, setMotivo] = useState(null);
  const [abrindo, setAbrindo] = useState('');
  const v = validateClassificationDecision({ ...form, decision: 'classify' }, classes, hoje);
  const abrir = async (which) => {
    setAbrindo(which);
    try { baixarArquivoDoServidor(await adaptedAction(federation.id, 'report_file', { userId: rec.user_id, which })); } catch (e) { toast.error(e.message); } finally { setAbrindo(''); }
  };
  const proprio = rec.user_id === meuUid;
  return (
    <li className="space-y-3 border-b border-gray-100 py-4 last:border-0">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-semibold text-ink">{rec.name}</p>
          <p className="text-xs text-gray-500">{[st.class_id && (rec.class_label || st.class_id), st.class_id && (rec.valid_until ? t('revisão em {d}', { d: br(rec.valid_until) }) : t('sem data de revisão'))].filter(Boolean).join(' · ')}</p>
        </div>
        <div className="flex flex-wrap items-center gap-1">
          {st.active && <V2Badge tone={st.expiring ? 'amber' : 'green'}>{st.expiring ? t('Revisão perto') : t('Classificado')}</V2Badge>}
          {st.expired && <V2Badge tone="red">{t('Revisão vencida')}</V2Badge>}
          {st.pending && <V2Badge tone="blue">{t(CLASS_STATUS_LABELS.pending)}</V2Badge>}
          {!st.class_id && !st.pending && <V2Badge tone="gray">{t(CLASS_STATUS_LABELS[rec.status] || rec.status)}</V2Badge>}
          {rec.report && <V2Button type="button" size="sm" variant="ghost" disabled={abrindo === 'current'} onClick={() => abrir('current')}><Paperclip className="h-4 w-4" />{t('Laudo vigente')}</V2Button>}
          {st.class_id && <V2Button type="button" size="sm" variant="ghost" onClick={() => setMotivo({ acao: 'revoke' })}>{t('Cancelar classificação')}</V2Button>}
        </div>
      </div>
      {pedido && (
        <div className="space-y-3 rounded-xl bg-gray-50 p-3 text-sm">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <p className="text-ink">{t('Pediu: {classe}', { classe: pedido.class_label || pedido.class_id })}</p>
            <V2Button type="button" size="sm" variant="ghost" disabled={abrindo === 'request'} onClick={() => abrir('request')}><Paperclip className="h-4 w-4" />{pedido.report?.name || t('Abrir o laudo')}</V2Button>
          </div>
          {pedido.note && <p className="whitespace-pre-line text-gray-700">{pedido.note}</p>}
          {proprio ? <p className="text-xs text-gray-500">{t('Este pedido é seu: outra pessoa da comissão decide.')}</p> : (
            <>
              <div className="grid gap-3 sm:grid-cols-2">
                <V2Field label={t('Categoria')} htmlFor={`ad-classe-${rec.id}`}><V2Select id={`ad-classe-${rec.id}`} value={form.class_id} onChange={(e) => setForm((x) => ({ ...x, class_id: e.target.value }))} options={[{ value: '', label: t('Escolha') }, ...classes.map((c) => ({ value: c.id, label: c.label }))]} /></V2Field>
                <V2Field label={t('Revisão em (opcional)')} htmlFor={`ad-rev-${rec.id}`} hint={t('Em branco, vale até a comissão mudar.')} error={v.errors.valid_until}><V2Input id={`ad-rev-${rec.id}`} type="date" min={hoje} value={form.valid_until} onChange={(e) => setForm((x) => ({ ...x, valid_until: e.target.value }))} /></V2Field>
              </div>
              <V2Field label={t('Observação (opcional)')} htmlFor={`ad-nota-${rec.id}`}><V2Textarea id={`ad-nota-${rec.id}`} rows={2} maxLength={ADAPTED_LIMITS.NOTE_MAX} value={form.note} onChange={(e) => setForm((x) => ({ ...x, note: e.target.value }))} /></V2Field>
              <div className="flex flex-wrap justify-end gap-2">
                <V2Button type="button" variant="ghost" onClick={() => setMotivo({ acao: 'decline' })}>{t('Recusar')}</V2Button>
                <V2Button type="button" disabled={!v.ok || m.isPending} onClick={() => m.mutate({ action: 'decide', userId: rec.user_id, decision: 'classify', ...form }, ok(t('Atleta classificado.')))}><Accessibility className="h-4 w-4" />{t('Classificar')}</V2Button>
              </div>
            </>
          )}
        </div>
      )}
      {rec.decision?.note && !pedido && <p className="text-xs text-gray-500">{t('Última decisão: {m}', { m: rec.decision.note })}</p>}
      {motivo && (
        <ConfirmDialog
          open
          destructive
          onOpenChange={(o) => { if (!o) setMotivo(null); }}
          loading={m.isPending}
          confirmDisabled={String(motivo.texto || '').trim().length < 3}
          title={motivo.acao === 'revoke' ? t('Cancelar a classificação de {nome}?', { nome: rec.name }) : t('Recusar o pedido de {nome}?', { nome: rec.name })}
          description={motivo.acao === 'revoke' ? t('A pessoa deixa de valer nas modalidades adaptadas e o laudo é apagado. Ela é avisada com o motivo e pode pedir de novo.') : t('A pessoa é avisada com o motivo e pode pedir de novo. Se já tinha uma classificação, ela continua.')}
          confirmLabel={motivo.acao === 'revoke' ? t('Cancelar classificação') : t('Recusar')}
          cancelLabel={t('Voltar')}
          onConfirm={() => m.mutate(motivo.acao === 'revoke'
            ? { action: 'revoke', userId: rec.user_id, reason: motivo.texto }
            : { action: 'decide', userId: rec.user_id, decision: 'decline', note: motivo.texto }, ok(motivo.acao === 'revoke' ? t('Classificação cancelada.') : t('Pedido recusado.'), () => setMotivo(null)))}
        >
          <V2Field label={t('Motivo')} htmlFor={`ad-motivo-${rec.id}`}><V2Input id={`ad-motivo-${rec.id}`} value={motivo.texto || ''} maxLength={ADAPTED_LIMITS.REASON_MAX} onChange={(e) => setMotivo((x) => ({ ...x, texto: e.target.value }))} /></V2Field>
        </ConfirmDialog>
      )}
    </li>
  );
}

export default function AdaptedManager({ federation }) {
  const { user } = useAuth();
  const q = useAdaptedClassifications(federation.id);
  const hoje = isoDate();
  const classes = adaptedClassesOf(federation);
  const grupos = useMemo(() => {
    const xs = q.data || [];
    return {
      pendentes: xs.filter((r) => r.status === 'pending'),
      vigentes: xs.filter((r) => r.status !== 'pending' && r.class_id),
      outros: xs.filter((r) => r.status !== 'pending' && !r.class_id),
    };
  }, [q.data]);
  const lista = (xs, label) => xs.length > 0 && (
    <V2Surface variant="compacto" className="px-4"><ul aria-label={label}>{xs.map((r) => <ClassificationCard key={r.id} federation={federation} rec={r} hoje={hoje} classes={classes} meuUid={user?.uid} />)}</ul></V2Surface>
  );
  return (
    <section className="space-y-4" aria-label={t('Pickleball adaptado')} data-dica="federacao-adaptado">
      <div>
        <h2 className="flex items-center gap-2 font-display text-xl font-bold text-ink"><Accessibility className="h-5 w-5" aria-hidden="true" />{t('Pickleball adaptado')}</h2>
        <p className="text-sm text-gray-500">{t('O filiado pede a classificação numa categoria adaptada e envia o laudo; a comissão confere e decide. O laudo é privado: só a pessoa e a comissão o abrem, e cada abertura da equipe fica registrada. Nas modalidades adaptadas dos torneios chancelados, quem organiza confere a classificação dos inscritos sem ver o laudo.')}</p>
      </div>
      <ClassesEditor federation={federation} />
      {q.isError ? <V2ErrorState inline title={t('Não carregaram as classificações')} onRetry={q.refetch} />
        : q.isLoading ? <V2Skeleton lines={4} />
          : !q.data.length ? <V2EmptyState icon={Accessibility} title={t('Nenhum pedido de classificação ainda')} description={t('O filiado em dia pede na aba "Minha filiação" da página da federação.')} />
            : (
              <>
                {grupos.pendentes.length > 0 && <h3 className="font-semibold text-ink">{tn(grupos.pendentes.length, '{n} pedido em análise', '{n} pedidos em análise')}</h3>}
                {lista(grupos.pendentes, t('Pedidos em análise'))}
                {grupos.vigentes.length > 0 && <h3 className="font-semibold text-ink">{tn(grupos.vigentes.length, '{n} atleta classificado', '{n} atletas classificados')}</h3>}
                {lista(grupos.vigentes, t('Atletas classificados'))}
                {grupos.outros.length > 0 && (
                  <details>
                    <summary className="cursor-pointer text-sm font-semibold text-ink">{tn(grupos.outros.length, 'Histórico ({n})', 'Histórico ({n})')}</summary>
                    <div className="mt-2">{lista(grupos.outros, t('Histórico de classificações'))}</div>
                  </details>
                )}
              </>
            )}
    </section>
  );
}
