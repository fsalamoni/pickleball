/**
 * Teste de RUNTIME de /carreira (docs/54).
 *
 * 🔴 `?evento=` tem TRÊS estados, e dois ficavam sem resposta: o torneio que não
 * existe mais (aviso antigo, excluído) abria a página calada, com o parâmetro
 * preso na URL; e na aba Conquistas a consulta nem rodava. Falha de leitura
 * continua sendo dita como falha — nunca como "não existe".
 *
 * 🔴 Com a flag desligada a pessoa ainda apaga os registros e tira a vitrine do ar.
 */
import React from 'react';
import { createRoot } from 'react-dom/client';
import { act } from 'react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const est = vi.hoisted(() => ({
  flags: { athlete_career: true }, linha: null, rascunho: null, eventsQ: null, publicQ: null,
  remover: null, acao: null, timelineOpts: null, inbox: null,
}));
const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn(), message: vi.fn() }));
vi.mock('sonner', () => ({ toast }));
vi.mock('@/core/lib/FirebaseAuthContext', () => ({ useAuth: () => ({ user: { uid: 'ana' }, userProfile: {} }) }));
vi.mock('@/core/lib/FeatureFlagsContext', () => ({ useFeatureFlags: () => ({ flags: est.flags, isLoading: false }) }));
vi.mock('@/modules/career/hooks/useCareerTimeline', () => ({ useCareerTimeline: (o) => { est.timelineOpts = o; return est.linha; } }));
vi.mock('@/modules/career/hooks/useCareer', () => ({
  useCareerSaveWithDraft: () => est.rascunho,
  useCareerEvents: () => est.eventsQ,
  useCareerPublic: () => est.publicQ,
  useDeleteCareerEvent: () => est.remover,
  useCareerPartnerAction: () => est.acao,
}));
vi.mock('@/v2/components/career/CareerTimeline', () => ({ default: () => <div>LINHA</div> }));
vi.mock('@/v2/components/career/CareerPartnerUi', () => ({ CareerPartnerInbox: (p) => { est.inbox = p; return null; } }));
vi.mock('@/v2/components/trophies/TrophyShelf', () => ({ default: () => <div>ESTANTE</div>, ABA_FORA: 'fora' }));
vi.mock('@/v2/components/career/CareerEventSheet', () => ({
  default: ({ event, onOpenChange }) => <div>FICHA {event.name} <button type="button" onClick={() => onOpenChange(false)}>fechar-ficha</button></div>,
}));
vi.mock('@/v2/components/career/CareerQuickRegister', () => ({ default: () => <div>REGISTRO</div> }));
vi.mock('@/v2/components/career/CareerListMode', () => ({ default: () => <div>LISTA</div> }));
vi.mock('@/v2/components/career/CareerRankPanel', () => ({ default: () => null }));
vi.mock('@/v2/components/career/CareerUpcomingTab', () => ({ default: () => null }));
vi.mock('@/v2/components/career/CareerGoalsTab', () => ({ default: () => null }));
vi.mock('@/v2/ui/V2SectionNav', () => ({ V2SubTabs: () => null }));

import V2Career from './V2Career.jsx';

const EV = { id: 'ana_a', name: 'Open de Floripa', start_date: '2025-05-10' };
const linha = (extra) => ({
  isPending: false, isPaused: false, isError: false, events: [EV], partners: [], trophies: undefined,
  timeline: { upcoming: [], seasons: [], faltou: [] }, retry: vi.fn(), retryPartners: vi.fn(), ...extra,
});

let container; let root; let onde;
function Onde() { onde = useLocation(); return null; }
async function abrir(url) {
  await act(async () => {
    root.render(
      <MemoryRouter key={url} initialEntries={[url]}>
        <Routes>
          <Route path="/carreira" element={<V2Career />} />
          <Route path="/perfil" element={<div>PERFIL</div>} />
        </Routes>
        <Onde />
      </MemoryRouter>,
    );
  });
  // Os diálogos são `lazy`.
  await act(async () => { await Promise.resolve(); });
}
const botao = (texto) => [...container.querySelectorAll('button')].find((b) => b.textContent.includes(texto));

beforeEach(() => {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  est.flags = { athlete_career: true };
  est.linha = linha();
  est.rascunho = { save: vi.fn(), pending: [], flush: vi.fn(), flushing: false, refresh: vi.fn() };
  est.eventsQ = { isPending: false, isSuccess: true, data: [EV], refetch: vi.fn() };
  est.publicQ = { isPending: false, isSuccess: true, data: [], refetch: vi.fn() };
  est.remover = { mutateAsync: vi.fn().mockResolvedValue(), isPending: false };
  est.acao = { mutateAsync: vi.fn().mockResolvedValue({}), isPending: false };
  vi.clearAllMocks();
});
afterEach(() => { act(() => root.unmount()); container.remove(); });

