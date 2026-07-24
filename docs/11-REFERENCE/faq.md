# FAQ — Perguntas frequentes

> Perguntas que você vai ter ao trabalhar no PickleRush. Se não achar
> aqui, procure em [`cheatsheet.md`](./cheatsheet.md) ou pergunte.

---

## Setup e dev

### Como rodo o projeto local?

```bash
git clone https://github.com/fsalamoni/pickleball.git
cd pickleball
npm install
npm run dev
# → http://localhost:5173
```

### Preciso de Firebase local?

Não necessariamente. Sem emuladores, o app funciona contra o projeto
real `pickletour` (autenticação requer conta Google). Para testar
regras offline, use emuladores: `firebase emulators:start`.

### Como vejo o que tá em produção?

https://picklerush.web.app — usuário precisa estar logado pra ver
telas autenticadas. Plataforma admin: `/admin/console`.

### Como ativo o modo admin?

1. Logar com `fsalamoni@gmail.com` (uid `Kx7CC0NVgogh8cCF4wIRmpOvo7r2`)
2. Esse user tem `role: 'platform_admin'`
3. `/admin/*` liberado, `/admin/console` permite ligar/desligar flags

---

## Estrutura do código

### Onde está a feature X?

Ver `cheatsheet.md` § 4 ("Onde está X") + `06-MODULES.md` § do módulo.

### Qual a diferença entre V1 e V2?

- **V1** (`src/pages/`, `src/components/`): legado, em desuso. Mantido
  só para `PublicTournament` (`/p/:id`) e `PrintTournament`
  (`/torneios/:id/imprimir`).
- **V2** (`src/v2/`): ativo, "Athleisure Premium". 67 pages, paleta
  ink/acid/paper, primitivos V2.

### Onde fica o schema do Firestore?

- `docs/05-DATA-MODEL.md` — todas as 92 coleções documentadas
- `firestore.rules` — regras de segurança (match por coleção)
- `firestore.indexes.json` — índices compostos

### Onde ficam as flags?

- `src/core/featureFlags.js` — 124 flags (FEATURE_FLAG)
- `src/core/featureFlagGroups.js` — agrupadas (admin)
- `platform_settings/feature_flags/{key}` — defaults no Firestore
- `/admin/console` — UI para ativar/desativar

### Como adiciono uma feature?

1. Ler `CLAUDE.md` (raiz) + `02-STANDARDS.md` (como codar)
2. Adicionar flag em `featureFlags.js` (default OFF)
3. Adicionar ao grupo em `featureFlagGroups.js`
4. Adicionar default no Firestore (via `migrateLegacyFlags`)
5. Implementar: domain → service → hook → UI
6. Adicionar teste
7. PR + smoke test + merge
8. Atualizar docs (01-AI-CONTEXT, 05-DATA-MODEL, 06-MODULES, 15-backlog)
9. Ativar flag no /admin/console pra testar

---

## Git, PR, deploy

### Como crio uma feature branch?

```bash
git fetch origin && git checkout main && git pull origin main
git worktree add ../picklerush-feat-X -b feat/X origin/main
cd ../picklerush-feat-X
```

### Como funciona o deploy?

`push em main` → GitHub Actions (`.github/workflows/deploy-firebase.yml`)
→ build + deploy (hosting, rules, indexes, functions). Tempo típico:
2-4 minutos.

### Onde vejo o status do deploy?

GitHub → Actions tab → último workflow "Deploy Firebase Hosting".

### Como dou rollback?

3 opções (em ordem de complexidade):
1. **Reverter o merge no GitHub** (botão Revert)
2. **`firebase hosting:clone picklerush:<versão> picklerush:live`** (instantâneo)
3. **Re-commit revertendo manualmente** (`git revert <sha>`)

### Por que não posso commitar direto em main?

- Perde rastreabilidade (qual feature quebrou produção?)
- Perde o smoke test gate (CI não roda)
- Perde o code review (mesmo que self-review)
- Bota a `main` em risco

---

## Bugs e debugging

### "X is not defined" no console

**Causa comum**: import faltando.

**Como investigar:**
1. `grep -n "X" src/v2/components/Y.jsx` — está importado?
2. Se for ícone `lucide-react`: rodar `node scripts/validate-lucide-imports.mjs`
3. Se for `cn()`: adicionar `import { cn } from '@/core/lib/utils'`

**Lições**:
- sw-v72.5 (MessageSquare sem import)
- sw-v73.4 (Calendar/Check/Copy sem import)
- sw-v73.5 (cn sem import em V2CourtsTab)

### "Bundle deployed mas feature não funciona"

