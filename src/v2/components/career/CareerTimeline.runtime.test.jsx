/**
 * A linha do tempo da Carreira, nos estados em que ela mentia ou travava:
 *  - sem conexão a consulta fica PAUSADA: os rascunhos do aparelho aparecem (e
 *    abrem a ficha) no lugar de um esqueleto que nunca termina;
 *  - o rascunho recusado pelo servidor é dito;
 *  - "Enviar agora" dá retorno; plural certo; filtros sem saída têm "Limpar".
 */
import React from 'react';
import { createRoot } from 'react-dom/client';
import { act } from 'react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { describe, it, expect, afterEach, vi } from 'vitest';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

vi.mock('@/core/lib/FirebaseAuthContext', () => ({ useAuth: () => ({ user: { uid: 'ana' }, userProfile: {} }) }));
vi.mock('@/modules/career/domain/seasonRecap.js', () => ({ buildSeasonRecap: () => null }));
const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn(), message: vi.fn() }));
vi.mock('sonner', () => ({ toast }));

import CareerTimeline from './CareerTimeline';

const item = (extra) => ({ id: 'i1', title: 'Open de Floripa', source: 'career', date: '2025-05-10', seal: 'declared', eventId: 'ana_a', ...extra });
const temporada = (items, summary) => ({ year: 2025, closed: true, items, summary: { tournaments: 1, podiums: 1, gameDays: 0, gold: 1, silver: 0, bronze: 0, ...summary } });
const carregada = (seasons = [], extra = {}) => ({
  isPending: false, isPaused: false, isError: false, retry: vi.fn(), events: [],
  timeline: { upcoming: [], seasons, faltou: [] }, ...extra,
});

let raiz; let onde;
function Onde() { onde = useLocation(); return null; }
const montar = (props, url = '/carreira') => {
  const el = document.createElement('div');
  document.body.appendChild(el);
  raiz = createRoot(el);
  act(() => {
    raiz.render(
      <MemoryRouter initialEntries={[url]}>
        <CareerTimeline onOpenEvent={vi.fn()} onRegister={vi.fn()} {...props} />
        <Onde />
      </MemoryRouter>,
    );
  });
  return el;
};
const botao = (el, texto) => [...el.querySelectorAll('button')].find((b) => b.textContent.includes(texto));
afterEach(() => { act(() => raiz?.unmount()); document.body.innerHTML = ''; vi.clearAllMocks(); });

describe('CareerTimeline', () => {
  it('🔴 sem conexão (consulta pausada): mostra os rascunhos do aparelho e diz "sem conexão", sem esqueleto eterno', () => {
    const onOpenEvent = vi.fn();
    const el = montar({
      data: { isPending: true, isPaused: true, isError: false, timeline: null },
      pending: [{ id: 'ana_r1', name: 'Copa Sul' }],
      onFlush: vi.fn(),
      onOpenEvent,
    });
    expect(el.textContent).toContain('1 registro guardado neste aparelho');
    expect(el.textContent).toContain('Sem conexão');
    expect(el.querySelector('.animate-pulse')).toBeNull();
    act(() => botao(el, 'Copa Sul').click());
    expect(onOpenEvent).toHaveBeenCalledWith('ana_r1');
  });

  it('carregando com conexão: a faixa dos rascunhos vem antes do esqueleto', () => {
    const el = montar({ data: { isPending: true, isPaused: false, timeline: null }, pending: [{ id: 'ana_r1', name: 'Copa Sul' }, { id: 'ana_r2', name: 'Etapa 2' }] });
    expect(el.textContent).toContain('2 registros guardados neste aparelho');
    expect(el.textContent).not.toContain('Sem conexão.');
  });

  it('🔴 rascunho recusado pelo servidor é dito, e não entra na conta dos que esperam a conexão', () => {
    const el = montar({ data: carregada(), pending: [{ id: 'ana_r1', name: 'Copa Sul', refused: true }], onFlush: vi.fn() });
    expect(el.textContent).toContain('recusado: abra para corrigir ou descartar');
    expect(el.textContent).not.toContain('esperando a conexão');
    expect(botao(el, 'Enviar agora')).toBeUndefined();
  });

  it('"Enviar agora" fica ocupado enquanto envia e diz o que aconteceu', async () => {
    const onFlush = vi.fn().mockResolvedValue({ enviados: 1, esperando: 0, recusados: [{ id: 'ana_r2', name: 'Etapa 2' }] });
    const pending = [{ id: 'ana_r1', name: 'Copa Sul' }];
    const el = montar({ data: carregada(), pending, onFlush, flushing: true });
    expect(botao(el, 'Enviando…').disabled).toBe(true);
    act(() => raiz.unmount());
    const el2 = montar({ data: carregada(), pending, onFlush });
    await act(async () => { botao(el2, 'Enviar agora').click(); });
    expect(toast.success).toHaveBeenCalledWith('1 registro enviado.');
    expect(toast.error.mock.calls[0][0]).toContain('Etapa 2');
  });

  it('plural certo no resumo da temporada, e a temporada fechada mostra que abre (seta)', () => {
    const el = montar({ data: carregada([temporada([item({ position: 1 })])]) });
    expect(el.textContent).toContain('1 torneio · 1 pódio');
    expect(el.textContent).not.toContain('1 torneios');
    expect(el.querySelector('summary svg')).not.toBeNull();
    expect(el.querySelector('summary h2').textContent).toContain('2025');
  });

  it('selo da colocação fica no tema claro (a cor do metal não troca no escuro); item sem destino não tem seta', () => {
    const el = montar({ data: carregada([temporada([item({ position: 1 }), item({ id: 'i2', title: 'Ponto de federação', eventId: null, link: null })])]) });
    const [comDestino, semDestino] = el.querySelectorAll('details li > *');
    expect(comDestino.tagName).toBe('BUTTON');
    expect(comDestino.querySelector('span[aria-hidden]').className).toContain('tema-claro');
    expect(semDestino.tagName).toBe('DIV');
    expect(semDestino.className).not.toContain('hover:');
    expect(semDestino.querySelector('span[aria-hidden]').className).not.toContain('tema-claro');
    // A seta de "abrir" só no clicável (o ícone do selo é o outro svg).
    expect(comDestino.querySelectorAll(':scope > svg')).toHaveLength(1);
    expect(semDestino.querySelectorAll(':scope > svg')).toHaveLength(0);
  });

  it('filtro que não deixa nada: oferece "Limpar filtros", que tira os três da URL e mantém o resto', () => {
    const el = montar({ data: carregada([temporada([item()])]) }, '/carreira?podios=1&origem=fora&aba=linha-do-tempo');
    expect(el.textContent).toContain('Nada com estes filtros.');
    act(() => botao(el, 'Limpar filtros').click());
    expect(onde.search).toBe('?aba=linha-do-tempo');
    expect(el.textContent).toContain('Open de Floripa');
  });

  it('primeiro uso: o vazio apresenta também "Vários de uma vez"', () => {
    const onList = vi.fn();
    const el = montar({ data: carregada(), onList });
    act(() => botao(el, 'Vários de uma vez').click());
    expect(onList).toHaveBeenCalled();
  });
});
