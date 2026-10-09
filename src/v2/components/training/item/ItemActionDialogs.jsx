/**
 * Diálogos da ficha que pedem um texto antes de agir: denunciar o item e o
 * motivo da equipe (ocultar, recusar). O motivo vai para o autor — por isso
 * é obrigatório onde a equipe tira algo do ar.
 */
import React, { useState } from 'react';
import { toast } from 'sonner';
import { useReportTrainingItem } from '@/modules/training/hooks/useTrainingAdmin';
import { REPORT_REASONS } from '@/modules/training/services/reportService';
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { V2Button, V2Field, V2Textarea } from '@/v2/ui/primitives';

export const mensagemDeErro = (err, padrao) => (err?.name === 'TrainingItemError' && err.message ? err.message : padrao);

/** Confirmação de algo que não volta (excluir, remover). */
export function ConfirmDialog({ open, onOpenChange, title, description, confirmLabel, pending = false, onConfirm }) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          {description && <AlertDialogDescription>{description}</AlertDialogDescription>}
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancelar</AlertDialogCancel>
          <V2Button variant="danger" disabled={pending} onClick={onConfirm}>{pending ? 'Aguarde…' : confirmLabel}</V2Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

/** Pede um texto e confirma. `required`: sem texto, não confirma. */
export function ReasonDialog({
  open, onOpenChange, title, description, label, confirmLabel, required = false, pending = false, onConfirm, maxLength = 300,
}) {
  const [texto, setTexto] = useState('');
  const fechar = (aberto) => { if (!aberto) setTexto(''); onOpenChange(aberto); };
  const vazio = !texto.trim();
  return (
    <Dialog open={open} onOpenChange={fechar}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            if (required && vazio) return;
            onConfirm(texto.trim(), () => fechar(false));
          }}
        >
          <V2Field label={label} htmlFor="motivo-texto" required={required}>
            <V2Textarea id="motivo-texto" rows={3} maxLength={maxLength} value={texto} onChange={(e) => setTexto(e.target.value)} />
          </V2Field>
          <div className="flex justify-end gap-2">
            <V2Button type="button" variant="ghost" onClick={() => fechar(false)}>Cancelar</V2Button>
            <V2Button type="submit" disabled={pending || (required && vazio)}>{pending ? 'Salvando…' : confirmLabel}</V2Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function ReportDialog({ open, onOpenChange, item, identity }) {
  const denunciar = useReportTrainingItem(identity);
  const [motivo, setMotivo] = useState('');
  const [texto, setTexto] = useState('');
  const fechar = (aberto) => { if (!aberto) { setMotivo(''); setTexto(''); } onOpenChange(aberto); };
  const enviar = (e) => {
    e.preventDefault();
    if (!motivo) return;
    denunciar.mutate({ item, reason: motivo, text: texto }, {
      onSuccess: () => {
        toast.success('Recebemos. A equipe analisa e o item continua visível enquanto isso.');
        fechar(false);
      },
      onError: (err) => toast.error(mensagemDeErro(err, 'Não foi possível enviar a denúncia. Tente de novo.')),
    });
  };
  return (
    <Dialog open={open} onOpenChange={fechar}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Denunciar este item</DialogTitle>
          <DialogDescription>Só a equipe da plataforma vê a denúncia. O autor não sabe quem denunciou.</DialogDescription>
        </DialogHeader>
        <form className="space-y-4" onSubmit={enviar}>
          <fieldset className="space-y-2">
            <legend className="text-sm font-semibold text-ink">O que há de errado?</legend>
            {Object.entries(REPORT_REASONS).map(([valor, rotulo]) => (
              <label key={valor} className="flex items-center gap-3 rounded-2xl border border-gray-100 p-3 text-sm text-ink has-[:checked]:border-ink">
                <input type="radio" name="motivo-denuncia" value={valor} checked={motivo === valor} onChange={() => setMotivo(valor)} className="h-4 w-4" />
                {rotulo}
              </label>
            ))}
          </fieldset>
          <V2Field label="Conte mais (opcional)" htmlFor="denuncia-texto">
            <V2Textarea id="denuncia-texto" rows={3} maxLength={500} value={texto} onChange={(e) => setTexto(e.target.value)} />
          </V2Field>
          <div className="flex justify-end gap-2">
            <V2Button type="button" variant="ghost" onClick={() => fechar(false)}>Cancelar</V2Button>
            <V2Button type="submit" disabled={!motivo || denunciar.isPending}>{denunciar.isPending ? 'Enviando…' : 'Enviar denúncia'}</V2Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
