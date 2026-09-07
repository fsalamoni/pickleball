/**
 * Regras do Firebase Storage — achado P1-05.
 *
 * ⚠️ LIÇÃO QUE ESTES TESTES GUARDAM: quando vários `match` alcançam o mesmo
 * caminho, o Storage concede acesso se QUALQUER um permitir. Uma primeira
 * versão deste bloco adicionou apenas o `private/` restritivo e **não
 * protegeu nada** — o bloco genérico continuava liberando. O emulador
 * mostrou isso. Por isso o genérico precisa excluir `private` explicitamente.
 *
 * Estes testes cobrem as duas metades: o que passou a ser protegido, e o que
 * NÃO pode ter mudado (foto de perfil, foto de torneio, anexo de chat).
 */
import { readFileSync } from 'node:fs';
import { beforeAll, afterAll, beforeEach, describe, it } from 'vitest';
import {
  initializeTestEnvironment, assertSucceeds, assertFails,
} from '@firebase/rules-unit-testing';
import { ref, uploadBytes, getBytes, deleteObject } from 'firebase/storage';

const DONO = 'dono_uid';
const OUTRO = 'outro_uid';
const bytes = () => new Uint8Array([0xff, 0xd8, 0xff, 0xd9]);
let env;

beforeAll(async () => {
  env = await initializeTestEnvironment({
    projectId: 'picklerush-storage-test',
    storage: { rules: readFileSync('storage.rules', 'utf8'), host: '127.0.0.1', port: 9199 },
  });
});
afterAll(async () => { await env?.cleanup(); });

beforeEach(async () => {
  await env.clearStorage();
  await env.withSecurityRulesDisabled(async (ctx) => {
    const st = ctx.storage();
    await uploadBytes(ref(st, 'uploads/dono_uid/private/comprovante.jpg'), bytes());
    await uploadBytes(ref(st, 'uploads/dono_uid/misc/foto-perfil.jpg'), bytes());
    await uploadBytes(ref(st, 'uploads/dono_uid/attachments/anexo.pdf'), bytes());
    await uploadBytes(ref(st, 'uploads/dono_uid/arquivo-solto.jpg'), bytes());
  });
});

const asDono  = () => env.authenticatedContext(DONO).storage();
const asOutro = () => env.authenticatedContext(OUTRO).storage();
const asAnon  = () => env.unauthenticatedContext().storage();

describe('private/ — o que passou a ser protegido', () => {
  it('1. 🔴 outro usuário NÃO lê arquivo privado alheio', async () => {
    await assertFails(getBytes(ref(asOutro(), 'uploads/dono_uid/private/comprovante.jpg')));
  });
  it('2. o dono lê o próprio arquivo privado', async () => {
    await assertSucceeds(getBytes(ref(asDono(), 'uploads/dono_uid/private/comprovante.jpg')));
  });
  it('3. o dono grava no próprio private/', async () => {
    await assertSucceeds(uploadBytes(ref(asDono(), 'uploads/dono_uid/private/novo.jpg'), bytes()));
  });
  it('4. 🔴 outro usuário NÃO grava no private/ alheio', async () => {
    await assertFails(uploadBytes(ref(asOutro(), 'uploads/dono_uid/private/invasor.jpg'), bytes()));
  });
  it('5. 🔴 outro usuário NÃO apaga arquivo privado alheio', async () => {
    await assertFails(deleteObject(ref(asOutro(), 'uploads/dono_uid/private/comprovante.jpg')));
  });
  it('6. 🔴 nem em subpasta mais funda', async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      await uploadBytes(ref(ctx.storage(), 'uploads/dono_uid/private/a/b/c.jpg'), bytes());
    });
    await assertFails(getBytes(ref(asOutro(), 'uploads/dono_uid/private/a/b/c.jpg')));
  });
  it('7. anônimo não lê nada do private/', async () => {
    await assertFails(getBytes(ref(asAnon(), 'uploads/dono_uid/private/comprovante.jpg')));
  });
});

describe('⭐ NÃO PODE TER MUDADO — uploads existentes', () => {
  it('8. outro usuário LÊ a foto de perfil (é exibida no diretório)', async () => {
    await assertSucceeds(getBytes(ref(asOutro(), 'uploads/dono_uid/misc/foto-perfil.jpg')));
  });
  it('9. outro usuário LÊ anexo de chat (é exibido na conversa)', async () => {
    await assertSucceeds(getBytes(ref(asOutro(), 'uploads/dono_uid/attachments/anexo.pdf')));
  });
  it('10. o dono grava na própria pasta comum', async () => {
    await assertSucceeds(uploadBytes(ref(asDono(), 'uploads/dono_uid/misc/nova.jpg'), bytes()));
  });
  it('11. 🔴 outro usuário NÃO grava na pasta alheia (como antes)', async () => {
    await assertFails(uploadBytes(ref(asOutro(), 'uploads/dono_uid/misc/invasor.jpg'), bytes()));
  });
  it('12. o dono apaga o próprio arquivo', async () => {
    await assertSucceeds(deleteObject(ref(asDono(), 'uploads/dono_uid/misc/foto-perfil.jpg')));
  });
  it('13. 🔴 outro usuário NÃO apaga arquivo alheio (como antes)', async () => {
    await assertFails(deleteObject(ref(asOutro(), 'uploads/dono_uid/misc/foto-perfil.jpg')));
  });
  it('14. subpasta funda comum segue legível', async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      await uploadBytes(ref(ctx.storage(), 'uploads/dono_uid/market/l1/0.jpg'), bytes());
    });
    await assertSucceeds(getBytes(ref(asOutro(), 'uploads/dono_uid/market/l1/0.jpg')));
  });
  it('15. compat: arquivo solto sem pasta segue legível', async () => {
    await assertSucceeds(getBytes(ref(asOutro(), 'uploads/dono_uid/arquivo-solto.jpg')));
  });
  it('16. anônimo não lê nada, em lugar nenhum (como antes)', async () => {
    await assertFails(getBytes(ref(asAnon(), 'uploads/dono_uid/misc/foto-perfil.jpg')));
  });
  it('17. 🔴 caminho fora de uploads/ segue bloqueado', async () => {
    await assertFails(uploadBytes(ref(asDono(), 'outro-lugar/x.jpg'), bytes()));
  });
});
