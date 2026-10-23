/**
 * EMBAIXADORES (Central → Rede e desenvolvimento → Embaixadores, módulo
 * `ambassadors`). A secretaria e o admin leem as candidaturas, nomeiam para
 * uma região (o servidor confere a filiação em dia e, quando a federação
 * exige, a proteção de menores), editam, recusam e encerram com motivo, e leem
 * os relatórios. O admin escreve o código de conduta e a frequência do
 * relatório: mudar o texto pede novo aceite de quem já é embaixador.
 */
import React, { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { MapPin, Pencil, Settings2, Users } from 'lucide-react';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useAuth } from '@/core/lib/FirebaseAuthContext';
import { isoDate } from '@/modules/federations/domain/membership';
import { AMB_REPORT_MONTHS, AMBASSADOR_STATUS_LABELS, ambassadorState, normalizeAmbassadorRules, validateAppointment } from '@/modules/federations/domain/development';
import { useAmbassadors, useDevelopmentAction } from '@/modules/federations/hooks/useDevelopment';
import { useFederationMutation } from '@/modules/federations/hooks/useFederations';
import { saveAmbassadorRules } from '@/modules/federations/services/developmentService';
import { V2Badge, V2Button, V2EmptyState, V2ErrorState, V2Field, V2Input, V2Select, V2Skeleton, V2Surface, V2Textarea, V2Toggle } from '@/v2/ui/primitives';
import { fmtData, t, tn } from '@/core/i18n';

const ok = (msg, depois) => ({ onSuccess: () => { toast.success(msg); depois?.(); }, onError: (e) => toast.error(e.message) });
const br = (iso) => (iso ? String(iso).split('-').reverse().join('/') : '');

function RulesEditor({ federation }) {
  const { user } = useAuth();
  const atual = normalizeAmbassadorRules(federation.ambassador_rules);
  const [f, setF] = useState(() => ({ open: atual.open, report_months: atual.report_months, conduct_text: atual.conduct_text }));
  const m = useFederationMutation((input) => saveAmbassadorRules(federation, input, { uid: user?.uid }));
  const mudaTexto = f.conduct_text.trim() !== atual.conduct_text.trim();
  return (
    <details className="rounded-2xl border border-gray-200 bg-white p-4">
      <summary className="flex cursor-pointer items-center gap-2 font-semibold text-ink"><Settings2 className="h-4 w-4" aria-hidden="true" />{t('Regras do programa')}<span className="text-sm font-normal text-gray-500">· {atual.open ? t('candidaturas abertas') : t('candidaturas fechadas')} · {tn(atual.report_months, 'relatório todo mês', 'relatório a cada {n} meses')} · {t('código versão {v}', { v: atual.conduct_version })}</span></summary>
      <div className="mt-3 space-y-3">
        <V2Toggle id="amb-aberto" checked={f.open} onChange={(v) => setF((x) => ({ ...x, open: v }))} label={t('Receber candidaturas')} hint={t('Fechado, o filiado não vê o botão de se candidatar. Quem já é embaixador continua.')} />
        <V2Field label={t('Relatório do embaixador')} htmlFor="amb-meses"><V2Select id="amb-meses" value={String(f.report_months)} onChange={(e) => setF((x) => ({ ...x, report_months: Number(e.target.value) }))} options={AMB_REPORT_MONTHS.map((n) => ({ value: String(n), label: tn(n, 'Todo mês', 'A cada {n} meses') }))} /></V2Field>
        <V2Field label={t('Código de conduta')} htmlFor="amb-codigo" hint={mudaTexto ? t('Ao salvar, o código passa para a versão {v} e cada embaixador é chamado a aceitar de novo.', { v: atual.conduct_version + 1 }) : t('Quem se candidata aceita este texto; fica registrado a versão e quando.')}>
          <V2Textarea id="amb-codigo" rows={7} maxLength={6000} value={f.conduct_text} onChange={(e) => setF((x) => ({ ...x, conduct_text: e.target.value }))} />
        </V2Field>
        <div className="flex justify-end"><V2Button type="button" disabled={m.isPending} onClick={() => m.mutate(f, ok(t('Regras salvas.')))}>{t('Salvar regras')}</V2Button></div>
      </div>
    </details>
  );
}

