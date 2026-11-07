import { describe, it, expect } from 'vitest';
import {
  bridgeBase, addressSpace, webrtcUrl, streamNames, onvifDevices, withOnvifCredentials,
  onvifProfiles, freeStreamName, streamVideoCodec, codecPlaysInBrowser, BRIDGE_DEFAULT_BASE,
} from './bridgeDiscovery.js';

describe('bridgeBase', () => {
  it('tira a raiz de um endereço salvo e diz se é a rede da arena', () => {
    expect(bridgeBase('http://localhost:1984/api/webrtc?src=quadra1')).toEqual({ base: 'http://localhost:1984', local: false });
    expect(bridgeBase('http://192.168.0.10:1984')).toEqual({ base: 'http://192.168.0.10:1984', local: true });
    expect(addressSpace(bridgeBase('http://127.0.0.1:1984'))).toBe('loopback');
    expect(addressSpace(bridgeBase('http://192.168.0.10:1984'))).toBe('local');
  });
  it('em branco é a go2rtc no próprio computador', () => {
    expect(bridgeBase('').base).toBe(BRIDGE_DEFAULT_BASE);
  });
  it('recusa o que não é da ponte', () => {
    expect(bridgeBase('rtsp://192.168.0.30/stream1')).toBeNull();
    expect(bridgeBase('http://admin:x@localhost:1984')).toBeNull();
    expect(bridgeBase('não é endereço')).toBeNull();
  });
});

describe('respostas da go2rtc', () => {
  it('nomes das câmeras já na ponte, em ordem', () => {
    expect(streamNames({ quadra2: {}, quadra1: { producers: [] } })).toEqual(['quadra1', 'quadra2']);
    expect(streamNames(null)).toEqual([]);
    expect(streamNames([])).toEqual([]);
  });

  it('câmeras achadas na rede, sem repetir', () => {
    const json = { sources: [
      { name: '192.168.0.30', info: 'Intelbras VIP 3230', url: 'onvif://user:pass@192.168.0.30:80/onvif/device_service' },
      { name: '192.168.0.30', info: 'repetida', url: 'onvif://user:pass@192.168.0.30:80/onvif/device_service' },
      { name: 'lixo', url: 'http://x' },
      { name: 'quebrado', url: '::' },
    ] };
    expect(onvifDevices(json)).toEqual([
      { host: '192.168.0.30', info: 'Intelbras VIP 3230', url: 'onvif://user:pass@192.168.0.30:80/onvif/device_service' },
    ]);
    expect(onvifDevices(undefined)).toEqual([]);
  });

  it('troca o usuário e a senha de enfeite pelos da câmera, escapados', () => {
    const url = withOnvifCredentials('onvif://user:pass@192.168.0.30:80/onvif/device_service', 'admin', 'a@b:c/d');
    const u = new URL(url);
    expect(u.hostname).toBe('192.168.0.30');
    expect(decodeURIComponent(u.username)).toBe('admin');
    expect(decodeURIComponent(u.password)).toBe('a@b:c/d');
    expect(url).not.toContain('user:pass');
    expect(withOnvifCredentials('onvif://user:pass@h/x', '', '')).toBe('onvif://h/x');
    expect(withOnvifCredentials('rtsp://h/x', 'a', 'b')).toBeNull();
  });

  it('perfis de vídeo, sem a foto, com o principal primeiro', () => {
    const json = { sources: [
      { name: 'cam stream0', url: 'onvif://a:b@h?subtype=MainStream' },
      { name: 'cam stream1', url: 'onvif://a:b@h?subtype=SubStream' },
      { name: 'cam snapshot', url: 'onvif://a:b@h?subtype=MainStream&snapshot' },
    ] };
    const p = onvifProfiles(json);
    expect(p.map((x) => x.label)).toEqual(['cam stream0', 'cam stream1']);
    expect(p[0].main).toBe(true);
    expect(p[1].main).toBe(false);
  });

  it('nome livre para a câmera nova', () => {
    expect(freeStreamName('Fundo A', [])).toBe('fundo_a');
    expect(freeStreamName('Fundo A', ['fundo_a', 'fundo_a_2'])).toBe('fundo_a_3');
    expect(freeStreamName('', [])).toBe('camera');
  });

  it('formato do vídeo pela resposta da ponte', () => {
    expect(streamVideoCodec({ producers: [{ medias: ['audio, recvonly, PCMA', 'video, recvonly, H264'] }] })).toBe('H264');
    expect(streamVideoCodec({ producers: [{ medias: ['video, recvonly, H265'] }] })).toBe('H265');
    expect(streamVideoCodec({ producers: [{ url: 'rtsp://…' }] })).toBeNull();
    expect(codecPlaysInBrowser('H265')).toBe(false);
    expect(codecPlaysInBrowser('HEVC')).toBe(false);
    expect(codecPlaysInBrowser('H264')).toBe(true);
    expect(codecPlaysInBrowser(null)).toBe(true);
  });

  it('endereço do vídeo de uma câmera da ponte', () => {
    expect(webrtcUrl('http://localhost:1984', 'fundo a')).toBe('http://localhost:1984/api/webrtc?src=fundo%20a');
  });
});
