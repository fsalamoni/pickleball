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
