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
    // `rtsp` leva a senha: serve só para mandar direto à ponte, nunca para guardar.
    bridges: rows.map((r) => ({ name: r.name, url: `http://${bHost}:1984/api/webrtc?src=${r.name}`, rtsp: r.rtsp })),
  };
}

/**
 * O arquivo MÍNIMO da ponte, sem câmera nenhuma: as câmeras entram depois
 * pela própria página (a go2rtc acha na rede e grava aqui). Só as duas linhas
 * que a montagem à mão esquece: `origin` (sem ela a página não fala com a
 * ponte) e `listen` (no mesmo computador, só ele alcança).
 */
export function go2rtcBaseConfig({ sameComputer = true } = {}) {
  return [
    '# go2rtc.yaml — gerado pelo PickleRush (controle de linhas).',
    '# As câmeras entram pela página do PickleRush e ficam gravadas aqui, com a senha delas.',
    '# Use este computador só para a quadra: o arquivo fica legível para quem usa o computador.',
    'api:',
    `  listen: ${yamlQuote(sameComputer ? '127.0.0.1:1984' : ':1984')}`,
    "  origin: '*'",
    '',
  ].join('\n');
}

/** Os sistemas em que a ponte roda e o arquivo da go2rtc de cada um (página de versões oficial). */
export const BRIDGE_DOWNLOADS = Object.freeze([
  { id: 'win', label: 'Windows 10 ou 11', file: 'go2rtc_win64.zip' },
  { id: 'mac_arm', label: 'Mac com chip Apple (M1 em diante)', file: 'go2rtc_mac_arm64.zip' },
  { id: 'mac_intel', label: 'Mac com Intel', file: 'go2rtc_mac_amd64.zip' },
  { id: 'linux', label: 'Linux (PC)', file: 'go2rtc_linux_amd64' },
  { id: 'pi', label: 'Raspberry Pi (64 bits)', file: 'go2rtc_linux_arm64' },
]);
export const bridgeDownloadUrl = (file) => `https://github.com/AlexxIT/go2rtc/releases/latest/download/${file}`;

/** O sistema deste aparelho, pelo que o navegador conta (para sugerir o download). */
export function guessBridgeOs(ua = '', platform = '') {
  const s = `${ua} ${platform}`;
  if (/Windows/i.test(s)) return 'win';
  if (/Mac/i.test(s)) return 'mac_arm'; // o navegador não diz o chip; a maioria dos Macs de hoje é Apple
  if (/aarch64|arm64/i.test(s) && /Linux/i.test(s)) return 'pi';
  if (/Linux/i.test(s)) return 'linux';
  return 'win';
}

/**
 * O "liga sozinha": um script que faz a ponte abrir sempre que o computador
 * liga, para ninguém precisar lembrar. Vai na MESMA pasta da go2rtc e do
 * `go2rtc.yaml`.
 * @param {'win'|'unix'} kind
 * @returns {{ file: string, text: string, mime: string }}
 */
export function bridgeAutostart(kind) {
  if (kind === 'win') {
    return {
      file: 'ligar-ponte-picklerush.cmd',
      mime: 'application/octet-stream',
      text: [
        '@echo off',
        'rem PickleRush: liga a ponte (go2rtc) agora e sempre que voce entrar no Windows.',
        'rem Deixe este arquivo na mesma pasta do go2rtc.exe e do go2rtc.yaml e de dois cliques.',
        'cd /d "%~dp0"',
        'if not exist "%~dp0go2rtc.exe" (echo Nao achei o go2rtc.exe nesta pasta. & pause & exit /b 1)',
        'schtasks /Create /F /SC ONLOGON /RL LIMITED /TN "PickleRush ponte" /TR "\\"%~dp0go2rtc.exe\\" -config \\"%~dp0go2rtc.yaml\\""',
        'start "PickleRush ponte" /min "%~dp0go2rtc.exe" -config "%~dp0go2rtc.yaml"',
        'echo Pronto: a ponte esta ligada e vai ligar sozinha quando o computador iniciar.',
        'timeout /t 5',
        '',
      ].join('\r\n'),
    };
  }
  return {
    file: 'ligar-ponte-picklerush.sh',
    mime: 'text/x-shellscript',
    text: [
      '#!/bin/sh',
      '# PickleRush: liga a ponte (go2rtc) agora e sempre que o computador iniciar.',
      '# No Terminal, na pasta da go2rtc e do go2rtc.yaml: sh ligar-ponte-picklerush.sh',
      'set -e',
      'DIR="$(cd "$(dirname "$0")" && pwd)"',
      'BIN="$DIR/go2rtc"',
      'if [ ! -f "$BIN" ]; then BIN="$(ls "$DIR"/go2rtc_* 2>/dev/null | head -n 1)"; fi',
      'if [ -z "$BIN" ] || [ ! -f "$BIN" ]; then echo "Nao achei a go2rtc nesta pasta."; exit 1; fi',
      'chmod +x "$BIN"',
      'if [ "$(uname)" = "Darwin" ]; then',
      '  xattr -d com.apple.quarantine "$BIN" 2>/dev/null || true',
      '  PLIST="$HOME/Library/LaunchAgents/app.picklerush.ponte.plist"',
      '  mkdir -p "$HOME/Library/LaunchAgents"',
      '  cat > "$PLIST" <<EOF',
      '<?xml version="1.0" encoding="UTF-8"?>',
      '<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">',
      '<plist version="1.0"><dict>',
      '<key>Label</key><string>app.picklerush.ponte</string>',
      '<key>ProgramArguments</key><array><string>$BIN</string><string>-config</string><string>$DIR/go2rtc.yaml</string></array>',
      '<key>WorkingDirectory</key><string>$DIR</string>',
      '<key>RunAtLoad</key><true/><key>KeepAlive</key><true/>',
      '</dict></plist>',
      'EOF',
      '  launchctl unload "$PLIST" 2>/dev/null || true',
      '  launchctl load "$PLIST"',
      'else',
      '  UNIT="$HOME/.config/systemd/user/picklerush-ponte.service"',
      '  mkdir -p "$(dirname "$UNIT")"',
      '  printf "[Unit]\\nDescription=PickleRush ponte (go2rtc)\\n\\n[Service]\\nWorkingDirectory=%s\\nExecStart=%s -config %s/go2rtc.yaml\\nRestart=always\\n\\n[Install]\\nWantedBy=default.target\\n" "$DIR" "$BIN" "$DIR" > "$UNIT"',
      '  systemctl --user daemon-reload',
      '  systemctl --user enable --now picklerush-ponte.service',
      'fi',
      'echo "Pronto: a ponte esta ligada e vai ligar sozinha quando o computador iniciar."',
      '',
    ].join('\n'),
  };
}
