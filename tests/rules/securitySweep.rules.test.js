/**
 * Varredura de segurança (2026-10-10): as brechas de "o id é a credencial" e
 * de "o update confere só o valor NOVO". Cada caso prova o ataque recusado e
 * o fluxo legítimo de pé.
 */
import { readFileSync } from 'node:fs';
import { beforeAll, afterAll, beforeEach, describe, it } from 'vitest';
import {
  initializeTestEnvironment, assertSucceeds, assertFails,
} from '@firebase/rules-unit-testing';
import { doc, setDoc, updateDoc, deleteDoc, getDoc } from 'firebase/firestore';

const DONO = 'dono_uid';
const GESTOR = 'gestor_uid';
const ATLETA = 'atleta_uid';
const INVASOR = 'invasor_uid';
const ALICE = 'alice_uid';
const BOB = 'bob_uid';
const ARENA = 'arenaA';
const ARENA_INV = 'arenaB';
const CLUBE = 'clubeV';
const CLUBE_INV = 'clubeI';
const TORNEIO = 'torneioV';
const TORNEIO_INV = 'torneioI';

let testEnv;
const as = (uid) => testEnv.authenticatedContext(uid, { email: `${uid}@x.com`, email_verified: true }).firestore();

beforeAll(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: 'picklerush-security-sweep-test',
    firestore: { rules: readFileSync('firestore.rules', 'utf8'), host: '127.0.0.1', port: 8080 },
  });
});
afterAll(async () => { await testEnv?.cleanup(); });

beforeEach(async () => {
  await testEnv.clearFirestore();
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    for (const u of [DONO, GESTOR, ATLETA, INVASOR, ALICE, BOB]) await setDoc(doc(db, 'users', u), { uid: u, role: 'user' });
    // Arenas: a vítima (A) e a do invasor (B).
    await setDoc(doc(db, 'arenas', ARENA), { id: ARENA, owner_id: DONO, allow_instant_booking: false });
    await setDoc(doc(db, 'arenas', ARENA_INV), { id: ARENA_INV, owner_id: INVASOR });
    await setDoc(doc(db, 'arena_managers', `${ARENA}_${DONO}`), { arena_id: ARENA, user_id: DONO, role: 'owner' });
    await setDoc(doc(db, 'arena_managers', `${ARENA}_${GESTOR}`), { arena_id: ARENA, user_id: GESTOR, role: 'manager' });
    await setDoc(doc(db, 'arena_managers', `${ARENA_INV}_${INVASOR}`), { arena_id: ARENA_INV, user_id: INVASOR, role: 'owner' });
    await setDoc(doc(db, 'arena_courts', 'q1'), { arena_id: ARENA, name: 'Quadra 1' });
    // Clubes: o da vítima e o do invasor.
    await setDoc(doc(db, 'clubs', CLUBE), { created_by: DONO });
    await setDoc(doc(db, 'clubs', CLUBE_INV), { created_by: INVASOR });
    // Torneios.
    await setDoc(doc(db, 'tournaments', TORNEIO), { creator_uid: DONO, archived: false });
    await setDoc(doc(db, 'tournaments', TORNEIO_INV), { creator_uid: INVASOR, archived: false });
    await setDoc(doc(db, 'tournament_admins', `${TORNEIO}_${DONO}`), { tournament_id: TORNEIO, user_id: DONO });
    await setDoc(doc(db, 'tournament_admins', `${TORNEIO_INV}_${INVASOR}`), { tournament_id: TORNEIO_INV, user_id: INVASOR });
    await setDoc(doc(db, 'tournament_matches', 'm1'), { tournament_id: TORNEIO, modality_id: 'mod1', score_a: 0 });
    await setDoc(doc(db, 'tournament_modalities', 'mod1'), { tournament_id: TORNEIO, entry_fee_cents: 0 });
    await setDoc(doc(db, 'tournament_modalities', 'modPaga'), { tournament_id: TORNEIO, entry_fee_cents: 5000 });
    await setDoc(doc(db, 'tournament_registrations', 'regV'), {
      tournament_id: TORNEIO, modality_id: 'mod1', created_by: ATLETA, user_id: ATLETA, player_a_user_id: ATLETA, status: 'confirmed',
    });
    await setDoc(doc(db, 'tournament_registrations', 'regI'), {
      tournament_id: TORNEIO, modality_id: 'mod1', created_by: INVASOR, user_id: INVASOR, player_a_user_id: INVASOR, status: 'confirmed',
    });
  });
});

