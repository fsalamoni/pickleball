/**
 * Exclusão de cadastro — o CENTRO DE TREINO e o lado PROFESSOR, com as
 * especificações REAIS, contra o Firestore falso.
 *
 * O que estes testes protegem:
 *  1. o que é só da pessoa some (itens PRIVADOS não compartilhados, diário com
 *     os comentários, planos, rotina, treinos recebidos, dúvidas que fez com
 *     as mensagens, os arquivos desses itens e as configurações de
 *     divulgação);
 *  2. ⭐ o CONTEÚDO que ela criou fica, com a autoria (decisão do dono,
 *     2026-10-09): itens que outras pessoas veem, com as fotos e vídeos;
 *     treinos que enviou; respostas a dúvidas; comentários em diários de
 *     alunos; conteúdo, pacotes e loja do professor; cupons e campanhas,
 *     fora do ar;
 *  3. ⭐ NENHUM documento de outra pessoa é apagado — a lista do que some é
 *     conferida inteira, não por amostra;
 *  4. denúncias, aulas dadas e pacotes vendidos ficam como estão;
 *  5. excluir o ALUNO encerra o vínculo com o professor.
 */
import { describe, it, expect } from 'vitest';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const {
  analyzeAccount, executeAccountDeletion,
  REMOVED_ATHLETE, QUERY_LIMIT, trainingItemStays, patchTrainingItemAuthor, patchDerivedFrom, patchSharedUids,
  patchCoachStudentLink, patchCoachCampaign, fica,
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
    'training_items/i_comp': { author_uid: 'prof', author_name: 'Prof Ana', visibility: 'privado', review: 'nao_se_aplica', shared_uids: ['aluno'] },
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
    'promo_coupons/cp1': {
      issuer_type: 'coach', issuer_id: 'prof', code: 'ANA10',
      art: { source: 'upload', image_url: 'https://firebasestorage.googleapis.com/v0/b/bkt/o/uploads%2Fprof%2Fcoach-coupons%2Fc.webp?alt=media' },
    },
    'promo_coupons/cp3': { issuer_type: 'coach', issuer_id: 'prof', code: 'VELHO', active: false },
    'promo_coupons/cp2': { issuer_type: 'platform', issuer_id: 'platform', code: 'PR10' },
    'promo_campaigns/cm1': {
      issuer_type: 'coach', issuer_id: 'prof', title: 'Aulas', banner_active: true, status: 'sent',
      banner: { source: 'upload', image_url: 'https://firebasestorage.googleapis.com/v0/b/bkt/o/uploads%2Fprof%2Fcoach-banners%2Fb.webp?alt=media' },
    },
    // a ficha do aluno na lista da professora
    'coach_students/prof_aluno': { coach_id: 'prof', student_id: 'aluno', student_name: 'Aluno Bia', status: 'active' },
  });
  const auth = createFakeAuth(['prof', 'aluno'], { log: db.store.log });
  const bucket = createFakeBucket([
    'treino/prof/a.webp', 'treino/prof/b.mp4', 'uploads/prof/x.jpg',
    'uploads/prof/coach-coupons/c.webp', 'uploads/prof/coach-banners/b.webp',
    'treino/aluno/c.webp', 'treino/professora/d.webp',
  ]);
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
    expect(linha(report.deletes, 'Itens de treino privados, não compartilhados')).toBe(1);
    expect(linha(report.deletes, 'Diário de treino e comentários')).toBe(3); // s_prof + c1 + c2
    expect(linha(report.deletes, 'Dúvidas de treino que fez e mensagens')).toBe(3);
    expect(linha(report.deletes, 'Planos de treino')).toBe(1);
    expect(linha(report.deletes, 'Rotina e preferências do treino')).toBe(1);
    expect(linha(report.deletes, 'Treinos recebidos')).toBe(1);
    expect(linha(report.deletes, 'Configurações de divulgação (professor)')).toBe(1);
    expect(linha(report.deletes, 'Lista de alunos (como professor)')).toBe(1);
    expect(linha(report.deletes, 'Fotos e arquivos enviados')).toBe(2); // treino/prof/b.mp4 + uploads/prof
    expect(linha(report.pseudonyms, 'Acesso a itens de treino de outras pessoas')).toBe(1);
    // o conteúdo criado fica, com a autoria
    expect(linha(report.retained, 'Itens de treino que criou (ficam, com a autoria)')).toBe(4); // i_comp, i_alunos, i_pend, i_pub
    expect(linha(report.retained, 'Fotos, vídeos e artes do conteúdo que fica')).toBe(3); // a.webp + arte do cupom e do banner
    expect(linha(report.retained, 'Treinos que enviou ou indicou (ficam com quem recebeu)')).toBe(1);
    expect(linha(report.retained, 'Dúvidas de alunos que respondeu (ficam, com as respostas)')).toBe(1);
    expect(linha(report.retained, 'Diários de alunos que acompanhava (os comentários ficam)')).toBe(1);
    expect(linha(report.retained, 'Conteúdo publicado como professor')).toBe(1);
    expect(linha(report.retained, 'Pacotes de aula oferecidos')).toBe(1);
    expect(linha(report.retained, 'Produtos da loja do professor')).toBe(1);
    expect(linha(report.retained, 'Cupons do professor (ficam, fora do ar)')).toBe(2); // o já desligado também fica
    expect(linha(report.retained, 'Campanhas do professor (ficam, fora do ar)')).toBe(1);
    expect(report.deletes.map((d) => d.label)).not.toContain('Conteúdo publicado como professor');
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
      'coach_students/prof_aluno',
      'promo_settings/prof',
      'training_items/i_priv',
      'training_meta/prof',
      'training_plans/p1',
      'training_questions/q1',
      'training_questions/q1/messages/m1',
      'training_questions/q1/messages/m2',
      'training_sessions/s_prof',
      'training_sessions/s_prof/comments/c1',
      'training_sessions/s_prof/comments/c2',
      'training_shares/e2',
      'users/prof',
    ]);
  });

  it('⭐ o item que criou fica com o nome e as mídias; só a foto de perfil sai', async () => {
    const { db, ctx } = cenario();
    const antes = ['i_comp', 'i_alunos', 'i_pend'].map((id) => [id, db.store.docs.get(`training_items/${id}`)]);
    await executar(ctx);
    const it = db.store.docs.get('training_items/i_pub');
    expect(it.author_uid).toBe('prof');
    expect(it.author_name).toBe('Prof Ana');
    expect(it.author_photo).toBeNull();
    expect(it.media).toHaveLength(2);
    antes.forEach(([id, d]) => expect(db.store.docs.get(`training_items/${id}`)).toEqual(d));
  });

  it('a cópia de outra pessoa guarda o "copiado de" com o nome; sai só o acesso da conta excluída', async () => {
    const { db, ctx } = cenario();
    await executar(ctx);
    const c = db.store.docs.get('training_items/i_copia');
    expect(c.derived_from).toEqual({ id: 'i_pub', title: 'Dinks', author_name: 'Prof Ana', locked: false });
    expect(c.shared_uids).toEqual(['outro']);
    expect(c.author_name).toBe('Aluno Bia');
    expect(db.store.docs.get('training_items/i_outro').shared_uids).toEqual(['x']);
  });

  it('o diário do aluno fica, sem o compartilhamento; os comentários dela ficam, com o nome', async () => {
    const { db, ctx } = cenario();
    await executar(ctx);
    expect(db.store.docs.get('training_sessions/s_aluno')).toEqual({
      uid: 'aluno', date: '2026-10-02', shared_coach_id: null, coach_confirmed_at: 'ontem',
    });
    expect(db.store.docs.get('training_sessions/s_aluno/comments/c3')).toEqual({ uid: 'prof', name: 'Prof Ana', text: 'Boa!' });
    expect(db.store.docs.get('training_sessions/s_aluno/comments/c4').text).toBe('Valeu');
    expect(db.store.docs.has('training_sessions/s_outro')).toBe(true);
  });

  it('a dúvida que respondeu fica como está, com as respostas e o nome', async () => {
    const { db, ctx } = cenario();
    const antes = ['training_questions/q2', 'training_questions/q2/messages/m3', 'training_questions/q2/messages/m4']
      .map((p) => [p, db.store.docs.get(p)]);
    await executar(ctx);
    antes.forEach(([p, d]) => expect(db.store.docs.get(p)).toEqual(d));
  });

  it('⭐ o conteúdo do professor fica; cupom e campanha ficam fora do ar', async () => {
    const { db, ctx } = cenario();
    const intactos = ['training_shares/e1', 'coach_content/cc1', 'coach_packages/pk1', 'coach_products/pr1', 'promo_coupons/cp2', 'promo_coupons/cp3']
      .map((p) => [p, db.store.docs.get(p)]);
    await executar(ctx);
    intactos.forEach(([p, d]) => expect(db.store.docs.get(p)).toEqual(d));
    expect(db.store.docs.get('promo_coupons/cp1')).toMatchObject({ code: 'ANA10', active: false });
    expect(db.store.docs.get('promo_campaigns/cm1')).toMatchObject({ title: 'Aulas', banner_active: false, status: 'cancelled' });
  });

  it('denúncias, aulas dadas e pacotes vendidos ficam intactos', async () => {
    const { db, ctx } = cenario();
    const antes = ['training_reports/r1', 'training_reports/r2', 'coach_lessons/l1', 'coach_package_sales/ps1']
      .map((p) => [p, db.store.docs.get(p)]);
    await executar(ctx);
    antes.forEach(([p, d]) => expect(db.store.docs.get(p)).toEqual(d));
  });

  it('⭐ Storage: as pastas DELA somem, menos a mídia do item que fica; a de outra pessoa fica', async () => {
    const { bucket, ctx } = cenario();
    await executar(ctx);
    // a foto de perfil sai; a arte do cupom e do banner que ficam, não
    expect(bucket.arquivos).toEqual([
      'treino/prof/a.webp', 'uploads/prof/coach-coupons/c.webp', 'uploads/prof/coach-banners/b.webp',
      'treino/aluno/c.webp', 'treino/professora/d.webp',
    ]);
  });

  it('⭐ excluir o ALUNO encerra o vínculo: o professor deixa de ser professor dele', async () => {
    const { db, ctx } = cenario();
    await executeAccountDeletion(ctx, 'aluno', {
      actor: ADMIN, reason: 'pedido do titular', hojeISO: HOJE, FieldValue: FakeFieldValue,
    });
    const v = db.store.docs.get('coach_students/prof_aluno');
    expect(v).toMatchObject({
      coach_id: 'prof', student_id: 'aluno', student_name: REMOVED_ATHLETE,
      status: 'ended', ended_by: 'aluno', ended_reason: 'conta_excluida',
    });
    expect(v.ended_at).toBeInstanceOf(Date);
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
  it('fica o que outras pessoas veem; só o privado não compartilhado sai', () => {
    expect(trainingItemStays({ visibility: 'publico', review: 'aprovado' })).toBe(true);
    expect(trainingItemStays({ visibility: 'publico', review: 'pendente' })).toBe(true);
    expect(trainingItemStays({ visibility: 'publico', review: 'recusado' })).toBe(true);
    expect(trainingItemStays({ visibility: 'alunos', review: 'nao_se_aplica' })).toBe(true);
    expect(trainingItemStays({ visibility: 'privado', shared_uids: ['x'] })).toBe(true);
    expect(trainingItemStays({ visibility: 'privado', shared_uids: [] })).toBe(false);
    expect(trainingItemStays({ visibility: 'privado' })).toBe(false);
    expect(trainingItemStays(null)).toBe(false);
  });

  it('o nome de autor nunca muda; só a foto de perfil sai', () => {
    expect(patchTrainingItemAuthor({ author_uid: 'outro', author_name: 'X', author_photo: 'f' }, 'prof')).toBeNull();
    expect(patchTrainingItemAuthor({ author_uid: 'prof', author_name: 'Prof Ana', author_photo: null }, 'prof')).toBeNull();
    expect(patchTrainingItemAuthor({ author_uid: 'prof', author_name: 'Prof Ana', author_photo: 'f', media: [{ path: 'treino/prof/a.webp' }] }, 'prof'))
      .toEqual({ author_photo: null });
    expect(patchDerivedFrom({ derived_from: { author_name: 'Prof Ana' } }, 'prof')).toBeNull();
    expect(patchDerivedFrom({})).toBeNull();
    expect(patchSharedUids({ shared_uids: ['a'] }, 'prof')).toBeNull();
  });

  it('a ficha do aluno excluído: nome sai e o vínculo encerra (uma vez só)', () => {
    const p = patchCoachStudentLink({ student_id: 'aluno', student_name: 'Bia', student_email: 'b@x', status: 'paused' }, 'aluno');
    expect(p).toMatchObject({ student_name: REMOVED_ATHLETE, student_email: null, status: 'ended', ended_by: 'aluno', ended_reason: 'conta_excluida' });
    // já encerrado: o fim de antes vale (quem encerrou e quando)
    expect(patchCoachStudentLink({ student_id: 'aluno', student_name: 'Bia', status: 'ended', ended_by: 'prof' }, 'aluno'))
      .toEqual({ student_name: REMOVED_ATHLETE, ended_reason: 'conta_excluida' });
    expect(patchCoachStudentLink({ student_id: 'outro', status: 'active' }, 'aluno')).toBeNull();
  });
});