describe('V2Career · ?evento=', () => {
  it('o torneio está na lista: a ficha abre; fechar tira o parâmetro', async () => {
    await abrir('/carreira?evento=ana_a');
    expect(container.textContent).toContain('FICHA Open de Floripa');
    expect(toast.message).not.toHaveBeenCalled();
    await act(async () => { botao('fechar-ficha').click(); });
    expect(onde.search).toBe('');
    // Foi esta visita que abriu: sumir depois (excluído) não vira aviso.
    expect(toast.message).not.toHaveBeenCalled();
  });

  it('🔴 lista carregada e o torneio não existe mais: diz e limpa a URL (mantendo a aba)', async () => {
    await abrir('/carreira?aba=proximos&evento=ana_sumiu');
    expect(toast.message).toHaveBeenCalledWith('Este torneio não está mais na sua carreira.');
    expect(onde.search).toBe('?aba=proximos');
    expect(container.textContent).not.toContain('FICHA');
  });

  it('🔴 a lista FALHOU: é falha (com "tentar de novo"), não "não existe" — e o parâmetro fica', async () => {
    est.linha = linha({ events: undefined });
    await abrir('/carreira?evento=ana_a');
    expect(container.textContent).toContain('Não deu para abrir a ficha deste torneio');
    expect(toast.message).not.toHaveBeenCalled();
    expect(onde.search).toBe('?evento=ana_a');
  });

  it('🔴 na aba Conquistas o link também consulta (antes nada abria e nada explicava)', async () => {
    await abrir('/carreira?aba=conquistas&evento=ana_a');
    expect(est.timelineOpts).toEqual({ enabled: true });
    expect(container.textContent).toContain('FICHA Open de Floripa');
    est.linha = linha({ events: undefined });
    await abrir('/carreira?aba=conquistas&evento=ana_a');
    expect(container.textContent).toContain('Não deu para abrir a ficha deste torneio');
  });

  it('enquanto carrega não afirma nada', async () => {
    est.linha = linha({ isPending: true, events: undefined, timeline: null });
    await abrir('/carreira?evento=ana_sumiu');
    expect(toast.message).not.toHaveBeenCalled();
    expect(onde.search).toBe('?evento=ana_sumiu');
  });

  it('o rascunho guardado no aparelho abre a ficha mesmo fora da lista (e vence a versão do servidor)', async () => {
    est.rascunho.pending = [{ id: 'ana_r1', name: 'Copa Sul', refused: true }, { ...EV, name: 'Open editado sem sinal' }];
    await abrir('/carreira?evento=ana_r1');
    expect(container.textContent).toContain('FICHA Copa Sul');
    await abrir('/carreira?evento=ana_a');
    expect(container.textContent).toContain('FICHA Open editado sem sinal');
  });
});

describe('V2Career · dupla', () => {
  it('🔴 `?dupla=` de um pedido que não está mais aberto: diz e limpa a URL', async () => {
    await abrir('/carreira?dupla=p_sumiu');
    expect(toast.message).toHaveBeenCalledWith('Este pedido de confirmação não está mais aberto.');
    expect(onde.search).toBe('');
  });

  it('pedido que existe segue destacado', async () => {
    est.linha = linha({ partners: [{ id: 'p1', partner_uid: 'ana', status: 'pending' }] });
    await abrir('/carreira?dupla=p1');
    expect(toast.message).not.toHaveBeenCalled();
    expect(est.inbox.focus).toBe('p1');
  });

  it('🔴 "Pôr na minha carreira também" sem a lista carregada NÃO espelha (duplicaria): avisa', async () => {
    est.linha = linha({ events: undefined });
    await abrir('/carreira');
    let ok;
    await act(async () => { ok = await est.inbox.onMirror({ name: 'Copa', linked_event: { id: 'x' } }); });
    expect(ok).toBe(false);
    expect(est.rascunho.save).not.toHaveBeenCalled();
    expect(toast.error).toHaveBeenCalled();
  });
});

describe('V2Career · flag desligada', () => {
  beforeEach(() => { est.flags = {}; });

  it('🔴 quem tem registro ainda consegue apagar (em dois toques, Cancelar no lugar do Excluir)', async () => {
    await abrir('/carreira');
    expect(container.textContent).toContain('A Carreira está desligada no momento');
    expect(container.textContent).toContain('Open de Floripa');
    await act(async () => { botao('Excluir').click(); });
    expect(est.remover.mutateAsync).not.toHaveBeenCalled();
    expect(document.activeElement.textContent).toBe('Cancelar');
    await act(async () => { botao('Excluir de vez').click(); });
    expect(est.remover.mutateAsync).toHaveBeenCalledWith(EV);
  });

  it('🔴 e tirar do perfil público o que estava na vitrine', async () => {
    est.eventsQ = { isPending: false, isSuccess: true, data: [] };
    est.publicQ = { isPending: false, isSuccess: true, data: [{ id: 'ana_ana_a', event_id: 'ana_a', name: 'Open de Floripa', start_date: '2025-05-10' }] };
    await abrir('/carreira');
    await act(async () => { botao('Tirar do perfil').click(); });
    expect(est.acao.mutateAsync).toHaveBeenCalledWith({ action: 'unpublish', eventId: 'ana_a' });
  });

  it('sem nada guardado, a página não existe (vai para o perfil)', async () => {
    est.eventsQ = { isPending: false, isSuccess: true, data: [] };
    await abrir('/carreira');
    expect(container.textContent).toContain('PERFIL');
  });

  it('leitura que falhou não vira "não há nada": fica na página e diz', async () => {
    est.eventsQ = { isPending: false, isSuccess: false, isError: true, data: undefined, refetch: vi.fn() };
    await abrir('/carreira');
    expect(container.textContent).not.toContain('PERFIL');
    expect(container.textContent).toContain('Os seus registros não carregaram');
  });
});
