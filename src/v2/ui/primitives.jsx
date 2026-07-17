import React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cn } from '@/core/lib/utils';

/**
 * Primitivos de UI do design system v2 "Athleisure Premium".
 *
 * Regras seguidas (docs/Design System):
 * - Superfícies brancas com squircles (rounded-3xl/4xl) e sombra orgânica difusa.
 * - Títulos em font-display (Outfit); dados/texto em Inter (herdado de .v2-root).
 * - Verde ácido (bg-acid) reservado para a ação principal.
 * - Nunca preto puro: texto primário em text-ink, secundário em text-gray-500.
 * - Respiro generoso (p-6/p-8) e bordas suaves (border-gray-100).
 */

export function V2Surface({ as: Tag = 'div', className, children, ...props }) {
  return (
    <Tag
      className={cn(
        'rounded-4xl border border-gray-100 bg-paper-pure p-6 shadow-organic-sm sm:p-8',
        className,
      )}
      {...props}
    >
      {children}
    </Tag>
  );
}

export function V2PageIntro({ title, subtitle, action, className }) {
  return (
    <div className={cn('mb-8 flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between', className)}>
      <div className="min-w-0">
        <h1 className="font-display text-3xl font-bold tracking-tight text-ink sm:text-4xl">{title}</h1>
        {subtitle && <p className="mt-2 font-medium text-gray-500">{subtitle}</p>}
      </div>
      {action && <div className="flex flex-wrap items-center gap-3">{action}</div>}
    </div>
  );
}

export function V2SectionHeader({ eyebrow, title, description, action, className }) {
  return (
    <div className={cn('flex flex-wrap items-end justify-between gap-4', className)}>
      <div className="min-w-0">
        {eyebrow && (
          <p className="text-[11px] font-bold uppercase tracking-widest text-gray-400">{eyebrow}</p>
        )}
        {title && <h2 className="mt-1 font-display text-2xl font-bold text-ink sm:text-3xl">{title}</h2>}
        {description && <p className="mt-2 max-w-2xl font-medium text-gray-500">{description}</p>}
      </div>
      {action}
    </div>
  );
}

const BUTTON_VARIANTS = {
  primary: 'bg-acid text-ink shadow-glow hover:bg-acid-light',
  secondary: 'bg-ink text-white hover:bg-ink-light',
  ghost: 'border border-gray-200 bg-paper-pure text-ink hover:border-ink',
  subtle: 'bg-paper text-ink hover:bg-paper-dark',
  danger: 'bg-red-50 text-red-600 hover:bg-red-100',
};

const BUTTON_SIZES = {
  sm: 'px-5 py-2.5 text-sm',
  md: 'px-6 py-3 text-sm',
  lg: 'px-8 py-3.5 text-base',
  icon: 'h-11 w-11',
};

export function V2Button({
  variant = 'primary',
  size = 'md',
  asChild = false,
  className,
  children,
  ...props
}) {
  const Comp = asChild ? Slot : 'button';
  return (
    <Comp
      className={cn(
        'btn-press inline-flex items-center justify-center gap-2 rounded-full font-bold transition-all',
        'focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-acid/30 disabled:cursor-not-allowed disabled:opacity-60',
        BUTTON_VARIANTS[variant] || BUTTON_VARIANTS.primary,
        BUTTON_SIZES[size] || BUTTON_SIZES.md,
        className,
      )}
      {...props}
    >
      {children}
    </Comp>
  );
}

const BADGE_TONES = {
  neutral: 'bg-paper text-gray-600 border border-gray-100',
  acid: 'bg-acid/20 text-ink border border-acid/30',
  ink: 'bg-ink text-acid',
  green: 'bg-green-50 text-green-600 border border-green-100',
  blue: 'bg-blue-50 text-blue-600 border border-blue-100',
  amber: 'bg-amber-50 text-amber-700 border border-amber-100',
  red: 'bg-red-50 text-red-500 border border-red-100',
};

export function V2Badge({ tone = 'neutral', className, children, ...props }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold',
        BADGE_TONES[tone] || BADGE_TONES.neutral,
        className,
      )}
      {...props}
    >
      {children}
    </span>
  );
}

const STAT_ACCENTS = {
  ink: 'bg-ink text-white',
  acid: 'bg-acid text-ink',
  blue: 'bg-blue-600 text-white',
  green: 'bg-green-500 text-white',
};

