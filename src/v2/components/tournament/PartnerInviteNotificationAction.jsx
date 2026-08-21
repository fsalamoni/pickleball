import React, { useState } from 'react';
import { toast } from 'sonner';
import { V2Button } from '@/v2/ui/primitives';
import { useRespondPartnerInvite } from '@/modules/tournament/hooks/useTournament';
import { partnerInviteNotificationRegistrationId } from '@/modules/tournament/domain/partnerInvite';

/**
 * Ação inline de convite de dupla dentro do sino de notificações
 * (flag partner_invite_quick_confirm). Quando a notificação carrega um convite
 * respondível (`data.kind === 'partner_invite'` + `registration_id`), oferece
 * "Confirmar dupla" / "Recusar" ali mesmo — o parceiro responde sem abrir o
 * torneio. Se a notificação não for um convite, renderiza `null` (o sino pode
 * montar o componente sem se preocupar com o tipo).
 *
 * É autocontido: valida via domínio puro, chama o mesmo serviço da página do
 * torneio (`respondPartnerInvite`) e nunca lança para fora — falhas viram toast.
 *
 * @param {object} props
 * @param {object} props.notification  a notificação (com `data`)
 * @param {() => void} [props.onResolved]  chamado após responder (ex.: marcar lida)
 */
export default function PartnerInviteNotificationAction({ notification, onResolved }) {
  const registrationId = partnerInviteNotificationRegistrationId(notification);
  const respondMutation = useRespondPartnerInvite();
  const [done, setDone] = useState(null); // null | 'accepted' | 'declined'

  if (!registrationId) return null;

  async function handleRespond(event, accept) {
    // Não deixa o clique borbulhar para a linha da notificação (que navega e
    // marca como lida) — a ação é auto-suficiente.
    event.preventDefault();
    event.stopPropagation();
    if (respondMutation.isPending || done) return;
    try {
      await respondMutation.mutateAsync({ id: registrationId, accept });
      setDone(accept ? 'accepted' : 'declined');
      toast.success(accept ? 'Dupla confirmada! Boa sorte no torneio.' : 'Convite de dupla recusado.');
      onResolved?.();
    } catch (err) {
      // Ex.: o convite já foi respondido em outro lugar. Marca como lida para
      // não insistir e explica o motivo.
      toast.error(err?.message || 'Não foi possível responder ao convite.');
      onResolved?.();
    }
  }

  if (done) {
    return (
      <p className="mt-1 text-xs font-semibold text-gray-500">
        {done === 'accepted' ? 'Dupla confirmada.' : 'Convite recusado.'}
      </p>
    );
  }

  // Impede que o clique nos botões seja tratado pelo item do menu (radix), que
  // fecharia o sino e navegaria. Paramos os eventos de ponteiro/mouse/clique.
  const stop = (e) => e.stopPropagation();

  return (
    <div
      className="mt-2 flex flex-wrap gap-2"
      onClick={stop}
      onPointerDown={stop}
      onPointerUp={stop}
      onMouseDown={stop}
    >
      <V2Button
        size="sm"
        disabled={respondMutation.isPending}
        onClick={(e) => handleRespond(e, true)}
      >
        Confirmar dupla
      </V2Button>
      <V2Button
        size="sm"
        variant="ghost"
        disabled={respondMutation.isPending}
        onClick={(e) => handleRespond(e, false)}
      >
        Recusar
      </V2Button>
    </div>
  );
}
