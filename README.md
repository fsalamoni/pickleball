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
- 📅 calendário interativo de reservas com seleção multi-slot e auto-preço
- 💳 pagamento PIX com QR code e chave copiável
- 📋 regras estruturadas (lista por categoria) na página pública
- 🛒 gestão de estoque/mercado (entradas, saídas, margem por produto)
- 🏟️ integração arena × torneio (torneios aparecem na página da arena)
- 🤝 integração arena × professor (coaches residentes aparecem na arena)
- 📆 solicitação de reservas avulsas e recorrentes
- 💸 negociação manual de valor
- 🧾 acompanhamento de pagamento e histórico
- 🔍 ampliação de fotos para melhor visualização da estrutura
- ⛔ bloqueio de conflito com horários já confirmados

### Além disso (visão completa em [`docs/46-INVENTARIO.md`](docs/46-INVENTARIO.md))

Dia de jogo (Play, Americano, Mexicano, Rei da Quadra), rankings e rating 2.0–8.0, Mercado (`/mercado`), Centro de Treino, gamificação, marketing de arenas e professores, notificações e push, modo escuro, três idiomas (pt/en/es) e central de ajuda. O inventário lista tudo que existe, gerado do código.

### Base operacional da plataforma

- 🔔 notificações in-app
- 🧾 auditoria de ações administrativas
- 🔐 login com Google (Firebase Auth)
- 🚩 feature flags para rollout controlado
- 📱 PWA opcional

## Documentação

Porta de entrada: [`docs/00-INDEX.md`](docs/00-INDEX.md). Guia-mestre (principalmente para quem desenvolve, humano ou IA): [`CLAUDE.md`](CLAUDE.md). Números e listas reais (módulos, rotas, coleções, índices, funções, flags): [`docs/46-INVENTARIO.md`](docs/46-INVENTARIO.md), **gerado do código**.

**Toda implementação atualiza a documentação no mesmo PR** (`npm run docs:inventario` + o doc do assunto). O CI reprova inventário desatualizado e PR que muda código sem tocar em documento.

## Arquitetura em um parágrafo

Aplicativo React 18 + Vite (PWA) falando direto com o Firebase: Auth (Google), **Firestore (banco nomeado `pickleball`)**, Storage e Hosting; regras de segurança (`firestore.rules`, `storage.rules`) são a defesa real. **Cloud Functions** (Node 22, região `southamerica-east1`) mantêm rankings e rating, filas, notificações/push, gamificação, exclusão/unificação de contas e o Mercado. A interface ativa é a V2 (`src/v2/`); a lógica de negócio vive em `src/modules/<módulo>/{domain,services,hooks,components}`; a base compartilhada em `src/core/`. Detalhes: [`docs/04-ARCHITECTURE.md`](docs/04-ARCHITECTURE.md).

## Stack

- React 18, Vite 6, Tailwind 3 + shadcn/ui (Radix), React Query 5
- Firebase JS 12 (Auth, Firestore, Storage, Hosting, Cloud Messaging) e Cloud Functions
- Vitest (unitários e de componentes), testes de regras no emulador, Playwright (E2E)

Versões exatas: `package.json` e `docs/46-INVENTARIO.md`.

## Como rodar

```bash
npm install
cp .env.example .env.local   # preencha as variáveis VITE_FIREBASE_*
npm run dev
```

## Scripts úteis

| Script | Descrição |
| --- | --- |
| `npm run dev` | desenvolvimento local com Vite |
| `npm run build` | build de produção (`dist/`) |
| `npm run build:budget` | confere o orçamento do pacote inicial |
| `npm run lint` | ESLint |
| `npm test` | testes com Vitest |
| `npm run test:rules` | testes das regras do Firestore/Storage no emulador |
| `npm run typecheck` | sintaxe e resolução (`checkJs` desligado: tipos JSDoc não são verificados) |
| `npm run e2e` | testes end-to-end (Playwright) |
| `npm run docs:inventario` | regrava `docs/46-INVENTARIO.md` a partir do código |
| `npm run docs:inventario:check` | falha se o inventário estiver desatualizado (CI) |
| `npm run security:secrets` | varredura de segredos nos arquivos versionados |

## PWA

Instalável pelo navegador, sem loja. Controle: `VITE_PWA_ENABLED=true` instala o service worker e habilita o convite de instalação; `false` desliga ambos.

## Feature flags

Poucas capacidades são ligadas pelo admin (`FEATURE_FLAG` em `src/core/featureFlags.js`); as demais já viraram código permanente (`PERMANENT_FEATURE`). A lista atual está no inventário. Novas funcionalidades nascem atrás de flag desligada. Ver [`docs/02-STANDARDS.md`](docs/02-STANDARDS.md).

## Deploy

Push em `main` dispara o GitHub Actions: CI (lint, testes, build, orçamento do pacote, inventário de docs) e publicação no Firebase (Hosting, regras e índices do Firestore, regras do Storage e Cloud Functions publicadas por nome). Detalhes e armadilhas em [`docs/03-WORKFLOW.md`](docs/03-WORKFLOW.md). Produção: https://picklerush.web.app.

## Estrutura

```text
src/
├── main.jsx, App.jsx      # bootstrap, providers e rotas raiz (públicas, telão, impressão)
├── core/                  # auth, firebase, i18n, tema, PWA, flags, guardas de fonte, libs
├── components/ui/         # primitivos shadcn/ui
├── pages/                 # telas públicas/impressão/telão (V1 removido)
├── modules/               # lógica de domínio por módulo (domain/services/hooks/components)
└── v2/                    # APP ATIVO: V2App.jsx (rotas), V2Layout, pages/, components/, ui/
functions/                 # Cloud Functions
tests/                     # regras no emulador (tests/rules) e E2E (tests/e2e)
docs/                      # documentação (ver docs/00-INDEX.md)
scripts/                   # utilitários, deploy de funções, gerador do inventário
```

A lista de módulos e a de pastas de componentes estão no inventário.
