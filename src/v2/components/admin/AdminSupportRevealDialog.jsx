/**
 * Revelar os dados de contato de uma conta — com motivo, registro de leitura
 * (`admin_access_logs`, pelo servidor; registro interno, sem aviso ao titular). É o que separa
 * suporte de vigilância: fica a testemunha, para o admin.
 */
import React, { useState } from 'react';
import { toast } from 'sonner';
import { Eye } from 'lucide-react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import { V2Button, V2Field, V2Input, V2Select, V2Textarea } from '@/v2/ui/primitives';
import { useSupportReveal } from '@/modules/admin/hooks/usePlatformUsers';
import {
  REVEAL_REASON_META, REVEAL_TEXT_MIN, SENSITIVE_FIELDS, validateRevealRequest,
} from '@/modules/admin/domain/supportAccess';

/** @param {{ user: object, onRevealed: (values: object) => void, onClose: Function }} props */
export default function AdminSupportRevealDialog({ user, onRevealed, onClose }) {
  const [categoria, setCategoria] = useState('');
  const [texto, setTexto] = useState('');
  const [ticket, setTicket] = useState('');
  const revelar = useSupportReveal();
  const pedido = { uid: user.uid, fields: SENSITIVE_FIELDS, reason_category: categoria, reason_text: texto.trim(), ticket_ref: ticket.trim() };
  const { isValid, errors } = validateRevealRequest(pedido);

  const confirmar = async () => {
    try {
      const r = await revelar.mutateAsync(pedido);
      onRevealed(r.values || {});
      onClose();
    } catch (e) {
      toast.error(e?.message || 'Não foi possível revelar.');
    }
  };

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-h-[90dvh] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Eye className="h-5 w-5" /> Revelar dados de contato</DialogTitle>
          <DialogDescription>
            E-mail, telefone, nascimento e endereço de {user.platform_name || user.full_name || 'esta conta'}.
            O acesso fica registrado internamente (quem, quando, por quê).
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <V2Field label="Categoria do motivo" htmlFor="reveal-cat" required>
            <V2Select id="reveal-cat" value={categoria} onChange={(e) => setCategoria(e.target.value)}>
              <option value="">Escolha…</option>
              {Object.entries(REVEAL_REASON_META).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </V2Select>
          </V2Field>
          <V2Field label="Motivo" htmlFor="reveal-texto" required error={texto && errors.reason_text}
            hint={`Mínimo ${REVEAL_TEXT_MIN} caracteres. A pessoa lê este texto no aviso.`}>
            <V2Textarea id="reveal-texto" rows={3} maxLength={500} value={texto} onChange={(e) => setTexto(e.target.value)}
              placeholder="Ex.: a pessoa pediu por WhatsApp para conferir o telefone do cadastro" />
          </V2Field>
          <V2Field label="Referência (opcional)" htmlFor="reveal-ticket" hint="E-mail, print ou protocolo do pedido.">
            <V2Input id="reveal-ticket" maxLength={120} value={ticket} onChange={(e) => setTicket(e.target.value)} />
          </V2Field>
        </div>
        <DialogFooter>
          <V2Button variant="ghost" onClick={onClose}>Cancelar</V2Button>
          <V2Button disabled={!isValid || revelar.isPending} onClick={confirmar}>
            {revelar.isPending ? 'Registrando…' : 'Registrar e revelar'}
          </V2Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
