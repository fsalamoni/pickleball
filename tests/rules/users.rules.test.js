/**
 * Regras de segurança de `users/{uid}` — achado P0-01 (escalação de privilégio).
 *
 * Contexto: `isPlatformAdmin()` decide autorização lendo `users/{uid}.role`.
 * Se o dono do documento pudesse escrever esse campo, qualquer conta viraria
 * platform_admin. Estes testes provam que não pode — e que TODOS os fluxos
 * reais de escrita da aplicação continuam funcionando.
 *
 * Cada fluxo testado foi mapeado no código-fonte:
 *  - FirebaseAuthContext.jsx:128-176  bootstrap de login (comum e dono)
 *  - FirebaseAuthContext.jsx:252      cadastro com nome
 *  - FirebaseAuthContext.jsx:279      updateUserProfile (perfil, onboarding…)
 *  - athleteService.js:243            setAthleteHidden (moderação pelo admin)
 *  - coachService.js:57               mirrorCoachToUser
 *  - V2AdminOwnerRestore.jsx:68       restauração do dono
 */
import { readFileSync } from 'node:fs';
import { beforeAll, afterAll, beforeEach, describe, it } from 'vitest';
import {
  initializeTestEnvironment,
  assertSucceeds,
  assertFails,
} from '@firebase/rules-unit-testing';
import { doc, getDoc, setDoc, deleteDoc, serverTimestamp } from 'firebase/firestore';

const OWNER_EMAIL = 'fsalamoni@gmail.com';
const OWNER_UID = 'owner_uid';
const USER_UID = 'user_uid';
const OTHER_UID = 'other_uid';
const ADMIN_UID = 'admin_uid';   // platform_admin que NÃO é o dono

let testEnv;

/** Perfil como o FirebaseAuthContext cria de fato (campos que importam). */
function baseProfile(overrides = {}) {
  return {
    uid: 'x',
    email: 'a@b.com',
    full_name: '',
    platform_name: '',
    birth_date: '',
    phone: '',
    photo_url: '',
    city: '',
    state: '',
    phone_public: false,
    email_public: false,
    address_public: false,
    directory_listed: true,
    role: 'user',
    can_create_pools: false,
    created_at: serverTimestamp(),
    updated_at: serverTimestamp(),
    last_login: serverTimestamp(),
    ...overrides,
  };
}

beforeAll(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: 'picklerush-rules-test',
    firestore: {
      rules: readFileSync('firestore.rules', 'utf8'),
      host: '127.0.0.1',
      port: 8080,
    },
  });
});

afterAll(async () => { await testEnv?.cleanup(); });

beforeEach(async () => {
  await testEnv.clearFirestore();
  // Semeia documentos existentes sem passar pelas regras.
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    await setDoc(doc(db, 'users', USER_UID), baseProfile({ uid: USER_UID, email: 'user@x.com' }));
    await setDoc(doc(db, 'users', OTHER_UID), baseProfile({ uid: OTHER_UID, email: 'other@x.com' }));
    await setDoc(doc(db, 'users', OWNER_UID), baseProfile({
      uid: OWNER_UID, email: OWNER_EMAIL, role: 'platform_admin', can_create_pools: true,
    }));
    await setDoc(doc(db, 'users', ADMIN_UID), baseProfile({
      uid: ADMIN_UID, email: 'admin@x.com', role: 'platform_admin', can_create_pools: true,
    }));
  });
});

const asUser  = () => testEnv.authenticatedContext(USER_UID, { email: 'user@x.com' }).firestore();
const asOther = () => testEnv.authenticatedContext(OTHER_UID, { email: 'other@x.com' }).firestore();
const asOwner = () => testEnv.authenticatedContext(OWNER_UID, { email: OWNER_EMAIL }).firestore();
const asAdmin = () => testEnv.authenticatedContext(ADMIN_UID, { email: 'admin@x.com' }).firestore();
const asAnon  = () => testEnv.unauthenticatedContext().firestore();
const NEW_UID = 'brand_new_uid';
const asNew   = () => testEnv.authenticatedContext(NEW_UID, { email: 'new@x.com' }).firestore();
const asNewOwner = () => testEnv.authenticatedContext('new_owner', { email: OWNER_EMAIL }).firestore();

