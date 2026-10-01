/**
 * A CENTRAL DE NOTIFICAÇÕES (`/notificacoes`):
 *  - todos os avisos, agrupados por dia, com "Mostrar mais";
 *  - filtros (não lidas, área, busca) que moram na URL;
 *  - marcar como lida e como NÃO lida;
 *  - o que está silenciado é DITO, com "mostrar também";
 *  - falha e carregamento não viram "nenhuma notificação";
 *  - sem a flag, a página não existe.
 */
import React from 'react';
import { createRoot } from 'react-dom/client';
import { act } from 'react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

const AGORA = new Date(2026, 8, 30, 14, 0).getTime();
const estado = {};
const flagsCtx = { flags: { notifications_center: true }, isLoading: false };
const markAsRead = vi.fn(async () => {});
const markAsUnread = vi.fn(async () => {});
const markAllAsRead = vi.fn(async (lista) => lista.filter((n) => !n.read).length);
const retry = vi.fn();
const toast = { success: vi.fn(), error: vi.fn() };

vi.mock('sonner', () => ({ toast }));
vi.mock('@/core/lib/FeatureFlagsContext', () => ({ useFeatureFlags: () => flagsCtx }));
vi.mock('@/core/lib/FirebaseAuthContext', () => ({ useAuth: () => ({ userProfile: estado.perfil || {} }) }));
vi.mock('@/core/lib/useRelogio', () => ({ useRelogio: () => ({ ms: AGORA, hora: '14:00' }) }));
vi.mock('@/modules/notifications/hooks/useNotifications', () => ({
  useNotifications: () => ({ markAsRead, markAsUnread, markAllAsRead, retry, ...estado }),
}));
vi.mock('@/v2/components/tournament/PartnerInviteNotificationAction', () => ({ default: () => null }));

const { default: V2Notifications } = await import('./V2Notifications.jsx');

const em = (...p) => new Date(...p).getTime();
const aviso = (id, over = {}) => ({ id, title: `Aviso ${id}`, message: '', read: false, ...over });

let container;
let root;
let local;
function Onde() {
  local = useLocation();
  return null;
}

beforeEach(() => {
  const lista = [
    aviso('hoje', { created_at_ms: em(2026, 8, 30, 13, 0), title: 'Reserva confirmada', message: 'Quadra 2 às 19h', link: '/minhas-reservas' }),
    aviso('ontem', { created_at_ms: em(2026, 8, 29, 9, 0), title: 'Você entrou no dia de jogo', link: '/dia-de-jogo/g1', read: true }),
    aviso('agosto', { created_at_ms: em(2026, 7, 2, 10, 0), title: 'Torneio aberto', type: 'tournament_open', link: '/torneios/t1' }),
  ];
  Object.assign(estado, {
    notifications: lista,
    allNotifications: lista,
    muted: { total: 0, naoLidas: 0, categorias: [] },
    unreadCount: 2,
    isLoading: false,
    isError: false,
    perfil: {},
  });
  flagsCtx.flags = { notifications_center: true };
  flagsCtx.isLoading = false;
  [markAsRead, markAsUnread, markAllAsRead, retry, toast.success, toast.error].forEach((f) => f.mockClear());
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});
afterEach(() => { act(() => root.unmount()); container.remove(); });

const render = async (url = '/notificacoes') => {
  await act(async () => {
    root.render(
      <MemoryRouter initialEntries={[url]}>
        <Routes>
          <Route path="/notificacoes" element={<><V2Notifications /><Onde /></>} />
          <Route path="/" element={<p>INICIO</p>} />
        </Routes>
      </MemoryRouter>,
    );
  });
};
const texto = () => container.textContent;
const titulos = () => [...container.querySelectorAll('li')].map((li) => li.querySelector('a, p')?.textContent);
const botao = (t) => [...container.querySelectorAll('button')].find((b) => b.textContent.includes(t));
const clicar = async (el) => { await act(async () => { el.click(); }); };

