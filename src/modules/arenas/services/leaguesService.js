/**
 * Service: o torneio interno da arena.
 *
 * ## A decisão que evitou reescrever a plataforma
 *
 * A arena já tem uma máquina completa de dia de jogo — sorteio equilibrado
 * pela régua 2.0–8.0, Play, Americano, Americano aprimorado, placar, ranking
 * do dia, telão e tutoriais. Um torneio interno é exatamente isso com
 * inscrição antecipada e prêmio.
 *
 * Então **começar o torneio cria um dia de jogo da arena** com os inscritos, e
 * o ambiente do atleta não precisou de nada novo. O torneio guarda o
 * `game_day_id` e vira a porta de entrada; o dia de jogo faz o trabalho —
 * inclusive bloquear a quadra, que a partir daí é responsabilidade dele
 * (por isso `tournamentBlocks` para de derivar quando há `game_day_id`:
 * contar duas vezes mostraria dois bloqueios para o mesmo horário).
 */

import {
  collection, doc, getDoc, getDocs, setDoc, updateDoc, deleteDoc,
  query, where, serverTimestamp, increment, arrayUnion, arrayRemove,
} from 'firebase/firestore';
import { db } from '@/core/config/firebase';
import { logger } from '@/core/lib/logger';
import { createAuditLog } from '@/core/services/auditService';
import { notifyUsers, NOTIFICATION_TYPE } from '@/core/services/notificationService';
import {
  normalizeInternalTournamentInput, INTERNAL_TOURNAMENT_STATUS,
  applyTournamentToLadder, isTournamentOpen, tournamentSeatsLeft,
} from '../domain/leagues.js';
import {
  checkUnavailabilityConflict, unavailabilityConflictMessage,
} from '../domain/booking_conflict.js';

const COL_TOURNAMENTS = 'arena_internal_tournaments';
const COL_LADDERS = 'arena_ladders';

function displayName(u, p) {
  return p?.platform_name || p?.full_name || u?.displayName || u?.email || 'Atleta';
}

export async function listArenaTournaments(arenaId, { onlyFuture = false, lim = 50 } = {}) {
  if (!db || !arenaId) return [];
  // `arena_id ==` + `date >=` + `orderBy(date)` sem indice composto:
  // `arena_internal_tournaments` nao tem nenhum. Os torneios internos da arena
  // nunca apareceram. Ordenacao e recorte em memoria (a colecao e pequena por
  // arena), com o corte DEPOIS de ordenar.
  const snap = await getDocs(query(collection(db, COL_TOURNAMENTS), where('arena_id', '==', arenaId)));
  const hoje = new Date().toISOString().slice(0, 10);
  return snap.docs
    .map((d) => ({ id: d.id, ...d.data() }))
    .filter((x) => !onlyFuture || String(x.date || '') >= hoje)
    .sort((a, b) => String(a.date || '').localeCompare(String(b.date || '')))
    // O corte leva os MAIS ANTIGOS: cortar do começo jogava fora os torneios
    // futuros assim que a arena passasse de 50 — e eles deixavam de ocupar a
    // quadra no calendário.
    .slice(-Math.max(1, Number(lim) || 50));
}

/**
 * Os torneios da casa em que a pessoa está inscrita, em TODAS as arenas —
 * para a lista de torneios dela.
 *
 * `array-contains` num campo só: sem índice composto. A leitura de
 * `arena_internal_tournaments` é aberta a quem tem conta.
 *
 * @returns {Promise<{ torneios: Array, arenas: Array }>}
 */
export async function listMyInternalTournaments(userId) {
  if (!db || !userId) return { torneios: [], arenas: [] };
  const snap = await getDocs(query(
    collection(db, COL_TOURNAMENTS), where('participants', 'array-contains', userId),
  ));
  const torneios = snap.docs
    .map((d) => ({ id: d.id, ...d.data() }))
    .sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')))
    .slice(0, 50);
  const ids = [...new Set(torneios.map((t) => t.arena_id).filter(Boolean))];
  const arenas = (await Promise.all(ids.map((id) => getDoc(doc(db, 'arenas', id)).catch(() => null))))
    .filter((d) => d?.exists?.())
    .map((d) => ({ id: d.id, ...d.data() }));
  return { torneios, arenas };
}

