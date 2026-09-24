/**
 * Exclusão de cadastro — a PSEUDONIMIZAÇÃO, com as especificações reais.
 *
 * Cada campo aqui foi conferido no código que escreve a coleção. Os testes
 * protegem as armadilhas que um olhar rápido não vê:
 *
 *  1. ⭐ o rótulo "A / B" da inscrição é RECALCULADO (e o dos grupos também);
 *  2. ⭐ no jogo, `slot.id` é id de PARTICIPANTE, não uid — e o uid é gravado
 *     no lado, senão o ranking confunde dois "Atleta removido";
 *  3. ⭐ mensagem perde o CONTEÚDO e os anexos (o arquivo foi apagado);
 *  4. ⭐ a outra pessoa da dupla, da conversa, da reserva fica intacta.
 */
import { describe, it, expect } from 'vitest';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const {
  patchRegistration, patchGameSides, patchMessage, patchConversation, patchBooking,
  patchInternalTournament, patchPairRanking, consolidarOps, executeAccountDeletion,
  REMOVED_ATHLETE, REMOVED_USER, REMOVED_MESSAGE,
} = require('../functions/accountDeletion.js');
const {
  createFakeDb, createFakeAuth, createFakeBucket, FakeFieldValue,
} = require('../tests/fakes/fakeFirestore.cjs');

describe('patchRegistration', () => {
  const dupla = {
    player_a_user_id: 'x', player_a_name: 'Ana', player_a_photo: 'p', player_a_email: 'a@x.com', player_a_email_lc: 'a@x.com',
    player_b_user_id: 'y', player_b_name: 'Bia', label: 'Ana / Bia',
  };

  it('⭐ troca o lado da pessoa e RECALCULA o rótulo', () => {
    expect(patchRegistration(dupla, 'x')).toEqual({
      player_a_name: REMOVED_ATHLETE, player_a_photo: null, player_a_email: null, player_a_email_lc: null,
      label: `${REMOVED_ATHLETE} / Bia`,
    });
  });

  it('lado B também', () => {
    expect(patchRegistration(dupla, 'y').label).toBe(`Ana / ${REMOVED_ATHLETE}`);
  });

  it('individual: rótulo é o nome só', () => {
    const r = patchRegistration({ player_a_user_id: 'x', player_a_name: 'Ana', label: 'Ana' }, 'x');
    expect(r.label).toBe(REMOVED_ATHLETE);
  });

  it('⭐ time: troca o membro e NÃO mexe no rótulo (é o nome do time)', () => {
    const time = { members: [{ user_id: 'x', name: 'Ana', photo_url: 'p' }, { user_id: 'y', name: 'Bia' }], label: 'Os Craques' };
    const r = patchRegistration(time, 'x');
    expect(r.members[0]).toEqual({ user_id: 'x', name: REMOVED_ATHLETE, photo_url: null });
    expect(r.members[1].name).toBe('Bia');
    expect(r.label).toBeUndefined();
  });

  it('e-mails migrados saem da inscrição pública', () => {
    const r = patchRegistration({ player_a_user_id: 'x', player_a_name: 'Ana', migrated_from_emails: ['a@x.com'] }, 'x');
    expect(r.migrated_from_emails).toEqual([]);
  });

  it('inscrição de outra pessoa: nada', () => {
    expect(patchRegistration(dupla, 'z')).toBeNull();
  });
});

describe('patchGameSides — o id do lado NÃO é uid', () => {
  it('⭐ reconhece pelo id de participante e GRAVA o uid no lado', () => {
    const jogo = { side_a: [{ id: 'p1', name: 'Ana' }, { id: 'p2', name: 'Bia' }], side_b: [] };
    const r = patchGameSides(jogo, 'x', new Set(['p1']));
    expect(r.side_a[0]).toEqual({ id: 'p1', name: REMOVED_ATHLETE, user_id: 'x' });
    expect(r.side_a[1]).toEqual({ id: 'p2', name: 'Bia' });
  });

  it('reconhece pelo user_id e limpa a foto', () => {
    const r = patchGameSides({ side_b: [{ id: 'p9', user_id: 'x', name: 'Ana', photo_url: 'f' }] }, 'x');
    expect(r.side_b[0]).toEqual({ id: 'p9', user_id: 'x', name: REMOVED_ATHLETE, photo_url: null });
  });

  it('⭐ um participante com id igual a OUTRO uid não é confundido', () => {
    // `id` só vale como uid quando é igual ao uid de quem sai.
    expect(patchGameSides({ side_a: [{ id: 'y', name: 'Bia' }] }, 'x', new Set())).toBeNull();
  });
});

