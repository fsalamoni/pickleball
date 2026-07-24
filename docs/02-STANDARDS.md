# 02-STANDARDS — Padrões de código

> **Quando usar**: antes de escrever qualquer linha de código. Se você não
> está seguindo algum desses padrões, PARE e releia.
>
> Complementa `docs/04-ARCHITECTURE.md` (camadas, design system) e
> `docs/01-AI-CONTEXT.md` (panorama). Este doc foca em **regras duras**
> e **como fazer**.

---

## 1. Estrutura de arquivos e pastas

### 1.1 Onde cada coisa vive

```
src/
├── core/                     # infraestrutura transversal
│   ├── config/               # init (firebase.js)
│   ├── lib/                  # utils (logger, useClipboard, profileValidation)
│   ├── domain/               # types.js (JSDoc typedefs compartilhados)
│   ├── services/             # auditService, notificationService, baseService
│   ├── featureFlags.js       # 124 flags (FEATURE_FLAG)
│   ├── featureFlagGroups.js  # agrupamento pra admin
│   └── pwa/                  # registerPwa + sw lifecycle
│
├── modules/                  # ⭐ BASE DE DOMÍNIO (19 módulos, ver 06-MODULES)
│   └── X/
│       ├── domain/           # lógica pura + .test.js (SEMPRE)
│       ├── services/         # Firestore CRUD + auditoria
│       ├── hooks/            # React Query (useX)
│       ├── pages/            # páginas V1 do módulo
│       ├── components/       # UI específica
│       └── README.md         # visão, schema, hooks, fluxos
│
├── v2/                       # ⭐ APP ATIVO
│   ├── V2App.jsx             # tabela de rotas autenticadas
│   ├── components/           # V2Layout, FeatureFlagGuard, V2Arena*, V2Coaches*
│   ├── pages/                # 67 páginas V2 (V2Xxx.jsx)
│   ├── ui/primitives.jsx     # V2Button, V2Card, V2Badge, V2Dialog, ...
│   └── lib/                  # utils V2
│
├── pages/                    # V1 legado (espectador, impressão)
├── components/               # shadcn/ui primitives (Radix)
└── App.jsx                   # roteamento + providers
```

### 1.2 Convenção de camadas (dentro de cada módulo)

```
domain/      lógica pura, sem React nem Firebase — sempre com .test.js
services/    I/O com Firestore (CRUD) + auditoria; sem regra de negócio pesada
hooks/       React Query (useQuery/useMutation) sobre os services
pages/       telas mapeadas a rotas
components/  UI específica do módulo
```

**Regra: dependência flui só para baixo** (`pages → hooks → services → domain`).
Componentes **nunca** chamam Firestore direto. Services **nunca** importam React.
Domain **nunca** importa services ou hooks.

### 1.3 Naming conventions

- **Pastas**: `kebab-case` (`arena_v3`, `chat`)
- **Módulos**: `snake_case` (`src/modules/arenas/`, `src/modules/leveling/`)
- **Componentes/pages**: `PascalCase` (`V2ArenaDetail.jsx`, `V2BookingRow.jsx`)
- **Funções/variáveis**: `camelCase` (`createBooking`, `useArenaBookings`)
- **Constantes**: `UPPER_SNAKE` (`FEATURE_FLAG.ARENAS`, `BOOKING_STATUS`)
- **Test files**: `Xxx.test.js` (domain) ou `Xxx.runtime.test.jsx` (componentes V2 críticos)
- **Hooks**: prefixo `use` (`useArena`, `useTournament`)
- **Services**: sem prefixo de classe (`bookingService.js`, não `BookingService.js`)

---

## 2. Linguagem e tipos

### 2.1 JSX, sem TypeScript

- **JSX puro**, sem TypeScript
- **JSDoc typedefs** compartilhados em `src/core/domain/types.js`
- Tipos de domínio específicos: em `src/modules/X/domain/types.js` quando necessário
- Rodar `npm run typecheck` antes de commit

