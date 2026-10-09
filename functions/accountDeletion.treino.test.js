/**
 * Exclusão de cadastro — o CENTRO DE TREINO e o lado PROFESSOR, com as
 * especificações REAIS, contra o Firestore falso.
 *
 * O que estes testes protegem:
 *  1. o que é só da pessoa some (itens privados e só para alunos, diário com
 *     os comentários, planos, rotina, envios dos dois lados, dúvidas que fez
 *     com as mensagens, fotos e vídeos de `treino/{uid}/`, a oferta do
 *     professor e as configurações de divulgação);
 *  2. o item PÚBLICO aprovado fica, sem o nome e sem as mídias enviadas;
 *  3. ⭐ NENHUM documento de outra pessoa é apagado — a lista do que some é
 *     conferida inteira, não por amostra;
 *  4. denúncias, aulas dadas e pacotes vendidos ficam como estão.
 */
import { describe, it, expect } from 'vitest';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const {
  analyzeAccount, executeAccountDeletion, REMOVED_USER, REMOVED_MESSAGE,
  trainingItemStays, patchTrainingItemAuthor, patchDerivedFrom, patchSharedUids, patchTrainingMessage,
} = require('../functions/accountDeletion.js');
const {
  createFakeDb, createFakeAuth, createFakeBucket, FakeFieldValue,
} = require('../tests/fakes/fakeFirestore.cjs');

const HOJE = '2026-10-09';
const ADMIN = { uid: 'admin', name: 'Dono', email: 'dono@x.com' };

