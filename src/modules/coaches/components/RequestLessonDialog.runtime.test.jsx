/**
 * O pedido de aula ao professor.
 *
 *  1. ⭐ só aparecem os horários LIVRES do professor — não há data/hora livres
 *     para propor; escolhido um horário, o botão libera e o pedido sai;
 *  2. ⭐ professor sem horários: a tela DIZ que não há, e oferece mandar
 *     mensagem e entrar na lista de espera (sem botão "Solicitar aula");
 *  3. leitura que falhou não vira "sem horários";
 *  4. quem consegue horário sai da lista de espera daquele professor.
 *
 * 🐞 Antes, com o professor sem horários publicados, a tela mostrava "propor
 * horário" e o botão "Solicitar aula" ficava apagado com tudo preenchido.
 */
import React from 'react';
import { createRoot } from 'react-dom/client';
import { act } from 'react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

const pedir = vi.fn(() => Promise.resolve('l1'));
const sair = vi.fn();
const estado = { disp: null, dispErro: false, esperas: [] };

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock('@/core/lib/FirebaseAuthContext', () => ({
  useAuth: () => ({ user: { uid: 'eu', email: 'eu@x.com', displayName: 'Eu' } }),
}));
vi.mock('../hooks/useLessons.js', () => ({
  useCoachAvailability: () => ({ data: estado.disp, isLoading: false, isError: estado.dispErro, isSuccess: !estado.dispErro, refetch: vi.fn() }),
  useCoachBusySlots: () => ({ data: [], isLoading: false, isError: false, isSuccess: true, refetch: vi.fn() }),
  useRequestLesson: () => ({ mutateAsync: pedir, isPending: false }),
}));
vi.mock('../hooks/useCoachWaitlist.js', () => ({
  useMyCoachWaitlists: () => ({ data: estado.esperas }),
  useLeaveCoachWaitlist: () => ({ mutate: sair }),
}));
vi.mock('./CoachWaitlistJoin.jsx', () => ({ default: () => <div data-testid="lista-de-espera">lista de espera</div> }));
vi.mock('@/v2/components/chat/V2ChatLauncherButton', () => ({ default: ({ label }) => <button type="button">{label}</button> }));
vi.mock('../hooks/useCoaches.js', () => ({ useCoachResidencies: () => ({ data: [] }) }));
vi.mock('@/modules/arenas/hooks/useArenas', () => ({ useArenas: () => ({ data: [] }) }));
vi.mock('@/v2/components/promo/LessonCouponField', () => ({ default: () => null }));

const { default: RequestLessonDialog } = await import('./RequestLessonDialog.jsx');

let host; let root;
beforeEach(() => {
  pedir.mockClear(); sair.mockClear();
  estado.disp = null; estado.dispErro = false; estado.esperas = [];
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
});
afterEach(() => {
  act(() => root.unmount());
  host.remove();
});

const botao = (texto) => [...document.querySelectorAll('button')].find((b) => b.textContent === texto);
const abrir = () => act(async () => {
  root.render(<RequestLessonDialog coach={{ id: 'c1', display_name: 'Prof' }} open onOpenChange={() => {}} />);
});
// Toda a semana das 06h às 22h: sempre há horário livre nos próximos dias.
const semanaInteira = { windows: [{ weekdays: [0, 1, 2, 3, 4, 5, 6], start: '06:00', end: '22:00' }], slot_minutes: 60 };

describe('RequestLessonDialog', () => {
  it('⭐ só horários livres: escolher um libera o pedido', async () => {
    estado.disp = semanaInteira;
    await abrir();
    expect(document.querySelector('input[type="date"]')).toBeNull();
    expect(document.querySelector('input[type="time"]')).toBeNull();
    expect(botao('Solicitar aula').disabled).toBe(true);
    expect(document.body.textContent).toContain('Escolha um dos horários livres.');

    const horario = document.querySelector('button[aria-pressed]');
    await act(async () => { horario.click(); });
    expect(botao('Solicitar aula').disabled).toBe(false);
    await act(async () => { botao('Solicitar aula').click(); });
    expect(pedir).toHaveBeenCalledTimes(1);
    expect(pedir.mock.calls[0][0].input.slots).toHaveLength(1);
    expect(sair).not.toHaveBeenCalled();
  });

  it('⭐ sem horários: diz que não há e oferece mensagem e lista de espera', async () => {
    await abrir();
    expect(document.body.textContent).toContain('Este professor ainda não tem horários disponíveis.');
    expect(botao('Mandar mensagem ao professor')).toBeTruthy();
    expect(document.querySelector('[data-testid="lista-de-espera"]')).toBeTruthy();
    expect(botao('Solicitar aula')).toBeUndefined();
    expect(botao('Fechar')).toBeTruthy();
  });

  it('com horários, a lista de espera fica a um toque', async () => {
    estado.disp = semanaInteira;
    await abrir();
    expect(document.querySelector('[data-testid="lista-de-espera"]')).toBeNull();
    const link = botao('Nenhum horário serve? Entre na lista de espera ou fale com o professor.');
    await act(async () => { link.click(); });
    expect(document.querySelector('[data-testid="lista-de-espera"]')).toBeTruthy();
  });

  it('leitura que falhou não vira "sem horários"', async () => {
    estado.dispErro = true;
    await abrir();
    expect(document.body.textContent).toContain('Não foi possível carregar os horários do professor');
    expect(document.body.textContent).not.toContain('ainda não tem horários');
  });

  it('quem consegue horário sai da lista de espera do professor', async () => {
    estado.disp = semanaInteira;
    estado.esperas = [{ coach_id: 'c1', user_id: 'eu' }];
    await abrir();
    await act(async () => { document.querySelector('button[aria-pressed]').click(); });
    await act(async () => { botao('Solicitar aula').click(); });
    expect(sair).toHaveBeenCalledWith({ coachId: 'c1' });
  });
});