```js
/**
 * @typedef {Object} Booking
 * @property {string} id
 * @property {string} arena_id
 * @property {string} athlete_id
 * @property {'single'|'recurring'|'coach_lesson'|'shared'} booking_type
 * @property {Slot[]} slots
 * @property {string} status
 * @property {string} created_at
 */
```

### 2.2 Mensagens, UI, comentários

- **100% pt-BR** em strings de UI, comentários, mensagens de erro, audit_logs
- Logs técnicos em inglês (código) — mas em PT quando forem mensagens para user
- Sem emoji decorativo em código (só na UI, e via `lucide`)

### 2.3 Imports

```js
// Ordem: 1) externos, 2) @/, 3) relativos
import { useState } from 'react';                       // 1
import { doc, getDoc } from 'firebase/firestore';       // 1
import { useQuery } from '@tanstack/react-query';        // 1
import { useAuth } from '@/core/lib/FirebaseAuthContext';// 2
import { FEATURE_FLAG } from '@/core/featureFlags';      // 2
import { bookingService } from '../services/bookingService';// 3
```

- **Alias `@/`** → `src/` (Vite + jsconfig)
- **SEMPRE** importar ícones lucide que você usa no JSX
- **SEMPRE** importar `cn` explicitamente em componentes (não confiar em hoisting)
- **EVITE** default exports exceto em componentes de página (padrão do Vite)

---

## 3. Feature flags (regra de ouro)

**Toda nova funcionalidade visível ao usuário DEVE nascer atrás de uma flag.**

### 3.1 Onde definir

**`src/core/featureFlags.js`** — adicionar ao `FEATURE_FLAG` object:

```js
export const FEATURE_FLAG = Object.freeze({
  // ... existentes
  MY_NEW_FEATURE: 'my_new_feature',  // ⬅️ nova
});
```

**`src/core/featureFlagGroups.js`** — adicionar ao grupo apropriado:

```js
{
  id: 'arenas',  // ou outro grupo
  label: 'Arenas e reservas',
  keys: [
    FEATURE_FLAG.MY_NEW_FEATURE,  // ⬅️ nova
  ],
},
```

Se não encaixar em grupo existente, vai pra `FLAG_GROUP_OTHER` (renderizado
no fim do admin console).

### 3.2 Default no Firestore

Criar (ou atualizar) o default em `platform_settings/feature_flags/my_new_feature`:

```js
{
  value: false,  // ⬅️ sempre false por default
  description: 'Descrição visível no admin',
  updated_at: <serverTimestamp>,
  updated_by: 'system',
}
```

### 3.3 Migração de flags

Ao **adicionar** flag nova OU **mudar** default de existente, **SEMPRE**:

1. Atualizar `migrateLegacyFlags` em `src/core/featureFlags.js`
2. **Bump `FLAGS_MIGRATION_VERSION`** (constante no mesmo arquivo)
3. Adicionar teste em `featureFlags.test.js` que valida:
   - Defaults batem com `FEATURE_FLAG` object
   - Migração roda idempotente
   - Defaults novos aparecem sem quebrar docs existentes

**Por quê?** Sem migração, o Firestore fica com defaults velhos e a feature
"nasce desligada mas não aparece no admin" — fachada. Lição da Onda 1.

### 3.4 Como usar na UI

**Opção A — gate de página inteira** (mais comum):

```jsx
import FeatureFlagGuard from '@/v2/components/FeatureFlagGuard';
import { FEATURE_FLAG } from '@/core/featureFlags';

export default function V2MyFeature() {
  return (
    <FeatureFlagGuard
      flag={FEATURE_FLAG.MY_NEW_FEATURE}
      label="Minha Feature"
      description="O que essa feature faz em 1 frase"
    >
      <MyFeatureContent />
    </FeatureFlagGuard>
  );
}
```

**Opção B — gate inline** (esconder só um botão/seção):

```jsx
import { useFeatureFlag } from '@/core/hooks/useFeatureFlag';

export default function V2Something() {
  const enabled = useFeatureFlag(FEATURE_FLAG.MY_NEW_FEATURE);
  return (
    <div>
      {enabled && <NewButton />}
      <ExistingStuff />
    </div>
  );
}
```

