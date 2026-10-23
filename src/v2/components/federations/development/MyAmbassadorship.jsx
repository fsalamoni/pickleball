/**
 * O EMBAIXADOR na aba "Minha filiação" (módulo `ambassadors`): o filiado em
 * dia lê o código de conduta e se candidata; com a candidatura em análise
 * pode desistir; nomeado, manda o relatório periódico, aceita o código novo
 * quando a federação o muda e pode deixar o mandato. "Só você vê".
 */
import React, { useState } from 'react';
import { toast } from 'sonner';
import { MapPin } from 'lucide-react';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useAuth } from '@/core/lib/FirebaseAuthContext';
import { fedModuleOn } from '@/modules/federations/domain/federation';
import { isoDate } from '@/modules/federations/domain/membership';
import { AMB_LIMITS, AMBASSADOR_STATUS_LABELS, ambassadorState, normalizeAmbassadorRules, validateAmbassadorApply, validateReport } from '@/modules/federations/domain/development';
import { useDevelopmentAction, useMyAmbassadorships } from '@/modules/federations/hooks/useDevelopment';
import { V2Badge, V2Button, V2ErrorState, V2Field, V2Input, V2Textarea } from '@/v2/ui/primitives';
import { t, tn } from '@/core/i18n';

const ok = (msg, depois) => ({ onSuccess: () => { toast.success(msg); depois?.(); }, onError: (e) => toast.error(e.message) });
const br = (iso) => (iso ? String(iso).split('-').reverse().join('/') : '');

function Conduta({ regras }) {
  return <p className="max-h-48 overflow-y-auto whitespace-pre-line rounded-xl bg-gray-50 p-3 text-sm text-gray-700">{regras.conduct_text}</p>;
}

