/**
 * O EDITOR de itens de treino (`/treino/novo`, `/treino/item/:id/editar`):
 *  - criar um drill com o mínimo e salvar chama a mutação com o input certo;
 *  - sem nome, não salva e diz o que falta, ao lado do campo;
 *  - o item de outra pessoa não abre para editar (e oferece a cópia);
 *  - a leitura que falha diz que falhou — nunca "não está disponível";
 *  - o conteúdo antigo do professor é mandado para a área do professor;
 *  - o rascunho fica no navegador e é oferecido de volta;
 *  - a prévia abre com o que está escrito (a ficha em si é de outra tela).
 */
import React from 'react';
import { createRoot } from 'react-dom/client';
import { act } from 'react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const toast = { success: vi.fn(), error: vi.fn() };
const flagsCtx = { flags: { training_center: true }, isLoading: false };
const identidade = {
  uid: 'eu', name: 'Ana', photo: null, isAdmin: false, isCoach: false, coachReady: true,
  activeCoachIds: [], coachLinks: [], coachLinksError: false, ageYears: 30, actor: { uid: 'eu' },
};
const estado = { leitura: null };
const pedidosDeItem = [];
const criar = vi.fn(async () => 'novo-id');
const atualizar = vi.fn(async () => ({ review: 'nao_se_aplica' }));

vi.mock('sonner', () => ({ toast }));
vi.mock('@/core/lib/FeatureFlagsContext', () => ({ useFeatureFlags: () => flagsCtx }));
vi.mock('@/core/services/observabilityService', () => ({ recordClientError: vi.fn() }));
vi.mock('@/modules/training/hooks/useTrainingIdentity', () => ({ useTrainingIdentity: () => identidade }));
vi.mock('@/modules/training/hooks/useTrainingSettings', () => ({ useTrainingSettings: () => ({ settings: {} }) }));
vi.mock('@/modules/training/hooks/useTrainingItems', () => ({
  useTrainingItem: (id) => {
    pedidosDeItem.push(id);
    return id ? estado.leitura : { isPending: true, isError: false, data: undefined };
  },
  useCreateTrainingItem: () => ({ mutateAsync: criar, isPending: false }),
  useUpdateTrainingItem: () => ({ mutateAsync: atualizar, isPending: false }),
  useVisibleTrainingItems: () => ({ items: [], byId: {}, isLoading: false, isError: false, refetch: vi.fn() }),
}));
// A ficha (`TrainingItemView`) é de outra tela: aqui só conferimos que a prévia abre.
vi.mock('./ItemPreviewDialog', () => ({
  default: ({ open, item }) => (open ? React.createElement('p', null, `PRÉVIA ${item?.title}`) : null),
}));
vi.mock('@/modules/training/services/mediaUploadService', () => ({
  countMyUploads: vi.fn(async () => 0),
  prepareUpload: vi.fn(),
  uploadTrainingMedia: vi.fn(),
  deleteTrainingMedia: vi.fn(),
}));

const { default: V2TrainingEditor } = await import('@/v2/pages/V2TrainingEditor.jsx');

let container;
let root;
let local;
function Onde() {
  local = useLocation();
  return null;
}

const ok = (item) => ({ isPending: false, isError: false, data: { item, reason: item ? '' : 'indisponivel' }, refetch: vi.fn() });

beforeEach(() => {
  estado.leitura = ok(null);
  pedidosDeItem.length = 0;
  [criar, atualizar, toast.success, toast.error].forEach((f) => f.mockClear());
  try { window.localStorage.clear(); } catch { /* sem armazenamento */ }
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});
afterEach(() => { act(() => root.unmount()); container.remove(); });

