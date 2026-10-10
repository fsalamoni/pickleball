/**
 * A barra inferior do celular (flag `nav_v3`): cinco itens, e o quarto muda
 * com a pessoa. Puro: recebe o que se sabe dela e devolve a lista.
 *
 * `Início · Jogar · Arenas · [contextual] · Minha área`, onde o contextual é,
 * nesta ordem de prioridade:
 *  1. **Central** — gere arena (vai à arena com mais pendências);
 *  2. **Painel** — dá aula (o painel do professor);
 *  3. **Torneios** — joga ou organiza torneio que ainda vale;
 *  4. **Treino** — abriu o Treino nos últimos 14 dias;
 *  5. **Torneios** — o padrão.
 *
 * Quem gere arena E dá aula vê a Central: a arena tem gente esperando resposta
 * (reserva pedida), a aula não trava ninguém.
 */

export const TREINO_RECENTE_DIAS = 14;
const DIA_MS = 24 * 60 * 60 * 1000;

/** Itens fixos; `icon` é só um nome — a tela escolhe o desenho. */
const INICIO = Object.freeze({ id: 'inicio', to: '/', label: 'Início', icon: 'inicio', exact: true });
const JOGAR = Object.freeze({ id: 'jogar', to: '/dia-de-jogo', label: 'Jogar', icon: 'jogar' });
const ARENAS = Object.freeze({ id: 'arenas', to: '/arenas', label: 'Arenas', icon: 'arenas' });
const MINHA_AREA = Object.freeze({ id: 'minha-area', to: '/perfil', label: 'Minha área', icon: 'minha-area' });
const TORNEIOS = Object.freeze({ id: 'torneios', to: '/torneios', label: 'Torneios', icon: 'torneios' });
const TREINO = Object.freeze({ id: 'treino', to: '/treino', label: 'Treino', icon: 'treino' });
const PAINEL = Object.freeze({ id: 'painel', to: '/aulas', label: 'Painel', icon: 'painel' });

/**
 * @param {{ arenaId?: string|null, pendencias?: number }[]} [arenas] as que a pessoa gere
 * @returns a arena com mais pendências; empate ⇒ a primeira
 */
export function arenaPrincipal(arenas = []) {
  return (arenas || []).filter((a) => a?.id).reduce((melhor, a) => {
    if (!melhor) return a;
    return (a.pendencias || 0) > (melhor.pendencias || 0) ? a : melhor;
  }, null);
}

/**
 * @param {number|null|undefined} ultimoAcessoMs quando a pessoa abriu o Treino pela última vez
 * @param {number} agoraMs
 */
export function treinoRecente(ultimoAcessoMs, agoraMs = Date.now()) {
  if (!Number.isFinite(ultimoAcessoMs) || ultimoAcessoMs <= 0) return false;
  return agoraMs - ultimoAcessoMs <= TREINO_RECENTE_DIAS * DIA_MS;
}

/**
 * @param {{
 *   arenas?: { id: string, pendencias?: number }[],
 *   ehProfessor?: boolean,
 *   temTorneioAtual?: boolean,
 *   treinoUltimoAcessoMs?: number|null,
 *   agoraMs?: number,
 * }} pessoa
 * @returns {Array<{ id: string, to: string, label: string, icon: string, exact?: boolean, badge?: number }>}
 */
export function bottomNavItems(pessoa = {}) {
  const arena = arenaPrincipal(pessoa.arenas);
  let contextual = TORNEIOS;
  if (arena) {
    contextual = {
      id: 'central', to: `/arenas/${arena.id}/gerir`, label: 'Central', icon: 'central',
      badge: arena.pendencias || 0,
    };
  } else if (pessoa.ehProfessor) {
    contextual = PAINEL;
  } else if (pessoa.temTorneioAtual) {
    contextual = TORNEIOS;
  } else if (treinoRecente(pessoa.treinoUltimoAcessoMs, pessoa.agoraMs)) {
    contextual = TREINO;
  }
  return [INICIO, JOGAR, ARENAS, contextual, MINHA_AREA];
}
