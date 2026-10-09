/**
 * A coleta do treino para a exportação: cada parte falha sozinha e o que não
 * veio é DITO — nunca vira "você não tem nada".
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const falhar = new Set();
const resp = (nome, valor) => vi.fn(async () => {
  if (falhar.has(nome)) throw new Error('permission-denied');
  return valor;
});

vi.mock('./trainingItemService.js', () => ({ listMyItems: resp('items', [{ id: 'i1' }]) }));
vi.mock('./sessionService.js', () => ({
  listMySessions: resp('sessions', [{ id: 's1' }, { id: 's2' }]),
  listComments: vi.fn(async (sid) => {
    if (falhar.has(`comments:${sid}`)) throw new Error('x');
    return [{ id: `c-${sid}` }];
  }),
}));
vi.mock('./planService.js', () => ({ listMyPlans: resp('plans', [{ id: 'p1' }]) }));
vi.mock('./metaService.js', () => ({ getMeta: resp('meta', { routine: { days: [2] } }) }));
vi.mock('./shareService.js', () => ({ listSent: resp('sent', [{ id: 'e1' }]), listInbox: resp('received', []) }));
vi.mock('./questionService.js', () => ({
  listMyQuestions: resp('asked', [{ id: 'q1' }]),
  listCoachQuestions: resp('answered', [{ id: 'q2' }]),
  listMessages: vi.fn(async (qid) => [{ id: `m-${qid}` }]),
}));
vi.mock('./reportService.js', () => ({ listMyReports: resp('reports', [{ id: 'r1' }]) }));
vi.mock('./mediaUploadService.js', () => ({ listMyUploadPaths: resp('media', ['treino/u1/a.webp']) }));
vi.mock('@/modules/progression/services/goalService', () => ({ listGoals: resp('goals', [{ id: 'g1' }]) }));

const { collectTrainingExport } = await import('./trainingExportService.js');

beforeEach(() => falhar.clear());

describe('collectTrainingExport', () => {
  it('junta tudo: diário com comentários, dúvidas dos dois lados com mensagens, mídia e metas', async () => {
    const r = await collectTrainingExport('u1');
    expect(r.incomplete).toEqual([]);
    expect(r.training.sessions).toEqual([{ id: 's1', comments: [{ id: 'c-s1' }] }, { id: 's2', comments: [{ id: 'c-s2' }] }]);
    expect(r.training.questions.map((q) => q.id)).toEqual(['q1', 'q2']);
    expect(r.training.questions[1].messages).toEqual([{ id: 'm-q2' }]);
    expect(r.training.shares).toEqual({ sent: [{ id: 'e1' }], received: [] });
    expect(r.training.media_paths).toEqual(['treino/u1/a.webp']);
    expect(r.goals).toEqual([{ id: 'g1' }]);
  });

  it('⭐ uma parte que falha não derruba as outras e fica escrita', async () => {
    falhar.add('sessions');
    falhar.add('media');
    const r = await collectTrainingExport('u1');
    expect(r.incomplete).toEqual(['Diário de treino', 'Lista de fotos e vídeos de treino enviados']);
    expect(r.training.items).toEqual([{ id: 'i1' }]);
    expect(r.training.sessions).toEqual([]);
  });

  it('⭐ comentário que falha: a sessão vem, sem os comentários (null, não lista vazia)', async () => {
    falhar.add('comments:s2');
    const r = await collectTrainingExport('u1');
    expect(r.incomplete).toEqual(['Comentários do diário de treino']);
    expect(r.training.sessions[1]).toEqual({ id: 's2', comments: null });
  });

  it('metas que falham ficam ausentes (não viram lista vazia)', async () => {
    falhar.add('goals');
    const r = await collectTrainingExport('u1');
    expect(r.goals).toBeUndefined();
    expect(r.incomplete).toContain('Metas pessoais');
  });
});
