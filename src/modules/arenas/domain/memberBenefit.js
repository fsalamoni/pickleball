/**
 * O benefício do membro chegando ao PREÇO — o elo que faltava.
 *
 * PURO, sem I/O.
 *
 * ## Por que este arquivo existe
 *
 * O módulo de membros já sabia calcular níveis ("Ouro dá 10% de desconto") e
 * já vendia pacotes de horas. Só que **nada disso chegava à reserva**: o preço
 * saía de `totalBookingPrice(arena, …)`, que não conhece membro, e o pacote de
 * horas era um saldo que ninguém debitava. Um desconto que não desconta e um
 * pacote que não abate são promessas sem efeito — e a arena descobre isso
 * quando o membro reclama.
 *
 * Aqui a conta é feita numa ordem, e a ordem importa:
 *
 *   1. **preço de tabela** — o que `totalBookingPrice` já devolve;
 *   2. **horas do pacote** — abatem HORAS, não reais: consumir 1h de um pacote
 *      tira o valor daquela hora, não um percentual;
 *   3. **desconto do nível** — percentual sobre o que sobrou;
 *   4. **cupom** — sobre o que sobrou depois do nível;
 *   5. **saldo da carteira** — abate reais, até zerar.
 *
 * Pacote antes de desconto de propósito: a hora do pacote já foi paga, e
 * aplicar percentual sobre ela seria dar desconto duas vezes. E o cupom vem
 * depois do nível pela mesma razão conservadora: o membro não acumula dois
 * percentuais cheios, e a arena consegue prever o pior caso de uma promoção.
 *
 * ## O que este arquivo NÃO faz
 *
 * Não grava nada e não decide sozinho. Quem escreve é o serviço, que **refaz a
 * conta antes de gravar** — a tela estima, quem grava confere. É a mesma regra
 * que já vale para o preço da reserva (`precoDaReserva`).
 */

import { DEFAULT_TIERS, MEMBER_STATUS, computeTier } from './members.js';
import { couponDiscount, couponLabel } from './marketing.js';
import { totalBookingPrice } from './pricing.js';

/** Arredonda em centavos, sem a sujeira do ponto flutuante. */
function centavos(v) {
  const n = Number(v);
  return Number.isFinite(n) ? Math.round(n * 100) / 100 : 0;
}

/** O membro está valendo? Pausado, cancelado ou expirado não tem benefício. */
export function isMemberActive(member) {
  return Boolean(member) && (member.status || MEMBER_STATUS.ACTIVE) === MEMBER_STATUS.ACTIVE;
}

/**
 * A configuração de níveis desta arena, ou a padrão.
 * Ignora entrada malformada — nível sem `min_points` numérico não entra.
 * @param {Array<object>|null|undefined} raw
 * @returns {Array<object>}
 */
export function normalizeTiers(raw) {
  const lista = (Array.isArray(raw) ? raw : [])
    .filter((t) => t && typeof t.id === 'string' && Number.isFinite(Number(t.min_points)))
    .map((t) => ({
      id: t.id,
      name: String(t.name || t.id),
      min_points: Math.max(0, Number(t.min_points)),
      discount_pct: Math.min(100, Math.max(0, Number(t.discount_pct) || 0)),
      color: t.color || 'slate',
      perks: Array.isArray(t.perks) ? t.perks.map(String) : [],
    }));
  return lista.length > 0 ? lista : DEFAULT_TIERS.map((t) => ({ ...t }));
}

/**
 * O nível do membro nesta arena e o desconto que ele dá.
 * @param {object|null} member
 * @param {Array<object>} [tiers]
 * @returns {{ tier: object|null, discountPct: number }}
 */
export function memberTier(member, tiers = DEFAULT_TIERS) {
  if (!isMemberActive(member)) return { tier: null, discountPct: 0 };
  const lista = normalizeTiers(tiers);
  const tier = computeTier(Number(member.points) || 0, lista);
  return { tier: tier || null, discountPct: Number(tier?.discount_pct) || 0 };
}

/**
 * Quanto falta para o próximo nível — o número que faz o membro voltar.
 * No topo, devolve `null` em `next`.
 * @returns {{ current: object|null, next: object|null, missing: number, progress: number }}
 */
