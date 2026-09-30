/**
 * MINHA REGIÃO — onde cada pessoa quer ver o que acontece (lógica pura).
 *
 * ## O pedido
 *
 * *"Que leve em consideração primeiro a sua cidade, mas também que tenha uma
 * margem de raio (configurável) para cidades próximas, e até a possibilidade
 * de ver em outros estados, cidades, países etc, caso o usuário deseje ver
 * outras localidades… em toda plataforma."*
 *
 * ## Os quatro jeitos
 *
 * | modo    | o que entra                                   | precisa de |
 * |---------|-----------------------------------------------|------------|
 * | cidade  | só a cidade                                   | cidade     |
 * | raio    | a cidade e as que ficam a até N km            | cidade (+ o mapa das cidades para medir) |
 * | estado  | o estado inteiro                              | UF         |
 * | todos   | todo lugar — o mais perto aparece primeiro    | nada       |
 *
 * O CENTRO vem do perfil (padrão), de outro lugar escolhido à mão (quem vai
 * viajar) ou da localização do aparelho — que vira uma CIDADE: o que se guarda
 * é o nome da cidade mais próxima, nunca as coordenadas da pessoa.
 *
 * O padrão, para quem nunca escolheu, é **a cidade do perfil e até 50 km**.
 * Sem cidade no perfil, cai para o estado; sem nada, mostra todo lugar e a
 * tela pede a cidade (`falta`), em vez de esconder tudo.
 *
 * ## Por que por cidade, e não por coordenada do item
 *
 * Nem torneio, nem arena, nem dia de jogo têm coordenadas — têm CIDADE e UF.
 * A distância é medida entre as CIDADES, pelo mapa do IBGE que a plataforma
 * carrega sob demanda (`core/geo/cidadesBR.js`). Nada disso toca o banco.
 */
import { normalizeLocality, ufOf } from './locality.js';
import { ufName } from './ufs.js';

export const REGION_MODE = Object.freeze({
  CIDADE: 'cidade',
  RAIO: 'raio',
  ESTADO: 'estado',
  TODOS: 'todos',
});

/** De onde vem o centro da região. */
export const REGION_ORIGIN = Object.freeze({
  PERFIL: 'perfil',
  OUTRA: 'outra',
  APARELHO: 'aparelho',
});

/** O que faltou para valer a região pedida (a tela pede isso à pessoa). */
export const REGION_MISSING = Object.freeze({
  CIDADE: 'cidade',
  ESTADO: 'estado',
});

/** As distâncias oferecidas na tela. */
export const RADIUS_CHOICES_KM = Object.freeze([10, 25, 50, 100, 200]);
export const DEFAULT_RADIUS_KM = 50;
export const MAX_RADIUS_KM = 1000;
const VERSAO = 1;

const texto = (v, max = 80) => String(v ?? '').trim().slice(0, max);

/**
 * A escolha, limpa. `null` quando não há escolha válida (vale o padrão).
 * @param {object} input `{ modo, origem, cidade, uf, raioKm }`
 */
export function normalizeRegionPreference(input) {
  if (!input || typeof input !== 'object') return null;
  const modo = Object.values(REGION_MODE).includes(input.modo) ? input.modo : null;
  if (!modo) return null;
  const origem = Object.values(REGION_ORIGIN).includes(input.origem) ? input.origem : REGION_ORIGIN.PERFIL;
  const raio = Math.round(Number(input.raioKm));
  const doPerfil = origem === REGION_ORIGIN.PERFIL;
  return {
    modo,
    origem,
    // Do perfil, a cidade é lida do PERFIL na hora — nunca copiada: quem muda
    // de cidade no cadastro não pode continuar vendo a antiga.
    cidade: doPerfil ? '' : texto(input.cidade),
    uf: doPerfil ? '' : ufOf(input.uf),
    raioKm: Number.isFinite(raio) && raio > 0 ? Math.min(MAX_RADIUS_KM, raio) : DEFAULT_RADIUS_KM,
  };
}

/** Texto guardado → escolha, ou `null` (nunca escolheu / ilegível). */
export function parseRegionPreference(raw) {
  if (!raw) return null;
  try {
    const obj = JSON.parse(raw);
    if (!obj || obj.v !== VERSAO) return null;
    return normalizeRegionPreference(obj);
  } catch {
    return null;
  }
}

