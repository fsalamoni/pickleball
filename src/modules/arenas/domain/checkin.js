/**
 * Domínio: check-in de chegada na arena (módulo `iot_qr_kiosk`).
 *
 * O catálogo promete à arena "presença confirmada sem ninguém no balcão — e
 * no-show medido de verdade", e ao atleta "chegou, apontou a câmera, entrou".
 * Nada disso existia: o único registro de presença da plataforma era o gestor
 * marcando `no_show` na mão, depois, de memória.
 *
 * **Zero coleção nova.** A chegada é um campo aditivo na própria reserva
 * (`arena_bookings.checked_in_at`), que o atleta já pode escrever pela regra —
 * e o gestor também. O totem é um `arena_devices` de tipo `qr_kiosk`, que já
 * existia no cadastro.
 *
 * ⚠️ **Limite honesto do código do totem.** `arena_devices` é
 * `allow read: if isAuthed()`, então o código exibido na tela do totem pode
 * ser lido de casa por qualquer conta autenticada. Ele impede a chegada
 * confirmada **por engano** (a pessoa que abre o aplicativo no sofá e toca no
 * botão), não a fraude deliberada. E não precisa impedir: nada de valor
 * depende dele — não abre porta, não cobra, não libera quadra. Quem quiser
 * presença inegociável usa o caminho da arena, que confirma pelo painel.
 */

/** Janela em que a chegada pode ser confirmada, em minutos. */
export const CHECKIN_EARLY_MIN = 60;
export const CHECKIN_LATE_MIN = 30;

/** Validade do código do totem. Curta o bastante para não circular no grupo. */
export const KIOSK_TOKEN_TTL_MS = 90_000;

/**
 * Alfabeto do código: sem `0/O`, `1/I/L` e `5/S`. Quem digita num tablet de
 * recepção, em pé, com a mochila no ombro, não deve ter de decidir se aquilo
 * é um zero ou um ó.
 */
const ALFABETO = 'ABCDEFGHJKMNPQRTUVWXYZ2346789';
export const KIOSK_CODE_LEN = 5;

const num = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0);
const str = (v) => String(v ?? '').trim();

/** `HH:MM` → minutos desde a meia-noite. Hora inválida vira `null`. */
export function minutesOfTime(hhmm) {
  const m = /^(\d{1,2}):(\d{2})$/.exec(str(hhmm));
  if (!m) return null;
  const h = Number(m[1]);
  const mi = Number(m[2]);
  if (h > 23 || mi > 59) return null;
  return h * 60 + mi;
}

