/**
 * Remoção de metadados sensíveis de imagem (EXIF/XMP/IPTC), SEM reprocessar.
 *
 * MOTIVO: foto de celular carrega `GPSLatitude`/`GPSLongitude` no EXIF. A
 * plataforma publica imagens em coleções abertas — `tournament_photos` é
 * `allow read: if true`, e a foto de perfil aparece no diretório. Publicar o
 * EXIF junto é vazar a localização de quem tirou a foto, inclusive de menores.
 * Ver docs/20-SEGURANCA-E-PRIVACIDADE/08-CONSENTIMENTO-E-IMAGEM.md §2.
 *
 * POR QUE NÃO RE-CODIFICAR: `storageService` preserva a qualidade original de
 * propósito. Redesenhar num canvas resolveria o EXIF, mas recomprimiria a
 * imagem e mudaria a qualidade. Aqui os segmentos JPEG são percorridos e os
 * de metadado são REMOVIDOS byte a byte; os dados de imagem seguem idênticos.
 *
 * O QUE É REMOVIDO
 *  - APP1 com `Exif\0\0`            → EXIF (contém GPS, modelo, data)
 *  - APP1 com o namespace XMP       → XMP (pode conter geo e autoria)
 *  - APP13 (Photoshop IRB)          → IPTC (pode conter local)
 *
 * O QUE É PRESERVADO (removê-los mudaria a imagem)
 *  - APP0 (JFIF)     — densidade/aspecto
 *  - APP2 (ICC)      — perfil de cor; sem ele as cores mudam
 *  - Tabelas, quadros e TODO o dado codificado após o SOS
 *
 * SEGURANÇA DE FALHA: qualquer estrutura inesperada faz a função devolver o
 * arquivo ORIGINAL, intacto. Nunca corrompe e nunca bloqueia um upload.
 * Formatos que não sejam JPEG passam sem alteração.
 */

const SOI = 0xd8;
const EOI = 0xd9;
const SOS = 0xda;
const APP1 = 0xe1;
const APP13 = 0xed;

const EXIF_SIG = [0x45, 0x78, 0x69, 0x66, 0x00, 0x00]; // "Exif\0\0"
const XMP_SIG = 'http://ns.adobe.com/xap/1.0/';

function startsWithBytes(bytes, offset, signature) {
  if (offset + signature.length > bytes.length) return false;
  return signature.every((b, i) => bytes[offset + i] === b);
}

function isXmpSegment(bytes, payloadStart, payloadEnd) {
  const max = Math.min(payloadStart + XMP_SIG.length, payloadEnd);
  let text = '';
  for (let i = payloadStart; i < max; i += 1) text += String.fromCharCode(bytes[i]);
  return text === XMP_SIG;
}

function isJpeg(bytes) {
  return bytes.length > 3 && bytes[0] === 0xff && bytes[1] === SOI;
}

/**
 * Remove os segmentos de metadado de um JPEG.
 *
 * @param {Uint8Array} bytes
 * @returns {Uint8Array|null} novos bytes, ou `null` quando não há nada a
 *   remover ou a estrutura não é reconhecida (o chamador mantém o original).
 */
export function stripJpegMetadataBytes(bytes) {
  if (!isJpeg(bytes)) return null;

  const keep = [[0, 2]]; // SOI
  let i = 2;
  let removed = false;

  while (i < bytes.length) {
    if (bytes[i] !== 0xff) return null;            // estrutura inesperada
    // Alguns codificadores enchem com 0xFF entre segmentos.
    if (bytes[i + 1] === 0xff) { keep.push([i, i + 1]); i += 1; continue; }

    const marker = bytes[i + 1];
    if (marker === undefined) return null;

    // Marcadores sem payload.
    if (marker === SOI || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) {
      keep.push([i, i + 2]);
      i += 2;
      continue;
    }
    // Fim da imagem: copia o resto.
    if (marker === EOI) { keep.push([i, bytes.length]); i = bytes.length; break; }
    // Início do scan: o dado codificado vem depois e não deve ser percorrido.
    if (marker === SOS) { keep.push([i, bytes.length]); i = bytes.length; break; }

    if (i + 3 >= bytes.length) return null;         // truncado
    const length = (bytes[i + 2] << 8) | bytes[i + 3];
    if (length < 2) return null;                    // comprimento inválido
    const segEnd = i + 2 + length;
    if (segEnd > bytes.length) return null;         // segmento estoura o arquivo

    const payloadStart = i + 4;
    const isExif = marker === APP1 && startsWithBytes(bytes, payloadStart, EXIF_SIG);
    const isXmp = marker === APP1 && isXmpSegment(bytes, payloadStart, segEnd);
    const isIptc = marker === APP13;

    if (isExif || isXmp || isIptc) {
      removed = true;                                // descarta o segmento
    } else {
      keep.push([i, segEnd]);
    }
    i = segEnd;
  }

  if (!removed) return null;                         // nada a fazer

  const total = keep.reduce((acc, [a, b]) => acc + (b - a), 0);
  const out = new Uint8Array(total);
  let off = 0;
  for (const [a, b] of keep) { out.set(bytes.subarray(a, b), off); off += b - a; }

  // Conferência final: continua um JPEG válido nas pontas.
  if (!isJpeg(out)) return null;
  return out;
}

/**
 * Devolve um Blob sem metadados sensíveis. Em qualquer imprevisto — formato
 * diferente, estrutura inesperada, ambiente sem as APIs — devolve o arquivo
 * ORIGINAL, sem alteração.
 *
 * @param {File|Blob} file
 * @returns {Promise<File|Blob>}
 */
export async function stripImageMetadata(file) {
  try {
    if (!file || typeof file.arrayBuffer !== 'function') return file;
    const type = String(file.type || '').toLowerCase();
    if (type !== 'image/jpeg' && type !== 'image/jpg') return file;

    const bytes = new Uint8Array(await file.arrayBuffer());
    const cleaned = stripJpegMetadataBytes(bytes);
    if (!cleaned) return file;

    const blob = new Blob([cleaned], { type: file.type });
    // Preserva o nome quando a origem é um File (o caminho no Storage o usa).
    if (typeof File === 'function' && file instanceof File) {
      return new File([blob], file.name, {
        type: file.type,
        lastModified: file.lastModified,
      });
    }
    return blob;
  } catch {
    return file; // nunca bloqueia o upload
  }
}
