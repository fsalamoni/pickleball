/**
 * O BOTÃO de entrar e sair de cada jogo do "Jogar" — o caminho CERTO de cada
 * origem, que é o que não pode divergir entre o início, o Procura-se jogo e o
 * Dia de jogo:
 *  - dia do atleta e do clube → "Participar" (`joinPublicGameDay`);
 *  - dia da arena → "Marcar presença" (`signUpToArenaGameDay`, com o teto);
 *  - dia da arena por QUADRA → "Escolher a quadra" (a escolha mora no dia);
 *  - o que já tenho → "Você vai" e o "Sair" (`leaveGameDay`);
 *  - jogo aberto → a regra da vaga (`slotActionState`): fora da faixa não entra;
 *  - convite → falar com quem convidou.
 */
import React from 'react';
import { createRoot } from 'react-dom/client';
import { act } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

const entrar = vi.fn(async () => {});
const marcar = vi.fn(async () => {});
const sair = vi.fn(async () => {});
const vagaEntrar = vi.fn(async () => {});
const nivel = { level: null };

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock('@/modules/games/hooks/useGameDays', () => ({
  useJoinPublicGameDay: () => ({ mutateAsync: entrar, isPending: false }),
  useLeaveGameDay: () => ({ mutateAsync: sair, isPending: false }),
}));
vi.mock('@/modules/games/hooks/useArenaGameDays', () => ({
  useSignUpToArenaGameDay: () => ({ mutateAsync: marcar, isPending: false }),
}));
vi.mock('@/modules/arenas/hooks/useArenaV3', () => ({ useUserWaitlist: () => ({ data: [] }) }));
vi.mock('@/modules/rating/hooks/useMyUnifiedLevel', () => ({ useMyUnifiedLevel: () => nivel }));
vi.mock('@/v2/components/arenas/openMatch/useOpenSlotActions', () => ({
  useOpenSlotActions: () => ({ ocupado: false, onEntrar: vagaEntrar, onSair: vi.fn(), onFila: vi.fn() }),
}));
vi.mock('@/v2/components/chat/V2ChatLauncherButton', () => ({
  default: ({ label, athlete }) => <button type="button" data-para={athlete?.id}>{label}</button>,
}));

const { default: PlayItemAction } = await import('./PlayItemAction.jsx');

const item = (over = {}) => ({
  key: 'dia:gd1', kind: 'dia', origem: 'atleta', id: 'gd1', link: '/dia-de-jogo/gd1', title: 'Racha de sábado',
  estou: false, cabe: true, porQuadra: false, fonte: { id: 'gd1' }, ...over,
});

let container;
let root;
beforeEach(() => {
  [entrar, marcar, sair, vagaEntrar].forEach((f) => f.mockClear());
  nivel.level = null;
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});
afterEach(() => { act(() => root.unmount()); container.remove(); });

const render = async (props) => {
  await act(async () => { root.render(<MemoryRouter><PlayItemAction {...props} /></MemoryRouter>); });
};
const botao = (t) => [...container.querySelectorAll('button')].find((b) => b.textContent.includes(t));
const clicar = async (el) => { await act(async () => { el.dispatchEvent(new MouseEvent('click', { bubbles: true })); }); };

describe('dias de jogo', () => {
  it('⭐ dia do atleta: "Participar" entra pelo caminho do atleta, e diz de qual jogo é', async () => {
    await render({ item: item() });
    const b = botao('Participar');
    expect(b.getAttribute('aria-label')).toBe('Participar de Racha de sábado');
    await clicar(b);
    expect(entrar).toHaveBeenCalledWith({ id: 'gd1' });
    expect(marcar).not.toHaveBeenCalled();
  });

  it('⭐ dia do CLUBE: o mesmo "Participar" (a regra confere que sou do clube)', async () => {
    await render({ item: item({ origem: 'clube', fonte: { id: 'gc', club_id: 'c1' } }) });
    await clicar(botao('Participar'));
    expect(entrar).toHaveBeenCalledWith({ id: 'gc', club_id: 'c1' });
  });

  it('⭐ dia da ARENA: "Marcar presença" passa pelo teto de vagas da arena', async () => {
    await render({ item: item({ origem: 'arena', fonte: { id: 'ga', arena_id: 'A1' } }) });
    await clicar(botao('Marcar presença'));
    expect(marcar).toHaveBeenCalledWith({ gameDay: { id: 'ga', arena_id: 'A1' }, courtId: null });
    expect(entrar).not.toHaveBeenCalled();
  });

  it('dia da arena por QUADRA: leva ao dia, onde se escolhe a quadra (nunca inscreve sem ela)', async () => {
    await render({ item: item({ origem: 'arena', porQuadra: true }) });
    const link = container.querySelector('a[href="/dia-de-jogo/gd1"]');
    expect(link.textContent).toContain('Escolher a quadra');
    expect(botao('Marcar presença')).toBeUndefined();
  });

  it('⭐ o que já tenho: "Você vai" e o "Sair", pelo sair de qualquer origem', async () => {
    await render({ item: item({ estou: true }) });
    expect(container.textContent).toContain('Você vai');
    expect(botao('Participar')).toBeUndefined();
    await clicar(botao('Sair'));
    expect(sair).toHaveBeenCalledWith('gd1');
  });

  it('com `mostrarAbrir`, o link para dentro do jogo fica ao lado do botão', async () => {
    await render({ item: item(), mostrarAbrir: true });
    expect(container.querySelector('a[href="/dia-de-jogo/gd1"]')).not.toBeNull();
  });
});

describe('jogo aberto e convite', () => {
  const vaga = (over = {}) => item({
    key: 'vaga:s1', kind: 'jogo_aberto', origem: 'jogo_aberto', id: 's1', link: '/dia-de-jogo/gs1', title: 'Jogo aberto · Arena Sol',
    fonte: { id: 's1', date: '2099-10-01', start: '19:00', total_spots: 4, participants: [], ...over },
  });

  it('com vaga e no meu nível: "Quero jogar"', async () => {
    nivel.level = 4.0;
    await render({ item: vaga({ min_level: 3.5, max_level: 4.5 }) });
    await clicar(botao('Quero jogar'));
    expect(vagaEntrar).toHaveBeenCalled();
  });

  it('fora da minha faixa: não entra — o botão diz por quê', async () => {
    nivel.level = 5.0;
    await render({ item: vaga({ min_level: 3.0, max_level: 4.0 }) });
    expect(botao('Fora da sua faixa').disabled).toBe(true);
  });

  it('convite solto: falar com quem convidou', async () => {
    await render({
      item: item({ kind: 'convite', origem: 'convite', fonte: { id: 'og1', created_by: 'ana', creator_name: 'Ana' } }),
    });
    const b = botao('Chamar para jogar');
    expect(b.getAttribute('data-para')).toBe('ana');
  });
});
