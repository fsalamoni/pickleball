/**
 * SELO DE CLUBE CERTIFICADO (Central → Rede e desenvolvimento → Selo de
 * clubes, módulo `club_seal`). O admin define o nome do selo, a validade e
 * os critérios; a secretaria e o admin conferem os pedidos — as evidências
 * enviadas por quem gere o clube ou a arena e o que a plataforma conferiu
 * sozinha (arena: torneio chancelado e professor licenciado) —, marcam cada
 * critério e concedem, recusam ou cassam com motivo. O selo concedido aparece
 * na aba Clubes e arenas da página pública.
 */
import React, { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { BadgeCheck, CheckCircle2, CircleHelp, Paperclip, Plus, RefreshCw, Settings2, Trash2, XCircle } from 'lucide-react';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { useAuth } from '@/core/lib/FirebaseAuthContext';
import { isoDate } from '@/modules/federations/domain/membership';
import { SEAL_AUTO, SEAL_AUTO_LABELS, SEAL_LIMITS, SEAL_STATUS_LABELS, autoApplies, normalizeSealRules, sealDecision, sealState, validateSealRules } from '@/modules/federations/domain/development';
import { useClubSeals, useDevelopmentAction } from '@/modules/federations/hooks/useDevelopment';
import { useFederationMutation } from '@/modules/federations/hooks/useFederations';
import { developmentAction, saveSealRules } from '@/modules/federations/services/developmentService';
import { V2Badge, V2Button, V2EmptyState, V2ErrorState, V2Field, V2Input, V2Select, V2Skeleton, V2Surface, V2Textarea, V2Toggle } from '@/v2/ui/primitives';
import { t, tn } from '@/core/i18n';
import { baixarArquivoDoServidor } from '../manage/accounts/accountsForms';

const ok = (msg, depois) => ({ onSuccess: () => { toast.success(msg); depois?.(); }, onError: (e) => toast.error(e.message) });
const br = (iso) => (iso ? String(iso).split('-').reverse().join('/') : '');
const TOM = { applied: 'blue', granted: 'green', rejected: 'gray', revoked: 'red' };
const tipo = (k) => (k === 'arena' ? t('Arena') : t('Clube'));

function RulesEditor({ federation }) {
  const { user } = useAuth();
  const atual = normalizeSealRules(federation.club_seal);
  const [f, setF] = useState(() => atual);
  const m = useFederationMutation((input) => saveSealRules(federation.id, input, { uid: user?.uid }));
  const r = validateSealRules(f);
  const setC = (i, k, v) => setF((x) => ({ ...x, criteria: x.criteria.map((c, j) => (j === i ? { ...c, [k]: v } : c)) }));
  return (
    <details className="rounded-2xl border border-gray-200 bg-white p-4">
      <summary className="flex cursor-pointer items-center gap-2 font-semibold text-ink"><Settings2 className="h-4 w-4" aria-hidden="true" />{t('Regras do selo')}<span className="text-sm font-normal text-gray-500">· {atual.name} · {tn(atual.validity_months, 'vale {n} mês', 'vale {n} meses')} · {tn(atual.criteria.length, '{n} critério', '{n} critérios')}</span></summary>
      <div className="mt-3 space-y-3">
        <V2Toggle id="selo-aberto" checked={f.open} onChange={(v) => setF((x) => ({ ...x, open: v }))} label={t('Receber pedidos')} hint={t('Fechado, os clubes e arenas não pedem o selo. Os selos concedidos seguem valendo.')} />
        <div className="grid gap-3 sm:grid-cols-2">
          <V2Field label={t('Nome do selo')} htmlFor="selo-nome"><V2Input id="selo-nome" maxLength={SEAL_LIMITS.NAME_MAX} value={f.name} onChange={(e) => setF((x) => ({ ...x, name: e.target.value }))} /></V2Field>
          <V2Field label={t('Validade (meses)')} htmlFor="selo-meses"><V2Input id="selo-meses" type="number" min={SEAL_LIMITS.MONTHS_MIN} max={SEAL_LIMITS.MONTHS_MAX} value={f.validity_months} onChange={(e) => setF((x) => ({ ...x, validity_months: e.target.value }))} /></V2Field>
        </div>
        <div className="space-y-2">
          <p className="text-sm font-semibold text-ink">{t('Critérios')}</p>
          {f.criteria.map((c, i) => (
            <div key={c.id} className="space-y-2 rounded-xl border border-gray-100 p-3">
              <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
                <V2Input aria-label={t('Nome do critério')} maxLength={SEAL_LIMITS.LABEL_MAX} value={c.label} onChange={(e) => setC(i, 'label', e.target.value)} />
                <V2Button type="button" variant="ghost" aria-label={t('Tirar o critério {nome}', { nome: c.label })} onClick={() => setF((x) => ({ ...x, criteria: x.criteria.filter((_, j) => j !== i) }))}><Trash2 className="h-4 w-4" /></V2Button>
              </div>
              <V2Input aria-label={t('O que o clube manda como evidência')} placeholder={t('O que o clube manda como evidência')} maxLength={SEAL_LIMITS.DESCRIPTION_MAX} value={c.description} onChange={(e) => setC(i, 'description', e.target.value)} />
              <div className="grid gap-2 sm:grid-cols-2">
                <V2Select aria-label={t('Conferência automática')} value={c.auto} onChange={(e) => setC(i, 'auto', e.target.value)} options={[{ value: '', label: t('Sem conferência automática') }, ...Object.values(SEAL_AUTO).map((a) => ({ value: a, label: t(SEAL_AUTO_LABELS[a]) }))]} />
                <V2Toggle id={`selo-obr-${c.id}`} checked={c.required} onChange={(v) => setC(i, 'required', v)} label={t('Obrigatório')} />
              </div>
            </div>
          ))}
          {r.errors.criteria && <p className="text-xs text-red-600">{r.errors.criteria}</p>}
          {f.criteria.length < SEAL_LIMITS.CRITERIA_MAX && <V2Button type="button" size="sm" variant="secondary" onClick={() => setF((x) => ({ ...x, criteria: [...x.criteria, { id: `c${Date.now().toString(36)}`, label: '', description: '', auto: '', required: true }] }))}><Plus className="h-4 w-4" />{t('Acrescentar critério')}</V2Button>}
          <p className="text-xs text-gray-500">{t('A conferência automática vale só para arena (é o que a plataforma sabe dela); para clube, a equipe confere pela evidência. Mudar os critérios não mexe nos selos já concedidos.')}</p>
        </div>
        <div className="flex justify-end"><V2Button type="button" disabled={!r.ok || m.isPending} onClick={() => m.mutate(f, ok(t('Regras salvas.')))}>{t('Salvar regras')}</V2Button></div>
      </div>
    </details>
  );
}

function AutoMark({ value }) {
  if (value === true) return <span className="inline-flex items-center gap-1 text-xs text-green-700"><CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />{t('a plataforma conferiu')}</span>;
  if (value === false) return <span className="inline-flex items-center gap-1 text-xs text-amber-800"><XCircle className="h-3.5 w-3.5" aria-hidden="true" />{t('a plataforma não encontrou')}</span>;
  return <span className="inline-flex items-center gap-1 text-xs text-gray-500"><CircleHelp className="h-3.5 w-3.5" aria-hidden="true" />{t('a equipe confere')}</span>;
}

function SealCard({ federation, seal: s, hoje }) {
  const m = useDevelopmentAction(federation.id);
  const st = sealState(s, hoje);
  const criterios = s.criteria?.length ? s.criteria : normalizeSealRules(federation.club_seal).criteria;
  const [marcados, setMarcados] = useState({});
  const [nota, setNota] = useState('');
  const [motivo, setMotivo] = useState(null);
  const [abrindo, setAbrindo] = useState('');
  const auto = s.auto_checks || {};
  const dec = sealDecision({ ...federation.club_seal, criteria: criterios }, s.kind, auto, marcados);
  const abrir = async (critId) => {
    setAbrindo(critId);
    try { baixarArquivoDoServidor(await developmentAction(federation.id, 'seal_file', { sealId: s.id, criterionId: critId })); } catch (e) { toast.error(e.message); } finally { setAbrindo(''); }
  };
  return (
    <li className="space-y-3 border-b border-gray-100 py-4 last:border-0">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-semibold text-ink">{s.org_name}</p>
          <p className="text-xs text-gray-500">{[tipo(s.kind), s.org_city && `${s.org_city}${s.org_state ? `/${s.org_state}` : ''}`, st.validUntil && t('selo até {d}', { d: br(st.validUntil) })].filter(Boolean).join(' · ')}</p>
        </div>
        <div className="flex flex-wrap items-center gap-1">
          {st.applied && st.valid && <V2Badge tone="green">{t('Selo valendo')}</V2Badge>}
          <V2Badge tone={st.applied ? 'blue' : (st.valid ? (st.expiring ? 'amber' : 'green') : TOM[s.status])}>{st.applied && st.valid ? t('Renovação em análise') : !st.applied && s.status === 'granted' && !st.valid ? t('Selo vencido') : t(SEAL_STATUS_LABELS[s.status] || s.status)}</V2Badge>
          {st.applied && <V2Button type="button" size="sm" variant="ghost" disabled={m.isPending} aria-label={t('Conferir de novo o que a plataforma sabe')} onClick={() => m.mutate({ action: 'seal_recheck', sealId: s.id }, ok(t('Conferido de novo.')))}><RefreshCw className="h-4 w-4" /></V2Button>}
          {st.valid && !st.applied && <V2Button type="button" size="sm" variant="ghost" onClick={() => setMotivo({ acao: 'seal_revoke' })}>{t('Cassar')}</V2Button>}
        </div>
      </div>
      {st.applied && (
        <>
          <ul className="space-y-2" aria-label={t('Critérios de {org}', { org: s.org_name })}>
            {criterios.map((c) => {
              const e = (s.evidence || {})[c.id];
              const daPlataforma = autoApplies(c, s.kind);
              return (
                <li key={c.id} className="rounded-xl bg-gray-50 p-3 text-sm">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <p className="font-semibold text-ink">{c.label}{!c.required && <span className="font-normal text-gray-500"> · {t('opcional')}</span>}</p>
                    {daPlataforma && <AutoMark value={auto[c.auto]} />}
                  </div>
                  {e?.text && <p className="mt-1 whitespace-pre-line text-gray-700">{e.text}</p>}
                  {e?.file && <V2Button type="button" size="sm" variant="ghost" disabled={abrindo === c.id} onClick={() => abrir(c.id)}><Paperclip className="h-4 w-4" />{e.file.name || t('Abrir arquivo')}</V2Button>}
                  {!e && !daPlataforma && <p className="mt-1 text-xs text-gray-500">{t('Sem evidência enviada.')}</p>}
                  {!(daPlataforma && auto[c.auto] === true) && (
                    <label className="mt-2 flex min-h-11 items-center gap-2 text-sm text-ink">
                      <input type="checkbox" className="h-4 w-4" checked={marcados[c.id] === true} onChange={(ev) => setMarcados((x) => ({ ...x, [c.id]: ev.target.checked }))} />
                      {t('Atende ao critério')}
                    </label>
                  )}
                </li>
              );
            })}
          </ul>
          <V2Field label={t('Observação da equipe (opcional)')} htmlFor={`selo-nota-${s.id}`}><V2Textarea id={`selo-nota-${s.id}`} rows={2} maxLength={SEAL_LIMITS.NOTE_MAX} value={nota} onChange={(e) => setNota(e.target.value)} /></V2Field>
          {!dec.ok && <p className="text-xs text-gray-500">{tn(dec.missing.length, 'Falta {n} critério obrigatório para conceder.', 'Faltam {n} critérios obrigatórios para conceder.')}</p>}
          <div className="flex flex-wrap justify-end gap-2">
            <V2Button type="button" variant="ghost" onClick={() => setMotivo({ acao: 'seal_reject' })}>{t('Recusar')}</V2Button>
            <V2Button type="button" disabled={!dec.ok || m.isPending} onClick={() => m.mutate({ action: 'seal_grant', sealId: s.id, checks: marcados, note: nota }, ok(t('Selo concedido.')))}><BadgeCheck className="h-4 w-4" />{t('Conceder o selo')}</V2Button>
          </div>
        </>
      )}
      {s.decision?.reason && !st.applied && <p className="text-xs text-gray-500">{t('Motivo: {m}', { m: s.decision.reason })}</p>}
      {motivo && (
        <ConfirmDialog
          open
          destructive
          onOpenChange={(o) => { if (!o) setMotivo(null); }}
          loading={m.isPending}
          confirmDisabled={String(motivo.texto || '').trim().length < 3}
          title={motivo.acao === 'seal_revoke' ? t('Cassar o selo de {org}?', { org: s.org_name }) : t('Recusar o pedido de {org}?', { org: s.org_name })}
          description={motivo.acao === 'seal_revoke' ? t('O selo sai da página na hora. Quem gere a organização é avisado com o motivo.') : t('Quem gere a organização é avisado com o motivo e pode pedir de novo.')}
          confirmLabel={motivo.acao === 'seal_revoke' ? t('Cassar') : t('Recusar')}
          cancelLabel={t('Voltar')}
          onConfirm={() => m.mutate({ action: motivo.acao, sealId: s.id, reason: motivo.texto }, ok(motivo.acao === 'seal_revoke' ? t('Selo cassado.') : t('Pedido recusado.'), () => setMotivo(null)))}
        >
          <V2Field label={t('Motivo')} htmlFor={`selo-motivo-${s.id}`}><V2Input id={`selo-motivo-${s.id}`} value={motivo.texto || ''} maxLength={300} onChange={(e) => setMotivo((x) => ({ ...x, texto: e.target.value }))} /></V2Field>
        </ConfirmDialog>
      )}
    </li>
  );
}

export default function SealsManager({ federation, admin }) {
  const q = useClubSeals(federation.id);
  const hoje = isoDate();
  const grupos = useMemo(() => {
    const xs = q.data || [];
    return {
      applied: xs.filter((s) => s.status === 'applied'),
      valid: xs.filter((s) => s.status !== 'applied' && sealState(s, hoje).valid),
      outros: xs.filter((s) => s.status !== 'applied' && !sealState(s, hoje).valid),
    };
  }, [q.data, hoje]);
  const lista = (xs, label) => xs.length > 0 && (
    <V2Surface variant="compacto" className="px-4"><ul aria-label={label}>{xs.map((s) => <SealCard key={s.id} federation={federation} seal={s} hoje={hoje} />)}</ul></V2Surface>
  );
  const nome = normalizeSealRules(federation.club_seal).name;
  return (
    <section className="space-y-4" aria-label={t('Selo de clubes')} data-dica="federacao-selo-clubes">
      <div>
        <h2 className="flex items-center gap-2 font-display text-xl font-bold text-ink"><BadgeCheck className="h-5 w-5" aria-hidden="true" />{t('Selo "{nome}"', { nome })}</h2>
        <p className="text-sm text-gray-500">{t('Clubes e arenas filiados pedem o selo mostrando que cumprem os critérios da federação. Quem gere a organização não decide o próprio selo.')}</p>
      </div>
      {admin && <RulesEditor federation={federation} />}
      {q.isError ? <V2ErrorState inline title={t('Não carregaram os pedidos de selo')} onRetry={q.refetch} />
        : q.isLoading ? <V2Skeleton lines={4} />
          : !q.data.length ? <V2EmptyState icon={BadgeCheck} title={t('Nenhum pedido de selo ainda')} description={t('Quem gere um clube ou arena filiado pede pelo cartão "Federação" da organização.')} />
            : (
              <>
                {grupos.applied.length > 0 && <h3 className="font-semibold text-ink">{tn(grupos.applied.length, '{n} pedido em análise', '{n} pedidos em análise')}</h3>}
                {lista(grupos.applied, t('Pedidos em análise'))}
                {grupos.valid.length > 0 && <h3 className="font-semibold text-ink">{tn(grupos.valid.length, '{n} selo valendo', '{n} selos valendo')}</h3>}
                {lista(grupos.valid, t('Selos valendo'))}
                {grupos.outros.length > 0 && (
                  <details>
                    <summary className="cursor-pointer text-sm font-semibold text-ink">{tn(grupos.outros.length, 'Histórico ({n})', 'Histórico ({n})')}</summary>
                    <div className="mt-2">{lista(grupos.outros, t('Histórico de selos'))}</div>
                  </details>
                )}
              </>
            )}
    </section>
  );
}
