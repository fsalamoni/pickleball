/**
 * V2ArenaAttendance — a presença do dia, do lado da arena.
 *
 * Rota: `/arenas/:arenaId/gerir/presenca`
 * Módulo: `iot_qr_kiosk` (que depende de `iot`).
 *
 * ## O que não existia
 *
 * O catálogo prometia à arena "presença confirmada sem ninguém no balcão — e
 * **no-show medido de verdade**". Não havia uma linha de código: o único
 * registro de presença da plataforma era o gestor marcando `no_show` numa
 * reserva por vez, depois, de memória — e por isso ninguém marcava. O número
 * de faltas do painel semanal e do CRM saía de um campo que quase nunca era
 * preenchido, o que é pior que não ter número nenhum: parece medido.
 *
 * Aqui a falta é **deduzida** (janela fechada, ninguém confirmou chegada) e a
 * arena confirma **em lote**, num toque. E a presença chega sozinha quando o
 * atleta usa o totem.
 *
 * ## A regra que decidiu o desenho
 *
 * `arena_bookings` já deixa o atleta E o gestor escreverem na reserva. Então a
 * chegada é um campo aditivo ali — **zero coleção nova, zero regra nova**.
 */

import React, { useMemo, useState } from 'react';
import { Link, Navigate, useParams } from 'react-router-dom';
import { toast } from 'sonner';
import {
  ArrowLeft, Check, Clock, Monitor, QrCode, RotateCcw, UserCheck, UserX, Users,
} from 'lucide-react';
import { useAuth } from '@/core/lib/FirebaseAuthContext';
import { useArena, useMyManagedArenas } from '@/modules/arenas/hooks/useArenas';
import { useArenaBookings } from '@/modules/arenas/hooks/useBookings';
import { useArenaModules } from '@/modules/arenas/hooks/useArenaModules';
import { ARENA_MODULE_ID } from '@/modules/arenas/domain/modules';
import {
  useConfirmArrival, useUndoArrival, useMarkNoShowBatch,
} from '@/modules/arenas/hooks/useCheckin';
import { attendanceOfDay, isoDay, noShowCandidates } from '@/modules/arenas/domain/checkin';
import { formatDateShortBR } from '@/modules/arenas/domain/calendar';
import ConfirmDialog from '@/components/ConfirmDialog';
import {
  V2Avatar, V2Badge, V2Button, V2EmptyState, V2Field, V2Input, V2Skeleton,
  V2StatCard, V2Surface,
} from '@/v2/ui/primitives';

const hhmm = (min) => `${String(Math.floor(min / 60)).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`;

const SITUACAO = {
  presente: { label: 'Chegou', tone: 'green' },
  faltou: { label: 'Não veio', tone: 'red' },
  aguardando: { label: 'Aguardando', tone: 'neutral' },
};

function LinhaPresenca({ linha, onConfirmar, onDesfazer, ocupado }) {
  const b = linha.booking;
  const meta = SITUACAO[linha.situacao];
  const porTotem = b.checked_in_by === 'athlete';

  return (
    <div className="flex flex-wrap items-center gap-3 border-b border-gray-100 py-3 last:border-0">
      <V2Avatar name={b.athlete_name || 'Reserva'} photoUrl={b.athlete_photo} size="sm" />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-bold text-ink">{b.athlete_name || 'Reserva da arena'}</p>
        <p className="flex flex-wrap items-center gap-x-2 text-xs text-gray-500">
          <span className="inline-flex items-center gap-1">
            <Clock className="h-3 w-3" /> {hhmm(linha.start)}–{hhmm(linha.end)}
          </span>
          {b.court_name && <span>· {b.court_name}</span>}
          {linha.situacao === 'presente' && (
            <span className={porTotem ? 'text-green-700' : 'text-gray-500'}>
              · {porTotem ? 'pelo totem' : 'confirmado na recepção'}
            </span>
          )}
        </p>
      </div>
      <V2Badge tone={meta.tone}>{meta.label}</V2Badge>
      {linha.situacao === 'presente' ? (
        <V2Button variant="ghost" size="sm" disabled={ocupado} onClick={() => onDesfazer(b)}>
          <RotateCcw className="h-3.5 w-3.5" /> Desfazer
        </V2Button>
      ) : (
        <V2Button variant="secondary" size="sm" disabled={ocupado} onClick={() => onConfirmar(b)}>
          <UserCheck className="h-3.5 w-3.5" /> Chegou
        </V2Button>
      )}
    </div>
  );
}

