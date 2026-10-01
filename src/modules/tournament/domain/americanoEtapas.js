/**
 * AMERICANO APRIMORADO EM ETAPAS (fase `americano_etapas`).
 *
 * ## O formato
 *
 * Inscrição individual. Os atletas jogam em ETAPAS. Em cada etapa eles são
 * divididos em grupos (de 4, por padrão) e cada grupo joga um Americano: cada
 * um forma dupla com cada outro do grupo uma vez — num grupo de 4, são 3 jogos
 * para cada um. Terminada a etapa, os grupos são REFEITOS, misturando os
 * atletas de grupos diferentes, e a próxima etapa começa. Quantas etapas, quem
 * organiza escolhe.
 *
 *     8 atletas, grupos de 4, 3 etapas → 9 jogos para cada um.
 *
 * A classificação é UMA só, somando tudo o que cada um fez em todas as etapas:
 * o campeão é quem teve o melhor desempenho no total.
 *
 * ## A mistura
 *
 * Os grupos de cada etapa são escolhidos para criar o máximo de encontros
 * INÉDITOS: duas pessoas que já jogaram juntas ou uma contra a outra custam
 * para voltar ao mesmo grupo, e quanto mais vezes já se encontraram, mais
 * custa (o custo é o quadrado dos encontros — duas repetições pesam mais que o
 * dobro de uma, o que espalha as repetições inevitáveis em vez de concentrar).
 * Repetição sempre vai existir a partir de um ponto (8 atletas em grupos de 4
 * se esgotam rápido); o que a busca garante é que ela seja a MENOR possível.
 *
 * A mistura não depende de resultado — só de quem já se encontrou. Por isso
 * ela é reprodutível pela semente e pode ser prevista antes do sorteio (a tela
 * mostra a previsão de encontros inéditos).
 *
 * ## Grupos que o Americano aceita
 *
 * O Americano só fecha (cada dupla exatamente uma vez) com 4, 5, 8, 9, 12, 13…
 * atletas (N ≡ 0 ou 1 mod 4). Os grupos de cada etapa saem desses tamanhos, o
 * mais perto possível do escolhido. Com grupos de tamanhos diferentes (9
 * atletas = 4 + 5), quem cai no grupo maior joga um jogo a mais naquela etapa
 * — e a mistura das etapas seguintes leva isso em conta, revezando quem fica
 * no grupo maior para os totais ficarem iguais (ou o mais perto disso).
 *
 * ## Sem campo novo nos jogos
 *
 * A etapa de cada jogo mora no NOME DO GRUPO que o jogo sempre teve
 * (`group: "Etapa 2 · Grupo A"`), e as rodadas seguem numeradas em sequência
 * de uma etapa para a outra. A configuração da fase ganha `etapa_count`
 * (opcional, dentro de `stages[]`, como os outros campos da fase); o tamanho
 * do grupo é o `max_per_group` de sempre.
 *
 * Puro — sem React, sem Firebase.
 */

import { TOURNAMENT_STAGE_TYPE } from './constants.js';
import { buildAmericanoRotation, seededRng, shuffle, withReturnLeg } from './draw.js';
import {
  ETAPAS_MIN, ETAPAS_MAX, ETAPAS_PADRAO, TAMANHOS_DE_GRUPO, TAMANHO_PADRAO,
  normalizeEtapaCount, normalizeEtapaGroupSize,
} from './americanoEtapasConfig.js';

export const AMERICANO_ETAPAS = TOURNAMENT_STAGE_TYPE.AMERICANO_ETAPAS;

export {
  ETAPAS_MIN, ETAPAS_MAX, ETAPAS_PADRAO, TAMANHOS_DE_GRUPO, TAMANHO_PADRAO,
  normalizeEtapaCount, normalizeEtapaGroupSize,
};

/** O Americano fecha com este número de atletas? (N ≡ 0 ou 1 mod 4, N ≥ 4) */
export function americanoFecha(n) {
  return n >= 4 && (n % 4 === 0 || n % 4 === 1);
}

/** Jogos de cada um num grupo de `tamanho` (cada dupla uma vez por turno). */
export function jogosNoGrupo(tamanho, legs = 1) {
  return Math.max(0, tamanho - 1) * (legs === 2 ? 2 : 1);
}

/**
 * Os tamanhos dos grupos de uma etapa para `n` atletas, o mais perto possível
 * do tamanho escolhido, só com tamanhos que fecham o Americano. Maiores
 * primeiro (Grupo A é o maior). `null` quando não há divisão possível
 * (6, 7 e 11 atletas com grupos de 4 ou 5, por exemplo).
 *
 * @param {number} n
 * @param {number} [alvo]
 * @returns {number[]|null}
 */
