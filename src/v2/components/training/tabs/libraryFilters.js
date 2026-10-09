/**
 * Filtros da Biblioteca do treino, lidos e escritos na URL (`?q=&tipo=…`),
 * para recarregar, voltar e mandar o link sem perder a busca.
 *
 * Puro: a aba só traduz a URL para o filtro de `filterItems` e escolhe a
 * fonte pela ORIGEM. "Do meu nível" usa o nível da pessoa na régua única;
 * nível desconhecido nunca esconde item (é a regra de `fitsLevel`).
 */
import { ITEM_KINDS, PLACES, isValidSkill } from '@/modules/training/domain/taxonomy';

/** Origens: as três de autoria + dois recortes da pessoa. */
export const ORIGINS = Object.freeze([
  { value: 'plataforma', label: 'Equipe PickleRush' },
  { value: 'professor', label: 'Professores' },
  { value: 'atleta', label: 'Atletas' },
  { value: 'meus_professores', label: 'Dos meus professores' },
  { value: 'salvos', label: 'Salvos' },
]);

export const MAX_MINUTES = Object.freeze([10, 20, 30, 45, 60]);

const num = (v) => {
  const n = Number(v);
  return v !== null && v !== '' && Number.isFinite(n) ? n : null;
};

/**
 * URL → estado dos filtros (valores inválidos viram "sem filtro").
 * @param {URLSearchParams} params
 */
export function readLibraryFilters(params) {
  const get = (k) => params?.get(k) || '';
  const tipo = get('tipo');
  const habilidade = get('habilidade');
  const local = get('local');
  const origem = get('origem');
  const jogadores = num(get('jogadores'));
  const tempo = num(get('tempo'));
  return {
    q: get('q').slice(0, 80),
    tipo: ITEM_KINDS.includes(tipo) ? tipo : '',
    habilidade: isValidSkill(habilidade) ? habilidade : '',
    nivel: get('nivel') === 'meu',
    jogadores: jogadores && jogadores >= 1 && jogadores <= 8 ? Math.round(jogadores) : null,
    local: PLACES.includes(local) ? local : '',
    tempo: MAX_MINUTES.includes(tempo) ? tempo : null,
    origem: ORIGINS.some((o) => o.value === origem) ? origem : '',
  };
}

/** Estado → extras para `irPara('biblioteca', extras)` (vazios somem da URL). */
export function libraryFiltersToParams(f) {
  return {
    q: f.q || '',
    tipo: f.tipo || '',
    habilidade: f.habilidade || '',
    nivel: f.nivel ? 'meu' : '',
    jogadores: f.jogadores || '',
    local: f.local || '',
    tempo: f.tempo || '',
    origem: f.origem || '',
  };
}

/** Quantos filtros estão ligados (o texto conta). */
export function activeFilterCount(f) {
  return ['q', 'tipo', 'habilidade', 'nivel', 'jogadores', 'local', 'tempo', 'origem'].filter((k) => !!f[k]).length;
}

/**
 * Aplica a origem e devolve o filtro de `filterItems`.
 * @param {object[]} pub   itens públicos
 * @param {object[]} coach itens dos meus professores
 * @param {{ favorites?: string[], level?: number|null }} ctx
 */
export function libraryPool(f, { pub = [], coach = [], favorites = [] } = {}) {
  if (f.origem === 'meus_professores') return coach;
  const byId = new Map();
  for (const it of [...pub, ...coach]) byId.set(it.id, it);
  const todos = [...byId.values()];
  if (f.origem === 'salvos') {
    const fav = new Set(favorites);
    return todos.filter((it) => fav.has(it.id));
  }
  return todos;
}

export function toFilterItems(f, { level = null } = {}) {
  const autoria = ['plataforma', 'professor', 'atleta'].includes(f.origem) ? f.origem : '';
  return {
    text: f.q,
    kind: f.tipo,
    skill: f.habilidade,
    level: f.nivel && Number.isFinite(level) ? level : null,
    players: f.jogadores,
    place: f.local,
    maxMinutes: f.tempo,
    origin: autoria,
  };
}
