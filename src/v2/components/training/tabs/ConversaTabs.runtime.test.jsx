/**
 * As abas do grupo CONVERSA (Dúvidas · Alunos):
 *  - atleta sem professor ativo vê a explicação (e o caminho para professores);
 *  - `?nova=1&item=x` abre a nova dúvida já citando o item;
 *  - o professor vê primeiro as dúvidas que esperam a resposta dele;
 *  - leitura que falha diz que falhou — nunca "nenhuma";
 *  - Alunos: aluno com treino para confirmar mostra "Confirmar que vi".
 */
import React from 'react';
import { createRoot } from 'react-dom/client';
import { act } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { todayLocal, weekKeyOf } from '@/modules/training/domain/dates';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const base = {
  uid: 'eu', name: 'Ana', photo: null, isAdmin: false, isCoach: false, coachReady: true,
  activeCoachIds: [], coachLinks: [], coachLinksError: false, ageYears: 30, actor: { uid: 'eu' },
};
const ok = (data) => ({ isPending: false, isLoading: false, isError: false, isSuccess: true, data, refetch: vi.fn() });
const falha = () => ({ isPending: false, isLoading: false, isError: true, isSuccess: false, data: undefined, refetch: vi.fn() });
const mut = () => ({ mutate: vi.fn(), isPending: false });
const est = {};

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock('@/modules/training/hooks/useTrainingQuestions', () => ({
  useMyTrainingQuestions: () => est.minhas,
  useCoachTrainingQuestions: () => est.dosAlunos,
  useQuestionMessages: () => ok([]),
  useQuestionActions: () => ({ create: mut(), send: mut(), close: mut(), remove: mut() }),
}));
vi.mock('@/modules/training/hooks/useTrainingItems', () => ({
  useTrainingItem: (id) => (id ? ok({ item: { id, title: 'Dink cruzado' }, reason: '' }) : { isPending: true, data: undefined }),
}));
vi.mock('@/modules/progression/hooks/usePeople', () => ({
  usePeople: () => ({ people: new Map([['prof', { name: 'Professor Beto', known: true }]]) }),
}));
vi.mock('@/modules/coaches/hooks/useStudents', () => ({ useCoachStudents: () => est.alunos, useStudent: () => est.vinculo }));
vi.mock('@/modules/training/hooks/useTrainingSessions', () => ({
  useStudentTrainingSessions: () => est.sessoesAlunos,
  useSessionActions: () => ({ confirm: mut(), comment: mut(), deleteComment: mut() }),
  useSessionComments: () => ok([]),
}));
vi.mock('@/modules/training/hooks/useTrainingShares', () => ({ useTrainingSent: () => est.enviados }));

const { default: QuestionsTab } = await import('./QuestionsTab.jsx');
const { default: StudentsTab } = await import('./StudentsTab.jsx');

let container;
let root;
beforeEach(() => {
  est.minhas = ok([]);
  est.dosAlunos = ok([]);
  est.alunos = ok([]);
  est.sessoesAlunos = ok({ items: [], incompleto: false });
  est.enviados = ok([]);
  est.vinculo = ok({ status: 'active' });
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});
afterEach(() => { act(() => root.unmount()); container.remove(); document.body.innerHTML = ''; });

const render = async (el) => {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  await act(async () => {
    root.render(<QueryClientProvider client={qc}><MemoryRouter>{el}</MemoryRouter></QueryClientProvider>);
  });
};
const texto = () => document.body.textContent;
const p = (q = '') => new URLSearchParams(q);

