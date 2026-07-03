import { CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { PlatformSurfaceCard } from '@/components/ui/platform-page';
import { cn } from '@/core/lib/utils';

export function LegalPage({ eyebrow, title, description, meta, children }) {
  return (
    <div className="mx-auto max-w-6xl space-y-5">
      <section className="bg-ink text-white rounded-[1.25rem] p-5 sm:rounded-[2rem] sm:p-8">
        <div className="max-w-3xl space-y-3">
          {eyebrow && <p className="text-xs font-semibold uppercase tracking-wider text-green-600">{eyebrow}</p>}
          <h1 className="text-2xl font-bold text-white sm:text-3xl">{title}</h1>
          {description && <p className="text-sm leading-6 text-white/70 sm:text-base">{description}</p>}
          {meta && <p className="text-xs text-acid/75">{meta}</p>}
        </div>
      </section>
      <div className="min-w-0 space-y-4">{children}</div>
    </div>
  );
}

export function LegalSection({ icon: Icon, title, description, children, className }) {
  return (
    <PlatformSurfaceCard className={cn('overflow-hidden', className)} contentClassName="p-0">
      <CardHeader className="border-b border-gray-100 bg-white/45 p-4 sm:p-5">
        <div className="flex items-start gap-3">
          {Icon && (
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl bg-ink text-white/70 shadow-sm">
              <Icon className="h-4 w-4" />
            </div>
          )}
          <div className="min-w-0 space-y-1">
            <CardTitle className="text-base text-ink">{title}</CardTitle>
            {description && <CardDescription>{description}</CardDescription>}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3 p-4 text-sm leading-6 text-gray-600 sm:p-5">
        {children}
      </CardContent>
    </PlatformSurfaceCard>
  );
}

export function LegalList({ children }) {
  return <ul className="space-y-2 text-sm text-gray-600">{children}</ul>;
}

export function LegalListItem({ children }) {
  return (
    <li className="flex gap-2">
      <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-green-600" />
      <span>{children}</span>
    </li>
  );
}

export function LegalStat({ label, value }) {
  return (
    <div className="rounded-md border border-gray-100 bg-white/65 p-3">
      <div className="text-xs text-gray-500">{label}</div>
      <div className="mt-1 text-lg font-bold text-green-700">{value}</div>
    </div>
  );
}
