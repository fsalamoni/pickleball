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
  const id = `${guestUid(hash)}_${invite.position}`;
  await Promise.all([
    refOf(ctx.db, `${host}/line_cams/${id}`).delete(),
    // A foto da quadra sai junto (a câmera com conta apaga a dela ao sair).
    refOf(ctx.db, `${host}/line_calib/${id}`).delete(),
  ]);
  return { ok: true };
}

/** Teto do texto da foto (o mesmo da regra `lcCal`): o documento tem 1 MiB. */
const SNAP_MAX = 900000;
const SNAP_RE = /^data:image\/jpeg;base64,[A-Za-z0-9+/]/;
const ZONE_RE = /^[a-z_]{1,20}$/;
const pt = (p) => (p && Number.isFinite(p.x) && Number.isFinite(p.y) ? { x: num(p.x), y: num(p.y) } : null);

/** A calibração que a câmera diz ter (`cur`): só números e uma área com cara de id. */
function limparCalib(c) {
  if (!c || typeof c !== 'object') return null;
  const corners = (Array.isArray(c.corners) ? c.corners : []).slice(0, 4).map(pt);
  if (corners.some((p) => !p)) return null;
  return semNulos({
    corners,
    hue: Number.isFinite(c.hue) ? Math.max(0, Math.min(360, c.hue)) : null,
    hueSet: c.hueSet === true ? true : null,
    zone: typeof c.zone === 'string' && ZONE_RE.test(c.zone) ? c.zone : null,
    checkTap: pt(c.checkTap),
  });
}

/**
 * A calibração pela central (docs/53 §5d). Com `fields`, grava o lado da
 * câmera (foto, tamanho do vídeo, o que ela tem, a última calibração
 * aplicada); sempre devolve o que quem organiza mandou.
 */
async function calib(ctx, data) {
  const { host, hash, invite } = await convite(ctx, data);
  const uid = guestUid(hash);
  const ref = refOf(ctx.db, `${host}/line_calib/${uid}_${invite.position}`);
  const f = data.fields;
  if (f && typeof f === 'object') {
    const out = { uid, position: invite.position };
    if (f.snap !== undefined) {
      if (typeof f.snap !== 'string' || f.snap.length >= SNAP_MAX || !SNAP_RE.test(f.snap)) {
        throw new LineGuestError('invalid-argument', 'Foto inválida.');
      }
      out.snap = f.snap;
      out.snap_ms = ctx.now;
    }
    ['vw', 'vh'].forEach((k) => { if (Number.isFinite(f[k])) out[k] = Math.max(1, Math.min(8192, Math.round(f[k]))); });
    if (Number.isFinite(f.applied_ms)) out.applied_ms = Math.round(f.applied_ms);
    const cur = limparCalib(f.cur);
    if (cur) out.cur = cur;
    await ref.set(out, { merge: true });
  }
  const s = await ref.get();
  const d = s.exists ? s.data() : {};
  // Para a câmera, só o que quem organiza mandou (a foto ela mesma tem).
  return {
    calib: d.calib || null,
    calib_ms: d.calib_ms || 0,
    snap_req_ms: d.snap_req_ms || 0,
    snap_ms: d.snap_ms || 0,
    run: typeof d.run === 'boolean' ? d.run : null,
    run_ms: d.run_ms || 0,
    vw: d.vw || null,
  };
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

const ACOES = { peek, beat, leave, call, calib };

async function lineGuest(ctx, data = {}) {
  const fn = ACOES[data.action];
  if (!fn) throw new LineGuestError('invalid-argument', 'Ação desconhecida.');
  return fn(ctx, data);
}

module.exports = { lineGuest, LineGuestError, hashToken, guestUid, MAX_HOURS, NEUTRO, SNAP_MAX };
