import React, { useState } from 'react';
import { Pencil, Plus, Trash2, XCircle } from 'lucide-react';
import { toast } from 'sonner';
import ConfirmDialog from '@/components/ConfirmDialog';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { V2Badge, V2Button, V2EmptyState, V2ErrorState, V2Field, V2Input, V2Select, V2Skeleton, V2Surface, V2Textarea, V2Toggle } from '@/v2/ui/primitives';
import { useIssuerChallenges, useChallengeEntries } from '@/modules/progression/hooks/useChallenges';
import {
  CHALLENGE_MAX_PRIZES, CHALLENGE_METRICS, CHALLENGE_PRIZE_XP_MAX, CHALLENGE_STATUS_LABEL, challengeTimeLabel, challengeTimeState, rankEntries, validateChallenge,
} from '@/modules/progression/domain/challenges';
import { challengeToForm, emptyChallengeForm, formToChallengeInput } from '@/modules/progression/domain/issuerForms';
import { BR_UFS } from '@/core/domain/ufs';
import { usePeople } from '@/modules/progression/hooks/usePeople';
import TermHint from '@/v2/components/gamification/TermHint';

const TONE = { active: 'green', draft: 'neutral', finished: 'blue', cancelled: 'red' };

function ChallengeForm({ issuer, initial, onCancel, onSave, saving }) {
  const [f, setF] = useState(initial);
  const [erro, setErro] = useState('');
  const set = (patch) => setF((x) => ({ ...x, ...patch }));
  const metricas = Object.entries(CHALLENGE_METRICS).filter(([, m]) => m.issuers.includes(issuer.type));
  const xpOk = issuer.type === 'platform';

  const salvar = () => {
    const input = formToChallengeInput(f);
    const v = validateChallenge(input, { ...issuer, uid: 'x' });
    if (!v.ok) { setErro(Object.values(v.errors)[0]); return; }
    setErro('');
    onSave(input);
  };

  return (
    <Dialog open onOpenChange={(v) => { if (!v) onCancel(); }}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>{initial.title ? 'Editar desafio' : 'Novo desafio'}</DialogTitle>
          <DialogDescription>O placar é calculado pelo servidor a partir dos jogos reais — você define o que medir e por quanto tempo.</DialogDescription>
        </DialogHeader>
        <div className="max-h-[60dvh] space-y-4 overflow-y-auto pr-1">
          <div className="grid grid-cols-[4.5rem_1fr] gap-3">
            <V2Field label="Ícone" htmlFor="ch-emoji"><V2Input id="ch-emoji" value={f.emoji} maxLength={4} onChange={(e) => set({ emoji: e.target.value })} /></V2Field>
            <V2Field label="Nome do desafio" htmlFor="ch-title" required><V2Input id="ch-title" value={f.title} maxLength={80} placeholder="Ex.: Semana das Duplas" onChange={(e) => set({ title: e.target.value })} /></V2Field>
          </div>
          <V2Field label="O que será medido" htmlFor="ch-metric" hint={CHALLENGE_METRICS[f.metric]?.description}>
            <V2Select id="ch-metric" value={f.metric} onChange={(e) => set({ metric: e.target.value })}>
              {metricas.map(([id, m]) => <option key={id} value={id}>{m.label}</option>)}
            </V2Select>
          </V2Field>
          {xpOk && (
            <V2Field label="Quem compete" htmlFor="ch-subject">
              <V2Select id="ch-subject" value={f.subject} onChange={(e) => set({ subject: e.target.value })}>
                <option value="athlete">Atletas</option>
                <option value="club">Clubes (um contra o outro)</option>
              </V2Select>
            </V2Field>
          )}
          <div className="grid grid-cols-2 gap-3">
            <V2Field label="Começa em" htmlFor="ch-ini"><V2Input id="ch-ini" type="date" value={f.startDate} onChange={(e) => set({ startDate: e.target.value })} /></V2Field>
            <V2Field label="Termina em (o dia vale)" htmlFor="ch-fim"><V2Input id="ch-fim" type="date" value={f.endDate} onChange={(e) => set({ endDate: e.target.value })} /></V2Field>
          </div>
          <V2Field label="Descrição curta" htmlFor="ch-desc"><V2Textarea id="ch-desc" rows={2} maxLength={400} value={f.description} onChange={(e) => set({ description: e.target.value })} /></V2Field>
          <V2Field label="Regras (opcional)" htmlFor="ch-rules"><V2Textarea id="ch-rules" rows={2} maxLength={600} value={f.rules} onChange={(e) => set({ rules: e.target.value })} /></V2Field>
          {xpOk && (
            <V2Field label="Só para um estado (opcional)" htmlFor="ch-uf">
              <V2Select id="ch-uf" value={f.regionState} onChange={(e) => set({ regionState: e.target.value })}>
                <option value="">Brasil todo</option>
                {BR_UFS.map((u) => <option key={u} value={u}>{u}</option>)}
              </V2Select>
            </V2Field>
          )}
          <fieldset className="space-y-2">
            <legend className="text-sm font-semibold text-ink">Prêmios (por posição)</legend>
            {f.prizes.map((p, i) => (
              <div key={i} className="grid grid-cols-[2rem_1fr_6rem] items-center gap-2">
                <span className="text-sm font-bold text-gray-500">{i + 1}º</span>
                <V2Input aria-label={`Prêmio do ${i + 1}º lugar`} placeholder="Ex.: Troféu, 1 hora grátis…" maxLength={80} value={p.label}
                  onChange={(e) => set({ prizes: f.prizes.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)) })} />
                {xpOk ? (
                  <V2Input aria-label={`XP do ${i + 1}º lugar`} type="number" min={0} max={CHALLENGE_PRIZE_XP_MAX} placeholder="XP" value={p.xp}
                    onChange={(e) => set({ prizes: f.prizes.map((x, j) => (j === i ? { ...x, xp: e.target.value } : x)) })} />
                ) : <span />}
              </div>
            ))}
            <div className="flex gap-2">
              {f.prizes.length < CHALLENGE_MAX_PRIZES && <V2Button type="button" variant="ghost" size="sm" onClick={() => set({ prizes: [...f.prizes, { label: '', xp: '' }] })}><Plus className="mr-1 h-4 w-4" /> Prêmio</V2Button>}
              {f.prizes.length > 1 && <V2Button type="button" variant="ghost" size="sm" onClick={() => set({ prizes: f.prizes.slice(0, -1) })}>Remover último</V2Button>}
            </div>
            {!xpOk && <p className="text-xs text-gray-500">O prêmio é seu (um brinde, uma hora, um desconto). Só a plataforma concede XP.</p>}
          </fieldset>
          <V2Toggle id="ch-publish" checked={f.publish} onChange={(v) => set({ publish: v })} label="Publicar agora" hint="Desligado, fica como rascunho — só você vê." />
        </div>
        {erro && <p role="alert" className="text-sm text-red-600">{erro}</p>}
        <DialogFooter>
          <V2Button variant="ghost" onClick={onCancel}>Cancelar</V2Button>
          <V2Button disabled={saving} onClick={salvar}>{saving ? 'Salvando…' : 'Salvar'}</V2Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Standings({ challenge }) {
  const q = useChallengeEntries(challenge.id);
  const ranked = rankEntries(q.entries).slice(0, 5);
  const { people } = usePeople(ranked.filter((e) => e.subjectType !== 'club').map((e) => e.subjectId));
  if (q.isLoading) return <V2Skeleton lines={2} />;
  if (q.isError) return <V2ErrorState inline title="Não deu para carregar os inscritos" onRetry={q.refetch} />;
  return (
    <div className="text-xs text-gray-600">
      <p><strong className="text-ink">{q.entries.length}</strong> {q.entries.length === 1 ? 'participante' : 'participantes'}</p>
      {ranked.length > 0 && (
        <ol className="mt-1 space-y-0.5">
          {ranked.map((e) => <li key={e.id}>{e.position}º {e.subjectType === 'club' ? 'Clube' : (people.get(e.subjectId)?.name || 'Atleta')} — {e.value || 0}</li>)}
        </ol>
      )}
    </div>
  );
}

