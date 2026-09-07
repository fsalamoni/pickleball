import { describe, it, expect } from 'vitest';
import { stripJpegMetadataBytes, stripImageMetadata } from './imageMetadata.js';

/* ---------------- montagem de JPEGs sintéticos para o teste -------------- */

const u8 = (...parts) => {
  const flat = parts.flat();
  return Uint8Array.from(flat);
};
const seg = (marker, payload) => {
  const len = payload.length + 2;
  return [0xff, marker, (len >> 8) & 0xff, len & 0xff, ...payload];
};
const ascii = (s) => [...s].map((c) => c.charCodeAt(0));

const SOI = [0xff, 0xd8];
const EOI = [0xff, 0xd9];
const JFIF = seg(0xe0, [...ascii('JFIF'), 0x00, 1, 1, 0, 0, 1, 0, 1, 0, 0]);
const EXIF_GPS = seg(0xe1, [
  ...ascii('Exif'), 0x00, 0x00,
  0x4d, 0x4d, 0x00, 0x2a,           // TIFF big-endian
  ...ascii('GPSLatitude-23.5505'),  // conteúdo sensível de mentira
  ...ascii('GPSLongitude-46.6333'),
]);
const XMP = seg(0xe1, [...ascii('http://ns.adobe.com/xap/1.0/'), 0x00, ...ascii('<x:xmpmeta/>')]);
const IPTC = seg(0xed, [...ascii('Photoshop 3.0'), 0x00, ...ascii('Sao Paulo')]);
const ICC = seg(0xe2, [...ascii('ICC_PROFILE'), 0x00, 1, 1, 0xaa, 0xbb, 0xcc]);
const DQT = seg(0xdb, [0x00, ...Array(64).fill(0x10)]);
const SOF0 = seg(0xc0, [0x08, 0, 16, 0, 16, 1, 0x11, 0x00]);
const SCAN = [0xff, 0xda, 0x00, 0x08, 0x01, 0x01, 0x00, 0x00, 0x3f, 0x00,
  0xde, 0xad, 0xbe, 0xef, 0x12, 0x34, 0x56, 0x78];

describe('stripJpegMetadataBytes — remoção', () => {
  it('🔴 remove o EXIF com GPS', () => {
    const input = u8(SOI, JFIF, EXIF_GPS, DQT, SOF0, SCAN, EOI);
    const out = stripJpegMetadataBytes(input);
    expect(out).not.toBeNull();
    const text = String.fromCharCode(...out);
    expect(text).not.toContain('GPSLatitude');
    expect(text).not.toContain('GPSLongitude');
    expect(text).not.toContain('Exif');
  });

  it('🔴 remove o XMP', () => {
    const out = stripJpegMetadataBytes(u8(SOI, JFIF, XMP, DQT, SOF0, SCAN, EOI));
    expect(String.fromCharCode(...out)).not.toContain('xmpmeta');
  });

  it('🔴 remove o IPTC (APP13), que pode conter local', () => {
    const out = stripJpegMetadataBytes(u8(SOI, JFIF, IPTC, DQT, SOF0, SCAN, EOI));
    const text = String.fromCharCode(...out);
    expect(text).not.toContain('Photoshop 3.0');
    expect(text).not.toContain('Sao Paulo');
  });

  it('remove os três de uma vez', () => {
    const out = stripJpegMetadataBytes(u8(SOI, JFIF, EXIF_GPS, XMP, IPTC, DQT, SOF0, SCAN, EOI));
    const text = String.fromCharCode(...out);
    expect(text).not.toContain('GPSLatitude');
    expect(text).not.toContain('xmpmeta');
    expect(text).not.toContain('Photoshop');
  });
});

describe('stripJpegMetadataBytes — PRESERVAÇÃO (não estragar a imagem)', () => {
  it('⭐ preserva o perfil de cor ICC — removê-lo mudaria as cores', () => {
    const out = stripJpegMetadataBytes(u8(SOI, JFIF, EXIF_GPS, ICC, DQT, SOF0, SCAN, EOI));
    expect(String.fromCharCode(...out)).toContain('ICC_PROFILE');
  });

  it('⭐ preserva o JFIF (densidade/aspecto)', () => {
    const out = stripJpegMetadataBytes(u8(SOI, JFIF, EXIF_GPS, DQT, SOF0, SCAN, EOI));
    expect(String.fromCharCode(...out)).toContain('JFIF');
  });

  it('⭐ preserva o dado codificado após o SOS, byte a byte', () => {
    const out = stripJpegMetadataBytes(u8(SOI, JFIF, EXIF_GPS, DQT, SOF0, SCAN, EOI));
    const scanBytes = Uint8Array.from([...SCAN, ...EOI]);
    const tail = out.subarray(out.length - scanBytes.length);
    expect(Array.from(tail)).toEqual(Array.from(scanBytes));
  });

  it('⭐ preserva as tabelas de quantização e o quadro', () => {
    const out = stripJpegMetadataBytes(u8(SOI, JFIF, EXIF_GPS, DQT, SOF0, SCAN, EOI));
    const expected = u8(SOI, JFIF, DQT, SOF0, SCAN, EOI);
    expect(Array.from(out)).toEqual(Array.from(expected));
  });

  it('⭐ continua um JPEG válido (SOI no início, EOI no fim)', () => {
    const out = stripJpegMetadataBytes(u8(SOI, JFIF, EXIF_GPS, DQT, SOF0, SCAN, EOI));
    expect(out[0]).toBe(0xff);
    expect(out[1]).toBe(0xd8);
    expect(out[out.length - 2]).toBe(0xff);
    expect(out[out.length - 1]).toBe(0xd9);
  });

  it('encolhe exatamente o tamanho do segmento removido', () => {
    const input = u8(SOI, JFIF, EXIF_GPS, DQT, SOF0, SCAN, EOI);
    const out = stripJpegMetadataBytes(input);
    expect(input.length - out.length).toBe(EXIF_GPS.length);
  });
});

