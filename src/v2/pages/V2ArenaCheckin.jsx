/**
 * V2ArenaCheckin — "cheguei".
 *
 * Rota: `/arenas/:arenaId/chegada` (é o destino do QR do totem, que já traz o
 * aparelho e o código na URL). Módulo: `iot_qr_kiosk`.
 *
 * ## O caminho curto é o que importa
 *
 * A promessa do catálogo ao atleta é de sete palavras: *"chegou, apontou a
 * câmera, entrou"*. Então quando a pessoa chega por QR **e tem um único
 * horário aberto**, a chegada é confirmada sozinha, sem toque nenhum: a tela
 * abre já dizendo que deu certo. Pedir um "confirmar" ali seria transformar um
 * gesto em dois para não ganhar nada — a pessoa que apontou a câmera para o
 * totem da recepção já disse tudo o que tinha a dizer.
 *
 * Com mais de um horário aberto (a pessoa reservou duas quadras, ou é a
 * segunda partida do dia), a escolha é dela — confirmar a reserva errada
 * deixaria a certa contando como falta.
 *
 * Sem QR (quem abriu o aplicativo pelo menu), o código de cinco caracteres do
 * totem é digitado aqui. O alfabeto do código não tem `0/O` nem `1/I/L`, para
 * ninguém ficar decidindo em pé se aquilo é um zero.
 */

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link, Navigate, useParams, useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import {
  ArrowLeft, CalendarClock, CheckCircle2, Clock, Loader2, QrCode,
} from 'lucide-react';
import { useAuth } from '@/core/lib/FirebaseAuthContext';
import { useArena } from '@/modules/arenas/hooks/useArenas';
import { useMyBookings } from '@/modules/arenas/hooks/useBookings';
import { useArenaModules } from '@/modules/arenas/hooks/useArenaModules';
import { ARENA_MODULE_ID } from '@/modules/arenas/domain/modules';
import { useCheckInBooking } from '@/modules/arenas/hooks/useCheckin';
import {
  myCheckinBookings, checkinBlockedReason, KIOSK_CODE_LEN, bookingDayWindow, isoDay,
} from '@/modules/arenas/domain/checkin';
import { formatDateShortBR } from '@/modules/arenas/domain/calendar';
import {
  V2Badge, V2Button, V2EmptyState, V2Field, V2Input, V2Skeleton, V2Surface,
} from '@/v2/ui/primitives';

const hhmm = (min) => `${String(Math.floor(min / 60)).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`;

function CartaoReserva({ booking, selecionado, onSelecionar, unica }) {
  const janela = bookingDayWindow(booking, isoDay());
  const chegou = booking.checkin?.state === 'checked_in';
  const bloqueio = booking.checkin?.state === 'early'
    ? checkinBlockedReason('early', booking.checkin.minutesToStart)
    : '';

  return (
    <button
      type="button"
      disabled={chegou || Boolean(bloqueio) || unica}
      onClick={() => onSelecionar(booking.id)}
      className={`w-full rounded-2xl border p-4 text-left transition ${
        selecionado ? 'border-ink bg-paper' : 'border-gray-100 bg-paper-pure hover:border-gray-200'
      } ${chegou || bloqueio ? 'opacity-70' : ''} ${unica ? 'cursor-default' : ''}`}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="flex items-center gap-1.5 font-display text-lg font-bold text-ink">
          <Clock className="h-4 w-4 text-gray-400" />
          {janela ? `${hhmm(janela.start)}–${hhmm(janela.end)}` : '—'}
        </p>
        {chegou && <V2Badge tone="green">Chegada confirmada</V2Badge>}
      </div>
      <p className="mt-1 text-xs text-gray-500">
        {booking.court_name ? `${booking.court_name} · ` : ''}
        {formatDateShortBR(isoDay())}
      </p>
      {bloqueio && <p className="mt-2 text-xs text-amber-700">{bloqueio}</p>}
    </button>
  );
}

