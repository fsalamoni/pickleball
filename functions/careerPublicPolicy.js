/**
 * MINHA CARREIRA — a régua da VITRINE pública no servidor (PR 7, docs/54 §2.8).
 *
 * CÓPIA de `src/modules/career/domain/careerPublic.js` (a projeção pública e os
 * limites) e de `src/core/lib/imageMetadata.js` (tirar EXIF/XMP/IPTC do JPEG),
 * com teste de paridade em `careerPublicPolicy.parity.test.js`: mexer num lado
 * só quebra o teste.
 *
 * Mais o que só o servidor decide:
 *  - o SELO, recalculado dos documentos que só o servidor grava (`career_partner`
 *    e o torneio da plataforma) — o que o dono escreve no próprio evento nunca
 *    vira selo;
 *  - quais duplas aparecem com NOME: confirmada, maior de 18, com a impressão do
 *    que confirmou igual ao registro de agora e com o "sim" DELA (`public_ok_partner`).
 */
const P = require('./careerPolicy.js');

const SHOWCASE_LIMITS = Object.freeze({ items: 20, photos: 6, partnerships: 5 });
const SHOWCASE_EVENT_FIELDS = Object.freeze([
  'name', 'start_date', 'end_date', 'date_precision', 'city', 'state',
  'federated', 'federation_name', 'federation_acronym', 'stage_tier',
]);
const SHOWCASE_ENTRY_FIELDS = Object.freeze([
  'format', 'gender', 'age', 'age_label', 'level_bracket', 'level_label', 'placement', 'placement_n',
]);

const vazio = (v) => v === undefined || v === null || v === '';

function showcaseItem(event, { seal, partners = {}, photos = [] } = {}) {
  const ev = event || {};
  const out = { uid: ev.uid, event_id: ev.id, seal: ['official', 'confirmed'].includes(seal) ? seal : 'declared' };
  // O selo Oficial confere só que a pessoa JOGOU o torneio da plataforma: a colocação
  // declarada não vai junto (a oficial é a do pódio, na estante). docs/54 §7.
  const oficial = out.seal === 'official';
  SHOWCASE_EVENT_FIELDS.forEach((k) => { if (!vazio(ev[k])) out[k] = ev[k]; });
  out.entries = (Array.isArray(ev.entries) ? ev.entries : []).slice(0, 6).map((e) => {
    const x = {};
    SHOWCASE_ENTRY_FIELDS.forEach((k) => { if (e && !vazio(e[k]) && !(oficial && k.startsWith('placement'))) x[k] = e[k]; });
    if (e && e.format === 'doubles' && e.partner && !vazio(e.partner.name)) {
      const p = e.partner.uid ? partners[e.partner.uid] : null;
      if (p && p.name) x.partner = { uid: e.partner.uid, name: String(p.name).slice(0, 80), photo_url: p.photo_url || null };
      else x.with_partner = true;
    }
    return x;
  });
  // Quem aparece com NOME: a exclusão de conta acha a vitrine de OUTRA pessoa por aqui, sem depender de gatilho.
  out.named_uids = [...new Set(out.entries.map((x) => x.partner && x.partner.uid).filter(Boolean))];
  out.photos = (photos || []).slice(0, SHOWCASE_LIMITS.photos).map((p) => ({
    path: p.path, url: p.url, kind: p.kind || 'other', alt: String(p.alt || '').slice(0, 140),
  }));
  return out;
}

// `nonce`: cada cópia tem caminho próprio — duas publicações ao mesmo tempo nunca gravam (nem apagam) o mesmo arquivo.
const publicPhotoPath = (uid, eventId, srcPath, nonce = '') => `carreira-publica/${uid}/${eventId}__${nonce ? `${nonce}__` : ''}${String(srcPath).split('/').pop()}`;
function sourceOfPublicPhoto(uid, path) {
  const nome = String(path || '').split('/').pop();
  const i = nome.lastIndexOf('__');
  return i > 0 ? `carreira/${uid}/${nome.slice(i + 2)}` : '';
}

/** Cópia de `canShowcaseEvent` (cliente): o torneio pode ir à vitrine? */
function canShowcaseEvent(ev, today) {
  return Boolean(ev) && ev.status !== 'cancelled' && ev.status !== 'planned' && !ev.planned_passed
    && Boolean(ev.start_date) && String(ev.start_date) <= String(today) && !String(ev.origin_ref || '').startsWith('tor:');
}

