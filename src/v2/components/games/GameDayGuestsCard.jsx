/**
 * GameDayGuestsCard — quem joga este dia de fora do clube/arena vinculados.
 *
 * Convidado é só RÓTULO (ver `domain/gameDayLink.js`): quem é de fora joga o
 * dia como qualquer outro e mantém todas as suas estatísticas. A tela diz quem é,
 * para o clube/arena saber quem veio de fora.
 *
 * - Clube: `club_members` é legível por quem está logado — qualquer pessoa vê.
 * - Arena: `arena_members` só o gestor lê. Para os demais a lista é DESCONHECIDA
 *   e o cartão não diz nada sobre convidados da arena (desconhecido nunca vira
 *   "convidado").
 *
 * Sem vínculo, não renderiza nada.
 */
import React, { useMemo } from 'react';
import { UserRound } from 'lucide-react';
import { V2Badge, V2Surface } from '@/v2/ui/primitives';
import { gameDayLinks, splitGuests } from '@/modules/games/domain/gameDayLink';
import { useGameDayParticipants } from '@/modules/games/hooks/useGameDays';
import { useClubMembers } from '@/modules/clubs/hooks/useClubs';
import { useMyManagedArenas } from '@/modules/arenas/hooks/useArenas';
import { useArenaMembers } from '@/modules/arenas/hooks/useArenaV3';
import { t, tn } from '@/core/i18n';

/** Uma linha por lado vinculado: "Clube X: 3 do clube · 2 convidados". */
function LadoDoVinculo({ nome, participantes, uids }) {
  const { known, guests, members } = useMemo(() => splitGuests(participantes, uids), [participantes, uids]);
  if (!known) return null;
  return (
    <div className="space-y-1.5">
      <p className="text-sm text-ink">
        <span className="font-semibold">{nome}</span>
        {' · '}
        {t('{n} de dentro', { n: members })}
        {' · '}
        {tn(guests.length, '{n} convidado', '{n} convidados')}
      </p>
      {guests.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {guests.map((p) => (
            <V2Badge key={p.id} tone="neutral"><UserRound className="mr-1 h-3 w-3" aria-hidden="true" /> {p.name || t('Atleta')}</V2Badge>
          ))}
        </div>
      )}
    </div>
  );
}

/** @param {{ gameDay: object }} props */
export default function GameDayGuestsCard({ gameDay }) {
  const { club, arena } = gameDayLinks(gameDay);
  const { data: participantes = [], isSuccess: temParticipantes } = useGameDayParticipants(gameDay?.id);
  const clubMembers = useClubMembers(club?.id || null);
  const { data: minhasArenas } = useMyManagedArenas();
  const geroArena = !!arena && (minhasArenas || []).some((a) => a.id === arena.id);
  const arenaMembers = useArenaMembers(geroArena ? arena.id : null);

  const clubUids = useMemo(
    () => (clubMembers.isSuccess ? new Set((clubMembers.data || []).map((m) => m.user_id).filter(Boolean)) : null),
    [clubMembers.isSuccess, clubMembers.data],
  );
  const arenaUids = useMemo(
    () => (geroArena && arenaMembers.isSuccess ? new Set((arenaMembers.data || []).map((m) => m.user_id).filter(Boolean)) : null),
    [geroArena, arenaMembers.isSuccess, arenaMembers.data],
  );

  if (!club && !arena) return null;
  if (!temParticipantes || participantes.length === 0) return null;
  // Nenhuma das listas de membros é conhecida: nada a dizer (nunca "todos convidados").
  if (!(club && clubUids) && !(arena && arenaUids)) return null;

  return (
    <V2Surface className="space-y-3">
      <div>
        <h2 className="font-display text-lg font-bold text-ink">{t('Convidados do vínculo')}</h2>
        <p className="mt-0.5 text-xs text-gray-500">
          {t('Quem não é do clube ou da arena vinculados joga como convidado e mantém todas as suas estatísticas.')}
        </p>
      </div>
      {club && <LadoDoVinculo nome={club.name} participantes={participantes} uids={clubUids} />}
      {arena && <LadoDoVinculo nome={arena.name} participantes={participantes} uids={arenaUids} />}
    </V2Surface>
  );
}
