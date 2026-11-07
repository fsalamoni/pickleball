import { describe, it, expect, vi } from 'vitest';
import { openIpCamera, closeCamera } from './cameraService.js';

/** Uma conexão WebRTC de mentira: o vídeo "chega" quando a resposta da ponte é aplicada. */
function fakePc({ comVideo = true } = {}) {
  const track = { stop: vi.fn(), getSettings: () => ({}) };
  const stream = { getTracks: () => [track], getVideoTracks: () => [track] };
  const pc = {
    iceGatheringState: 'complete',
    localDescription: { sdp: 'oferta' },
    addTransceiver: vi.fn(),
    createOffer: async () => ({ type: 'offer', sdp: 'oferta' }),
    setLocalDescription: async () => {},
    setRemoteDescription: vi.fn(async () => { if (comVideo) pc.ontrack({ streams: [stream], track }); }),
    getStats: async () => new Map([['v', { type: 'inbound-rtp', kind: 'video', frameWidth: 1920, frameHeight: 1080, framesPerSecond: 60 }]]),
    close: vi.fn(),
  };
  return { pc, Pc: function Pc() { return pc; } };
}
const bridge = { url: 'http://192.168.0.20:1984/api/webrtc?src=quadra1', local: true };
const opts = { timeoutMs: 5, statsDelayMs: 0 };

describe('openIpCamera', () => {
  it('troca a oferta com a ponte e devolve o vídeo com o que de fato chega', async () => {
    const { pc, Pc } = fakePc();
    const fetchImpl = vi.fn(async () => ({ ok: true, text: async () => 'resposta' }));
    const { stream, settings } = await openIpCamera(bridge, { ...opts, Pc, fetchImpl });
    expect(pc.addTransceiver).toHaveBeenCalledWith('video', { direction: 'recvonly' });
    const [url, init] = fetchImpl.mock.calls[0];
    expect(url).toBe(bridge.url);
    expect(init).toMatchObject({ method: 'POST', body: 'oferta', targetAddressSpace: 'local' });
    expect(init.headers['Content-Type']).toBe('application/sdp');
    expect(pc.setRemoteDescription).toHaveBeenCalledWith({ type: 'answer', sdp: 'resposta' });
    expect(settings).toEqual({ width: 1920, height: 1080, frameRate: 60 });
    closeCamera(stream);
    expect(pc.close).toHaveBeenCalled();
  });

  it('ponte fora do ar vira ip-unreachable e fecha a conexão', async () => {
    const { pc, Pc } = fakePc();
    const fetchImpl = async () => { throw new TypeError('Failed to fetch'); };
    await expect(openIpCamera(bridge, { ...opts, Pc, fetchImpl })).rejects.toThrow('ip-unreachable');
    expect(pc.close).toHaveBeenCalled();
  });

  it('câmera que a ponte não conhece vira ip-refused', async () => {
    const { Pc } = fakePc();
    const fetchImpl = async () => ({ ok: false, status: 404, text: async () => '' });
    await expect(openIpCamera(bridge, { ...opts, Pc, fetchImpl })).rejects.toThrow('ip-refused');
  });

  it('conectou e o vídeo não veio: ip-no-video', async () => {
    const { pc, Pc } = fakePc({ comVideo: false });
    const fetchImpl = async () => ({ ok: true, text: async () => 'resposta' });
    await expect(openIpCamera(bridge, { ...opts, Pc, fetchImpl })).rejects.toThrow('ip-no-video');
    expect(pc.close).toHaveBeenCalled();
  });
});
