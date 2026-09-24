/**
 * Regras das coleções dos MÓDULOS ADICIONAIS DA ARENA.
 *
 * Estes testes existem por causa de uma família de defeitos que estava em
 * produção desde que as regras foram escritas: condições de `delete` e de
 * `read` olhando `request.resource.data`.
 *
 *   - Num `delete` **não existe** `request.resource` ⇒ a condição é sempre
 *     falsa ⇒ NINGUÉM conseguia apagar professor, aula, cupom, campanha,
 *     checklist, dispositivo, ladder, produto/entrada/saída de estoque.
 *   - Numa `read` idem ⇒ a arena NUNCA conseguiu ler o próprio NPS nem as
 *     próprias ordens de manutenção.
 *
 * E dois casos de escrita larga demais:
 *
 *   - `arena_sales` e `arena_payments` com `create: if isAuthed()` — qualquer
 *     conta forjava venda/pagamento em QUALQUER arena, com qualquer valor.
 *   - `arena_referrals` com `create: if isAuthed()` — dava para criar
 *     indicação apontando OUTRA pessoa como indicadora.
 *
 * Metade dos testes prova a correção; a outra metade prova o que NÃO pode ter
 * mudado (o gestor continua podendo, o estranho continua não podendo).
 */
import { readFileSync } from 'node:fs';
import { beforeAll, afterAll, beforeEach, describe, it } from 'vitest';
import {
  initializeTestEnvironment, assertSucceeds, assertFails,
} from '@firebase/rules-unit-testing';
import {
  doc, getDoc, setDoc, updateDoc, deleteDoc, getDocs, collection, query, where,
  arrayUnion, arrayRemove, increment, serverTimestamp,
} from 'firebase/firestore';

const ADMIN = 'admin_uid';
const GESTOR = 'gestor_uid';
const ATLETA = 'atleta_uid';
const ESTRANHO = 'estranho_uid';
const PROF = 'prof_uid';
const ARENA = 'arena_1';
const ARENA_2 = 'arena_2';
const REDE = 'rede_1';

let testEnv;

beforeAll(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: 'picklerush-arena-modules-test',
    firestore: {
      rules: readFileSync('firestore.rules', 'utf8'),
      host: '127.0.0.1',
      port: 8080,
    },
  });
});
afterAll(async () => { await testEnv?.cleanup(); });

/** Semeia um documento em cada coleção, com as regras desligadas. */
beforeEach(async () => {
  await testEnv.clearFirestore();
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    await setDoc(doc(db, 'users', ADMIN), { uid: ADMIN, role: 'platform_admin' });
    await setDoc(doc(db, 'users', GESTOR), { uid: GESTOR, role: 'user' });
    await setDoc(doc(db, 'users', ATLETA), { uid: ATLETA, role: 'user' });
    await setDoc(doc(db, 'users', ESTRANHO), { uid: ESTRANHO, role: 'user' });
    await setDoc(doc(db, 'arenas', ARENA), { name: 'Arena 1', owner_id: GESTOR });
    await setDoc(doc(db, 'arena_managers', `${ARENA}_${GESTOR}`), {
      arena_id: ARENA, user_id: GESTOR,
    });
    // Uma SEGUNDA arena, de OUTRO dono — é contra ela que se prova que a rede
    // não deixa ninguém puxar a unidade alheia para dentro do próprio grupo.
    await setDoc(doc(db, 'arenas', ARENA_2), { name: 'Arena 2', owner_id: ESTRANHO });
    await setDoc(doc(db, 'arena_managers', `${ARENA_2}_${ESTRANHO}`), {
      arena_id: ARENA_2, user_id: ESTRANHO,
    });
    await setDoc(doc(db, 'arena_networks', REDE), {
      id: REDE, name: 'Rede do gestor', owner_id: GESTOR, owner_arena_id: ARENA, arenas: [ARENA],
    });

    const daArena = { arena_id: ARENA };
    await setDoc(doc(db, 'arena_coaches', 'c1'), { ...daArena, name: 'Prof' });
    await setDoc(doc(db, 'arena_classes', 'cl1'), { ...daArena, title: 'Aula' });
    await setDoc(doc(db, 'arena_coupons', 'cp1'), { ...daArena, code: 'X' });
    await setDoc(doc(db, 'arena_campaigns', 'cm1'), { ...daArena, title: 'Volte' });
    await setDoc(doc(db, 'arena_checklists', 'ck1'), { ...daArena, kind: 'abertura' });
    await setDoc(doc(db, 'arena_devices', 'd1'), { ...daArena, name: 'Totem' });
    await setDoc(doc(db, 'arena_ladders', 'l1'), { ...daArena, season: '2026' });
    await setDoc(doc(db, 'arena_maintenance_orders', 'm1'), { ...daArena, title: 'Rede' });
    await setDoc(doc(db, 'arena_nps_responses', 'n1'), { ...daArena, user_id: ATLETA, score: 9 });
    await setDoc(doc(db, 'arena_class_bookings', 'b1'), { ...daArena, user_id: ATLETA });
    await setDoc(doc(db, 'arena_inventory_products', 'ip1'), { ...daArena, name: 'Água' });
    await setDoc(doc(db, 'arena_inventory_entries', 'ie1'), { ...daArena, qty: 10 });
    await setDoc(doc(db, 'arena_inventory_exits', 'ix1'), { ...daArena, qty: 2 });
    // Uma reserva confirmada do ATLETA, para provar de quem é a chegada.
    await setDoc(doc(db, 'arena_bookings', 'ab1'), {
      arena_id: ARENA, athlete_id: ATLETA, status: 'confirmed',
      slots: [{ date: '2026-09-14', start: '19:00', end: '20:00' }],
    });
    await setDoc(doc(db, 'arena_module_states', `${ARENA}_members`), {
      arena_id: ARENA, module_id: 'members', enabled: true,
    });
  });
});

