/**
 * PRAZOS DO TORNEIO NO SERVIDOR (2026-11-07).
 *
 * 1. `runScheduleWorker` (a cada 5 min): vira o status que as datas mandam —
 *    publicado com a abertura vencida → inscrições abertas; aberto (ou
 *    publicado) com o encerramento vencido → inscrições encerradas. Nunca
 *    reabre o que a organização encerrou nem mexe em rascunho.
 * 2. `onTournamentUpdated` (gatilho): quando as inscrições de um torneio
 *    PÚBLICO abrem — à mão ou pela data —, avisa a comunidade UMA vez
 *    (`registrations_open_notified`); quando a virada foi pela data, avisa a
 *    organização.
 *
 * `dueScheduleChange` é CÓPIA de `src/modules/tournament/domain/registrationWindow.js`
 * (o pacote de Functions é publicado isolado), com teste de paridade.
 */
const { tx, textoDoAviso, i18nDoAviso } = require('./avisoI18n.js');

const OPEN = 'registrations_open';
const CLOSED = 'registrations_closed';
const PUBLISHED = 'published';

const instante = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : null);

/** `'open'`, `'close'` ou `null` — ver o lado do cliente. */
function dueScheduleChange(t, agora) {
  if (!t || t.archived === true) return null;
  const abre = instante(t.registration_opens_ms);
  const fecha = instante(t.registration_closes_ms);
  const fechou = fecha != null && agora >= fecha;
  if ((t.status === PUBLISHED || t.status === OPEN) && fechou) return 'close';
  if (t.status === PUBLISHED && abre != null && agora >= abre) return 'open';
  return null;
}

/** Vira o status dos torneios com a data vencida. Devolve quantos virou. */
async function runScheduleWorker(ctx) {
  const snaps = await Promise.all([PUBLISHED, OPEN].map((s) => ctx.db.collection('tournaments').where('status', '==', s).get()));
  let virados = 0;
  for (const snap of snaps) {
    for (const d of snap.docs) {
      const mudanca = dueScheduleChange(d.data(), ctx.now);
      if (!mudanca) continue;
      await d.ref.update({
        status: mudanca === 'open' ? OPEN : CLOSED,
        schedule_change: mudanca,
        schedule_changed_ms: ctx.now,
        updated_at: ctx.Timestamp.fromMillis(ctx.now),
      });
      virados += 1;
    }
  }
  return virados;
}

function aviso(ctx, batch, userId, { title, message, link, type, essential = false }) {
  const i18n = i18nDoAviso({ title, message });
  batch.set(ctx.db.collection('notifications').doc(), {
    user_id: userId, title: textoDoAviso(title), message: textoDoAviso(message), ...(i18n ? { i18n } : {}),
    type, link, read: false, archived: false, origin: 'server', essential,
    created_at: ctx.Timestamp.fromMillis(ctx.now),
  });
}

/** Grava os avisos em lotes de 400 (o teto do lote é 500). */
async function avisar(ctx, uids, conteudo) {
  const unicos = [...new Set(uids.filter(Boolean))];
  for (let i = 0; i < unicos.length; i += 400) {
    const batch = ctx.db.batch();
    unicos.slice(i, i + 400).forEach((uid) => aviso(ctx, batch, uid, conteudo));
    await batch.commit();
  }
  return unicos.length;
}

/** A comunidade: o diretório de atletas, sem os ocultados pela moderação (como `listAthletes`). */
async function comunidade(ctx) {
  const snap = await ctx.db.collection('athlete_profiles').where('directory_listed', '==', true).get();
  return snap.docs.filter((d) => d.data().hidden !== true).map((d) => d.id);
}

/** Quem organiza: o criador e os administradores do torneio. */
async function organizacao(ctx, id, t) {
  const snap = await ctx.db.collection('tournament_admins').where('tournament_id', '==', id).get();
  return [t.creator_uid, ...snap.docs.map((d) => d.data().user_id)];
}

async function onTournamentUpdated(ctx, antes, depois, id) {
  if (!antes || !depois || depois.archived === true) return;
  const nome = String(depois.name || 'Torneio').slice(0, 60);
  const abriu = depois.status === OPEN && antes.status !== OPEN;

  if (abriu && depois.visibility === 'public' && depois.registrations_open_notified !== true) {
    // Marca antes de avisar: um gatilho repetido não manda o aviso duas vezes.
    await ctx.db.collection('tournaments').doc(id).update({ registrations_open_notified: true });
    await avisar(ctx, await comunidade(ctx), {
      title: tx('Inscrições abertas: "{torneio}"', { torneio: nome }),
      message: tx('Um torneio público está com inscrições abertas. Toque para ver e participar.'),
      type: 'tournament_open',
      link: `/torneios/${id}`,
    });
  }

  const pelaData = depois.schedule_changed_ms && depois.schedule_changed_ms !== antes.schedule_changed_ms;
  if (pelaData && (depois.schedule_change === 'open' || depois.schedule_change === 'close')) {
    await avisar(ctx, await organizacao(ctx, id, depois), depois.schedule_change === 'open'
      ? {
        title: tx('As inscrições de "{torneio}" abriram', { torneio: nome }),
        message: tx('Abriram sozinhas, na data e hora marcadas.'),
        type: 'tournament_open', link: `/torneios/${id}`,
      }
      : {
        title: tx('As inscrições de "{torneio}" encerraram', { torneio: nome }),
        message: tx('Encerraram sozinhas, na data e hora marcadas. Já dá para conferir as inscrições e sortear.'),
        type: 'tournament_open', link: `/torneios/${id}`,
      });
  }
}

module.exports = { dueScheduleChange, runScheduleWorker, onTournamentUpdated };
