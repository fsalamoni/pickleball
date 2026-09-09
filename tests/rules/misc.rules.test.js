/**
 * S4 — as três coleções que faltavam na rede de regressão de regras:
 * `notifications`, `athlete_profiles` e `conversations`.
 *
 * Em `notifications` isto também prova o P1-06: o sino tem a credibilidade da
 * interface oficial, e `allow create: if isAuthed()` deixava qualquer conta
 * escrever nele com texto e LINK arbitrários. Metade destes testes é dedicada
 * ao que NÃO pode ter mudado — as 48 chamadas legítimas do
 * `notificationService` têm de continuar passando.
 */
import { readFileSync } from 'node:fs';
import { beforeAll, afterAll, beforeEach, describe, it } from 'vitest';
import {
  initializeTestEnvironment, assertSucceeds, assertFails,
} from '@firebase/rules-unit-testing';
import {
  doc, getDoc, setDoc, addDoc, updateDoc, deleteDoc, getDocs, collection,
  query, where, serverTimestamp,
} from 'firebase/firestore';

const ADMIN_UID = 'admin_uid';
const EU = 'eu_uid';
const OUTRO = 'outro_uid';
const TERCEIRO = 'terceiro_uid';

let testEnv;

beforeAll(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: 'picklerush-misc-test',
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
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    await setDoc(doc(db, 'users', ADMIN_UID), { uid: ADMIN_UID, role: 'platform_admin' });
    await setDoc(doc(db, 'users', EU), { uid: EU, role: 'user' });
    await setDoc(doc(db, 'users', OUTRO), { uid: OUTRO, role: 'user' });
    await setDoc(doc(db, 'notifications', 'n_minha'), {
      user_id: EU, title: 'Oi', message: '', type: 'generic', link: null, read: false,
    });
    await setDoc(doc(db, 'notifications', 'n_alheia'), {
      user_id: OUTRO, title: 'Oi', message: '', type: 'generic', link: null, read: false,
    });
    await setDoc(doc(db, 'athlete_profiles', EU), { uid: EU, name: 'Eu' });
    await setDoc(doc(db, 'conversations', 'c1'), {
      member_ids: [EU, OUTRO], created_by: EU, title: 'Conversa',
    });
    await setDoc(doc(db, 'conversations', 'c1', 'messages', 'm1'), {
      sender_id: OUTRO, text: 'oi',
    });
  });
});

const como = (uid) => testEnv.authenticatedContext(uid, { email: `${uid}@x.com` }).firestore();
const anon = () => testEnv.unauthenticatedContext().firestore();

/** Notificação exatamente como `notificationService.buildPayload` monta. */
const notificacaoReal = (over = {}) => ({
  user_id: OUTRO,
  title: 'Nova atividade',
  message: 'Fulano respondeu no fórum',
  type: 'forum_reply',
  link: '/clubes/abc?tab=forum',
  data: null,
  actor_id: EU,
  actor_name: 'Eu',
  read: false,
  read_at: null,
  created_at: serverTimestamp(),
  created_at_ms: Date.now(),
  ...over,
});

describe('notifications — leitura e escrita do dono', () => {
  it('1. leio a MINHA notificação', async () => {
    await assertSucceeds(getDoc(doc(como(EU), 'notifications', 'n_minha')));
  });
  it('2. ⭐ NÃO leio a notificação de outro', async () => {
    await assertFails(getDoc(doc(como(EU), 'notifications', 'n_alheia')));
  });
  it('3. anônimo não lê nada', async () => {
    await assertFails(getDoc(doc(anon(), 'notifications', 'n_minha')));
  });
  it('4. marco a MINHA como lida', async () => {
    await assertSucceeds(updateDoc(doc(como(EU), 'notifications', 'n_minha'), { read: true }));
  });
  it('5. ⭐ NÃO marco a de outro como lida', async () => {
    await assertFails(updateDoc(doc(como(EU), 'notifications', 'n_alheia'), { read: true }));
  });
  it('6. só o admin apaga', async () => {
    await assertFails(deleteDoc(doc(como(EU), 'notifications', 'n_minha')));
    await assertSucceeds(deleteDoc(doc(como(ADMIN_UID), 'notifications', 'n_minha')));
  });
});

