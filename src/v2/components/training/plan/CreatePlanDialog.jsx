/**
 * Criar um plano de treino em uma tela: objetivo, semanas, dias, tempo, foco
 * e local. Com "montar com a biblioteca", o assistente (`buildPlanSlots`)
 * distribui os itens — e a pessoa VÊ a prévia antes de salvar. Sem itens que
 * combinem, os dias ficam vazios para completar (nada é inventado).
 *
 * O novo plano nasce ativo; o serviço pausa o que estava ativo.
 */
import React, { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';
import { usePlanActions } from '@/modules/training/hooks/useTrainingPlans';
import { useMyUnifiedLevel } from '@/modules/rating/hooks/useMyUnifiedLevel';
import { PLAN_LIMITS, buildPlanSlots, normalizePlan } from '@/modules/training/domain/plan';
import { WEEK_ORDER } from '@/modules/training/domain/treinar';
import { WEEKDAY_LONG, WEEKDAY_SHORT, todayLocal } from '@/modules/training/domain/dates';
import {
  PLACES, PLACE_LABELS, SKILL_AREAS, SKILL_AREA_LABELS,
} from '@/modules/training/domain/taxonomy';
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import {
  V2Button, V2Field, V2FilterChip, V2Input, V2Select, V2Textarea, V2Toggle,
} from '@/v2/ui/primitives';
import { mensagemDeErro } from '@/v2/components/training/item/ItemActionDialogs';

const toggle = (list, v) => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);

/**
 * @param {{ open: boolean, onOpenChange: (o: boolean) => void, identity: object, plans: object[],
 *   visiveis: ReturnType<import('@/modules/training/hooks/useTrainingItems').useVisibleTrainingItems>,
 *   routine?: object|null, firstItemId?: string|null }} props
 */
