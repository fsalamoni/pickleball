import { describe, it, expect } from 'vitest';
import { parseBridgeUrl, inboundVideoSettings, IP_BRIDGE_EXAMPLE } from './ipCamera.js';

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