export function etapaGroupSizes(n, alvo = TAMANHO_PADRAO) {
  const total = Math.floor(Number(n));
  if (!Number.isFinite(total) || total < 4) return null;
  const meta = normalizeEtapaGroupSize(alvo);
  const candidatos = [];
  for (let s = 4; s <= 2 * meta + 1; s += 1) if (americanoFecha(s)) candidatos.push(s);

  // Programação dinâmica: menor soma de (tamanho − alvo)²; no empate, menos
  // grupos (cada grupo a menos é uma quadra a menos ocupada ao mesmo tempo).
  const melhor = new Array(total + 1).fill(null);
  melhor[0] = { custo: 0, grupos: [] };
  for (let k = 1; k <= total; k += 1) {
    candidatos.forEach((s) => {
      if (s > k || !melhor[k - s]) return;
      const anterior = melhor[k - s];
      const custo = anterior.custo + (s - meta) ** 2;
      const grupos = [...anterior.grupos, s];
      const atual = melhor[k];
      if (!atual || custo < atual.custo || (custo === atual.custo && grupos.length < atual.grupos.length)) {
        melhor[k] = { custo, grupos };
      }
    });
  }
  const r = melhor[total];
  return r ? r.grupos.slice().sort((a, b) => b - a) : null;
}

/** Os números de atletas mais próximos (abaixo e acima) que fecham os grupos. */
export function numerosQueFecham(n, alvo = TAMANHO_PADRAO) {
  let abaixo = null;
  for (let k = n - 1; k >= 4; k -= 1) if (etapaGroupSizes(k, alvo)) { abaixo = k; break; }
  let acima = null;
  for (let k = n + 1; k <= n + 8; k += 1) if (etapaGroupSizes(k, alvo)) { acima = k; break; }
  return { abaixo, acima };
}

const LETRAS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
const letraDoGrupo = (i) => (i < LETRAS.length ? LETRAS[i] : `${LETRAS[Math.floor(i / LETRAS.length) - 1]}${LETRAS[i % LETRAS.length]}`);

/** "Etapa 2 · Grupo A" — o nome do grupo carrega a etapa (nenhum campo novo). */
export function etapaGroupName(etapa, indice) {
  return `Etapa ${etapa} · Grupo ${letraDoGrupo(indice)}`;
}

const NOME_DA_ETAPA = /^Etapa (\d+) · /;

/** A etapa de um jogo (pelo nome do grupo). Sem marca, é a 1ª. */
export function etapaOfMatch(m) {
  const r = NOME_DA_ETAPA.exec(String(m?.group || ''));
  return r ? Number(r[1]) : 1;
}

/** "Grupo A" — o nome do grupo sem a etapa, para a tela que já agrupa por etapa. */
export function grupoSemEtapa(nome) {
  return String(nome || '').replace(NOME_DA_ETAPA, '');
}

const idsDoJogo = (m) => [...(m?.side_a_ids || []), ...(m?.side_b_ids || [])].map(String);
const parDe = (a, b) => (a < b ? `${a}|${b}` : `${b}|${a}`);

/**
 * Quantas vezes cada par de atletas já se encontrou (no mesmo jogo, como
 * parceiros ou adversários). É a memória que a mistura quer evitar repetir.
 *
 * @returns {Map<string, number>} chave `a|b` (ordenada)
 */
export function encounterCounts(matches = []) {
  const contagem = new Map();
  (matches || []).forEach((m) => {
    const ids = idsDoJogo(m);
    if (ids.length < 2 || !(m.side_a_ids || []).length || !(m.side_b_ids || []).length) return;
    for (let i = 0; i < ids.length; i += 1) {
      for (let j = i + 1; j < ids.length; j += 1) {
        const k = parDe(ids[i], ids[j]);
        contagem.set(k, (contagem.get(k) || 0) + 1);
      }
    }
  });
  return contagem;
}

/** Jogos de cada atleta na fase (só os disputáveis: bye/W.O. sem adversário não conta). */
export function gamesPlayedBy(matches = []) {
  const jogos = new Map();
  (matches || []).forEach((m) => {
    if (!(m.side_a_ids || []).length || !(m.side_b_ids || []).length) return;
    idsDoJogo(m).forEach((id) => jogos.set(id, (jogos.get(id) || 0) + 1));
  });
  return jogos;
}

