/**
 * Controle de linhas (docs/53 §5c): a CÂMERA CONVIDADA, sem conta.
 *
 * Quem organiza a quadra gera um convite por posição (o navegador grava
 * `{quadra}/line_invites/{sha256(token)}` — a regra confere quem organiza e a
 * validade de no máximo 12 h) e mostra um QR. O token vai no FRAGMENTO do
 * link (`#t=…`), que não chega a servidor nenhum nem aos registros de acesso;
 * o banco guarda só o hash. Qualquer celular que abre o link vira a câmera
 * daquela posição, sem login, até o convite vencer ou ser apagado.
 *
 * Sem conta não há regra que o deixe escrever: tudo passa por aqui, com o
 * Admin SDK, e só com o convite válido E o controle ligado na quadra. Grava
 * exatamente o que a câmera com conta grava (`lcCam`/`lcCall` no
 * firestore.rules), com `uid` = `guest_{16 do hash}` — não é conta de
 * ninguém, não guarda nome de pessoa, e a central mostra "Convidado".
 *
 * Ações: `peek` (o convite vale? posição, arranjo e nome da quadra),
 * `beat` (a câmera "no ar"), `call` (uma marcação), `leave` (sai do ar).
 * Convite que não existe, venceu ou cuja quadra desligou respondem igual.
 */
const crypto = require('node:crypto');

const MAX_HOURS = 12;
const HOST_RE = /^(game_days\/[A-Za-z0-9_-]{1,64}\/line_courts\/court-[0-9]{1,2}|tournament_line_courts\/[A-Za-z0-9_-]{1,140})$/;
const TOKEN_RE = /^[A-Za-z0-9_-]{32,64}$/;
const POSITION_RE = /^[a-z0-9_]{1,20}$/;
const KINDS = ['bounce', 'volley', 'serve_foot', 'two_bounce'];
const CALLS = ['in', 'out', 'review', 'fault', 'clean'];
const NEUTRO = 'Este QR não vale mais. Peça um novo a quem organiza a quadra.';

class LineGuestError extends Error {
  constructor(code, message) { super(message); this.code = code; }
}

const hashToken = (token) => crypto.createHash('sha256').update(String(token)).digest('hex');
const guestUid = (hash) => `guest_${hash.slice(0, 16)}`;

/** `a/b/c/d` → referência do documento, pelo caminho (o falso dos testes não tem `db.doc`). */
function refOf(db, path) {
  const p = path.split('/');
  let ref = db.collection(p[0]).doc(p[1]);
  for (let i = 2; i < p.length; i += 2) ref = ref.collection(p[i]).doc(p[i + 1]);
  return ref;
}

const num = (v) => (Number.isFinite(v) ? Math.round(v * 1000) / 1000 : null);
const semNulos = (o) => { Object.keys(o).forEach((k) => { if (o[k] === null || o[k] === undefined) delete o[k]; }); return o; };

/** O convite vale? Devolve o que a câmera precisa; senão, a mesma recusa para tudo. */
async function convite(ctx, data) {
  const host = String(data.host || '');
  const token = String(data.token || '');
  if (!HOST_RE.test(host) || !TOKEN_RE.test(token)) throw new LineGuestError('invalid-argument', NEUTRO);
  const hash = hashToken(token);
  const [inv, quadra, global] = await Promise.all([
    refOf(ctx.db, `${host}/line_invites/${hash}`).get(),
    refOf(ctx.db, host).get(),
    refOf(ctx.db, 'platform_settings/global').get(),
  ]);
  const i = inv.exists ? inv.data() : null;
  const q = quadra.exists ? quadra.data() : null;
  // A flag `line_control` desligada desliga também o convidado.
  const flag = global.exists && global.data().feature_flags?.line_control === true;
  if (!flag || !i || !q || q.line_control !== true || !(Number(i.exp_ms) > ctx.now)
    || Number(i.exp_ms) > ctx.now + MAX_HOURS * 3600000 + 60000 || !POSITION_RE.test(String(i.position || ''))) {
    throw new LineGuestError('not-found', NEUTRO);
  }
  return { host, hash, invite: i, court: q };
}

async function peek(ctx, data) {
  const { host, invite, court } = await convite(ctx, data);
  let title = court.court_name || '';
  if (host.startsWith('game_days/')) {
    const gd = await refOf(ctx.db, host.split('/').slice(0, 2).join('/')).get();
    title = (gd.exists && gd.data().title) || '';
  }
  return {
    position: invite.position,
    layout: court.line_control_layout || null,
    exp_ms: invite.exp_ms,
    title: String(title).slice(0, 80),
  };
}

async function beat(ctx, data) {
  const { host, hash, invite, court } = await convite(ctx, data);
  const c = data.cam || {};
  const uid = guestUid(hash);
  await refOf(ctx.db, `${host}/line_cams/${uid}_${invite.position}`).set(semNulos({
    uid,
    name: 'Convidado',
    position: invite.position,
    layout: court.line_control_layout || null,
    calibrated: c.calibrated === true,
    analyzing: c.analyzing === true,
    fps: Number.isFinite(c.fps) ? Math.max(0, Math.min(240, Math.round(c.fps))) : 0,
    battery: Number.isFinite(c.battery) ? Math.max(0, Math.min(100, Math.round(c.battery))) : null,
    charging: typeof c.charging === 'boolean' ? c.charging : null,
    check_cm: Number.isFinite(c.checkCm) ? Math.round(c.checkCm * 10) / 10 : null,
    seen_ms: ctx.now,
    updated_at: ctx.FieldValue.serverTimestamp(),
  }));
  return { ok: true };
}

async function leave(ctx, data) {
  const { host, hash, invite } = await convite(ctx, data);
  await refOf(ctx.db, `${host}/line_cams/${guestUid(hash)}_${invite.position}`).delete();
  return { ok: true };
}

async function call(ctx, data) {
  const { host, hash, invite } = await convite(ctx, data);
  const e = data.call || {};
  if (!KINDS.includes(e.kind) || !CALLS.includes(e.call) || !Number.isFinite(e.t_ms)) {
    throw new LineGuestError('invalid-argument', 'Marcação inválida.');
  }
  // A hora do lance não pode estar longe da hora de agora (o relógio do aparelho erra um pouco).
  if (Math.abs(e.t_ms - ctx.now) > 10 * 60000) throw new LineGuestError('invalid-argument', 'Marcação fora de hora.');
  await refOf(ctx.db, host).collection('line_calls').add(semNulos({
    uid: guestUid(hash),
    position: invite.position,
    kind: e.kind,
    call: e.call,
    reason: typeof e.reason === 'string' ? e.reason.slice(0, 12) : null,
    t_ms: Math.round(e.t_ms),
    margin_m: num(e.margin_m),
    uncertainty_m: num(e.uncertainty_m),
    depth_m: num(e.depth_m),
    serve: e.serve === true ? true : null,
    x: num(e.x),
    y: num(e.y),
    created_at: ctx.FieldValue.serverTimestamp(),
  }));
  return { ok: true };
}

const ACOES = { peek, beat, leave, call };

async function lineGuest(ctx, data = {}) {
  const fn = ACOES[data.action];
  if (!fn) throw new LineGuestError('invalid-argument', 'Ação desconhecida.');
  return fn(ctx, data);
}

module.exports = { lineGuest, LineGuestError, hashToken, guestUid, MAX_HOURS, NEUTRO };
