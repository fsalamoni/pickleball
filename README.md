# Pickleball

Plataforma web para criação e administração de torneios amadores de **pickleball** no Brasil.

## Funcionalidades

- 🏆 **Torneios** com formatos single, duplas e americana
- 📋 **Modalidades múltiplas** por torneio com níveis (iniciante → elite), categorias por gênero e idade
- 📏 **Regras configuráveis**: CBP ou USAP, jogos de 11/15/21 pontos, 1+ sets
- 🎲 **Sorteio automático** de grupos e chaves (com seed reproduzível)
- 🪜 **Formatos avançados de fase**: pontos corridos, grupos, mata-mata (single), **dupla eliminação** com bracket reset e **sistema suíço** com pareamento por pontuação
- 📅 **Agendamento por quadras** com slots de tempo e descanso mínimo entre jogos
- 📊 **Ranking ao vivo** adaptado ao formato (pontos corridos, grupos, mata-mata, americana)
- 👥 **Admins compartilhados** por torneio sem afetar o admin geral da plataforma
- 📖 **Páginas educativas**: regras (CBP/USAP) e nivelamento (CBPE/USAP) com formulário auto-avaliativo
- 🎫 Até **500 inscritos por modalidade**, taxa de inscrição opcional, check-in de jogadores
- 👀 **Visão pública** (`/p/:id`) para espectadores, sem login, com atualização automática
- 🖨️ **Versão para impressão** (`/torneios/:id/imprimir`) das chaves e classificação
- 🔐 Login com **Google** (Firebase Auth) e auditoria de ações administrativas

## Stack

- **React 18** + Vite + Tailwind + shadcn/ui
- **Firebase**: Auth, Firestore (database `pickleball`), Hosting
- **React Query** para data fetching
- **Vitest** para testes unitários · **Playwright** para E2E

## Como rodar

```bash
npm install
cp .env.example .env.local   # preencha as variáveis do Firebase
npm run dev                  # http://localhost:5173
```

## Scripts úteis

| Script | Descrição |
| --- | --- |
| `npm run dev` | Vite em modo desenvolvimento |
| `npm run build` | Build de produção (`dist/`) |
| `npm run lint` | ESLint |
| `npm run test` | Vitest (unit) |
| `npm run e2e` | Playwright (E2E) |

## App mobile (PWA)

A plataforma pode ser instalada como app no celular **sem passar pelas lojas**,
direto do site (Android via prompt nativo; iOS/Safari via "Adicionar à Tela de
Início"). É um PWA — totalmente aditivo, não altera banco de dados nem
funcionalidades.

Fica **desligado por padrão** atrás da flag `VITE_PWA_ENABLED`:

- `VITE_PWA_ENABLED=false` (padrão): nenhum service worker é registrado e o
  botão "Baixar o app" não aparece. Zero impacto.
- `VITE_PWA_ENABLED=true`: ativa o registro do service worker (apenas em build de
  produção) e exibe o botão de instalação na landing.

Os ícones do app são gerados por `node scripts/generate-pwa-icons.mjs`
(saída em `public/`). Após validar tudo, basta ligar a flag no ambiente de build.

## Feature flags (admin master)

Algumas funcionalidades nascem **desligadas** e são ativadas em tempo real pelo
admin master na página **Métricas da Plataforma** (`/admin/metricas`), no card
**Funcionalidades (flags)**. As flags ficam em `platform_settings/global`
(Firestore) e são puramente aditivas — desligar não afeta nada do que já existe.

- **Torneios em múltiplas fases** (`multi_phase_tournaments`): permite configurar
  uma modalidade com várias fases encadeadas (grupos, americano, mata-mata, dupla
  eliminação, suíço), com **divisão em grupos equilibrados** por gênero e nível
  (diferença máxima de 1 atleta por grupo), sorteio ou seleção manual,
  **qualificação de classificados** (geral ou por gênero) e **progressão
  automática entre fases** (fusão de grupos A+B → AB, formação de duplas mistas,
  chaveamento A×B / C×D). A inscrição continua em **lista única** por modalidade.
  Com a flag desligada, o fluxo de fase única permanece idêntico ao atual.

> Após o primeiro uso, lembre-se de publicar as regras do Firestore
> (`firestore.rules`) — há uma regra nova para `platform_settings` (leitura
> pública, escrita só do admin master).

## Publicação no GitHub Pages

O repositório já está preparado para publicar a aplicação em **GitHub Pages** via workflow do GitHub Actions (`.github/workflows/deploy-pages.yml`).

### 1. Habilite o GitHub Pages

No GitHub, abra **Settings → Pages** e selecione **Build and deployment → Source: GitHub Actions**.

### 2. Configure as variáveis do build

Em **Settings → Secrets and variables → Actions**, crie as variáveis (ou secrets) abaixo com os valores reais do seu projeto Firebase:

- `VITE_FIREBASE_API_KEY`
- `VITE_FIREBASE_AUTH_DOMAIN`
- `VITE_FIREBASE_PROJECT_ID`
- `VITE_FIREBASE_STORAGE_BUCKET`
- `VITE_FIREBASE_MESSAGING_SENDER_ID`
- `VITE_FIREBASE_APP_ID`

Opcionais:

- `VITE_FIREBASE_MEASUREMENT_ID`
- `VITE_FIRESTORE_DATABASE_ID` (padrão recomendado: `pickleball`)
- `VITE_ENABLE_FIREBASE_ANALYTICS`
- `VITE_ENABLE_FIREBASE_PERFORMANCE`

### 3. Deploy

Ao fazer push para `main`, o workflow publica automaticamente em:

`https://fsalamoni.github.io/pickleball/`

O workflow também gera `404.html` a partir do `index.html` para manter o roteamento SPA funcionando em refresh e links diretos.

## Estrutura

```
src/
├── App.jsx                # Roteamento
├── core/                  # Auth, Firebase, serviços compartilhados, design system
├── components/            # Layout, AuditLogTable, UI primitives (shadcn)
├── pages/                 # Landing, Login, Regras, Nivelamento, Conduta, Política
└── modules/
    ├── tournament/        # Domínio principal (torneios, modalidades, jogos, ranking)
    │   ├── domain/        # constants, scoring, draw, ranking (puros, testados)
    │   ├── services/      # Firestore CRUD
    │   ├── hooks/         # React Query
    │   ├── pages/         # Dashboard, CreateTournament, JoinTournament, Tournament
    │   └── components/    # Tabs do torneio + dialogs
    ├── leveling/          # Tabela e formulário de nivelamento (CBPE/USAP)
    ├── notifications/     # Notificações in-app
    └── admin/             # Painel administrativo da plataforma
```
