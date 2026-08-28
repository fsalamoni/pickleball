/* eslint-disable */
/*
 * Service worker dedicado ao Firebase Cloud Messaging (notificações push).
 *
 * ADITIVO E ISOLADO: é um SW separado do PWA (`sw.js`) e só é registrado
 * quando o atleta opta por receber push (getToken em pushService.js). Se o
 * push não estiver configurado/ativo, este arquivo nunca é registrado e não
 * tem efeito algum.
 *
 * A configuração do Firebase vem da URL reservada do Firebase Hosting
 * (`/__/firebase/init.js`), então nada precisa ser embutido aqui.
 */
importScripts('https://www.gstatic.com/firebasejs/10.14.1/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.14.1/firebase-messaging-compat.js');

try {
  // Config automática do projeto (servida pelo Firebase Hosting).
  importScripts('/__/firebase/init.js');
  const messaging = firebase.messaging();

  // Mensagens data-only em segundo plano: exibe uma notificação amigável.
  messaging.onBackgroundMessage((payload) => {
    const n = payload.notification || {};
    const d = payload.data || {};
    const title = n.title || d.title || 'PickleRush';
    const options = {
      body: n.body || d.message || '',
      icon: '/pwa-192.png',
      badge: '/pwa-192.png',
      data: { link: (payload.fcmOptions && payload.fcmOptions.link) || d.link || '/' },
    };
    self.registration.showNotification(title, options);
  });
} catch (err) {
  // Sem config/hosting (ex.: dev local): push simplesmente não funciona aqui.
}

// Clique na notificação: foca uma aba aberta (navegando para o link) ou abre uma nova.
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const link = (event.notification.data && event.notification.data.link) || '/';
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((wins) => {
      for (const w of wins) {
        if ('focus' in w) {
          if ('navigate' in w) { try { w.navigate(link); } catch (e) { /* noop */ } }
          return w.focus();
        }
      }
      if (self.clients.openWindow) return self.clients.openWindow(link);
      return undefined;
    }),
  );
});
