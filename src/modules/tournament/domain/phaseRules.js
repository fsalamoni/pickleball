/**
 * O que está EM VIGOR nesta fase, em linguagem de quadra (lógica pura).
 *
 * ## Por que este arquivo existe
 *
 * A Onda AT entregou ao admin do torneio oito controles novos — tamanhos de
 * grupo à mão, turnos, classificados por grupo, repescagem, ordem de
 * desempate, método de comparação entre grupos, entrada direta e cabeças. Só
 * que eles se configuram em **Modalidades** e o torneio se sorteia em
 * **Sorteio**: duas telas. Quem organiza chegava na hora de clicar em
 * "Sortear" ou "Gerar próxima fase" sem NENHUM eco do que tinha configurado —
 * e esses botões fazem uma conta invisível (classificar, repescar, comparar
 * entre grupos, encaixar quem entra direto).
 *
 * Configuração que não aparece onde se age é configuração que ninguém confia:
 * na dúvida, o organizador volta na outra tela para conferir, ou pior, sorteia
 * sem saber e descobre pelo resultado.
 *
 * ## O contrato
 *
 * Cada linha traz `label` (o quê), `value` (como está) e `help` (por quê), e
 * marca `changed` quando difere do padrão da plataforma — é o que deixa a tela
 * destacar exatamente o que aquele organizador mexeu, sem transformar o resumo
 * num paredão de texto igual para todo mundo.
 *
 * Só entram linhas que se APLICAM à fase: repescagem não existe na última
 * fase, entrada direta não existe na primeira, comparação entre grupos não
 * existe com um grupo só. Linha que não se aplica não vira "—": some.
 */

import {
  TOURNAMENT_STAGE_TYPE,
  PHASE_BRACKET_SEEDING,
  PHASE_BRACKET_SEEDING_LABELS,
} from './constants.js';
import { supportsGroups, normalizePhase, BRACKET_FORMATS } from './phases.js';
import { describeTiebreakOrder, DEFAULT_TIEBREAK_ORDER } from './tiebreak.js';
import { CROSS_GROUP_METHOD, CROSS_GROUP_METHOD_LABELS } from './crossGroup.js';
import { DIRECT_ENTRY_MODE, DIRECT_ENTRY_MODE_LABELS, normalizeDirectEntry } from './directEntry.js';

/** Lista "1, 2 e 3" — no Brasil ninguém lê "1, 2, 3" numa frase. */
function listar(valores) {
  const v = valores.map((n) => String(n));
  if (v.length <= 1) return v[0] || '';
  return `${v.slice(0, -1).join(', ')} e ${v[v.length - 1]}`;
}

function ordinal(n) {
  return `${Math.max(1, Math.floor(n))}º`;
}

/**
 * Traduz a configuração de UMA fase nas linhas que a tela mostra.
 *
 * @param {object} rawPhase fase como está gravada (ou já normalizada)
 * @param {{ isFirst?: boolean, isLast?: boolean, groupCount?: number }} [ctx]
 * @returns {{ rows: Array<{key:string,label:string,value:string,help:string,changed:boolean}>, changedCount: number }}
 */