const render = async (url) => {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  await act(async () => {
    root.render(
      <QueryClientProvider client={qc}>
        <MemoryRouter initialEntries={[url]}>
          <Routes>
            <Route path="/treino/novo" element={<><V2TrainingEditor /><Onde /></>} />
            <Route path="/treino/item/:itemId/editar" element={<><V2TrainingEditor /><Onde /></>} />
            <Route path="/treino/item/:itemId" element={<><p>FICHA</p><Onde /></>} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>,
    );
  });
};
const texto = () => container.textContent;
const botao = (t) => [...container.querySelectorAll('button')].find((b) => b.textContent.trim() === t || b.textContent.includes(t));
const clicar = async (el) => { await act(async () => { el.click(); }); };
const digitar = async (el, valor) => {
  const proto = el.tagName === 'TEXTAREA' ? window.HTMLTextAreaElement.prototype : window.HTMLInputElement.prototype;
  const setter = Object.getOwnPropertyDescriptor(proto, 'value').set;
  await act(async () => {
    setter.call(el, valor);
    el.dispatchEvent(new Event('input', { bubbles: true }));
  });
};

describe('criar', () => {
  it('⭐ drill com o mínimo: salvar chama a mutação com o input certo e abre a ficha', async () => {
    await render('/treino/novo?tipo=drill');
    await digitar(container.querySelector('#campo-title'), 'Dink cruzado');
    await digitar(container.querySelector('#campo-summary'), 'Troca de dinks cruzados na cozinha.');
    await clicar(botao('Adicionar passo'));
    await digitar(container.querySelector('[aria-label="Passo 1"]'), 'Troque dinks cruzados com o parceiro.');
    await clicar(botao('Salvar'));

    expect(criar).toHaveBeenCalledTimes(1);
    const [arg] = criar.mock.calls[0];
    expect(arg).toMatchObject({ source: null, aiAssisted: false, asPlatform: false });
    expect(arg.input).toMatchObject({
      kind: 'drill',
      title: 'Dink cruzado',
      summary: 'Troca de dinks cruzados na cozinha.',
      steps: ['Troque dinks cruzados com o parceiro.'],
      visibility: 'privado',
    });
    expect(local.pathname).toBe('/treino/item/novo-id');
    expect(toast.success).toHaveBeenCalled();
  });

  it('sem nome nem resumo: não salva e diz o que falta ao lado do campo', async () => {
    await render('/treino/novo?tipo=drill');
    await clicar(botao('Salvar'));
    expect(criar).not.toHaveBeenCalled();
    expect(texto()).toContain('Dê um nome com pelo menos 3 letras.');
    expect(container.querySelector('#campo-title').getAttribute('aria-invalid')).toBe('true');
  });

  it('"Ver prévia" mostra a ficha com o que está escrito, sem salvar', async () => {
    await render('/treino/novo?tipo=drill');
    await digitar(container.querySelector('#campo-title'), 'Prévia do drill');
    await clicar(botao('Ver prévia'));
    expect(texto()).toContain('PRÉVIA Prévia do drill');
    expect(criar).not.toHaveBeenCalled();
  });

  it('diagrama sem arrastar: põe pelo botão, aparece na lista, move e desfaz', async () => {
    await render('/treino/novo?tipo=drill');
    await clicar(botao('Desenhar um quadro'));
    await clicar(botao('Pôr no meio da quadra: Jogador A'));
    expect(texto()).toContain('Jogador A1, na cozinha de baixo, no meio');
    for (let i = 0; i < 6; i += 1) await clicar(container.querySelector('[aria-label="Mover para a esquerda"]'));
    expect(texto()).toContain('Jogador A1, na cozinha de baixo, à esquerda');
    await clicar(botao('Desfazer'));
    expect(texto()).toContain('Jogador A1, na cozinha de baixo, no meio');
  });

  it('⭐ IA: o JSON colado preenche o formulário e o item sai marcado como feito com IA', async () => {
    await render('/treino/novo?tipo=drill');
    await clicar(botao('Usar a IA'));
    await digitar(container.querySelector('#ia-resposta'), 'Aqui está:\n```json\n{"kind":"drill","title":"Drill da IA","summary":"Resumo que veio da IA, para revisar.","steps":["Faça isto"],"link":"https://inventado.example"}\n```');
    await clicar(botao('Ler a resposta'));
    await clicar(botao('Preencher tudo'));
    expect(container.querySelector('#campo-title').value).toBe('Drill da IA');
    expect(texto()).toContain('Revise cada parte antes de publicar');
    await clicar(botao('Salvar'));
    const [arg] = criar.mock.calls[0];
    expect(arg.aiAssisted).toBe(true);
    expect(arg.input.link).toBe('');
  });

  it('IA: resposta que não é JSON diz o porquê em português', async () => {
    await render('/treino/novo?tipo=drill');
    await clicar(botao('Usar a IA'));
    await digitar(container.querySelector('#ia-resposta'), 'desculpe, não consigo');
    await clicar(botao('Ler a resposta'));
    expect(texto()).toContain('Não consegui ler o JSON');
  });

  it('sem tipo escolhido, o formulário espera a escolha', async () => {
    await render('/treino/novo');
    expect(texto()).toContain('Que tipo de item?');
    expect(container.querySelector('#campo-title')).toBeNull();
  });

  it('o rascunho fica no navegador e volta como "Continuar rascunho"', async () => {
    await render('/treino/novo?tipo=drill');
    await digitar(container.querySelector('#campo-title'), 'Rascunho guardado');
    await act(async () => { await new Promise((r) => setTimeout(r, 700)); });
    expect(window.localStorage.getItem('v2:draft:eu:treino:novo')).toContain('Rascunho guardado');

    act(() => root.unmount());
    root = createRoot(container);
    await render('/treino/novo?tipo=drill');
    await clicar(botao('Continuar rascunho'));
    expect(container.querySelector('#campo-title').value).toBe('Rascunho guardado');
  });
});

