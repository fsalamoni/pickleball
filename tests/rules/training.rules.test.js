/**
 * Regras do CENTRO DE TREINO (flag `training_center`) e as duas correções F0.
 *
 * Sempre com contas que NÃO são admin — `isPlatformAdmin()` na regra esconde
 * qualquer consulta mal filtrada (lição da Onda CB). Prova que:
 *
 *  1. ⭐ item público só entra na biblioteca pela política de revisão
 *     (atleta e professor → fila; professor VERIFICADO → direto; admin decide);
 *  2. ⭐ privado só o autor (e quem recebeu); "meus alunos" só aluno ATIVO;
 *  3. ⭐ ninguém cria em nome de outro, nem como professor sem perfil, nem
 *     como plataforma; o autor não mexe em moderação (oculto, destaque, nota);
 *  4. ⭐ editar um item aprovado (atleta) volta para a fila; compartilhar não;
 *  5. ⭐ envio "para aluno" é EXCLUSIVO do professor com vínculo ATIVO;
 *  6. diário, planos, preferências, dúvidas e denúncias são privados;
 *  7. as CONSULTAS que as telas fazem passam (e a sem filtro do dono não);
 *  8. F0: o aluno só aceita o convite em coach_students; coach_content "só
 *     alunos" exige vínculo ativo.
 *  9. ⭐ o vínculo vale enquanto o professor for professor do aluno: qualquer
 *     um encerra, e o encerrado só volta pelo aceite do aluno.
 */
import { readFileSync } from 'node:fs';
import { beforeAll, afterAll, beforeEach, describe, it } from 'vitest';
import {
  initializeTestEnvironment, assertSucceeds, assertFails,
} from '@firebase/rules-unit-testing';
import {
  addDoc, collection, deleteDoc, deleteField, doc, getDoc, getDocs, query, serverTimestamp, setDoc, updateDoc, where,
  writeBatch,
} from 'firebase/firestore';

const ADMIN = 'admin_uid';
const PROF = 'prof_uid';
const ANA = 'ana_uid'; // aluna ATIVA do PROF
const BIA = 'bia_uid'; // aluna PAUSADA do PROF
const CAIO = 'caio_uid'; // convidado (não aceitou)
const DUDA = 'duda_uid'; // atleta sem vínculo

const item = (over = {}) => ({
  kind: 'drill', title: 'Dink cruzado', summary: 'Dinks cruzados com alvo.',
  author_uid: ANA, author_role: 'atleta', author_name: 'Ana', created_by: ANA,
  visibility: 'privado', review: 'nao_se_aplica', hidden: false, featured: false,
  shared_uids: [], steps: ['Passo 1'], media: [], diagrams: [], blocks: [], schema_version: 1,
  ...over,
});

let testEnv;

beforeAll(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: 'picklerush-training-test',
    firestore: { rules: readFileSync('firestore.rules', 'utf8'), host: '127.0.0.1', port: 8080 },
  });
});
afterAll(async () => { await testEnv?.cleanup(); });

beforeEach(async () => {
  await testEnv.clearFirestore();
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    await setDoc(doc(db, 'users', ADMIN), { uid: ADMIN, role: 'platform_admin' });
    for (const uid of [PROF, ANA, BIA, CAIO, DUDA]) await setDoc(doc(db, 'users', uid), { uid, role: 'user' });
    await setDoc(doc(db, 'coaches', PROF), { uid: PROF, name: 'Prof. Rui' });
    await setDoc(doc(db, 'coach_students', `${PROF}_${ANA}`), { coach_id: PROF, student_id: ANA, status: 'active', private_notes: 'segredo' });
    await setDoc(doc(db, 'coach_students', `${PROF}_${BIA}`), { coach_id: PROF, student_id: BIA, status: 'paused' });
    await setDoc(doc(db, 'coach_students', `${PROF}_${CAIO}`), { coach_id: PROF, student_id: CAIO, status: 'invited' });

    await setDoc(doc(db, 'training_items', 'pub_ok'), item({ author_uid: DUDA, author_name: 'Duda', created_by: DUDA, visibility: 'publico', review: 'aprovado' }));
    await setDoc(doc(db, 'training_items', 'pub_pend'), item({ author_uid: DUDA, created_by: DUDA, visibility: 'publico', review: 'pendente' }));
    await setDoc(doc(db, 'training_items', 'pub_oculto'), item({ author_uid: DUDA, created_by: DUDA, visibility: 'publico', review: 'aprovado', hidden: true }));
    await setDoc(doc(db, 'training_items', 'priv_duda'), item({ author_uid: DUDA, created_by: DUDA }));
    await setDoc(doc(db, 'training_items', 'priv_comp'), item({ author_uid: DUDA, created_by: DUDA, shared_uids: [ANA] }));
    await setDoc(doc(db, 'training_items', 'alunos_prof'), item({ author_uid: PROF, author_role: 'professor', created_by: PROF, visibility: 'alunos' }));
    await setDoc(doc(db, 'training_items', 'priv_prof'), item({ author_uid: PROF, author_role: 'professor', created_by: PROF }));
    await setDoc(doc(db, 'training_items', 'plat'), item({ author_uid: 'plataforma', author_role: 'plataforma', created_by: ADMIN, visibility: 'publico', review: 'aprovado', featured: true }));

    await setDoc(doc(db, 'training_sessions', 's_ana'), { uid: ANA, date: '2026-10-08', week_key: '2026-10-06', duration_min: 45, rpe: 5, notes: '', shared_coach_id: PROF });
    await setDoc(doc(db, 'training_sessions', 's_bia'), { uid: BIA, date: '2026-10-08', week_key: '2026-10-06', duration_min: 30, rpe: 4, shared_coach_id: PROF });
    await setDoc(doc(db, 'training_questions', 'q_ana'), { asker_uid: ANA, coach_uid: PROF, subject: 'Dink', status: 'aberta', last_from: 'aluno' });
    await setDoc(doc(db, 'training_shares', 'sh_ana'), { from_uid: PROF, from_name: 'Rui', from_role: 'professor', to_uid: ANA, item_id: 'alunos_prof', item_title: 'x', item_kind: 'drill', kind: 'aluno', note: '', due_date: null, read_at: null, done_at: null, done_note: '' });
    await setDoc(doc(db, 'coach_content', 'cc_alunos'), { coach_id: PROF, title: 'Só alunos', body: 'x', visibility: 'students' });
  });
});

const como = (uid) => testEnv.authenticatedContext(uid).firestore();
const anonimo = () => testEnv.unauthenticatedContext().firestore();
const setTraining = (data) => testEnv.withSecurityRulesDisabled((ctx) => setDoc(doc(ctx.firestore(), 'platform_settings', 'training'), data));

