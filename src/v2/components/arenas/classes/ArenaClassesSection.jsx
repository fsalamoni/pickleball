/**
 * "Aulas e professores" — a seção da página da arena (módulo `classes`).
 *
 * Antes, as aulas eram um BOTÃO de atalho no topo da página, que levava a
 * outra tela; e os professores parceiros eram uma seção à parte, sem ligação
 * com as aulas. Agora é uma seção só, no fluxo da página:
 *
 * - as **próximas aulas com vaga**, com a matrícula ali mesmo;
 * - os **professores** — parceiros da plataforma (com link para o perfil) e
 *   quem dá aula na agenda, numa lista só (`publicCoachRoster`);
 * - para quem DÁ aula aqui, o caminho curto para a própria agenda.
 *
 * Sem aula marcada e sem professor, a seção não aparece: uma caixa vazia no
 * meio da página não ajuda ninguém. Sem login, as aulas não são lidas (a
 * regra exige conta) — aparecem os parceiros e o convite para entrar.
 */
import React, { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import { ArrowRight, CalendarCheck, GraduationCap, Users } from 'lucide-react';
import { useAuth } from '@/core/lib/FirebaseAuthContext';
import {
  useArenaCoaches as useArenaPartnerCoaches,
} from '@/modules/coaches/hooks/useCoaches';
import {
  useArenaCoaches as useArenaClassCoaches, useArenaClasses, useBookClass,
  useMyClassBookings, useMyCoachProfiles,
} from '@/modules/arenas/hooks/useArenaV3';
import { mergeCoachRoster, publicCoachRoster } from '@/modules/arenas/domain/coachRoster';
import { nextOpenClasses } from '@/modules/arenas/domain/classAgenda';
import {
  CLASS_FORMAT, CLASS_FORMAT_META, COACH_LEVEL, COACH_LEVEL_META, classSeatsLeft,
} from '@/modules/arenas/domain/classes';
import { formatPrice } from '@/modules/arenas/domain/pricing';
import { formatDateShortBR } from '@/modules/arenas/domain/calendar';
import { todayISO } from '@/modules/arenas/domain/subscription';
import { V2Avatar, V2Badge, V2Button, V2Surface } from '@/v2/ui/primitives';

function ProximaAula({ aula, arenaId, matriculado, isAuthenticated }) {
  const matricular = useBookClass();
  const vagas = classSeatsLeft(aula);
  const formato = CLASS_FORMAT_META[aula.format] || CLASS_FORMAT_META[CLASS_FORMAT.GROUP];
  const nivel = COACH_LEVEL_META[aula.level] || COACH_LEVEL_META[COACH_LEVEL.BEGINNER];
  return (
    <li className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-gray-100 bg-paper p-3">
      <div className="min-w-0">
        <p className="text-sm font-bold text-ink">
          {formatDateShortBR(aula.date)} · {aula.start}–{aula.end}
        </p>
        <p className="mt-0.5 text-xs text-gray-500">
          {aula.coach_name || 'Professor a definir'} · {formato.label} · {nivel.label}
        </p>
        <p className="mt-0.5 flex items-center gap-1 text-xs text-gray-500">
          <Users className="h-3 w-3" /> {vagas > 0 ? `${vagas} vaga(s)` : 'lotada'} ·{' '}
          <strong className="text-ink">{formatPrice(aula.price)}</strong>
        </p>
      </div>
      {matriculado ? (
        <V2Badge tone="green">Você está nesta aula</V2Badge>
      ) : isAuthenticated ? (
        <V2Button
          size="sm"
          disabled={vagas <= 0 || matricular.isPending}
          onClick={() => matricular.mutateAsync({ arenaId, classId: aula.id })
            .then(() => toast.success('Matrícula feita! Combine o pagamento com a arena.'))
            .catch((e) => toast.error(e?.message || 'Não foi possível matricular.'))}
        >
          {vagas <= 0 ? 'Lotada' : 'Matricular-me'}
        </V2Button>
      ) : null}
    </li>
  );
}

export default function ArenaClassesSection({ arena }) {
  const arenaId = arena.id;
  const { isAuthenticated } = useAuth();
  const parceirosQ = useArenaPartnerCoaches(arenaId);
  // `arena_coaches` e `arena_classes` exigem conta para ler: sem login, a
  // consulta nem sai (falharia, e a falha viraria "nenhuma aula").
  const paraQuem = isAuthenticated ? arenaId : null;
  const { data: professoresDasAulas = [] } = useArenaClassCoaches(paraQuem);
  const { data: aulas = [] } = useArenaClasses(paraQuem);
  const { data: minhas = [] } = useMyClassBookings(paraQuem);
  const { data: meusPerfis = [] } = useMyCoachProfiles();

  const hoje = todayISO();
  const proximas = useMemo(() => nextOpenClasses(aulas, { hoje, limit: 3 }), [aulas, hoje]);
  const professores = useMemo(
    () => publicCoachRoster(mergeCoachRoster(parceirosQ.data || [], professoresDasAulas)).slice(0, 6),
    [parceirosQ.data, professoresDasAulas],
  );
  const matriculadas = useMemo(() => new Set(minhas.map((b) => b.class_id)), [minhas]);
  const souProfessorAqui = meusPerfis.some((p) => p.arena_id === arenaId && p.active !== false);

  if (proximas.length === 0 && professores.length === 0 && !souProfessorAqui) return null;

  const agenda = `/arenas/${arenaId}/aulas`;

  return (
    <V2Surface>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="flex items-center gap-1.5 font-display text-base font-bold text-ink">
          <GraduationCap className="h-4 w-4" /> Aulas e professores
        </h3>
        <Link to={agenda} className="inline-flex items-center gap-1 text-xs font-bold text-ink hover:underline">
          Ver agenda completa <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </div>

      {souProfessorAqui && (
        <Link
          to={agenda}
          className="mt-3 flex items-center justify-between gap-2 rounded-2xl bg-ink px-4 py-3 text-sm font-bold text-acid hover:bg-ink/90"
        >
          <span className="inline-flex items-center gap-2"><CalendarCheck className="h-4 w-4" /> Você dá aula aqui — ver sua agenda e seus alunos</span>
          <ArrowRight className="h-4 w-4" />
        </Link>
      )}

      {proximas.length > 0 && (
        <>
          <p className="mt-4 text-xs font-bold uppercase tracking-wider text-gray-500">Próximas aulas</p>
          <ul className="mt-2 space-y-2">
            {proximas.map((a) => (
              <ProximaAula key={a.id} aula={a} arenaId={arenaId}
                matriculado={matriculadas.has(a.id)} isAuthenticated={isAuthenticated} />
            ))}
          </ul>
        </>
      )}

      {!isAuthenticated && (
        <p className="mt-3 text-sm text-gray-500">
          <Link to="/entrar" className="font-bold text-ink underline">Entre</Link> para ver os horários e se matricular.
        </p>
      )}

      {professores.length > 0 && (
        <>
          <p className="mt-4 text-xs font-bold uppercase tracking-wider text-gray-500">Professores</p>
          <div className="mt-2 grid gap-2 sm:grid-cols-2">
            {professores.map((p) => {
              const conteudo = (
                <>
                  <V2Avatar photoUrl={p.photo} name={p.name} size="sm" />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-bold text-ink line-clamp-1">{p.name}</p>
                    <p className="text-xs text-gray-500 line-clamp-1">
                      {p.teaches ? 'Dá aula na agenda da arena' : 'Professor parceiro'}
                      {p.partner?.modalities?.length > 0 ? ` · ${p.partner.modalities.join(' · ')}` : ''}
                    </p>
                  </div>
                </>
              );
              return p.profileLink ? (
                <Link key={p.key} to={p.profileLink}
                  className="flex items-center gap-3 rounded-2xl border border-gray-100 bg-paper p-3 transition-colors hover:border-ink/30">
                  {conteudo}
                </Link>
              ) : (
                <div key={p.key} className="flex items-center gap-3 rounded-2xl border border-gray-100 bg-paper p-3">
                  {conteudo}
                </div>
              );
            })}
          </div>
        </>
      )}
    </V2Surface>
  );
}
