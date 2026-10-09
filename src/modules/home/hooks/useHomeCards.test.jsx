/**
 * O hook da escolha dos cards — o que protege:
 *
 *  1. ⭐ dois consumidores (a tela inicial e o seletor aberto sobre ela) veem
 *     a MESMA escolha, e mudar num atualiza o outro na hora;
 *  2. o padrão vale até a pessoa escolher; restaurar volta a ele;
 *  3. a escolha é da CONTA: trocar de usuário relê;
 *  4. o início sob medida só vale com as DUAS flags.
 */
import React from 'react';
import { createRoot } from 'react-dom/client';
import { act } from 'react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

const estado = { uid: 'ana', flags: {} };
vi.mock('@/core/lib/FirebaseAuthContext', () => ({ useAuth: () => ({ user: { uid: estado.uid } }) }));
vi.mock('@/core/lib/FeatureFlagsContext', () => ({ useFeatureFlag: (k) => Boolean(estado.flags[k]) }));

import { useHomeCards, useHomeCardsContext, useHomeCardsOn } from './useHomeCards';

let container; let root;
const vistos = {};
function Sonda({ nome }) {
  vistos[nome] = useHomeCards();
  return null;
}
function Flags() {
  vistos.on = useHomeCardsOn();
  vistos.ctx = useHomeCardsContext();
  return null;
}
const montar = (el) => act(() => { root.render(el); });

beforeEach(() => {
  window.localStorage.clear();
  estado.uid = 'ana';
  estado.flags = {};
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});
afterEach(() => { act(() => root.unmount()); container.remove(); });

describe('useHomeCards', () => {
  it('padrão até escolher', () => {
    montar(<Sonda nome="a" />);
    expect(vistos.a.escolhidos).toEqual(['jogar', 'reservar', 'ranking']);
    expect(vistos.a).toMatchObject({ personalizado: false, padrao: true });
  });

  it('⭐ dois consumidores andam juntos', () => {
    montar(<><Sonda nome="tela" /><Sonda nome="seletor" /></>);
    act(() => vistos.seletor.alternar('agenda'));
    expect(vistos.tela.escolhidos).toEqual(['jogar', 'reservar', 'ranking', 'agenda']);
    act(() => vistos.tela.mover('agenda', -3));
    expect(vistos.seletor.escolhidos).toEqual(['agenda', 'jogar', 'reservar', 'ranking']);
    expect(vistos.seletor).toMatchObject({ personalizado: true, padrao: false });
    act(() => vistos.seletor.restaurar());
    expect(vistos.tela).toMatchObject({ escolhidos: ['jogar', 'reservar', 'ranking'], personalizado: false });
  });

  it('desligar tudo é uma escolha (não volta ao padrão)', () => {
    montar(<Sonda nome="a" />);
    act(() => vistos.a.definir([]));
    expect(vistos.a.escolhidos).toEqual([]);
    expect(vistos.a.personalizado).toBe(true);
  });

  it('a escolha é da conta: trocar de usuário relê', () => {
    montar(<Sonda nome="a" />);
    act(() => vistos.a.definir(['ranking']));
    estado.uid = 'bia';
    montar(<Sonda nome="a" />);
    expect(vistos.a.escolhidos).toEqual(['jogar', 'reservar', 'ranking']);
    estado.uid = 'ana';
    montar(<Sonda nome="a" />);
    expect(vistos.a.escolhidos).toEqual(['ranking']);
  });
});

describe('flags', () => {
  it('⭐ só vale com o início personalizado E o sob medida', () => {
    montar(<Flags />);
    expect(vistos.on).toBe(false);
    estado.flags = { home_cards: true };
    montar(<Flags />);
    expect(vistos.on).toBe(false);
    estado.flags = { home_cards: true, personalized_home: true };
    montar(<Flags />);
    expect(vistos.on).toBe(true);
  });

  it('o contexto diz o que cada card pode oferecer', () => {
    montar(<Flags />);
    expect(vistos.ctx).toEqual({ promocoes: false, evolucao: false, treino: false });
    estado.flags = { coach_marketing: true, action_home: true, training_center: true };
    montar(<Flags />);
    expect(vistos.ctx).toEqual({ promocoes: true, evolucao: true, treino: true });
  });
});