export function V2StatCard({ icon: Icon, label, value, delta, deltaTone = 'green', accent = 'ink', hint, className }) {
  const deltaClass = deltaTone === 'green'
    ? 'bg-green-50 text-green-500'
    : deltaTone === 'red'
      ? 'bg-red-50 text-red-500'
      : 'bg-gray-50 text-gray-400';
  return (
    <div className={cn('group relative flex flex-col justify-center overflow-hidden rounded-4xl border border-gray-100 bg-paper-pure p-8 shadow-organic-sm', className)}>
      <div className="absolute right-0 top-0 -mr-8 -mt-8 h-24 w-24 rounded-bl-full bg-paper transition-transform group-hover:scale-110" />
      <div className="relative z-10">
        {Icon && (
          <div className={cn('mb-6 flex h-12 w-12 items-center justify-center rounded-2xl text-xl shadow-md', STAT_ACCENTS[accent] || STAT_ACCENTS.ink)}>
            <Icon className="h-5 w-5" />
          </div>
        )}
        <p className="mb-1 font-medium text-gray-500">{label}</p>
        <div className="flex items-baseline gap-3">
          <h3 className="font-display text-4xl font-bold tracking-tight text-ink sm:text-5xl">{value}</h3>
          {delta && <span className={cn('rounded-lg px-2 py-1 text-sm font-bold', deltaClass)}>{delta}</span>}
        </div>
        {hint && <p className="mt-2 text-xs font-medium text-gray-400">{hint}</p>}
      </div>
    </div>
  );
}

const AVATAR_SIZES = {
  xs: 'h-6 w-6 text-[10px]',
  sm: 'h-9 w-9 text-xs',
  md: 'h-11 w-11 text-sm',
  lg: 'h-14 w-14 text-base',
  xl: 'h-20 w-20 text-2xl',
};

function initialsFor(name) {
  return (
    String(name || '')
      .split(' ')
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase())
      .join('') || '?'
  );
}

export function V2Avatar({ name, photoUrl, size = 'md', className, ring = false }) {
  const dim = AVATAR_SIZES[size] || AVATAR_SIZES.md;
  const ringClass = ring ? 'ring-2 ring-white' : '';
  if (photoUrl) {
    return <img src={photoUrl} alt="" title={name || ''} className={cn(dim, ringClass, 'shrink-0 rounded-full border border-gray-100 object-cover object-top', className)} />;
  }
  return (
    <div
      title={name || ''}
      className={cn(dim, ringClass, 'flex shrink-0 items-center justify-center rounded-full bg-ink font-bold text-acid', className)}
    >
      {initialsFor(name)}
    </div>
  );
}

export function V2AvatarStack({ people = [], size = 'md', max = 4, className }) {
  const list = people.filter(Boolean).slice(0, max);
  if (list.length === 0) return null;
  return (
    <div className={cn('flex -space-x-3', className)}>
      {list.map((person, index) => (
        <V2Avatar key={`${person.name || 'p'}-${index}`} name={person.name} photoUrl={person.photoUrl} size={size} ring />
      ))}
    </div>
  );
}

export function V2EmptyState({ icon: Icon, title, description, action, className }) {
  return (
    <div className={cn('flex flex-col items-center px-6 py-14 text-center', className)}>
      {Icon && (
        <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-acid/15 text-ink shadow-glow">
          <Icon className="h-9 w-9" />
        </div>
      )}
      <h3 className="font-display text-2xl font-bold text-ink">{title}</h3>
      {description && <p className="mt-3 max-w-lg font-medium leading-7 text-gray-500">{description}</p>}
      {action && <div className="mt-6 flex flex-wrap justify-center gap-3">{action}</div>}
    </div>
  );
}

export function V2Skeleton({ className }) {
  return <div className={cn('animate-pulse rounded-3xl bg-gray-100', className)} />;
}