/**
 * Quantas vezes cada par já esteve no MESMO GRUPO de uma etapa (pelo nome do
 * grupo de cada jogo). É a unidade da mistura: num Americano exato, estar no
 * mesmo grupo é jogar junto e contra — então é isso que não se quer repetir.
 *
 * @returns {Map<string, number>} chave `a|b` (ordenada)
 */
export function coGroupCounts(matches = []) {
  const membrosPorGrupo = new Map();
  (matches || []).forEach((m) => {
    if (!(m.side_a_ids || []).length || !(m.side_b_ids || []).length) return;
    const chave = `${m.stage_index ?? 0}::${m.group || ''}`;
    if (!membrosPorGrupo.has(chave)) membrosPorGrupo.set(chave, new Set());
    idsDoJogo(m).forEach((id) => membrosPorGrupo.get(chave).add(id));
  });
  const contagem = new Map();
  membrosPorGrupo.forEach((membros) => {
    const ids = [...membros].sort();
    for (let i = 0; i < ids.length; i += 1) {
      for (let j = i + 1; j < ids.length; j += 1) {
        const k = `${ids[i]}|${ids[j]}`;
        contagem.set(k, (contagem.get(k) || 0) + 1);
      }
    }
  });
  return contagem;
}

/**
 * O custo de um par que esteve junto em `c` grupos.
 *
 * A ordem das prioridades é a do pedido — "o máximo de partidas inéditas":
 *  1. cada vez que um par se junta DE NOVO custa caro (`PESO_DO_REENCONTRO`).
 *     Como o total de "lugares de par" de cada etapa é fixo, minimizar os
 *     reencontros é o mesmo que maximizar os pares inéditos;
 *  2. entre divisões com o mesmo número de reencontros, a parte quadrática
 *     espalha as repetições inevitáveis (juntar pela 3ª vez custa mais que
 *     juntar dois pares diferentes pela 2ª).
 *
 * Com 8 atletas em grupos de 4, isso dá exatamente o esquema de quadra: na
 * etapa 2 cada grupo leva dois de cada grupo da etapa 1; na etapa 3, os pares
 * que seguiram juntos se juntam aos dois que ainda não encontraram — e em 3
 * etapas todos se encontram.
 */
const PESO_DO_REENCONTRO = 1000;
const custoDoPar = (c) => (c > 1 ? PESO_DO_REENCONTRO * (c - 1) + 10 * (c - 1) * (c - 1) : 0);
/**
 * Peso da diferença de jogos entre atletas (só com grupos de tamanhos
 * diferentes). Vem ANTES dos encontros: numa classificação única, jogar um
 * jogo a menos que os outros pesa mais que reencontrar alguém.
 */
const PESO_DA_JUSTICA = 5000;

/**
 * Planeja as PRÓXIMAS `etapas` de uma vez, cada uma com os mesmos `sizes`.
 *
 * Planejar etapa por etapa é guloso: a etapa 2 escolhida sozinha pode deixar a
 * 4 sem saída boa. Olhando as que faltam juntas, a busca encontra a mistura
 * perfeita quando ela existe (16 atletas em grupos de 4: em 5 etapas, cada par
 * se encontra exatamente uma vez). A etapa gerada é a primeira do plano; as
 * seguintes são replanejadas, com o que de fato aconteceu, quando chegar a vez
 * delas.
 *
 * Busca local por trocas (um atleta de um grupo pelo de outro, na mesma
 * etapa) até não haver troca que melhore, com perturbações para escapar de
 * mínimos locais — determinística pela semente e limitada em esforço.
 *
 * @param {string[]} ids
 * @param {{
 *   sizes: number[], etapas?: number,
 *   coGroups?: Map<string, number>, gamesPlayed?: Map<string, number>,
 *   legs?: number, seed?: string, esforco?: number,
 * }} opts
 * @returns {string[][][]} plano[etapa][grupo] = ids
 */