describe('mensagens e conversas', () => {
  it('⭐ a mensagem perde o conteúdo e os anexos', () => {
    const r = patchMessage({ sender_id: 'x', sender_name: 'Ana', sender_photo: 'f', text: 'oi', attachments: [{ url: 'u' }] }, 'x');
    expect(r).toEqual({ sender_name: REMOVED_USER, sender_photo: null, text: REMOVED_MESSAGE, attachments: [] });
  });

  it('mensagem de outra pessoa não muda', () => {
    expect(patchMessage({ sender_id: 'y', text: 'oi' }, 'x')).toBeNull();
  });

  it('a conversa troca o membro e a última mensagem, se for dele', () => {
    const conv = {
      members: [{ uid: 'x', name: 'Ana', photo_url: 'f' }, { uid: 'y', name: 'Bia' }],
      last_message: { sender_id: 'x', sender_name: 'Ana', text: 'tchau', has_attachments: true, at_ms: 1 },
    };
    const r = patchConversation(conv, 'x');
    expect(r.members).toEqual([{ uid: 'x', name: REMOVED_USER, photo_url: null }, { uid: 'y', name: 'Bia' }]);
    expect(r.last_message).toEqual({ sender_id: 'x', sender_name: REMOVED_USER, text: REMOVED_MESSAGE, has_attachments: false, at_ms: 1 });
  });
});

describe('patchBooking', () => {
  it('⭐ titular e participante (inclusive quem recusou); valor intacto', () => {
    const b = {
      athlete_id: 'x', athlete_name: 'Ana', athlete_photo: 'f', price: 80,
      participants: [{ athlete_id: 'x', name: 'Ana', photo: 'f', status: 'declined' }, { athlete_id: 'y', name: 'Bia' }],
    };
    const r = patchBooking(b, 'x');
    expect(r.athlete_name).toBe(REMOVED_ATHLETE);
    expect(r.athlete_photo).toBeNull();
    expect(r.participants[0]).toEqual({ athlete_id: 'x', name: REMOVED_ATHLETE, photo: null, status: 'declined' });
    expect(r.participants[1].name).toBe('Bia');
    expect(r.price).toBeUndefined();
  });

  it('reserva de professor (athlete_id nulo) não é tocada pelo titular', () => {
    expect(patchBooking({ athlete_id: null, athlete_name: 'Prof' }, 'x')).toBeNull();
  });
});

describe('torneio interno e ranking de dupla', () => {
  it('troca elenco e classificação final', () => {
    const r = patchInternalTournament({
      roster: [{ user_id: 'x', name: 'Ana', photo_url: 'f' }],
      final_standings: [{ user_id: 'x', name: 'Ana', position: 1 }],
    }, 'x');
    expect(r.roster[0].name).toBe(REMOVED_ATHLETE);
    expect(r.final_standings[0]).toEqual({ user_id: 'x', name: REMOVED_ATHLETE, position: 1 });
  });

  it('nomes e fotos em vetor PARALELO aos ids', () => {
    const r = patchPairRanking({ player_ids: ['y', 'x'], display_names: ['Bia', 'Ana'], photos: ['p', 'q'] }, 'x');
    expect(r.display_names).toEqual(['Bia', REMOVED_ATHLETE]);
    expect(r.photos).toEqual(['p', null]);
  });

  it('players[] do ranking de duplas', () => {
    const r = patchPairRanking({ player_ids: ['x', 'y'], players: [{ uid: 'x', name: 'Ana', photo: 'f' }, { uid: 'y', name: 'Bia' }] }, 'x');
    expect(r.players[0]).toEqual({ uid: 'x', name: REMOVED_ATHLETE, photo: null });
  });
});

