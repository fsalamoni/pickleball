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
├── main.jsx / App.jsx        # boot, providers, rotas públicas e telas "soltas" (telões, totem, impressão)
├── core/                     # infraestrutura transversal
│   ├── config/               # firebase.js (banco nomeado `pickleball`)
│   ├── lib/                  # auth, flags, tema, logger, queryState, preferências por usuário
│   ├── domain/               # lógica pura transversal + types.js (typedefs JSDoc)
│   ├── services/             # auditService, notificationService, platformSettingsService, webVitals…
│   ├── i18n/ · theme/ · pwa/ · seo/ · geo/
│   ├── guards/               # guardas de fonte (testes que leem o código) — ver §10.5
│   ├── featureFlags.js       # FEATURE_FLAG (ligáveis) e PERMANENT_FEATURE (incorporadas)
│   └── featureFlagGroups.js  # agrupamento no painel do admin
│
├── modules/                  # ⭐ BASE DE DOMÍNIO (lista em docs/46-INVENTARIO.md)
│   └── X/
│       ├── domain/           # lógica pura + .test.js (SEMPRE)
│       ├── services/         # Firestore CRUD + auditoria
│       ├── hooks/            # React Query (useX)
│       ├── components/       # UI específica
│       └── README.md         # visão, schema, hooks, fluxos
│
├── v2/                       # ⭐ APP ATIVO
│   ├── V2App.jsx             # tabela de rotas autenticadas (tudo lazy; telas sensíveis em <Isolada>)
│   ├── components/           # V2Layout, V2RouteBoundary, e uma pasta por área (arenas, tournament, games…)
│   ├── pages/                # V2Xxx.jsx (uma por rota)
│   └── ui/                   # primitives.jsx, pageFrame.js, V2SectionNav, V2CollapsibleCard…
│
├── pages/                    # telas públicas V1 fora do V2 (/p/:id, impressão, telão do torneio, /c/:clubId)
└── components/               # shadcn/Radix (ui/) e diálogos compartilhados
```

Números (páginas, módulos, coleções…) mudam toda semana: consulte
`docs/46-INVENTARIO.md`, que é gerado.

### 1.2 Convenção de camadas (dentro de cada módulo)

```
domain/      lógica pura, sem React nem Firebase — sempre com .test.js
services/    I/O com Firestore (CRUD) + auditoria; sem regra de negócio pesada
hooks/       React Query (useQuery/useMutation) sobre os services
pages/       telas mapeadas a rotas
components/  UI específica do módulo
```

**Regra: dependência flui só para baixo** (`pages → hooks → services → domain`).
Tela nova **nunca** chama Firestore direto (8 telas antigas ainda chamam e
estão numa lista que só diminui). Services **nunca** importam React. Domain
**nunca** importa Firebase, React, services, hooks nem componentes. Import em
círculo é proibido. Tudo isso é conferido pelo guarda
`src/core/guards/fronteirasDeModulos.test.js` — ver `docs/04-ARCHITECTURE.md`
§1.1a. Quem usa o seu módulo: `docs/46-INVENTARIO.md` §3.1.

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
- `npm run typecheck` hoje confere só sintaxe e resolução (`checkJs: false` no `jsconfig.json`): os tipos JSDoc **não** são verificados. Ligar `checkJs` é dívida conhecida (ver `docs/04-ARCHITECTURE.md` §11)

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

- **pt-BR é a língua do código**: comentários, mensagens de erro, audit_logs e o texto-fonte da UI. Todo texto visível passa por `t('Texto em português')` (o português é a chave) ou `tk('…')` para rótulo em constante (e `t(rotulo)` no render); tradução em `src/<área>/i18n/locales/{en,es}.js`; **nunca** `t()` no nível do módulo. Datas/números por `fmtData`/`fmtNumero`/`fmtMoeda`. O que vai para o BANCO segue em português. `i18nCatalogos.test.js` reprova chave sem tradução (`docs/44-IDIOMAS.md`)
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

**Toda nova funcionalidade visível ao usuário nasce atrás de uma flag, default OFF.**

Estado atual (conferido em `src/core/featureFlags.js`):

- `FEATURE_FLAG` — as flags **ligáveis** pelo admin. Hoje são só cinco:
  `dupr_official_sync`, `gameday_mexicano`, `gameday_king_of_court`,
  `marketplace`, `multi_language`.
- `PERMANENT_FEATURE` — as 33 funcionalidades que estavam ligadas em produção
  e foram **incorporadas** em 2026-10-10. Valem sempre `true`, não aparecem no
  painel, e o banco não as desliga (`normalizeFeatureFlags` as força). Chaves
  antigas no documento do banco são ignoradas. Leitura de `PERMANENT_FEATURE`
  fora do catálogo é dívida (ramo morto a apagar) e o guarda só aceita o número
  DESCER (`dividaDeDesign.test.js`). Nenhuma chave pode estar nos dois
  catálogos (`flagsIncorporadas.test.js`).
- Flags não listadas nos catálogos **não existem** — não referencie
  `FEATURE_FLAG.X` sem declarar.

### 3.1 Onde definir

1. `src/core/featureFlags.js` — adicione a chave ao `FEATURE_FLAG`, com um
   comentário em pt-BR dizendo o que liga, o que NÃO muda quando desligada e o
   impacto no banco. Atualize o teste `flagsIncorporadas.test.js` (ele lista as
   chaves esperadas) e o `featureFlags`/`featureFlagGroups` tests.
2. `src/core/featureFlagGroups.js` — coloque no grupo apropriado do painel
   (senão cai em `FLAG_GROUP_OTHER`).
3. `FEATURE_FLAG_META` — rótulo e descrição mostrados ao admin.

### 3.2 Onde o valor mora

No documento único **`platform_settings/global`**, campo `feature_flags` (mapa
`chave → boolean`), lido pelo `FeatureFlagsProvider` por `onSnapshot`
(`platformSettingsService`). Ausente ou não booleano ⇒ `false` (default OFF).
Só o admin da plataforma escreve (a regra de `platform_settings` reforça), e a
mudança gera `audit_logs`. Não existe mais um documento por flag nem
`migrateLegacyFlags`: **default OFF não precisa de migração**. Flag nova que
precise nascer LIGADA para quem já usa exige decisão explícita do dono
(princípio 11 do `CLAUDE.md`) e teste de propriedade provando que desligada nada muda.

### 3.3 Como usar na UI

```jsx
import { useFeatureFlag } from '@/core/lib/FeatureFlagsContext';
import { FEATURE_FLAG } from '@/core/featureFlags';

