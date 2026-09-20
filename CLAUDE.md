# CLAUDE.md — Guia-mestre do PickleRush para IAs e humanos

> **Você é uma IA? Leia isto primeiro.** Este documento é a porta de entrada
> única para entender e evoluir o PickleRush. Tudo o que você precisa está
> aqui ou a até 2 cliques daqui.
>
> **Você é humano?** Mesmo lugar. O fluxo é o mesmo.

---

## 0. TL;DR (30 segundos)

- **O que é**: PWA para pickleball amador BR — torneios, clubes, arenas, professores, comunidade.
- **Stack**: React 18 + Vite, Tailwind + shadcn/ui, Firebase (Firestore db `pickleball`), React Query, Vitest, Playwright.
- **Estado**: 20 módulos (rating virou oficial com domain/services/hooks/components), 71 V2 pages, 103 coleções Firestore (+push_tokens, +player_skill_ratings), **102 índices compostos**, **14 feature flags default OFF** (137 ativas viraram código em produção), **1800 testes verdes**, **9 Cloud Functions**. Ondas recentes: **DUPR-style rating** (escala 2.0-8.0, motor placar + confiabilidade), **engajamento** (action_home, smart_matchmaking, post_game_flow, push_notifications), **tournament equipes** (sortear → jogar → ranking), **arena mercado** (catálogo + gestão), **game day Play** (open play, visões separadas, sorteio aditivo). Legado V1 removido.
- **Live**: https://picklerush.web.app (Firebase site `picklerush`; `pickletour` é redirect-only).
- **Deploy**: push em `main` → GitHub Actions → Firebase Hosting + Rules + Cloud Function.
- **Repositório**: https://github.com/fsalamoni/pickleball
- **Admin**: `fsalamoni@gmail.com` (uid `Kx7CC0NVgogh8cCF4wIRmpOvo7r2`, role `platform_admin`).

Se você só tem 30 segundos, isso é o suficiente para não se perder.

---

## 1. Como usar este guia (para IAs)

**Fluxo obrigatório antes de fazer QUALQUER tarefa:**

```
┌────────────────────────────────────────────────────────────┐
│ 1. Leia §2 (princípios) e §3 (estrutura dos docs)         │
│ 2. Identifique o módulo/feature que vai tocar (§4)         │
│ 3. Leia o README do módulo (em src/modules/X/README.md)    │
│ 4. Leia o doc setorial (docs/01-AI-CONTEXT.md, DATA_MODEL,   │
│    MODULES, ARCHITECTURE, STANDARDS, WORKFLOW)             │
│ 5. Só então abra o código                                  │
│ 6. Planeje em 3 passos (§6)                                │
│ 7. Implemente respeitando os padrões (docs/02-STANDARDS)  │
│ 8. Teste, documente, commite, faça PR (§7-§8)             │
└────────────────────────────────────────────────────────────┘
```

**Tempo investido nos passos 1-4: 5-10 min.** Esse investimento se paga em
horas de implementação sem voltar atrás. **Não pule.**

Se você tem dúvida sobre **"onde está X"** → §4 (mapa rápido).
Se você tem dúvida sobre **"como faço Y"** → §5 (decisão rápida) + docs/02-STANDARDS.md.
Se você está **começando uma feature nova** → §6 (planejamento).
Se você está **terminando uma feature** → §7 (checklist de entrega).

---

## 2. Princípios não-negociáveis (leia antes de tocar em qualquer coisa)

Estes princípios vieram de bugs reais que custaram horas pra arrumar. São inegociáveis:

1. **Não prejudicar nada.** Calma, cautela, atenção. Antes de remover/renomear, **grep + bundle grep + runtime test** pra garantir zero impacto.
2. **Feature flags SEMPRE.** Toda nova feature nasce atrás de `FEATURE_FLAG.X` (default OFF). UI gated por `<FeatureFlagGuard flag=...>` ou `useFeatureFlag(key)`. Defaults em `platform_settings/feature_flags/{key}`. Veja `docs/02-STANDARDS.md` §3.
3. **UX/UI é prioridade.** Refinamentos visuais depois de cada sprint. Não aceito "funciona, tá pronto". Tem que funcionar **e** ser bonito.
4. **MERGES + DEPLOYS AUTOMÁTICOS.** Quando terminar um conjunto coerente de tarefas, fazer squash merge + push em main → deploy sai sozinho. Veja `docs/03-WORKFLOW.md`.
5. **Lógica pura em `domain/` com teste.** Service = I/O. Hook = React Query. Componente = UI. Regra de negócio NUNCA em componente. Sempre testada (Vitest).
6. **Auditoria em toda escrita.** `auditService.createAuditLog(...)` após mutações relevantes.
7. **Sem TypeScript, mas com JSDoc.** Typedefs em `core/domain/types.js`. `npm run typecheck` antes de commit.
8. **Sem `console.log` em services.** Use `core/lib/logger`.
9. **pt-BR em tudo.** UI, comentários, mensagens, audit_logs. Sem inglês solto.
10. **Dado pessoal: a regra é a única defesa.** Nesta arquitetura o cliente fala direto com o banco — validação no navegador é conveniência, não controle. Nunca coloque e-mail, telefone, endereço ou data de nascimento em coleção de leitura ampla; nunca deixe o usuário escrever campo que define permissão; preferência de privacidade tem que valer no SERVIDOR. Ver `docs/20-SEGURANCA-E-PRIVACIDADE/`.
11. **Backward-compat SEMPRE.** Aditividade: nova coleção? Regra nova no `firestore.rules` sem mexer nas existentes. Nova flag? Default OFF. Schema change? Campo novo opcional. Migração de dados → `migrateLegacyFlags` com bump de `FLAGS_MIGRATION_VERSION`.

**Se uma tarefa pedir para violar qualquer um desses, PARE e pergunte.**

---

## 3. Estrutura dos docs (mapa completo)

```
/workspace/pickleball/
├── CLAUDE.md                       ⭐ ESTE ARQUIVO (guia-mestre)
├── AGENTS.md                       🔁 alias (alguns agentes leem este nome)
├── README.md                       👤 usuário final (como rodar/usar)
│
├── docs/
│   ├── 00-INDEX.md                 📚 mapa de navegação detalhado
│   ├── 01-AI-CONTEXT.md            🧠 panorama da plataforma
│   ├── 02-STANDARDS.md             📐 padrões de código (como codar)
│   ├── 03-WORKFLOW.md              🔄 git, deploy, GitHub, Firebase
│   ├── 04-ARCHITECTURE.md          🏗️ camadas, design system, testes
│   ├── 05-DATA-MODEL.md            💾 92 coleções Firestore + regras
│   ├── 06-MODULES.md               📦 19 módulos + fluxos + rotas
│   ├── 07-DESIGN-STANDARD.md       🎨 paleta/tipografia/componentes
│   ├── 08-ARENA-ROADMAP.md         🏟️ sprints de arena (status)
│   ├── 09-UX-ANALYSIS/             🔍 auditorias UX/UI por persona
│   │   ├── README.md
│   │   ├── 01-fundacao-design-system.md
│   │   ├── ... 12 docs de auditoria ...
│   │   ├── 13-arena-refino.md
│   │   ├── 14-professor-implementacao.md
│   │   └── 15-backlog-remanescente.md   ⭐ comece por aqui pra novas features
│   ├── 10-ARENA-V3/                🏟️ docs específicos Arena V3
│   │   ├── 00-INDEX.md
│   │   ├── 26-ARENA-V3-COMPLETE-REFERENCE.md  ⭐ status atual
│   │   └── ... sprints 1-10 ...
│   ├── 11-REFERENCE/               📖 cheatsheet, glossário, FAQ
│   │   ├── cheatsheet.md
│   │   ├── glossary.md
│   │   └── faq.md
│   ├── 12-TEAM-TOURNAMENTS.md      🏆 torneio por equipes
│   ├── 13-NIVEL-UNIFICADO.md       📏 ⭐ régua 2.0–8.0 de TODOS os sorteios
│   ├── 14-DIA-DE-JOGO-TELAO.md     📺 colapsáveis + telão do dia de jogo
│   ├── 15-DIA-DE-JOGO-PERMISSOES.md 🔐 quem pode organizar o dia de jogo
│   ├── 16-DIA-DE-JOGO-RODIZIO.md   🔁 rodízio equilibrado do Play
│   ├── 17-DIA-DE-JOGO-AMERICANO-APRIMORADO.md ⭐ formato americano_live
│   ├── 18-RANKINGS.md              🏆 quando ranking e rating atualizam
│   ├── 19-TUTORIAIS.md             🎓 tutoriais em tela (torneio + dia de jogo)
│   ├── 21-CENTRAL-DE-AJUDA.md      🆘 a página /ajuda, por tipo de usuário
│   ├── 22-DIA-DE-JOGO-DA-ARENA.md  🏟️ a arena cria dia de jogo no calendário
│   ├── 23-ARENA-CALENDARIO-E-RESERVA.md 🗓️ auditoria: calendário, reserva, prontidão
│   ├── 25-DIA-DE-JOGO-COMO-MODULO.md ⭐ o dia de jogo igual em toda origem
│   ├── 27-FALHA-NAO-E-VAZIO.md     ⚠️ ⭐ consulta que falha vira "não existe"
│   ├── 26-TORNEIO-FORMATOS-E-REGRAS.md ⭐ grupos, classificação, chaves e o
│   │                                     controle total do admin do torneio
│   ├── 20-SEGURANCA-E-PRIVACIDADE/ 🔴 ⭐ PRIORIDADE MÁXIMA — segurança, LGPD,
│   │   ├── 00-INDEX.md                documentos legais, imagem, admin
│   │   ├── 01-AUDITORIA-ACHADOS.md    ⚠ 31 achados, 2 CRÍTICOS ABERTOS
│   │   ├── 05-ADMIN-SUPORTE.md        console de suporte do admin
│   │   ├── 13-PLANO-DE-DESENVOLVIMENTO.md  12 PRs por risco
│   │   └── patches/                   correções PRONTAS (não aplicadas)
│   │
│   └── FUTURO/                     📐 desenhado, NADA no código
│       ├── 00-INDEX.md             ⭐ as 4 funcionalidades futuras
│       ├── GAMIFICACAO/            🎮 progressão V2 (flag existe, OFF)
│       ├── MERCADO/                🛒 marketplace aberto (15 docs)
│       ├── FEED/                   📣 rede social / Instagram (14 docs)
│       ├── CONFIANCA-E-MODERACAO/  🛡️ moderação compartilhada (6 docs)
│       └── PLANO-MESTRE-MERCADO-FEED.md 🗺️ cronograma das 3 ondas
│
├── src/
│   ├── App.jsx                     # roteamento
│   ├── core/                       # ⭐ auth, firebase, logger, feature flags
│   ├── modules/                    # ⭐ BASE DE DOMÍNIO (19 módulos)
│   │   ├── tournament/README.md
│   │   ├── arenas/README.md
│   │   ├── coaches/README.md
│   │   ├── clubs/README.md
│   │   ├── help/README.md          🎓 conteúdo dos tutoriais em tela
│   │   └── ... (15 mais)
│   ├── v2/                         # ⭐ APP ATIVO (Athleisure Premium)
│   │   ├── pages/                  # 67 páginas V2
│   │   ├── components/             # V2Layout, FeatureFlagGuard, ...
│   │   └── ui/primitives.jsx       # V2Button, V2Card, V2Badge, ...
│   ├── pages/                      # V1 legado (em desuso)
│   └── components/                 # shadcn/ui primitives
│
├── firestore.rules                 # ⭐ regras de segurança (94 coleções)
├── firestore.indexes.json          # índices compostos
├── firebase.json                   # config hosting
├── functions/                      # Cloud Functions (region SP)
├── public/                         # assets, PWA
└── .github/workflows/
    ├── deploy-firebase.yml         # ⭐ push em main → deploy
    ├── ci.yml                      # lint + test em PR
    └── deploy-pages.yml            # legado
```

**Ordem de leitura sugerida (se você tem 1 hora):**
1. `docs/01-AI-CONTEXT.md` (15 min) — panorama condensado
2. `src/modules/<módulo>/README.md` do módulo que você vai tocar (5 min)
3. `docs/02-STANDARDS.md` (10 min) — como codar
4. `docs/03-WORKFLOW.md` (5 min) — git/deploy
5. `docs/06-MODULES.md` § relevante (5 min) — mapa do módulo
6. `docs/09-UX-ANALYSIS/15-backlog-remanescente.md` (5 min) — o que ainda falta
7. Código (5-10 min) — localizar arquivos

**Ordem de leitura sugerida (se você tem 5 minutos):**
1. §0 TL;DR deste arquivo
2. `docs/01-AI-CONTEXT.md` §1-3 (o que é, stack, arquitetura)
3. `docs/06-MODULES.md` § módulo que vai tocar

---

## 4. Mapa rápido "onde está X"

