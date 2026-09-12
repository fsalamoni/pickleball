/**
 * Dia de jogo da arena — a tela em que o ATLETA marca presença.
 *
 * É o ponto em que a funcionalidade encosta no usuário, e o que estes testes
 * protegem é justamente o que dá errado em tela de inscrição:
 *
 *  1. ⭐ a flag desligada faz a seção NÃO EXISTIR (nem vazia);
 *  2. ⭐ quando não dá para entrar, a tela DIZ O MOTIVO — botão desabilitado
 *     sem explicação é a pior resposta possível;
 *  3. ⭐ na inscrição POR QUADRA, o botão só libera depois de escolher a
 *     quadra, e quadra lotada não é escolhível;
 *  4. quem já está inscrito vê o caminho para o dia de jogo e a saída;
 *  5. as vagas mostradas batem com a lista real de inscritos.
 *
 * Os hooks de I/O são dublês; o DOMÍNIO (vagas, veredito) é o de verdade — é
 * ele que decide o que a tela mostra.
 */
import React from 'react';
import { createRoot } from 'react-dom/client';
import { act } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

const flags = { on: true };
const auth = { user: { uid: 'atleta-1' }, userProfile: { platform_name: 'Ana' } };
const estado = { dias: [], participantes: [] };
const inscrever = vi.fn(() => Promise.resolve());
const sair = vi.fn(() => Promise.resolve());

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock('@/core/lib/FeatureFlagsContext', () => ({ useFeatureFlag: () => flags.on }));
vi.mock('@/core/lib/FirebaseAuthContext', () => ({ useAuth: () => auth }));
vi.mock('@/modules/games/hooks/useArenaGameDays', () => ({
  useArenaGameDays: () => ({ data: estado.dias }),
  useSignUpToArenaGameDay: () => ({ mutateAsync: inscrever, isPending: false }),
  useLeaveArenaGameDay: () => ({ mutateAsync: sair, isPending: false }),
}));
vi.mock('@/modules/games/hooks/useGameDays', () => ({
  useGameDayParticipants: () => ({ data: estado.participantes }),
}));

const { default: ArenaGameDaysSection } = await import('./ArenaGameDaysSection.jsx');

let container, root;

const slot = (id, cap = null) => ({
  court_id: id, court_name: `Quadra ${id}`, start_time: '18:00', end_time: '22:00', capacity: cap,
});

const dia = (over = {}) => ({
  id: 'gd1',
  arena_id: 'a1',
  arena_name: 'Arena Teste',
  title: 'Sexta de Americano',
  // Data bem no futuro: a seção só mostra o que ainda vai acontecer.
  date: '2099-10-02',
  status: 'active',
  format: 'americano',
  signup_mode: 'day',
  capacity: null,
  arena_slots: [slot('c1')],
  ...over,
});

beforeEach(() => {
  flags.on = true;
  auth.user = { uid: 'atleta-1' };
  estado.dias = [dia()];
  estado.participantes = [];
  inscrever.mockClear();
  sair.mockClear();
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  document.body.innerHTML = '';
});

async function render() {
  await act(async () => {
    root.render(<MemoryRouter><ArenaGameDaysSection arenaId="a1" /></MemoryRouter>);
  });
}

const click = (el) => act(() => { el.dispatchEvent(new MouseEvent('click', { bubbles: true })); });
const botao = (texto) => [...container.querySelectorAll('button')]
  .find((b) => b.textContent.trim() === texto);
const botaoQueContem = (texto) => [...container.querySelectorAll('button')]
  .find((b) => b.textContent.includes(texto));

/* ================================================================ flag === */

describe('a flag manda', () => {
  it('⭐ desligada, a seção não existe', async () => {
    flags.on = false;
    await render();
    expect(container.textContent).toBe('');
  });

  it('ligada e sem dia marcado, também não existe (seção vazia é ruído)', async () => {
    estado.dias = [];
    await render();
    expect(container.textContent).toBe('');
  });

  it('ligada e com dia marcado, aparece', async () => {
    await render();
    expect(container.textContent).toContain('Dias de jogo');
    expect(container.textContent).toContain('Sexta de Americano');
  });
});

/* =============================================================== o dia === */

