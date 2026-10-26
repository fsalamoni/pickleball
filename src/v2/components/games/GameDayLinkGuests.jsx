/**
 * GameDayLinkGuests — quem joga este dia de fora do clube/arena vinculados.
 *
 * Montado DENTRO da seção "Clube ou arena" (`GameDayLinkSection`), nas
 * configurações do dia — não é um cartão solto no meio do dia de jogo. Segue o
 * desenho da lista de organizadores logo acima: subtítulo, linhas brancas com
 * avatar e selo, e a nota de rodapé.
 *
 * Convidado é só RÓTULO (ver `domain/gameDayLink.js`): quem é de fora joga o
 * dia como qualquer outro e mantém todas as suas estatísticas.
 *
 * - Clube: `club_members` é legível por quem está logado — qualquer pessoa vê.
 * - Arena: `arena_members` só o gestor lê. Para os demais a lista é DESCONHECIDA
 *   e o bloco não diz nada sobre convidados da arena (desconhecido nunca vira
 *   "convidado").
 *
 * Sem vínculo, sem participantes ou sem lista de membros conhecida: nada.
 */
import React, { useMemo } from 'react';
import { V2Badge } from '@/v2/ui/primitives';
import { UserAvatar } from '@/components/ui/user-avatar';
import { gameDayLinks, splitGuests } from '@/modules/games/domain/gameDayLink';
import { useGameDayParticipants } from '@/modules/games/hooks/useGameDays';
import { useClubMembers } from '@/modules/clubs/hooks/useClubs';
import { useMyManagedArenas } from '@/modules/arenas/hooks/useArenas';
import { useArenaMembers } from '@/modules/arenas/hooks/useArenaV3';
import { t, tn } from '@/core/i18n';

/** Um bloco por lado vinculado: "Clube X · 3 de dentro · 2 convidados" + linhas. */
function LadoDoVinculo({ nome, participantes, uids }) {
  const { known, guests, members } = useMemo(() => splitGuests(participantes, uids), [participantes, uids]);
  if (!known) return null;
  return (
    <div className="space-y-1.5">
      <p className="text-xs text-gray-500">
        <span className="font-semibold text-ink">{nome}</span>
        {' · '}
        {t('{n} de dentro', { n: members })}
        {' · '}
        {tn(guests.length, '{n} convidado', '{n} convidados')}
      </p>
      {guests.map((p) => (
        <div key={p.id} className="flex items-center gap-2 rounded-lg border border-gray-100 bg-white p-2">
          <UserAvatar name={p.name || t('Atleta')} photoUrl={p.photo_url} size="sm" />
          <span className="min-w-0 flex-1 truncate text-sm font-medium text-ink">{p.name || t('Atleta')}</span>
          <V2Badge tone="neutral">{t('Convidado')}</V2Badge>
        </div>
      ))}
    </div>
  );
}

/** @param {{ gameDay: object }} props */
export default function GameDayLinkGuests({ gameDay }) {
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
    <div className="space-y-2 pt-1">
      <p className="text-sm font-semibold text-ink">{t('Convidados')}</p>
      {club && <LadoDoVinculo nome={club.name} participantes={participantes} uids={clubUids} />}
      {arena && <LadoDoVinculo nome={arena.name} participantes={participantes} uids={arenaUids} />}
    </div>
  );
}
