/**
 * Mídia dos itens de treino: imagens e vídeos, por LINK ou por ENVIO.
 *
 * - Vídeo por link: YouTube e Vimeo viram um player com FACHADA (capa + um
 *   clique; nada de terceiros carrega antes do clique), em
 *   `youtube-nocookie.com` / `player.vimeo.com` com `dnt=1`. Arquivo direto
 *   (`.mp4`, `.webm`, `.mov`) toca no `<video>` do navegador.
 * - Imagem por link: qualquer `https://`; se não carregar, a tela diz.
 * - Envio: limites da plataforma (`platform_settings/training`), conferidos
 *   aqui ANTES de subir e de novo no `storage.rules` (teto rígido).
 */

import { safeHttpUrl } from '@/core/domain/externalUrl';

export const MEDIA_TYPES = Object.freeze(['image', 'video']);
export const MEDIA_TAGS = Object.freeze(['demo', 'certo', 'errado']);
export const MEDIA_TAG_LABELS = Object.freeze({ demo: 'Demonstração', certo: 'Certo', errado: 'Errado' });
export const MAX_MEDIA = 8;

/** Tetos rígidos — os mesmos do `storage.rules`. A configuração do admin só pode BAIXAR. */
export const HARD_LIMITS = Object.freeze({ imageMb: 3, videoMb: 60, videoSeconds: 120 });

export const IMAGE_MIME = Object.freeze(['image/webp', 'image/jpeg', 'image/png']);
export const VIDEO_MIME = Object.freeze(['video/mp4', 'video/webm', 'video/quicktime']);

const YT_ID = /^[A-Za-z0-9_-]{11}$/;

/** "90", "90s", "1m30s", "1:30", "01:02:03" → segundos; `null` se inválido. */
export function parseTimeSeconds(value) {
  const v = String(value ?? '').trim().toLowerCase();
  if (!v) return null;
  if (/^\d+$/.test(v)) return Number(v);
  if (/^\d+(:\d{1,2}){1,2}$/.test(v)) {
    return v.split(':').map(Number).reduce((acc, n) => acc * 60 + n, 0);
  }
  const m = v.match(/^(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s)?$/);
  if (!m || (!m[1] && !m[2] && !m[3])) return null;
  return Number(m[1] || 0) * 3600 + Number(m[2] || 0) * 60 + Number(m[3] || 0);
}

/** Segundos → "m:ss" (ou "h:mm:ss"). */
export function formatTimeSeconds(sec) {
  const n = Math.max(0, Math.floor(Number(sec) || 0));
  const h = Math.floor(n / 3600);
  const m = Math.floor((n % 3600) / 60);
  const s = String(n % 60).padStart(2, '0');
  return h ? `${h}:${String(m).padStart(2, '0')}:${s}` : `${m}:${s}`;
}

function hostOf(url) {
  try { return new URL(url).hostname.toLowerCase().replace(/^www\./, '').replace(/^m\./, ''); } catch { return ''; }
}

/**
 * Reconhece um link de vídeo. O minuto marcado no link (`?t=90`, `t=1m30s`,
 * `#t=1:30` no Vimeo) vira o início do player; `opts.start`/`opts.end`
 * (segundos) vencem o do link — é o trecho que o professor escolheu.
 * @param {string} value
 * @param {{ start?: number|null, end?: number|null }} [opts]
 * @returns {{ provider: 'youtube'|'vimeo'|'web'|'storage', id: string|null, embedUrl: string|null,
 *   thumbUrl: string|null, url: string, start: number|null, end: number|null } | null}
 */