export default function V2ArenaAttendance() {
  const { arenaId } = useParams();
  const { user } = useAuth();
  const { data: arena, isLoading } = useArena(arenaId);
  const { data: minhas = [] } = useMyManagedArenas();
  const { isOn, isLoading: modulosCarregando } = useArenaModules(arenaId);
  const { data: reservas = [], isLoading: rvCarregando } = useArenaBookings(arenaId);

  const [dia, setDia] = useState(() => isoDay());
  const confirmar = useConfirmArrival();
  const desfazer = useUndoArrival();
  const emLote = useMarkNoShowBatch();

  const resumo = useMemo(() => attendanceOfDay(reservas, dia), [reservas, dia]);
  const pendentes = useMemo(() => noShowCandidates(reservas, dia), [reservas, dia]);

  if (isLoading || modulosCarregando) {
    return <div className="mx-auto max-w-4xl px-4 py-8"><V2Skeleton lines={6} /></div>;
  }
  if (!arena) return <Navigate to="/arenas" replace />;

  const podeGerir = arena.owner_id === user?.uid
    || (arena.manager_ids || []).includes(user?.uid)
    || minhas.some((a) => a.id === arena.id);

  if (!podeGerir || !isOn(ARENA_MODULE_ID.IOT_QR_KIOSK)) {
    return <Navigate to={`/arenas/${arenaId}`} replace />;
  }

  const acao = async (fn, msgOk) => {
    try {
      await fn();
      toast.success(msgOk);
    } catch (err) {
      toast.error(err?.message || 'Não foi possível concluir.');
    }
  };

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <div className="mb-6">
        <Link to={`/arenas/${arena.id}/gerir`} className="mb-3 inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-gray-500 hover:text-ink">
          <ArrowLeft className="h-3.5 w-3.5" /> Voltar para a gestão
        </Link>
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="font-display text-3xl font-bold tracking-tight text-ink">Presença</h1>
            <p className="mt-2 font-medium text-gray-500">
              {arena.name} · quem chegou, quem não veio.
            </p>
          </div>
          <V2Button asChild>
            <Link to={`/arenas/${arena.id}/totem`} target="_blank" rel="noreferrer">
              <Monitor className="h-4 w-4" /> Abrir o totem
            </Link>
          </V2Button>
        </div>
      </div>

      <V2Surface className="mb-6">
        <div className="flex flex-wrap items-end gap-3">
          <V2Field label="Dia" htmlFor="dia-presenca" className="w-44">
            <V2Input id="dia-presenca" type="date" value={dia} onChange={(e) => setDia(e.target.value || isoDay())} />
          </V2Field>
          <p className="pb-2 text-xs text-gray-500">
            {formatDateShortBR(dia)} · {resumo.total} {resumo.total === 1 ? 'reserva confirmada' : 'reservas confirmadas'}
          </p>
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <V2StatCard icon={UserCheck} label="Chegaram" value={resumo.presentes} accent="green" />
          <V2StatCard icon={UserX} label="Não vieram" value={resumo.faltas} />
          <V2StatCard icon={Clock} label="Aguardando" value={resumo.aguardando} />
          <V2StatCard
            icon={Users}
            label="Taxa de falta"
            value={`${resumo.taxaFalta}%`}
            hint="Sobre o que já foi decidido no dia"
          />
        </div>
      </V2Surface>

      {pendentes.length > 0 && (
        <V2Surface className="mb-6 border-amber-200 bg-amber-50">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm font-bold text-ink">
                {pendentes.length} {pendentes.length === 1 ? 'horário passou sem ninguém confirmar chegada' : 'horários passaram sem ninguém confirmar chegada'}
              </p>
              <p className="text-xs text-gray-600">
                Marcar como falta alimenta o painel semanal e a ficha do cliente. Você pode
                desfazer depois.
              </p>
            </div>
            <ConfirmDialog
              trigger={(
                <V2Button variant="secondary" size="sm" disabled={emLote.isPending}>
                  <UserX className="h-3.5 w-3.5" /> Marcar {pendentes.length} como falta
                </V2Button>
              )}
              title="Marcar as faltas do dia?"
              description={`${pendentes.length} reserva(s) sem chegada confirmada serão marcadas como não comparecimento.`}
              confirmLabel="Marcar faltas"
              onConfirm={() => acao(
                () => emLote.mutateAsync({ bookings: pendentes, arenaId: arena.id }),
                'Faltas registradas.',
              )}
            />
          </div>
        </V2Surface>
      )}

      <V2Surface>
        <h2 className="mb-1 font-display text-lg font-bold text-ink">O dia, horário a horário</h2>
        {rvCarregando ? (
          <V2Skeleton lines={4} />
        ) : resumo.linhas.length === 0 ? (
          <V2EmptyState
            icon={QrCode}
            title="Nenhuma reserva confirmada neste dia"
            description="A presença aparece aqui assim que houver reserva confirmada para a data escolhida."
          />
        ) : (
          <div>
            {resumo.linhas.map((linha) => (
              <LinhaPresenca
                key={linha.id}
                linha={linha}
                ocupado={confirmar.isPending || desfazer.isPending}
                onConfirmar={(b) => acao(() => confirmar.mutateAsync({ booking: b }), 'Chegada confirmada.')}
                onDesfazer={(b) => acao(() => desfazer.mutateAsync({ booking: b }), 'Chegada desfeita.')}
              />
            ))}
          </div>
        )}
      </V2Surface>

      <p className="mt-6 flex items-start gap-2 rounded-2xl bg-paper p-4 text-xs leading-5 text-gray-500">
        <Check className="mt-0.5 h-3.5 w-3.5 shrink-0" />
        A falta só é afirmada <strong className="text-ink">depois que a janela fecha</strong> (o
        horário mais 30 minutos). Enquanto ela está aberta, a pessoa ainda pode estar
        estacionando — e cobrar multa de quem chegou no horário é o tipo de erro que custa o
        cliente, não a reserva.
      </p>
    </div>
  );
}
