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
import { MemoryRouter } from 'react-router-dom';
import { act } from 'react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

const auth = { user: { uid: 'admin_uid' }, isPlatformAdmin: true };
const dados = { users: [], rota: '/admin', lembretes: [] };
const salvar = vi.fn(async () => ({ changes: [{ field: 'city' }] }));
const enviarLembrete = vi.fn(async ({ uids }) => ({ sent: uids.length, requested: uids.length }));

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock('@/core/lib/FirebaseAuthContext', () => ({ useAuth: () => auth }));
vi.mock('@/modules/admin/hooks/usePlatformUsers', () => ({
  useAllPlatformUsers: () => ({ data: dados.users, isLoading: false }),
  useAccountLifecycleLogs: () => ({ data: [], isLoading: false }),
  useProfileReminderLogs: () => ({ data: dados.lembretes, isLoading: false, isSuccess: true }),
  useSendProfileReminder: () => ({ mutateAsync: enviarLembrete, isPending: false }),
  useUpdateUserRecordAsAdmin: () => ({ mutateAsync: salvar, isPending: false }),
}));
vi.mock('@/core/lib/FeatureFlagsContext', () => ({ useFeatureFlag: () => false }));
vi.mock('@/modules/admin/services/adminService', () => ({ logUserRecordsExport: vi.fn() }));

// O diálogo do pedido entra por `lazy`: carregado antes, resolve na primeira volta.
await import('./userRecords/ProfileReminderDialog.jsx');
const { default: AdminUserRecordsTab } = await import('./AdminUserRecordsTab.jsx');
const { fieldOptions } = await import('@/modules/admin/domain/adminUserEdit');

const COMPLETO = {
  uid: 'u_completo', email: 'completa@x.com', platform_name: 'Completa',
  full_name: 'Ana Completa', birth_date: '1990-01-01', phone: '51999999999',
  gender: 'F', city: 'Porto Alegre', state: 'RS', address: 'Rua X',
  pickleball_experience: '1-2 anos', competition_gender: 'female',
  court_side: 'right', leveling_level: '3.5', dupr_id: 'DDQ0KL', dupr_rating: 3.5,
  photo_url: 'https://x/y.jpg',
};
const INCOMPLETO = { uid: 'u_falta', email: 'falta@x.com', platform_name: 'Faltosa' };

let container, root;

beforeEach(() => {
  salvar.mockClear();
  enviarLembrete.mockClear();
  dados.users = [COMPLETO, INCOMPLETO];
  dados.rota = '/admin';
  dados.lembretes = [];
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});
afterEach(() => {
  act(() => root.unmount());
  container.remove();
  document.body.innerHTML = '';
});

const render = async () => {
  await act(async () => {
    root.render(<MemoryRouter initialEntries={[dados.rota]}><AdminUserRecordsTab /></MemoryRouter>);
  });
};
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
    expect(container.textContent).toContain('15 de 15 campos preenchidos');
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

describe('aba Cadastros — DUPR no card de cada pessoa', () => {
  it('⭐ ID e rating aparecem na linha, no formato de três casas', async () => {
    await render();
    const txt = container.textContent;
    expect(txt).toContain('DDQ0KL');
    expect(txt).toContain('3,500');
  });

  it('⭐ rating cravado no limite (8,000) é apontado, com filtro próprio', async () => {
    dados.users = [COMPLETO, { ...COMPLETO, uid: 'u_teto', platform_name: 'Teto', dupr_rating: 8 }];
    await render();
    expect(container.textContent).toContain('DUPR a conferir (1)');
    expect(container.textContent).toContain('cravado no limite');
  });

  it('⭐ no editor, "4525" pergunta "Você quis dizer 4,525?" e trava o salvar até aceitar', async () => {
    dados.users = [COMPLETO];
    await render();
    await click([...container.querySelectorAll('button')].find((x) => x.textContent.includes('Editar cadastro')));
    const d = document.querySelector('[role="dialog"]');
    await digitar(d.querySelector('#admin_dupr_rating'), '4525');
    const motivo = [...d.querySelectorAll('label')]
      .find((l) => l.textContent.includes('Motivo da correção')).querySelector('input');
    await digitar(motivo, 'rating informado pelo atleta');
    const salvarBtn = () => [...d.querySelectorAll('button')].find((b) => b.textContent.includes('Salvar'));
    expect(salvarBtn().disabled).toBe(true);
    // O aviso aparece ao sair do campo.
    await act(async () => { d.querySelector('#admin_dupr_rating').dispatchEvent(new FocusEvent('focusout', { bubbles: true })); });
    expect(d.textContent).toContain('Você quis dizer 4,525?');
    await click([...d.querySelectorAll('button')].find((b) => b.textContent.includes('Sim, usar 4,525')));
    expect(salvarBtn().disabled).toBe(false);
    await click(salvarBtn());
    expect(salvar.mock.calls[0][0].patch.dupr_rating).toBe(4.525);
  });
});

