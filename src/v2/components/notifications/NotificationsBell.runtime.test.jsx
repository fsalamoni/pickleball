/**
 * O SINO. O menu do Radix é trocado por blocos simples (o comportamento de
 * abrir/fechar e a rolagem são conferidos no navegador); aqui vale a LÓGICA:
 *  - a lista do sino ROLA (a caixa tem altura máxima e só a lista rola);
 *  - com a central: os 20 mais novos + "Ver todas", dizendo quantos ficaram
 *    de fora e quantos deles não foram lidos;
 *  - sem a central: a lista inteira (nada some);
 *  - selo 99+, nome acessível por extenso;
 *  - carregando e falha NÃO viram "nenhuma notificação".
 */
import React from 'react';
import { createRoot } from 'react-dom/client';
import { act } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

const estado = {};
const flags = { notifications_center: false };
const markAsRead = vi.fn(async () => {});
const markAllAsRead = vi.fn(async () => 2);
const retry = vi.fn();
const navigate = vi.fn();

vi.mock('react-router-dom', async (orig) => ({ ...(await orig()), useNavigate: () => navigate }));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock('@/core/lib/FeatureFlagsContext', () => ({ useFeatureFlag: (k) => Boolean(flags[k]) }));
vi.mock('@/modules/notifications/hooks/useNotifications', () => ({
  useNotifications: () => ({ markAsRead, markAllAsRead, retry, ...estado }),
}));
vi.mock('@/v2/components/tournament/PartnerInviteNotificationAction', () => ({ default: () => null }));
vi.mock('@/components/ui/dropdown-menu', () => ({
  DropdownMenu: ({ children }) => <div>{children}</div>,
  DropdownMenuTrigger: ({ children }) => children,
  DropdownMenuContent: ({ children, style, className }) => (
    <div data-testid="caixa" style={style} className={className}>{children}</div>
  ),
  DropdownMenuItem: ({ asChild, onSelect, children, className }) => (
    asChild ? children : <div role="menuitem" tabIndex={-1} className={className} onClick={onSelect}>{children}</div>
  ),
}));

const { default: NotificationsBell } = await import('./NotificationsBell.jsx');

const aviso = (i, over = {}) => ({
  id: `n${i}`, title: `Aviso ${i}`, message: `Mensagem ${i}`, read: false,
  created_at_ms: Date.now() - i * 60_000, link: '/minhas-reservas', ...over,
});

let container;
let root;
beforeEach(() => {
  Object.assign(estado, {
    notifications: [], unreadCount: 0, muted: { total: 0, naoLidas: 0, categorias: [] },
    isLoading: false, isError: false,
  });
  flags.notifications_center = false;
  [markAsRead, markAllAsRead, retry, navigate].forEach((f) => f.mockClear());
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});
afterEach(() => { act(() => root.unmount()); container.remove(); });

const render = async () => {
  await act(async () => { root.render(<MemoryRouter><NotificationsBell /></MemoryRouter>); });
};
const itens = () => container.querySelectorAll('[role="menuitem"]');
const texto = () => container.textContent;

describe('a caixa cabe na tela e a lista rola', () => {
  it('⭐ altura máxima pela tela e a LISTA com rolagem (o defeito relatado)', async () => {
    estado.notifications = Array.from({ length: 30 }, (_, i) => aviso(i));
    await render();
    const caixa = container.querySelector('[data-testid="caixa"]');
    expect(caixa.style.maxHeight).toContain('--radix-dropdown-menu-content-available-height');
    const lista = container.querySelector('[data-lista-do-sino]');
    expect(lista.className).toContain('overflow-y-auto');
    expect(lista.className).toContain('min-h-0');
  });
});

describe('sem a central (flag desligada)', () => {
  it('mostra a lista INTEIRA — nada fica inalcançável — e o atalho das preferências', async () => {
    estado.notifications = Array.from({ length: 30 }, (_, i) => aviso(i));
    estado.unreadCount = 30;
    await render();
    expect(itens()).toHaveLength(30);
    expect(texto()).not.toContain('Ver todas as notificações');
    expect(container.querySelector('a[href="/configuracoes#notificacoes"]')).not.toBeNull();
  });
});