describe('campanha fora do ar e arquivo que fica (puros)', () => {
  it('a campanha do professor sai do ar também na página dela', () => {
    expect(patchCoachCampaign({ issuer_id: 'prof', status: 'sent' }, 'prof')).toEqual({ status: 'cancelled', banner_active: false });
    expect(patchCoachCampaign({ issuer_id: 'prof', status: 'cancelled', banner_active: false }, 'prof')).toBeNull();
    expect(patchCoachCampaign({ issuer_id: 'platform', status: 'sent' }, 'prof')).toBeNull();
  });

  it('fica: o caminho exato ou a pasta inteira', () => {
    expect(fica(new Set(['treino/p/a.webp']), 'treino/p/a.webp')).toBe(true);
    expect(fica(new Set(['treino/p/a.webp']), 'treino/p/b.webp')).toBe(false);
    expect(fica(new Set(['treino/p/']), 'treino/p/b.webp')).toBe(true);
    expect(fica(new Set(['treino/p/']), 'uploads/p/b.webp')).toBe(false);
    expect(fica(undefined, 'treino/p/a.webp')).toBe(false);
  });
});

describe('mais itens que o limite da consulta', () => {
  it('⭐ a pasta do treino fica inteira e a exclusão sai parcial — nunca apaga mídia de item que fica', async () => {
    const docs = { 'users/prof': { uid: 'prof', full_name: 'Prof Ana' } };
    for (let i = 0; i <= QUERY_LIMIT; i += 1) {
      docs[`training_items/i${String(i).padStart(4, '0')}`] = {
        author_uid: 'prof', created_by: 'prof', author_name: 'Prof Ana', visibility: 'publico', review: 'aprovado',
        media: [{ source: 'upload', type: 'image', path: `treino/prof/${i}.webp` }],
      };
    }
    const db = createFakeDb(docs);
    const bucket = createFakeBucket([`treino/prof/${QUERY_LIMIT}.webp`, 'treino/prof/0.webp', 'uploads/prof/x.jpg']);
    const ctx = { db, auth: createFakeAuth(['prof'], { log: db.store.log }), bucket };
    const { report } = await analyzeAccount(ctx, 'prof', { actorUid: 'admin', hojeISO: HOJE });
    expect(report.truncated).toBe(true);
    expect(report.storageFiles).toBe(1); // só a foto de perfil
    const r = await executar(ctx);
    expect(r.status).toBe('partial');
    expect(bucket.arquivos).toEqual([`treino/prof/${QUERY_LIMIT}.webp`, 'treino/prof/0.webp']);
  });
});

