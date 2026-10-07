/**
 * O que ESTE dia de jogo é, em linguagem de quadra (lógica pura).
 *
 * ## Por que este arquivo existe
 *
 * Quem abria um dia de jogo via o título, o selo da origem, a data e as
 * observações — e mais nada. **Nem o formato.** Só que o formato decide tudo o
 * que importa para quem vai jogar: se há placar, se há ranking do dia, se o
 * resultado pode ir para o ranking da plataforma, se dá para vincular uma
 * dupla, se as partidas saem em rodadas ou quadra a quadra.
 *
 * Pior: a LISTA da arena já mostrava o formato num selo, e a tela do dia não.
 * A lista dizia mais que o detalhe.
 *
 * Mesma ideia do `describePhaseRules` do torneio (Onda AU), e pelo mesmo
 * motivo: configuração que não aparece onde se joga é configuração que ninguém
 * confere.
 *
 * ## O contrato
 *
 * Cada linha traz `label`, `value` e `help`. Linha que não se aplica **some**
 * em vez de virar "—": vagas só existem em dia de jogo de arena, "quem
 * organiza" só interessa a quem pode organizar.
 */

import {
  GAME_DAY_FORMAT,
  GAME_DAY_FORMAT_LABELS,
  isPlayFormat,
  isAmericanoLiveFormat,
  isCourtByCourtFormat,
  formatHasScores,
} from '@/modules/clubs/domain/gameDayFormats';
import {
  GAME_DAY_MANAGE_MODE,
  GAME_DAY_MANAGE_MODE_LABELS,
  gameDayManageMode,
  gameDayAdminUids,
} from './gameDayRoles.js';
import { isPublicGameDay } from './gameDay.js';
import { isArenaGameDay } from './arenaGameDay.js';
import { isClubGameDay } from './clubGameDay.js';
import { GROUP_POLICY_LABELS, GROUP_POLICY_HINTS } from './playGroups.js';

/** Quantos nomes de grupo cabem na linha antes de virar "+N". */
const NOMES_DE_GRUPO_NA_LINHA = 4;

/**
 * O formato respeita DUPLA VINCULADA?
 *
 * Mexicano e Rei da Quadra montam as duplas pela classificação da rodada e
 * pelo resultado da anterior — é o que DEFINE os dois formatos. Prender uma
 * dupla ali seria deixar de ser Mexicano. Por isso a tela avisa em vez de
 * ignorar o vínculo em silêncio (é o que fazia a pessoa achar que o sistema
 * errou). Ver `docs/25-DIA-DE-JOGO-COMO-MODULO.md` §4.
 */
export function formatHonorsFixedPairs(format) {
  return format !== GAME_DAY_FORMAT.MEXICANO && format !== GAME_DAY_FORMAT.KING_OF_COURT;
}

/** Uma frase dizendo como as partidas saem neste formato. */
export function formatRhythm(format) {
  if (isPlayFormat(format)) {
    return 'Quadra a quadra, por ordem de chegada. Sem placar.';
  }
  if (isAmericanoLiveFormat(format)) {
    return 'Quadra a quadra, uma partida por vez, com placar e ranking do dia.';
  }
  if (format === GAME_DAY_FORMAT.MEXICANO) {
    return 'Rodadas sorteadas, com as duplas saindo da classificação da rodada anterior.';
  }
  if (format === GAME_DAY_FORMAT.KING_OF_COURT) {
    return 'Rodadas em que quem vence sobe de quadra e quem perde desce.';
  }
  return 'Rodadas sorteadas de uma vez, com placar e ranking do dia.';
}

/**
 * Traduz o dia de jogo nas linhas que a tela mostra.
 *
 * @param {object} gameDay
 * @param {{ podeGerenciar?: boolean, participantCount?: number,
 *           playGroups?: {groups: Array, policy: string}|null }} [ctx]
 *   `playGroups` só vem quando os grupos valem NESTE dia (flag ligada, Play e ao
 *   menos um grupo): quem decide é a tela, com `isPlayGroupsActive`. Sem ele a
 *   linha de grupos não existe — dia sem grupo e flag desligada são o mesmo.
 * @returns {{ rows: Array<{key:string,label:string,value:string,help:string}> }}
 */