describe('clube: o id do vínculo é a credencial', () => {
  it('o dono de um clube não vira admin do clube alheio gravando o id dele', async () => {
    await assertFails(setDoc(doc(as(INVASOR), 'club_members', `${CLUBE}_${INVASOR}`), {
      club_id: CLUBE_INV, user_id: INVASOR, role: 'admin',
    }));
  });
  it('o criador ainda se registra como admin do próprio clube', async () => {
    await assertSucceeds(setDoc(doc(as(INVASOR), 'club_members', `${CLUBE_INV}_${INVASOR}`), {
      club_id: CLUBE_INV, user_id: INVASOR, role: 'admin',
    }));
  });
});

describe('arena: o update confere a arena ATUAL', () => {
  it('o gestor de B não puxa a quadra de A para a sua arena', async () => {
    await assertFails(updateDoc(doc(as(INVASOR), 'arena_courts', 'q1'), { arena_id: ARENA_INV }));
  });
  it('o gestor de A edita a própria quadra', async () => {
    await assertSucceeds(updateDoc(doc(as(GESTOR), 'arena_courts', 'q1'), { name: 'Central' }));
  });
  it('carteira {A}_{uid} não nasce com a arena B', async () => {
    await assertFails(setDoc(doc(as(INVASOR), 'arena_wallets', `${ARENA}_${ATLETA}`), {
      arena_id: ARENA_INV, user_id: ATLETA, balance: 0,
    }));
    await assertSucceeds(setDoc(doc(as(GESTOR), 'arena_wallets', `${ARENA}_${ATLETA}`), {
      arena_id: ARENA, user_id: ATLETA, balance: 0,
    }));
  });
  it('o gestor não se torna dono da arena nem tira o vínculo do dono', async () => {
    await assertFails(updateDoc(doc(as(GESTOR), 'arenas', ARENA), { owner_id: GESTOR }));
    await assertSucceeds(updateDoc(doc(as(GESTOR), 'arenas', ARENA), { name: 'Nova' }));
    await assertFails(deleteDoc(doc(as(GESTOR), 'arena_managers', `${ARENA}_${DONO}`)));
  });
});

describe('reserva: o atleta pede, a arena confirma', () => {
  const pedido = (over = {}) => ({
    arena_id: ARENA, athlete_id: ATLETA, court_id: 'q1', status: 'requested',
    agreed_price: null, payment_status: 'none', proposed_price: 100, ...over,
  });
  it('não nasce confirmada nem paga numa arena sem reserva instantânea', async () => {
    await assertFails(setDoc(doc(as(ATLETA), 'arena_bookings', 'b1'), pedido({ status: 'confirmed' })));
    await assertFails(setDoc(doc(as(ATLETA), 'arena_bookings', 'b1'), pedido({ payment_status: 'paid' })));
    await assertSucceeds(setDoc(doc(as(ATLETA), 'arena_bookings', 'b1'), pedido()));
  });
  it('o atleta não confirma o próprio pedido; aceita a proposta da arena pelo valor proposto', async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'arena_bookings', 'b2'), pedido());
      await setDoc(doc(ctx.firestore(), 'arena_bookings', 'b3'), pedido({ status: 'negotiating', proposed_price: 120, proposed_by: 'arena' }));
    });
    await assertFails(updateDoc(doc(as(ATLETA), 'arena_bookings', 'b2'), { status: 'confirmed', agreed_price: 1 }));
    await assertFails(updateDoc(doc(as(ATLETA), 'arena_bookings', 'b3'), { status: 'confirmed', agreed_price: 1 }));
    await assertSucceeds(updateDoc(doc(as(ATLETA), 'arena_bookings', 'b3'), { status: 'confirmed', agreed_price: 120 }));
  });
  it('o atleta cancela e contrapropõe; a arena confirma', async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'arena_bookings', 'b4'), pedido());
    });
    await assertSucceeds(updateDoc(doc(as(ATLETA), 'arena_bookings', 'b4'), { proposed_price: 90, proposed_by: 'athlete', status: 'negotiating' }));
    await assertFails(updateDoc(doc(as(ATLETA), 'arena_bookings', 'b4'), { proposed_price: 80, proposed_by: 'arena' }));
    await assertSucceeds(updateDoc(doc(as(GESTOR), 'arena_bookings', 'b4'), { status: 'confirmed', agreed_price: 90 }));
    await assertFails(updateDoc(doc(as(ATLETA), 'arena_bookings', 'b4'), { payment_status: 'paid' }));
    await assertSucceeds(updateDoc(doc(as(ATLETA), 'arena_bookings', 'b4'), { status: 'cancelled' }));
  });
});