export function planEtapas(ids, opts = {}) {
  const atletas = (ids || []).map(String);
  const sizes = opts.sizes || [];
  const n = atletas.length;
  if (sizes.reduce((s, t) => s + t, 0) !== n) {
    throw new Error('Os tamanhos dos grupos não somam o número de atletas.');
  }
  const R = Math.max(1, Math.floor(Number(opts.etapas)) || 1);
  const legs = opts.legs === 2 ? 2 : 1;
  const rng = seededRng(opts.seed || 'etapas');

  // Contagem de "juntos no grupo" (histórico + plano), por índice.
  const idx = new Map(atletas.map((id, i) => [id, i]));
  const C = new Int32Array(n * n);
  (opts.coGroups || new Map()).forEach((vezes, chave) => {
    const [a, b] = chave.split('|');
    if (!idx.has(a) || !idx.has(b)) return;
    C[idx.get(a) * n + idx.get(b)] += vezes;
    C[idx.get(b) * n + idx.get(a)] += vezes;
  });

  // Jogos: com grupos de tamanhos diferentes, quem cai no maior joga mais.
  const inc = sizes.map((t) => jogosNoGrupo(t, legs));
  const variosTamanhos = new Set(sizes).size > 1;
  const G = new Float64Array(n);
  atletas.forEach((id, i) => { G[i] = (opts.gamesPlayed && opts.gamesPlayed.get(id)) || 0; });
  const media = (G.reduce((s, v) => s + v, 0) + R * sizes.reduce((s, t, g) => s + t * inc[g], 0)) / Math.max(1, n);

  const juntar = (membros, d) => {
    for (let x = 0; x < membros.length; x += 1) {
      for (let y = x + 1; y < membros.length; y += 1) {
        C[membros[x] * n + membros[y]] += d;
        C[membros[y] * n + membros[x]] += d;
      }
    }
  };

  // Plano inicial: cada etapa sorteada.
  const plano = [];
  for (let e = 0; e < R; e += 1) {
    const ordem = shuffle(atletas.map((_, i) => i), rng);
    const grupos = [];
    let cursor = 0;
    sizes.forEach((tam, g) => {
      const membros = ordem.slice(cursor, cursor + tam);
      cursor += tam;
      grupos.push(membros);
      juntar(membros, 1);
      membros.forEach((i) => { G[i] += inc[g]; });
    });
    plano.push(grupos);
  }

  const custoTotal = () => {
    let c = 0;
    for (let i = 0; i < n; i += 1) {
      for (let j = i + 1; j < n; j += 1) c += custoDoPar(C[i * n + j]);
      if (variosTamanhos) c += PESO_DA_JUSTICA * (G[i] - media) ** 2;
    }
    return c;
  };

  // Delta de trocar A[a] (grupo g1) com B[b] (grupo g2) na mesma etapa.
  const deltaDaTroca = (A, a, g1, B, b, g2) => {
    const i = A[a];
    const j = B[b];
    let d = 0;
    for (let x = 0; x < A.length; x += 1) {
      if (x === a) continue;
      const k = A[x];
      const ci = C[i * n + k];
      const cj = C[j * n + k];
      d += custoDoPar(ci - 1) - custoDoPar(ci) + custoDoPar(cj + 1) - custoDoPar(cj);
    }
    for (let y = 0; y < B.length; y += 1) {
      if (y === b) continue;
      const k = B[y];
      const ci = C[i * n + k];
      const cj = C[j * n + k];
      d += custoDoPar(ci + 1) - custoDoPar(ci) + custoDoPar(cj - 1) - custoDoPar(cj);
    }
    if (variosTamanhos && inc[g1] !== inc[g2]) {
      const dif = inc[g2] - inc[g1];
      d += PESO_DA_JUSTICA * (
        (G[i] + dif - media) ** 2 - (G[i] - media) ** 2
        + (G[j] - dif - media) ** 2 - (G[j] - media) ** 2
      );
    }
    return d;
  };

  const trocar = (grupos, g1, a, g2, b) => {
    const A = grupos[g1];
    const B = grupos[g2];
    const i = A[a];
    const j = B[b];
    // desfaz os pares antigos de i em A e de j em B, refaz os novos
    for (let x = 0; x < A.length; x += 1) {
      if (x === a) continue;
      C[i * n + A[x]] -= 1; C[A[x] * n + i] -= 1;
      C[j * n + A[x]] += 1; C[A[x] * n + j] += 1;
    }
    for (let y = 0; y < B.length; y += 1) {
      if (y === b) continue;
      C[j * n + B[y]] -= 1; C[B[y] * n + j] -= 1;
      C[i * n + B[y]] += 1; C[B[y] * n + i] += 1;
    }
    if (inc[g1] !== inc[g2]) {
      const dif = inc[g2] - inc[g1];
      G[i] += dif;
      G[j] -= dif;
    }
    A[a] = j;
    B[b] = i;
  };

  // Esforço proporcional ao tamanho: rápido o bastante para a tela prever.
  const orcamento = Math.max(2000, Math.floor(Number(opts.esforco) || 0) || 400000);
  let gasto = 0;
  const buscaLocal = () => {
    let melhorou = true;
    while (melhorou && gasto < orcamento) {
      melhorou = false;
      for (let e = 0; e < R; e += 1) {
        const grupos = plano[e];
        for (let g1 = 0; g1 < grupos.length; g1 += 1) {
          for (let g2 = g1 + 1; g2 < grupos.length; g2 += 1) {
            for (let a = 0; a < grupos[g1].length; a += 1) {
              for (let b = 0; b < grupos[g2].length; b += 1) {
                gasto += 1;
                if (deltaDaTroca(grupos[g1], a, g1, grupos[g2], b, g2) < -1e-9) {
                  trocar(grupos, g1, a, g2, b);
                  melhorou = true;
                }
              }
            }
          }
        }
      }
    }
  };

  const copia = () => plano.map((gs) => gs.map((m) => m.slice()));
  const restaurar = (salvo) => {
    // Recompõe C e G a partir do plano salvo.
    for (let e = 0; e < R; e += 1) plano[e].forEach((m, g) => { juntar(m, -1); m.forEach((i) => { G[i] -= inc[g]; }); });
    for (let e = 0; e < R; e += 1) {
      plano[e] = salvo[e].map((m) => m.slice());
      plano[e].forEach((m, g) => { juntar(m, 1); m.forEach((i) => { G[i] += inc[g]; }); });
    }
  };

  buscaLocal();
  let melhorCusto = custoTotal();
  let melhorPlano = copia();
  const grupoPorEtapa = sizes.length;
  // Perturbações: algumas trocas ao acaso numa etapa e nova busca. Fica com o
  // melhor plano visto.
  for (let k = 0; k < 200 && gasto < orcamento && melhorCusto > 0 && grupoPorEtapa > 1; k += 1) {
    const e = Math.floor(rng() * R);
    const grupos = plano[e];
    const passos = 2 + Math.floor(rng() * 3);
    for (let p = 0; p < passos; p += 1) {
      const g1 = Math.floor(rng() * grupoPorEtapa);
      let g2 = Math.floor(rng() * (grupoPorEtapa - 1));
      if (g2 >= g1) g2 += 1;
      trocar(grupos, g1, Math.floor(rng() * grupos[g1].length), g2, Math.floor(rng() * grupos[g2].length));
    }
    buscaLocal();
    const custo = custoTotal();
    if (custo < melhorCusto - 1e-9) {
      melhorCusto = custo;
      melhorPlano = copia();
    } else {
      restaurar(melhorPlano);
    }
  }

  return melhorPlano.map((grupos) => grupos.map((membros) => membros.map((i) => atletas[i])));
}