**NUNCA redirecionar silenciosamente** para `/` quando flag off. Use
`FeatureFlagGuard` — o admin precisa DESCobrir a feature. (Lição sw-v73.3.)

### 3.5 Como ativar para teste local

1. Logado como platform_admin (`fsalamoni@gmail.com`)
2. Ir em `/admin/console`
3. Togglear a flag
4. Refresh

Ou via console do Firebase:
```js
firebase.firestore().doc('platform_settings/feature_flags/my_new_feature')
  .set({ value: true, updated_at: firebase.firestore.FieldValue.serverTimestamp() });
```

---

## 4. Páginas V2 (Athleisure Premium)

### 4.1 Estrutura padrão de uma página V2

```jsx
// src/v2/pages/V2Xxx.jsx
import { lazy, Suspense } from 'react';
import { useAuth } from '@/core/lib/FirebaseAuthContext';
import { useFeatureFlag } from '@/core/hooks/useFeatureFlag';
import { FEATURE_FLAG } from '@/core/featureFlags';
import { V2Shell, V2Loading } from '@/v2/components/V2Shell';
import FeatureFlagGuard from '@/v2/components/FeatureFlagGuard';

// Lazy-load de sub-componentes pesados
const V2XxxContent = lazy(() => import('@/v2/components/Xxx/V2XxxContent'));

export default function V2Xxx() {
  return (
    <V2Shell title="Xxx" subtitle="O que essa tela faz">
      <FeatureFlagGuard flag={FEATURE_FLAG.XXX} label="Xxx" description="...">
        <Suspense fallback={<V2Loading />}>
          <V2XxxContent />
        </Suspense>
      </FeatureFlagGuard>
    </V2Shell>
  );
}
```

### 4.2 Rotas

- Tabela em `src/v2/V2App.jsx` (autenticadas) ou `App.jsx` (públicas)
- `basename = import.meta.env.BASE_URL`
- Use `React.lazy` + `Suspense` para code splitting
- Adicione à tabela **na posição correta** (manter agrupamento lógico)

```jsx
const V2MyFeature = lazy(() => import('@/v2/pages/V2MyFeature'));

// dentro do <Routes>:
<Route path="/minha-feature" element={<V2MyFeature />} />
```

### 4.3 Componentes críticos: SEMPRE `*.runtime.test.jsx`

Componentes de página V2 que **não podem quebrar** DEVEM ter teste de
runtime. Lição: tree-shaking do Vite pode eliminar imports side-effect-free
que parecem usados. Tests estáticos (grep) NÃO pegam.

```jsx
// src/v2/pages/V2ArenaDetail.runtime.test.jsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

vi.mock('@/core/lib/FirebaseAuthContext', () => ({
  useAuth: () => ({ user: { uid: 'u1' }, userProfile: {} }),
}));
vi.mock('@/core/hooks/useArena', () => ({
  useArena: () => ({ data: MOCK_ARENA, isLoading: false }),
}));
// ... mockar TODOS os hooks que a página usa

describe('V2ArenaDetail', () => {
  it('renderiza com dados mockados', () => {
    render(<V2ArenaDetail />, { wrapper: TestWrapper });
    expect(screen.getByText(/nome da arena/i)).toBeInTheDocument();
  });

  it('não quebra ao clicar em tabs', async () => {
    const { user } = setupUser();
    render(<V2ArenaDetail />, { wrapper: TestWrapper });
    await user.click(screen.getByRole('tab', { name: /quadras/i }));
    expect(screen.getByText(/adicionar quadra/i)).toBeInTheDocument();
  });
});
```

### 4.4 V2 UI primitives

Use os primitivos V2 (`src/v2/ui/primitives.jsx`):

- `V2Button` (variants: primary, secondary, ghost, danger)
- `V2Card` (header, body, footer)
- `V2Badge` (tones: blue, green, amber, red, neutral)
- `V2Dialog` (modal)
- `V2Skeleton` (loading)
- `V2Select` (aceita children OU options — ver §6)
- `V2Input`, `V2Textarea`, `V2Switch`
- `V2Tabs` (sub-tab-bar)
- `V2Surface` (wrapper com sombra orgânica)
- `V2ConfirmDialog` (substitui `confirm()` nativo)