const ABERTOS = [P.PARTNER_STATUS.INVITED, P.PARTNER_STATUS.RECONFIRM];
const confere = (ev, d) => P.careerFingerprint(ev, P.citedEntryIndexes(ev, d.partner_uid)) === d.fingerprint;

/**
 * A impressão do que a DUPLA viu ao permitir o nome: a de `careerFingerprint`
 * (datas e participações citadas) MAIS os campos públicos do torneio (nome,
 * cidade, federação, etapa). Gravada em `public_fp` no "sim"; trocar o nome ou a
 * cidade depois tira o nome da dupla até ela permitir de novo.
 */
function consentFingerprint(ev, partnerUid) {
  const e = ev || {};
  return [P.careerFingerprint(e, P.citedEntryIndexes(e, partnerUid)),
    ...SHOWCASE_EVENT_FIELDS.map((k) => (vazio(e[k]) ? '' : String(e[k])))].join('|');
}

/** Comparação que não depende da ordem das chaves (o Firestore devolve o mapa ordenado). */
function stableJson(v) {
  if (Array.isArray(v)) return `[${v.map(stableJson).join(',')}]`;
  if (v && typeof v === 'object') return `{${Object.keys(v).sort().map((k) => `${JSON.stringify(k)}:${stableJson(v[k])}`).join(',')}}`;
  return JSON.stringify(v === undefined ? null : v);
}

/**
 * Selo recalculado (a mesma conta de `careerSeal` + `partnerSealFor` do cliente):
 * oficial (o servidor conferiu o torneio da plataforma) > confirmado pela dupla
 * (nada esperando nova confirmação e a impressão confere) > declarado.
 */
function showcaseSeal(ev, partnerDocs, official) {
  if (official) return 'official';
  const docs = (partnerDocs || []).filter((d) => d && d.event_id === ev.id);
  if (docs.some((d) => ABERTOS.includes(d.status))) return 'declared';
  return docs.some((d) => d.status === P.PARTNER_STATUS.CONFIRMED && confere(ev, d)) ? 'confirmed' : 'declared';
}

/** As duplas que podem aparecer com nome: `uid → true`. `adultos`: Set dos uids maiores de 18. */
function consentingPartners(ev, partnerDocs, adultos) {
  const ok = {};
  (partnerDocs || []).forEach((d) => {
    if (d && d.event_id === ev.id && d.status === P.PARTNER_STATUS.CONFIRMED && d.public_ok_partner === true
      && confere(ev, d) && d.public_fp === consentFingerprint(ev, d.partner_uid) && adultos.has(d.partner_uid)) ok[d.partner_uid] = true;
  });
  return ok;
}

/* ------------------------------------------------- EXIF fora do JPEG -- */

const EXIF_SIG = [0x45, 0x78, 0x69, 0x66, 0x00, 0x00];
const XMP_SIG = 'http://ns.adobe.com/xap/1.0/';
const startsWithBytes = (b, o, sig) => o + sig.length <= b.length && sig.every((x, i) => b[o + i] === x);
function isXmp(b, s, e) {
  let txt = '';
  for (let i = s; i < Math.min(s + XMP_SIG.length, e); i += 1) txt += String.fromCharCode(b[i]);
  return txt === XMP_SIG;
}
const isJpeg = (b) => b.length > 3 && b[0] === 0xff && b[1] === 0xd8;

/** O mesmo percurso de `stripJpegMetadataBytes` (cliente): `null` = nada a tirar ou estrutura estranha. */
function stripJpegMetadataBytes(bytes) {
  if (!isJpeg(bytes)) return null;
  const keep = [[0, 2]];
  let i = 2;
  let removed = false;
  while (i < bytes.length) {
    if (bytes[i] !== 0xff) return null;
    if (bytes[i + 1] === 0xff) { keep.push([i, i + 1]); i += 1; continue; }
    const marker = bytes[i + 1];
    if (marker === undefined) return null;
    if (marker === 0xd8 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) { keep.push([i, i + 2]); i += 2; continue; }
    if (marker === 0xd9 || marker === 0xda) { keep.push([i, bytes.length]); break; }
    if (i + 3 >= bytes.length) return null;
    const length = (bytes[i + 2] << 8) | bytes[i + 3];
    if (length < 2) return null;
    const segEnd = i + 2 + length;
    if (segEnd > bytes.length) return null;
    const ps = i + 4;
    if ((marker === 0xe1 && (startsWithBytes(bytes, ps, EXIF_SIG) || isXmp(bytes, ps, segEnd))) || marker === 0xed) removed = true;
    else keep.push([i, segEnd]);
    i = segEnd;
  }
  if (!removed) return null;
  const out = new Uint8Array(keep.reduce((a, [x, y]) => a + (y - x), 0));
  let off = 0;
  keep.forEach(([x, y]) => { out.set(bytes.subarray(x, y), off); off += y - x; });
  return isJpeg(out) ? out : null;
}