describe('editar', () => {
  const meu = {
    id: 'i1', kind: 'drill', title: 'Meu drill', summary: 'Um resumo com mais de dez letras.', steps: ['Passo um'],
    author_uid: 'eu', author_role: 'atleta', author_name: 'Ana', visibility: 'privado', review: 'nao_se_aplica',
  };

  it('⭐ o item de outra pessoa não abre para editar — e oferece a cópia', async () => {
    estado.leitura = ok({ ...meu, author_uid: 'outra', author_name: 'Bia', visibility: 'publico', review: 'aprovado' });
    await render('/treino/item/i1/editar');
    expect(texto()).toContain('Só quem criou pode editar');
    expect(container.querySelector('#campo-title')).toBeNull();
    expect(botao('Salvar')).toBeUndefined();
    expect(container.querySelector('a[href="/treino/novo?copiar=i1"]')).not.toBeNull();
  });

  it('⭐ leitura que falha mostra o erro com "Tentar de novo" — nunca "não está disponível"', async () => {
    const refetch = vi.fn();
    estado.leitura = { isPending: false, isError: true, data: undefined, refetch };
    await render('/treino/item/i1/editar');
    expect(texto()).toContain('Não foi possível abrir o item');
    expect(texto()).not.toContain('não está disponível');
    await clicar(botao('Tentar de novo'));
    expect(refetch).toHaveBeenCalled();
  });

  it('o próprio item abre preenchido e salva pela atualização', async () => {
    estado.leitura = ok(meu);
    await render('/treino/item/i1/editar');
    expect(container.querySelector('#campo-title').value).toBe('Meu drill');
    await clicar(botao('Salvar'));
    expect(atualizar).toHaveBeenCalledWith(expect.objectContaining({ item: meu, input: expect.objectContaining({ title: 'Meu drill' }) }));
    expect(local.pathname).toBe('/treino/item/i1');
  });

  it('conteúdo antigo do professor (cc_) é editado na área do professor — sem ler o banco', async () => {
    await render('/treino/item/cc_abc/editar');
    expect(texto()).toContain('área do professor');
    expect(container.querySelector('a[href="/aulas?aba=conteudo"]')).not.toBeNull();
    expect(pedidosDeItem.every((id) => id === null)).toBe(true);
  });
});
