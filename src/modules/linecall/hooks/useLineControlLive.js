/**
 * useLineControlLive — as câmeras no ar e as marcações de um jogo, em tempo
 * real, já juntadas pela central (`fuseLineCalls`).
 *
 * Usado pela central (`/dia-de-jogo/:id/linhas`), pela escolha de posição
 * (que posição já tem câmera), pelo cartão do dia de jogo e pelo telão.
 *
 * Falha não é "nenhuma câmera" (docs/27-FALHA-NAO-E-VAZIO.md): a escuta que
 * falhou acaba, e `retry` assina de novo.
 */

import { useEffect, useMemo, useState, useCallback } from 'react';
import { onSnapshot, query, orderBy, limit } from 'firebase/firestore';
import { logger } from '@/core/lib/logger';
import { camsCol, callsCol } from '../services/lineCallSync.js';
import { fuseLineCalls } from '../domain/fusion.js';
import { addClockSamples, clockOffsets, alignCalls, alignCams } from '../domain/clockSync.js';

/** Quantas marcações a central lê (as mais recentes). */
const CALLS_LIMIT = 150;

function useLive(makeQuery, enabled, onSnap = null) {
  const [state, setState] = useState({ list: [], isLoading: enabled, isError: false });
  const [tentativa, setTentativa] = useState(0);
  useEffect(() => {
    if (!enabled) { setState({ list: [], isLoading: false, isError: false }); return undefined; }
    setState((s) => ({ ...s, isLoading: true, isError: false }));
    let inicial = true;
    return onSnapshot(
      makeQuery(),
      (snap) => {
        onSnap?.(snap, inicial);
        inicial = false;
        setState({ list: snap.docs.map((d) => ({ id: d.id, ...d.data() })), isLoading: false, isError: false });
      },
      (err) => {
        logger.warn('linhas: escuta falhou', err);
        setState((s) => ({ ...s, isLoading: false, isError: true }));
      },
    );
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, tentativa]);
  return [state, useCallback(() => setTentativa((n) => n + 1), [])];
}

/** O relógio da tela, para dizer quem está no ar (tique de 5 s). */
export function useNow(stepMs = 5000) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), stepMs);
    return () => clearInterval(id);
  }, [stepMs]);
  return now;
}

/**
 * @param {string|null} gameDayId
 * @param {{ enabled?: boolean, calls?: boolean }} [opts] `calls: false` ouve só as câmeras
 */
export function useLineControlLive(gameDayId, { enabled = true, calls: withCalls = true } = {}) {
  const on = Boolean(enabled && gameDayId);
  // As horas de cada aparelho viram as do relógio desta tela (domain/clockSync.js).
  const [samples, setSamples] = useState(null);
  useEffect(() => { setSamples(null); }, [gameDayId]);
  const onCams = useCallback((snap, inicial) => {
    const changed = snap.docChanges().filter((ch) => ch.type !== 'removed').map((ch) => ch.doc.data());
    // A carga inicial e o retrato do cache trazem sinais antigos: servem para o
    // relógio da câmera, não para medir a chegada nesta tela.
    const fresh = !inicial && !snap.metadata?.fromCache;
    if (changed.length) setSamples((s) => addClockSamples(s, changed, fresh ? Date.now() : null));
  }, []);
  const [cams, retryCams] = useLive(() => camsCol(gameDayId), on, onCams);
  const [calls, retryCalls] = useLive(
    () => query(callsCol(gameDayId), orderBy('created_at', 'desc'), limit(CALLS_LIMIT)),
    on && withCalls,
  );
  const offsets = useMemo(() => clockOffsets(samples), [samples]);
  const alignedCalls = useMemo(() => alignCalls(calls.list, offsets), [calls.list, offsets]);
  const alignedCams = useMemo(() => alignCams(cams.list, offsets), [cams.list, offsets]);
  const lances = useMemo(() => fuseLineCalls(alignedCalls), [alignedCalls]);
  return {
    cams: alignedCams,
    calls: alignedCalls,
    lances,
    isLoading: cams.isLoading || calls.isLoading,
    isError: cams.isError || calls.isError,
    retry: () => { retryCams(); retryCalls(); },
  };
}