describe('a lista', () => {
  it('⭐ agrupada por dia: Hoje, Ontem e o mês — os antigos também', async () => {
    await render();
    const grupos = [...container.querySelectorAll('h2')].map((h) => h.textContent);
    expect(grupos).toEqual(['Hoje', 'Ontem', 'Agosto de 2026']);
    expect(titulos()).toEqual(['Reserva confirmada', 'Você entrou no dia de jogo', 'Torneio aberto']);
    expect(texto()).toContain('Mostrando 3 de 3 notificações');
  });

  it('cada aviso leva ao assunto e marca como lido ao abrir', async () => {
    await render();
    const link = container.querySelector('a[href="/minhas-reservas"]');
    await clicar(link);
    expect(markAsRead).toHaveBeenCalledWith('hoje');
  });

  it('⭐ "Mostrar mais" em vez de despejar centenas de uma vez', async () => {
    const muitas = Array.from({ length: 70 }, (_, i) => aviso(`n${i}`, { created_at_ms: AGORA - i * 60_000 }));
    estado.notifications = muitas;
    estado.allNotifications = muitas;
    await render();
    expect(container.querySelectorAll('li')).toHaveLength(30);
    await clicar(botao('Mostrar mais 30'));
    expect(container.querySelectorAll('li')).toHaveLength(60);
    await clicar(botao('Mostrar mais 10'));
    expect(container.querySelectorAll('li')).toHaveLength(70);
    expect(botao('Mostrar mais')).toBeUndefined();
  });
});

describe('filtros (na URL)', () => {
  it('não lidas', async () => {
    await render();
    await clicar(botao('Não lidas'));
    expect(titulos()).toEqual(['Reserva confirmada', 'Torneio aberto']);
    expect(local.search).toBe('?filtro=nao-lidas');
  });

  it('⭐ a URL traz os filtros de volta (abrir um aviso e voltar não perde o lugar)', async () => {
    await render('/notificacoes?area=torneios');
    expect(titulos()).toEqual(['Torneio aberto']);
  });

  it('área: só as áreas presentes viram filtro', async () => {
    await render();
    const grupoAreas = container.querySelector('div[aria-label="Filtrar por área"]');
    const nomes = [...grupoAreas.querySelectorAll('button')].map((b) => b.textContent.replace(/\d+/g, '').replace(/,.*$/, '').trim());
    expect(nomes).toEqual(['Todas as áreas', 'Jogos', 'Torneios', 'Arenas']);
    await clicar(botao('Jogos'));
    expect(titulos()).toEqual(['Você entrou no dia de jogo']);
    expect(local.search).toBe('?area=jogos');
  });

  it('no celular a área é uma lista de seleção, com as mesmas opções', async () => {
    await render();
    const sel = container.querySelector('select[aria-label="Filtrar por área"]');
    expect([...sel.options].map((o) => o.textContent)).toEqual([
      'Todas as áreas (3)', 'Dias de jogo e jogos (1)', 'Torneios (1, 1 não lida)', 'Arenas e reservas (1, 1 não lida)',
    ]);
    await act(async () => {
      sel.value = 'torneios';
      sel.dispatchEvent(new Event('change', { bubbles: true }));
    });
    expect(titulos()).toEqual(['Torneio aberto']);
    expect(local.search).toBe('?area=torneios');
  });

  it('busca no texto (sem acento) e "Nada encontrado" com "Limpar filtros"', async () => {
    await render();
    const campo = container.querySelector('input[type="search"]');
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
    await act(async () => {
      setter.call(campo, 'quadra');
      campo.dispatchEvent(new Event('input', { bubbles: true }));
    });
    expect(titulos()).toEqual(['Reserva confirmada']);
    await act(async () => {
      setter.call(campo, 'xyz inexistente');
      campo.dispatchEvent(new Event('input', { bubbles: true }));
    });
    expect(texto()).toContain('Nada encontrado');
    await clicar(botao('Limpar filtros'));
    expect(titulos()).toHaveLength(3);
  });

  it('não lidas sem nenhuma: "Tudo lido", com o caminho de volta', async () => {
    estado.notifications = estado.notifications.map((n) => ({ ...n, read: true }));
    estado.allNotifications = estado.notifications;
    await render('/notificacoes?filtro=nao-lidas');
    expect(texto()).toContain('Tudo lido');
    await clicar(botao('Ver todas'));
    expect(titulos()).toHaveLength(3);
  });
});

