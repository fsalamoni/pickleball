# Cheatsheet — Cola de comandos, snippets, troubleshooting

> **Quando usar**: precisa de um comando rápido, esqueceu a sintaxe, ou
> tem um erro recorrente. Cole este arquivo nos favoritos.

---

## 1. Setup local

```bash
# Clone
git clone https://github.com/fsalamoni/pickleball.git
cd pickleball

# Install
npm install

# Dev server
npm run dev
# → http://localhost:5173

# Emuladores Firebase (opcional, pra testar rules)
firebase emulators:start
# → http://localhost:4000 (UI)
```

## 2. Comandos de build/test/lint

```bash
npm run dev          # vite dev server
npm run build        # build produção → dist/
npm run preview      # serve dist/ local
npm test             # vitest (CI)
npm run test:watch   # vitest watch
npm run test:coverage
npm run lint         # eslint --quiet (0 errors esperado)
npm run lint:fix     # autofix
npm run typecheck    # JSDoc check
npm run e2e:install  # playwright (primeira vez)
npm run e2e          # playwright E2E
```

## 3. Git — fluxo de feature

```bash
# Setup worktree
cd /workspace/pickleball
git fetch origin
git checkout main
git pull origin main
git worktree add ../picklerush-feat-X -b feat/X origin/main
cd ../picklerush-feat-X

# Trabalhar...
# Validar
npm run lint && npm run build && npm test

# Commitar
git add .
git commit -m "feat(X): descrição"

# PR
git push -u origin feat/X
gh pr create --base main --title "feat(X): descrição" --body "..."

# Após merge
cd /workspace/pickleball
git worktree remove ../picklerush-feat-X
git branch -D feat/X
git fetch origin
```

## 4. Snippets de código

### 4.1 FeatureFlagGuard (gate de página)

```jsx
import FeatureFlagGuard from '@/v2/components/FeatureFlagGuard';
import { FEATURE_FLAG } from '@/core/featureFlags';

export default function V2MyFeature() {
  return (
    <FeatureFlagGuard
      flag={FEATURE_FLAG.MY_NEW_FEATURE}
      label="Minha Feature"
      description="O que faz em 1 frase"
    >
      <MyFeatureContent />
    </FeatureFlagGuard>
  );
}
```

### 4.2 useFeatureFlag (gate inline)

```jsx
import { useFeatureFlag } from '@/core/hooks/useFeatureFlag';
import { FEATURE_FLAG } from '@/core/featureFlags';

export default function V2Something() {
  const enabled = useFeatureFlag(FEATURE_FLAG.MY_NEW_FEATURE);
  return <div>{enabled && <NewButton />}<ExistingStuff /></div>;
}
```

### 4.3 React Query hook

```js
// src/modules/X/hooks/useY.js
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { yService } from '../services/yService';
import { queryKeys } from './queryKeys';

export function useY(id) {
  return useQuery({
    queryKey: queryKeys.y(id),
    queryFn: () => yService.get(id),
    enabled: !!id,
    staleTime: 30_000,
  });
}

export function useCreateY() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: yService.create,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.yAll() });
    },
  });
}
```

### 4.4 Service Firestore (CRUD + auditoria + notificação)

```js
// src/modules/X/services/yService.js
import { collection, doc, getDoc, addDoc, updateDoc, deleteDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '@/core/config/firebase';
import { logger } from '@/core/lib/logger';
import { auditService } from '@/core/services/auditService';
import { notifyUsers } from '@/core/services/notificationService';

export const yService = {
  async get(id) {
    const snap = await getDoc(doc(db, 'y', id));
    return snap.exists() ? { id: snap.id, ...snap.data() } : null;
  },

  async list() {
    const snap = await getDocs(collection(db, 'y'));
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  },

  async create(data, actor) {
    const ref = await addDoc(collection(db, 'y'), {
      ...data,
      created_at: serverTimestamp(),
      created_at_ms: Date.now(),
      created_by: actor.uid,
    });
    await auditService.createAuditLog({
      action: 'y_created',
      actor: actor.uid,
      details: { y_id: ref.id, ...data },
    });
    if (data.notifyUserIds?.length) {
      await notifyUsers(data.notifyUserIds, { /* ... */ });
    }
    return { id: ref.id, ...data };
  },

  async update(id, data, actor) {
    await updateDoc(doc(db, 'y', id), {
      ...data,
      updated_at: serverTimestamp(),
      updated_by: actor.uid,
    });
    await auditService.createAuditLog({
      action: 'y_updated',
      actor: actor.uid,
      details: { y_id: id, ...data },
    });
  },

  async delete(id, actor) {
    await deleteDoc(doc(db, 'y', id));
    await auditService.createAuditLog({
      action: 'y_deleted',
      actor: actor.uid,
      details: { y_id: id },
    });
  },
};
```

