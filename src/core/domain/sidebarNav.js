/**
 * A BARRA LATERAL configurável: quais hubs aparecem no 1º nível do menu, e
 * em que ordem. Puro: recebe o que se sabe da pessoa e devolve a lista.
 *
 * Três padrões, um por papel (atleta, arena, professor), escolhidos sozinhos
 * pelo que a pessoa É e editáveis item a item. A escolha mora no navegador,
 * por usuário (`core/lib/sidebarNavPreference.js`) — zero banco.
 *
 * O que não muda com a escolha:
 *  - **Início** e **Minha área** são fixos — é na Minha área que mora a porta
 *    da arena, do painel do professor e das configurações (inclusive esta).
 *    Sem ela a pessoa esconderia o caminho de volta;
 *  - **Admin** é fixo para quem administra a plataforma;
 *  - um item escondido continua alcançável: pela Minha área, pela busca
 *    (Ctrl/⌘+K, que indexa TODOS os hubs) e pelas rotas de sempre.
 */

export const SIDEBAR_ITEM = Object.freeze({
  INICIO: 'inicio',
  JOGAR: 'jogar',
  COMPETIR: 'competir',
  COMUNIDADE: 'comunidade',
  ARENAS: 'arenas',
  AULAS: 'ensino',
  PERFIL: 'perfil',
  PARCEIROS: 'parceiros',
  MINHA_ARENA: 'minha-arena',
  PROFESSOR: 'professor',
  ADMIN: 'admin',
});

const I = SIDEBAR_ITEM;

/**
 * `requer`: o papel de que o item depende (`arenas`, `professor`, `admin`).
 * `fixo`: não sai da barra. Os rótulos são os do menu (o da arena é o nome dela).
 */
export const SIDEBAR_ITEM_META = Object.freeze({
  [I.INICIO]: { label: 'Início', description: 'O que pede ação hoje.', fixo: true },
  [I.JOGAR]: { label: 'Jogar', description: 'Dia de jogo, vagas e pessoas do seu nível.' },
  [I.COMPETIR]: { label: 'Competir', description: 'Torneios, circuitos e rankings.' },
  [I.COMUNIDADE]: { label: 'Comunidade', description: 'Atletas, clubes, novidades e mensagens.' },
  [I.ARENAS]: { label: 'Arenas', description: 'Reservar quadra e as suas reservas.' },
  [I.AULAS]: { label: 'Aulas', description: 'Professores e as aulas que você faz.' },
  [I.PERFIL]: { label: 'Minha área', description: 'Tudo o que é seu, inclusive o que você gere.', fixo: true },
  [I.PARCEIROS]: { label: 'Parceiros', description: 'Os parceiros da plataforma.' },
  [I.MINHA_ARENA]: { label: 'Minha arena', description: 'A Central da arena que você gere, com as pendências.', requer: 'arenas' },
  [I.PROFESSOR]: { label: 'Painel do professor', description: 'Agenda, alunos, clínicas e horários.', requer: 'professor' },
  [I.ADMIN]: { label: 'Admin', description: 'O painel da plataforma.', requer: 'admin', fixo: true },
});

export const ALL_SIDEBAR_ITEMS = Object.freeze(Object.keys(SIDEBAR_ITEM_META));
const CONHECIDOS = new Set(ALL_SIDEBAR_ITEMS);

export const SIDEBAR_PRESET = Object.freeze({ ATLETA: 'atleta', ARENA: 'arena', PROFESSOR: 'professor' });

export const SIDEBAR_PRESET_META = Object.freeze({
  [SIDEBAR_PRESET.ATLETA]: { label: 'Atleta', description: 'Jogar, competir, reservar e a comunidade.' },
  [SIDEBAR_PRESET.ARENA]: { label: 'Arena', description: 'A Central da sua arena logo depois do Início.', requer: 'arenas' },
  [SIDEBAR_PRESET.PROFESSOR]: { label: 'Professor', description: 'O Painel do professor logo depois do Início.', requer: 'professor' },
});

/** Os itens de cada padrão, na ordem. Admin entra sozinho para quem é (fixo). */
export const SIDEBAR_PRESET_ITEMS = Object.freeze({
  [SIDEBAR_PRESET.ATLETA]: Object.freeze([I.INICIO, I.JOGAR, I.COMPETIR, I.ARENAS, I.COMUNIDADE, I.AULAS, I.PERFIL]),
  [SIDEBAR_PRESET.ARENA]: Object.freeze([I.INICIO, I.MINHA_ARENA, I.ARENAS, I.JOGAR, I.COMPETIR, I.PERFIL]),
  [SIDEBAR_PRESET.PROFESSOR]: Object.freeze([I.INICIO, I.PROFESSOR, I.AULAS, I.JOGAR, I.COMPETIR, I.PERFIL]),
});

/** @typedef {{ arenas?: boolean, professor?: boolean, admin?: boolean }} Papeis */

/** O item pode aparecer para esta pessoa? */
export function sidebarItemAvailable(id, papeis = {}) {
  const meta = SIDEBAR_ITEM_META[id];
  if (!meta) return false;
  return !meta.requer || Boolean(papeis[meta.requer]);
}

