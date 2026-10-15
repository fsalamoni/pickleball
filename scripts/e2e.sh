#!/usr/bin/env bash
# Testes de navegador (Playwright) contra o build DESTE código, com Auth e
# Firestore nos emuladores — nada toca o banco de produção. É o que o CI roda
# em todo PR. Argumentos extras vão para o `playwright test`.
#   npm run e2e                      # tudo
#   npm run e2e -- tests/e2e/logado.spec.js --project=chromium
# Precisa de Java (emulador do Firestore) e do Chromium do Playwright
# (`npm run e2e:install`). Para testar o site no ar: `npm run e2e:producao`.
set -euo pipefail

export VITE_FIREBASE_API_KEY=demo-key
export VITE_FIREBASE_AUTH_DOMAIN=demo-picklerush.firebaseapp.com
export VITE_FIREBASE_PROJECT_ID=demo-picklerush
export VITE_FIREBASE_STORAGE_BUCKET=demo-picklerush.appspot.com
export VITE_FIREBASE_MESSAGING_SENDER_ID=0
export VITE_FIREBASE_APP_ID=1:0:web:demo
export VITE_FIREBASE_USE_EMULATORS=true

npx vite build
npx --yes firebase-tools@13 emulators:exec --only auth,firestore --project demo-picklerush \
  "E2E_EMULADORES=1 npx playwright test $*"