**NÃO use shadcn/ui direto em código novo V2.** Reaproveite primitivos V2.

### 4.5 Navegação 2 níveis (admin da arena, admin do clube)

```jsx
import { V2TabBar } from '@/v2/components/V2TabBar';
import { V2SubTabBar } from '@/v2/components/V2SubTabBar';

<V2TabBar sticky="top-2" tabs={[
  { id: 'reservas', label: 'Reservas', icon: Calendar },
  { id: 'calendario', label: 'Calendário', icon: CalendarDays },
  // ... 5+ tabs no nível 1
]} />

<V2SubTabBar sticky="top-[68px]" tabs={[
  // sub-tabs do nível 2 (se necessário)
]} />
```

**Ordem da nav:** `arena-tab-bar` → `arena-subtab-bar` (sticky top correto).

---

## 5. Firestore (schema + services + rules)

### 5.1 Aditivividade — REGRA INEGOCIÁVEL

**Nunca quebrar uma coleção existente.** Novas coleções, novos campos
opcionais, novas regras (aditivas). Migração sempre via script idempotente
ou via `migrateLegacyFlags` para flags.

### 5.2 Adicionar nova coleção

1. **Schema em `docs/05-DATA-MODEL.md`**
2. **Regra em `firestore.rules`** (aditiva, após o `match /<col>/` existente)
3. **Service em `src/modules/X/services/collectionService.js`** com CRUD
4. **Hook em `src/modules/X/hooks/useCollection.js`** com React Query
5. **UI** consome o hook
6. **Teste do service** (mocks de Firestore)
7. **Adicionar flag** se afeta comportamento visível

```js
// firestore.rules
match /my_new_collection/{id} {
  allow read: if isAuthenticated();
  allow create: if isAuthenticated() 
    && request.resource.data.user_id == request.auth.uid;
  allow update, delete: if isAuthenticated() 
    && resource.data.user_id == request.auth.uid;
}
```

### 5.3 Adicionar campo a coleção existente

- **SEMPRE** campo **opcional** (nunca obrigatório)
- Service lê com default se faltar: `const name = data.name ?? 'Anônimo';`
- Atualizar regra só se o novo campo **restringir** algo (improvável)
- Documentar em `05-DATA-MODEL.md`

### 5.4 Ids deterministas

Quando o doc é um par recurso+user, use id determinista:

```js
// Exemplo: arena_managers, club_members, coach_students
const id = `${arenaId}_${userId}`;  // 'arenaX_uidY'
```

Evita duplicidade. Simplifica regras.

### 5.5 Auditoria

Toda mutação relevante chama `auditService.createAuditLog`:

```js
await auditService.createAuditLog({
  action: 'booking_cancelled',  // estável, snake_case
  actor: user.uid,
  details: { booking_id, reason, cancelled_by: 'athlete' },
});
```

Ações típicas: `tournament_created`, `club_member_invited`,
`match_result_recorded`, `club_join_approved`, `booking_cancelled`,
`booking_transferred`, `booking_responsibles_changed`,
`coach_lesson_created`, `clinic_signup`, `feature_flag_changed`,
`club_recurring_event_added`.

### 5.6 Notificações

Ações que disparam notificação usam `notificationService.createNotification`
ou `notifyUsers` (lote ≤400). Tipos em `NOTIFICATION_TYPE`
(`01-AI-CONTEXT.md` §7). Categorias silenciáveis (Onda 9b):
`booking_confirmed`, `tournament_*`, `chat_*`, `forum_*`, etc.

### 5.7 Realtime

- `onSnapshot` em **poucos** lugares (chat, spectator do torneio, sino)
- Resto: `useQuery` + invalidação após mutação

---

## 6. Lógica de negócio (domain/)

### 6.1 Onde mora

`src/modules/X/domain/<arquivo>.js` — sempre puro, sem imports de React
ou Firebase. **Sempre com `<arquivo>.test.js` ao lado.**

