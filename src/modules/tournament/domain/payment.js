/**
 * Pagamento de inscrições (flag payment_instructions).
 *
 * Gera o payload PIX "copia e cola" (BR Code estático, padrão EMV/BCB) a
 * partir da chave configurada pelo organizador do torneio, além de
 * utilitários de formatação. Puro — sem Firebase, totalmente testável.
 *
 * Referência do formato: Manual de Padrões para Iniciação do PIX (BCB),
 * payload estático: campos EMV `id + len(2) + valor`, CRC16-CCITT no campo 63.
 */

const PIX_GUI = 'br.gov.bcb.pix';

/** Monta um campo EMV: id (2 dígitos) + tamanho (2 dígitos) + valor. */
function emv(id, value) {
  const text = String(value ?? '');
  return `${id}${String(text.length).padStart(2, '0')}${text}`;
}

/**
 * CRC16-CCITT (FALSE): polinômio 0x1021, valor inicial 0xFFFF — algoritmo
 * exigido pelo BR Code. Retorna 4 dígitos hexadecimais maiúsculos.
 * @param {string} payload
 * @returns {string}
 */
export function crc16(payload) {
  let crc = 0xffff;
  for (let i = 0; i < payload.length; i += 1) {
    crc ^= payload.charCodeAt(i) << 8;
    for (let bit = 0; bit < 8; bit += 1) {
      crc = crc & 0x8000 ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff;
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, '0');
}

/**
 * Nome/cidade do recebedor aceitam um subconjunto restrito de caracteres no
 * BR Code: remove acentos e símbolos fora do conjunto seguro e limita o
 * tamanho máximo do campo.
 */
function sanitizeEmvText(value, max) {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^A-Za-z0-9 .,-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max);
}

/**
 * Gera o payload PIX estático ("copia e cola"). Retorna `null` sem chave.
 *
 * @param {{
 *   key: string,
 *   merchantName?: string,
 *   merchantCity?: string,
 *   amountCents?: number|null,
 *   txid?: string,
 * }} input
 * @returns {string|null}
 */
export function buildPixPayload({ key, merchantName, merchantCity, amountCents = null, txid = '***' } = {}) {
  const pixKey = String(key || '').trim();
  if (!pixKey) return null;
  const name = sanitizeEmvText(merchantName, 25) || 'RECEBEDOR';
  const city = sanitizeEmvText(merchantCity, 15) || 'BRASIL';
  const tx = sanitizeEmvText(txid, 25).replace(/ /g, '') || '***';

  let payload = emv('00', '01');
  payload += emv('26', emv('00', PIX_GUI) + emv('01', pixKey));
  payload += emv('52', '0000');
  payload += emv('53', '986');
  const cents = Number(amountCents);
  if (Number.isFinite(cents) && cents > 0) {
    payload += emv('54', (cents / 100).toFixed(2));
  }
  payload += emv('58', 'BR');
  payload += emv('59', name);
  payload += emv('60', city);
  payload += emv('62', emv('05', tx));
  payload += '6304';
  return payload + crc16(payload);
}

/** Formata centavos como moeda pt-BR (R$ 1.234,56). */
export function formatBrlCents(cents) {
  const value = (Number(cents) || 0) / 100;
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

/** O torneio tem PIX configurado para exibir instruções de pagamento? */
export function tournamentHasPixConfig(tournament) {
  return Boolean(String(tournament?.payment_pix_key || '').trim());
}
