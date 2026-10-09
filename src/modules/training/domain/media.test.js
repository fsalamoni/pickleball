import { describe, it, expect } from 'vitest';
import {
  HARD_LIMITS, MAX_MEDIA, parseTimeSeconds, formatTimeSeconds, parseVideoUrl, isStorageUrl,
  normalizeMedia, normalizeMediaList, uploadLimits, uploadPermission, validateUpload, storageFileName,
  trainingStoragePath,
} from './media.js';

const YT = 'dQw4w9WgXcQ';
const STORAGE = 'https://firebasestorage.googleapis.com/v0/b/proj/o/treino%2Fu1%2Fa.mp4?alt=media';
const MB = 1024 * 1024;

describe('parseTimeSeconds / formatTimeSeconds', () => {
  it.each([
    ['90', 90], ['90s', 90], ['1m30s', 90], ['1:30', 90], ['01:02:03', 3723], ['1h', 3600], [' 2M ', 120],
  ])('%s → %i', (v, s) => expect(parseTimeSeconds(v)).toBe(s));

  it.each(['', null, 'abc', '1:2:3:4', 'm', '1.5'])('%s → null', (v) => expect(parseTimeSeconds(v)).toBeNull());

  it('formata m:ss e h:mm:ss', () => {
    expect(formatTimeSeconds(90)).toBe('1:30');
    expect(formatTimeSeconds(5)).toBe('0:05');
    expect(formatTimeSeconds(3723)).toBe('1:02:03');
    expect(formatTimeSeconds(-3)).toBe('0:00');
    expect(formatTimeSeconds('x')).toBe('0:00');
  });
});

describe('parseVideoUrl — YouTube', () => {
  it.each([
    `https://www.youtube.com/watch?v=${YT}`,
    `https://m.youtube.com/watch?v=${YT}`,
    `https://youtu.be/${YT}`,
    `https://www.youtube.com/shorts/${YT}`,
    `https://www.youtube.com/embed/${YT}`,
    `https://www.youtube-nocookie.com/embed/${YT}`,
  ])('%s', (url) => {
    const v = parseVideoUrl(url);
    expect(v.provider).toBe('youtube');
    expect(v.id).toBe(YT);
    expect(v.embedUrl).toContain(`https://www.youtube-nocookie.com/embed/${YT}?`);
    expect(v.embedUrl).toContain('playsinline=1');
    expect(v.thumbUrl).toBe(`https://i.ytimg.com/vi/${YT}/hqdefault.jpg`);
    expect(v.url).toBe(url);
  });

  it('id inválido ⇒ null', () => {
    expect(parseVideoUrl('https://www.youtube.com/watch?v=curto')).toBeNull();
    expect(parseVideoUrl('https://www.youtube.com/watch')).toBeNull();
    expect(parseVideoUrl('https://youtu.be/')).toBeNull();
  });

  it.each([['90'], ['1m30s'], ['1:30']])('t=%s vira início de 90 s', (t) => {
    const v = parseVideoUrl(`https://www.youtube.com/watch?v=${YT}&t=${t}`);
    expect(v.start).toBe(90);
    expect(v.end).toBeNull();
    expect(v.embedUrl).toContain('&start=90');
  });

  it('start/end escolhidos vencem o do link; fim antes do início é descartado', () => {
    const v = parseVideoUrl(`https://youtu.be/${YT}?t=90`, { start: 10, end: 40 });
    expect([v.start, v.end]).toEqual([10, 40]);
    expect(v.embedUrl).toContain('&start=10&end=40');
    const w = parseVideoUrl(`https://youtu.be/${YT}`, { start: 40, end: 40 });
    expect([w.start, w.end]).toEqual([40, null]);
    const x = parseVideoUrl(`https://youtu.be/${YT}?t=90`, { end: 30 });
    expect([x.start, x.end]).toEqual([90, null]);
  });
});

