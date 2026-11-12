/**
 * A ficha do torneio de fora. O que estes testes travam (pente fino, Etapa 2):
 *  - "há alteração não salva" some depois de salvar (dupla e vitrine destravam);
 *  - fechar com alteração pergunta antes; excluir e tirar foto pedem confirmação;
 *  - valor que o normalizador descartaria calado vira erro no campo;
 *  - o plano que passou não vira "jogado" calado ("Joguei" / "Não fui");
 *  - a dupla escolhida da lista não perde a conta ao editar o nome;
 *  - a foto só sai do Storage com o servidor confirmando.
 */
import React from 'react';
import { createRoot } from 'react-dom/client';
import { act } from 'react';
import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const est = vi.hoisted(() => ({}));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn(), message: vi.fn() } }));
vi.mock('@/core/lib/FirebaseAuthContext', () => ({ useAuth: () => ({ user: { uid: 'u1' }, userProfile: { platform_name: 'Ana' } }) }));
vi.mock('@/core/lib/FeatureFlagsContext', () => ({ useFeatureFlag: () => false }));
vi.mock('@/modules/federations/hooks/useFederations', () => ({ usePublicFederations: () => ({ isSuccess: false, isError: false }) }));
vi.mock('@/modules/training/services/mediaUploadService', () => ({ prepareUpload: vi.fn() }));
vi.mock('@/modules/training/hooks/useDebriefs', () => ({ useMyDebriefs: () => ({ isSuccess: true, data: [] }) }));
vi.mock('@/modules/career/services/careerService', () => ({ deleteCareerPhoto: (...a) => est.apagarFoto(...a), uploadCareerPhoto: vi.fn() }));
vi.mock('@/modules/career/hooks/useCareer', () => ({
  useDeleteCareerEvent: () => ({ mutateAsync: (...a) => est.remover(...a), isPending: false }),
  useShareCareerWithCoach: () => ({ mutate: vi.fn(), isPending: false }),
}));
vi.mock('@/modules/training/hooks/useTrainingIdentity', () => ({ useTrainingIdentity: () => ({ uid: 'u1', coachLinks: [], coachLinksError: false }) }));
vi.mock('@/modules/coaches/hooks/useStudents', () => ({ useStudentCoaches: () => ({ isSuccess: true, isError: false, data: [] }) }));
vi.mock('@tanstack/react-query', () => ({ useQuery: () => ({ data: [], isError: false, isPending: false }) }));
vi.mock('@/modules/athletes/services/athleteService', () => ({ listAthletes: vi.fn() }));
vi.mock('@/v2/components/people/PartnerPicker', () => ({ default: () => null }));
vi.mock('@/modules/tournament/components/AddToCalendarButton', () => ({ default: () => null }));
vi.mock('./CareerPartnerUi', () => ({ CareerPartnerLayer: (p) => { est.dupla = p; return null; } }));
vi.mock('./CareerShowcaseLayer', () => ({ default: (p) => { est.vitrine = p; return null; } }));

import CareerEventSheet, { conferirFicha } from './CareerEventSheet';

const jogado = (extra = {}) => ({
  id: 'u1_a', uid: 'u1', name: 'Open de Floripa', status: 'played', start_date: '2025-05-10', date_precision: 'day',
  entries: [{ format: 'doubles', gender: null, age: null, level_bracket: null, placement: 'champion' }], photos: [], updated_at_ms: 5, ...extra,
});

let raiz;
let fechar;
let save;
const montar = (event) => {
  fechar = vi.fn();
  const el = document.createElement('div');
  document.body.appendChild(el);
  raiz = createRoot(el);
  act(() => { raiz.render(<CareerEventSheet event={event} open onOpenChange={fechar} save={(...a) => save(...a)} saved onRepeat={vi.fn()} />); });
};
const digitar = (el, v) => {
  const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
  act(() => { set.call(el, v); el.dispatchEvent(new Event('input', { bubbles: true })); });
};
const botao = (txt, onde = document.body) => [...onde.querySelectorAll('button')].filter((b) => b.textContent.trim() === txt).pop();
const tocar = async (el) => { await act(async () => { el.click(); }); };
const campo = (id) => document.getElementById(id);

