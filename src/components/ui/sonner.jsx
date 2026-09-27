import { Toaster as Sonner } from 'sonner';
import { useTheme } from '@/core/lib/ThemeContext';

export function Toaster(props) {
  // Os avisos "coloridos" (sucesso, erro) têm paleta própria no sonner: sem o
  // tema, o verde-claro de sucesso apareceria aceso no meio do modo escuro.
  const { efetivo } = useTheme();
  return (
    <Sonner
      position="top-right"
      richColors
      closeButton
      theme={efetivo === 'escuro' ? 'dark' : 'light'}
      toastOptions={{
        classNames: {
          toast: 'group bg-background text-foreground border border-border shadow-lg',
          description: 'text-muted-foreground',
          actionButton: 'bg-primary text-primary-foreground',
          cancelButton: 'bg-muted text-muted-foreground',
        },
      }}
      {...props}
    />
  );
}
