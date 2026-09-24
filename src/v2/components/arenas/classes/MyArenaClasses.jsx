/**
 * As aulas das ARENAS no lado da pessoa — fora da página da arena.
 *
 * Antes, a matrícula numa aula de arena só aparecia dentro de
 * `/arenas/:id/aulas`: quem se matriculava em duas arenas tinha de lembrar de
 * abrir as duas. E o professor da arena não via as aulas dela no próprio
 * painel (`/aulas`). Aqui:
 *
 * - `MyArenaEnrollments` — em "Minhas aulas" (`/minhas-aulas`): as matrículas
 *   de todas as arenas, a próxima primeiro;
 * - `MyTaughtArenaClasses` — no painel do professor (`/aulas`): as aulas que
 *   ele dá em cada arena, com quantos alunos.
 *
 * Os dois somem quando não há nada: quem nunca fez aula em arena não vê uma
 * caixa vazia a mais.
 */
import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Building2, CalendarDays, Users } from 'lucide-react';
import { useMyClassEnrollments, useMyTaughtClasses } from '@/modules/arenas/hooks/useArenaV3';
import { enrollmentRows, taughtClassRows } from '@/modules/arenas/domain/classAgenda';
import { formatDateShortBR } from '@/modules/arenas/domain/calendar';
import { todayISO } from '@/modules/arenas/domain/subscription';
import { V2Badge, V2Button, V2Surface } from '@/v2/ui/primitives';

const porId = (lista = []) => new Map(lista.map((x) => [x.id, x]));

function LinhaDeAula({ aula, arenaId, arenaName, children }) {
  return (
    <Link
      to={`/arenas/${arenaId}/aulas`}
      className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-gray-100 bg-paper p-3 transition-colors hover:border-ink/30"
    >
      <div className="min-w-0">
        <p className="flex items-center gap-1.5 text-sm font-bold text-ink">
          <CalendarDays className="h-3.5 w-3.5 text-gray-400" />
          {formatDateShortBR(aula.date)} · {aula.start}–{aula.end}
        </p>
        <p className="mt-0.5 flex items-center gap-1 text-xs text-gray-500">
          <Building2 className="h-3 w-3" /> {arenaName}
          {aula.coach_name ? ` · ${aula.coach_name}` : ''}
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-1.5">{children}</div>
    </Link>
  );
}

/** "Minhas aulas": as matrículas em aula de arena. */
export function MyArenaEnrollments() {
  const { data, isLoading } = useMyClassEnrollments();
  const [verTodas, setVerTodas] = useState(false);
  const hoje = todayISO();
  const linhas = useMemo(() => enrollmentRows(
    data?.bookings || [], porId(data?.aulas), porId(data?.arenas), hoje,
  ), [data, hoje]);

  if (isLoading || linhas.length === 0) return null;
  const vindo = linhas.filter((l) => l.upcoming);
  const foi = linhas.filter((l) => !l.upcoming);
  const passadasVisiveis = verTodas ? foi : foi.slice(0, 3);

  return (
    <V2Surface>
      <h2 className="mb-1 font-display text-lg font-bold text-ink">Aulas nas arenas</h2>
      <p className="mb-4 text-sm text-gray-500">As aulas da agenda das arenas em que você se matriculou.</p>
      {vindo.length === 0 && (
        <p className="mb-3 text-sm text-gray-500">Nenhuma aula marcada daqui para a frente.</p>
      )}
      <div className="space-y-2">
        {vindo.map((l) => (
          <LinhaDeAula key={l.key} aula={l.aula} arenaId={l.arenaId} arenaName={l.arenaName}>
            {l.cancelled
              ? <V2Badge tone="red">Cancelada</V2Badge>
              : <V2Badge tone={l.booking.paid ? 'green' : 'amber'}>{l.booking.paid ? 'Pago' : 'Pagar na arena'}</V2Badge>}
          </LinhaDeAula>
        ))}
      </div>
      {foi.length > 0 && (
        <>
          <p className="mb-2 mt-5 text-xs font-bold uppercase tracking-wider text-gray-500">Já aconteceram</p>
          <div className="space-y-2">
            {passadasVisiveis.map((l) => (
              <LinhaDeAula key={l.key} aula={l.aula} arenaId={l.arenaId} arenaName={l.arenaName}>
                {l.cancelled ? <V2Badge tone="neutral">Cancelada</V2Badge> : <V2Badge tone="neutral">Feita</V2Badge>}
              </LinhaDeAula>
            ))}
          </div>
          {foi.length > 3 && (
            <V2Button size="sm" variant="ghost" className="mt-2" onClick={() => setVerTodas((v) => !v)}>
              {verTodas ? 'Mostrar menos' : `Ver todas (${foi.length})`}
            </V2Button>
          )}
        </>
      )}
    </V2Surface>
  );
}

/** Painel do professor: as aulas que ele DÁ nas arenas. */
export function MyTaughtArenaClasses() {
  const { data, isLoading } = useMyTaughtClasses();
  const hoje = todayISO();
  const { proximas, passadas } = useMemo(() => taughtClassRows(
    data?.perfis || [],
    new Map(Object.entries(data?.aulasPorPerfil || {})),
    porId(data?.arenas),
    hoje,
  ), [data, hoje]);

  if (isLoading || !data?.perfis?.length) return null;
  const arenas = [...new Map((data.perfis || []).map((p) => [p.arena_id, porId(data.arenas).get(p.arena_id)?.name || 'Arena'])).entries()];

  return (
    <V2Surface>
      <h2 className="mb-1 font-display text-lg font-bold text-ink">Aulas que você dá nas arenas</h2>
      <p className="mb-4 text-sm text-gray-500">
        A agenda que as arenas marcaram com você. Toque numa aula para ver os alunos.
      </p>
      {proximas.length === 0 ? (
        <p className="text-sm text-gray-500">Nenhuma aula marcada daqui para a frente.</p>
      ) : (
        <div className="space-y-2">
          {proximas.slice(0, 10).map((l) => (
            <LinhaDeAula key={l.key} aula={l.aula} arenaId={l.arenaId} arenaName={l.arenaName}>
              <V2Badge tone="neutral">
                <Users className="mr-1 inline h-3 w-3" />
                {Number(l.aula.enrolled) || 0}/{Number(l.aula.max_students) || 0}
              </V2Badge>
            </LinhaDeAula>
          ))}
        </div>
      )}
      <div className="mt-4 flex flex-wrap gap-2 text-xs text-gray-500">
        {passadas.filter((l) => l.given).length > 0 && (
          <span>{passadas.filter((l) => l.given).length} aula(s) dada(s)</span>
        )}
        {arenas.map(([id, nome]) => (
          <Link key={id} to={`/arenas/${id}/aulas`} className="font-bold text-ink hover:underline">
            Agenda em {nome} →
          </Link>
        ))}
      </div>
    </V2Surface>
  );
}