beforeEach(() => {
  est.apagarFoto = vi.fn();
  est.remover = vi.fn(async () => {});
  // O que o servidor devolve: as MESMAS informações com as chaves em outra ordem e outro `updated_at_ms`.
  save = vi.fn(async (ev) => ({ saved: true, event: { updated_at_ms: 99, start_date: ev.start_date, name: ev.name, id: ev.id, status: ev.status, entries: ev.entries.map((e) => ({ placement: e.placement, format: e.format })) } }));
});
afterEach(() => { act(() => raiz?.unmount()); document.body.innerHTML = ''; });

describe('CareerEventSheet — alteração não salva', () => {
  it('🔴 depois de salvar, dupla e vitrine deixam de ver "alteração não salva"', async () => {
    montar(jogado());
    expect(est.dupla.dirty).toBe(false);
    digitar(campo('ficha-nome'), 'Open de Floripa 2025');
    expect(est.dupla.dirty).toBe(true);
    expect(document.body.textContent).toContain('Alterações não salvas');
    await tocar(botao('Salvar'));
    expect(save).toHaveBeenCalledTimes(1);
    expect(est.dupla.dirty).toBe(false);
    expect(est.vitrine.dirty).toBe(false);
    expect(document.body.textContent).not.toContain('Alterações não salvas');
  });

  it('Enter no formulário salva, e os campos de fora dele estão ligados a ele', async () => {
    montar(jogado());
    expect(campo('ficha-link').form?.id).toBe('ficha-form');
    expect(campo('carreira-cat-0-pts').form?.id).toBe('ficha-form');
    await act(async () => { campo('ficha-form').dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })); });
    expect(save).toHaveBeenCalledTimes(1);
  });

  it('🔴 fechar com alteração pergunta antes; sem alteração fecha direto', async () => {
    montar(jogado());
    await tocar(botao('Fechar'));
    expect(fechar).toHaveBeenCalledWith(false);
    fechar.mockClear();
    digitar(campo('ficha-nome'), 'Outro nome');
    await tocar(botao('Fechar'));
    expect(fechar).not.toHaveBeenCalled();
    const pergunta = document.querySelector('[role="alertdialog"]');
    expect(pergunta.textContent).toContain('Descartar as alterações?');
    await tocar(botao('Descartar', pergunta));
    expect(fechar).toHaveBeenCalledWith(false);
  });
});

describe('CareerEventSheet — o que seria descartado calado', () => {
  it('link sem https:// é completado; http:// vira erro no campo e não salva', async () => {
    montar(jogado());
    digitar(campo('ficha-link'), 'www.site.com/resultado');
    await tocar(botao('Salvar'));
    expect(save.mock.calls[0][0].link).toBe('https://www.site.com/resultado');
    save.mockClear();
    digitar(campo('ficha-link'), 'http://site.com/resultado');
    await tocar(botao('Salvar'));
    expect(save).not.toHaveBeenCalled();
    expect(campo('ficha-link').getAttribute('aria-invalid')).toBe('true');
    expect(document.getElementById(campo('ficha-link').getAttribute('aria-describedby')).textContent).toContain('https://');
  });

  it('conferirFicha: fim antes do começo, pontos e posição fora da faixa, nome vazio', () => {
    const { erros } = conferirFicha({ name: ' ', start_date: '2025-05-10', end_date: '2025-05-01', entries: [{ placement: 'other', placement_n: '0', points_declared: '200000' }] });
    expect(Object.keys(erros).sort()).toEqual(['carreira-cat-0-n', 'carreira-cat-0-pts', 'ficha-fim', 'ficha-nome']);
    expect(conferirFicha(jogado()).erros).toEqual({});
  });

  it('🔴 o plano que passou não salva sem resposta; "Não fui" grava cancelado', async () => {
    montar(jogado({ status: 'planned', start_date: '2020-03-01', entries: [{ format: 'doubles', gender: null, placement: null }] }));
    expect(document.body.textContent).toContain('Você jogou?');
    await tocar(botao('Salvar'));
    expect(save).not.toHaveBeenCalled();
    expect(document.querySelector('[role="alert"]').textContent).toContain('conte como foi');
    await tocar(botao('Não fui'));
    await tocar(botao('Salvar'));
    expect(save.mock.calls[0][0].status).toBe('cancelled');
  });

  it('"Joguei" salva como jogado, e a pergunta some depois de respondida', async () => {
    montar(jogado({ status: 'planned', start_date: '2020-03-01', entries: [{ format: 'doubles', gender: null, placement: null }] }));
    await tocar(botao('Joguei'));
    await tocar(botao('Salvar'));
    expect(save.mock.calls[0][0].status).toBe('played');
    expect(document.body.textContent).not.toContain('Você jogou?');
  });
});

