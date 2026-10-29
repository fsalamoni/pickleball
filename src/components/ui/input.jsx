import * as React from 'react';
import { cn } from '@/core/lib/utils';
import { useNumberDraft } from '@/core/lib/useNumberDraft';

export const Input = React.forwardRef(({ className, type, ...props }, ref) => {
  // Campo numérico: deixa apagar e redigitar mesmo quando a tela converte no onChange.
  const numero = useNumberDraft(type === 'number' ? props : {});
  return (
    <input
      type={type}
      ref={ref}
      className={cn(
        'flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50',
        className,
      )}
      {...props}
      {...numero}
    />
  );
});
Input.displayName = 'Input';

/** `<input type="number">` sem estilo próprio, que deixa apagar e redigitar (ver `useNumberDraft`). */
export const NumberInput = React.forwardRef((props, ref) => {
  const numero = useNumberDraft(props);
  return <input ref={ref} {...props} type="number" {...numero} />;
});
NumberInput.displayName = 'NumberInput';
