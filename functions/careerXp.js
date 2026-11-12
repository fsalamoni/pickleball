/**
 * MINHA CARREIRA — o XP da FICHA COMPLETA (flag `athlete_career`, módulo de
 * gamificação `career_xp`; docs/54 §9 e docs/38).
 *
 * O que paga é o ATO de registrar e refletir: a ficha de um torneio de fora
 * JÁ JOGADO com resultado (toda colocação preenchida), ao menos uma foto e o
 * balanço respondido. O resultado declarado rende ZERO: campeão e fase de
 * grupos pagam o mesmo, e só uma vez (guarda `carreiraNaoPontua`).
 *
 *  - Id determinístico `{uid}_career_{eventoId}` (o `grantId` do cliente): a
 *    mesma ficha nunca paga duas vezes.
 *  - Ficha que deixa de estar completa, ou registro apagado ⇒ o grant é
 *    ZERADO (`xp: 0`), não apagado — o cliente ignora `xp <= 0` e, com o
 *    documento ali, refazer a mesma ficha não paga de novo.
 *  - Teto mensal (`career.monthlyCap`, padrão 4) contado pelos grants de
 *    carreira criados no mês (os zerados inclusive): apagar e criar outro
 *    registro cai no mesmo teto. XP por ficha em `career.xpPerRecord` (25).
 *  - Torneio da plataforma ("É este", `platform_tournament_id`) não paga: vale
 *    o oficial, que já conta.
 *  - Só paga com a flag `athlete_career` E o módulo `career_xp` ligados; zerar
 *    vale sempre.
 *
 * Disparado pelo gatilho do registro (`careerEventWritten`) e pelo do balanço
 * (`careerDebriefWritten`, `training_debriefs/{uid}_externo_{evento}`).
 */
const g = require('./gamification.js');
const P = require('./careerPolicy.js');

const KIND = 'career';
const EVENTS = 'career_events';
const DEBRIEFS = 'training_debriefs';
const GRANTS = 'user_xp_grants';

const ISO = /^\d{4}-\d{2}-\d{2}$/;
const hojeBR = (now) => new Date(now - 3 * 3600000).toISOString().slice(0, 10);
const mesBR = (now) => hojeBR(now).slice(0, 7);

/** O mesmo `grantId` do cliente (`xpGrants.js`). */
const grantDocId = (uid, eventId) => `${uid}_${KIND}_${String(eventId).replace(/[^A-Za-z0-9_-]/g, '-').slice(0, 80)}`;
const debriefDocId = (uid, eventId) => `${uid}_externo_${eventId}`;

/** Cópia de `isCareerDebriefDone` (`src/modules/career/domain/careerHabits.js`; paridade). */
function balancoFeito(debrief, eventId, uid) {
  return Boolean(debrief && debrief.status === 'respondido' && debrief.source && debrief.source.type === 'externo'
    && debrief.source.ref_id === eventId && (!uid || debrief.uid === uid));
}

/** Cópia de `isCompleteCareerRecord` (paridade em `careerHabits.test.js`). O valor da colocação nunca importa. */
function fichaCompleta(ev, debrief, hoje) {
  if (!ev || ev.status !== 'played' || !ISO.test(String(ev.start_date || ''))) return false;
  if (hoje && ev.start_date > hoje) return false;
  const entries = Array.isArray(ev.entries) ? ev.entries : [];
  if (!entries.length || !entries.every((e) => Boolean(e && e.placement))) return false;
  const pasta = `carreira/${ev.uid}/`;
  if (!Array.isArray(ev.photos) || !ev.photos.some((p) => String((p && p.path) || '').startsWith(pasta))) return false;
  return balancoFeito(debrief, ev.id, ev.uid);
}

/** A ficha PAGA? Completa e não ligada a um torneio da plataforma (vale o oficial). */
const fichaPaga = (ev, debrief, hoje) => fichaCompleta(ev, debrief, hoje) && !ev.platform_tournament_id;

async function flagLigada(db) {
  const snap = await db.collection('platform_settings').doc('global').get();
  return Boolean(snap.exists && snap.data().feature_flags && snap.data().feature_flags.athlete_career === true);
}