describe('users/{uid} — leitura', () => {
  it('1. o dono lê o próprio documento', async () => {
    await assertSucceeds(getDoc(doc(asUser(), 'users', USER_UID)));
  });
  it('2. um usuário NÃO lê o documento de outro', async () => {
    await assertFails(getDoc(doc(asUser(), 'users', OTHER_UID)));
  });
  it('3. o platform_admin lê o documento de qualquer um', async () => {
    await assertSucceeds(getDoc(doc(asAdmin(), 'users', USER_UID)));
  });
  it('4. anônimo não lê nada', async () => {
    await assertFails(getDoc(doc(asAnon(), 'users', USER_UID)));
  });
});

describe('users/{uid} — criação (primeiro login)', () => {
  it('5. FLUXO REAL: conta nova nasce como role:"user"', async () => {
    await assertSucceeds(setDoc(doc(asNew(), 'users', NEW_UID),
      baseProfile({ uid: NEW_UID, email: 'new@x.com' })));
  });
  it('6. 🔴 conta nova NÃO pode nascer como platform_admin', async () => {
    await assertFails(setDoc(doc(asNew(), 'users', NEW_UID),
      baseProfile({ uid: NEW_UID, role: 'platform_admin' })));
  });
  it('7. 🔴 conta nova NÃO pode nascer com can_create_pools:true', async () => {
    await assertFails(setDoc(doc(asNew(), 'users', NEW_UID),
      baseProfile({ uid: NEW_UID, can_create_pools: true })));
  });
  it('8. 🔴 conta nova NÃO pode nascer com hidden', async () => {
    await assertFails(setDoc(doc(asNew(), 'users', NEW_UID),
      baseProfile({ uid: NEW_UID, hidden: false })));
  });
  it('9. FLUXO REAL: o dono da plataforma nasce como platform_admin', async () => {
    await assertSucceeds(setDoc(doc(asNewOwner(), 'users', 'new_owner'),
      baseProfile({ uid: 'new_owner', email: OWNER_EMAIL,
                    role: 'platform_admin', can_create_pools: true })));
  });
  it('10. ninguém cria o documento de outro usuário', async () => {
    await assertFails(setDoc(doc(asUser(), 'users', 'alheio'), baseProfile()));
  });
});

describe('users/{uid} — 🔴 escalação de privilégio (P0-01)', () => {
  it('11. 🔴 O ATAQUE: usuário comum NÃO se promove a platform_admin', async () => {
    await assertFails(setDoc(doc(asUser(), 'users', USER_UID),
      { role: 'platform_admin' }, { merge: true }));
  });
  it('12. 🔴 nem escrevendo o documento inteiro', async () => {
    await assertFails(setDoc(doc(asUser(), 'users', USER_UID),
      baseProfile({ uid: USER_UID, role: 'platform_admin' })));
  });
  it('13. 🔴 usuário comum NÃO se dá can_create_pools', async () => {
    await assertFails(setDoc(doc(asUser(), 'users', USER_UID),
      { can_create_pools: true }, { merge: true }));
  });
  it('14. 🔴 usuário comum NÃO altera os próprios campos de moderação', async () => {
    await assertFails(setDoc(doc(asUser(), 'users', USER_UID),
      { hidden: false }, { merge: true }));
  });
  it('15. 🔴 admin que NÃO é o dono não se promove além (role imutável por ele)', async () => {
    await assertFails(setDoc(doc(asAdmin(), 'users', ADMIN_UID),
      { role: 'super_admin' }, { merge: true }));
  });
});

