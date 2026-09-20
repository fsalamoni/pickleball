/**
 * O que vai acontecer quando o organizador clicar em "Gerar próxima fase"
 * (lógica pura, sem I/O).
 *
 * ## Por que este arquivo existe
 *
 * "Gerar próxima fase" é o botão mais irreversível do torneio: ele classifica
 * os grupos, aplica a ordem de desempate configurada, compara quem veio de
 * grupos de tamanhos diferentes, chama os repescados, encaixa quem entra
 * direto e sorteia a fase seguinte — tudo de uma vez, e sem dizer nada antes.
 * Quem organiza clicava no escuro e descobria o resultado pelo que apareceu na
 * tela; se estivesse errado, já estava gravado.
 *
 * Então a tela passa a mostrar ANTES quem passa, quem passa por repescagem e
 * quem entra direto.
 *
 * ## A regra que não pode ser quebrada
 *
 * A prévia e o avanço saem **da mesma fonte**: `previewPhaseAdvance` é chamada
 * pelos dois. É a mesma lição do dia de jogo, onde a previsão de quadra e o
 * sorteio divergiram e a tela anunciava uma partida e criava outra. Um guarda
 * de fonte (`src/core/guards/torneioRegras.test.js`) reprova quem montar a
 * próxima fase por fora daqui.
 *
 * `phaseDrawIssues` também mora aqui: era uma função privada do serviço, e a
 * tela não tinha como saber que o Americano exige 4 por grupo antes de a
 * escrita ser recusada.
 */

import { TOURNAMENT_STAGE_TYPE, TOURNAMENT_STAGE_TYPE_LABELS } from './constants.js';
import { americanoMatchCount } from './draw.js';
import { buildNextPhaseEntrants } from './phaseProgression.js';

/**
 * Confere se cada grupo comporta o formato escolhido.
 *
 * @param {object} phase fase normalizada
 * @param {Array<{ name?: string, entrants?: object[] }>} groups
 * @param {{ isTeam?: boolean }} [options]
 * @returns {string[]} problemas encontrados (vazio = ok)
 */
export function phaseDrawIssues(phase, groups, { isTeam = false } = {}) {
  const issues = [];
  const unidade = isTeam ? 'equipe(s)' : 'atleta(s)';
  (groups || []).forEach((g) => {
    const n = (g.entrants || []).length;
    const name = g.name || 'único';
    if (phase.type === TOURNAMENT_STAGE_TYPE.AMERICANO) {
      if (n < 4) {
        issues.push(`o grupo "${name}" ficaria com ${n} atleta(s), e o Americano exige ao menos 4`);
      } else if (!americanoMatchCount(n).exact) {
        issues.push(
          `o grupo "${name}" ficaria com ${n} atletas, número incompatível com o Americano `
          + '(use 4, 5, 8, 9, 12, 13, 16, 17…)',
        );
      }
    } else if (phase.type === TOURNAMENT_STAGE_TYPE.MEXICANO) {
      if (n < 4) issues.push(`o grupo "${name}" ficaria com ${n} atleta(s), e o Mexicano exige ao menos 4`);
    } else if (n < 2) {
      issues.push(`o grupo "${name}" ficaria com ${n} ${unidade}, e são necessários ao menos 2`);
    }
  });
  return issues;
}

function rotulo(e) {
  return e?.label || e?.name || e?.id || '?';
}

/**
 * Monta a próxima fase e diz, em português, o que ela vai conter.
 *
 * Não escreve nada: quem grava é o serviço, com exatamente este resultado.
 *
 * @param {object} params
 * @param {Array<{ index:number, name:string, ranked:object[], headToHead?:Map }>} params.rankedGroups
 * @param {object} params.prevPhase fase atual, normalizada
 * @param {object} params.nextPhase próxima fase, normalizada
 * @param {string} params.seed semente do sorteio
 * @param {object[]} [params.directEntrants] quem entra direto nesta próxima fase
 * @param {boolean} [params.isTeam]
 * @returns {{
 *   ok: boolean,
 *   blocked: { code: string, message: string } | null,
 *   entrants: object[],
 *   groups: object[],
 *   bracketSeeding: string,
 *   counts: { total:number, qualifiers:number, wildcards:number, directs:number },
 *   names: { qualifiers:string[], wildcards:string[], directs:string[] },
 *   nextLabel: string,
 * }}
 */
export function previewPhaseAdvance(params) {
  const {
    rankedGroups, prevPhase, nextPhase, seed,
    directEntrants = [], isTeam = false,
  } = params;

  const nextLabel = TOURNAMENT_STAGE_TYPE_LABELS[nextPhase?.type] || nextPhase?.type || 'próxima fase';
  const vazio = {
    ok: false,
    entrants: [],
    groups: [],
    bracketSeeding: nextPhase?.bracket_seeding,
    counts: { total: 0, qualifiers: 0, wildcards: 0, directs: 0 },
    names: { qualifiers: [], wildcards: [], directs: [] },
    nextLabel,
  };

  const { groups, entrants, bracketSeeding } = buildNextPhaseEntrants(
    rankedGroups, prevPhase, nextPhase, { seed, directEntrants },
  );

  if (!entrants || entrants.length === 0) {
    return {
      ...vazio,
      blocked: {
        code: 'sem_classificados',
        message: isTeam
          ? 'Nenhuma equipe se classificou para a próxima fase. Revise quantas equipes cada grupo classifica.'
          : 'Nenhum atleta se classificou para a próxima fase. Revise o critério de classificação — '
            + 'em especial "por gênero", que exige o gênero informado em cada inscrição.',
      },
    };
  }

  const diretos = entrants.filter((e) => e._directEntry);
  const repescados = entrants.filter((e) => e._wildcard && !e._directEntry);
  const classificados = entrants.filter((e) => !e._wildcard && !e._directEntry);

  const base = {
    entrants,
    groups,
    bracketSeeding,
    counts: {
      total: entrants.length,
      qualifiers: classificados.length,
      wildcards: repescados.length,
      directs: diretos.length,
    },
    names: {
      qualifiers: classificados.map(rotulo),
      wildcards: repescados.map(rotulo),
      directs: diretos.map(rotulo),
    },
    nextLabel,
  };

  const issues = phaseDrawIssues(nextPhase, groups, { isTeam });
  if (issues.length > 0) {
    return {
      ...base,
      ok: false,
      blocked: {
        code: 'formato_incompativel',
        message: `Não é possível gerar a próxima fase (${nextLabel}): ${issues[0]}. `
          + 'Ajuste os classificados por grupo na fase anterior, o número de grupos desta fase '
          + 'ou escolha outro formato.',
      },
    };
  }

  return { ...base, ok: true, blocked: null };
}

/**
 * Frase curta com a composição da próxima fase, para o cabeçalho da prévia.
 * @param {ReturnType<typeof previewPhaseAdvance>} preview
 * @param {{ isTeam?: boolean }} [options]
 * @returns {string}
 */
export function describePhaseAdvance(preview, { isTeam = false } = {}) {
  if (!preview || preview.counts.total === 0) return 'Ninguém se classificou ainda.';
  const unidade = isTeam ? 'equipe' : 'atleta';
  const plural = preview.counts.total === 1 ? unidade : `${unidade}s`;
  const partes = [`${preview.counts.qualifiers} classificado(s)`];
  if (preview.counts.wildcards > 0) partes.push(`${preview.counts.wildcards} por repescagem`);
  if (preview.counts.directs > 0) partes.push(`${preview.counts.directs} entrando direto`);
  return `${preview.counts.total} ${plural} na ${preview.nextLabel.toLowerCase()}: ${partes.join(', ')}.`;
}