const como = (uid) => testEnv.authenticatedContext(uid).firestore();
const anon = () => testEnv.unauthenticatedContext().firestore();

/* ---------------------------------------------------------------- */
/*  🐞 O gestor não conseguia APAGAR nada                            */
/* ---------------------------------------------------------------- */

describe('🐞 delete olhava request.resource (nulo em delete)', () => {
  const casos = [
    ['arena_coaches', 'c1'],
    ['arena_classes', 'cl1'],
    ['arena_coupons', 'cp1'],
    ['arena_campaigns', 'cm1'],
    ['arena_checklists', 'ck1'],
    ['arena_devices', 'd1'],
    ['arena_ladders', 'l1'],
    ['arena_maintenance_orders', 'm1'],
    ['arena_inventory_products', 'ip1'],
    ['arena_inventory_entries', 'ie1'],
    ['arena_inventory_exits', 'ix1'],
  ];

  casos.forEach(([col, id]) => {
    it(`o gestor apaga em ${col}`, async () => {
      await assertSucceeds(deleteDoc(doc(como(GESTOR), col, id)));
    });

    it(`o estranho NÃO apaga em ${col}`, async () => {
      await assertFails(deleteDoc(doc(como(ESTRANHO), col, id)));
    });
  });

  it('o admin da plataforma também apaga', async () => {
    await assertSucceeds(deleteDoc(doc(como(ADMIN), 'arena_coaches', 'c1')));
  });
});

/* ---------------------------------------------------------------- */
/*  🐞 A arena não conseguia LER o próprio NPS / manutenção          */
/* ---------------------------------------------------------------- */

describe('🐞 read olhava request.resource (nulo em leitura)', () => {
  it('a arena lê o próprio NPS', async () => {
    await assertSucceeds(getDoc(doc(como(GESTOR), 'arena_nps_responses', 'n1')));
  });

  it('quem respondeu vê a própria resposta', async () => {
    await assertSucceeds(getDoc(doc(como(ATLETA), 'arena_nps_responses', 'n1')));
  });

  it('um estranho NÃO lê o NPS da arena', async () => {
    await assertFails(getDoc(doc(como(ESTRANHO), 'arena_nps_responses', 'n1')));
  });

  it('a arena lê as próprias ordens de manutenção', async () => {
    await assertSucceeds(getDoc(doc(como(GESTOR), 'arena_maintenance_orders', 'm1')));
  });

  it('um estranho NÃO lê a manutenção da arena', async () => {
    await assertFails(getDoc(doc(como(ESTRANHO), 'arena_maintenance_orders', 'm1')));
  });
});