/** Escolha → texto para guardar (ou `null`, que apaga). */
export function serializeRegionPreference(pref) {
  const p = normalizeRegionPreference(pref);
  return p ? JSON.stringify({ v: VERSAO, ...p }) : null;
}

/**
 * A região que VALE agora, a partir da escolha e do perfil.
 *
 * @param {object|null} preferencia escolha guardada (ou `null`: o padrão)
 * @param {{ city?: string, state?: string }} [perfil]
 * @returns {{
 *   modo: string, origem: string, cidade: string, uf: string, raioKm: number,
 *   padrao: boolean, falta: string|null,
 * }}
 */
export function resolveRegion(preferencia, perfil = {}) {
  const pref = normalizeRegionPreference(preferencia);
  const p = pref || {
    modo: REGION_MODE.RAIO, origem: REGION_ORIGIN.PERFIL, cidade: '', uf: '', raioKm: DEFAULT_RADIUS_KM,
  };
  const doPerfil = p.origem === REGION_ORIGIN.PERFIL;
  const cidade = doPerfil ? texto(perfil?.city) : p.cidade;
  const uf = doPerfil ? ufOf(perfil?.state) : p.uf;
  const base = {
    origem: p.origem, cidade, uf, raioKm: p.raioKm, padrao: !pref, falta: null,
  };

  if (p.modo === REGION_MODE.TODOS) return { ...base, modo: REGION_MODE.TODOS };
  if (p.modo === REGION_MODE.ESTADO) {
    return uf
      ? { ...base, modo: REGION_MODE.ESTADO }
      : { ...base, modo: REGION_MODE.TODOS, falta: REGION_MISSING.ESTADO };
  }
  // cidade ou raio
  if (cidade) return { ...base, modo: p.modo };
  if (uf) return { ...base, modo: REGION_MODE.ESTADO, falta: REGION_MISSING.CIDADE };
  return { ...base, modo: REGION_MODE.TODOS, falta: REGION_MISSING.CIDADE };
}

/** A região limita alguma coisa? ("todo lugar" não limita.) */
export function regionLimits(region) {
  return Boolean(region) && region.modo !== REGION_MODE.TODOS;
}

const cidadeUf = (r) => `${r.cidade}${r.uf ? ` / ${r.uf}` : ''}`;
const km = (n) => `${Number(n).toLocaleString('pt-BR')} km`;

/** "Porto Alegre / RS e até 50 km" · "Rio Grande do Sul (todo o estado)" · "Todo lugar". */
export function regionLabel(region) {
  if (!region) return '';
  switch (region.modo) {
    case REGION_MODE.CIDADE: return cidadeUf(region);
    case REGION_MODE.RAIO: return `${cidadeUf(region)} e até ${km(region.raioKm)}`;
    case REGION_MODE.ESTADO: return `${ufName(region.uf)} (todo o estado)`;
    default: return 'Todo lugar';
  }
}

/** Para o chip: "Porto Alegre + 50 km" · "Porto Alegre" · "RS" · "Todo lugar". */
export function regionShortLabel(region) {
  if (!region) return '';
  switch (region.modo) {
    case REGION_MODE.CIDADE: return region.cidade;
    case REGION_MODE.RAIO: return `${region.cidade} + ${km(region.raioKm)}`;
    case REGION_MODE.ESTADO: return region.uf;
    default: return 'Todo lugar';
  }
}

/** Para frases: "em Porto Alegre / RS e até 50 km" · "em todo o estado (RS)". */
export function regionPhrase(region) {
  if (!region) return '';
  switch (region.modo) {
    case REGION_MODE.CIDADE:
    case REGION_MODE.RAIO:
      return `em ${regionLabel(region)}`;
    case REGION_MODE.ESTADO: return `em todo o estado (${region.uf})`;
    default: return 'em todo lugar';
  }
}

/* ------------------------------------------------------------ distância -- */