/**
 * Recusa o torneio quando alguma das quadras já está comprometida.
 *
 * Marcar torneio em cima de reserva confirmada é criar um conflito que só
 * aparece no sábado, com gente na quadra.
 */
async function recusarSeQuadraOcupada(arenaId, value, { exceptId } = {}) {
  if (!value.court_ids?.length || !value.start_time || !value.end_time) return;
  const { arenaOccupancy } = await import('./arenaOccupancy.js');
  const blocos = (await arenaOccupancy(arenaId))
    .filter((b) => b.tournament_id !== exceptId);
  const candidatos = value.court_ids.map((courtId) => ({
    date: value.date, start: value.start_time, end: value.end_time, court_id: courtId,
  }));
  const { hasConflict, conflicts } = checkUnavailabilityConflict(candidatos, blocos);
  if (hasConflict) throw new Error(unavailabilityConflictMessage(conflicts));
}

export async function createInternalTournament(arenaId, input, actor) {
  if (!arenaId) throw new Error('arenaId obrigatório.');
  const { valid, errors, value } = normalizeInternalTournamentInput(input);
  if (!valid) throw new Error(Object.values(errors)[0] || 'Dados inválidos.');
  await recusarSeQuadraOcupada(arenaId, value);
  const id = doc(collection(db, COL_TOURNAMENTS)).id;
  await setDoc(doc(db, COL_TOURNAMENTS, id), {
    id, arena_id: arenaId, ...value,
    enrolled: 0, participants: [], roster: [],
    game_day_id: null,
    status: INTERNAL_TOURNAMENT_STATUS.SCHEDULED,
    created_by: actor?.uid, created_at: serverTimestamp(), updated_at: serverTimestamp(),
  });
  await createAuditLog({ action: 'arena_internal_tournament_created', actor, details: { arena_id: arenaId, name: value.name } });
  return id;
}

export async function joinTournament(tid, user, profile) {
  if (!tid || !user?.uid) throw new Error('Parâmetros obrigatórios.');
  const ref = doc(db, COL_TOURNAMENTS, tid);
  const snap = await getDoc(ref);
  if (!snap.exists()) throw new Error('Torneio não encontrado.');
  const t = { id: snap.id, ...snap.data() };
  if (!isTournamentOpen(t)) throw new Error('As inscrições deste torneio já fecharam.');
  if ((t.participants || []).includes(user.uid)) throw new Error('Você já está inscrito.');
  const vagas = tournamentSeatsLeft(t);
  if (vagas !== null && vagas <= 0) throw new Error('Torneio lotado.');

  // O `roster` guarda NOME e FOTO junto do uid. Sem isso, começar o torneio
  // criaria um dia de jogo com uma lista de identificadores — e o organizador
  // não reconheceria ninguém na tela de sorteio.
  await updateDoc(ref, {
    participants: arrayUnion(user.uid),
    roster: arrayUnion({
      user_id: user.uid,
      name: displayName(user, profile),
      photo_url: profile?.photo_url || user?.photoURL || null,
      level: profile?.level || profile?.leveling_level || null,
    }),
    enrolled: increment(1),
    updated_at: serverTimestamp(),
  });
  await createAuditLog({ action: 'arena_internal_tournament_joined', actor: user, details: { tournament_id: tid } });
}

/**
 * Sair do torneio.
 *
 * Não existia: só dava para entrar. Um torneio de que ninguém consegue sair
 * enche de gente que não vai aparecer, e o sorteio nasce errado.
 */
