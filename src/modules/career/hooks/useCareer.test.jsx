/**
 * Hooks da carreira — o rascunho sem sinal e as mutações que não podem ficar
 * penduradas: só se diz "guardado neste aparelho" quando guardou; o envio que
 * chega depois do prazo sai da fila; o recusado no reenvio não some calado;
 * excluir offline tira da fila; o modo lista nunca fica em "Salvando…".
 */
import {
  describe, it, expect, beforeEach, afterEach, vi,
} from 'vitest';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { readViewPreference, writeViewPreference } from '@/core/lib/viewPreference';
import { CAREER_PENDING_PREF, MAX_PENDING, parsePending } from '../domain/draftQueue.js';

const svc = vi.hoisted(() => ({
  saveCareerEvent: vi.fn(),
  saveCareerEventsBatch: vi.fn(),
  deleteCareerEvent: vi.fn(),
  shareCareerWithCoach: vi.fn(),
}));

vi.mock('@/core/lib/FirebaseAuthContext', () => ({
  useAuth: () => ({ user: { uid: 'u1', displayName: 'Ana' }, userProfile: { platform_name: 'Ana P.' } }),
}));
vi.mock('../services/careerService.js', () => {
  class CareerError extends Error {}
  return {
    CareerError,
    saveCareerEvent: (...a) => svc.saveCareerEvent(...a),
    saveCareerEventsBatch: (...a) => svc.saveCareerEventsBatch(...a),
    deleteCareerEvent: (...a) => svc.deleteCareerEvent(...a),
    shareCareerWithCoach: (...a) => svc.shareCareerWithCoach(...a),
  };
});

const {
  careerKeys, useCareerSaveWithDraft, useDeleteCareerEvent, useSaveCareerBatch, useShareCareerWithCoach,
} = await import('./useCareer.js');

const PRAZO_MS = 8000;
const evento = (extra = {}) => ({ name: 'Open de Verão', start_date: '2020-03-01', entries: [{ format: 'doubles', gender: 'mixed' }], ...extra });
const fila = () => parsePending(readViewPreference('u1', CAREER_PENDING_PREF));
const semear = (lista) => writeViewPreference('u1', CAREER_PENDING_PREF, JSON.stringify(lista));
const negado = () => Object.assign(new Error('negado'), { code: 'permission-denied' });
const offline = (v = true) => vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(!v);
/** Promessa controlada de fora. */
const adiada = () => {
  let resolve; let reject;
  const p = new Promise((a, b) => { resolve = a; reject = b; });
  return { p, resolve, reject };
};

let qc; let root; let container;
/** Monta o hook num componente mínimo; `result.current` é o último retorno. */
const montar = (hook) => {
  qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  const result = { current: null };
  function Sonda() { result.current = hook(); return null; }
  container = document.createElement('div');
  root = createRoot(container);
  act(() => { root.render(<QueryClientProvider client={qc}><Sonda /></QueryClientProvider>); });
  return { result };
};

beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  root = null;
  window.localStorage.clear();
  Object.values(svc).forEach((m) => m.mockReset());
  svc.saveCareerEvent.mockImplementation(async (uid, ev) => ev);
});
afterEach(() => {
  if (root) act(() => root.unmount());
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('useCareerSaveWithDraft — salvar', () => {
  it('sem conexão: guarda no aparelho e não chama o servidor', async () => {
    offline();
    const { result } = montar(() => useCareerSaveWithDraft());
    let r;
    await act(async () => { r = await result.current.save(evento()); });
    expect(r.saved).toBe(false);
    expect(fila().map((x) => x.id)).toEqual([r.event.id]);
    expect(svc.saveCareerEvent).not.toHaveBeenCalled();
  });

  it('⭐ sem conexão e o navegador recusou guardar: LANÇA (nunca afirma "guardado neste aparelho")', async () => {
    offline();
    const { result } = montar(() => useCareerSaveWithDraft());
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('QuotaExceeded'); });
    await expect(result.current.save(evento())).rejects.toThrow(/não deixou guardar/);
  });

  it('⭐ fila cheia e sem conexão: recusa o novo em vez de derrubar o mais antigo', async () => {
    offline();
    semear(Array.from({ length: MAX_PENDING }, (_, i) => evento({ id: `u1_${i}` })));
    const { result } = montar(() => useCareerSaveWithDraft());
    await expect(result.current.save(evento())).rejects.toThrow(/esperando conexão/);
    expect(fila()).toHaveLength(MAX_PENDING);
    expect(fila()[0].id).toBe('u1_0');
  });

  it('gravou: sai da fila e devolve o gravado', async () => {
    const { result } = montar(() => useCareerSaveWithDraft());
    let r;
    await act(async () => { r = await result.current.save(evento()); });
    expect(r.saved).toBe(true);
    expect(fila()).toEqual([]);
  });

  it('regra recusou: sai da fila e o erro sobe', async () => {
    svc.saveCareerEvent.mockRejectedValue(negado());
    const { result } = montar(() => useCareerSaveWithDraft());
    await act(async () => { await expect(result.current.save(evento())).rejects.toMatchObject({ code: 'permission-denied' }); });
    expect(fila()).toEqual([]);
  });

  it('⭐ passou do prazo: fica na fila; quando o envio CHEGA, sai dela (o reenvio não regrava por cima)', async () => {
    vi.useFakeTimers();
    const envio = adiada();
    svc.saveCareerEvent.mockReturnValue(envio.p);
    const { result } = montar(() => useCareerSaveWithDraft());
    let r;
    await act(async () => {
      const p = result.current.save(evento());
      await vi.advanceTimersByTimeAsync(PRAZO_MS + 10);
      r = await p;
    });
    expect(r.saved).toBe(false);
    expect(fila()).toHaveLength(1);
    await act(async () => { envio.resolve(r.event); await vi.advanceTimersByTimeAsync(0); });
    expect(fila()).toEqual([]);
  });

  it('⭐ a confirmação do envio ANTIGO não apaga um rascunho mais novo do mesmo id', async () => {
    vi.useFakeTimers();
    const envio = adiada();
    svc.saveCareerEvent.mockReturnValue(envio.p);
    const { result } = montar(() => useCareerSaveWithDraft());
    let r;
    await act(async () => {
      const p = result.current.save(evento());
      await vi.advanceTimersByTimeAsync(PRAZO_MS + 10);
      r = await p;
    });
    semear([{ ...r.event, name: 'Nome corrigido' }]);
    await act(async () => { envio.resolve(r.event); await vi.advanceTimersByTimeAsync(0); });
    expect(fila().map((x) => x.name)).toEqual(['Nome corrigido']);
  });
});

describe('useCareerSaveWithDraft — reenvio (flush)', () => {
  it('⭐ o recusado fica na fila MARCADO, é dito no retorno e não é reenviado de novo', async () => {
    offline(); // sem reenvio automático ao montar
    semear([evento({ id: 'u1_a', name: 'A' }), evento({ id: 'u1_b', name: 'B' })]);
    svc.saveCareerEvent.mockImplementation(async (uid, ev) => { if (ev.id === 'u1_a') throw negado(); return ev; });
    const { result } = montar(() => useCareerSaveWithDraft());
    let r;
    await act(async () => { r = await result.current.flush(); });
    expect(r).toEqual({ enviados: 1, esperando: 0, recusados: [{ id: 'u1_a', name: 'A' }] });
    expect(fila()).toMatchObject([{ id: 'u1_a', refused: true }]);
    expect(svc.saveCareerEvent.mock.calls[0][2]).toEqual({ resend: true });
    svc.saveCareerEvent.mockClear();
    await act(async () => { r = await result.current.flush(); });
    expect(svc.saveCareerEvent).not.toHaveBeenCalled();
    expect(r.enviados).toBe(0);
  });

  it('para no primeiro erro de conexão e diz quantos seguem esperando', async () => {
    offline();
    semear([evento({ id: 'u1_a' }), evento({ id: 'u1_b' })]);
    svc.saveCareerEvent.mockRejectedValue(Object.assign(new Error('x'), { code: 'unavailable' }));
    const { result } = montar(() => useCareerSaveWithDraft());
    let r;
    await act(async () => { r = await result.current.flush(); });
    expect(r).toEqual({ enviados: 0, esperando: 2, recusados: [] });
    expect(svc.saveCareerEvent).toHaveBeenCalledTimes(1);
  });

  it('corrigir e salvar o recusado tira a marca', async () => {
    offline();
    semear([evento({ id: 'u1_a', refused: true })]);
    const { result } = montar(() => useCareerSaveWithDraft());
    await act(async () => { await result.current.save(evento({ id: 'u1_a', refused: true })); });
    expect(fila()[0].refused).toBeUndefined();
  });
});