/**
 * Criar, editar, cancelar e acompanhar os desafios de UM emissor.
 * @param {{ issuer: { type: string, id: string, name?: string }, actor: object }} props
 */
export default function IssuerChallengesManager({ issuer, actor }) {
  const c = useIssuerChallenges(issuer, actor);
  const [editando, setEditando] = useState(null); // { id?, atual?, form }
  const [aberto, setAberto] = useState(null);

  const salvar = async (input) => {
    try {
      if (editando.id) await c.update.mutateAsync({ id: editando.id, atual: editando.atual, patch: input });
      else await c.create.mutateAsync(input);
      toast.success('Desafio salvo.');
      setEditando(null);
    } catch (e) {
      toast.error(e?.message || 'Não foi possível salvar agora.');
    }
  };

  if (c.isLoading) return <V2Skeleton className="h-48 rounded-4xl" />;
  if (c.isError) return <V2Surface><V2ErrorState title="Não deu para carregar os desafios" onRetry={c.refetch} /></V2Surface>;

  return (
    <V2Surface data-testid="issuer-challenges" data-dica="oferta-desafios" className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <div>
          <h2 className="flex items-center gap-1 font-display text-lg font-bold text-ink">Desafios <TermHint term="oferecer-desafios" /></h2>
          <p className="text-sm text-gray-500">Competições com começo, fim e placar — o servidor mede e a pessoa só joga.</p>
        </div>
        <V2Button size="sm" onClick={() => setEditando({ form: emptyChallengeForm() })}><Plus className="mr-1 h-4 w-4" /> Novo desafio</V2Button>
      </div>

      {c.challenges.length === 0 ? (
        <V2EmptyState title="Nenhum desafio ainda" description="Crie o primeiro: por exemplo “Quem mais joga esta semana”, com um brinde para o 1º lugar." />
      ) : (
        <ul className="space-y-3">
          {c.challenges.map((d) => {
            const estado = challengeTimeState(d);
            const editavel = ['draft', 'active'].includes(d.status) && estado !== 'ended';
            return (
              <li key={d.id} className="rounded-2xl border border-gray-100 p-4">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-display text-base font-bold text-ink">{d.emoji} {d.title}</p>
                    <p className="text-xs text-gray-500">{CHALLENGE_METRICS[d.metric]?.label} · {challengeTimeLabel(d)}</p>
                  </div>
                  <V2Badge tone={TONE[d.status]}>{CHALLENGE_STATUS_LABEL[d.status]}</V2Badge>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <V2Button size="sm" variant="secondary" onClick={() => setAberto(aberto === d.id ? null : d.id)}>{aberto === d.id ? 'Esconder placar' : 'Ver placar'}</V2Button>
                  {editavel && <V2Button size="sm" variant="ghost" onClick={() => setEditando({ id: d.id, atual: d, form: challengeToForm(d) })}><Pencil className="mr-1 h-3.5 w-3.5" /> Editar</V2Button>}
                  {d.status === 'active' && (
                    <ConfirmDialog
                      trigger={<V2Button size="sm" variant="ghost"><XCircle className="mr-1 h-3.5 w-3.5" /> Cancelar</V2Button>}
                      title="Cancelar este desafio?" description="Ele deixa de valer para todos. Quem está dentro não recebe prêmio por ele."
                      confirmLabel="Cancelar o desafio" onConfirm={() => c.cancel.mutate(d.id, { onSuccess: () => toast('Desafio cancelado.') })}
                    />
                  )}
                  {['draft', 'cancelled'].includes(d.status) && (
                    <ConfirmDialog
                      trigger={<V2Button size="sm" variant="ghost"><Trash2 className="mr-1 h-3.5 w-3.5" /> Apagar</V2Button>}
                      title="Apagar este desafio?" description="Isso não pode ser desfeito." confirmLabel="Apagar"
                      onConfirm={() => c.remove.mutate(d.id)}
                    />
                  )}
                </div>
                {aberto === d.id && <div className="mt-3 border-t border-gray-100 pt-3"><Standings challenge={d} /></div>}
              </li>
            );
          })}
        </ul>
      )}
      {editando && (
        <ChallengeForm issuer={issuer} initial={editando.form} onCancel={() => setEditando(null)} onSave={salvar} saving={c.create.isPending || c.update.isPending} />
      )}
    </V2Surface>
  );
}
