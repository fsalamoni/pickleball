/**
 * ENTRADA DIRETA NA TELA.
 *
 * O domínio prova quem entra onde (`directEntry.test.js`). Aqui prendemos o
 * que a tela precisa mostrar ANTES do sorteio: o resultado da configuração com
 * NOMES, e o aviso quando a configuração não fecha.
 */
import React from 'react';
import { createRoot } from 'react-dom/client';
import { act } from 'react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const { default: DirectEntryPanel } = await import('./DirectEntryPanel.jsx');

let container;
let root;

function render(ui) {
  act(() => { root.render(ui); });
  return container.textContent;
}
const abrir = () => {
  act(() => { container.querySelector('button')?.click(); });
  return container.textContent;
};

beforeEach(() => {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});
afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

const inscricao = (id, nome, nivel) => ({
  id, label: nome, player_a_name: nome, player_a_level: nivel, kind: 'single',
});

const inscritos = [
  inscricao('r1', 'Ana', 'advanced'),
  inscricao('r2', 'Bruno', 'intermediate'),
  inscricao('r3', 'Carla', 'beginner'),
  inscricao('r4', 'Davi', 'beginner'),
];

const modalidade = (stages) => ({ id: 'm1', tournament_id: 't1', stages });

describe('⭐ o painel de entrada direta', () => {
  it('não aparece com uma fase só — não há fase para pular', () => {
    const texto = render(
      <DirectEntryPanel modality={modalidade([{ type: 'groups' }])} registrations={inscritos} isAdmin />,
    );
    expect(texto).toBe('');
  });

  it('com duas fases e nada configurado, diz que todos começam na 1ª', () => {
    const texto = render(
      <DirectEntryPanel modality={modalidade([{ type: 'groups' }, { type: 'knockout' }])} registrations={inscritos} isAdmin />,
    );
    expect(texto).toContain('todos começam na 1ª fase');
  });

  it('⭐ mostra os NOMES de quem entra direto e quantos começam do começo', () => {
    render(
      <DirectEntryPanel
        modality={modalidade([
          { type: 'groups' },
          { type: 'knockout', direct_entry: { mode: 'seeds', count: 2 } },
        ])}
        registrations={inscritos}
        isAdmin
      />,
    );
    const texto = abrir();
    expect(texto).toContain('2 começam na 1ª fase');
    expect(texto).toContain('pulando 1 fase(s)');
    // Os dois mais fortes: Ana (advanced) e Bruno (intermediate).
    expect(texto).toContain('Ana, Bruno');
  });

  it('⭐ avisa quando não sobra gente para a 1ª fase', () => {
    render(
      <DirectEntryPanel
        modality={modalidade([
          { type: 'groups' },
          { type: 'knockout', direct_entry: { mode: 'seeds', count: 4 } },
        ])}
        registrations={inscritos}
        isAdmin
      />,
    );
    expect(abrir()).toMatch(/Sobram 0 inscrito/);
  });

  it('⭐ modo manual lista os inscritos para escolher pelo nome', () => {
    render(
      <DirectEntryPanel
        modality={modalidade([
          { type: 'groups' },
          { type: 'knockout', direct_entry: { mode: 'manual', ids: ['r3'] } },
        ])}
        registrations={inscritos}
        isAdmin
      />,
    );
    const texto = abrir();
    expect(texto).toContain('Carla');
    expect(texto).toContain('pulando 1 fase(s)');
  });

  it('quem não administra vê o plano mas não os controles', () => {
    render(
      <DirectEntryPanel
        modality={modalidade([
          { type: 'groups' },
          { type: 'knockout', direct_entry: { mode: 'seeds', count: 1 } },
        ])}
        registrations={inscritos}
        isAdmin={false}
      />,
    );
    const texto = abrir();
    expect(texto).toContain('Só quem administra');
    expect(container.querySelector('select')).toBeNull();
  });

  it('⭐ mudar o modo salva as fases sem tocar no resto da modalidade', () => {
    const onSave = vi.fn();
    render(
      <DirectEntryPanel
        modality={{ id: 'm1', tournament_id: 't1', stages: [{ type: 'groups', group_count: 3 }, { type: 'knockout' }] }}
        registrations={inscritos}
        isAdmin
        onSave={onSave}
      />,
    );
    abrir();
    const select = container.querySelector('select');
    act(() => {
      Object.getOwnPropertyDescriptor(window.HTMLSelectElement.prototype, 'value')
        .set.call(select, 'seeds');
      select.dispatchEvent(new Event('change', { bubbles: true }));
    });
    expect(onSave).toHaveBeenCalledTimes(1);
    const stages = onSave.mock.calls[0][0];
    expect(stages[0]).toMatchObject({ type: 'groups', group_count: 3 });
    expect(stages[1].direct_entry.mode).toBe('seeds');
  });

  it('sem inscrições confirmadas, não quebra', () => {
    render(
      <DirectEntryPanel
        modality={modalidade([{ type: 'groups' }, { type: 'knockout', direct_entry: { mode: 'manual', ids: [] } }])}
        registrations={[]}
        isAdmin
      />,
    );
    expect(abrir()).toContain('Ainda não há inscrições confirmadas');
  });
});