### 4.5 Domain puro (lógica + test)

```js
// src/modules/X/domain/something.js (puro)
export function computeSomething(input) {
  // lógica pura
  return result;
}

// src/modules/X/domain/something.test.js
import { describe, it, expect } from 'vitest';
import { computeSomething } from './something';

describe('computeSomething', () => {
  it('computa corretamente no caso normal', () => {
    expect(computeSomething({ a: 1 })).toBe(/* expected */);
  });
  it('lida com input vazio', () => {
    expect(computeSomething(null)).toBe(/* expected */);
  });
  it('lida com input inválido', () => {
    expect(() => computeSomething({ invalid: true })).toThrow();
  });
});
```

### 4.6 V2ConfirmDialog (substitui `confirm()` nativo)

```jsx
import { useState } from 'react';
import { V2ConfirmDialog } from '@/v2/ui/primitives';

const [open, setOpen] = useState(false);

<>
  <V2Button onClick={() => setOpen(true)}>Ação destrutiva</V2Button>
  <V2ConfirmDialog
    open={open}
    onOpenChange={setOpen}
    title="Tem certeza?"
    description="Esta ação não pode ser desfeita."
    confirmLabel="Sim, fazer"
    cancelLabel="Voltar"
    onConfirm={handleAction}
    variant="danger"
  />
</>
```

### 4.7 V2Dialog (modal genérico)

```jsx
import { V2Dialog, V2Button, V2Input } from '@/v2/ui/primitives';

<V2Dialog
  open={open}
  onOpenChange={setOpen}
  title="Título"
  description="Descrição opcional"
  footer={
    <>
      <V2Button variant="ghost" onClick={() => setOpen(false)}>Cancelar</V2Button>
      <V2Button onClick={handleSave}>Salvar</V2Button>
    </>
  }
>
  <V2Input label="Nome" value={name} onChange={setName} />
</V2Dialog>
```

### 4.8 Firestore rule (nova coleção)

```
match /my_new_collection/{id} {
  allow read: if isAuthenticated();
  allow create: if isAuthenticated() 
    && request.resource.data.user_id == request.auth.uid
    && request.resource.data.keys().hasAll(['user_id', 'created_at']);
  allow update, delete: if isAuthenticated() 
    && resource.data.user_id == request.auth.uid;
}
```

### 4.9 Audit log (escrita)

```js
import { auditService } from '@/core/services/auditService';

await auditService.createAuditLog({
  action: 'my_action',  // snake_case, estável
  actor: user.uid,
  details: { /* contexto */ },
});
```

### 4.10 Notificação (criação)

```js
import { createNotification, notifyUsers } from '@/core/services/notificationService';

// 1 user
await createNotification({
  userId: user.uid,
  title: 'Título',
  message: 'Mensagem',
  type: 'generic',  // ver NOTIFICATION_TYPE em 01-AI-CONTEXT §7
  link: '/rota/relacionada',
  actor: currentUser.uid,
});

// Vários users (lote ≤400)
await notifyUsers([uid1, uid2, uid3], {
  title: '...',
  message: '...',
  type: 'club_event_published',
  link: '/clubes/X',
  actor: currentUser.uid,
});
```

## 5. Diagnóstico rápido

### 5.1 "Feature não funciona em produção"

