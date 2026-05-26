import React from 'react';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
} from '@/components/ui/alert-dialog';
import { cn } from '@/core/lib/utils';
import { buttonVariants } from '@/components/ui/button';
import { AlertTriangle } from 'lucide-react';

/**
 * Alert-dialog reaproveitável para confirmações destrutivas.
 * Substitui o `window.confirm()` por uma experiência consistente.
 *
 * Props:
 *  - open, onOpenChange: estado controlado
 *  - title, description: textos
 *  - confirmLabel: texto do botão de ação
 *  - destructive: usa estilo destrutivo no botão
 *  - onConfirm: callback ao confirmar
 *  - loading: desabilita o botão enquanto ação executa
 */
export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = 'Confirmar',
  cancelLabel = 'Cancelar',
  destructive = false,
  onConfirm,
  loading = false,
}) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            {destructive && <AlertTriangle className="w-5 h-5 text-red-600" />}
            {title}
          </AlertDialogTitle>
          {description && <AlertDialogDescription>{description}</AlertDialogDescription>}
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={loading}>{cancelLabel}</AlertDialogCancel>
          <AlertDialogAction
            disabled={loading}
            onClick={(e) => {
              e.preventDefault();
              onConfirm?.();
            }}
            className={cn(destructive && buttonVariants({ variant: 'destructive' }))}
          >
            {loading ? 'Aguarde…' : confirmLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
