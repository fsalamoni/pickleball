/**
 * Domínio: Operações da arena — checklist, manutenção e equipe.
 *
 * PURO, sem I/O.
 *
 * ## O que faltava
 *
 * **O checklist não era uma ROTINA.** Ele era criado uma vez e os itens eram
 * marcados para sempre: a rotina de fechamento cumprida na segunda continuava
 * "concluída" na terça, e a arena não tinha como responder a única pergunta
 * que importa de manhã — *hoje a abertura foi feita?*. Um checklist que não
 * recomeça é uma lista de compras antiga.
 *
 * **A manutenção não fechava a quadra**, embora o catálogo prometesse. A ordem
 * não tinha quadra nem janela de tempo; era um bilhete. Trocar o piso da
 * quadra 2 na quinta não impedia ninguém de reservar a quadra 2 na quinta.
 *
 * Aqui estão as duas regras, puras e testadas. O que grava é o serviço.
 */

export const CHECKLIST_KIND = Object.freeze({
  OPENING: 'opening',
  CLOSING: 'closing',
  MAINTENANCE: 'maintenance',
});

export const MAINTENANCE_STATUS = Object.freeze({
  PENDING: 'pending',
  IN_PROGRESS: 'in_progress',
  DONE: 'done',
  CANCELLED: 'cancelled',
});

export const MAINTENANCE_PRIORITY = Object.freeze({
  LOW: 'low',
  MEDIUM: 'medium',
  HIGH: 'high',
  URGENT: 'urgent',
});

/** Normaliza item de checklist. */
export function normalizeChecklistItem(input = {}) {
  return {
    title: String(input.title || '').trim().slice(0, 200),
    description: String(input.description || '').trim().slice(0, 500),
    required: input.required !== false,
    order: Number(input.order) || 0,
  };
}

const DATA_ISO = /^\d{4}-\d{2}-\d{2}$/;
const HORA = /^\d{2}:\d{2}$/;

/**
 * Normaliza ordem de manutenção.
 *
 * Ganhou quadra e janela de tempo: sem isso a ordem era um bilhete, e trocar o
 * piso da quadra 2 na quinta não impedia ninguém de reservar a quadra 2 na
 * quinta. Os campos são OPCIONAIS — ordem sem `blocks_court` continua sendo o
 * bilhete de antes, que é o que se quer para "comprar lâmpadas".
 */
export function normalizeMaintenanceInput(input = {}) {
  const errors = {};
  const title = String(input.title || '').trim();
  if (!title) errors.title = 'Título obrigatório.';
  if (title.length > 200) errors.title = 'Máx. 200 chars.';

  const fecha = Boolean(input.blocks_court);
  const inicio = DATA_ISO.test(String(input.starts_on || '')) ? input.starts_on : null;
  const fim = DATA_ISO.test(String(input.ends_on || '')) ? input.ends_on : null;
  const horaIni = HORA.test(String(input.start_time || '')) ? input.start_time : '00:00';
  const horaFim = HORA.test(String(input.end_time || '')) ? input.end_time : '23:59';

  // Fechar a quadra é a parte que afeta o dinheiro da arena. Se a pessoa
  // marcou "fechar" e não disse quando, é erro — e não um bloqueio silencioso
  // de data nenhuma (que pareceria ter funcionado).
  if (fecha && !inicio) errors.starts_on = 'Diga a partir de que dia a quadra fica fechada.';
  if (fecha && fim && fim < inicio) errors.ends_on = 'O fim não pode ser antes do início.';
  if (fecha && horaFim <= horaIni) errors.end_time = 'O horário final tem que ser depois do inicial.';
  if (fecha && inicio) {
    const dias = maintenanceDates({ starts_on: inicio, ends_on: fim });
    if (fim && fim > dias[dias.length - 1]) {
      errors.ends_on = `No máximo ${MAINTENANCE_MAX_DAYS} dias de uma vez.`;
    }
  }

  return {
    valid: Object.keys(errors).length === 0,
    errors,
    value: {
      title,
      description: String(input.description || '').trim().slice(0, 1000),
      priority: Object.values(MAINTENANCE_PRIORITY).includes(input.priority) ? input.priority : MAINTENANCE_PRIORITY.MEDIUM,
      status: Object.values(MAINTENANCE_STATUS).includes(input.status)
        ? input.status
        : MAINTENANCE_STATUS.PENDING,
      due_date: input.due_date || null,
      /** Quadra afetada. `null` = a arena inteira. */
      court_id: String(input.court_id || '').trim() || null,
      /** A ordem tira a quadra da venda? */
      blocks_court: fecha,
      starts_on: fecha ? inicio : null,
      ends_on: fecha ? (fim || inicio) : null,
      start_time: fecha ? horaIni : null,
      end_time: fecha ? horaFim : null,
    },
  };
}