describe('mídia enviada que outras pessoas usam', () => {
  const link = (caminho) => `https://firebasestorage.googleapis.com/v0/b/bkt/o/${encodeURIComponent(caminho)}?alt=media&token=t`;

  function cenarioMidia() {
    const db = createFakeDb({
      'users/prof': { uid: 'prof', full_name: 'Prof Ana' },
      'training_items/i_pub': {
        author_uid: 'prof', created_by: 'prof', author_name: 'Prof Ana', visibility: 'publico', review: 'aprovado',
        media: [{ source: 'upload', type: 'image', path: 'treino/prof/a.webp', url: link('treino/prof/a.webp') }],
      },
      // privado, não compartilhado: sai com o arquivo
      'training_items/i_priv': {
        author_uid: 'prof', created_by: 'prof', author_name: 'Prof Ana', visibility: 'privado', review: 'nao_se_aplica',
        media: [{ source: 'upload', type: 'image', path: 'treino/prof/p.webp', url: link('treino/prof/p.webp') }],
      },
      // a cópia guarda só o link (sem `path`)
      'training_items/i_copia': {
        author_uid: 'aluno', created_by: 'aluno', author_name: 'Aluno Bia', visibility: 'privado', review: 'nao_se_aplica',
        derived_from: { id: 'i_pub', title: 'Dinks', author_name: 'Prof Ana', locked: false },
        media: [
          { source: 'upload', type: 'image', path: null, url: link('treino/prof/a.webp') },
          { source: 'url', type: 'video', url: 'https://youtu.be/abc' },
        ],
      },
      // cópia de um item que ficou privado depois de copiado
      'training_items/i_copia2': {
        author_uid: 'aluno', created_by: 'aluno', author_name: 'Aluno Bia', visibility: 'privado', review: 'nao_se_aplica',
        derived_from: { id: 'i_priv', title: 'Saque', author_name: 'Prof Ana', locked: false },
        media: [
          { source: 'upload', type: 'image', path: null, url: link('treino/prof/p.webp') },
          { source: 'url', type: 'video', url: 'https://youtu.be/abc' },
        ],
      },
      // item da PLATAFORMA que ela montou quando era admin
      'training_items/i_plat': {
        author_uid: 'plataforma', created_by: 'prof', author_name: 'Equipe PickleRush', visibility: 'publico', review: 'aprovado',
        media: [{ source: 'upload', type: 'video', path: 'treino/prof/plat.mp4', url: link('treino/prof/plat.mp4') }],
      },
    });
    const auth = createFakeAuth(['prof'], { log: db.store.log });
    const bucket = createFakeBucket(['treino/prof/a.webp', 'treino/prof/p.webp', 'treino/prof/plat.mp4', 'treino/prof/solto.webp']);
    return { db, bucket, ctx: { db, auth, bucket } };
  }

  it('⭐ a mídia do item que fica, fica — no item, na cópia e no Storage', async () => {
    const { db, bucket, ctx } = cenarioMidia();
    const pub = db.store.docs.get('training_items/i_pub');
    const copia = db.store.docs.get('training_items/i_copia');
    await executar(ctx);
    expect(db.store.docs.get('training_items/i_pub')).toEqual(pub);
    expect(db.store.docs.get('training_items/i_copia')).toEqual(copia);
    expect(bucket.arquivos).toContain('treino/prof/a.webp');
  });

  it('⭐ a cópia do item que sai perde o link do arquivo que vai sumir (e mantém o vídeo de fora)', async () => {
    const { db, ctx } = cenarioMidia();
    await executar(ctx);
    expect(db.store.docs.get('training_items/i_copia2').media).toEqual([{ source: 'url', type: 'video', url: 'https://youtu.be/abc' }]);
    expect(db.store.docs.get('training_items/i_copia2').derived_from.author_name).toBe('Prof Ana');
    expect(db.store.docs.has('training_items/i_priv')).toBe(false);
  });

  it('⭐ o arquivo do item da PLATAFORMA fica no Storage e o item não é tocado', async () => {
    const { db, bucket, ctx } = cenarioMidia();
    const antes = db.store.docs.get('training_items/i_plat');
    const { report } = await analyzeAccount(ctx, 'prof', { actorUid: 'admin', hojeISO: HOJE });
    expect(linha(report.deletes, 'Fotos e arquivos enviados')).toBe(2); // p.webp + solto.webp
    expect(linha(report.retained, 'Fotos, vídeos e artes do conteúdo que fica')).toBe(2); // a.webp + plat.mp4
    await executar(ctx);
    expect(bucket.arquivos).toEqual(['treino/prof/a.webp', 'treino/prof/plat.mp4']);
    expect(db.store.docs.get('training_items/i_plat')).toEqual(antes);
  });

  it('a pasta é apagada mesmo quando a prévia não conseguiu listá-la', async () => {
    const { bucket, ctx } = cenarioMidia();
    const getFiles = bucket.getFiles.bind(bucket);
    let primeira = true;
    bucket.getFiles = async (o) => {
      if (primeira && o.prefix.startsWith('treino/')) { primeira = false; throw new Error('falhou'); }
      return getFiles(o);
    };
    await executar(ctx);
    expect(bucket.arquivos).toEqual(['treino/prof/a.webp', 'treino/prof/plat.mp4']);
  });

  it('a cópia de uma pasta de nome parecido não perde nada', () => {
    expect(patchDerivedFrom({
      derived_from: { author_name: 'Prof Ana' }, media: [{ url: link('treino/professora/x.webp') }],
    }, 'prof')).toBeNull();
  });
});
