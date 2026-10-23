// @vitest-environment jsdom
import React from 'react';
import { createRoot } from 'react-dom/client';
import { act } from 'react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

const estado = { official: true, policy: { isSuccess: true, data: { mode: 'rules' } } };
vi.mock('@/modules/rating/hooks/useDuprMode', () => ({
  useDuprMode: () => ({ official: estado.official }),
  useDuprPolicy: () => estado.policy,
}));

import DuprSubmitChoice from './DuprSubmitChoice';

let host; let root;
const onChange = vi.fn();
const pintar = (props) => act(() => { root.render(<DuprSubmitChoice id="x" onChange={onChange} {...props} />); });

beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
  estado.official = true;
  estado.policy = { isSuccess: true, data: { mode: 'rules' } };
  onChange.mockClear();
});
afterEach(() => { act(() => root.unmount()); host.remove(); });

describe('DuprSubmitChoice', () => {
  it('no grupo opcional, quem cria escolhe (e a caixa grava o que marcou)', () => {
    pintar({ bucket: 'game_day_rotation', value: null });
    const caixa = host.querySelector('input[type="checkbox"]');
    expect(caixa.checked).toBe(false);
    expect(host.textContent).toContain('vale o padrão');
    act(() => { caixa.click(); });
    expect(onChange).toHaveBeenCalledWith(true);
  });

  it('a escolha gravada vence o padrão', () => {
    pintar({ bucket: 'tournament_rotation', value: true });
    expect(host.querySelector('input').checked).toBe(true);
  });

  it('grupo obrigatório só avisa; Play diz que não vai', () => {
    pintar({ bucket: 'tournament_fixed', value: false });
    expect(host.querySelector('input')).toBeNull();
    expect(host.textContent).toContain('vão ao DUPR');
    pintar({ bucket: 'game_day_play', value: null });
    expect(host.textContent).toContain('não vai ao DUPR');
  });

  it('some sem DUPR para quem vê, sem política carregada ou com o envio desligado', () => {
    estado.official = false;
    pintar({ bucket: 'game_day_rotation' });
    expect(host.innerHTML).toBe('');
    estado.official = true;
    estado.policy = { isSuccess: false, data: undefined };
    pintar({ bucket: 'game_day_rotation' });
    expect(host.innerHTML).toBe('');
    estado.policy = { isSuccess: true, data: { mode: 'off' } };
    pintar({ bucket: 'game_day_rotation' });
    expect(host.innerHTML).toBe('');
  });
});