export function tierProgress(member, tiers = DEFAULT_TIERS) {
  const lista = normalizeTiers(tiers).sort((a, b) => a.min_points - b.min_points);
  const pontos = Math.max(0, Number(member?.points) || 0);
  const current = computeTier(pontos, lista) || lista[0];
  const next = lista.find((t) => t.min_points > pontos) || null;
  if (!next) return { current, next: null, missing: 0, progress: 100 };
  const base = current?.min_points || 0;
  const faixa = Math.max(1, next.min_points - base);
  return {
    current,
    next,
    missing: Math.max(0, next.min_points - pontos),
    progress: Math.min(100, Math.round(((pontos - base) / faixa) * 100)),
  };
}

/** Horas que um pacote ainda tem, considerando validade. */
export function usableHours(pkg, now = Date.now()) {
  if (!pkg) return 0;
  // Ausência de validade é "não vence" — e `Number(null)` é 0, que passaria
  // por "venceu em 1970" e zeraria um pacote perfeitamente válido.
  const bruto = pkg.expires_at;
  if (bruto != null && bruto !== '') {
    const expira = bruto instanceof Date ? bruto.getTime() : Number(bruto);
    if (Number.isFinite(expira) && expira <= now) return 0;
  }
  return Math.max(0, (Number(pkg.total_hours) || 0) - (Number(pkg.used_hours) || 0));
}

/**
 * A duração total, em horas, de uma seleção de horários.
 * @param {Array<{start?: string, end?: string}>} slots
 */
export function slotsHours(slots = []) {
  const min = (t) => {
    const m = String(t || '').match(/^(\d{1,2}):(\d{2})$/);
    return m ? Number(m[1]) * 60 + Number(m[2]) : null;
  };
  return (slots || []).reduce((acc, s) => {
    const a = min(s?.start);
    const b = min(s?.end);
    return acc + (a != null && b != null && b > a ? (b - a) / 60 : 0);
  }, 0);
}

/**
 * O preço final para ESTE membro, com o detalhamento de cada abatimento.
 *
 * O detalhamento não é enfeite: sem ele o atleta vê um número diferente do da
 * tabela e não sabe por quê — e a arena não sabe explicar.
 *
 * @param {object} arena
 * @param {{ courtId?: string|null, slots?: Array, clientId?: string|null }} selecao
 * @param {{
 *   member?: object|null,
 *   tiers?: Array<object>,
 *   packages?: Array<object>,
 *   wallet?: object|null,
 *   coupon?: object|null,
 *   useWallet?: boolean,
 *   usePackage?: boolean,
 *   now?: number,
 * }} [contexto]
 * @returns {{
 *   table: number, total: number, hours: number,
 *   packageHours: number, packageValue: number,
 *   discountPct: number, discountValue: number,
 *   couponValue: number, couponCode: string|null,
 *   walletValue: number, tier: object|null,
 *   lines: Array<{ label: string, value: number }>,
 * }}
 */
