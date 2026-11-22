/**
 * O criador de avatar (`/avatar`): o que a tela manda ao servidor são SÓ as
 * escolhas (nunca texto), o limite trava o botão, falha ao consultar não vira
 * "indisponível", e o avatar criado só vai para o perfil quando a pessoa salva.
 */
import React from 'react';
import { createRoot } from 'react-dom/client';
import { act } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import V2AvatarStudio from './V2AvatarStudio.jsx';
import { DEFAULT_RECIPE } from '@/modules/avatar/domain/recipe.js';
import { normalizeBrandPaddle } from '@/modules/avatar/domain/brandItems.js';

const h = vi.hoisted(() => ({
  flags: { avatar_creator: true },
  profile: {},
  update: vi.fn(async () => {}),
  status: { isLoading: false, isError: false, data: null, refetch: vi.fn() },
  generate: vi.fn(),
  brand: { items: [], isLoading: false, isError: false },
  action: vi.fn(),
  upload: vi.fn(async () => ({ url: 'https://s.example/t.jpg', path: 't', fullUrl: 'https://s.example/f.jpg', fullPath: 'f' })),
}));

vi.mock('@/core/lib/FirebaseAuthContext', () => ({
  useAuth: () => ({ user: { uid: 'u1' }, userProfile: h.profile, updateUserProfile: h.update }),
}));
vi.mock('@/core/lib/FeatureFlagsContext', () => ({ useFeatureFlags: () => ({ flags: h.flags, isLoading: false }) }));
vi.mock('@/modules/avatar/hooks/useAvatarCatalog', () => ({ useLiveBrandPaddles: () => h.brand }));
vi.mock('@/modules/avatar/hooks/useAvatarAi', () => ({
  useAvatarAiStatus: () => h.status,
  useGenerateAvatar: () => ({ mutate: h.generate, isPending: false }),
}));
vi.mock('@/modules/avatar/services/avatarAiService.js', async (orig) => ({
  ...(await orig()),
  avatarAiAction: h.action,
  avatarImageFromBase64: () => ({ blob: new Blob(['x']), url: 'blob:avatar' }),
  avatarFiles: async () => ({ thumb: 'thumb', full: 'full' }),
}));
vi.mock('@/modules/avatar/services/avatarService.js', () => ({ uploadAvatarImages: h.upload }));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const livre = { available: true, ok: true, reason: null, day_left: 3, month_left: 15, per_day: 3, per_month: 15, last_ms: 0, base_recipe: null };

let box;
let root;
const montar = () => act(() => { root.render(<MemoryRouter><V2AvatarStudio /></MemoryRouter>); });
const botao = (nome) => [...box.querySelectorAll('button')].find((el) => (el.getAttribute('aria-label') || el.textContent).trim() === nome);
const clicar = (el) => act(async () => { el.click(); });

beforeEach(() => {
  box = document.createElement('div');
  document.body.appendChild(box);
  root = createRoot(box);
  h.flags = { avatar_creator: true };
  h.profile = {};
  h.status = { isLoading: false, isError: false, data: livre, refetch: vi.fn() };
  h.brand = { items: [], isLoading: false, isError: false };
  h.generate.mockReset();
  h.update.mockClear();
  h.upload.mockClear();
  h.action.mockReset();
  URL.revokeObjectURL = vi.fn();
});
afterEach(() => {
  act(() => root.unmount());
  box.remove();
});

