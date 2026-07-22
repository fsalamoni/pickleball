# PickleRush

Plataforma web para **operar o ecossistema do pickleball amador no Brasil**.

Ela une torneios, modalidades, comunidade, clubes, arenas, reservas e comunicação em um único produto.

## Propósito

A PickleRush existe para:

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
- 🪜 onboarding guiado pós-criação (4 passos: fotos → preços → horários → compartilhar)
- 🧭 "Minhas arenas" no sidebar com badge de reservas pendentes (só aparece para quem gerencia)
- 🎾 quadras nomeadas (coberta/descoberta, superfície, ativas/inativas, ordenáveis)
- 🕐 janelas de horário recorrentes por quadra (ex: "Seg–Sex 08:00–12:00")
- 📅 calendário mensal de reservas com filtro por quadra e cores por status
- 📈 painel do proprietário com receita, ocupação, conversão, rating, próximas reservas (mês a mês)
- 💰 regras de preço por dia/horário, com opção de aplicar só a uma quadra específica
- 🛡️ detecção de conflito em tempo real (valida schedule + reservas ativas antes de criar)
- ⚡ reserva instantânea (auto-confirmada, requer pagamento adiantado, opt-in por arena)
- 🏪 PDV (loja) com produtos, vendas, pagamentos (PIX por QR/código ou dinheiro na arena)
- 💬 resposta pública de reviews pela arena (gerente ou dono)
- 📋 regras da casa (markdown) exibidas na página pública da arena
- 🏆 circuitos de torneios com ranking acumulado (séries de torneios + pontuação)
- 👨‍🏫 diretório de professores com perfil, valor/hora e vínculo de residência em arenas
- 🏟️ integração arena × torneio (torneios aparecem na página da arena)
- 🤝 integração arena × professor (coaches residentes aparecem na arena)
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

A camada de apresentação ativa é o **V2 ("Athleisure Premium")** em `src/v2/` (rotas, layout e primitivos próprios). As primitivas compartilhadas de baixo nível (shadcn/ui) ficam em [src/components/ui/](src/components/ui/).

## App ativo (V2) vs. legado (V1)

A plataforma opera em **dois apps paralelos no mesmo código-fonte**, e a V2 é a experiência oficial e integral:

- **V2 (ativo, `src/v2/`)** — design "Athleisure Premium". Atende **toda a navegação** do app autenticado em `/*` e as páginas públicas (landing, login, espectador, impressão). É o que o usuário final vê.
- **V1 (legado, `src/pages/` + `src/V1Routes.jsx`)** — design antigo, mantido apenas como arquivo de rotas. **Não recebe mais navegação nova**; páginas que tinham par em V2 foram removidas. Sobrevive apenas como código morto em `src/V1Routes.jsx` (ver plano de remoção).

A camada de **domínio** (`src/modules/`) é **compartilhada por V1 e V2** — V2 renderiza usando os hooks e services que V1 já consolidou. Toda a lógica de negócio, dados, regras e integrações mora em `src/modules/` e é reusada.

## Stack

- React 18 + Vite + Tailwind + shadcn/ui (Radix)
- Firebase: Auth (Google), **Firestore (database nomeada `pickleball`)**, Hosting, Storage, **Cloud Functions** (region `southamerica-east1`, apenas para recálculo do ranking nacional)
- React Query para data fetching
- Vitest para testes unitários (~408 testes)
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
├── App.jsx                # Roteamento raiz + providers
├── main.jsx               # Bootstrap + PWA (atrás de flag)
├── core/                  # auth, firebase, services e base compartilhada
├── components/            # layout, componentes globais e ui/ (shadcn)
├── pages/                 # páginas públicas com auto-refresh (espectador, impressão)
├── modules/               # ⭐ BASE DE DOMÍNIO — 17 módulos (hooks/services/domain)
│   ├── tournament/        # torneios, modalidades, fases, jogos, ranking, sorteio
│   ├── athletes/          # diretório e perfis públicos
│   ├── clubs/             # clubes, mural, eventos, fóruns, game-day
│   ├── chat/              # conversas diretas e em grupo
│   ├── leveling/          # nivelamento do atleta (CBPE/USAP)
│   ├── notifications/     # notificações in-app (sino)
│   ├── admin/             # painel administrativo
│   ├── arenas/            # arenas, reservas, fotos, preços
│   ├── games/             # jogos abertos e procura-jogo
│   ├── partners/          # espaço de parceiros
│   ├── performance/       # meu desempenho
│   ├── progression/       # progressão do atleta
│   ├── rating/            # ranking nacional
│   ├── sharing/           # compartilhamento e certificados
│   ├── social/            # feed, follows, players, metas
│   ├── achievements/      # conquistas
│   └── analytics/         # funil e observabilidade
└── v2/                    # ⭐ APP ATIVO — "Athleisure Premium"
    ├── V2App.jsx          # Tabela de rotas do V2 (ativo em /*)
    ├── components/        # V2Layout + componentes por módulo
    ├── pages/             # V2Dashboard, V2Arenas, V2Tournament, ...
    └── ui/primitives.jsx  # V2Button, V2Card, ...
```
