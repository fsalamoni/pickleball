/**
 * Mensalidade da arena — domínio puro, sem I/O.
 *
 * ## O que é (e o que não é)
 *
 * É o plano mensal que a arena cobra de quem é de casa: um valor, um dia de
 * vencimento e o registro de quais meses foram pagos. O pagamento é **Pix
 * manual**, como o resto da plataforma: quem confirma que caiu é a arena.
 * Não há adquirente, não há cobrança automática, e este arquivo não pretende
 * que haja — prometer débito automático sem gateway seria mentir para os dois
 * lados.
 *
 * ## Por que os meses pagos são uma LISTA, e não um "pago até"
 *
 * "Pago até 10/08" perde a informação de quem pulou um mês e pagou o seguinte
 * — e é justamente esse caso que a arena precisa enxergar. Guardando
 * `paid_months: ['2026-06', '2026-08']`, a conta de atraso é exata e o
 * histórico fica auditável.
 */

/** Situação de uma mensalidade. */
export const SUBSCRIPTION_STATUS = Object.freeze({
  /** Em dia — o mês corrente está pago. */
  ACTIVE: 'active',
  /** Devendo — o mês corrente (ou anteriores) não foi pago. */
  OVERDUE: 'overdue',
  /** Encerrada pela arena ou pelo atleta. */
  CANCELLED: 'cancelled',
});

export const SUBSCRIPTION_STATUS_LABEL = Object.freeze({
  [SUBSCRIPTION_STATUS.ACTIVE]: 'Em dia',
  [SUBSCRIPTION_STATUS.OVERDUE]: 'Em atraso',
  [SUBSCRIPTION_STATUS.CANCELLED]: 'Encerrada',
});

/** 'YYYY-MM' de uma data ISO ('2026-08-13' → '2026-08'). */
export function monthKey(dateISO) {
  const m = String(dateISO || '').match(/^(\d{4})-(\d{2})/);
  return m ? `${m[1]}-${m[2]}` : '';
}

/** Hoje em 'YYYY-MM-DD', no fuso local. */
export function todayISO(now = new Date()) {
  const p = (n) => String(n).padStart(2, '0');
  return `${now.getFullYear()}-${p(now.getMonth() + 1)}-${p(now.getDate())}`;
}

/**
 * O dia de vencimento dentro de um mês, respeitando meses curtos.
 *
 * Vencimento no dia 31 em fevereiro não existe: cai no último dia do mês. Sem
 * isso a data viraria 03/03 e a mensalidade apareceria em atraso por engano.
 *
 * @param {string} mes 'YYYY-MM'
 * @param {number} dia 1–31
 * @returns {string} 'YYYY-MM-DD'
 */
export function dueDateForMonth(mes, dia) {
  const m = String(mes || '').match(/^(\d{4})-(\d{2})$/);
  if (!m) return '';
  const ano = Number(m[1]);
  const mesN = Number(m[2]);
  const ultimo = new Date(ano, mesN, 0).getDate();
  const d = Math.min(Math.max(1, Math.trunc(Number(dia) || 1)), ultimo);
  return `${m[1]}-${m[2]}-${String(d).padStart(2, '0')}`;
}

/**
 * Valida e normaliza o plano.
 * @returns {{ valid: boolean, errors: Object, value: Object }}
 */
export function normalizeSubscriptionInput(input = {}) {
  const errors = {};
  const planName = String(input.plan_name || '').trim();
  if (!planName) errors.plan_name = 'Dê um nome ao plano.';
  if (planName.length > 80) errors.plan_name = 'No máximo 80 caracteres.';

  const price = Number(input.price);
  if (!Number.isFinite(price) || price <= 0) errors.price = 'O valor deve ser maior que zero.';

  const billingDay = Math.trunc(Number(input.billing_day));
  if (!Number.isFinite(billingDay) || billingDay < 1 || billingDay > 28) {
    // Até 28 de propósito: 29, 30 e 31 não existem em todo mês, e um plano
    // cujo vencimento muda de dia conforme o mês confunde os dois lados.
    errors.billing_day = 'O dia de vencimento deve ser entre 1 e 28.';
  }

  return {
    valid: Object.keys(errors).length === 0,
    errors,
    value: {
      plan_name: planName,
      price: Number.isFinite(price) ? Math.round(price * 100) / 100 : 0,
      billing_day: Number.isFinite(billingDay) ? billingDay : 1,
      notes: String(input.notes || '').trim().slice(0, 300),
    },
  };
}