describe('parseVideoUrl — Vimeo, arquivo direto e recusas', () => {
  it('Vimeo com dnt e início pelo #t=', () => {
    const v = parseVideoUrl('https://vimeo.com/123456789#t=1m30s');
    expect(v.provider).toBe('vimeo');
    expect(v.id).toBe('123456789');
    expect(v.start).toBe(90);
    expect(v.embedUrl).toBe('https://player.vimeo.com/video/123456789?autoplay=1&dnt=1&playsinline=1#t=90s');
    expect(parseVideoUrl('https://player.vimeo.com/video/123456789').id).toBe('123456789');
    expect(parseVideoUrl('https://vimeo.com/canal/sem-numero')).toBeNull();
  });

  it.each(['mp4', 'webm', 'mov'])('arquivo .%s direto toca no <video>', (ext) => {
    const v = parseVideoUrl(`https://cdn.exemplo.com/v/clip.${ext}`, { start: 5 });
    expect(v.provider).toBe('web');
    expect(v.embedUrl).toBeNull();
    expect(v.start).toBe(5);
  });

  it('URL do Storage é provider storage', () => {
    expect(parseVideoUrl(STORAGE).provider).toBe('storage');
    expect(parseVideoUrl('https://proj.firebasestorage.app/v0/b/x/o/y?alt=media').provider).toBe('storage');
    expect(isStorageUrl(STORAGE)).toBe(true);
    expect(isStorageUrl('https://exemplo.com/a.mp4')).toBe(false);
  });

  it('recusa http, javascript:, página comum e lixo', () => {
    expect(parseVideoUrl(`http://www.youtube.com/watch?v=${YT}`)).toBeNull();
    expect(parseVideoUrl('javascript:alert(1)')).toBeNull();
    expect(parseVideoUrl('https://exemplo.com/pagina')).toBeNull();
    expect(parseVideoUrl('')).toBeNull();
    expect(parseVideoUrl(null)).toBeNull();
  });
});

describe('normalizeMedia', () => {
  it('imagem por link https; http recusado', () => {
    expect(normalizeMedia({ type: 'image', url: 'https://exemplo.com/a.jpg' }))
      .toEqual({ type: 'image', source: 'url', url: 'https://exemplo.com/a.jpg', path: null, provider: 'web', caption: '', tag: 'demo' });
    expect(normalizeMedia({ type: 'image', url: 'http://exemplo.com/a.jpg' })).toBeNull();
    expect(normalizeMedia({ type: 'audio', url: 'https://exemplo.com/a.mp3' })).toBeNull();
  });

  it('envio só com URL do Storage, e guarda o caminho', () => {
    expect(normalizeMedia({ type: 'image', source: 'upload', url: 'https://exemplo.com/a.jpg', path: 'treino/u/a' })).toBeNull();
    const m = normalizeMedia({ type: 'video', source: 'upload', url: STORAGE, path: 'treino/u1/a.mp4' });
    expect(m.provider).toBe('storage');
    expect(m.path).toBe('treino/u1/a.mp4');
  });

  it('caminho só vale em envio; legenda até 140; tag conhecida', () => {
    const m = normalizeMedia({ type: 'image', url: 'https://exemplo.com/a.jpg', path: 'x', caption: 'c'.repeat(200), tag: 'certo' });
    expect(m.path).toBeNull();
    expect(m.caption).toHaveLength(140);
    expect(m.tag).toBe('certo');
  });

  it('vídeo: link que não é vídeo é recusado; trecho guardado', () => {
    expect(normalizeMedia({ type: 'video', url: 'https://exemplo.com/pagina' })).toBeNull();
    const v = normalizeMedia({ type: 'video', url: `https://youtu.be/${YT}?t=90`, start: 30, end: 45 });
    expect(v.provider).toBe('youtube');
    expect([v.start, v.end]).toEqual([30, 45]);
    const w = normalizeMedia({ type: 'video', url: `https://youtu.be/${YT}?t=90` });
    expect([w.start, w.end]).toEqual([90, null]);
  });

  it(`lista: descarta inválidos e corta em ${MAX_MEDIA}`, () => {
    const list = Array.from({ length: 12 }, (_, i) => ({ type: 'image', url: `https://exemplo.com/${i}.jpg` }));
    expect(normalizeMediaList([{ type: 'x' }, ...list])).toHaveLength(MAX_MEDIA);
    expect(normalizeMediaList(undefined)).toEqual([]);
  });
});

describe('uploadLimits', () => {
  it('padrões', () => {
    expect(uploadLimits()).toEqual({ enabled: true, videoEnabled: true, imageMb: 3, videoMb: 60, videoSeconds: 60, perUser: 40 });
  });

  it('nunca acima do teto rígido; o admin só pode baixar', () => {
    const l = uploadLimits({ max_image_mb: 10, max_video_mb: 500, max_video_seconds: 900, max_uploads_per_user: 9999 });
    expect(l.imageMb).toBe(HARD_LIMITS.imageMb);
    expect(l.videoMb).toBe(HARD_LIMITS.videoMb);
    expect(l.videoSeconds).toBe(HARD_LIMITS.videoSeconds);
    expect(l.perUser).toBe(500);
    const b = uploadLimits({ max_image_mb: 1, max_video_mb: 20, max_video_seconds: 30, max_uploads_per_user: 10 });
    expect([b.imageMb, b.videoMb, b.videoSeconds, b.perUser]).toEqual([1, 20, 30, 10]);
  });

  it('cota 0 é escolha do admin (ninguém envia), não "sem valor"', () => {
    expect(uploadLimits({ max_uploads_per_user: 0 }).perUser).toBe(0);
    expect(uploadLimits({ max_uploads_per_user: null }).perUser).toBe(40);
    expect(uploadLimits({ max_image_mb: 0 }).imageMb).toBe(3);
  });

  it('desligar envio desliga vídeo junto', () => {
    expect(uploadLimits({ allow_uploads: false })).toMatchObject({ enabled: false, videoEnabled: false });
    expect(uploadLimits({ allow_video_upload: false })).toMatchObject({ enabled: true, videoEnabled: false });
  });
});

