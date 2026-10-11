/**
 * Suspender, bloquear ou reativar UMA conta. Motivo obrigatório (a pessoa lê
 * ao tentar entrar; vai para a Auditoria); na suspensão, o prazo. O servidor
 * (`adminSetAccountStatus`) confere as portas de novo e desliga o login.
 */
import React, { useState } from 'react';
import { toast } from 'sonner';
import { Ban, PauseCircle, PlayCircle } from 'lucide-react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import { V2Button, V2Field, V2Select, V2Textarea } from '@/v2/ui/primitives';
import { useSetAccountStatus } from '@/modules/admin/hooks/usePlatformUsers';
import {
  STATUS_ACTION_META, SUSPEND_DAYS_OPTIONS, accountStatusOf, validateStatusRequest,
} from '@/modules/admin/domain/accountStatus';

const ICONE = { suspend: PauseCircle, block: Ban, reactivate: PlayCircle };
const COR = { suspend: 'bg-amber-600 text-white hover:bg-amber-700', block: 'bg-red-600 text-white hover:bg-red-700', reactivate: '' };

/** @param {{ user: object, action: 'suspend'|'block'|'reactivate', onClose: Function }} props */
export default function AdminAccountStatusDialog({ user, action, onClose }) {
  const [reason, setReason] = useState('');
  const [days, setDays] = useState(7);
  const mutar = useSetAccountStatus();
  const meta = STATUS_ACTION_META[action];
  const Icone = ICONE[action];
  const atual = accountStatusOf(user);
  const { isValid, errors } = validateStatusRequest({ action, reason, days });
  const nome = user.platform_name || user.full_name || user.email || user.uid;

  const confirmar = async () => {
    try {
      await mutar.mutateAsync({ uid: user.uid, action, reason: reason.trim(), days: action === 'suspend' ? Number(days) : undefined });
      toast.success(`Conta de ${nome} ${meta.verb}.`);
      onClose();
    } catch (e) {
      toast.error(e?.message || 'Não foi possível concluir.');
    }
  };

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-h-[90dvh] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Icone className="h-5 w-5" /> {meta.label} a conta de {nome}</DialogTitle>
          <DialogDescription>
            {meta.hint}{' '}
            {action !== 'reactivate'
              ? 'A pessoa é deslogada agora e não entra mais; nada é apagado.'
              : atual.reason ? `Estava ${atual.label.toLowerCase()} por: ${atual.reason}` : ''}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          {action === 'suspend' && (
            <V2Field label="Por quanto tempo" htmlFor="status-dias" error={errors.days}>
              <V2Select id="status-dias" value={days} onChange={(e) => setDays(Number(e.target.value))}>
                {SUSPEND_DAYS_OPTIONS.map((d) => <option key={d} value={d}>{d} dia{d > 1 ? 's' : ''}</option>)}
              </V2Select>
            </V2Field>
          )}
          <V2Field
            label="Motivo"
            htmlFor="status-motivo"
            required
            error={reason && errors.reason}
            hint={action === 'reactivate' ? 'Fica na Auditoria.' : 'A pessoa lê este motivo ao tentar entrar. Fica na Auditoria.'}
          >
            <V2Textarea id="status-motivo" rows={3} maxLength={500} value={reason} onChange={(e) => setReason(e.target.value)}
              placeholder={action === 'reactivate' ? 'Ex.: a pessoa explicou e o caso foi resolvido' : 'Ex.: denúncias repetidas de ofensas no chat'} />
          </V2Field>
        </div>

        <DialogFooter>
          <V2Button variant="ghost" onClick={onClose}>Cancelar</V2Button>
          <V2Button className={COR[action]} disabled={!isValid || mutar.isPending} onClick={confirmar}>
            {mutar.isPending ? 'Aplicando…' : meta.label}
          </V2Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
