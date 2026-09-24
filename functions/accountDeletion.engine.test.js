/**
 * Exclusão de cadastro no servidor — a CASCATA, contra um Firestore falso.
 *
 * O que estes testes protegem (é aqui que um erro apaga o que não devia):
 *
 *  1. conta BLOQUEADA não perde nada — nem a conta de login;
 *  2. a ordem: conta de login PRIMEIRO, `users/{uid}` POR ÚLTIMO;
 *  3. falha ao apagar a conta de login = nada é apagado no banco;
 *  4. o que é de outras pessoas não é apagado — é pseudonimizado;
 *  5. contador de pai só é mexido se o pai existe;
 *  6. rodar duas vezes é seguro;
 *  7. a auditoria fica gravada, com o motivo.
 */
import { describe, it, expect } from 'vitest';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const {
  analyzeAccount, executeAccountDeletion, patchFlatFields, REMOVED_ATHLETE,
} = require('../functions/accountDeletion.js');
const {
  createFakeDb, createFakeAuth, createFakeBucket, FakeFieldValue,
} = require('../tests/fakes/fakeFirestore.cjs');

const HOJE = '2026-09-24';
const ADMIN = { uid: 'admin', name: 'Dono', email: 'dono@x.com' };

/** Uma especificação de pseudonimização de exemplo, igual às reais. */
const INSCRICAO = {
  col: 'tournament_registrations',
  wheres: [['player_a_user_id', '=='], ['player_b_user_id', '==']],
  label: 'Inscrições em torneio',
  patch: (d, uid) => patchFlatFields(d, uid, [
    { idField: 'player_a_user_id', name: ['player_a_name'], clear: ['player_a_photo'] },
    { idField: 'player_b_user_id', name: ['player_b_name'], clear: ['player_b_photo'] },
  ]),
};
const RESERVA = {
  col: 'arena_bookings', wheres: [['athlete_id', '==']], bucket: 'retained', label: 'Reservas de quadra',
  patch: (d, uid) => patchFlatFields(d, uid, [{ idField: 'athlete_id', name: ['athlete_name'] }]),
};

function cenario(extra = {}) {
  const db = createFakeDb({
    'users/t1': { uid: 't1', full_name: 'Teste Um', email: 't1@example.com' },
    'athlete_profiles/t1': { uid: 't1', name: 'Teste Um' },
    'player_ratings/t1': { rating: 1500 },
    'notifications/n1': { user_id: 't1', text: 'oi' },
    'notifications/n2': { user_id: 'outro', text: 'oi' },
    'club_members/c1_t1': { user_id: 't1', club_id: 'c1', role: 'member' },
    'clubs/c1': { name: 'Clube', member_count: 5 },
    'club_members/fantasma_t1': { user_id: 't1', club_id: 'fantasma', role: 'member' },
    'tournament_registrations/r1': {
      player_a_user_id: 't1', player_a_name: 'Teste Um', player_a_photo: 'http://f',
      player_b_user_id: 'real', player_b_name: 'Pessoa Real',
    },
    'arena_bookings/b1': { athlete_id: 't1', athlete_name: 'Teste Um', price: 80 },
    ...extra,
  });
  // Auth e banco escrevem no MESMO registro: é o que permite provar a ordem.
  const auth = createFakeAuth(['t1', 'real'], { log: db.store.log });
  const bucket = createFakeBucket(['uploads/t1/profile/a.jpg', 'uploads/real/profile/b.jpg']);
  const ctx = { db, auth, bucket, pseudoSpecs: [INSCRICAO, RESERVA] };
  return { db, auth, bucket, ctx };
}

const executar = (ctx, uid = 't1') => executeAccountDeletion(ctx, uid, {
  actor: ADMIN, reason: 'conta de teste', hojeISO: HOJE, FieldValue: FakeFieldValue,
});

describe('a prévia só LÊ', () => {
  it('⭐ monta o relatório sem gravar nada', async () => {
    const { db, ctx, auth } = cenario();
    const antes = new Map(db.store.docs);
    const { report } = await analyzeAccount(ctx, 't1', { actorUid: 'admin', hojeISO: HOJE });
    expect(report.canDelete).toBe(true);
    expect(report.deletes.find((d) => d.label === 'Notificações').count).toBe(1);
    expect(report.deletes.find((d) => d.label === 'Fotos e arquivos enviados').count).toBe(1);
    expect(report.pseudonyms.find((d) => d.label === 'Inscrições em torneio').count).toBe(1);
    expect(report.retained.find((d) => d.label === 'Reservas de quadra').count).toBe(1);
    expect(db.store.log).toEqual([]);
    expect(auth.log).toEqual([]);
    expect(db.store.docs).toEqual(antes);
  });
});

