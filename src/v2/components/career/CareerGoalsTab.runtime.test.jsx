/**
 * Aba METAS: o estado da meta é dito em palavras (abandonada não aparece como
 * alcançada), excluir pergunta antes e diz quando falha, a meta ativa pode ser
 * editada, o rating DUPR sai no formato do idioma e a tela avisa do torneio
 * lançado só com o ano (o motivo de a meta "não andar").
 */
import React from 'react';
import { createRoot } from 'react-dom/client';
import { act } from 'react';
import { describe, it, expect, afterEach, vi } from 'vitest';
import { toast } from 'sonner';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const est = vi.hoisted(() => ({}));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock('@/core/lib/FirebaseAuthContext', () => ({ useAuth: () => ({ user: { uid: 'u1' }, userProfile: est.perfil }) }));
vi.mock('@/modules/rating/hooks/useDuprMode', () => ({ useDuprMode: () => ({ official: est.dupr }) }));
vi.mock('@/modules/progression/hooks/useProgression', () => ({
  useGoals: () => ({ isPending: false, isError: false, data: est.metas, refetch: vi.fn() }),
  useCreateGoal: () => ({ mutate: est.criar, isPending: false }),
  useUpdateGoal: () => ({ mutate: est.atualizar, isPending: est.salvando }),
  useDeleteGoal: () => ({ mutate: est.apagar, isPending: false }),
}));

import CareerGoalsTab from './CareerGoalsTab';

const meta = (extra = {}) => ({ id: 'g1', uid: 'u1', kind: 'outcome', title: 'Dois pódios', metric: 'career_podiums', target: 2, since: '2026-01-01', due_date: '2099-12-31', status: 'active', ...extra });
const linha = (items = []) => ({ seasons: [{ items }], faltou: [] });

let raiz;
let el;
const montar = (metas, { timeline = linha(), dupr = false, perfil = {}, salvando = false } = {}) => {
  Object.assign(est, { metas, dupr, perfil, salvando, criar: vi.fn(), atualizar: vi.fn(), apagar: vi.fn() });
  el = document.createElement('div');
  document.body.appendChild(el);
  raiz = createRoot(el);
  act(() => { raiz.render(<CareerGoalsTab data={{ isPending: false, timeline }} />); });
  return el;
};
const botao = (rotulo, onde = document.body) => [...onde.querySelectorAll('button')].find((b) => b.textContent.trim() === rotulo);
const tocar = (b) => act(() => { b.click(); });
afterEach(() => { act(() => raiz?.unmount()); document.body.innerHTML = ''; vi.clearAllMocks(); });

describe('CareerGoalsTab — o estado da meta', () => {
  it('🔴 a meta deixada de lado que já tinha batido o alvo não aparece como alcançada', () => {
    montar([meta({ kind: 'process', progress_manual: 100, status: 'dropped' }), meta({ id: 'g2', title: 'Outra', status: 'done' })]);
    tocar(botao('Concluídas e deixadas de lado (2)'));
    expect(el.textContent).toContain('Deixada de lado');
    expect(el.textContent).toContain('Concluída');
    expect(el.textContent).not.toContain('Alcançada');
  });

  it('prazo que passou é dito, sem tirar a meta das ativas', () => {
    montar([meta({ due_date: '2020-01-01', since: '2019-01-01' })]);
    expect(el.textContent).toContain('Prazo encerrado');
    expect(botao('Concluir')).toBeTruthy();
  });

  it('🔴 o rating DUPR sai com três casas e vírgula, não "4.525"', () => {
    montar([meta({ metric: 'dupr_rating', target: 4.75 })], { dupr: true, perfil: { dupr_verified: true, dupr_rating: 4.525 } });
    expect(el.textContent).toContain('4,525 de 4,750');
  });

  it('🔴 avisa do torneio lançado só com o ano dentro da janela da meta', () => {
    const item = { date: '2026-01-01', datePrecision: 'year', source: 'externo' };
    montar([meta({ metric: 'career_events_played' })], { timeline: linha([item]) });
    expect(el.textContent).toContain('1 torneio lançado só com o ano pode estar fora desta conta');
  });
});

describe('CareerGoalsTab — ações', () => {
  it('🔴 excluir pergunta antes; a falha é dita e a pergunta fecha', () => {
    montar([meta({ status: 'done' })]);
    tocar(botao('Concluídas e deixadas de lado (1)'));
    tocar(botao('Excluir'));
    expect(est.apagar).not.toHaveBeenCalled();
    const pergunta = document.querySelector('[role="alertdialog"]');
    expect(pergunta.textContent).toContain('"Dois pódios" sai das suas metas');
    tocar(botao('Excluir de vez', pergunta));
    expect(est.apagar).toHaveBeenCalledWith('g1', expect.any(Object));
    act(() => { est.apagar.mock.calls[0][1].onError(new Error('Sem permissão.')); });
    expect(toast.error).toHaveBeenCalledWith('Sem permissão.');
    expect(document.querySelector('[role="alertdialog"]')).toBeNull();
  });

  it('🔴 a meta ativa pode ser editada: o formulário abre preenchido e grava o patch', () => {
    const g = meta();
    montar([g]);
    tocar(botao('Editar'));
    const titulo = document.getElementById('meta-g1-titulo');
    expect(titulo.value).toBe('Dois pódios');
    expect(document.activeElement).toBe(titulo);
    // O tipo não muda na edição.
    expect(el.textContent).not.toContain('Tipo de meta');
    act(() => { titulo.form.requestSubmit(); });
    expect(est.atualizar).toHaveBeenCalledWith(
      { goal: g, patch: { title: 'Dois pódios', since: '2026-01-01', due_date: '2099-12-31', if_then: '', metric: 'career_podiums', target: 2 } },
      expect.any(Object),
    );
    // Salvo: o formulário fecha e o foco volta ao "Editar".
    act(() => { est.atualizar.mock.calls[0][1].onSuccess(); });
    expect(document.getElementById('meta-g1-titulo')).toBeNull();
    expect(document.activeElement.textContent.trim()).toBe('Editar');
  });

  it('o progresso da meta de processo não é desligado enquanto salva, e a mudança concorrente é ignorada', () => {
    montar([meta({ kind: 'process', metric: undefined, target: undefined, progress_manual: 25 })], { salvando: true });
    const sel = el.querySelector('select');
    expect(sel.disabled).toBe(false);
    act(() => {
      Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value').set.call(sel, '50');
      sel.dispatchEvent(new Event('change', { bubbles: true }));
    });
    expect(est.atualizar).not.toHaveBeenCalled();
  });

  it('concluir grava pela aba (o cartão some da lista e o aviso não pode morrer com ele)', () => {
    const g = meta();
    montar([g]);
    tocar(botao('Concluir'));
    expect(est.atualizar).toHaveBeenCalledWith({ goal: g, patch: { status: 'done' } }, expect.any(Object));
    act(() => { est.atualizar.mock.calls[0][1].onSuccess(); });
    expect(toast.success).toHaveBeenCalledWith('Meta concluída.');
  });
});
