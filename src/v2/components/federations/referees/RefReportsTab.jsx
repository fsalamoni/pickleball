/**
 * Arbitragem → AVALIAÇÕES E SÚMULAS (Central): o que cada árbitro enviou
 * depois do evento e a avaliação da equipe (notas de 1 a 5 em cinco
 * critérios + comentário). Só quem atuou é avaliado; o aviso ao árbitro não
 * traz a nota — ele a vê na Minha área.
 */
import React, { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { ClipboardList, FileText, Star } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { refereesAction } from '@/modules/federations/services/refereesService';
import { useFederationMutation } from '@/modules/federations/hooks/useFederations';
import { EVAL_CRITERIA, EVAL_CRITERIA_LABELS, REFEREE_LIMITS, isoDateBR, validateEvaluation } from '@/modules/federations/domain/referees';
import { useFiltroNaUrl } from '../manage/listTools';
import { haAlteracaoNaoSalva, useAvisoNaoSalvo } from '../manage/naoSalvo';
import { V2Badge, V2Button, V2EmptyState, V2ErrorState, V2Field, V2FilterChip, V2Select, V2Skeleton, V2Surface, V2Textarea } from '@/v2/ui/primitives';
import { t, tk } from '@/core/i18n';
import { AssignmentBadge, funcao, periodo } from './refUi';

const FILTROS = [
  { id: 'sem-avaliacao', label: tk('Sem avaliação') },
  { id: 'com-sumula', label: tk('Com súmula') },
  { id: 'todas', label: tk('Todas') },
];

function AvaliacaoForm({ federation, a, onFechar }) {
  const [scores, setScores] = useState(() => ({ ...(a.evaluation?.scores || {}) }));
  const [comment, setComment] = useState(a.evaluation?.comment || '');
  useAvisoNaoSalvo(JSON.stringify(scores) !== JSON.stringify(a.evaluation?.scores || {}) || comment !== (a.evaluation?.comment || ''));
  const r = validateEvaluation({ scores, comment });
  const m = useFederationMutation(() => refereesAction({ federationId: federation.id, action: 'evaluate', assignmentId: a.id, scores: r.value.scores, comment: r.value.comment }));
  const enviar = (e) => {
    e.preventDefault();
    if (!r.ok) { toast.error(t('Dê uma nota de 1 a 5 em cada critério.')); return; }
    m.mutate(undefined, { onSuccess: () => { toast.success(t('Avaliação registrada.')); onFechar(); }, onError: (er) => toast.error(er.message) });
  };
  return (
    <form onSubmit={enviar} noValidate className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        {EVAL_CRITERIA.map((c) => (
          <V2Field key={c} label={t(EVAL_CRITERIA_LABELS[c])} htmlFor={`ref-nota-${c}`} required>
            <V2Select id={`ref-nota-${c}`} value={scores[c] || ''} onChange={(e) => setScores((s) => ({ ...s, [c]: Number(e.target.value) || undefined }))}>
              <option value="">{t('Nota')}</option>
              {[5, 4, 3, 2, 1].map((n) => <option key={n} value={n}>{n}</option>)}
            </V2Select>
          </V2Field>
        ))}
      </div>
      <V2Field label={t('Comentário (o árbitro vê)')} htmlFor="ref-comentario"><V2Textarea id="ref-comentario" rows={3} maxLength={REFEREE_LIMITS.COMMENT_MAX} value={comment} onChange={(e) => setComment(e.target.value)} /></V2Field>
      {r.ok && <p className="text-sm text-gray-500">{t('Média: {m}', { m: r.value.avg })}</p>}
      <div className="flex justify-end gap-2">
        <V2Button type="button" variant="ghost" onClick={onFechar}>{t('Voltar')}</V2Button>
        <V2Button type="submit" disabled={m.isPending}><Star className="h-4 w-4" />{t('Registrar a avaliação')}</V2Button>
      </div>
    </form>
  );
}

export default function RefReportsTab({ federation, assignmentsQ }) {
  const hoje = isoDateBR();
  const [filtro, setFiltro] = useFiltroNaUrl('filtro', 'sem-avaliacao', FILTROS.map((f) => f.id));
  const [aberto, setAberto] = useState(null);
  const lista = useMemo(() => {
    if (!assignmentsQ.data) return null;
    const relevantes = assignmentsQ.data.filter((a) => a.status === 'done' || a.status === 'no_show' || (a.report && a.event?.date <= hoje));
    const f = relevantes.filter((a) => (filtro === 'sem-avaliacao' ? a.status === 'done' && !a.evaluation : filtro === 'com-sumula' ? Boolean(a.report) : true));
    return f.sort((a, b) => String(b.event?.date || '').localeCompare(String(a.event?.date || '')) || String(a.referee_name).localeCompare(String(b.referee_name), 'pt-BR'));
  }, [assignmentsQ.data, filtro, hoje]);
  return (
    <section className="space-y-4" aria-label={t('Avaliações e súmulas')} data-dica="federacao-arbitragem-avaliacoes">
      <div className="flex flex-wrap gap-2" role="group" aria-label={t('Filtrar')}>
        {FILTROS.map((f) => <V2FilterChip key={f.id} active={filtro === f.id} onClick={() => setFiltro(f.id)}>{t(f.label)}</V2FilterChip>)}
      </div>
      {assignmentsQ.isError && <V2ErrorState inline title={t('Não carregou as escalas')} onRetry={() => assignmentsQ.refetch()} />}
      {assignmentsQ.isLoading && <V2Skeleton lines={4} />}
      {lista && lista.length === 0 && (
        <V2EmptyState icon={ClipboardList} title={filtro === 'sem-avaliacao' ? t('Nenhuma atuação esperando avaliação') : t('Nada neste filtro')} description={t('Depois do evento, feche-o em Escalas: quem atuou aparece aqui para avaliar, com a súmula que enviou.')} />
      )}
      {lista && lista.length > 0 && (
        <ul className="space-y-2">
          {lista.map((a) => (
            <li key={a.id}>
              <V2Surface variant="compacto" className="space-y-2 p-3">
                <div className="flex flex-wrap items-start gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="flex flex-wrap items-center gap-2 font-bold text-ink">{a.referee_name}<AssignmentBadge status={a.status} />{a.evaluation && <V2Badge tone="ink">{t('Média {m}', { m: a.evaluation.avg })}</V2Badge>}</p>
                    <p className="text-xs text-gray-500">{funcao(a.function)} · {a.event?.name} · {periodo(a.event)}</p>
                  </div>
                  {a.status === 'done' && <V2Button type="button" size="sm" variant={a.evaluation ? 'ghost' : 'primary'} onClick={() => setAberto(a)}><Star className="h-4 w-4" />{a.evaluation ? t('Corrigir a avaliação') : t('Avaliar')}</V2Button>}
                </div>
                {a.report?.text
                  ? <details><summary className="flex min-h-11 cursor-pointer items-center gap-2 text-sm font-semibold text-ink"><FileText className="h-4 w-4" aria-hidden="true" />{t('Súmula enviada')}</summary><p className="whitespace-pre-wrap text-sm text-ink">{a.report.text}</p></details>
                  : a.status === 'done' && <p className="text-xs text-gray-500">{t('Sem súmula enviada.')}</p>}
              </V2Surface>
            </li>
          ))}
        </ul>
      )}
      <Dialog open={aberto != null} onOpenChange={(o) => { if (!o) setAberto(null); }}>
        <DialogContent className="max-h-[90dvh] max-w-xl overflow-y-auto" onInteractOutside={(e) => { if (haAlteracaoNaoSalva()) e.preventDefault(); }}>
          <DialogTitle>{t('Avaliação da atuação')}</DialogTitle>
          <DialogDescription>{aberto ? `${aberto.referee_name} · ${aberto.event?.name}` : ''}</DialogDescription>
          {aberto && <AvaliacaoForm federation={federation} a={aberto} onFechar={() => setAberto(null)} />}
        </DialogContent>
      </Dialog>
    </section>
  );
}
