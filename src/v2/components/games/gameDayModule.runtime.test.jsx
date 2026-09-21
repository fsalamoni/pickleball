/**
 * ⭐ O ESPAÇAMENTO ENTRE OS CARTÕES É DO MÓDULO.
 *
 * 🐞 O módulo devolvia um FRAGMENTO. Junte as três coisas: o cartão de regras
 * carregava um `mb-4` próprio, o de configurações não tinha margem nenhuma e o
 * organizador trazia o seu `space-y` por dentro. Resultado: o intervalo entre
 * cartões mudava a cada cartão — e ainda mudava de origem para origem, porque
 * o clube envolvia tudo num `space-y` dele por fora e o atleta não envolvia em
 * nada.
 *
 * É invisível a teste de comportamento: com tudo funcionando, uma tela
 * desalinhada renderiza igual a uma alinhada.
 */
import React from 'react';
import { createRoot } from 'react-dom/client';
import { act } from 'react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock('@/v2/components/games/AthleteGameDayOrganizer', () => ({ default: () => <div>GRADE</div> }));
vi.mock('@/v2/components/games/AthletePlayOrganizer', () => ({ default: () => <div>PLAY</div> }));
vi.mock('@/v2/components/games/AthletePlayParticipant', () => ({ default: () => <div>PLAY PARTICIPANTE</div> }));
vi.mock('@/v2/components/games/AthleteAmericanoLiveOrganizer', () => ({ default: () => <div>AO VIVO</div> }));
vi.mock('@/v2/components/games/GameDaySettingsCard', () => ({ default: () => <div>CONFIGURACOES</div> }));
vi.mock('@/v2/components/tutorial/V2TutorialLauncher', () => ({ default: () => null }));
// O cartão de REGRAS renderiza de verdade: é justamente ele que carregava a
// margem à mão, e é isso que o teste precisa enxergar.
vi.mock('@/modules/games/hooks/useGameDays', () => ({
  useGameDayParticipants: () => ({ data: [] }),
}));

const { default: GameDayModule } = await import('./GameDayModule.jsx');

const dia = (extra = {}) => ({ id: 'gd1', title: 'Rachão', format: 'americano', ...extra });

let container;
let root;

function render(gameDay, podeGerenciar = true) {
  act(() => {
    root.render(
      <MemoryRouter><GameDayModule gameDay={gameDay} podeGerenciar={podeGerenciar} /></MemoryRouter>,
    );
  });
  return container.firstElementChild;
}

beforeEach(() => {
  window.localStorage.clear();
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

describe('⭐ o módulo espaça os próprios cartões', () => {
  it('⭐ há UM container, e é ele que dá o intervalo', () => {
    const raiz = render(dia());
    expect(raiz, 'o módulo voltou a devolver um fragmento').toBeTruthy();
    expect(raiz.className, `container sem ritmo: "${raiz.className}"`).toMatch(/space-y-\d/);
  });

  it('⭐ nenhum cartão carrega margem vertical própria', () => {
    const raiz = render(dia());
    Array.from(raiz.children).forEach((filho) => {
      expect(
        filho.className,
        `um cartão do módulo voltou a se espaçar sozinho: "${filho.className}"`,
      ).not.toMatch(/\bm[bty]-\d/);
    });
  });

  it('⭐ a ordem é: o que o dia É, o que dá para mudar, e o dia acontecendo', () => {
    const raiz = render(dia());
    const texto = raiz.textContent;
    expect(texto).toContain('CONFIGURACOES');
    expect(texto).toContain('GRADE');
    // As configurações vêm ANTES do miolo: quem abre a tela para configurar
    // não deve rolar por cima da operação do dia.
    expect(texto.indexOf('CONFIGURACOES')).toBeLessThan(texto.indexOf('GRADE'));
  });

  it('⭐ e as configurações aparecem UMA vez só', () => {
    const texto = render(dia()).textContent;
    expect(texto.split('CONFIGURACOES').length - 1).toBe(1);
  });

  it('cada formato leva à sua visão, sempre com as configurações junto', () => {
    expect(render(dia({ format: 'play' })).textContent).toContain('PLAY');
    expect(render(dia({ format: 'americano_live' })).textContent).toContain('AO VIVO');
    // Sem poder gerenciar, o Play mostra a visão de participante — e mesmo aí
    // o cartão de configurações é montado (quem pode vê-lo decide lá dentro).
    const so = render(dia({ format: 'play' }), false).textContent;
    expect(so).toContain('PLAY PARTICIPANTE');
    expect(so).toContain('CONFIGURACOES');
  });
});