/* ---------------------------------------------------------------- */
/*  🔒 Venda e pagamento não podem ser forjados                      */
/* ---------------------------------------------------------------- */

describe('🔒 venda e pagamento', () => {
  it('o comprador registra a PRÓPRIA compra', async () => {
    await assertSucceeds(setDoc(doc(como(ATLETA), 'arena_sales', 's1'), {
      arena_id: ARENA, buyer_id: ATLETA, total: 10,
    }));
  });

  it('a arena registra a venda no balcão', async () => {
    await assertSucceeds(setDoc(doc(como(GESTOR), 'arena_sales', 's2'), {
      arena_id: ARENA, buyer_id: ATLETA, total: 10,
    }));
  });

  it('🐞 um estranho NÃO forja venda em nome de outro', async () => {
    await assertFails(setDoc(doc(como(ESTRANHO), 'arena_sales', 's3'), {
      arena_id: ARENA, buyer_id: ATLETA, total: 9999,
    }));
  });

  it('quem paga registra o PRÓPRIO pagamento', async () => {
    await assertSucceeds(setDoc(doc(como(ATLETA), 'arena_payments', 'p1'), {
      arena_id: ARENA, payer_id: ATLETA, amount: 10,
    }));
  });

  it('🐞 um estranho NÃO forja pagamento de outro', async () => {
    await assertFails(setDoc(doc(como(ESTRANHO), 'arena_payments', 'p2'), {
      arena_id: ARENA, payer_id: ATLETA, amount: 10,
    }));
  });
});

/* ---------------------------------------------------------------- */
/*  🔒 Indicação só em nome próprio                                  */
/* ---------------------------------------------------------------- */

describe('🔒 indique e ganhe', () => {
  it('indico em nome próprio', async () => {
    await assertSucceeds(setDoc(doc(como(ATLETA), 'arena_referrals', 'r1'), {
      arena_id: ARENA, referrer_id: ATLETA, referred_id: ESTRANHO,
    }));
  });

  it('🐞 NÃO crio indicação apontando outra pessoa como indicadora', async () => {
    await assertFails(setDoc(doc(como(ESTRANHO), 'arena_referrals', 'r2'), {
      arena_id: ARENA, referrer_id: ATLETA, referred_id: ESTRANHO,
    }));
  });
});

/* ---------------------------------------------------------------- */
/*  🐞 A arena não conseguia cancelar uma aula                       */
/* ---------------------------------------------------------------- */

/* ---------------------------------------------------------------- */
/*  Aulas dentro da arena (2026-09-24)                               */
/* ---------------------------------------------------------------- */