**"Onde está o SCHEMA do Firestore?"** → `docs/05-DATA-MODEL.md` + `firestore.rules`
**"Onde estão as FLAGS?"** → `src/core/featureFlags.js` (124) + `featureFlagGroups.js` (agrupadas)
**"Onde está a TELA X?"** → `src/v2/pages/V2Xxx.jsx` (R2 → module/pages)
**"Onde está o COMPONENTE X?"** → `src/v2/components/Xxx.jsx` ou `src/v2/ui/primitives.jsx`
**"Onde está a REGRA DE NEGÓCIO X?"** → `src/modules/X/domain/*.js` (sempre com `.test.js` ao lado)
**"Onde está o SERVICE do Firestore?"** → `src/modules/X/services/*.js`
**"Onde está o HOOK React Query?"** → `src/modules/X/hooks/*.js`
**"Onde está a RULE de segurança X?"** → `firestore.rules` (match /<coleção>/)
**"Onde está o CLOUD FUNCTION X?"** → `functions/index.js`
**"Onde está o TESTE X?"** → `*.test.js` ao lado do arquivo; `*.runtime.test.jsx` em `src/v2/pages/` para componentes críticos
**"Onde está a FEATURE que não existe mas devia?"** → `docs/09-UX-ANALYSIS/15-backlog-remanescente.md`
**"Qual NÍVEL o sorteio usa?"** → `docs/13-NIVEL-UNIFICADO.md` (régua 2.0–8.0: DUPR → rating da plataforma → ELO → nível declarado) · código em `src/modules/rating/domain/unifiedLevel.js`
**"Onde está a GAMIFICAÇÃO?"** → `docs/FUTURO/GAMIFICACAO/README.md` (flag `gamification_v2`, default OFF)
**"Onde está o TELÃO do dia de jogo?"** → `src/v2/pages/V2GameDayTelao.jsx` · rota `/dia-de-jogo/:id/telao` (em `src/App.jsx`, fora do V2Layout) · doc em `docs/14-DIA-DE-JOGO-TELAO.md`
**"Quem pode sortear/substituir/criar partida num dia de jogo?"** → `docs/15-DIA-DE-JOGO-PERMISSOES.md` · código em `src/modules/games/domain/gameDayRoles.js` (fonte única)
**"Por que as partidas do Play saem sempre com as mesmas pessoas?"** → era a fila em blocos de 4; resolvido pelo rodízio equilibrado atrás da flag `play_smart_rotation` (padrão OFF) · `docs/16-DIA-DE-JOGO-RODIZIO.md` · código em `src/modules/games/domain/playRotation.js`
**"O dia de jogo funciona igual no clube, na arena e no atleta?"** → ⭐ `docs/25-DIA-DE-JOGO-COMO-MODULO.md`. **Sim, e desde a Onda AS também o ARMAZENAMENTO**: toda data NOVA de evento de clube nasce como um `game_days` (campo `game_day_id` na data), como já era no atleta e na arena. Duas fontes únicas: `buildGameDayDraw` (`modules/games/services/gameDayDrawPlanner.js`) para o SORTEIO de grade e `GameDayModule` (`src/v2/components/games/GameDayModule.jsx`) para o MIOLO (a visão por formato + tutorial + telão). **Nunca** chame `generateGameDayGames`/`generateMexicanoSchedule`/`kingOfCourtFirstRound` nem monte o `? :` dos organizadores numa tela: `src/core/guards/diaDeJogoUniforme.test.js` lê o código-fonte e reprova. 🐞 Antes eram QUATRO cópias do mesmo switch e DUAS do mesmo `handleDraw`, e elas divergiram: o clube ficou sem Play, sem Americano aprimorado e sem telão — sem nada na tela avisar. A origem só pode mudar TRÊS coisas: onde nasce, quem organiza e o que o local acrescenta (a arena fecha quadra; o clube tem chat e RSVP por data)
**"O dia de jogo do CLUBE mudou. E o que já está publicado?"** → ⭐ **nada foi migrado, e não vai ser.** A pergunta que separa é UMA: `isModularEventDate(date)` — `club_events/{id}/dates/{id}.game_day_id` preenchido ⇒ módulo (`game_days`); ausente ⇒ legado, servido pelo `GameDayOrganizer` de sempre, lendo e escrevendo nas mesmas subcoleções. Quem faz a pergunta é `src/v2/components/clubs/ClubGameDayTab.jsx`, e é o ÚNICO lugar que a faz (guarda de fonte). O legado encolhe sozinho. Ver `docs/25-DIA-DE-JOGO-COMO-MODULO.md` §5
**"Quem organiza o dia de jogo do clube?"** → quem agendou a data (criador), os administradores NOMEADOS e **quem administra o CLUBE** (`isClubGameDayManagerOf` no `firestore.rules`, guardada por `'club_id' in …`). O dia nasce `manage_mode: 'participants'` de propósito — no evento legado qualquer membro mexia em participantes e jogos, e nascer restrito tiraria da comunidade algo que ela já tinha. O membro do clube LÊ o dia (`isClubGameDayMemberOf`) e **entra e sai sozinho**. Na tela, pergunte sempre a `useGameDayRoles`, que soma arena e clube num lugar só
**"Onde se edita/arquiva um dia de jogo de clube?"** → na **DATA do evento**, não em `/dia-de-jogo/:id` (que mostra "Gerir no clube"). A data manda em título, horário, local e existência; a aba de jogos manda no FORMATO, e só enquanto não houver partidas — trocar depois não é edição, é perda (o Play não guarda placar; Mexicano e Rei da Quadra derivam as rodadas do que já aconteceu). E **nunca** abra `CreateGameDayDialog` num dia de clube: ele grava a `visibility` junto, e público ali significa legível e auto-inscrevível por qualquer conta
**"Como o torneio organiza grupos, classificação e chaves? O que o admin pode mudar?"** → ⭐ `docs/26-TORNEIO-FORMATOS-E-REGRAS.md`. Existe um PADRÃO bom (regulamento USA Pickleball + práticas dos circuitos) e **o admin do torneio pode trocar tudo**, com explicação ao lado de cada controle. Configurável: tamanhos dos grupos à mão, turnos (ida/ida e volta), classificados grupo a grupo, repescagem (quantas vagas e de qual colocação), **ordem dos critérios de desempate** (9 critérios, 4 ordens prontas), **método de comparação entre grupos** (aproveitamento / absoluto / descartar o último) e **entrada direta** (quem pula fases). Todo campo é ADITIVO: em branco, a fase se comporta como antes. Zero coleção, zero índice, zero regra — tudo em `tournament_modalities.stages[]`, que não tem lista fechada de campos
**"Vou escrever `const { data = [] } = useX()` numa tela"**  → ⚠️ leia `docs/27-FALHA-NAO-E-VAZIO.md`. Consulta que FALHA devolve indefinido, cai no `[]` e a tela conclui que **não existe nada** — e afirma isso. Medido: **28 de 30** telas de dia de jogo e torneio faziam isso. Dizia *"Nenhum dia de jogo ainda"* para quem tem dez, *"Dia de jogo não encontrado — pode ter sido removido ou você não tem acesso"* na beira da quadra, *"Torneio não encontrado. Verifique o link"* com o link certo. Se a tela vai AFIRMAR algo do vazio, ela precisa de `isError` + `<V2ErrorState onRetry={refetch} />`. Guarda em `src/core/guards/falhaNaoEVazio.test.js`
**"Vou mostrar um erro de carregamento"** → `<V2ErrorState />` (`src/v2/ui/primitives.jsx`), nunca um bloco escrito à mão — havia SETE cópias. `inline` para uma seção que falhou dentro de uma tela que carregou. E `podeAfirmarVazio(consulta)` (`core/lib/queryState.js`) responde à pergunta que a tela realmente faz
**"🐞 O sorteio pode apagar jogo já disputado?"** → podia, e por uma queda de rede: `useMatches` falhando ⇒ `matches = []` ⇒ o botão vira **Sortear** (não "Re-sortear"), o diálogo diz que vai GERAR **sem mencionar que apaga**, e `persistMatches` apaga tudo. Agora a tela **não renderiza** comando sobre estado desconhecido, e o serviço tranca de novo por `canDiscardStageMatches` (`domain/drawSafety.js`): descartar jogo COM RESULTADO exige `replacesKnownMatches`, que só é verdadeiro quando a tela VIU os jogos. Jogo sem resultado não é protegido de propósito — confirmação demais treina a pessoa a clicar em "sim" sem ler
**"O dia de jogo diz qual é o FORMATO dele?"** → agora sim. Não dizia: o cabeçalho tinha título, origem, data e observações, e a LISTA da arena mostrava mais que o detalhe. `describeGameDayRules` (`modules/games/domain/gameDayRules.js`) + `GameDayRulesCard`, montado **dentro do `GameDayModule`** para chegar às três origens por construção
**"Em quais formatos a dupla vinculada vale?"** (predicado) → `formatHonorsFixedPairs(format)` em `gameDayRules.js`. Mexicano e Rei da Quadra **não** — neles as duplas saem da classificação da rodada, que é o que define os dois formatos
**"Mexi na aba de SORTEIO do torneio"**  → ela tem **DOIS ramos**, e ferramenta acrescentada num só **não dá erro**: `V2TournamentDrawTab` manda uma fase para o `ModalityDrawBlock` (no próprio arquivo) e várias fases para o `MultiPhaseDrawBlock`. 🐞 A Onda AT montou o planejador de grupos e a **entrada direta** só no primeiro — e `DirectEntryPanel` começa com `if (fases.length < 2) return null`, ou seja, a funcionalidade-título daquela onda foi montada exatamente no ramo onde ela NUNCA renderiza, e faltava no único ramo em que "pular fases" quer dizer algo. Cada tela, isolada, funcionava. `src/core/guards/torneioRegras.test.js` reprova quem montar `StageExplanation`/`DirectEntryPanel` num ramo só
**"Quem vai passar para a próxima fase?"** → a tela MOSTRA antes do clique (`NextPhasePreview`), e a prévia sai de `previewPhaseAdvance` (`domain/phaseAdvancePreview.js`) — a **mesma** função que o serviço usa para gravar. **Nunca** chame `buildNextPhaseEntrants` por fora dela: é a lição do dia de jogo, em que a previsão anunciava uma partida e o sorteio criava outra. Guarda de fonte travando
**"Configurei a fase em Modalidades e sorteio em Sorteio — como sei o que está valendo?"** → `describePhaseRules` (`domain/phaseRules.js`) + `PhaseRulesSummary`, na própria fase. Mostra por padrão só o que o organizador MUDOU (repetir o padrão para todo mundo vira paredão que ninguém lê) e **some** com a linha que não se aplica — repescagem não existe na última fase, entrada direta não existe na primeira
**"Vou traduzir uma inscrição em `entrant` fora do serviço"** → `registrationToEntrant` (`domain/registrationEntrant.js`). Cópia que diverge aqui é silenciosa: o `strength` é o que ordena os cabeças, e uma tela passaria a ordenar diferente da outra sem erro nenhum
**"O tutorial/a ajuda ainda valem depois que mudei a regra?"** → 🐞 não valiam: a Onda AR trocou o gatilho do ranking de torneio do ENCERRAMENTO para o LANÇAMENTO, e o tutorial seguia afirmando *"torneio ainda em andamento não pontua. É de propósito"*. Há guarda comparando o que a ajuda afirma contra `RANKING_ELIGIBLE_STATUSES`
**"Chegaram 19 inscritos. Em quantos grupos eu divido?"** → o planejador responde: `suggestGroupPlans(19, { qualifiersPerGroup: 2 })` (`domain/groupPlan.js`) devolve as divisões viáveis com jogos, jogos por atleta, classificados e se a chave fecha. A tela de sorteio mostra isso ANTES de clicar, com o número REAL de inscritos. Tamanho bom é **4 ou 5**; grupo de 2 é bloqueado; grupo de 3 pede **ida e volta** (`round_robin_legs: 2`). 🐞 Antes a tela avisava "para grupos do mesmo tamanho use um múltiplo de 4", que é pedir para o inscrito desistir — grupo desigual é o caso NORMAL, e o que ele exige é a regra de comparação certa, não um inscrito a mais
**"Grupos de tamanhos diferentes: como comparar quem veio de cada um?"** → por **COLOCAÇÃO primeiro** (todos os 1ºs, depois os 2ºs) e, dentro dela, por **APROVEITAMENTO** — vitórias e saldo ÷ partidas jogadas (`domain/crossGroup.js`). 3 vitórias em 3 vale mais que 3 em 4. O admin pode trocar para absoluto ou para "descartar o jogo contra o último de cada grupo" (regra da FIFA). **Nunca** compare vitórias absolutas entre grupos desiguais por conta própria
**"Faltam/sobram classificados para fechar a chave"** → `bracketFit(n)` diz as duas saídas: quantos **repescar** para encher a chave atual e quantos **tirar** para caber na menor. A repescagem (`wildcard_slots`) pega os melhores da colocação seguinte ao corte — e um 4º NUNCA entra na frente de um 3º, porque a repescagem compara IGUAIS
**"Como se desempata dentro do grupo?"** → vitórias → **confronto direto** → saldo → saldo no confronto direto → pontos a favor → pontos sofridos (USA Pickleball 15.B.4). Fonte ÚNICA em `domain/tiebreak.js`, usada na classificação do grupo, no ranking da modalidade e na progressão entre fases. 🐞 Antes a regra vivia duplicada em dois arquivos e **nenhuma das duas tinha confronto direto** — a reclamação nº 1 de quadra ("mas eu ganhei dele"). Empate de três+ usa **mini-tabela** entre os empatados, recalculada a cada nível. Quem não se enfrentou: critério PULADO, nunca inventado. A ORDEM é configurável por fase
**"Quero que alguém entre direto numa fase mais à frente, pulando fases"** → ⭐ é a **entrada direta** (`direct_entry` na fase, `domain/directEntry.js`). Dois modos: os **N melhores cabeças** (modelo de qualificatória — os fortes esperam, os outros disputam as vagas) ou uma **lista a dedo** (campeão defendendo título, convidado). Quem entra direto na fase 3 pula as fases 1 e 2: não entra no sorteio nem na classificação delas. Configura-se na **aba de sorteio**, onde os NOMES existem. Regras: entra uma vez só (vale a fase mais cedo, com aviso), a 1ª fase precisa sobrar com ≥2 (senão é ERRO na tela), e numa próxima fase de grupos os diretos são ESPALHADOS
**"Chave com número de inscritos que não é potência de 2"** → os byes vão para os **melhores cabeças** (regra do DUPR), e são sempre exatamente `tamanho − inscritos`. 🐞 Antes os não-cabeças eram despejados nos slots da esquerda para a direita: uma chave de 16 com 9 inscritos nascia com **TRÊS partidas de ninguém contra ninguém** (gravadas como W.O.) e um bye dado a quem calhasse; e a ordem canônica estava espelhada (o nº 1 pegava o nº 5 na estreia em vez do nº 8). **Nunca** preencha chave da esquerda para a direita: todo mundo entra pela posição canônica do seu número (`bracketSeedOrder`)
**"Em quais formatos a dupla vinculada vale?"** → Play, Americano aprimorado e Americano de grade: **sim**. Mexicano e Rei da Quadra: **não**, e a tela AVISA (`fixedPairsIgnored`) em vez de ignorar calada — neles as duplas saem da classificação da rodada e do resultado da anterior, que é o que define os dois formatos. E o vínculo tem de valer em **TRÊS momentos**: quem joga a rodada, em que grupo de 4, e de que LADO. Só o terceiro ⇒ a dupla vai para quadras diferentes; só os dois primeiros ⇒ ela joga uma CONTRA a outra (foi o defeito relatado). Ver `docs/25-DIA-DE-JOGO-COMO-MODULO.md` §4
**"Vinculei uma dupla e ela não jogou junta"** → era o caso no Americano aprimorado, e a causa é sutil: o vínculo valia ao escolher **QUEM** entra (`respectsFixedPairs`) e não ao escolher **COMO** os quatro se dividem — `pairFourBalanced` recebe IDS e não tinha como saber quem estava vinculado. Na primeira partida eles saíam juntos por acaso; da segunda em diante aquela parceria já custava 10 no histórico e o motor os colocava como **adversários**. Agora `fixedPairsWithin(ids, participantes)` (`americanoLive.js`) traduz os `partner_id` mútuos e é passada em TODO caminho de sorteio (partida avulsa, rede, custo do grupo na rodada, previsão). O vínculo é **filtro antes do custo**, não mais um critério dentro dele: as demais regras decidem só entre as formações que o respeitam. E a parceria vinculada **não é cobrada como repetição** — se fosse, o custo do grupo cresceria 10 por partida e a dupla passaria a ser evitada. Ao criar caminho novo de sorteio, **nunca** chame `pairFourBalanced` sem `fixedPairs`. Ver `docs/17-DIA-DE-JOGO-AMERICANO-APRIMORADO.md` §4a
**"Cliquei no jogador em quadra: quero escolher entre deixá-lo de fora e trocá-lo por alguém"** → é o que acontece — o clique abre `CourtPlayerDialog` (exportado de `AthletePlayOrganizer.jsx`), com as duas opções; a lista de quem pode entrar vem de `eligibleSwapReplacements` e é reconferida no serviço. Vale no painel E no telão. Ver `docs/14-DIA-DE-JOGO-TELAO.md`
**"No Americano aprimorado, como corrijo a quadra: trocar quem está jogando ou desfazer o sorteio?"** → tocando no NOME de quem está em quadra (abre `CourtPlayerDialog`: deixar de fora × substituir) e em **Cancelar partida** (devolve os quatro à fila, sem placar). Vale no painel E no telão — antes só existia no telão, e desfazer um sorteio no painel exigia lançar um resultado que não aconteceu e apagá-lo depois, ou seja, um placar falso atravessando o ranking do dia. `cancelPlayGame` **recusa** partida que já tem placar: aquela sai pela lista de partidas concluídas, que re-sincroniza o ranking. Ver `docs/17-DIA-DE-JOGO-AMERICANO-APRIMORADO.md` §6b
**"No Americano aprimorado, por que não saem todas as duplas possíveis?"** → porque sortear quadra a quadra é GULOSO: a primeira quadra leva o melhor quarteto e a última herda o que sobrou — e com atletas = 4 × quadras a última nem tem escolha. Medido em dia inteiro com elenco estável: 8 em 2 quadras formavam **12 das 28 duplas**; 12 em 3, **18 de 66**. Agora a rodada é escolhida como um TODO (`bestAmericanoLiveRound`) e dá 28/28 e 66/66. Os grupos de uma rodada são DISJUNTOS, então o custo da rodada é a soma dos custos dos grupos sobre o mesmo histórico — é isso que torna a otimização barata. Com UMA quadra livre nada disso roda: o caminho é o de antes, partida a partida. E a frente da fila é obrigatória na rodada, senão a busca por variedade empurra sempre a mesma pessoa para fora. Ver `docs/17-DIA-DE-JOGO-AMERICANO-APRIMORADO.md` §4b
**"Quero um Americano em que as partidas saiam UMA A UMA, quadra por quadra, mas COM placar"** → é o **Americano aprimorado** (`americano_live`), atrás da flag `gameday_americano_live` (default OFF). Organização do Play (fila, pausa, dupla fixa, entra/sai a qualquer hora) + placar, ranking do dia e publicação no ranking/rating/DUPR do Americano. O fluxo é de DOIS passos: **"Lançar resultado"** libera a quadra, e só então aparece **"Gerar próxima partida"** — não junte os dois. Código em `src/modules/games/domain/americanoLive.js` e `src/v2/components/games/AthleteAmericanoLiveOrganizer.jsx`; doc em `docs/17-DIA-DE-JOGO-AMERICANO-APRIMORADO.md`
**"O telão mudou com o formato novo?"** → sim, ganhou um terceiro arranjo (quadras + previsão com duplas + partidas concluídas com placar + ranking do dia). `buildGameDayBoard` agora aceita `format` (OPCIONAL): informado, ele decide `isCourtByCourt`/`hasScores`; omitido, a inferência antiga vale bit a bit. Ver `docs/14-DIA-DE-JOGO-TELAO.md` §2.2
**"Onde está o botão de recalcular ranking/rating?"** → **não existe mais**, de propósito. Havia quatro (console e métricas do admin, ranking 2.0–8.0, pós-migração de inscrições e ranking interno do clube) e todos saíram: botão de recalcular mente sobre de quem é a responsabilidade (só o admin da plataforma escreve ranking, então quem publicava dependia de OUTRA pessoa lembrar), compete com o gatilho que já faz a conta, e esconde o defeito quando algo não entra. No lugar, o painel `RankingAutomatico` EXPLICA o que dispara o quê. O cliente também parou de tentar materializar ranking ao publicar — era recusado pela regra e custava ler a coleção inteira de torneios. Guarda em `src/core/guards/diaDeJogoUniforme.test.js`. Ver `docs/18-RANKINGS.md` §8
**"O resultado de TORNEIO conta a partir de quando?"** → do **lançamento**, não do encerramento. Em torneio o lançamento não é facultativo: o placar é lançado porque a partida aconteceu. 🐞 A elegibilidade exigia `status === 'finished'`, e num torneio de três dias nada aparecia no rating até alguém clicar em "encerrar" — às vezes nunca. Segue de fora o que não é resultado de verdade: **rascunho** (ambiente de teste), **cancelado**, **privado** e **arquivado**; e como o recálculo é integral, cancelar ou arquivar TIRA do ranking o que já contou. No **dia de jogo** é o contrário e continua sendo: o gatilho é a **PUBLICAÇÃO**, porque ali lançar no ranking é decisão de quem organiza. A regra vive em `isTournamentRankingEligible` (cliente) e `isEligible` (`functions/ranking.js`) — **as duas cópias têm teste de paridade**. Ver `docs/18-RANKINGS.md` §3
**"Quando o ranking/rating atualiza depois de publicar um resultado?"** → **na hora**. Gatilhos do Firestore (`functions/index.js`) recalculam os TRÊS rankings de partida — ELO/nacional, rating 2.0–8.0 e duplas — a cada escrita em `club_event_games`, `tournament_matches` ou mudança de elegibilidade de torneio. Roda no SERVIDOR porque a regra só deixa o admin escrever ranking, e quem publica quase nunca é o admin (antes a tentativa do cliente era recusada em silêncio). Rajadas são coalescidas por um lease em `platform_settings/ranking_worker`. Ver `docs/18-RANKINGS.md`
**"Como o ranking de DUPLAS é classificado?"** → aproveitamento → mais vitórias → menos derrotas → saldo de pontos. A regra vive em `compareDoublesRows` (`src/modules/rating/domain/doublesRanking.js`), a classificação é gravada em `doubles_rankings` pelo servidor (campo `position`) e a tela **não reordena** — só filtra e pagina (20/50/100, estado na URL)
**"Quero um piso de jogos para a dupla entrar no ranking"** → é a **amostra mínima** (Todas / 3+ / 5+ / 10+ / 20+), escolhida por CADA usuário e salva no navegador (`v2:view:<uid>:ranking:duplas:min-jogos`, via `src/core/lib/viewPreference.js` — **nada no banco**). O recorte RENUMERA dentro dele (a posição geral vai junto, em `overall_position`); a busca por nome, não. Ver `docs/18-RANKINGS.md` §6.1
**"Vou calcular o FIM de um slot de horário"** → `slotEndTime(time, { date, schedules })` (`modules/arenas/domain/slot_status.js`). **NUNCA** derive do "próximo horário da lista": numa arena com horário partido (manhã e noite) a grade tem buracos, e isso gerava reserva de NOVE HORAS — bug real, corrigido. `hora + 1` cego também não serve: passa do fechamento numa janela que acaba às 21:30. Ver `docs/23-ARENA-CALENDARIO-E-RESERVA.md` §1
**"Como o atleta reserva uma quadra?"** → **calendário (o DIA) → grade (QUADRA e HORÁRIOS) → confirmar (avulsa ou recorrente, observações, convidados)**. A segunda tela CONFIRMA, não re-pergunta: `BookingRequestDialog` recebe `selection` e mostra a escolha agrupada por quadra. Sem `selection` (botão "Solicitar reserva" da página da arena) ele segue sendo o formulário completo de antes — há teste travando os dois modos. Ver `docs/23-ARENA-CALENDARIO-E-RESERVA.md` §6
**"Quero pedir mais de uma quadra e mais de um horário no mesmo dia"** → pode. A escolha é uma lista de CÉLULAS (`{ court_id, date, start, end }`, com `court_id: null` = "tanto faz") em `modules/arenas/domain/bookingSelection.js`; `groupSelectionByCourt` junta as quadras com os MESMOS horários e separa as que não têm, e `createBookingsForSelection` valida TODOS os pares antes de escrever e grava num lote só (tudo ou nada, com `booking_group_id` comum). **Nenhum campo novo no documento.** Não use `createBooking` para isso: ele grava uma reserva por quadra com os MESMOS horários para todas
**"Quanto custa a reserva?"** → `totalBookingPrice(arena, { courtId, slots })` (`modules/arenas/domain/pricing.js`). **NUNCA** grave o retorno de `resolveArenaPrice` como preço da reserva: ele é o valor **por hora**, e isso era um bug real — três horas selecionadas chegavam à arena valendo uma, na tela E no campo gravado. O serviço refaz a conta antes de escrever (`precoDaReserva`), nos dois caminhos de criação. Para MOSTRAR, `bookingPriceInfo(booking, { arena })`: o acordado vence, com a arena em mãos recalcula (corrige as reservas antigas) e o número nunca sai sem a duração ao lado. Ver `docs/23-ARENA-CALENDARIO-E-RESERVA.md` §8
**"A arena demora a abrir"** → o caminho já está pavimentado, siga-o: (1) toda consulta de arena nasce em `modules/arenas/hooks/arenaQueries.js` + `arenaKeys.js` — **nunca escreva `queryKey` de arena à mão**, porque a pré-busca e o hook têm de bater bit a bit e chave divergente não dá erro, só faz buscar de novo o que já estava em cache (há teste lendo o código-fonte); (2) link para uma arena chama `useArenaPrefetch()` no `onMouseEnter`/`onFocus`/`onTouchStart` — as consultas saem enquanto o pacote da tela baixa; (3) `useArena` já vem semeado pelo cache da lista; (4) aba pesada entra por `lazy` com `<Suspense>` em volta **só da área das abas**. E o que NÃO fazer: recortar reservas por data no servidor é impossível hoje (a data mora dentro de `slots`, que é vetor) — "resolver" isso pede campo novo ou índice novo, ou seja, mexer no banco, e as reservas antigas sumiriam do filtro. Ver `docs/23-ARENA-CALENDARIO-E-RESERVA.md` §11
**"Vou mostrar uma data na tela"** → `formatSlotLabel(slot)` / `formatDateShortBR(date)` (`modules/arenas/domain/calendar.js`), nunca a ISO crua: `2026-07-23 · 19:00` era o que a reserva mostrava ao atleta e à arena, e no Brasil ninguém lê data assim. O dia da semana vem junto, e o ANO aparece quando não é o corrente ("23/07" numa reserva de 2027 é armadilha). São montadas das constantes do módulo, não de `toLocaleDateString`, para não depender da configuração da máquina. Ver `docs/23-ARENA-CALENDARIO-E-RESERVA.md` §13
**"Vou escrever uma consulta com `orderBy`"** → se houver `where` junto, ela exige **índice composto** — e sem ele **falha**, não devolve menos. Como o padrão do projeto é `const { data = [] } = useX()`, o erro vira lista vazia e a tela mente em silêncio: `listArenaUnavailabilities` estava assim desde que foi escrita (o calendário NUNCA recebeu um bloqueio, e o sintoma que apareceu meses depois foi "o dia de jogo não fecha a quadra"), e com ela `listArenaTournaments`, as duas da fila de espera e a de checklists. O padrão do projeto é **um `where` só, ordenação em memória** (como `listArenaGameDays`); com `limit`, mova o corte junto, senão você corta antes de ordenar. `src/core/guards/indicesCompostos.test.js` reprova quem reintroduzir a combinação sem índice. Ver `docs/22-DIA-DE-JOGO-DA-ARENA.md`
**"Lista vazia na tela"** → confira se não é FALHA. Consulta que falha devolve `[]`, e `[]` costuma ter um significado próprio: o calendário dizia "esta arena não publicou horários" e a lista dizia "Nenhuma arena encontrada. Cadastre uma arena" quando o problema era a rede. Trate `isError` com texto próprio e botão de **Tentar de novo**; e enquanto CARREGA não afirme ocupação — mês sem reserva carregada parece mês inteiro livre. Ver `docs/23-ARENA-CALENDARIO-E-RESERVA.md` §12
**"O calendário do mês não mostra direito a ocupação"** → passe `courts` a `aggregateDayStatus`. Sem isso a arena inteira é contada como UMA quadra: uma reserva às 19h pintava as 19h de ocupado com as outras duas quadras livres. Com `courts`, a conta é em **horas-quadra** e vêm `total`, `occupancy`, `freeTimes` (horários com pelo menos uma quadra livre) e `openTimes` — é o que alimenta a barra de ocupação e o rótulo "4h livres / Lotado / Bloqueado" de cada dia. Mês sem vaga nenhuma não é beco: `findFirstFreeDate` diz qual é o próximo dia livre. E indexe por data (`indexBookingsByDate`) antes de varrer 42 dias × quadras. Ver `docs/23-ARENA-CALENDARIO-E-RESERVA.md` §9
**"O atleta quer ver quais QUADRAS estão livres num horário"** → é a matriz `CourtTimePicker` (seletor **Por horário / Por quadra** no diálogo do dia). Antes ele via só "2/3 quadras livres", sem saber quais. A do atleta NÃO é a do admin (`CourtDayGrid`): não mostra nome de quem reservou, só o que está livre é clicável, e clicar ESCOLHE a quadra — que agora chega ao pedido de reserva e ao preço. **Uma reserva, uma quadra**
**"Cadastrei a quadra e ninguém consegue reservar"** → quadra **sem janela de horário** é invisível: fora do calendário, fora da reserva, fora do dia de jogo. Isso hoje é avisado em três alturas (linha da quadra, topo da aba Quadras, painel de prontidão na Central da arena). Domínio: `courtScheduleStatus` / `courtsWithoutSchedule` em `court_schedule.js`. Janela **sem `court_id` vale para a arena inteira**; quadra inativa nunca vira alarme. Ver `docs/23-ARENA-CALENDARIO-E-RESERVA.md` §4
**"A arena quer criar o PRÓPRIO dia de jogo, marcado no calendário"** → é o **dia de jogo da arena** (flag `arena_game_day`, default OFF). **Nenhuma coleção nova**: é o mesmo `game_days`, com campos aditivos (`arena_id`, `arena_slots`, `signup_mode`, `capacity`). Ausente `arena_id`, nada muda — o dia de jogo do atleta segue idêntico. Fechar a quadra no calendário também não é código novo: grava `arena_unavailabilities` com `source: 'game_day'`, e conflito de reserva, status de slot e calendário mensal já respeitam. Domínio em `src/modules/games/domain/arenaGameDay.js`; arena em `/arenas/:id/gerir/dia-de-jogo`, atleta na página da arena + `/dia-de-jogo/:id` de sempre. Ver `docs/22-DIA-DE-JOGO-DA-ARENA.md`
**"O dia de jogo da arena não está fechando a quadra no calendário"** → era o caso, e foi corrigido na raiz: a quadra fechada saía SÓ da cópia gravada em `arena_unavailabilities`, e cópia que não chega deixa o calendário oferecendo uma quadra ocupada. Agora o **dia de jogo é a fonte**: `gameDayBlocks`/`mergeGameDayBlocks` (`modules/games/domain/arenaGameDay.js`) derivam os bloqueios dele, no mesmo formato, e as telas somam gravados + derivados sem duplicar. Use o merge para calcular STATUS (calendário, grade do dia, conflito), **nunca** para LISTAR bloqueios numa tela de gestão — o derivado não tem documento, e um botão de apagar apontaria para o nada. E o BLOQUEIO nunca depende de feature flag: a flag gateia o que se mostra, não se a quadra está ocupada. Ver `docs/22-DIA-DE-JOGO-DA-ARENA.md`
**"Vou criar/validar uma reserva"** → conferir outras RESERVAS não basta. O serviço ignorava os bloqueios da arena, e o formulário completo de reserva (o que pede data e hora digitadas) não passa pelo calendário — dava para pedir exatamente a quadra fechada, ou a que está com um dia de jogo em cima. `checkUnavailabilityConflict` + `unavailabilityConflictMessage` (`modules/arenas/domain/booking_conflict.js`) recusam **dizendo o motivo**, e valem nos três caminhos: `createBooking`, `createBookingsForSelection` e `createManualBooking` (a arena também não se atropela). Encostar não é sobrepor; bloqueio sem `court_id` fecha a arena inteira
**"Com 8 jogadores e 2 quadras, os jogos saem sempre entre os mesmos"** → era isso mesmo, e não é defeito do sorteio: é o MOMENTO. Quando a quadra 1 termina, os únicos 4 na fila são os 4 que saíram dela, então voltam para ela. Com quatro pessoas na fila só existe um grupo possível. A saída é **sortear a rodada**: encerre sem sortear (no Play, "Só encerrar"; no Americano aprimorado lançar o resultado já libera) e, com as quadras livres, **"Sortear todas as quadras"** distribui a fila inteira. `drawPlayRoundForFreeCourts` (`playRotation.js`) e `drawAmericanoLiveRoundForFreeCourts` (`americanoLive.js`) saem da PREVISÃO (`simulatePlaySequence` / `forecastAmericanoLiveMatches`) — nunca sorteie por outro caminho, ou a tela anuncia uma partida e cria outra (há teste travando). O serviço grava a rodada num lote só. Vale nas três telas: painel do atleta, painel da arena e telão. Ver `docs/16-DIA-DE-JOGO-RODIZIO.md` §10
**"Quem pode sortear/lançar/editar num dia de jogo?"** → pergunte ao hook `useGameDayRoles(gameDay, participants)` (`podeGerenciar` / `podeConfigurar`), nunca chame `canManageGameDay` direto numa tela. Ele soma os TRÊS caminhos: criador, administrador nomeado e **gestor da ARENA** (só em dia de jogo com `arena_id`). Não custa consulta — `useMyManagedArenas` já vem do `V2Layout`
**"Dois dias de jogo na mesma quadra e no mesmo dia?"** → pode, em horários diferentes. `findGameDayOverlaps` confere, e **encostar não é sobrepor** (18h–20h e 20h–22h convivem). A mesma conferência roda contra as reservas por `checkBookingConflict`
**"Onde estão os MÓDULOS ADICIONAIS da arena?"** → ⭐ `docs/24-MODULOS-DE-ARENA/00-INDEX.md`. São **três camadas diferentes**, e confundi-las é o erro clássico: (1) a PLATAFORMA libera o módulo às arenas em **Painel admin → Funcionalidades → Módulos de arena** (documento único `platform_settings/arena_modules`, regra que já existia); (2) a ARENA ativa para si em **Gestão → Configurações → Módulos** (`arena_module_states`, que já existia); (3) atleta/professor/equipe passam a ver. Chave-mestra: a flag `arena_modules` (default OFF) — desligada, NADA disso existe. Catálogo em `modules.js` + `moduleCatalog.js`, gate em `moduleAccess.js`
**"Vou gatear uma tela por módulo de arena"** → `useArenaModules(arenaId)` (um hook, DUAS consultas, responde pelos 50 módulos em memória) ou `<ArenaModuleGuard arenaId module={...}>`. **NUNCA** um hook por módulo dentro de um `map`. Módulo desligado não é erro: a seção some, a rota redireciona — nunca renderize desabilitado
**"Vou criar um módulo de arena novo"** → id em `ARENA_MODULE_ID` (**o id é contrato de banco**, está gravado em `arena_module_states.module_id` — nunca renomeie), metadados em `ARENA_MODULE_META`, detalhamento em `ARENA_MODULE_DETAIL` (público, benefício por persona, `status`, `requires`, rotas, `config`). Nasce `planned`, que **não é liberável**. Há teste de integridade do catálogo
**"Por que não faço uma feature flag por módulo de arena?"** → porque são 50, e `FEATURE_FLAG` é liga/desliga de CÓDIGO. Cinquenta linhas ali estourariam a contagem "X ativas de Y" e misturariam dois conceitos. A liberação por módulo tem modo (`opt_in`/`forced`) e observação, e mora no documento da camada 1
**"Uma regra do Firestore recusa `delete` sem motivo aparente"** → confira se a condição olha `request.resource.data`: num **delete** ele NÃO EXISTE, e a regra é sempre falsa. Já foi corrigido em `arena_unavailabilities` (Onda AA) e, em 2026-09-13, em mais **onze** coleções de arena, onde ninguém conseguia apagar professor, aula, cupom, campanha, checklist, dispositivo, ladder nem item de estoque. O mesmo vale para `read` — a arena nunca conseguiu ler o próprio NPS nem as próprias ordens de manutenção
**"Vou mexer em jogo aberto / fila de espera / buscar parceiro"** → `docs/24-MODULOS-DE-ARENA/01-MATCHMAKING.md`. Três coisas que NÃO podem regredir: (1) a vaga com `court_id` **OCUPA a quadra** (`openSlotBlocks`/`mergeOpenSlotBlocks`, mesmo desenho do dia de jogo — e o bloqueio nunca depende de flag); (2) o nível é a régua única 2.0–8.0 dos DOIS lados, e **nível desconhecido não barra ninguém**; (3) quem sai de um jogo LOTADO chama o próximo da fila, e a Cloud Function `advanceOpenSlotWaitlist` expira o prazo vencido e chama o seguinte
**"Preciso do nível de alguém numa tela"** → `useMyUnifiedLevel()` (o meu) ou `useUnifiedLevels(uids)` (um lote, UMA consulta). **Nunca** `profile.level` nem `leveling_level`: são código de faixa, não número na régua — comparar contra 2.0–8.0 não filtra, filtra errado (era o defeito do "buscar parceiro" e da peneira do jogo aberto)
**"Escrevi uma consulta e a lista vem vazia"** → antes de investigar a tela, rode `npx vitest run src/core/guards/indicesCompostos.test.js`. Ele varre `where` + `orderBy` sem índice **nos dois estilos** de montagem (dentro de `query(...)` e por vetor de constraints) e ignora comentários. Cinco consultas estavam mortas desde que foram escritas — vagas de jogo aberto (duas), catálogo de professores da arena, agenda de aulas e torneios internos
**"Vou mexer no preço de uma reserva"** → confira se passa por `memberBookingPrice` (`arenas/domain/memberBenefit.js`). A ordem da conta é **tabela → horas de pacote → desconto do nível → saldo da carteira**, e o pacote vem ANTES do desconto de propósito (a hora do pacote já foi paga; aplicar percentual sobre ela dá desconto duas vezes — há teste travando). A tela ESTIMA, o serviço REFAZ antes de gravar; e horas e saldo só são CONSUMIDOS na **confirmação**, nunca no pedido — queimar pacote num pedido que a arena pode recusar é cobrar por um jogo que não vai acontecer. Ver `docs/24-MODULOS-DE-ARENA/02-MEMBROS.md`
**"Vou mexer em aula ou professor da arena"** → `docs/24-MODULOS-DE-ARENA/05-AULAS.md`. (1) A matrícula grava **`user_id`** — é o campo que a REGRA confere, e gravar só `athlete_id` fazia o Firestore recusar TODA matrícula em silêncio, desde que a funcionalidade foi escrita. **O nome do campo que a regra usa é contrato.** (2) Aula com `court_id` **OCUPA a quadra** (derivada, como o dia de jogo — `arena_classes` é legível por todos); cancelada ou já dada devolve. (3) O bloqueio de aula **não carrega nome de aluno** — ele é público. (4) A comissão vem da **configuração** do módulo `classes_marketplace`, não de um número no código (eram 50% fixos contra 20% configurados), e professor **da casa não paga comissão**. (5) O professor é reconhecido pelo **`user_id`** em `arena_coaches`: sem o vínculo ele não vê a própria agenda
**"Vou mexer em torneio interno da arena"** → `docs/24-MODULOS-DE-ARENA/06-TORNEIOS-INTERNOS.md`. (1) **Começar o torneio CRIA UM DIA DE JOGO da arena** com os inscritos, no formato escolhido — é o que faz o torneio virar jogo sem reescrever sorteio, placar, ranking do dia e telão; o dia de jogo é criado ANTES de o status mudar, para um erro não deixar o torneio "em andamento" sem jogo nenhum. (2) O formato tem de ser um que o dia de jogo saiba conduzir (`americano`, `americano_live`, `mexicano`, `king`, `play`) — `single_elimination` era guardado e nada o executava. (3) Torneio com `court_ids` **ocupa a quadra** (derivado), mas **para de derivar quando tem `game_day_id`**: o dia de jogo já bloqueia, e contar duas vezes mostra dois bloqueios para o mesmo horário. (4) O **ladder** (`arena_ladders`) era lido e nunca escrito — agora `applyTournamentToLadder` acumula, quem participou leva 10 pontos, e o documento tem id determinístico `arenaId_periodo` (leitura por `getDoc`, sem índice). (5) O `roster` guarda **nome e foto**, não só uid: sem isso o sorteio mostraria identificadores
**"Vou mexer no PDV / venda / dividir a conta"** → `docs/24-MODULOS-DE-ARENA/07-PDV-MARCA-REDE-IA.md`. (1) O estoque baixa na **ENTREGA**, nunca na compra: a regra de `arena_products` só deixa o gestor escrever, então a baixa feita pelo atleta era **recusada** e sobrava uma venda fantasma no banco — e o modelo está certo, reservar o que a arena ainda não entregou conta uma venda que pode não acontecer; a arena **reconfere** antes de baixar, porque entre a compra e a retirada outra pessoa pode levar a última unidade. (2) **Cada pessoa grava o próprio pagamento** (`payer_id == request.auth.uid`): o comprador gravava o de todo mundo, e num `writeBatch` a recusa de um derrubava **todos, o dele inclusive** — a divisão fica em `split_details` e quem entra nela é **avisado**. (3) `created_at_ms` tem de ser GRAVADO — a ordenação do caixa existia e comparava `undefined` com `undefined`; a leitura tem fallback para o `created_at` do servidor, senão o histórico antigo desaba para o fim da lista
**"Vou mexer na marca (cor, logo) da arena"** → `arenas/{id}.branding` (campo opcional do documento da arena, `allow read: if true`), **nunca** `arena_settings.branding`: aquela coleção só o GESTOR lê, e a cor gravada lá nunca teria como chegar à página pública nem ao telão — era o caso, e nada no projeto lia o campo. **O que é público tem de estar onde o público lê.** O texto por cima da cor é escolhido por CONTRASTE (`readableInk`, luminância da WCAG), senão amarelo-limão apaga o cabeçalho inteiro. Domínio em `arenas/domain/whiteLabel.js`; use `brandingOf(arena)` para exibir
**"Vou mexer na previsão / preço sugerido da IA da arena"** → `getHistoricalBookings` devolvia `return []` com o comentário "só para satisfazer a interface": a previsão era **sempre zero** e o preço sugerido não tinha histórico. Agora lê reservas **confirmadas e concluídas** (pedido recusado não é demanda). Sem histórico a tela **não inventa** — diz que falta movimento. E o preço é **sugestão**: nada muda de preço sozinho, quem aplica é a arena. ⚠️ `resolveArenaPrice` devolve um **objeto** `{ price, … }` — usar o retorno cru faz `base > 0` ser sempre falso e o bloco some da tela sem erro nenhum
**"Vou mexer em rede de arenas (multi-unidade)"** → incluir unidade exige as **DUAS** condições: gerir **a unidade** *e* ser **dono da rede**. Só a primeira e eu colocaria a sua unidade na minha rede, passando a ver os números dela no BI; só a segunda e eu poluiria a rede alheia. Criar a rede exige `owner_arena_id` (**é o campo que a regra confere**) e gerir a arena fundadora. `listNetworks()` mostrava **todas as redes da plataforma** para qualquer conta logada — use `listMyNetworks(uid)`. Rede entre donos diferentes continua sendo caso do admin da plataforma
**"Vou mexer em chegada, presença ou no-show da arena"** → `docs/24-MODULOS-DE-ARENA/08-CHEGADA-E-TOTEM.md`. (1) A chegada mora **na própria reserva** (`arena_bookings.checked_in_at`), não numa coleção nova: a regra existente já deixa o titular E o gestor escreverem no documento — **zero regra nova**, com asserção no emulador travando isso (se ela cair, o módulo para em silêncio, com um `permission-denied` genérico que ninguém liga a um check-in). (2) A **falta só é afirmada depois que a janela FECHA** (horário + 30 min): enquanto ela está aberta a pessoa pode estar estacionando, e cobrar multa de quem chegou no horário custa o cliente, não a reserva. (3) A **taxa sai sobre o que já foi DECIDIDO**, não sobre o dia inteiro — dividir pelo total às 9h daria 95% de falta todo dia. (4) O código do totem **gira** (90 s) e morre ao fechar a tela; **só o gestor escreve `arena_devices`**. (5) O totem **não lista nomes** — um cumprimento, primeiro nome, 20 segundos: painel público num corredor com a agenda nominal do dia é exposição que ninguém pediu. (6) Quem chega pelo QR com **um** horário aberto não toca em nada — o caminho curto é a promessa do catálogo
**"Vou acrescentar algo que OCUPA uma quadra"** → entre em `mergeArenaBlocks` (`arenas/domain/arenaBlocks.js`) e em `arenaOccupancy` (`arenas/services/arenaOccupancy.js`), **não** em cada tela. A cadeia estava repetida em CINCO lugares (dois serviços e três calendários) e a que ficasse para trás não dava erro — dava a quadra vendida duas vezes. Fonte opcional: quem não a carregou passa `undefined` e nada muda. Derivado x gravado: derive quando a coleção for legível pelo atleta (dia de jogo, vaga aberta, aula); **grave** quando não for (ordem de manutenção), e aí a cópia chega dentro de `gravados`
**"Vou mexer em checklist, manutenção, estoque ou equipe da arena"** → `docs/24-MODULOS-DE-ARENA/04-OPERACOES.md`. (1) O estado do checklist HOJE sai de `checklistRunState(checklist, hoje)` — ler `checklist.items` direto na tela reintroduz o defeito de o checkmark de ontem aparecer marcado hoje; a virada do dia é feita ao abrir a tela e é **idempotente**. (2) Ordem de manutenção com `blocks_court` **grava** `arena_unavailabilities` (não deriva, ao contrário do dia de jogo — a ordem é privada da arena e o atleta nunca a leria), e **concluir ou cancelar devolve a quadra**; o `sync` só toca documentos com `maintenance_id`. (3) O **motivo** da ordem nunca entra no bloqueio público — ele diz só "Manutenção programada". (4) Marcar "fechar" sem data é ERRO, não bloqueio de zero dias. (5) A equipe (`arena_settings.staff`) **não guarda telefone nem e-mail**. (6) Toda mutação de manutenção invalida o calendário inteiro da arena (`arenaKeys.bloqueiosDaArena`), porque cada recorte de datas é uma consulta diferente
**"Vou mexer em cupom, campanha, NPS, pontos ou indicação"** → `docs/24-MODULOS-DE-ARENA/03-MARKETING.md`. Sete coisas que NÃO podem regredir: (1) o cupom é **reconferido pelo serviço** contra o banco antes de gravar — conferir só no navegador deixa qualquer pessoa gravar um desconto que a arena não criou; (2) o uso do cupom é contabilizado na **confirmação**, nunca no pedido; (3) a campanha mostra **quantas pessoas** vão receber ANTES de enviar, e não envia para zero; (4) o NPS não é perguntado a quem não veio, nem mais de uma vez a cada 90 dias; (5) resgate de pontos e de indicação são escritas da **ARENA** (a regra só deixa o gestor escrever `arena_members` e `arena_wallets` — botão na tela do atleta dá "permissão negada" que ele não tem como resolver); (6) atalho de módulo vem do **catálogo**, não de lista escrita à mão; (7) o serviço de contabilizar cupom **não** se chama `useCoupon` (o ESLint trata `useX` como hook e derruba o lint de quem o chama)
**"Criei uma tela nova de módulo de arena. Como alguém chega nela?"** → `<ArenaModuleShortcuts arenaId audience="manage"|"public" />`. Ele lê `manage`/`public` do catálogo e cruza com o que a arena ligou — rota preenchida vira botão sozinho, nos dois lugares (página da arena e Central). **Não escreva o link à mão**: o console de marketing existia, tinha rota, e nada na plataforma levava até ele — módulo ligado, tela inalcançável. Destinos repetidos viram um botão só
**"Mudei/removi uma rota de tela de módulo de arena"** → o CATÁLOGO promete aquele caminho (`manage`/`public`) e `ArenaModuleShortcuts` monta o botão a partir dele — caminho com erro de digitação **não dá erro**, dá um botão bonito que leva a uma tela em branco, no celular do cliente, na frente da recepção. `src/core/guards/rotasDeModulos.test.js` lê `V2App.jsx` e reprova quem quebrar o par (e exige `:arenaId`, que é o nome que `arenaModuleRoute` troca)
**"A tela precisa saber se um módulo está ligado"** → `useArenaModules(arenaId)` (UM hook, DUAS consultas, responde pelos 50). **Nunca** `useCanArenaUseModule` por módulo, e jamais dentro de um `map`
**"Onde ficam os níveis de membro de uma arena?"** → `arena_settings.member_tiers` (campo opcional), **não** em `arena_tier_configs`: aquela coleção só o admin da plataforma escreve, e a arena ficaria sem poder configurar os próprios níveis. Ausente, valem os padrões (`DEFAULT_TIERS`)
**"Onde está o MANUAL da plataforma?"** → `/ajuda` (flag `help_center`, default OFF): 33 artigos em 5 partes — Começar aqui, **Atleta**, **Arena**, **Professor**, Conta e privacidade. Conteúdo em `src/modules/help/domain/helpCenter.js`, página em `src/v2/pages/V2Help.jsx`. Acesso em três pontos de TODA tela (barra lateral, menu do usuário, gaveta do celular), fora dos hubs de propósito. Link direto por `?s=<seção>&a=<artigo>`. **Nada no Firestore** (só a parte preferida, no localStorage por usuário). Ver `docs/21-CENTRAL-DE-AJUDA.md`
**"Vou colocar um link de ajuda numa tela"** → use `helpLinkFor(location.pathname)`, importado de **`modules/help/domain/helpLink`** (NUNCA de `helpCenter`: aquele arquivo carrega os 33 artigos, e importá-lo de uma tela comum joga o manual inteiro no chunk que todo mundo baixa — 216 kB contra 184 kB, medido; há teste travando isso). Nunca `'/ajuda'` cru. Ele monta `/ajuda?de=<rota>` e a central abre com **"Ajuda para esta tela"** no topo — os artigos daquele assunto, sem a pessoa ter de adivinhar a persona nem varrer a lista. O mapa rota → artigos é `HELP_ROUTE_HINTS`; `*` vale por UM segmento e **vence o primeiro molde que casa**, então o específico vem antes do genérico (teste trava a ordem). Rota sem pista ⇒ bloco nenhum, de propósito: sugestão errada ensina a ignorar o bloco
**"Criei/removi uma tela. O que a ajuda precisa saber?"** → duas coisas: os artigos que citam a tela (`{ type: 'link', to }` — há teste lendo `V2App.jsx`) e a PISTA de rota em `HELP_ROUTE_HINTS`. O teste pega a pista órfã; a pista que FALTA ninguém vê
**"Vou escrever ajuda sobre uma funcionalidade"** → confira antes se ela está LIGADA. A gamificação (`/conquistas`, `/hall-da-fama`, `/vinculos`) está atrás de `gamification_v2`, que é OFF — documentá-la manda a pessoa para uma porta que não abre. Há teste travando isso em `helpCenter.test.js`; e outro que confere cada link da ajuda contra as rotas reais de `V2App.jsx`
**"Quero um tutorial explicando esta ferramenta"** → já existem quatro (torneio, dia de jogo Play, Americano e Americano aprimorado). Conteúdo em `src/modules/help/domain/tutorials.js`; para colocar numa tela é UMA linha: `<V2TutorialLauncher tutorialId={...} />` (ou `tutorialIdForGameDayFormat(gameDay.format)` num dia de jogo). Ele abre sozinho na primeira vez, deixa dispensar e mantém o botão para rever. A memória é `localStorage` por usuário — **nada no banco**. Ver `docs/19-TUTORIAIS.md`
**"Mexi numa tela de torneio ou dia de jogo"** → passe pelo tutorial dela (`src/modules/help/domain/tutorials.js`). Um tutorial que ensina um botão que não existe mais é PIOR que nenhum: quem segue passo a passo conclui que está fazendo algo errado
**"Preciso guardar uma preferência de tela por usuário"** → `src/core/lib/viewPreference.js` (valores) ou `collapsePreference.js` (booleanos). Sempre com o uid na chave — `localStorage` é por NAVEGADOR, e num tablet de clube uma pessoa herdaria a preferência da outra. E ao testar, espione `Storage.prototype`: no jsdom, `vi.spyOn(window.localStorage, …)` não troca o método, grava uma chave com aquele nome e o teste passa sem exercitar nada
**"Posso mexer no motor de rating?"** → só nos DOIS lados. Os motores existem em `src/modules/rating/domain/` (cliente) e `functions/engines/` (servidor, porque o pacote de Functions é publicado isolado). `functions/engines/parity.test.js` roda as duas implementações sobre as mesmas 400 partidas e exige resultado idêntico — mexer num lado só quebra o teste, de propósito
**"A previsão de próxima partida mostra gente diferente de quem entra. Por quê?"** → era isso mesmo, e foi corrigido: previsão, previsão por quadra e ordem de participação derivam todas de `simulatePlaySequence` (fonte única). A previsão de quadra **ocupada** é condicional (depende de quem termina primeiro). Ver `docs/16-DIA-DE-JOGO-RODIZIO.md` §4b
**"Como faço uma seção colapsável que LEMBRA por usuário?"** → `src/v2/ui/V2CollapsibleCard.jsx` + id estável em `src/v2/components/games/gameDaySections.js`
**"Onde está SEGURANÇA / LGPD / documentos legais / dados de usuário?"** → ⭐ `docs/20-SEGURANCA-E-PRIVACIDADE/00-INDEX.md` — **leia antes de tocar em qualquer coisa que envolva dado pessoal**. Os 2 achados CRÍTICOS já foram tratados; resta a migração destrutiva do P0-02 (presa ao backup) e **um achado aberto de operação**: `16-ACHADO-ADMINS-EXTRAS.md`
**"Posso guardar o e-mail de alguém num documento de coleção?"** → Só se a leitura for RESTRITA. `club_members` e `tournament_admins` são `allow read: if isAuthed()` — qualquer conta logada lê — e por isso **não guardam mais e-mail** (P1-01). `club_join_requests` e `club_member_invites` guardam, porque a leitura é limitada ao titular, ao admin do clube e ao admin da plataforma. Há teste de regressão em `src/modules/clubs/domain/memberPayload.test.js`
**"Onde fica o e-mail de quem se inscreveu num torneio?"** → **não** no documento da inscrição, que é público (quadro/impressão/telão). Fica em `tournament_registrations/{rid}/private/contact`, e a prova de inscrição provisória em `provisional_claims/{rid}_a|b`. Sempre leia por `resolveRegistrationContact` (domínio) ou `registrationContactService` — nunca por `reg.player_a_email` direto, que só existe em documento legado
**"Quem tem poder de admin na plataforma? Como tiro o poder de alguém?"** → **Painel admin → Governança → Acessos** (`src/v2/components/admin/AdminAccessTab.jsx`, domínio em `src/modules/admin/domain/accessRoster.js`). A revogação é **assimétrica**: remove poder, NUNCA concede — promover é só pelo console, de propósito. `hidden: true` **não** remove poder. Ver `docs/20-SEGURANCA-E-PRIVACIDADE/17-ACESSOS-E-PODERES.md`
**"Como corrijo/completo o cadastro de um usuário?"** → **Painel admin → Comunidade → Cadastros** (`src/v2/components/admin/AdminUserRecordsTab.jsx`, domínio em `src/modules/admin/domain/adminUserEdit.js`). Lista FECHADA de campos: o admin corrige dado errado, mas **não** mexe em poder, **não** altera a privacidade do titular e **não** troca o e-mail de login. Motivo obrigatório + auditoria com antes/depois. As listas de seleção são as MESMAS do cadastro normal (importadas da fonte, nunca recopiadas). Ver `docs/20-SEGURANCA-E-PRIVACIDADE/18-CADASTROS-ADMIN.md`
**"Como o admin acessa dado de usuário para dar suporte?"** → `docs/20-SEGURANCA-E-PRIVACIDADE/05-ADMIN-SUPORTE.md` (🟡 escrita implementada; quebra-vidro e log de leitura ainda não)
**"Onde está o MERCADO (marketplace) / o FEED (rede social) / a GAMIFICAÇÃO?"** → 📐 **ainda não existem** — só o desenho, em `docs/FUTURO/00-INDEX.md`. Pastas dos módulos já estruturadas (só README) em `src/modules/{marketplace,feed,moderation}/`
**"Cuidado: 'mercado' já significa outra coisa!"** → `arena_products`/`catalog_products` são o **PDV/loja da arena** (módulo `arenas/`). O marketplace novo usa **só** o prefixo `market_`. Ver `docs/FUTURO/MERCADO/00-INDEX.md` § Colisão de nomes

