# Arquitetura da Plataforma Bolão Copa 2026

## Status Arquitetural — 05/05/2026

- Frontend em produção com `src/core` e `src/modules` operacionais.
- Cloud Functions Gen2 em Node.js 22, região `southamerica-east1`, com arquivos TypeScript diretamente em `functions/src`.
- Firestore dedicado: database `bolao2026` no projeto Firebase `hocapp-44760`.
- Hosting público: `https://superbolao.web.app` pelo target `superbolao`.
- Redesign Arena Copa fase 1 publicado; fase 2 de polimento visual em andamento.

## 1. Visão Geral

A plataforma Bolão Copa 2026 é uma **SPA (Single Page Application)** construída com **React 18 + Vite** e hospedada no **Firebase Hosting**. Utiliza **Firestore** como banco de dados NoSQL e **Cloud Functions** para lógica serverless. A arquitetura segue princípios de **modularidade**, **isolamento de dados** e **separação de responsabilidades**.

---

## 2. Estrutura de Diretórios (Core + Módulos)

```
raiz/
├── docs/                    ← Documentação do projeto
├── .github/workflows/       ← CI/CD (lint, testes, deploy)
├── functions/               ← Cloud Functions (backend serverless)
│   └── src/
│       ├── index.ts              ← Entry point (exporta funções)
│       ├── firestore.ts          ← Inicialização Admin SDK no database bolao2026
│       ├── auth.ts               ← Autorização platform_admin
│       ├── runtimeOptions.ts     ← Região/runtime/service account
│       ├── scoringEngine.ts      ← Engine TS sincronizada com o frontend
│       ├── processMatchScoring.ts
│       ├── revealBetsForStage.ts
│       ├── notifyPendingBets.ts
│       ├── seedTournament.ts
│       ├── setSpecialBetResults.ts
│       └── syncFifaResults.ts
├── src/                     ← Frontend React
│   ├── core/                ← Núcleo da plataforma
│   │   ├── config/          ← Configuração Firebase, constantes
│   │   ├── domain/          ← Lógica de negócio pura (engines, tipos, validadores)
│   │   ├── lib/             ← Utilitários genéricos, logger, helpers
│   │   └── services/        ← Serviços core (auth, baseService)
│   ├── modules/             ← Módulos funcionais independentes
│   │   ├── auth/            ← Autenticação, perfil, roles
│   │   ├── pool/            ← Criação, busca, join/leave de bolões
│   │   ├── bets/            ← Palpites em jogos e palpites especiais
│   │   ├── scoring/         ← Leaderboard, ranking, processamento de pontos
│   │   ├── tournament/      ← Torneio, jogos, fases, seed
│   │   ├── admin/           ← Painel de administração da plataforma
│   │   └── notifications/   ← Sistema de notificações
│   └── App.jsx
├── firestore.rules          ← Regras de segurança
├── firestore.indexes.json   ← Índices compostos
└── firebase.json            ← Configuração Firebase
```

---

## 3. Princípios Arquiteturais