export default function CreatePlanDialog({ open, onOpenChange, identity, plans, visiveis, routine = null, firstItemId = null }) {
  const acoes = usePlanActions(identity, plans);
  const navigate = useNavigate();
  const { level } = useMyUnifiedLevel();
  const [f, setF] = useState(() => ({
    title: '',
    goal: '',
    weeks: 4,
    days: routine?.days?.length ? routine.days : [2, 4],
    minutes: routine?.minutes || 60,
    focus: routine?.focus || [],
    place: routine?.place || '',
    auto: true,
  }));
  const [previa, setPrevia] = useState(false);
  const [erro, setErro] = useState('');
  const set = (patch) => { setErro(''); setPrevia(false); setF((x) => ({ ...x, ...patch })); };

  const slots = useMemo(() => {
    if (!f.auto) return [];
    const base = buildPlanSlots({
      weeks: f.weeks, days: f.days, minutes: f.minutes, focus: f.focus, level, place: f.place,
      items: visiveis.items, seed: `${identity.uid}:${todayLocal()}`,
    });
    // O item que trouxe a pessoa até aqui entra no primeiro dia.
    if (firstItemId && base[0] && !base[0].item_ids.includes(firstItemId)) {
      base[0] = { ...base[0], item_ids: [firstItemId, ...base[0].item_ids].slice(0, PLAN_LIMITS.itemsPerSlot) };
    }
    return base;
  }, [f, level, visiveis.items, identity.uid, firstItemId]);

  const input = {
    title: f.title, goal: f.goal, weeks: f.weeks, days: f.days, minutes: f.minutes, focus: f.focus,
    slots: f.auto ? slots : (firstItemId && f.days.length
      ? [{ week: 1, day: [...f.days].sort()[0], title: 'Treino', item_ids: [firstItemId], duration_min: f.minutes }]
      : []),
    source: f.auto ? 'assistente' : 'manual',
  };

  const verPrevia = (e) => {
    e.preventDefault();
    const { valid, error } = normalizePlan(input);
    if (!valid) { setErro(error); return; }
    setPrevia(true);
  };

  const criar = () => acoes.create.mutate(input, {
    onSuccess: (id) => {
      toast.success('Plano criado e ativo.');
      onOpenChange(false);
      navigate(`/treino/planos/${id}`);
    },
    onError: (err) => setErro(mensagemDeErro(err, 'Não foi possível criar o plano agora.')),
  });

  const semana1 = slots.filter((s) => s.week === 1);
  const vazios = slots.filter((s) => !s.item_ids.length).length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Novo plano de treino</DialogTitle>
          <DialogDescription>Um plano dá a cada dia de treino o que fazer. Você pode mudar qualquer dia depois.</DialogDescription>
        </DialogHeader>
        {!previa ? (
          <form className="space-y-5" onSubmit={verPrevia} noValidate>
            <V2Field label="Nome do plano" htmlFor="plano-nome" required>
              <V2Input id="plano-nome" maxLength={PLAN_LIMITS.title} value={f.title} onChange={(e) => set({ title: e.target.value })} placeholder="Ex.: Dink consistente em 4 semanas" />
            </V2Field>
            <V2Field label="Objetivo (opcional)" htmlFor="plano-obj">
              <V2Textarea id="plano-obj" rows={2} maxLength={PLAN_LIMITS.goal} value={f.goal} onChange={(e) => set({ goal: e.target.value })} placeholder="O que você quer conseguir no fim?" />
            </V2Field>
            <fieldset className="space-y-2">
              <legend className="text-sm font-semibold text-ink">Dias da semana</legend>
              <div className="flex flex-wrap gap-1.5">
                {WEEK_ORDER.map((d) => (
                  <V2FilterChip key={d} active={f.days.includes(d)} aria-pressed={f.days.includes(d)} aria-label={WEEKDAY_LONG[d]} onClick={() => set({ days: toggle(f.days, d) })} className="min-w-[3rem] justify-center px-3 py-1.5">
                    {WEEKDAY_SHORT[d]}
                  </V2FilterChip>
                ))}
              </div>
            </fieldset>
            <div className="grid gap-3 sm:grid-cols-3">
              <label className="space-y-1 text-sm font-semibold text-ink">
                Semanas
                <V2Select value={f.weeks} onChange={(e) => set({ weeks: Number(e.target.value) })}>
                  {Array.from({ length: PLAN_LIMITS.weeks }, (_, i) => i + 1).map((n) => <option key={n} value={n}>{n}</option>)}
                </V2Select>
              </label>
              <label className="space-y-1 text-sm font-semibold text-ink">
                Minutos por dia
                <V2Select value={f.minutes} onChange={(e) => set({ minutes: Number(e.target.value) })}>
                  {[30, 45, 60, 75, 90, 120].map((m) => <option key={m} value={m}>{m}</option>)}
                </V2Select>
              </label>
              <label className="space-y-1 text-sm font-semibold text-ink">
                Onde
                <V2Select value={f.place} onChange={(e) => set({ place: e.target.value })}>
                  <option value="">Qualquer</option>
                  {PLACES.map((p) => <option key={p} value={p}>{PLACE_LABELS[p]}</option>)}
                </V2Select>
              </label>
            </div>
            <fieldset className="space-y-2">
              <legend className="text-sm font-semibold text-ink">Foco (opcional)</legend>
              <div className="flex flex-wrap gap-1.5">
                {SKILL_AREAS.map((a) => (
                  <V2FilterChip key={a} active={f.focus.includes(a)} aria-pressed={f.focus.includes(a)} disabled={!f.focus.includes(a) && f.focus.length >= 6} onClick={() => set({ focus: toggle(f.focus, a) })} className="px-3 py-1.5">
                    {SKILL_AREA_LABELS[a]}
                  </V2FilterChip>
                ))}
              </div>
            </fieldset>
            <V2Toggle
              id="plano-auto"
              checked={f.auto}
              onChange={(v) => set({ auto: typeof v === 'boolean' ? v : !f.auto })}
              label="Montar com a biblioteca"
              hint="Escolhe drills do seu foco e do seu nível para cada dia. Desligado, os dias começam vazios."
            />
            {erro && <p role="alert" className="text-sm font-medium text-red-600">{erro}</p>}
            <div className="flex justify-end gap-2">
              <V2Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>Cancelar</V2Button>
              <V2Button type="submit">Ver prévia</V2Button>
            </div>
          </form>
        ) : (
          <div className="space-y-4">
            <p className="text-sm text-gray-600">
              {f.weeks} {f.weeks === 1 ? 'semana' : 'semanas'} · {f.days.length} {f.days.length === 1 ? 'dia' : 'dias'} por semana · {f.minutes} min
            </p>
            {f.auto && visiveis.incompleto && (
              <p className="rounded-2xl bg-amber-50 p-3 text-sm text-amber-900">Parte da biblioteca não carregou; a prévia usou só o que chegou.</p>
            )}
            {f.auto ? (
              <div className="space-y-2">
                <p className="text-sm font-semibold text-ink">A primeira semana</p>
                <ul className="space-y-2">
                  {semana1.map((s) => (
                    <li key={s.day} className="rounded-2xl bg-gray-50 p-3 text-sm">
                      <p className="font-semibold text-ink">{WEEKDAY_LONG[s.day]}</p>
                      <p className="text-gray-600">
                        {s.item_ids.length
                          ? s.item_ids.map((id) => visiveis.byId[id]?.title || 'Item').join(' · ')
                          : 'Vazio — você escolhe os itens depois.'}
                      </p>
                    </li>
                  ))}
                </ul>
                {vazios > 0 && <p className="text-xs text-gray-500">{vazios} {vazios === 1 ? 'dia ficou vazio' : 'dias ficaram vazios'}: não há itens suficientes que combinem; complete depois.</p>}
                <p className="text-xs text-gray-500">As semanas seguintes avançam do mais simples para o mais desafiador.</p>
              </div>
            ) : (
              <p className="text-sm text-gray-600">Os dias começam vazios. Depois de criar, abra cada dia para escolher os itens.</p>
            )}
            {erro && <p role="alert" className="text-sm font-medium text-red-600">{erro}</p>}
            <div className="flex justify-end gap-2">
              <V2Button variant="ghost" onClick={() => setPrevia(false)}>Voltar</V2Button>
              <V2Button onClick={criar} disabled={acoes.create.isPending}>{acoes.create.isPending ? 'Criando…' : 'Criar plano'}</V2Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
