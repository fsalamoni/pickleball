/**
 * EDITAIS DE SEDE na Central (`?aba=sedes`, Bloco 3b): a equipe de
 * competições escreve o edital (evento, prazos, critérios e pesos), publica —
 * os clubes e arenas filiados são avisados —, escolhe quais cartas de
 * intenção seguem, recebe as propostas, dá as notas (cada avaliador a sua; a
 * nota final é a média) e publica o resultado. Escolher quem não teve a maior
 * nota exige motivo, que sai publicado. Toda escrita é do servidor.
 */
import React, { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { CalendarClock, Check, MapPin, Pencil, Plus, Send, Trash2 } from 'lucide-react';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useAuth } from '@/core/lib/FirebaseAuthContext';
import { isoDate } from '@/modules/federations/domain/membership';
import {
  DEFAULT_HOST_CRITERIA, HOST_BID_STATUS as BS, HOST_BID_STATUS_LABELS, HOST_ENTRY_STAGE as ES, HOST_ENTRY_STAGE_LABELS, HOST_LIMITS,
  hostBidPhase, hostRanking, hostResultNeedsReason, normalizeHostCriteria, validateHostBid, validateHostExtend, validateHostScores, weightedScore,
} from '@/modules/federations/domain/hosting';
import { useBidEntries, useBidScores, useHostBids, useHostingAction } from '@/modules/federations/hooks/useHosting';
import { V2Badge, V2Button, V2EmptyState, V2ErrorState, V2Field, V2Input, V2Select, V2Skeleton, V2Textarea } from '@/v2/ui/primitives';
import { t, tn } from '@/core/i18n';
import { ProposalFileButton, TOM_CANDIDATURA, TOM_EDITAL_SEDE, br, cidadeUf, periodo } from './hostingUi';

const ok = (msg, depois) => ({ onSuccess: (r) => { toast.success(typeof msg === 'function' ? msg(r) : msg); depois?.(r); }, onError: (e) => toast.error(e.message) });

/* ---------------------------------------------------------------- editor -- */