export function describeGameDayRules(gameDay, ctx = {}) {
  if (!gameDay) return { rows: [] };
  const format = gameDay.format || GAME_DAY_FORMAT.AMERICANO;
  const rows = [];
  const add = (key, label, value, help) => rows.push({ key, label, value, help });

  // --------------------------------------------------------------- formato
  add(
    'formato',
    'Formato',
    GAME_DAY_FORMAT_LABELS[format] || format,
    formatRhythm(format),
  );

  // ---------------------------------------------------------------- placar
  const temPlacar = formatHasScores(format);
  add(
    'placar',
    'Placar',
    temPlacar ? 'Sim — com ranking do dia' : 'Não — só as partidas',
    temPlacar
      ? 'Cada partida tem resultado lançado, e o ranking do dia se atualiza a cada placar.'
      : 'O Play organiza quem joga com quem e não guarda resultado. Por isso ele não alimenta ranking nenhum — nem o do dia, nem o da plataforma.',
  );

  // ------------------------------------------------------ ranking da casa
  if (temPlacar) {
    const publicado = Boolean(gameDay.publish_to_ranking);
    add(
      'ranking',
      'Ranking da plataforma',
      publicado ? 'Publicado' : 'Só depois de publicado',
      publicado
        ? 'Os resultados deste dia já foram enviados ao ranking e ao rating da plataforma.'
        : 'Diferente do torneio, aqui lançar o placar não basta: mandar para o ranking da plataforma é uma DECISÃO de quem organiza, num botão à parte.',
    );
  }

  // ---------------------------------------------------------- dupla fixa
  const honra = formatHonorsFixedPairs(format);
  const grupos = isPlayFormat(format) && ctx.playGroups?.groups?.length > 0 ? ctx.playGroups : null;
  add(
    'duplas',
    'Dupla vinculada',
    honra ? 'Vale neste formato' : 'Não vale neste formato',
    honra
      ? 'Dá para prender duas pessoas para jogarem sempre juntas — e nunca uma contra a outra. As demais regras do sorteio continuam valendo para o resto.'
        + (grupos ? ' Com grupos, a dupla só vale se os dois estão no mesmo grupo.' : '')
      :'Aqui as duplas saem da classificação da rodada e do resultado da anterior — é o que define o formato. Prender uma dupla deixaria de ser este jogo.',
  );

  // ------------------------------------------------------------ quadras
  const quadras = Number(gameDay.play_courts) || 0;
  if (isCourtByCourtFormat(format) && quadras > 0) {
    add(
      'quadras',
      'Quadras em uso',
      quadras === 1 ? '1 quadra' : `${quadras} quadras`,
      quadras > 1
        ? 'Com mais de uma quadra livre dá para sortear a RODADA inteira de uma vez, em vez de partida a partida — é o que mistura a fila quando o grupo é pequeno.'
        : 'Com uma quadra só, as partidas saem uma a uma, na ordem da fila.',
    );
  }

  // ------------------------------------------------------------- grupos
  if (grupos) {
    const nomes = grupos.groups.map((g) => g.name);
    const resto = nomes.length - NOMES_DE_GRUPO_NA_LINHA;
    const politica = GROUP_POLICY_LABELS[grupos.policy] ? grupos.policy : 'queue';
    add(
      'grupos',
      'Grupos',
      nomes.slice(0, NOMES_DE_GRUPO_NA_LINHA).join(', ') + (resto > 0 ? ` +${resto}` : ''),
      `Cada grupo tem a sua fila, e as partidas saem dentro dele. ${GROUP_POLICY_LABELS[politica]}: ${GROUP_POLICY_HINTS[politica]}`,
    );
  }

  // -------------------------------------------------------------- vagas
  const cap = Number(gameDay.capacity) || 0;
  if (isArenaGameDay(gameDay) && cap > 0) {
    const inscritos = Number(ctx.participantCount) || 0;
    add(
      'vagas',
      'Vagas',
      `${inscritos} de ${cap}`,
      'Limite de atletas no dia. Cheio, ninguém mais entra sozinho — mas quem organiza ainda pode incluir à mão.',
    );
  }

  // ------------------------------------------------------- quem organiza
  if (ctx.podeGerenciar) {
    const modo = gameDayManageMode(gameDay);
    const nomeados = gameDayAdminUids(gameDay).length;
    const aberto = modo === GAME_DAY_MANAGE_MODE.PARTICIPANTS;
    add(
      'organiza',
      'Quem conduz as partidas',
      GAME_DAY_MANAGE_MODE_LABELS[modo] + (nomeados > 0 ? ` · ${nomeados} nomeado(s)` : ''),
      aberto
        ? 'Todo mundo que está no dia pode sortear, substituir e mexer na lista. Bom quando várias pessoas se revezam organizando.'
        : 'Sortear, substituir, pausar, vincular dupla e mexer na lista ficam com quem criou e com os administradores nomeados.',
    );
  }

  // ------------------------------------------------------- quem enxerga
  if (!isArenaGameDay(gameDay) && !isClubGameDay(gameDay)) {
    const publico = isPublicGameDay(gameDay);
    add(
      'visibilidade',
      'Quem enxerga',
      publico ? 'Qualquer atleta da plataforma' : 'Só quem foi convidado',
      publico
        ? 'O dia aparece como convite em "Procura-se jogo", e qualquer conta pode se inscrever sozinha.'
        : 'Ele não aparece em nenhuma busca: só entra quem você convidar.',
    );
  }

  return { rows };
}