export function parseVideoUrl(value, opts = {}) {
  const url = safeHttpUrl(value, { maxLength: 1000 });
  if (!url || !url.startsWith('https://')) return null;
  let parsed;
  try { parsed = new URL(url); } catch { return null; }
  const host = hostOf(url);
  if (host === 'youtube.com' || host === 'youtube-nocookie.com' || host === 'youtu.be') {
    let id = null;
    if (host === 'youtu.be') id = parsed.pathname.slice(1).split('/')[0];
    else if (parsed.pathname === '/watch') id = parsed.searchParams.get('v');
    else {
      const m = parsed.pathname.match(/^\/(?:embed|shorts|live|v)\/([^/?#]+)/);
      id = m ? m[1] : null;
    }
    if (!id || !YT_ID.test(id)) return null;
    const { start, end } = trecho(parsed.searchParams.get('t') ?? parsed.searchParams.get('start'), opts);
    const extra = `${start ? `&start=${start}` : ''}${end ? `&end=${end}` : ''}`;
    return {
      provider: 'youtube',
      id,
      embedUrl: `https://www.youtube-nocookie.com/embed/${id}?autoplay=1&rel=0&modestbranding=1&playsinline=1${extra}`,
      thumbUrl: `https://i.ytimg.com/vi/${id}/hqdefault.jpg`,
      url,
      start,
      end,
    };
  }
  if (host === 'vimeo.com' || host === 'player.vimeo.com') {
    const m = parsed.pathname.match(/(?:^|\/)(\d{5,12})(?:\/|$)/);
    if (!m) return null;
    const hashT = parsed.hash.match(/t=([^&]+)/);
    const { start, end } = trecho(hashT ? hashT[1] : null, opts);
    return {
      provider: 'vimeo',
      id: m[1],
      embedUrl: `https://player.vimeo.com/video/${m[1]}?autoplay=1&dnt=1&playsinline=1${start ? `#t=${start}s` : ''}`,
      thumbUrl: null,
      url,
      start,
      end,
    };
  }
  if (/\.(mp4|webm|mov)$/i.test(parsed.pathname) || isStorageUrl(url)) {
    // Arquivo direto: o trecho entra como fragmento de mídia (`#t=ini,fim`).
    const { start, end } = trecho(null, opts);
    return { provider: isStorageUrl(url) ? 'storage' : 'web', id: null, embedUrl: null, thumbUrl: null, url, start, end };
  }
  return null;
}

/** Início/fim do trecho: os escolhidos vencem o do link; fim antes do início é descartado. */
function trecho(linkT, opts = {}) {
  const pick = (v) => (Number.isFinite(Number(v)) && v !== null && v !== '' && Number(v) > 0 ? Math.floor(Number(v)) : null);
  const start = pick(opts.start) ?? pick(parseTimeSeconds(linkT));
  let end = pick(opts.end);
  if (end !== null && start !== null && end <= start) end = null;
  return { start, end };
}

export function isStorageUrl(url) {
  const host = hostOf(url);
  return host === 'firebasestorage.googleapis.com' || host.endsWith('.firebasestorage.app');
}

/** Normaliza uma entrada de mídia; `null` se inválida. */
export function normalizeMedia(raw = {}) {
  const type = MEDIA_TYPES.includes(raw?.type) ? raw.type : null;
  if (!type) return null;
  const source = raw.source === 'upload' ? 'upload' : 'url';
  const url = safeHttpUrl(raw.url, { maxLength: 1000 });
  if (!url || !url.startsWith('https://')) return null;
  let provider = isStorageUrl(url) ? 'storage' : 'web';
  if (type === 'video') {
    const v = parseVideoUrl(url);
    if (!v) return null;
    provider = v.provider;
  }
  if (source === 'upload' && provider !== 'storage') return null;
  const path = source === 'upload' ? String(raw.path ?? '').trim().slice(0, 300) || null : null;
  const out = {
    type,
    source,
    url,
    path,
    provider,
    caption: String(raw.caption ?? '').trim().slice(0, 140),
    tag: MEDIA_TAGS.includes(raw.tag) ? raw.tag : 'demo',
  };
  if (type === 'video') {
    const { start, end } = parseVideoUrl(url, { start: raw.start, end: raw.end });
    out.start = start;
    out.end = end;
  }
  return out;
}

export function normalizeMediaList(list) {
  return (Array.isArray(list) ? list : []).map(normalizeMedia).filter(Boolean).slice(0, MAX_MEDIA);
}

/**
 * Limites efetivos de envio: a configuração do admin, nunca acima do teto rígido.
 * @param {object} settings `platform_settings/training` normalizado
 */
export function uploadLimits(settings = {}) {
  // `allowZero`: cota 0 é escolha do admin (ninguém envia), não "sem valor".
  const cap = (v, max, def, allowZero = false) => {
    const n = v === null || v === '' ? NaN : Number(v);
    return Number.isFinite(n) && (n > 0 || (allowZero && n === 0)) ? Math.min(n, max) : Math.min(def, max);
  };
  return {
    enabled: settings.allow_uploads !== false,
    videoEnabled: settings.allow_uploads !== false && settings.allow_video_upload !== false,
    imageMb: cap(settings.max_image_mb, HARD_LIMITS.imageMb, 3),
    videoMb: cap(settings.max_video_mb, HARD_LIMITS.videoMb, 60),
    videoSeconds: cap(settings.max_video_seconds, HARD_LIMITS.videoSeconds, 60),
    perUser: cap(settings.max_uploads_per_user, 500, 40, true),
  };
}

/**
 * Pode enviar arquivo? Menor de 18 anos: não (só link) — decisão do plano,
 * até parecer jurídico. Idade desconhecida não bloqueia.
 * @returns {{ ok: boolean, reason: string }}
 */
export function uploadPermission({ ageYears = null, limits, usedCount = 0 } = {}) {
  if (!limits?.enabled) return { ok: false, reason: 'O envio de arquivos está desligado no momento. Use um link.' };
  if (Number.isFinite(ageYears) && ageYears < 18) {
    return { ok: false, reason: 'Para menores de 18 anos, a mídia entra só por link.' };
  }
  if (usedCount >= limits.perUser) {
    return { ok: false, reason: `Você chegou ao limite de ${limits.perUser} arquivos enviados. Apague algum ou use um link.` };
  }
  return { ok: true, reason: '' };
}

const mb = (bytes) => bytes / (1024 * 1024);
const fmt = (n) => (Number.isInteger(n) ? String(n) : n.toFixed(1)).replace('.', ',');

/**
 * Confere um arquivo antes de subir. `durationSec` vem do `<video>` do navegador.
 * @returns {{ ok: boolean, type: 'image'|'video'|null, error: string }}
 */
export function validateUpload({ type: mime = '', size = 0, durationSec = null } = {}, limits) {
  const lim = limits || uploadLimits();
  if (IMAGE_MIME.includes(mime)) {
    if (size <= 0) return { ok: false, type: 'image', error: 'Arquivo vazio.' };
    // Estrito, como o `storage.rules` (`size < N MB`).
    if (mb(size) >= lim.imageMb) {
      return { ok: false, type: 'image', error: `A imagem tem ${fmt(mb(size))} MB. Ela precisa ter menos de ${fmt(lim.imageMb)} MB.` };
    }
    return { ok: true, type: 'image', error: '' };
  }
  if (VIDEO_MIME.includes(mime)) {
    if (!lim.videoEnabled) return { ok: false, type: 'video', error: 'O envio de vídeo está desligado. Use um link do YouTube ou Vimeo.' };
    if (size <= 0) return { ok: false, type: 'video', error: 'Arquivo vazio.' };
    if (mb(size) >= lim.videoMb) {
      return { ok: false, type: 'video', error: `O vídeo tem ${fmt(mb(size))} MB. Ele precisa ter menos de ${fmt(lim.videoMb)} MB.` };
    }
    if (Number.isFinite(durationSec) && durationSec > lim.videoSeconds + 0.5) {
      return { ok: false, type: 'video', error: `O vídeo tem ${Math.round(durationSec)} s. O máximo é ${lim.videoSeconds} s.` };
    }
    return { ok: true, type: 'video', error: '' };
  }
  return { ok: false, type: null, error: 'Formato não aceito. Imagens: JPG, PNG ou WebP. Vídeos: MP4, WebM ou MOV.' };
}

/** Nome de arquivo seguro para o Storage: `<agora>-<aleatório>.<ext>`. */
export function storageFileName(mime, now = Date.now(), rand = Math.random()) {
  const ext = { 'image/webp': 'webp', 'image/jpeg': 'jpg', 'image/png': 'png', 'video/mp4': 'mp4', 'video/webm': 'webm', 'video/quicktime': 'mov' }[mime] || 'bin';
  return `${now}-${Math.floor(rand * 1e9).toString(36)}.${ext}`;
}

/** Caminho no Storage — o mesmo que o `storage.rules` autoriza. */
export function trainingStoragePath(uid, fileName) {
  return `treino/${uid}/${fileName}`;
}