/** Calcula % de conclusão de checklist. */
export function checklistProgress(items = []) {
  if (items.length === 0) return 0;
  const done = items.filter((i) => i.completed).length;
  return Math.round((done / items.length) * 100);
}


/* ================================================================== */
/*  Checklist: a rotina do DIA                                        */
/* ================================================================== */

/** Quantos dias de histórico o documento guarda. */
export const CHECKLIST_HISTORY_MAX = 30;

export const CHECKLIST_KIND_META = Object.freeze({
  [CHECKLIST_KIND.OPENING]: { label: 'Abertura', hint: 'O que precisa estar pronto antes de o primeiro jogador chegar.' },
  [CHECKLIST_KIND.CLOSING]: { label: 'Fechamento', hint: 'O que não pode ficar para amanhã depois do último jogo.' },
  [CHECKLIST_KIND.MAINTENANCE]: { label: 'Manutenção', hint: 'A conferência periódica de quadra e equipamento.' },
});

/**
 * O estado do checklist HOJE.
 *
 * A chave é `run_date`: quando ele não é o dia de hoje, os itens marcados são
 * de OUTRO dia e não valem como cumpridos. A tela nunca deve mostrar o
 * checkmark de ontem como se fosse de hoje — foi exatamente esse o defeito.
 *
 * Checklist NÃO recorrente (`recurring: false`) é uma lista de tarefas comum:
 * o que foi marcado fica marcado, e não há "dia" nenhum.
 *
 * @param {object|null} checklist
 * @param {string} todayISO 'YYYY-MM-DD'
 * @returns {{
 *   recurring: boolean, runDate: string|null, freshDay: boolean,
 *   items: Array<object>, total: number, done: number, progress: number,
 *   pendingRequired: number, complete: boolean,
 * }}
 */
export function checklistRunState(checklist, todayISO) {
  const recurring = checklist?.recurring !== false;
  const runDate = checklist?.run_date || null;
  // Dia novo: o que foi marcado pertence ao dia anterior.
  const freshDay = recurring && runDate !== todayISO;

  const brutos = Array.isArray(checklist?.items) ? checklist.items : [];
  const items = freshDay
    ? brutos.map((i) => ({ ...i, completed: false, completed_at: null, completed_by: null }))
    : brutos;

  const total = items.length;
  const done = items.filter((i) => i.completed).length;
  const pendingRequired = items.filter((i) => i.required !== false && !i.completed).length;

  return {
    recurring,
    runDate,
    freshDay,
    items,
    total,
    done,
    progress: checklistProgress(items),
    pendingRequired,
    complete: total > 0 && done === total,
  };
}