describe('⭐ o PROFESSOR vê os alunos da própria aula', () => {
  beforeEach(async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      const db = ctx.firestore();
      // O cadastro de professor é da ARENA — é ele que diz quem é o professor.
      await setDoc(doc(db, 'arena_coaches', 'cprof'), { arena_id: ARENA, name: 'Prof', user_id: PROF });
      await setDoc(doc(db, 'arena_coaches', 'coutro'), { arena_id: ARENA, name: 'Outro', user_id: ESTRANHO });
      await setDoc(doc(db, 'arena_classes', 'aula1'), { arena_id: ARENA, coach_id: 'cprof', price: 80 });
      await setDoc(doc(db, 'arena_class_bookings', 'aula1_' + ATLETA), {
        arena_id: ARENA, class_id: 'aula1', coach_id: 'cprof', user_id: ATLETA, paid: false,
      });
    });
  });

  it('🐞 o professor lê a matrícula da aula dele (antes via "ninguém matriculado")', async () => {
    await assertSucceeds(getDoc(doc(como(PROF), 'arena_class_bookings', 'aula1_' + ATLETA)));
  });

  it('o professor LISTA as matrículas filtrando por coach_id', async () => {
    const q = query(collection(como(PROF), 'arena_class_bookings'), where('coach_id', '==', 'cprof'));
    await assertSucceeds(getDocs(q));
  });

  it('outro professor da mesma arena NÃO lê os alunos alheios', async () => {
    await assertFails(getDoc(doc(como(ESTRANHO), 'arena_class_bookings', 'aula1_' + ATLETA)));
  });

  it('o professor NÃO marca pagamento (é da arena)', async () => {
    await assertFails(updateDoc(doc(como(PROF), 'arena_class_bookings', 'aula1_' + ATLETA), { paid: true }));
  });

  it('🐞 a ARENA lista os alunos da aula filtrando por arena_id + class_id', async () => {
    const q = query(
      collection(como(GESTOR), 'arena_class_bookings'),
      where('arena_id', '==', ARENA), where('class_id', '==', 'aula1'),
    );
    await assertSucceeds(getDocs(q));
  });

  it('só por class_id a regra NÃO consegue provar (era a consulta antiga — a lista vinha vazia)', async () => {
    const q = query(collection(como(GESTOR), 'arena_class_bookings'), where('class_id', '==', 'aula1'));
    await assertFails(getDocs(q));
  });

  it('um estranho não lista os alunos da arena', async () => {
    const q = query(
      collection(como(ESTRANHO), 'arena_class_bookings'),
      where('arena_id', '==', ARENA), where('class_id', '==', 'aula1'),
    );
    await assertFails(getDocs(q));
  });

  it('a arena continua lendo e marcando o pagamento', async () => {
    await assertSucceeds(getDoc(doc(como(GESTOR), 'arena_class_bookings', 'aula1_' + ATLETA)));
    await assertSucceeds(updateDoc(doc(como(GESTOR), 'arena_class_bookings', 'aula1_' + ATLETA), { paid: true }));
  });
});

describe('🔒 a matrícula do aluno não decide o que é da arena', () => {
  beforeEach(async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      const db = ctx.firestore();
      await setDoc(doc(db, 'arena_classes', 'aula2'), { arena_id: ARENA, price: 80 });
      await setDoc(doc(db, 'arena_class_bookings', 'aula2_' + ATLETA), {
        arena_id: ARENA, class_id: 'aula2', user_id: ATLETA, paid: false, amount: 80,
      });
    });
  });

  const matricula = (over = {}) => ({
    arena_id: ARENA, class_id: 'aula2', user_id: ESTRANHO, paid: false, amount: 80, ...over,
  });

  it('a matrícula normal continua funcionando', async () => {
    await assertSucceeds(setDoc(doc(como(ESTRANHO), 'arena_class_bookings', 'aula2_' + ESTRANHO), matricula()));
  });

  it('não dá para se matricular já PAGO', async () => {
    await assertFails(setDoc(doc(como(ESTRANHO), 'arena_class_bookings', 'aula2_' + ESTRANHO), matricula({ paid: true })));
  });

  it('não dá para plantar a matrícula na lista de OUTRA arena', async () => {
    await assertFails(setDoc(doc(como(ESTRANHO), 'arena_class_bookings', 'aula2_' + ESTRANHO), matricula({ arena_id: ARENA_2 })));
  });

  it('não dá para se matricular em nome de outra pessoa', async () => {
    await assertFails(setDoc(doc(como(ESTRANHO), 'arena_class_bookings', 'aula2_x'), matricula({ user_id: ATLETA })));
  });

  it('o aluno não se marca como PAGO depois', async () => {
    await assertFails(updateDoc(doc(como(ATLETA), 'arena_class_bookings', 'aula2_' + ATLETA), { paid: true }));
  });

  it('o aluno não mexe no valor', async () => {
    await assertFails(updateDoc(doc(como(ATLETA), 'arena_class_bookings', 'aula2_' + ATLETA), { amount: 0 }));
  });

  it('o aluno continua podendo DESMARCAR a própria aula', async () => {
    await assertSucceeds(deleteDoc(doc(como(ATLETA), 'arena_class_bookings', 'aula2_' + ATLETA)));
  });
});