**Para encontrar QUALQUER arquivo rápido:**
```bash
# por nome
find src -name "V2Arena*" -type f
# por conteúdo (procurar string)
grep -rn "useArenaBookings" src/
# por export
grep -rn "export function\|export const" src/modules/arenas/ | head
# por rota
grep -rn "path=\"/arenas" src/v2/V2App.jsx
```

---

## 5. Decisão rápida: "como faço Y?"

| Preciso... | Onde olhar | Como fazer |
|---|---|---|
| Adicionar uma feature nova | `docs/02-STANDARDS.md` §3 | Flag nova, default OFF, `<FeatureFlagGuard>`, git worktree, PR, smoke test, squash merge |
| Adicionar uma página V2 nova | `docs/02-STANDARDS.md` §4 | `src/v2/pages/V2Xxx.jsx` (lazy), rota em `src/v2/V2App.jsx`, `useFeatureFlag` se for nova, `ProtectedRoute` se for autenticada |
| Adicionar uma coleção Firestore | `docs/02-STANDARDS.md` §5 | Schema em `docs/05-DATA-MODEL.md` + `match /<col>/{id}` em `firestore.rules` (aditivo) + service + hook + UI |
| Adicionar um campo em coleção existente | `docs/02-STANDARDS.md` §5 | Campo OPCIONAL, regra atualizada (aditiva), service lê com default se faltar |
| Adicionar lógica de negócio | `docs/02-STANDARDS.md` §6 | `src/modules/X/domain/novo.js` + `novo.test.js` (sempre!), puro, sem React/Firebase |
| Mudar algo em produção | `docs/03-WORKFLOW.md` | Worktree, branch, PR, smoke test, **squash merge + delete branch** → deploy sai |
| Corrigir um bug em produção | `docs/03-WORKFLOW.md` §5 | Branch `fix/X`, PR, smoke test, deploy via merge. **NUNCA hotfix direto em main** |
| Fazer deploy manual | `docs/03-WORKFLOW.md` §6 | Use `firebase deploy` local OU push em main. **Não pule smoke test** |
| Adicionar dependência | `docs/02-STANDARDS.md` §7 | Verificar se já existe similar no `package.json`; preferir libs leves e mantidas |
| Trocar tema/paleta | `docs/07-DESIGN-STANDARD.md` | Tokens em `tailwind.config.js` + `src/v2/ui/primitives.jsx` |
| Investigar bug "feature X não funciona" | `docs/11-REFERENCE/cheatsheet.md` § "Diagnóstico" | (1) bundle deployed, (2) build, (3) tests, (4) Playwright, (5) feature flag, (6) firestore rule |
| Ver o que ainda falta fazer | `docs/09-UX-ANALYSIS/15-backlog-remanescente.md` | Lista consolidada, com status ✅/🟡/⏳ |
| Ver status atual do Arena V3 | `docs/10-ARENA-V3/26-ARENA-V3-COMPLETE-REFERENCE.md` | Métricas, sprint, gotchas |
| Equilibrar duplas/jogos por nível | `docs/13-NIVEL-UNIFICADO.md` | `fetchUnifiedLevelsByParticipant(participants)` → passe `levels` ao motor de sorteio. NUNCA compare escalas diferentes na mesma conta |
| Retomar a gamificação | `docs/FUTURO/GAMIFICACAO/README.md` | Leia README → 01 → 02 → 03 antes de tocar em código |
| Mostrar/esconder um comando de dia de jogo | `docs/15-DIA-DE-JOGO-PERMISSOES.md` | `canManageGameDay(gd, uid, { participants })` para operar partidas; `canConfigureGameDay(gd, uid)` para configurar. Comando sem atribuição **não é renderizado** (nunca só desabilitado) |
| Tornar uma seção colapsável | `docs/14-DIA-DE-JOGO-TELAO.md` §1 | `<V2CollapsibleCard sectionId="..." summary="...">`; id ESTÁVEL (mudar apaga a preferência de todo mundo) e ações SEMPRE em `actions`, nunca dentro do corpo do cabeçalho |