/**
 * Os grupos de UMA etapa (a próxima), olhando também as `etapas` que ainda
 * virão depois dela (ver `planEtapas`).
 *
 * @param {string[]} ids
 * @param {{ sizes: number[], coGroups?: Map<string, number>, gamesPlayed?: Map<string, number>,
 *   legs?: number, seed?: string, etapasRestantes?: number, esforco?: number }} opts
 * @returns {string[][]}
 */
export function planEtapaGroups(ids, opts = {}) {
  return planEtapas(ids, { ...opts, etapas: Math.max(1, opts.etapasRestantes || 1) })[0];
}

/**
 * Os jogos de UMA etapa, a partir dos grupos já escolhidos: um Americano por
 * grupo (2 turnos quando a fase pede), com o nome "Etapa N · Grupo X" e as
 * rodadas numeradas depois das que já existem (as quadras rodam os grupos em
 * paralelo).
 *
 * @param {string[][]} grupos
 * @param {{ etapa: number, roundOffset?: number, seed?: string, playerMeta?: object|null, legs?: number }} opts
 */
export function buildEtapaMatches(grupos, opts = {}) {
  const etapa = Math.max(1, Math.floor(Number(opts.etapa)) || 1);
  const offset = Math.max(0, Math.floor(Number(opts.roundOffset)) || 0);
  const jogos = [];
  grupos.forEach((membros, g) => {
    const nome = etapaGroupName(etapa, g);
    const meta = opts.playerMeta
      ? Object.fromEntries(membros.map((id) => [id, opts.playerMeta[id] || {}]))
      : null;
    const rotacao = withReturnLeg(
      buildAmericanoRotation(membros, { seed: `${opts.seed || 'etapas'}:E${etapa}:${g}`, playerMeta: meta }),
      opts.legs,
    );
    rotacao.forEach((m, k) => {
      jogos.push({
        group: nome,
        round: offset + (Number(m.round) || 1),
        position: k + 1,
        side_a: m.side_a,
        side_b: m.side_b,
      });
    });
  });
  return jogos;
}