describe('⭐ criar itens: autoria e política de revisão', () => {
  it('atleta cria privado e público PENDENTE', async () => {
    const db = como(ANA);
    await assertSucceeds(setDoc(doc(db, 'training_items', 'n1'), item()));
    await assertSucceeds(setDoc(doc(db, 'training_items', 'n2'), item({ visibility: 'publico', review: 'pendente' })));
  });

  it('🔴 atleta NÃO publica direto (padrão: a equipe revisa)', async () => {
    await assertFails(setDoc(doc(como(ANA), 'training_items', 'n'), item({ visibility: 'publico', review: 'aprovado' })));
  });

  it('com a revisão de atleta desligada pelo admin, publica direto', async () => {
    await setTraining({ public_review_atleta: false });
    await assertSucceeds(setDoc(doc(como(ANA), 'training_items', 'n'), item({ visibility: 'publico', review: 'aprovado' })));
  });

  it('com a publicação de atletas desligada, atleta não cria público', async () => {
    await setTraining({ allow_public_athlete: false });
    await assertFails(setDoc(doc(como(ANA), 'training_items', 'n'), item({ visibility: 'publico', review: 'pendente' })));
    await assertSucceeds(setDoc(doc(como(ANA), 'training_items', 'n2'), item()));
  });

  it('🔴 professor NÃO verificado: o público vai para a fila (padrão); "meus alunos" segue', async () => {
    const db = como(PROF);
    const p = { author_uid: PROF, author_role: 'professor', created_by: PROF };
    await assertFails(setDoc(doc(db, 'training_items', 'p1'), item({ ...p, visibility: 'publico', review: 'aprovado' })));
    await assertSucceeds(setDoc(doc(db, 'training_items', 'p1b'), item({ ...p, visibility: 'publico', review: 'pendente' })));
    await assertSucceeds(setDoc(doc(db, 'training_items', 'p2'), item({ ...p, visibility: 'alunos' })));
  });

  it('com a revisão de professor DESLIGADA pelo admin, o professor publica direto', async () => {
    await setTraining({ public_review_professor: false });
    const p = { author_uid: PROF, author_role: 'professor', created_by: PROF, visibility: 'publico' };
    await assertSucceeds(setDoc(doc(como(PROF), 'training_items', 'p1'), item({ ...p, review: 'aprovado' })));
  });

  it('professor VERIFICADO pelo admin publica direto — e editar continua publicado', async () => {
    await setTraining({ verified_professors: [PROF] });
    const p = { author_uid: PROF, author_role: 'professor', created_by: PROF, visibility: 'publico' };
    await assertSucceeds(setDoc(doc(como(PROF), 'training_items', 'p1'), item({ ...p, review: 'aprovado' })));
    await assertSucceeds(updateDoc(doc(como(PROF), 'training_items', 'p1'), { title: 'Dink cruzado v2', review: 'aprovado' }));
  });

  it('🔴 quem se declara professor sozinho (coaches/{uid}) não pula a fila', async () => {
    const db = como(DUDA);
    await assertSucceeds(setDoc(doc(db, 'coaches', DUDA), { uid: DUDA, name: 'Duda' }));
    const p = { author_uid: DUDA, author_role: 'professor', created_by: DUDA, author_name: 'Duda', visibility: 'publico' };
    await assertFails(setDoc(doc(db, 'training_items', 'd1'), item({ ...p, review: 'aprovado' })));
    await assertSucceeds(setDoc(doc(db, 'training_items', 'd2'), item({ ...p, review: 'pendente' })));
  });

  it('🔴 a lista de verificados vale só para o papel professor, e só o admin a escreve', async () => {
    await setTraining({ verified_professors: [ANA] });
    await assertFails(setDoc(doc(como(ANA), 'training_items', 'a1'), item({ visibility: 'publico', review: 'aprovado' })));
    await assertFails(setDoc(doc(como(ANA), 'training_items', 'a2'), item({ author_role: 'professor', visibility: 'publico', review: 'aprovado' })));
    await assertFails(setDoc(doc(como(PROF), 'platform_settings', 'training'), { verified_professors: [PROF] }, { merge: true }));
    await assertSucceeds(setDoc(doc(como(ADMIN), 'platform_settings', 'training'), { verified_professors: [PROF] }, { merge: true }));
  });

  it('🔴 professor que saiu da lista: editar o público aprovado volta para a fila; compartilhar não', async () => {
    await testEnv.withSecurityRulesDisabled((ctx) => setDoc(doc(ctx.firestore(), 'training_items', 'prof_pub'),
      item({ author_uid: PROF, author_role: 'professor', created_by: PROF, author_name: 'Rui', visibility: 'publico', review: 'aprovado' })));
    const ref = doc(como(PROF), 'training_items', 'prof_pub');
    await assertFails(updateDoc(ref, { title: 'Outro título', review: 'aprovado' }));
    await assertSucceeds(updateDoc(ref, { shared_uids: [ANA] }));
    await assertSucceeds(updateDoc(ref, { title: 'Outro título', review: 'pendente' }));
  });

  it('🔴 lista gravada com tipo errado fecha (não abre) a publicação direta', async () => {
    await setTraining({ verified_professors: PROF });
    const p = { author_uid: PROF, author_role: 'professor', created_by: PROF, visibility: 'publico' };
    await assertFails(setDoc(doc(como(PROF), 'training_items', 'p1'), item({ ...p, review: 'aprovado' })));
  });

  it('🔴 atleta não cria "meus alunos", nem se diz professor, nem plataforma', async () => {
    const db = como(ANA);
    await assertFails(setDoc(doc(db, 'training_items', 'a'), item({ visibility: 'alunos' })));
    await assertFails(setDoc(doc(db, 'training_items', 'b'), item({ author_role: 'professor' })));
    await assertFails(setDoc(doc(db, 'training_items', 'c'), item({ author_uid: 'plataforma', author_role: 'plataforma', visibility: 'publico', review: 'aprovado' })));
  });

  it('🔴 ninguém cria em nome de outra pessoa', async () => {
    await assertFails(setDoc(doc(como(ANA), 'training_items', 'x'), item({ author_uid: DUDA })));
    await assertFails(setDoc(doc(como(ANA), 'training_items', 'y'), item({ created_by: DUDA })));
  });

  it('🔴 o autor não nasce oculto/destacado nem com nota de revisão', async () => {
    const db = como(ANA);
    await assertFails(setDoc(doc(db, 'training_items', 'a'), item({ featured: true })));
    await assertFails(setDoc(doc(db, 'training_items', 'b'), item({ hidden: true })));
    await assertFails(setDoc(doc(db, 'training_items', 'c'), item({ review_note: 'ok' })));
  });

  it('🔴 forma: título curto, passos demais, público sem revisão coerente', async () => {
    const db = como(ANA);
    await assertFails(setDoc(doc(db, 'training_items', 'a'), item({ title: 'ab' })));
    await assertFails(setDoc(doc(db, 'training_items', 'b'), item({ steps: Array.from({ length: 16 }, () => 'x') })));
    await assertFails(setDoc(doc(db, 'training_items', 'c'), item({ review: 'pendente' })));
    await assertFails(setDoc(doc(db, 'training_items', 'd'), item({ kind: 'qualquer' })));
  });

  it('🔴 o id fixo das sementes (pickle_*) é só da plataforma', async () => {
    await assertFails(setDoc(doc(como(ANA), 'training_items', 'pickle_dink'), item()));
    await assertSucceeds(setDoc(doc(como(ANA), 'training_items', 'meu_dink'), item()));
  });

  it('o admin cria conteúdo da plataforma, já destacado', async () => {
    await assertSucceeds(setDoc(doc(como(ADMIN), 'training_items', 'pickle_x'), item({
      author_uid: 'plataforma', author_role: 'plataforma', created_by: ADMIN, visibility: 'publico', review: 'aprovado', featured: true,
    })));
  });
});

