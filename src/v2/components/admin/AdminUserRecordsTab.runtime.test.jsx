/**
 * A aba "Cadastros": o admin corrige e complementa o cadastro de um usuário.
 *
 * O que este arquivo protege:
 *  - o que FALTA aparece antes de o admin procurar;
 *  - nada é salvo sem motivo;
 *  - o diff (antes → depois) é mostrado ANTES de salvar;
 *  - a tela diz, em voz alta, o que ela deliberadamente não faz.
 */
import React from 'react';
import { createRoot } from 'react-dom/client';
import { act } from 'react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

const auth = { user: { uid: 'admin_uid' }, isPlatformAdmin: true };
const dados = { users: [] };
const salvar = vi.fn(async () => ({ changes: [{ field: 'city' }] }));

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock('@/core/lib/FirebaseAuthContext', () => ({ useAuth: () => auth }));
vi.mock('@/modules/admin/hooks/usePlatformUsers', () => ({
  useAllPlatformUsers: () => ({ data: dados.users, isLoading: false }),
  useUpdateUserRecordAsAdmin: () => ({ mutateAsync: salvar, isPending: false }),
}));

const { default: AdminUserRecordsTab } = await import('./AdminUserRecordsTab.jsx');
const { fieldOptions } = await import('@/modules/admin/domain/adminUserEdit');

const COMPLETO = {
  uid: 'u_completo', email: 'completa@x.com', platform_name: 'Completa',
  full_name: 'Ana Completa', birth_date: '1990-01-01', phone: '51999999999',
  gender: 'F', city: 'Porto Alegre', state: 'RS', address: 'Rua X',
  pickleball_experience: '1-2 anos', competition_gender: 'female',
  court_side: 'right', leveling_level: '3.5', dupr_id: 'A1', dupr_rating: 3.5,
  photo_url: 'https://x/y.jpg',
};
const INCOMPLETO = { uid: 'u_falta', email: 'falta@x.com', platform_name: 'Faltosa' };

let container, root;

beforeEach(() => {
  salvar.mockClear();
  dados.users = [COMPLETO, INCOMPLETO];
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});
afterEach(() => {
  act(() => root.unmount());
  container.remove();
  document.body.innerHTML = '';
});

const render = async () => { await act(async () => { root.render(<AdminUserRecordsTab />); }); };
const click = (el) => act(() => { el.dispatchEvent(new MouseEvent('click', { bubbles: true })); });
const digitar = async (input, valor) => {
  await act(async () => {
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
    setter.call(input, valor);
    input.dispatchEvent(new Event('input', { bubbles: true }));
  });
};

describe('aba Cadastros — enxergar o que falta', () => {
  it('⭐ aponta o que está vazio, sem o admin ter de procurar', async () => {
    await render();
    const txt = container.textContent;
    expect(txt).toContain('Falta preencher');
    expect(txt).toContain('Data de nascimento');
    expect(txt).toContain('Telefone');
  });

  it('⭐ quem tem obrigatório faltando aparece PRIMEIRO', async () => {
    await render();
    const nomes = [...container.querySelectorAll('div')]
      .map((d) => d.textContent).join('|');
    expect(nomes.indexOf('Faltosa')).toBeLessThan(nomes.indexOf('Completa'));
  });

  it('cadastro completo é marcado como completo', async () => {
    await render();
    expect(container.textContent).toContain('completo');
    expect(container.textContent).toContain('15/15 campos preenchidos');
  });

  it('⭐ diz em voz alta o que NÃO faz', async () => {
    await render();
    const txt = container.textContent;
    expect(txt).toContain('não mexe em poder');
    expect(txt).toContain('preferências de privacidade do titular');
    expect(txt).toContain('não troca o e-mail de login');
  });
});

describe('aba Cadastros — editar', () => {
  const abrirEditor = async () => {
    await render();
    const b = [...container.querySelectorAll('button')]
      .find((x) => x.textContent.includes('Editar cadastro'));
    await click(b);
    return document.querySelector('[role="dialog"]');
  };

  it('⭐ o campo vazio é marcado no formulário', async () => {
    const d = await abrirEditor();
    expect(d).toBeTruthy();
    expect(d.textContent).toContain('vazio');
  });

  it('⭐ NÃO oferece campo de poder nem de privacidade', async () => {
    const d = await abrirEditor();
    ['role', 'can_create_pools', 'email_public', 'directory_listed'].forEach((k) => {
      expect(d.textContent.toLowerCase()).not.toContain(k);
    });
    expect(d.textContent).not.toContain('Poder');
  });

  it('⭐ mostra o ANTES → DEPOIS antes de salvar', async () => {
    const d = await abrirEditor();
    const cidade = [...d.querySelectorAll('label')]
      .find((l) => l.textContent.includes('Cidade'))
      .querySelector('input');
    await digitar(cidade, 'Canoas');
    expect(d.textContent).toContain('O que vai mudar (1)');
    expect(d.textContent).toContain('Canoas');
  });

  it('⭐ NÃO salva sem motivo', async () => {
    const d = await abrirEditor();
    const cidade = [...d.querySelectorAll('label')]
      .find((l) => l.textContent.includes('Cidade'))
      .querySelector('input');
    await digitar(cidade, 'Canoas');
    const btn = [...d.querySelectorAll('button')]
      .find((b) => b.textContent.includes('Salvar'));
    expect(btn.disabled).toBe(true);
    expect(salvar).not.toHaveBeenCalled();
  });

  it('⭐ com motivo, salva apenas os campos permitidos', async () => {
    const d = await abrirEditor();
    const campo = (rotulo) => [...d.querySelectorAll('label')]
      .find((l) => l.textContent.includes(rotulo)).querySelector('input');
    await digitar(campo('Cidade'), 'Canoas');
    await digitar(campo('Motivo da correção'), 'o atleta pediu por WhatsApp');
    const btn = [...d.querySelectorAll('button')]
      .find((b) => b.textContent.includes('Salvar'));
    expect(btn.disabled).toBe(false);
    await click(btn);
    expect(salvar).toHaveBeenCalledTimes(1);
    const arg = salvar.mock.calls[0][0];
    expect(arg.uid).toBe('u_falta');
    expect(arg.reason).toBe('o atleta pediu por WhatsApp');
    expect(arg.patch.city).toBe('Canoas');
    // O payload nunca carrega campo de poder ou privacidade.
    expect(arg.patch).not.toHaveProperty('role');
    expect(arg.patch).not.toHaveProperty('email_public');
  });

  it('sem alteração nenhuma, o salvar fica travado', async () => {
    const d = await abrirEditor();
    const motivo = [...d.querySelectorAll('label')]
      .find((l) => l.textContent.includes('Motivo da correção')).querySelector('input');
    await digitar(motivo, 'um motivo qualquer');
    const btn = [...d.querySelectorAll('button')]
      .find((b) => b.textContent.includes('Salvar'));
    expect(btn.disabled).toBe(true);
  });
});

