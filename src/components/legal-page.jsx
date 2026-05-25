import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { cn } from '@/core/lib/utils';

export function LegalPage({ eyebrow, title, description, meta, children }) {
  return (
    <div className="mx-auto max-w-6xl space-y-5">
      <section className="arena-panel-strong rounded-lg p-5 sm:p-6">
        <div className="max-w-3xl space-y-3">
          {eyebrow && <p className="text-xs font-semibold uppercase tracking-wider text-emerald-200">{eyebrow}</p>}
          <h1 className="text-2xl font-bold text-white sm:text-3xl">{title}</h1>
          {description && <p className="text-sm leading-6 text-emerald-50/90 sm:text-base">{description}</p>}
          {meta && <p className="text-xs text-emerald-100/75">{meta}</p>}
        </div>
      </section>
      <div className="min-w-0 space-y-4">{children}</div>
    </div>
  );
}

export function LegalSection({ icon: Icon, title, description, children, className }) {
  return (
    <Card className={cn('overflow-hidden', className)}>
      <CardHeader className="border-b border-emerald-950/10 bg-white/45 p-4 sm:p-5">
        <div className="flex items-start gap-3">
          {Icon && (
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-emerald-900 text-emerald-50 shadow-sm">
              <Icon className="h-4 w-4" />
            </div>
          )}
          <div className="min-w-0 space-y-1">
            <CardTitle className="text-base text-slate-950">{title}</CardTitle>
            {description && <CardDescription>{description}</CardDescription>}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3 p-4 text-sm leading-6 text-slate-700 sm:p-5">
        {children}
      </CardContent>
    </Card>
  );
}

export function LegalList({ children }) {
  return <ul className="space-y-2 text-sm text-slate-700">{children}</ul>;
}

export function LegalListItem({ children }) {
  return (
    <li className="flex gap-2">
      <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-600" />
      <span>{children}</span>
    </li>
  );
}

export function LegalStat({ label, value }) {
  return (
    <div className="rounded-md border border-emerald-950/10 bg-white/65 p-3">
      <div className="text-xs text-slate-500">{label}</div>
      <div className="mt-1 text-lg font-bold text-emerald-800">{value}</div>
    </div>
  );
}