export default function V2ArenaCheckin() {
  const { arenaId } = useParams();
  const [params] = useSearchParams();
  const { user } = useAuth();
  const { data: arena, isLoading } = useArena(arenaId);
  const { isOn, isLoading: modulosCarregando } = useArenaModules(arenaId);
  const { data: reservas = [], isLoading: rvCarregando } = useMyBookings();
  const checkin = useCheckInBooking();

  const deviceId = params.get('d') || '';
  const codigoDoQr = (params.get('c') || '').toUpperCase();

  const [codigo, setCodigo] = useState(codigoDoQr);
  const [escolhida, setEscolhida] = useState('');
  const [pronto, setPronto] = useState(false);
  const automaticoRef = useRef(false);

  const minhas = useMemo(
    () => myCheckinBookings(reservas, user?.uid, arenaId),
    [reservas, user?.uid, arenaId],
  );
  const abertas = useMemo(() => minhas.filter((b) => b.checkin.state === 'open'), [minhas]);
  const jaChegou = useMemo(() => minhas.some((b) => b.checkin.state === 'checked_in'), [minhas]);

  const alvo = useMemo(() => {
    if (escolhida) return abertas.find((b) => b.id === escolhida) || null;
    return abertas.length === 1 ? abertas[0] : null;
  }, [escolhida, abertas]);

  const confirmar = async (booking, code) => {
    try {
      await checkin.mutateAsync({ booking, deviceId: deviceId || undefined, code });
      setPronto(true);
    } catch (err) {
      toast.error(err?.message || 'Não foi possível confirmar sua chegada.');
      throw err;
    }
  };

  /* --- veio pelo QR e só tem um horário: confirma sozinho ---------------- */
  useEffect(() => {
    if (automaticoRef.current) return;
    if (!codigoDoQr || rvCarregando || abertas.length !== 1) return;
    automaticoRef.current = true;
    confirmar(abertas[0], codigoDoQr).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [codigoDoQr, rvCarregando, abertas.length]);

  if (isLoading || modulosCarregando) {
    return <div className="mx-auto max-w-lg px-4 py-10"><V2Skeleton lines={5} /></div>;
  }
  if (!arena) return <Navigate to="/arenas" replace />;
  if (!isOn(ARENA_MODULE_ID.IOT_QR_KIOSK)) return <Navigate to={`/arenas/${arenaId}`} replace />;

  /* --- deu certo --------------------------------------------------------- */
  if (pronto || (jaChegou && abertas.length === 0)) {
    return (
      <div className="mx-auto max-w-lg px-4 py-16 text-center">
        <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-green-50">
          <CheckCircle2 className="h-10 w-10 text-green-600" />
        </div>
        <h1 className="mt-6 font-display text-3xl font-bold tracking-tight text-ink">
          Chegada confirmada
        </h1>
        <p className="mt-2 text-gray-500">
          Bom jogo em {arena.name}. A recepção já sabe que você está aqui.
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <V2Button asChild>
            <Link to={`/arenas/${arenaId}`}>Ver a arena</Link>
          </V2Button>
          <V2Button variant="ghost" asChild>
            <Link to="/minhas-reservas">Minhas reservas</Link>
          </V2Button>
        </div>
      </div>
    );
  }

  const carregandoAutomatico = Boolean(codigoDoQr) && rvCarregando;

  return (
    <div className="mx-auto max-w-lg px-4 py-8">
      <Link to={`/arenas/${arenaId}`} className="mb-3 inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-gray-500 hover:text-ink">
        <ArrowLeft className="h-3.5 w-3.5" /> {arena.name}
      </Link>
      <h1 className="font-display text-3xl font-bold tracking-tight text-ink">Chegada</h1>
      <p className="mt-2 font-medium text-gray-500">
        Confirme sua presença com o código do totem da recepção.
      </p>

      {carregandoAutomatico ? (
        <V2Surface className="mt-6 flex items-center gap-3">
          <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
          <p className="text-sm text-gray-600">Procurando a sua reserva de hoje…</p>
        </V2Surface>
      ) : minhas.length === 0 ? (
        <V2Surface className="mt-6">
          <V2EmptyState
            icon={CalendarClock}
            title="Você não tem horário aqui hoje"
            description="A chegada só pode ser confirmada no dia da reserva, a partir de uma hora antes do horário."
            action={(
              <Link to={`/arenas/${arenaId}`} className="text-sm font-bold text-ink underline">
                Ver os horários da arena
              </Link>
            )}
          />
        </V2Surface>
      ) : (
        <>
          <div className="mt-6 space-y-3">
            {minhas.map((b) => (
              <CartaoReserva
                key={b.id}
                booking={b}
                unica={abertas.length === 1 && b.checkin.state === 'open'}
                selecionado={alvo?.id === b.id}
                onSelecionar={setEscolhida}
              />
            ))}
          </div>

          {abertas.length > 1 && !escolhida && (
            <p className="mt-3 text-xs text-gray-500">
              Você tem mais de um horário agora. Toque no que você veio jogar.
            </p>
          )}

          {abertas.length > 0 && (
            <V2Surface className="mt-6">
              <V2Field
                label="Código do totem"
                htmlFor="codigo-totem"
                hint={`${KIOSK_CODE_LEN} caracteres, na tela da recepção. Ele muda a cada minuto e meio.`}
              >
                <V2Input
                  id="codigo-totem"
                  value={codigo}
                  onChange={(e) => setCodigo(e.target.value.toUpperCase().slice(0, KIOSK_CODE_LEN + 2))}
                  placeholder="A2B4C"
                  autoCapitalize="characters"
                  autoComplete="off"
                  spellCheck={false}
                  className="text-center font-display text-2xl font-bold tracking-[0.4em]"
                />
              </V2Field>
              <V2Button
                className="mt-4 w-full"
                disabled={!alvo || codigo.trim().length < KIOSK_CODE_LEN || checkin.isPending}
                onClick={() => confirmar(alvo, codigo).catch(() => {})}
              >
                {checkin.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <QrCode className="h-4 w-4" />}
                Confirmar minha chegada
              </V2Button>
            </V2Surface>
          )}
        </>
      )}

      <p className="mt-6 text-xs leading-5 text-gray-400">
        A confirmação vale só para o seu horário, e é o que faz a arena saber que a quadra
        está em uso. Esqueceu de confirmar? A recepção resolve na hora.
      </p>
    </div>
  );
}
