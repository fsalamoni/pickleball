/**
 * Peças pequenas do editor de treino: a seção com a linha do "porquê", o
 * botão de ícone (sempre com nome), o chip de escolha e a lista editável com
 * ↑ ↓ (alternativa de um toque a arrastar — WCAG 2.5.7).
 */
import React from 'react';
import { ArrowDown, ArrowUp, Check, Plus, Trash2, TriangleAlert } from 'lucide-react';
import { cn } from '@/core/lib/utils';
import { skillOptions } from '@/modules/training/domain/taxonomy';
import { V2Button } from '@/v2/ui/primitives';
import { moveItem, removeAt, replaceAt } from './editorForm';

export function EditorSection({ id, titulo, porque, feito = false, dica, children }) {
  return (
    <section
      id={`secao-${id}`}
      aria-labelledby={`secao-${id}-t`}
      data-dica={dica}
      className="scroll-mt-4 rounded-4xl border border-gray-100 bg-paper-pure p-5 shadow-organic-sm sm:p-8"
    >
      <div className="mb-5">
        <h2 id={`secao-${id}-t`} className="flex items-center gap-2 font-display text-xl font-bold text-ink">
          {titulo}
          {feito && <Check className="h-5 w-5 text-green-600" aria-label="preenchida" />}
        </h2>
        {porque && <p className="mt-1 text-sm text-gray-500">{porque}</p>}
      </div>
      <div className="space-y-5">{children}</div>
    </section>
  );
}

/** Botão só de ícone: o nome é obrigatório (quem não vê o ícone ouve o nome). */
export function IconBtn({ label, onClick, disabled = false, className, children, ...rest }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-gray-200 bg-paper-pure text-ink transition-colors hover:border-ink disabled:cursor-not-allowed disabled:opacity-40',
        className,
      )}
      {...rest}
    >
      {children}
    </button>
  );
}

/** Chip de liga/desliga (escolha múltipla). */
export function ChipToggle({ active, onClick, disabled = false, children }) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'inline-flex min-h-[44px] items-center gap-1.5 rounded-full border px-4 py-2 text-sm transition-colors disabled:cursor-not-allowed disabled:opacity-40',
        active ? 'border-transparent bg-acid font-bold text-ink' : 'border-gray-200 bg-paper-pure text-gray-600 hover:border-ink hover:text-ink',
      )}
    >
      {active && <Check className="h-3.5 w-3.5" aria-hidden="true" />}
      {children}
    </button>
  );
}

/** Lista de avisos que orientam (não bloqueiam). */
export function Avisos({ itens = [] }) {
  if (!itens.length) return null;
  return (
    <ul className="space-y-1 rounded-2xl border border-amber-100 bg-amber-50 px-4 py-3 text-xs text-amber-800">
      {itens.map((a) => (
        <li key={a} className="flex gap-2">
          <TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          <span>{a}</span>
        </li>
      ))}
    </ul>
  );
}

export function ErroDoCampo({ id, erro }) {
  if (!erro) return null;
  return <p id={id} className="text-xs font-medium text-red-500">{erro}</p>;
}

/**
 * Lista editável: cada item tem ↑ ↓ e remover; "Adicionar" até o limite,
 * com o contador ("4 de 15").
 */
export function ListEditor({
  id, items = [], onChange, max, addLabel, makeNew, renderItem, itemLabel = 'item', extraActions = null,
}) {
  return (
    <div id={id} className="space-y-3">
      {items.length > 0 && (
        <ol className="space-y-3">
          {items.map((it, i) => (
            // A posição É a identidade aqui: os campos são controlados pelo valor.
            <li key={i} className="rounded-3xl border border-gray-100 bg-paper p-3">
              <div className="min-w-0">{renderItem(it, i, (v) => onChange(replaceAt(items, i, v)))}</div>
              <div className="mt-2 flex justify-end gap-2">
                <IconBtn label={`Subir ${itemLabel} ${i + 1}`} disabled={i === 0} onClick={() => onChange(moveItem(items, i, -1))}>
                  <ArrowUp className="h-4 w-4" aria-hidden="true" />
                </IconBtn>
                <IconBtn label={`Descer ${itemLabel} ${i + 1}`} disabled={i === items.length - 1} onClick={() => onChange(moveItem(items, i, 1))}>
                  <ArrowDown className="h-4 w-4" aria-hidden="true" />
                </IconBtn>
                <IconBtn label={`Remover ${itemLabel} ${i + 1}`} onClick={() => onChange(removeAt(items, i))}>
                  <Trash2 className="h-4 w-4" aria-hidden="true" />
                </IconBtn>
              </div>
            </li>
          ))}
        </ol>
      )}
      <div className="flex flex-wrap items-center gap-3">
        {addLabel && (
          <V2Button type="button" variant="ghost" size="sm" disabled={items.length >= max} onClick={() => onChange([...items, makeNew()])}>
            <Plus className="h-4 w-4" aria-hidden="true" /> {addLabel}
          </V2Button>
        )}
        {extraActions}
        <span className="text-xs text-gray-400">{items.length} de {max}</span>
      </div>
    </div>
  );
}

/** Escolha múltipla em chips, com teto (o que passa do teto fica desligado). */
export function MultiChips({ id, legend, hint, options = [], value = [], onChange, max = Infinity }) {
  const lista = Array.isArray(value) ? value : [];
  const alternar = (v) => onChange(lista.includes(v) ? lista.filter((x) => x !== v) : [...lista, v]);
  return (
    <fieldset id={id} className="scroll-mt-4">
      <legend className="mb-2 text-sm font-semibold text-ink">{legend}</legend>
      <div className="flex flex-wrap gap-2">
        {options.map((o) => (
          <ChipToggle
            key={o.value}
            active={lista.includes(o.value)}
            disabled={!lista.includes(o.value) && lista.length >= max}
            onClick={() => alternar(o.value)}
          >
            {o.label}
          </ChipToggle>
        ))}
      </div>
      {hint && <p className="mt-2 text-xs text-gray-400">{hint}</p>}
    </fieldset>
  );
}

const SKILL_GROUPS = skillOptions();

/** Habilidades agrupadas por área (a área também é escolhível). */
export function SkillPicker({ id, value = [], onChange, max = 6 }) {
  const lista = Array.isArray(value) ? value : [];
  const alternar = (v) => onChange(lista.includes(v) ? lista.filter((x) => x !== v) : [...lista, v]);
  const chip = (o) => (
    <ChipToggle
      key={o.value}
      active={lista.includes(o.value)}
      disabled={!lista.includes(o.value) && lista.length >= max}
      onClick={() => alternar(o.value)}
    >
      {o.label}
    </ChipToggle>
  );
  return (
    <fieldset id={id} className="scroll-mt-4">
      <legend className="mb-1 text-sm font-semibold text-ink">Habilidades</legend>
      <p className="mb-3 text-xs text-gray-400">A principal primeiro. Até {max} ({lista.length} escolhidas).</p>
      <div className="space-y-3">
        {SKILL_GROUPS.map((g) => (
          <div key={g.value}>
            <p className="mb-1.5 text-xs font-bold uppercase tracking-wide text-gray-400">{g.label}</p>
            <div className="flex flex-wrap gap-2">
              {chip({ value: g.value, label: `${g.label} (geral)` })}
              {g.children.map(chip)}
            </div>
          </div>
        ))}
      </div>
    </fieldset>
  );
}