---

## 6. Como planejar uma feature nova (3 passos)

Antes de tocar em código, **responda por escrito** (em chat, comentário, ou no PR):

### Passo 1 — O QUÊ
- **Qual problema** estou resolvendo? (citando user story ou bug)
- **Quem** se beneficia? (persona: atleta, organizador, dono de arena, professor, admin)
- **Critério de aceite**: como sei que está pronto?
- **Já existe algo similar?** (checar `docs/09-UX-ANALYSIS/15-backlog-remanescente.md` — talvez seja um item lá)

### Passo 2 — COMO
- **Qual módulo** vai receber? (ver §4 + `docs/06-MODULES.md`)
- **Qual camada**: novo `domain/` (lógica), `services/` (I/O), `hooks/` (queries), `pages/` (UI)?
- **Qual flag?** (definir em `src/core/featureFlags.js` + agrupar em `featureFlagGroups.js`)
- **Qual schema?** (novas coleções ou campos aditivos)
- **Qual UI?** (qual página V2, qual componente)
- **Quais testes?** (domain test + runtime test se for page crítica)
- **Quais docs atualizar?** (este guia → `01-AI-CONTEXT` + `05-DATA-MODEL` + `06-MODULES` + `15-backlog-remanescente` + memória do agente se for lição nova)

### Passo 3 — RISCOS
- **Backward-compat**: estou quebrando algo? (verificar `firestore.rules`, schema, refs)
- **Bundle size**: a feature adiciona muito peso? (lazy load se > 30KB)
- **PWA/SW**: precisa bumpar `sw-vN.js`? (ver `docs/03-WORKFLOW.md` §7)
- **Feature flag migration**: precisa `migrateLegacyFlags`? (sim, se for flag nova com default que afeta comportamento existente)
- **Auditoria**: ações que precisam de `audit_logs`?
- **Notificações**: ações que disparam notificação?
- **i18n**: tudo em pt-BR? termos consistentes com o resto?

**Só então comece a codar.**

---

## 7. Checklist de entrega (antes de pedir review)

Toda feature/task completa deve passar por este checklist:

```
PRÉ-COMMIT
[ ] Lint passa (npm run lint) — esperado 0 errors
[ ] Build passa (npm run build) — sem warnings
[ ] Tests passam (npm test) — adicionar testes novos se relevante
[ ] Smoke test manual — abrir a feature no dev, fazer o fluxo happy-path
[ ] Bundle grep — se importou lib nova, ela tá no bundle? (ver docs/03-WORKFLOW §8)
[ ] i18n pt-BR — todos os textos visíveis

DOCS (atualizar ANTES do PR, não depois)
[ ] docs/01-AI-CONTEXT.md — se afeta panorama (rotas, coleções, etc)
[ ] docs/05-DATA-MODEL.md — se afeta schema
[ ] docs/06-MODULES.md — se afeta módulo/rota
[ ] src/modules/X/README.md — se afeta o módulo
[ ] docs/09-UX-ANALYSIS/15-backlog-remanescente.md — marcar como ✅ implementado
[ ] Memory topic (se lição nova crítica) — via mavis memory tool

PR
[ ] Branch nomeado: feat/X / fix/X / docs/X / refactor/X
[ ] Commit message descritivo (Conventional Commits)
[ ] PR com descrição clara: o que, por que, como testar
[ ] Squash merge → delete branch
[ ] Push em main → GitHub Actions → deploy sai

PÓS-DEPLOY
[ ] Conferir o run do workflow (deve passar)
[ ] Abrir o site em produção, verificar
[ ] Se feature flag nova: ativar no /admin/console pra validar
[ ] Se flag ON por default: verificar que user que não é admin não vê
[ ] Reportar no chat
```

**Se um item falhou: NÃO faça o PR.** Volte, arrume, depois submeta.

---

## 8. Atalhos por papel (persona)

### Atleta (jogador)
- Quer: ver torneios, se inscrever, jogar, ver ranking, encontrar parceiros
- Toca: `tournament/`, `rating/`, `clubs/`, `chat/`, `social/`
- Lê: `docs/06-MODULES.md` (esses 5)

### Organizador de torneio
- Quer: criar torneio, gerenciar inscrições, sortear, agendar quadras, ver resultados
- Toca: `tournament/`, `coaches/` (se for arena)
- Lê: `docs/06-MODULES.md` § tournament + `docs/01-AI-CONTEXT.md` §5 (rotas)

### Dono de arena
- Quer: criar arena, gerenciar quadras/preços, receber reservas, ver métricas, PDV
- Toca: `arenas/`, `coaches/` (parcerias), `notifications/`
- Lê: `docs/06-MODULES.md` § arenas + `docs/08-ARENA-ROADMAP.md` + `docs/10-ARENA-V3/26-ARENA-V3-COMPLETE-REFERENCE.md`