export async function leaveTournament(tid, user) {
  if (!tid || !user?.uid) return;
  const ref = doc(db, COL_TOURNAMENTS, tid);
  const snap = await getDoc(ref);
  if (!snap.exists()) return;
  const t = { id: snap.id, ...snap.data() };
  if (!(t.participants || []).includes(user.uid)) return;
  if (!isTournamentOpen(t)) throw new Error('O torneio já começou — fale com a arena.');

  // `arrayRemove` num objeto exige igualdade EXATA de todos os campos, e o
  // `roster` pode ter mudado de forma. Reescrever a lista filtrada é o que
  // funciona sempre.
  const roster = (Array.isArray(t.roster) ? t.roster : []).filter((r) => r?.user_id !== user.uid);
  await updateDoc(ref, {
    participants: arrayRemove(user.uid),
    roster,
    enrolled: Math.max(0, (Number(t.enrolled) || 1) - 1),
    updated_at: serverTimestamp(),
  });
  await createAuditLog({ action: 'arena_internal_tournament_left', actor: user, details: { tournament_id: tid } });
}

/**
 * A classificação da arena num período.
 *
 * Lê pelo ID determinístico (`arenaId_periodo`), que é o mesmo que a escrita
 * usa: um `getDoc` no lugar de uma consulta com dois filtros. Mais barato, e
 * sem o risco de existirem dois documentos para o mesmo período.
 *
 * O padrão é `'geral'` — a acumulação da casa, que é o que faz o ladder ter
 * graça. `'current_week'` era o padrão antigo e continua funcionando para quem
 * pedir explicitamente.
 */
export async function getLadder(arenaId, period = 'geral') {
  if (!db || !arenaId) return [];
  const snap = await getDoc(doc(db, COL_LADDERS, `${arenaId}_${period}`));
  return snap.exists() ? (snap.data().rankings || []) : [];
}


/* ================================================================== */
/*  Editar, cancelar, apagar                                           */
/* ================================================================== */

async function torneioPorId(tid) {
  const snap = await getDoc(doc(db, COL_TOURNAMENTS, tid));
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
}

export async function updateInternalTournament(tid, input, actor) {
  if (!tid) return;
  const atual = await torneioPorId(tid);
  if (!atual) throw new Error('Torneio não encontrado.');
  if (atual.game_day_id) {
    throw new Error('O torneio já começou: mude a data e as quadras pelo dia de jogo.');
  }
  const { valid, errors, value } = normalizeInternalTournamentInput({ ...atual, ...input });
  if (!valid) throw new Error(Object.values(errors)[0] || 'Dados inválidos.');
  // Reduzir o teto abaixo de quem já se inscreveu deixaria gente de fora sem
  // que ninguém fosse avisado.
  if (value.max_participants < (Number(atual.enrolled) || 0)) {
    throw new Error(`Já há ${atual.enrolled} inscrito(s): o limite não pode ser menor.`);
  }
  await recusarSeQuadraOcupada(atual.arena_id, value, { exceptId: tid });
  await updateDoc(doc(db, COL_TOURNAMENTS, tid), { ...value, updated_at: serverTimestamp() });
  await createAuditLog({
    action: 'arena_internal_tournament_updated', actor,
    details: { tournament_id: tid, arena_id: atual.arena_id },
  });
}

/** Cancela e avisa quem estava inscrito. */
export async function cancelInternalTournament(tid, motivo, actor) {
  if (!tid) return;
  const t = await torneioPorId(tid);
  if (!t) return;
  await updateDoc(doc(db, COL_TOURNAMENTS, tid), {
    status: INTERNAL_TOURNAMENT_STATUS.CANCELLED,
    cancel_reason: String(motivo || '').trim().slice(0, 200),
    updated_at: serverTimestamp(),
  });
  const uids = (t.participants || []).filter(Boolean);
  if (uids.length > 0) {
    try {
      await notifyUsers(uids, {
        title: 'Torneio cancelado',
        message: `"${t.name}" foi cancelado${motivo ? `: ${motivo}` : '.'}`,
        type: NOTIFICATION_TYPE.GENERIC,
        link: `/arenas/${t.arena_id}/torneios`,
        actor,
      });
    } catch (err) {
      logger.info('Falha ao avisar inscritos do torneio cancelado', { err: err?.code });
    }
  }
  await createAuditLog({
    action: 'arena_internal_tournament_cancelled', actor,
    details: { tournament_id: tid, arena_id: t.arena_id, inscritos: uids.length },
  });
}

