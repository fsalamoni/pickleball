/**
 * ENTRADA DIRETA: quem começa o torneio numa fase mais à frente.
 *
 * ## O que é
 *
 * Nem todo mundo entra no mesmo ponto. É comum — e o organizador precisa poder
 * dizer isso:
 *
 * - **cabeças que pulam a fase eliminatória**: os 8 melhores entram direto na
 *   chave principal e os outros disputam um pré-torneio pelas vagas restantes
 *   (o modelo de qualificatória do tênis e dos circuitos grandes);
 * - **campeão defendendo título** que entra direto nas quartas;
 * - **grupo que só existe para peneirar**: 20 inscritos, 12 jogam a primeira
 *   fase por 4 vagas, e 8 já estão na segunda;
 * - **convidados/wild cards da organização** que entram numa fase específica.
 *
 * Quem entra direto na fase 3 **pula as fases 1 e 2** — não aparece no
 * sorteio delas, não conta para os grupos delas, e a classificação delas
 * não fala dele. Ele aparece quando a fase dele começa.
 *
 * ## A regra que isto respeita
 *
 * Uma pessoa entra **uma vez só**. Se for declarada em duas fases, vale a
 * MAIS CEDO — entrar mais tarde é vantagem, e vantagem duplicada por engano
 * de configuração não pode passar em silêncio: um aviso é emitido.
 *
 * ## O que isto NÃO decide
 *
 * Não decide se é justo. Um torneio em que metade entra direto na final é uma
 * configuração válida e péssima; a plataforma calcula, avisa o que for
 * aritmeticamente impossível, e deixa a decisão com quem organiza — que
 * conhece o regulamento, o patrocinador e o público.
 *
 * Lógica pura: sem React, sem Firebase.
 */

/** De onde saem os que entram direto. */
export const DIRECT_ENTRY_MODE = Object.freeze({
  /** Ninguém entra direto: todos começam na primeira fase. */
  NONE: 'none',
  /** Os N mais fortes (nível/ranking) entram direto nesta fase. */
  SEEDS: 'seeds',
  /** Uma lista escolhida a dedo pelo organizador. */
  MANUAL: 'manual',
});

export const DIRECT_ENTRY_MODE_LABELS = Object.freeze({
  [DIRECT_ENTRY_MODE.NONE]: 'Ninguém — todos começam na 1ª fase',
  [DIRECT_ENTRY_MODE.SEEDS]: 'Os melhores cabeças entram direto aqui',
  [DIRECT_ENTRY_MODE.MANUAL]: 'Uma lista que eu escolho',
});

export const DIRECT_ENTRY_MODE_HELP = Object.freeze({
  [DIRECT_ENTRY_MODE.NONE]:
    'O padrão: a fase é formada só pelos classificados da fase anterior.',
  [DIRECT_ENTRY_MODE.SEEDS]:
    'Os mais fortes (pelo nível/ranking usado no sorteio) pulam as fases anteriores e entram aqui. É o modelo de qualificatória: os cabeças esperam, os demais disputam as vagas.',
  [DIRECT_ENTRY_MODE.MANUAL]:
    'Você escolhe nome por nome. Serve para campeão defendendo título, convidado da organização ou qualquer critério que não seja o ranking.',
});

/**
 * Normaliza a configuração de entrada direta de UMA fase.
 * Campo aditivo: ausente ⇒ `none`, e nada muda.
 */
export function normalizeDirectEntry(raw = {}) {
  const modo = Object.values(DIRECT_ENTRY_MODE).includes(raw?.mode)
    ? raw.mode
    : DIRECT_ENTRY_MODE.NONE;
  const count = Math.max(0, Math.floor(Number(raw?.count)) || 0);
  const ids = Array.isArray(raw?.ids)
    ? [...new Set(raw.ids.map((i) => String(i || '').trim()).filter(Boolean))]
    : [];
  if (modo === DIRECT_ENTRY_MODE.NONE) return { mode: modo, count: 0, ids: [] };
  if (modo === DIRECT_ENTRY_MODE.SEEDS) return { mode: modo, count, ids: [] };
  return { mode: modo, count: ids.length, ids };
}

/** Está configurada para valer alguma coisa? */
export function hasDirectEntry(cfg) {
  const c = normalizeDirectEntry(cfg);
  if (c.mode === DIRECT_ENTRY_MODE.SEEDS) return c.count > 0;
  if (c.mode === DIRECT_ENTRY_MODE.MANUAL) return c.ids.length > 0;
  return false;
}

