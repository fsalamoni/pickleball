/**
 * A navegação em dois níveis das centrais.
 *
 * O que protege:
 *  1. ⭐ as seções QUEBRAM em linhas — nada de rolagem para o lado, que
 *     escondia o que não cabia (eram treze seções na Central da arena);
 *  2. com `grupos`, cada grupo é uma linha com nome, na ordem dos grupos;
 *  3. seção sem grupo conhecido vai para o fim — nunca some;
 *  4. a seção e a aba ativas são anunciadas (`aria-current`);
 *  5. tocar numa seção ou numa aba devolve o item tocado;
 *  6. ⭐ as centrais usam esta peça (guarda de fonte): arena, professor,
 *     gestão do torneio e o painel do admin;
 *  7. as setas do teclado movem o foco entre as seções (Home/End às pontas),
 *     sem trocar de seção sozinhas.
 */
import React from 'react';
import { createRoot } from 'react-dom/client';
import { act } from 'react';
import { readFileSync } from 'node:fs';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { Crown, Tag } from 'lucide-react';

const { V2SectionNav, V2SubTabs, agruparSecoes } = await import('./V2SectionNav.jsx');

let container, root;
beforeEach(() => {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});
afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

const SECOES = [
  { id: 'perfil', label: 'Perfil', grupo: 'gerir' },
  { id: 'reservas', label: 'Reservas', grupo: 'atender', icon: Crown },
  { id: 'marketing', label: 'Marketing', grupo: 'gerir', icon: Tag },
  { id: 'membros', label: 'Membros', grupo: 'atender' },
];
const GRUPOS = [{ id: 'atender', label: 'Atender' }, { id: 'gerir', label: 'Gerir' }];

describe('agruparSecoes', () => {
  it('sem grupos: uma linha só, sem nome, na ordem de sempre', () => {
    expect(agruparSecoes(SECOES)).toEqual([{ id: 'todas', label: null, secoes: SECOES }]);
  });

  it('com grupos: uma linha por grupo, na ordem dos grupos, mantendo a ordem das seções', () => {
    const linhas = agruparSecoes(SECOES, GRUPOS);
    expect(linhas.map((l) => l.label)).toEqual(['Atender', 'Gerir']);
    expect(linhas[0].secoes.map((s) => s.id)).toEqual(['reservas', 'membros']);
    expect(linhas[1].secoes.map((s) => s.id)).toEqual(['perfil', 'marketing']);
  });

  it('⭐ seção sem grupo conhecido vai para o fim — nunca some', () => {
    const linhas = agruparSecoes([...SECOES, { id: 'nova', label: 'Nova' }], GRUPOS);
    expect(linhas.at(-1)).toMatchObject({ id: 'outras', label: null });
    expect(linhas.flatMap((l) => l.secoes).map((s) => s.id)).toHaveLength(5);
  });

  it('grupo sem seção não vira linha vazia', () => {
    const linhas = agruparSecoes(SECOES.filter((s) => s.grupo === 'gerir'), GRUPOS);
    expect(linhas.map((l) => l.id)).toEqual(['gerir']);
  });
});

