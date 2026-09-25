/**
 * "Precisa de você" — o que está esperando a ARENA agir, de todos os módulos
 * (lógica pura).
 *
 * A Central tem uma seção por assunto, e cada pendência mora na sua: reserva
 * para confirmar em Reservas, pedido do app para entregar em Pedidos, falta
 * para marcar em Presença, mensalidade atrasada em Membros. Quem abre a
 * Central de manhã não sabe por onde começar — e o que não está na aba aberta
 * espera até alguém lembrar. Aqui elas viram uma linha só, cada uma levando à
 * aba que resolve.
 *
 * ⚠️ Fonte `undefined` = não carregou ou FALHOU. O item dela não entra — nunca
 * vira "0": afirmar que não há pedido para entregar porque a consulta caiu é o
 * defeito de `docs/27-FALHA-NAO-E-VAZIO.md`. Pela mesma razão esta função não
 * diz "tudo em dia": ela só sabe o que CARREGOU.
 *
 * As contas são as MESMAS das abas (a faixa não pode dizer 3 e a aba mostrar
 * 5): pedido a entregar é o de `counterSummary`, falta a marcar é a de
 * `noShowCandidates`, mensalidade atrasada é a de `subscriptionState`.
 */
import { BOOKING_STATUS } from './constants.js';
import { bookingSlots } from './booking.js';
import { counterSummary } from './shop.js';
import { noShowCandidates } from './checkin.js';
import { SUBSCRIPTION_STATUS, subscriptionState } from './subscription.js';

const plural = (n, um, varios) => (n === 1 ? um : varios);

/**
 * Reserva solicitada que ainda vale confirmar: tem algum horário de hoje em
 * diante. Pedido de ontem não se confirma mais — ele fica na aba, mas não
 * "precisa de você" agora.
 */
function aConfirmar(bookings, hoje) {
  return bookings.filter((b) => b?.status === BOOKING_STATUS.REQUESTED
    && bookingSlots(b).some((s) => String(s?.date || '') >= hoje));
}

/**
 * @param {{ bookings?: object[], sales?: object[], subscriptions?: object[] }} fontes
 *   cada uma `undefined` quando não carregou ou falhou
 * @param {{ loja?: boolean, presenca?: boolean, mensalidade?: boolean }} ligados módulos da arena
 * @param {{ hoje: string, now?: Date }} quando `hoje` em YYYY-MM-DD
 * @returns {Array<{ id: string, count: number, label: string, aba: string }>}
 */
export function arenaPendingItems(fontes = {}, ligados = {}, { hoje, now = new Date() } = {}) {
  const itens = [];
  const { bookings, sales, subscriptions } = fontes;

  if (Array.isArray(bookings)) {
    const n = aConfirmar(bookings, hoje).length;
    if (n > 0) {
      itens.push({ id: 'reservas', count: n, aba: 'reservas',
        label: plural(n, 'reserva para confirmar', 'reservas para confirmar') });
    }
  }
  if (ligados.loja && Array.isArray(sales)) {
    const n = counterSummary(sales, hoje, () => '').aEntregar.length;
    if (n > 0) {
      itens.push({ id: 'pedidos', count: n, aba: 'pedidos',
        label: plural(n, 'pedido do app para entregar', 'pedidos do app para entregar') });
    }
  }
  if (ligados.presenca && Array.isArray(bookings)) {
    const n = noShowCandidates(bookings, hoje, now).length;
    if (n > 0) {
      itens.push({ id: 'faltas', count: n, aba: 'presenca',
        label: plural(n, 'falta para marcar hoje', 'faltas para marcar hoje') });
    }
  }
  if (ligados.mensalidade && Array.isArray(subscriptions)) {
    const n = subscriptions.filter((s) => subscriptionState(s, hoje).status === SUBSCRIPTION_STATUS.OVERDUE).length;
    if (n > 0) {
      itens.push({ id: 'mensalidades', count: n, aba: 'membros',
        label: plural(n, 'mensalidade em atraso', 'mensalidades em atraso') });
    }
  }
  return itens;
}