describe('o que a tela conta sobre o dia', () => {
  it('mostra data, horário e as quadras', async () => {
    await render();
    expect(container.textContent).toContain('2099-10-02');
    expect(container.textContent).toContain('18:00–22:00');
    expect(container.textContent).toContain('Quadra c1');
  });

  it('dia que já passou não aparece', async () => {
    estado.dias = [dia({ date: '2020-01-01' })];
    await render();
    expect(container.textContent).toBe('');
  });

  it('sem limite, diz que é sem limite', async () => {
    await render();
    expect(container.textContent).toContain('sem limite');
  });

  it('com limite, mostra o quanto já foi preenchido', async () => {
    estado.dias = [dia({ capacity: 16 })];
    estado.participantes = [{ user_id: 'x' }, { user_id: 'y' }];
    await render();
    expect(container.textContent).toContain('2 de 16 vagas preenchidas');
  });

  it('avisa quando os inscritos também conduzem as partidas', async () => {
    estado.dias = [dia({ manage_mode: 'participants' })];
    await render();
    expect(container.textContent).toContain('inscritos também conduzem');
  });
});

/* =========================================================== inscrição === */

describe('marcar presença', () => {
  it('o botão chama a inscrição', async () => {
    await render();
    click(botao('Marcar presença'));
    await act(async () => { await Promise.resolve(); });
    expect(inscrever).toHaveBeenCalledTimes(1);
    expect(inscrever.mock.calls[0][0].courtId).toBeNull();
  });

  it('⭐ lotado: o botão trava E a tela diz por quê', async () => {
    estado.dias = [dia({ capacity: 2 })];
    estado.participantes = [{ user_id: 'x' }, { user_id: 'y' }];
    await render();
    expect(botao('Marcar presença').disabled).toBe(true);
    expect(container.textContent).toContain('As vagas deste dia de jogo acabaram');
  });

  it('⭐ deslogado: trava e explica', async () => {
    auth.user = null;
    await render();
    expect(botao('Marcar presença').disabled).toBe(true);
    expect(container.textContent).toContain('Entre na sua conta');
  });

  it('quem já está inscrito vê o caminho para o dia de jogo, não o botão', async () => {
    estado.participantes = [{ user_id: 'atleta-1' }];
    await render();
    expect(botao('Marcar presença')).toBeFalsy();
    expect(container.textContent).toContain('Inscrito');
    const link = [...container.querySelectorAll('a')].find((a) => a.textContent.includes('Abrir dia de jogo'));
    expect(link.getAttribute('href')).toBe('/dia-de-jogo/gd1');
  });

  it('quem já está inscrito consegue sair', async () => {
    estado.participantes = [{ user_id: 'atleta-1' }];
    await render();
    click(botao('Desmarcar presença'));
    await act(async () => { await Promise.resolve(); });
    expect(sair).toHaveBeenCalledTimes(1);
    expect(sair.mock.calls[0][0]).toMatchObject({ gameDayId: 'gd1', uid: 'atleta-1' });
  });
});

/* ======================================================== por quadra === */

describe('inscrição POR QUADRA', () => {
  const porQuadra = (over = {}) => dia({
    signup_mode: 'court',
    arena_slots: [slot('c1', 2), slot('c2', null)],
    ...over,
  });

  beforeEach(() => { estado.dias = [porQuadra()]; });

  it('⭐ o botão só libera depois de escolher a quadra, e diz isso', async () => {
    await render();
    expect(botao('Marcar presença').disabled).toBe(true);
    expect(container.textContent).toContain('Escolha em qual quadra');

    click(botaoQueContem('Quadra c1'));
    await act(async () => { await Promise.resolve(); });
    expect(botao('Marcar presença').disabled).toBe(false);
  });

  it('a quadra escolhida vai junto na inscrição', async () => {
    await render();
    click(botaoQueContem('Quadra c2'));
    await act(async () => { await Promise.resolve(); });
    click(botao('Marcar presença'));
    await act(async () => { await Promise.resolve(); });
    expect(inscrever.mock.calls[0][0].courtId).toBe('c2');
  });

  it('⭐ quadra lotada não é escolhível, e a outra segue livre', async () => {
    estado.participantes = [
      { user_id: 'x', arena_court_id: 'c1' },
      { user_id: 'y', arena_court_id: 'c1' },
    ];
    await render();
    expect(botaoQueContem('Quadra c1').disabled).toBe(true);
    expect(botaoQueContem('Quadra c1').textContent).toContain('lotada');
    expect(botaoQueContem('Quadra c2').disabled).toBe(false);
  });

  it('mostra as vagas de cada quadra', async () => {
    await render();
    expect(botaoQueContem('Quadra c1').textContent).toContain('2 vaga(s)');
    // Sem limite não mostra vaga restante — mostra quantos já estão.
    expect(botaoQueContem('Quadra c2').textContent).toContain('0 inscrito(s)');
  });

  it('quem já está inscrito não vê mais o seletor de quadra', async () => {
    estado.participantes = [{ user_id: 'atleta-1', arena_court_id: 'c1' }];
    await render();
    expect(container.textContent).not.toContain('Escolha a quadra');
  });
});
