/* eslint-disable */
/*
 * Service worker do push (Firebase Cloud Messaging).
 *
 * Só é registrado quando a pessoa ativa o push (`enablePush` em
 * src/core/services/pushService.js), com escopo próprio — não colide com o
 * service worker do PWA (`sw.js`), que controla a raiz.
 *
 * NÃO usa o SDK do Firebase. O SDK exige a configuração completa do app
 * (inclusive o appId) e a URL reservada `/__/firebase/init.js` desta
 * hospedagem não traz appId: o SDK falhava ao iniciar e nenhum push aparecia
 * (o navegador mostrava só "o site foi atualizado em segundo plano"). O aviso
 * do FCM chega como Web Push comum, com o corpo em JSON:
 *   { notification: { title, body, icon }, data: { link, … }, fcmOptions: { link } }
 * Testado em src/core/services/pushWorker.test.js.
 */

const ICONE = '/pwa-192.png';

function lerCorpo(event) {
  try {
    return event.data ? event.data.json() : {};
  } catch (e) {
    return {};
  }
}

// A versão nova entra na hora (a antiga, com o SDK, não mostrava nada).
self.addEventListener('install', () => self.skipWaiting());

self.addEventListener('push', (event) => {
  const p = lerCorpo(event);
  const n = p.notification || {};
  const d = p.data || {};
  const link = (p.fcmOptions && p.fcmOptions.link) || d.link || '/';
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((janelas) => {
      // App aberto e à vista: o sino já mostra o aviso na hora. O teste do
      // painel (data.teste) aparece sempre.
      const aVista = janelas.some((w) => w.visibilityState === 'visible' && !String(w.url).startsWith('chrome-extension://'));
      if (aVista && d.teste !== '1') return undefined;
      return self.registration.showNotification(n.title || d.title || 'PickleRush', {
        body: n.body || d.message || '',
        icon: n.icon || ICONE,
        badge: n.badge || ICONE,
        tag: p.fcmMessageId || undefined,
        data: { link },
      });
    }),
  );
});

// Toque na notificação: abre a página do aviso, sempre dentro do site.
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  let destino;
  try {
    destino = new URL((event.notification.data && event.notification.data.link) || '/', self.location.origin);
  } catch (e) {
    destino = new URL('/', self.location.origin);
  }
  if (destino.origin !== self.location.origin) destino = new URL('/', self.location.origin);
  const caminho = destino.pathname + destino.search + destino.hash;
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((janelas) => {
      const janela = janelas.find((w) => 'focus' in w);
      if (!janela) return self.clients.openWindow ? self.clients.openWindow(destino.href) : undefined;
      // Este service worker não controla as páginas do app (quem controla é o
      // sw.js) e por isso não pode navegar por elas: pede ao app aberto, que
      // confere o caminho e navega (`usePushNoAparelho`).
      janela.postMessage({ tipo: 'picklerush:abrir-aviso', link: caminho });
      return janela.focus();
    }),
  );
});
