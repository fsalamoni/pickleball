/**
 * V2ArenaClasses — as aulas da arena, para quem vai TER ou DAR aula.
 *
 * Rotas: `/arenas/:arenaId/aulas` (atleta e professor) ·
 *        `/arenas/:arenaId/gerir/aulas` (antiga tela da arena — agora leva à
 *        Central, seção Aulas; a rota fica porque notificações e links antigos
 *        apontam para ela)
 * Módulos: `classes` (+ `classes_catalog`, `classes_packages`,
 * `classes_marketplace`).
 *
 * ## Uma tela, três pessoas
 *
 * | Quem | O que vê primeiro |
 * |---|---|
 * | **Atleta** | as aulas em que dá para se matricular, e as suas |
 * | **Professor** | a agenda DELE nesta arena, com os alunos de cada aula |
 * | **Arena** | a agenda inteira — mas o lugar dela é a Central (Aulas) |
 *
 * O corpo da agenda é `ArenaClassesPanel`, o MESMO da Central: a arena e o
 * atleta olham para a mesma coisa, cada um com os poderes que tem.
 *
 * ## 🐞 O defeito que ninguém via
 *
 * A matrícula **nunca funcionou** até a Onda AL: a regra exige `user_id` e o
 * serviço gravava `athlete_id`. Ver `classesService.js`.
 */

import React, { useMemo } from 'react';
import { Link, Navigate, useMatch, useParams } from 'react-router-dom';
import { ArrowLeft, GraduationCap, Settings2 } from 'lucide-react';
import { useAuth } from '@/core/lib/FirebaseAuthContext';
import { useArena, useMyManagedArenas } from '@/modules/arenas/hooks/useArenas';
import { useArenaCoaches, useMyCoachProfiles } from '@/modules/arenas/hooks/useArenaV3';
import { useArenaModules } from '@/modules/arenas/hooks/useArenaModules';
import { ARENA_MODULE_ID } from '@/modules/arenas/domain/modules';
import { COACH_LEVEL, COACH_LEVEL_META } from '@/modules/arenas/domain/classes';
import { formatPrice } from '@/modules/arenas/domain/pricing';
import ArenaClassesPanel from '@/v2/components/arenas/classes/ArenaClassesPanel';
import {
  V2Avatar, V2Badge, V2Button, V2Skeleton, V2Surface,
} from '@/v2/ui/primitives';

/** A vitrine dos professores da arena (módulo `classes_catalog`). */
function VitrineDeProfessores({ arenaId }) {
  const { data: coaches = [] } = useArenaCoaches(arenaId);
  if (coaches.length === 0) return null;
  return (
    <V2Surface className="mb-6">
      <div className="mb-4 flex items-center gap-2">
        <GraduationCap className="h-5 w-5 text-ink" />
        <h2 className="font-display text-lg font-bold text-ink">Professores</h2>
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        {coaches.map((c) => {
          const nivel = COACH_LEVEL_META[c.level] || COACH_LEVEL_META[COACH_LEVEL.INTERMEDIATE];
          return (
            <div key={c.id} className="rounded-2xl border border-gray-100 bg-paper p-3">
              <div className="flex items-start gap-3">
                <V2Avatar photoUrl={c.photo_url} name={c.name} size="md" />
                <div className="min-w-0 flex-1">
                  <p className="font-display text-base font-bold text-ink">{c.name}</p>
                  <div className="mt-0.5 flex flex-wrap gap-1.5">
                    <V2Badge tone="neutral">{nivel.label}</V2Badge>
                    {Number(c.price_per_hour) > 0 && (
                      <V2Badge tone="acid">{formatPrice(c.price_per_hour)}/h</V2Badge>
                    )}
                  </div>
                  {c.bio && <p className="mt-2 text-sm leading-6 text-gray-600">{c.bio}</p>}
                  {Number(c.sessions_given) > 0 && (
                    <p className="mt-1 text-xs text-gray-500">{c.sessions_given} aula(s) dada(s) aqui</p>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </V2Surface>
  );
}

export default function V2ArenaClasses() {
  const { arenaId } = useParams();
  const naGestao = useMatch('/arenas/:arenaId/gerir/aulas');
  const { user, isPlatformAdmin } = useAuth();
  const { data: arena, isLoading } = useArena(arenaId);
  const { data: managed = [] } = useMyManagedArenas();
  const { isOn, isLoading: modulosCarregando } = useArenaModules(arenaId);
  const { data: meusPerfis = [] } = useMyCoachProfiles();

  // Sou professor NESTA arena? É o vínculo `user_id` que responde.
  const meuPerfilDeProfessor = useMemo(
    () => meusPerfis.find((p) => p.arena_id === arenaId && p.active !== false) || null,
    [meusPerfis, arenaId],
  );

  // A gestão das aulas mora na Central. O endereço antigo continua valendo.
  if (naGestao) return <Navigate to={`/arenas/${arenaId}/gerir?aba=aulas`} replace />;

  if (isLoading || modulosCarregando) {
    return <V2Skeleton className="mx-auto h-96 max-w-[1000px] rounded-4xl" />;
  }
  if (!arena) return <Navigate to="/arenas" replace />;
  if (!isOn(ARENA_MODULE_ID.CLASSES)) return <Navigate to={`/arenas/${arenaId}`} replace />;

  const podeGerir = arena.owner_id === user?.uid
    || managed.some((m) => m.id === arena.id)
    || isPlatformAdmin;
  const temCatalogo = isOn(ARENA_MODULE_ID.CLASSES_CATALOG);
  const souProfessor = Boolean(meuPerfilDeProfessor) && !podeGerir;

  const titulo = podeGerir ? 'Aulas da arena'
    : souProfessor ? 'Sua agenda nesta arena'
      : 'Aulas nesta arena';

  return (
    <div className="mx-auto max-w-[1000px]">
      <div className="mb-6">
        <Link
          to={`/arenas/${arena.id}`}
          className="mb-3 inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-gray-500 hover:text-ink"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> {arena.name}
        </Link>
        <h1 className="font-display text-3xl font-bold tracking-tight text-ink">{titulo}</h1>
        <p className="mt-2 font-medium text-gray-500">
          {souProfessor
            ? 'As aulas em que você é o professor, com os alunos de cada uma.'
            : `${arena.name} · agenda e matrículas.`}
        </p>
        {podeGerir && (
          <V2Button asChild size="sm" variant="secondary" className="mt-3">
            <Link to={`/arenas/${arena.id}/gerir?aba=aulas`}>
              <Settings2 className="h-4 w-4" /> Gerir aulas e professores na Central
            </Link>
          </V2Button>
        )}
      </div>

      {temCatalogo && !souProfessor && <VitrineDeProfessores arenaId={arena.id} />}

      <ArenaClassesPanel arena={arena} podeGerir={podeGerir} meuPerfilDeProfessor={meuPerfilDeProfessor} />
    </div>
  );
}