export async function deleteInternalTournament(tid, actor) {
  if (!tid) return;
  const t = await torneioPorId(tid);
  await deleteDoc(doc(db, COL_TOURNAMENTS, tid));
  await createAuditLog({
    action: 'arena_internal_tournament_deleted', actor,
    details: { tournament_id: tid, arena_id: t?.arena_id || null },
  });
}

/* ================================================================== */
/*  Começar: o torneio vira DIA DE JOGO                                */
/* ================================================================== */

/**
 * Cria o dia de jogo da arena com os inscritos e liga o torneio a ele.
 *
 * É aqui que o torneio deixa de ser uma lista de nomes. A partir deste
 * momento, tudo o que a plataforma já sabe fazer passa a valer: sorteio
 * equilibrado pela régua 2.0–8.0, Play/Americano/Rei da Quadra, placar,
 * ranking do dia, telão e tutoriais. **Nada disso precisou ser escrito de
 * novo.**
 *
 * A ordem importa: o dia de jogo é criado ANTES de o torneio ser marcado como
 * "em andamento". Se a criação falhar (uma quadra ficou ocupada no meio do
 * caminho), o torneio continua com as inscrições abertas e a arena tenta de
 * novo — em vez de ficar "em andamento" sem jogo nenhum.
 *
 * @param {object} tournament
 * @param {{ arena?: object, courts?: Array }} ctx
 * @param {object} actor
 * @returns {Promise<{ gameDayId: string }>}
 */
export async function startInternalTournament(tournament, { arena = null, courts = [] } = {}, actor) {
  if (!tournament?.id) throw new Error('Torneio inválido.');
  if (tournament.game_day_id) throw new Error('Este torneio já começou.');
  const inscritos = Array.isArray(tournament.roster) ? tournament.roster : [];
  if (inscritos.length < 2) throw new Error('São necessárias pelo menos 2 pessoas inscritas.');
  if (!tournament.court_ids?.length || !tournament.start_time || !tournament.end_time) {
    throw new Error('Escolha as quadras e o horário antes de começar.');
  }

  const { createArenaGameDay } = await import('@/modules/games/services/arenaGameDayService.js');
  const { addGameDayParticipant } = await import('@/modules/games/services/gameDayService.js');

  const nomePorId = new Map((courts || []).map((c) => [c.id, c.name]));
  const gameDayId = await createArenaGameDay(tournament.arena_id, {
    title: tournament.name,
    date: tournament.date,
    notes: tournament.description || null,
    format: tournament.format,
    capacity: tournament.max_participants,
    arena_slots: tournament.court_ids.map((courtId) => ({
      court_id: courtId,
      court_name: nomePorId.get(courtId) || null,
      start_time: tournament.start_time,
      end_time: tournament.end_time,
    })),
  }, actor, { arena, courts });

  // Os inscritos entram como participantes. Em série: são poucas dezenas, e o
  // paralelo só aumentaria a chance de bater no limite de escrita.
  for (const p of inscritos) {
    // eslint-disable-next-line no-await-in-loop
    await addGameDayParticipant(gameDayId, {
      user_id: p.user_id,
      name: p.name || 'Atleta',
      photo_url: p.photo_url || null,
      play_level: p.level || null,
    }, actor).catch((err) => logger.info('Inscrito não entrou no dia de jogo', { err: err?.code }));
  }

  await updateDoc(doc(db, COL_TOURNAMENTS, tournament.id), {
    game_day_id: gameDayId,
    status: INTERNAL_TOURNAMENT_STATUS.RUNNING,
    started_at: serverTimestamp(),
    updated_at: serverTimestamp(),
  });

  const uids = (tournament.participants || []).filter(Boolean);
  if (uids.length > 0) {
    try {
      await notifyUsers(uids, {
        title: 'O torneio começou',
        message: `"${tournament.name}" está rolando. Entre para ver as partidas.`,
        type: NOTIFICATION_TYPE.GENERIC,
        link: `/dia-de-jogo/${gameDayId}`,
        actor,
      });
    } catch (err) {
      logger.info('Falha ao avisar o início do torneio', { err: err?.code });
    }
  }

  await createAuditLog({
    action: 'arena_internal_tournament_started', actor,
    details: {
      tournament_id: tournament.id, arena_id: tournament.arena_id,
      game_day_id: gameDayId, inscritos: inscritos.length,
    },
  });
  return { gameDayId };
}

