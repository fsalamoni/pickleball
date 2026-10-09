import { describe, it, expect } from 'vitest';
import {
  SHARE_KIND, MAX_RECIPIENTS, needsSharedAccess, canShareItem, buildShares, sortInbox, unreadCount, dueLabel,
} from './share.js';

const publico = { id: 'p1', author_uid: 'autor', visibility: 'publico', review: 'aprovado', hidden: false, title: 'Dink', kind: 'drill' };
const privado = { id: 'v1', author_uid: 'autor', visibility: 'privado', review: 'nao_se_aplica', hidden: false, title: 'Meu', kind: 'treino' };

describe('canShareItem', () => {
  it('sem conta não compartilha', () => {
    expect(canShareItem(publico, {}).ok).toBe(false);
  });
  it('o próprio item, mesmo privado', () => {
    expect(canShareItem(privado, { uid: 'autor' }).ok).toBe(true);
  });
  it('item público da biblioteca, de outra pessoa', () => {
    expect(canShareItem(publico, { uid: 'outro' }).ok).toBe(true);
    expect(canShareItem({ ...publico, review: 'pendente' }, { uid: 'outro' }).ok).toBe(false);
    expect(canShareItem({ ...publico, hidden: true }, { uid: 'outro' }).ok).toBe(false);
  });
  it('o privado que recebi de outra pessoa, não', () => {
    expect(canShareItem({ ...privado, shared_uids: ['eu'] }, { uid: 'eu' }).ok).toBe(false);
  });
  it('conteúdo antigo (legacy) não, nem do próprio professor', () => {
    expect(canShareItem({ ...publico, legacy: true, author_uid: 'eu' }, { uid: 'eu' }).ok).toBe(false);
  });
});

describe('needsSharedAccess', () => {
  it('público não precisa; "alunos" para aluno não precisa; o resto precisa', () => {
    expect(needsSharedAccess(publico, { kind: SHARE_KIND.INDICACAO })).toBe(false);
    expect(needsSharedAccess({ ...privado, visibility: 'alunos' }, { kind: SHARE_KIND.ALUNO })).toBe(false);
    expect(needsSharedAccess({ ...privado, visibility: 'alunos' }, { kind: SHARE_KIND.INDICACAO })).toBe(true);
    expect(needsSharedAccess(privado, { kind: SHARE_KIND.ALUNO })).toBe(true);
  });
});

describe('buildShares', () => {
  const from = { uid: 'eu', name: 'Ana', role: 'professor' };

  it('um documento por destinatário, sem repetir nem mandar para si', () => {
    const s = buildShares({ item: privado, from, toUids: ['b', 'eu', 'b', '', null, 'c'] });
    expect(s.map((x) => x.to_uid)).toEqual(['b', 'c']);
    expect(s[0]).toEqual({
      from_uid: 'eu', from_name: 'Ana', from_role: 'professor', to_uid: 'b', item_id: 'v1', item_title: 'Meu',
      item_kind: 'treino', kind: 'indicacao', note: '', due_date: null, read_at: null, done_at: null, done_note: '',
    });
  });

  it(`no máximo ${MAX_RECIPIENTS} destinatários`, () => {
    const toUids = Array.from({ length: 50 }, (_, i) => `u${i}`);
    expect(buildShares({ item: publico, from, toUids })).toHaveLength(MAX_RECIPIENTS);
  });

  it('prazo só no envio de professor para aluno, e só data ISO', () => {
    expect(buildShares({ item: publico, from, toUids: ['b'], kind: 'aluno', dueDate: '2026-10-12' })[0].due_date).toBe('2026-10-12');
    expect(buildShares({ item: publico, from, toUids: ['b'], kind: 'aluno', dueDate: '12/10/2026' })[0].due_date).toBeNull();
    expect(buildShares({ item: publico, from, toUids: ['b'], kind: 'indicacao', dueDate: '2026-10-12' })[0].due_date).toBeNull();
  });

  it('tipo desconhecido vira indicação; papel e nome com padrão; nota cortada', () => {
    const [s] = buildShares({ item: publico, from: { uid: 'x', role: 'admin' }, toUids: ['b'], kind: 'raro', note: 'n'.repeat(900) });
    expect(s.kind).toBe('indicacao');
    expect(s.from_role).toBe('atleta');
    expect(s.from_name).toBe('Atleta');
    expect(s.note).toHaveLength(500);
  });
});

describe('caixa de entrada', () => {
  const ts = (s) => ({ seconds: s });

  it('do professor (prazo mais perto antes) › indicações (recentes antes) › concluídos', () => {
    const list = [
      { id: 'feito', kind: 'aluno', due_date: '2026-10-01', done_at: ts(5), created_at: ts(9) },
      { id: 'ind_velha', kind: 'indicacao', created_at: ts(1) },
      { id: 'prof_sem_prazo', kind: 'aluno', created_at: ts(8) },
      { id: 'prof_dia_12', kind: 'aluno', due_date: '2026-10-12', created_at: ts(2) },
      { id: 'ind_nova', kind: 'indicacao', created_at: ts(7) },
      { id: 'prof_dia_10', kind: 'aluno', due_date: '2026-10-10', created_at: ts(1) },
    ];
    expect(sortInbox(list).map((s) => s.id)).toEqual(['prof_dia_10', 'prof_dia_12', 'prof_sem_prazo', 'ind_nova', 'ind_velha', 'feito']);
  });

  it('não lidas: nem lidas nem concluídas', () => {
    expect(unreadCount([{}, { read_at: ts(1) }, { done_at: ts(1) }, {}])).toBe(2);
    expect(unreadCount()).toBe(0);
  });
});

describe('dueLabel', () => {
  const hoje = '2026-10-08';
  it.each([
    [null, ''],
    ['2026-10-08', 'para hoje'],
    ['2026-10-09', 'para amanhã'],
    ['2026-10-07', 'era para ontem'],
    ['2026-10-05', 'era para 3 dias atrás'],
    ['2026-11-02', 'até 02/11'],
  ])('%s → %s', (due, label) => expect(dueLabel(due, hoje)).toBe(label));
});