describe('stripJpegMetadataBytes — segurança de falha', () => {
  it('devolve null quando não há nada a remover (não mexe à toa)', () => {
    expect(stripJpegMetadataBytes(u8(SOI, JFIF, DQT, SOF0, SCAN, EOI))).toBeNull();
  });
  it('devolve null para quem não é JPEG (PNG)', () => {
    expect(stripJpegMetadataBytes(u8([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))).toBeNull();
  });
  it('devolve null para arquivo truncado no meio do segmento', () => {
    const input = u8(SOI, JFIF, [0xff, 0xe1, 0x00, 0xff, 0x45]);
    expect(stripJpegMetadataBytes(input)).toBeNull();
  });
  it('devolve null para comprimento de segmento inválido', () => {
    expect(stripJpegMetadataBytes(u8(SOI, [0xff, 0xe1, 0x00, 0x00], EOI))).toBeNull();
  });
  it('devolve null quando falta o marcador 0xFF esperado', () => {
    expect(stripJpegMetadataBytes(u8(SOI, [0x00, 0x11, 0x22], EOI))).toBeNull();
  });
  it('devolve null para entrada vazia', () => {
    expect(stripJpegMetadataBytes(new Uint8Array(0))).toBeNull();
  });
  it('tolera enchimento 0xFF entre segmentos', () => {
    const out = stripJpegMetadataBytes(u8(SOI, JFIF, [0xff], EXIF_GPS, DQT, SOF0, SCAN, EOI));
    expect(out).not.toBeNull();
    expect(String.fromCharCode(...out)).not.toContain('GPSLatitude');
  });
});

describe('stripImageMetadata — camada de Blob', () => {
  const jpegBlob = (bytes) => new Blob([bytes], { type: 'image/jpeg' });

  // O Blob do jsdom nem sempre expõe `arrayBuffer()`. A leitura no código de
  // produção só acontece na ENTRADA (que é um File real do navegador), então
  // isto é limitação do ambiente de teste, não do módulo. O helper abaixo lê
  // de qualquer forma disponível.
  async function readBytes(blob) {
    if (typeof blob.arrayBuffer === 'function') {
      return new Uint8Array(await blob.arrayBuffer());
    }
    return new Uint8Array(await new Response(blob).arrayBuffer());
  }

  it('remove o EXIF de um Blob JPEG', async () => {
    const input = u8(SOI, JFIF, EXIF_GPS, DQT, SOF0, SCAN, EOI);
    const out = await stripImageMetadata(jpegBlob(input));
    const bytes = await readBytes(out);
    expect(String.fromCharCode(...bytes)).not.toContain('GPSLatitude');
    expect(out.type).toBe('image/jpeg');
  });

  it('devolve o MESMO objeto quando não é JPEG (PNG intacto)', async () => {
    const png = new Blob([u8([0x89, 0x50, 0x4e, 0x47])], { type: 'image/png' });
    expect(await stripImageMetadata(png)).toBe(png);
  });

  it('devolve o MESMO objeto quando não há metadado a remover', async () => {
    const clean = jpegBlob(u8(SOI, JFIF, DQT, SOF0, SCAN, EOI));
    expect(await stripImageMetadata(clean)).toBe(clean);
  });

  it('devolve o MESMO objeto diante de entrada inválida — nunca bloqueia o upload', async () => {
    expect(await stripImageMetadata(null)).toBe(null);
    const naoArquivo = { type: 'image/jpeg' };
    expect(await stripImageMetadata(naoArquivo)).toBe(naoArquivo);
  });

  it('preserva o nome do arquivo (o caminho no Storage usa isso)', async () => {
    const input = u8(SOI, JFIF, EXIF_GPS, DQT, SOF0, SCAN, EOI);
    const file = new File([input], 'foto-do-torneio.jpg', { type: 'image/jpeg' });
    const out = await stripImageMetadata(file);
    expect(out.name).toBe('foto-do-torneio.jpg');
  });
});
