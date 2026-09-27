/**
 * O PROVEDOR das dicas (flag `guided_tips`).
 *
 * Leve de propósito: guarda o estado (ligadas, guia em andamento, ponto
 * aberto, painel) e as ações. Tudo o que DESENHA — o destaque com a seta, os
 * pontos pulsando, o painel "O que você quer fazer?" — e o catálogo dos guias
 * moram na `DicasCamada`, baixada sob demanda: só quando as dicas estão
 * ligadas, um guia está em andamento ou o painel foi aberto. Quem nunca liga
 * as dicas não paga por elas.
 *
 * Nada aqui toca o banco (`dicasPreference.js`).
 */
import React, { Suspense, lazy, useCallback, useMemo, useState, useSyncExternalStore } from 'react';
import { useAuth } from '@/core/lib/FirebaseAuthContext';
import { useFeatureFlag } from '@/core/lib/FeatureFlagsContext';
import { FEATURE_FLAG } from '@/core/featureFlags';
import {
  dicasSnapshot, marcarGuiaFeito, marcarPontoVisto, recomecarPontos, setDicasLigadas, setGuiaAtivo, subscribeDicas,
} from '@/modules/help/services/dicasPreference';
import { DICAS_INERTES, DicasContext } from './DicasContext';

const DicasCamada = lazy(() => import('./DicasCamada'));

export default function DicasProvider({ children }) {
  const on = useFeatureFlag(FEATURE_FLAG.GUIDED_TIPS);
  const { user } = useAuth();
  const uid = user?.uid || null;
  const snap = useSyncExternalStore(subscribeDicas, () => dicasSnapshot(uid), () => dicasSnapshot(uid));
  const [painelAberto, setPainelAberto] = useState(false);
  const [ponto, setPonto] = useState(null);

  const alternar = useCallback((valor) => {
    const proximo = typeof valor === 'boolean' ? valor : !dicasSnapshot(uid).ligadas;
    setDicasLigadas(uid, proximo);
    if (!proximo) setPonto(null);
  }, [uid]);

  const iniciarGuia = useCallback((id, passo = 0) => {
    if (!id) return;
    setPainelAberto(false);
    setPonto(null);
    setGuiaAtivo(uid, { id, passo });
  }, [uid]);

  const irParaPasso = useCallback((passo) => {
    const atual = dicasSnapshot(uid).guia;
    if (atual) setGuiaAtivo(uid, { id: atual.id, passo: Math.max(0, passo) });
  }, [uid]);

  const encerrarGuia = useCallback(({ concluido = false } = {}) => {
    const atual = dicasSnapshot(uid).guia;
    if (concluido && atual) marcarGuiaFeito(uid, atual.id);
    setGuiaAtivo(uid, null);
  }, [uid]);

  const marcarVisto = useCallback((id) => marcarPontoVisto(uid, id), [uid]);

  const valor = useMemo(() => {
    if (!on) return DICAS_INERTES;
    return {
      on,
      ligadas: snap.ligadas,
      feitos: snap.feitos,
      vistos: snap.vistos,
      guia: snap.guia,
      painelAberto,
      ponto,
      alternar,
      iniciarGuia,
      irParaPasso,
      encerrarGuia,
      abrirPainel: () => { setPonto(null); setPainelAberto(true); },
      fecharPainel: () => setPainelAberto(false),
      abrirPonto: (id) => setPonto(id),
      fecharPonto: () => setPonto(null),
      marcarVisto,
      recomecarVistos: () => recomecarPontos(uid),
    };
  }, [on, snap, painelAberto, ponto, alternar, iniciarGuia, irParaPasso, encerrarGuia, marcarVisto, uid]);

  const precisaCamada = on && (snap.ligadas || Boolean(snap.guia) || painelAberto);

  return (
    <DicasContext.Provider value={valor}>
      {children}
      {precisaCamada && (
        <Suspense fallback={null}>
          <DicasCamada />
        </Suspense>
      )}
    </DicasContext.Provider>
  );
}
