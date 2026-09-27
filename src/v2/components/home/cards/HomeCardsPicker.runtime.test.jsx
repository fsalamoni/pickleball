/**
 * O seletor dos cards do início (Configurações → Página inicial e o
 * "Personalizar" do próprio início). O que protege:
 *
 *  1. ⭐ ligar põe o card no FIM da lista; desligar tira; a escolha fica no
 *     navegador, por usuário — nada vai ao banco;
 *  2. ⭐ subir/descer muda a ordem; nas pontas o botão fica focável, avisa
 *     (`aria-disabled`) e não faz nada — não some sob o dedo;
 *  3. restaurar volta ao padrão (e só aparece fora dele);
 *  4. ⭐ as sugestões saem do que a pessoa FAZ, com o motivo, e um toque
 *     acrescenta; o que ela já tem não é sugerido;
 *  5. card de funcionalidade desligada não é oferecido;
 *  6. cada mudança é anunciada ao leitor de tela;
 *  7. o cartão de Configurações some com a flag desligada.
 */
import React from 'react';
import { createRoot } from 'react-dom/client';
import { act } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

const estado = { flags: {}, arenas: [], coach: null, interests: [] };
vi.mock('@/core/lib/FirebaseAuthContext', () => ({
  useAuth: () => ({ user: { uid: 'u1' }, userProfile: { interests: estado.interests } }),
}));
vi.mock('@/core/lib/FeatureFlagsContext', () => ({ useFeatureFlag: (k) => Boolean(estado.flags[k]) }));
vi.mock('@/modules/arenas/hooks/useMyArenaSummary', () => ({
  useMyArenaSummary: () => ({ arenas: estado.arenas, pendingByArena: {}, totalPendingBookings: 0 }),
}));
vi.mock('@/modules/coaches/hooks/useCoaches', () => ({ useCoach: () => ({ data: estado.coach }) }));

const { default: HomeCardsPicker } = await import('./HomeCardsPicker.jsx');
const { default: HomeCardsSettingsCard } = await import('./HomeCardsSettingsCard.jsx');

const CHAVE = 'v2:view:u1:inicio:cards';
let container; let root;
beforeEach(() => {
  window.localStorage.clear();
  Object.assign(estado, { flags: { personalized_home: true, home_cards: true }, arenas: [], coach: null, interests: [] });
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});
afterEach(() => { act(() => root.unmount()); container.remove(); });

const montar = async (el) => { await act(async () => { root.render(<MemoryRouter>{el}</MemoryRouter>); }); };
const ligados = () => [...container.querySelectorAll('ol [data-card-inicio]')].map((li) => li.getAttribute('data-card-inicio'));
const linha = (id) => container.querySelector(`[data-card-inicio="${id}"]`);
const clicar = async (el) => { await act(async () => { el.click(); }); };
const salvo = () => JSON.parse(window.localStorage.getItem(CHAVE) || 'null')?.cards ?? null;
const anuncio = () => container.querySelector('[aria-live="polite"]').textContent;
const botao = (texto) => [...container.querySelectorAll('button')].find((b) => b.textContent.includes(texto));