```js
// src/modules/arenas/domain/court_assignment.js (puro)
export function pickAvailableCourt(courts, date, startTime, endTime, bookings) {
  // lógica de negócio pura
}

// src/modules/arenas/domain/court_assignment.test.js
import { describe, it, expect } from 'vitest';
import { pickAvailableCourt } from './court_assignment';

describe('pickAvailableCourt', () => {
  it('atribui primeira quadra livre', () => {
    const courts = [{ id: 'c1' }, { id: 'c2' }];
    const bookings = [{ court_id: 'c1', date: '2026-07-24', start: '18:00', end: '19:00' }];
    expect(pickAvailableCourt(courts, '2026-07-24', '18:00', '19:00', bookings)).toBe('c2');
  });
  // ... mais casos
});
```

### 6.2 Regras

1. **SEMPRE** teste ao lado (`.test.js` mesmo nome)
2. **Pura**: nenhum import de `react`, `firebase`, `next/router`, etc
3. **Determinista**: mesma entrada → mesma saída
4. **Sem side-effects**: nada de `console.log`, `Date.now()`, `Math.random()`
   sem seed explícito
5. **Tipada via JSDoc** (typedefs compartilhados em `core/domain/types.js`)
6. **Cobre casos extremos**: vazio, null, undefined, valores inválidos
7. **Naming**: `verbNoun` (`pickAvailableCourt`, `computeCircuitRanking`,
   `validateBookingRequest`)

### 6.3 Quando NÃO criar domain

- **Cálculos triviais** que não valem um arquivo (`sum`, `filter` simples)
- **Wrappers de Firestore** (vão em `services/`, não `domain/`)
- **Componentes visuais** (vão em `components/`)

### 6.4 Quando criar

- Cálculo não-trivial com regras (sorteio, ranking, rateio, conflito, validação)
- Lógica que vai ser **chamada de múltiplos lugares**
- Lógica que precisa de **cobertura de teste** sem mock de React/Firebase

---

## 7. Componentes V2 (UI)

### 7.1 Estrutura de um componente V2

```jsx
// src/v2/components/V2BookingRow.jsx
import { Calendar, User, Copy } from 'lucide-react';  // ⬅️ SEMPRE importar tudo que usa
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { V2Card, V2Badge, V2Button } from '@/v2/ui/primitives';
import { cn } from '@/core/lib/utils';

export function V2BookingRow({ booking, onCancel, className }) {
  return (
    <V2Card className={cn('p-4', className)}>
      <div className="flex items-center gap-2">
        <Calendar className="h-4 w-4" />  // ⬅️ ícone importado
        <span>{format(booking.date, "dd 'de' MMMM", { locale: ptBR })}</span>
        <V2Badge tone={booking.status === 'confirmed' ? 'green' : 'amber'}>
          {booking.status}
        </V2Badge>
      </div>
      <V2Button variant="ghost" onClick={onCancel}>
        Cancelar
      </V2Button>
    </V2Card>
  );
}
```

### 7.2 Imports de ícones (LIÇÃO sw-v72.5 + sw-v73.4)

**SEMPRE** adicione o ícone ao import de `lucide-react` quando usar no JSX.
Build passa mas runtime quebra se você esquecer.

**Verificação**: `node scripts/validate-lucide-imports.mjs` (roda antes de CI).

### 7.3 `cn()` helper (LIÇÃO sw-v73.5)

**SEMPRE** importe explicitamente:
```js
import { cn } from '@/core/lib/utils';
```

`cn()` = `clsx + tailwind-merge`. Compor classes condicionalmente.

### 7.4 V2Select (LIÇÃO sw-v73.5)

Aceita **2 APIs**:

```jsx
// API 1: children (manual)
<V2Select value={...} onChange={...}>
  <option value="indoor">Coberta</option>
  <option value="outdoor">Descoberta</option>
</V2Select>

// API 2: options (declarativo)
<V2Select
  value={...}
  onChange={...}
  options={[
    { value: 'indoor', label: 'Coberta' },
    { value: 'outdoor', label: 'Descoberta' },
  ]}
/>
```