describe('⭐ copiar e adaptar', () => {
  const copia = (over = {}) => item({ title: 'Dink (adaptação)', ...over });

  it('copia o público da biblioteca e pode publicar a cópia', async () => {
    await assertSucceeds(setDoc(doc(como(ANA), 'training_items', 'c1'),
      copia({ visibility: 'publico', review: 'pendente', derived_from: { id: 'pub_ok', title: 'x', author_name: 'Duda', locked: false } })));
  });

  it('🔴 a cópia do "meus alunos" nasce trancada e nunca vira pública', async () => {
    const db = como(ANA);
    await assertFails(setDoc(doc(db, 'training_items', 'c2'),
      copia({ derived_from: { id: 'alunos_prof', title: 'x', author_name: 'Rui', locked: false } })));
    await assertFails(setDoc(doc(db, 'training_items', 'c3'),
      copia({ visibility: 'publico', review: 'pendente', derived_from: { id: 'alunos_prof', title: 'x', author_name: 'Rui', locked: true } })));
    await assertSucceeds(setDoc(doc(db, 'training_items', 'c4'),
      copia({ derived_from: { id: 'alunos_prof', title: 'x', author_name: 'Rui', locked: true } })));
    await assertFails(updateDoc(doc(db, 'training_items', 'c4'), { visibility: 'publico', review: 'pendente' }));
    await assertFails(updateDoc(doc(db, 'training_items', 'c4'), { derived_from: null }));
  });

  it('🔴 copiar a própria cópia trancada não destranca', async () => {
    const db = como(ANA);
    await assertSucceeds(setDoc(doc(db, 'training_items', 'c5'),
      copia({ derived_from: { id: 'alunos_prof', title: 'x', author_name: 'Rui', locked: true } })));
    await assertFails(setDoc(doc(db, 'training_items', 'c6'),
      copia({ visibility: 'publico', review: 'pendente', derived_from: { id: 'c5', title: 'x', author_name: 'Ana', locked: false } })));
    await assertSucceeds(setDoc(doc(db, 'training_items', 'c7'),
      copia({ derived_from: { id: 'c5', title: 'x', author_name: 'Ana', locked: true } })));
  });

  it('🔴 a cópia trancada fica com quem copiou: não nasce compartilhada, não ganha leitores, não é indicada', async () => {
    const db = como(ANA);
    const trancada = { derived_from: { id: 'alunos_prof', title: 'x', author_name: 'Rui', locked: true } };
    await assertFails(setDoc(doc(db, 'training_items', 'c8'), copia({ ...trancada, shared_uids: [DUDA] })));
    await assertSucceeds(setDoc(doc(db, 'training_items', 'c9'), copia(trancada)));
    await assertFails(updateDoc(doc(db, 'training_items', 'c9'), { shared_uids: [DUDA] }));
    await assertFails(addDoc(collection(db, 'training_shares'), {
      from_uid: ANA, from_name: 'Ana', from_role: 'atleta', to_uid: DUDA, item_id: 'c9', item_title: 'x', item_kind: 'drill',
      kind: 'indicacao', note: '', due_date: null, read_at: null, done_at: null, done_note: '',
    }));
    // a cópia DESTRAVADA segue indicável
    await assertSucceeds(setDoc(doc(db, 'training_items', 'c10'),
      copia({ derived_from: { id: 'pub_ok', title: 'x', author_name: 'Duda', locked: false } })));
    await assertSucceeds(updateDoc(doc(db, 'training_items', 'c10'), { shared_uids: [DUDA] }));
  });
});

describe('⭐ ler itens', () => {
  it('qualquer conta lê o público aprovado; ninguém sem login', async () => {
    await assertSucceeds(getDoc(doc(como(ANA), 'training_items', 'pub_ok')));
    await assertSucceeds(getDoc(doc(como(ANA), 'training_items', 'plat')));
    await assertFails(getDoc(doc(anonimo(), 'training_items', 'pub_ok')));
  });

  it('🔴 pendente, oculto e privado: só o autor', async () => {
    const db = como(ANA);
    await assertFails(getDoc(doc(db, 'training_items', 'pub_pend')));
    await assertFails(getDoc(doc(db, 'training_items', 'pub_oculto')));
    await assertFails(getDoc(doc(db, 'training_items', 'priv_duda')));
    await assertSucceeds(getDoc(doc(como(DUDA), 'training_items', 'pub_pend')));
    await assertSucceeds(getDoc(doc(como(DUDA), 'training_items', 'pub_oculto')));
  });

  it('quem recebeu lê o privado compartilhado', async () => {
    await assertSucceeds(getDoc(doc(como(ANA), 'training_items', 'priv_comp')));
    await assertFails(getDoc(doc(como(BIA), 'training_items', 'priv_comp')));
  });

  it('⭐ "meus alunos": aluna ATIVA lê; pausada, convidado e estranho não', async () => {
    await assertSucceeds(getDoc(doc(como(ANA), 'training_items', 'alunos_prof')));
    await assertFails(getDoc(doc(como(BIA), 'training_items', 'alunos_prof')));
    await assertFails(getDoc(doc(como(CAIO), 'training_items', 'alunos_prof')));
    await assertFails(getDoc(doc(como(DUDA), 'training_items', 'alunos_prof')));
    await assertFails(getDoc(doc(como(ANA), 'training_items', 'priv_prof')));
  });

  it('o admin lê tudo', async () => {
    await assertSucceeds(getDoc(doc(como(ADMIN), 'training_items', 'priv_duda')));
  });
});

describe('⭐ as consultas das telas', () => {
  it('biblioteca pública (três igualdades) passa para quem não é admin', async () => {
    const q = query(collection(como(ANA), 'training_items'),
      where('visibility', '==', 'publico'), where('review', '==', 'aprovado'), where('hidden', '==', false));
    await assertSucceeds(getDocs(q));
  });

  it('🔴 biblioteca sem o filtro de revisão é recusada', async () => {
    await assertFails(getDocs(query(collection(como(ANA), 'training_items'), where('visibility', '==', 'publico'))));
    await assertFails(getDocs(collection(como(ANA), 'training_items')));
  });

  it('"meus" (author_uid) passa', async () => {
    await assertSucceeds(getDocs(query(collection(como(DUDA), 'training_items'), where('author_uid', '==', DUDA))));
  });

  it('"dos meus professores" passa para a aluna ativa e não para a pausada', async () => {
    const q = (db) => query(collection(db, 'training_items'),
      where('author_uid', '==', PROF), where('visibility', '==', 'alunos'), where('hidden', '==', false));
    await assertSucceeds(getDocs(q(como(ANA))));
    await assertFails(getDocs(q(como(BIA))));
  });

  it('"compartilhados comigo" passa', async () => {
    const q = query(collection(como(ANA), 'training_items'),
      where('shared_uids', 'array-contains', ANA), where('hidden', '==', false));
    await assertSucceeds(getDocs(q));
  });

  it('o admin lista a coleção inteira', async () => {
    await assertSucceeds(getDocs(collection(como(ADMIN), 'training_items')));
  });
});