1. `curl -s https://picklerush.web.app/ | grep -oE 'index-[^"]+\.js'` — qual bundle está ativo?
2. `curl -s https://picklerush.web.app/assets/index-XXX.js | grep -c "novoCodigo"` — código novo está lá?
3. Se não está: SW stale. `DevTools → Application → Service Workers → Unregister`
4. Se está mas não funciona: erro JS em runtime. DevTools → Console
5. Se flag está OFF: ativar em /admin/console
6. Se Firestore rule tá negando: Console → Rules → Simulador

### "Build passa mas feature não funciona em runtime"

**Quase sempre**: tree-shaking eliminou import. Solução: `*.runtime.test.jsx`
para o componente. Ver `02-STANDARDS.md` §4.3.

### "PWA não atualiza"

1. SW foi bumped? `grep SW_VERSION src/core/pwa/registerPwa.js`
2. Auto-unregister tá rodando? `grep "unregisterStale" src/core/pwa/`
3. Reload deferido tá bloqueando? Track atividade via sessionStorage

Lição sw-v73.3: auto-reload de 50ms interrompe interação do user.
Solução: defer 5s se user interagindo.

### "Test quebrou mas eu não mudei nada"

1. Rodar `npx vitest run <arquivo>` — erro específico
2. Verificar se mock tá desatualizado
3. Verificar se import path mudou
4. `git log --oneline` no arquivo — alguém mexeu?

### "Deploy quebrou"

GitHub Actions → run com erro → log.

Erros comuns:
- `Missing secret` — adicionar em Settings → Secrets
- `Build failed` — `npm run build` local
- `Lint errors` — `npm run lint`
- `Tests failed` — `npm test`
- `Service account inválido` — regerar no Firebase Console

---

## Feature flags

### Como crio uma flag?

```js
// src/core/featureFlags.js
export const FEATURE_FLAG = Object.freeze({
  // ... existentes
  MY_NEW_FEATURE: 'my_new_feature',
});

// src/core/featureFlagGroups.js
{
  id: 'arenas',  // ou criar novo grupo
  keys: [
    FEATURE_FLAG.MY_NEW_FEATURE,
  ],
}
```

E adicionar default no Firestore (via `migrateLegacyFlags`).

### Como ativo uma flag em produção?

1. Logar como `fsalamoni@gmail.com` (platform_admin)
2. `/admin/console` → togglear a flag
3. Refresh

Ou via Firebase Console:
```js
firebase.firestore().doc('platform_settings/feature_flags/my_new_feature')
  .set({ value: true, ... });
```

### Como escondo uma página quando flag off?

```jsx
import FeatureFlagGuard from '@/v2/components/FeatureFlagGuard';

<FeatureFlagGuard
  flag={FEATURE_FLAG.MY_NEW_FEATURE}
  label="Minha Feature"
  description="O que faz"
>
  <Content />
</FeatureFlagGuard>
```

**NUNCA** redirecionar para `/` silenciosamente (lição sw-v73.3).

### Por que minha flag não aparece no admin?

Provavelmente falta em `featureFlagGroups.js` OU não rodou
`migrateLegacyFlags` (bump `FLAGS_MIGRATION_VERSION`).

---

## Banco de dados (Firestore)

### Como adiciono uma coleção?

1. Doc em `05-DATA-MODEL.md`
2. `match /<col>/{id}` em `firestore.rules` (aditivo)
3. `src/modules/X/services/<col>Service.js` (CRUD)
4. `src/modules/X/hooks/use<col>.js` (React Query)
5. `queryKeys.js` do módulo
6. UI consome o hook
7. Testes

### Como adiciono um campo em coleção existente?

- SEMPRE campo **opcional**
- Service lê com default: `const name = data.name ?? 'Anônimo';`
- Atualizar `05-DATA-MODEL.md`
- Atualizar regra só se restringir algo (improvável)

### Como adiciono uma regra nova?

`firestore.rules`, de forma **aditiva** (não mexe nas existentes). Para
match determinístico (ex.: `arena_managers/{arenaId_uid}`), use:
```
match /arena_managers/{managerId} {
  allow read: if isAuthenticated();
  allow create, update: if isAuthenticated()
    && managerId.matches('.*_' + request.auth.uid);
  allow delete: if isPlatformAdmin();
}
```

### Como testo regras localmente?

```bash
firebase emulators:start
# → http://localhost:4000 (UI do Firestore emulator)
# → tem simulador de regras
```

---

## UI / V2

### Como adiciono uma página V2?

```jsx
// src/v2/pages/V2Xxx.jsx
import { lazy, Suspense } from 'react';
import { V2Shell, V2Loading } from '@/v2/components/V2Shell';
import FeatureFlagGuard from '@/v2/components/FeatureFlagGuard';
import { FEATURE_FLAG } from '@/core/featureFlags';

const V2XxxContent = lazy(() => import('@/v2/components/Xxx/V2XxxContent'));

export default function V2Xxx() {
  return (
    <V2Shell title="Xxx">
      <FeatureFlagGuard flag={FEATURE_FLAG.XXX} label="Xxx" description="...">
        <Suspense fallback={<V2Loading />}>
          <V2XxxContent />
        </Suspense>
      </FeatureFlagGuard>
    </V2Shell>
  );
}
```