**Children > options** se ambos passados. NUNCA confie só em uma API.

### 7.5 Confirmação de ações destrutivas (LIÇÃO sw-v73.3)

**SEMPRE** use `V2ConfirmDialog` em vez de `confirm()` nativo:

```jsx
import { V2ConfirmDialog } from '@/v2/ui/primitives';

const [open, setOpen] = useState(false);

<V2ConfirmDialog
  open={open}
  onOpenChange={setOpen}
  title="Cancelar reserva?"
  description="Esta ação não pode ser desfeita."
  confirmLabel="Sim, cancelar"
  cancelLabel="Voltar"
  onConfirm={handleCancel}
  variant="danger"
/>
```

---

## 8. Hooks (React Query)

### 8.1 Padrão

```js
// src/modules/arenas/hooks/useArenaBookings.js
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { bookingService } from '../services/bookingService';
import { queryKeys } from './queryKeys';

export function useArenaBookings(arenaId) {
  return useQuery({
    queryKey: queryKeys.arenaBookings(arenaId),
    queryFn: () => bookingService.listByArena(arenaId),
    enabled: !!arenaId,
    staleTime: 30_000,
  });
}

export function useCreateBooking(arenaId) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: bookingService.create,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.arenaBookings(arenaId) });
      qc.invalidateQueries({ queryKey: queryKeys.arenasAll() });
    },
  });
}
```

### 8.2 Query keys centralizadas

```js
// src/modules/arenas/hooks/queryKeys.js
export const queryKeys = {
  arenaBookings: (arenaId) => ['arenaBookings', arenaId],
  arenasAll: () => ['arenas'],
  // ...
};
```

**Sempre** invalidar todas as keys relacionadas após mutação.

### 8.3 Convenção de nome

- `useX` para queries (`useArenaBookings`)
- `useXMutation` ou `useCreateX`, `useUpdateX`, `useDeleteX` para mutations
- `useX` se for hook custom (não query) (`useClipboard`)

---

## 9. Services (Firestore CRUD)

### 9.1 Padrão

```js
// src/modules/arenas/services/bookingService.js
import { collection, doc, getDoc, getDocs, addDoc, updateDoc, deleteDoc, query, where } from 'firebase/firestore';
import { db } from '@/core/config/firebase';
import { logger } from '@/core/lib/logger';
import { auditService } from '@/core/services/auditService';
import { notifyUsers } from '@/core/services/notificationService';

export const bookingService = {
  async listByArena(arenaId) {
    try {
      const q = query(collection(db, 'arena_bookings'), where('arena_id', '==', arenaId));
      const snap = await getDocs(q);
      return snap.docs.map(d => ({ id: d.id, ...d.data() }));
    } catch (e) {
      logger.error('bookingService.listByArena failed', { arenaId, error: e });
      throw e;
    }
  },

  async create(booking) {
    const ref = await addDoc(collection(db, 'arena_bookings'), {
      ...booking,
      created_at: serverTimestamp(),
      created_at_ms: Date.now(),
    });
    await auditService.createAuditLog({
      action: 'booking_created',
      actor: booking.created_by,
      details: { booking_id: ref.id, ... },
    });
    if (booking.athlete_id) {
      await notifyUsers([booking.athlete_id], { /* ... */ });
    }
    return { id: ref.id, ...booking };
  },

  // ... update, delete, getById
};
```

### 9.2 Regras

- Usar `logger` (não `console`)
- Catch + re-throw com contexto
- `auditService` após mutações relevantes
- `notifyUsers` quando aplicável
- Tratar `null`/`undefined` em leitura
- **NÃO** fazer regra de negócio aqui (vai em `domain/`)

---

## 10. Testes

### 10.1 Vitest (unit)

- 1334+ testes verdes (target)
- Rodar `npm test` (CI) ou `npm run test:watch` (dev)
- Cada arquivo puro de `domain/` **DEVE** ter `*.test.js` ao lado
- Cobrir: happy path, edge cases, inputs inválidos, null/undefined
- Naming: `describe('functionName')` → `it('does X when Y')`