/**
 * O corpo do documento para começar o dia: itens limpos, `run_date` de hoje e
 * o dia anterior guardado no histórico.
 *
 * O histórico é o que transforma o checklist numa PROVA — "a abertura de
 * sábado foi cumprida às 6h47 pelo João" — e não só numa lista. É limitado a
 * 30 entradas porque documento do Firestore tem teto de 1 MB e um registro que
 * cresce para sempre um dia deixa de salvar, em silêncio.
 *
 * @param {object} checklist
 * @param {string} todayISO
 * @returns {object|null} `null` quando não há nada a fazer (já é o dia de hoje)
 */
export function startChecklistDay(checklist, todayISO) {
  if (!checklist || checklist.recurring === false) return null;
  if (checklist.run_date === todayISO) return null;

  const anteriores = Array.isArray(checklist.items) ? checklist.items : [];
  const historico = Array.isArray(checklist.history) ? checklist.history : [];

  // Só guarda o dia que EXISTIU: um checklist recém-criado não tem passado, e
  // uma linha de "0%" que nunca aconteceu mentiria no relatório.
  const registro = checklist.run_date
    ? [{
      date: checklist.run_date,
      progress: checklistProgress(anteriores),
      done: anteriores.filter((i) => i.completed).length,
      total: anteriores.length,
    }]
    : [];

  return {
    run_date: todayISO,
    items: anteriores.map((i) => ({
      ...i, completed: false, completed_at: null, completed_by: null,
    })),
    completed_pct: 0,
    history: [...historico, ...registro].slice(-CHECKLIST_HISTORY_MAX),
  };
}

/**
 * O resumo da manhã: o que está pendente HOJE, entre todos os checklists.
 *
 * É o que a Central da arena mostra sem ninguém pedir. Sem isso a informação
 * existe e ninguém a procura — e checklist que ninguém abre não é rotina.
 *
 * @param {Array<object>} checklists
 * @param {string} todayISO
 * @returns {{ total: number, pendentes: Array<{ id: string, title: string, kind: string, pending: number }> }}
 */
export function checklistsPendingToday(checklists = [], todayISO) {
  const pendentes = (checklists || [])
    .filter((c) => c && c.active !== false)
    .map((c) => {
      const estado = checklistRunState(c, todayISO);
      const pending = estado.total - estado.done;
      return { id: c.id, title: c.title || 'Checklist', kind: c.kind, pending, total: estado.total };
    })
    .filter((c) => c.total > 0 && c.pending > 0);
  return { total: pendentes.reduce((a, c) => a + c.pending, 0), pendentes };
}

/* ================================================================== */
/*  Manutenção: a ordem que FECHA a quadra                            */
/* ================================================================== */

export const MAINTENANCE_STATUS_META = Object.freeze({
  [MAINTENANCE_STATUS.PENDING]: { label: 'Pendente', tone: 'amber' },
  [MAINTENANCE_STATUS.IN_PROGRESS]: { label: 'Em andamento', tone: 'blue' },
  [MAINTENANCE_STATUS.DONE]: { label: 'Concluída', tone: 'green' },
  [MAINTENANCE_STATUS.CANCELLED]: { label: 'Cancelada', tone: 'neutral' },
});

export const MAINTENANCE_PRIORITY_META = Object.freeze({
  [MAINTENANCE_PRIORITY.LOW]: { label: 'Baixa', tone: 'neutral' },
  [MAINTENANCE_PRIORITY.MEDIUM]: { label: 'Média', tone: 'blue' },
  [MAINTENANCE_PRIORITY.HIGH]: { label: 'Alta', tone: 'amber' },
  [MAINTENANCE_PRIORITY.URGENT]: { label: 'Urgente', tone: 'red' },
});

/** A ordem ainda está viva? Concluída e cancelada não bloqueiam nada. */
export function isMaintenanceOpen(order) {
  const s = order?.status || MAINTENANCE_STATUS.PENDING;
  return s === MAINTENANCE_STATUS.PENDING || s === MAINTENANCE_STATUS.IN_PROGRESS;
}

