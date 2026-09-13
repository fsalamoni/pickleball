/**
 * Calendário mensal da arena — a OCUPAÇÃO que a bolinha não contava.
 *
 * O que estes testes protegem é o que a pessoa lê antes de escolher o dia:
 *
 *  1. ⭐ uma reserva numa quadra NÃO lota o horário da arena inteira. Era o
 *     bug: com três quadras, reservar as 19h numa delas pintava o dia como
 *     ocupado e escondia as outras duas;
 *  2. ⭐ o dia diz QUANTO está livre (barra proporcional + "4h livres"), não
 *     só "tem vaga"; dia sem vaga diz "Lotado", e bloqueio do admin diz
 *     "Bloqueado" — que é outra coisa;
 *  3. ⭐ mês sem nenhuma vaga não é beco: a tela diz isso e oferece o próximo
 *     dia livre, em vez de deixar a pessoa clicando "próximo mês" no escuro;
 *  4. o resumo do mês bate com a grade;
 *  5. dia passado não ganha barra nem rótulo.
 *
 * Os hooks de I/O são dublês; o DOMÍNIO da agregação é o de verdade.
 */
import React from 'react';
import { createRoot } from 'react-dom/client';
import { act } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

const HOJE = '2026-07-20'; // segunda-feira
const QUI_1 = '2026-07-23';
const QUI_2 = '2026-07-30';

const estado = {
  courts: [{ id: 'q1', name: 'Quadra 1' }, { id: 'q2', name: 'Quadra 2' }, { id: 'q3', name: 'Quadra 3' }],
  schedules: [],
  bookings: [],
  unavailabilities: [],
  carregando: false,
  erro: false,
};

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock('@/core/lib/FeatureFlagsContext', () => ({ useFeatureFlag: () => false }));
vi.mock('@/core/lib/FirebaseAuthContext', () => ({
  useAuth: () => ({ isAuthenticated: true, user: { uid: 'u1' } }),
}));
vi.mock('@/modules/arenas/hooks/useArenas', () => ({
  useArena: () => ({ data: { id: 'a1', name: 'Arena Teste' } }),
  useArenaCourts: () => ({ data: estado.courts, isLoading: false }),
  useArenaCourtSchedules: () => ({ data: estado.schedules, isLoading: false }),
  useArenaUnavailabilities: () => ({
    data: estado.unavailabilities, isPending: estado.carregando, isError: estado.erro, refetch: () => {},
  }),
}));
vi.mock('@/modules/arenas/hooks/useBookings', () => ({
  useArenaBookings: () => ({
    data: estado.bookings, isPending: estado.carregando, isError: estado.erro, refetch: () => {},
  }),
}));
vi.mock('@/modules/games/hooks/useArenaGameDays', () => ({
  useArenaGameDays: () => ({ data: [] }),
}));
vi.mock('./V2DaySlotsDialog', () => ({ default: () => null }));

const { default: V2BookingCalendar } = await import('./V2BookingCalendar.jsx');

/** Janela das 18h às 22h — 4 horários de 1h. */
const janela = (weekdays, over = {}) => ({
  id: `s-${weekdays.join('')}`, weekdays, start_time: '18:00', end_time: '22:00', is_active: true, ...over,
});

const reserva = (courtId, date, over = {}) => ({
  id: `b-${courtId}-${date}`,
  status: 'confirmed',
  court_id: courtId,
  slots: [{ date, start: '18:00', end: '22:00' }],
  ...over,
});

let container, root;

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true, now: new Date(`${HOJE}T12:00:00`) });
  estado.courts = [{ id: 'q1', name: 'Quadra 1' }, { id: 'q2', name: 'Quadra 2' }, { id: 'q3', name: 'Quadra 3' }];
  estado.schedules = [janela([4])]; // só quintas
  estado.bookings = [];
  estado.unavailabilities = [];
  estado.carregando = false;
  estado.erro = false;
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  document.body.innerHTML = '';
  vi.useRealTimers();
});