describe('users/{uid} — fluxos reais da aplicação continuam funcionando', () => {
  it('16. FLUXO REAL login comum: grava last_login + updated_at', async () => {
    await assertSucceeds(setDoc(doc(asUser(), 'users', USER_UID),
      { last_login: serverTimestamp(), updated_at: serverTimestamp() }, { merge: true }));
  });
  it('17. FLUXO REAL updateUserProfile: edita o perfil', async () => {
    await assertSucceeds(setDoc(doc(asUser(), 'users', USER_UID), {
      platform_name: 'Fernando S.', full_name: 'Fernando Salamoni',
      city: 'São Paulo', state: 'SP', phone: '11999999999',
      birth_date: '1985-03-12', updated_at: serverTimestamp(),
    }, { merge: true }));
  });
  it('18. FLUXO REAL onboarding: interests + onboarding_completed_at', async () => {
    await assertSucceeds(setDoc(doc(asUser(), 'users', USER_UID),
      { interests: ['torneios'], onboarding_completed_at: serverTimestamp(),
        updated_at: serverTimestamp() }, { merge: true }));
  });
  it('19. FLUXO REAL preferências de privacidade', async () => {
    await assertSucceeds(setDoc(doc(asUser(), 'users', USER_UID),
      { phone_public: true, email_public: false, directory_listed: false,
        updated_at: serverTimestamp() }, { merge: true }));
  });
  it('20. FLUXO REAL nivelamento', async () => {
    await assertSucceeds(setDoc(doc(asUser(), 'users', USER_UID),
      { leveling_level: '3.5', leveling_method: 'form',
        updated_at: serverTimestamp() }, { merge: true }));
  });
  it('21. FLUXO REAL mirrorCoachToUser: o próprio usuário vira professor', async () => {
    await assertSucceeds(setDoc(doc(asUser(), 'users', USER_UID),
      { is_coach: true, coach_bio: 'Aulas', coach_price: '120',
        coach_regions: 'SP', coach_modalities: 'simples',
        updated_at: serverTimestamp() }, { merge: true }));
  });
  it('22. FLUXO REAL cadastro com nome (signup)', async () => {
    await assertSucceeds(setDoc(doc(asUser(), 'users', USER_UID),
      { full_name: 'Fulano', platform_name: 'Fulano',
        updated_at: serverTimestamp() }, { merge: true }));
  });
  it('23. FLUXO REAL notification_prefs', async () => {
    await assertSucceeds(setDoc(doc(asUser(), 'users', USER_UID),
      { notification_prefs: { chat: true }, updated_at: serverTimestamp() },
      { merge: true }));
  });
  it('24. FLUXO REAL login do dono: re-grava role:platform_admin (inalterado)', async () => {
    await assertSucceeds(setDoc(doc(asOwner(), 'users', OWNER_UID),
      { role: 'platform_admin', can_create_pools: true,
        last_login: serverTimestamp(), updated_at: serverTimestamp() },
      { merge: true }));
  });
  it('25. FLUXO REAL V2AdminOwnerRestore: o dono restaura o próprio papel', async () => {
    // simula papel corrompido para 'user'
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'users', OWNER_UID),
        { role: 'user', can_create_pools: false }, { merge: true });
    });
    await assertSucceeds(setDoc(doc(asOwner(), 'users', OWNER_UID),
      { role: 'platform_admin', can_create_pools: true,
        restored_at: serverTimestamp(), restored_via: 'V2AdminOwnerRestore',
        updated_at: serverTimestamp() }, { merge: true }));
  });
  it('26. 🔴 mas NÃO-dono não consegue usar o mesmo caminho de restauração', async () => {
    await assertFails(setDoc(doc(asUser(), 'users', USER_UID),
      { role: 'platform_admin', can_create_pools: true,
        restored_at: serverTimestamp(), restored_via: 'V2AdminOwnerRestore',
        updated_at: serverTimestamp() }, { merge: true }));
  });
});

describe('users/{uid} — moderação pelo admin (setAthleteHidden)', () => {
  it('27. FLUXO REAL: admin oculta um atleta', async () => {
    await assertSucceeds(setDoc(doc(asAdmin(), 'users', USER_UID),
      { hidden: true, hidden_at: serverTimestamp(), hidden_by: ADMIN_UID,
        updated_at: serverTimestamp() }, { merge: true }));
  });
  it('28. FLUXO REAL: admin reexibe um atleta', async () => {
    await assertSucceeds(setDoc(doc(asAdmin(), 'users', USER_UID),
      { hidden: false, hidden_at: null, hidden_by: null,
        updated_at: serverTimestamp() }, { merge: true }));
  });
  it('29. 🔴 admin NÃO altera o telefone de um usuário', async () => {
    await assertFails(setDoc(doc(asAdmin(), 'users', USER_UID),
      { phone: '11888888888', updated_at: serverTimestamp() }, { merge: true }));
  });
  it('30. 🔴 admin NÃO promove outro usuário a platform_admin', async () => {
    await assertFails(setDoc(doc(asAdmin(), 'users', USER_UID),
      { role: 'platform_admin' }, { merge: true }));
  });
  it('31. 🔴 usuário comum NÃO oculta outro usuário', async () => {
    await assertFails(setDoc(doc(asUser(), 'users', OTHER_UID),
      { hidden: true, hidden_at: serverTimestamp(), hidden_by: USER_UID,
        updated_at: serverTimestamp() }, { merge: true }));
  });
});