describe('notifications — P1-06: o que continua funcionando', () => {
  it('7. ⭐ a notificação real do serviço passa (fórum)', async () => {
    await assertSucceeds(addDoc(collection(como(EU), 'notifications'), notificacaoReal()));
  });
  it('8. os links reais da aplicação passam', async () => {
    const links = [
      '/atleta/abc123', '/p/torneio1', '/procura-jogo', '/torneios/t1/admin',
      '/chat?c=conv1', '/clubes/c1?tab=members', '/dia-de-jogo/gd1/telao', null,
    ];
    for (const link of links) {
      // eslint-disable-next-line no-await-in-loop
      await assertSucceeds(addDoc(collection(como(EU), 'notifications'), notificacaoReal({ link })));
    }
  });
  it('9. todos os tipos conhecidos passam', async () => {
    const tipos = [
      'chat_message', 'chat_invite', 'forum_reply', 'forum_mention', 'event_invite',
      'club_join_request', 'club_join_approved', 'club_join_rejected', 'club_invite',
      'club_invite_accepted', 'club_event_published', 'tournament_open',
      'tournament_announcement', 'partner_invite', 'partner_response',
      'profile_reminder', 'leveling_reminder', 'generic',
    ];
    for (const type of tipos) {
      // eslint-disable-next-line no-await-in-loop
      await assertSucceeds(addDoc(collection(como(EU), 'notifications'), notificacaoReal({ type })));
    }
  });
  it('10. o payload de ação (data) continua aceito', async () => {
    await assertSucceeds(addDoc(collection(como(EU), 'notifications'), notificacaoReal({
      type: 'partner_invite',
      data: { kind: 'partner_invite', registration_id: 'r1' },
    })));
  });
});

describe('notifications — P1-06: o que passou a ser barrado', () => {
  it('11. ⭐ link EXTERNO (phishing) é recusado', async () => {
    for (const link of [
      'https://site-falso.com/roubo',
      'http://x.com',
      '//site-falso.com',
      'javascript:alert(1)',
    ]) {
      // eslint-disable-next-line no-await-in-loop
      await assertFails(addDoc(collection(como(EU), 'notifications'), notificacaoReal({ link })));
    }
  });
  it('12. ⭐ tipo inventado é recusado (não dá para forjar aviso "do sistema")', async () => {
    await assertFails(addDoc(collection(como(EU), 'notifications'), notificacaoReal({
      type: 'security_alert_oficial',
    })));
  });
  it('13. ⭐ título/mensagem gigantes são recusados', async () => {
    await assertFails(addDoc(collection(como(EU), 'notifications'), notificacaoReal({
      title: 'x'.repeat(301),
    })));
    await assertFails(addDoc(collection(como(EU), 'notifications'), notificacaoReal({
      message: 'x'.repeat(601),
    })));
  });

  it('13b. ⭐ o limite do SERVIÇO (140/300) passa folgado, inclusive com emoji', async () => {
    // O serviço corta em unidades UTF-16 do JS; a regra conta caracteres. Um
    // título no limite, cheio de emoji, não pode ser recusado por causa dessa
    // diferença de contagem — é o que esta folga garante.
    await assertSucceeds(addDoc(collection(como(EU), 'notifications'), notificacaoReal({
      title: '🎾'.repeat(70),          // 140 unidades JS, 70 caracteres
      message: '🏓 vamos jogar! '.repeat(20),
    })));
  });
  it('14. ⭐ não dá para criar já marcada como lida', async () => {
    await assertFails(addDoc(collection(como(EU), 'notifications'), notificacaoReal({ read: true })));
  });
  it('15. ⭐ destinatário vazio é recusado', async () => {
    await assertFails(addDoc(collection(como(EU), 'notifications'), notificacaoReal({ user_id: '' })));
  });
  it('16. anônimo não cria notificação', async () => {
    await assertFails(addDoc(collection(anon(), 'notifications'), notificacaoReal()));
  });
});

