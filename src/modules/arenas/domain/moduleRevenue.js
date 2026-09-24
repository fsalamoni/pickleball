/**
 * O dinheiro dos MÓDULOS no mês — aulas, pacotes, mensalidades e torneios.
 *
 * O painel de métricas da arena somava reservas, PDV e mercado; o que entrava
 * pelos módulos integrados (Membros, Aulas, Torneios) não aparecia em lugar
 * nenhum — a arena vendia pacote, cobrava mensalidade e dava aula, e o "total
 * do mês" não sabia.
 *
 * Só entra no total o que foi **recebido**:
 *  - aula: matrícula marcada como paga, e só a parte que FICA com a arena
 *    (`arena_amount`) — o resto é do professor; o que falta receber aparece
 *    separado;
 *  - pacote: a venda registrada na carteira (quem registra é a arena, ao
 *    confirmar o pagamento);
 *  - mensalidade: o mês marcado como pago × o valor do plano.
 * O torneio da casa entra como **previsto** (inscrição × valor): a plataforma
 * não registra o pagamento da inscrição, e chamar isso de receita seria
 * inventar número.
 *
 * PURO. Sem I/O.
 */

const centavos = (n) => Math.round((Number(n) || 0) * 100) / 100;

/** Milissegundos de um Timestamp do Firestore, Date, número ou ISO. */
function ms(v) {
  if (v == null) return NaN;
  if (typeof v.toMillis === 'function') return v.toMillis();
  if (typeof v.toDate === 'function') return v.toDate().getTime();
  if (Number.isFinite(v?.seconds)) return v.seconds * 1000;
  if (v instanceof Date) return v.getTime();
  if (typeof v === 'number') return v;
  const t = Date.parse(String(v));
  return Number.isFinite(t) ? t : NaN;
}

/**
 * @param {{
 *   year: number, month: number,
 *   classes?: Array, classBookings?: Array, wallets?: Array,
 *   subscriptions?: Array, tournaments?: Array,
 * }} input
 */
export function moduleRevenue({
  year, month, classes = [], classBookings = [], wallets = [], subscriptions = [], tournaments = [],
} = {}) {
  const mes = `${year}-${String(month).padStart(2, '0')}`;
  const noMes = (iso) => String(iso || '').startsWith(mes);

  // Aulas — pela DATA da aula (é quando o serviço aconteceu).
  const aulaPorId = new Map((classes || []).map((c) => [c.id, c]));
  const aulas = { recebido: 0, arena: 0, aReceber: 0, alunos: 0 };
  (classBookings || []).forEach((b) => {
    const aula = aulaPorId.get(b?.class_id);
    if (!aula || !noMes(aula.date) || aula.status === 'cancelled') return;
    aulas.alunos += 1;
    if (b.paid) {
      aulas.recebido += Number(b.amount) || 0;
      aulas.arena += Number(b.arena_amount) || 0;
    } else {
      aulas.aReceber += Number(b.amount) || 0;
    }
  });

  // Pacotes — pela data da VENDA (a transação na carteira).
  const pacotes = { valor: 0, vendidos: 0 };
  (wallets || []).forEach((w) => (Array.isArray(w?.transactions) ? w.transactions : []).forEach((t) => {
    if (t?.type !== 'package_purchase') return;
    const quando = ms(t.at);
    if (!Number.isFinite(quando)) return;
    const d = new Date(quando);
    if (d.getFullYear() !== year || d.getMonth() + 1 !== month) return;
    pacotes.valor += Number(t.amount) || 0;
    pacotes.vendidos += 1;
  }));

  // Mensalidades — o mês marcado como pago.
  const mensalidades = { recebido: 0, pagantes: 0 };
  (subscriptions || []).forEach((s) => {
    if (!Array.isArray(s?.paid_months) || !s.paid_months.includes(mes)) return;
    mensalidades.recebido += Number(s.price) || 0;
    mensalidades.pagantes += 1;
  });

  // Torneios da casa — previsto, nunca somado ao recebido.
  const torneios = { previsto: 0, inscritos: 0, quantos: 0 };
  (tournaments || []).forEach((t) => {
    if (!noMes(t?.date) || t.status === 'cancelled') return;
    const inscritos = Math.max(0, Number(t.enrolled) || 0);
    torneios.quantos += 1;
    torneios.inscritos += inscritos;
    torneios.previsto += inscritos * (Number(t.entry_fee) || 0);
  });

  const recebido = aulas.arena + pacotes.valor + mensalidades.recebido;
  return {
    aulas: {
      recebido: centavos(aulas.recebido), arena: centavos(aulas.arena),
      aReceber: centavos(aulas.aReceber), alunos: aulas.alunos,
    },
    pacotes: { valor: centavos(pacotes.valor), vendidos: pacotes.vendidos },
    mensalidades: { recebido: centavos(mensalidades.recebido), pagantes: mensalidades.pagantes },
    torneios: { previsto: centavos(torneios.previsto), inscritos: torneios.inscritos, quantos: torneios.quantos },
    recebido: centavos(recebido),
  };
}