describe('com a central (flag ligada)', () => {
  it('⭐ os 20 mais novos + "Ver todas", dizendo quantos ficaram de fora e quantos não foram lidos', async () => {
    flags.notifications_center = true;
    estado.notifications = Array.from({ length: 25 }, (_, i) => aviso(i, { read: i < 22 }));
    estado.unreadCount = 3;
    await render();
    expect(itens()).toHaveLength(20);
    const ver = container.querySelector('a[href="/notificacoes"]');
    expect(ver.textContent).toContain('Ver todas as notificações');
    expect(ver.textContent).toContain('Mais 5 avisos');
    expect(ver.textContent).toContain('3 não lidas');
  });
});

describe('o botão do sino', () => {
  it('selo 99+ e nome acessível por extenso', async () => {
    estado.unreadCount = 137;
    estado.notifications = [aviso(1)];
    await render();
    const botao = container.querySelector('[data-dica="botao-notificacoes"]');
    expect(botao.getAttribute('aria-label')).toBe('Notificações (137 não lidas)');
    expect(botao.textContent).toBe('99+');
  });

  it('sem não lidas: sem selo', async () => {
    estado.notifications = [aviso(1, { read: true })];
    await render();
    const botao = container.querySelector('[data-dica="botao-notificacoes"]');
    expect(botao.getAttribute('aria-label')).toBe('Notificações');
    expect(botao.textContent).toBe('');
  });
});

describe('abrir e marcar', () => {
  it('tocar no aviso leva ao assunto e marca como lido', async () => {
    estado.notifications = [aviso(1, { link: '/dia-de-jogo/g1' })];
    estado.unreadCount = 1;
    await render();
    await act(async () => { itens()[0].click(); });
    expect(navigate).toHaveBeenCalledWith('/dia-de-jogo/g1');
    expect(markAsRead).toHaveBeenCalledWith('n1');
  });

  it('aviso já lido não é regravado; link perigoso não navega', async () => {
    estado.notifications = [aviso(1, { read: true, link: '//site-falso.com' })];
    await render();
    await act(async () => { itens()[0].click(); });
    expect(navigate).not.toHaveBeenCalled();
    expect(markAsRead).not.toHaveBeenCalled();
  });

  it('"Marcar todas como lidas"', async () => {
    estado.notifications = [aviso(1), aviso(2)];
    estado.unreadCount = 2;
    await render();
    const b = [...container.querySelectorAll('button')].find((x) => x.textContent.includes('Marcar todas como lidas'));
    await act(async () => { b.click(); });
    expect(markAllAsRead).toHaveBeenCalled();
  });
});

describe('falha e carregamento não são "nenhuma notificação"', () => {
  it('⭐ falhou: diz que não carregou e oferece tentar de novo', async () => {
    estado.isError = true;
    await render();
    expect(texto()).toContain('Não foi possível carregar as notificações');
    expect(texto()).not.toContain('Nenhuma notificação');
    const b = [...container.querySelectorAll('button')].find((x) => x.textContent === 'Tentar de novo');
    await act(async () => { b.click(); });
    expect(retry).toHaveBeenCalled();
  });

  it('carregando: esqueleto, não "nenhuma"', async () => {
    estado.isLoading = true;
    await render();
    expect(container.querySelector('[aria-busy="true"]')).not.toBeNull();
    expect(texto()).not.toContain('Nenhuma notificação');
  });

  it('vazio de verdade: diz que não há, e lembra o que está silenciado', async () => {
    estado.muted = { total: 2, naoLidas: 1, categorias: ['Mensagens e fórum'] };
    await render();
    expect(texto()).toContain('Nenhuma notificação por enquanto');
    expect(texto()).toContain('Você silenciou Mensagens e fórum');
  });
});