async function render() {
  await act(async () => {
    root.render(<MemoryRouter><V2BookingCalendar arenaId="a1" /></MemoryRouter>);
  });
}

/** A célula de um dia, pelo aria-label (que começa sempre pela data por extenso). */
function celula(date) {
  const dia = Number(date.slice(-2));
  return [...container.querySelectorAll('button')].find((b) => {
    const num = b.querySelector('span');
    return num && Number(num.textContent) === dia && b.getAttribute('aria-label')?.includes('de jul');
  });
}

const botaoQueContem = (texto) => [...container.querySelectorAll('button')]
  .find((b) => b.textContent.includes(texto));

/* ======================================================= a conta por quadra */

describe('⭐ uma reserva não lota a arena inteira', () => {
  it('com 3 quadras e 1 reservada, o dia segue com horário livre', async () => {
    estado.bookings = [reserva('q1', QUI_1)];
    await render();
    const cel = celula(QUI_1);
    expect(cel).toBeTruthy();
    // 4 horários continuam com quadra livre (q2 e q3 inteiras).
    expect(cel.textContent).toContain('4h livres');
    expect(cel.getAttribute('aria-label')).toContain('4 horários com quadra livre');
    expect(cel.getAttribute('aria-label')).toContain('33% ocupado');
    expect(cel.disabled).toBe(false);
  });

  it('com as 3 quadras reservadas, aí sim: Lotado', async () => {
    estado.bookings = ['q1', 'q2', 'q3'].map((q) => reserva(q, QUI_1));
    await render();
    const cel = celula(QUI_1);
    expect(cel.textContent).toContain('Lotado');
    expect(cel.textContent).not.toContain('livres');
    expect(cel.getAttribute('aria-label')).toContain('100% ocupado');
    // Lotado ainda é clicável: dá para ver quem está em quadra e a lista.
    expect(cel.disabled).toBe(false);
  });

  it('bloqueio do admin diz "Bloqueado", que não é o mesmo que lotado', async () => {
    estado.unavailabilities = [{ id: 'u1', date: QUI_1, start_time: '18:00', end_time: '22:00', court_id: null }];
    await render();
    const cel = celula(QUI_1);
    expect(cel.textContent).toContain('Bloqueado');
    expect(cel.textContent).not.toContain('Lotado');
  });

  it('filtrando UMA quadra, a conta é só dela', async () => {
    estado.bookings = [reserva('q1', QUI_1)];
    await render();
    const select = container.querySelector('select');
    await act(async () => {
      select.value = 'q1';
      select.dispatchEvent(new Event('change', { bubbles: true }));
    });
    expect(celula(QUI_1).textContent).toContain('Lotado');
  });
});

/* ============================================================== a barrinha */

describe('⭐ a barra de ocupação', () => {
  it('é proporcional ao que está livre e ao que está reservado', async () => {
    estado.bookings = [reserva('q1', QUI_1)];
    await render();
    const faixas = [...celula(QUI_1).querySelectorAll('[aria-hidden="true"] > span')];
    const larguras = faixas.map((f) => f.style.width);
    // 8 de 12 horas-quadra livres, 4 reservadas.
    expect(larguras).toHaveLength(2);
    expect(larguras[0].startsWith('66.6')).toBe(true);
    expect(larguras[1].startsWith('33.3')).toBe(true);
  });

  it('dia fechado não tem barra nem rótulo', async () => {
    await render();
    const segunda = celula('2026-07-27'); // não é quinta
    expect(segunda.querySelector('[aria-hidden="true"]')).toBeNull();
    expect(segunda.textContent.trim()).toBe('27');
    expect(segunda.disabled).toBe(true);
  });

  it('dia que já passou não ganha barra', async () => {
    await render();
    const cel = celula('2026-07-16'); // quinta anterior a hoje
    expect(cel.textContent).toContain('passou');
    expect(cel.textContent).not.toContain('livres');
    expect(cel.querySelector('[aria-hidden="true"]')).toBeNull();
    expect(cel.disabled).toBe(true);
  });
});