function cenario() {
  const db = createFakeDb({
    'users/prof': { uid: 'prof', full_name: 'Prof Ana', email: 'ana@example.com' },
    'users/aluno': { uid: 'aluno', full_name: 'Aluno Bia' },
    // itens
    'training_items/i_priv': { author_uid: 'prof', author_name: 'Prof Ana', visibility: 'privado', review: 'nao_se_aplica' },
    'training_items/i_alunos': { author_uid: 'prof', author_name: 'Prof Ana', visibility: 'alunos', review: 'nao_se_aplica' },
    'training_items/i_pend': { author_uid: 'prof', author_name: 'Prof Ana', visibility: 'publico', review: 'pendente' },
    'training_items/i_pub': {
      author_uid: 'prof',
      author_name: 'Prof Ana',
      author_photo: 'https://foto',
      visibility: 'publico',
      review: 'aprovado',
      media: [
        { source: 'upload', type: 'image', path: 'treino/prof/a.webp', url: 'https://storage/a' },
        { source: 'url', type: 'video', url: 'https://youtu.be/abc' },
      ],
    },
    'training_items/i_copia': {
      author_uid: 'aluno', author_name: 'Aluno Bia', visibility: 'privado', review: 'nao_se_aplica',
      derived_from: { id: 'i_pub', title: 'Dinks', author_name: 'Prof Ana', locked: false },
      shared_uids: ['prof', 'outro'],
    },
    'training_items/i_outro': { author_uid: 'outro', author_name: 'Outro', visibility: 'privado', review: 'nao_se_aplica', shared_uids: ['x'] },
    // diário
    'training_sessions/s_prof': { uid: 'prof', date: '2026-10-01' },
    'training_sessions/s_prof/comments/c1': { uid: 'prof', name: 'Prof Ana', text: 'ok' },
    'training_sessions/s_prof/comments/c2': { uid: 'aluno', name: 'Aluno Bia', text: 'oi' },
    'training_sessions/s_aluno': { uid: 'aluno', date: '2026-10-02', shared_coach_id: 'prof', coach_confirmed_at: 'ontem' },
    'training_sessions/s_aluno/comments/c3': { uid: 'prof', name: 'Prof Ana', text: 'Boa!' },
    'training_sessions/s_aluno/comments/c4': { uid: 'aluno', name: 'Aluno Bia', text: 'Valeu' },
    'training_sessions/s_outro': { uid: 'outro', date: '2026-10-03' },
    // planos, rotina, envios
    'training_plans/p1': { uid: 'prof', title: 'Meu plano' },
    'training_plans/p2': { uid: 'aluno', title: 'Plano da Bia' },
    'training_meta/prof': { routine: { days: [1] } },
    'training_meta/aluno': { routine: { days: [2] } },
    'training_shares/e1': { from_uid: 'prof', to_uid: 'aluno', from_name: 'Prof Ana' },
    'training_shares/e2': { from_uid: 'aluno', to_uid: 'prof', from_name: 'Aluno Bia' },
    'training_shares/e3': { from_uid: 'aluno', to_uid: 'outro', from_name: 'Aluno Bia' },
    // dúvidas
    'training_questions/q1': { asker_uid: 'prof', asker_name: 'Prof Ana', coach_uid: 'outroProf', coach_name: 'Outro Prof' },
    'training_questions/q1/messages/m1': { uid: 'prof', name: 'Prof Ana', text: 'Como faço?' },
    'training_questions/q1/messages/m2': { uid: 'outroProf', name: 'Outro Prof', text: 'Assim.' },
    'training_questions/q2': { asker_uid: 'aluno', asker_name: 'Aluno Bia', coach_uid: 'prof', coach_name: 'Prof Ana' },
    'training_questions/q2/messages/m3': { uid: 'aluno', name: 'Aluno Bia', text: 'Dúvida' },
    'training_questions/q2/messages/m4': { uid: 'prof', name: 'Prof Ana', text: 'Resposta' },
    // denúncias
    'training_reports/r1': { reporter_uid: 'prof', item_id: 'i_outro', item_author_uid: 'outro', reason: 'spam' },
    'training_reports/r2': { reporter_uid: 'aluno', item_id: 'i_pub', item_author_uid: 'prof', reason: 'impreciso' },
    // o lado professor
    'coach_content/cc1': { coach_id: 'prof', title: 'Vídeo' },
    'coach_content/cc2': { coach_id: 'outroProf', title: 'Vídeo' },
    'coach_packages/pk1': { coach_id: 'prof', name: '10 aulas' },
    'coach_products/pr1': { coach_id: 'prof', name: 'Raquete' },
    'coach_lessons/l1': { coach_id: 'prof', student_id: 'aluno', student_name: 'Aluno Bia', price: 100 },
    'coach_package_sales/ps1': { coach_id: 'prof', student_id: 'aluno', student_name: 'Aluno Bia', total: 500 },
    'promo_settings/prof': { coupon_costs: { a: 5 } },
    'promo_settings/platform': { coupon_costs: { b: 1 } },
    'promo_coupons/cp1': { issuer_type: 'coach', issuer_id: 'prof', code: 'ANA10' },
    'promo_coupons/cp2': { issuer_type: 'platform', issuer_id: 'platform', code: 'PR10' },
    'promo_campaigns/cm1': { issuer_type: 'coach', issuer_id: 'prof', title: 'Aulas' },
  });
  const auth = createFakeAuth(['prof', 'aluno'], { log: db.store.log });
  const bucket = createFakeBucket(['treino/prof/a.webp', 'treino/prof/b.mp4', 'uploads/prof/x.jpg', 'treino/aluno/c.webp', 'treino/professora/d.webp']);
  return { db, auth, bucket, ctx: { db, auth, bucket } };
}

const executar = (ctx) => executeAccountDeletion(ctx, 'prof', {
  actor: ADMIN, reason: 'pedido da titular', hojeISO: HOJE, FieldValue: FakeFieldValue,
});
const linha = (xs, label) => (xs.find((x) => x.label === label) || { count: 0 }).count;