```bash
# 1. Bundle deployed?
curl -s https://picklerush.web.app/ | grep -oE 'index-[^"]+\.js'

# 2. Tem o código novo no bundle?
curl -s https://picklerush.web.app/assets/index-XXX.js | grep -c "novoCodigo"

# 3. Build local funciona?
npm run build

# 4. Tests passam?
npm test

# 5. Flag tá ON no Firestore?
# Console do Firebase → platform_settings/feature_flags/{key}

# 6. Rule tá permitindo?
# Firebase Console → Firestore → Rules → test rule
```

### 5.2 "ReferenceError: X is not defined"

```bash
# 1. X está importado?
grep "import.*X" src/v2/components/Y.jsx

# 2. Se não está → adicionar
# 3. Se está mas quebra → tree-shaking?
#    Rodar validate-lucide-imports (se for lucide)
node scripts/validate-lucide-imports.mjs
#    Se for cn() → import explícito
```

### 5.3 "Build quebrou"

```bash
# Rodar local
npm run build 2>&1 | tail -50

# Geralmente:
# - import faltando
# - typo em import path
# - dependência não instalada (npm install)
```

### 5.4 "Test quebrou"

```bash
# Rodar específico
npx vitest run src/modules/X/domain/Y.test.js

# Ver o erro
# - check se a função mudou
# - check se o mock tá desatualizado
# - check se o import path mudou
```

### 5.5 "Deploy quebrou"

```bash
# Ver último run
gh run list --workflow=deploy-firebase.yml --limit=3

# Ver log
gh run view <run-id> --log

# Erros comuns:
# - missing secret (adicionar no GitHub)
# - lint/build/test falhou (rodar local)
# - service account inválido (regenerar)
```

### 5.6 "PWA não atualiza"

```bash
# 1. SW está stale?
# DevTools → Application → Service Workers → Unregister

# 2. SW version foi bumped?
grep SW_VERSION src/core/pwa/registerPwa.js

# 3. Auto-unregister tá rodando?
grep "unregisterStaleAndMaybeReload" src/core/pwa/

# 4. Reload deferido tá interferindo?
# Checar sessionStorage 'pwa-stale-last-activity'
```

## 6. Comandos Firebase CLI

```bash
firebase login
firebase projects:list
firebase use pickletour
firebase deploy                       # tudo
firebase deploy --only hosting
firebase deploy --only firestore:rules
firebase deploy --only firestore:indexes
firebase deploy --only functions
firebase emulators:start
firebase emulators:start --only firestore,auth
firebase firestore:databases:get pickleball --project pickletour
firebase firestore:databases:create pickleball --location southamerica-east1 --project pickletour
firebase hosting:sites:get picklerush --project pickletour
firebase functions:log
```

## 7. URLs importantes

| Recurso | URL |
|---|---|
| Produção | https://picklerush.web.app |
| Legacy | https://pickletour.web.app (redirect 301) |
| Firebase Console | https://console.firebase.google.com/project/pickletour |
| Firestore Console | https://console.firebase.google.com/project/pickletour/firestore |
| Auth | https://console.firebase.google.com/project/pickletour/authentication |
| Functions | https://console.firebase.google.com/project/pickletour/functions |
| GitHub | https://github.com/fsalamoni/pickleball |
| GitHub Actions | https://github.com/fsalamoni/pickleball/actions |
| Cloud Functions log | `firebase functions:log` |

## 8. Atalhos do teclado (V2)

| Tecla | Ação |
|---|---|
| `Ctrl/Cmd + K` | Busca global (Onda 10) |
| `Ctrl/Cmd + R` | Reload (com SW auto-unregister) |
| `Esc` | Fecha modal/dialog |
| `Tab` | Próximo elemento focável |
| `Shift+Tab` | Anterior |

## 9. Resumo de uma linha

```bash
# Feature local → PR → merge → deploy:
git fetch && git checkout main && git pull
git worktree add ../X -b feat/X origin/main
cd ../X
# ... codar ...
npm run lint && npm run build && npm test
git add . && git commit -m "feat(X): Y"
git push -u origin feat/X
gh pr create --base main
# merge no GitHub → deploy sai em ~3 min
```

> **Última atualização**: 2026-07-24. Faltou um comando? Adiciona aqui.
