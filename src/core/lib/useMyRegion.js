/**
 * A MINHA REGIÃO, para quem desenha (flag `my_region`).
 *
 * `useMyRegion()` responde, para a tela inteira:
 *  - se a funcionalidade vale (`ativa`);
 *  - qual é a região agora (`region`, de `resolveRegion`) e como dizê-la;
 *  - o JUIZ (`matcher`): para cada lugar, dentro ou fora, e a distância;
 *  - se ainda está carregando o mapa das cidades (`carregando`);
 *  - como mudar (`definir`, `restaurar`).
 *
 * `useRegionalList(itens, lugarDe)` aplica isso a uma lista e devolve o que
 * mostrar — com a contagem do que ficou de fora e o botão de "ver também"
 * (que vale SÓ nesta tela, nesta visita: ampliar uma vez não muda a região).
 *
 * O mapa das cidades (≈ 57 kB) só é baixado com a funcionalidade ligada e um
 * centro conhecido — e uma vez por sessão. Nada aqui toca o banco.
 */
import {
  useCallback, useEffect, useMemo, useState, useSyncExternalStore,
} from 'react';
import { useAuth } from '@/core/lib/FirebaseAuthContext';
import { useFeatureFlag } from '@/core/lib/FeatureFlagsContext';
import { FEATURE_FLAG } from '@/core/featureFlags';
import {
  REGION_MODE, placeInfo, regionLabel, regionLimits, regionMatcher, regionPhrase, regionShortLabel, resolveRegion,
} from '@/core/domain/region';
import { loadCityGeo } from '@/core/geo/cidadesBR';
import { regionSnapshot, resetRegion, saveRegion, subscribeRegion } from './regionPreference';

/*
 * O mapa das cidades é UM para a plataforma inteira e não muda durante a
 * sessão: um armazém pequeno basta (sem React Query — assim quem só quer saber
 * a região não depende de provedor nenhum, e com a flag desligada nada é
 * carregado).
 */
let geo = Object.freeze({ status: 'idle', data: null });
const ouvintesGeo = new Set();
function publicarGeo(prox) {
  geo = Object.freeze(prox);
  ouvintesGeo.forEach((fn) => { try { fn(); } catch { /* segue */ } });
}
function assinarGeo(fn) {
  ouvintesGeo.add(fn);
  return () => ouvintesGeo.delete(fn);
}
function carregarGeo() {
  if (geo.status === 'loading' || geo.status === 'success') return;
  publicarGeo({ status: 'loading', data: null });
  loadCityGeo()
    .then((data) => publicarGeo({ status: 'success', data }))
    .catch(() => publicarGeo({ status: 'error', data: null }));
}

/** O mapa das cidades, sob demanda (uma vez por sessão). */
export function useCityGeo({ enabled = true } = {}) {
  const retrato = useSyncExternalStore(assinarGeo, () => geo, () => geo);
  useEffect(() => { if (enabled) carregarGeo(); }, [enabled]);
  return {
    data: retrato.data,
    isLoading: enabled && (retrato.status === 'idle' || retrato.status === 'loading'),
    isError: retrato.status === 'error',
    refetch: () => {
      if (geo.status === 'error') publicarGeo({ status: 'idle', data: null });
      carregarGeo();
    },
  };
}

export function useMyRegion() {
  const ativa = useFeatureFlag(FEATURE_FLAG.MY_REGION);
  const { user, userProfile } = useAuth();
  const uid = user?.uid || null;
  const retrato = useSyncExternalStore(subscribeRegion, () => regionSnapshot(uid), () => regionSnapshot(uid));
  const cidadePerfil = userProfile?.city || '';
  const ufPerfil = userProfile?.state || '';
  const region = useMemo(
    () => resolveRegion(retrato.salvo, { city: cidadePerfil, state: ufPerfil }),
    [retrato, cidadePerfil, ufPerfil],
  );
  // O mapa serve para medir distância: sem centro, não há o que medir.
  const precisaMapa = ativa && Boolean(region.cidade);
  const geoQ = useCityGeo({ enabled: precisaMapa });
  const geo = geoQ.data || null;
  const matcher = useMemo(() => regionMatcher(region, geo), [region, geo]);

  const definir = useCallback((pref) => { saveRegion(uid, pref); }, [uid]);
  const restaurar = useCallback(() => { resetRegion(uid); }, [uid]);

  return {
    ativa,
    region,
    matcher,
    geo,
    rotulo: regionLabel(region),
    rotuloCurto: regionShortLabel(region),
    frase: regionPhrase(region),
    limita: ativa && regionLimits(region),
    personalizada: retrato.salvo !== null,
    // A escolha guardada (ou `null`): o seletor precisa dela, não só da região resolvida.
    escolha: retrato.salvo,
    // Só "até N km" depende do mapa para decidir quem entra; nos outros modos
    // o mapa só acrescenta a distância, e a lista não precisa esperar por ela.
    carregando: precisaMapa && region.modo === REGION_MODE.RAIO && geoQ.isLoading,
    mapaFalhou: precisaMapa && geoQ.isError,
    definir,
    restaurar,
  };
}

/**
 * Aplica a região a uma lista.
 *
 * - Desligada a funcionalidade (ou "todo lugar"): a lista volta como veio.
 * - Ligada: só o que está DENTRO, na ordem recebida — e `fora` diz quantos
 *   ficaram de fora, para a tela oferecer "ver também" em vez de esconder.
 * - `ignorar`: quando a pessoa está BUSCANDO por nome, a região não se mete —
 *   quem procura uma arena pelo nome quer achá-la onde ela estiver.
 *
 * @template T
 * @param {T[]} itens
 * @param {(item: T) => object|object[]} lugarDe `{ city, state }` (ou vários)
 * @param {{ ignorar?: boolean }} [opts]
 */
export function useRegionalList(itens, lugarDe, { ignorar = false } = {}) {
  const regiao = useMyRegion();
  const [ampliado, setAmpliado] = useState(false);
  const lista = Array.isArray(itens) ? itens : [];

  const resultado = useMemo(() => {
    if (!regiao.ativa) return { visiveis: lista, fora: 0 };
    const infos = new Map(lista.map((i) => [i, placeInfo(i, lugarDe, regiao.matcher)]));
    const dentro = lista.filter((i) => infos.get(i).dentro);
    const fora = lista.length - dentro.length;
    const mostrarTudo = ignorar || ampliado || !regionLimits(regiao.region);
    return { visiveis: mostrarTudo ? lista : dentro, fora: mostrarTudo ? 0 : fora, infos, foraTotal: fora };
    // `lugarDe` costuma ser uma função nova a cada render: a lista e a região
    // bastam para decidir quando recalcular.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lista, regiao.ativa, regiao.matcher, regiao.region, ampliado, ignorar]);

  const infoDe = useCallback(
    (item) => resultado.infos?.get(item) || (regiao.ativa ? placeInfo(item, lugarDe, regiao.matcher) : null),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [resultado, regiao.ativa, regiao.matcher],
  );

  return {
    ...regiao,
    itens: resultado.visiveis,
    fora: resultado.fora,
    // Com "ver também" ligado, quantos vieram de fora (para o "só a minha região").
    ampliadoCom: ampliado ? (resultado.foraTotal || 0) : 0,
    ampliado,
    ampliar: () => setAmpliado(true),
    recolher: () => setAmpliado(false),
    buscando: ignorar,
    infoDe,
  };
}