describe('V2SectionNav', () => {
  it('⭐ quebra em linhas — nada de rolagem para o lado', async () => {
    await act(async () => {
      root.render(<V2SectionNav sections={SECOES} grupos={GRUPOS} activeId="reservas" onSelect={() => {}} ariaLabel="Seções" />);
    });
    const nav = container.querySelector('nav[aria-label="Seções"]');
    expect(nav).not.toBeNull();
    expect(container.innerHTML).not.toContain('overflow-x-auto');
    expect(nav.querySelectorAll('.flex-wrap')).toHaveLength(2);
  });

  it('cada grupo é uma linha com nome, e a seção ativa é anunciada', async () => {
    await act(async () => {
      root.render(<V2SectionNav sections={SECOES} grupos={GRUPOS} activeId="marketing" onSelect={() => {}} />);
    });
    expect(container.textContent).toMatch(/Atender.*Reservas.*Membros.*Gerir.*Perfil.*Marketing/);
    const ativos = [...container.querySelectorAll('[aria-current="page"]')].map((b) => b.textContent);
    expect(ativos).toEqual(['Marketing']);
  });

  it('sem grupos, não há nome de linha', async () => {
    await act(async () => {
      root.render(<V2SectionNav sections={SECOES} activeId="perfil" onSelect={() => {}} />);
    });
    expect(container.textContent).not.toContain('Atender');
    expect(container.querySelectorAll('button')).toHaveLength(4);
  });

  it('as setas movem o foco entre as seções, Home e End vão às pontas, e nada é selecionado', async () => {
    const onSelect = vi.fn();
    await act(async () => {
      root.render(<V2SectionNav sections={SECOES} grupos={GRUPOS} activeId="reservas" onSelect={onSelect} />);
    });
    const botoes = [...container.querySelectorAll('button')];
    const tecla = (el, key) => act(async () => { el.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true })); });
    botoes[0].focus();
    await tecla(botoes[0], 'ArrowRight');
    expect(document.activeElement).toBe(botoes[1]);
    await tecla(botoes[1], 'ArrowLeft');
    expect(document.activeElement).toBe(botoes[0]);
    await tecla(botoes[0], 'ArrowLeft');
    expect(document.activeElement).toBe(botoes.at(-1));
    await tecla(botoes.at(-1), 'Home');
    expect(document.activeElement).toBe(botoes[0]);
    await tecla(botoes[0], 'End');
    expect(document.activeElement).toBe(botoes.at(-1));
    expect(onSelect).not.toHaveBeenCalled();
  });

  it('tocar numa seção devolve a seção tocada', async () => {
    const onSelect = vi.fn();
    await act(async () => {
      root.render(<V2SectionNav sections={SECOES} grupos={GRUPOS} activeId="reservas" onSelect={onSelect} />);
    });
    const membros = [...container.querySelectorAll('button')].find((b) => b.textContent === 'Membros');
    await act(async () => { membros.click(); });
    expect(onSelect).toHaveBeenCalledWith(expect.objectContaining({ id: 'membros' }));
  });
});

describe('V2SubTabs', () => {
  const ABAS = [{ value: 'cupons', label: 'Cupons' }, { value: 'campanhas', label: 'Campanhas' }];

  it('quebra em linhas, anuncia a aba ativa e devolve a aba tocada', async () => {
    const onSelect = vi.fn();
    await act(async () => {
      root.render(<V2SubTabs tabs={ABAS} activeValue="campanhas" onSelect={onSelect} ariaLabel="Abas de Marketing" />);
    });
    const nav = container.querySelector('nav[aria-label="Abas de Marketing"]');
    expect(nav.className).toContain('flex-wrap');
    expect(container.innerHTML).not.toContain('overflow-x-auto');
    expect(container.querySelector('[aria-current="page"]').textContent).toBe('Campanhas');
    await act(async () => { container.querySelector('button').click(); });
    expect(onSelect).toHaveBeenCalledWith(ABAS[0]);
  });
});

describe('⭐ as centrais usam a navegação que quebra em linhas', () => {
  const telas = [
    ['src/v2/pages/V2ArenaManage.jsx', 'Central da arena'],
    ['src/v2/pages/V2CoachAgenda.jsx', 'painel do professor'],
    ['src/v2/components/tournament/V2TournamentAdminPanel.jsx', 'gestão do torneio'],
    ['src/v2/pages/V2AdminConsole.jsx', 'painel do admin'],
  ];
  for (const [arquivo, nome] of telas) {
    it(`${nome}`, () => {
      const src = readFileSync(arquivo, 'utf8');
      expect(src).toContain('<V2SectionNav');
      // A barra antiga: um trilho que rolava para o lado com as seções dentro.
      expect(src).not.toMatch(/overflow-x-auto">\s*<div className="inline-flex gap-1\.5 rounded-full/);
    });
  }

  it('a Central da arena monta as duas linhas (Atender e Gerir)', () => {
    const src = readFileSync('src/v2/pages/V2ArenaManage.jsx', 'utf8');
    expect(src).toMatch(/grupos=\{ARENA_SECTION_GROUPS\}/);
  });
});