describe('aba Cadastros — listas de seleção', () => {
  const abrirEditor = async () => {
    await render();
    const b = [...container.querySelectorAll('button')]
      .find((x) => x.textContent.includes('Editar cadastro'));
    await click(b);
    return document.querySelector('[role="dialog"]');
  };
  const campoSelect = (d, rotulo) => [...d.querySelectorAll('label')]
    .find((l) => l.textContent.includes(rotulo))?.querySelector('select');

  it('⭐ os campos com lista viram SELECT, não texto livre', async () => {
    const d = await abrirEditor();
    ['Gênero', 'Experiência no pickleball', 'Categoria competitiva',
      'Lado na quadra', 'Nível declarado'].forEach((rotulo) => {
      expect(campoSelect(d, rotulo), rotulo).toBeTruthy();
    });
  });

  it('os campos sem lista continuam texto livre', async () => {
    const d = await abrirEditor();
    ['Cidade', 'Telefone', 'Estado (UF)'].forEach((rotulo) => {
      expect(campoSelect(d, rotulo), rotulo).toBeFalsy();
    });
  });

  it('⭐ as opções são as MESMAS do cadastro normal', async () => {
    const d = await abrirEditor();
    const sel = campoSelect(d, 'Gênero');
    const valores = [...sel.querySelectorAll('option')].map((o) => o.value);
    // Primeira é sempre "não informado" (string vazia).
    expect(valores[0]).toBe('');
    expect(valores.slice(1)).toEqual(fieldOptions('gender').map((o) => o.value));
  });

  it('⭐ escolher salva o CÓDIGO, não o rótulo', async () => {
    const d = await abrirEditor();
    const sel = campoSelect(d, 'Gênero');
    const codigo = fieldOptions('gender')[0].value;
    await act(async () => {
      const setter = Object.getOwnPropertyDescriptor(
        window.HTMLSelectElement.prototype, 'value',
      ).set;
      setter.call(sel, codigo);
      sel.dispatchEvent(new Event('change', { bubbles: true }));
    });
    const motivo = [...d.querySelectorAll('label')]
      .find((l) => l.textContent.includes('Motivo da correção')).querySelector('input');
    await digitar(motivo, 'preenchendo o que faltava');
    await click([...d.querySelectorAll('button')].find((b) => b.textContent.includes('Salvar')));
    expect(salvar).toHaveBeenCalledTimes(1);
    expect(salvar.mock.calls[0][0].patch.gender).toBe(codigo);
  });

  it('⭐ valor legado FORA da lista aparece e é sinalizado, em vez de sumir', async () => {
    dados.users = [{ ...INCOMPLETO, gender: 'masculino' }]; // rótulo antigo, não código
    const d = await abrirEditor();
    expect(d.textContent).toContain('valor antigo, fora da lista');
    expect(d.textContent).toContain('Escolha um da lista para corrigir');
    const sel = campoSelect(d, 'Gênero');
    expect([...sel.querySelectorAll('option')].map((o) => o.value)).toContain('masculino');
  });

  it('⭐ mudar o nível leva junto o texto exibido (os campos irmãos)', async () => {
    const d = await abrirEditor();
    const sel = campoSelect(d, 'Nível declarado');
    const codigo = fieldOptions('leveling_level')[1].value;
    await act(async () => {
      const setter = Object.getOwnPropertyDescriptor(
        window.HTMLSelectElement.prototype, 'value',
      ).set;
      setter.call(sel, codigo);
      sel.dispatchEvent(new Event('change', { bubbles: true }));
    });
    const motivo = [...d.querySelectorAll('label')]
      .find((l) => l.textContent.includes('Motivo da correção')).querySelector('input');
    await digitar(motivo, 'nivel informado pelo atleta');
    await click([...d.querySelectorAll('button')].find((b) => b.textContent.includes('Salvar')));
    const patch = salvar.mock.calls[0][0].patch;
    expect(patch.leveling_level).toBe(codigo);
    expect(patch.level).toMatch(/USAP/);
    expect(patch.leveling_method).toBe('manual');
  });
});
