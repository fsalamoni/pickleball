import { describe, it, expect } from 'vitest';
import { parseBridgeUrl, inboundVideoSettings, IP_BRIDGE_EXAMPLE, go2rtcConfig, streamName } from './ipCamera.js';

describe('parseBridgeUrl', () => {
  it('aceita a go2rtc no mesmo computador, sem pedir rede local', () => {
    expect(parseBridgeUrl(IP_BRIDGE_EXAMPLE)).toEqual({ ok: true, url: IP_BRIDGE_EXAMPLE, local: false });
  });
  it('aceita a MediaMTX (WHEP) na rede da arena, marcando rede local', () => {
    const r = parseBridgeUrl('  http://192.168.0.20:8889/quadra1/whep ');
    expect(r).toMatchObject({ ok: true, local: true, url: 'http://192.168.0.20:8889/quadra1/whep' });
  });
  it('recusa o endereço da câmera (rtsp), que não é o da ponte', () => {
    expect(parseBridgeUrl('rtsp://192.168.0.30:554/stream1')).toEqual({ ok: false, error: 'ip-rtsp' });
  });
  it('recusa usuário e senha no endereço', () => {
    expect(parseBridgeUrl('http://admin:123@192.168.0.20:1984/api/webrtc?src=q')).toEqual({ ok: false, error: 'ip-credentials' });
  });
  it('recusa texto que não é endereço e protocolo estranho', () => {
    expect(parseBridgeUrl('quadra1').ok).toBe(false);
    expect(parseBridgeUrl('').ok).toBe(false);
    expect(parseBridgeUrl('javascript:alert(1)')).toEqual({ ok: false, error: 'ip-url-invalid' });
  });
});

describe('inboundVideoSettings', () => {
  it('lê o que chegou de verdade', () => {
    const reports = [
      { type: 'transport' },
      { type: 'inbound-rtp', kind: 'video', frameWidth: 1920, frameHeight: 1080, framesPerSecond: 50 },
    ];
    expect(inboundVideoSettings(reports)).toEqual({ width: 1920, height: 1080, frameRate: 50 });
  });
  it('sem vídeo chegando, não inventa número', () => {
    expect(inboundVideoSettings([{ type: 'inbound-rtp', kind: 'audio' }])).toEqual({});
  });
});

describe('go2rtcConfig (assistente da câmera IP)', () => {
  const cam = { name: 'Quadra 1 · Fundo A', brand: 'intelbras', host: '192.168.0.30', user: 'admin', pass: 'p@ss:w/rd' };

  it('gera o arquivo com CORS liberado, a senha escapada e o endereço da ponte', () => {
    const r = go2rtcConfig({ cameras: [cam] });
    expect(r.ok).toBe(true);
    expect(r.yaml).toContain("origin: '*'");
    expect(r.yaml).toContain("listen: '127.0.0.1:1984'");
    expect(r.yaml).toContain("quadra_1_fundo_a: 'rtsp://admin:p%40ss%3Aw%2Frd@192.168.0.30:554/cam/realmonitor?channel=1&subtype=0'");
    expect(r.bridges).toEqual([{ name: 'quadra_1_fundo_a', url: 'http://localhost:1984/api/webrtc?src=quadra_1_fundo_a' }]);
    // o endereço da ponte passa na mesma conferência da tela
    expect(parseBridgeUrl(r.bridges[0].url)).toMatchObject({ ok: true, local: false });
  });

  it('ponte em outro computador escuta na rede e usa o IP dele', () => {
    const r = go2rtcConfig({ cameras: [{ ...cam, brand: 'hikvision', port: '8554' }], sameComputer: false, bridgeHost: '192.168.0.10' });
    expect(r.yaml).toContain("listen: ':1984'");
    expect(r.yaml).toContain('@192.168.0.30:8554/Streaming/Channels/101');
    expect(parseBridgeUrl(r.bridges[0].url)).toMatchObject({ ok: true, local: true });
  });

  it('aspas simples na senha não quebram o YAML', () => {
    const r = go2rtcConfig({ cameras: [{ ...cam, pass: "it's" }] });
    expect(r.yaml).toContain("admin:it''s@"); // o YAML devolve uma aspa só
  });

  it('acusa campo errado sem gerar nada', () => {
    const r = go2rtcConfig({
      cameras: [{ name: 'a', host: '300.1.1.1', brand: 'outra' }, { name: 'A', host: 'cam.local', port: 0, brand: 'tapo' }],
      sameComputer: false,
    });
    expect(r.ok).toBe(false);
    expect(r.errors).toEqual(expect.arrayContaining([
      { index: 0, field: 'host', code: 'invalid' },
      { index: 0, field: 'path', code: 'required' },
      { index: 1, field: 'name', code: 'duplicate' },
      { index: 1, field: 'port', code: 'invalid' },
      { index: -1, field: 'bridgeHost', code: 'invalid' },
    ]));
    expect(go2rtcConfig({ cameras: [] }).ok).toBe(false);
  });

  it('o nome vira identificador simples', () => {
    expect(streamName('  Quadra Ção #2 ')).toBe('quadra_cao_2');
  });
});
