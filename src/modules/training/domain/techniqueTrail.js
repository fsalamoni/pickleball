/**
 * A TRILHA DOS GOLPES: os fundamentos do pickleball numa ordem de aprender,
 * em famílias (base, saque, fundo, transição, cozinha, rede, avançados), e o
 * quanto a pessoa já domina de cada uma.
 *
 * A ordem é da biblioteca da plataforma (`seed_slug`): o que vem antes é o
 * que o golpe seguinte usa. Fundamento escrito por professor ou atleta entra
 * na família pela habilidade principal, depois dos da plataforma.
 *
 * Também daqui: os drills que treinam um golpe (`relatedDrills`) — a ponte
 * entre aprender o gesto e repeti-lo na quadra.
 */

import { ITEM_KIND, skillArea } from './taxonomy.js';
import { MASTERY } from './evolution.js';

export const TRAIL_FAMILIES = Object.freeze([
  {
    id: 'base',
    title: 'Base do jogo',
    description: 'Empunhadura, prontidão e como se mover: o que todo golpe usa.',
    slugs: ['empunhadura-continental', 'empunhaduras-eastern-e-western', 'posicao-de-prontidao', 'olhar-na-bola', 'split-step', 'deslocamento-lateral', 'avancar-e-recuar'],
  },
  {
    id: 'saque',
    title: 'Saque e devolução',
    description: 'Os dois primeiros golpes do ponto: dentro, fundo e com calma.',
    slugs: ['saque', 'saque-drop', 'saque-com-efeito', 'devolucao-de-saque'],
  },
  {
    id: 'fundo',
    title: 'Golpes de fundo',
    description: 'Drive de direita e de esquerda, efeito, lob e passada.',
    slugs: ['drive', 'drive-de-backhand', 'topspin', 'slice', 'lob', 'passada'],
  },
  {
    id: 'transicao',
    title: 'Transição',
    description: 'Do fundo para a rede: o drop, o reset e o meio-voleio.',
    slugs: ['drop-da-terceira-bola', 'reset', 'meio-voleio'],
  },
  {
    id: 'cozinha',
    title: 'Na cozinha',
    description: 'Os dinks: bola baixa, paciência e efeito.',
    slugs: ['dink', 'dink-de-backhand', 'dink-com-efeito', 'dink-voleio'],
  },
  {
    id: 'rede',
    title: 'Na rede',
    description: 'Voleios, bloqueios, acelerações e defesas rápidas.',
    slugs: ['voleio', 'voleio-punch', 'bloqueio', 'defesa-de-corpo', 'speed-up', 'contra-ataque', 'flick-de-backhand'],
  },
  {
    id: 'avancados',
    title: 'Jogadas avançadas',
    description: 'O smash da bola alta e as jogadas pela lateral: Erne e ATP.',
    slugs: ['smash', 'erne', 'atp-por-fora-do-poste'],
  },
]);

const FAMILY_BY_SLUG = new Map(TRAIL_FAMILIES.flatMap((f) => f.slugs.map((s, i) => [s, { family: f.id, order: i }])));

/** Família do fundamento que não é da plataforma, pela habilidade principal. */
function familyBySkill(skills = []) {
  for (const s of skills) {
    if (s === 'groundstrokes.terceira_bola_drop' || s === 'groundstrokes.transicao' || s === 'net.reset' || s === 'net.meio_voleio') return 'transicao';
    if (s === 'net.smash' || s === 'net.erne' || s === 'net.atp') return 'avancados';
    const area = skillArea(s);
    if (area === 'serve') return 'saque';
    if (area === 'groundstrokes') return 'fundo';
    if (area === 'kitchen') return 'cozinha';
    if (area === 'net') return 'rede';
    if (area === 'physical') return 'base';
  }
  return null;
}

/**
 * Em que família da trilha o item entra (ou `null`, se não é da trilha).
 * Da plataforma: pela lista. Os outros: só fundamento, pela habilidade.
 */
export function trailFamilyOf(item = {}) {
  const daLista = item.seed_slug && FAMILY_BY_SLUG.get(item.seed_slug);
  if (daLista) return daLista.family;
  if (item.kind !== ITEM_KIND.FUNDAMENTO || item.legacy) return null;
  return familyBySkill(item.skills || []);
}