export default function V2Something() {
  const ativo = useFeatureFlag(FEATURE_FLAG.MULTI_LANGUAGE);
  return ativo ? <NovoBotao /> : null;   // desligada ⇒ a tela é a de sempre
}
```

- Flag desligada: a seção **some** ou a rota **redireciona/explica** — nunca
  renderize desabilitado, e nunca deixe a rota em branco.
- Guia de dicas, artigo da ajuda e pista de rota da funcionalidade levam
  `flags: ['chave']` e só aparecem com a flag ligada (`helpCatalog`).
- Flag de FUNCIONALIDADE vale mesmo para dado já gravado; flag que só tira a
  opção de ESCOLHER nunca tira o que já está gravado (ex.: formatos de dia de jogo).
- O painel do admin mostra a contagem "X ativas de Y" a partir de `countFlags`.

### 3.4 Como ativar para teste local

Logado como `platform_admin`, abra o painel admin → Funcionalidades e ligue a
flag (ou grave `feature_flags.<chave> = true` em `platform_settings/global` no
emulador/console). Atualize a página.

### 3.5 Quando virar permanente

Quando a funcionalidade está ligada e estável, o dono decide incorporá-la: a
chave sai de `FEATURE_FLAG` para `PERMANENT_FEATURE`, os `if` viram dívida a
remover tela a tela, e docs/CLAUDE.md são atualizados.

### 3.6 Navegação (histórico: `NAV_HUBS`)

A navegação em hubs (flag `NAV_HUBS`) foi incorporada. Hoje a barra lateral e a
gaveta mostram os hubs que a **pessoa** escolhe (`core/domain/sidebarNav.js`,
`useSidebarNav`, zero banco), a barra inferior do celular é fixa
(`core/domain/bottomNav.js`) e a barra de abas de cada central é
`V2SectionNav`/`V2SubTabs`. Ver `docs/07-DESIGN-STANDARD.md` §6.

### 3.7 Central de documentos jurídicos (incorporada; era `LEGAL_CENTER`)

> **REGRA**: novos documentos jurídicos **DEVEM** ter versão
> (`version: 'N.M'`). Bump de versão reabre o aceite do usuário.

O usuário vê:
- `/legal` — central com lista de documentos
- `/legal/:docRoute` — página de documento com botão "Li e concordo"
- `LegalConsentGate` no `V2Layout` bloqueia acesso até aceite dos
  essenciais

**Estrutura de documentos** (em `domain/legalDocuments.js`):
- **Essenciais** (aceite bloqueante): Termos de Uso, Política de
  Privacidade (LGPD), Termo de Riscos.
- **Complementares** (informativos): Cookies, Diretrizes, Pagamentos,
  Cancelamento.
- **Por papel** (aceite no fluxo): Organizador, Arena, Professor.

**Coleção `legal_consents`** (id determinístico `{uid}_{docKey}`):
```js
{
  id: `${uid}_${docKey}`,
  uid,
  doc_key,
  version: '1.0',
  accepted_at: serverTimestamp,
  ip_hash: '...',  // opcional, LGPD
}
```

**Regras Firestore**:
- Read público (transparência)
- Write só do próprio `uid`
- Service account (admin SDK) escreve via Cloud Functions

**Bump de versão**: se o `version` aceitado < `version` vigente, o
`LegalConsentGate` reabre o aceite. Não destrói o aceite antigo
(histórico).

### 3.8 Dia de jogo do atleta (incorporado; era `ATHLETE_GAME_DAY`)

> **REGRA**: dia de jogo do atleta **respeita visibilidade**:
> público (aparece em "Procura-se jogo") OU privado (só convidados).
> Publicação no ranking é opt-in por dia (`publish_to_ranking` no
> `game_days/{id}/dates/{dateId}`).

O atleta pode:
- Criar dia de jogo próprio (público ou privado)
- Convidar/inserir qualquer atleta da plataforma
- Reaproveitar o motor `gameDayDraw`/`gameDayFormats` (Americano /
  Mexicano / Rei da Quadra)
- Publicar resultados decididos no ranking geral (espelho em
  `club_event_games`)
- Publicar em ranking de clube quando todos os atletas da partida
  são do mesmo clube (`club_id` resolvido por partida)

**Estrutura de dados** (mesma do dia de jogo de clube):
```
game_days/{id}
  ├─ club_id: null  (ou club_id se for dia de clube)
  ├─ visibility: 'public' | 'private'
  ├─ participants/{uid}
  └─ games/{gameId}  (mesmo schema dos clubes)
