# ARCHITECTURE

> Como o código é organizado e por quê. Para o panorama, leia
> `docs/01-AI-CONTEXT.md` primeiro; para os números do que existe hoje
> (rotas, coleções, índices, funções, flags), `docs/46-INVENTARIO.md`
> (gerado — não os repita à mão aqui).

## 1. Visão em camadas

```
src/
├── main.jsx            boot: i18n, PWA, ErrorBoundary global, tela de falha de inicialização
├── App.jsx             providers + rotas públicas e telas "soltas" (telões, totem, impressão)
├── core/               infraestrutura transversal (sem regra de negócio de módulo)
├── modules/<x>/        BASE DE DOMÍNIO: domain · services · hooks · components (· pages legadas)
├── v2/                 o APP: V2App (rotas autenticadas), V2Layout, pages, components, ui
├── pages/              telas públicas V1 que ainda vivem fora do V2 (/p/:id, impressão, telão do torneio, /c/:clubId)
└── components/         primitivos shadcn/Radix (ui/) e poucos diálogos compartilhados
functions/              Cloud Functions (codebase `picklerush`, região southamerica-east1, Node 22)
tests/                  rules (emulador) · e2e (Playwright) · fakes · manual
scripts/                orçamento de pacote, inventário, deploy de funções, segredos, utilitários
```

### 1.1 Dentro de cada módulo (`src/modules/<x>/`)

```
domain/      lógica pura, sem React nem Firebase — sempre com .test.js ao lado
services/    I/O com Firestore (CRUD) + auditoria; sem regra de negócio pesada
hooks/       React Query (useQuery/useMutation) sobre os services
components/  UI específica do módulo
README.md    visão, schema, hooks e fluxos do módulo
```

Regra: a dependência flui só para baixo (`telas → hooks → services → domain`,
e tudo pode usar `core`). Regra de negócio (pontuação, sorteio, ranking,
agendamento, elegibilidade) mora em `domain/` e é testada. A lista de módulos
está em `docs/46-INVENTARIO.md`; o mapa funcional em `docs/06-MODULES.md`.

### 1.1a Fronteiras conferidas no código

Estas regras **não dependem de disciplina**: o guarda
`src/core/guards/fronteirasDeModulos.test.js` reprova no `npm test` (e no CI)
quem as cruzar. O grafo de imports vem de `src/core/guards/grafoDeImports.js`,
a mesma fonte do inventário.

| Regra | Estado em 2026-10-15 |
|---|---|
| Nenhum ciclo de import estático em `src/` | 0 (o único, no sorteio do torneio, foi desfeito em `drawPrimitives.js`) |
| `domain/` não importa Firebase, React, `services/`, `hooks/`, componente nem tela | 0 violações em ~300 arquivos |
| `services/` não importa React, `hooks/` nem componentes | 0 |
| `domain/`, `services/` e `hooks/` de um módulo não importam `src/v2` | 0 |
| `src/core` não importa `src/modules` nem `src/v2` | 1 exceção escrita: `FirebaseAuthContext.jsx` (sincroniza o perfil no login) |
| Tela (`src/v2`) não importa o SDK do Firebase | **8 telas antigas ainda importam** (admin, cadastro da arena, edição do perfil); a lista só diminui — tela nova não entra |

**Módulos podem usar uns aos outros**, e usam: o grafo módulo × módulo está em
`docs/46-INVENTARIO.md` §3.1, com a coluna **"Usado por"** — antes de mudar um
módulo, rode também os testes dos que o usam. Os mais usados são `athletes`,
`tournament`, `games` e `rating`; mexer na API pública deles pede mais cuidado.
O que impede a quebra silenciosa entre módulos são as fontes únicas citadas no
`CLAUDE.md` §4 (uma função para cada regra, nunca cópias), os testes de
paridade cliente × servidor e os guardas de fonte (§6).

### 1.2 `src/core/` — o que há lá