describe('⭐ editar e excluir itens', () => {
  it('🔴 atleta edita um aprovado: só volta como PENDENTE', async () => {
    await testEnv.withSecurityRulesDisabled((ctx) => setDoc(doc(ctx.firestore(), 'training_items', 'meu_pub'),
      item({ visibility: 'publico', review: 'aprovado' })));
    const ref = doc(como(ANA), 'training_items', 'meu_pub');
    await assertFails(updateDoc(ref, { title: 'Dink cruzado 2' }));
    await assertSucceeds(updateDoc(ref, { title: 'Dink cruzado 2', review: 'pendente' }));
  });

  it('compartilhar um aprovado não muda a revisão', async () => {
    await testEnv.withSecurityRulesDisabled((ctx) => setDoc(doc(ctx.firestore(), 'training_items', 'meu_pub'),
      item({ visibility: 'publico', review: 'aprovado' })));
    await assertSucceeds(updateDoc(doc(como(ANA), 'training_items', 'meu_pub'), { shared_uids: [BIA] }));
  });

  it('virar privado leva a revisão para "não se aplica"', async () => {
    await testEnv.withSecurityRulesDisabled((ctx) => setDoc(doc(ctx.firestore(), 'training_items', 'meu_pub'),
      item({ visibility: 'publico', review: 'recusado' })));
    await assertSucceeds(updateDoc(doc(como(ANA), 'training_items', 'meu_pub'), { visibility: 'privado', review: 'nao_se_aplica' }));
  });

  it('🔴 o autor não mexe em oculto, destaque, nota de revisão nem autoria', async () => {
    const ref = doc(como(DUDA), 'training_items', 'pub_oculto');
    await assertFails(updateDoc(ref, { hidden: false }));
    await assertFails(updateDoc(doc(como(DUDA), 'training_items', 'pub_ok'), { featured: true }));
    await assertFails(updateDoc(doc(como(DUDA), 'training_items', 'pub_ok'), { review_note: 'ok' }));
    await assertFails(updateDoc(doc(como(DUDA), 'training_items', 'priv_duda'), { author_uid: ANA }));
    await assertFails(updateDoc(doc(como(DUDA), 'training_items', 'priv_duda'), { author_role: 'professor' }));
  });

  it('🔴 ninguém edita nem apaga o item de outra pessoa', async () => {
    await assertFails(updateDoc(doc(como(ANA), 'training_items', 'pub_ok'), { title: 'Roubado' }));
    await assertFails(deleteDoc(doc(como(ANA), 'training_items', 'pub_ok')));
    await assertFails(updateDoc(doc(como(PROF), 'training_items', 'plat'), { title: 'Roubado' }));
  });

  it('o admin oculta, aprova e edita a plataforma; não troca o autor', async () => {
    const db = como(ADMIN);
    await assertSucceeds(updateDoc(doc(db, 'training_items', 'pub_ok'), { hidden: true, hidden_reason: 'impreciso' }));
    await assertSucceeds(updateDoc(doc(db, 'training_items', 'pub_pend'), { review: 'aprovado', reviewed_by: ADMIN }));
    await assertSucceeds(updateDoc(doc(db, 'training_items', 'plat'), { title: 'Novo título' }));
    await assertFails(updateDoc(doc(db, 'training_items', 'pub_ok'), { author_uid: ADMIN }));
  });

  it('autor e admin apagam', async () => {
    await assertSucceeds(deleteDoc(doc(como(DUDA), 'training_items', 'priv_duda')));
    await assertSucceeds(deleteDoc(doc(como(ADMIN), 'training_items', 'pub_ok')));
  });
});

const share = (over = {}) => ({
  from_uid: ANA, from_name: 'Ana', from_role: 'atleta', to_uid: DUDA, item_id: 'pub_ok',
  item_title: 'Dink', item_kind: 'drill', kind: 'indicacao', note: 'Olha esse', due_date: null,
  read_at: null, done_at: null, done_note: '', ...over,
});

describe('⭐ compartilhar e enviar para alunos', () => {
  it('indica item público da biblioteca e o próprio privado', async () => {
    await testEnv.withSecurityRulesDisabled((ctx) => setDoc(doc(ctx.firestore(), 'training_items', 'priv_ana'), item()));
    await assertSucceeds(addDoc(collection(como(ANA), 'training_shares'), share()));
    await assertSucceeds(addDoc(collection(como(ANA), 'training_shares'), share({ item_id: 'priv_ana' })));
  });

  it('o próprio privado + shared_uids no MESMO lote', async () => {
    await testEnv.withSecurityRulesDisabled((ctx) => setDoc(doc(ctx.firestore(), 'training_items', 'priv_ana'), item()));
    const db = como(ANA);
    const b = writeBatch(db);
    b.update(doc(db, 'training_items', 'priv_ana'), { shared_uids: [DUDA] });
    b.set(doc(collection(db, 'training_shares')), share({ item_id: 'priv_ana' }));
    await assertSucceeds(b.commit());
  });

  it('🔴 só quem tem perfil de professor indica "como professor"', async () => {
    await assertFails(addDoc(collection(como(ANA), 'training_shares'), share({ from_role: 'professor' })));
    await assertSucceeds(addDoc(collection(como(PROF), 'training_shares'), share({ from_uid: PROF, from_role: 'professor' })));
  });

  it('🔴 não indica o privado de outra pessoa, nem para si mesmo', async () => {
    await assertFails(addDoc(collection(como(ANA), 'training_shares'), share({ item_id: 'priv_duda' })));
    await assertFails(addDoc(collection(como(ANA), 'training_shares'), share({ item_id: 'priv_comp' })));
    await assertFails(addDoc(collection(como(ANA), 'training_shares'), share({ to_uid: ANA })));
    await assertFails(addDoc(collection(como(ANA), 'training_shares'), share({ from_uid: DUDA })));
    await assertFails(addDoc(collection(como(ANA), 'training_shares'), share({ due_date: '2026-10-10' })));
  });

  it('⭐ professor envia para aluna ATIVA; não para pausada nem convidado', async () => {
    const p = { from_uid: PROF, from_name: 'Rui', from_role: 'professor', kind: 'aluno', item_id: 'alunos_prof', due_date: '2026-10-10' };
    await assertSucceeds(addDoc(collection(como(PROF), 'training_shares'), share({ ...p, to_uid: ANA })));
    await assertFails(addDoc(collection(como(PROF), 'training_shares'), share({ ...p, to_uid: BIA })));
    await assertFails(addDoc(collection(como(PROF), 'training_shares'), share({ ...p, to_uid: CAIO })));
  });

  // A regra lê 4 documentos por envio "para aluno" e o lote tem teto de 20
  // leituras: o serviço manda de 4 em 4. Se um dia a regra ler mais, este
  // teste cai e o lote do serviço (SHARE_BATCH) tem de diminuir.
  it('⭐ um lote de 4 envios "para aluno" (o tamanho que o serviço usa) passa', async () => {
    const alunos = Array.from({ length: 4 }, (_, i) => `aluno${i}_uid`);
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      for (const a of alunos) {
        await setDoc(doc(ctx.firestore(), 'coach_students', `${PROF}_${a}`), { coach_id: PROF, student_id: a, status: 'active' });
      }
    });
    const db = como(PROF);
    const b = writeBatch(db);
    b.update(doc(db, 'training_items', 'priv_prof'), { shared_uids: alunos });
    const p = { from_uid: PROF, from_name: 'Rui', from_role: 'professor', kind: 'aluno', item_id: 'priv_prof', due_date: null };
    for (const a of alunos) b.set(doc(collection(db, 'training_shares')), share({ ...p, to_uid: a }));
    await assertSucceeds(b.commit());
  });

  it('🔴 atleta não usa o envio "para aluno"', async () => {
    await assertFails(addDoc(collection(como(DUDA), 'training_shares'), share({ from_uid: DUDA, kind: 'aluno', from_role: 'professor', to_uid: ANA })));
  });

  it('com o compartilhamento desligado pelo admin, ninguém indica', async () => {
    await setTraining({ allow_sharing: false });
    await assertFails(addDoc(collection(como(ANA), 'training_shares'), share()));
  });

  it('o destinatário marca lido/feito; não reescreve; quem mandou não altera', async () => {
    const ref = (uid) => doc(como(uid), 'training_shares', 'sh_ana');
    await assertSucceeds(updateDoc(ref(ANA), { read_at: new Date(), done_at: new Date(), done_note: 'Feito!' }));
    await assertFails(updateDoc(ref(ANA), { note: 'mudei' }));
    await assertFails(updateDoc(ref(PROF), { done_at: new Date() }));
  });

  it('🔴 estranho não lê; as duas pontas leem pela consulta delas', async () => {
    await assertFails(getDoc(doc(como(DUDA), 'training_shares', 'sh_ana')));
    await assertSucceeds(getDocs(query(collection(como(ANA), 'training_shares'), where('to_uid', '==', ANA))));
    await assertSucceeds(getDocs(query(collection(como(PROF), 'training_shares'), where('from_uid', '==', PROF))));
  });
});