/**
 * Bytes da foto PRONTOS para a vitrine, ou `null` quando não dá para garantir
 * que saem sem metadado: JPEG perde EXIF/XMP/IPTC; PNG/WebP com um bloco de
 * metadado (`eXIf`, `EXIF`, `XMP`) são recusados — a tela (`prepareUpload`)
 * já os entrega limpos, então só o envio feito por fora cai aqui.
 */
function cleanPhotoBytes(buf, contentType) {
  const b = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  if (contentType === 'image/jpeg') {
    if (!isJpeg(b)) return null;
    // `null` do percurso é "nada a tirar" OU "estrutura estranha": sem saber qual,
    // decide o que sobrou — assinatura de EXIF/XMP/IPTC em QUALQUER ponto (segmento
    // que o percurso não reconheceu, XMP estendido, imagem extra depois do fim) recusa.
    const out = stripJpegMetadataBytes(b) || b;
    return temMetadado(out) ? null : out;
  }
  const tipos = chunkTypes(b, contentType);
  if (!tipos) return null; // estrutura que não reconhecemos: não publica
  const proibidos = contentType === 'image/png' ? ['eXIf', 'iTXt', 'tEXt', 'zTXt'] : ['EXIF', 'XMP '];
  return tipos.some((x) => proibidos.includes(x)) ? null : b;
}

const ASSINATURAS = ['Exif\u0000\u0000', 'http://ns.adobe.com/', 'Photoshop 3.0'].map((x) => [...x].map((ch) => ch.charCodeAt(0)));
function temMetadado(b) {
  for (let i = 0; i < b.length; i += 1) {
    if (ASSINATURAS.some((sig) => b[i] === sig[0] && startsWithBytes(b, i, sig))) return true;
  }
  return false;
}

/** Os tipos de bloco (chunk) de um PNG ou WebP, ou `null` se a estrutura não fecha. */
function chunkTypes(b, contentType) {
  const tipo = (o) => String.fromCharCode(b[o], b[o + 1], b[o + 2], b[o + 3]);
  const out = [];
  if (contentType === 'image/png') {
    if (b.length < 8 || b[0] !== 0x89 || tipo(1).slice(0, 3) !== 'PNG') return null;
    for (let o = 8; o + 12 <= b.length;) {
      const len = ((b[o] << 24) >>> 0) + (b[o + 1] << 16) + (b[o + 2] << 8) + b[o + 3];
      out.push(tipo(o + 4));
      o += 12 + len;
      if (o > b.length) return null;
    }
    return out;
  }
  if (contentType === 'image/webp') {
    if (b.length < 12 || tipo(0) !== 'RIFF' || tipo(8) !== 'WEBP') return null;
    for (let o = 12; o + 8 <= b.length;) {
      const len = b[o + 4] + (b[o + 5] << 8) + (b[o + 6] << 16) + ((b[o + 7] << 24) >>> 0);
      out.push(tipo(o));
      o += 8 + len + (len % 2);
      if (o > b.length + 1) return null;
    }
    return out;
  }
  return null;
}

module.exports = {
  SHOWCASE_LIMITS,
  SHOWCASE_EVENT_FIELDS,
  SHOWCASE_ENTRY_FIELDS,
  showcaseItem,
  publicPhotoPath,
  sourceOfPublicPhoto,
  showcaseSeal,
  consentingPartners,
  consentFingerprint,
  canShowcaseEvent,
  stableJson,
  stripJpegMetadataBytes,
  cleanPhotoBytes,
};
