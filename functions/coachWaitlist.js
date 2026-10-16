/**
 * A lista de espera do PROFESSOR (`coach_waitlist`) — quem avisa é o servidor.
 *
 * O aluno que não achou horário livre entra na lista. Avisar é escrever para
 * OUTRAS pessoas (o aviso de cada aluno e o `notified_at` da entrada dele), e
 * o navegador do professor ou de quem desmarcou não tem por que fazer isso —
 * nem lê a lista, no caso do aluno que cancela. Aqui o aviso sai quando:
 *
 *  - o professor ABRE horários (`coach_availability` ganhou janela nova ou
 *    perdeu uma folga futura) — `abriuHorario`;
 *  - uma aula CONFIRMADA é desfeita (cancelada ou recusada) e ainda não
 *    passou, num professor que tem janelas — `aulaLiberouHorario`.
 *
 * Os mesmos gatilhos mantêm `coach_busy_slots/{coachId}` (os horários já
 * confirmados, sem nome de aluno) — ver `recalcularOcupados`.
 *
 * A pessoa continua na lista até pedir uma aula ou sair; para não virar
 * spam (o professor salva a agenda três vezes seguidas), cada entrada é
 * avisada no máximo uma vez a cada `INTERVALO_HORAS`.
 */

const { tx, textoDoAviso, i18nDoAviso } = require('./avisoI18n');

const INTERVALO_HORAS = 6;
const POR_LOTE = 200; // 2 escritas por entrada; o lote aceita 500.

function ms(t) {
  if (!t) return NaN;
  if (typeof t.toMillis === 'function') return t.toMillis();
  if (t instanceof Date) return t.getTime();
  return Number(t);
}

/** "Hoje" em Brasília (AAAA-MM-DD). */
function hojeEmBrasilia(agoraMs) {
  return new Date(agoraMs - 3 * 3600000).toISOString().slice(0, 10);
}

/** Cada janela vira `dia|início|fim`, uma chave por dia da semana. */
function chavesDasJanelas(disp) {
  const out = new Set();
  ((disp && disp.windows) || []).forEach((w) => {
    (w.weekdays || []).forEach((d) => out.add(`${d}|${w.start}|${w.end}`));
  });
  return out;
}

const folgasFuturas = (disp, hoje) => new Set(((disp && disp.exceptions) || [])
  .map((e) => e && e.date).filter((d) => typeof d === 'string' && d >= hoje));

/** O professor abriu horário? (janela nova, ou folga futura retirada). */
function abriuHorario(antes, depois, hoje) {
  if (!depois) return false;
  const novas = chavesDasJanelas(depois);
  if (novas.size === 0) return false;
  const velhas = chavesDasJanelas(antes);
  if ([...novas].some((k) => !velhas.has(k))) return true;
  const folgasDepois = folgasFuturas(depois, hoje);
  return [...folgasFuturas(antes, hoje)].some((d) => !folgasDepois.has(d));
}

/** Uma aula confirmada (ainda por vir) foi desfeita? */
function aulaLiberouHorario(antes, depois, hoje) {
  if (!antes || !depois || antes.status !== 'confirmed') return false;
  if (!['cancelled', 'declined'].includes(depois.status)) return false;
  return (depois.slots || []).some((s) => s && typeof s.date === 'string' && s.date >= hoje);
}

/**
 * Avisa quem está na lista do professor.
 * @param {{ db: any, Timestamp: any, agoraMs: number, logger?: any }} ctx
 * @param {string} coachId
 * @param {'horarios'|'vaga'} motivo
 */
async function avisarListaDeEspera(ctx, coachId, motivo) {
  const { db, Timestamp, agoraMs } = ctx;
  if (!coachId) return { avisados: 0 };
  const snap = await db.collection('coach_waitlist').where('coach_id', '==', coachId).get();
  const aAvisar = snap.docs.filter((d) => {
    const ultimo = ms(d.data().notified_at);
    return !(Number.isFinite(ultimo) && agoraMs - ultimo < INTERVALO_HORAS * 3600000);
  });
  if (aAvisar.length === 0) return { avisados: 0 };

  const perfil = await db.collection('coaches').doc(coachId).get();
  const professor = String((perfil.exists && perfil.data().display_name) || '').slice(0, 60) || tx('O professor');
  const title = motivo === 'vaga'
    ? tx('Abriu uma vaga com {professor}', { professor })
    : tx('{professor} abriu horários de aula', { professor });
  const message = motivo === 'vaga'
    ? tx('Uma aula foi desmarcada. Veja os horários livres e peça a sua antes que outra pessoa marque.')
    : tx('Você está na lista de espera. Veja os horários livres e peça a sua aula antes que outra pessoa marque.');
  const i18n = i18nDoAviso({ title, message });
  const agora = Timestamp.fromMillis(agoraMs);

  for (let i = 0; i < aAvisar.length; i += POR_LOTE) {
    const lote = db.batch();
    aAvisar.slice(i, i + POR_LOTE).forEach((d) => {
      const e = d.data();
      lote.set(db.collection('notifications').doc(), {
        user_id: e.user_id,
        title: textoDoAviso(title),
        message: textoDoAviso(message),
        ...(i18n ? { i18n } : {}),
        type: 'generic',
        link: `/coaches/${coachId}?marcar=1`,
        read: false,
        archived: false,
        created_at: agora,
      });
      lote.update(d.ref, { notified_at: agora, notify_count: (Number(e.notify_count) || 0) + 1 });
    });
    // eslint-disable-next-line no-await-in-loop
    await lote.commit();
  }
  if (ctx.logger) ctx.logger.info('Lista de espera do professor avisada.', { coachId, motivo, avisados: aAvisar.length });
  return { avisados: aAvisar.length };
}

