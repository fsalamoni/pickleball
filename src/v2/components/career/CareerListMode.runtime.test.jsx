/**
 * Modo lista ("Vários de uma vez"): o que foi digitado não se perde.
 *  - as linhas ficam guardadas no navegador (por uid) até o servidor confirmar
 *    e voltam ao reabrir;
 *  - cada linha tem id estável: salvar de novo manda os MESMOS ids (não duplica);
 *  - a falha mostra a frase da mutação (prazo, sem conexão) e mantém as linhas.
 */
import React from 'react';
import { createRoot } from 'react-dom/client';
import { act } from 'react';
import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import { readViewPreference, writeViewPreference } from '@/core/lib/viewPreference';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const UID = 'ana';
vi.mock('@/core/lib/FirebaseAuthContext', () => ({ useAuth: () => ({ user: { uid: 'ana' } }) }));
const est = vi.hoisted(() => ({ mutateAsync: null, events: [] }));
vi.mock('@/modules/career/hooks/useCareer', () => ({
  useCareerEvents: () => ({ isSuccess: true, data: est.events }),
  useSaveCareerBatch: () => ({ mutateAsync: (...a) => est.mutateAsync(...a), isPending: false }),
}));
const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn(), message: vi.fn() }));
vi.mock('sonner', () => ({ toast }));

import CareerListMode, { CAREER_LIST_PREF } from './CareerListMode';

const LINHAS = [
  { id: `${UID}_l1`, year: 2023, name: 'Etapa Sul', format: 'doubles', gender: null, placement: 'champion' },
  { id: `${UID}_l2`, year: 2024, name: 'Open de Gramado', format: 'doubles', gender: null, placement: null },
];
let raiz;
const montar = (onOpenChange = vi.fn()) => {
  const el = document.createElement('div');
  document.body.appendChild(el);
  raiz = createRoot(el);
  act(() => { raiz.render(<CareerListMode open onOpenChange={onOpenChange} />); });
  return onOpenChange;
};
const botao = (texto) => [...document.body.querySelectorAll('button')].find((b) => b.textContent.includes(texto));
const guardadas = () => JSON.parse(readViewPreference(UID, CAREER_LIST_PREF) || '[]');

beforeEach(() => {
  window.localStorage.clear();
  est.events = [];
  est.mutateAsync = vi.fn().mockResolvedValue([]);
  // Já respondeu "Agora não" à pergunta da estimativa.
  writeViewPreference(UID, 'carreira:estimativa', 'skip');
});
afterEach(() => { act(() => raiz?.unmount()); document.body.innerHTML = ''; vi.clearAllMocks(); });

describe('CareerListMode', () => {
  it('🔴 reabrir traz de volta as linhas digitadas e não confirmadas', () => {
    writeViewPreference(UID, CAREER_LIST_PREF, JSON.stringify(LINHAS));
    montar();
    expect(document.getElementById('lista-nome-0').value).toBe('Etapa Sul');
    expect(document.getElementById('lista-nome-1').value).toBe('Open de Gramado');
  });

  it('🔴 a falha mostra a frase da mutação, mantém as linhas e o novo Salvar manda os MESMOS ids', async () => {
    writeViewPreference(UID, CAREER_LIST_PREF, JSON.stringify(LINHAS));
    est.mutateAsync = vi.fn().mockRejectedValue(new Error('A conexão está lenta e o envio ainda não foi confirmado.'));
    const onOpenChange = montar();
    await act(async () => { botao('Salvar todos').click(); });
    expect(document.body.textContent).toContain('A conexão está lenta e o envio ainda não foi confirmado.');
    expect(onOpenChange).not.toHaveBeenCalled();
    expect(guardadas().map((l) => l.id)).toEqual([`${UID}_l1`, `${UID}_l2`]);

    est.mutateAsync = vi.fn().mockResolvedValue([]);
    await act(async () => { botao('Salvar todos').click(); });
    expect(est.mutateAsync.mock.calls[0][0].map((e) => e.id)).toEqual([`${UID}_l1`, `${UID}_l2`]);
    expect(toast.success).toHaveBeenCalledWith('2 torneios registrados.');
    expect(onOpenChange).toHaveBeenCalledWith(false);
    // Confirmado: as linhas guardadas saem.
    expect(readViewPreference(UID, CAREER_LIST_PREF)).toBeNull();
  });

  it('linha que já virou torneio (o envio chegou depois do prazo) sai da lista: não regrava por cima', () => {
    writeViewPreference(UID, CAREER_LIST_PREF, JSON.stringify(LINHAS));
    est.events = [{ id: `${UID}_l1`, name: 'Etapa Sul' }];
    montar();
    expect(document.getElementById('lista-nome-0').value).toBe('Open de Gramado');
    expect(document.getElementById('lista-nome-1')).toBeNull();
  });

  it('o erro da linha é ligado ao campo (aria-invalid + aria-describedby) e diz qual linha', async () => {
    writeViewPreference(UID, CAREER_LIST_PREF, JSON.stringify([{ ...LINHAS[0], year: 1800 }]));
    montar();
    await act(async () => { botao('Salvar todos').click(); });
    const ano = document.getElementById('lista-ano-0');
    expect(ano.getAttribute('aria-invalid')).toBe('true');
    expect(document.getElementById(ano.getAttribute('aria-describedby')).textContent).toContain('Linha 1:');
    expect(est.mutateAsync).not.toHaveBeenCalled();
  });
});
