/**
 * ArenaCheckinAsk — "você tem horário agora. Chegou?"
 *
 * Módulo: `iot_qr_kiosk`.
 *
 * ## Por que isto não é só um atalho no menu
 *
 * O atalho do catálogo leva à tela de chegada — e ninguém abre uma tela de
 * chegada por conta própria. A chegada só existe num instante muito estreito
 * (uma hora antes do jogo até meia hora depois do fim) e para quem está
 * fisicamente na porta da arena. Fora dessa janela o assunto não existe;
 * dentro dela é a única coisa que a pessoa quer fazer.
 *
 * Então o cartão obedece à janela: aparece quando há horário aberto HOJE nesta
 * arena, vira uma confirmação discreta depois que a chegada é registrada, e
 * **não renderiza nada** no resto do tempo — nem caixa cinza, nem explicação
 * de por que não dá.
 */

import React, { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { CheckCircle2, Clock, QrCode } from 'lucide-react';
import { useAuth } from '@/core/lib/FirebaseAuthContext';
import { useMyBookings } from '@/modules/arenas/hooks/useBookings';
import { useArenaModules } from '@/modules/arenas/hooks/useArenaModules';
import { ARENA_MODULE_ID } from '@/modules/arenas/domain/modules';
import { myCheckinBookings, bookingDayWindow, isoDay } from '@/modules/arenas/domain/checkin';
import { V2Button } from '@/v2/ui/primitives';

const hhmm = (min) => `${String(Math.floor(min / 60)).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`;

export default function ArenaCheckinAsk({ arenaId }) {
  const { user } = useAuth();
  const { isOn } = useArenaModules(arenaId);
  const { data: reservas = [], isLoading } = useMyBookings();

  const minhas = useMemo(
    () => myCheckinBookings(reservas, user?.uid, arenaId),
    [reservas, user?.uid, arenaId],
  );

  if (!user?.uid || isLoading || !isOn(ARENA_MODULE_ID.IOT_QR_KIOSK)) return null;

  const aberta = minhas.find((b) => b.checkin.state === 'open');
  const chegou = minhas.find((b) => b.checkin.state === 'checked_in');
  if (!aberta && !chegou) return null;

  if (!aberta && chegou) {
    return (
      <div className="flex items-center gap-2 rounded-2xl border border-green-100 bg-green-50 px-4 py-3 text-sm text-green-800">
        <CheckCircle2 className="h-4 w-4 shrink-0" />
        Chegada confirmada. Bom jogo!
      </div>
    );
  }

  const janela = bookingDayWindow(aberta, isoDay());

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-acid/30 bg-acid/10 px-4 py-3">
      <div className="flex items-center gap-2 text-sm text-ink">
        <Clock className="h-4 w-4 shrink-0 text-ink/60" />
        <span>
          Você tem quadra hoje
          {janela ? <strong> às {hhmm(janela.start)}</strong> : null}. Já chegou?
        </span>
      </div>
      <V2Button size="sm" asChild>
        <Link to={`/arenas/${arenaId}/chegada`}>
          <QrCode className="h-3.5 w-3.5" /> Confirmar chegada
        </Link>
      </V2Button>
    </div>
  );
}
