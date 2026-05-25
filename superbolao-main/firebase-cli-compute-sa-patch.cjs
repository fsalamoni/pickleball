/**
 * Patch para o Firebase CLI v13+ que corrige o fallback do
 * getDefaultServiceAccount. A API Compute Engine retorna o formato antigo
 * (143237037612-compute@developer.gserviceaccount.com) que NÃO EXISTE.
 *
 * Uso:
 *   $env:NODE_OPTIONS = '--require "d:/Bol-o-Copa-2026/firebase-cli-compute-sa-patch.cjs"'
 *   firebase deploy --only functions
 */
const Module = require('module');

const originalLoad = Module._load;

Module._load = function patchedLoad(request, parent, isMain) {
  const loaded = originalLoad.apply(this, arguments);

  // Intercepta o módulo computeEngine.js em qualquer localização do firebase-tools
  if (
    request === '../gcp/computeEngine' ||
    request === '../../gcp/computeEngine' ||
    (typeof request === 'string' && request.includes('gcp') && request.endsWith('computeEngine'))
  ) {
    if (loaded && typeof loaded.getDefaultServiceAccount === 'function') {
      const originalGetDefault = loaded.getDefaultServiceAccount;
      loaded.getDefaultServiceAccount = async function (projectNumber) {
        // Fallback seguro: retorna a service account do App Engine, que existe
        // e já tem as permissões necessárias (editor, cloudfunctions.developer, etc.)
        return 'hocapp-44760@appspot.gserviceaccount.com';
      };
      return loaded;
    }
  }

  return loaded;
};