describe('consolidarOps', () => {
  const ref = (path) => ({ path });

  it('junta trocas no mesmo documento', () => {
    const r = consolidarOps([
      { type: 'update', ref: ref('a/1'), data: { x: 1 } },
      { type: 'update', ref: ref('a/1'), data: { y: 2 } },
    ]);
    expect(r).toEqual([{ type: 'update', ref: ref('a/1'), data: { x: 1, y: 2 } }]);
  });

  it('⭐ não troca documento que também vai ser apagado (o lote falharia)', () => {
    const r = consolidarOps([
      { type: 'update', ref: ref('a/1'), data: { x: 1 } },
      { type: 'delete', ref: ref('a/1') },
      { type: 'delete', ref: ref('a/1') },
    ]);
    expect(r).toEqual([{ type: 'delete', ref: ref('a/1') }]);
  });
});

/* ======================================================= cascata inteira == */

describe('⭐ a cascata com as especificações REAIS', () => {
  const X = 'x';
  const seed = () => ({
    'users/x': { uid: X, full_name: 'Ana Teste', email: 'ana@example.com' },
    'athlete_profiles/x': { uid: X },
    // inscrição de dupla + contato privado + grupo que copia o rótulo
    'tournament_registrations/r1': {
      tournament_id: 't1', player_a_user_id: X, player_a_name: 'Ana Teste', player_a_email: 'ana@example.com',
      player_b_user_id: 'y', player_b_name: 'Bia Real', label: 'Ana Teste / Bia Real',
    },
    'tournament_registrations/r1/private/contact': { player_a_email: 'ana@example.com', player_a_email_lc: 'ana@example.com', player_b_email: 'bia@gmail.com' },
    'tournament_groups/g1': { tournament_id: 't1', entrants: [{ id: 'r1', label: 'Ana Teste / Bia Real' }, { id: 'r2', label: 'Outra' }] },
    // dia de jogo: participante + jogo em que o lado usa o id do PARTICIPANTE
    'game_days/d1': { created_by: 'y', member_uids: [X, 'y'], status: 'active' },
    'game_days/d1/participants/px': { user_id: X, name: 'Ana Teste', photo_url: 'f' },
    'game_days/d1/participants/py': { user_id: 'y', name: 'Bia Real' },
    'game_days/d1/games/j1': { side_a: [{ id: 'px', name: 'Ana Teste' }], side_b: [{ id: 'py', name: 'Bia Real', user_id: 'y' }] },
    // conversa
    'conversations/c1': { member_ids: [X, 'y'], members: [{ uid: X, name: 'Ana Teste' }, { uid: 'y', name: 'Bia Real' }] },
    'conversations/c1/messages/m1': { sender_id: X, sender_name: 'Ana Teste', text: 'segredo', attachments: [] },
    'conversations/c1/messages/m2': { sender_id: 'y', sender_name: 'Bia Real', text: 'oi' },
    // fórum
    'club_forum_threads/f1': { author_id: 'y', author_name: 'Bia Real', participant_ids: ['y', X] },
    'club_forum_threads/f1/comments/k1': { author_id: X, author_name: 'Ana Teste', body: 'concordo' },
    'club_forum_threads/f1/poll_votes/x': { user_id: X, option: 1 },
    // reserva retida
    'arena_bookings/b1': { athlete_id: X, athlete_name: 'Ana Teste', price: 90 },
    // evento de clube achado pela presença (que depois é apagada)
    'club_event_rsvps/e1_x': { event_id: 'e1', user_id: X },
    'club_events/e1': { created_by: 'y', created_by_name: 'Bia Real' },
    'club_events/e1/participants/q1': { user_id: X, name: 'Ana Teste' },
    'club_events/e1/date_rsvps/d_x': { user_id: X },
  });

  async function rodar() {
    const db = createFakeDb(seed());
    const ctx = { db, auth: createFakeAuth([X], { log: db.store.log }), bucket: createFakeBucket([]) };
    const r = await executeAccountDeletion(ctx, X, {
      actor: { uid: 'admin', email: 'dono@x.com' }, reason: 'teste', hojeISO: '2026-09-24', FieldValue: FakeFieldValue,
    });
    return { db, r, get: (p) => db.store.docs.get(p) };
  }

  it('exclui', async () => {
    const { r } = await rodar();
    expect(r.status).toBe('deleted');
  });

  it('⭐ inscrição: lado trocado, rótulo recalculado, e-mail privado apagado, grupo atualizado', async () => {
    const { get } = await rodar();
    expect(get('tournament_registrations/r1').label).toBe(`${REMOVED_ATHLETE} / Bia Real`);
    expect(get('tournament_registrations/r1').player_a_email).toBeNull();
    expect(get('tournament_registrations/r1/private/contact')).toEqual({
      player_a_email: null, player_a_email_lc: null, player_b_email: 'bia@gmail.com',
    });
    expect(get('tournament_groups/g1').entrants).toEqual([
      { id: 'r1', label: `${REMOVED_ATHLETE} / Bia Real` }, { id: 'r2', label: 'Outra' },
    ]);
  });

  it('⭐ dia de jogo: participante e jogo pseudonimizados; a outra pessoa intacta', async () => {
    const { get } = await rodar();
    expect(get('game_days/d1/participants/px')).toEqual({ user_id: X, name: REMOVED_ATHLETE, photo_url: null });
    expect(get('game_days/d1/participants/py').name).toBe('Bia Real');
    const jogo = get('game_days/d1/games/j1');
    expect(jogo.side_a[0]).toEqual({ id: 'px', name: REMOVED_ATHLETE, user_id: X });
    expect(jogo.side_b[0].name).toBe('Bia Real');
  });

  it('⭐ conversa: a mensagem da pessoa perde o conteúdo; a da outra fica', async () => {
    const { get } = await rodar();
    expect(get('conversations/c1/messages/m1').text).toBe(REMOVED_MESSAGE);
    expect(get('conversations/c1/messages/m2').text).toBe('oi');
    expect(get('conversations/c1').members[0].name).toBe(REMOVED_USER);
  });

  it('fórum: comentário fica sem autor, voto some, tópico alheio intacto', async () => {
    const { get } = await rodar();
    expect(get('club_forum_threads/f1/comments/k1')).toEqual({ author_id: X, author_name: REMOVED_USER, body: 'concordo' });
    expect(get('club_forum_threads/f1/poll_votes/x')).toBeUndefined();
    expect(get('club_forum_threads/f1').author_name).toBe('Bia Real');
  });

  it('⭐ evento achado pela presença que é APAGADA: a descoberta vem antes da escrita', async () => {
    const { get } = await rodar();
    expect(get('club_event_rsvps/e1_x')).toBeUndefined();
    expect(get('club_events/e1/participants/q1').name).toBe(REMOVED_ATHLETE);
    expect(get('club_events/e1/date_rsvps/d_x')).toBeUndefined();
    expect(get('club_events/e1').created_by_name).toBe('Bia Real');
  });

  it('reserva retida com o valor', async () => {
    const { get } = await rodar();
    expect(get('arena_bookings/b1')).toEqual({ athlete_id: X, athlete_name: REMOVED_ATHLETE, price: 90 });
  });

  it('⭐ nenhum documento de OUTRA pessoa foi apagado', async () => {
    const { db } = await rodar();
    const apagados = db.store.log.filter(([t]) => t === 'delete').map(([, p]) => p);
    expect(apagados.sort()).toEqual([
      'athlete_profiles/x',
      'club_event_rsvps/e1_x',
      'club_events/e1/date_rsvps/d_x',
      'club_forum_threads/f1/poll_votes/x',
      'users/x',
    ].sort());
  });
});