/** A data local de `now` em ISO (`YYYY-MM-DD`), sem passar por UTC. */
export function isoDay(now = new Date()) {
  const d = now instanceof Date ? now : new Date(now);
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/**
 * Gera um código de totem.
 *
 * `random` é injetável para o teste — um código sorteado não é testável, e
 * "confio no `Math.random`" não é asserção.
 */
export function newKioskToken(nowMs = Date.now(), random = Math.random) {
  let code = '';
  for (let i = 0; i < KIOSK_CODE_LEN; i += 1) {
    const idx = Math.floor(random() * ALFABETO.length) % ALFABETO.length;
    code += ALFABETO[idx];
  }
  return { code, issued_at_ms: num(nowMs), expires_at_ms: num(nowMs) + KIOSK_TOKEN_TTL_MS };
}

/** O código que o totem mostra AGORA ainda vale? */
export function isKioskTokenFresh(device, nowMs = Date.now()) {
  const exp = num(device?.checkin_token?.expires_at_ms);
  return exp > num(nowMs);
}

/**
 * O código digitado bate com o do totem?
 *
 * Comparação sem diferenciar maiúsculas e sem espaço: ninguém erra o código,
 * erra o teclado do celular.
 */
export function kioskCodeMatches(device, code, nowMs = Date.now()) {
  const esperado = str(device?.checkin_token?.code).toUpperCase();
  const digitado = str(code).toUpperCase().replace(/\s+/g, '');
  if (!esperado || !digitado) return false;
  if (!isKioskTokenFresh(device, nowMs)) return false;
  return esperado === digitado;
}

/** O primeiro e o último minuto de uma reserva NUM dia. */
export function bookingDayWindow(booking, diaISO) {
  const slots = (booking?.slots || []).filter((s) => str(s?.date) === str(diaISO));
  if (slots.length === 0) return null;
  const inicios = slots.map((s) => minutesOfTime(s?.start)).filter((v) => v !== null);
  const fins = slots.map((s) => minutesOfTime(s?.end)).filter((v) => v !== null);
  if (inicios.length === 0) return null;
  return {
    start: Math.min(...inicios),
    end: fins.length > 0 ? Math.max(...fins) : Math.min(...inicios) + 60,
  };
}

/**
 * Em que estado está a chegada desta reserva, agora.
 *
 * Estados: `checked_in` (já chegou), `open` (pode confirmar), `early` (cedo
 * demais), `late` (tarde demais), `other_day` (não é hoje), `not_confirmed`
 * (a arena ainda não aceitou), `cancelled`.
 *
 * @returns {{ state: string, minutesToStart: number|null }}
 */
export function checkinState(booking, now = new Date()) {
  const agora = now instanceof Date ? now : new Date(now);
  const hoje = isoDay(agora);
  const minutosAgora = agora.getHours() * 60 + agora.getMinutes();

  if (booking?.checked_in_at) return { state: 'checked_in', minutesToStart: null };
  const status = str(booking?.status);
  if (status === 'cancelled' || status === 'rejected') {
    return { state: 'cancelled', minutesToStart: null };
  }
  // Pedido ainda não aceito não tem chegada: não há reserva para comparecer.
  if (status !== 'confirmed' && status !== 'completed') {
    return { state: 'not_confirmed', minutesToStart: null };
  }

  const janela = bookingDayWindow(booking, hoje);
  if (!janela) return { state: 'other_day', minutesToStart: null };

  const faltam = janela.start - minutosAgora;
  if (faltam > CHECKIN_EARLY_MIN) return { state: 'early', minutesToStart: faltam };
  if (minutosAgora > janela.end + CHECKIN_LATE_MIN) return { state: 'late', minutesToStart: faltam };
  return { state: 'open', minutesToStart: faltam };
}

/**
 * As reservas de HOJE, nesta arena, em que ESTA pessoa pode confirmar chegada.
 *
 * Inclui as que já foram confirmadas (para a tela poder dizer "você já chegou"
 * em vez de sumir com o cartão, que é o que faz a pessoa tocar de novo).
 * O participante conta como dono: quem dividiu a quadra também chega.
 */
export function myCheckinBookings(bookings, uid, arenaId, now = new Date()) {
  const hoje = isoDay(now instanceof Date ? now : new Date(now));
  return (bookings || [])
    .filter((b) => !arenaId || str(b?.arena_id) === str(arenaId))
    .filter((b) => str(b?.athlete_id) === str(uid)
      || (b?.participant_ids || []).map(String).includes(String(uid)))
    .filter((b) => bookingDayWindow(b, hoje) !== null)
    .map((b) => ({ ...b, checkin: checkinState(b, now) }))
    .filter((b) => ['open', 'early', 'checked_in'].includes(b.checkin.state))
    .sort((a, b) => {
      const ja = bookingDayWindow(a, hoje)?.start ?? 0;
      const jb = bookingDayWindow(b, hoje)?.start ?? 0;
      return ja - jb;
    });
}

/**
 * O painel de presença do dia, para a arena.
 *
 * `faltou` só é afirmado depois que a janela FECHOU: enquanto ela está aberta
 * a pessoa ainda pode estar estacionando, e chamar isso de falta é o tipo de
 * número que faz a arena cobrar multa de quem chegou no horário.
 */
export function attendanceOfDay(bookings, diaISO, now = new Date()) {
  const agora = now instanceof Date ? now : new Date(now);
  const minutosAgora = agora.getHours() * 60 + agora.getMinutes();
  const ehHoje = isoDay(agora) === str(diaISO);

  const linhas = (bookings || [])
    .filter((b) => ['confirmed', 'completed'].includes(str(b?.status)))
    .map((b) => ({ b, janela: bookingDayWindow(b, diaISO) }))
    .filter((x) => x.janela !== null)
    .map(({ b, janela }) => {
      const chegou = Boolean(b?.checked_in_at);
      // Num dia passado a janela está sempre fechada; em HOJE, depende da hora.
      const fechou = !ehHoje || minutosAgora > janela.end + CHECKIN_LATE_MIN;
      let situacao = 'aguardando';
      if (chegou) situacao = 'presente';
      else if (b?.no_show === true) situacao = 'faltou';
      else if (fechou) situacao = 'faltou';
      return {
        id: b.id,
        booking: b,
        start: janela.start,
        end: janela.end,
        situacao,
        // Quem faltou SEM a arena ter marcado é o que ela pode confirmar num
        // toque — e é exatamente a lista que ninguém tinha paciência de montar.
        pendenteDeMarcacao: situacao === 'faltou' && b?.no_show !== true,
      };
    })
    .sort((a, b) => a.start - b.start);

  const presentes = linhas.filter((l) => l.situacao === 'presente').length;
  const faltas = linhas.filter((l) => l.situacao === 'faltou').length;
  const aguardando = linhas.filter((l) => l.situacao === 'aguardando').length;
  const decididas = presentes + faltas;

  return {
    linhas,
    total: linhas.length,
    presentes,
    faltas,
    aguardando,
    // A taxa sai sobre o que já foi DECIDIDO. Dividir pelo total às 9h da
    // manhã daria 95% de falta todo dia — e um número que só faz sentido às
    // 23h não é um número, é uma armadilha.
    taxaFalta: decididas > 0 ? Math.round((faltas / decididas) * 1000) / 10 : 0,
  };
}

/** As reservas que a arena pode marcar como falta em lote. */
export function noShowCandidates(bookings, diaISO, now = new Date()) {
  return attendanceOfDay(bookings, diaISO, now).linhas
    .filter((l) => l.pendenteDeMarcacao)
    .map((l) => l.booking);
}

/** Texto do motivo pelo qual a chegada não pode ser confirmada agora. */
export function checkinBlockedReason(state, minutesToStart) {
  switch (state) {
    case 'early': {
      const h = Math.floor(num(minutesToStart) / 60);
      const m = num(minutesToStart) % 60;
      const quando = h > 0 ? `${h}h${m > 0 ? String(m).padStart(2, '0') : ''}` : `${m} min`;
      return `Ainda falta ${quando} para o seu horário. A chegada abre 1 hora antes.`;
    }
    case 'late':
      return 'O horário já passou. Fale com a recepção da arena.';
    case 'not_confirmed':
      return 'A arena ainda não confirmou esta reserva.';
    case 'cancelled':
      return 'Esta reserva foi cancelada.';
    case 'other_day':
      return 'Esta reserva não é para hoje.';
    default:
      return '';
  }
}