### Professor
- Quer: perfil público, agenda de aulas, roster de alunos, pacotes, clínicas
- Toca: `coaches/`, `arenas/` (parcerias), `leveling/`
- Lê: `docs/06-MODULES.md` § coaches + `docs/09-UX-ANALYSIS/14-professor-implementacao.md`

### Platform admin
- Quer: visão geral, métricas, ativar flags, gerenciar todos os recursos
- Toca: tudo (precisa conhecer tudo)
- Lê: TUDO (este guia + 01-AI-CONTEXT + 05-DATA-MODEL + 06-MODULES + 15-backlog + 26-ARENA-V3-REF)

---

## 9. Convenções de commit e branch

**Branches:**
- `feat/descrição-curta` — feature nova
- `fix/descrição-curta` — bug fix
- `docs/descrição-curta` — só docs
- `refactor/descrição-curta` — refactor sem mudança de comportamento
- `test/descrição-curta` — só testes
- `chore/descrição-curta` — manutenção (deps, config)

**Commits (Conventional Commits):**
```
feat(arenas): add waitlist for booked slots (#66)
fix(v2-arena-detail): import Calendar/Check/Copy from lucide (#65)
docs(readme): update feature flags count to 124
refactor(coaches): extract clinic validation to domain
test(arenas): add court_assignment.test.js (8 tests)
chore(deps): bump firebase to 12.x
```

**PRs:**
- 1 feature = 1 PR (ou 1 sprint atômico = 1 PR)
- Squash merge (botão do GitHub) — mantém main linear
- Delete branch após merge
- **NUNCA** merge direto sem PR (perde rastreabilidade)
- **NUNCA** force push em main

---

## 10. Métricas atuais (snapshot 2026-08-31, 11:05 GMT-3)

