const baseURL = normalizeBaseURL(process.env.HEALTHCHECK_BASE_URL || 'https://superbolao.web.app');

const routes = [
  '/',
  '/regras',
  '/politica-uso',
  '/aviso-jogos',
  '/login',
];

const checks = [];
let failed = false;

for (const route of routes) {
  await checkRoute(route);
}

await checkIndexAndAssets();

for (const check of checks) {
  const marker = check.ok ? 'OK' : 'FAIL';
  console.log(`${marker} ${check.label}${check.detail ? ` - ${check.detail}` : ''}`);
}

if (failed) {
  process.exitCode = 1;
} else {
  console.log(`Production healthcheck passed for ${baseURL}`);
}

async function checkRoute(route) {
  const response = await fetchWithTimeout(`${baseURL}${route}`);
  const body = await response.text();
  const ok = response.ok && body.includes('<div id="root">') && body.includes('/assets/');

  record(ok, `route ${route}`, `status ${response.status}`);
}

async function checkIndexAndAssets() {
  const response = await fetchWithTimeout(`${baseURL}/index.html`);
  const html = await response.text();
  const cacheControl = response.headers.get('cache-control') || '';
  const assets = Array.from(html.matchAll(/(?:src|href)="(\/assets\/[^"]+\.(?:js|css))"/g), (match) => match[1]);

  record(response.ok, 'index.html status', `status ${response.status}`);
  record(cacheControl.includes('no-cache') || cacheControl.includes('no-store'), 'index.html cache policy', cacheControl || 'missing cache-control');
  record(assets.length > 0, 'hashed asset references', `${assets.length} asset(s)`);

  for (const assetPath of assets) {
    const assetResponse = await fetchWithTimeout(`${baseURL}${assetPath}`);
    const assetCacheControl = assetResponse.headers.get('cache-control') || '';
    const cacheOk = assetCacheControl.includes('max-age=31536000') && assetCacheControl.includes('immutable');

    record(assetResponse.ok, `asset ${assetPath}`, `status ${assetResponse.status}`);
    record(cacheOk, `asset cache ${assetPath}`, assetCacheControl || 'missing cache-control');
  }
}

async function fetchWithTimeout(url) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15_000);

  try {
    return await fetch(url, {
      cache: 'no-store',
      headers: {
        'cache-control': 'no-cache',
        pragma: 'no-cache',
      },
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeout);
  }
}

function record(ok, label, detail) {
  checks.push({ ok, label, detail });
  if (!ok) failed = true;
}

function normalizeBaseURL(value) {
  return String(value).replace(/\/+$/, '');
}