describe('diário', () => {
  const sess = (over = {}) => ({ uid: ANA, date: '2026-10-08', week_key: '2026-10-06', duration_min: 40, rpe: 6, notes: '', title: 'Treino', item_ids: [], skills: [], ...over });

  it('o dono registra; compartilha só com professor de vínculo ativo', async () => {
    await assertSucceeds(setDoc(doc(como(ANA), 'training_sessions', 'n1'), sess()));
    await assertSucceeds(setDoc(doc(como(ANA), 'training_sessions', 'n2'), sess({ shared_coach_id: PROF })));
    await assertFails(setDoc(doc(como(BIA), 'training_sessions', 'n3'), sess({ uid: BIA, shared_coach_id: PROF })));
  });

  it('🔴 forma e confirmação do professor', async () => {
    await assertFails(setDoc(doc(como(ANA), 'training_sessions', 'a'), sess({ rpe: 11 })));
    await assertFails(setDoc(doc(como(ANA), 'training_sessions', 'b'), sess({ duration_min: 700 })));
    await assertFails(setDoc(doc(como(ANA), 'training_sessions', 'c'), sess({ coach_confirmed_at: new Date() })));
    await assertFails(setDoc(doc(como(ANA), 'training_sessions', 'd'), sess({ uid: DUDA })));
  });

  it('⭐ o professor lê e confirma a sessão compartilhada da aluna ATIVA; não a da pausada', async () => {
    await assertSucceeds(getDoc(doc(como(PROF), 'training_sessions', 's_ana')));
    await assertSucceeds(updateDoc(doc(como(PROF), 'training_sessions', 's_ana'), { coach_confirmed_at: new Date() }));
    await assertFails(updateDoc(doc(como(PROF), 'training_sessions', 's_ana'), { notes: 'mudei' }));
    await assertFails(getDoc(doc(como(PROF), 'training_sessions', 's_bia')));
  });

  it('consulta do professor por aluno (duas igualdades) passa', async () => {
    const q = query(collection(como(PROF), 'training_sessions'), where('shared_coach_id', '==', PROF), where('uid', '==', ANA));
    await assertSucceeds(getDocs(q));
  });

  it('consulta do dono por semanas passa; estranho não lê', async () => {
    await assertSucceeds(getDocs(query(collection(como(ANA), 'training_sessions'), where('uid', '==', ANA), where('week_key', 'in', ['2026-10-06', '2026-09-29']))));
    await assertFails(getDoc(doc(como(DUDA), 'training_sessions', 's_ana')));
  });

  it('comentários: professor e dona comentam; estranho não; ninguém edita', async () => {
    const c = (uid) => ({ uid, name: 'x', text: 'Bom treino', created_at: new Date() });
    await assertSucceeds(setDoc(doc(como(PROF), 'training_sessions', 's_ana', 'comments', 'c1'), c(PROF)));
    await assertSucceeds(setDoc(doc(como(ANA), 'training_sessions', 's_ana', 'comments', 'c2'), c(ANA)));
    await assertFails(setDoc(doc(como(DUDA), 'training_sessions', 's_ana', 'comments', 'c3'), c(DUDA)));
    await assertFails(updateDoc(doc(como(PROF), 'training_sessions', 's_ana', 'comments', 'c1'), { text: 'mudei' }));
    await assertSucceeds(deleteDoc(doc(como(ANA), 'training_sessions', 's_ana', 'comments', 'c1')));
    await assertSucceeds(getDocs(collection(como(PROF), 'training_sessions', 's_ana', 'comments')));
  });
});

describe('planos e preferências', () => {
  const plano = (over = {}) => ({ uid: ANA, title: 'Plano', weeks: 4, days: [1, 3], slots: [], status: 'ativo', ...over });

  it('o dono cria e edita; estranho não lê', async () => {
    await assertSucceeds(setDoc(doc(como(ANA), 'training_plans', 'p'), plano()));
    await assertFails(setDoc(doc(como(ANA), 'training_plans', 'q'), plano({ weeks: 17 })));
    await assertFails(setDoc(doc(como(ANA), 'training_plans', 'r'), plano({ uid: DUDA })));
    await assertSucceeds(updateDoc(doc(como(ANA), 'training_plans', 'p'), { status: 'pausado' }));
    await assertFails(getDoc(doc(como(DUDA), 'training_plans', 'p')));
    await assertSucceeds(getDocs(query(collection(como(ANA), 'training_plans'), where('uid', '==', ANA))));
  });

  it('training_meta: só o dono, só as chaves conhecidas', async () => {
    await assertSucceeds(setDoc(doc(como(ANA), 'training_meta', ANA), { favorites: ['a'], routine: { days: [1] }, onboarding_done: true }));
    await assertFails(setDoc(doc(como(ANA), 'training_meta', DUDA), { favorites: [] }));
    await assertFails(setDoc(doc(como(ANA), 'training_meta', ANA), { xp: 999 }));
    await assertFails(getDoc(doc(como(DUDA), 'training_meta', ANA)));
  });

  it('training_meta: o balanço ligado ou não (só enabled e since)', async () => {
    await assertSucceeds(setDoc(doc(como(ANA), 'training_meta', ANA), { debrief: { enabled: true, since: '2026-10-09' } }));
    await assertSucceeds(setDoc(doc(como(ANA), 'training_meta', ANA), { debrief: { enabled: false, since: null } }, { merge: true }));
    await assertFails(setDoc(doc(como(ANA), 'training_meta', ANA), { debrief: { enabled: true, xp: 10 } }));
    await assertFails(setDoc(doc(como(ANA), 'training_meta', ANA), { debrief: 'sim' }));
  });
});