| Pasta | Conteúdo |
|---|---|
| `config/` | `firebase.js` (app, Auth, Firestore nomeado `pickleball`, `firebaseReady`), `owners.js` |
| `lib/` | `FirebaseAuthContext` (`useAuth`), `FeatureFlagsContext` (`useFeatureFlag`), `ThemeContext`, `logger`, `queryState` (`podeAfirmarVazio`), preferências por usuário (`viewPreference`, `collapsePreference`, `useSidebarNav`, `useMyRegion`), `useWakeLock`, `useRelogio`, `useOnline`, `profileValidation` |
| `domain/` | lógica pura transversal: `errorRecovery` (boundary), `bottomNav`, `sidebarNav`, `instant` (datas do banco), `internalLink` (links de aviso), `externalUrl` (`safeHttpUrl`), `region`, `locality`, `ufs`, `desfazer`, `connectivity`, `types.js` (typedefs JSDoc) |
| `services/` | `auditService`, `notificationService`, `observabilityService`, `platformSettingsService`, `pushService`, `storageService`, `webVitals`, `baseService` |
| `i18n/` | `t()`, `tk()`, `tn()`, formatadores, carregador de catálogos (`docs/44-IDIOMAS.md`) |
| `theme/` | `palette.js` (fonte única das cores), `tailwindTheme.js`, `themeDom`, `themePreference` (`docs/30-MODO-ESCURO.md`) |
| `pwa/` | `registerPwa`, `usePwaInstall`, `conviteInstalar` |
| `seo/` | `meta.js`, `useDocumentMeta` |
| `geo/` | mapa de cidades do IBGE (`cidadesBR.data.js`, só por import dinâmico) |
| `guards/` | **guardas de fonte** (ver §6) |
| `featureFlags.js` | `FEATURE_FLAG` (as ligáveis), `PERMANENT_FEATURE` (incorporadas), `featureFlagGroups.js` |

## 2. Estado e dados

- **Servidor**: React Query é a fonte de verdade do dado remoto. O
  `QueryClient` está em `App.jsx`: `staleTime` 2 min, `gcTime` 10 min,
  `refetchOnWindowFocus: false`, `retry: 1`. Mutations invalidam as chaves
  afetadas; chaves de consulta repetidas ficam em módulos de chaves (ex.:
  `modules/arenas/hooks/arenaKeys.js`) — chave escrita à mão diverge sem erro.
- **Falha não é vazio**: consulta que falha não pode virar "não existe nada".
  Telas tratam `isError` (`<V2ErrorState onRetry={refetch}/>`) e só afirmam
  vazio quando `podeAfirmarVazio(consulta)`; `queryFn` nunca engole erro com
  `.catch(() => [])`. Detalhe e guardas: `docs/27-FALHA-NAO-E-VAZIO.md`.
- **Sessão**: `FirebaseAuthContext` (Context) — `useAuth()` (`isAuthenticated`,
  `isLoadingAuth`, `isPlatformAdmin`…). Papéis administrativos e
  "ver como usuário" (`viewAsUser` / `toggleViewAsUser`) também vivem ali.
- **Flags**: `FeatureFlagsProvider` observa `platform_settings/global` e expõe
  o mapa; `useFeatureFlag(key)` lê um booleano. Só as chaves de `FEATURE_FLAG`
  (hoje 5) são ligáveis pelo admin; as incorporadas (`PERMANENT_FEATURE`) valem
  sempre `true`. Ver `docs/02-STANDARDS.md` §3.
- **UI local**: `useState`/`react-hook-form`. Sem Redux/Zustand.
- **Preferência por pessoa, sem banco**: `viewPreference`/`collapsePreference`
  (sempre com o uid na chave — `localStorage` é por navegador). Banco só para
  o que precisa valer em outro aparelho.
- **Realtime**: `onSnapshot` só onde faz sentido (notificações — uma assinatura
  compartilhada em `useNotifications`, chat, visão pública); o resto é fetch +
  invalidação. Assinatura não tem `refetch`: devolva `isError` + `retry`.