describe('🐞 o ATLETA se inscreve no torneio da casa (antes: toda inscrição recusada)', () => {
  const VAGA = { user_id: ATLETA, name: 'Atleta', photo_url: null, level: null };
  const OUTRO = { user_id: 'outro_uid', name: 'Outro', photo_url: null, level: null };

  beforeEach(async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      const db = ctx.firestore();
      await setDoc(doc(db, 'arena_internal_tournaments', 't_aberto'), {
        arena_id: ARENA, name: 'Copa', status: 'scheduled', game_day_id: null,
        max_participants: 8, enrolled: 1, participants: ['outro_uid'], roster: [OUTRO],
      });
      await setDoc(doc(db, 'arena_internal_tournaments', 't_inscrito'), {
        arena_id: ARENA, name: 'Copa 2', status: 'scheduled', game_day_id: null,
        max_participants: 8, enrolled: 2, participants: ['outro_uid', ATLETA], roster: [OUTRO, VAGA],
      });
      await setDoc(doc(db, 'arena_internal_tournaments', 't_lotado'), {
        arena_id: ARENA, name: 'Copa cheia', status: 'scheduled', game_day_id: null,
        max_participants: 1, enrolled: 1, participants: ['outro_uid'], roster: [OUTRO],
      });
      await setDoc(doc(db, 'arena_internal_tournaments', 't_rolando'), {
        arena_id: ARENA, name: 'Copa rolando', status: 'running', game_day_id: 'gd1',
        max_participants: 8, enrolled: 1, participants: ['outro_uid'], roster: [OUTRO],
      });
    });
  });

  // O mesmo formato que o serviço (`joinTournament`) grava.
  const entrar = (uid, extra = {}) => ({
    participants: arrayUnion(uid),
    roster: arrayUnion({ ...VAGA, user_id: uid }),
    enrolled: increment(1),
    updated_at: serverTimestamp(),
    ...extra,
  });

  it('⭐ o atleta ENTRA no torneio', async () => {
    await assertSucceeds(updateDoc(doc(como(ATLETA), 'arena_internal_tournaments', 't_aberto'), entrar(ATLETA)));
  });

  it('⭐ o atleta SAI do torneio (reescrevendo o roster sem ele)', async () => {
    await assertSucceeds(updateDoc(doc(como(ATLETA), 'arena_internal_tournaments', 't_inscrito'), {
      participants: arrayRemove(ATLETA), roster: [OUTRO], enrolled: 1, updated_at: serverTimestamp(),
    }));
  });

  it('não inscreve OUTRA pessoa', async () => {
    await assertFails(updateDoc(doc(como(ATLETA), 'arena_internal_tournaments', 't_aberto'), entrar('terceiro_uid')));
  });

  it('não TIRA outra pessoa', async () => {
    await assertFails(updateDoc(doc(como(ATLETA), 'arena_internal_tournaments', 't_inscrito'), {
      participants: arrayRemove('outro_uid'), roster: [VAGA], enrolled: 1, updated_at: serverTimestamp(),
    }));
  });

  it('não entra em torneio LOTADO', async () => {
    await assertFails(updateDoc(doc(como(ATLETA), 'arena_internal_tournaments', 't_lotado'), entrar(ATLETA)));
  });

  it('não entra depois que o torneio COMEÇOU', async () => {
    await assertFails(updateDoc(doc(como(ATLETA), 'arena_internal_tournaments', 't_rolando'), entrar(ATLETA)));
  });

  it('não muda mais nada do torneio junto (nome, prêmio, status)', async () => {
    await assertFails(updateDoc(doc(como(ATLETA), 'arena_internal_tournaments', 't_aberto'), entrar(ATLETA, { name: 'Minha copa' })));
    await assertFails(updateDoc(doc(como(ATLETA), 'arena_internal_tournaments', 't_aberto'), entrar(ATLETA, { status: 'finished' })));
  });

  it('não apaga o roster dos outros ao entrar', async () => {
    await assertFails(updateDoc(doc(como(ATLETA), 'arena_internal_tournaments', 't_aberto'), {
      participants: arrayUnion(ATLETA), roster: [VAGA], enrolled: increment(1), updated_at: serverTimestamp(),
    }));
  });

  it('não infla a contagem de inscritos', async () => {
    await assertFails(updateDoc(doc(como(ATLETA), 'arena_internal_tournaments', 't_aberto'), entrar(ATLETA, { enrolled: increment(5) })));
  });

  it('a arena continua editando o torneio', async () => {
    await assertSucceeds(updateDoc(doc(como(GESTOR), 'arena_internal_tournaments', 't_aberto'), { name: 'Copa da Casa' }));
  });
});