describe('users/{uid} — exclusão', () => {
  it('32. usuário comum não apaga o próprio documento', async () => {
    await assertFails(deleteDoc(doc(asUser(), 'users', USER_UID)));
  });
  it('33. usuário comum não apaga o de outro', async () => {
    await assertFails(deleteDoc(doc(asOther(), 'users', USER_UID)));
  });
  it('34. admin apaga (comportamento existente, preservado)', async () => {
    await assertSucceeds(deleteDoc(doc(asAdmin(), 'users', USER_UID)));
  });
});

describe('users/{uid} — REVOGAÇÃO de poder (assimétrica: só remove)', () => {
  // Contexto: ADMIN_UID é um platform_admin que NÃO é o dono. É exatamente a
  // situação encontrada em produção — contas com `role: platform_admin` que
  // sobraram de um ajuste antigo, e que a regra do P0-01 impedia de rebaixar
  // pela aplicação. Este bloco prova que o dono passa a conseguir revogar, e
  // que ninguém consegue o contrário.

  const revogacao = () => ({
    role: 'user',
    can_create_pools: false,
    role_previous: 'platform_admin',
    role_revoked_at: serverTimestamp(),
    role_revoked_by: OWNER_UID,
    updated_at: serverTimestamp(),
  });

  it('35. ⭐ o DONO revoga o admin de outra conta', async () => {
    await assertSucceeds(setDoc(doc(asOwner(), 'users', ADMIN_UID), revogacao(), { merge: true }));
  });

  it('36. 🔴 a revogação NÃO serve para PROMOVER — nem para o dono', async () => {
    // O ponto central da assimetria: o caminho só aceita chegar em 'user'.
    await assertFails(setDoc(doc(asOwner(), 'users', USER_UID),
      { role: 'platform_admin', updated_at: serverTimestamp() }, { merge: true }));
    await assertFails(setDoc(doc(asOwner(), 'users', USER_UID),
      { role: 'user', can_create_pools: true, updated_at: serverTimestamp() }, { merge: true }));
  });

  it('37. 🔴 um platform_admin que NÃO é o dono não revoga ninguém', async () => {
    await assertFails(setDoc(doc(asAdmin(), 'users', OWNER_UID), revogacao(), { merge: true }));
    await assertFails(setDoc(doc(asAdmin(), 'users', USER_UID), revogacao(), { merge: true }));
  });

  it('38. 🔴 usuário comum não revoga ninguém', async () => {
    await assertFails(setDoc(doc(asUser(), 'users', ADMIN_UID), revogacao(), { merge: true }));
  });

  it('39. 🔴 a revogação não é brecha para editar OUTROS campos', async () => {
    await assertFails(setDoc(doc(asOwner(), 'users', ADMIN_UID),
      { ...revogacao(), phone: '11999999999' }, { merge: true }));
    await assertFails(setDoc(doc(asOwner(), 'users', ADMIN_UID),
      { ...revogacao(), email: 'trocado@x.com' }, { merge: true }));
  });

  it('40. o dono PODE escrever o próprio documento — e isso é proposital', async () => {
    // Anotação honesta: a regra nova traz `request.auth.uid != userId`, mas
    // isso NÃO impede o auto-rebaixamento, porque o branch anterior
    // (`isOwner(userId) && isPlatformOwnerEmail()`) já libera o dono a
    // escrever o próprio documento — regras do Firebase são OR, e um bloco
    // restritivo ao lado de um permissivo não restringe nada.
    //
    // Isso é a ESCOTILHA DE EMERGÊNCIA e tem de continuar existindo: foi por
    // ela que o dono recuperou o acesso da última vez. Sem ela, um role
    // corrompido tranca o dono para fora da própria plataforma.
    //
    // Logo, impedir o clique errado na PRÓPRIA linha é responsabilidade da
    // INTERFACE (o botão não é renderizado para si mesmo), coberta em
    // `accessRoster.test.js`. E o estrago seria reversível de qualquer forma:
    // veja o teste 41.
    await assertSucceeds(setDoc(doc(asOwner(), 'users', OWNER_UID), revogacao(), { merge: true }));
  });

  it('41. o dono continua restaurando o PRÓPRIO admin (escotilha de emergência)', async () => {
    // Não pode ter sido quebrado pela regra nova: é como ele voltou da última
    // vez em que perdeu o acesso.
    await assertSucceeds(setDoc(doc(asOwner(), 'users', OWNER_UID),
      { role: 'platform_admin', can_create_pools: true, updated_at: serverTimestamp() },
      { merge: true }));
  });
});