describe('CareerEventSheet — planejado, dupla e fotos', () => {
  it('torneio que ainda não começou não pede colocação, pontos nem foto', () => {
    const ano = new Date().getFullYear() + 1;
    montar(jogado({ status: 'planned', start_date: `${ano}-06-01`, entries: [{ format: 'doubles', gender: null, placement: null }] }));
    expect(campo('carreira-cat-0-col')).toBeNull();
    expect(campo('carreira-cat-0-pts')).toBeNull();
    expect(botao('Pôr foto')).toBeUndefined();
    expect(document.body.textContent).toContain('Categorias');
    expect(campo('ficha-inicio').getAttribute('min')).toBe('1990-01-01');
  });

  it('🔴 dupla escolhida da lista: o nome não é editável (editar apagava a conta); "Tirar a dupla" solta', async () => {
    montar(jogado({ entries: [{ format: 'doubles', gender: null, placement: 'champion', partner: { uid: 'parceira1', name: 'Bia' } }] }));
    expect(campo('carreira-cat-0-dupla').readOnly).toBe(true);
    await tocar(botao('Tirar a dupla'));
    expect(campo('carreira-cat-0-dupla').readOnly).toBe(false);
    expect(campo('carreira-cat-0-dupla').value).toBe('');
  });

  it('🔴 tirar foto pede confirmação e só apaga o arquivo com o servidor confirmando', async () => {
    const foto = { path: 'carreira/u1/a.jpg', url: 'https://x/a.jpg', kind: 'medal', alt: 'Medalha' };
    montar(jogado({ photos: [foto] }));
    save = vi.fn(async (ev) => ({ saved: false, event: ev }));
    await tocar(botao('Tirar a foto'));
    expect(save).not.toHaveBeenCalled();
    await tocar(botao('Tirar a foto', document.querySelector('[role="alertdialog"]')));
    expect(save.mock.calls[0][0].photos).toEqual([]);
    expect(est.apagarFoto).not.toHaveBeenCalled();
  });

  it('com o servidor confirmando, o arquivo da foto sai do Storage', async () => {
    montar(jogado({ photos: [{ path: 'carreira/u1/a.jpg', url: 'https://x/a.jpg', kind: 'medal', alt: 'Medalha' }] }));
    await tocar(botao('Tirar a foto'));
    await tocar(botao('Tirar a foto', document.querySelector('[role="alertdialog"]')));
    expect(est.apagarFoto).toHaveBeenCalledWith('carreira/u1/a.jpg');
  });

  it('o campo de arquivo fica fora do Tab e do leitor de tela', () => {
    montar(jogado());
    expect(campo('ficha-foto').hidden).toBe(true);
  });

  it('excluir pergunta num diálogo e mostra a mensagem do erro', async () => {
    est.remover = vi.fn(async () => { throw new Error('Sem conexão para excluir agora.'); });
    montar(jogado());
    await tocar(botao('Excluir'));
    expect(est.remover).not.toHaveBeenCalled();
    await tocar(botao('Excluir de vez', document.querySelector('[role="alertdialog"]')));
    expect(est.remover).toHaveBeenCalledTimes(1);
    expect(fechar).not.toHaveBeenCalled();
    expect(document.querySelector('[role="alert"]').textContent).toContain('Sem conexão para excluir agora.');
  });

  it('🔴 mandado ao professor: anotações e fotos não prometem "só você vê"', () => {
    montar(jogado({ shared_coach_id: 'professor1' }));
    expect(document.querySelector('label[for="ficha-notas"]').textContent).not.toContain('só você vê');
    expect(document.body.textContent).toContain('as anotações ficam ao alcance dele também');
    expect(document.body.textContent).not.toContain('Até 6 fotos, só você vê');
  });
});