describe('Dúvidas', () => {
  it('atleta sem professor ativo vê a explicação e o caminho', async () => {
    await render(<QuestionsTab identity={base} params={p()} irPara={vi.fn()} />);
    expect(texto()).toContain('As dúvidas vão para o seu professor');
    expect(container.querySelector('a[href="/coaches"]')).not.toBeNull();
    expect(texto()).not.toContain('Nova dúvida');
  });

  it('?nova=1&item=x abre a nova dúvida citando o item e o professor', async () => {
    const aluno = { ...base, activeCoachIds: ['prof'], coachLinks: [{ coach_id: 'prof' }] };
    await render(<QuestionsTab identity={aluno} params={p('nova=1&item=d1')} irPara={vi.fn()} />);
    expect(texto()).toContain('Sobre: Dink cruzado');
    expect(texto()).toContain('Professor Beto');
    expect(document.getElementById('duvida-assunto')).not.toBeNull();
  });

  it('o professor vê primeiro as que esperam a resposta dele', async () => {
    const prof = { ...base, isCoach: true };
    est.dosAlunos = ok([
      { id: 'q1', subject: 'Já respondida', status: 'respondida', coach_uid: 'eu', asker_name: 'Bia', updated_at: { seconds: 200 } },
      { id: 'q2', subject: 'Esperando', status: 'aberta', coach_uid: 'eu', asker_name: 'Caio', updated_at: { seconds: 100 } },
    ]);
    await render(<QuestionsTab identity={prof} params={p()} irPara={vi.fn()} />);
    const itens = [...container.querySelectorAll('[data-dica="treino-duvidas-lista"] li')].map((li) => li.textContent);
    expect(itens[0]).toContain('Esperando');
    expect(itens[0]).toContain('Responder');
    expect(itens[1]).toContain('Já respondida');
  });

  it('leitura que falha diz que falhou — nunca "nenhuma dúvida"', async () => {
    est.minhas = falha();
    const aluno = { ...base, activeCoachIds: ['prof'] };
    await render(<QuestionsTab identity={aluno} params={p()} irPara={vi.fn()} />);
    expect(texto()).toContain('As dúvidas não carregaram');
    expect(texto()).not.toContain('Nenhuma dúvida');
  });

  it('?q=<id> abre a conversa', async () => {
    est.minhas = ok([{ id: 'q9', subject: 'Sobre o saque', status: 'aberta', coach_uid: 'prof', coach_name: 'Professor Beto', asker_uid: 'eu' }]);
    await render(<QuestionsTab identity={{ ...base, activeCoachIds: ['prof'] }} params={p('q=q9')} irPara={vi.fn()} />);
    expect(texto()).toContain('Sobre o saque');
    expect(texto()).toContain('Com Professor Beto');
    expect(document.getElementById('resposta-q9')).not.toBeNull();
  });

  it('vínculo encerrado: a conversa fica para consulta, sem campo para escrever', async () => {
    est.minhas = ok([{ id: 'q9', subject: 'Sobre o saque', status: 'aberta', coach_uid: 'prof', coach_name: 'Professor Beto', asker_uid: 'eu' }]);
    est.vinculo = ok({ status: 'ended' });
    await render(<QuestionsTab identity={{ ...base, activeCoachIds: [] }} params={p('q=q9')} irPara={vi.fn()} />);
    expect(texto()).toContain('fica aqui para consulta');
    expect(document.getElementById('resposta-q9')).toBeNull();
    expect(texto()).not.toContain('Encerrar a conversa');
    expect(texto()).toContain('Apagar');
  });

  it('o vínculo ainda carregando (ou falhando) não fecha a conversa', async () => {
    est.minhas = ok([{ id: 'q9', subject: 'Sobre o saque', status: 'aberta', coach_uid: 'prof', coach_name: 'Professor Beto', asker_uid: 'eu' }]);
    est.vinculo = falha();
    await render(<QuestionsTab identity={{ ...base, activeCoachIds: ['prof'] }} params={p('q=q9')} irPara={vi.fn()} />);
    expect(document.getElementById('resposta-q9')).not.toBeNull();
  });
});

describe('Alunos', () => {
  const prof = { ...base, isCoach: true };

  it('sem alunos, explica onde adicioná-los', async () => {
    await render(<StudentsTab identity={prof} irPara={vi.fn()} />);
    expect(texto()).toContain('Você ainda não tem alunos');
    expect(container.querySelector('a[href="/aulas?aba=alunos"]')).not.toBeNull();
  });

  it('falha ao ler os alunos não vira "sem alunos"', async () => {
    est.alunos = falha();
    await render(<StudentsTab identity={prof} irPara={vi.fn()} />);
    expect(texto()).toContain('Os seus alunos não carregaram');
    expect(texto()).not.toContain('Você ainda não tem alunos');
  });

  it('aluno com treino mostrado aparece com o que confirmar; convidado só como pendente', async () => {
    const hoje = todayLocal();
    est.alunos = ok([
      { id: 'prof_bia', student_id: 'bia', student_name: 'Bia', status: 'active' },
      { id: 'prof_duda', student_id: 'duda', student_name: 'Duda', status: 'invited' },
    ]);
    est.sessoesAlunos = ok({ items: [{ id: 's1', uid: 'bia', date: hoje, week_key: weekKeyOf(hoje), title: 'Dink', duration_min: 30 }], incompleto: false });
    await render(<StudentsTab identity={prof} irPara={vi.fn()} />);
    expect(texto()).toContain('1 de 1');
    expect(texto()).toContain('Bia');
    expect(texto()).toContain('1 para confirmar');
    expect(texto()).toContain('Convidados, ainda sem aceitar');
    const botao = [...container.querySelectorAll('button[aria-expanded]')].find((b) => b.textContent.includes('Bia'));
    await act(async () => { botao.click(); });
    expect(container.querySelector('[data-dica="treino-alunos-confirmar"]')).not.toBeNull();
  });
});