describe('lida e não lida', () => {
  it('⭐ marcar como NÃO lida (para voltar depois) e como lida', async () => {
    await render();
    await clicar(container.querySelector('button[aria-label="Marcar como não lida: Você entrou no dia de jogo"]'));
    expect(markAsUnread).toHaveBeenCalledWith('ontem');
    await clicar(container.querySelector('button[aria-label="Marcar como lida: Reserva confirmada"]'));
    expect(markAsRead).toHaveBeenCalledWith('hoje');
  });

  it('marcar todas como lidas, com retorno', async () => {
    await render();
    await clicar(botao('Marcar todas como lidas'));
    expect(markAllAsRead).toHaveBeenCalled();
    expect(toast.success).toHaveBeenCalledWith('2 notificações marcadas como lidas.');
  });

  it('falha ao marcar: avisa, não engole', async () => {
    markAsUnread.mockRejectedValueOnce(new Error('rede'));
    await render();
    await clicar(container.querySelector('button[aria-label="Marcar como não lida: Você entrou no dia de jogo"]'));
    expect(toast.error).toHaveBeenCalled();
  });
});

describe('silenciadas', () => {
  it('⭐ diz quantas estão escondidas e deixa mostrar também', async () => {
    const chat = aviso('chat', { type: 'chat_message', created_at_ms: em(2026, 8, 30, 12, 0), title: 'Nova mensagem' });
    estado.perfil = { notification_prefs: { social: false } };
    estado.allNotifications = [...estado.notifications, chat];
    estado.muted = { total: 1, naoLidas: 1, categorias: ['Mensagens e fórum'] };
    await render();
    expect(texto()).toContain('Você silenciou Mensagens e fórum');
    expect(titulos()).not.toContain('Nova mensagem');
    await clicar(botao('Mostrar também'));
    expect(titulos()).toContain('Nova mensagem');
    expect(texto()).toContain('Silenciada');
    expect(local.search).toBe('?silenciados=1');
  });
});

describe('falha, carregamento, vazio e flag', () => {
  it('⭐ falhou: não afirma que não há notificação, e oferece tentar de novo', async () => {
    estado.isError = true;
    estado.notifications = [];
    estado.allNotifications = [];
    await render();
    expect(texto()).toContain('Não foi possível carregar as notificações');
    expect(texto()).not.toContain('Nenhuma notificação');
    await clicar(botao('Tentar de novo'));
    expect(retry).toHaveBeenCalled();
  });

  it('carregando: esqueleto', async () => {
    estado.isLoading = true;
    estado.notifications = [];
    estado.allNotifications = [];
    await render();
    expect(container.querySelector('[aria-busy="true"]')).not.toBeNull();
    expect(texto()).not.toContain('Nenhuma notificação');
  });

  it('vazio de verdade', async () => {
    estado.notifications = [];
    estado.allNotifications = [];
    estado.unreadCount = 0;
    await render();
    expect(texto()).toContain('Nenhuma notificação por enquanto');
    expect(botao('Marcar todas como lidas')).toBeUndefined();
  });

  it('sem a flag: a página não existe (volta ao início)', async () => {
    flagsCtx.flags = {};
    await render();
    expect(texto()).toContain('INICIO');
  });

  it('enquanto as flags carregam, não expulsa ninguém', async () => {
    flagsCtx.flags = {};
    flagsCtx.isLoading = true;
    await render();
    expect(texto()).not.toContain('INICIO');
  });
});