describe('ligar, desligar e ordenar', () => {
  it('⭐ começa no padrão, na ordem: Dias de jogo, Horários da arena e Ranking', async () => {
    await montar(<HomeCardsPicker />);
    expect(ligados()).toEqual(['jogar', 'reservar', 'ranking']);
    expect(botao('Restaurar o padrão')).toBeUndefined();
  });

  it('⭐ ligar põe no fim; desligar tira; a escolha fica no navegador', async () => {
    await montar(<HomeCardsPicker />);
    const interruptor = linha('agenda').querySelector('[role="switch"]');
    expect(interruptor.getAttribute('aria-checked')).toBe('false');
    await clicar(interruptor);
    expect(ligados()).toEqual(['jogar', 'reservar', 'ranking', 'agenda']);
    expect(salvo()).toEqual(['jogar', 'reservar', 'ranking', 'agenda']);
    expect(anuncio()).toBe('Sua agenda entrou no início, em 4º.');
    await clicar(linha('reservar').querySelector('[role="switch"]'));
    expect(ligados()).toEqual(['jogar', 'ranking', 'agenda']);
    expect(anuncio()).toBe('Horários da arena saiu do início.');
  });

  it('⭐ subir e descer; nas pontas o botão avisa e não faz nada', async () => {
    await montar(<HomeCardsPicker />);
    const subirPrimeiro = linha('jogar').querySelector('button[aria-label^="Subir"]');
    expect(subirPrimeiro.getAttribute('aria-disabled')).toBe('true');
    await clicar(subirPrimeiro);
    expect(ligados()).toEqual(['jogar', 'reservar', 'ranking']);
    const descerUltimo = linha('ranking').querySelector('button[aria-label^="Descer"]');
    expect(descerUltimo.getAttribute('aria-disabled')).toBe('true');

    await clicar(linha('ranking').querySelector('button[aria-label^="Subir"]'));
    expect(ligados()).toEqual(['jogar', 'ranking', 'reservar']);
    expect(anuncio()).toBe('Ranking agora é o 2º.');
    await clicar(linha('jogar').querySelector('button[aria-label^="Descer"]'));
    expect(ligados()).toEqual(['ranking', 'jogar', 'reservar']);
    expect(salvo()).toEqual(['ranking', 'jogar', 'reservar']);
  });

  it('restaurar volta ao padrão e apaga a escolha guardada', async () => {
    window.localStorage.setItem(CHAVE, JSON.stringify({ v: 1, cards: ['ranking'] }));
    await montar(<HomeCardsPicker />);
    expect(ligados()).toEqual(['ranking']);
    await clicar(botao('Restaurar o padrão'));
    expect(ligados()).toEqual(['jogar', 'reservar', 'ranking']);
    expect(window.localStorage.getItem(CHAVE)).toBeNull();
    expect(anuncio()).toContain('voltou ao padrão');
  });

  it('sem nenhum card, diz que só o resumo do dia aparece', async () => {
    window.localStorage.setItem(CHAVE, JSON.stringify({ v: 1, cards: [] }));
    await montar(<HomeCardsPicker />);
    expect(ligados()).toEqual([]);
    expect(container.textContent).toContain('Por enquanto o seu início mostra só o resumo do dia');
  });
});

describe('sugestões e disponibilidade', () => {
  it('⭐ sugere o que a pessoa FAZ, com o motivo; um toque acrescenta', async () => {
    const foci = [
      { focus: 'arena', reason: 'papel', weight: 100 },
      { focus: 'professor', reason: 'papel', weight: 90 },
      { focus: 'ranking', reason: 'interesse', weight: 50 },
    ];
    await montar(<HomeCardsPicker foci={foci} />);
    const sugeridos = container.textContent.split('Sugeridos para você')[1] || '';
    expect(sugeridos).toContain('Sua arena');
    expect(sugeridos).toContain('Suas aulas (professor)');
    // Ranking já está no início: não é sugerido de novo.
    expect(linha('ranking').closest('ol')).toBeTruthy();
    const adicionar = linha('arena').querySelector('button');
    expect(adicionar.textContent).toContain('Adicionar');
    await clicar(adicionar);
    expect(ligados()).toEqual(['jogar', 'reservar', 'ranking', 'arena']);
  });

  it('card de funcionalidade desligada não é oferecido', async () => {
    await montar(<HomeCardsPicker />);
    expect(linha('destaques')).toBeNull();
    expect(linha('evolucao')).toBeNull();
    act(() => root.unmount());
    root = createRoot(container);
    estado.flags = { ...estado.flags, platform_marketing: true, action_home: true };
    await montar(<HomeCardsPicker />);
    expect(linha('destaques')).toBeTruthy();
    expect(linha('evolucao')).toBeTruthy();
  });

  it('cada interruptor tem nome acessível (o título do card)', async () => {
    await montar(<HomeCardsPicker />);
    for (const sw of container.querySelectorAll('[role="switch"]')) {
      const id = sw.getAttribute('aria-labelledby');
      expect(document.getElementById(id)?.textContent).toBeTruthy();
    }
  });
});

describe('Configurações → Página inicial', () => {
  it('some com o início sob medida desligado', async () => {
    estado.flags = { personalized_home: true };
    await montar(<HomeCardsSettingsCard />);
    expect(container.textContent).toBe('');
  });

  it('com a flag: título, resumo do que está no início e o seletor; o link leva ao início', async () => {
    await montar(<HomeCardsSettingsCard />);
    expect(container.querySelector('#pagina-inicial')).toBeTruthy();
    expect(container.textContent).toContain('Hoje: 3 cards: Dias de jogo, Horários da arena e Ranking.');
    expect(container.querySelector('a[href="/"]').textContent).toContain('Ver o início');
    await clicar(linha('ranking').querySelector('[role="switch"]'));
    expect(container.textContent).toContain('Hoje: 2 cards: Dias de jogo e Horários da arena.');
  });

  it('sugere a arena para quem gere uma (do que já está em cache)', async () => {
    estado.arenas = [{ id: 'a1', name: 'Arena Sul' }];
    await montar(<HomeCardsSettingsCard />);
    expect(container.textContent).toContain('Sugeridos para você');
    expect(linha('arena').querySelector('button').textContent).toContain('Adicionar');
  });
});