> Última atualização: 2026-09-20 (Onda AT). Antes: 2026-08-31, após **41 PRs
> novos** mergeados em main (#95 a #135) — Sprints 32 a 50+.
> Detalhes em `docs/08-ARENA-ROADMAP.md` (Seções 34-50) e
> memory topic `picklerush-sync-2026-08.md`.
>
> **Destaques por onda**:
>
> - **Onda AV — Falha não é lista vazia** (2026-09-20): auditoria do dia de
>   jogo com a lente da usabilidade, e o achado é uma classe inteira.
>
>   **(1) 🐞 28 de 30 telas tratavam falha de rede como "não existe".** O
>   padrão do projeto é `const { data = [] } = useX()`; numa falha, `data` vem
>   indefinido, cai no `[]` e a tela AFIRMA o vazio. Só que vazio quase nunca é
>   neutro: *"Nenhum dia de jogo ainda"* para quem tem dez, *"Dia de jogo não
>   encontrado — pode ter sido removido ou você não tem acesso"* na beira da
>   quadra, *"Torneio não encontrado. Verifique o link"* com o link certo.
>   Quem lê isso não tenta de novo: acredita, e vai criar um duplicado ou ligar
>   para o suporte. A mesma classe tinha sido corrigida na ARENA na Onda AE e
>   nunca chegou ao dia de jogo nem ao torneio.
>
>   **(2) 🐞 E o caso grave: o sorteio apagando o que não viu.**
>   `persistMatches` apaga TODOS os jogos da fase antes de gravar os novos — é
>   o que faz "re-sortear" funcionar, e a tela avisa disso. Só que o aviso era
>   decidido por `matches.length`. Com a consulta falhando: o botão vira
>   **"Sortear"** em vez de "Re-sortear", o cabeçalho diz "nenhum jogo gerado
>   ainda", o diálogo diz que vai **gerar** e **não menciona que apaga** — e o
>   organizador confirma. Resultado de torneio destruído por uma queda de rede,
>   sem ninguém ter como perceber. Fechado nos dois níveis: a tela **não
>   renderiza** comando sobre estado desconhecido (a regra do dia de jogo:
>   comando sem atribuição não aparece, nunca só desabilitado), e o serviço
>   **recusa** descartar jogo COM RESULTADO sem reconhecimento explícito. Jogo
>   sem resultado segue livre de propósito — confirmação demais treina a pessoa
>   a clicar em "sim" sem ler, e aí a confirmação que importa passa batida.
>
>   **(3) O dia de jogo não dizia o que ele É.** O cabeçalho tinha título,
>   origem, data e observações — **nem o formato**, que é o que decide se há
>   placar, ranking do dia, publicação no ranking da plataforma e dupla
>   vinculada. Pior: a LISTA da arena já mostrava o formato num selo, e a tela
>   do dia não — a lista dizia mais que o detalhe. Agora há um resumo, e ele
>   mora dentro do `GameDayModule`, para chegar às três origens **por
>   construção** — que é o antídoto da doença da Onda AS (o clube meses sem
>   Play e sem telão porque cada tela montava o próprio miolo).
>
>   **(4) Uma peça só para "falhou".** O bloco de erro estava escrito à mão em
>   SETE lugares e não havia primitivo: agora é `V2ErrorState`, que nunca diz
>   que o dado não existe, sempre oferece o caminho de volta e não despeja erro
>   técnico na cara de ninguém.
>
>   **(5) Nove componentes V1 de clube removidos**, sem caminho a partir de
>   `main.jsx`. Entre eles `EventDatesPanel.jsx`, gêmeo obsoleto do
>   `V2EventDatesPanel` que a Onda AS modificou e que **não conhece
>   `game_day_id`** — a mesma armadilha do `TournamentDrawTab` (AU) e do
>   `V2GameDayOrganizer` (AS).
>
>   **Banco: zero.** Nenhuma coleção, campo, índice, regra, função ou migração.
>   +68 testes. Ver `docs/27-FALHA-NAO-E-VAZIO.md`.
>
> - **Onda AU — A Onda AT chega onde ela fazia sentido** (2026-09-20):
>   auditoria do que a onda anterior entregou, e o achado foi constrangedor.
>
>   **(1) 🐞 A ENTRADA DIRETA era inalcançável em produção.** A aba de sorteio
>   tem dois ramos — `stages.length > 1` manda para o `MultiPhaseDrawBlock`, o
>   resto fica no `ModalityDrawBlock`. A Onda AT montou o planejador de grupos
>   e o painel de entrada direta **só no segundo**. E `DirectEntryPanel` começa
>   com `if (fases.length < 2) return null`: pular fase exige fase para pular.
>   Ou seja, a funcionalidade-título daquela onda foi montada **exatamente no
>   ramo onde ela nunca renderiza**, e faltava no único ramo em que ela
>   significa alguma coisa. Nenhum teste de comportamento pegava — cada tela,
>   isolada, funcionava. É a família do console de marketing da Onda AJ (módulo
>   ligado, tela inalcançável) e das quatro cópias do `handleDraw` da AS.
>   Corrigido nos dois ramos, com **guarda de fonte** travando o par.
>
>   **(2) A fase não dizia quais regras estavam em vigor.** A AT deu oito
>   controles ao admin; eles se configuram em **Modalidades** e o torneio se
>   sorteia em **Sorteio**. Quem organiza chegava no botão sem eco nenhum do
>   que tinha configurado — e esse botão faz uma conta invisível. Agora cada
>   fase mostra o que está valendo, **só o que foi MUDADO** por padrão (repetir
>   o padrão da plataforma para todo mundo vira paredão que ninguém lê), com
>   "ver todas as regras" ao lado. Linha que não se aplica **some**, não vira
>   "—".
>
>   **(3) "Gerar próxima fase" era caixa-preta.** O botão mais irreversível do
>   torneio classificava, comparava grupos desiguais, chamava repescados,
>   encaixava quem entra direto e sorteava — sem dizer nada antes. Agora a tela
>   mostra **quem passa, quem entra por repescagem e quem entra direto**, nome
>   por nome, e avisa quando ainda há jogo por decidir em vez de apresentar um
>   parcial como definitivo. ⚠️ A prévia e o avanço saem da **mesma função**
>   (`previewPhaseAdvance`): é a lição do dia de jogo, em que a previsão
>   anunciava uma partida e o sorteio criava outra — aqui o estrago seria
>   anunciar quem vai à próxima fase de um torneio.
>
>   **(4) 🐞 O tutorial ensinava uma regra revogada.** A Onda AR trocou o
>   gatilho do ranking de torneio do ENCERRAMENTO para o LANÇAMENTO, e o
>   tutorial seguia afirmando, com ênfase, *"torneio ainda em andamento não
>   pontua no ranking geral. É de propósito"* — a central de ajuda dizia o
>   mesmo. Tutorial errado é pior que tutorial nenhum: o organizador ia
>   procurar um botão de "encerrar" para liberar um ranking que já estava
>   atualizado. Corrigidos, com guarda comparando o texto contra
>   `RANKING_ELIGIBLE_STATUSES`. De quebra, a ajuda ganhou o artigo que faltava
>   — *"Quando o número de inscritos não é o ideal"* — e o tutorial passou a
>   ensinar planejador, repescagem, entrada direta e regras avançadas.
>
>   **(5) Onze componentes mortos removidos.** `TournamentAdminPanel` e as
>   cinco abas que ele montava, mais quatro cartões órfãos — sem nenhum caminho
>   a partir de `main.jsx` e fora do bundle. Entre eles, `TournamentDrawTab.jsx`,
>   uma **segunda cópia da aba de sorteio** importando o mesmo
>   `MultiPhaseDrawBlock`: exatamente a armadilha do `V2GameDayOrganizer` da
>   Onda AS. (Sobra um órfão conhecido, `services/courtService.js`, que ficou
>   de propósito por estar descrito no README do módulo.)
>
>   **Banco: zero.** Nenhuma coleção, campo, índice, regra, função ou migração.
>   Nenhum dado histórico lido ou reescrito. +46 testes.
>   Ver `docs/26-TORNEIO-FORMATOS-E-REGRAS.md` §11.
>
> - **Onda AT — O torneio com qualquer número de inscritos, e o admin no
>   comando** (2026-09-20): auditoria do torneio de ponta a ponta, com foco no
>   que ninguém tinha olhado: **o que acontece quando o número de inscritos não
>   é o ideal**.
>
>   **(1) 🐞 A chave incompleta nascia quebrada.** Dois defeitos no mesmo
>   lugar. A sequência canônica estava espelhada — numa chave de 8 o nº 1
>   estreava contra o nº 5, não contra o nº 8. E os não-cabeças eram despejados
>   nos slots vazios da ESQUERDA para a DIREITA, o que amontoava todo mundo na
>   metade de cima e deixava pares inteiros vazios: **uma chave de 16 com 9
>   inscritos nascia com TRÊS partidas de ninguém contra ninguém**, gravadas
>   como W.O. no banco, e um único bye entregue a quem calhasse. Agora todo
>   mundo entra pela posição canônica do seu número, o que dá exatamente
>   `tamanho − inscritos` byes, zero partida fantasma, e os byes nos **melhores
>   cabeças** — a regra do DUPR, que sai de graça da ordem certa.
>
>   **(2) 🐞 O desempate não tinha CONFRONTO DIRETO.** A ordem do regulamento
>   (USA Pickleball 15.B.4) põe o confronto direto logo depois das vitórias; a
>   plataforma pulava direto para o saldo. É a reclamação nº 1 de quadra — *"mas
>   eu ganhei dele"* — e quem organizava não tinha como explicar, porque a tela
>   mostrava o resultado certo de uma conta errada. Pior: a regra vivia
>   DUPLICADA em dois arquivos, as duas cópias igualmente erradas. Virou fonte
>   única, com mini-tabela para empate de três ou mais, recalculada a cada nível
>   (o empate menor é um empate NOVO).
>
>   **(3) Grupos desiguais deixaram de ser tratados como erro.** A tela avisava
>   *"para grupos do mesmo tamanho use um número de inscritos múltiplo de 4"* —
>   que é pedir para alguém desistir da inscrição. Grupo desigual é o caso
>   NORMAL de torneio amador; o que ele exige é a **regra de comparação certa**:
>   colocação primeiro, e dentro dela **aproveitamento**, não número absoluto
>   (3 vitórias em 3 vale mais que 3 em 4). No lugar do aviso inútil entrou um
>   **planejador**: dado o número real de inscritos, mostra as divisões viáveis
>   com jogos, jogos por atleta, classificados e se a chave fecha — e as
>   alternativas, na tela de sorteio, antes de clicar.
>
>   **(4) O que fazer quando os classificados não fecham a chave.** 10
>   classificados numa chave de 16 são 6 byes, e metade da primeira rodada não
>   acontece. Agora a plataforma mostra as duas saídas e implementa a primeira:
>   **repescagem** dos melhores da colocação seguinte ao corte, comparados entre
>   IGUAIS (um 4º nunca entra na frente de um 3º).
>
>   **(5) ⭐ Tudo passou a ser do ADMIN.** Existe um padrão bom e ele pode ser
>   trocado inteiro, com explicação ao lado de cada controle: tamanhos dos
>   grupos à mão, turnos (ida e volta, que é a saída para o grupo de 3),
>   classificados grupo a grupo, repescagem e de qual colocação, **ordem dos
>   critérios de desempate** (9 critérios, 4 ordens prontas) e **método de
>   comparação entre grupos** (aproveitamento / absoluto / descartar o último,
>   que é a regra da FIFA).
>
>   **(6) ⭐ Entrada direta: pular fases.** O pedido mais específico, e o que
>   não existia de jeito nenhum. Os N melhores cabeças — ou uma lista a dedo —
>   **pulam as fases anteriores** e entram numa fase à frente como cabeças. É o
>   modelo de qualificatória (os fortes esperam, os outros disputam as vagas), o
>   campeão defendendo título, o convidado da organização. Configura-se na aba
>   de SORTEIO, onde os nomes existem, e a tela mostra o resultado antes do
>   sorteio: *"2 entram direto na fase 2 (Ana, Bruno), pulando 1 fase; 12
>   começam na 1ª"*. Com as travas que importam: entra uma vez só, a 1ª fase
>   precisa sobrar com ao menos 2, e numa próxima fase de grupos os diretos são
>   espalhados em vez de formarem um grupo da morte por acidente.
>
>   **Banco: zero coleção, zero índice, zero regra, zero migração.** Oito campos
>   opcionais em `tournament_modalities.stages[]`, que não tem lista fechada de
>   campos. `normalizePhase` preenche os padrões na leitura, então uma
>   modalidade gravada antes desta onda se comporta exatamente como antes.
>   Ver `docs/26-TORNEIO-FORMATOS-E-REGRAS.md`.
>
> - **Onda AS — O clube entra no módulo, sem tocar no que já foi jogado**
>   (2026-09-19): a Onda AR unificou o SORTEIO e deixou uma tabela de
>   honestidade sobre o que ainda era diferente. Esta fecha o resto — **para o
>   futuro**.
>
>   **(1) 🐞 Havia QUATRO cópias do mesmo `? :`.** Não era só o `handleDraw`:
>   a escolha da VISÃO por formato (Play × Americano aprimorado × grade) e as
>   ferramentas do dia (tutorial do formato, telão) eram montadas tela a tela —
>   no atleta, na arena, e em lugar nenhum no clube. Foi assim que o clube
>   passou meses sem Play, sem Americano aprimorado e sem telão, com o próprio
>   documento do módulo registrando a dívida. Agora isso é `GameDayModule`, e
>   as três telas passam por ele; um guarda de FONTE reprova quem montar o
>   switch por fora, porque o defeito é invisível a teste de comportamento —
>   cada tela, isolada, funciona.
>
>   **(2) A data de evento de clube passou a NASCER como `game_days`.** É o
>   corolário da Onda AM (o torneio interno cria um dia de jogo em vez de
>   reescrever sorteio, placar, ranking e telão): sem armazenamento próprio,
>   não sobra o que unificar. O clube ganhou de graça Play, Americano
>   aprimorado, telão, tutorial e administradores nomeados — **zero tela
>   nova**. E ganhou permissão explícita: quem administra o CLUBE administra o
>   dia (mesmo sem ter agendado a data, e mesmo que quem agendou saia), o
>   membro LÊ e se inscreve sozinho, e quem não é do clube não vê nada. O dia
>   nasce com a gestão ABERTA de propósito: no evento legado qualquer membro
>   mexia em participantes e jogos, e nascer restrito tiraria da comunidade
>   algo que ela já tinha.
>
>   **(3) O legado NÃO foi migrado, e não vai ser.** A pergunta que separa é
>   uma só — `game_day_id` na data —, e ela mora num lugar só. Data anterior
>   segue no organizador de sempre, lendo e escrevendo exatamente onde sempre
>   leu e escreveu; nenhum documento publicado é lido, reescrito ou movido. Um
>   dia de jogo já jogado costuma já estar no ranking de quem jogou: migrar
>   seria reescrever histórico, e deixar como está não custa nada porque as
>   duas casas convivem. O legado encolhe sozinho.
>
>   **De quebra, três achados no caminho.** Uma QUINTA cópia do organizador
>   (`V2GameDayOrganizer.jsx`, 769 linhas) estava no repositório **sem um único
>   import** e fora do bundle — saiu. O espelho do ranking inferia o `club_id`
>   pelos atletas mesmo quando o clube dono era conhecido, e é justamente esse
>   campo que `isClubAdmin(club_id)` confere: sem a correção, só quem agendou a
>   data publicaria. E a aba de jogos do clube virou `lazy`, o que **reduziu**
>   a página do evento de clube de 48,6 kB para 31,7 kB — o organizador legado
>   também saiu do caminho crítico.
>
>   **Banco: quatro campos opcionais** (`game_day_id` na data do evento;
>   `club_id`, `club_name`, `club_event_id` no dia de jogo) e **duas condições
>   aditivas** no `firestore.rules`, ambas guardadas por `'club_id' in …` —
>   sem o campo, sempre falsas. Zero coleção, zero índice, zero migração. 85
>   asserções no emulador (eram 57), metade provando o que passou a funcionar e
>   metade o que continua barrado.
>   Ver `docs/25-DIA-DE-JOGO-COMO-MODULO.md` §5.
>
> - **Onda AR — O dia de jogo vira módulo, e o ranking deixa de esperar
>   botão** (2026-09-18): três frentes, todas nascidas da mesma pergunta —
>   *por que isto funciona diferente dependendo de onde está?*
>
>   **(1) A dupla vinculada, agora em todos os formatos.** Auditados os cinco:
>   Play e Americano aprimorado já honravam (o segundo desde a Onda AQ); o
>   sorteio de **grade** não tinha o recurso, e nem a tela para vincular. Ganhou
>   os dois. E o motor de grade expôs o que o Americano aprimorado já tinha
>   ensinado: o vínculo precisa valer em **TRÊS momentos** — quem joga a
>   rodada (`recortarComDuplas`), em que grupo de 4 (`ordenarComDuplas`) e de
>   que lado (`bestPairingOfFour`). Garantir só o último deixa a dupla em
>   quadras diferentes; só os dois primeiros a coloca uma CONTRA a outra.
>   **Mexicano e Rei da Quadra não honram**, e não é omissão: neles as duplas
>   saem da classificação da rodada e do resultado da anterior, que é o que
>   define os dois formatos — prender uma dupla ali seria deixar de ser
>   Mexicano. Então a tela **avisa** em vez de ignorar calada, que é o que faz
>   a pessoa achar que o sistema errou.
>
>   **(2) 🐞 O dia de jogo do CLUBE era uma versão mais pobre da mesma
>   ferramenta.** O painel do clube e o do atleta tinham duas cópias do mesmo
>   `handleDraw`, e elas divergiram: o do atleta ganhou Mexicano e Rei da
>   Quadra, o do clube ficou só no Americano — e **nada na tela dizia isso**.
>   Quem organizava pelo clube simplesmente não sabia que os outros formatos
>   existiam. Agora o sorteio tem fonte ÚNICA (`buildGameDayDraw`), usada pelas
>   três origens: formato, nível unificado 2.0–8.0, sorteio aditivo e duplas
>   vinculadas valem nas três por construção. O armazenamento continua
>   diferente (é migração de dados, ficou fora), mas a ORIGEM só pode mudar
>   três coisas: onde grava, quem organiza e o que o local acrescenta. Um
>   guarda de FONTE (`diaDeJogoUniforme.test.js`) reprova quem chamar os
>   motores por fora — porque este defeito é invisível a teste de
>   comportamento: cada tela, isolada, funciona.
>
>   **(3) 🐞 O resultado de torneio só contava depois de "encerrar".** A
>   elegibilidade exigia `status === 'finished'`: num torneio de três dias,
>   nada do que acontecia em quadra aparecia no rating até alguém clicar num
>   botão — às vezes dias depois, às vezes nunca. E o organizador não tinha
>   como saber que faltava um passo, porque lançar o resultado já parecia o
>   passo final. Em torneio o lançamento **não é facultativo**, então passou a
>   contar na hora; segue de fora o que não é resultado de verdade (rascunho,
>   cancelado, privado, arquivado), e como o recálculo é integral, cancelar
>   TIRA do ranking o que já contou. No dia de jogo o gatilho continua sendo a
>   **publicação** — ali lançar no ranking é decisão de quem organiza, e essa é
>   a única diferença legítima entre as origens. Apareceu também um caminho
>   sem gatilho nenhum: mudar o uid por trás de uma **inscrição** troca a quem
>   o jogo pertence sem tocar em partida alguma, e isso dependia de um admin
>   apertar "Recalcular ranking agora" — ganhou gatilho próprio.
>   E aí **os quatro botões de recalcular saíram**. Não por arrumação: botão de
>   recalcular mente sobre de quem é a responsabilidade (só o admin escreve
>   ranking, então quem publica depende de outra pessoa lembrar), compete com
>   o gatilho e esconde o defeito quando algo não entra. No lugar, um painel
>   que EXPLICA o que dispara o quê — botão que some sem explicação vira
>   chamado de suporte. O cliente também parou de tentar materializar ranking
>   ao publicar: era recusado pela regra e custava ler a coleção INTEIRA de
>   torneios a cada publicação.
>
>   **Banco: um campo opcional** (`partner_id` em `club_events/{id}/participants`,
>   sob a regra que já existia, sem lista fechada de campos) e **uma Cloud
>   Function nova**. Zero coleção, zero índice, zero regra, zero migração.
>   Ver `docs/25-DIA-DE-JOGO-COMO-MODULO.md` e `docs/18-RANKINGS.md` §3 e §8.
>
> - **Onda AQ — A dupla vinculada joga junta** (2026-09-18): relatado depois de
>   um dia de jogo real no Americano aprimorado — vinculou-se uma dupla, os dois
>   foram mantidos nas mesmas partidas e **jogaram um contra o outro**. O
>   sintoma enganava: parecia que o vínculo estava sendo ignorado, mas ele
>   valia — só que em **um** dos dois momentos em que precisa valer. Escolher
>   QUEM entra é `respectsFixedPairs`, e funcionava; escolher **COMO os quatro
>   se dividem em lados** é `pairFourBalanced`, que recebe **IDS** e não tem
>   como saber quem está vinculado a quem. Por isso o defeito só aparecia da
>   **segunda partida em diante**: na primeira o histórico está vazio e a
>   formação sai arbitrária (às vezes junta, por acaso); depois, repetir aquela
>   parceria custa 10, e o motor separava a dupla — colocando-a como
>   adversária. A correção é uma ponte, `fixedPairsWithin`, passada em **todos**
>   os caminhos de sorteio (partida avulsa, rede do Play, custo de cada grupo na
>   rodada e previsão da tela — esquecer um faria a tela anunciar uma dupla e a
>   quadra receber outra). E o vínculo entrou como **filtro ANTES do custo**,
>   não como mais um critério dentro dele: parceria inédita, adversário inédito,
>   nível e ordem da fila continuam valendo para todo o resto e decidem só entre
>   as formações que respeitam o vínculo. Duas consequências não óbvias: a
>   parceria vinculada **não é cobrada como repetição** (se fosse, o custo do
>   grupo cresceria 10 por partida e a dupla acabaria evitada — jogando cada vez
>   menos), e vínculo inconsistente **não trava** a partida. De quebra, a
>   **substituição** entrou na mesma regra: quem tem dupla ESPERANDO na fila vai
>   para o fim da lista de substitutos — continua elegível, mas só é chamado
>   quando não há mais ninguém, porque tirá-lo dali desfaria em silêncio um
>   vínculo que ninguém pediu para desfazer. Medido em dia inteiro simulado:
>   **zero** partidas com a dupla como adversária e **zero** com ela entrando
>   pela metade, com a participação tão equilibrada quanto antes. **Zero banco.**
>   Ver `docs/17-DIA-DE-JOGO-AMERICANO-APRIMORADO.md` §4a.
>
> - **Onda AP — Americano aprimorado: a rodada inteira, e as saídas que só o
>   telão tinha** (2026-09-14): três coisas no mesmo formato. **(1) 🐞 Não dava
>   para trocar quem estava em quadra** na visão normal do dia de jogo — no
>   telão dava, com o mesmo diálogo, desde a Onda S. **(2) 🐞 E não dava para
>   CANCELAR a partida sorteada**: para desfazer um sorteio que não servia, quem
>   organizava tinha de **lançar um resultado que não aconteceu** e apagá-lo
>   depois na lista de concluídas — um placar falso atravessando o ranking do
>   dia só para liberar a quadra. As duas ações agora existem nas duas telas,
>   pelo mesmo componente e pelo mesmo serviço; e `cancelPlayGame` passou a
>   **recusar** partida que já tem placar (entre abrir a confirmação e
>   confirmar, outra pessoa pode ter lançado o resultado, e aí "cancelar"
>   apagaria em silêncio algo já publicado). **(3) O sorteio foi revisto contra
>   o alvo do formato** — americano é *todos com todos, contra todos duas
>   vezes* —, e a medição foi constrangedora: com elenco estável e o número de
>   partidas que o formato pede, 8 atletas em 2 quadras formavam **12 das 28
>   duplas possíveis**; 12 em 3 quadras, **18 de 66**; 16 em 4, **24 de 120**.
>   Não era o motor de pareamento: era o sorteio ser GULOSO quadra a quadra — a
>   primeira leva o melhor quarteto e a última herda o que sobrou, e quando
>   atletas = 4 × quadras a última nem tem escolha. A rodada passou a ser
>   escolhida como um **todo** (`bestAmericanoLiveRound`): semente no sorteio
>   guloso de hoje — então nunca sai pior — e melhoria por trocas enquanto
>   baixarem o custo da rodada inteira. Os grupos são disjuntos, então o custo
>   da rodada é a SOMA dos custos dos grupos sobre o mesmo histórico, e a
>   otimização é barata. Resultado: **28/28**, **66/66** e **120/120**, com os
>   confrontos parelhos (nenhum par sem se enfrentar). Três restrições que
>   nenhuma troca viola: duplas fixas, o primeiro elegível da fila, e a FRENTE
>   da fila dentro da rodada — sem a última, procurar dupla inédita no fundo
>   empurra sempre a mesma pessoa para fora. Com uma quadra livre só, o caminho
>   é exatamente o de antes (teste travando). De quebra, a bússola do dia passou
>   a mostrar os DOIS alvos lado a lado: duplas com todos **e** confrontos duas
>   vezes — mostrar só o primeiro escondia metade do que o sorteio persegue.
>   **Zero banco.** Ver `docs/17-DIA-DE-JOGO-AMERICANO-APRIMORADO.md` §4b e §6b.
>   De quebra, **dois testes que dependiam da HORA do dia** foram estabilizados
>   (chegada e presença da arena): o fixture montava a HORA a partir de
>   `Date.now()` e a DATA sempre como "hoje", então rodar a suíte depois das 20h
>   fazia "daqui a três horas" virar 00:18 do mesmo dia — ou seja, um horário
>   VENCIDO. Passavam de manhã e reprovavam à noite. Agora o relógio é fixado ao
>   meio-dia (só `Date`, para não travar a renderização do React).
>
> - **Onda AO — A chegada: o totem, e a falta que passou a ser medida**
>   (2026-09-14): o último módulo `BETA` do catálogo era **uma frase e nenhuma
>   linha de código** — "presença confirmada sem ninguém no balcão, e no-show
>   medido de verdade". E a promessa incomodava mais do que a ausência, porque
>   **o número de faltas já existia**: `no_show` alimenta o painel semanal e a
>   ficha do cliente no CRM, e era preenchido pelo gestor, uma reserva por vez,
>   de memória, depois do expediente — um número que quase ninguém preenche é
>   pior que nenhum, porque parece medido. **A decisão que dispensou o banco**:
>   a tentação era criar `arena_checkins`, mas `arena_bookings` já deixa o
>   titular e o gestor escreverem no documento, então a chegada é um **campo
>   aditivo na própria reserva** — zero coleção, zero índice, **zero regra**, e
>   a presença mora junto do horário a que se refere. Seis asserções novas no
>   emulador (218) travam o contrato: o titular confirma a própria chegada, o
>   estranho não confirma a dos outros, a arena confirma e desfaz, e **só o
>   gestor gira o código do totem**. **O totem** é um tablet na recepção com um
>   QR e um código de cinco caracteres que **gira a cada 90 s** (fixo na parede
>   viraria mensagem de grupo — "manda aí que eu confirmo do carro") e morre ao
>   fechar a tela; sai com a **marca da arena** (Onda AN — é a tela mais vista
>   pelo cliente, e o único lugar onde o white label aparece de verdade) e
>   **não lista ninguém**: cumprimenta o último que chegou, primeiro nome, 20
>   segundos. Quem aponta a câmera **e tem um único horário aberto não toca em
>   nada** — a promessa ao atleta tem sete palavras, e um botão ali seria
>   transformar um gesto em dois. **A falta virou medida**: só é afirmada
>   depois que a janela fecha (+30 min), a taxa sai sobre o que já foi
>   DECIDIDO (dividir pelo total às 9h daria 95% de falta todo dia) e a arena
>   marca **em lote**, num toque, sobre exatamente quem o sistema já sabe que
>   não veio — era o trabalho manual que competia com fechar o caixa, e por
>   isso nunca era feito. Ver `docs/24-MODULOS-DE-ARENA/08-CHEGADA-E-TOTEM.md`.
>
> - **Onda AN — PDV, marca, rede e inteligência: o último quarteirão**
>   (2026-09-14): a onda que fechou os módulos de arena, e **seis defeitos**
>   independentes. **🐞 O atleta não conseguia comprar**: `createSale` gravava a
>   venda e em seguida dava baixa em `arena_products`, coleção que a regra só
>   deixa o gestor escrever — a segunda escrita era recusada e sobrava uma
>   **venda fantasma** no banco com um erro na tela. A correção não foi
>   afrouxar a regra: o estoque sai na **entrega**, com reconferência (entre a
>   compra e a retirada outra pessoa pode levar a última unidade), e cancelar
>   devolve o que já tinha saído. **🐞 Dividir a conta derrubava o pagamento do
>   próprio comprador**: ele criava um documento por participante, com
>   `payer_id` alheio, e como era um lote atômico a recusa de um matava todos.
>   Agora **cada um grava o seu** e quem entra na divisão é **avisado** — sem o
>   aviso, "dividir a conta" é o comprador cobrando os amigos por fora, que é
>   exatamente o que a funcionalidade promete resolver. **🐞 O caixa não
>   ordenava**: a lista comparava `created_at_ms`, campo que **nunca era
>   gravado**. **🐞 A marca ia para `arena_settings`**, que só o gestor lê — a
>   cor e o logo não tinham como chegar à página pública, e de fato **nada no
>   projeto lia aquele campo**; foram para `arenas/{id}.branding` e agora
>   pintam o cabeçalho da arena, com o texto escolhido por **contraste**
>   (luminância da WCAG), que é o que impede o amarelo-limão de apagar o
>   título. **🐞 A previsão da IA era calculada sobre lista vazia** —
>   `getHistoricalBookings` era `return []` com o comentário "só para
>   satisfazer a interface"; agora lê reservas confirmadas e concluídas, e sem
>   histórico a tela **não inventa**. O preço continua **sugestão**: nada muda
>   de preço sozinho. **🐞 A rede não podia ser criada** pela arena, embora o
>   módulo seja oferecido a ela, e `listNetworks()` mostrava **as redes de
>   todo mundo** para qualquer conta logada. Esta é a **única regra ampliada em
>   seis ondas**, e continua fechando o caso perigoso: incluir unidade exige
>   **gerir a unidade** *e* **ser dono da rede** — só a primeira e eu colocaria
>   a sua unidade na minha rede para ver os números dela; só a segunda e eu
>   poluiria a rede alheia. **Zero coleção, zero índice**; campos opcionais em
>   quatro coleções e **14 asserções novas no emulador** (212 no total), metade
>   provando o que passou a funcionar e metade provando o que continua barrado.
>   Ver `docs/24-MODULOS-DE-ARENA/07-PDV-MARCA-REDE-IA.md`.
>
> - **Onda AM — Torneios internos: o torneio vira jogo** (2026-09-14): cinco
>   defeitos. **🐞 O torneio não gerava partida nenhuma** — guardava
>   `format: 'single_elimination'` e nada no projeto sorteava nada: o atleta se
>   inscrevia e acabava ali. **🐞 O ladder era lido e nunca escrito**:
>   `getLadder` consultava `arena_ladders` e nada no projeto gravava naquela
>   coleção, então a classificação da arena estava vazia desde sempre, para
>   todo mundo. **🐞 O torneio não ocupava a quadra**, e **🐞 não dava para
>   sair** — só entrar. **A decisão que evitou reescrever a plataforma**: a
>   arena já tem uma máquina completa de dia de jogo (sorteio pela régua
>   2.0–8.0, Play, Americano, Americano aprimorado, placar, ranking do dia,
>   telão, tutoriais), e um torneio interno é exatamente isso com inscrição
>   antecipada e prêmio. Então **começar o torneio CRIA um dia de jogo da
>   arena** com os inscritos, e o ambiente do atleta não precisou de nada novo
>   — o mesmo corolário da Onda AA. O dia de jogo é criado ANTES de o status
>   mudar: se falhar, o torneio segue com inscrições abertas em vez de ficar
>   "em andamento" sem jogo. O **ladder** passou a existir de verdade (100/70/
>   50/35 por posição e **10 para quem participou** — um ladder em que só os
>   quatro primeiros somam faz todo mundo desistir na segunda semana), com id
>   determinístico `arenaId_periodo` que troca uma consulta de dois filtros por
>   um `getDoc`. De quebra: editar, cancelar avisando os inscritos, apagar, e
>   o `roster` com nome e foto — sem ele o sorteio nasceria com uma lista de
>   identificadores. **Zero coleção, zero índice, zero regra**; campos
>   opcionais numa coleção. Ver `docs/24-MODULOS-DE-ARENA/06-TORNEIOS-INTERNOS.md`.
>
> - **Onda AL — Aulas: a matrícula que nunca funcionou** (2026-09-13): o
>   defeito mais caro e mais invisível da Arena V3. **🐞 A regra de
>   `arena_class_bookings` exige `request.resource.data.user_id ==
>   request.auth.uid`, e o serviço gravava o campo como `athlete_id`** — campo
>   ausente vale `null`, `null` nunca é igual a um uid, e o Firestore recusava
>   **toda** matrícula em aula desde o dia em que a funcionalidade foi escrita.
>   O erro chegava como um "permission-denied" genérico, que ninguém liga a um
>   nome de campo. A lição vale para o projeto inteiro: **o nome do campo que a
>   regra usa é contrato**, e escrever um sinônimo não é estilo — é a operação
>   recusada em silêncio. **🐞 A aula também não ocupava a quadra**, embora o
>   catálogo prometesse que ela "passa a ocupar a grade": dava para marcar aula
>   às 19h e vender a mesma quadra às 19h. Agora ocupa (derivada, como o dia de
>   jogo — `arena_classes` é legível por todos), cancelada ou dada devolve, e
>   o bloqueio público **não carrega nome de aluno**. **🐞 E o professor era um
>   nome solto**: `arena_coaches` não tinha vínculo com a conta da pessoa, e o
>   catálogo prometia a ele "sua agenda na arena, com os alunos no mesmo
>   lugar". Com `user_id`, a tela passou a ter TRÊS donos — atleta, professor e
>   arena —, decidindo pelo que a pessoa É, não por um seletor. De quebra: a
>   comissão saiu do código (eram **50% fixos** ignorando os 20% configurados
>   no módulo, e professor da casa não paga nada), e apareceram editar aula,
>   cancelar avisando os matriculados, marcar como dada, desmarcar devolvendo a
>   vaga, registrar pagamento e editar professor — nada disso existia.
>   **O refactor que a onda exigiu**: a cadeia de merge de bloqueios estava
>   repetida em CINCO lugares e cada fonte nova pedia lembrar dos cinco; virou
>   `mergeArenaBlocks` (domínio, compõe) + `arenaOccupancy` (serviço, busca).
>   **Zero coleção, zero índice, zero regra**; campos opcionais em três
>   coleções. Ver `docs/24-MODULOS-DE-ARENA/05-AULAS.md`.
>
> - **Onda AK — Operações: a rotina que recomeça e a quadra que fecha**
>   (2026-09-13): quatro módulos `READY` no catálogo, cinco defeitos.
>   **(1) 🐞 O checklist não era uma ROTINA**: criado uma vez e marcado para
>   sempre — o fechamento cumprido na segunda continuava "concluído" na terça,
>   e a arena não tinha como responder a única pergunta que importa de manhã,
>   *hoje a abertura foi feita?*. Agora cada dia recomeça (virada ao abrir a
>   tela, idempotente) e o dia anterior vai para um histórico de 30 dias — o
>   que transforma o checklist numa PROVA ("a abertura de sábado foi cumprida,
>   8 de 8") em vez de uma lista de compras antiga. Lista marcada como não
>   recorrente não vira nunca, de propósito. **(2) 🐞 A manutenção não fechava
>   a quadra**, embora o catálogo prometesse: a ordem não tinha quadra nem
>   data, era um bilhete — trocar o piso da quadra 2 na quinta não impedia
>   ninguém de reservar a quadra 2 na quinta. Agora fecha, e **concluir ou
>   cancelar devolve a quadra à venda** (manutenção que termina e deixa a
>   quadra fechada é prejuízo silencioso). Aqui a cópia é GRAVADA, e não
>   derivada como no dia de jogo: a ordem é privada da arena e o atleta nunca a
>   leria — então o bloqueio público existe e diz só **"Manutenção
>   programada"**, sem o motivo ("trocar a fechadura do vestiário" não é
>   assunto de quem vai jogar; há teste garantindo que o título não vaza). E a
>   recusa da reserva ganhou texto próprio, com o "é temporário" que evita a
>   pessoa desistir da arena em vez do horário. **(3) 🐞 O alerta de estoque
>   não chegava a lugar nenhum**: 242 linhas de domínio testado e o aviso de
>   "acabando" só existia dentro da aba Mercado, que ninguém abre de manhã.
>   **(4) 🐞 A equipe não existia** — módulo `READY` sem uma linha de código;
>   agora é `arena_settings.staff`, com nome, função e turno e **sem telefone
>   nem e-mail** (para dizer quem estava de plantão isso basta). **(5) A tela
>   não respondia à pergunta do dia**: ganhou um topo **Hoje** com o que está
>   pendente agora — e que diz "nada pendente" numa linha em vez de encher a
>   tela de cartões verdes. **Zero coleção, zero índice, zero regra**; campos
>   opcionais em quatro coleções.
>   Ver `docs/24-MODULOS-DE-ARENA/04-OPERACOES.md`.
>
> - **Onda AJ — Marketing e fidelidade: o cupom desconta, a campanha chega**
>   (2026-09-13): o terceiro módulo entregue sobre o chassi, e **cinco defeitos
>   independentes** que o mantinham decorativo. **(1) O cupom não descontava
>   nada**: havia tela para criar e nenhum lugar para digitar — o desconto
>   existia no banco e nunca no preço. Agora o atleta digita no pedido, o erro
>   é específico ("venceu", "vale a partir de R$ 100", "você já usou"), a conta
>   entra em `memberBookingPrice` entre o nível e a carteira, e o **serviço
>   reconfere o cupom contra o banco antes de gravar** — conferir só no
>   navegador deixaria qualquer pessoa gravar um desconto que a arena não
>   criou. O uso é contabilizado na **confirmação**, e `used_by` é uma LISTA,
>   que é o que torna "uma vez por pessoa" conferível. **(2) A campanha era um
>   rascunho**: `createCampaign` gravava o documento e ninguém era notificado —
>   a arena "enviava" e a comunidade nunca recebia. Agora há quatro públicos
>   concretos (membros, sumidos, frequentes, todo mundo), cada cartão mostra
>   **quantas pessoas** vão receber ANTES de enviar, público vazio não envia, e
>   só reserva concluída conta como "já jogou aqui" (mandar "sentimos sua
>   falta" a quem nunca veio faz desinstalar o aplicativo). **(3) O NPS não
>   mostrava o motivo** — e a `read` da regra estava quebrada, então a arena
>   nem lia o próprio NPS. Agora vê nota, distribuição e **os comentários**; e
>   a pergunta ao atleta aparece na página da arena só para quem jogou nos
>   últimos 30 dias e não respondeu nos últimos 90, com a **nota indo embora no
>   clique** e o comentário depois (pedir texto antes da nota é o motivo de a
>   maioria dos NPS não ter resposta). **(4) A indicação não tinha resgate**:
>   agora o atleta vê o próprio código (copiar/convidar) e a arena registra
>   quem chegou por ele, creditando os dois lados. **(5) 🐞 Nada levava ao
>   console**: `/gerir/marketing` tinha rota e **nenhum link** na plataforma —
>   módulo ligado, tela inalcançável. Corrigido na classe, não no caso:
>   `ArenaModuleShortcuts` monta os atalhos a partir do CATÁLOGO, nos dois
>   lados do balcão, e módulo novo com rota aparece sozinho. De quebra, os
>   **pontos passaram a valer alguma coisa** (20 pontos = R$ 1, resgatados pela
>   arena porque só o gestor escreve carteira; o resto em pontos fica com o
>   atleta, nunca é arredondado para fora) e o cupom ganhou editar, desligar e
>   apagar — desligar vem antes de apagar, porque apagar leva junto a contagem
>   de usos e ninguém responde mais "quanto essa promoção rendeu?".
>   **Zero coleção, zero índice, zero regra**; quatro campos opcionais.
>   Ver `docs/24-MODULOS-DE-ARENA/03-MARKETING.md`.
>
> - **Onda AI — Membros: o benefício chega ao preço** (2026-09-13): o módulo
>   sabia calcular nível ("Ouro dá 10%") e vendia pacotes de horas — e **nada
>   disso chegava à reserva**. O valor gravado saía de `totalBookingPrice`, que
>   não conhece membro, e o pacote era um saldo que ninguém debitava: um
>   desconto que não desconta e um pacote que não abate. Agora a conta é
>   `memberBookingPrice` (tabela → horas de pacote → desconto do nível → saldo
>   da carteira, nessa ordem, com o pacote antes do desconto para não descontar
>   duas vezes), a tela mostra o detalhamento linha a linha, o serviço REFAZ a
>   conta antes de gravar e o consumo acontece só na **confirmação** — queimar
>   horas num pedido que a arena ainda pode recusar seria cobrar por um jogo que
>   não vai acontecer. Pontos passam a ser creditados por reserva concluída
>   (valor + horas: quem usa pacote pagou antes e continua vindo), e o pacote
>   consumido é sempre **o que vence primeiro**, para ninguém perder saldo por
>   uma decisão do sistema. **A arena também não conseguia incluir ninguém**: a
>   tela de gestão só listava, e o estado vazio dizia "conforme atletas
>   comprarem pacotes, eles aparecem aqui". Agora inclui pelo diretório, ajusta
>   pontos, credita carteira com motivo (que vai para a auditoria E para o
>   extrato do atleta) e cuida da mensalidade. E a **mensalidade foi escrita do
>   zero**: `arena_subscriptions` tinha regra e uma constante, nenhuma função.
>   Meses pagos são uma LISTA (não um "pago até", que esconderia quem pulou um
>   mês), e antes do vencimento o mês corrente não conta como atraso.
>   **Zero coleção, zero índice, zero regra**; dois campos opcionais. Ver
>   `docs/24-MODULOS-DE-ARENA/02-MEMBROS.md`.
>
> - **Onda AH — Jogo aberto, fila de espera e buscar parceiro** (2026-09-13): o
>   primeiro módulo de arena entregue de verdade sobre o chassi novo — e quatro
>   defeitos independentes que o mantinham inútil. **(1) 🐞 A lista de vagas
>   nunca carregou**: `where('arena_id')` + `orderBy('date')` exige índice
>   composto e o único índice de `arena_open_slots` é `[arena_id, starts_at]`;
>   a consulta falhava sempre e o erro virava lista vazia. O guarda de índices
>   não pegava porque estas consultas montam as condições num VETOR, com o
>   `orderBy` fora do `query(...)` — o guarda agora varre por função também (e
>   ignora comentários, que citavam `orderBy` e o faziam acusar a si mesmo).
>   Com ele, mais **quatro consultas mortas** apareceram: catálogo de
>   professores da arena, agenda de aulas, torneios internos e a lista global de
>   vagas. **(2) 🐞 A peneira de nível comparava escalas diferentes** — a vaga
>   validava 0–7 e comparava contra `profile.level`, que é código de faixa; ou
>   não filtrava, ou filtrava errado. Agora é a régua única 2.0–8.0 dos dois
>   lados, e nível desconhecido NÃO barra (a plataforma não inventa nível).
>   **(3) 🐞 A vaga não ocupava a quadra**: era texto livre, sem `court_id`, e
>   a arena vendia o mesmo horário duas vezes. Virou `court_id` opcional +
>   `openSlotBlocks`/`mergeOpenSlotBlocks`, o mesmo desenho do dia de jogo, e
>   entrou no conflito de reserva e nos três calendários. **(4) 🐞 A fila de
>   espera nunca chamou ninguém**: `notifyNextInLine` não era invocada de lugar
>   nenhum, a notificação apontava para `/minha-fila` (rota que nunca existiu) e
>   o prazo da promoção não era cumprido por ninguém — vaga presa para sempre.
>   Agora sair de um jogo lotado chama o próximo, a Cloud Function
>   `advanceOpenSlotWaitlist` expira e avança a cada 10 min, e o atleta tem onde
>   confirmar. De quebra: datas em pt-BR, "lotado" deixou de dizer "inscrições
>   encerradas" (era o que escondia a fila) e falha parou de virar lista vazia.
>   **Zero coleção, zero índice, zero regra**; um campo opcional e uma função
>   agendada. Ver `docs/24-MODULOS-DE-ARENA/01-MATCHMAKING.md`.
>
> - **Onda AG — Módulos adicionais da arena: o chassi** (2026-09-13): a Arena V3
>   existia no código desde julho e **não funcionava para ninguém** — a "Onda O"
>   removeu as 51 flags `arena_module_*` de `FEATURE_FLAG`, e como
>   `normalizeFeatureFlags` só devolve chave conhecida, `canArenaUseModule`
>   começava com `if (!platformFlags.arena_modules) return false` e **todo
>   módulo resolvia para desligado, sempre**. A aba "Arena V3" do painel admin
>   não renderizava nada (itera `FEATURE_FLAG`, que não tinha mais nenhuma), e a
>   tela de módulos da arena tinha o mapa de flags **escrito na mão como objeto
>   vazio** — toda linha dizia "a plataforma ainda não ativou". Agora são
>   **três camadas explícitas**: a plataforma LIBERA (Funcionalidades → Módulos
>   de arena), a arena ATIVA (Configurações → Módulos), o usuário VÊ. Catálogo
>   de **50 módulos** com público, benefício por persona, dependências, rotas e
>   configuração; gate puro que devolve o MOTIVO (a tela precisa dizer por que,
>   e o motivo é outro para o admin e para a arena); cascata avisada antes de
>   gravar (ligar a carteira liga membros junto; desligar membros derruba
>   carteira, pacotes e mensalidade — com a lista na tela) e gravada em LOTE.
>   **Zero coleção nova, zero regra nova, zero índice**: a camada da plataforma
>   é um documento em `platform_settings`, que já tinha regra. De quebra, **doze
>   regras quebradas** foram corrigidas — `delete` e `read` condicionados a
>   `request.resource.data`, que não existe nessas operações (ninguém apagava
>   professor, aula, cupom, campanha, checklist, dispositivo, ladder ou item de
>   estoque; a arena nunca leu o próprio NPS) — e três brechas fechadas
>   (`arena_sales`, `arena_payments` e `arena_referrals` aceitavam
>   `create: if isAuthed()`, então qualquer conta forjava venda em qualquer
>   arena e indicação em nome de outra pessoa). 43 asserções novas no emulador.
>   Ver `docs/24-MODULOS-DE-ARENA/00-INDEX.md`.
> - **Onda AG — Sortear a rodada inteira** (2026-09-14): com o número exato de
>   jogadores para encher as quadras — 8 em 2, 12 em 3 — os jogos saíam sempre
>   entre os mesmos. Não era o motor de rodízio: era o MOMENTO. Quando a quadra
>   1 termina, os únicos 4 na fila são os 4 que saíram dela, e com quatro
>   pessoas só existe um grupo possível; os dois quartetos jogavam a noite
>   inteira sem se cruzar. Agora quem organiza escolhe: **criar a próxima aqui**
>   (mantém o grupo, comportamento de sempre), **só encerrar** (libera a quadra
>   sem sortear — a novidade que torna a rodada possível no Play) ou **sortear
>   todas as quadras**, que com a fila inteira na mesa distribui e mistura. As
>   duas funções de rodada saem da PREVISÃO que a tela já mostra
>   (`simulatePlaySequence` / `forecastAmericanoLiveMatches`), não de um sorteio
>   paralelo: o que se anuncia é o que se cria, com teste travando a igualdade.
>   A rodada é gravada num lote só — meia rodada consumiria a fila pela metade.
>   O botão só aparece com mais de uma quadra e só habilita com duas livres e
>   fila para as duas; enquanto não dá, a tela **explica o caminho** em vez de
>   só desabilitar. Vale nas três telas: painel do atleta, painel da arena e
>   telão. **Zero banco.** Ver `docs/16-DIA-DE-JOGO-RODIZIO.md` §10.
>
> - **Onda AF — O dia de jogo fecha a quadra de verdade** (2026-09-13): três
>   defeitos vistos em tela. **(1) 🐞 O dia de jogo não bloqueava o
>   calendário**: um dia de jogo das 18h às 22h nas três quadras, e a grade
>   oferecendo os quatro horários como livres — com o aviso de que estavam
>   fechados logo acima. A quadra fechada saía SÓ da cópia gravada em
>   `arena_unavailabilities`, e cópia que não chega deixa o sistema inteiro sem
>   saber. Agora o dia de jogo é a FONTE (`gameDayBlocks`/`mergeGameDayBlocks`)
>   e as telas somam gravados + derivados sem duplicar. **(2) O pedido de
>   reserva nunca conferia bloqueio** — só outras reservas; o formulário
>   completo, que não passa pelo calendário, deixava pedir exatamente a quadra
>   fechada. `checkUnavailabilityConflict` recusa dizendo o motivo, nos três
>   caminhos de criação, a reserva manual da arena inclusive. E o bloqueio
>   deixou de depender de feature flag: a flag gateia o que se MOSTRA, não se a
>   quadra está ocupada. **(3) A tela repetia a si mesma**: o card
>   "Organização" saía duas vezes (da página e do organizador) e havia DUAS
>   listas das mesmas pessoas — "Inscritos", em cima, que só removia, e
>   "Participantes", recolhido embaixo, que é onde estão dupla, pausa e
>   exclusão. Uma lista, num lugar só; o painel da arena virou **Vagas**, que é
>   a pergunta dela e não é respondida em nenhum outro lugar. De quebra, o
>   bloqueio derivado não tem documento — a tela da arena tinha um botão
>   "Remover indisponibilidade" que apagaria o nada, e apagar a cópia GRAVADA
>   abriria a quadra com o dia de jogo ainda em cima; agora ali se vê o dia de
>   jogo e o caminho para ele. **Zero banco.**
>   Ver `docs/22-DIA-DE-JOGO-DA-ARENA.md`.
>
> - **Onda AE — A arena abre rápido, e para de mentir quando não sabe**
>   (2026-09-13): abrir uma arena era uma FILA de esperas que não dependiam
>   umas das outras — baixar o pacote, montar, só então pedir a arena, e só
>   então quadras, janelas, reservas e bloqueios. Cinco cortes, **zero banco**:
>   **pré-busca por intenção** (o dedo encosta no cartão e as consultas saem
>   enquanto o pacote da tela baixa), **a arena vem semeada da lista** (que já
>   trouxe o documento inteiro), **fim de um N+1 que rodava em TODA tela**
>   (`listMyManagedArenas` buscava as arenas em fila, e o menu pergunta isso
>   sempre), **as quinze abas da Central agora chegam sob demanda**
>   (170 kB → **37 kB**) e **o diálogo do dia baixa depois da pintura**, com
>   aquecimento no ocioso para o clique seguir instantâneo (80 kB → **60 kB**).
>   As chaves de cache viraram fonte única, com teste lendo o código-fonte:
>   chave escrita duas vezes diverge um dia, e o sintoma não é erro — é buscar
>   de novo o que já estava em cache, para sempre. **E duas mentiras caíram**:
>   o mês desenhava ANTES de as reservas chegarem (mês sem reserva parece mês
>   livre) e, quando a consulta FALHAVA, a lista vazia virava "esta arena não
>   publicou horários" — na lista de arenas, "Nenhuma arena encontrada,
>   cadastre uma arena", como se a plataforma estivesse vazia. Agora ocupação
>   só é afirmada com dado na mão, e falha tem texto próprio e botão. Por fim,
>   **datas em pt-BR em toda a arena**: `2026-07-23 · 19:00` virou
>   `Qui, 23/07 · 19:00–20:00`, com o ano quando não é o corrente — e o painel
>   da arena parou de mostrar o status cru do banco ("requested: 3").
>   Ver `docs/23-ARENA-CALENDARIO-E-RESERVA.md` §11-§13.
>
> - **Onda AD — O preço certo e a ocupação legível** (2026-09-13): duas coisas
>   que a tela dizia errado. **(1) O preço.** Selecionar três horários somava na
>   tela e a reserva chegava à arena valendo **uma hora** — e o mesmo número
>   reaparecia na lista do dia, várias quadras pendentes, todas com o preço de
>   uma hora. Não era exibição: `resolveArenaPrice` devolve o valor POR HORA e
>   era ele que ia para `proposed_price`. A conta virou domínio
>   (`totalBookingPrice`, cada horário na SUA faixa) e o **serviço a refaz antes
>   de escrever**, documento a documento, nos dois caminhos de criação — a tela
>   estima, quem grava confere. Para o que já estava gravado,
>   `bookingPriceInfo(booking, { arena })` recalcula na leitura, e a linha de
>   reserva do atleta busca a arena sozinha para que a MESMA reserva mostre o
>   MESMO número dos dois lados do balcão. **(2) A ocupação.** O calendário
>   mensal contava a arena como se fosse UMA quadra: uma reserva às 19h fazia as
>   19h contarem como ocupadas — com duas quadras livres. `aggregateDayStatus`
>   passou a contar em **horas-quadra** (`courts`), e cada dia ganhou barra
>   proporcional + "4h livres" / "Lotado" / "Bloqueado" (que não é a mesma
>   coisa), no lugar de dois números que eram horas contadas como reservas. O
>   mês ganhou resumo ("2 dias com horário livre em julho") e, quando não há
>   nenhum, **o próximo dia livre** em vez de um botão de "próximo mês" no
>   escuro. De quebra, reservas e bloqueios passaram a ser indexados por data —
>   a grade fazia 42 dias × quadras varreduras da lista inteira. E o resumo do
>   diálogo do dia parou de chamar HORÁRIOS de "solicitações". **Zero banco**:
>   nenhum campo, coleção, índice, regra ou função; nenhum dado histórico
>   reescrito. Ver `docs/23-ARENA-CALENDARIO-E-RESERVA.md` §8-§10.
>
> - **Onda AC — A reserva em duas telas, sem repetir pergunta** (2026-09-12):
>   reservar eram duas telas, e a segunda **re-perguntava tudo o que a primeira
>   já tinha respondido** — data, horário, "qualquer/específicas/todas",
>   "avulso/recorrente" —, num vocabulário diferente e com as respostas podendo
>   se contradizer. Agora: **calendário (o DIA) → grade (QUADRA e HORÁRIOS) →
>   confirmar**. A segunda tela mostra a escolha agrupada por quadra e faz só
>   as perguntas que sobraram. **E uma limitação escondida caiu**: o serviço
>   gravava uma reserva por quadra, mas todas com os MESMOS horários — então
>   "Quadra 1 às 19h e Quadra 2 às 20h" não cabia num pedido. A escolha virou
>   uma lista de CÉLULAS (`bookingSelection.js`), `groupSelectionByCourt` a
>   traduz para os pedidos certos e `createBookingsForSelection` valida todos
>   os pares antes de escrever e grava num lote só — tudo ou nada, com
>   `booking_group_id` comum. A matriz quadra × horário virou o padrão com mais
>   de uma quadra, e "toda semana" repete a escolha INTEIRA (o metadado
>   `recurrence` só é gravado quando é verdade — um horário só; com vários,
>   fica `null` em vez de mentir num campo que alguém exibe). O formulário
>   completo do botão "Solicitar reserva" da página da arena segue idêntico,
>   com teste travando os dois modos. **Zero banco**: nenhum campo novo,
>   coleção, índice, regra ou função. Ver `docs/23-ARENA-CALENDARIO-E-RESERVA.md` §6.
>
> - **Onda AB — Arena: calendário, reserva e prontidão** (2026-09-12):
>   auditoria de ponta a ponta da arena, dos dois lados do balcão. **Dois bugs
>   reais**: (1) o fim de um slot era "o próximo horário da grade" — numa arena
>   com horário PARTIDO (manhã e noite) a grade tem buracos, e clicar nas 09:00
>   pedia reserva **das 09:00 às 18:00**, nove horas, com preço e ocupação
>   correspondentes; (2) `hora + 1` cego passava meia hora além do fechamento
>   numa janela que acaba às 21:30. A conta virou domínio testado
>   (`slotEndTime`). **A quadra invisível**: quadra sem janela de horário não
>   entra no calendário, não aceita reserva, não entra em dia de jogo — e nada
>   dizia isso ao dono, que só descobria quando alguém reclamava; agora é
>   avisado em três alturas, e o atleta também deixou de ver um mês cinza sem
>   explicação. **A pergunta sem resposta**: "2 de 3 quadras livres" não dizia
>   QUAIS; o atleta ganhou a matriz quadra × horário (`CourtTimePicker`), em
>   que clicar ESCOLHE a quadra — escolha que agora chega ao pedido e ao preço,
>   em vez de se perder no último passo. E o diálogo do dia deixou de pedir
>   rolagem por reservas alheias antes de mostrar os horários: a grade vem
>   primeiro, "sem horário livre" virou aviso acima dela em vez de parede no
>   lugar dela, e as legendas mostram só as cores que estão na tela. O
>   calendário da ARENA passou a mostrar os dias de jogo que ela mesma marcou.
>   **Zero banco** — nenhuma regra, coleção, índice ou função tocada.
>   Ver `docs/23-ARENA-CALENDARIO-E-RESERVA.md`.
>
> - **Onda AA — Dia de jogo da arena** (2026-09-12): a arena passa a criar o
>   próprio dia de jogo, **marcado no calendário** — o que FECHA a data e as
>   quadras escolhidas para reserva. Horário do dia todo ou por quadra; mais de
>   um dia de jogo na mesma quadra no mesmo dia, desde que em horários
>   diferentes; limite de atletas no dia, por quadra, ou nenhum; e a escolha de
>   se só a equipe da arena conduz as partidas ou se os inscritos também. O
>   atleta marca presença pela página e pelo calendário da arena.
>   **Nenhuma coleção nova**: é o mesmo `game_days` com campos aditivos
>   (`arena_id`, `arena_slots`, `signup_mode`, `capacity`) — ausente `arena_id`,
>   nada muda. O corolário é o que importa: **o ambiente do atleta não precisou
>   de nada novo** (sorteio, Play, Americano aprimorado, ranking do dia, telão,
>   tutoriais). Fechar a quadra também não é código novo: grava
>   `arena_unavailabilities` com `source: 'game_day'`, e conflito de reserva,
>   status de slot e calendário mensal já respeitam. **Três bugs de regra
>   encontrados e corrigidos no caminho**: (1) nenhum gestor de arena conseguia
>   APAGAR o próprio bloqueio de calendário (a regra olhava
>   `request.resource.data` num delete); (2) SAIR de um dia de jogo público era
>   recusado, porque o recálculo de membros tira quem saiu da lista; (3) ENTRAR
>   era permissivo demais — bastava "eu estou na lista nova", o que deixava
>   qualquer membro remover os outros. **57 asserções no emulador** (30 já
>   existiam). Ver `docs/22-DIA-DE-JOGO-DA-ARENA.md`.
>
> - **Onda Z — Ajuda no momento em que dói** (2026-09-12): a central de ajuda
>   deixou de ser um manual bem escrito para virar uma tela que **responde
>   rápido**. Ninguém abre a ajuda por lazer: abre travado, no meio de outra
>   coisa, já irritado — e a primeira versão cobrava quatro passos ali (achar o
>   link, adivinhar a persona, varrer dez artigos, abrir). Agora: **o link de
>   ajuda de TODA tela leva a rota junto** (`helpLinkFor` → `?de=`) e a central
>   abre com "Ajuda para esta tela"; a tela inicial começa por **perguntas**
>   ("Como me inscrevo num torneio?"), porque buscar pressupõe saber o nome da
>   coisa e quem está perdido não sabe; **cartões de identificação** ("Eu
>   jogo", "Tenho uma arena", "Dou aulas") no lugar de abas abstratas, com a
>   escolha **lembrada por usuário**; a busca **destaca** o termo e mostra o
>   **trecho do corpo** onde ele apareceu, ganhou atalho `/`, `Esc`/X para
>   limpar, e **"nada encontrado" virou sugestão, não parede**; e todo artigo
>   aberto termina com **Próximo**, **Copiar link** e **Topo** — sem becos.
>   Os testes novos travam o contrato entre quem gera o link e quem o lê, a
>   existência de cada rota de origem, a ordem específico-antes-de-genérico das
>   pistas (o genérico engoliria o específico) e que o destaque nunca perde nem
>   inventa caractere. **Zero Firestore** — a única memória é a parte
>   preferida, no `localStorage` por usuário. Ver `docs/21-CENTRAL-DE-AJUDA.md`
>   §2.
>
> - **Onda Y — Central de ajuda** (2026-09-11): a página `/ajuda` (flag
>   `help_center`, default OFF) — o manual da plataforma dentro dela, dividido
>   por TIPO DE USUÁRIO: Começar aqui, **Atleta**, **Arena**, **Professor**,
>   Conta e privacidade. 33 artigos feitos de blocos tipados (parágrafo, passo
>   a passo, lista, dica, atenção, atalho), com busca que procura no CORPO dos
>   textos, ignora acento e em que vários termos estreitam o resultado.
>   Acesso em TRÊS pontos de toda tela (barra lateral, menu do usuário, gaveta
>   do celular), fora dos hubs de propósito: ajuda não é um tema da plataforma,
>   é o que se procura quando se está perdido em qualquer um deles. Estado na
>   URL (`?s=&a=&q=`) permite mandar alguém direto ao artigo. Dois testes
>   guardam o essencial: **todo link interno aponta para rota que existe**
>   (lendo `V2App.jsx`) e **a ajuda não documenta o que está atrás de flag
>   desligada** (a gamificação). **Zero banco** — nem localStorage.
>   Ver `docs/21-CENTRAL-DE-AJUDA.md`.
>
> - **Onda X — Tutoriais em tela** (2026-09-11): quatro tutoriais completos
>   dentro das próprias ferramentas — **torneio** (criar → modalidades →
>   inscrições → sorteio → resultados → encerramento/ranking → página pública e
>   telão) e **dia de jogo** nos formatos **Play**, **Americano** (que serve
>   também a Mexicano e Rei da Quadra: a tela é a mesma) e **Americano
>   aprimorado**. Abrem sozinhos na primeira vez que a pessoa entra na
>   ferramenta, podem ser DISPENSADOS de qualquer jeito (X, Dispensar, Entendi,
>   clicar fora) e o botão "Como funciona" fica sempre lá para REVER. No
>   diálogo de criação de dia de jogo o botão acompanha o formato selecionado —
>   sem isso os tutoriais só existiriam depois do dia criado, tarde demais para
>   ajudar a escolher. Conteúdo é domínio puro e testado (módulo novo `help/`);
>   a memória de "já viu" é `localStorage` por usuário — **zero coleção, zero
>   regra, zero migração**. Contra o bug clássico do modal que reaparece: marca
>   por USUÁRIO (não por sessão) + abertura latcheada por ref.
>   Ver `docs/19-TUTORIAIS.md`.
>
> - **Onda W — Rankings atualizados na publicação** (2026-09-11): todo resultado
>   publicado passa a atualizar, NA HORA, os três rankings de partida — ELO/
>   nacional, rating estilo DUPR (2.0–8.0) e duplas. São gatilhos do Firestore
>   (`club_event_games`, `tournament_matches`, elegibilidade de torneio) que
>   rodam no SERVIDOR: materializar ranking é escrita que só o admin pode fazer,
>   e quem publica um dia de jogo quase nunca é o admin — a tentativa do cliente
>   era recusada pela regra e morria num `catch`. Rajadas (publicar um dia
>   grava dezenas de partidas) são coalescidas por um lease, custando duas
>   passadas. **Bug corrigido junto**: o recálculo de servidor que já existia
>   lia só `tournament_matches` e ignorava `club_event_games`, então toda vez
>   que rodava apagava do ranking nacional os resultados de dia de jogo.
>   O ranking de **duplas** passou a ser materializado em `doubles_rankings`
>   (coleção nova, leitura pública, escrita só do admin; zero índice, zero
>   migração) e classificado por **aproveitamento → vitórias → derrotas →
>   saldo**; a página ganhou paginação 20/50/100 com estado na URL e deixou de
>   ler quatro coleções inteiras a cada abertura. Os motores duplicados
>   (cliente × Functions) ganharam **teste de paridade** sobre 400 partidas.
>   Ver `docs/18-RANKINGS.md`.
>
> - **Onda V — Dia de jogo: Americano aprimorado** (2026-09-10): formato NOVO
>   (`americano_live`, flag `gameday_americano_live`, default OFF) que junta a
>   organização do Play — quadra a quadra, fila de participação, pausa, dupla
>   fixa, entrar e sair a qualquer hora — ao **placar** do Americano: ranking do
>   dia, partidas concluídas com resultado, criação manual, edição e exclusão, e
>   publicação no ranking/rating da plataforma e no DUPR. O sorteio funde os dois
>   motores: o primeiro da fila SEMPRE entra (baseline do Play) e os outros três
>   saem de uma janela dos 8 primeiros, pareados por `pairFourBalanced` (o motor
>   do Americano). O fluxo é de DOIS passos — **"Lançar resultado"** libera a
>   quadra e só então aparece **"Gerar próxima partida"**. O telão ganhou o
>   terceiro arranjo, e `buildGameDayBoard` passou a aceitar `format`
>   (opcional; omitido, comportamento idêntico ao anterior). **Zero regra nova
>   no `firestore.rules`**, zero coleção, zero índice, zero migração: só mais um
>   valor possível em `game_days.format`. O formato NÃO herda o atalho
>   colaborativo do Play (`isPlayGameDayMember`), porque aqui o resultado
>   alimenta o ranking da plataforma — provado por 6 asserções no emulador.
>   Ver `docs/17-DIA-DE-JOGO-AMERICANO-APRIMORADO.md`.
>
> - **Onda T — Dia de jogo: quem organiza** (2026-09-06): o criador escolhe, na
>   criação e na edição, se **só ele e quem ele autorizar** operam as partidas
>   (sortear, criar próxima, substituir, indisponível, vincular dupla,
>   incluir/excluir participante) ou se isso fica **aberto a qualquer inscrito**;
>   e ganha um card **Organização** para nomear outros usuários da plataforma
>   como admin do dia de jogo. Comando sem atribuição **não aparece** (não é só
>   desabilitado). Configurar (editar, arquivar, mudar o modo, nomear admin,
>   publicar no ranking) continua exclusivo do criador — publicar exige
>   `isGameDayOwnerOf` em `club_event_games` e não afrouxamos essa regra.
>   Dois campos opcionais (`manage_mode`, `admin_uids`); **ausentes ⇒
>   comportamento antigo**, sem migração. Regras aditivas, provadas por 24
>   asserções no emulador. Ver `docs/15-DIA-DE-JOGO-PERMISSOES.md`.
>
> - **Onda S — Dia de jogo: colapsáveis + telão** (2026-09-05): toda seção do
>   dia de jogo (os quatro formatos + o dia de jogo do clube) recolhe e LEMBRA
>   por usuário (`v2:collapse:<uid>:<secao>`, só no navegador); e a rota
>   `/dia-de-jogo/:id/telao` abre um painel em tela cheia para a segunda tela,
>   adaptado a retrato e paisagem e atualizando sozinho a cada 15 s. O conteúdo
>   MUDA com o formato: na grade vão ranking do dia e últimos resultados; no
>   Play vão a próxima partida DE CADA QUADRA e a ordem de participação — **o
>   Play não grava placar**, então ali não existem resultados nem ranking. No
>   Play, quem ORGANIZA também conduz o dia pelo próprio telão (criar próxima
>   partida, criar jogo em quadra livre, cancelar, deixar indisponível ou
>   substituir clicando no nome,
>   pausar, vincular dupla); para todos os outros segue só leitura. Zero
>   impacto no banco.
>   Ver `docs/14-DIA-DE-JOGO-TELAO.md`.
>
> - **Onda R — Nível unificado nos sorteios** (2026-09-04): uma régua só
>   (2.0–8.0, a do DUPR) para TODOS os sorteios, alimentada por
>   DUPR informado → rating 2.0–8.0 da plataforma → ELO → nível declarado
>   (convertido para a mesma escala). Aplicada em dia de jogo
>   (Americano, Mexicano, Rei da Quadra e Play) e no seeding de torneios.
>   Leitura pura: **zero impacto no banco** (nenhuma coleção, campo, índice
>   ou regra novos). Ver `docs/13-NIVEL-UNIFICADO.md`.
> - **Gamificação V2** (#115): em produção atrás de `gamification_v2`
>   (default OFF). Documentação exclusiva em `docs/FUTURO/GAMIFICACAO/`.
>
> - **Onda G — DUPR / Rating estilo DUPR** (#128-#133, Sprints 38-43):
>   ranking próprio estilo DUPR (escala 2.0-8.0) em aba separada,
>   motor baseado em placar + confiabilidade, evolução por jogo,
>   redesign visual (#133). Flag `skill_rating_dupr` (default OFF).
>   ELO existente permanece intacto.
> - **Onda H — Engajamento (4 flags)** (#134, Sprints 44+):
>   `action_home` (Home orientada a ação), `smart_matchmaking`
>   (score 0-100 em Encontrar jogadores), `post_game_flow`
>   (Jogar de novo + Ver minha evolução), `push_notifications`
>   (PWA push com FCM + SW dedicado).
> - **Onda I — Torneio por equipes** (#105-#112, Sprints 32-37):
>   modalidade Equipes (sortear, jogar, ver ranking, etapas),
>   resultados espelhados em `club_event_games` com
>   `source='team_confrontation'`. Flag `team_tournaments`.
> - **Onda J — Arena Mercado** (#95-#100, Sprints 32-36):
>   catálogo padrão de produtos, mercado unificado, vendas
>   só do que está/esteve em estoque, gestão de catálogo.
> - **Onda K — Game Day Play** (#101-#109): formato Play
>   (open play) com organizador/participante separados,
>   sorteio aditivo, ranking do dia, visões separadas.
> - **Onda L — Admin + Moderation** (#110, #120): moderação
>   de atletas (ocultar contas falsas/teste), DUPR match CSV
>   export, bulk re-sync do diretório.
> - **Onda M — Coach** (#133-#135): descoberta aprimorada
>   (filtros + ordenação), alunos ligados à evolução, semente
>   de rating por nível validado.
> - **Onda N — Arena Ops** (#136+): painel "Como foi sua
>   semana" (arena_ops_kpis), preço dinâmico, checkout unificado,
>   CRM de membros (4 flags).
> - **Onda O — Refactor** (lotes 1-2): conversão de flags em
>   código (lotes 1 e 2) + enxugar catálogo para a única
>   flag remanescente. **137 feature flags viraram código**
>   (default ON em produção). Apenas 6 flags novas default OFF.
> - **Onda P — Tournament UX** (#113-#125): console de gestão
>   dedicado, "Meus torneios" no Perfil, inscrições/sorteio
>   colapsáveis, cards que iniciam fechados, fase de grupos
>   com múltiplos grupos, gêneros respeitados, visão pública
>   + impressão de grupos.
> - **Onda Q — V1 Legacy Cleanup** (`0f824b0`): remoção de
>   páginas V1 mortas em `src/modules/*/pages`.

| Métrica | Valor | Delta do início do agente |
|---|---|---|
| **Testes Vitest** | **4829 passing** (284 arquivos) + 218 asserções de regras (Vitest) + 85 do dia de jogo no emulador | +4421 (era 408) |
| **Lint errors** | 0 | era 30+ |
| **Módulos** | 21 (+`help` — conteúdo dos tutoriais em tela) (`games` e `legal` saíram como `src/modules/` mas continuam como pastas oficiais — **rating virou módulo oficial** com domain/services/hooks/components) | +4 (coaches, circuits, games, legal) |
| **V2 pages** | 82 (+V2GameDayTelao — telão, fora do V2Layout; +V2Help — central de ajuda; +V2ArenaKiosk — totem da recepção, também fora do V2Layout; +V2ArenaCheckin; +V2ArenaAttendance) | +58 |
| **V2 components (src/v2/components/)** | **16 pastas** (+home, +rating, +settings, +tournament cresceu muito, +admin) | — |
| **Coleções Firestore** | **122 top-level em `firestore.rules`** (+`doubles_rankings`) (as 13 da gamificação V2 documentadas em `05-DATA-MODEL.md`) — a Onda AS não criou nenhuma | +82 |
| **Índices compostos Firestore** | **33 em `firestore.indexes.json`** (+`provisional_claims`) (+4 da gamificação V2) | +28 |
| **Feature flags ativas** | **20 default OFF** (+`arena_modules` — a chave-mestra dos módulos adicionais de arena; 137 viraram código) | −112 |
| **Cloud Functions** | **14** (+ `recomputeRankingOnTournamentRegistration` — a inscrição também move o ranking) | +14 |
| **PRs mergeados** | **96 totais** (Sprints 0-50+) | — |
| **Origin/main** | `106bd55` (PR #110) | — |
| **Bundle deployed** | (deploy em curso) | — |
| **Live URL** | https://picklerush.web.app | — |

Quando você for commitar, atualize esta seção se os números mudarem.

---

## 11. Onde pedir ajuda / reportar problema

- **Bug em produção?** → Reproduzir em dev → fix/X branch → PR → squash merge → deploy.
- **Bug "feature flag X não funciona"?** → Checar `01-AI-CONTEXT` §9 + `featureFlagGroups.js`.
- **Build quebrou?** → Rodar `npm run build` local, ver erro. Geralmente import faltando (lição sw-v72.5, sw-v73.4).
- **Tests quebraram?** → Rodar `npx vitest run <arquivo>` pra ver qual falhou.
- **Deploy quebrou?** → Verificar logs em GitHub Actions (`.github/workflows/deploy-firebase.yml`).
- **Firestore rule rejeitou?** → Testar no console do Firebase com simulador.
- **Não sabe por onde começar?** → Volte ao §3 (mapa) ou §5 (decisão rápida).

**Gotchas de bugs reais (aprendidos na marra):**
- **Diálogo cortado em paisagem (tablet/celular):** `DialogContent`/`AlertDialogContent`
  precisam de `max-h-[90dvh] overflow-y-auto`. Sem isso, em telas baixas o
  rodapé (campos + botão salvar) fica fora da viewport e inacessível.
- **Modal de onboarding reaparecendo toda sessão:** não confie só num flag de
  sessão (`sessionStorage`). Gate a abertura por `isRequiredProfileComplete` (e
  `onboarding_completed_at`), com trava latcheada por usuário, para abrir **só na
  primeira entrada** e não fechar no meio do fluxo ao salvar.
- **Colisão de coleção Firestore:** antes de reusar um nome de coleção (ex.:
  `arena_waitlist`), confirme que outra feature não o usa com outro shape —
  consultas por `arena_id` contaminam entre features. Use coleção própria
  (ex.: `booking_waitlist`).

---

## 12. Resumo de 1 página (cola)

```
PLATAFORMA   PickleRush (picklerush.web.app)
STACK        React+Vite, Tailwind+shadcn, Firebase (db 'pickleball'), React Query, Vitest
MODELO       19 módulos em src/modules/X/{domain,services,hooks,pages,components}/
UI ATIVA     src/v2/ (67 pages, 2-level nav, dark ink/acid/paper)
FEATURES     6 flags (dupr_official_sync + dupr_match_export + action_home/smart_matchmaking/post_game_flow/push_notifications, default OFF)
SCHEMA       94 coleções top-level em firestore.rules
TESTES       1350 vitest (domain obrigatório)
DEPLOY       push main → GitHub Actions → firebase hosting (sites picklerush+pickletour)
SEGURANÇA    firestore.rules (aditivas), audit_logs em mutações
PWA          VITE_PWA_ENABLED=true; sw-vN.js versionado; auto-unregister; reload deferido
WORKTREE     SEMPRE 1 worktree por feature, remover após merge
LINT         0 errors (npm run lint --quiet)
TIPOS        JSDoc + core/domain/types.js
I18N         pt-BR em tudo
ADMIN        fsalamoni@gmail.com (platform_admin, uid Kx7CC0NVgogh8cCF4wIRmpOvo7r2)
```

---

> **Última atualização**: 2026-07-24 (pós sub-ondas 8b–5b + fixes de UX).
> Ao mudar arquitetura, coleção, módulo, rota, fluxo de deploy, padrão de
> código ou processo → atualizar este arquivo + 01-AI-CONTEXT + o doc
> específico. Manter a estrutura: §0 TL;DR + §1 como usar + §2 princípios +
> §3 docs + §4 onde está + §5 como faço + §6 planejar + §7 checklist + §8 personas.