/** Força de um entrant (mais alto = mais forte). Sem nível ⇒ o fim da fila. */
function forcaDe(e) {
  const s = Number(e?.strength);
  return Number.isFinite(s) ? s : -1;
}

/**
 * Decide em que fase cada inscrito entra.
 *
 * @param {Array<{ id: string, strength?: number }>} entrants todos os
 *   confirmados da modalidade
 * @param {Array<object>} phases fases já normalizadas
 * @returns {{
 *   byPhase: Map<number, object[]>,
 *   phaseOfEntrant: Map<string, number>,
 *   warnings: Array<{ level: string, text: string }>,
 * }}
 *   `byPhase.get(0)` são os que começam do começo.
 */
export function planDirectEntries(entrants, phases) {
  const lista = Array.isArray(entrants) ? entrants.filter(Boolean) : [];
  const fases = Array.isArray(phases) ? phases : [];
  const warnings = [];
  const byPhase = new Map();
  const phaseOfEntrant = new Map();
  fases.forEach((_, i) => byPhase.set(i, []));
  if (byPhase.size === 0) byPhase.set(0, []);

  // Ordena por força uma vez só: é a fila de onde saem "os N melhores".
  const porForca = lista.slice().sort((a, b) => forcaDe(b) - forcaDe(a));
  const porId = new Map(lista.map((e) => [String(e.id), e]));

  // Percorre da fase MAIS CEDO para a mais tarde: quem já foi alocado não é
  // realocado, e é assim que "vale a entrada mais cedo" sai de graça.
  for (let i = 1; i < fases.length; i += 1) {
    const cfg = normalizeDirectEntry(fases[i]?.direct_entry);
    if (!hasDirectEntry(cfg)) continue;

    let escolhidos = [];
    if (cfg.mode === DIRECT_ENTRY_MODE.SEEDS) {
      escolhidos = porForca.filter((e) => !phaseOfEntrant.has(String(e.id))).slice(0, cfg.count);
      if (escolhidos.length < cfg.count) {
        warnings.push({
          level: 'warn',
          text: `Fase ${i + 1}: pedidos ${cfg.count} entrando direto, mas só ${escolhidos.length} inscrito(s) sobram para isso.`,
        });
      }
    } else {
      cfg.ids.forEach((id) => {
        const e = porId.get(String(id));
        if (!e) {
          warnings.push({
            level: 'warn',
            text: `Fase ${i + 1}: um dos escolhidos para entrar direto não está mais inscrito e foi ignorado.`,
          });
          return;
        }
        if (phaseOfEntrant.has(String(id))) {
          warnings.push({
            level: 'warn',
            text: `Fase ${i + 1}: ${e.label || id} já entra direto numa fase anterior — vale a entrada mais cedo.`,
          });
          return;
        }
        escolhidos.push(e);
      });
    }

    escolhidos.forEach((e) => phaseOfEntrant.set(String(e.id), i));
    byPhase.set(i, escolhidos);
  }

  // O resto começa do começo.
  const naPrimeira = lista.filter((e) => !phaseOfEntrant.has(String(e.id)));
  naPrimeira.forEach((e) => phaseOfEntrant.set(String(e.id), 0));
  byPhase.set(0, naPrimeira);

  if (lista.length > 0 && naPrimeira.length < 2) {
    warnings.push({
      level: 'error',
      text: `Sobram ${naPrimeira.length} inscrito(s) para a 1ª fase — ela precisa de ao menos 2. Reduza quem entra direto nas fases seguintes.`,
    });
  }

  return { byPhase, phaseOfEntrant, warnings };
}

/**
 * Explica, em texto, o que a configuração produz — para a tela poder mostrar
 * isso ANTES de sortear, que é quando ainda dá para mudar de ideia.
 *
 * @returns {Array<{ phase: number, label: string, count: number, text: string }>}
 */
export function describeDirectEntries(plan, phases) {
  const fases = Array.isArray(phases) ? phases : [];
  const saida = [];
  (plan?.byPhase || new Map()).forEach((lista, i) => {
    if (i === 0) {
      saida.push({
        phase: 0,
        label: fases[0]?.name || 'Fase 1',
        count: lista.length,
        text: `${lista.length} começam na 1ª fase.`,
      });
      return;
    }
    if (lista.length === 0) return;
    const puladas = i;
    saida.push({
      phase: i,
      label: fases[i]?.name || `Fase ${i + 1}`,
      count: lista.length,
      text: `${lista.length} entram direto na fase ${i + 1}, pulando ${puladas} fase(s).`,
    });
  });
  return saida.sort((a, b) => a.phase - b.phase);
}