## 3. Firebase

- `core/config/firebase.js` inicializa app, Auth e Firestore. **Banco nomeado
  `pickleball`**, nunca o `(default)`.
- **A segurança é a regra**: o cliente fala direto com o banco, então tudo
  vale no `firestore.rules` / `storage.rules` (aditivo; provado no emulador em
  `tests/rules/`). Dado pessoal em coleção de leitura ampla é proibido.
- **Cloud Functions** (`functions/`, codebase próprio `picklerush`, região
  `southamerica-east1`, runtime Node.js 22): ranking/rating recalculados por
  gatilho e recuperação agendada, fila de espera, push, exclusão e unificação
  de contas, mercado. Escrita sensível (ranking, pedidos do mercado, XP
  concedido) é **só do servidor**. A lista atual está em `docs/46-INVENTARIO.md`.
  O projeto Firebase é compartilhado com outro app — ver `docs/03-WORKFLOW.md` §9.1.
- `auditService.createAuditLog` grava `audit_logs` após mutações relevantes;
  `observabilityService` registra page views, erros de cliente e eventos
  (`web_vitals` incluído); `storageService` para uploads.
- `platformSettingsService`: documento único `platform_settings/global`
  (mapa de flags + o que o admin mostra a todos no início).

## 4. Roteamento, boundaries e carregamento

- `react-router-dom` v6 (`BrowserRouter`, `basename = import.meta.env.BASE_URL`).
  `App.jsx` cobre rotas públicas e telas sem layout (telão do dia de jogo, telão
  do torneio, totem da arena, impressão); `V2App.jsx` cobre as autenticadas
  dentro do `V2Layout`.
- **Guards de rota**: `ProtectedRoute` (exige login) e `AdminRoute` (exige
  `platform_admin`), em `App.jsx`. Em DEV sem Firebase, um conjunto de rotas
  é liberado como "local preview".
- **Tudo preguiçoso**: toda página é `React.lazy` + `Suspense`
  (`App.jsx` e ~100 telas em `V2App.jsx`); abas pesadas e diálogos grandes
  também; mapa de cidades, semente do treino e catálogos de idioma só por
  import dinâmico. Libs de compartilhamento ficam num chunk à parte
  (`manualChunks` em `vite.config.js`: `vendor`, `vendor-ui`,
  `vendor-routing-data`, `vendor-markdown`, `vendor-sharing`, e Firebase
  dividido em firestore/auth/functions/core).
- **Orçamento do pacote inicial**: `npm run build:budget`
  (`scripts/check-bundle-size.mjs`) soma, em gzip, o JS/CSS referenciado pelo
  `index.html` e reprova acima do teto (`BUNDLE_BUDGET_KB`, padrão 440 kB). O
  CI roda depois do build. O teto só desce: acrescentou peso, divida com `lazy`.
  Alvo de build: `es2019/chrome64/safari12` (WebViews antigos).
- **Um erro numa tela não derruba o app**: o `ErrorBoundary` global
  (`main.jsx`) fica acima do Router e nunca reseta; por isso toda tela de dia de
  jogo/torneio/promo entra em `<Isolada nome="…">` no `V2App.jsx`, que é o
  `V2RouteBoundary` (cartão de erro no lugar da tela, dentro do layout). Telas
  sem ninguém para clicar (telões) usam `<V2RouteBoundary unattended>`: tentam
  de novo sozinhas com espera crescente e limite (`core/domain/errorRecovery.js`).
  Versão velha depois de deploy (`isChunkLoadError`) pede **Recarregar**, não
  "tentar de novo". Ver `docs/28-ERRO-NAO-DERRUBA-O-APP.md`; guarda
  `telaIsolada.test.js`.
- Falha de inicialização (storage bloqueado, WebView antigo, rede): `main.jsx`
  mostra `BootFailed` com "Tentar de novo", que limpa service workers e caches.