/** A etapa mais adiantada que já tem jogo (0 sem jogos). */
export function etapaAtual(matches = []) {
  return (matches || []).reduce((max, m) => Math.max(max, etapaOfMatch(m)), 0);
}

const decidido = (m) => m?.status === 'finished' || m?.status === 'walkover';

/**
 * Em que pé está a fase: etapas geradas, a atual, quantos jogos faltam nela e
 * se dá para gerar a próxima.
 *
 * @returns {{ total: number, atual: number, pendentes: number, completa: boolean, podeGerar: boolean, proxima: number|null }}
 */
export function etapasProgress(matches = [], phase = {}) {
  const total = normalizeEtapaCount(phase?.etapa_count);
  const atual = etapaAtual(matches);
  const daAtual = (matches || []).filter((m) => etapaOfMatch(m) === atual);
  const pendentes = daAtual.filter((m) => !decidido(m)).length;
  const etapaFechada = atual > 0 && pendentes === 0;
  return {
    total,
    atual,
    pendentes,
    completa: etapaFechada && atual >= total,
    podeGerar: etapaFechada && atual < total,
    proxima: atual < total ? atual + 1 : null,
  };
}

/** Quem joga a próxima etapa: quem jogou a fase, menos quem saiu dela. */
export function etapaParticipants(matches = [], { excluir = [] } = {}) {
  const fora = new Set((excluir || []).map(String));
  const ids = new Set();
  (matches || []).forEach((m) => idsDoJogo(m).forEach((id) => { if (!fora.has(id)) ids.add(id); }));
  return [...ids].sort();
}

/** Mensagem quando o número de atletas não fecha os grupos do Americano. */
export function mensagemSemDivisao(n, alvo) {
  const { abaixo, acima } = numerosQueFecham(n, alvo);
  const opcoes = [abaixo, acima].filter(Boolean).join(' ou ');
  return `Com ${n} atletas não dá para montar grupos de Americano (que fecham com 4, 5, 8, 9… atletas).`
    + (opcoes ? ` Com ${opcoes} atletas, fecha.` : '');
}

/**
 * A 1ª etapa (o sorteio da fase): grupos sorteados, um Americano por grupo.
 *
 * @param {string[]} ids
 * @param {object} phase fase normalizada
 * @param {{ seed?: string, playerMeta?: object|null }} [opts]
 * @returns {{ matches: object[], groups: string[][] }}
 */
export function firstEtapaDraw(ids, phase = {}, opts = {}) {
  const sizes = etapaGroupSizes(ids.length, phase.max_per_group);
  if (!sizes) throw new Error(mensagemSemDivisao(ids.length, phase.max_per_group));
  // Sem histórico, qualquer divisão é igualmente boa: é o sorteio da etapa 1.
  const groups = planEtapaGroups(ids, { sizes, seed: `${opts.seed || 'etapas'}:E1`, legs: phase.round_robin_legs });
  return {
    groups,
    matches: buildEtapaMatches(groups, {
      etapa: 1, roundOffset: 0, seed: opts.seed, playerMeta: opts.playerMeta || null, legs: phase.round_robin_legs,
    }),
  };
}

/**
 * A PRÓXIMA etapa, a partir dos jogos já gravados da fase. Usada pelo avanço
 * de fase (`computeStageAdvance`), no mesmo contrato do Mexicano e do suíço:
 *  - `{ pending: true }` enquanto houver jogo da etapa atual por decidir;
 *  - `{ complete: true }` quando todas as etapas pedidas já foram jogadas;
 *  - `{ error }` quando quem sobrou na fase não fecha os grupos;
 *  - `{ matches, etapa }` com os jogos da etapa nova.
 *
 * @param {object[]} matches jogos da fase
 * @param {object} phase fase normalizada
 * @param {{ seed?: string, excluir?: string[], playerMeta?: object|null }} [ctx]
 */