/* ================================================================== */
/*  Encerrar: o resultado alimenta o LADDER                            */
/* ================================================================== */

/** O id determinístico do ladder de um período. */
function ladderId(arenaId, period) {
  return `${arenaId}_${period}`;
}

/**
 * Encerra o torneio e soma o resultado ao ladder da arena.
 *
 * O ladder era **lido e nunca escrito**: `getLadder` consultava
 * `arena_ladders` e nada no projeto gravava ali. A classificação da arena
 * estava vazia desde sempre, para todo mundo.
 *
 * O documento tem id determinístico (`arenaId_periodo`), então `setDoc` com
 * `merge` cria na primeira vez e atualiza depois — sem consulta, sem índice e
 * sem o risco de dois documentos para o mesmo período.
 *
 * @param {object} tournament
 * @param {Array<{ user_id, name?, position?, won? }>} classificacao
 * @param {{ period?: string }} [opts]
 * @param {object} actor
 */
export async function finishInternalTournament(tournament, classificacao = [], { period = 'geral' } = {}, actor) {
  if (!tournament?.id) throw new Error('Torneio inválido.');
  // Conferido no BANCO, não no que a tela tem em mãos: encerrar duas vezes
  // (dois cliques, duas abas) somaria os pontos duas vezes no ladder — e
  // ninguém confere a acumulação de olho.
  const atualNoBanco = await torneioPorId(tournament.id);
  if (!atualNoBanco) throw new Error('Torneio não encontrado.');
  if (atualNoBanco.status === INTERNAL_TOURNAMENT_STATUS.FINISHED) {
    throw new Error('Este torneio já foi encerrado.');
  }
  if (atualNoBanco.status !== INTERNAL_TOURNAMENT_STATUS.RUNNING) {
    throw new Error('Só dá para encerrar um torneio que já começou.');
  }
  const arenaId = atualNoBanco.arena_id;

  const atual = await getLadder(arenaId, period);
  const novo = applyTournamentToLadder(atual, classificacao);

  await setDoc(doc(db, COL_LADDERS, ladderId(arenaId, period)), {
    id: ladderId(arenaId, period),
    arena_id: arenaId,
    period,
    rankings: novo,
    updated_at: serverTimestamp(),
  }, { merge: true });

  await updateDoc(doc(db, COL_TOURNAMENTS, tournament.id), {
    status: INTERNAL_TOURNAMENT_STATUS.FINISHED,
    finished_at: serverTimestamp(),
    final_standings: classificacao.slice(0, 10),
    updated_at: serverTimestamp(),
  });

  // Quem jogou fica sabendo — e vai ver onde ficou. Sem isto o torneio
  // terminava em silêncio e o ladder mudava sem ninguém saber por quê.
  const uids = [...new Set([
    ...(atualNoBanco.participants || []),
    ...classificacao.map((c) => c?.user_id),
  ].filter(Boolean))];
  if (uids.length > 0) {
    const campeao = classificacao.find((c) => Number(c?.position) === 1);
    try {
      await notifyUsers(uids, {
        title: 'Torneio encerrado',
        message: campeao?.name
          ? `"${atualNoBanco.name}" terminou — campeão: ${campeao.name}. Veja a classificação da casa.`
          : `"${atualNoBanco.name}" terminou. Veja a classificação da casa.`,
        type: NOTIFICATION_TYPE.GENERIC,
        link: `/arenas/${arenaId}/torneios`,
        actor,
      });
    } catch (err) {
      logger.info('Falha ao avisar o fim do torneio', { err: err?.code });
    }
  }

  await createAuditLog({
    action: 'arena_internal_tournament_finished', actor,
    details: { tournament_id: tournament.id, arena_id: arenaId, classificados: classificacao.length },
  });
  return novo;
}
