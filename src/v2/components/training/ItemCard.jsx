/**
 * Peças comuns das telas do treino: o ícone de cada tipo, a linha de autoria
 * e o cartão de um item. Uma fonte só — biblioteca, "Meus", "Recebidos",
 * planos, o "Hoje" e o painel do admin mostram o item do mesmo jeito.
 *
 * A AUTORIA aparece sempre (pedido do dono): "Equipe PickleRush", "Professor
 * Fulano" ou o nome do atleta, com o selo do papel.
 */
import React from 'react';
import { Link } from 'react-router-dom';
import {
  Activity, BadgeCheck, BookOpen, Dumbbell, GraduationCap, ListChecks, Route, Sparkles, Star, Target,
} from 'lucide-react';
import { cn } from '@/core/lib/utils';
import { ITEM_KIND_LABELS } from '@/modules/training/domain/taxonomy';
import { authorBadge, itemStatusLabel } from '@/modules/training/domain/visibility';
import { itemMetaLine } from '@/modules/training/domain/trainingItem';
import { V2Badge } from '@/v2/ui/primitives';

const KIND_ICON = {
  drill: Target,
  treino: ListChecks,
  fundamento: Activity,
  jogada: Route,
  fisico: Dumbbell,
  estudo: BookOpen,
};

// Tons claros (50–200) não mudam no modo escuro; o texto 700+ espelha junto.
const KIND_TONE = {
  drill: 'bg-lime-100 text-lime-800',
  treino: 'bg-sky-100 text-sky-800',
  fundamento: 'bg-violet-100 text-violet-800',
  jogada: 'bg-amber-100 text-amber-800',
  fisico: 'bg-rose-100 text-rose-800',
  estudo: 'bg-teal-100 text-teal-800',
};

export function KindIcon({ kind, className, size = 'md' }) {
  const Icon = KIND_ICON[kind] || Target;
  return (
    <span
      aria-hidden="true"
      className={cn(
        'inline-flex shrink-0 items-center justify-center rounded-2xl',
        size === 'sm' ? 'h-8 w-8' : 'h-11 w-11',
        KIND_TONE[kind] || KIND_TONE.drill,
        className,
      )}
    >
      <Icon className={size === 'sm' ? 'h-4 w-4' : 'h-5 w-5'} />
    </span>
  );
}

/** "Equipe PickleRush" / "Professor Ana" / "Bia", com o selo do papel. */
export function AuthorLine({ item, className }) {
  const a = authorBadge(item);
  const Icon = a.role === 'plataforma' ? BadgeCheck : a.role === 'professor' ? GraduationCap : null;
  return (
    <span className={cn('inline-flex min-w-0 items-center gap-1 text-xs font-semibold text-gray-500', className)}>
      {Icon && <Icon className={cn('h-3.5 w-3.5 shrink-0', a.role === 'plataforma' ? 'text-emerald-600' : 'text-sky-600')} aria-hidden="true" />}
      <span className="truncate">{a.label}</span>
      {item?.ai_assisted && (
        <span className="inline-flex shrink-0 items-center gap-0.5 text-gray-400" title="Criado com ajuda de IA e revisado pelo autor">
          <Sparkles className="h-3 w-3" aria-hidden="true" /> IA
        </span>
      )}
    </span>
  );
}

/**
 * @param {{
 *   item: object,
 *   to?: string,             // padrão: a ficha do item
 *   showStatus?: boolean,    // "Só eu", "Em revisão"… (lista "Meus")
 *   actions?: React.ReactNode, // botões abaixo do cartão (fora do link)
 *   extra?: React.ReactNode,   // uma linha a mais (prazo, recado…)
 *   className?: string,
 * }} props
 */
export default function ItemCard({ item, to, showStatus = false, actions, extra, className }) {
  // O conteúdo antigo do professor (`cc_…`) também abre na ficha, que o acha
  // entre os itens dos professores da pessoa.
  const href = to || `/treino/item/${item.id}`;
  const meta = itemMetaLine(item);
  const corpo = (
    <div className="flex gap-3">
      <KindIcon kind={item.kind} />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-[11px] font-bold uppercase tracking-widest text-gray-400">{ITEM_KIND_LABELS[item.kind] || 'Item'}</span>
          {item.featured && (
            <span className="inline-flex items-center gap-0.5 text-[11px] font-bold text-amber-600">
              <Star className="h-3 w-3 fill-current" aria-hidden="true" /> Destaque
            </span>
          )}
        </div>
        <h3 className="mt-0.5 font-display text-base font-bold leading-snug text-ink">{item.title}</h3>
        {item.summary && <p className="mt-1 line-clamp-2 text-sm text-gray-500">{item.summary}</p>}
        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1">
          <AuthorLine item={item} />
          {meta && <span className="text-xs text-gray-400">{meta}</span>}
        </div>
        {extra && <div className="mt-2">{extra}</div>}
      </div>
      {showStatus && (
        <V2Badge
          tone={item.hidden ? 'red' : item.review === 'pendente' ? 'amber' : item.review === 'recusado' ? 'red' : 'neutral'}
          className="h-fit shrink-0"
        >
          {itemStatusLabel(item)}
        </V2Badge>
      )}
    </div>
  );

  return (
    <article className={cn('rounded-3xl border border-gray-100 bg-paper-pure p-4 shadow-sm transition-colors', href && 'hover:border-ink', className)}>
      {href ? (
        <Link to={href} className="block rounded-2xl focus:outline-none focus-visible:ring-2 focus-visible:ring-ink">
          {corpo}
        </Link>
      ) : corpo}
      {actions && <div className="mt-3 flex flex-wrap gap-2 border-t border-gray-100 pt-3">{actions}</div>}
    </article>
  );
}
