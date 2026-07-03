import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva } from 'class-variance-authority';
import { cn } from '@/core/lib/utils';

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-full text-sm font-semibold tracking-[-0.01em] ring-offset-background transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 disabled:shadow-none',
  {
    variants: {
      variant: {
        default: 'bg-[linear-gradient(135deg,hsl(var(--primary))_0%,hsl(88_72%_43%)_100%)] text-primary-foreground shadow-[0_18px_38px_-22px_rgba(15,23,42,0.7)] hover:-translate-y-0.5 hover:brightness-105',
        destructive: 'bg-destructive text-destructive-foreground shadow-[0_16px_32px_-20px_rgba(185,28,28,0.55)] hover:-translate-y-0.5 hover:bg-destructive/95',
        outline: 'border border-gray-100 bg-white/75 text-ink shadow-[0_12px_28px_-22px_rgba(15,23,42,0.5)] hover:-translate-y-0.5 hover:border-green-500/30 hover:bg-white',
        secondary: 'bg-secondary text-secondary-foreground shadow-[0_14px_28px_-24px_rgba(15,23,42,0.35)] hover:-translate-y-0.5 hover:bg-paper',
        ghost: 'text-gray-600 hover:bg-white/70 hover:text-ink',
        link: 'text-primary underline-offset-4 hover:underline',
      },
      size: {
        default: 'h-11 px-5 py-2.5',
        sm: 'h-9 px-4 text-[13px]',
        lg: 'h-12 px-6 text-[15px]',
        icon: 'h-10 w-10',
      },
    },
    defaultVariants: { variant: 'default', size: 'default' },
  },
);

export const Button = React.forwardRef(({ className, variant, size, asChild = false, ...props }, ref) => {
  const Comp = asChild ? Slot : 'button';
  return <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />;
});
Button.displayName = 'Button';

export { buttonVariants };
