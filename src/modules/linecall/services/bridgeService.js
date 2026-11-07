/**
 * Os pedidos à PONTE (go2rtc) que a página faz para achar e cadastrar
 * câmeras sem a pessoa editar arquivo (docs/53 §5b). As respostas são lidas
 * em `domain/bridgeDiscovery.js`.
 *
 * Nada daqui vai para o banco: a senha da câmera passa só deste navegador para
 * a ponte, no computador da arena, e é ela quem a grava no `go2rtc.yaml`. A
 * página nunca lê o arquivo de volta (`/api/config`), porque ele guarda as
 * senhas.
 *
 * Erros: `bridge-offline` (não respondeu: desligada, sem a linha `origin` no
 * arquivo, ou a permissão de rede local negada), `bridge-error` (respondeu
 * com erro; a mensagem da ponte vai junto).
 */

import { addressSpace, onvifDevices, onvifProfiles, streamNames, streamVideoCodec } from '../domain/bridgeDiscovery.js';

async function ask(bridge, path, { method = 'GET', fetchImpl = globalThis.fetch, allow404 = false } = {}) {
  let resp;
  try {
    // Chrome: página segura falando com o próprio computador ou com a rede da
    // arena precisa declarar para onde vai (Local Network Access).
    resp = await fetchImpl(`${bridge.base}${path}`, { method, targetAddressSpace: addressSpace(bridge) });
  } catch {
    throw new Error('bridge-offline');
  }
  if (allow404 && resp.status === 404) return null;
  if (!resp.ok) {
    const e = new Error('bridge-error');
    try { e.detail = (await resp.text()).slice(0, 200); } catch { /* sem texto */ }
    throw e;
  }
  const text = await resp.text();
  if (!text) return {};
  try { return JSON.parse(text); } catch { return {}; }
}

/** A ponte está no ar? Devolve as câmeras que ela já tem. */
export async function bridgeStreams(bridge, opts) {
  return streamNames(await ask(bridge, '/api/streams', opts));
}

/** As câmeras ONVIF que a ponte acha na rede dela (pode levar alguns segundos). */
export async function discoverOnvif(bridge, opts) {
  return onvifDevices(await ask(bridge, '/api/onvif', { ...opts, allow404: true }));
}

/** Os perfis de vídeo de uma câmera ONVIF, já com usuário e senha. */
export async function cameraProfiles(bridge, onvifUrl, opts) {
  return onvifProfiles(await ask(bridge, `/api/onvif?src=${encodeURIComponent(onvifUrl)}`, { ...opts, allow404: true }));
}

/** Cria a câmera na ponte (e a go2rtc a grava no arquivo dela). */
export async function addBridgeStream(bridge, name, src, opts) {
  await ask(bridge, `/api/streams?name=${encodeURIComponent(name)}&src=${encodeURIComponent(src)}`, { ...opts, method: 'PUT' });
}

/** Liga na câmera e diz o formato do vídeo (`H264`, `H265`…); null se não deu para saber. */
export async function probeStreamCodec(bridge, name, opts) {
  return streamVideoCodec(await ask(bridge, `/api/streams?src=${encodeURIComponent(name)}`, { ...opts, allow404: true }));
}
