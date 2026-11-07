/**
 * Câmera IP pela PONTE local (go2rtc ou MediaMTX). O navegador não fala RTSP:
 * a ponte, num computador da arena, converte o vídeo da câmera para WebRTC,
 * e o PickleRush o recebe como se fosse uma câmera comum. Ver
 * docs/53-CONTROLE-DE-LINHAS.md §3.1.
 *
 * Aqui só a regra do ENDEREÇO da ponte, que a pessoa digita. Duas portas
 * fechadas de propósito: endereço de câmera (rtsp://) não é o da ponte, e
 * usuário/senha nunca entram no PickleRush — a credencial da câmera fica no
 * arquivo da ponte, no computador da arena.
 */

/** O endereço de exemplo da go2rtc no mesmo computador. */
export const IP_BRIDGE_EXAMPLE = 'http://localhost:1984/api/webrtc?src=quadra1';

const LOOPBACK = new Set(['localhost', '127.0.0.1', '[::1]']);

/**
 * Confere o endereço da ponte.
 * @param {string} text o que a pessoa digitou
 * @returns {{ ok: true, url: string, local: boolean } | { ok: false, error: 'ip-url-invalid'|'ip-rtsp'|'ip-credentials' }}
 *   `local` = rede da arena (não é o próprio computador): o Chrome pede a
 *   permissão de "rede local" para esse caso.
 */
export function parseBridgeUrl(text) {
  const raw = String(text || '').trim();
  if (/^rtsps?:\/\//i.test(raw)) return { ok: false, error: 'ip-rtsp' };
  let u;
  try { u = new URL(raw); } catch { return { ok: false, error: 'ip-url-invalid' }; }
  if (u.protocol !== 'http:' && u.protocol !== 'https:') return { ok: false, error: 'ip-url-invalid' };
  if (u.username || u.password) return { ok: false, error: 'ip-credentials' };
  return { ok: true, url: u.href, local: !LOOPBACK.has(u.hostname) };
}

/**
 * O que a câmera ENTREGA, lido das estatísticas da conexão (quadros e
 * tamanho que de fato chegaram) — o anúncio da câmera não conta.
 * @param {Iterable<object>} reports os relatórios de `pc.getStats()`
 * @returns {{ width?: number, height?: number, frameRate?: number }}
 */
export function inboundVideoSettings(reports) {
  for (const r of reports) {
    if (r?.type === 'inbound-rtp' && (r.kind === 'video' || r.mediaType === 'video')) {
      return { width: r.frameWidth, height: r.frameHeight, frameRate: r.framesPerSecond };
    }
  }
  return {};
}

/**
 * As marcas mais comuns e o caminho RTSP do fluxo PRINCIPAL de cada uma. Os
 * ids ficam no aparelho (preferência), nunca no banco. Intelbras e Amcrest
 * usam o caminho da Dahua.
 */
export const IP_CAMERA_BRANDS = Object.freeze({
  intelbras: { label: 'Intelbras', path: '/cam/realmonitor?channel=1&subtype=0' },
  hikvision: { label: 'Hikvision', path: '/Streaming/Channels/101' },
  dahua: { label: 'Dahua / Amcrest', path: '/cam/realmonitor?channel=1&subtype=0' },
  reolink: { label: 'Reolink', path: '/h264Preview_01_main' },
  tapo: { label: 'TP-Link Tapo', path: '/stream1' },
  outra: { label: 'Outra marca (caminho do manual)', path: '' },
});

const IPV4_RE = /^\d{1,3}(?:\.\d{1,3}){3}$/;
const NAME_RE = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)*$/i;
const validHost = (h) => (IPV4_RE.test(h) ? h.split('.').every((n) => Number(n) <= 255) : NAME_RE.test(h) && !/^[\d.]+$/.test(h));

/** Nome de câmera que a go2rtc aceita e que vai no `src=` sem escapar. */
export function streamName(text) {
  return String(text || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 40);
}

const yamlQuote = (s) => `'${String(s).replace(/'/g, "''")}'`;

/**
 * O ASSISTENTE da câmera IP: monta o `go2rtc.yaml` e os endereços da ponte a
 * partir do que a pessoa digita. Roda só no navegador — a senha vai para o
 * ARQUIVO baixado, nunca para o banco nem para a preferência guardada.
 *
 * Dois detalhes que a montagem à mão costuma errar: `api.origin: '*'` (sem
 * ele a go2rtc recusa o pedido que vem da página do PickleRush, e a tela diz
 * "a ponte não respondeu") e usuário/senha com `@`, `:` ou `/` precisam ir
 * escapados dentro do endereço RTSP.
 *
 * @param {{ cameras: Array<{ name: string, brand?: string, host: string, port?: number|string,
 *   user?: string, pass?: string, path?: string }>, sameComputer?: boolean, bridgeHost?: string }} input
 *   `sameComputer`: a ponte roda no computador que abre o PickleRush (escuta
 *   só nele, `127.0.0.1`); senão escuta na rede e o endereço usa `bridgeHost`.
 * @returns {{ ok: true, yaml: string, bridges: Array<{ name: string, url: string }> }
 *   | { ok: false, errors: Array<{ index: number, field: string, code: string }> }}
 */
export function go2rtcConfig({ cameras = [], sameComputer = true, bridgeHost = '' } = {}) {
  const errors = [];
  const names = new Set();
  const rows = cameras.map((c, index) => {
    const name = streamName(c.name);
    const host = String(c.host || '').trim();
    const port = c.port === '' || c.port == null ? 554 : Number(c.port);
    const brand = IP_CAMERA_BRANDS[c.brand] || IP_CAMERA_BRANDS.outra;
    let path = String(c.path || brand.path).trim();
    if (!name) errors.push({ index, field: 'name', code: 'required' });
    else if (names.has(name)) errors.push({ index, field: 'name', code: 'duplicate' });
    names.add(name);
    if (!validHost(host)) errors.push({ index, field: 'host', code: 'invalid' });
    if (!Number.isInteger(port) || port < 1 || port > 65535) errors.push({ index, field: 'port', code: 'invalid' });
    if (!path) errors.push({ index, field: 'path', code: 'required' });
    if (path && !path.startsWith('/')) path = `/${path}`;
    const cred = c.user ? `${encodeURIComponent(c.user)}${c.pass ? `:${encodeURIComponent(c.pass)}` : ''}@` : '';
    return { name, rtsp: `rtsp://${cred}${host}:${port}${path}` };
  });
  const bHost = sameComputer ? 'localhost' : String(bridgeHost || '').trim();
  if (!cameras.length) errors.push({ index: -1, field: 'cameras', code: 'required' });
  if (!sameComputer && !validHost(bHost)) errors.push({ index: -1, field: 'bridgeHost', code: 'invalid' });
  if (errors.length) return { ok: false, errors };
  const yaml = [
    '# go2rtc.yaml — gerado pelo PickleRush (controle de linhas).',
    '# Guarde ao lado do programa go2rtc. A senha das câmeras fica só neste arquivo.',
    'api:',
    `  listen: ${yamlQuote(sameComputer ? '127.0.0.1:1984' : ':1984')}`,
    "  origin: '*'",
    'streams:',
    ...rows.map((r) => `  ${r.name}: ${yamlQuote(r.rtsp)}`),
    '',
  ].join('\n');
  return {
    ok: true,
    yaml,
    bridges: rows.map((r) => ({ name: r.name, url: `http://${bHost}:1984/api/webrtc?src=${r.name}` })),
  };
}
