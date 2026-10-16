/**
 * O service worker do push (`public/firebase-messaging-sw.js`), rodado num
 * `self` falso. Ele não usa o SDK do Firebase (o `/__/firebase/init.js` desta
 * hospedagem não traz appId e o SDK quebrava ao iniciar): estes testes travam
 * que ele mostra o aviso do FCM sozinho e abre o link certo.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const CODIGO = readFileSync('public/firebase-messaging-sw.js', 'utf8');

function montar({ janelas = [] } = {}) {
  const ouvintes = {};
  const mostradas = [];
  const abertas = [];
  const self = {
    location: { origin: 'https://picklerush.web.app', href: 'https://picklerush.web.app/firebase-messaging-sw.js' },
    addEventListener: (tipo, fn) => { ouvintes[tipo] = fn; },
    skipWaiting: () => {},
    registration: { showNotification: async (titulo, opcoes) => { mostradas.push({ titulo, ...opcoes }); } },
    clients: {
      matchAll: async () => janelas,
      openWindow: async (url) => { abertas.push(url); },
    },
  };
  vm.runInNewContext(CODIGO, { self, URL, String, console });
  const disparar = async (tipo, evento) => {
    let espera;
    ouvintes[tipo]({ ...evento, waitUntil: (p) => { espera = p; } });
    await espera;
  };
  return { ouvintes, mostradas, abertas, disparar };
}

const pushDo = (corpo) => ({ data: { json: () => corpo } });
const AVISO = {
  notification: { title: 'Reserva confirmada', body: 'Sábado, 18h', icon: '/pwa-192.png' },
  data: { link: 'https://picklerush.web.app/minhas-reservas', type: 'generic' },
  fcmOptions: { link: 'https://picklerush.web.app/minhas-reservas' },
  fcmMessageId: 'm1',
};

describe('service worker do push', () => {
  it('⭐ não carrega o SDK do Firebase nem a configuração da hospedagem', () => {
    const semComentarios = CODIGO.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
    expect(semComentarios).not.toMatch(/importScripts|__\/firebase\/init\.js|firebase\.messaging\(/);
  });

  it('⭐ mostra o aviso do FCM com o app fechado', async () => {
    const sw = montar();
    await sw.disparar('push', pushDo(AVISO));
    expect(sw.mostradas).toEqual([{
      titulo: 'Reserva confirmada', body: 'Sábado, 18h', icon: '/pwa-192.png', badge: '/pwa-192.png', tag: 'm1',
      data: { link: 'https://picklerush.web.app/minhas-reservas' },
    }]);
  });

  it('com o app à vista, o aviso fica no sino; o teste do painel aparece sempre', async () => {
    const sw = montar({ janelas: [{ visibilityState: 'visible', url: 'https://picklerush.web.app/' }] });
    await sw.disparar('push', pushDo(AVISO));
    expect(sw.mostradas).toHaveLength(0);
    await sw.disparar('push', pushDo({ ...AVISO, data: { ...AVISO.data, teste: '1' } }));
    expect(sw.mostradas).toHaveLength(1);
  });

  it('corpo que não é JSON não derruba: mostra o padrão', async () => {
    const sw = montar();
    await sw.disparar('push', { data: { json: () => { throw new Error('x'); } } });
    expect(sw.mostradas[0]).toMatchObject({ titulo: 'PickleRush', body: '', data: { link: '/' } });
  });

  it('⭐ tocar com o app aberto pede ao app para navegar (o SW do push não controla a página)', async () => {
    const recebidas = [];
    let focou = false;
    const janela = { url: 'https://picklerush.web.app/', focus: async () => { focou = true; }, postMessage: (m) => recebidas.push(m) };
    const sw = montar({ janelas: [janela] });
    await sw.disparar('notificationclick', {
      notification: { close: () => {}, data: { link: 'https://picklerush.web.app/minhas-reservas?x=1#topo' } },
    });
    expect(recebidas).toEqual([{ tipo: 'picklerush:abrir-aviso', link: '/minhas-reservas?x=1#topo' }]);
    expect(focou).toBe(true);
  });

  it('tocar com o app fechado abre a página; link de fora vira o início', async () => {
    const sw = montar();
    await sw.disparar('notificationclick', { notification: { close: () => {}, data: { link: '/torneios' } } });
    await sw.disparar('notificationclick', { notification: { close: () => {}, data: { link: 'https://golpe.example/x' } } });
    expect(sw.abertas).toEqual(['https://picklerush.web.app/torneios', 'https://picklerush.web.app/']);
  });
});