function AppointDialog({ federation, amb, editar, onClose }) {
  const hoje = isoDate();
  const [f, setF] = useState(() => ({ region: amb.region || amb.region_wish || '', term_until: amb.term_until || '' }));
  const m = useDevelopmentAction(federation.id);
  const r = validateAppointment(f, hoje);
  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-h-[90dvh] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{editar ? t('Editar embaixador') : t('Nomear {nome}', { nome: amb.user_name })}</DialogTitle>
          <DialogDescription>{editar ? t('A região aparece na página da federação.') : t('A filiação em dia e, se a federação exige, a proteção de menores são conferidas na hora. A pessoa é avisada e passa a aparecer na página.')}</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <V2Field label={t('Região')} htmlFor="amb-regiao" error={r.errors.region}><V2Input id="amb-regiao" maxLength={80} value={f.region} onChange={(e) => setF((x) => ({ ...x, region: e.target.value }))} /></V2Field>
          <V2Field label={t('Fim do mandato (opcional)')} htmlFor="amb-fim" error={r.errors.term_until} hint={t('Em branco, o mandato segue até alguém encerrar.')}><V2Input id="amb-fim" type="date" min={hoje} value={f.term_until} onChange={(e) => setF((x) => ({ ...x, term_until: e.target.value }))} /></V2Field>
        </div>
        <div className="mt-3 flex justify-end gap-2">
          <V2Button type="button" variant="ghost" onClick={onClose}>{t('Cancelar')}</V2Button>
          <V2Button type="button" disabled={!r.ok || m.isPending} onClick={() => m.mutate({ action: editar ? 'amb_update' : 'amb_appoint', userId: amb.user_id, ...f }, ok(editar ? t('Embaixador atualizado.') : t('Embaixador nomeado.'), onClose))}>{editar ? t('Salvar') : t('Nomear')}</V2Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function ReasonDialog({ federation, amb, encerrar, onClose }) {
  const [motivo, setMotivo] = useState('');
  const m = useDevelopmentAction(federation.id);
  return (
    <ConfirmDialog
      open
      destructive
      onOpenChange={(o) => { if (!o) onClose(); }}
      loading={m.isPending}
      confirmDisabled={motivo.trim().length < 3}
      title={encerrar ? t('Encerrar o mandato de {nome}?', { nome: amb.user_name }) : t('Recusar a candidatura de {nome}?', { nome: amb.user_name })}
      description={encerrar ? t('Sai da página da federação. A pessoa é avisada com o motivo.') : t('A pessoa é avisada com o motivo e pode se candidatar de novo depois.')}
      confirmLabel={encerrar ? t('Encerrar') : t('Recusar')}
      cancelLabel={t('Voltar')}
      onConfirm={() => m.mutate({ action: encerrar ? 'amb_end' : 'amb_reject', userId: amb.user_id, reason: motivo }, ok(encerrar ? t('Mandato encerrado.') : t('Candidatura recusada.'), onClose))}
    >
      <V2Field label={t('Motivo')} htmlFor="amb-motivo"><V2Input id="amb-motivo" value={motivo} maxLength={300} onChange={(e) => setMotivo(e.target.value)} /></V2Field>
    </ConfirmDialog>
  );
}

function AmbassadorRow({ federation, amb: a, hoje, onAct }) {
  const st = ambassadorState(a, federation.ambassador_rules, hoje);
  const reports = [...(a.reports || [])].reverse();
  return (
    <li className="space-y-2 border-b border-gray-100 py-3 last:border-0">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-semibold text-ink">{a.user_name}</p>
          <p className="text-xs text-gray-500">{[a.city && `${a.city}${a.state ? `/${a.state}` : ''}`, st.appointed ? t('região {r}', { r: a.region }) : t('quer atuar em {r}', { r: a.region_wish }), st.appointed && a.appointed_at && t('desde {d}', { d: br(a.appointed_at) }), a.term_until && t('mandato até {d}', { d: br(a.term_until) })].filter(Boolean).join(' · ')}</p>
        </div>
        <div className="flex flex-wrap items-center gap-1">
          {st.reportDue && <V2Badge tone="amber">{tn(st.overdueDays, 'Relatório atrasado {n} dia', 'Relatório atrasado {n} dias')}</V2Badge>}
          {st.needsReaccept && <V2Badge tone="amber">{t('Falta aceitar o código novo')}</V2Badge>}
          {!st.appointed && <V2Badge tone={a.status === 'applied' ? 'blue' : 'gray'}>{t(AMBASSADOR_STATUS_LABELS[a.status] || a.status)}</V2Badge>}
          {a.status === 'applied' && <V2Button type="button" size="sm" onClick={() => onAct({ tipo: 'nomear', amb: a })}>{t('Nomear')}</V2Button>}
          {a.status === 'applied' && <V2Button type="button" size="sm" variant="ghost" onClick={() => onAct({ tipo: 'recusar', amb: a })}>{t('Recusar')}</V2Button>}
          {st.appointed && <V2Button type="button" size="sm" variant="ghost" aria-label={t('Editar {nome}', { nome: a.user_name })} onClick={() => onAct({ tipo: 'editar', amb: a })}><Pencil className="h-4 w-4" /></V2Button>}
          {st.appointed && <V2Button type="button" size="sm" variant="ghost" onClick={() => onAct({ tipo: 'encerrar', amb: a })}>{t('Encerrar')}</V2Button>}
        </div>
      </div>
      {a.status === 'applied' && <p className="whitespace-pre-line rounded-xl bg-gray-50 p-3 text-sm text-gray-700">{a.motivation}</p>}
      {a.decision?.reason && a.status !== 'applied' && <p className="text-xs text-gray-500">{t('Motivo: {m}', { m: a.decision.reason })}</p>}
      {reports.length > 0 && (
        <details>
          <summary className="cursor-pointer text-sm font-semibold text-ink">{tn(reports.length, '{n} relatório', '{n} relatórios')}{a.next_report_due && st.appointed ? ` · ${t('próximo em {d}', { d: br(a.next_report_due) })}` : ''}</summary>
          <ul className="mt-2 space-y-2">
            {reports.map((r) => <li key={r.id} className="rounded-xl bg-gray-50 p-3 text-sm"><p className="text-xs text-gray-500">{fmtData(r.at_ms)}</p><p className="whitespace-pre-line text-gray-700">{r.text}</p></li>)}
          </ul>
        </details>
      )}
    </li>
  );
}

export default function AmbassadorsManager({ federation, admin }) {
  const q = useAmbassadors(federation.id);
  const [acao, setAcao] = useState(null);
  const hoje = isoDate();
  const grupos = useMemo(() => {
    const xs = q.data || [];
    return {
      applied: xs.filter((a) => a.status === 'applied'),
      appointed: xs.filter((a) => ambassadorState(a, federation.ambassador_rules, hoje).appointed),
      outros: xs.filter((a) => a.status !== 'applied' && !ambassadorState(a, federation.ambassador_rules, hoje).appointed),
    };
  }, [q.data, federation.ambassador_rules, hoje]);
  const lista = (xs, label) => xs.length > 0 && (
    <V2Surface variant="compacto" className="px-4">
      <ul aria-label={label}>{xs.map((a) => <AmbassadorRow key={a.id} federation={federation} amb={a} hoje={hoje} onAct={setAcao} />)}</ul>
    </V2Surface>
  );
  return (
    <section className="space-y-4" aria-label={t('Embaixadores regionais')} data-dica="federacao-embaixadores">
      <div>
        <h2 className="flex items-center gap-2 font-display text-xl font-bold text-ink"><MapPin className="h-5 w-5" aria-hidden="true" />{t('Embaixadores regionais')}</h2>
        <p className="text-sm text-gray-500">{t('Filiados que representam a federação numa região: divulgam, ajudam clubes novos e mandam um relatório periódico. Aparecem na página pública por região, sem contato pessoal.')}</p>
      </div>
      {admin && <RulesEditor key={federation.ambassador_rules?.conduct_version || 0} federation={federation} />}
      {q.isError ? <V2ErrorState inline title={t('Não carregaram os embaixadores')} onRetry={q.refetch} />
        : q.isLoading ? <V2Skeleton lines={4} />
          : !q.data.length ? <V2EmptyState icon={Users} title={t('Nenhuma candidatura ainda')} description={t('O filiado em dia se candidata pela área dele na página da federação.')} />
            : (
              <>
                {grupos.applied.length > 0 && <h3 className="font-semibold text-ink">{tn(grupos.applied.length, '{n} candidatura em análise', '{n} candidaturas em análise')}</h3>}
                {lista(grupos.applied, t('Candidaturas em análise'))}
                {grupos.appointed.length > 0 && <h3 className="font-semibold text-ink">{tn(grupos.appointed.length, '{n} embaixador nomeado', '{n} embaixadores nomeados')}</h3>}
                {lista(grupos.appointed, t('Embaixadores nomeados'))}
                {grupos.outros.length > 0 && (
                  <details>
                    <summary className="cursor-pointer text-sm font-semibold text-ink">{tn(grupos.outros.length, 'Histórico ({n})', 'Histórico ({n})')}</summary>
                    <div className="mt-2">{lista(grupos.outros, t('Histórico de embaixadores'))}</div>
                  </details>
                )}
              </>
            )}
      {acao && (acao.tipo === 'nomear' || acao.tipo === 'editar') && <AppointDialog federation={federation} amb={acao.amb} editar={acao.tipo === 'editar'} onClose={() => setAcao(null)} />}
      {acao && (acao.tipo === 'recusar' || acao.tipo === 'encerrar') && <ReasonDialog federation={federation} amb={acao.amb} encerrar={acao.tipo === 'encerrar'} onClose={() => setAcao(null)} />}
    </section>
  );
}
