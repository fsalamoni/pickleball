/*
 * Service worker do PWA PickleRush.
 *
 * Princípios de segurança (não pode afetar nada do app/Firebase):
 *  - Só intercepta requisições GET de MESMA ORIGEM.
 *  - NUNCA toca em tráfego cross-origin (Firestore, Auth, Storage, Google APIs):
 *    para esses, não chamamos respondWith() e o navegador trata normalmente.
 *  - Navegação usa network-first (sempre conteúdo novo quando online); o cache
 *    só entra como fallback offline. Assets com hash são imutáveis (cache-first).
 *  - skipWaiting + clients.claim garantem que atualizações entram sem ficar presas.
 *
 * IMPORTANTE: bumpar `VERSION` sempre que o conjunto de assets mudar (ex.:
 * migração de V1 → V2). O cache key inclui o nome do produto e a versão; a
 * próxima ativação apaga caches antigos em `activate`.
 */
const VERSION = 'v5';
const CACHE = `picklerush-${VERSION}`;
const SHELL_URL = '/index.html';

self.addEventListener('install', (event) => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)));
      await self.clients.claim();
    })(),
  );
});

self.addEventListener('message', (event) => {
  if (event.data === 'SKIP_WAITING') self.skipWaiting();
});

function isStaticAsset(url) {
  return (
    url.pathname.startsWith('/assets/') ||
    /\.(?:js|css|png|svg|webp|ico|woff2?|ttf|otf|webmanifest)$/.test(url.pathname)
  );
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  // Só mesma origem. Tudo que é Firebase/Google/externo passa direto.
  if (url.origin !== self.location.origin) return;

  // Navegação (HTML): network-first com fallback offline para a app shell.
  if (request.mode === 'navigate') {
    event.respondWith(
      (async () => {
        try {
          const fresh = await fetch(request);
          const cache = await caches.open(CACHE);
          cache.put(SHELL_URL, fresh.clone()).catch(() => {});
          return fresh;
        } catch {
          const cached = await caches.match(SHELL_URL);
          return cached || Response.error();
        }
      })(),
    );
    return;
  }

  // Assets estáticos (com hash são imutáveis): cache-first com atualização.
  if (isStaticAsset(url)) {
    event.respondWith(
      (async () => {
        const cached = await caches.match(request);
        if (cached) return cached;
        try {
          const fresh = await fetch(request);
          if (fresh && fresh.status === 200 && fresh.type === 'basic') {
            const cache = await caches.open(CACHE);
            cache.put(request, fresh.clone()).catch(() => {});
          }
          return fresh;
        } catch {
          return cached || Response.error();
        }
      })(),
    );
  }
  // Demais GETs de mesma origem: comportamento padrão do navegador.
});