describe('athlete_profiles', () => {
  it('17. qualquer autenticado lê (diretório de atletas)', async () => {
    await assertSucceeds(getDoc(doc(como(OUTRO), 'athlete_profiles', EU)));
  });
  it('18. ⭐ anônimo NÃO lê o diretório', async () => {
    await assertFails(getDoc(doc(anon(), 'athlete_profiles', EU)));
  });
  it('19. escrevo o MEU perfil', async () => {
    await assertSucceeds(setDoc(doc(como(EU), 'athlete_profiles', EU), { uid: EU, name: 'Eu 2' }));
  });
  it('20. ⭐ NÃO escrevo o perfil de outro', async () => {
    await assertFails(setDoc(doc(como(OUTRO), 'athlete_profiles', EU), { uid: EU, name: 'Invadido' }));
  });
  it('21. o admin escreve (restauração de perfil corrompido)', async () => {
    await assertSucceeds(setDoc(doc(como(ADMIN_UID), 'athlete_profiles', EU), { uid: EU, name: 'Restaurado' }));
  });
});

describe('conversations', () => {
  it('22. participante lê a conversa', async () => {
    await assertSucceeds(getDoc(doc(como(EU), 'conversations', 'c1')));
  });
  it('23. ⭐ quem não é participante NÃO lê', async () => {
    await assertFails(getDoc(doc(como(TERCEIRO), 'conversations', 'c1')));
  });
  it('24. ⭐ anônimo não lê', async () => {
    await assertFails(getDoc(doc(anon(), 'conversations', 'c1')));
  });
  it('25. a lista só devolve as minhas conversas', async () => {
    await assertSucceeds(getDocs(query(
      collection(como(EU), 'conversations'), where('member_ids', 'array-contains', EU),
    )));
    await assertFails(getDocs(collection(como(EU), 'conversations')));
  });
  it('26. crio conversa da qual participo', async () => {
    await assertSucceeds(setDoc(doc(como(EU), 'conversations', 'c2'), {
      member_ids: [EU, OUTRO], created_by: EU,
    }));
  });
  it('27. ⭐ NÃO crio conversa da qual não participo', async () => {
    await assertFails(setDoc(doc(como(EU), 'conversations', 'c3'), {
      member_ids: [OUTRO, TERCEIRO], created_by: EU,
    }));
  });
  it('28. ⭐ NÃO crio conversa em nome de outro', async () => {
    await assertFails(setDoc(doc(como(EU), 'conversations', 'c4'), {
      member_ids: [EU, OUTRO], created_by: OUTRO,
    }));
  });
  it('29. participante lê as mensagens', async () => {
    await assertSucceeds(getDoc(doc(como(EU), 'conversations', 'c1', 'messages', 'm1')));
  });
  it('30. ⭐ quem não é participante NÃO lê as mensagens', async () => {
    await assertFails(getDoc(doc(como(TERCEIRO), 'conversations', 'c1', 'messages', 'm1')));
  });
  it('31. ⭐ NÃO dá para enviar mensagem no nome de outro', async () => {
    await assertFails(setDoc(doc(como(EU), 'conversations', 'c1', 'messages', 'm2'), {
      sender_id: OUTRO, text: 'forjada',
    }));
  });
  it('32. ⭐ só o autor edita/apaga a própria mensagem', async () => {
    await assertFails(deleteDoc(doc(como(EU), 'conversations', 'c1', 'messages', 'm1')));
    await assertSucceeds(deleteDoc(doc(como(OUTRO), 'conversations', 'c1', 'messages', 'm1')));
  });
});