/** Os meses entre dois 'YYYY-MM', inclusive. Curto por construção. */
export function monthsBetween(de, ate) {
  const a = String(de || '').match(/^(\d{4})-(\d{2})$/);
  const b = String(ate || '').match(/^(\d{4})-(\d{2})$/);
  if (!a || !b) return [];
  const out = [];
  let ano = Number(a[1]);
  let mes = Number(a[2]);
  const fimAno = Number(b[1]);
  const fimMes = Number(b[2]);
  // Teto de 120 meses: uma mensalidade de dez anos já é caso de suporte.
  for (let i = 0; i < 120; i += 1) {
    if (ano > fimAno || (ano === fimAno && mes > fimMes)) break;
    out.push(`${ano}-${String(mes).padStart(2, '0')}`);
    mes += 1;
    if (mes > 12) { mes = 1; ano += 1; }
  }
  return out;
}

/**
 * A situação da mensalidade hoje.
 *
 * @param {object|null} sub
 * @param {string} [hoje] 'YYYY-MM-DD'
 * @returns {{
 *   status: string, label: string,
 *   currentMonth: string, dueDate: string,
 *   paidCurrent: boolean, unpaidMonths: string[], monthsLate: number,
 * }}
 */
export function subscriptionState(sub, hoje = todayISO()) {
  const mesAtual = monthKey(hoje);
  const vazio = {
    status: SUBSCRIPTION_STATUS.CANCELLED,
    label: SUBSCRIPTION_STATUS_LABEL[SUBSCRIPTION_STATUS.CANCELLED],
    currentMonth: mesAtual,
    dueDate: '',
    paidCurrent: false,
    unpaidMonths: [],
    monthsLate: 0,
  };
  if (!sub) return vazio;
  if (sub.status === SUBSCRIPTION_STATUS.CANCELLED) {
    return { ...vazio, dueDate: dueDateForMonth(mesAtual, sub.billing_day) };
  }

  const pagos = new Set(Array.isArray(sub.paid_months) ? sub.paid_months : []);
  const inicio = monthKey(sub.started_on) || mesAtual;
  // Os meses em aberto vão do início do plano até o mês corrente. O mês
  // corrente só entra quando o vencimento já passou — cobrar no dia 1 uma
  // mensalidade que vence no dia 10 é chamar de caloteiro quem está em dia.
  const vencimentoAtual = dueDateForMonth(mesAtual, sub.billing_day);
  const meses = monthsBetween(inicio, mesAtual)
    .filter((m) => (m === mesAtual ? hoje >= vencimentoAtual : true));
  const emAberto = meses.filter((m) => !pagos.has(m));

  const status = emAberto.length === 0 ? SUBSCRIPTION_STATUS.ACTIVE : SUBSCRIPTION_STATUS.OVERDUE;
  return {
    status,
    label: SUBSCRIPTION_STATUS_LABEL[status],
    currentMonth: mesAtual,
    dueDate: vencimentoAtual,
    paidCurrent: pagos.has(mesAtual),
    unpaidMonths: emAberto,
    monthsLate: emAberto.length,
  };
}

/** O total devido hoje (meses em aberto × valor do plano). */
export function amountDue(sub, hoje = todayISO()) {
  const { unpaidMonths } = subscriptionState(sub, hoje);
  const valor = Number(sub?.price) || 0;
  return Math.round(unpaidMonths.length * valor * 100) / 100;
}
