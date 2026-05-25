import { cn } from '@/core/lib/utils';

export function EmptyState({ icon: Icon, title, description, action, className }) {
  return (
    <div className={cn('flex flex-col items-center justify-center text-center py-12 px-6', className)}>
      {Icon && (
        <div className="w-14 h-14 rounded-full bg-muted flex items-center justify-center mb-4">
          <Icon className="w-7 h-7 text-muted-foreground" />
        </div>
      )}
      {title && <h3 className="text-lg font-semibold text-foreground mb-1">{title}</h3>}
      {description && <p className="text-sm text-muted-foreground max-w-md mb-4">{description}</p>}
      {action}
    </div>
  );
}