/** Distância em linha reta entre dois pontos `{ lat, lon }`, em km. */
export function haversineKm(a, b) {
  if (!a || !b) return null;
  const rad = (g) => (g * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLon = rad(b.lon - a.lon);
  const h = Math.sin(dLat / 2) ** 2
    + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLon / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** "na sua cidade" · "a 14 km" · `null` (distância desconhecida). */
export function distanceLabel(distancia) {
  if (distancia == null || !Number.isFinite(distancia)) return null;
  if (distancia < 1) return 'na sua cidade';
  return `a ${km(Math.round(distancia))}`;
}

/**
 * O juiz de uma região: diz, para um lugar `{ city, state }`, se ele está
 * DENTRO e a que distância (quando dá para medir).
 *
 * `geo` é o mapa das cidades (`buildCityGeo`). Sem ele (ainda carregando, ou
 * sem rede), "até N km" vale só para a própria cidade — nada é inventado.
 *
 * @param {object} region `resolveRegion`
 * @param {object|null} [geo]
 * @returns {(place: { city?: string, state?: string }) => { dentro: boolean, km: number|null, conhecido: boolean }}
 */
export function regionMatcher(region, geo = null) {
  const modo = region?.modo || REGION_MODE.TODOS;
  const centroCidade = normalizeLocality(region?.cidade);
  const centroUf = ufOf(region?.uf);
  const centro = geo && centroCidade ? geo.coordsOf(region.cidade, centroUf) : null;
  const memoria = new Map();

  return (place) => {
    const cidade = normalizeLocality(place?.city);
    const ufInformada = ufOf(place?.state);
    const chave = `${ufInformada}|${cidade}`;
    const lembrado = memoria.get(chave);
    if (lembrado) return lembrado;

    let uf = ufInformada;
    const coords = geo && cidade ? geo.coordsOf(place.city, uf) : null;
    // Cidade sem UF que só existe num estado: a UF vem do mapa.
    if (!uf && coords?.uf) uf = coords.uf;
    const mesmaCidade = Boolean(cidade) && cidade === centroCidade
      && (!uf || !centroUf || uf === centroUf);
    const distancia = mesmaCidade ? 0 : (centro && coords ? haversineKm(centro, coords) : null);

    let dentro;
    switch (modo) {
      case REGION_MODE.CIDADE: dentro = mesmaCidade; break;
      case REGION_MODE.RAIO: dentro = mesmaCidade || (distancia != null && distancia <= region.raioKm); break;
      case REGION_MODE.ESTADO: dentro = Boolean(uf) && uf === centroUf; break;
      default: dentro = true;
    }
    const resultado = Object.freeze({ dentro, km: distancia, conhecido: Boolean(cidade || uf) });
    memoria.set(chave, resultado);
    return resultado;
  };
}

/**
 * Separa uma lista em DENTRO e FORA da região, preservando a ordem de cada
 * lado. Item sem lugar conhecido fica FORA (salvo em "todo lugar").
 *
 * @template T
 * @param {T[]} itens
 * @param {(item: T) => ({ city?: string, state?: string }|Array<{ city?: string, state?: string }>)} lugarDe
 *   um lugar, ou vários (o professor atende em mais de uma cidade: basta um dentro)
 * @param {ReturnType<typeof regionMatcher>} juiz
 * @returns {{ dentro: T[], fora: T[] }}
 */
export function splitByRegion(itens, lugarDe, juiz) {
  const dentro = [];
  const fora = [];
  (itens || []).forEach((item) => {
    (placeInfo(item, lugarDe, juiz).dentro ? dentro : fora).push(item);
  });
  return { dentro, fora };
}

/**
 * O veredito de um item que pode ter VÁRIOS lugares: dentro se algum estiver
 * dentro; a distância é a menor.
 */
export function placeInfo(item, lugarDe, juiz) {
  const lugares = [].concat(lugarDe(item) || []).filter(Boolean);
  if (lugares.length === 0) return { dentro: juiz({}).dentro, km: null, conhecido: false };
  let melhor = null;
  lugares.forEach((l) => {
    const r = juiz(l);
    if (!melhor
      || (r.dentro && !melhor.dentro)
      || (r.dentro === melhor.dentro && (r.km ?? Infinity) < (melhor.km ?? Infinity))) melhor = r;
  });
  return melhor;
}

/** Comparador: mais perto primeiro; distância desconhecida por último. */
export function byDistance(lugarDe, juiz) {
  return (a, b) => (placeInfo(a, lugarDe, juiz).km ?? Infinity) - (placeInfo(b, lugarDe, juiz).km ?? Infinity);
}