export function V2FilterChip({ active = false, className, children, ...props }) {
  return (
    <button
      type="button"
      className={cn(
        'btn-press inline-flex items-center gap-2 rounded-full border px-5 py-2 text-sm font-medium shadow-sm transition-colors',
        active
          ? 'border-transparent bg-acid text-ink font-bold'
          : 'border-gray-200 bg-paper-pure text-gray-600 hover:border-ink hover:text-ink',
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}

export function V2SearchInput({ icon: Icon, className, wrapperClassName, ...props }) {
  return (
    <div className={cn('relative', wrapperClassName)}>
      {Icon && (
        <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-4 text-gray-400">
          <Icon className="h-4 w-4" />
        </div>
      )}
      <input
        className={cn(
          'block w-full rounded-full border border-gray-200 bg-paper-pure py-3 pl-11 pr-4 text-sm text-ink transition-all',
          'placeholder-gray-400 focus:border-gray-300 focus:bg-white focus:ring-4 focus:ring-gray-100',
          className,
        )}
        {...props}
      />
    </div>
  );
}

const FIELD_CONTROL = 'w-full rounded-2xl border border-gray-200 bg-paper-pure px-4 py-3 text-sm text-ink transition-all placeholder-gray-400 focus:border-gray-300 focus:bg-white focus:outline-none focus:ring-4 focus:ring-gray-100 disabled:cursor-not-allowed disabled:opacity-60';

export function V2Field({ label, htmlFor, hint, error, required, className, children }) {
  return (
    <div className={cn('space-y-2', className)}>
      {label && (
        <label htmlFor={htmlFor} className="block text-sm font-semibold text-ink">
          {label} {required && <span className="text-acid-dark">*</span>}
        </label>
      )}
      {children}
      {hint && !error && <p className="text-xs leading-5 text-gray-400">{hint}</p>}
      {error && <p className="text-xs font-medium text-red-500">{error}</p>}
    </div>
  );
}

export function V2Input({ className, ...props }) {
  return <input className={cn(FIELD_CONTROL, className)} {...props} />;
}

export function V2Textarea({ className, rows = 4, ...props }) {
  return <textarea rows={rows} className={cn(FIELD_CONTROL, 'min-h-[7rem] resize-y', className)} {...props} />;
}

export function V2Select({ className, children, ...props }) {
  return (
    <select className={cn(FIELD_CONTROL, 'h-12 appearance-none bg-[length:1rem] pr-10', className)} {...props}>
      {children}
    </select>
  );
}

export function V2Toggle({ checked, onChange, label, hint, id }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <div className="min-w-0">
        {label && <label htmlFor={id} className="cursor-pointer text-sm font-semibold text-ink">{label}</label>}
        {hint && <p className="text-xs leading-5 text-gray-400">{hint}</p>}
      </div>
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={cn(
          'relative inline-flex h-7 w-12 shrink-0 items-center rounded-full transition-colors',
          checked ? 'bg-acid' : 'bg-gray-200',
        )}
      >
        <span className={cn('inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform', checked ? 'translate-x-6' : 'translate-x-1')} />
      </button>
    </div>
  );
}

export function V2ContentHero({ eyebrow, title, description, meta, action }) {
  return (
    <div className="relative mb-6 overflow-hidden rounded-4xl bg-mesh p-8 shadow-organic">
      <div className="absolute -right-10 -top-10 h-56 w-56 rounded-full bg-acid opacity-20 blur-[80px]" />
      <div className="relative z-10 flex flex-wrap items-end justify-between gap-4">
        <div className="max-w-3xl">
          {eyebrow && <span className="rounded-full border border-white/10 bg-white/10 px-3 py-1 text-xs font-bold uppercase tracking-wider text-acid">{eyebrow}</span>}
          <h1 className="mt-4 font-display text-3xl font-bold text-white sm:text-4xl">{title}</h1>
          {description && <p className="mt-3 text-sm leading-7 text-gray-300">{description}</p>}
          {meta && <p className="mt-3 text-xs text-gray-400">{meta}</p>}
        </div>
        {action}
      </div>
    </div>
  );
}

export function V2ContentSection({ icon: Icon, title, description, children, className }) {
  return (
    <V2Surface className={className}>
      <div className="flex items-start gap-3">
        {Icon && (
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-ink text-acid">
            <Icon className="h-5 w-5" />
          </div>
        )}
        <div className="min-w-0">
          <h2 className="font-display text-lg font-bold text-ink">{title}</h2>
          {description && <p className="mt-1 text-sm text-gray-500">{description}</p>}
        </div>
      </div>
      <div className="mt-4 space-y-3 text-sm leading-7 text-gray-600">{children}</div>
    </V2Surface>
  );
}

export function V2BulletList({ items = [], className }) {
  return (
    <ul className={cn('space-y-2', className)}>
      {items.map((item, i) => (
        <li key={i} className="flex gap-2.5">
          <span className="mt-2.5 h-1.5 w-1.5 shrink-0 rounded-full bg-acid-dark" />
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}
