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
import { doc, getDoc, setDoc, updateDoc, deleteDoc } from 'firebase/firestore';

const ADMIN = 'admin_uid';
const GESTOR = 'gestor_uid';
const ATLETA = 'atleta_uid';
const ESTRANHO = 'estranho_uid';
const ARENA = 'arena_1';

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