function BidEditor({ federation, bid, onClose }) {
  const [f, setF] = useState(() => ({
    title: bid?.title || '', event_name: bid?.event_name || '', event_start: bid?.event_start || '', event_end: bid?.event_end || '',
    description: bid?.description || '', requirements: bid?.requirements || '', intent_until: bid?.intent_until || '', proposal_until: bid?.proposal_until || '',
    criteria: (bid?.criteria?.length ? bid.criteria : DEFAULT_HOST_CRITERIA).map((c) => ({ ...c, label: bid ? c.label : t(c.label) })),
  }));
  const set = (k, v) => setF((x) => ({ ...x, [k]: v }));
  const setCrit = (i, patch) => set('criteria', f.criteria.map((c, j) => (j === i ? { ...c, ...patch } : c)));
  const m = useHostingAction(federation.id);
  const r = validateHostBid(f, isoDate());
  const salvar = () => m.mutate({ action: 'bid_save', bidId: bid?.id, ...f }, ok(t('Edital salvo.'), onClose));
  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-h-[90dvh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{bid ? t('Editar edital de sede') : t('Novo edital de sede')}</DialogTitle>
          <DialogDescription>{t('O edital nasce como rascunho. Publicado, as regras ficam como foram anunciadas: só os prazos podem ser estendidos, com motivo.')}</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <V2Field label={t('Título do edital')} htmlFor="sd-titulo" error={r.errors.title} hint={t('Ex.: Edital de sede do Estadual 2027')}><V2Input id="sd-titulo" value={f.title} maxLength={120} onChange={(e) => set('title', e.target.value)} /></V2Field>
          <V2Field label={t('Evento')} htmlFor="sd-evento" error={r.errors.event_name}><V2Input id="sd-evento" value={f.event_name} maxLength={120} onChange={(e) => set('event_name', e.target.value)} /></V2Field>
          <div className="grid gap-3 sm:grid-cols-2">
            <V2Field label={t('O evento começa em')} htmlFor="sd-inicio" error={r.errors.event_start}><V2Input id="sd-inicio" type="date" value={f.event_start} onChange={(e) => set('event_start', e.target.value)} /></V2Field>
            <V2Field label={t('Termina em (opcional)')} htmlFor="sd-fim" error={r.errors.event_end}><V2Input id="sd-fim" type="date" value={f.event_end} onChange={(e) => set('event_end', e.target.value)} /></V2Field>
            <V2Field label={t('Cartas de intenção até')} htmlFor="sd-carta" error={r.errors.intent_until}><V2Input id="sd-carta" type="date" value={f.intent_until} onChange={(e) => set('intent_until', e.target.value)} /></V2Field>
            <V2Field label={t('Propostas até')} htmlFor="sd-proposta" error={r.errors.proposal_until}><V2Input id="sd-proposta" type="date" value={f.proposal_until} onChange={(e) => set('proposal_until', e.target.value)} /></V2Field>
          </div>
          <V2Field label={t('Descrição do evento')} htmlFor="sd-descricao" error={r.errors.description} hint={t('Público esperado, formato, quantos dias, o que a federação leva.')}><V2Textarea id="sd-descricao" rows={4} maxLength={HOST_LIMITS.TEXT_MAX} value={f.description} onChange={(e) => set('description', e.target.value)} /></V2Field>
          <V2Field label={t('O que a sede precisa ter (opcional)')} htmlFor="sd-requisitos" hint={t('Número de quadras, vestiário, estacionamento, transmissão…')}><V2Textarea id="sd-requisitos" rows={3} maxLength={HOST_LIMITS.TEXT_MAX} value={f.requirements} onChange={(e) => set('requirements', e.target.value)} /></V2Field>
          <div className="space-y-2">
            <p className="text-sm font-semibold text-ink">{t('Critérios de avaliação e pesos')}</p>
            <p className="text-xs text-gray-500">{t('A comissão dá nota de 0 a 10 em cada critério; a nota da proposta é a média ponderada pelos pesos.')}</p>
            {f.criteria.map((c, i) => (
              <div key={c.id || i} className="grid items-end gap-2 rounded-xl border border-gray-100 p-2 sm:grid-cols-[1fr_5rem_auto]">
                <V2Field label={t('Critério {n}', { n: i + 1 })} htmlFor={`sd-crit-${i}`}><V2Input id={`sd-crit-${i}`} value={c.label} maxLength={HOST_LIMITS.LABEL_MAX} onChange={(e) => setCrit(i, { label: e.target.value })} /></V2Field>
                <V2Field label={t('Peso')} htmlFor={`sd-peso-${i}`}><V2Input id={`sd-peso-${i}`} type="number" min={1} max={HOST_LIMITS.WEIGHT_MAX} value={c.weight} onChange={(e) => setCrit(i, { weight: e.target.value })} /></V2Field>
                <V2Button type="button" size="sm" variant="ghost" aria-label={t('Tirar critério {n}', { n: i + 1 })} disabled={f.criteria.length <= 1} onClick={() => set('criteria', f.criteria.filter((_, j) => j !== i))}><Trash2 className="h-4 w-4" /></V2Button>
              </div>
            ))}
            {r.errors.criteria && <p className="text-xs text-red-600">{r.errors.criteria}</p>}
            <V2Button type="button" size="sm" variant="ghost" disabled={f.criteria.length >= HOST_LIMITS.CRITERIA_MAX} onClick={() => set('criteria', [...f.criteria, { id: `c${Date.now().toString(36)}`, label: '', description: '', weight: 1 }])}><Plus className="h-4 w-4" />{t('Acrescentar critério')}</V2Button>
          </div>
        </div>
        <div className="mt-3 flex justify-end gap-2">
          <V2Button type="button" variant="ghost" onClick={onClose}>{t('Cancelar')}</V2Button>
          <V2Button type="button" disabled={!r.ok || m.isPending} onClick={salvar}>{t('Salvar')}</V2Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function ExtendDialog({ federation, bid, onClose }) {
  const [f, setF] = useState({ intent_until: bid.intent_until, proposal_until: bid.proposal_until, reason: '' });
  const m = useHostingAction(federation.id);
  const r = validateHostExtend(bid, f, isoDate());
  return (
    <ConfirmDialog
      open
      onOpenChange={(o) => { if (!o) onClose(); }}
      loading={m.isPending}
      confirmDisabled={!r.ok}
      title={t('Estender os prazos?')}
      description={t('Quem já se candidatou recebe um aviso com os novos prazos e o motivo.')}
      confirmLabel={t('Estender')}
      cancelLabel={t('Voltar')}
      onConfirm={() => m.mutate({ action: 'bid_extend', bidId: bid.id, ...f }, ok(t('Prazos estendidos.'), onClose))}
    >
      <div className="grid gap-3 sm:grid-cols-2">
        {bid.status === BS.INTENT && <V2Field label={t('Cartas até')} htmlFor="sd-ext-carta"><V2Input id="sd-ext-carta" type="date" min={bid.intent_until} value={f.intent_until} onChange={(e) => setF((x) => ({ ...x, intent_until: e.target.value }))} /></V2Field>}
        <V2Field label={t('Propostas até')} htmlFor="sd-ext-proposta"><V2Input id="sd-ext-proposta" type="date" min={bid.proposal_until} value={f.proposal_until} onChange={(e) => setF((x) => ({ ...x, proposal_until: e.target.value }))} /></V2Field>
      </div>
      {r.errors.dates && <p className="text-xs text-red-600">{r.errors.dates}</p>}
      <V2Field label={t('Motivo')} htmlFor="sd-ext-motivo" hint={t('Fica no histórico do edital. Mínimo 3 caracteres.')}><V2Input id="sd-ext-motivo" value={f.reason} maxLength={300} onChange={(e) => setF((x) => ({ ...x, reason: e.target.value }))} /></V2Field>
    </ConfirmDialog>
  );
}

/* ------------------------------------------------------------------ notas -- */

function ScoreForm({ federation, bid, entry, minha }) {
  const criterios = normalizeHostCriteria(bid.criteria);
  const [notas, setNotas] = useState(() => Object.fromEntries(criterios.map((c) => [c.id, minha?.scores?.[c.id] ?? ''])));
  const [obs, setObs] = useState(minha?.note || '');
  const m = useHostingAction(federation.id);
  const r = validateHostScores(criterios, { scores: notas, note: obs });
  return (
    <div className="space-y-2 rounded-xl bg-gray-50 p-3">
      <p className="text-xs font-semibold text-ink">{minha ? t('Sua nota: {n}', { n: Number(minha.total || 0).toFixed(2) }) : t('Dê a sua nota')}</p>
      <div className="grid gap-2 sm:grid-cols-2">
        {criterios.map((c) => (
          <V2Field key={c.id} label={t('{criterio} (peso {p})', { criterio: c.label, p: c.weight })} htmlFor={`sd-nota-${entry.id}-${c.id}`}>
            <V2Input id={`sd-nota-${entry.id}-${c.id}`} type="number" min={0} max={HOST_LIMITS.SCORE_MAX} step={1} value={notas[c.id]} onChange={(e) => setNotas((x) => ({ ...x, [c.id]: e.target.value === '' ? '' : Number(e.target.value) }))} />
          </V2Field>
        ))}
      </div>
      <V2Field label={t('Observação (opcional, só a equipe lê)')} htmlFor={`sd-obs-${entry.id}`}><V2Input id={`sd-obs-${entry.id}`} value={obs} maxLength={HOST_LIMITS.NOTE_MAX} onChange={(e) => setObs(e.target.value)} /></V2Field>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-xs text-gray-600">{r.ok ? t('Nota ponderada: {n}', { n: weightedScore(criterios, r.value.scores).toFixed(2) }) : r.errors.scores}</span>
        <V2Button type="button" size="sm" disabled={!r.ok || m.isPending} onClick={() => m.mutate({ action: 'bid_score', bidId: bid.id, entryId: entry.id, scores: r.value.scores, note: obs }, ok(t('Nota registrada.')))}>{minha ? t('Atualizar nota') : t('Registrar nota')}</V2Button>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------ candidatura -- */

function Candidatura({ federation, bid, entry, notas, meUid, marcado, onMarcar }) {
  const [ver, setVer] = useState(false);
  const minha = notas.find((s) => s.entry_id === entry.id && s.evaluator_uid === meUid);
  const daEntrada = notas.filter((s) => s.entry_id === entry.id);
  const podeMarcar = bid.status === BS.INTENT && entry.stage === ES.INTENT;
  return (
    <li className="space-y-2 py-3 text-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="flex items-center gap-2 font-semibold text-ink">
          {podeMarcar && <input type="checkbox" className="h-5 w-5" checked={marcado} onChange={(e) => onMarcar(e.target.checked)} aria-label={t('Selecionar {org} para a proposta', { org: entry.org_name })} />}
          {entry.org_name}{cidadeUf(entry) && <span className="font-normal text-gray-500">· {cidadeUf(entry)}</span>}
        </span>
        <span className="flex items-center gap-2">
          {daEntrada.length > 0 && <span className="text-xs text-gray-500">{tn(daEntrada.length, '{n} nota', '{n} notas')}</span>}
          <V2Badge tone={TOM_CANDIDATURA[entry.stage] || 'neutral'}>{t(HOST_ENTRY_STAGE_LABELS[entry.stage] || entry.stage)}</V2Badge>
        </span>
      </div>
      <button type="button" className="text-xs font-semibold text-gray-600 underline" aria-expanded={ver} onClick={() => setVer((v) => !v)}>{ver ? t('Esconder a carta e a proposta') : t('Ler a carta e a proposta')}</button>
      {ver && (
        <div className="space-y-2">
          <div><p className="text-xs font-semibold text-gray-600">{t('Carta de intenção')}</p><p className="whitespace-pre-line text-xs text-gray-700">{entry.intent?.text}</p></div>
          {entry.proposal && (
            <div>
              <p className="text-xs font-semibold text-gray-600">{t('Proposta')}</p>
              <p className="whitespace-pre-line text-xs text-gray-700">{entry.proposal.text}</p>
              <div className="mt-1 flex flex-wrap gap-1">{(entry.proposal.files || []).map((file, i) => <ProposalFileButton key={file.path} federationId={federation.id} entryId={entry.id} index={i} file={file} />)}</div>
            </div>
          )}
        </div>
      )}
      {bid.status === BS.REVIEW && entry.stage === ES.PROPOSAL && entry.applicant_uid !== meUid && <ScoreForm key={minha?.at_ms || 'nova'} federation={federation} bid={bid} entry={entry} minha={minha} />}
    </li>
  );
}

/* ---------------------------------------------------------------- detalhe -- */

function ResultDialog({ federation, bid, ranking, onClose }) {
  const [winner, setWinner] = useState(ranking[0]?.entry_id || '');
  const [motivo, setMotivo] = useState('');
  const m = useHostingAction(federation.id);
  const precisa = hostResultNeedsReason(ranking, winner);
  return (
    <ConfirmDialog
      open
      onOpenChange={(o) => { if (!o) onClose(); }}
      loading={m.isPending}
      confirmDisabled={!winner || (precisa && motivo.trim().length < 3)}
      title={t('Publicar o resultado?')}
      description={t('A sede escolhida e a nota de cada proposta saem na página da federação. Quem mandou proposta recebe um aviso.')}
      confirmLabel={t('Publicar resultado')}
      cancelLabel={t('Voltar')}
      onConfirm={() => m.mutate({ action: 'bid_result', bidId: bid.id, winnerEntryId: winner, reason: motivo }, ok(t('Resultado publicado.'), onClose))}
    >
      <V2Field label={t('Sede escolhida')} htmlFor="sd-vencedora"><V2Select id="sd-vencedora" value={winner} onChange={(e) => setWinner(e.target.value)} options={ranking.map((r, i) => ({ value: r.entry_id, label: t('{pos}. {org} · nota {n}', { pos: i + 1, org: r.org_name, n: r.total.toFixed(2) }) }))} /></V2Field>
      <V2Field label={precisa ? t('Justificativa (obrigatória: não é a maior nota)') : t('Justificativa (opcional)')} htmlFor="sd-justifica" hint={t('Sai publicada junto com o resultado.')}><V2Textarea id="sd-justifica" rows={3} value={motivo} maxLength={500} onChange={(e) => setMotivo(e.target.value)} /></V2Field>
    </ConfirmDialog>
  );
}

function BidDetail({ federation, bid, onEdit, onClose }) {
  const { user } = useAuth();
  const rascunho = bid.status === BS.DRAFT;
  const qe = useBidEntries(federation.id, bid.id, { enabled: !rascunho });
  const qs = useBidScores(federation.id, bid.id, { enabled: [BS.REVIEW, BS.RESULT].includes(bid.status) });
  const [acao, setAcao] = useState(null);
  const [motivo, setMotivo] = useState('');
  const [marcados, setMarcados] = useState(() => new Set());
  const m = useHostingAction(federation.id);
  const fase = hostBidPhase(bid, isoDate());
  const entries = useMemo(() => [...(qe.data || [])].sort((a, b) => String(a.org_name).localeCompare(String(b.org_name), 'pt-BR')), [qe.data]);
  const notas = qs.data || [];
  const ranking = useMemo(() => hostRanking(bid.criteria, entries, notas), [bid.criteria, entries, notas]);
  const semNota = ranking.filter((r) => !r.count).length;
  const cartas = entries.filter((e) => e.stage === ES.INTENT);
  const executar = () => {
    if (acao === 'publicar') m.mutate({ action: 'bid_publish', bidId: bid.id }, ok((r) => tn(r?.notices || 0, 'Edital publicado. {n} aviso enviado.', 'Edital publicado. {n} avisos enviados.'), () => setAcao(null)));
    if (acao === 'apagar') m.mutate({ action: 'bid_delete', bidId: bid.id }, ok(t('Rascunho apagado.'), () => { setAcao(null); onClose(); }));
    if (acao === 'cancelar') m.mutate({ action: 'bid_cancel', bidId: bid.id, reason: motivo }, ok(t('Edital cancelado.'), () => setAcao(null)));
    if (acao === 'avaliar') m.mutate({ action: 'bid_review', bidId: bid.id }, ok(t('Propostas fechadas. A comissão já pode dar as notas.'), () => setAcao(null)));
    if (acao === 'selecionar') m.mutate({ action: 'bid_shortlist', bidId: bid.id, entryIds: [...marcados] }, ok(t('Seleção registrada. Todos foram avisados.'), () => setAcao(null)));
  };
  const textos = {
    publicar: { title: t('Publicar o edital?'), description: federation.confederation ? t('O edital aparece na página da confederação e as equipes das federações da rede recebem um aviso. As regras não mudam mais.') : t('O edital aparece na página da federação e quem gere os clubes e arenas filiados recebe um aviso. As regras não mudam mais.'), label: t('Publicar') },
    apagar: { title: t('Apagar o rascunho?'), description: t('Ninguém viu o edital: o rascunho some.'), label: t('Apagar') },
    cancelar: { title: t('Cancelar o edital?'), description: t('Quem se candidatou recebe um aviso com o motivo, que também sai na página.'), label: t('Cancelar edital') },
    avaliar: { title: t('Fechar as propostas agora?'), description: t('Ninguém manda mais proposta e a comissão passa a dar as notas. No prazo, isto acontece sozinho.'), label: t('Fechar propostas') },
    selecionar: { title: tn(marcados.size, 'Selecionar {n} candidatura para a proposta?', 'Selecionar {n} candidaturas para a proposta?'), description: t('As escolhidas são avisadas para mandar a proposta até {data}; as demais, de que não seguiram.', { data: br(bid.proposal_until) }), label: t('Confirmar seleção') },
  };
  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-h-[90dvh] max-w-3xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{bid.title}</DialogTitle>
          <DialogDescription>{[bid.event_name, periodo(bid.event_start, bid.event_end), t('cartas até {data}', { data: br(bid.intent_until) }), t('propostas até {data}', { data: br(bid.proposal_until) })].filter(Boolean).join(' · ')}</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <V2Badge tone={TOM_EDITAL_SEDE[bid.status] || 'neutral'}>{t(HOST_BID_STATUS_LABELS[bid.status] || bid.status)}</V2Badge>
            {!rascunho && bid.counts && <span className="text-sm text-gray-600">{tn(bid.counts.intents || 0, '{n} carta', '{n} cartas')} · {tn(bid.counts.proposals || 0, '{n} proposta', '{n} propostas')}</span>}
          </div>
          {bid.cancel_reason && <p className="text-sm text-gray-600">{t('Motivo do cancelamento: {motivo}', { motivo: bid.cancel_reason })}</p>}
          <div className="flex flex-wrap gap-2">
            {rascunho && <V2Button type="button" size="sm" variant="secondary" onClick={onEdit}><Pencil className="h-4 w-4" />{t('Editar')}</V2Button>}
            {rascunho && <V2Button type="button" size="sm" onClick={() => setAcao('publicar')}><Send className="h-4 w-4" />{t('Publicar')}</V2Button>}
            {rascunho && <V2Button type="button" size="sm" variant="ghost" onClick={() => setAcao('apagar')}><Trash2 className="h-4 w-4" />{t('Apagar rascunho')}</V2Button>}
            {[BS.INTENT, BS.PROPOSAL].includes(bid.status) && <V2Button type="button" size="sm" variant="secondary" onClick={() => setAcao('estender')}><CalendarClock className="h-4 w-4" />{t('Estender prazos')}</V2Button>}
            {bid.status === BS.INTENT && <V2Button type="button" size="sm" disabled={!marcados.size} onClick={() => setAcao('selecionar')}><Check className="h-4 w-4" />{t('Seguir com {n} para a proposta', { n: marcados.size })}</V2Button>}
            {bid.status === BS.PROPOSAL && <V2Button type="button" size="sm" onClick={() => setAcao('avaliar')}>{t('Fechar propostas')}</V2Button>}
            {bid.status === BS.REVIEW && <V2Button type="button" size="sm" disabled={!qe.isSuccess || !qs.isSuccess || !ranking.length || semNota > 0} onClick={() => setAcao('resultado')}><MapPin className="h-4 w-4" />{t('Publicar resultado')}</V2Button>}
            {[BS.INTENT, BS.PROPOSAL, BS.REVIEW].includes(bid.status) && <V2Button type="button" size="sm" variant="ghost" onClick={() => { setMotivo(''); setAcao('cancelar'); }}>{t('Cancelar edital')}</V2Button>}
          </div>
          {bid.status === BS.INTENT && <p className="text-sm text-gray-600">{fase.intentClosed ? t('O prazo das cartas passou. Marque quem segue para a proposta.') : t('Recebendo cartas. Marque quem segue para a proposta quando quiser; o prazo das propostas é {data}.', { data: br(bid.proposal_until) })}</p>}
          {bid.status === BS.PROPOSAL && <p className="text-sm text-gray-600">{t('As propostas fecham sozinhas no prazo e o edital passa para avaliação.')}</p>}
          {bid.status === BS.REVIEW && semNota > 0 && <p className="text-sm text-amber-800">{tn(semNota, 'Falta nota em {n} proposta para publicar o resultado.', 'Falta nota em {n} propostas para publicar o resultado.')}</p>}
          {bid.status === BS.REVIEW && ranking.length > 0 && (
            <section className="space-y-1">
              <p className="text-sm font-semibold text-ink">{t('Classificação parcial')}</p>
              <ol className="space-y-0.5 text-sm text-gray-700">
                {ranking.map((r, i) => <li key={r.entry_id} className="flex justify-between gap-2"><span>{i + 1}. {r.org_name}</span><span className="text-xs">{r.count ? t('nota {n} · {q} avaliador(es)', { n: r.total.toFixed(2), q: r.count }) : t('sem nota')}</span></li>)}
              </ol>
            </section>
          )}
          {bid.result && <p className="text-sm text-gray-700">{t('Sede escolhida: {org}', { org: [bid.result.winner_name, bid.result.winner_city].filter(Boolean).join(' · ') })}{bid.result.note ? ` — ${bid.result.note}` : ''}</p>}
          {!rascunho && (
            <section className="space-y-2">
              <p className="text-sm font-semibold text-ink">{t('Candidaturas')}</p>
              {qe.isError && <V2ErrorState inline title={t('Não carregaram as candidaturas')} onRetry={() => qe.refetch()} />}
              {qs.isError && <V2ErrorState inline title={t('Não carregaram as notas')} onRetry={() => qs.refetch()} />}
              {qe.isLoading && <V2Skeleton lines={3} />}
              {qe.isSuccess && !entries.length && <p className="text-sm text-gray-500">{t('Nenhuma candidatura ainda.')}</p>}
              {bid.status === BS.INTENT && cartas.length > 0 && <p className="text-xs text-gray-500">{t('Marque as candidaturas que seguem para a fase da proposta.')}</p>}
              {entries.length > 0 && (
                <ul className="divide-y divide-gray-100 rounded-2xl border border-gray-100 px-3">
                  {entries.map((e) => (
                    <Candidatura
                      key={e.id}
                      federation={federation}
                      bid={bid}
                      entry={e}
                      notas={notas}
                      meUid={user?.uid}
                      marcado={marcados.has(e.id)}
                      onMarcar={(v) => setMarcados((s) => { const n = new Set(s); if (v) n.add(e.id); else n.delete(e.id); return n; })}
                    />
                  ))}
                </ul>
              )}
            </section>
          )}
        </div>
        {acao === 'estender' && <ExtendDialog federation={federation} bid={bid} onClose={() => setAcao(null)} />}
        {acao === 'resultado' && <ResultDialog federation={federation} bid={bid} ranking={ranking} onClose={() => setAcao(null)} />}
        {textos[acao] && (
          <ConfirmDialog
            open
            destructive={acao === 'cancelar' || acao === 'apagar'}
            onOpenChange={(o) => { if (!o) setAcao(null); }}
            loading={m.isPending}
            confirmDisabled={acao === 'cancelar' && motivo.trim().length < 3}
            title={textos[acao].title}
            description={textos[acao].description}
            confirmLabel={textos[acao].label}
            cancelLabel={t('Voltar')}
            onConfirm={executar}
          >
            {acao === 'cancelar' && <V2Field label={t('Motivo')} htmlFor="sd-motivo" hint={t('Sai na página e no aviso. Mínimo 3 caracteres.')}><V2Input id="sd-motivo" value={motivo} maxLength={300} onChange={(e) => setMotivo(e.target.value)} /></V2Field>}
          </ConfirmDialog>
        )}
      </DialogContent>
    </Dialog>
  );
}

/* ------------------------------------------------------------------ lista -- */

export default function HostBidsManager({ federation }) {
  const q = useHostBids(federation.id, { equipe: true });
  const [editando, setEditando] = useState(null);
  const [abertoId, setAbertoId] = useState(null);
  const lista = q.data || [];
  const aberto = lista.find((b) => b.id === abertoId) || null;
  if (q.isError) return <V2ErrorState title={t('Não carregaram os editais de sede')} onRetry={() => q.refetch()} />;
  if (q.isLoading) return <V2Skeleton lines={5} />;
  return (
    <div className="space-y-3" data-dica="federacao-aba-sedes">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-gray-600">{t('Escolha a sede dos campeonatos com regra pública: carta de intenção, proposta, nota da comissão e resultado publicado.')}</p>
        <V2Button type="button" size="sm" onClick={() => setEditando({})} data-dica="federacao-novo-edital-sede"><Plus className="h-4 w-4" />{t('Novo edital de sede')}</V2Button>
      </div>
      {!lista.length && <V2EmptyState icon={MapPin} title={t('Nenhum edital de sede ainda')} description={t('Crie o primeiro para receber candidaturas de clubes e arenas.')} />}
      <ul className="space-y-2">
        {lista.map((b) => (
          <li key={b.id}>
            <button type="button" onClick={() => setAbertoId(b.id)} className="w-full rounded-2xl border border-gray-100 bg-white p-3 text-left hover:border-gray-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink">
              <span className="flex flex-wrap items-center gap-2 font-semibold text-ink">{b.title}<V2Badge tone={TOM_EDITAL_SEDE[b.status] || 'neutral'}>{t(HOST_BID_STATUS_LABELS[b.status] || b.status)}</V2Badge></span>
              <span className="mt-0.5 block text-xs text-gray-500">{[b.event_name, periodo(b.event_start, b.event_end), b.counts ? tn(b.counts.intents || 0, '{n} candidatura', '{n} candidaturas') : ''].filter(Boolean).join(' · ')}</span>
            </button>
          </li>
        ))}
      </ul>
      {editando && <BidEditor federation={federation} bid={editando.id ? editando : null} onClose={() => setEditando(null)} />}
      {aberto && !editando && <BidDetail federation={federation} bid={aberto} onEdit={() => setEditando(aberto)} onClose={() => setAbertoId(null)} />}
    </div>
  );
}