describe('uploadPermission', () => {
  const limits = uploadLimits();

  it('desligado', () => {
    expect(uploadPermission({ limits: uploadLimits({ allow_uploads: false }) }).ok).toBe(false);
    expect(uploadPermission({}).ok).toBe(false);
  });

  it('menor de 18: só link; idade desconhecida não bloqueia', () => {
    expect(uploadPermission({ ageYears: 17, limits })).toEqual({ ok: false, reason: expect.stringMatching(/menores de 18/) });
    expect(uploadPermission({ ageYears: 18, limits }).ok).toBe(true);
    expect(uploadPermission({ ageYears: null, limits }).ok).toBe(true);
  });

  it('cota por pessoa', () => {
    expect(uploadPermission({ limits, usedCount: 39 }).ok).toBe(true);
    expect(uploadPermission({ limits, usedCount: 40 }).reason).toMatch(/limite de 40/);
    expect(uploadPermission({ limits: uploadLimits({ max_uploads_per_user: 0 }), usedCount: 0 }).ok).toBe(false);
  });
});

describe('validateUpload', () => {
  const limits = uploadLimits();

  it('imagem dentro e fora do limite', () => {
    expect(validateUpload({ type: 'image/webp', size: 2 * MB }, limits)).toEqual({ ok: true, type: 'image', error: '' });
    expect(validateUpload({ type: 'image/png', size: 3.5 * MB }, limits).error)
      .toBe('A imagem tem 3,5 MB. Ela precisa ter menos de 3 MB.');
    expect(validateUpload({ type: 'image/jpeg', size: 0 }, limits).error).toBe('Arquivo vazio.');
    // Exatamente no limite é recusado, como na regra do Storage (`size < 3 MB`).
    expect(validateUpload({ type: 'image/webp', size: 3 * MB }, limits).ok).toBe(false);
    expect(validateUpload({ type: 'video/mp4', size: 60 * MB }, limits).ok).toBe(false);
  });

  it('vídeo: desligado, tamanho e duração', () => {
    expect(validateUpload({ type: 'video/mp4', size: MB }, uploadLimits({ allow_video_upload: false })).error)
      .toMatch(/vídeo está desligado/);
    expect(validateUpload({ type: 'video/webm', size: 61 * MB }, limits).error).toBe('O vídeo tem 61 MB. Ele precisa ter menos de 60 MB.');
    expect(validateUpload({ type: 'video/quicktime', size: 10 * MB, durationSec: 75 }, limits).error)
      .toBe('O vídeo tem 75 s. O máximo é 60 s.');
    // meio segundo de folga (o `<video>` arredonda)
    expect(validateUpload({ type: 'video/mp4', size: 10 * MB, durationSec: 60.4 }, limits).ok).toBe(true);
    expect(validateUpload({ type: 'video/mp4', size: 10 * MB }, limits).ok).toBe(true);
  });

  it('formato não aceito', () => {
    const r = validateUpload({ type: 'image/gif', size: MB }, limits);
    expect(r.ok).toBe(false);
    expect(r.type).toBeNull();
    expect(r.error).toMatch(/Formato não aceito/);
  });

  it('sem limites explícitos usa os padrões', () => {
    expect(validateUpload({ type: 'image/webp', size: 4 * MB }).ok).toBe(false);
  });
});

describe('nome e caminho no Storage', () => {
  it('extensão pelo tipo e nome determinístico com now/rand', () => {
    expect(storageFileName('image/jpeg', 1000, 0.5)).toBe(`1000-${Math.floor(0.5 * 1e9).toString(36)}.jpg`);
    expect(storageFileName('video/quicktime', 1, 0)).toBe('1-0.mov');
    expect(storageFileName('image/webp', 1, 0)).toMatch(/\.webp$/);
    expect(storageFileName('application/pdf', 1, 0)).toMatch(/\.bin$/);
  });

  it('o caminho é o que o storage.rules autoriza', () => {
    expect(trainingStoragePath('u1', 'a.webp')).toBe('treino/u1/a.webp');
  });
});