export function nextEtapa(matches = [], phase = {}, ctx = {}) {
  if (!matches || matches.length === 0) return { pending: true };
  const prog = etapasProgress(matches, phase);
  if (prog.pendentes > 0) return { pending: true };
  if (prog.completa) return { complete: true };

  const ids = etapaParticipants(matches, { excluir: ctx.excluir });
  const sizes = etapaGroupSizes(ids.length, phase.max_per_group);
  if (!sizes) return { error: mensagemSemDivisao(ids.length, phase.max_per_group) };

  const etapa = prog.atual + 1;
  const groups = planEtapaGroups(ids, {
    sizes,
    coGroups: coGroupCounts(matches),
    gamesPlayed: gamesPlayedBy(matches),
    legs: phase.round_robin_legs,
    seed: `${ctx.seed || 'etapas'}:E${etapa}`,
    // Olha as etapas que ainda vêm (esta inclusa), para não se encurralar.
    etapasRestantes: prog.total - prog.atual,
  });
  const ultimaRodada = matches.reduce((max, m) => Math.max(max, Number(m.round) || 0), 0);
  return {
    etapa,
    groups,
    matches: buildEtapaMatches(groups, {
      etapa, roundOffset: ultimaRodada, seed: ctx.seed, playerMeta: ctx.playerMeta || null, legs: phase.round_robin_legs,
    }),
  };
}

/**
 * Previsão da fase inteira, ANTES do sorteio: os grupos de todas as etapas
 * (a mistura não depende de resultado) e o que cada um vai viver — jogos,
 * pessoas diferentes encontradas e reencontros. É o que a tela mostra para o
 * organizador escolher o número de etapas sabendo o que ganha com cada uma.
 *
 * @param {number} n atletas
 * @param {object} phase fase normalizada
 * @returns {null | {
 *   sizes: number[], etapas: number, jogosPorAtleta: { min: number, max: number },
 *   totalJogos: number, encontrosPossiveis: number, encontrosIneditos: number,
 *   reencontros: number, conheceTodos: number|null,
 * }}
 */
export function simulateEtapas(n, phase = {}) {
  const sizes = etapaGroupSizes(n, phase.max_per_group);
  if (!sizes) return null;
  const etapas = normalizeEtapaCount(phase.etapa_count);
  const legs = phase.round_robin_legs === 2 ? 2 : 1;
  const ids = Array.from({ length: n }, (_, i) => `a${String(i).padStart(3, '0')}`);
  const juntos = new Map();
  const jogos = new Map();
  let conheceTodos = null;
  const totalPares = (n * (n - 1)) / 2;

  // O MESMO caminho do torneio de verdade: a etapa 1 sorteada e cada etapa
  // seguinte planejada com o que já aconteceu, olhando as que faltam.
  for (let e = 1; e <= etapas; e += 1) {
    const grupos = planEtapaGroups(ids, {
      sizes, coGroups: juntos, gamesPlayed: jogos, legs, seed: `previsao:E${e}`,
      etapasRestantes: e === 1 ? 1 : etapas - e + 1,
      // A previsão roda na tela, a cada ajuste: esforço menor que o do sorteio
      // de verdade (que pode demorar um pouco mais e achar um pouco melhor).
      esforco: 60000,
    });
    grupos.forEach((membros) => {
      for (let x = 0; x < membros.length; x += 1) {
        jogos.set(membros[x], (jogos.get(membros[x]) || 0) + jogosNoGrupo(membros.length, legs));
        for (let y = x + 1; y < membros.length; y += 1) {
          const k = parDe(membros[x], membros[y]);
          juntos.set(k, (juntos.get(k) || 0) + 1);
        }
      }
    });
    if (conheceTodos == null && juntos.size === totalPares) conheceTodos = e;
  }

  const porAtleta = [...jogos.values()];
  const coGrupos = [...juntos.values()];
  return {
    sizes,
    etapas,
    jogosPorAtleta: { min: Math.min(...porAtleta), max: Math.max(...porAtleta) },
    totalJogos: sizes.reduce((s, t) => s + (t * (t - 1)) / 4, 0) * legs * etapas,
    encontrosPossiveis: totalPares,
    encontrosIneditos: juntos.size,
    reencontros: coGrupos.filter((v) => v > 1).length,
    conheceTodos,
  };
}

/**
 * Explicação da fase para a tela (o mesmo contrato de `explainStage`): o que
 * acontece com N atletas, em linguagem de quadra.
 */