describe('torneio: o torneio do documento ATUAL decide', () => {
  it('o dono de outro torneio não reescreve o placar gravando o id dele', async () => {
    await assertFails(updateDoc(doc(as(INVASOR), 'tournament_matches', 'm1'), { tournament_id: TORNEIO_INV, score_a: 11 }));
    await assertSucceeds(updateDoc(doc(as(DONO), 'tournament_matches', 'm1'), { score_a: 11 }));
  });
  it('a modalidade não muda de torneio', async () => {
    await assertFails(updateDoc(doc(as(INVASOR), 'tournament_modalities', 'mod1'), { tournament_id: TORNEIO_INV }));
  });
});

describe('inscrição: o inscrito não se dá vaga', () => {
  it('não nasce confirmada em modalidade com taxa; nasce em modalidade sem taxa', async () => {
    const base = { tournament_id: TORNEIO, created_by: ATLETA, user_id: ATLETA, seed: null };
    await assertFails(setDoc(doc(as(ATLETA), 'tournament_registrations', 'n1'), { ...base, modality_id: 'modPaga', status: 'confirmed' }));
    await assertSucceeds(setDoc(doc(as(ATLETA), 'tournament_registrations', 'n2'), { ...base, modality_id: 'modPaga', status: 'pending_payment' }));
    await assertSucceeds(setDoc(doc(as(ATLETA), 'tournament_registrations', 'n3'), { ...base, modality_id: 'mod1', status: 'confirmed' }));
  });
  it('o inscrito faz check-in e desiste, mas não sai da fila sozinho', async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'tournament_registrations', 'w1'), {
        tournament_id: TORNEIO, modality_id: 'mod1', created_by: ATLETA, status: 'waitlist',
      });
    });
    await assertFails(updateDoc(doc(as(ATLETA), 'tournament_registrations', 'w1'), { status: 'confirmed' }));
    await assertSucceeds(updateDoc(doc(as(ATLETA), 'tournament_registrations', 'regV'), { status: 'checked_in' }));
    await assertSucceeds(updateDoc(doc(as(ATLETA), 'tournament_registrations', 'w1'), { status: 'cancelled' }));
  });
});

describe('prova provisória: o id é amarrado à inscrição', () => {
  it('não grava a prova da inscrição alheia apontando para a minha', async () => {
    await assertFails(setDoc(doc(as(INVASOR), 'provisional_claims', 'regV_a'), {
      registration_id: 'regI', slot: 'a', email_lc: `${INVASOR}@x.com`,
    }));
    await assertSucceeds(setDoc(doc(as(INVASOR), 'provisional_claims', 'regI_b'), {
      registration_id: 'regI', slot: 'b', email_lc: 'parceiro@x.com',
    }));
  });
});

