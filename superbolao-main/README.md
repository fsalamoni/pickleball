# Bolão Copa 2026

- Produção: `https://superbolao.web.app`
- Projeto Firebase: `hocapp-44760`
- Firestore database: `bolao2026`
- Hosting target: `superbolao`

SaaS multi-tenant para bolões da Copa do Mundo FIFA 2026, com bolões privados por convite, calendário oficial, palpites por jogo, palpites especiais, ranking em tempo real e apuração automática.

## Stack

- **Vite + React 18** — SPA com rotas públicas, autenticadas e Admin Geral.
- **Firebase** — Auth Google, Firestore named database, Cloud Functions Gen2, Hosting e Scheduler.
- **Tailwind CSS + shadcn/ui** — tokens visuais, componentes base e direção visual Arena Copa.
- **TanStack React Query** — cache local de leituras com `staleTime: 30_000`.
- **React.lazy + Vite manualChunks** — code splitting por rota, `vendor` e chunks `vendor-firebase-*` por domínio.
- **Firebase Analytics/Performance opt-in** — page views sanitizados, captura de erros e performance quando habilitado por env.
- **Vitest + Playwright** — testes unitários da engine e smoke E2E público/autenticado.

## Estrutura

```text
src/
  App.jsx                    # Rotas, lazy loading, QueryClient e providers
  core/
    config/firebase.js        # Init Firebase; Firestore database bolao2026
    domain/                   # Engine pura de pontuação + testes
    lib/                      # Auth context, logger, utils e validações globais
    services/                 # Serviços core/base
  components/
    Layout.jsx                # Sidebar, topbar, notificações e shell público legal
    legal-page.jsx            # Wrapper compartilhado de Regras/Política
    ui/                       # Componentes shadcn-style
  modules/
    admin/                    # Admin Geral: solicitações, jogos, métricas, bolões, seed
    bets/                     # Hooks/services de palpites
    notifications/            # Hooks/services de notificações
    pool/                     # Bolões, dashboard, cartão, calendário, ranking e admin do bolão
    scoring/                  # Serviços/hooks de pontuação e ranking
    tournament/               # Dados seed, hooks, services e utilitários do torneio
  pages/
    Landing.jsx, Login.jsx, Profile.jsx
    PublicRules.jsx, PrivacyPolicy.jsx, ResponsibleGaming.jsx

functions/
  src/
    index.ts                  # Exporta Cloud Functions
    firestore.ts              # Admin SDK no database bolao2026
    runtimeOptions.ts         # Região/runtime/service account
    scoringEngine.ts          # Engine TS sincronizada com frontend
    processMatchScoring.ts    # Recalcula pontos ao finalizar jogos
    revealBetsForStage.ts     # Reveal automático de palpites por fase
    notifyPendingBets.ts      # Notificações de prazos pendentes
    seedTournament.ts         # Seed do torneio
    setSpecialBetResults.ts   # Admin: campeão/artilheiro
    syncFifaResults.ts        # Admin: sincronização FIFA

docs/                         # Arquitetura, roadmap, plano, indexação e caching
firestore.rules
firestore.indexes.json
firebase.json
```

## Modelo de Isolamento

| Camada | Mecanismo |
|---|---|
| Plataforma | Firestore named database `bolao2026` dentro do projeto `hocapp-44760` |
| Usuário | Security Rules filtram dados por `request.auth.uid` |
| Bolão | `pool_memberships` controla acesso; dados usam `pool_id` |
| Sigilo dos palpites | `bets.revealed` começa `false`; antes do reveal só o dono lê o próprio palpite |
| Admin | Admin Geral gerencia estrutura, placares, zebras, métricas e auditoria sem ler palpites sigilosos antes do reveal |

## Engine de Pontuação

- 6 níveis de acerto: bucha, vencedor + diferença, vencedor + gols de um time, apenas vencedor, apenas gols de um time, pênaltis.
- Multiplicador de zebra 2x/3x/4x quando o usuário palpita na zebra e ela vence ou avança nos pênaltis.
- Pontos extras por pênaltis só entram quando o jogo realmente tiver decisão por pênaltis oficial registrada.
- Super Bucha como critério de desempate: bucha + pênaltis, bucha + zebra, ou acerto do campeão.
- Default `0x0` para jogos sem palpite.
- Desempates do ranking geral: pontos, buchas, super buchas, posição na 1ª fase.

A engine é mantida em JS no frontend e TS nas Functions, com testes espelhados.

## Desenvolvimento

```bash
npm install
cd functions && npm install && cd ..

npm run dev
```

Para emuladores Firebase:

```bash
firebase emulators:start
```

Observabilidade frontend é opcional e fica desligada por padrão. Para habilitar no Hosting, configure `VITE_FIREBASE_MEASUREMENT_ID`, `VITE_ENABLE_FIREBASE_ANALYTICS=true` e/ou `VITE_ENABLE_FIREBASE_PERFORMANCE=true` antes do build.

## Validação

Antes de publicar mudanças, rode no mínimo:

```bash
npm run lint
npm test
npm run typecheck
npm run build
git diff --check
```

Smoke E2E público de produção:

```bash
# Primeira execução na máquina
npm run e2e:install

# Valida rotas públicas, chunks lazy e overflow desktop/mobile
npm run e2e:public
```

Smoke E2E autenticado com dados reais:

```bash
# Opção automática via Firebase Admin custom token.
# Requer gcloud/ADC com roles/iam.serviceAccountTokenCreator no projeto.
npm run e2e:auth:admin

# Alternativa manual: abre o navegador para login Google e salva a sessão.
npm run e2e:auth:save

# Informe um bolão real para validar tabs internas.
$env:E2E_POOL_ID="id-do-bolao"

# Use apenas com uma sessão platform_admin.
$env:E2E_ADMIN_SMOKE="true"

npm run e2e:auth
```

O estado de autenticação é salvo em `tests/.auth/` e não deve ser versionado.

Healthcheck rápido de produção:

```bash
npm run health:production
```

O healthcheck valida rewrites públicas, HTML da SPA e política de cache dos assets hashados do Hosting.
O mesmo comando roda automaticamente no workflow `Production Healthcheck` a cada 30 minutos e também pode ser disparado manualmente no GitHub Actions.

Testes das Functions:

```bash
npm --prefix functions test
npm --prefix functions run build
```

## Deploy

```bash
# Somente Hosting para https://superbolao.web.app
npm run deploy:hosting

# Hosting + Firestore + Functions
npm run deploy:firebase
```

O deploy de Hosting usa o target `superbolao` no projeto `hocapp-44760`.

## Próximos Blocos Planejados

- Ampliar testes E2E com Playwright para fluxos críticos autenticados.
- Cobertura de integração com Firebase Emulators para services/regras.
- Revisar notificações do GitHub Actions/Firebase Console para alertas operacionais.

## Licença

Privado — uso interno do projeto.