export function explainAmericanoEtapas(n, phase = {}) {
  const legs = phase.round_robin_legs === 2 ? 2 : 1;
  const etapas = normalizeEtapaCount(phase.etapa_count);
  const alvo = normalizeEtapaGroupSize(phase.max_per_group);
  const sizes = etapaGroupSizes(n, alvo);
  if (!sizes) {
    return {
      status: 'error',
      totalMatches: 0,
      rounds: 0,
      lines: [mensagemSemDivisao(n, alvo)],
      recommendation: 'O Americano de cada grupo só fecha com 4, 5, 8, 9, 12, 13… atletas. Ajuste o tamanho dos grupos ou o número de inscritos.',
    };
  }
  const sim = simulateEtapas(n, { ...phase, etapa_count: etapas, max_per_group: alvo, round_robin_legs: legs });
  const tamanhos = new Set(sizes).size === 1
    ? `${sizes.length} ${sizes.length === 1 ? 'grupo' : 'grupos'} de ${sizes[0]}`
    : `grupos de ${sizes.join(', ').replace(/, (\d+)$/, ' e $1')}`;
  const jogosEtapa = new Set(sizes).size === 1
    ? `${jogosNoGrupo(sizes[0], legs)} jogos`
    : `${jogosNoGrupo(Math.min(...sizes), legs)} ou ${jogosNoGrupo(Math.max(...sizes), legs)} jogos`;
  const totalPorAtleta = sim.jogosPorAtleta.min === sim.jogosPorAtleta.max
    ? `${sim.jogosPorAtleta.max} jogos`
    : `${sim.jogosPorAtleta.min} a ${sim.jogosPorAtleta.max} jogos`;
  const outros = n - 1;
  const conhecidos = Math.round((2 * sim.encontrosIneditos) / n);

  const lines = [
    `${n} atletas → em cada etapa, ${tamanhos}; cada um faz ${jogosEtapa} na etapa${legs === 2 ? ' (ida e volta)' : ''}.`,
    `${etapas} ${etapas === 1 ? 'etapa' : 'etapas'} → ${totalPorAtleta} para cada atleta, ${sim.totalJogos} jogos no total.`,
    'A cada etapa os grupos são refeitos, misturando quem ainda não se encontrou — e a classificação é uma só, somando todas as etapas.',
    sizes.length > 1
      ? `Previsão da mistura: cada atleta encontra, em média, ${Math.min(conhecidos, outros)} dos outros ${outros}${sim.conheceTodos ? ` — todos se encontram até a etapa ${sim.conheceTodos}` : ''}.`
      : 'Com um grupo só, todas as etapas reúnem as mesmas pessoas: é como jogar o mesmo Americano várias vezes.',
  ];
  let status = 'ok';
  let recommendation;
  if (new Set(sizes).size > 1) {
    status = 'info';
    recommendation = sim.jogosPorAtleta.min === sim.jogosPorAtleta.max
      ? 'Os grupos têm tamanhos diferentes, mas a mistura reveza quem fica no maior: no fim, todos jogam o mesmo número de jogos.'
      : 'Os grupos têm tamanhos diferentes e o total de jogos não fecha igual para todos. Se quiser comparar por percentual, use o desempate por aproveitamento nas regras avançadas da fase.';
  }
  if (sizes.length === 1 && n > 0) {
    status = 'warn';
    recommendation = 'Para haver mistura entre as etapas são precisos ao menos 2 grupos (8 atletas com grupos de 4).';
  }
  return {
    status,
    totalMatches: sim.totalJogos,
    rounds: 0,
    lines,
    ...(recommendation ? { recommendation } : {}),
  };
}

/**
 * A frase de situação das etapas, para a tela de sorteio (`null` antes do
 * sorteio).
 */
export function etapasResumo(prog) {
  if (!prog || prog.atual === 0) return null;
  const jogos = (n) => `${n} ${n === 1 ? 'jogo' : 'jogos'}`;
  if (prog.completa) {
    return `As ${prog.total} ${prog.total === 1 ? 'etapa foi jogada' : 'etapas foram jogadas'} — a classificação final está valendo.`;
  }
  if (prog.pendentes > 0) {
    return prog.atual < prog.total
      ? `Etapa ${prog.atual} de ${prog.total} em andamento: ${prog.pendentes === 1 ? 'falta 1 jogo' : `faltam ${jogos(prog.pendentes)}`} para gerar a etapa ${prog.atual + 1}.`
      : `Última etapa (${prog.atual} de ${prog.total}) em andamento: ${prog.pendentes === 1 ? 'falta 1 jogo' : `faltam ${jogos(prog.pendentes)}`}.`;
  }
  return `Etapa ${prog.atual} de ${prog.total} concluída — a etapa ${prog.proxima} pode ser gerada.`;
}

/** O rótulo do botão de avançar: "Gerar etapa 2 de 3". */
export function etapaBotaoTexto(prog) {
  if (!prog || !prog.proxima) return 'Gerar próxima etapa';
  return `Gerar etapa ${prog.proxima} de ${prog.total}`;
}