const ordemNaFamilia = (item) => {
  const daLista = item.seed_slug && FAMILY_BY_SLUG.get(item.seed_slug);
  return daLista ? daLista.order : Number.MAX_SAFE_INTEGER;
};

const masteryOf = (mastery, id) => (Object.values(MASTERY).includes(mastery?.[id]) ? mastery[id] : null);

/**
 * A trilha montada com os itens que a pessoa vê, família por família, e o
 * domínio de cada golpe. `next` é o golpe para continuar: o primeiro que
 * está "aprendendo" e, sem nenhum, o primeiro ainda não marcado.
 *
 * @param {object[]} items itens visíveis
 * @param {Record<string,string>} [mastery] `training_meta.mastery`
 * @returns {{ families: Array<{ id: string, title: string, description: string,
 *   items: Array<{ item: object, mastery: string|null }>, counts: object }>,
 *   counts: object, next: object|null }}
 */
export function buildTechniqueTrail(items = [], mastery = {}) {
  const porFamilia = new Map(TRAIL_FAMILIES.map((f) => [f.id, []]));
  for (const it of items) {
    if (!it?.id) continue;
    const fam = trailFamilyOf(it);
    if (fam) porFamilia.get(fam).push(it);
  }
  const vazio = () => ({ total: 0, dominado: 0, consistente: 0, aprendendo: 0, novo: 0 });
  const geral = vazio();
  const families = TRAIL_FAMILIES.map((f) => {
    const lista = porFamilia.get(f.id)
      .sort((a, b) => ordemNaFamilia(a) - ordemNaFamilia(b) || String(a.title).localeCompare(String(b.title), 'pt-BR'))
      .map((item) => ({ item, mastery: masteryOf(mastery, item.id) }));
    const counts = vazio();
    for (const { mastery: m } of lista) {
      counts.total += 1;
      counts[m || 'novo'] += 1;
    }
    for (const k of Object.keys(geral)) geral[k] += counts[k];
    return { id: f.id, title: f.title, description: f.description, items: lista, counts };
  }).filter((f) => f.items.length > 0);

  const todos = families.flatMap((f) => f.items);
  const next = (todos.find((x) => x.mastery === MASTERY.APRENDENDO) || todos.find((x) => !x.mastery))?.item || null;
  return { families, counts: geral, next };
}

/**
 * Onde o item está na trilha: a família, a posição e os vizinhos (anterior e
 * próximo, dentro da família). `null` se o item não é da trilha.
 */
export function trailPosition(item, items = []) {
  if (!item) return null;
  const fam = trailFamilyOf(item);
  if (!fam) return null;
  const { families } = buildTechniqueTrail(items.some((x) => x.id === item.id) ? items : [...items, item]);
  const f = families.find((x) => x.id === fam);
  const i = f.items.findIndex((x) => x.item.id === item.id);
  return {
    family: { id: f.id, title: f.title },
    index: i + 1,
    total: f.items.length,
    prev: f.items[i - 1]?.item || null,
    next: f.items[i + 1]?.item || null,
  };
}

/**
 * Os drills que treinam este golpe: os que dividem habilidade com ele, os de
 * mais habilidades em comum primeiro, depois os destaques e os do nível mais
 * próximo. Habilidade "área" (sem sub-habilidade) não liga nada sozinha —
 * ligaria metade da biblioteca.
 */
export function relatedDrills(item, items = [], { limit = 4 } = {}) {
  const minhas = (item?.skills || []).filter((s) => s.includes('.'));
  if (!minhas.length) return [];
  const nivel = Number.isFinite(item.level_min) ? item.level_min : null;
  return items
    .filter((it) => it.id !== item.id && it.kind === ITEM_KIND.DRILL && !it.legacy)
    .map((it) => ({ it, comum: (it.skills || []).filter((s) => minhas.includes(s)).length }))
    .filter((x) => x.comum > 0)
    .sort((a, b) => b.comum - a.comum
      || (!!b.it.featured - !!a.it.featured)
      || (nivel === null ? 0 : Math.abs((a.it.level_min ?? nivel) - nivel) - Math.abs((b.it.level_min ?? nivel) - nivel))
      || String(a.it.title).localeCompare(String(b.it.title), 'pt-BR'))
    .slice(0, limit)
    .map((x) => x.it);
}