/** 'YYYY-MM-DD' + n dias, sem depender do fuso da máquina. */
function somaDias(iso, n) {
  const [a, m, d] = String(iso).split('-').map(Number);
  const base = Date.UTC(a, (m || 1) - 1, d || 1) + n * 86_400_000;
  const dt = new Date(base);
  const p = (x) => String(x).padStart(2, '0');
  return `${dt.getUTCFullYear()}-${p(dt.getUTCMonth() + 1)}-${p(dt.getUTCDate())}`;
}

/** Máximo de dias que uma ordem pode fechar de uma vez. */
export const MAINTENANCE_MAX_DAYS = 60;

/**
 * Os dias que a ordem cobre, do início ao fim (inclusive).
 * Sem `ends_on`, é um dia só. Fim antes do início não inverte a conta — é
 * entrada inválida, e devolver o intervalo ao contrário fecharia a quadra por
 * dois meses sem ninguém pedir.
 */
export function maintenanceDates(order) {
  const inicio = order?.starts_on;
  if (!inicio || !/^\d{4}-\d{2}-\d{2}$/.test(String(inicio))) return [];
  const fim = order?.ends_on && /^\d{4}-\d{2}-\d{2}$/.test(String(order.ends_on))
    ? order.ends_on
    : inicio;
  if (fim < inicio) return [inicio];
  const dias = [];
  for (let d = inicio; d <= fim && dias.length < MAINTENANCE_MAX_DAYS; d = somaDias(d, 1)) {
    dias.push(d);
  }
  return dias;
}

/**
 * Os bloqueios de calendário que ESTA ordem implica.
 *
 * ## Por que aqui a cópia é gravada, e no dia de jogo é derivada
 *
 * O dia de jogo é público: qualquer pessoa lê o documento, então a tela do
 * atleta consegue DERIVAR o bloqueio da fonte. A ordem de manutenção é
 * privada da arena (`allow read: if isArenaManager`) — e tem que ser, porque
 * "trocar a fechadura do vestiário" não é assunto de quem vai jogar. O atleta
 * nunca conseguiria derivar nada dela.
 *
 * Então aqui a verdade que o calendário público enxerga é a cópia gravada em
 * `arena_unavailabilities`, que é legível por todos e não conta o motivo — só
 * diz que a quadra está fechada. O serviço mantém a cópia em dia: criar,
 * editar, concluir e cancelar sincronizam.
 *
 * Sem `court_id` o bloqueio vale para a ARENA INTEIRA — é o mesmo contrato do
 * resto do sistema, e é o que se quer numa dedetização.
 *
 * @param {object} order
 * @returns {Array<object>} payloads no formato de `arena_unavailabilities`
 */
export function maintenanceBlockPayloads(order) {
  if (!order?.arena_id) return [];
  if (!order.blocks_court) return [];
  if (!isMaintenanceOpen(order)) return [];
  const inicio = order.start_time || '00:00';
  const fim = order.end_time || '23:59';
  if (fim <= inicio) return [];
  return maintenanceDates(order).map((date) => ({
    arena_id: order.arena_id,
    court_id: order.court_id || null,
    date,
    start_time: inicio,
    end_time: fim,
    source: 'maintenance',
    maintenance_id: order.id,
    // O motivo NÃO vai junto: este documento é público. "Manutenção" basta
    // para o atleta entender por que o horário não está à venda.
    notes: 'Manutenção programada',
  }));
}

/* ================================================================== */
/*  Equipe                                                            */
/* ================================================================== */

export const STAFF_ROLE = Object.freeze({
  MANAGER: 'manager',
  RECEPTION: 'reception',
  MAINTENANCE: 'maintenance',
  CLEANING: 'cleaning',
  COACH: 'coach',
  OTHER: 'other',
});