E adicionar a rota em `src/v2/V2App.jsx`:
```jsx
const V2Xxx = lazy(() => import('@/v2/pages/V2Xxx'));
<Route path="/xxx" element={<V2Xxx />} />
```

### Como uso a navegação 2 níveis?

```jsx
<V2TabBar sticky="top-2" tabs={[
  { id: 'tab1', label: 'Tab 1', icon: Icon1 },
  { id: 'tab2', label: 'Tab 2', icon: Icon2 },
]} />
<V2SubTabBar sticky="top-[68px]" tabs={[
  { id: 'sub1', label: 'Sub 1' },
  { id: 'sub2', label: 'Sub 2' },
]} />
```

Usado em `/arenas/:id/gerir`, `/admin/console`.

### Como faço um modal?

```jsx
import { V2Dialog, V2Button } from '@/v2/ui/primitives';

const [open, setOpen] = useState(false);

<V2Dialog
  open={open}
  onOpenChange={setOpen}
  title="Título"
  footer={
    <>
      <V2Button variant="ghost" onClick={() => setOpen(false)}>Cancelar</V2Button>
      <V2Button onClick={handleSave}>Salvar</V2Button>
    </>
  }
>
  {/* conteúdo */}
</V2Dialog>
```

### Como faço um confirm dialog (ação destrutiva)?

```jsx
import { V2ConfirmDialog } from '@/v2/ui/primitives';

<V2ConfirmDialog
  open={open}
  onOpenChange={setOpen}
  title="Tem certeza?"
  description="Esta ação não pode ser desfeita."
  confirmLabel="Sim, cancelar"
  cancelLabel="Voltar"
  onConfirm={handleCancel}
  variant="danger"
/>
```

**NUNCA** use `window.confirm()` nativo (lição sw-v73.3).

---

## Testes

### Como escrevo um teste de domain?

```js
// src/modules/X/domain/y.test.js
import { describe, it, expect } from 'vitest';
import { doY } from './y';

describe('doY', () => {
  it('caso normal', () => {
    expect(doY(input)).toBe(expected);
  });
  it('input vazio', () => {
    expect(doY(null)).toBe(defaultValue);
  });
  it('input inválido', () => {
    expect(() => doY({ invalid: true })).toThrow();
  });
});
```

### Como escrevo um teste de runtime (componente V2)?

```jsx
// src/v2/pages/V2Xxx.runtime.test.jsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

vi.mock('@/core/lib/FirebaseAuthContext', () => ({
  useAuth: () => ({ user: { uid: 'u1' }, userProfile: { role: 'platform_admin' } }),
}));
vi.mock('@/core/hooks/useX', () => ({
  useX: () => ({ data: MOCK_X, isLoading: false }),
}));

const TestWrapper = ({ children }) => {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
};

describe('V2Xxx', () => {
  it('renderiza com dados', () => {
    render(<V2Xxx />, { wrapper: TestWrapper });
    expect(screen.getByText(/texto esperado/i)).toBeInTheDocument();
  });
  it('clica em tab e não quebra', async () => {
    const user = userEvent.setup();
    render(<V2Xxx />, { wrapper: TestWrapper });
    await user.click(screen.getByRole('tab', { name: /tab 2/i }));
    // assert
  });
});
```

### Por que meu teste de domain importa React?

Não deveria. Domain é puro. Se você precisa de React, é componente —
mova para `components/` e faça `runtime.test.jsx`.

---

## Onde achar mais info

- **Princípios / fluxo de leitura**: [`../CLAUDE.md`](../CLAUDE.md)
- **Padrões de código**: [`../02-STANDARDS.md`](../02-STANDARDS.md)
- **Git/deploy**: [`../03-WORKFLOW.md`](../03-WORKFLOW.md)
- **Schema**: [`../05-DATA-MODEL.md`](../05-DATA-MODEL.md)
- **Módulos**: [`../06-MODULES.md`](../06-MODULES.md)
- **Backlog**: [`../09-UX-ANALYSIS/15-backlog-remanescente.md`](../09-UX-ANALYSIS/15-backlog-remanescente.md)
- **Status Arena V3**: [`../10-ARENA-V3/26-ARENA-V3-COMPLETE-REFERENCE.md`](../10-ARENA-V3/26-ARENA-V3-COMPLETE-REFERENCE.md)
- **Cheatsheet**: [`./cheatsheet.md`](./cheatsheet.md)
- **Glossário**: [`./glossary.md`](./glossary.md)

> **Última atualização**: 2026-07-24. Pergunta frequente faltando?
> Adiciona aqui.