describe('dia de jogo: arena e clube são de quem é da arena e do clube', () => {
  it('qualquer conta não cria dia "da arena A" (fecharia o calendário dela)', async () => {
    await assertFails(setDoc(doc(as(INVASOR), 'game_days', 'g1'), { created_by: INVASOR, arena_id: ARENA, visibility: 'public', member_uids: [] }));
    await assertSucceeds(setDoc(doc(as(GESTOR), 'game_days', 'g2'), { created_by: GESTOR, arena_id: ARENA, visibility: 'public', member_uids: [] }));
    await assertSucceeds(setDoc(doc(as(ATLETA), 'game_days', 'g3'), { created_by: ATLETA, visibility: 'public', member_uids: [ATLETA] }));
  });
  it('o criador não muda o dia para a arena alheia depois', async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'game_days', 'g4'), { created_by: INVASOR, visibility: 'public', member_uids: [] });
    });
    await assertFails(updateDoc(doc(as(INVASOR), 'game_days', 'g4'), { arena_id: ARENA }));
    await assertSucceeds(updateDoc(doc(as(INVASOR), 'game_days', 'g4'), { title: 'Noite' }));
  });
});

describe('conversa direta: só os dois', () => {
  it('um terceiro não cria antes o DM de outras duas pessoas', async () => {
    await assertFails(setDoc(doc(as(INVASOR), 'conversations', `dm_${ALICE}__${BOB}`), {
      type: 'direct', member_ids: [INVASOR, ALICE, BOB], created_by: INVASOR,
    }));
    await assertSucceeds(setDoc(doc(as(ALICE), 'conversations', `dm_${ALICE}__${BOB}`), {
      type: 'direct', member_ids: [ALICE, BOB], created_by: ALICE,
    }));
  });
  it('membro não inclui um terceiro; sai e oculta', async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'conversations', 'grp'), {
        type: 'group', member_ids: [ALICE, BOB], members: [{ uid: ALICE }, { uid: BOB }], created_by: ALICE, hidden_for: [],
      });
      await setDoc(doc(ctx.firestore(), 'conversations', 'grp', 'messages', 'msg'), { sender_id: ALICE, sender_name: 'Alice', text: 'oi' });
    });
    await assertFails(updateDoc(doc(as(BOB), 'conversations', 'grp'), { member_ids: [ALICE, BOB, INVASOR] }));
    await assertSucceeds(updateDoc(doc(as(BOB), 'conversations', 'grp'), { hidden_for: [BOB] }));
    await assertFails(updateDoc(doc(as(ALICE), 'conversations', 'grp', 'messages', 'msg'), { sender_id: BOB }));
    await assertSucceeds(updateDoc(doc(as(ALICE), 'conversations', 'grp', 'messages', 'msg'), { text: 'olá', edited: true }));
    await assertFails(deleteDoc(doc(as(BOB), 'conversations', 'grp')));
    await assertSucceeds(updateDoc(doc(as(BOB), 'conversations', 'grp'), { member_ids: [ALICE], members: [{ uid: ALICE }] }));
  });
});

describe('perfil público: a ocultação é do admin', () => {
  it('o dono não desfaz a ocultação', async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'athlete_profiles', INVASOR), { uid: INVASOR, hidden: true });
    });
    await assertFails(updateDoc(doc(as(INVASOR), 'athlete_profiles', INVASOR), { hidden: false }));
    await assertFails(deleteDoc(doc(as(INVASOR), 'athlete_profiles', INVASOR)));
    await assertSucceeds(updateDoc(doc(as(INVASOR), 'athlete_profiles', INVASOR), { city: 'POA' }));
  });
});

describe('avaliação da arena', () => {
  it('ninguém reescreve a avaliação alheia; a arena responde', async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'arena_reviews', 'r1'), { arena_id: ARENA, user_id: ATLETA, rating: 5 });
    });
    await assertFails(updateDoc(doc(as(INVASOR), 'arena_reviews', 'r1'), { user_id: INVASOR, rating: 1 }));
    await assertSucceeds(updateDoc(doc(as(GESTOR), 'arena_reviews', 'r1'), { response: 'Obrigado!', responded_by: GESTOR }));
    await assertFails(updateDoc(doc(as(GESTOR), 'arena_reviews', 'r1'), { rating: 1 }));
    await assertSucceeds(getDoc(doc(as(ATLETA), 'arena_reviews', 'r1')));
  });
});
