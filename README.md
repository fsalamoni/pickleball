# PickleTour

Plataforma web para **operar o ecossistema do pickleball amador no Brasil**.

Ela une torneios, modalidades, comunidade, clubes, arenas, reservas e comunicação em um único produto.

## Propósito

A PickleTour existe para:

1. reduzir improviso na organização de torneios;
2. melhorar a percepção de qualidade para atletas e público;
3. conectar a rotina do esporte fora do torneio, com clubes, arenas e relacionamento contínuo;
4. transformar o produto em uma presença digital completa do pickleball, e não só em um painel de resultados.

## Funcionalidades principais

### Torneios e modalidades

- 🏆 torneios com identidade, operação e visão pública
- 📋 modalidades múltiplas por torneio com nível, gênero, idade e taxa de inscrição
- 🧭 página própria de modalidade com visão geral, inscrição, jogos, ranking e fotos
- 🪜 múltiplas fases por modalidade
- 📏 pontuação por fase: pontos por game e sets por partida definidos dentro de cada fase
- 🎲 sorteio automático de grupos e chaves com seed reproduzível
- 🧩 formatos competitivos: pontos corridos, grupos, mata-mata, dupla eliminação, suíço, americano e mexicano
- 📅 agendamento por quadras com janela de horários e duração média de jogo
- 📊 ranking ao vivo e classificação por modalidade
- 🖼️ galerias de fotos gerais e por modalidade
- 👀 visão pública sem login (`/p/:id`)
- 🖨️ versão para impressão do torneio

### Comunidade e atletas

- 👤 perfil do atleta com foto, elegibilidade competitiva e dados públicos controlados
- 📖 nivelamento com base CBPE e USAP
- 🔎 diretório de atletas
- 💬 chat direto e em grupo
- 📰 feed e fóruns da comunidade

### Clubes

- 🏠 criação e gestão de clubes
- 🎟️ convites e ingresso por código
- 📅 eventos e game-days
- 🗳️ fórum com comentários e enquetes

### Arenas e reservas

- 🏟️ diretório de arenas com perfil, fotos, contatos e preços
- 📆 solicitação de reservas avulsas e recorrentes
- 💸 negociação manual de valor
- 🧾 acompanhamento de pagamento e histórico
- 🔍 ampliação de fotos para melhor visualização da estrutura
- ⛔ bloqueio de conflito com horários já confirmados

### Base operacional da plataforma

- 🔔 notificações in-app
- 🧾 auditoria de ações administrativas
- 🔐 login com Google (Firebase Auth)
- 🚩 feature flags para rollout controlado
- 📱 PWA opcional

## Padrão visual

O padrão obrigatório de design da plataforma está documentado em [docs/DESIGN_STANDARD.md](docs/DESIGN_STANDARD.md).

As primitivas de composição para páginas, seções e formulários ficam em [src/components/ui/platform-page.jsx](src/components/ui/platform-page.jsx).

## Stack

- React 18 + Vite + Tailwind + shadcn/ui
- Firebase: Auth, Firestore (database `pickleball`), Hosting
- React Query para data fetching
- Vitest para testes unitários
- Playwright para E2E

## Como rodar

```bash
npm install
cp .env.example .env.local
npm run dev
```

## Scripts úteis

| Script | Descrição |
| --- | --- |
| `npm run dev` | desenvolvimento local com Vite |
| `npm run build` | build de produção (`dist/`) |
| `npm run lint` | validação estática com ESLint |
| `npm run test` | testes unitários com Vitest |
| `npm run e2e` | testes end-to-end com Playwright |

## PWA

A aplicação pode ser instalada no celular sem loja, via navegador.

Controle:

- `VITE_PWA_ENABLED=false`: sem service worker, sem botão de instalação
- `VITE_PWA_ENABLED=true`: instala o PWA e habilita o CTA na landing

## Feature flags

Algumas capacidades nascem desligadas e são habilitadas pelo admin master.

Exemplos importantes:

- `multi_phase_tournaments`: múltiplas fases por modalidade
- `modality_pages`: páginas próprias das modalidades
- `tournament_gallery`: galeria de fotos de torneio
- `arenas`: diretório e operação de arenas

As flags vivem em `platform_settings/global` e são aditivas.

## Deploy

Push em `main` dispara os workflows do GitHub Actions para CI e publicação.

O repositório está preparado para:

1. deploy em Firebase Hosting;
2. deploy em GitHub Pages;
3. publicação de regras e índices do Firestore;
4. validação automática de build.

## Estrutura

```text
src/
├── App.jsx
├── core/                  # auth, firebase, serviços e base compartilhada
├── components/            # layout, componentes globais e ui/
├── pages/                 # landing, login, regras, perfil e páginas institucionais
└── modules/
    ├── tournament/        # torneios, modalidades, fases, jogos, ranking, visão pública
    ├── arenas/            # arenas, reservas, fotos, preços e avaliações
    ├── clubs/             # clubes, mural, eventos e fóruns
    ├── chat/              # conversas diretas e em grupo
    ├── athletes/          # diretório e perfis públicos
    ├── leveling/          # nivelamento do atleta
    ├── notifications/     # notificações in-app
    └── admin/             # painel administrativo da plataforma
```