describe('balanço do jogo', () => {
  const fonte = { type: 'dia_de_jogo', ref_id: 'gd1', title: 'Sábado', date: '2026-10-08', games: 4, wins: 3 };
  const balanco = (over = {}) => ({
    uid: ANA, source: fonte, status: 'respondido', rating: 4, strengths: ['dink'], weaknesses: ['saque', 'devolucao'],
    evolution: 'melhorou', body: 4, mind: 3, note: 'Saque curto demais.', suggestion: { focus: ['saque'], item_ids: ['a', 'b'], light: false },
    applied: null, ...over,
  });

  it('a dona grava, relê, atualiza e apaga; o id começa pelo uid dela', async () => {
    await assertSucceeds(setDoc(doc(como(ANA), 'training_debriefs', `${ANA}_dia_de_jogo_gd1`), balanco()));
    await assertSucceeds(getDoc(doc(como(ANA), 'training_debriefs', `${ANA}_dia_de_jogo_gd1`)));
    await assertSucceeds(updateDoc(doc(como(ANA), 'training_debriefs', `${ANA}_dia_de_jogo_gd1`), { applied: { plan_id: 'p', mode: 'novo' } }));
    await assertSucceeds(getDocs(query(collection(como(ANA), 'training_debriefs'), where('uid', '==', ANA))));
    await assertSucceeds(deleteDoc(doc(como(ANA), 'training_debriefs', `${ANA}_dia_de_jogo_gd1`)));
  });

  it('ninguém grava no balanço de outra pessoa nem lê', async () => {
    await assertSucceeds(setDoc(doc(como(ANA), 'training_debriefs', `${ANA}_dia_de_jogo_gd1`), balanco()));
    await assertFails(getDoc(doc(como(DUDA), 'training_debriefs', `${ANA}_dia_de_jogo_gd1`)));
    await assertFails(getDocs(query(collection(como(DUDA), 'training_debriefs'), where('uid', '==', ANA))));
    await assertFails(setDoc(doc(como(DUDA), 'training_debriefs', `${ANA}_dia_de_jogo_gd1`), balanco({ uid: DUDA })));
    await assertFails(setDoc(doc(como(DUDA), 'training_debriefs', `${DUDA}_x`), balanco()));
    await assertFails(setDoc(doc(como(DUDA), 'training_debriefs', 'qualquer'), balanco({ uid: DUDA })));
    await assertSucceeds(getDoc(doc(como(ADMIN), 'training_debriefs', `${ANA}_dia_de_jogo_gd1`)));
  });

  it('o formato é conferido: nota 1–5, até 3 aspectos, texto curto, campos conhecidos', async () => {
    const id = `${ANA}_avulso_2026-10-08_1`;
    await assertFails(setDoc(doc(como(ANA), 'training_debriefs', id), balanco({ rating: 9 })));
    await assertFails(setDoc(doc(como(ANA), 'training_debriefs', id), balanco({ rating: null })));
    await assertFails(setDoc(doc(como(ANA), 'training_debriefs', id), balanco({ weaknesses: ['a', 'b', 'c', 'd'] })));
    await assertFails(setDoc(doc(como(ANA), 'training_debriefs', id), balanco({ note: 'x'.repeat(501) })));
    await assertFails(setDoc(doc(como(ANA), 'training_debriefs', id), balanco({ xp: 50 })));
    await assertFails(setDoc(doc(como(ANA), 'training_debriefs', id), balanco({ source: { ...fonte, type: 'treino' } })));
    await assertSucceeds(setDoc(doc(como(ANA), 'training_debriefs', id), balanco({ source: { ...fonte, type: 'avulso', ref_id: '2026-10-08_1' } })));
  });

  it('dispensar fica gravado sem nota', async () => {
    await assertSucceeds(setDoc(doc(como(ANA), 'training_debriefs', `${ANA}_torneio_t1`), {
      uid: ANA, source: { ...fonte, type: 'torneio', ref_id: 't1', games: null, wins: null }, status: 'dispensado',
    }));
  });
});

describe('dúvidas', () => {
  it('aluna ATIVA pergunta; quem não é aluno ativo não', async () => {
    const q = (uid) => ({ asker_uid: uid, coach_uid: PROF, subject: 'Saque', status: 'aberta', last_from: 'aluno' });
    await assertSucceeds(setDoc(doc(como(ANA), 'training_questions', 'n1'), q(ANA)));
    await assertFails(setDoc(doc(como(BIA), 'training_questions', 'n2'), q(BIA)));
    await assertFails(setDoc(doc(como(DUDA), 'training_questions', 'n3'), q(DUDA)));
  });

  it('as duas pontas leem e trocam mensagens; estranho não', async () => {
    const m = (uid) => ({ uid, name: 'x', text: 'Resposta', created_at: new Date() });
    await assertSucceeds(getDoc(doc(como(PROF), 'training_questions', 'q_ana')));
    await assertSucceeds(setDoc(doc(como(PROF), 'training_questions', 'q_ana', 'messages', 'm1'), m(PROF)));
    await assertSucceeds(updateDoc(doc(como(PROF), 'training_questions', 'q_ana'), { status: 'respondida', last_from: 'professor' }));
    await assertFails(updateDoc(doc(como(PROF), 'training_questions', 'q_ana'), { coach_uid: DUDA }));
    await assertFails(setDoc(doc(como(DUDA), 'training_questions', 'q_ana', 'messages', 'm2'), m(DUDA)));
    await assertFails(updateDoc(doc(como(PROF), 'training_questions', 'q_ana', 'messages', 'm1'), { text: 'mudei' }));
    await assertFails(getDoc(doc(como(DUDA), 'training_questions', 'q_ana')));
    await assertSucceeds(getDocs(query(collection(como(PROF), 'training_questions'), where('coach_uid', '==', PROF))));
  });

  it('quem perguntou apaga a conversa inteira; o professor e estranhos não', async () => {
    const m = { uid: PROF, name: 'x', text: 'Resposta', created_at: new Date() };
    await testEnv.withSecurityRulesDisabled((ctx) => setDoc(doc(ctx.firestore(), 'training_questions', 'q_ana', 'messages', 'mp'), m));
    await assertFails(deleteDoc(doc(como(PROF), 'training_questions', 'q_ana', 'messages', 'mp')));
    await assertFails(deleteDoc(doc(como(DUDA), 'training_questions', 'q_ana', 'messages', 'mp')));
    await assertFails(deleteDoc(doc(como(PROF), 'training_questions', 'q_ana')));
    const db = como(ANA);
    const b = writeBatch(db);
    b.delete(doc(db, 'training_questions', 'q_ana', 'messages', 'mp'));
    await assertSucceeds(b.commit());
    await assertSucceeds(deleteDoc(doc(db, 'training_questions', 'q_ana')));
  });
});