describe('aba Cadastros — milhares de contas', () => {
  const muitos = (n) => Array.from({ length: n }, (_, i) => ({
    uid: `p${String(i).padStart(3, '0')}`, email: `p${i}@x.com`, platform_name: `Pessoa ${String(i).padStart(3, '0')}`,
  }));
  const linhas = () => container.querySelectorAll('input[type="checkbox"][aria-label^="Selecionar"]').length;

  it('⭐ pagina de 20 em 20 e deixa trocar para 50 e 100', async () => {
    dados.users = muitos(130);
    await render();
    expect(linhas()).toBe(20);
    expect(container.textContent).toContain('Mostrando 1–20 de 130 cadastros');
    const seletor = container.querySelector('#cadastros-por-pagina');
    expect([...seletor.options].map((o) => o.value)).toEqual(['20', '50', '100']);
    await act(async () => {
      seletor.value = '100';
      seletor.dispatchEvent(new Event('change', { bubbles: true }));
    });
    expect(linhas()).toBe(100);
    await click(container.querySelector('[aria-label="Próxima página"]'));
    expect(linhas()).toBe(30);
    expect(container.textContent).toContain('Mostrando 101–130 de 130 cadastros');
  });

  it('⭐ o recorte vem da URL: filtro, ordem e página sobrevivem a recarregar e a um link', async () => {
    dados.users = [...muitos(3), { ...COMPLETO, uid: 'u_sp', platform_name: 'Paulista', state: 'SP' }];
    dados.rota = '/admin?uf=SP';
    await render();
    expect(linhas()).toBe(1);
    expect(container.textContent).toContain('1 cadastro neste recorte');
    expect(container.querySelector('#cad-uf').value).toBe('SP');
  });

  it('⭐ ordena por nome quando pedido', async () => {
    dados.users = [
      { ...COMPLETO, uid: 'z', platform_name: 'Zélia' },
      { uid: 'a', platform_name: 'Álvaro' },
      { ...COMPLETO, uid: 'm', platform_name: 'Marta' },
    ];
    dados.rota = '/admin?ordem=nome';
    await render();
    const nomes = [...container.querySelectorAll('input[type="checkbox"][aria-label^="Selecionar"]')]
      .map((c) => c.getAttribute('aria-label'));
    expect(nomes.map((n) => n.replace('Selecionar ', '').replace(' para excluir', ''))).toEqual(['Álvaro', 'Marta', 'Zélia']);
  });

  it('⭐ o panorama diz em que pé estão os cadastros, e cada número filtra', async () => {
    await render();
    const txt = container.textContent;
    expect(txt).toContain('Panorama dos cadastros');
    expect(txt).toContain('50% dos cadastros estão completos');
    expect(txt).toContain('O que mais falta (obrigatório)');
    const atalho = [...container.querySelectorAll('button')].find((b) => b.textContent.includes('Data de nascimento') && b.getAttribute('aria-pressed') !== null);
    await click(atalho);
    expect(linhas()).toBe(1);
    expect(container.textContent).toContain('Faltosa');
    expect(container.textContent).toContain('Limpar filtros');
  });

  it('⭐ "Pedir para completar" conta antes e envia só a quem falta obrigatório', async () => {
    await render();
    const botao = [...container.querySelectorAll('button')].find((b) => b.textContent.includes('Pedir para completar (1)'));
    expect(botao).toBeTruthy();
    await click(botao);
    await act(async () => { await new Promise((r) => setTimeout(r, 0)); });
    const d = document.querySelector('[role="dialog"]');
    expect(d.textContent).toContain('Vai para 1 pessoa.');
    expect(d.textContent).toContain('1 já está com o cadastro em dia');
    await click([...d.querySelectorAll('button')].find((b) => b.textContent.includes('Enviar para 1 pessoa')));
    expect(enviarLembrete).toHaveBeenCalledTimes(1);
    expect(enviarLembrete.mock.calls[0][0].uids).toEqual(['u_falta']);
  });

  it('⭐ quem recebeu um pedido há pouco não recebe outro, e a linha diz quando foi', async () => {
    dados.lembretes = [{ created_at_ms: Date.now() - 60_000, details: { uids: ['u_falta'] } }];
    await render();
    expect(container.textContent).toContain('pedido para completar enviado em');
    const botao = [...container.querySelectorAll('button')].find((b) => b.textContent.includes('Pedir para completar (0)'));
    expect(botao.disabled).toBe(true);
  });
});