## 5. Apresentação

- **Tailwind + Radix** (shadcn em `src/components/ui/`) + primitivos próprios
  `src/v2/ui/primitives.jsx` (`V2Button`, `V2Surface`, `V2Page`…). Telas novas
  usam os primitivos V2 — catálogo e tokens em `docs/07-DESIGN-STANDARD.md`.
- **Moldura única de página**: `<V2Page>` (1200 px, sem recuo próprio),
  `PAGE_TITLE`/`HERO_TITLE` (`src/v2/ui/pageFrame.js`) — `docs/45-MOLDURA-DAS-PAGINAS.md`.
- **Tema**: a paleta (`core/theme/palette.js`) é a fonte única das cores; o
  modo escuro é um interruptor CSS (`--k`) — a tela não muda
  (`docs/30-MODO-ESCURO.md`). `ThemeProvider` aplica `.dark`; telão, totem e
  impressão ficam claros por `<AparenciaClara>`.
- **Idiomas**: `t('texto em português')` (o português é a chave), `tk()` para
  rótulos em constantes, catálogos em `src/<área>/i18n/locales/{en,es}.js`
  (`docs/44-IDIOMAS.md`). Flag `multi_language`.
- **Layout** (`src/v2/components/V2Layout.jsx`): barra lateral recolhível
  (hubs escolhidos pela pessoa), barra inferior do celular (5 itens, o quarto
  contextual), cabeçalho com busca/paleta Ctrl/⌘+K, sino, idioma e menu do
  usuário, banner offline e convite de instalação.
- Ícones `lucide-react`; datas `date-fns`/`date-fns-tz` (fuso BRT) ou os
  formatadores de `core/i18n`.

## 6. Guardas de fonte (`src/core/guards/`)

Testes Vitest que **leem o código-fonte** e reprovam regressões que teste de
comportamento não vê (cada tela, isolada, funciona; a classe de defeito não).
Exemplos: `fronteirasDeModulos` (§1.1a), `falhaNaoEVazio` (varredura da plataforma toda), `telaIsolada`,
`telaMorta` (componente que ninguém importa a partir de `main.jsx`),
`larguraDePagina`, `dividaDeDesign` (só aceita a contagem DESCER:
`text-gray-400`, `text-[10px]`, `<button>` sem `type`, cartão/campo escrito à
mão), `modoEscuro`, `i18nCatalogos`/`i18nAvisos`, `indicesCompostos`,
`diaDeJogoUniforme`, `deployFunctions`, `deployFirebaseWorkflow`,
`exclusaoCobreColecoes`, `flagsIncorporadas`, `rotasDeModulos`, `dicas`,
`instanteDoBanco`, `cabecalhosSeguranca`. A lista completa é a pasta; ao
encontrar uma classe de defeito nova, **escreva o guarda** em vez de confiar em
quem lembrar.

## 7. PWA e service worker

- Atrás de `VITE_PWA_ENABLED` (só build de produção). Desligada: nenhum SW é
  registrado, qualquer registro anterior é removido e o botão de instalar some.
- `public/sw.js` (versão atual: `VERSION = 'v7'`, cache `picklerush-v7`) usa
  `skipWaiting` + `clients.claim`; ao ativar, apaga caches de outras versões.
  **Bumpar `VERSION` quando o conjunto de assets mudar.** O `registerPwa`
  recarrega uma única vez na troca de controlador.
- `public/firebase-messaging-sw.js` atende o push (FCM); `public/manifest.webmanifest`
  e os ícones vêm de `scripts/generate-pwa-icons.mjs`.
- Cache no hosting (`firebase.json`): assets imutáveis (1 ano); `index.html`,
  `sw.js` e manifest sem cache.

## 8. Medição

`core/services/webVitals.js` (carregado sob demanda) envia LCP, INP e CLS ao
Analytics como evento `web_vitals`, com a rota anonimizada. Sem Analytics
ligado, não faz nada.