describe('denúncias', () => {
  it('qualquer conta denuncia; só o admin resolve', async () => {
    const r = { reporter_uid: ANA, item_id: 'pub_ok', reason: 'perigoso', text: 'Exercício arriscado', status: 'aberta' };
    await assertSucceeds(setDoc(doc(como(ANA), 'training_reports', 'r1'), r));
    await assertFails(setDoc(doc(como(ANA), 'training_reports', 'r2'), { ...r, status: 'resolvida' }));
    await assertFails(setDoc(doc(como(ANA), 'training_reports', 'r3'), { ...r, reporter_uid: DUDA }));
    await assertFails(updateDoc(doc(como(ANA), 'training_reports', 'r1'), { status: 'resolvida' }));
    await assertFails(getDoc(doc(como(DUDA), 'training_reports', 'r1')));
    await assertSucceeds(updateDoc(doc(como(ADMIN), 'training_reports', 'r1'), { status: 'resolvida' }));
  });
});

describe('avisos do treino', () => {
  it('os tipos novos são aceitos pela regra de notificações', async () => {
    await assertSucceeds(addDoc(collection(como(ANA), 'notifications'), {
      user_id: DUDA, title: 'Ana indicou um drill', message: 'Dink cruzado', type: 'training_share',
      link: '/treino?aba=recebidos', read: false,
    }));
  });
});

describe('🔒 F0 — correções de regras antigas', () => {
  it('coach_students: o aluno só aceita o convite', async () => {
    await assertSucceeds(updateDoc(doc(como(CAIO), 'coach_students', `${PROF}_${CAIO}`), { status: 'active', updated_at: new Date() }));
  });

  it('🔴 coach_students: o aluno não reescreve notas, nem se pausa/reativa', async () => {
    await assertFails(updateDoc(doc(como(ANA), 'coach_students', `${PROF}_${ANA}`), { private_notes: 'apaguei' }));
    await assertFails(updateDoc(doc(como(ANA), 'coach_students', `${PROF}_${ANA}`), { status: 'paused' }));
    await assertFails(updateDoc(doc(como(BIA), 'coach_students', `${PROF}_${BIA}`), { status: 'active' }));
    await assertFails(updateDoc(doc(como(CAIO), 'coach_students', `${PROF}_${CAIO}`), { status: 'active', tags: ['vip'] }));
  });

  it('🔒 coach_student_notes: só o professor (e o admin) lê e escreve a nota privada', async () => {
    const id = `${PROF}_${ANA}`;
    const nota = { coach_id: PROF, student_id: ANA, text: 'parou em out/26' };
    await assertSucceeds(setDoc(doc(como(PROF), 'coach_student_notes', id), nota));
    await assertSucceeds(getDocs(query(collection(como(PROF), 'coach_student_notes'), where('coach_id', '==', PROF))));
    await assertSucceeds(getDocs(query(collection(como(ADMIN), 'coach_student_notes'), where('coach_id', '==', PROF))));
    // o aluno não lê (nem por consulta, nem por id) nem escreve
    await assertFails(getDocs(query(collection(como(ANA), 'coach_student_notes'), where('student_id', '==', ANA))));
    await assertFails(getDoc(doc(como(ANA), 'coach_student_notes', id)));
    await assertFails(updateDoc(doc(como(ANA), 'coach_student_notes', id), { text: 'x' }));
    await assertFails(deleteDoc(doc(como(ANA), 'coach_student_notes', id)));
    // id forjado / outro professor
    await assertFails(setDoc(doc(como(DUDA), 'coach_student_notes', `${PROF}_${DUDA}`), { coach_id: PROF, student_id: DUDA, text: 'x' }));
    await assertSucceeds(deleteDoc(doc(como(PROF), 'coach_student_notes', id)));
  });

  it('coach_students: o professor segue editando tudo', async () => {
    await assertSucceeds(updateDoc(doc(como(PROF), 'coach_students', `${PROF}_${ANA}`), { private_notes: 'nova', status: 'paused' }));
  });

  it('🔴 coach_students: o id do vínculo não pode ser forjado', async () => {
    // DUDA não é aluna do PROF; gravar `{PROF}_{DUDA}` dizendo que o professor é ela mesma.
    await assertFails(setDoc(doc(como(DUDA), 'coach_students', `${PROF}_${DUDA}`), { coach_id: DUDA, student_id: DUDA, status: 'active' }));
    await assertFails(setDoc(doc(como(DUDA), 'coach_students', `${PROF}_${DUDA}`), { coach_id: DUDA, student_id: PROF, status: 'active' }));
    // O caminho certo segue valendo para o professor.
    await assertSucceeds(setDoc(doc(como(PROF), 'coach_students', `${PROF}_${DUDA}`), { coach_id: PROF, student_id: DUDA, status: 'active' }));
  });

  it('🔴 coach_students: o professor não troca de quem é o vínculo', async () => {
    await assertFails(updateDoc(doc(como(PROF), 'coach_students', `${PROF}_${ANA}`), { student_id: DUDA }));
    await assertFails(updateDoc(doc(como(PROF), 'coach_students', `${PROF}_${ANA}`), { coach_id: DUDA }));
  });

  it('🔴 um vínculo forjado já gravado não abre "só alunos"', async () => {
    await testEnv.withSecurityRulesDisabled((ctx) => setDoc(doc(ctx.firestore(), 'coach_students', `${PROF}_${DUDA}`),
      { coach_id: DUDA, student_id: DUDA, status: 'active' }));
    await assertFails(getDoc(doc(como(DUDA), 'training_items', 'alunos_prof')));
    await assertFails(getDoc(doc(como(DUDA), 'coach_content', 'cc_alunos')));
  });

  it('coach_content "só alunos": ativa lê; pausada e convidado não', async () => {
    await assertSucceeds(getDoc(doc(como(ANA), 'coach_content', 'cc_alunos')));
    await assertFails(getDoc(doc(como(BIA), 'coach_content', 'cc_alunos')));
    await assertFails(getDoc(doc(como(CAIO), 'coach_content', 'cc_alunos')));
  });
});