/** O padrão pode ser escolhido por esta pessoa? */
export function sidebarPresetAvailable(preset, papeis = {}) {
  const meta = SIDEBAR_PRESET_META[preset];
  if (!meta) return false;
  return !meta.requer || Boolean(papeis[meta.requer]);
}

/** O padrão de quem nunca escolheu: arena > professor > atleta (a arena tem gente esperando resposta). */
export function defaultSidebarPreset(papeis = {}) {
  if (papeis.arenas) return SIDEBAR_PRESET.ARENA;
  if (papeis.professor) return SIDEBAR_PRESET.PROFESSOR;
  return SIDEBAR_PRESET.ATLETA;
}

/** Qualquer lista vira uma escolha válida: só itens conhecidos, sem repetir, na ordem. */
export function normalizeSidebarItems(lista) {
  if (!Array.isArray(lista)) return [];
  const vistos = new Set();
  const saida = [];
  lista.forEach((id) => {
    if (typeof id !== 'string' || !CONHECIDOS.has(id) || vistos.has(id)) return;
    vistos.add(id);
    saida.push(id);
  });
  return saida;
}

/**
 * O que a barra MOSTRA: os escolhidos disponíveis para a pessoa, com os fixos
 * garantidos — Início sempre em primeiro; Minha área e Admin no fim, se a
 * lista guardada não os tiver (uma escolha antiga, ou um papel que chegou depois).
 * @param {string[]} escolhidos
 * @param {Papeis} papeis
 */
export function visibleSidebarItems(escolhidos, papeis = {}) {
  const base = normalizeSidebarItems(escolhidos).filter((id) => sidebarItemAvailable(id, papeis));
  const semInicio = base.filter((id) => id !== I.INICIO);
  const fixosQueFaltam = ALL_SIDEBAR_ITEMS.filter((id) => (
    SIDEBAR_ITEM_META[id].fixo && id !== I.INICIO && !semInicio.includes(id) && sidebarItemAvailable(id, papeis)
  ));
  return [I.INICIO, ...semInicio, ...fixosQueFaltam];
}

/**
 * A escolha em vigor: a salva (`{ preset, items }`) ou o padrão do papel.
 * @param {{ preset?: string, items?: string[] }|null|undefined} salvo `null` = nunca escolheu
 * @param {Papeis} papeis
 * @returns {{ preset: string, items: string[] }}
 */
export function chosenSidebar(salvo, papeis = {}) {
  if (salvo && Array.isArray(salvo.items)) {
    const preset = SIDEBAR_PRESET_META[salvo.preset] ? salvo.preset : defaultSidebarPreset(papeis);
    return { preset, items: visibleSidebarItems(salvo.items, papeis) };
  }
  const preset = defaultSidebarPreset(papeis);
  return { preset, items: visibleSidebarItems(SIDEBAR_PRESET_ITEMS[preset], papeis) };
}

/** A lista é exatamente a do padrão (mesmos itens, mesma ordem) para esta pessoa? */
export function isPresetSidebar(lista, preset, papeis = {}) {
  const alvo = visibleSidebarItems(SIDEBAR_PRESET_ITEMS[preset] || [], papeis);
  const l = visibleSidebarItems(lista, papeis);
  return l.length === alvo.length && l.every((id, i) => id === alvo[i]);
}

/** Liga (no fim, antes dos fixos do fim) ou desliga um item. Fixo não sai. */
export function toggleSidebarItem(lista, id, papeis = {}) {
  const atual = visibleSidebarItems(lista, papeis);
  if (!CONHECIDOS.has(id)) return atual;
  if (atual.includes(id)) {
    if (SIDEBAR_ITEM_META[id].fixo) return atual;
    return atual.filter((x) => x !== id);
  }
  // Entra antes de Minha área/Admin, que fecham a barra.
  const corte = atual.findIndex((x) => x === I.PERFIL || x === I.ADMIN);
  const saida = [...atual];
  saida.splice(corte < 0 ? saida.length : corte, 0, id);
  return visibleSidebarItems(saida, papeis);
}

/** Move um item uma posição. Início não se move e ninguém passa à frente dele. */
export function moveSidebarItem(lista, id, passo, papeis = {}) {
  const atual = visibleSidebarItems(lista, papeis);
  const de = atual.indexOf(id);
  const para = de + Math.trunc(passo);
  if (id === I.INICIO || de < 0 || para < 1 || para >= atual.length || para === de) return atual;
  const saida = [...atual];
  saida.splice(de, 1);
  saida.splice(para, 0, id);
  return saida;
}

/** Os itens disponíveis que NÃO estão na barra, na ordem do catálogo. */
export function hiddenSidebarItems(lista, papeis = {}) {
  const ligados = new Set(visibleSidebarItems(lista, papeis));
  return ALL_SIDEBAR_ITEMS.filter((id) => !ligados.has(id) && sidebarItemAvailable(id, papeis));
}
