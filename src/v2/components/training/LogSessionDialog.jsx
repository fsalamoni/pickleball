/**
 * Registrar (ou editar) um treino no diário — em poucos toques: o dia já vem
 * como hoje, o tipo e o "fiz tudo" já vêm marcados; a pessoa diz os minutos
 * e o esforço (escala CR-10) e salva.
 *
 * Quem valida é `normalizeSession` (o serviço refaz antes de gravar). Nada de
 * saúde: o aviso `SESSION_HEALTH_HINT` fica junto da nota.
 */
import React, { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { X } from 'lucide-react';
import { useSessionActions } from '@/modules/training/hooks/useTrainingSessions';
import { usePeople } from '@/modules/progression/hooks/usePeople';
import {
  SESSION_HEALTH_HINT, SESSION_KINDS, SESSION_KIND_LABELS, SESSION_NOTES_MAX, SESSION_STATUS, SESSION_STATUS_LABELS,
  normalizeSession,
} from '@/modules/training/domain/session';
import { rpeLabel } from '@/modules/training/domain/taxonomy';
import { todayLocal } from '@/modules/training/domain/dates';
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import {
  V2Button, V2Field, V2FilterChip, V2Input, V2Select, V2Textarea,
} from '@/v2/ui/primitives';
import { mensagemDeErro } from '@/v2/components/training/item/ItemActionDialogs';

const MINUTOS_RAPIDOS = [15, 30, 45, 60, 90];

function estadoInicial({ session, initial, itemsById }) {
  const base = session || initial || {};
  const ids = base.item_ids || [];
  const titulo = base.title || (ids.length === 1 ? itemsById?.[ids[0]]?.title : '') || '';
  return {
    date: base.date || todayLocal(),
    kind: base.kind || 'quadra',
    status: base.status || SESSION_STATUS.FEITO,
    duration_min: base.duration_min ? String(base.duration_min) : '',
    rpe: Number.isFinite(base.rpe) ? base.rpe : 5,
    rpeSet: Number.isFinite(base.rpe),
    title: titulo,
    notes: base.notes || '',
    item_ids: ids,
    plan_id: base.plan_id || null,
    shared_coach_id: base.shared_coach_id || '',
  };
}

/**
 * @param {{ open: boolean, onOpenChange: (o: boolean) => void, identity: object,
 *   itemsById?: Record<string, object>, initial?: object, session?: object|null,
 *   onSaved?: (id?: string) => void }} props
 */
export default function LogSessionDialog({ open, onOpenChange, identity, itemsById = {}, initial, session = null, onSaved }) {
  const acoes = useSessionActions(identity);
  const [f, setF] = useState(() => estadoInicial({ session, initial, itemsById }));
  const [erro, setErro] = useState('');
  const set = (patch) => { setErro(''); setF((x) => ({ ...x, ...patch })); };
  const { people } = usePeople(identity.activeCoachIds);

  // Reabrir com outro item/sessão recomeça o formulário.
  useEffect(() => {
    if (open) { setF(estadoInicial({ session, initial, itemsById })); setErro(''); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, session?.id, (initial?.item_ids || []).join(',')]);

  const opcoesItens = useMemo(
    () => Object.values(itemsById).filter((it) => !f.item_ids.includes(it.id))
      .sort((a, b) => String(a.title).localeCompare(String(b.title), 'pt-BR')),
    [itemsById, f.item_ids],
  );
  const salvando = acoes.create.isPending || acoes.update.isPending;

  const salvar = (e) => {
    e.preventDefault();
    const input = {
      date: f.date,
      kind: f.kind,
      status: f.status,
      duration_min: f.duration_min,
      rpe: f.rpeSet ? f.rpe : null,
      title: f.title,
      notes: f.notes,
      item_ids: f.item_ids,
      plan_id: f.plan_id,
      shared_coach_id: f.shared_coach_id || null,
    };
    const { valid, error, value } = normalizeSession(input);
    if (!valid) { setErro(error); return; }
    const fim = {
      onSuccess: (id) => {
        toast.success(session ? 'Registro atualizado.' : 'Treino registrado no diário.');
        onOpenChange(false);
        onSaved?.(id);
      },
      onError: (err) => setErro(mensagemDeErro(err, 'Não foi possível salvar agora. Tente de novo.')),
    };
    if (session) acoes.update.mutate({ session, input: value }, fim);
    else acoes.create.mutate(value, fim);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{session ? 'Editar registro' : 'Registrar treino'}</DialogTitle>
          <DialogDescription>Leva menos de um minuto. Só os minutos são obrigatórios.</DialogDescription>
        </DialogHeader>
        <form className="space-y-5" onSubmit={salvar} noValidate>
          <div className="space-y-2" role="group" aria-label="Como foi">
            <p className="text-sm font-semibold text-ink">Como foi</p>
            <div className="flex flex-wrap gap-2">
              {Object.values(SESSION_STATUS).map((s) => (
                <V2FilterChip key={s} active={f.status === s} aria-pressed={f.status === s} onClick={() => set({ status: s })} className="px-3 py-1.5">
                  {SESSION_STATUS_LABELS[s]}
                </V2FilterChip>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <V2Field label="Minutos" htmlFor="sessao-min" required>
              <V2Input
                id="sessao-min"
                type="number"
                inputMode="numeric"
                min={1}
                max={600}
                value={f.duration_min}
                onChange={(e) => set({ duration_min: e.target.value })}
                placeholder="Ex.: 45"
              />
            </V2Field>
            <div className="flex flex-wrap gap-1.5">
              {MINUTOS_RAPIDOS.map((m) => (
                <V2FilterChip key={m} active={Number(f.duration_min) === m} onClick={() => set({ duration_min: String(m) })} className="px-3 py-1 text-xs">
                  {m} min
                </V2FilterChip>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <label htmlFor="sessao-rpe" className="block text-sm font-semibold text-ink">
              Esforço: {f.rpeSet ? `${f.rpe} · ${rpeLabel(f.rpe)}` : 'arraste para marcar'}
            </label>
            <input
              id="sessao-rpe"
              type="range"
              min={0}
              max={10}
              step={1}
              value={f.rpe}
              onChange={(e) => set({ rpe: Number(e.target.value), rpeSet: true })}
              aria-valuetext={f.rpeSet ? `${f.rpe}, ${rpeLabel(f.rpe)}` : 'Não marcado'}
              className="w-full accent-ink"
            />
            <div className="flex justify-between text-xs text-gray-400" aria-hidden="true">
              <span>0 · Repouso</span><span>5 · Puxado</span><span>10 · Máximo</span>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <V2Field label="Dia" htmlFor="sessao-dia">
              <V2Input id="sessao-dia" type="date" max={todayLocal()} value={f.date} onChange={(e) => set({ date: e.target.value })} />
            </V2Field>
            <V2Field label="Tipo" htmlFor="sessao-tipo">
              <V2Select id="sessao-tipo" value={f.kind} onChange={(e) => set({ kind: e.target.value })}>
                {SESSION_KINDS.map((k) => <option key={k} value={k}>{SESSION_KIND_LABELS[k]}</option>)}
              </V2Select>
            </V2Field>
          </div>

          <V2Field label="Nome (opcional)" htmlFor="sessao-titulo">
            <V2Input id="sessao-titulo" maxLength={120} value={f.title} onChange={(e) => set({ title: e.target.value })} placeholder="Treino" />
          </V2Field>

          <div className="space-y-2">
            <p className="text-sm font-semibold text-ink">O que você treinou</p>
            {f.item_ids.length > 0 && (
              <ul className="flex flex-wrap gap-2">
                {f.item_ids.map((id) => (
                  <li key={id} className="inline-flex items-center gap-1 rounded-full bg-gray-100 py-1 pl-3 pr-1 text-sm text-ink">
                    {itemsById[id]?.title || 'Item'}
                    <button
                      type="button"
                      aria-label={`Tirar "${itemsById[id]?.title || 'item'}" do registro`}
                      onClick={() => set({ item_ids: f.item_ids.filter((x) => x !== id) })}
                      className="rounded-full p-1 text-gray-500 hover:text-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-ink"
                    >
                      <X className="h-3.5 w-3.5" aria-hidden="true" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
            {f.item_ids.length < 12 && opcoesItens.length > 0 && (
              <V2Select
                aria-label="Acrescentar um item da biblioteca"
                value=""
                onChange={(e) => { if (e.target.value) set({ item_ids: [...f.item_ids, e.target.value] }); }}
              >
                <option value="">Acrescentar um item (opcional)</option>
                {opcoesItens.map((it) => <option key={it.id} value={it.id}>{it.title}</option>)}
              </V2Select>
            )}
          </div>

          <V2Field label="Notas (opcional)" htmlFor="sessao-notas" hint={SESSION_HEALTH_HINT}>
            <V2Textarea id="sessao-notas" rows={3} maxLength={SESSION_NOTES_MAX} value={f.notes} onChange={(e) => set({ notes: e.target.value })} />
          </V2Field>

          {identity.activeCoachIds.length > 0 && (
            <V2Field label="Mostrar ao professor" htmlFor="sessao-prof" hint="O professor vê este registro e pode comentar.">
              <V2Select id="sessao-prof" value={f.shared_coach_id} onChange={(e) => set({ shared_coach_id: e.target.value })}>
                <option value="">Só eu</option>
                {identity.activeCoachIds.map((id) => <option key={id} value={id}>{people.get(id)?.name || 'Professor'}</option>)}
              </V2Select>
            </V2Field>
          )}

          {erro && <p role="alert" className="text-sm font-medium text-red-600">{erro}</p>}
          <div className="flex justify-end gap-2">
            <V2Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>Cancelar</V2Button>
            <V2Button type="submit" disabled={salvando}>{salvando ? 'Salvando…' : 'Salvar'}</V2Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