describe('💳 pacote de horas: o atleta PEDE, a arena CREDITA', () => {
  // O botão "Comprar" gravava a carteira pelo atleta e falhava sempre. A
  // regra está CERTA: se o atleta escrevesse a própria carteira, bastaria
  // gravar um pacote para ter horas sem pagar. O pedido virou aviso à arena.
  const carteira = (over = {}) => ({
    arena_id: ARENA, user_id: ATLETA, balance: 0, total_spent: 500,
    packages: [{ pkg_id: 'p1', total_hours: 10, used_hours: 0 }], ...over,
  });

  it('o atleta NÃO se dá horas escrevendo a própria carteira', async () => {
    await assertFails(setDoc(doc(como(ATLETA), 'arena_wallets', `${ARENA}_${ATLETA}`), carteira()));
  });

  it('a arena credita o pacote na carteira do atleta', async () => {
    await assertSucceeds(setDoc(doc(como(GESTOR), 'arena_wallets', `${ARENA}_${ATLETA}`), carteira()));
  });

  it('o atleta continua LENDO a própria carteira', async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'arena_wallets', `${ARENA}_${ATLETA}`), carteira());
    });
    await assertSucceeds(getDoc(doc(como(ATLETA), 'arena_wallets', `${ARENA}_${ATLETA}`)));
  });
});

describe('🐞 reserva de aula', () => {
  it('o aluno cancela a própria aula', async () => {
    await assertSucceeds(deleteDoc(doc(como(ATLETA), 'arena_class_bookings', 'b1')));
  });

  it('a arena também cancela (antes não conseguia)', async () => {
    await assertSucceeds(deleteDoc(doc(como(GESTOR), 'arena_class_bookings', 'b1')));
  });

  it('um estranho não mexe na aula alheia', async () => {
    await assertFails(deleteDoc(doc(como(ESTRANHO), 'arena_class_bookings', 'b1')));
  });
});

/* ---------------------------------------------------------------- */
/*  Camadas 1 e 2 — liberação e opt-in                               */
/* ---------------------------------------------------------------- */

describe('camada 1 — liberação da plataforma', () => {
  it('qualquer pessoa LÊ o que foi liberado (a página da arena depende disso)', async () => {
    await assertSucceeds(getDoc(doc(anon(), 'platform_settings', 'arena_modules')));
  });

  it('só o admin da plataforma ESCREVE a liberação', async () => {
    await assertSucceeds(setDoc(doc(como(ADMIN), 'platform_settings', 'arena_modules'), {
      modules: { members: { released: true, mode: 'opt_in' } },
    }));
  });

  it('o gestor da arena NÃO libera módulo para si mesmo', async () => {
    await assertFails(setDoc(doc(como(GESTOR), 'platform_settings', 'arena_modules'), {
      modules: { members: { released: true, mode: 'opt_in' } },
    }));
  });
});

describe('camada 2 — opt-in da arena', () => {
  it('o gestor liga um módulo na própria arena', async () => {
    await assertSucceeds(setDoc(doc(como(GESTOR), 'arena_module_states', `${ARENA}_pdv`), {
      arena_id: ARENA, module_id: 'pdv', enabled: true,
    }));
  });

  it('o gestor desliga o que ligou', async () => {
    await assertSucceeds(updateDoc(
      doc(como(GESTOR), 'arena_module_states', `${ARENA}_members`),
      { enabled: false },
    ));
  });

  it('um estranho NÃO liga módulo em arena que não é dele', async () => {
    await assertFails(setDoc(doc(como(ESTRANHO), 'arena_module_states', `${ARENA}_pdv`), {
      arena_id: ARENA, module_id: 'pdv', enabled: true,
    }));
  });

  it('o atleta LÊ o que a arena ligou (precisa saber o que ela oferece)', async () => {
    await assertSucceeds(getDoc(doc(como(ATLETA), 'arena_module_states', `${ARENA}_members`)));
  });

  it('o gestor apaga o estado do módulo da própria arena', async () => {
    await assertSucceeds(deleteDoc(
      doc(como(GESTOR), 'arena_module_states', `${ARENA}_members`),
    ));
  });
});


