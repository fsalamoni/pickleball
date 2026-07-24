/**
 * AddToCalendarButton — botão que baixa um arquivo .ics do evento (jogo,
 * torneio ou reserva/aula) para importar no calendário do usuário.
 *
 * Puro no cliente: monta o .ics com o domínio `ics.js` e dispara o download via
 * Blob. Gated pela flag calendar_export pelo componente pai (aqui só renderiza).
 */

import React from 'react';
import { CalendarPlus } from 'lucide-react';
import { toast } from 'sonner';
import { buildICS, icsFilename } from '@/modules/tournament/domain/ics.js';
import { V2Button } from '@/v2/ui/primitives';

export default function AddToCalendarButton({
  event, label = 'Adicionar ao calendário', size = 'sm', variant = 'secondary', className,
}) {
  function handleClick() {
    const content = buildICS(event || {});
    if (!content) {
      toast.error('Não foi possível gerar o evento (data inválida).');
      return;
    }
    try {
      const blob = new Blob([content], { type: 'text/calendar;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = icsFilename(event?.title);
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch {
      toast.error('Não foi possível baixar o evento.');
    }
  }

  return (
    <V2Button type="button" size={size} variant={variant} onClick={handleClick} className={className}>
      <CalendarPlus className="h-4 w-4" /> {label}
    </V2Button>
  );
}
