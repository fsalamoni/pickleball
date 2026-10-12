/**
 * LIGAR o jogador provisório de uma inscrição de torneio à CONTA do atleta.
 *
 * O organizador inscreve alguém sem conta com um e-mail inventado só para a
 * inscrição existir. Quando o atleta se cadastra (com o e-mail DELE), o
 * reivindicar automático não acha nada — o e-mail é outro. Quem resolve é o
 * organizador, escolhendo a conta na lista. E a troca tem de ser completa:
 * a conta, o nome, o nível, a categoria, a foto E o e-mail oficial.
 *
 * Por que no servidor: o e-mail oficial mora em `users/{uid}` e no Auth, que o
 * organizador não lê (e não deve ler — a regra de `users` é do titular). Aqui
 * o servidor lê, grava no contato PRIVADO da inscrição (o mesmo lugar que o
 * organizador já lê para quem se inscreveu sozinho) e devolve só o nome.
 *
 * Escritas num lote só (tudo ou nada):
 *   tournament_registrations/{rid}           conta + dados oficiais; sai o e-mail
 *                                             público legado do slot (P0-02)
 *   tournament_registrations/{rid}/private/contact   e-mail oficial do slot
 *   provisional_claims/{rid}_{slot}           APAGADA — a prova do e-mail
 *                                             inventado não pode mais reivindicar
 *
 * Travas: nunca troca a conta de quem já tem outra (transferiria resultados);
 * a conta não pode estar em outra inscrição ativa da modalidade; equipe não.
 * Com a MESMA conta já ligada, é "atualizar com o cadastro" — conserta as
 * inscrições ligadas antes desta correção (nome e e-mail provisórios).
 */

const COL = 'tournament_registrations';
const texto = (v) => String(v == null ? '' : v).trim();
const lc = (v) => texto(v).toLowerCase();

function validateLinkRequest(data = {}) {
  const registrationId = texto(data.registrationId);
  const slot = texto(data.slot);
  const userId = texto(data.userId);
  if (!registrationId) return { error: 'Informe a inscrição.' };
  if (slot !== 'a' && slot !== 'b') return { error: 'Jogador inválido.' };
  if (!userId) return { error: 'Escolha o atleta da plataforma.' };
  return { registrationId, slot, userId };
}

/** Mesmo critério de `publicDisplayName` (src/core/lib/displayName.js): nunca o e-mail inteiro. */
function officialName(user = {}, authUser = {}) {
  const local = texto(authUser.email || user.email).split('@')[0].slice(0, 60);
  return texto(user.platform_name) || texto(user.full_name) || texto(authUser.displayName) || local || 'Atleta';
}

function registrationLabel(reg) {
  if (reg.format === 'doubles') return `${reg.player_a_name || '—'} / ${reg.player_b_name || '—'}`;
  return reg.player_a_name || '—';
}

/**
 * O que muda na inscrição (sem I/O). `user` é `users/{uid}`; `authUser`, o
 * registro do Auth. Devolve `{ error }` ou `{ updates, email, refresh }`.
 */
function buildLinkPlan(reg, slot, userId, { user, authUser = {}, others = [] }) {
  if (!reg) return { error: 'Inscrição não encontrada.' };
  if (reg.kind === 'team') return { error: 'Inscrição de equipe: o elenco se edita pela equipe.' };
  if (slot === 'b' && reg.format !== 'doubles') return { error: 'Esta inscrição não tem jogador B.' };
  if (!user) return { error: 'Cadastro do atleta não encontrado.' };
  const p = `player_${slot}_`;
  const atual = texto(reg[`${p}user_id`]);
  if (atual && atual !== userId) {
    return { error: 'Este jogador já está ligado a outra conta. Trocar de conta transferiria resultados de uma pessoa para outra.' };
  }
  const outro = slot === 'a' ? 'b' : 'a';
  if (texto(reg[`player_${outro}_user_id`]) === userId) return { error: 'Este atleta já está nesta inscrição.' };
  const emOutra = others.find((r) => r.id !== reg.id && r.status !== 'cancelled'
    && (r.player_a_user_id === userId || r.player_b_user_id === userId));
  if (emOutra) return { error: `Este atleta já está inscrito nesta modalidade (${emOutra.label || 'outra inscrição'}).` };

  const email = lc(authUser.email || user.email);
  const updates = {
    [`${p}user_id`]: userId,
    [`${p}name`]: officialName(user, authUser),
    [`${p}level`]: user.level || user.leveling_level || reg[`${p}level`] || null,
    [`${p}competition_gender`]: user.competition_gender || reg[`${p}competition_gender`] || null,
    [`${p}photo`]: user.photo_url || authUser.photoURL || reg[`${p}photo`] || null,
    [`${p}provisional`]: false,
  };
  if (slot === 'a' && (!reg.user_id || reg.user_id === atual)) updates.user_id = userId;
  const depois = { ...reg, ...updates };
  updates.is_provisional = Boolean(depois.player_a_provisional || depois.player_b_provisional);
  updates.label = registrationLabel(depois);
  return { updates, email, refresh: atual === userId };
}

async function applyRegistrationLink(ctx, pedido, { actor }) {
  const { db, auth, FieldValue } = ctx;
  const regRef = db.collection(COL).doc(pedido.registrationId);
  const regSnap = await regRef.get();
  if (!regSnap.exists) return { status: 'error', error: 'Inscrição não encontrada.' };
  const reg = { id: regSnap.id, ...regSnap.data() };

  if (!actor.isPlatformAdmin) {
    const adm = await db.collection('tournament_admins').doc(`${reg.tournament_id}_${actor.uid}`).get();
    if (!adm.exists) return { status: 'denied', error: 'Só quem organiza o torneio liga inscrições a contas.' };
  }

  const [userSnap, othersSnap] = await Promise.all([
    db.collection('users').doc(pedido.userId).get(),
    reg.modality_id ? db.collection(COL).where('modality_id', '==', reg.modality_id).get() : Promise.resolve({ docs: [] }),
  ]);
  let authUser = {};
  try { authUser = (await auth.getUser(pedido.userId)) || {}; } catch (_) { authUser = {}; }
  const plan = buildLinkPlan(reg, pedido.slot, pedido.userId, {
    user: userSnap.exists ? userSnap.data() : null,
    authUser,
    others: othersSnap.docs.map((d) => ({ id: d.id, ...d.data() })),
  });
  if (plan.error) return { status: 'error', error: plan.error };

  const p = `player_${pedido.slot}_`;
  const now = FieldValue.serverTimestamp();
  const batch = db.batch();
  batch.update(regRef, {
    ...plan.updates,
    // P0-02: o e-mail público legado do slot sai — o oficial vai para o privado.
    [`${p}email`]: FieldValue.delete(),
    [`${p}email_lc`]: FieldValue.delete(),
    [`${p}linked_at`]: now,
    [`${p}linked_by`]: actor.uid,
    updated_at: now,
  });
  if (plan.email) {
    batch.set(regRef.collection('private').doc('contact'), {
      [`${p}email`]: plan.email, [`${p}email_lc`]: plan.email, updated_at: now,
    }, { merge: true });
  }
  batch.delete(db.collection('provisional_claims').doc(`${reg.id}_${pedido.slot}`));
  await batch.commit();
  return {
    status: 'ok',
    refresh: plan.refresh,
    name: plan.updates[`${p}name`],
    has_email: Boolean(plan.email),
    tournament_id: reg.tournament_id || null,
    previous_name: reg[`${p}name`] || '',
  };
}

module.exports = { validateLinkRequest, buildLinkPlan, applyRegistrationLink, officialName };