/* ---------------------------------------------------------------- */
/*  🐞 Multi-unidade: a arena não conseguia criar a PRÓPRIA rede      */
/* ---------------------------------------------------------------- */

describe('🐞 rede de unidades: era só do admin da plataforma', () => {
  it('⭐ o gestor cria a rede da arena dele', async () => {
    // Antes: `allow create: if isPlatformAdmin()`. O módulo é oferecido à
    // ARENA, que ligava, abria a tela, clicava e recebia permissão negada.
    await assertSucceeds(setDoc(doc(como(GESTOR), 'arena_networks', 'nova'), {
      id: 'nova', name: 'Minha rede', owner_id: GESTOR, owner_arena_id: ARENA, arenas: [ARENA],
    }));
  });

  it('⭐ NÃO cria rede em nome de arena que ele não administra', async () => {
    await assertFails(setDoc(doc(como(GESTOR), 'arena_networks', 'nova'), {
      id: 'nova', name: 'Rede alheia', owner_id: GESTOR, owner_arena_id: ARENA_2, arenas: [ARENA_2],
    }));
  });

  it('⭐ NÃO cria rede se declarar OUTRA pessoa como dona', async () => {
    await assertFails(setDoc(doc(como(GESTOR), 'arena_networks', 'nova'), {
      id: 'nova', name: 'Rede', owner_id: ESTRANHO, owner_arena_id: ARENA, arenas: [ARENA],
    }));
  });

  it('o dono edita a própria rede', async () => {
    await assertSucceeds(updateDoc(doc(como(GESTOR), 'arena_networks', REDE), {
      name: 'Rede renomeada', owner_id: GESTOR,
    }));
  });

  it('⭐ editar não transfere a rede para outra pessoa', async () => {
    await assertFails(updateDoc(doc(como(GESTOR), 'arena_networks', REDE), {
      owner_id: ESTRANHO,
    }));
  });

  it('quem não é dono não edita a rede', async () => {
    await assertFails(updateDoc(doc(como(ESTRANHO), 'arena_networks', REDE), { name: 'X' }));
  });

  it('o dono apaga a própria rede; o estranho não', async () => {
    await assertFails(deleteDoc(doc(como(ESTRANHO), 'arena_networks', REDE)));
    await assertSucceeds(deleteDoc(doc(como(GESTOR), 'arena_networks', REDE)));
  });

  it('o admin da plataforma continua podendo tudo', async () => {
    await assertSucceeds(setDoc(doc(como(ADMIN), 'arena_networks', 'adm'), {
      id: 'adm', name: 'Rede do admin', owner_id: ADMIN, owner_arena_id: ARENA_2, arenas: [],
    }));
  });
});

describe('🐞 vínculo de unidade: as DUAS condições são necessárias', () => {
  it('⭐ o dono da rede inclui a arena que ele administra', async () => {
    await assertSucceeds(setDoc(doc(como(GESTOR), 'arena_network_memberships', `${REDE}_${ARENA}`), {
      id: `${REDE}_${ARENA}`, network_id: REDE, arena_id: ARENA,
    }));
  });

  it('⭐ o dono da rede NÃO puxa a arena dos outros para dentro dela', async () => {
    // Senão eu colocaria a sua unidade na minha rede e passaria a ver os
    // números dela no BI consolidado.
    await assertFails(setDoc(doc(como(GESTOR), 'arena_network_memberships', `${REDE}_${ARENA_2}`), {
      id: `${REDE}_${ARENA_2}`, network_id: REDE, arena_id: ARENA_2,
    }));
  });

  it('⭐ quem administra a arena NÃO a enfia na rede alheia', async () => {
    // Senão eu poluiria a rede de outra pessoa com uma unidade que ninguém
    // convidou — e ela apareceria nos números somados dela.
    await assertFails(setDoc(doc(como(ESTRANHO), 'arena_network_memberships', `${REDE}_${ARENA_2}`), {
      id: `${REDE}_${ARENA_2}`, network_id: REDE, arena_id: ARENA_2,
    }));
  });

  it('rede inexistente não aceita vínculo', async () => {
    await assertFails(setDoc(doc(como(GESTOR), 'arena_network_memberships', `fantasma_${ARENA}`), {
      id: `fantasma_${ARENA}`, network_id: 'fantasma', arena_id: ARENA,
    }));
  });

  it('⭐ quem administra a unidade pode SAIR da rede', async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'arena_network_memberships', `${REDE}_${ARENA}`), {
        id: `${REDE}_${ARENA}`, network_id: REDE, arena_id: ARENA,
      });
    });
    // Prender uma arena numa rede seria a pior parte do módulo.
    await assertSucceeds(deleteDoc(
      doc(como(GESTOR), 'arena_network_memberships', `${REDE}_${ARENA}`),
    ));
  });

  it('um terceiro não tira ninguém da rede', async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'arena_network_memberships', `${REDE}_${ARENA}`), {
        id: `${REDE}_${ARENA}`, network_id: REDE, arena_id: ARENA,
      });
    });
    await assertFails(deleteDoc(
      doc(como(ATLETA), 'arena_network_memberships', `${REDE}_${ARENA}`),
    ));
  });
});