export const STAFF_ROLE_META = Object.freeze({
  [STAFF_ROLE.MANAGER]: { label: 'Gerência' },
  [STAFF_ROLE.RECEPTION]: { label: 'Recepção' },
  [STAFF_ROLE.MAINTENANCE]: { label: 'Manutenção' },
  [STAFF_ROLE.CLEANING]: { label: 'Limpeza' },
  [STAFF_ROLE.COACH]: { label: 'Professor' },
  [STAFF_ROLE.OTHER]: { label: 'Outros' },
});

export const STAFF_SHIFT = Object.freeze({
  MORNING: 'morning',
  AFTERNOON: 'afternoon',
  NIGHT: 'night',
  FULL: 'full',
});

export const STAFF_SHIFT_META = Object.freeze({
  [STAFF_SHIFT.MORNING]: { label: 'Manhã', from: '06:00', to: '12:00' },
  [STAFF_SHIFT.AFTERNOON]: { label: 'Tarde', from: '12:00', to: '18:00' },
  [STAFF_SHIFT.NIGHT]: { label: 'Noite', from: '18:00', to: '23:59' },
  [STAFF_SHIFT.FULL]: { label: 'Dia inteiro', from: '00:00', to: '23:59' },
});

export const STAFF_MAX = 40;

/**
 * Um membro da equipe.
 *
 * **Sem e-mail, sem telefone, sem documento.** A equipe é gente, e o princípio
 * 10 vale aqui como em qualquer lugar: dado de contato só entra em coleção com
 * leitura restrita e quando serve para alguma coisa. Para dizer quem estava de
 * plantão bastam nome, função e turno. Quem trabalha na arena e tem conta na
 * plataforma pode ser vinculado por `user_id` — e aí o contato já existe no
 * lugar certo, que é o perfil da pessoa.
 *
 * @param {object} input
 * @returns {{ valid: boolean, errors: object, value: object }}
 */
export function normalizeStaffMember(input = {}) {
  const errors = {};
  const name = String(input.name || '').trim().slice(0, 80);
  if (!name) errors.name = 'Diga o nome de quem trabalha aqui.';
  const role = Object.values(STAFF_ROLE).includes(input.role) ? input.role : STAFF_ROLE.OTHER;
  const shift = Object.values(STAFF_SHIFT).includes(input.shift) ? input.shift : STAFF_SHIFT.FULL;
  return {
    valid: Object.keys(errors).length === 0,
    errors,
    value: {
      id: String(input.id || '').trim() || null,
      name,
      role,
      shift,
      user_id: String(input.user_id || '').trim() || null,
      active: input.active !== false,
      notes: String(input.notes || '').trim().slice(0, 120),
    },
  };
}

/**
 * Quem está de plantão a esta hora.
 *
 * A pergunta que essa lista responde não é "quem trabalha aqui" (isso o dono
 * já sabe) — é **"quem estava aqui quando aquilo aconteceu"**. Por isso a
 * conta é por HORA, não por dia.
 *
 * @param {Array<object>} staff
 * @param {string} [hhmm] 'HH:MM'; ausente, usa a hora atual
 * @returns {Array<object>}
 */
export function staffOnDuty(staff = [], hhmm = null) {
  const agora = hhmm || (() => {
    const d = new Date();
    const p = (n) => String(n).padStart(2, '0');
    return `${p(d.getHours())}:${p(d.getMinutes())}`;
  })();
  return (staff || [])
    .filter((m) => m && m.active !== false)
    .filter((m) => {
      const janela = STAFF_SHIFT_META[m.shift] || STAFF_SHIFT_META[STAFF_SHIFT.FULL];
      return agora >= janela.from && agora <= janela.to;
    });
}

/** A equipe agrupada por função, na ordem do `STAFF_ROLE_META`. */
export function staffByRole(staff = []) {
  return Object.keys(STAFF_ROLE_META)
    .map((role) => ({
      role,
      label: STAFF_ROLE_META[role].label,
      people: (staff || []).filter((m) => (m?.role || STAFF_ROLE.OTHER) === role),
    }))
    .filter((g) => g.people.length > 0);
}