function ApplyDialog({ federation, regras, onClose }) {
  const [f, setF] = useState({ motivation: '', region_wish: '', accept_conduct: false });
  const m = useDevelopmentAction(federation.id);
  const r = validateAmbassadorApply(f);
  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-h-[90dvh] max-w-xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t('Candidatar-se a embaixador')}</DialogTitle>
          <DialogDescription>{t('A secretaria analisa e avisa pelo sino. Nomeado, você aparece na página da federação com nome, foto e região, nunca com contato.')}</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <V2Field label={t('Região onde quer atuar')} htmlFor="amb-c-regiao"><V2Input id="amb-c-regiao" maxLength={AMB_LIMITS.REGION_MAX} placeholder={t('Ex.: Serra gaúcha')} value={f.region_wish} onChange={(e) => setF((x) => ({ ...x, region_wish: e.target.value }))} /></V2Field>
          <V2Field label={t('Por que você quer ser embaixador?')} htmlFor="amb-c-motivo" hint={t('O que já faz pelo esporte e o que pretende fazer na região.')}><V2Textarea id="amb-c-motivo" rows={5} maxLength={AMB_LIMITS.MOTIVATION_MAX} value={f.motivation} onChange={(e) => setF((x) => ({ ...x, motivation: e.target.value }))} /></V2Field>
          <div className="space-y-2">
            <p className="text-sm font-semibold text-ink">{t('Código de conduta')}</p>
            <Conduta regras={regras} />
            <label className="flex min-h-11 items-center gap-2 text-sm text-ink">
              <input type="checkbox" className="h-4 w-4" checked={f.accept_conduct} onChange={(e) => setF((x) => ({ ...x, accept_conduct: e.target.checked }))} />
              {t('Li e aceito o código de conduta')}
            </label>
          </div>
        </div>
        <div className="mt-3 flex justify-end gap-2">
          <V2Button type="button" variant="ghost" onClick={onClose}>{t('Cancelar')}</V2Button>
          <V2Button type="button" disabled={!r.ok || m.isPending} onClick={() => m.mutate({ action: 'amb_apply', ...f }, ok(t('Candidatura enviada.'), onClose))}>{t('Enviar candidatura')}</V2Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function ReportDialog({ federation, onClose }) {
  const [text, setText] = useState('');
  const m = useDevelopmentAction(federation.id);
  const r = validateReport({ text });
  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-h-[90dvh] max-w-xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t('Relatório de embaixador')}</DialogTitle>
          <DialogDescription>{t('Conte o que foi feito no período: clínicas, festivais, clubes visitados, pessoas novas, dificuldades.')}</DialogDescription>
        </DialogHeader>
        <V2Field label={t('Relatório')} htmlFor="amb-rel" error={text && !r.ok ? r.errors.text : undefined}><V2Textarea id="amb-rel" rows={8} maxLength={AMB_LIMITS.REPORT_MAX} value={text} onChange={(e) => setText(e.target.value)} /></V2Field>
        <div className="mt-3 flex justify-end gap-2">
          <V2Button type="button" variant="ghost" onClick={onClose}>{t('Cancelar')}</V2Button>
          <V2Button type="button" disabled={!r.ok || m.isPending} onClick={() => m.mutate({ action: 'amb_report', text }, ok(t('Relatório enviado.'), onClose))}>{t('Enviar')}</V2Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default function MyAmbassadorship({ federation, memberActive }) {
  const { user } = useAuth();
  const ligado = fedModuleOn(federation, 'ambassadors');
  const q = useMyAmbassadorships(user?.uid, { enabled: ligado });
  const m = useDevelopmentAction(federation.id);
  const [dialogo, setDialogo] = useState('');
  if (!ligado) return null;
  const regras = normalizeAmbassadorRules(federation.ambassador_rules);
  const a = (q.data || []).find((x) => x.federation_id === federation.id) || null;
  const st = ambassadorState(a, regras, isoDate());
  const podeCandidatar = memberActive && regras.open && (!a || st.canApply);
  if (q.isError) return <V2ErrorState inline title={t('Não carregou a sua situação de embaixador')} onRetry={q.refetch} />;
  if (!q.isSuccess || (!a && !podeCandidatar)) return null;
  return (
    <section aria-labelledby="fed-embaixador" className="space-y-2 border-t border-gray-100 pt-4" data-dica="federacao-meu-embaixador">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 id="fed-embaixador" className="flex items-center gap-2 font-semibold text-ink"><MapPin className="h-4 w-4" aria-hidden="true" />{t('Embaixador regional')}</h3>
        {a && <V2Badge tone={st.appointed ? 'green' : a.status === 'applied' ? 'blue' : 'gray'}>{t(AMBASSADOR_STATUS_LABELS[st.termEnded ? 'ended' : a.status] || a.status)}</V2Badge>}
      </div>
      {!a || st.canApply ? (
        <>
          <p className="text-sm text-gray-600">{t('Represente a federação na sua região: divulgue o esporte, ajude clubes novos e conte o que acontece por aí.')}</p>
          {a?.decision?.reason && <p className="text-xs text-gray-500">{t('Última decisão: {m}', { m: a.decision.reason })}</p>}
          {podeCandidatar && <V2Button type="button" size="sm" variant="secondary" onClick={() => setDialogo('candidatar')}>{t('Quero ser embaixador')}</V2Button>}
        </>
      ) : a.status === 'applied' ? (
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm text-gray-600">{t('Candidatura para {regiao} em análise na secretaria.', { regiao: a.region_wish })}</p>
          <V2Button type="button" size="sm" variant="ghost" onClick={() => setDialogo('desistir')}>{t('Desistir')}</V2Button>
        </div>
      ) : (
        <>
          <p className="text-sm text-gray-600">{[t('Região {r}', { r: a.region }), a.appointed_at && t('desde {d}', { d: br(a.appointed_at) }), a.term_until && t('mandato até {d}', { d: br(a.term_until) }), a.next_report_due && t('próximo relatório em {d}', { d: br(a.next_report_due) })].filter(Boolean).join(' · ')}</p>
          {st.reportDue && <p className="text-sm font-semibold text-amber-800">{tn(st.overdueDays, 'O relatório está atrasado {n} dia.', 'O relatório está atrasado {n} dias.')}</p>}
          {st.needsReaccept && (
            <div className="space-y-2 rounded-xl border border-amber-200 bg-amber-50 p-3">
              <p className="text-sm font-semibold text-amber-900">{t('A federação atualizou o código de conduta. Leia e aceite para seguir como embaixador.')}</p>
              <Conduta regras={regras} />
              <V2Button type="button" size="sm" disabled={m.isPending} onClick={() => m.mutate({ action: 'amb_accept', accept_conduct: true }, ok(t('Código aceito.')))}>{t('Li e aceito')}</V2Button>
            </div>
          )}
          <div className="flex flex-wrap gap-2">
            <V2Button type="button" size="sm" onClick={() => setDialogo('relatorio')}>{t('Enviar relatório')}</V2Button>
            <V2Button type="button" size="sm" variant="ghost" onClick={() => setDialogo('desistir')}>{t('Deixar o mandato')}</V2Button>
          </div>
        </>
      )}
      {dialogo === 'candidatar' && <ApplyDialog federation={federation} regras={regras} onClose={() => setDialogo('')} />}
      {dialogo === 'relatorio' && <ReportDialog federation={federation} onClose={() => setDialogo('')} />}
      {dialogo === 'desistir' && (
        <ConfirmDialog
          open
          destructive
          onOpenChange={(o) => { if (!o) setDialogo(''); }}
          loading={m.isPending}
          title={a?.status === 'applied' ? t('Desistir da candidatura?') : t('Deixar o mandato de embaixador?')}
          description={a?.status === 'applied' ? t('A candidatura é apagada. Você pode se candidatar de novo depois.') : t('Você sai da página da federação. Os relatórios enviados ficam com a federação.')}
          confirmLabel={a?.status === 'applied' ? t('Desistir') : t('Deixar o mandato')}
          cancelLabel={t('Voltar')}
          onConfirm={() => m.mutate({ action: 'amb_withdraw' }, ok(t('Feito.'), () => setDialogo('')))}
        />
      )}
    </section>
  );
}