/* ---------------------------------------------------------------- */
/*  Chegada (módulo `iot_qr_kiosk`) — ZERO regra nova                */
/* ---------------------------------------------------------------- */

describe('a chegada não precisou de regra nova', () => {
  const chegada = { checked_in_at: new Date(), checked_in_by: 'athlete' };

  it('⭐ o dono da reserva confirma a PRÓPRIA chegada', async () => {
    // É isto que dispensa regra nova: `arena_bookings` já deixa o titular
    // escrever no próprio documento. Se um dia esta asserção cair, o módulo
    // inteiro para em silêncio — a recusa chega como "permission-denied"
    // genérico, que ninguém liga a um check-in.
    await assertSucceeds(updateDoc(doc(como(ATLETA), 'arena_bookings', 'ab1'), chegada));
  });

  it('⭐ um estranho NÃO confirma a chegada de outra pessoa', async () => {
    await assertFails(updateDoc(doc(como(ESTRANHO), 'arena_bookings', 'ab1'), chegada));
  });

  it('⭐ a arena confirma a chegada de quem reservou (e desfaz)', async () => {
    await assertSucceeds(updateDoc(doc(como(GESTOR), 'arena_bookings', 'ab1'), {
      checked_in_at: new Date(), checked_in_by: 'arena',
    }));
    await assertSucceeds(updateDoc(doc(como(GESTOR), 'arena_bookings', 'ab1'), {
      checked_in_at: null, checked_in_by: null,
    }));
  });

  it('⭐ a arena marca falta; o estranho não', async () => {
    await assertSucceeds(updateDoc(doc(como(GESTOR), 'arena_bookings', 'ab1'), { no_show: true }));
    await assertFails(updateDoc(doc(como(ESTRANHO), 'arena_bookings', 'ab1'), { no_show: true }));
  });

  it('⭐ só o gestor gira o código do totem', async () => {
    const token = { checkin_token: { code: 'AB2CD', expires_at_ms: 1 }, status: 'online' };
    await assertSucceeds(updateDoc(doc(como(GESTOR), 'arena_devices', 'd1'), token));
    // O atleta LÊ o equipamento (a regra é `read: if isAuthed()`), mas não
    // escreve — senão qualquer conta plantaria um código e confirmaria de casa.
    await assertFails(updateDoc(doc(como(ATLETA), 'arena_devices', 'd1'), token));
    await assertFails(updateDoc(doc(como(ESTRANHO), 'arena_devices', 'd1'), token));
  });

  it('o totem só é criado por quem gere a arena', async () => {
    await assertSucceeds(setDoc(doc(como(GESTOR), 'arena_devices', 'd2'), {
      arena_id: ARENA, name: 'Totem 2', kind: 'qr_kiosk',
    }));
    await assertFails(setDoc(doc(como(ATLETA), 'arena_devices', 'd3'), {
      arena_id: ARENA, name: 'Totem pirata', kind: 'qr_kiosk',
    }));
  });
});