describe('⭐ vínculo: enquanto for professor do aluno', () => {
  const vinc = (aluno) => `${PROF}_${aluno}`;
  const encerrar = (uid) => ({ status: 'ended', updated_at: serverTimestamp(), ended_at: serverTimestamp(), ended_by: uid });
  const fimGravado = (aluno, status = 'ended') => testEnv.withSecurityRulesDisabled((ctx) => updateDoc(
    doc(ctx.firestore(), 'coach_students', vinc(aluno)), { status, ended_at: new Date(), ended_by: aluno },
  ));

  it('⭐ a aluna encerra — e tudo o que o vínculo abria fecha junto', async () => {
    await assertSucceeds(updateDoc(doc(como(ANA), 'coach_students', vinc(ANA)), encerrar(ANA)));
    await assertFails(getDoc(doc(como(ANA), 'coach_content', 'cc_alunos')));
    await assertFails(getDoc(doc(como(ANA), 'training_items', 'alunos_prof')));
    await assertFails(getDoc(doc(como(PROF), 'training_sessions', 's_ana')));
    await assertFails(setDoc(doc(como(ANA), 'training_questions', 'nova'),
      { asker_uid: ANA, coach_uid: PROF, subject: 'Saque', status: 'aberta', last_from: 'aluno' }));
    await assertFails(setDoc(doc(como(PROF), 'training_shares', 'novo'), {
      from_uid: PROF, from_name: 'Rui', from_role: 'professor', to_uid: ANA, item_id: 'priv_prof', item_title: 'x',
      item_kind: 'drill', kind: 'aluno', note: '', due_date: null, read_at: null, done_at: null, done_note: '',
    }));
  });

  it('⭐ a dúvida fica para consulta, sem mensagem nova', async () => {
    const m = (uid) => ({ uid, name: 'x', text: 'Oi', created_at: new Date() });
    await fimGravado(ANA);
    await assertSucceeds(getDoc(doc(como(ANA), 'training_questions', 'q_ana')));
    await assertSucceeds(getDocs(collection(como(PROF), 'training_questions', 'q_ana', 'messages')));
    await assertFails(setDoc(doc(como(ANA), 'training_questions', 'q_ana', 'messages', 'x1'), m(ANA)));
    await assertFails(setDoc(doc(como(PROF), 'training_questions', 'q_ana', 'messages', 'x2'), m(PROF)));
  });

  it('a pausada e o convidado também encerram (recusar o convite)', async () => {
    await assertSucceeds(updateDoc(doc(como(BIA), 'coach_students', vinc(BIA)), encerrar(BIA)));
    await assertSucceeds(updateDoc(doc(como(CAIO), 'coach_students', vinc(CAIO)), encerrar(CAIO)));
  });

  it('🔴 o aluno não encerra mexendo em outra coisa, nem em nome do professor, nem reativa', async () => {
    await assertFails(updateDoc(doc(como(ANA), 'coach_students', vinc(ANA)), { ...encerrar(ANA), private_notes: '' }));
    await assertFails(updateDoc(doc(como(ANA), 'coach_students', vinc(ANA)), encerrar(PROF)));
    await assertFails(updateDoc(doc(como(ANA), 'coach_students', vinc(ANA)), { ...encerrar(ANA), ended_at: new Date(0) }));
    await assertFails(updateDoc(doc(como(DUDA), 'coach_students', vinc(ANA)), encerrar(DUDA)));
    await fimGravado(ANA);
    await assertFails(updateDoc(doc(como(ANA), 'coach_students', vinc(ANA)), { status: 'active', updated_at: new Date() }));
  });

  it('o professor encerra (com a data) e segue anotando na ficha encerrada', async () => {
    await assertFails(updateDoc(doc(como(PROF), 'coach_students', vinc(ANA)), { status: 'ended' }));
    await assertSucceeds(updateDoc(doc(como(PROF), 'coach_students', vinc(ANA)), encerrar(PROF)));
    await assertSucceeds(updateDoc(doc(como(PROF), 'coach_students', vinc(ANA)), { private_notes: 'parou em out/26' }));
  });

  it('🔴 encerrado: o professor não reativa, não pausa, não tira a data e não apaga', async () => {
    await fimGravado(ANA);
    await assertFails(updateDoc(doc(como(PROF), 'coach_students', vinc(ANA)), { status: 'active' }));
    await assertFails(updateDoc(doc(como(PROF), 'coach_students', vinc(ANA)), { status: 'paused' }));
    await assertFails(updateDoc(doc(como(PROF), 'coach_students', vinc(ANA)), { status: 'invited', ended_at: deleteField() }));
    await assertFails(deleteDoc(doc(como(PROF), 'coach_students', vinc(ANA))));
    await assertSucceeds(deleteDoc(doc(como(ADMIN), 'coach_students', vinc(ANA))));
  });

  it('⭐ o professor convida de novo; só a aluna reativa, e o histórico de fim sai no aceite', async () => {
    await fimGravado(ANA);
    await assertSucceeds(updateDoc(doc(como(PROF), 'coach_students', vinc(ANA)), { status: 'invited', updated_at: new Date() }));
    await assertFails(updateDoc(doc(como(PROF), 'coach_students', vinc(ANA)), { status: 'active' }));
    await assertFails(deleteDoc(doc(como(PROF), 'coach_students', vinc(ANA))));
    await assertFails(updateDoc(doc(como(ANA), 'coach_students', vinc(ANA)), { status: 'active', updated_at: new Date() }));
    await assertSucceeds(updateDoc(doc(como(ANA), 'coach_students', vinc(ANA)),
      { status: 'active', updated_at: new Date(), ended_at: deleteField(), ended_by: deleteField() }));
    await assertSucceeds(getDoc(doc(como(ANA), 'coach_content', 'cc_alunos')));
    // De volta ao normal: o professor pausa e reativa como antes.
    await assertSucceeds(updateDoc(doc(como(PROF), 'coach_students', vinc(ANA)), { status: 'paused' }));
    await assertSucceeds(updateDoc(doc(como(PROF), 'coach_students', vinc(ANA)), { status: 'active' }));
  });

  it('a aluna recusa o novo convite', async () => {
    await fimGravado(ANA, 'invited');
    await assertSucceeds(updateDoc(doc(como(ANA), 'coach_students', vinc(ANA)), encerrar(ANA)));
  });

  it('vínculo sem histórico de fim segue como antes: o professor remove', async () => {
    await assertSucceeds(deleteDoc(doc(como(PROF), 'coach_students', vinc(BIA))));
  });

  it('⭐ o vínculo entre os dois, por consulta: quem não tem vínculo recebe "nenhum", não recusa', async () => {
    const entre = (uid, aluno) => getDocs(query(collection(como(uid), 'coach_students'),
      where('coach_id', '==', PROF), where('student_id', '==', aluno)));
    await assertSucceeds(entre(ANA, ANA));
    await assertSucceeds(entre(PROF, ANA));
    await assertSucceeds(entre(DUDA, DUDA));
    await assertSucceeds(entre(PROF, DUDA));
    await assertFails(entre(DUDA, ANA));
  });

  it('⭐ a conta da aluna foi excluída: o professor tira a ficha encerrada', async () => {
    await fimGravado(ANA);
    await assertFails(deleteDoc(doc(como(PROF), 'coach_students', vinc(ANA))));
    await testEnv.withSecurityRulesDisabled((ctx) => deleteDoc(doc(ctx.firestore(), 'users', ANA)));
    await assertFails(deleteDoc(doc(como(DUDA), 'coach_students', vinc(ANA))));
    await assertSucceeds(deleteDoc(doc(como(PROF), 'coach_students', vinc(ANA))));
  });
});
