/**
 * O QUE O CLUBE GUARDA DA PESSOA (Bloco G) — leitura só do SERVIDOR, só dos dados da própria conta.
 *
 * As espécies do clube moram sob `club_x/{clube}/…` e o navegador não consulta "todos os
 * clubes de uma vez" (não há regra de grupo de coleções). Este callable faz a varredura que o
 * navegador não pode, SEMPRE pelo `uid` de quem chama:
 *
 *  - `pending`: o que espera a pessoa nos clubes de que ela é membro (cobrança, filiação,
 *    convocação, sanção, eleição) — alimenta o "Precisa de você" da Minha área;
 *  - `export`: tudo o que os clubes com associação guardam dela (exportação de dados — LGPD),
 *    inclusive os clubes de que já saiu.
 *
 * Nada é gravado. O que é do clube (planos, contas, equipe, atos) fica com ele. Fica de fora do
 * arquivo o que é só de gestão ou credencial: a nota interna da secretaria, o código da
 * carteirinha e o recibo da votação. O voto é secreto: a cédula nunca teve o uid.
 */
const a = require('./clubAssociation.js');

const { texto, col } = a;
const CLUBES_MAX = 100;
const FORA = new Set(['note', 'card_code', 'staff_note', 'receipt', 'internal_note']);

/** Timestamp do Admin SDK vira texto ISO; o que é só de gestão ou credencial sai. */
function limpa(v) {
  if (v == null) return v;
  if (typeof v.toMillis === 'function') return new Date(v.toMillis()).toISOString();
  if (Array.isArray(v)) return v.map(limpa);
  if (typeof v === 'object') {
    const out = {};
    Object.keys(v).forEach((k) => { if (!FORA.has(k)) out[k] = limpa(v[k]); });
    return out;
  }
  return v;
}

const doc = (d) => (d && d.exists ? { id: d.id, ...limpa(d.data()) } : null);
const docs = (snap) => snap.docs.map((d) => ({ id: d.id, ...limpa(d.data()) }));

/** Os clubes que ligaram a associação e onde a pessoa pode ter algo (`todos` = também onde já saiu). */
async function clubesDe(ctx, uid, todos) {
  const base = ctx.db.collection('clubs');
  if (todos) {
    const snap = await base.where('association.enabled', '==', true).limit(CLUBES_MAX + 1).get();
    return { clubes: snap.docs.slice(0, CLUBES_MAX).map((d) => ({ id: d.id, ...d.data() })), truncated: snap.size > CLUBES_MAX };
  }
  const mem = await ctx.db.collection('club_members').where('user_id', '==', uid).limit(CLUBES_MAX + 1).get();
  const ids = [...new Set(mem.docs.map((d) => d.data().club_id).filter(Boolean))].slice(0, CLUBES_MAX);
  const lidos = await Promise.all(ids.map((id) => base.doc(id).get()));
  return { clubes: lidos.filter((d) => d.exists && d.data().association?.enabled === true).map((d) => ({ id: d.id, ...d.data() })), truncated: mem.size > CLUBES_MAX };
}

/** Eleições em que a pessoa está no colégio: o edital (sem o que é da comissão) e se ela já votou. */
async function eleicoesDe(ctx, clubId, voters) {
  const ids = [...new Set(voters.map((v) => v.election_id).filter(Boolean))];
  const lidas = await Promise.all(ids.map((id) => col(ctx, clubId, 'elections').doc(id).get()));
  return lidas.filter((d) => d.exists).map((d) => {
    const e = d.data();
    const v = voters.find((x) => x.election_id === d.id) || {};
    return { id: d.id, title: texto(e.title, 200), status: e.status, mode: e.mode || null, calendar: limpa(e.calendar || null), voted: Boolean(v.voted_at_ms) };
  });
}

async function doClube(ctx, uid, club, completo) {
  const por = (kind, campo) => col(ctx, club.id, kind).where(campo, '==', uid).limit(201).get();
  const [aff, charges, cases, convites, voters] = await Promise.all([
    col(ctx, club.id, 'aff').doc(uid).get(), por('charges', 'user_id'), por('cases', 'user_id'), por('callup_members', 'user_id'), por('voters', 'user_id'),
  ]);
  const eleitor = docs(voters);
  const item = {
    club_id: club.id, club_name: club.name || '', aff: doc(aff), charges: docs(charges), sanctions: docs(cases), callup_invites: docs(convites),
    voters: eleitor, elections: await eleicoesDe(ctx, club.id, eleitor),
  };
  if (completo) {
    const [staff, ombud, safeguard, minors, candidacies, endorsements] = await Promise.all([
      col(ctx, club.id, 'staff').doc(uid).get(), por('ombud', 'reporter_uid'), col(ctx, club.id, 'safeguard').doc(uid).get(), col(ctx, club.id, 'minors').doc(uid).get(),
      col(ctx, club.id, 'candidacies').where('member_uids', 'array-contains', uid).limit(201).get(), por('endorsements', 'user_id'),
    ]);
    Object.assign(item, { staff_role: doc(staff), ombud_reports: docs(ombud), safeguarding: doc(safeguard), minor_registry: doc(minors), candidacies: docs(candidacies), endorsements: docs(endorsements) });
  }
  const tem = item.aff || item.charges.length || item.sanctions.length || item.callup_invites.length || item.voters.length
    || (completo && (item.staff_role || item.ombud_reports.length || item.safeguarding || item.minor_registry || item.candidacies.length || item.endorsements.length));
  return tem ? item : null;
}

async function mine(ctx, actor, data) {
  await a.exigeFlag(ctx);
  const escopo = data.scope === 'export' ? 'export' : 'pending';
  const { clubes, truncated } = await clubesDe(ctx, actor.uid, escopo === 'export');
  const partes = await Promise.allSettled(clubes.map((c) => doClube(ctx, actor.uid, c, escopo === 'export')));
  const falhou = partes.filter((p) => p.status === 'rejected');
  // Falha não é vazio: se algum clube não pôde ser lido, a tela e o arquivo dizem.
  return {
    clubs: partes.filter((p) => p.status === 'fulfilled' && p.value).map((p) => p.value),
    incomplete: falhou.length > 0 || truncated, failed: falhou.length,
  };
}

module.exports = { mine, limpa };