**Erros em produção**: `recordClientError` (`observabilityService`, chamado
pelos boundaries) e os ouvintes globais de `core/services/errorReport.js`
(exceção solta, promessa rejeitada, falha da inicialização) mandam o erro para
`POST /api/erro` → função `clientErrorReport` → Google Cloud Error Reporting,
que agrupa, conta e avisa erro novo. O corpo é montado por
`core/domain/errorReport.js` (rota sem ids, ruído de navegador e extensões
fora) e o servidor limpa de novo. Só no site publicado. Ver
`docs/03-WORKFLOW.md` §7.4.

## 9. Testes

| Camada | Onde | Como |
|---|---|---|
| Unitário / domínio | `*.test.js` ao lado do arquivo; `functions/**/*.test.js` | `npm test` (Vitest, jsdom) |
| Componente / tela crítica | `*.runtime.test.jsx` | renderiza com hooks mockados; tree-shaking e imports esquecidos aparecem só em runtime |
| Guardas de fonte | `src/core/guards/*.test.js` | ver §6 |
| Regras do Firestore/Storage | `tests/rules/*.rules.test.js` | `npm run test:rules` (emulador, precisa de Java; config `vitest.rules.config.js`) |
| Paridade cliente × servidor | `*.parity.test.js` (motores de rating, ranking, mercado, avisos) | mexer num lado só quebra o teste, de propósito |
| E2E | `tests/e2e/*.spec.js` | `npm run e2e` (Playwright; Chromium desktop e Pixel 5) no build deste código com Auth e Firestore nos emuladores — no CI em todo PR. Inclui uma conta que entra e abre as telas principais e o axe nas rotas públicas. `npm run e2e:producao` roda as públicas no site no ar (também depois de cada deploy). Ver `docs/03-WORKFLOW.md` §7.2 |

Contagens e arquivos atuais: `docs/46-INVENTARIO.md`.

## 10. CI/CD (resumo — detalhe em `docs/03-WORKFLOW.md`)

- `ci.yml` (push em `main`/`copilot/**` e PRs): segredos no Git
  (`security:secrets`), inventário em dia (`docs:inventario:check`), lint,
  testes, build, orçamento do pacote; job `firestore-rules` (emulador);
  job `e2e` (navegador, emuladores); `dependencias` (informativo); e, só em
  PR, `docs-obrigatorios`.
- `deploy-firebase.yml` (push em `main`): build, regras e índices do Firestore,
  Cloud Functions por nome, regras do Storage e Hosting (`picklerush`); por
  fim abre o site no ar num navegador e confere `/api/erro`.
- `functions-watchdog.yml` (a cada 30 min) recria função apagada; demais
  workflows: backup manual do Firestore, limpeza de e-mails legados,
  GitHub Pages (legado).

## 11. Convenções de código

- Alias `@/` → `src/` (e `@core`, `@modules`). JS + JSDoc (`core/domain/types.js`).
  ⚠️ Os tipos JSDoc são **documentação, não verificação**: `jsconfig.json` tem
  `checkJs: false`, então `npm run typecheck` só confere sintaxe e resolução, e
  não roda no CI. O que segura a correção hoje são os testes (`domain/` sempre
  testado), os guardas de fonte e os testes de paridade. Ligar `checkJs` (ou
  migrar para TypeScript) arquivo a arquivo é a maior dívida técnica conhecida.
- `logger` (`core/lib/logger`) em vez de `console` nos services.
- UI, comentários e mensagens em **pt-BR**, via `t()`/`tk()`.
- Funcionalidade nova nasce atrás de flag (default OFF) — `docs/02-STANDARDS.md` §3.
- Todo ícone `lucide-react` usado no JSX precisa estar no import, e `cn()`
  importado explicitamente (o build passa; o runtime quebra).
- Commits no padrão Conventional Commits.
- **Documentação faz parte da entrega** — `docs/02-STANDARDS.md` §15.