### 10.2 Runtime tests (componentes V2 críticos)

- `*.runtime.test.jsx` em `src/v2/pages/` ou `src/v2/components/`
- Mockar **todos** os hooks (auth, feature flag, react-query)
- Renderizar com dados mockados
- **Clicar em cada tab** (lição sw-v73.5 — V2CourtsTab quebrava)
- Cobre 80% dos "ReferenceError" e "cn is not defined"

### 10.3 Playwright (E2E)

- `npm run e2e` (precisa `npm run e2e:install` antes)
- Auth injetada: criar user via signUp REST + PATCH role via Firestore +
  IndexedDB injection em `firebaseLocalStorageDb` (NÃO `firebase:authUser:...`)
- Lição: bugs que só aparecem logado precisam de E2E com auth

### 10.4 O que NÃO testar

- Wrappers triviais de Firestore (vai pelo E2E)
- Componentes puramente visuais sem lógica (Snapshot test basta)
- Tudo de uma vez (teste focado = suite rápida)

---

## 11. Estilo de código

### 11.1 Lint e format

- ESLint com config do projeto (`npm run lint --quiet` = 0 errors)
- Sem prettier explícito (ESLint + formatação manual)
- 2 espaços de indentação
- Aspas duplas para JSX, aspas simples para JS
- Ponto-e-vírgula no fim de linha
- Arrow functions onde possível

### 11.2 Comentários

- Explicar **POR QUÊ**, não o quê (código já diz o quê)
- JSDoc em funções públicas
- `// TODO:` com nome: `// TODO(fsalamoni): refatorar pra usar feature flag`
- Sem comentários óbvios (`// loop over array`)

### 11.3 Logs

- `logger.info` em fluxos importantes
- `logger.error` em catch de services
- `logger.debug` em dev only
- **NUNCA** `console.log` em código de produção
- **NUNCA** logar PII (email, telefone) sem anonymizar

---

## 12. Dependências

### 12.1 Antes de adicionar

1. Já existe similar? Checar `package.json` (Radix UI, date-fns, lucide...)
2. A lib é mantida? Tem versão recente? TypeScript? Stars? Issues abertas?
3. Bundle size? (importar tree-shakeable, evitar libs "full SDK")
4. Licença compatível (MIT, Apache, BSD)

### 12.2 Adicionando

```bash
npm install <package>
# ou dev:
npm install -D <package>
```

Depois:
- Atualizar `package.json` (automático)
- Documentar em `docs/04-ARCHITECTURE.md` §2 se for infraestrutura
- Checar que **builda** (rodar `npm run build`)
- Checar que **tests passam** (rodar `npm test`)

### 12.3 Evitar

- Lodash (usar ES nativo)
- Moment (usar date-fns)
- Axios (usar fetch nativo)
- UI libs "all-in-one" (usar shadcn primitives + V2)
- Lodash-like utilities (ramda, underscore)

---

## 13. Resumo (cola rápida)

```
FLUXO IDEAL:
1. Lê CLAUDE.md → 01-AI-CONTEXT → README do módulo
2. Planeja (3 passos) — §6 do CLAUDE.md
3. Cria flag + domain + service + hook + UI + test
4. Smoke test local
5. PR + squash merge
6. Deploy sai via GitHub Actions
7. Atualiza docs (01-AI-CONTEXT, 05-DATA-MODEL, 06-MODULES, 15-backlog)
8. Atualiza memory se for lição crítica

NUNCA:
- console.log em services (use logger)
- redirect silencioso em flag off (use FeatureFlagGuard)
- commit direto em main (use PR)
- ícone no JSX sem import (use scripts/validate-lucide-imports)
- lógica em componente (use domain/)
- quebrar coleção existente (use aditivade)
- mutation sem audit_logs (se relevante)
- bundle > 30KB sem lazy load
- text em inglês (use pt-BR)
```

> **Última atualização**: 2026-07-24. Mudou o padrão? Atualize este doc
> **e** o `CLAUDE.md` §5 + a memory do agente.