/**
 * Acerta o grant do registro `eventId` (de `uid`). Idempotente. Numa transação:
 * duas fichas completadas juntas não furam o teto.
 *
 * @returns {Promise<'paid'|'revoked'|'capped'|'kept'|'off'|'minor'|'none'>}
 */
async function sync(ctx, { uid, eventId }) {
  const { db, now } = ctx;
  if (!uid || !eventId) return 'none';
  const [ligada, cfg] = await Promise.all([flagLigada(db), g.carregarConfig(db)]);
  const podePagar = ligada && g.moduloLigado(cfg, 'career_xp') && cfg.career.xpPerRecord > 0;
  const grantRef = db.collection(GRANTS).doc(grantDocId(uid, eventId));
  return db.runTransaction(async (tx) => {
    const [evSnap, debSnap, grantSnap] = await Promise.all([
      tx.get(db.collection(EVENTS).doc(eventId)),
      tx.get(db.collection(DEBRIEFS).doc(debriefDocId(uid, eventId))),
      tx.get(grantRef),
    ]);
    const ev = evSnap.exists ? { id: eventId, ...evSnap.data() } : null;
    const dono = ev && ev.uid === uid;
    const paga = dono && fichaPaga(ev, debSnap.exists ? debSnap.data() : null, hojeBR(now));
    if (grantSnap.exists) {
      // Já pagou uma vez: nunca de novo. Deixou de valer ⇒ zera.
      if (!paga && Number(grantSnap.data().xp) > 0) {
        tx.update(grantRef, { xp: 0, revoked_at: now });
        return 'revoked';
      }
      return 'kept';
    }
    if (!paga) return 'none';
    if (!podePagar) return 'off';
    // Só quem VAI pagar consulta o teto e o cadastro (ainda antes de qualquer
    // escrita): a gravação comum da ficha não lê nem trava os grants da pessoa.
    // Só igualdades (zero índice): todo grant de carreira nasce com `kind` e
    // `month`, e o zerado os mantém.
    const mes = mesBR(now);
    const [meus, userSnap] = await Promise.all([
      tx.get(db.collection(GRANTS).where('uid', '==', uid).where('kind', '==', KIND).where('month', '==', mes)),
      tx.get(db.collection('users').doc(uid)),
    ]);
    // Menor de 18 (ou nascimento desconhecido) não ganha XP de carreira: ele
    // entraria no placar público de sempre (plano §13.4, "Menores").
    const birth = userSnap.exists ? userSnap.data().birth_date : null;
    if (!P.isAdult(birth, hojeBR(now))) return 'minor';
    if (meus.docs.length >= cfg.career.monthlyCap) return 'capped';
    tx.set(grantRef, {
      uid, kind: KIND, xp: Math.min(g.MAX_GRANT_XP, Math.round(cfg.career.xpPerRecord)), label: '',
      refId: String(eventId).slice(0, 120), month: mes, at: now, schemaVersion: 1,
    });
    return 'paid';
  });
}

/** `career_events/{id}` mudou (o gatilho `careerEventWritten` chama). */
function onEvent(ctx, eventId, before, after) {
  const uid = (after && after.uid) || (before && before.uid);
  return sync(ctx, { uid, eventId });
}

/** `training_debriefs/{id}` mudou: só o balanço de torneio de fora interessa. */
function onDebrief(ctx, debriefId, before, after) {
  // O evento sai do ID do balanço, não do `source` de agora: o dono pode trocar
  // `source.type`/`ref_id` no update, e a ficha que ele deixava completa tem de
  // ser reconferida (e zerada) mesmo assim.
  const uid = (before && before.uid) || (after && after.uid);
  const pref = uid ? debriefDocId(uid, '') : '';
  if (!uid || !String(debriefId).startsWith(pref) || String(debriefId).length === pref.length) return Promise.resolve('none');
  return sync(ctx, { uid, eventId: String(debriefId).slice(pref.length) });
}

module.exports = { sync, onEvent, onDebrief, fichaCompleta, fichaPaga, balancoFeito, grantDocId, KIND };