```

**Regras Firestore**:
- Read: criador + membros do dia de jogo (se privado) OU público
  (se público)
- Write: criador do dia de jogo
- Publicação: idem + opt-in por `date_id`

## 4. Páginas V2 (Athleisure Premium)

### 4.1 Estrutura padrão de uma página V2

```jsx
// src/v2/pages/V2Xxx.jsx
import { V2Page, V2PageHeader, V2ErrorState, V2EmptyState, V2Skeleton } from '@/v2/ui/primitives';
import { podeAfirmarVazio } from '@/core/lib/queryState';
import { t } from '@/core/i18n';

export default function V2Xxx() {
  const consulta = useXxx();               // hook React Query do módulo
  return (
    <V2Page className="space-y-6">          {/* moldura única: 1200 px, sem recuo próprio */}
      <V2PageHeader title={t('Xxx')} subtitle={t('O que esta tela faz')} />
      {consulta.isLoading && <V2Skeleton lines={4} />}
      {consulta.isError && <V2ErrorState onRetry={consulta.refetch} />}
      {podeAfirmarVazio(consulta) && !consulta.data?.length && (
        <V2EmptyState title={t('Nada por aqui ainda')} />
      )}
      {/* conteúdo */}
    </V2Page>
  );
}
```

- A página inteira vai em `<V2Page>`; **sem** `p-*`/`px-*`/`mt-*` próprios nem
  h1 escrito à mão (`PAGE_TITLE`) — `docs/45-MOLDURA-DAS-PAGINAS.md`.
- Funcionalidade atrás de flag: `useFeatureFlag` e, desligada, explicar ou
  redirecionar (§3.3). Não existe `FeatureFlagGuard` nem `V2Shell`.
- Carregando, erro e vazio sempre tratados; vazio só com `podeAfirmarVazio`.
- Texto sempre em `t()` (§2.2). Tela de dia de jogo, torneio ou promoção entra
  em `<Isolada nome="…">` no `V2App.jsx` (§4.2).
- Subcomponentes pesados em `lazy` com `<Suspense>` só em volta da área que muda.

### 4.2 Rotas

- Tabela em `src/v2/V2App.jsx` (autenticadas) ou `App.jsx` (públicas/sem layout).
- Toda página é `React.lazy` + `Suspense`; `basename = import.meta.env.BASE_URL`.
- Rota autenticada dentro do `V2Layout`; exigir admin da plataforma usa `AdminRoute`.
- **Tela de dia de jogo, torneio ou promoção** (e qualquer tela que possa quebrar
  por dado inesperado) entra em `<Isolada nome="…">`: um erro vira cartão no
  lugar da tela, não "Algo deu errado" no app inteiro. Telão/totem usam
  `<V2RouteBoundary unattended>`. Guarda: `telaIsolada.test.js`.
- Telão, totem e impressão ficam claros: `<AparenciaClara>` na rota.
- Rota nova com ajuda: pista em `HELP_ROUTE_HINTS` e artigos que a citam; rota de
  módulo de arena segue o catálogo (`rotasDeModulos.test.js`).

```jsx
const V2MyFeature = lazy(() => import('@/v2/pages/V2MyFeature'));
<Route path="/minha-feature" element={<Isolada nome="minha-feature"><V2MyFeature /></Isolada>} />
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
vi.mock('@/modules/arenas/hooks/useArenas', () => ({
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

Use `src/v2/ui/primitives.jsx` (lista completa e variantes em
`docs/07-DESIGN-STANDARD.md` §3): `V2Page`, `V2PageHeader`, `V2Surface`
(`variant` padrao/compacto/plano), `V2Button`, `V2Badge`, `V2Field`/`V2Input`/
`V2Textarea`/`V2Select`/`V2Toggle`, `V2EmptyState`, `V2ErrorState`, `V2Skeleton`,
`V2FilterChip`, `V2SearchInput`, `V2StatCard`… e, em `src/v2/ui/`,
`V2CollapsibleCard`, `V2SectionNav`/`V2SubTabs`, `V2Pagination`, `CopyCodeButton`.
Diálogos usam Radix (`src/components/ui/dialog.jsx`) e `ConfirmDialog`.

**Não** escreva à mão o que já tem primitivo (cartão, campo, botão, bloco de
erro, "voltar", código copiável): `dividaDeDesign.test.js` e as demais guardas
contam e só aceitam o número descer. Cor só pela paleta (§4.6); texto secundário
`text-gray-500`; fonte ≥ 11 px; `<button>` sempre com `type`.

### 4.5 Navegação de seções

Barras de seções/abas de uma central são `V2SectionNav` (seções, com `grupos`)
e `V2SubTabs` (abas); **quebram em linhas, nunca rolam de lado**. A aba ativa
vive na URL (`?aba=`/`?secao=`) e o valor é contrato de link — nunca renomeie.
Âncoras de seção (`id="arena-…"`) também são contrato.

### 4.6 Cor e modo escuro

Escreva `bg-white`/`text-gray-500`/`border-gray-100`/`bg-ink` como sempre: a
paleta (`core/theme/palette.js`) decide a cor nos dois modos. Cor arbitrária
(`bg-[#…]`, `style`) não troca; **nunca** `dark:` para cor. Ver
`docs/30-MODO-ESCURO.md` e `docs/07-DESIGN-STANDARD.md` §7.

---

## 5. Firestore (schema + services + rules)

### 5.1 Aditivividade — REGRA INEGOCIÁVEL

**Nunca quebrar uma coleção existente.** Novas coleções, novos campos
opcionais, novas regras (aditivas). Migração sempre via script idempotente
(flag nova com default OFF não precisa de migração — §3.2).

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


### 5.3.1 court_id é OBRIGATÓRIO em `arena_bookings` (PR #75)

Desde o PR #75, TODA reserva deve ter `court_id` setado. O service
`createBooking` PERSISTE o `court_id` (antes era perdido!) e, se o user
não escolhe quadra, chama `pickAvailableCourt` para auto-atribuir.

NUNCA criar reserva sem `court_id`. Se `pickAvailableCourt` retorna
null, o service **erra** com mensagem clara — sem fallback silencioso.

### 5.3.2 Padrão "query simples + filtro/ordenação em memória" (PRs #82, #84)

Quando uma query Firestore precisa de **índice composto** (ex.:
`where('arena_id', '==', X), where('active', '==', true), orderBy('name')`)
e o índice **falta ou dá problema**, use o padrão abaixo em vez de criar
índice:

```js
// ❌ ANTES — quebra sem índice composto
const q = query(collection(db, 'x'),
  where('arena_id', '==', arenaId),
  where('active', '==', true),
  orderBy('name', 'asc'));

// ✅ DEPOIS — query simples + filtro/ordenação em memória
const snap = await getDocs(query(collection(db, 'x'),
  where('arena_id', '==', arenaId)));
let list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
if (activeOnly) list = list.filter((p) => p.active !== false);
return list.sort((a, b) => String(a.name || '').localeCompare(String(b.name || '')));
```

**Quando usar**:
- Coleção ≤ 500 docs por filtro principal (caso típico por arena)
- Performance não é crítica (< 1s aceitável)
- Índice composto está dando problema

**Quando NÃO usar**:
- Coleção com > 1000 docs por filtro (usar paginação server-side)
- Filtro é numérico/range em campo não-indexed

**Aplicado em** (no momento):
- `listCoaches` (`modules/coaches/services/coachService.js`)
- `listInventoryProducts/Entries/Exits` (`modules/arenas/services/arenaService.js`)
- PDV produtos, membros, pacotes

### 5.3.3 `coach_favorites/{uid_coachId}` (Wave B)

Curtir professor (mesmo padrão de `arena_favorites/{uid_arenaId}`).
Id determinístico; regras: read/create/delete só pelo próprio uid.

```js
// firestore.rules
match /coach_favorites/{favId} {
  allow read: if isAuthed() && request.auth.uid == favId.split('_')[0];
  allow create: if isAuthed()
    && request.auth.uid == favId.split('_')[0]
    && request.resource.data.user_id == request.auth.uid
    && request.resource.data.coach_id == favId.split('_')[1];
  allow delete: if isAuthed() && request.auth.uid == favId.split('_')[0];
}
```

Service: `favoriteCoach / unfavoriteCoach / listMyFavoriteCoaches` em
`src/modules/coaches/services/coachService.js`. Hook: `useToggleFavoriteCoach`.
Componente: `V2FavoriteCoachButton` (Heart) em
`src/v2/components/coach/V2CoachActions.jsx`.

### 5.3.4 `club_event_games/{eventId_dateId_gameId}` (Wave C)

Lançamento de resultados de dias de jogo no ranking nacional.
Id determinístico = `${eventId}_${dateId}_${gameId}` (mesma forma usada
em `clubEventGames` constants). Lançar é **opt-in**: o criador do
evento OU um admin do clube liga a chave `publish_to_ranking` no dia
de jogo. Por padrão a chave está **desligada** (não lança nada).

**Garantias de design:**
- Apenas jogos DECIDIDOS (`score_a != null && score_b != null && score_a != score_b`) são publicados.
- Apenas jogadores com `user_id` válido (não guests) entram no ranking.
- Idempotência: rodar a publicação várias vezes não duplica; jogos
  removidos do dia de jogo também são removidos do ranking.
- Singles (1×1) e doubles (2×2) suportados; outros tamanhos pulados.
- Ao despublicar, os jogos saem do ranking e o `recomputeAllRatings` é
  acionado.
- Schema espelha `tournament_matches` (lado A/B, winner, sets, status)
  + campos `source='club_event_game'`, `event_id`, `date_id`, `club_id`,
  `event_title`, `game_id`, `published_by`.

**Regras Firestore (resumo):**
```js
match /club_event_games/{gameId} {
  allow read: if true;
  allow create, update, delete: if isAuthed() && (
    isPlatformAdmin()
    || isClubEventCreator(request.resource.data.event_id)
    || isClubAdmin(request.resource.data.club_id)
  );
  // event_id/date_id/club_id imutáveis após criação.
}
```

**Quem pode ligar/desligar a chave:**
- Criador do evento (`club_events/{id}.created_by == auth.uid`)
- Admin do clube (`club_members/{clubId_uid}.role == 'admin'`)
- Admin da plataforma

**Service:** `rankingPublishingService.publishEventDateToRanking /
unpublishEventDateFromRanking` em
`src/modules/clubs/services/rankingPublishingService.js`.

**Domínio puro:** `buildPublishableMatch / buildPublishableMatches` em
`src/modules/clubs/domain/rankingPublishing.js` (19 testes unitários).

**Hooks:** `useEventDateRankingMeta`, `usePublishEventDateToRanking`,
`useUnpublishEventDateFromRanking`, `usePublishedGamesForDate` em
`src/modules/clubs/hooks/useClubs.js`.

**UI:** `PublishToRankingToggle` em
`src/modules/clubs/components/PublishToRankingToggle.jsx` (switch com
tooltip, botão "Republicar" idempotente, ConfirmDialog para despublicar,
resumo de jogos decididos/eligíveis). Renderizado **dentro do
`GameDayOrganizer`** (mesma seção da organização de jogos), logo
após a lista de jogos do dia. `canManage` é computado pelo
`GameDayOrganizer` (`useAuth` + `useMyMembership` +
`event.created_by`).

### 5.3.5 `useClubInternalRanking` (Wave C.2 — ranking do clube)

Ranking interno do clube (Individual + Duplas) com agregação
opcional de fontes externas (torneios + dias de jogo de outros
clubes).

**Composição:**
- `fetchClubInternalRankingSources(clubId, { includeExternal })`
  coleta as 3 fontes em paralelo:
  1. **Jogos do próprio clube** (`club_events/{id}/.../games`)
  2. **`club_event_games`** do próprio clube
  3. **Fontes externas** (só se `includeExternal=true`):
     - `club_event_games` de outros clubes (filtrado pelos uids
       do clube via `array-contains-any` chunked em 30).
     - `tournament_matches` finalizados (idem).
- `normalizeAllSources` (puro) padroniza os matches de
  formatos diferentes (`side_a_ids`/`side_b_ids` ou objetos).
- `filterMatchesForClub` (puro) mantém só os matches que
  envolvem pelo menos um uid do clube; flags `includeClub`/
  `includeExternal` controlam quais fontes entram.
- `computeClubRanking` (individual) + `computeDoublesRanking`
  (duplas, reusado do ranking nacional) derivam as tabelas.

**Permissões do toggle "Incluir externos":**
- **SÓ** o criador do evento OU admin do clube liga/desliga.
- Default: OFF (escopo só do clube).

**Sem mudança em `firestore.rules`**: o ranking é read-only.
Apenas a leitura de `tournament_matches` e `club_event_games`
(que já são públicos ou controlados pelas regras existentes).

**Sub-abas (UI):**
- `Individual` (sempre visível)
- `Duplas` (só se `CLUB_INTERNAL_DOUBLES_RANKING` ON)
- Subcomponentes: `IndividualRankingTable`, `DoublesRankingTable`,
  `ExternalToggle`, `PairMembers`.

### 5.3.6 Ranking interno do clube MATERIALIZADO (Wave C.3)

Todos os cálculos de ranking do clube são feitos **no servidor** via
Cloud Function (`functions/clubRanking.js` →
`recomputeClubInternalRankings`). O frontend apenas **LÊ** o
materializado. Toggle "Incluir resultados externos" = ler da coleção
`_ext` em vez da interna — sem recalcular.

**Por que materializar?**
- Sem latência: ranking abre instantaneamente, mesmo com 10k+ jogos.
- Múltiplos users: a leitura é servida do mesmo materializado, sem
  custo de CPU cliente.
- Coerência: o ranking nunca está inconsistente com os dados;
  recalcula automaticamente em qualquer mudança.

**Coleções materializadas (4):**
- `club_internal_ratings/{clubId_userId}` — individual, só clube
- `club_internal_ratings_ext/{clubId_userId}` — individual, com externos
- `club_internal_doubles_ratings/{clubId_pairKey}` — duplas, só clube
- `club_internal_doubles_ratings_ext/{clubId_pairKey}` — duplas, com externos

**Schema (todas as 4 coleções):**
- `id = ${clubId}_${userId|pairKey}`
- `club_id`, `user_id`/`pair_key`/`player_ids[]`
- `display_name`, `photo_url` (denormalizados — resolve o bug do uid)
- `games, wins, losses, points_for, points_against, points_balance, win_rate`
- `scope: 'internal' | 'ext'`
- `updated_at` (serverTimestamp)

**Gatilhos (5 onDocumentWritten) — `functions/index.js`:**
1. `recomputeClubRankingOnClubGame`: `club_events/{id}/games/{id}`
2. `recomputeClubRankingOnClubEventGame`: `club_event_games/{id}`
   (afeta dono + clubes dos uids externos)
3. `recomputeClubRankingOnTournamentMatch`: `tournament_matches/{id}`
   (resolve registration → uids → clubes via `athlete_profiles.club_ids`)
4. `recomputeClubRankingOnMemberChange`: `club_members/{id}`
5. `recomputeClubRankingOnAthleteProfileChange`: `athlete_profiles/{id}`

**Callable (admin):**
- `recomputeAllClubInternalRankings({})` — só `platform_admin`
- `recomputeOneClubInternalRanking({ clubId })` — admin do clube ou
  `platform_admin`

**Regras Firestore:**
```js
match /club_internal_ratings/{docId} {
  allow read: if true;
  allow write: if isAuthed() && (
    isPlatformAdmin()
    || (resource != null && isClubAdmin(resource.data.club_id))
    || (request.resource != null && isClubAdmin(request.resource.data.club_id))
  );
}
// (mesma estrutura para _ext, _doubles_, _doubles_ext)
```

**Pipeline server-side (`recomputeClubInternalRankings`):**
1. Carrega `club_members` + `athlete_profiles` (chunked 30) +
   `club_events` (com subcoleção `games`).
2. Carrega `club_event_games` do próprio clube + de outros
   clubes (chunked 30) + `tournament_matches` finalizados
   (chunked 30).
3. Resolve registrations → uids (chunked 30).
4. Normaliza cada match (4 normalizadores puros).
5. Aplica `applyToIndividual` + `applyToDoubles` para o escopo
   `internal` (só clube) e `ext` (interno + externo).
6. Enriquece com `display_name`/`photo_url` via profiles.
7. Ordena (`sortIndividual`/`sortDoubles`).
8. Escreve materializado em batch (substitui o conjunto anterior;
   remove documentos de atletas que saíram).

**Frontend (`useClubInternalRanking`):**
- Lê `club_internal_ratings` (ou `_ext` se `includeExternal=true`)
  com `where('club_id', '==', clubId), orderBy('wins', 'desc')`.
- Lê `club_internal_doubles_ratings` (ou `_ext`).
- Resolve profiles defensivos para nomes/fotos que faltarem
  no materializado.
- Sem cálculo. Toggle = trocar coleção. Cache 30s.

### 5.3.7 Índices compostos para coleções materializadas (Wave C.6.1)

> **REGRA**: toda coleção materializada que tem query com
> `where` + `orderBy` em campos diferentes PRECISA de **índice
> composto** declarado em `firestore.indexes.json`. Sem o
> índice, o Firestore lança `FAILED_PRECONDITION` (código 9) e a
> UI mostra vazio mesmo com o materializado populado.

**Quando adicionar índice composto:**
- Toda nova query `where(X, '==', val) + orderBy(Y, 'desc'|'asc')`
  onde `X !== Y`.
- Toda query `where(X, 'in', [...]) + orderBy(Y, ...)`.

**Onde declarar:**

```json
// firestore.indexes.json
{
  "indexes": [
    {
      "collectionGroup": "club_internal_ratings",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "club_id", "order": "ASCENDING" },
        { "fieldPath": "wins", "order": "DESCENDING" }
      ]
    }
  ]
}
```

**Como o deploy acontece:**
- O workflow `deploy-firebase.yml` tem passo "Deploy Firestore
  rules and indexes" que aplica o JSON automaticamente no push
  para main.
- O índice leva ~1-2 min para propagar no Firestore.

**Como diagnosticar falha de índice:**
- No console do browser: `Failed to load resource: ... 400 FAILED_PRECONDITION`
- O link no erro aponta para o Firebase Console onde você pode
  criar o índice manualmente (mas isso é só para DEV — em prod,
  o índice deve estar no `firestore.indexes.json`).

**Exemplo real (Wave C.6.1)**: 4 coleções materializadas
(`club_internal_ratings`, `club_internal_ratings_ext`,
`club_internal_doubles_ratings`, `club_internal_doubles_ratings_ext`)
precisavam do mesmo índice (ASC club_id + DESC wins). A Wave C.3
introduziu o materializado mas esqueceu de criar os índices. Bug
ficou latente até a Wave C.6.1.

**Convenção de comentário no hook:** hooks que fazem query com
`where + orderBy` devem ter um comentário no topo explicando
o requisito do índice composto:

```js
/**
 * IMPORTANTE: a query `where('club_id', '==', x) + orderBy('wins', 'desc')`
 * exige índice composto em `firestore.indexes.json`. Sem o índice,
 * o Firestore lança `failed-precondition` (código 9).
 */
```

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
// src/v2/components/arenas/V2BookingRow.jsx
import { Calendar } from 'lucide-react';                 // ⬅️ SEMPRE importar tudo que usa
import { V2Surface, V2Badge, V2Button } from '@/v2/ui/primitives';
import { cn } from '@/core/lib/utils';
import { t, fmtData } from '@/core/i18n';

export function V2BookingRow({ booking, onCancel, className }) {
  return (
    <V2Surface variant="compacto" className={cn(className)}>
      <div className="flex items-center gap-2">
        <Calendar className="h-4 w-4" aria-hidden="true" />
        <span>{fmtData(booking.date)}</span>
        <V2Badge tone={booking.status === 'confirmed' ? 'green' : 'amber'}>
          {t(booking.status === 'confirmed' ? 'Confirmada' : 'Pendente')}
        </V2Badge>
      </div>
      <V2Button variant="ghost" onClick={onCancel}>{t('Cancelar')}</V2Button>
    </V2Surface>
  );
}
```

Não ponha margem vertical própria no componente que entra num módulo
composto (o container espaça); data na tela por `fmtData`/`formatSlotLabel`,
nunca a ISO crua.

### 7.2 Imports de ícones (LIÇÃO sw-v72.5 + sw-v73.4)

**SEMPRE** adicione o ícone ao import de `lucide-react` quando usar no JSX.
O build passa, mas o runtime quebra se você esquecer — por isso componente
crítico tem `*.runtime.test.jsx`. Ícone sem texto vizinho leva `aria-label`
(ou `aria-hidden` se decorativo).

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

### 7.5.1 V2Surface colapsável (PR #83)

`V2Surface` ganhou modo `collapsible` (retrocompatível). Quando o
componente é usado como seção de dados, prefira a versão colapsável
com `V2CollapsibleSection`:

```jsx
// Modo legado (não muda)
<V2Surface className="p-6">...</V2Surface>

// Modo colapsável
<V2CollapsibleSection
  title="Dados pessoais"
  eyebrow="Perfil"
  description="Edite suas informações"
  defaultCollapsed={false}
  collapseId="profile-pessoal"  {/* localStorage key */}
>
  ...
</V2CollapsibleSection>
```

- Estado é lembrado por seção via localStorage (`collapseId` ou título)
- Chevron importado de `lucide-react`
- Use em toda seção interna de dados — **nunca em heroes**
- Aplicado em: Meu perfil, Professores, Circuitos, Clubes, Arena pública

### 7.5 Confirmação de ações destrutivas (LIÇÃO sw-v73.3)

**NUNCA** `confirm()` nativo. Use o `ConfirmDialog` controlado
(`@/components/ui/confirm-dialog`) ou o de gatilho (`@/components/ConfirmDialog`,
para botões de lista). Para ação que dá para desfazer, prefira `useDesfazivel`
(toast com "Desfazer") a pedir confirmação — confirmação demais treina a
clicar em "sim" sem ler.

```jsx
import { ConfirmDialog } from '@/components/ui/confirm-dialog';

<ConfirmDialog
  open={open}
  onOpenChange={setOpen}
  title={t('Cancelar reserva?')}
  description={t('Esta ação não pode ser desfeita.')}
  confirmLabel={t('Sim, cancelar')}
  onConfirm={handleCancel}
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

Cada módulo concentra suas chaves num arquivo (ex.:
`modules/arenas/hooks/arenaKeys.js`); **nunca** escreva `queryKey` à mão numa
tela. A pré-busca e o hook têm de bater bit a bit, e chave divergente não dá
erro — só busca de novo o que estava em cache.

```js
export const arenaKeys = {
  bookings: (arenaId) => ['arenaBookings', arenaId],
  // ...
};
```

**Sempre** invalidar todas as chaves relacionadas após mutação. `queryFn`
nunca engole erro (`.catch(() => [])`): o erro vira vazio que parece resposta
— use `Promise.allSettled` e marque a parte que falhou (`docs/27-FALHA-NAO-E-VAZIO.md`).

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

- `npm test` (CI) ou `npm run test:watch`; jsdom; `functions/**` também roda.
  Contagem atual: `docs/46-INVENTARIO.md` (não repita número aqui).
- Cada arquivo puro de `domain/` **DEVE** ter `*.test.js` ao lado.
- Cobrir: caminho feliz, bordas, entradas inválidas, `null`/`undefined`.
- Data lida do banco em teste usa `Timestamp` de verdade (`firebase/firestore`),
  não número — número é o que o código GRAVA, não o que o banco devolve.
- Teste de storage/preferência: espione `Storage.prototype` (no jsdom,
  `vi.spyOn(window.localStorage, …)` não troca o método).

### 10.2 Runtime tests (componentes V2 críticos)

- `*.runtime.test.jsx` ao lado da tela/componente.
- Mockar **todos** os hooks (auth, flags, react-query) e renderizar com dados.
- Clicar em cada aba (V2CourtsTab já quebrou por isso). Cobre os "ReferenceError".
- Teste de error boundary: controle a falha **de fora** (objeto mutável); um
  componente que "se cura" na segunda renderização não serve (o React
  re-renderiza uma vez antes do fallback).
- Teste de consulta com conta que NÃO é admin: `isPlatformAdmin()` na regra
  esconde consulta mal filtrada.

### 10.3 Regras no emulador

`tests/rules/*.rules.test.js`, `npm run test:rules` (Java + emulador de
Firestore/Storage; config `vitest.rules.config.js`, Node, sem paralelismo).
**Toda** regra nova ou alterada tem asserção do que passou a funcionar e do que
continua barrado. Serviço com banco falso não pega regra: o falso nunca recusa.

### 10.4 Playwright (E2E)

`npm run e2e` (antes, `npm run e2e:install`). Roda contra `E2E_BASE_URL`
(padrão: produção) em Chromium desktop e Pixel 5. Hoje cobre rotas públicas e
acessibilidade com axe (`serious`/`critical` barram). Bug que só aparece logado
precisa de E2E com auth injetada (IndexedDB `firebaseLocalStorageDb`).
O CI **não** roda E2E.

### 10.5 Guardas de fonte

`src/core/guards/*.test.js` leem o código-fonte e reprovam classes de defeito
(falha-vira-vazio, tela sem isolamento, largura de página, dívida de design,
tela morta, índice composto ausente, i18n sem catálogo, deploy de funções,
coleção fora da exclusão de conta…). Regras:

- Antes de fechar uma tarefa, rode os guardas do assunto
  (`npx vitest run src/core/guards`) — eles são o jeito de a base se defender.
- Descobriu uma **classe** de defeito? Escreva o guarda; não confie em quem lembrar.
- Isenção de guarda exige motivo escrito; contador de dívida só pode DESCER.
- Para consulta que "voltou vazia": `npx vitest run src/core/guards/indicesCompostos.test.js`.

### 10.6 O que NÃO testar

- Wrappers triviais de Firestore (a regra e o E2E cobrem).
- Componentes puramente visuais sem lógica.
- Tudo de uma vez — teste focado mantém a suíte rápida.

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
- Documentar em `docs/04-ARCHITECTURE.md` se for infraestrutura
- Conferir o orçamento do pacote inicial (`npm run build && npm run build:budget`)
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
3. Cria flag (default OFF) + domain + service + hook + UI + testes
4. Smoke test local; lint, test, build, build:budget
5. ATUALIZA OS DOCS (§15) e roda npm run docs:inventario
6. PR + squash merge → deploy sai via GitHub Actions

NUNCA:
- console.log em services (use logger)
- flag sem declarar em featureFlags.js; tela desabilitada em vez de oculta
- commit direto em main (use PR)
- ícone no JSX sem import; cn sem import
- lógica de negócio em componente (use domain/)
- quebrar coleção existente (aditividade)
- mutation sem audit_logs (se relevante)
- bundle inicial acima do teto (lazy)
- texto fora de t()/tk(); 'pt-BR' fixo; cor arbitrária; dark: para cor
- `.catch(() => [])` em queryFn; afirmar "vazio" sem podeAfirmarVazio
- PR de código sem tocar em docs (o CI reprova)
```

## 14. "Ver como usuário" (debug)

Toggle no header (visível só para `platform_admin`). Quando ativo:
- `useAuth().isPlatformAdmin` retorna `false`
- o app se comporta como usuário comum

Útil para depurar a UX sem fazer logout. Lógica: `core/lib/FirebaseAuthContext.jsx`
mantém o estado `impersonate`, e `isPlatformAdmin = role === 'platform_admin' && !impersonate`.

## 15. Documentação é parte da entrega

Código sem documentação não está pronto. Em **toda** implementação (feature,
correção de comportamento, mudança de regra, rota, coleção, índice, flag, função):

1. **Doc do assunto**: atualize (ou crie) o `docs/NN-*.md` que explica o
   assunto — o *porquê* e as regras que não podem regredir, não só o *como*.
2. **README do módulo**: `src/modules/<x>/README.md` se mudou schema, hooks,
   fluxos ou regras do módulo.
3. **`CLAUDE.md`**: quando muda o mapa "onde está X" (§4), um princípio (§2) ou
   uma regra que quem vier depois precisa saber antes de mexer.
4. **Docs de apoio** quando couber: `05-DATA-MODEL` (schema), `06-MODULES`
   (módulo/rota), `01-AI-CONTEXT` (panorama), backlog.
5. **Ajuda ao usuário**: artigo, guia de dicas e pista de rota (`helpCenter`,
   `guias`, `HELP_ROUTE_HINTS`) se a tela ou regra visível mudou — ajuda
   desatualizada é pior que nenhuma.
6. **Rode `npm run docs:inventario`** e comite `docs/46-INVENTARIO.md` (arquivo
   **gerado** por `scripts/gen-inventario.mjs`: rotas, coleções, regras, índices,
   funções, flags, módulos). Nunca o edite à mão. `npm run docs:inventario:check`
   verifica sem gravar.

**O que o CI cobra** (`.github/workflows/ci.yml`):

- Passo `npm run docs:inventario:check`: reprova se o inventário não bate com o código.
- Job `docs-obrigatorios` (só em PR, `scripts/check-docs-updated.mjs`): reprova
  o PR que muda código de produto (`src/` exceto testes, `functions/`,
  `firestore.rules`, `storage.rules`, `firestore.indexes.json`, `firebase.json`,
  `.github/workflows/`) sem tocar em nenhum doc (`docs/`, `CLAUDE.md`,
  `AGENTS.md`, `README.md`, README de módulo, `functions/README.md`).
- Saída honesta, só quando de fato nada muda para quem lê a documentação
  (refator interno, ajuste de teste): escreva no corpo do PR a linha
  `Docs: não se aplica — <motivo>` (o motivo é obrigatório e não pode ser
  genérico). Não use a isenção para fugir do passo 1.

> **Última atualização**: 2026-10-15. Mudou o padrão? Atualize este doc
> **e** o `CLAUDE.md` §5 e §2.