describe('a prévia do servidor mostra o treino e o lado professor', () => {
  it('⭐ conta o que some, o que perde o nome e o que fica — sem gravar nada', async () => {
    const { db, ctx } = cenario();
    const antes = new Map(db.store.docs);
    const { report } = await analyzeAccount(ctx, 'prof', { actorUid: 'admin', hojeISO: HOJE });
    expect(report.canDelete).toBe(true);
    expect(linha(report.deletes, 'Itens de treino privados e só para alunos')).toBe(3);
    expect(linha(report.deletes, 'Diário de treino e comentários')).toBe(4); // s_prof + c1 + c2 + c3
    expect(linha(report.deletes, 'Dúvidas de treino e mensagens')).toBe(3);
    expect(linha(report.deletes, 'Planos de treino')).toBe(1);
    expect(linha(report.deletes, 'Rotina e preferências do treino')).toBe(1);
    expect(linha(report.deletes, 'Treinos enviados e recebidos')).toBe(2);
    expect(linha(report.deletes, 'Conteúdo publicado como professor')).toBe(1);
    expect(linha(report.deletes, 'Pacotes de aula oferecidos')).toBe(1);
    expect(linha(report.deletes, 'Produtos da loja do professor')).toBe(1);
    expect(linha(report.deletes, 'Configurações de divulgação (professor)')).toBe(1);
    expect(linha(report.deletes, 'Cupons do professor')).toBe(1);
    expect(linha(report.deletes, 'Campanhas do professor')).toBe(1);
    expect(linha(report.deletes, 'Fotos e arquivos enviados')).toBe(3); // treino/prof (2) + uploads/prof (1)
    // i_pub (autoria) + i_copia ("copiado de")
    expect(linha(report.pseudonyms, 'Itens de treino públicos (autoria removida)')).toBe(2);
    expect(linha(report.pseudonyms, 'Acesso a itens de treino de outras pessoas')).toBe(1);
    expect(linha(report.pseudonyms, 'Diários de alunos que acompanhava')).toBe(1);
    expect(linha(report.pseudonyms, 'Dúvidas que respondeu como professor')).toBe(2); // q2 + m4
    expect(linha(report.retained, 'Denúncias de conteúdo que fez')).toBe(1);
    expect(linha(report.retained, 'Denúncias sobre o conteúdo da conta')).toBe(1);
    expect(linha(report.retained, 'Aulas particulares dadas (como professor)')).toBe(1);
    expect(linha(report.retained, 'Pacotes de aula vendidos (como professor)')).toBe(1);
    expect(db.store.log).toEqual([]);
    expect(db.store.docs).toEqual(antes);
  });
});

