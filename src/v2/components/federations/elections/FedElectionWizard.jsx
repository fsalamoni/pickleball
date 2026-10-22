/**
 * O ASSISTENTE do edital, passo a passo: cargos → calendário → colégio e
 * pesos (com a prévia de quem vota e o peso de cada grupo, vinda do
 * servidor, e os alertas de 1/3 e 1:6) → comissão eleitoral → revisar e
 * publicar. Rascunho muda tudo; edital publicado muda só calendário e
 * colégio, com motivo (vai ao histórico).
 */
import React, { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { AlertTriangle, Check, ChevronLeft, ChevronRight, Plus, Trash2 } from 'lucide-react';
import {
  CALENDAR_KEYS, CALENDAR_LABEL, CATEGORIES, CATEGORY_LABEL, MODE_LABEL, MODES, ORGANS, ORGAN_LABEL, POSITION_KINDS, POSITION_KIND_LABEL, POSITIONS_MAX, REASON_MIN,
  TIE_RULES, TIE_RULE_LABEL, WEIGHT_MAX, electionDraft, noticeText, validateElection,
} from '@/modules/federations/domain/elections';
import { useElectionAction } from '@/modules/federations/hooks/useElections';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { V2Badge, V2Button, V2Field, V2Input, V2Select, V2Surface, V2Textarea } from '@/v2/ui/primitives';
import { fmtNumero, t, tk } from '@/core/i18n';
import FedPersonPicker from '../manage/FedPersonPicker';
import { useAvisoNaoSalvo } from '../manage/naoSalvo';
import { hojeBr, pct } from './electionsUi';

const PASSOS = [
  { id: 'cargos', label: tk('Cargos'), chaves: (k) => k === 'title' || k.startsWith('positions') || k === 'endorsement_pct' },
  { id: 'calendario', label: tk('Calendário'), chaves: (k) => k.startsWith('calendar') || k === 'notice_min_days' },
  { id: 'colegio', label: tk('Colégio e pesos'), chaves: (k) => k.startsWith('college') },
  { id: 'comissao', label: tk('Comissão'), chaves: (k) => k === 'commission' },
  { id: 'revisar', label: tk('Revisar e publicar'), chaves: () => false },
];

const nomeDaPessoa = (a) => a?.platform_name || a?.full_name || a?.display_name || '';

function deEleicao(e, hoje) {
  if (!e) return electionDraft(hoje);
  const base = electionDraft(hoje);
  return {
    ...base, title: e.title || '', description: e.description || '', mode: e.mode || base.mode, tie_rule: e.tie_rule || base.tie_rule,
    endorsement_pct: e.endorsement_pct ?? 0, notice_min_days: e.notice_min_days ?? base.notice_min_days,
    positions: (e.positions || base.positions).map((p) => ({ ...p })), calendar: { ...base.calendar, ...(e.calendar || {}) },
    college: { min_months: e.college?.min_months ?? 0, weights: { ...base.college.weights, ...(e.college?.weights || {}) } },
    commission: (e.commission || []).map((p) => ({ ...p })),
  };
}

function PreviaColegio({ federation, f }) {
  const acao = useElectionAction();
  const [res, setRes] = useState(null);
  const pedir = () => acao.mutate({ federationId: federation.id, action: 'preview', election: f }, { onSuccess: setRes, onError: (er) => toast.error(er.message) });
  const b = res?.balance;
  return (
    <div className="space-y-3 rounded-2xl bg-gray-50 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-semibold text-ink">{t('Quem votaria hoje')}</p>
        <V2Button type="button" size="sm" variant="secondary" onClick={pedir} disabled={acao.isPending} data-dica="federacao-eleicao-previa">{acao.isPending ? t('Calculando…') : b ? t('Recalcular') : t('Ver a prévia do colégio')}</V2Button>
      </div>
      {!b && <p className="text-sm text-gray-500">{t('A prévia conta os filiados em dia hoje, com os pesos acima, e confere as regras da lei.')}</p>}
      {b && (
        <>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <caption className="sr-only">{t('Peso de cada grupo no colégio eleitoral')}</caption>
              <thead><tr className="text-left text-xs text-gray-500"><th className="py-1 font-semibold">{t('Grupo')}</th><th className="py-1 text-right font-semibold">{t('Eleitores')}</th><th className="py-1 text-right font-semibold">{t('Peso de cada voto')}</th><th className="py-1 text-right font-semibold">{t('Peso do grupo')}</th></tr></thead>
              <tbody>
                {CATEGORIES.map((k) => (
                  <tr key={k} className="border-t border-gray-200">
                    <td className="py-1.5">{t(CATEGORY_LABEL[k])}</td>
                    <td className="py-1.5 text-right tabular-nums">{fmtNumero(b.by_category[k].voters)}</td>
                    <td className="py-1.5 text-right tabular-nums">{b.by_category[k].unit || '—'}</td>
                    <td className="py-1.5 text-right tabular-nums">{fmtNumero(b.by_category[k].weight)} ({fmtNumero(pct(b.by_category[k].weight, b.total_weight))}%)</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-sm text-ink">{t('{n} eleitores, peso total {p}. Apoio exigido por chapa: {a}.', { n: fmtNumero(b.voters), p: fmtNumero(b.total_weight), a: fmtNumero(res.endorsements_needed) })}</p>
          <ul className="space-y-1 text-sm">
            <li className={b.athletes_ok ? 'text-green-800' : 'font-semibold text-red-700'}>{b.athletes_ok ? '✓ ' : '✗ '}{t('Atletas com {p}% do peso (a lei pede ao menos 1/3).', { p: fmtNumero(Math.round(b.athlete_share * 1000) / 10) })}</li>
            <li className={b.ratio_ok ? 'text-green-800' : 'font-semibold text-red-700'}>{b.ratio_ok ? '✓ ' : '✗ '}{t('Diferença entre pesos até 1 para 6.')}</li>
            {b.small.length > 0 && <li className="text-amber-800"><AlertTriangle className="mr-1 inline h-4 w-4" aria-hidden="true" />{t('Grupos com menos de 3 eleitores ({g}): o voto deles pode ser deduzido pela apuração. Considere juntar grupos ou zerar o peso.', { g: b.small.map((k) => t(CATEGORY_LABEL[k])).join(', ') })}</li>}
          </ul>
        </>
      )}
    </div>
  );
}

export default function FedElectionWizard({ federation, election = null, onClose }) {
  const hoje = hojeBr();
  const publicado = election?.status === 'published';
  const [f, setF] = useState(() => deEleicao(election, hoje));
  const [base] = useState(f);
  const [passo, setPasso] = useState(publicado ? 1 : 0);
  const [reason, setReason] = useState('');
  const [confirmar, setConfirmar] = useState(false);
  const acao = useElectionAction();
  useAvisoNaoSalvo(JSON.stringify(f) !== JSON.stringify(base));
  const r = useMemo(() => validateElection(f), [f]);
  const errosDo = (i) => Object.entries(r.errors).filter(([k]) => PASSOS[i].chaves(k));
  const err = (k) => r.errors[k];
  const set = (k, v) => setF((x) => ({ ...x, [k]: v }));
  const setPos = (i, k, v) => setF((x) => ({ ...x, positions: x.positions.map((p, j) => (j === i ? { ...p, [k]: v } : p)) }));
  const setCal = (k, v) => setF((x) => ({ ...x, calendar: { ...x.calendar, [k]: v } }));
  const setPeso = (k, v) => setF((x) => ({ ...x, college: { ...x.college, weights: { ...x.college.weights, [k]: v } } }));
  const passos = publicado ? [1, 2, 4] : [0, 1, 2, 3, 4];
  const pos = passos.indexOf(passo);

  const salvar = async (publicar = false) => {
    if (!r.ok) { toast.error(Object.values(r.errors)[0]); return; }
    if (publicado && reason.trim().length < REASON_MIN) { toast.error(t('Diga o motivo da mudança (mínimo {n} caracteres).', { n: REASON_MIN })); return; }
    try {
      let id = election?.id;
      if (id) await acao.mutateAsync({ federationId: federation.id, action: 'update', electionId: id, election: r.value, reason: publicado ? reason : '' });
      else id = (await acao.mutateAsync({ federationId: federation.id, action: 'create', election: r.value })).electionId;
      if (publicar) {
        const res = await acao.mutateAsync({ federationId: federation.id, action: 'publish', electionId: id });
        toast.success(t('Edital publicado. {n} filiados avisados.', { n: res?.notified || 0 }));
      } else toast.success(publicado ? t('Edital atualizado.') : t('Rascunho salvo.'));
      onClose?.(id);
    } catch (er) {
      toast.error(er.message);
    }
  };

  return (
    <V2Surface className="space-y-5 p-5 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="font-display text-xl text-ink">{election ? (publicado ? t('Ajustar o edital publicado') : t('Editar o rascunho')) : t('Nova eleição')}</h3>
        <V2Button type="button" variant="ghost" size="sm" onClick={() => onClose?.(null)}>{t('Fechar')}</V2Button>
      </div>
      <ol className="flex flex-wrap gap-2" aria-label={t('Passos')}>
        {passos.map((i, n) => {
          const erros = errosDo(i).length;
          return (
            <li key={PASSOS[i].id}>
              <button type="button" onClick={() => setPasso(i)} aria-current={i === passo ? 'step' : undefined}
                className={`inline-flex min-h-11 items-center gap-2 rounded-full px-3 text-sm font-semibold ${i === passo ? 'bg-ink text-white' : 'bg-gray-100 text-ink hover:bg-gray-200'}`}>
                <span className="tabular-nums">{n + 1}.</span>{t(PASSOS[i].label)}
                {erros > 0 && <V2Badge tone="red">{erros}</V2Badge>}
              </button>
            </li>
          );
        })}
      </ol>

      {passo === 0 && (
        <div className="space-y-4">
          <V2Field label={t('Título da eleição')} htmlFor="el-titulo" required error={err('title')}><V2Input id="el-titulo" maxLength={120} value={f.title} onChange={(e) => set('title', e.target.value)} placeholder={t('Ex.: Eleições 2027–2030')} /></V2Field>
          <V2Field label={t('Descrição')} htmlFor="el-desc" hint={t('O que se elege e para qual mandato. Vai no edital.')}><V2Textarea id="el-desc" rows={3} maxLength={2000} value={f.description} onChange={(e) => set('description', e.target.value)} /></V2Field>
          <fieldset className="space-y-3">
            <legend className="text-sm font-semibold text-ink">{t('Cargos')}</legend>
            {f.positions.map((p, i) => (
              <div key={i} className="grid gap-3 rounded-2xl border border-gray-100 p-3 md:grid-cols-[2fr_1fr_1fr_auto_auto_auto] md:items-end">
                <V2Field label={t('Cargo')} htmlFor={`el-p${i}`} error={err(`positions.${i}.label`)}><V2Input id={`el-p${i}`} maxLength={80} value={p.label} onChange={(e) => setPos(i, 'label', e.target.value)} /></V2Field>
                <V2Field label={t('Forma')} htmlFor={`el-pk${i}`}><V2Select id={`el-pk${i}`} value={p.kind} onChange={(e) => setPos(i, 'kind', e.target.value)}>{POSITION_KINDS.map((k) => <option key={k} value={k}>{t(POSITION_KIND_LABEL[k])}</option>)}</V2Select></V2Field>
                <V2Field label={t('Órgão')} htmlFor={`el-po${i}`}><V2Select id={`el-po${i}`} value={p.organ} onChange={(e) => setPos(i, 'organ', e.target.value)}>{ORGANS.map((k) => <option key={k} value={k}>{t(ORGAN_LABEL[k])}</option>)}</V2Select></V2Field>
                {p.kind === 'individual' && <V2Field label={t('Vagas')} htmlFor={`el-ps${i}`} error={err(`positions.${i}.seats`)}><V2Input id={`el-ps${i}`} type="number" min={1} max={20} className="md:w-20" value={p.seats} onChange={(e) => setPos(i, 'seats', e.target.value)} /></V2Field>}
                <V2Field label={t('Mínimo de cada sexo')} htmlFor={`el-pg${i}`} error={err(`positions.${i}.gender_min`)}><V2Input id={`el-pg${i}`} type="number" min={0} max={10} className="md:w-20" value={p.gender_min} onChange={(e) => setPos(i, 'gender_min', e.target.value)} /></V2Field>
                <V2Button type="button" variant="ghost" size="icon" aria-label={t('Tirar o cargo {c}', { c: p.label || i + 1 })} disabled={f.positions.length < 2} onClick={() => set('positions', f.positions.filter((_, j) => j !== i))}><Trash2 className="h-4 w-4" /></V2Button>
              </div>
            ))}
            {err('positions') && <p className="text-sm text-red-700">{err('positions')}</p>}
            {f.positions.length < POSITIONS_MAX && <V2Button type="button" variant="secondary" size="sm" onClick={() => set('positions', [...f.positions, { label: '', kind: 'individual', organ: 'fiscal', seats: 3, gender_min: 0 }])}><Plus className="h-4 w-4" />{t('Incluir cargo')}</V2Button>}
          </fieldset>
          <div className="grid gap-3 md:grid-cols-3">
            <V2Field label={t('Como se vota')} htmlFor="el-modo"><V2Select id="el-modo" value={f.mode} onChange={(e) => set('mode', e.target.value)}>{MODES.map((k) => <option key={k} value={k}>{t(MODE_LABEL[k])}</option>)}</V2Select></V2Field>
            <V2Field label={t('Em caso de empate')} htmlFor="el-empate"><V2Select id="el-empate" value={f.tie_rule} onChange={(e) => set('tie_rule', e.target.value)}>{TIE_RULES.map((k) => <option key={k} value={k}>{t(TIE_RULE_LABEL[k])}</option>)}</V2Select></V2Field>
            <V2Field label={t('Apoio exigido por chapa (%)')} htmlFor="el-apoio" error={err('endorsement_pct')} hint={t('Percentual do colégio que precisa apoiar a chapa. A lei limita a 5%.')}><V2Input id="el-apoio" type="number" min={0} max={5} step={0.5} value={f.endorsement_pct} onChange={(e) => set('endorsement_pct', e.target.value)} /></V2Field>
          </div>
        </div>
      )}

      {passo === 1 && (
        <div className="space-y-4">
          <p className="text-sm text-gray-500">{t('Todas as datas no horário de Brasília. O edital sai na data em que for publicado.')}</p>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {CALENDAR_KEYS.map((k) => (
              <V2Field key={k} label={t(CALENDAR_LABEL[k])} htmlFor={`el-${k}`} required={k !== 'inauguration_on'} error={err(`calendar.${k}`)}>
                <V2Input id={`el-${k}`} type="date" value={f.calendar[k] || ''} disabled={k === 'notice_on' && (publicado || !election)} onChange={(e) => setCal(k, e.target.value)} />
              </V2Field>
            ))}
            <V2Field label={t('A votação abre às')} htmlFor="el-abre"><V2Input id="el-abre" type="time" value={f.calendar.voting_opens} onChange={(e) => setCal('voting_opens', e.target.value)} /></V2Field>
            <V2Field label={t('E fecha às')} htmlFor="el-fecha"><V2Input id="el-fecha" type="time" value={f.calendar.voting_closes} onChange={(e) => setCal('voting_closes', e.target.value)} /></V2Field>
            <V2Field label={t('Antecedência mínima do edital (dias)')} htmlFor="el-antec" error={err('notice_min_days')} hint={t('Do edital até a votação. Confira o estatuto.')}><V2Input id="el-antec" type="number" min={0} max={365} value={f.notice_min_days} onChange={(e) => set('notice_min_days', e.target.value)} /></V2Field>
          </div>
        </div>
      )}

      {passo === 2 && (
        <div className="space-y-4">
          <V2Field label={t('Filiado há quantos meses, na abertura da votação')} htmlFor="el-meses" error={err('college.min_months')} hint={t('0 = qualquer filiado em dia. Dependentes (sem conta própria) não votam.')}><V2Input id="el-meses" type="number" min={0} max={60} className="sm:w-32" value={f.college.min_months} onChange={(e) => set('college', { ...f.college, min_months: e.target.value })} /></V2Field>
          <fieldset>
            <legend className="text-sm font-semibold text-ink">{t('Peso do voto de cada grupo (0 = não vota)')}</legend>
            <div className="mt-2 grid gap-3 sm:grid-cols-3 lg:grid-cols-5">
              {CATEGORIES.map((k) => (
                <V2Field key={k} label={t(CATEGORY_LABEL[k])} htmlFor={`el-w-${k}`} error={err(`college.weights.${k}`)}>
                  <V2Input id={`el-w-${k}`} type="number" min={k === 'athlete' ? 1 : 0} max={WEIGHT_MAX} value={f.college.weights[k]} onChange={(e) => setPeso(k, e.target.value)} />
                </V2Field>
              ))}
            </div>
            <p className="mt-2 text-xs text-gray-500">{t('Clubes e arenas votam pelo representante que pediu a filiação. A lei pede atletas com ao menos 1/3 do peso total e no máximo 1 para 6 entre pesos.')}</p>
          </fieldset>
          <PreviaColegio federation={federation} f={r.value} />
        </div>
      )}

      {passo === 3 && (
        <div className="space-y-3">
          <p className="text-sm text-gray-500">{t('A comissão conduz a eleição: analisa chapas, julga impugnações, abre e encerra a votação e publica o resultado. Quem está na comissão não concorre. Sem comissão, o admin da federação conduz.')}</p>
          {f.commission.length === 0 && <p className="rounded-2xl bg-amber-50 px-4 py-3 text-sm text-amber-900">{t('Sem comissão nomeada: o admin da federação vai conduzir. O ideal é nomear de 3 a 5 pessoas.')}</p>}
          <FedPersonPicker id="el-comissao" multiple max={7}
            selecionados={f.commission.map((p) => ({ id: p.uid, platform_name: p.name }))}
            onChange={(lista) => set('commission', lista.map((a) => ({ uid: a.id, name: nomeDaPessoa(a) })))} />
          {err('commission') && <p className="text-sm text-red-700">{err('commission')}</p>}
        </div>
      )}

      {passo === 4 && (
        <div className="space-y-4">
          {!r.ok && (
            <div className="rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-800">
              <p className="font-semibold">{t('Falta acertar antes de salvar:')}</p>
              <ul className="mt-1 list-disc pl-5">{Object.values(r.errors).slice(0, 6).map((m) => <li key={m}>{m}</li>)}</ul>
            </div>
          )}
          <div>
            <p className="text-sm font-semibold text-ink">{t('Prévia do edital')}</p>
            <pre className="mt-2 max-h-80 overflow-auto whitespace-pre-wrap rounded-2xl bg-gray-50 p-4 font-sans text-sm text-ink">{noticeText(federation, { ...r.value, calendar: { ...r.value.calendar, notice_on: publicado ? r.value.calendar.notice_on : hoje } })}</pre>
            {federation.modules?.official_docs === true ? <p className="mt-1 text-xs text-gray-500">{t('Ao publicar, o edital entra no acervo oficial, numerado.')}</p> : <p className="mt-1 text-xs text-gray-500">{t('O acervo oficial está desligado: o edital fica só na aba Eleições.')}</p>}
          </div>
          {publicado && <V2Field label={t('Motivo da mudança')} htmlFor="el-motivo" required hint={t('Fica no histórico da eleição.')}><V2Textarea id="el-motivo" rows={2} maxLength={1000} value={reason} onChange={(e) => setReason(e.target.value)} /></V2Field>}
          <div className="flex flex-wrap gap-2">
            {publicado
              ? <V2Button type="button" onClick={() => salvar(false)} disabled={acao.isPending || !r.ok}><Check className="h-4 w-4" />{t('Salvar o ajuste')}</V2Button>
              : (
                <>
                  <V2Button type="button" variant="secondary" onClick={() => salvar(false)} disabled={acao.isPending || !r.ok} data-dica="federacao-eleicao-rascunho">{t('Salvar rascunho')}</V2Button>
                  <V2Button type="button" onClick={() => setConfirmar(true)} disabled={acao.isPending || !r.ok} data-dica="federacao-eleicao-publicar"><Check className="h-4 w-4" />{t('Publicar o edital')}</V2Button>
                </>
              )}
          </div>
        </div>
      )}

      <div className="flex justify-between gap-2 border-t border-gray-100 pt-4">
        <V2Button type="button" variant="ghost" disabled={pos <= 0} onClick={() => setPasso(passos[pos - 1])}><ChevronLeft className="h-4 w-4" />{t('Voltar')}</V2Button>
        {pos < passos.length - 1 && <V2Button type="button" variant="secondary" onClick={() => setPasso(passos[pos + 1])}>{t('Avançar')}<ChevronRight className="h-4 w-4" /></V2Button>}
      </div>
      <ConfirmDialog
        open={confirmar}
        onOpenChange={setConfirmar}
        title={t('Publicar o edital?')}
        description={t('Os cargos não mudam mais depois de publicados, e todos os filiados são avisados. Calendário e colégio ainda podem ser ajustados, com motivo.')}
        confirmLabel={t('Publicar')}
        cancelLabel={t('Revisar mais')}
        onConfirm={() => { setConfirmar(false); salvar(true); }}
      />
    </V2Surface>
  );
}