/* ============================================================ resumo do mês */

describe('⭐ o resumo do mês', () => {
  it('conta os dias com horário livre daqui para frente', async () => {
    await render();
    // Quintas de julho a partir de 20/07: 23 e 30.
    expect(container.textContent).toContain('2 dias com horário livre');
    expect(container.textContent).toContain('julho');
  });

  it('sem vaga nenhuma no mês, diz isso e oferece o próximo dia livre', async () => {
    estado.bookings = [QUI_1, QUI_2].flatMap((d) => ['q1', 'q2', 'q3'].map((q) => reserva(q, d)));
    await render();
    expect(container.textContent).toContain('Nenhum horário livre');
    const ir = botaoQueContem('Próximo dia livre');
    expect(ir).toBeTruthy();
    expect(ir.textContent).toContain('6 de ago');
  });

  it('o botão do próximo dia livre leva ao mês dele', async () => {
    estado.bookings = [QUI_1, QUI_2].flatMap((d) => ['q1', 'q2', 'q3'].map((q) => reserva(q, d)));
    await render();
    await act(async () => {
      botaoQueContem('Próximo dia livre').dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    expect(container.textContent).toContain('agosto de 2026');
    expect(container.textContent).toContain('dias com horário livre');
  });

  it('arena sem horário publicado não mostra resumo — mostra o aviso', async () => {
    estado.schedules = [];
    await render();
    expect(container.textContent).toContain('ainda não publicou os horários');
    expect(container.textContent).not.toContain('dias com horário livre');
  });
});

/* ========================================================== carregando === */

describe('⭐ enquanto a ocupação não chegou, a tela não afirma nada', () => {
  it('não diz "livres" nem "Lotado" com as reservas ainda em voo', async () => {
    estado.carregando = true;
    await render();
    // O mês inteiro PARECERIA livre: as reservas ainda não chegaram.
    expect(container.textContent).not.toContain('livres');
    expect(container.textContent).not.toContain('Lotado');
    expect(container.textContent).toContain('Carregando a ocupação');
  });

  it('a barra vira um marcador neutro, e o aria-label diz que está carregando', async () => {
    estado.carregando = true;
    await render();
    const cel = celula(QUI_1);
    expect(cel.getAttribute('aria-label')).toContain('carregando a ocupação');
    expect(cel.querySelector('.animate-pulse')).toBeTruthy();
  });

  it('o dia continua clicável — a grade do dia tem a informação de verdade', async () => {
    estado.carregando = true;
    await render();
    expect(celula(QUI_1).disabled).toBe(false);
  });
});

/* ================================================================ erro === */

describe('⭐ quando a consulta FALHA', () => {
  it('a tela diz que falhou e oferece tentar de novo', async () => {
    estado.erro = true;
    await render();
    expect(container.textContent).toContain('Não foi possível carregar a ocupação');
    expect(botaoQueContem('Tentar de novo')).toBeTruthy();
  });

  it('não afirma ocupação nenhuma — falha não é "está livre"', async () => {
    estado.erro = true;
    await render();
    expect(container.textContent).not.toContain('livres');
    expect(container.textContent).not.toContain('Lotado');
    expect(celula(QUI_1).getAttribute('aria-label')).toContain('ocupação indisponível');
  });

  it('os dias seguem clicáveis: a grade do dia ainda pode carregar', async () => {
    estado.erro = true;
    await render();
    expect(celula(QUI_1).disabled).toBe(false);
  });

  it('e não oferece "próximo dia livre", que seria um palpite', async () => {
    estado.erro = true;
    estado.bookings = [QUI_1, QUI_2].flatMap((d) => ['q1', 'q2', 'q3'].map((q) => reserva(q, d)));
    await render();
    expect(botaoQueContem('Próximo dia livre')).toBeUndefined();
  });
});