describe('a execução', () => {
  it('⭐ apaga o que é só da pessoa', async () => {
    const { db, ctx, auth, bucket } = cenario();
    const r = await executar(ctx);
    expect(r.status).toBe('deleted');
    expect(db.store.docs.has('users/t1')).toBe(false);
    expect(db.store.docs.has('athlete_profiles/t1')).toBe(false);
    expect(db.store.docs.has('player_ratings/t1')).toBe(false);
    expect(db.store.docs.has('notifications/n1')).toBe(false);
    expect(db.store.docs.has('club_members/c1_t1')).toBe(false);
    expect(auth.contas.has('t1')).toBe(false);
    expect(bucket.arquivos).toEqual(['uploads/real/profile/b.jpg']);
  });

  it('⭐ não toca no que é de outras pessoas', async () => {
    const { db, ctx, auth, bucket } = cenario();
    await executar(ctx);
    expect(db.store.docs.has('notifications/n2')).toBe(true);
    expect(auth.contas.has('real')).toBe(true);
    expect(bucket.arquivos).toContain('uploads/real/profile/b.jpg');
  });

  it('⭐ pseudonimiza o histórico: o lado da pessoa muda, o da dupla não', async () => {
    const { db, ctx } = cenario();
    await executar(ctx);
    const reg = db.store.docs.get('tournament_registrations/r1');
    expect(reg.player_a_name).toBe(REMOVED_ATHLETE);
    expect(reg.player_a_photo).toBeNull();
    expect(reg.player_a_user_id).toBe('t1'); // o uid fica: é o que mantém o resultado de pé
    expect(reg.player_b_name).toBe('Pessoa Real');
  });

  it('⭐ reserva é RETIDA (valor intacto), só o nome sai', async () => {
    const { db, ctx } = cenario();
    await executar(ctx);
    expect(db.store.docs.get('arena_bookings/b1')).toEqual({ athlete_id: 't1', athlete_name: REMOVED_ATHLETE, price: 80 });
  });

  it('⭐ contador do clube desce; clube que não existe não é criado', async () => {
    const { db, ctx } = cenario();
    await executar(ctx);
    expect(db.store.docs.get('clubs/c1').member_count).toBe(4);
    expect(db.store.docs.has('clubs/fantasma')).toBe(false);
    expect(db.store.docs.has('club_members/fantasma_t1')).toBe(false);
  });

  it('⭐ ordem: conta de login antes de tudo, `users` depois de tudo', async () => {
    const { db, ctx } = cenario();
    await executar(ctx);
    // a PRIMEIRA escrita de qualquer tipo é a conta de login
    expect(db.store.log[0]).toEqual(['deleteUser', 't1']);
    const apagados = db.store.log.filter(([t]) => t === 'delete').map(([, p]) => p);
    expect(apagados[apagados.length - 1]).toBe('users/t1');
    expect(db.store.log[db.store.log.length - 1][0]).toBe('add'); // auditoria por último
  });

  it('⭐ grava a auditoria com o motivo e o que foi feito', async () => {
    const { db, ctx } = cenario();
    await executar(ctx);
    const audit = [...db.store.docs.entries()].find(([p]) => p.startsWith('audit_logs/'))[1];
    expect(audit.action).toBe('admin_account_deleted');
    expect(audit.actor_id).toBe('admin');
    expect(audit.user_id).toBe('t1');
    expect(audit.details.reason).toBe('conta de teste');
    expect(audit.details.conta_de_login_excluida).toBe(true);
    expect(audit.details.pseudonimizados).toEqual([{ item: 'Inscrições em torneio', qtd: 1 }]);
  });

  it('⭐ rodar de novo é seguro — e termina o que faltou', async () => {
    const { db, ctx } = cenario();
    await executar(ctx);
    const depois = new Map([...db.store.docs].filter(([p]) => !p.startsWith('audit_logs/')));
    const r2 = await executar(ctx);
    expect(r2.status).toBe('deleted');
    const depois2 = new Map([...db.store.docs].filter(([p]) => !p.startsWith('audit_logs/')));
    expect(depois2).toEqual(depois);
  });
});

describe('o que impede', () => {
  it('⭐ conta BLOQUEADA não perde nada — nem a conta de login', async () => {
    const { db, ctx, auth } = cenario({ 'arenas/a1': { name: 'Central', owner_id: 't1' } });
    const antes = new Map(db.store.docs);
    const r = await executar(ctx);
    expect(r.status).toBe('blocked');
    expect(r.report.blockers[0].label).toMatch(/arena "Central"/);
    expect(auth.log).toEqual([]);
    expect(db.store.log).toEqual([]);
    expect(db.store.docs).toEqual(antes);
  });

  it('⭐ admin não é excluído, mesmo que o pedido chegue', async () => {
    const { db, ctx, auth } = cenario({ 'users/t1': { uid: 't1', role: 'platform_admin', email: 'x@y.com' } });
    const r = await executar(ctx);
    expect(r.status).toBe('blocked');
    expect(auth.log).toEqual([]);
    expect(db.store.docs.has('users/t1')).toBe(true);
  });

  it('⭐ falha ao apagar a conta de login = nada é apagado no banco', async () => {
    const { db, ctx } = cenario();
    ctx.auth = createFakeAuth(['t1'], { failOn: ['t1'], log: db.store.log });
    const antes = new Map(db.store.docs);
    const r = await executar(ctx);
    expect(r.status).toBe('error');
    expect(db.store.docs).toEqual(antes);
  });

  it('conta de login que já não existe não impede terminar a limpeza', async () => {
    const { db, ctx } = cenario();
    ctx.auth = createFakeAuth([]);
    const r = await executar(ctx);
    expect(r.status).toBe('deleted');
    expect(db.store.docs.has('users/t1')).toBe(false);
  });
});