describe('a execução', () => {
  it('⭐ apaga EXATAMENTE o que é da pessoa — nenhum documento de outra pessoa some', async () => {
    const { db, ctx } = cenario();
    const antes = new Set(db.store.docs.keys());
    const r = await executar(ctx);
    expect(r.status).toBe('deleted');
    const sumiram = [...antes].filter((p) => !db.store.docs.has(p)).sort();
    expect(sumiram).toEqual([
      'coach_content/cc1',
      'coach_packages/pk1',
      'coach_products/pr1',
      'promo_campaigns/cm1',
      'promo_coupons/cp1',
      'promo_settings/prof',
      'training_items/i_alunos',
      'training_items/i_pend',
      'training_items/i_priv',
      'training_meta/prof',
      'training_plans/p1',
      'training_questions/q1',
      'training_questions/q1/messages/m1',
      'training_questions/q1/messages/m2',
      'training_sessions/s_aluno/comments/c3',
      'training_sessions/s_prof',
      'training_sessions/s_prof/comments/c1',
      'training_sessions/s_prof/comments/c2',
      'training_shares/e1',
      'training_shares/e2',
      'users/prof',
    ]);
  });

  it('⭐ o item público aprovado fica: sem nome, sem foto, sem a mídia enviada (o link fica)', async () => {
    const { db, ctx } = cenario();
    await executar(ctx);
    const it = db.store.docs.get('training_items/i_pub');
    expect(it.author_uid).toBe('prof');
    expect(it.author_name).toBe(REMOVED_USER);
    expect(it.author_photo).toBeNull();
    expect(it.media).toEqual([{ source: 'url', type: 'video', url: 'https://youtu.be/abc' }]);
  });

  it('a cópia de outra pessoa perde o nome no "copiado de" e o acesso da conta excluída', async () => {
    const { db, ctx } = cenario();
    await executar(ctx);
    const c = db.store.docs.get('training_items/i_copia');
    expect(c.derived_from).toEqual({ id: 'i_pub', title: 'Dinks', author_name: REMOVED_USER, locked: false });
    expect(c.shared_uids).toEqual(['outro']);
    expect(c.author_name).toBe('Aluno Bia');
    expect(db.store.docs.get('training_items/i_outro').shared_uids).toEqual(['x']);
  });

  it('o diário do aluno fica, sem o compartilhamento e sem os comentários dela', async () => {
    const { db, ctx } = cenario();
    await executar(ctx);
    expect(db.store.docs.get('training_sessions/s_aluno')).toEqual({
      uid: 'aluno', date: '2026-10-02', shared_coach_id: null, coach_confirmed_at: 'ontem',
    });
    expect(db.store.docs.get('training_sessions/s_aluno/comments/c4').text).toBe('Valeu');
    expect(db.store.docs.has('training_sessions/s_outro')).toBe(true);
  });

  it('a dúvida que respondeu fica para o aluno, com o nome e o texto dela trocados', async () => {
    const { db, ctx } = cenario();
    await executar(ctx);
    expect(db.store.docs.get('training_questions/q2').coach_name).toBe(REMOVED_USER);
    expect(db.store.docs.get('training_questions/q2/messages/m4')).toEqual({ uid: 'prof', name: REMOVED_USER, text: REMOVED_MESSAGE });
    expect(db.store.docs.get('training_questions/q2/messages/m3').text).toBe('Dúvida');
  });

  it('denúncias, aulas dadas e pacotes vendidos ficam intactos', async () => {
    const { db, ctx } = cenario();
    const antes = ['training_reports/r1', 'training_reports/r2', 'coach_lessons/l1', 'coach_package_sales/ps1']
      .map((p) => [p, db.store.docs.get(p)]);
    await executar(ctx);
    antes.forEach(([p, d]) => expect(db.store.docs.get(p)).toEqual(d));
  });

  it('⭐ Storage: as duas pastas DELA somem; a de outra pessoa — mesmo com nome parecido — fica', async () => {
    const { bucket, ctx } = cenario();
    await executar(ctx);
    expect(bucket.arquivos).toEqual(['treino/aluno/c.webp', 'treino/professora/d.webp']);
  });

  it('rodar de novo é seguro', async () => {
    const { db, ctx } = cenario();
    await executar(ctx);
    const depois = new Map([...db.store.docs].filter(([p]) => !p.startsWith('audit_logs/')));
    await executar(ctx);
    expect(new Map([...db.store.docs].filter(([p]) => !p.startsWith('audit_logs/')))).toEqual(depois);
  });
});

describe('as trocas, puras', () => {
  it('só público APROVADO fica', () => {
    expect(trainingItemStays({ visibility: 'publico', review: 'aprovado' })).toBe(true);
    expect(trainingItemStays({ visibility: 'publico', review: 'pendente' })).toBe(false);
    expect(trainingItemStays({ visibility: 'publico', review: 'recusado' })).toBe(false);
    expect(trainingItemStays({ visibility: 'alunos', review: 'nao_se_aplica' })).toBe(false);
    expect(trainingItemStays(null)).toBe(false);
  });

  it('não mexe no item de outra autoria nem repete troca já feita', () => {
    expect(patchTrainingItemAuthor({ author_uid: 'outro', author_name: 'X' }, 'prof')).toBeNull();
    expect(patchTrainingItemAuthor({ author_uid: 'prof', author_name: REMOVED_USER, author_photo: null }, 'prof')).toBeNull();
    expect(patchDerivedFrom({ derived_from: { author_name: REMOVED_USER } })).toBeNull();
    expect(patchDerivedFrom({})).toBeNull();
    expect(patchSharedUids({ shared_uids: ['a'] }, 'prof')).toBeNull();
    expect(patchTrainingMessage({ uid: 'outro', text: 'x' }, 'prof')).toBeNull();
  });

  it('a mídia de OUTRA pasta (mesmo prefixo de nome) não é tirada do item', () => {
    const p = patchTrainingItemAuthor({
      author_uid: 'prof', author_name: REMOVED_USER, media: [{ path: 'treino/professora/x.webp' }],
    }, 'prof');
    expect(p).toBeNull();
  });
});