export function describePhaseRules(rawPhase, ctx = {}) {
  const isFirst = ctx.isFirst !== false;
  const isLast = Boolean(ctx.isLast);
  const phase = normalizePhase(rawPhase || {}, { isFirst });
  const agrupada = supportsGroups(phase.type);
  const éChave = BRACKET_FORMATS.has(phase.type);

  // Quantos grupos esta fase terá de fato: o tamanho manual manda.
  const gruposManuais = phase.custom_group_sizes.length;
  const grupos = gruposManuais > 0
    ? gruposManuais
    : Number(ctx.groupCount ?? phase.group_count) || 1;

  const rows = [];
  const add = (key, label, value, help, changed = false) => {
    rows.push({ key, label, value, help, changed });
  };

  // ---------------------------------------------------------------- divisão
  if (agrupada && gruposManuais > 0) {
    add(
      'divisao',
      'Divisão dos grupos',
      `À mão: ${listar(phase.custom_group_sizes)} atleta(s)`,
      'Você fixou o tamanho de cada grupo. Se o número de inscritos mudar, o último grupo cresce ou encolhe para caber todo mundo — ninguém fica de fora.',
      true,
    );
  } else if (agrupada && grupos > 1) {
    add(
      'divisao',
      'Divisão dos grupos',
      `${grupos} grupos, equilibrados automaticamente`,
      'Os inscritos são distribuídos o mais igualmente possível. Grupos de tamanhos diferentes são normais — a comparação entre eles é feita por aproveitamento.',
    );
  }

  // ----------------------------------------------------------------- turnos
  if (agrupada) {
    const volta = phase.round_robin_legs === 2;
    add(
      'turnos',
      'Turnos',
      volta ? 'Ida e volta — cada dupla se enfrenta 2 vezes' : 'Só ida — cada dupla se enfrenta 1 vez',
      volta
        ? 'Cada confronto acontece duas vezes, com os lados invertidos na volta. É a saída para o grupo de 3, que só na ida daria 2 jogos por atleta.'
        : 'O padrão. Num grupo de 3 isso dá apenas 2 jogos por atleta — considere ida e volta.',
      volta,
    );
  }

  // ---------------------------------------------------------- classificados
  if (!isLast) {
    const porGrupo = phase.qualifiers_by_group.filter((n) => n > 0);
    if (porGrupo.length > 0) {
      add(
        'classificados',
        'Quem passa de fase',
        `Grupo a grupo: ${listar(porGrupo)}`,
        'Você definiu um número por grupo. É o que se usa quando os grupos têm tamanhos diferentes: passam 2 do grupo de 5 e 1 do de 3.',
        true,
      );
    } else {
      add(
        'classificados',
        'Quem passa de fase',
        agrupada && grupos > 1
          ? `Os ${phase.qualifiers_per_group} melhores de cada grupo`
          : `Os ${phase.qualifiers_per_group} melhores`,
        'Classificados diretos, antes da repescagem.',
        phase.qualifiers_per_group !== 2,
      );
    }
  }

  // ------------------------------------------------------------- repescagem
  if (!isLast && agrupada && grupos > 1) {
    if (phase.wildcard_slots > 0) {
      const de = phase.wildcard_from_position > 0
        ? ordinal(phase.wildcard_from_position)
        : ordinal(phase.qualifiers_per_group + 1);
      add(
        'repescagem',
        'Repescagem',
        `${phase.wildcard_slots} vaga(s), entre os melhores ${de} colocados`,
        'As vagas extras vão para os melhores da colocação seguinte ao corte, comparados só ENTRE IGUAIS — um 4º nunca entra na frente de um 3º.',
        true,
      );
    } else {
      add(
        'repescagem',
        'Repescagem',
        'Nenhuma — passam só os classificados diretos',
        'Se os classificados não fecharem a chave, a repescagem é o caminho para encher as vagas que sobrarem.',
      );
    }
  }

  // ------------------------------------------------------------- desempate
  if (agrupada) {
    const ordem = describeTiebreakOrder(phase.tiebreak_order);
    const mudou = phase.tiebreak_order.length > 0
      && phase.tiebreak_order.join('|') !== DEFAULT_TIEBREAK_ORDER.join('|');
    add(
      'desempate',
      'Desempate dentro do grupo',
      ordem.map((c) => c.label).join(' → '),
      mudou
        ? 'Ordem escolhida por você. Critério que não se aplica (quem não se enfrentou, por exemplo) é PULADO, nunca inventado.'
        : 'A ordem do regulamento (USA Pickleball 15.B.4). O confronto direto vem logo depois das vitórias — é a reclamação nº 1 de quadra, "mas eu ganhei dele".',
      mudou,
    );
  }

  // -------------------------------------------------------- entre os grupos
  if (!isLast && agrupada && grupos > 1) {
    const mudou = phase.cross_group_method !== CROSS_GROUP_METHOD.RATE;
    add(
      'entre_grupos',
      'Comparação entre grupos',
      CROSS_GROUP_METHOD_LABELS[phase.cross_group_method] || phase.cross_group_method,
      mudou
        ? 'Método escolhido por você para ordenar quem veio de grupos diferentes.'
        : 'O padrão, e o único justo com grupos de tamanhos diferentes: 3 vitórias em 3 jogos valem mais que 3 em 4. A colocação vem sempre primeiro — todos os 1ºs, depois os 2ºs.',
      mudou,
    );
  }

  // --------------------------------------------------------- entrada direta
  if (!isFirst) {
    const cfg = normalizeDirectEntry(phase.direct_entry);
    const nenhuma = cfg.mode === DIRECT_ENTRY_MODE.NONE;
    let valor = DIRECT_ENTRY_MODE_LABELS[cfg.mode];
    if (cfg.mode === DIRECT_ENTRY_MODE.SEEDS) valor = `Os ${cfg.count} melhores cabeças entram direto aqui`;
    if (cfg.mode === DIRECT_ENTRY_MODE.MANUAL) valor = `${cfg.ids.length} escolhido(s) a dedo entram direto aqui`;
    add(
      'entrada_direta',
      'Entrada direta',
      valor,
      nenhuma
        ? 'Ninguém pula fases: esta fase é formada só por quem se classificou na anterior.'
        : 'Quem entra direto aqui NÃO joga as fases anteriores — não entra no sorteio nem na classificação delas.',
      !nenhuma,
    );
  }

  // ---------------------------------------------------------------- cabeças
  if (phase.seed_count > 0) {
    add(
      'cabecas',
      'Cabeças de chave',
      `${phase.seed_count} protegido(s)`,
      'Os cabeças entram por posições que só os fazem se cruzar o mais tarde possível — e, numa chave incompleta, são eles que recebem os byes.',
      true,
    );
  }

  // ------------------------------------------------------------------ chave
  if (éChave) {
    const mudou = phase.bracket_seeding !== PHASE_BRACKET_SEEDING.STANDARD;
    add(
      'chave',
      'Montagem da chave',
      PHASE_BRACKET_SEEDING_LABELS[phase.bracket_seeding] || phase.bracket_seeding,
      'Todo mundo entra pela posição canônica do seu número. É o que garante byes exatamente onde faltam inscritos, sem partida de ninguém contra ninguém.',
      mudou,
    );
    if (phase.type === TOURNAMENT_STAGE_TYPE.KNOCKOUT && phase.third_place) {
      add('terceiro', 'Disputa de 3º lugar', 'Sim', 'Os perdedores das semifinais se enfrentam por mais uma partida.', true);
    }
  }

  return { rows, changedCount: rows.filter((r) => r.changed).length };
}

/** Só as linhas que o organizador mudou — para um resumo curto. */
export function changedPhaseRules(rawPhase, ctx = {}) {
  return describePhaseRules(rawPhase, ctx).rows.filter((r) => r.changed);
}
