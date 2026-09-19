/**
 * Serviço do DIA DE JOGO DO CLUBE — o mesmo `game_days` das outras origens.
 *
 * **Nenhuma coleção nova, nenhuma regra reescrita, nenhuma migração.** O dia de
 * jogo do clube é um documento de `game_days` com quatro campos aditivos
 * (`club_id`, `club_name`, `club_event_id`, `club_event_date_id`), e a data do
 * evento ganha um `game_day_id` apontando para ele. Ausentes esses campos —
 * como em tudo o que já está publicado — nada muda: o organizador legado segue
 * servindo aquela data, lendo e escrevendo exatamente onde sempre leu e
 * escreveu.
 *
 * O desenho é o mesmo que a arena usa desde a Onda AA (`arenaGameDayService`),
 * e pela mesma razão: o dia de jogo pertence ao CLUBE, não a quem clicou em
 * criar. Quem administra o clube administra o dia, inclusive quem virou
 * administrador depois — a regra do Firestore confere `club_id` contra
 * `club_members`.
 */

import {
  collection, doc, setDoc, updateDoc, deleteDoc, serverTimestamp,
} from 'firebase/firestore';
import { db } from '@/core/config/firebase';
import { createAuditLog } from '@/core/services/auditService';
import { GAME_DAY_STATUS, GAME_DAY_VISIBILITY, normalizePlayCourts } from '../domain/gameDay.js';
import { normalizeClubGameDayInput } from '../domain/clubGameDay.js';
import { getGameDay, deleteGameDay } from './gameDayService.js';

const COL = 'game_days';

/**
 * Cria o dia de jogo de uma DATA de evento de clube e amarra os dois.
 *
 * Ordem deliberada: o `game_days` nasce PRIMEIRO e a data do evento já é
 * gravada com `game_day_id`. É o mesmo corolário da Onda AM (o torneio interno
 * cria o dia de jogo antes de mudar o próprio status): se o dia de jogo
 * falhar, não sobra uma data prometendo um módulo que não existe. Quem chama
 * cria a data em seguida; se ELA falhar, `discardClubGameDay` desfaz o que
 * acabou de nascer, para não deixar um dia de jogo órfão na lista de ninguém.
 *
 * @param {object} args
 * @param {string} args.clubId
 * @param {object|null} [args.club]  documento do clube (nome/foto para exibir)
 * @param {object} args.event        o evento de clube (título, id)
 * @param {object} args.input        `{ date_time, location, note, format, play_courts, manage_mode }`
 * @param {object} args.actor        usuário autenticado
 * @returns {Promise<{ id: string }>}
 */
export async function createClubGameDay({ clubId, club = null, event, input }, actor) {
  if (!actor?.uid) throw new Error('É preciso estar autenticado.');
  if (!clubId) throw new Error('Clube inválido.');
  if (!event?.id) throw new Error('Evento inválido.');

  const { valid, errors, value } = normalizeClubGameDayInput(input, { event });
  if (!valid) throw new Error(Object.values(errors)[0] || 'Dados inválidos.');

  const id = doc(collection(db, COL)).id;
  const payload = {
    id,
    ...value,
    play_courts: normalizePlayCourts(value.play_courts),
    // --- o que faz dele um dia de jogo de CLUBE ---
    club_id: clubId,
    club_name: club?.name || null,
    club_event_id: event.id,
    // PRIVADO: o dia de jogo é do clube. Público aqui significaria publicar
    // convite em "Procura-se jogo" e deixar qualquer conta se inserir — o
    // evento de clube nunca funcionou assim. Quem vê são os membros do clube
    // (uma condição aditiva na regra) e quem foi inserido no dia.
    visibility: GAME_DAY_VISIBILITY.PRIVATE,
    open_game_id: null,
    created_by: actor.uid,
    creator_name: club?.name || null,
    creator_photo: club?.logo_url || null,
    // Quem agenda a data não vira jogador: um evento semanal cria dezenas de
    // datas de uma vez, e o organizador apareceria inscrito em todas elas.
    member_uids: [actor.uid],
    invited_uids: [],
    admin_uids: [],
    status: GAME_DAY_STATUS.ACTIVE,
    publish_to_ranking: false,
    published_count: 0,
    created_at: serverTimestamp(),
    created_at_ms: Date.now(),
    updated_at: serverTimestamp(),
  };
  await setDoc(doc(db, COL, id), payload);

  await createAuditLog({
    action: 'club_game_day_created',
    actor,
    details: { club_id: clubId, event_id: event.id, game_day_id: id, format: value.format },
  });
  return { id };
}

/**
 * Apaga um dia de jogo recém-criado que não chegou a ser amarrado a uma data.
 *
 * Só é chamado no caminho de erro, e de propósito é `deleteDoc` e não
 * `deleteGameDay`: o documento acabou de nascer, não tem convite público,
 * participantes, jogos nem resultado no ranking para desfazer.
 */
export async function discardClubGameDay(gameDayId) {
  if (!gameDayId) return;
  await deleteDoc(doc(db, COL, gameDayId)).catch(() => {});
}

/**
 * Mantém o dia de jogo em dia com a DATA do evento (data, hora, local, nome).
 *
 * Editar a data no clube e o dia de jogo continuar marcado para o horário
 * antigo seria a divergência de sempre, só que dentro de um documento só.
 */
export async function syncClubGameDayFromDate(gameDayId, { event, date }, actor) {
  if (!gameDayId) return;
  const atual = await getGameDay(gameDayId);
  if (!atual?.club_id) return;
  const { valid, value } = normalizeClubGameDayInput(
    { date_time: date?.date_time, location: date?.location, note: date?.note },
    { event },
  );
  if (!valid) return;
  await updateDoc(doc(db, COL, gameDayId), {
    title: value.title,
    date: value.date,
    time: value.time,
    location: value.location,
    notes: value.notes,
    updated_at: serverTimestamp(),
  });
  await createAuditLog({
    action: 'club_game_day_synced',
    actor,
    details: { game_day_id: gameDayId, club_id: atual.club_id },
  });
}

/**
 * Arquiva o dia de jogo quando a data do evento é removida.
 *
 * Reusa `deleteGameDay`, que já tira os resultados do ranking — apagar a data
 * e deixar o dia publicado seria tirar do clube um jogo que segue contando no
 * rating de quem jogou.
 */
export async function archiveClubGameDay(gameDayId, actor) {
  if (!gameDayId) return;
  await deleteGameDay(gameDayId, actor).catch(() => {});
}
