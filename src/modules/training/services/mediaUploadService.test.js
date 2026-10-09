/**
 * Preparo da mídia de treino ANTES de subir:
 *  - imagem em WebP, ou JPEG quando o navegador não codifica WebP;
 *  - duração do vídeo com tempo-limite (nunca fica pendurado);
 *  - .mov e vídeo que o navegador não abre: AVISO, não bloqueio.
 */
import {
  describe, it, expect, beforeEach, afterEach, vi,
} from 'vitest';
import { uploadLimits } from '../domain/media.js';

vi.mock('firebase/storage', () => ({}));
vi.mock('@/core/config/firebase', () => ({ storage: null }));
vi.mock('@/core/lib/logger', () => ({ logger: { error: vi.fn() } }));
const strip = vi.fn(async (f) => f);
vi.mock('@/core/lib/imageMetadata', () => ({ stripImageMetadata: (f) => strip(f) }));

const {
  compressImage, measureVideoDuration, prepareUpload, VIDEO_DURATION_TIMEOUT_MS,
} = await import('./mediaUploadService.js');

// O que o navegador "sabe" codificar e como o vídeo se comporta.
const nav = { codifica: ['image/webp', 'image/jpeg'], video: { evento: 'meta', duracao: 30 } };
const criarOriginal = document.createElement.bind(document);
const ctx = { drawImage: vi.fn(), fillRect: vi.fn() };

beforeEach(() => {
  nav.codifica = ['image/webp', 'image/jpeg'];
  nav.video = { evento: 'meta', duracao: 30 };
  strip.mockClear();
  ctx.fillRect.mockClear();
  globalThis.createImageBitmap = vi.fn(async () => ({ width: 3200, height: 1600, close: vi.fn() }));
  URL.createObjectURL = vi.fn(() => 'blob:x');
  URL.revokeObjectURL = vi.fn();
  vi.spyOn(document, 'createElement').mockImplementation((tag) => {
    if (tag === 'canvas') {
      return {
        width: 0,
        height: 0,
        getContext: () => ctx,
        // Navegador sem o formato devolve PNG (o padrão do canvas), não o pedido.
        toBlob: (cb, tipo) => cb(nav.codifica.includes(tipo) ? new Blob(['x'], { type: tipo }) : (nav.codifica.length ? new Blob(['x'], { type: 'image/png' }) : null)),
      };
    }
    if (tag === 'video') {
      const v = { duration: NaN, removeAttribute: vi.fn() };
      Object.defineProperty(v, 'src', {
        set() {
          queueMicrotask(() => {
            if (nav.video.evento === 'meta') { v.duration = nav.video.duracao; v.onloadedmetadata?.(); }
            if (nav.video.evento === 'erro') v.onerror?.();
            // 'nada': o navegador nunca responde.
          });
        },
      });
      return v;
    }
    return criarOriginal(tag);
  });
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
  delete globalThis.createImageBitmap;
});

const foto = (tipo = 'image/png') => new File([new Uint8Array(500_000)], 'foto', { type: tipo });
const video = (tipo = 'video/mp4') => new File([new Uint8Array(1000)], 'clipe', { type: tipo });

describe('compressImage', () => {
  it('codifica em WebP quando o navegador sabe', async () => {
    const f = await compressImage(foto());
    expect(f.type).toBe('image/webp');
    expect(f.name).toBe('imagem.webp');
  });

  it('⭐ sem WebP, cai para JPEG (com fundo branco para a transparência)', async () => {
    nav.codifica = ['image/jpeg'];
    const f = await compressImage(foto());
    expect(f.type).toBe('image/jpeg');
    expect(f.name).toBe('imagem.jpg');
    expect(ctx.fillRect).toHaveBeenCalled();
  });

  it('sem codificador nenhum, devolve o original sem metadados', async () => {
    nav.codifica = [];
    const original = foto('image/jpeg');
    expect(await compressImage(original)).toBe(original);
    expect(strip).toHaveBeenCalledWith(original);
  });
});

describe('duração do vídeo', () => {
  it('lê a duração pelo navegador', async () => {
    expect(await measureVideoDuration(video())).toBe(30);
  });

  it('⭐ nunca fica pendurado: passado o tempo-limite, devolve null', async () => {
    vi.useFakeTimers();
    nav.video = { evento: 'nada' };
    const p = measureVideoDuration(video());
    await vi.advanceTimersByTimeAsync(VIDEO_DURATION_TIMEOUT_MS + 10);
    expect(await p).toBeNull();
    expect(URL.revokeObjectURL).toHaveBeenCalled();
  });
});

describe('prepareUpload', () => {
  const limites = uploadLimits({});

  it('⭐ vídeo que não responde a tempo: erro claro em pt-BR, sem subir', async () => {
    vi.useFakeTimers();
    nav.video = { evento: 'nada' };
    const p = prepareUpload(video(), limites);
    await vi.advanceTimersByTimeAsync(VIDEO_DURATION_TIMEOUT_MS + 10);
    const r = await p;
    expect(r.ok).toBe(false);
    expect(r.file).toBeNull();
    expect(r.error).toMatch(/duração do vídeo/);
  });

  it('⭐ .mov passa, com o aviso de que pode não tocar em todo aparelho', async () => {
    const r = await prepareUpload(video('video/quicktime'), limites);
    expect(r.ok).toBe(true);
    expect(r.warning).toMatch(/\.mov/);
  });

  it('vídeo que o navegador não abre passa com aviso (a duração não dá para medir)', async () => {
    nav.video = { evento: 'erro' };
    const r = await prepareUpload(video(), limites);
    expect(r.ok).toBe(true);
    expect(r.warning).toMatch(/pode não tocar/);
  });

  it('MP4 normal: sem aviso', async () => {
    const r = await prepareUpload(video(), limites);
    expect(r).toMatchObject({ ok: true, type: 'video' });
    expect(r.warning).toBeUndefined();
  });

  it('vídeo longo demais é recusado pela duração', async () => {
    nav.video = { evento: 'meta', duracao: 95 };
    const r = await prepareUpload(video(), limites);
    expect(r.ok).toBe(false);
    expect(r.error).toMatch(/95 s/);
  });

  it('imagem sai comprimida e sem aviso', async () => {
    const r = await prepareUpload(foto(), limites);
    expect(r).toMatchObject({ ok: true, type: 'image' });
    expect(r.file.type).toBe('image/webp');
    expect(r.warning).toBeUndefined();
  });
});