describe('useDeleteCareerEvent', () => {
  it('⭐ offline, rascunho da fila: sai da fila na hora e a exclusão conclui (não espera o servidor)', async () => {
    offline();
    semear([evento({ id: 'u1_a' })]);
    svc.deleteCareerEvent.mockReturnValue(new Promise(() => {}));
    const { result } = montar(() => useDeleteCareerEvent());
    await act(async () => { await result.current.mutateAsync({ id: 'u1_a' }); });
    expect(fila()).toEqual([]);
    expect(svc.deleteCareerEvent).toHaveBeenCalledTimes(1);
  });

  it('offline, torneio já gravado: erro claro, nada é enfileirado no SDK', async () => {
    offline();
    const { result } = montar(() => useDeleteCareerEvent());
    await act(async () => { await expect(result.current.mutateAsync({ id: 'u1_a' })).rejects.toThrow(/Sem conexão/); });
    expect(svc.deleteCareerEvent).not.toHaveBeenCalled();
  });

  it('⭐ apagou: relê a carreira E o balanço do treino', async () => {
    svc.deleteCareerEvent.mockResolvedValue();
    const { result } = montar(() => useDeleteCareerEvent());
    const invalida = vi.spyOn(qc, 'invalidateQueries');
    await act(async () => { await result.current.mutateAsync({ id: 'u1_a' }); });
    const chaves = invalida.mock.calls.map((c) => c[0].queryKey);
    expect(chaves).toContainEqual(['career']);
    expect(chaves).toContainEqual(['treino', 'balanco']);
  });

  it('rascunho da fila sem documento: a recusa da regra não é erro', async () => {
    semear([evento({ id: 'u1_a' })]);
    svc.saveCareerEvent.mockReturnValue(new Promise(() => {}));
    svc.deleteCareerEvent.mockRejectedValue(negado());
    const { result } = montar(() => useDeleteCareerEvent());
    await act(async () => { await result.current.mutateAsync({ id: 'u1_a' }); });
    expect(fila()).toEqual([]);
  });
});

describe('useSaveCareerBatch — modo lista', () => {
  it('⭐ servidor que não confirma: a mutação FALHA no prazo (o botão sai de "Salvando…")', async () => {
    vi.useFakeTimers();
    svc.saveCareerEventsBatch.mockReturnValue(new Promise(() => {}));
    const { result } = montar(() => useSaveCareerBatch());
    await act(async () => {
      const falhou = expect(result.current.mutateAsync([evento()])).rejects.toThrow(/ainda não foi confirmado/);
      await vi.advanceTimersByTimeAsync(PRAZO_MS + 10);
      await falhou;
    });
  });

  it('sem conexão: recusa na hora e nada é enviado (não fica pausada)', async () => {
    offline();
    const { result } = montar(() => useSaveCareerBatch());
    await act(async () => { await expect(result.current.mutateAsync([evento()])).rejects.toThrow(/Sem conexão/); });
    expect(svc.saveCareerEventsBatch).not.toHaveBeenCalled();
  });
});

describe('useShareCareerWithCoach', () => {
  it('⭐ falhou no meio: invalida assim mesmo (a tela relê o que ficou gravado) e manda quem é o aluno', async () => {
    svc.shareCareerWithCoach.mockRejectedValue(new Error('caiu'));
    const { result } = montar(() => useShareCareerWithCoach());
    const invalida = vi.spyOn(qc, 'invalidateQueries');
    await act(async () => { await expect(result.current.mutateAsync({ event: { id: 'u1_a' }, coachId: 'prof' })).rejects.toThrow('caiu'); });
    expect(invalida.mock.calls.map((c) => c[0].queryKey)).toContainEqual(['career']);
    expect(svc.shareCareerWithCoach.mock.calls[0][2]).toEqual({ actor: { uid: 'u1', name: 'Ana P.' } });
  });
});

describe('careerKeys', () => {
  it('⭐ ranking e agenda das federações ficam FORA do prefixo que cada salvar invalida', () => {
    expect(careerKeys.officialRanks('u1', 'x')[0]).not.toBe('career');
    expect(careerKeys.fedAgenda('x')[0]).not.toBe('career');
    expect(careerKeys.events('u1')[0]).toBe('career');
  });
});