describe('criar o avatar', () => {
  it('manda ao servidor só as escolhas do catálogo, do zero', async () => {
    montar();
    await clicar(botao('Atlético'));
    await clicar(botao('Criar avatar'));
    expect(h.generate).toHaveBeenCalledTimes(1);
    const [pedido] = h.generate.mock.calls[0];
    expect(pedido).toEqual({ recipe: { ...DEFAULT_RECIPE, build: 'athletic' }, keep: false });
    expect(box.textContent).toContain('Restam 3 de 3 criações hoje.');
  });

  it('"manter o rosto" só aparece depois de um avatar criado do zero', async () => {
    montar();
    expect(botao('Manter o rosto e mudar o resto')).toBeUndefined();
    h.status = { ...h.status, data: { ...livre, base_recipe: DEFAULT_RECIPE } };
    montar();
    await clicar(botao('Manter o rosto e mudar o resto'));
    expect(h.generate.mock.calls[0][0].keep).toBe(true);
  });

  it('no limite do dia o botão trava e a tela diz por quê', () => {
    h.status = { ...h.status, data: { ...livre, ok: false, reason: 'day', day_left: 0 } };
    montar();
    expect(botao('Criar avatar').disabled).toBe(true);
    expect(box.textContent).toContain('Você já criou os avatares de hoje');
  });

  it('o avatar criado só vai para o perfil ao salvar, e a foto de antes fica guardada', async () => {
    h.profile = { photo_url: 'https://s.example/foto.jpg' };
    h.generate.mockImplementation((_vars, { onSuccess }) => onSuccess({ image: 'AAAA', mime: 'image/jpeg', recipe: DEFAULT_RECIPE }));
    montar();
    await clicar(botao('Criar avatar'));
    expect(h.update).not.toHaveBeenCalled();
    expect(box.querySelector('img[src="blob:avatar"]')).not.toBeNull();
    await clicar(box.querySelector('#av-as-photo'));
    await clicar(botao('Salvar avatar'));
    expect(h.upload).toHaveBeenCalledWith('u1', { thumb: 'thumb', full: 'full' }, expect.any(Function));
    const gravado = h.update.mock.calls[0][0];
    expect(gravado.photo_url).toBe('https://s.example/t.jpg');
    expect(gravado.avatar).toMatchObject({ as_photo: true, photo_backup: 'https://s.example/foto.jpg', full_url: 'https://s.example/f.jpg' });
  });

  it('avisa do avatar criado e não salvo, e o recupera do servidor', async () => {
    h.status = { ...h.status, data: { ...livre, last_ms: 500 } };
    h.action.mockResolvedValue({ image: 'AAAA', mime: 'image/jpeg', recipe: DEFAULT_RECIPE, last_ms: 500 });
    montar();
    expect(box.textContent).toContain('Você criou um avatar e ainda não salvou.');
    await clicar(botao('Ver o avatar'));
    expect(h.action).toHaveBeenCalledWith('last');
    expect(botao('Salvar avatar')).toBeDefined();
  });
});

describe('quando não dá para criar', () => {
  it('falha ao consultar é erro com "tentar de novo", nunca "indisponível"', async () => {
    h.status = { isLoading: false, isError: true, data: undefined, refetch: vi.fn() };
    montar();
    expect(box.textContent).not.toContain('ainda não está disponível');
    await clicar(botao('Tentar de novo'));
    expect(h.status.refetch).toHaveBeenCalled();
  });

  it('criador ainda não ligado pelo admin: diz isso e não oferece criar', () => {
    h.status = { ...h.status, data: { ...livre, available: false } };
    montar();
    expect(box.textContent).toContain('O criador de avatar ainda não está disponível.');
    expect(botao('Criar avatar')).toBeUndefined();
  });

  it('flag desligada: quem usa o avatar como foto ainda volta para a foto de antes', async () => {
    h.flags = {};
    h.profile = { photo_url: 'https://s.example/a.jpg', avatar: { url: 'https://s.example/a.jpg', photo_backup: 'https://s.example/foto.jpg' } };
    montar();
    await clicar(botao('Voltar para a minha foto'));
    expect(h.update.mock.calls[0][0].photo_url).toBe('https://s.example/foto.jpg');
  });
});

describe('raquete de marca', () => {
  const marca = normalizeBrandPaddle({ brand: 'ACME', name: 'Pro 16', shape: 'elongated', color: '#ef4444' });

  it('aparece com o selo Patrocinado e vai no pedido', async () => {
    h.brand = { items: [marca], isLoading: false, isError: false };
    montar();
    await clicar(botao('Raquete'));
    expect(box.textContent).toContain('Patrocinado');
    await clicar([...box.querySelectorAll('[role="radio"]')].find((el) => el.textContent.includes('ACME')));
    await clicar(botao('Criar avatar'));
    expect(h.generate.mock.calls[0][0].recipe.paddleBrand).toBe(marca.id);
  });

  it('marca que não carregou não trava o criador', async () => {
    h.brand = { items: [], isLoading: false, isError: true };
    montar();
    await clicar(botao('Raquete'));
    expect(box.textContent).toContain('As raquetes de marca não carregaram agora');
    expect(botao('Criar avatar').disabled).toBe(false);
  });
});
