/**
 * O rosto público da federação (`/federacoes/:id` e `/f/:slug`): quais abas
 * existem e qual abre. Puro — a tela (`FederationProfile`) só desenha.
 *
 * Uma aba só existe com o módulo ligado (ou o conteúdo preenchido, no caso da
 * transparência), para nunca abrir uma aba vazia. "Minha filiação" é da
 * PESSOA, não do público: só aparece no app, para quem tem filiação ali, e
 * nunca na prévia "ver como visitante".
 *
 * Os links antigos continuam valendo: os avisos levam a `#fed-cursos` (ou
 * `?ancora=fed-cursos`), a notícia a `?noticia=<id>`, o comentário a
 * `#fed-ouvidoria` — `resolveProfileTab` acha a aba que contém a seção.
 */
import { tk } from '@/core/i18n';
import { fedModuleOn } from './federation';
import { hasGovernance } from './governance';

/** Celular brasileiro (DDD + 9 dígitos, com ou sem 55) vira link do WhatsApp; fixo e número estranho não. */
export function whatsappLink(phone) {
  let d = String(phone || '').replace(/\D/g, '');
  if (d.length === 13 && d.startsWith('55')) d = d.slice(2);
  return d.length === 11 && d[2] === '9' ? `https://wa.me/55${d}` : null;
}

export const PROFILE_TAB = Object.freeze({
  OVERVIEW: 'inicio',
  MINE: 'minha',
  NEWS: 'noticias',
  AGENDA: 'agenda',
  COMPETITIONS: 'competicoes',
  DOCUMENTS: 'documentos',
  COURSES: 'cursos',
  CLUBS: 'clubes',
  CONTACT: 'contato',
  ELECTIONS: 'eleicoes',
});

/** A seção (id do título, `fed-*`) → a aba onde ela mora. */
const ANCHOR_TAB = Object.freeze({
  'fed-planos': PROFILE_TAB.OVERVIEW,
  'fed-sobre': PROFILE_TAB.OVERVIEW,
  'fed-promocoes': PROFILE_TAB.OVERVIEW,
  'fed-patrocinadores': PROFILE_TAB.OVERVIEW,
  'fed-noticias': PROFILE_TAB.NEWS,
  'federacao-noticias': PROFILE_TAB.NEWS,
  'fed-agenda': PROFILE_TAB.AGENDA,
  'fed-torneios': PROFILE_TAB.COMPETITIONS,
  'fed-ranking': PROFILE_TAB.COMPETITIONS,
  'fed-arbitragem': PROFILE_TAB.COMPETITIONS,
  'fed-acervo': PROFILE_TAB.DOCUMENTS,
  'fed-governanca': PROFILE_TAB.DOCUMENTS,
  'fed-contas': PROFILE_TAB.DOCUMENTS,
  'fed-cursos': PROFILE_TAB.COURSES,
  'fed-credenciados': PROFILE_TAB.COURSES,
  'fed-filiados-orgs': PROFILE_TAB.CLUBS,
  'fed-ouvidoria': PROFILE_TAB.CONTACT,
  'fed-contato': PROFILE_TAB.CONTACT,
  'fed-eleicoes': PROFILE_TAB.ELECTIONS,
  'fed-minha-filiacao': PROFILE_TAB.MINE,
});

/** A aba de uma âncora (`#fed-cursos`, com ou sem o `#`), ou null. */
export function tabForAnchor(anchor) {
  const id = String(anchor || '').replace(/^#/, '');
  return ANCHOR_TAB[id] || null;
}

/**
 * As abas da página, na ordem.
 * @param {object} federation
 * @param {{ member?: boolean }} [opts] member: a pessoa tem filiação ali (e não é prévia)
 * @returns {Array<{ id: string, dica: string, label: string }>} `dica` é a âncora das dicas guiadas (contrato: nunca renomeie)
 */
export function profileTabs(federation, { member = false } = {}) {
  if (!federation) return [];
  const on = (m) => fedModuleOn(federation, m);
  return [
    { id: PROFILE_TAB.OVERVIEW, dica: 'federacao-pub-inicio', label: tk('Visão geral') },
    member && { id: PROFILE_TAB.MINE, dica: 'federacao-pub-minha', label: tk('Minha filiação') },
    on('news') && { id: PROFILE_TAB.NEWS, dica: 'federacao-pub-noticias', label: tk('Notícias') },
    on('calendar') && { id: PROFILE_TAB.AGENDA, dica: 'federacao-pub-agenda', label: tk('Agenda') },
    (on('tournaments') || on('ranking') || on('referees')) && { id: PROFILE_TAB.COMPETITIONS, dica: 'federacao-pub-competicoes', label: tk('Competições') },
    (on('official_docs') || on('accounts') || hasGovernance(federation.governance)) && { id: PROFILE_TAB.DOCUMENTS, dica: 'federacao-pub-documentos', label: tk('Documentos') },
    on('elections') && { id: PROFILE_TAB.ELECTIONS, dica: 'federacao-pub-eleicoes', label: tk('Eleições') },
    on('courses') && { id: PROFILE_TAB.COURSES, dica: 'federacao-pub-cursos', label: tk('Cursos') },
    on('affiliations') && { id: PROFILE_TAB.CLUBS, dica: 'federacao-pub-clubes', label: tk('Clubes e arenas') },
    { id: PROFILE_TAB.CONTACT, dica: 'federacao-pub-contato', label: on('discipline') ? tk('Contato e ouvidoria') : tk('Contato') },
  ].filter(Boolean);
}

/**
 * A aba aberta: a pedida na URL (`?aba=`), senão a da notícia (`?noticia=`)
 * ou da âncora (`#fed-…`), senão a visão geral. Aba que não existe (módulo
 * desligado, link velho) cai na visão geral, nunca numa tela em branco.
 */
export function resolveProfileTab(tabs, { aba = '', hash = '', noticia = '' } = {}) {
  const existe = (id) => Boolean(id) && tabs.some((x) => x.id === id);
  if (existe(aba)) return aba;
  if (noticia && existe(PROFILE_TAB.NEWS)) return PROFILE_TAB.NEWS;
  const daAncora = tabForAnchor(hash);
  if (existe(daAncora)) return daAncora;
  return PROFILE_TAB.OVERVIEW;
}