export function memberBookingPrice(arena, selecao = {}, contexto = {}) {
  const {
    member = null, tiers = DEFAULT_TIERS, packages = [], wallet = null,
    coupon = null,
    useWallet = true, usePackage = true, now = Date.now(),
  } = contexto;

  // As horas saem da MESMA conta do preço: `totalBookingPrice` descarta slot
  // inválido, e contar por fora daria uma duração que não corresponde ao valor.
  const { total: tabela, hours: horas } = totalBookingPrice(arena, selecao);
  const lines = [{ label: 'Valor da tabela', value: centavos(tabela) }];

  const ativo = isMemberActive(member);
  const { tier, discountPct } = memberTier(member, tiers);

  // 1. Pacote: abate HORAS. O valor da hora é o preço médio da seleção — usar
  //    o preço de uma faixa específica daria margem a escolher a hora mais
  //    cara para abater.
  let horasPacote = 0;
  let valorPacote = 0;
  if (ativo && usePackage && horas > 0 && tabela > 0) {
    const disponiveis = (packages || []).reduce((acc, p) => acc + usableHours(p, now), 0);
    horasPacote = Math.min(horas, disponiveis);
    if (horasPacote > 0) {
      valorPacote = centavos((tabela / horas) * horasPacote);
      lines.push({ label: `Pacote (${horasPacote}h)`, value: -valorPacote });
    }
  }

  const aposPacote = Math.max(0, centavos(tabela - valorPacote));

  // 2. Desconto do nível, sobre o que sobrou.
  const valorDesconto = discountPct > 0 ? centavos(aposPacote * (discountPct / 100)) : 0;
  if (valorDesconto > 0) {
    lines.push({ label: `Desconto ${tier?.name || 'membro'} (${discountPct}%)`, value: -valorDesconto });
  }

  const aposDesconto = Math.max(0, centavos(aposPacote - valorDesconto));

  // 3. Cupom — vale para QUALQUER pessoa, membro ou não. É promoção da arena,
  //    não benefício de membro; condicioná-lo a ser membro esvaziaria o uso
  //    mais comum (trazer gente nova).
  const valorCupom = coupon ? couponDiscount(aposDesconto, coupon) : 0;
  if (valorCupom > 0) {
    lines.push({ label: couponLabel(coupon) || 'Cupom', value: -valorCupom });
  }

  const aposCupom = Math.max(0, centavos(aposDesconto - valorCupom));

  // 4. Carteira: abate reais, até zerar.
  let valorCarteira = 0;
  if (ativo && useWallet && aposCupom > 0) {
    const saldo = Math.max(0, Number(wallet?.balance) || 0);
    valorCarteira = centavos(Math.min(saldo, aposCupom));
    if (valorCarteira > 0) lines.push({ label: 'Saldo em carteira', value: -valorCarteira });
  }

  const total = Math.max(0, centavos(aposCupom - valorCarteira));

  return {
    table: centavos(tabela),
    total,
    hours: horas,
    packageHours: horasPacote,
    packageValue: valorPacote,
    discountPct,
    discountValue: valorDesconto,
    couponValue: valorCupom,
    couponCode: valorCupom > 0 ? (coupon?.code || null) : null,
    walletValue: valorCarteira,
    tier,
    lines,
  };
}

/* ------------------------------------------------------------------ */
/*  Pontos                                                             */
/* ------------------------------------------------------------------ */

/** Quanto vale, em pontos, cada real gasto. Um por real, arredondado. */
export const PONTOS_POR_REAL = 1;

/** Pontos por hora jogada, mesmo em reserva de graça (cortesia, pacote). */
export const PONTOS_POR_HORA = 10;

/**
 * Os pontos que uma reserva concluída vale.
 *
 * Conta gasto E presença: quem usa pacote pagou antes e continua vindo — não
 * pontuar essa visita puniria justamente o cliente mais fiel.
 *
 * @param {{ amount?: number, hours?: number }} reserva
 * @returns {number} inteiro, nunca negativo
 */
export function pointsForBooking({ amount = 0, hours = 0 } = {}) {
  const porReal = Math.max(0, Number(amount) || 0) * PONTOS_POR_REAL;
  const porHora = Math.max(0, Number(hours) || 0) * PONTOS_POR_HORA;
  return Math.max(0, Math.round(porReal + porHora));
}

/**
 * O que consumir de cada pacote para cobrir `horas`, na ordem certa:
 * **o que vence antes sai primeiro** — senão o pacote velho expira com saldo
 * enquanto o novo é gasto.
 *
 * @param {Array<object>} packages
 * @param {number} horas
 * @param {number} [now]
 * @returns {Array<{ id: string, hours: number }>}
 */
export function planPackageConsumption(packages = [], horas = 0, now = Date.now()) {
  let restante = Math.max(0, Number(horas) || 0);
  if (restante === 0) return [];
  return (packages || [])
    .filter((p) => usableHours(p, now) > 0)
    .sort((a, b) => {
      const va = a.expires_at instanceof Date ? a.expires_at.getTime() : Number(a.expires_at) || Infinity;
      const vb = b.expires_at instanceof Date ? b.expires_at.getTime() : Number(b.expires_at) || Infinity;
      return va - vb;
    })
    .reduce((plano, p) => {
      if (restante <= 0) return plano;
      const usa = Math.min(restante, usableHours(p, now));
      restante -= usa;
      return usa > 0 ? [...plano, { id: p.id, hours: usa }] : plano;
    }, []);
}