### 3.1 Core Rígido e Estável
O diretório `src/core/` contém código que **NÃO DEVE** ser alterado com frequência:
- **domain/**: Lógica de negócio pura (engines, tipos, validadores) — testável, sem dependências externas.
- **config/**: Configuração Firebase, constantes da plataforma.
- **lib/**: Utilitários genéricos.
- **services/**: Serviços base que orquestram o acesso ao Firestore.

**Regra:** Alterações no core exigem testes e revisão cuidadosa, pois impactam toda a plataforma.

### 3.2 Módulos Independentes
Cada funcionalidade da plataforma vive em `src/modules/<nome>/` e **NÃO DEVE** depender de código interno de outros módulos. A comunicação entre módulos é feita via:
- **Hooks públicos** expostos pelo módulo
- **Serviços core** compartilhados
- Eventos/contextos React (apenas interfaces públicas)

**Regra:** Um módulo pode ser removido ou substituído sem quebrar os demais.

### 3.3 Isolamento de Dados
- **Plataforma:** Prefixo `platform_*` para coleções globais.
- **Bolão:** Cada bolão tem seus dados em coleções específicas, identificadas por `pool_id`.
- **Usuário:** Cada usuário tem seu perfil e dados associados via `user_id`.
- **Banco de dados por plataforma:** Uso de `database` namespaces (Firestore multi-database) para segregar plataformas diferentes no mesmo projeto Firebase.

### 3.4 Backend como Orquestrador
Toda lógica que envolve múltiplas entidades (cálculo de pontos, revelação de palpites, notificações) roda nas **Cloud Functions**, não no cliente. O frontend apenas chama serviços e reage a snapshots do Firestore.

---

## 4. Fluxo de Dados

```
┌─────────────┐     ┌──────────────┐     ┌─────────────┐
│   Frontend  │────▶│   Services   │────▶│  Firestore  │
│  (React)    │◀────│  (firebase/  │◀────│  (NoSQL)    │
│             │     │   firestore) │     │             │
└─────────────┘     └──────┬───────┘     └──────┬──────┘
                           │                    │
                           │                    ▼
                           │            ┌──────────────┐
                           │            │    Cloud     │
                           └────────────│  Functions   │
                                        │  (Triggers)  │
                                        └──────────────┘
```

1. **Frontend** lê dados via hooks que usam `onSnapshot` (tempo real).
2. **Frontend** escreve via funções de serviço (ex.: `saveBets()`).
3. **Cloud Functions** reagem a alterações no Firestore (ex.: `processMatchScoring` quando `match.status → finished`).
4. Resultados processados são escritos de volta ao Firestore.
5. **Frontend** reage automaticamente via snapshots.

---

## 5. Convenções de Nomenclatura

### 5.1 Coleções Firestore
- **Nomes:** snake_case no plural (ex.: `pools`, `pool_memberships`, `special_bets`)
- **IDs determinísticos:** Para evitar duplicatas e facilitar queries
  - Memberships: `${userId}_${poolId}`
  - Bets: `${userId}_${poolId}_${matchId}`
  - Special bets: `${userId}_${poolId}_${type}`
  - Processed scores: `${userId}_${poolId}_${stageId}`

### 5.2 Variáveis e Funções
- **camelCase** para JS/TS
- **snake_case** apenas para campos no Firestore

### 5.3 Componentes React
- **PascalCase** para arquivos e componentes
- Organizados por funcionalidade dentro de `modules/<nome>/components/`

---

## 6. Diagrama de Componentes Principais

```
App
├── AuthProvider (core/lib/FirebaseAuthContext)
│   └── QueryClientProvider (react-query)
│       └── BrowserRouter
│           ├── Layout (core/components/Layout)
│           │   ├── Sidebar (navegação)
│           │   ├── Header (notificações)
│           │   └── Main Content
│           │       ├── Dashboard (modules/pool)
│           │       ├── Pool (modules/pool) com abas:
│           │       │   ├── PoolDashboardTab
│           │       │   ├── PoolRulesTab
│           │       │   └── PoolAdminTab
│           │       ├── Admin Pages (modules/admin)
│           │       │   ├── AdminMatches
│           │       │   ├── AdminMetrics
│           │       │   ├── AdminSeed
│           │       │   └── AdminCreatorRequests
│           │       └── ... outras páginas
│           └── Toaster (sonner)
```

---

## 7. Segurança

### 7.1 Regras do Firestore
- **Regras granulares** por coleção (`firestore.rules`)
- **Plataforma admin** (`platform_admin`) tem acesso a todas as coleções
- **Pool admin/owner** gerencia seu bolão
- **Usuário comum** só acessa dados próprios ou de bolões onde é membro
- **Cloud Functions** acessam via Admin SDK (privilegiado)

### 7.2 Autenticação
- **Google Sign-In** único método
- **Roles** definidas no perfil do usuário (`users/{uid}.role`)
- **`can_create_pools`** flag para autorização de criação de bolões

---

> **Última atualização:** 05/05/2026
> **Versão:** 1.1.0