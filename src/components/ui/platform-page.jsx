import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/core/lib/utils';

export function PlatformSurfaceCard({ children, className, contentClassName, ...props }) {
  return (
    <Card className={cn('rounded-[2rem] border-white/80 bg-white/82', className)} {...props}>
      <CardContent className={cn('p-6 sm:p-7', contentClassName)}>{children}</CardContent>
    </Card>
  );
}

export function PlatformSectionHeader({
  eyebrow,
  title,
  description,
  action = null,
  className,
  titleClassName,
  descriptionClassName,
}) {
  return (
    <div className={cn('flex flex-wrap items-end justify-between gap-3', className)}>
      <div>
        {eyebrow && (
          <div className="text-xs font-semibold uppercase tracking-[0.2em] text-gray-400">
            {eyebrow}
          </div>
        )}
        {title && (
          <h3 className={cn('mt-2 text-2xl font-semibold text-ink', titleClassName)}>
            {title}
          </h3>
        )}
        {description && (
          <p className={cn('mt-1 max-w-2xl text-sm leading-6 text-gray-500', descriptionClassName)}>
            {description}
          </p>
        )}
      </div>
      {action}
    </div>
  );
}

export function PlatformMetricCard({ label, value, description, icon: Icon, className, valueClassName }) {
  return (
    <div className={cn('rounded-[1.35rem] border border-gray-100 bg-secondary/35 p-4', className)}>
      <div className="flex items-center justify-between gap-3">
        <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-gray-400">
          {label}
        </div>
        {Icon && (
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-acid/15 text-ink">
            <Icon className="h-4.5 w-4.5" />
          </div>
        )}
      </div>
      <div className={cn('mt-3 text-xl font-semibold text-ink', valueClassName)}>{value}</div>
      {description && <p className="mt-1 text-xs leading-5 text-gray-500">{description}</p>}
    </div>
  );
}

export function PlatformFormSection({
  icon: Icon,
  eyebrow,
  title,
  description,
  className,
  children,
}) {
  return (
    <section className={cn('space-y-4 rounded-[1.5rem] border border-gray-100 bg-white/75 p-5', className)}>
      {(Icon || eyebrow || title || description) && (
        <div className="flex items-start gap-3">
          {Icon && (
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-acid/15 text-ink">
              <Icon className="h-4.5 w-4.5" />
            </div>
          )}
          <div>
            {eyebrow && (
              <div className="text-xs font-semibold uppercase tracking-[0.16em] text-gray-400">
                {eyebrow}
              </div>
            )}
            {title && <div className="text-base font-semibold text-ink">{title}</div>}
            {description && <p className="mt-1 text-sm leading-6 text-gray-500">{description}</p>}
          </div>
        </div>
      )}
      {children}
    </section>
  );
}

export function PlatformNotice({ children, className }) {
  return (
    <div className={cn('rounded-[1.25rem] border border-gray-200 bg-acid/10/70 p-4 text-sm leading-6 text-emerald-950', className)}>
      {children}
    </div>
  );
}