/**
 * Os horários OCUPADOS do professor, num documento PÚBLICO
 * (`coach_busy_slots/{coachId}`: só data e hora, sem aluno).
 *
 * 🐞 O pedido de aula e o calendário do perfil liam as aulas do professor
 * (`coach_lessons` por `coach_id`), e a regra só deixa o professor e o aluno
 * de CADA aula lerem — para qualquer outra pessoa a consulta era recusada, o
 * erro virava lista vazia e o horário já confirmado com outro aluno aparecia
 * livre. O servidor recalcula a lista a cada escrita numa aula (e quando o
 * professor salva a agenda), e a tela lê só ela.
 */
const OCUPADOS_MAX = 500;

async function recalcularOcupados(ctx, coachId) {
  const { db, Timestamp, agoraMs } = ctx;
  if (!coachId) return { ocupados: 0 };
  const hoje = hojeEmBrasilia(agoraMs);
  const aulas = await db.collection('coach_lessons').where('coach_id', '==', coachId).get();
  const slots = aulas.docs
    .map((d) => d.data())
    .filter((l) => l && l.status === 'confirmed')
    .flatMap((l) => (Array.isArray(l.slots) ? l.slots : []))
    .filter((x) => x && typeof x.date === 'string' && x.date >= hoje && x.start && x.end)
    .map((x) => ({ date: x.date, start: String(x.start), end: String(x.end) }))
    .sort((a, b) => (a.date + a.start).localeCompare(b.date + b.start))
    .slice(0, OCUPADOS_MAX);
  await db.collection('coach_busy_slots').doc(coachId).set({
    coach_id: coachId, slots, updated_at: Timestamp.fromMillis(agoraMs),
  });
  return { ocupados: slots.length };
}

/** A aula mudou o que ocupa a agenda? (status, horários, criada ou apagada). */
function aulaMudouOcupacao(antes, depois) {
  if (!antes || !depois) return true;
  return antes.status !== depois.status || JSON.stringify(antes.slots || []) !== JSON.stringify(depois.slots || []);
}

/** Gatilho da disponibilidade: abriu horário ⇒ avisa a lista. */
async function aoMudarDisponibilidade(ctx, coachId, antes, depois) {
  // Mantém a lista pública de ocupados em dia (também a de professores que
  // ainda não tiveram aula mexida desde que ela existe).
  await recalcularOcupados(ctx, coachId);
  if (!abriuHorario(antes, depois, hojeEmBrasilia(ctx.agoraMs))) return { avisados: 0 };
  return avisarListaDeEspera(ctx, coachId, 'horarios');
}

/**
 * Gatilho da aula: recalcula os ocupados do professor e, se uma confirmada
 * foi desfeita num professor com janelas, avisa a lista.
 */
async function aoMudarAula(ctx, antes, depois) {
  const coachDaAula = (depois && depois.coach_id) || (antes && antes.coach_id);
  if (coachDaAula && aulaMudouOcupacao(antes, depois)) await recalcularOcupados(ctx, coachDaAula);
  if (!aulaLiberouHorario(antes, depois, hojeEmBrasilia(ctx.agoraMs))) return { avisados: 0 };
  const coachId = depois.coach_id;
  const disp = await ctx.db.collection('coach_availability').doc(coachId).get();
  if (!disp.exists || chavesDasJanelas(disp.data()).size === 0) return { avisados: 0 };
  return avisarListaDeEspera(ctx, coachId, 'vaga');
}

module.exports = {
  INTERVALO_HORAS,
  hojeEmBrasilia,
  abriuHorario,
  aulaLiberouHorario,
  avisarListaDeEspera,
  aoMudarDisponibilidade,
  aoMudarAula,
  recalcularOcupados,
  aulaMudouOcupacao,
};
