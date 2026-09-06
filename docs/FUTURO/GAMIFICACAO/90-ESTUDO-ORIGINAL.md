# PickleRush — Análise Completa + Plano de Gamificação & Engajamento

> **Status do documento:** Definições e ideias. **Nenhuma execução foi feita.**
> Última atualização: 2026-09-01 · Autor: Mavis
>
> **Escopo:** entender a fundo o sistema de XP / níveis / estatísticas atual
> (a partir do código do repo `fsalamoni/pickleball` e da página ao vivo
> `picklerush.web.app/meu-desempenho`) e propor um plano de gamificação que
> gere engajamento de verdade em todas as frentes da plataforma — não só em
> torneios. Sem alterar a regra de ouro do projeto: tudo atrás de feature
> flag, nada que prejudique o que já funciona.

---

## Sumário

1. [Mapa do que existe hoje](#1-mapa-do-que-existe-hoje)
2. [Anatomia do sistema de XP, níveis e progressão](#2-anatomia-do-sistema-de-xp-níveis-e-progressão)
3. [Como o sistema atual falha em gerar hábito](#3-como-o-sistema-atual-falha-em-gerar-hábito)
4. [Padrões de mercado que importam pra PickleRush](#4-padrões-de-mercado-que-importam-pra-picklerush)
5. [Princípios do plano de gamificação](#5-princípios-do-plano-de-gamificação)
6. [Pilares de gamificação propostos](#6-pilares-de-gamificação-propostos)
7. [Mapa de gatilhos por feature da plataforma](#7-mapa-de-gatilhos-por-feature-da-plataforma)
8. [Sistema de XP/Níveis expandido](#8-sistema-de-xpníveis-expandido)
9. [Conquistas: taxonomia completa](#9-conquistas-taxonomia-completa)
10. [Missões e desafios](#10-missões-e-desafios)
11. [Estações, temporadas e eventos ao vivo](#11-estações-temporadas-e-eventos-ao-vivo)
12. [Sistema social: rivals, crews, mentores](#12-sistema-social-rivals-crews-mentores)
13. [Sistema de convites & viralidade](#13-sistema-de-convites--viralidade)
14. [Onboarding gamificado + re-engajamento](#14-onboarding-gamificado--re-engajamento)
15. [Painel do professor (engajamento do lado "supply")](#15-painel-do-professor-engajamento-do-lado-supply)
16. [Arena: CRM + health score](#16-arena-crm--health-score)
17. [Clubes: vida social & leaderboards internos](#17-clubes-vida-social--leaderboards-internos)
18. [Mecânicas de "review da semana" & jornada emocional](#18-mecânicas-de-review-da-semana--jornada-emocional)
19. [Mecânicas de proteção (anti-burnout, anti-cheating)](#19-mecânicas-de-proteção-anti-burnout-anti-cheating)
20. [Roadmap sugerido (Fases) com feature flags](#20-roadmap-sugerido-fases-com-feature-flags)
21. [Métricas de sucesso](#21-métricas-de-sucesso)
22. [Anexo: lista exaustiva de ideias extras ("Cardápio")](#22-anexo-lista-exaustiva-de-ideias-extras-cardápio)

---

## 1. Mapa do que existe hoje

Antes de propor, mapeei **o que já existe**. O PickleRush é um sistema
extremamente mais profundo do que a tela "Meu desempenho" deixa transparecer.

### 1.1 Os 21 módulos (do `picklerush-platform`)

```
achievements · admin · analytics · arenas · athletes · chat · circuits
· clubs · coaches · games · legal · leveling · notifications · partners
· performance · progression · rating · sharing · social · tournament
```

Cada módulo já tem domínio puro, services, hooks e pelo menos uma página V2.
**1.447 testes verdes.** Build verde. 102 coleções no Firestore. 131 feature
flags. PWA com SW ativo.

### 1.2 As rotas V2 (60+ páginas)

```
Atleta:    /atletas · /atleta/:uid · /perfil · /perfil/editar · /meu-desempenho
Torneios:  /torneios · /torneios/criar · /torneios/ingressar · /torneios/guia
           /torneios/:id · /torneios/:id/modalidades/:modId · /torneios/:id/:tab
           /torneios/:id/imprimir · /p/:id (espectador com onSnapshot)
Ranking:   /ranking · /ranking/duplas · /encontrar-jogadores · /procura-jogo
           /parceiros · /doubles-ranking
Aulas:     /coaches · /coaches/:uid · /aulas · /clinicas
Arenas:    /arenas · /arenas/criar · /arenas/:id · /arenas/:id/gerir
           /minhas-reservas
Clubes:    /clubes · /clubes/criar · /clubes/:id · /clubes/:id/eventos/:eventId
Social:    /novidades · /chat · /meus-jogos · /dia-de-jogo
Pessoal:   /perfil · /configuracoes
Legal:     /regras · /nivelamento · /historia · /conduta · /politica-uso
Admin:     /admin/torneios · /admin/metricas · /admin/parceiros · /admin/perfis
           /admin/console
```

### 1.3 O que cada ator já tem de comportamento

| Ator | O que pode fazer | Dados gerados |
|---|---|---|
| **Atleta** | Inscrever-se em torneio, jogar (com placar), entrar em clube, seguir pessoas, postar no mural, comentar em fórum, abrir "procuro jogo", criar game-day, reservar quadra em arena, agendar aula com professor, comprar pacote, validar nível com professor, criar/aceitar/matchar com parceiros (smart matchmaking: rating + lado + cidade + interesses) | XP, nível, streak, rating ELO, ranking DUPR 2.0–8.0, achievements, goals, follows, h2h (head-to-head) |
| **Organizador de torneio** | Criar torneio (com wizard de 8 etapas), inscrever atletas, gerar chave/sorteio, lançar resultados, criar circuito com etapas, marcar torneio como modelo, ter telão (TV mode), placar courtside, exportar CSV, exportar para DUPR (flag) | Torneios finalizados alimentam o ranking ELO nacional |
| **Admin de clube** | Criar clube, aprovar membros, criar game-day (Mexicano + Rei da Quadra), criar eventos, ranking interno (individual e duplas, materializado server-side), publicar resultados no ranking nacional (toggle) | Ranking interno individual + duplas, eventos com RSVP |
| **Professor (Coach)** | Perfil público, agenda (janelas semanais), aulas avulsas/recorrentes, pacotes (com credits), biblioteca, loja, clínicas/workshops, validação de nível dos alunos, residência em arena, parcerias com arenas (mútuo) | Alunos, aulas, pacotes vendidos, clínicas, validações |
| **Arena** | Cadastro, calendário mensal de reservas, multi-quadra, lista de espera, manutenção, campanhas, pacotes de mensalidade, CRM de membros, PDV, precificação dinâmica, no-show tracking, ladder, ligas, match aberto, aulas (Sistema C, diferente do professor), turmas | Reservas, receita, no-shows, manutenções |
| **Platform admin** | Console (`/admin/console`) com todas flags, métricas, backfill de materializados, gestão de perfis, parceiros, restaurar atletas | Ativa/desativa features, recalcula rankings, gerencia usuários |

### 1.4 Sistemas de pontuação que JÁ EXISTEM (e ninguém vê)

| Sistema | Onde | Como é gerado | Onde é exibido |
|---|---|---|---|
| **XP (Progressão)** | `progression/domain/progression.js` | `played*10 + wins*20 + podiums*40 + titles*120 + tournaments*30` | Card "Nível X · 3020 XP" no `/meu-desempenho` |
| **Streak de semanas** | `computeWeekStreak` | Semanas ISO com pelo menos 1 jogo, contagem consecutiva | "🔥 2 semana(s) seguidas" no card de Progressão |
| **Nível** | `levelFromXp` | Cada nível L custa `500*L` de XP incremental | "Nível 4" |
| **Rating ELO** | `modules/rating` | Recalculado em todo `onDocumentWritten` de torneio público finalizado | Ranking nacional + perfil |
| **Nível 2.0–8.0 (DUPR-like)** | `duprReconcile.js`, `duprScale.js` | Re-escala o rating ELO em escala 2.0–8.0 (estilo DUPR) | Selo "Nível 3.5" no perfil, aba no ranking |
| **20 conquistas** | `achievements/domain/achievements.js` | Predicados sobre `tournaments/played/wins/podiums/titles/rating/weekStreak` | Card "Conquistas X/20" |
| **4 metas pessoais** | `progression/domain/progression.js` | User define `target` por métrica (`games`/`wins`/`tournaments`/`rating`) | Card "Metas" |
| **Matchmaking smart score** | `smartMatchmaking.js` | 0–100 (rating 40 + courtSide 25 + city 20 + interests 15) | "Encontrar jogadores" |
| **H2H (head-to-head)** | `headToHeadService.js` | Histórico contra cada adversário | "Vs Fulano: 3–1" |
| **Nível validado por professor** | `coach_level_validations` | Professor atesta nível do aluno | Selo "Nível 3.5 validado por Beltrano" no perfil público |

**Já existe, no papel, todo o esqueleto de uma gamificação saudável.** O que
falta é: **unificar tudo em uma narrativa**, **revelar nos momentos certos**,
e **adicionar o que ainda não tem** (missões, temporadas, recompensas por
invite, escola de progresso, mentoria, rivalidades).

---

## 2. Anatomia do sistema de XP, níveis e progressão

Lendo `src/modules/progression/domain/progression.js` linha por linha:

### 2.1 Pesos de XP atuais (`XP_WEIGHTS`)

```js
export const XP_WEIGHTS = Object.freeze({
  played: 10,        // cada jogo vale 10 XP
  wins: 20,          // cada vitória vale +20 XP (não substitui, soma)
  podiums: 40,      // cada pódio vale +40 XP
  titles: 120,      // cada título vale +120 XP
  tournaments: 30,  // cada torneio disputado vale +30 XP
});
```

**XP total = `played*10 + wins*20 + podiums*40 + titles*120 + tournaments*30`**

Usando o usuário da screenshot (8 torneios, 22 inscrições, 142 jogos, 66V–76D,
0 títulos, 1 pódio):
- 142*10 = 1.420
- 66*20 = 1.320
- 1*40 = 40
- 0*120 = 0
- 8*30 = 240
- **Total: 3.020 XP** ✓ bate com a tela

### 2.2 Função de nível (`levelFromXp`)

```js
// Nível 1: precisa de 500 XP
// Nível 2: + 1.000 (total 1.500)
// Nível 3: + 1.500 (total 3.000)
// Nível 4: + 2.000 (total 5.000)
// Nível L: + 500*L
```

| Nível | XP necessário para chegar | XP incremental |
|---|---|---|
| 1 → 2 | 500 | 500 |
| 2 → 3 | 1.500 | 1.000 |
| 3 → 4 | 3.000 | 1.500 |
| 4 → 5 | 5.000 | 2.000 |
| 5 → 6 | 7.500 | 2.500 |
| 6 → 7 | 10.500 | 3.000 |
| 7 → 8 | 14.000 | 3.500 |
| 8 → 9 | 18.000 | 4.000 |
| 9 → 10 | 22.500 | 4.500 |
| 10 → 11 | 27.500 | 5.000 |
| 15 | 65.000 | 7.500 |

O usuário da screenshot (Nível 4, 3.020 XP) precisa de `500*4 = 2.000` XP para
o Nível 5, e está com 3.020 − 3.000 = **20 XP no nível atual**. Exatamente
como aparece no card: "20/2000 XP para o nível 5". ✓

### 2.3 Streak (`computeWeekStreak`)

A função agrupa datas em "semanas ISO" (epoch/7d), pega o set, ordena e conta
quantas semanas consecutivas a partir da mais recente.

- **Streak 0**: nenhum jogo.
- **Streak 1**: jogou só essa semana.
- **Streak 4**: jogou nas últimas 4 semanas seguidas (achievement "Constância").
- **Streak 12**: achievement "Rotina de atleta".

**Não tem freeze, não tem proteção, não tem graça explícita.** A chama
🔥 na UI só acende com `streak > 0` e some no `streak === 0`. Não há
narrativa. Não há perda. Não há salvaguarda. Não há nada para o usuário
fazer além de "continuar jogando".

### 2.4 Achievements (20, ordenados por facilidade)

```js
[
  { id: 'first_tournament',  name: 'Estreante',         desc: 'Participou do primeiro torneio.' },
  { id: 'first_win',          name: 'Primeira vitória',  desc: 'Venceu o primeiro jogo.' },
  { id: 'first_podium',       name: 'No pódio',          desc: 'Terminou entre os 3 primeiros.' },
  { id: 'champion',           name: 'Campeão',           desc: 'Conquistou um título.' },
  { id: 'wins_10',            name: 'Dez de lá',         desc: 'Acumulou 10 vitórias.' },
  { id: 'wins_50',            name: 'Cinquentão',        desc: 'Acumulou 50 vitórias.' },
  { id: 'wins_100',           name: 'Centena de vitórias' },
  { id: 'played_25',          name: 'Pegando ritmo',     desc: 'Disputou 25 jogos.' },
  { id: 'tournaments_10',     name: 'Maratonista',       desc: 'Disputou 10 torneios.' },
  { id: 'tournaments_25',     name: 'Veterano de quadra' },
  { id: 'played_100',         name: 'Centurião',         desc: 'Disputou 100 jogos.' },
  { id: 'played_250',         name: 'Incansável' },
  { id: 'podiums_10',         name: 'Frequentador do pódio' },
  { id: 'titles_5',           name: 'Colecionador de troféus' },
  { id: 'titles_10',          name: 'Lenda' },
  { id: 'rating_1100',        name: 'Em ascensão',       desc: 'Atingiu rating 1100.' },
  { id: 'rating_1300',        name: 'Elite',             desc: 'Atingiu rating 1300.' },
  { id: 'rating_1500',        name: 'Fora de série',     desc: 'Atingiu rating 1500.' },
  { id: 'week_streak_4',      name: 'Constância',        desc: 'Jogou em 4 semanas seguidas.' },
  { id: 'week_streak_12',     name: 'Rotina de atleta',  desc: 'Jogou em 12 semanas seguidas.' },
]
```

**Problemas:**
1. Todos os 20 achievements são **baseados em acúmulo** (jogue mais, ganhe
   mais, ganhe streak). **Zero achievements sociais** (primeiro comentário,
   primeiro follow, primeiro parceiro de jogo, primeiro clube entrado, etc).
2. **Zero achievements de descoberta** (visitou a primeira arena, leu as
   regras, viu o primeiro telão de torneio ao vivo).
3. **Zero achievements sazonais** (jogou torneio em julho, organizou um
   torneio no verão).
4. **Zero achievements de "primeiro a fazer"** (primeiro torneio público,
   primeiro a entrar num clube novo).
5. O **rating 1100 / 1300 / 1500** usam rating ELO cru. Pode ser
   desencorajador para um iniciante 2.0 que está em 800.
6. **Sem layers**: tudo num card só. Sem "categorias" (carreira / social /
   descoberta / sazonal).

### 2.5 O card "Meu desempenho" — UI atual

A página `V2Performance.jsx` (que a partir de Sprint 30 vira ABA dentro de
Perfil, mas por enquanto pode ser acessada em `/meu-desempenho`) renderiza:

```
┌──────────────────────────────────────────────────────┐
│  Meu desempenho                                     │
│  Estatísticas, histórico e evolução dos seus jogos. │
│  [Estatística] [Meus jogos]                         │
│                                                      │
│  ┌───┐ ┌───┐ ┌───┐ ┌────┐ ┌───┐ ┌───┐              │
│  │ 🏆│ │ ✓ │ │ ⚔ │ │  % │ │ 🏅│ │ 🥇│              │
│  │  8│ │ 22│ │142│ │ 46%│ │  0│ │  1│              │
│  └───┘ └───┘ └───┘ └────┘ └───┘ └───┘              │
│  66V – 76D                                           │
│                                                      │
│  ┌──────────────────────────────────────────────┐  │
│  │ Desempenho por formato                       │  │
│  │ Duplas · 142 jogo(s) · 66V – 76D · 46%      │  │
│  └──────────────────────────────────────────────┘  │
│                                                      │
│  ┌──────────────────────────────────────────────┐  │
│  │ ⚡ Nível 4                                   │  │
│  │ 3020 XP                          🔥 2 sem.   │  │
│  │ ████░░░░░░░░░░░░░░░░░░░░░░░░░░░             │  │
│  │ 20/2000 XP para o nível 5                    │  │
│  └──────────────────────────────────────────────┘  │
│                                                      │
│  [Achievements card — 5/20]                          │
│  [Goals card — 2 ativas, 1 concluída]                 │
│  [Rating sparkline]                                   │
│  [DUPR Evolution 2.0–8.0]                             │
│  [DUPR Rating Badge]                                  │
└──────────────────────────────────────────────────────┘
```

**Lindo, mas passivo.** Conta o que aconteceu. Não convida a próxima ação.

---

## 3. Como o sistema atual falha em gerar hábito

Fazendo uma auditoria honesta:

### 3.1 Problemas identificados

| # | Problema | Por que é grave |
|---|---|---|
| **F1** | **XP é só "jogar torneios"**. Quem joga game-day social com amigos não ganha XP. Quem reserva arena e joga de boa também não. 90% da vida real de um jogador de pickleball acontece fora de torneio. | Iniciação "Eu fiz X, nada aconteceu" |
| **F2** | **Streak é frágil sem proteção**. Perdeu 1 semana por motivo legítimo (viagem, lesão, gripe) → streak vai a zero, e o "2 semanas seguidas" virou pó. Sem freeze day, sem "vacation mode". | Punição desproporcional → desinstalar |
| **F3** | **Nível "Nível 4" sem nome**. Os níveis de nivelamento (Iniciante Absoluto, Iniciante, Iniciante Plus, Intermediário, …) já têm nomes lindos (Intermediário, Intermediário Plus, Avançado, PRO, Open/Elite). Mas o "Nível 4" do XP é genérico. | Confunde com o "nível USAP" e gera dúvida |
| **F4** | **Conquistas não celebram marcos de início**. "Estreante" é a primeira. Mas não há "Bem-vindo", "Primeira reserva", "Primeiro chat", "Primeiro amigo", "Primeira inscrição em torneio", "Primeira vitória por WO", "Primeiro jogo contra alguém do seu estado", etc. | A primeira impressão é "ok, mas cadê as outras coisinhas?" |
| **F5** | **Sem missões**. O usuário não tem nada dizendo "Complete esta semana: 3 jogos, 1 aula experimental, 1 torneio — ganhe 200 XP bônus". | Sem direção, sem curto prazo |
| **F6** | **Sem recompensa por convite**. O `invite_code` em `tournaments` e `clubs` existe, mas é só um código para entrar — não há "ganhe XP por cada amigo que entrou pelo seu código". | Subutiliza o motor viral que está pronto |
| **F7** | **Sem feedback emocional**. "Você está há 7 dias sem jogar. Bora?" | Sem notificação emocional, a plataforma vira só "banco de dados" |
| **F8** | **Achievements card não tem "próximo objetivo"**. Mostra "5/20" mas não diz "Faltam 25 jogos para o Centurião" | Não comunica o "quase lá" |
| **F9** | **Não há "review da semana"**. Strava manda segunda-feira "Sua semana: 4 atividades, +12 km. Comparado com 6 média". PickleRush não manda nada. | Perde o momento de celebração |
| **F10** | **Sem "primeiro compare"**. "Fulano te ultrapassou em 12 pontos" / "Você ganhou 8 posições" — feedback de progressão invisível | Falta de dopamina comparativa |
| **F11** | **Sem "volta da vitória"**. Quem ganha não ganha nada além do placar e do XP. Sem badge efêmero "🔥 Hot streak: 3 torneios consecutivos no pódio", sem card de "tweetable" para o Instagram. | Momento de glória passa batido |
| **F12** | **Não há níveis de engajamento por arena, clube, professor, arena**. Eu posso ser "Patrono Nível 3 da Arena X" ou "Aluno Diamante do Professor Y" — nada disso existe. | Sem pertencimento vertical |
| **F13** | **Sem cardápio de "faltam X coisas"**. Quando abro o Duolingo, vejo claramente "Complete 3 lições hoje para manter a sequência". PickleRush não mostra isso no card de XP. | Sem "reminder comportamental" |
| **F14** | **Sem sistema de "missões de descoberta"**. "Visite a página de 3 atletas esta semana", "Siga seu primeiro jogador", "Veja o primeiro torneio ao vivo" — features existem, mas ninguém descobre. | Subutilização por desconhecimento |
| **F15** | **A `progression` flag está LIGADA hard-coded** em V2Performance (`const progressionOn = true`), mas em outros lugares usa `useFeatureFlag`. Inconsistência. | Tech debt, não impacta usuário final |

### 3.2 O que já é bom (preservar)

- Sistema de XP é determinístico, puro, testável — manter.
- Streak de semanas (semanas ISO) é correto — manter.
- Conquistas por acúmulo cumprem seu papel — manter.
- DUPR 2.0–8.0 dá uma "escala humana" ao ELO — manter.
- Nível validado por professor é um sinal social forte — manter.
- Smart matchmaking dá uma "personalidade" à busca de parceiros — manter.

---

## 4. Padrões de mercado que importam pra PickleRush

Não vou reinventar. O que funciona em esporte amador (validado em apps de
centenas de milhões de usuários):

### 4.1 Strava (cicismo/corrida — 100M+ usuários)

- **Kudos**: "👏" dado por outros usuários em atividades. Equivalente ao
  "like" mas virou moeda social. **PickleRush já tem "follow"**, mas não há
  "👏" em jogo/torneio. **Ideia**: "Apoiar" um jogo finalizado (1 por jogo
  por usuário, com 5 XP para quem apoiou e 1 XP para quem recebeu).
- **Segments / KOMs**: trechos cronometrados onde você compete contra
  fantasmas globais. **PickleRush análogo**: "Rei da Quadra" semanal
  (melhor % de vitória em 7 dias) com selo trocável.
- **Local legends**: o top 3 de cada "segmento" vira "Lenda Local". **Aqui**:
  "Lenda da Arena X", "Rei do Clube Y", "Professor Favorito da Temporada".
- **Streak de semana / mês** com proteção (1 dia de graça por semana).
  **Aplicar já no streak do PickleRush**.
- **Weekly summary (Monday morning)**: "Você correu 35 km essa semana, 12%
  acima da média. 4 atividades. 🏆". **PickleRush análogo** é urgente:
  segunda-feira 7h é a hora certa para engajar quem ficou parado.
- **Goals explícitas com "completion celebration"**: "Meta atingida! 🎉
  +1 mês grátis" — celebradas visualmente, com share card. **PickleRush tem
  `goalProgress` mas não tem a celebração**.

### 4.2 DUPR (pickleball — referência direta do esporte)

- Rating único global (2.0 a 8.0) por jogador.
- Rating separado de **Singles**, **Doubles** e **Doubles Partnered With X**.
- "Self-rating" no cadastro.
- **Importação de jogos** automática (eles jogam torneios CBP).
- **Perfil verificado** com foto do app (substitui "claim by email").
- "**Reliability score**" — taxa de comparecimento (no-show penaliza).
- **"Doubles partners"** destacada — quem joga junto com você mais vezes.
- **Ladder semanal** — você sobe/desce por "match wins" da semana.

**Lições pro PickleRush**:
- Reliability/comparecimento é BIG. Não tem nada parecido no PickleRush.
- "Parceiro de duplas mais frequente" é um sinal social riquíssimo.
- Ladder semanal (top-N da semana) é um complemento perfeito ao rating cumulativo.

### 4.3 Nike Run Club (corrida — 30M+ usuários)

- **Coachs runs guiados** (áudio) com meta semanal.
- **Streak de troféus** colecionáveis.
- **"Just do it"** reminders personalizados por horário.
- **Medals (corridas/eventos)** com edição limitada.
- **Compartilhamento visual do troféu** com foto e pace.

**Lições**:
- "Medal de evento" é forte. PickleRush pode dar "Medalha de Participante —
  Open de Curitiba 2026" ao usuário.
- "Compartilhar troféu" com 1 tap → 80% dos shares de Strava são privados.
  Mas a minoria que compartilha puxa MUITA gente nova.

### 4.4 Pokémon Go (AR game — 100M+ installs)

- **Pokéstops** = locais do mundo real que dão recompensas. **PickleRush
  análogo**: arenas parceiras viram "checkpoints" — checar 3 arenas novas
  em 30 dias = conquista.
- **Raids** = cooperação de várias pessoas. **PickleRush análogo**: "Raid
  Party" — para fechar um torneio faltam 4 duplas, e o sistema convida
  quem tem perfil similar.
- **Streak de "daily login"** com recompensa crescente (7 dias, 14 dias,
  30 dias). **PickleRush pode ter streak diário de "qualquer ação na
  plataforma"**.

### 4.5 Whoop / Garmin (wearables)

- **Strain / Recovery score** (verde/amarelo/vermelho). **PickleRush
  análogo**: "Readiness to play" baseado em dias desde o último jogo +
  frequência recente. Verde: pode forçar. Amarelo: jogue leve. Vermelho:
  descanse (prevenção de lesão).

### 4.6 Airbnb (marketplace, não esporte, mas o melhor exemplo de review loop)

- **Reviews mútuas** após cada "experiência" (jogo/aula). **PickleRush
  pode ter review de arena + review de professor + review de dupla
  parceira**.
- **"Superhost" / "Super Professor"** — selo baseado em reviews.
- **Resposta pública do anfitrião** à review — feedback loop.

### 4.7 TikTok / Duolingo (engajamento diário extremo)

- **Loop de 30 segundos** que faz voltar. **PickleRush pode ter o
  "cardápio de hoje"**: 3 coisas rápidas para fazer (3 min) com
  recompensa clara.
- **Loss aversion** ("🔥 Não perca sua sequência de 14 dias!"). Aplicar
  com cuidado para não ser irritante, mas com elegância.
- **Personalização por IA** do que mostrar — não é o que interessa à
  plataforma, é o que interessa ao user.

### 4.8 ClassPass / Mindbody (wellness marketplace)

- **First class free** — primeira aula com professor é grátis, com
  lembrete proativo. **PickleRush pode fazer: "Você nunca teve aula com
  um professor — quer ganhar 100 XP fazendo uma aula experimental?".
- **Pack de créditos** que expiram → "Use seus créditos antes de
  expirar". PickleRush já tem pacotes com validade. **Basta notificar
  proativamente**.
- **Curadoria por objetivo** ("Quero melhorar meu 3rd shot drop") que
  recomenda aulas. PickleRush pode recomendar clínicas e aulas.

### 4.9 XP/Leveling (muitos jogos — Diablo, Runescape, Genshin)

- **Prestige system**: ao chegar no nível máximo, você pode "resetar" e
  ganhar um selo permanente. Aplicar quando alguém chega em Nível 10
  no PickleRush: "Veterano da Plataforma", "Patriarca do PickleRush".
- **Skill trees**: em vez de uma única "XP total", cada ramo pode ter XP
  separado (Torneiro, Social, Arena, Professor). Mostra o perfil
  multifacetado do usuário.
- **Reputation de comunidade** (Reddit karma, Stack Overflow rep) — sinais
  de confiança (subir conteúdo, ajudar novato, organizar eventos).

---

## 5. Princípios do plano de gamificação

Tudo abaixo se sustenta em 7 princípios. Antes de implementar qualquer
mecânica, validar contra eles.

### P1. **Nada substitui o produto real**
Gamificação é tempero. O pickleball é o prato. Nenhuma mecânica pode
fazer alguém gostar de pickleball se não gosta. Mas pode tirar a
"chatice burocrática" do meio do caminho.

### P2. **Recompensas instantâneas, atrasadas, raras**
- **Instantâneas** (< 5s): animação ao desbloquear algo, +XP flutuando
  na tela, "👏 de Fulano", badge efêmero.
- **Atrasadas** (1 dia a 1 semana): missões semanais, recap de fim de
  semana, "sua semana em review".
- **Raras** (1 mês a 1 temporada): troféu de temporada, badge de 100
  jogos, "veterano da plataforma".

### P3. **Acessível para o iniciante 1.0, profundo para o PRO 5.0**
Um iniciante 1.0 (que mal segura a raquete) precisa ver "Bem-vindo,
você ganhou sua primeira conquista" em 30 segundos. O PRO 5.0 precisa
ter "Lenda" como horizonte aspiracional. **Não dar tudo para um lado só.**

### P4. **Variedade, não punição**
Perder streak por motivo legítimo NÃO deve doer tanto quanto deveria.
Ação ruim ("Ele não compareceu") deve ter consequência leve e
recuperável ("seu comparecimento caiu para 92%, mas com 3 jogos seguidos
você volta para 95%").

### P5. **O usuário é o ator, não o espectador**
Toda gamificação deve pedir uma AÇÃO observável. Badges por
"estar cadastrado" não geram hábito. Badges por "primeiro torneio
ao qual você se inscreveu e jogou" geram.

### P6. **Compartilhável por padrão, privado por escolha**
Cada marco deve ter um card pronto pra postar (Strava-style). Mas
o default de privacidade deve ser "só eu" + opt-in para compartilhar.

### P7. **Feature flags SEMPRE**
Tudo novo atrás de flag. Default OFF. Migração via `migrateLegacyFlags`.
Bump `FLAGS_MIGRATION_VERSION`. Teste de aceitação. Ativação gradual
(1% → 10% → 50% → 100%).

---

## 6. Pilares de gamificação propostos

A gamificação do PickleRush deve girar em torno de **6 pilares**. Cada
pilar tem um "porquê emocional" e um conjunto de mecânicas.

### Pilar 1 — **Progressão Pessoal** ("eu estou evoluindo")

> O usuário sente que está melhorando como jogador E como membro da
> comunidade.

**Mecânicas**:
- **Sistema de XP expandido** (multi-fonte, não só torneio).
- **Níveis com nome** (Calouro, Aprendiz, Jogador, Veterano, Lenda, etc).
- **Skill trees** (Torneiro, Social, Arena, Professor, Clube).
- **Metas pessoais** (já existe, mas com celebração e desafio).
- **Streak com proteção** (1 dia de graça por mês, modo "descanso").
- **PRs (personal records)** detectados automaticamente:
  - Maior sequência de vitórias.
  - Melhor % de aproveitamento em 10 jogos.
  - Subiu de nível (USAP 2.5 → 3.0).
  - Bateu rating pessoal (rating 1023 → 1045).

### Pilar 2 — **Conquistas & Troféus** ("eu conquistei algo raro")

> Coleção de marcos com raridade visível.

**Mecânicas**:
- **Conquistas com 5 raridades**: Comum (cinza), Incomum (verde-azulado),
  Rara (azul), Épica (roxa), Lendária (dourada) — estilo jogos de RPG.
- **Conquistas por categoria** (separadas em 5 famílias: Carreira, Social,
  Descoberta, Sazonal, Comunidade).
- **Troféus de temporada** (3 meses): ed. limitada, expira.
- **Cards colecionáveis**: ilustrados, com lore ("A primeira vitória do
  Centro-Oeste"), compartilháveis.
- **Pin/frame de perfil** baseado em troféu raro (customização).

### Pilar 3 — **Missões & Desafios** ("o que eu faço hoje?")

> Curto prazo, com retorno claro.

**Mecânicas**:
- **Missão diária** (3 ações, ~5 min, +50–150 XP).
- **Missão semanal** (5 ações, ~30 min, +300–600 XP + item raro).
- **Missão mensal** (10 ações, +1.500 XP + troféu).
- **Missão de temporada** (longa, multi-semana, troféu lendário).
- **Desafios comunitários** ("O clube com mais jogos esse mês ganha uma
  clínica grátis de um PRO"). Combinam com missões pessoais.

### Pilar 4 — **Social & Competição** ("eu sou parte de algo")

> Vínculo com pessoas, não só com números.

**Mecânicas**:
- **Rivals** (até 5 rivais, comparáveis por rating). "vs Beltrano: 2–1
  essa temporada".
- **Crews** (grupos de até 8 atletas, "meu grupo de duplas").
- **Mentor/Apprentice** (nível 4.0+ pode mentorar até 2 iniciantes; XP
  para ambos quando o aluno atinge metas).
- **Top 8 semanal** da arena/clube/professor.
- **Kudos / 👏** em jogos, conquistas, fotos.
- **"Carta ao companheiro"**: ao final de cada torneio de duplas, cada
  dupla escreve uma frase pro parceiro (ou anônima).
- **Match reviews** (avaliação mútua de 5 estrelas + 1 linha).

### Pilar 5 — **Descoberta & Engajamento** ("a plataforma tem mais")

> Trazer gente para o âmago da plataforma.

**Mecânicas**:
- **"Sua semana em review"** (segunda 7h, push): número de jogos, número
  de novos conhecidos, rating delta, posição delta.
- **"Primeiros passos"** tour gamificado no primeiro login.
- **"Bingo da plataforma"** (a cada estação, um bingo 5×5 com
  funcionalidades).
- **"Mapa do tesouro"**: 10 arenas parceiras = 1 troféu.
- **"Tour do ranking"**: assista 5 jogos no modo espectador ao vivo.

### Pilar 6 — **Recompensas Reais & Tangíveis** ("vale a pena mesmo")

> Recompensas digitais, mas com significado real.

**Mecânicas**:
- **Descontos em arenas parceiras** ao atingir Nível X.
- **Aula experimental grátis** com professor parceiro.
- **Prioridade em listas de espera** de torneios populares.
- **Badge de "Top Patrocinador"** ao indicar N amigos.
- **"Hall da Fama da Temporada"** — top 3 de cada estado visível em
  página pública.
- **Camiseta virtual** para o avatar (visual, não física, mas colecionável).

---

## 7. Mapa de gatilhos por feature da plataforma

Como o sistema **gatilha XP, conquistas, missões, etc.** em cada feature.

### 7.1 Torneios (criar, organizar, participar, competir, finalizar)

| Ação do usuário | XP | Conquistas | Missão |
|---|---|---|---|
| Inscrever-se em torneio público | +30 (já existe) | "Inscrito", "Maratonista", "Veterano" | ✅ Missão semanal: 1 torneio |
| Comparecer (jogar pelo menos 1 jogo) | +50 | "Não faltou" (+5 cumulativo) | "Compareça 100% do mês" |
| Vencê-lo (campeão) | +120 (já existe) | "Campeão" (já existe) | "Ganhe 1 torneio no mês" |
| Subir ao pódio | +40 (já existe) | "Frequentador do pódio" | — |
| Criar torneio público (organizador) | +200 | "Organizador", "Mentor de comunidade" | "Organize 1 torneio" |
| Criar torneio com 16+ atletas | +500 | "Promotor" | — |
| Criar torneio 100% feminino / 50+ / iniciante | +300 | "Inclusivo" | — |
| Finalizar torneio com sucesso (admin) | +150 | — | — |
| Telão do torneio (TV mode): organizar | +50 | — | — |
| Adicionar fotos ao torneio | +20 (até 100) | "Documentarista" | — |
| **Lançar resultados de torneio dentro de 24h** (admin) | +100 (bônus velocidade) | "Pontual" | "Lance resultados no prazo" |
| Tornar torneio anual recorrente (3+ edições) | +1.000 (one-shot) | "Tradição" | — |

### 7.2 Jogos sociais (game-day, procura-jogo, dia de jogo aberto)

| Ação | XP | Conquistas | Missão |
|---|---|---|---|
| Criar um "dia de jogo" (game-day) | +80 | "Anfitrião" | "Crie 1 dia de jogo no mês" |
| **Participar de game-day** (jogar pelo menos 1 jogo) | +20 | "Social" | "Participe de 2 dias de jogo" |
| **Lançar resultado de jogo avulso** (qualquer formato) | +15 | — | "Lance 3 resultados no mês" |
| Vencer jogo avulso | +25 | — | — |
| **Publicar "procuro jogo"** (open game) | +30 | "Comunicador" | — |
| **Aceitar "procuro jogo"** de alguém | +15 | "Parceiro de ocasião" | — |
| **Convidar amigo para jogo** via plataforma | +10 | — | — |
| **Fechar um dia de jogo com placar** (organizador) | +50 | "Arbitro social" | — |
| Jogar Mexicano ou Rei da Quadra (formatos especiais) | +5 bônus por jogo | "Mexicano Lover", "Rei da Quadra" | — |

### 7.3 Clubes (criar, entrar, participar, organizar)

| Ação | XP | Conquistas | Missão |
|---|---|---|---|
| **Criar clube** | +200 | "Fundador" | — |
| **Entrar em clube** (1º clube) | +50 | "Associado" | "Entre em 1 clube" |
| **Convidar alguém para o clube** (aceito) | +30 | "Recrutador" | "Convide 3 pessoas" |
| **Convidar alguém que vira admin** (após 90 dias) | +200 | "Embaixador" | — |
| **Postar no mural** (1º post) | +20 | "Voz do clube" | — |
| **Criar evento no clube** (1º evento) | +100 | "Animador" | "Organize 1 evento" |
| **Criar evento recorrente** (semanal, 4 semanas) | +300 | "Tradição do clube" | — |
| **Lançar resultado no ranking nacional** (toggle) | +50 | "Aberto à comunidade" | — |
| **RSVP em evento do clube** | +5 | — | "Confirme presença em 3 eventos" |
| **Comentar em fórum** (1º comentário) | +10 | "Participativo" | — |
| **Criar enquete no fórum** | +30 | — | — |
| **Ser admin de clube há 6 meses** | +500 (one-shot) | "Pilar" | — |
| **Levar clube a 50 membros** | +1.000 (one-shot) | "Mega clube" | — |
| **Levar clube a 100 membros** | +2.500 (one-shot) | "Comunidade" | — |

### 7.4 Arenas (reservar, avaliar, divulgar)

| Ação | XP | Conquistas | Missão |
|---|---|---|---|
| **Reservar quadra pela 1ª vez** | +50 | "Frequentador" | "Reserve 1ª vez" |
| **Reservar 10 quadras no mês** | +200 | "Residente" | "Jogue 10x na arena" |
| **Avaliar arena (1ª review)** | +30 | "Crítico" | "Avalie 2 arenas" |
| **Avaliar 10+ arenas diferentes** | +300 | "Explorador de quadras" | — |
| **Comparecer a TODAS as reservas do mês** | +150 (bônus) | "Pontual nas quadras" | — |
| **Cancelar reserva com < 24h** (punição leve) | −10 | — | — |
| **No-show em reserva** (punição leve) | −30 | "Fantasma" (rara, evitável) | — |
| **Visitar arena nova (1ª vez lá)** | +50 | "Explorador urbano" | "Visite 2 arenas" |
| **Indicar arena que ainda não estava no app** | +200 (admin aceita) | "Scout" | — |
| **Arena parceira premium** (1 ano) | +1.000 ao criar | — | — |

### 7.5 Professores (aulas, pacotes, clínicas, mentoria)

| Ação do aluno | XP | Conquistas | Missão |
|---|---|---|---|
| **Primeira aula experimental** | +80 | "Aluno aplicado" | "Tenha 1 aula" |
| **Comprar pacote de aulas (5+)** | +100 | "Comprometido" | — |
| **Concluir pacote de 10 aulas** | +250 (one-shot) | "Disciplina" | — |
| **Ser avaliado com 5⭐ pelo professor** | +50 | "Excelência" | — |
| **Receber validação de nível do professor** | +200 | "Validado por PRO" | — |
| **Participar de clínica/workshop** | +60 | "Workshop lover" | "Vá a 1 clínica" |
| **Convidar amigo para clínica** (aceito) | +40 | — | — |

| Ação do professor | XP | Conquistas | Missão |
|---|---|---|---|
| **Marcar 1ª aula** | +200 | "Professor ativo" | — |
| **Dar 10 aulas no mês** | +500 | "Veterano do ensino" | — |
| **Validar nível de aluno** | +30 | "Avaliador" | — |
| **Criar clínica/workshop** | +100 | "Educador" | "Crie 1 clínica" |
| **Atingir 4.9⭐ com 20+ reviews** | +1.000 | "5 estrelas" | — |
| **Atingir 100 alunos no roster** | +1.500 | "Influência" | — |
| **Publicar conteúdo na biblioteca** | +50 | "Curador" | — |
| **Criar pacote sazonal** (Black Friday) | +200 | "Empreendedor" | — |

### 7.6 Social (perfis, follows, chat, mural, comunidade)

| Ação | XP | Conquistas | Missão |
|---|---|---|---|
| **Completar perfil (100%)** | +100 | "Identidade completa" | "Complete perfil" |
| **Foto de perfil** (1ª) | +30 | "Cara conhecida" | — |
| **Foto de capa** (1ª) | +30 | "Estilo" | — |
| **Bio preenchida (50+ chars)** | +20 | "Autoral" | — |
| **Lado da quadra definido** | +20 | "Sabem meu lado" | — |
| **Seguir 1º atleta** | +10 | "Sociável" | "Siga 3 atletas" |
| **Ser seguido por 10 atletas** | +100 | "Puxador" | — |
| **Enviar 1º chat** | +20 | "Conversador" | — |
| **Receber 1º "👏" (kudos)** | +10 | "Reconhecido" | — |
| **Dar 50 kudos no mês** | +100 | "Apoiador" | "Dê 10 kudos" |
| **Postar foto com tag `#picklerush`** | +20 (até 200/mês) | "Embaixador visual" | — |
| **Indicar plataforma (link de referral)** | +10 (quem indica) + +50 (quem entra) | "Embaixador" | "Convide 3 amigos" |
| **Ajudar novato (resposta em chat marcada como "solução")** | +50 | "Mentor da comunidade" | — |
| **Comentar em post de fórum** (1º) | +20 | "Voz" | — |
| **Postar em novidade** | +30 | "Influencer" | — |

### 7.7 Onboarding (1ª vez)

| Ação | XP | Conquistas |
|---|---|---|
| Criar conta (login) | +50 | "Bem-vindo" |
| Aceitar política de uso | +20 | "Cidadão" |
| Completar 1º quiz de nivelamento | +50 | "Auto-conhecimento" |
| Definir cidade + estado | +20 | "Localizado" |
| Foto de perfil | +30 | "Cara" |
| Bio de 50+ chars | +20 | "Voz" |
| Ver o 1º torneio ao vivo (público) | +30 | "Espectador" |
| Entrar no 1º clube OU seguir 3 atletas | +50 | "Conectado" |
| **Total possível no 1º dia**: ~350 XP | | |

### 7.8 Re-engajamento (voltar depois de parado)

| Situação | Mecânica |
|---|---|
| 7 dias sem ação | Push: "Fulano te mandou kudos! Volte para agradecer." (sutil) |
| 14 dias sem ação | Email + push: "Seu rating 1.023 está congelado. Bora 1 jogo?" |
| 30 dias sem ação | "Sentimos sua falta. 30 XP de boas-vindas se voltar hoje" |
| 60 dias sem ação | Email: "Sua semana em review" retroativo + cupom arena |
| 90 dias sem ação | "Volta por 1 dia: ganhe troféu 'Loyalty Veteran'" |

### 7.9 Compartilhamento / Viralidade

| Ação | XP |
|---|---|
| Compartilhar torneio no WhatsApp/Instagram | +10 |
| Compartilhar resultado pessoal | +15 |
| Quem entra pelo SEU código de convite | +50 (one-shot por amigo) |
| Quem entra pelo seu código E joga 5+ jogos | +200 (bônus retenção) |
| Quem entra pelo seu código E organiza 1 torneio | +500 (bônus criador) |
| Quem você convidou e se tornou PRO validado | +1.000 (bônusダイヤモンド) |

---

## 8. Sistema de XP/Níveis expandido

### 8.1 O que muda

| Hoje | Proposta |
|---|---|
| `XP_WEIGHTS = { played: 10, wins: 20, podiums: 40, titles: 120, tournaments: 30 }` | **Multi-fonte** com pesos por categoria |
| `levelFromXp` incremental `500*L` | **Curva calibrada** com platôs entre tiers |
| Nome "Nível 4" genérico | **Tiers com nome**: Calouro, Aprendiz, Jogador, Veterano, Expert, Elite, Lenda, Imortal |
| XP em uma única "XP total" | **Skill trees** (Torneiro / Social / Arena / Professor / Clube) — XP por trilha |

### 8.2 Nova função `computeXpV2`

```js
// Pseudocódigo (manter em src/modules/progression/domain/progression.js)
export const XP_WEIGHTS_V2 = Object.freeze({
  // Carreira (torneios e jogos)
  tournament_attended: 30,
  tournament_podium: 40,
  tournament_title: 120,
  game_played: 10,
  game_won: 20,
  game_day_attended: 20,
  game_day_organized: 80,
  game_day_published_to_ranking: 50,

  // Social (clubes, follows, chat, mural)
  club_joined: 50,
  club_created: 200,
  club_event_created: 100,
  club_event_rsvp: 5,
  club_post: 20,
  follow_first: 10,
  kudos_received: 10,
  kudos_given: 1,
  chat_message: 1, // cap diário 10
  profile_completed: 100,
  referral_invited: 50,
  referral_activated: 200,

  // Arena
  booking_first: 50,
  booking_attended: 30,
  booking_cancelled_late: -10,
  booking_no_show: -30,
  arena_reviewed: 30,
  arena_visited_first: 50,
  arena_referred: 200,

  // Professor
  lesson_first: 80,
  lesson_attended: 40,
  package_purchased: 100,
  clinic_attended: 60,
  level_validated_by_coach: 200,

  // Descoberta
  first_tournament_watched: 30,
  first_share: 10,
  first_photo_posted: 20,
  help_newcomer_marked_solution: 50,

  // Professor (lado supply)
  teacher_first_lesson: 200,
  teacher_10_lessons_month: 500,
  teacher_validated_student: 30,
  teacher_clinic_created: 100,

  // Organizador
  tournament_created: 200,
  tournament_16plus: 500,
  tournament_recurring: 1000,

  // Bônus diários (cap)
  daily_first_action: 20,
  weekly_all_actions: 100,
});

export const XP_CAPS = Object.freeze({
  daily: 500,      // máximo XP por dia de ações "normais"
  weekly: 2500,    // máximo XP por semana
  burst: 200,      // máximo por evento único (anti farming)
});
```

### 8.3 Níveis com nome (Tiers)

```js
export const TIERS = Object.freeze([
  { tier: 1, level: 1,   name: 'Calouro',   threshold: 0,     color: 'gray',   icon: '🌱' },
  { tier: 1, level: 4,   name: 'Aprendiz',  threshold: 2000,  color: 'green',  icon: '🌿' },
  { tier: 2, level: 7,   name: 'Jogador',   threshold: 6000,  color: 'teal',   icon: '🏓' },
  { tier: 2, level: 10,  name: 'Regular',   threshold: 12000, color: 'cyan',   icon: '🏸' },
  { tier: 3, level: 14,  name: 'Veterano',  threshold: 22000, color: 'blue',   icon: '🎖️' },
  { tier: 3, level: 18,  name: 'Expert',    threshold: 35000, color: 'indigo', icon: '⭐' },
  { tier: 4, level: 22,  name: 'Elite',     threshold: 50000, color: 'purple', icon: '💎' },
  { tier: 4, level: 26,  name: 'Lenda',     threshold: 70000, color: 'pink',   icon: '👑' },
  { tier: 5, level: 30,  name: 'Imortal',   threshold: 100000, color: 'amber',  icon: '🔥' },
]);
```

O usuário 1.0 (Iniciante Absoluto) é "Calouro". O 3.5 pode chegar em
"Jogador". O 5.0+ pode aspirar a "Imortal".

### 8.4 Skill trees (5 trilhas paralelas)

Em vez de uma XP só, o usuário tem **5 trilhas independentes**, cada uma
com seu próprio nível. Visualizar como 5 barras de progresso.

```
┌─────────────────────────────────────────────┐
│  Sua progressão                             │
│                                              │
│  🎾 Torneiro    ████████░░  Nível 6         │
│  🤝 Social      ████░░░░░░  Nível 3         │
│  🏟️ Arena       ██░░░░░░░░  Nível 2         │
│  🎓 Professor   ░░░░░░░░░░  Nível 0         │
│  👥 Clube       ██████░░░░  Nível 4         │
└─────────────────────────────────────────────┘
```

**Por que isso é bom**:
- O usuário que não joga torneio mas é super ativo em clube não se sente
  "preso no Calouro".
- Dá profundidade de perfil para matchmaking.
- Permite destacar "Lenda Social" sem ser necessariamente bom tecnicamente.

### 8.5 Streak com proteção

```js
export const STREAK_RULES = Object.freeze({
  weekly_target: 1, // pelo menos 1 jogo na semana conta
  grace_days_per_month: 1, // 1 dia de "férias" por mês
  max_streak_visualized: 52, // até 52 semanas (1 ano)
  comeback_bonus: 200, // XP ao voltar depois de quebrar streak de 4+ semanas
});
```

UI: além da 🔥, mostrar 🛡️ quando o usuário usou o grace day do mês.

### 8.6 Sistema anti-farming

- **Cap diário**: 500 XP/dia de ações "fáceis" (follow, kudos, chat).
- **Detecção de anomalias**: gain de XP > 5.000 em 1h → review manual.
- **Bots/criação em massa**: clusters de XP no mesmo IP/deviceId → review.
- **Campeonato muito grande (16+ atletas)**: bonus XP só conta se ≥ 50%
  dos jogos foram efetivamente jogados (não WO).

---

## 9. Conquistas: taxonomia completa

A atual lista de 20 é linear. A proposta é **5 famílias, ~80 conquistas, com
raridade e pin visual**.

### 9.1 Famílias

| Família | Tag | Cor | Foco |
|---|---|---|---|
| 🏆 Carreira | `career` | dourada | torneios, rating, títulos, USAP |
| 🤝 Social | `social` | azul | follows, chat, kudos, comunidade |
| 🗺️ Descoberta | `discovery` | verde | arenas, professores, clínicas, novos |
| 🌸 Sazonal | `seasonal` | rosa | eventos da estação atual |
| 🏛️ Comunidade | `community` | roxa | clubes, ajudar, mentorear |

### 9.2 Raridade

| Raridade | % de usuários que terão | Visual |
|---|---|---|
| Comum | >50% | cinza, sem brilho |
| Incomum | 20-50% | verde-azulado, brilho discreto |
| Rara | 5-20% | azul, brilho médio |
| Épica | 1-5% | roxa, brilho alto + animação |
| Lendária | <1% | dourada, animada, com partículas |

### 9.3 Catálogo inicial (~80, expansível)

**Carreira (20):**
1. **Bem-vindo** (C) — criou conta
2. **Estreante** (C) — 1º torneio
3. **Primeira vitória** (C)
4. **No pódio** (C) — top 3
5. **Campeão** (I) — 1º título
6. **Dez de lá** (C) — 10 vitórias
7. **Maratonista** (I) — 10 torneios
8. **Pegando ritmo** (C) — 25 jogos
9. **Frequentador do pódio** (I) — 10 pódios
10. **Cinquentão** (I) — 50 vitórias
11. **Centurião** (R) — 100 jogos
12. **Colecionador** (I) — 5 títulos
13. **Veterano de quadra** (R) — 25 torneios
14. **Em ascensão** (I) — rating 1100
15. **Centena de vitórias** (R) — 100 vitórias
16. **Incansável** (R) — 250 jogos
17. **Elite** (R) — rating 1300
18. **Constância** (I) — 4 semanas seguidas
19. **Lenda** (E) — 10 títulos
20. **Fora de série** (E) — rating 1500
21. **Rotina de atleta** (E) — 12 semanas seguidas
22. **Imortal do rating** (L) — rating 1700+
23. **Tri-campeão** (R) — 3 títulos seguidos
24. **General** (L) — 25 títulos
25. **Dobrador de níveis** (I) — subiu de USAP 2.0 → 3.0
26. **Oitava maravilha** (E) — venceu alguém 200+ pontos acima
27. **Nocaute** (R) — vitória 11-0
28. **Revanche** (I) — perdeu antes, ganhou depois pro mesmo adversário

**Social (15):**
1. **Sociável** (C) — 1º follow
2. **Conversador** (C) — 1º chat
3. **Reconhecido** (C) — 1º kudos recebido
4. **Voz** (C) — 1º post
5. **Apoiador** (I) — 50 kudos dados
6. **Puxador** (I) — 10 seguidores
7. **Influenciador** (R) — 100 seguidores
8. **Embaixador visual** (I) — 10 fotos postadas
9. **Embaixador** (E) — 5 amigos convidados
10. **Carta ao companheiro** (I) — enviou carta após torneio
11. **Cidadão** (C) — aceitou política
12. **Rei do 👏** (R) — 500 kudos dados
13. **Match Review 5⭐** (I) — 10 reviews 5⭐ recebidas
14. **Influência** (E) — 1.000 seguidores
15. **Mascote da comunidade** (L) — aparece em 3+ posts de boas-vindas

**Descoberta (15):**
1. **Identidade completa** (C) — perfil 100%
2. **Cara conhecida** (C) — foto
3. **Localizado** (C) — cidade+estado
4. **Auto-conhecimento** (C) — 1º quiz de nivelamento
5. **Espectador** (C) — viu 1º torneio ao vivo
6. **Frequentador** (C) — 1ª reserva de arena
7. **Aluno aplicado** (C) — 1ª aula com professor
8. **Crítico** (C) — 1ª review de arena
9. **Explorador urbano** (I) — visitou 3 arenas diferentes
10. **Workshop lover** (I) — 5 clínicas participadas
11. **Comprometido** (I) — comprou pacote de 5+ aulas
12. **Disciplina** (R) — completou 10 aulas
13. **Explorador de quadras** (R) — avaliou 10+ arenas
14. **Mapa do tesouro** (E) — jogou em 10 arenas diferentes
15. **Globetrotter** (L) — jogou em 3 estados diferentes

**Sazonal (10) — trocam a cada estação:**
1. **Solstício de Verão** (S) — participou de torneio em dezembro
2. **Carnaval de Quadra** (S) — jogou game-day no Carnaval
3. **Páscoa Solidária** (S) — organizou torneio beneficente
4. **Festa Junina** (S) — jogou em junho
5. **Inverno Quente** (S) — 12 jogos em julho/agosto
6. **Volta às Aulas** (S) — fez 1ª aula com novo professor em fevereiro
7. **Black Friday do Esporte** (S) — comprou pacote de aulas em novembro
8. **Réveillon Esportivo** (S) — jogou na última semana do ano
9. **Aniversariante do Mês** (S) — jogou no mês do seu aniversário
10. **Troféu da Temporada** (S) — 3 estações consecutivas jogando

**Comunidade (15):**
1. **Associado** (C) — entrou em 1 clube
2. **Fundador** (R) — criou 1 clube
3. **Voz do clube** (C) — 1º post em clube
4. **Animador** (I) — criou 1 evento
5. **Recrutador** (I) — convidou 3 pessoas
6. **Pilar** (R) — admin há 6 meses
7. **Mega clube** (E) — clube chegou a 50 membros
8. **Comunidade** (L) — clube chegou a 100 membros
9. **Anfitrião** (I) — criou 1 dia de jogo
10. **Arbitro social** (I) — fechou game-day com placar
11. **Embaixador** (E) — alguém que convidou virou admin
12. **Tradição do clube** (E) — evento recorrente 4+ semanas
13. **Patrocinador** (R) — indicou arena parceira
14. **Mentor da comunidade** (E) — 10 respostas marcadas como "solução"
15. **Pilar da comunidade** (L) — admin de clube 100+ membros há 1 ano

**Troféus de plataforma (5, ONE-SHOT, LENDÁRIO):**
1. **Imortal do PickleRush** — 100.000 XP totais
2. **Pioneiro** — top 100 dos usuários que estavam na plataforma em 2026
3. **Conexão** — jogou com 100+ atletas diferentes
4. **Poliglota** — jogou em 5+ estados do Brasil
5. **Mentor de 100** — 100 alunos com nível validado por você (professores)

---

## 10. Missões e desafios

### 10.1 Missão Diária (3 ações, +50–150 XP)

**Algoritmo**: a cada dia (UTC-3 04h), gerar 3 missões baseadas no perfil:

```
┌────────────────────────────────────────┐
│  Missões de hoje (terça, 22 set)      │
│                                        │
│  ✓ Complete 1 jogo (qualquer formato) │
│    → +30 XP                            │
│                                        │
│  ☐ Visite o perfil de 1 atleta novo   │
│    → +20 XP                            │
│                                        │
│  ☐ Mande 1 mensagem no chat           │
│    → +15 XP                            │
│                                        │
│  Bônus "Triple Complete": +50 XP       │
│  Expira em 14h 23min                   │
└────────────────────────────────────────┘
```

**Missão do dia** pode incluir (com pesos):
- 1 missão de "core loop" (jogar)
- 1 missão de descoberta (feature nova)
- 1 missão social (interagir)

### 10.2 Missão Semanal (5 missões, +300–600 XP)

```
┌──────────────────────────────────────────────┐
│  Missões da semana (15–21 set)                │
│                                               │
│  ☐ Jogue 3 partidas (qualquer formato)        │
│  ☐ Inscreva-se em 1 torneio                   │
│  ☐ Publique 1 resultado pessoal               │
│  ☐ Participe de 1 dia de jogo                 │
│  ☐ Convide 1 amigo                            │
│                                               │
│  Bônus "Semanão Completo": +250 XP + 1 troféu │
│  (recolher até domingo 23:59)                 │
└──────────────────────────────────────────────┘
```

### 10.3 Missão Mensal (10 missões, +1.500 XP + 1 troféu)

```
┌──────────────────────────────────────────────┐
│  Missões de Setembro (você está em 3/10)     │
│                                               │
│  ✓ Entre em 1 clube                          │
│  ✓ Compre 1 aula com professor               │
│  ✓ Jogue em 1 arena nova                     │
│  ☐ Atinja 50% de aproveitamento em 10 jogos   │
│  ☐ Participe de 1 torneio público             │
│  ☐ Convide 3 amigos (1 já aceitou!)           │
│  ☐ Suba de nível USAP (1.5 → 2.0)             │
│  ☐ Dê 10 kudos                                │
│  ☐ Comente em 1 fórum                         │
│  ☐ Avalie 2 arenas                            │
│                                               │
│  Bônus: +1 troféu raro "Setembro Dourado"    │
└──────────────────────────────────────────────┘
```

### 10.4 Desafios comunitários (competição entre clubes/arenas/professores)

```
┌────────────────────────────────────────────────┐
│  🏆 Desafio da Semana: "O Clube Mais Ativo"    │
│                                                 │
│  12 clubes disputam. Quem somar mais XP entre  │
│  seus membros hoje-sábado, vence.              │
│                                                 │
│  Prêmio:                                        │
│   🥇 1º lugar: clínica grátis de PRO 5.0 +      │
│                troféu "Comunidade do Mês"        │
│   🥈 2º lugar: pacote de 5 aulas grátis         │
│   🥉 3º lugar: kit com squeeze + adesivos       │
│                                                 │
│  Ranking parcial:                               │
│   1. PickleCuritiba   ████████ 4.230 XP        │
│   2. Smash POA        ███████░ 3.870 XP        │
│   3. Bauru Beach      ██████░░ 3.120 XP        │
│   ...                                           │
│   8. Seu clube       ███░░░░░ 1.420 XP         │
└────────────────────────────────────────────────┘
```

### 10.5 Desafios 1v1 ("Boss fights")

Estilo "duelo semanal" — você vs alguém do seu nível.

```
┌──────────────────────────────────────────────┐
│  ⚔️ Duelo da Semana                          │
│                                              │
│  Você (1.105) vs. Beltrano (1.123)           │
│                                              │
│  Critério: somatório de rating change em     │
│  jogos oficiais nesta semana.                │
│                                              │
│  Vencedor: +200 XP + troféu "Vingador"        │
│  Perdedor: +50 XP (participação)              │
│                                              │
│  [Aceitar duelo]  [Recusar]  [Adiar]         │
└──────────────────────────────────────────────┘
```

A cada 7 dias, o sistema emparelha usuários próximos em rating para um duelo.

---

## 11. Estações, temporadas e eventos ao vivo

### 11.1 Estrutura de tempo

- **Estações** (3 meses): Verão (jan-mar), Outono (abr-jun), Inverno
  (jul-set), Primavera (out-dez). Cada uma com 1 troféu lendário e missões
  sazonais.
- **Temporadas ranqueadas** (1 mês): "Temporada Setembro 2026" com ladder
  semanal, reset de XP sazonal (mas XP cumulativo permanente).

### 11.2 Temporada do mês (1 mês, ladder visível)

```
┌────────────────────────────────────────────────┐
│  Temporada Setembro 2026                        │
│                                                 │
│  ⏱️ 18 dias restantes                            │
│                                                 │
│  Ladder semanal (sua posição: 47º de 312)       │
│  ╔══╦════╦══╦════╗                              │
│  ║47║ +3 ║🎾║ 1.180 XP║ você                   │
│  ║48║ -1 ║🎾║ 1.165 XP║ Beltrano               │
│  ║49║ =  ║🎾║ 1.150 XP║ Cicrano                │
│  ╚══╩════╩══╩════╝                              │
│                                                 │
│  Top 10% do mês ganha:                          │
│  - Troféu "Top 10%" (lendário)                  │
│  - 1 aula experimental grátis com PRO 5.0        │
│  - 50% desconto em pacotes de qualquer professor │
│  - Selo de "Temporada Top 10%" no avatar         │
│  - Entrada direta em 1 torneio premium          │
└────────────────────────────────────────────────┘
```

### 11.3 Hall da Fama (página pública)

```
┌──────────────────────────────────────────────────┐
│  🏛️ Hall da Fama — Temporada Setembro 2026      │
│                                                   │
│  Top 3 por estado (link externo: /hall-da-fama)  │
│                                                   │
│  Paraná                                           │
│   🥇 Beltrano (1.420 XP)                          │
│   🥈 Fulano  (1.380 XP)                           │
│   🥉 Cicrano (1.355 XP)                           │
│                                                   │
│  Rio Grande do Sul                                 │
│   🥇 Dieguito (1.580 XP)                          │
│   🥈 Marilia  (1.510 XP)                          │
│   ...                                              │
│                                                   │
│  Top 3 geral:                                     │
│   🥇 Beltrano · Top 1% · Lendário                 │
│   ...                                              │
└──────────────────────────────────────────────────┘
```

URL pública, compartilhável, **indexável** (SEO), com foto, nível, troféu
da temporada, "selo de autenticidade" (criado via UI, não print).

### 11.4 Banners de "Evento agora" no header

Quando o usuário entra no app durante um torneio público AO VIVO:

```
┌────────────────────────────────────────────┐
│  🔴 AO VIVO  ·  Open de Curitiba · Set/26  │
│  142 atletas · 28 jogos em andamento       │
│  [Assistir ao vivo] [Inscrever-se]         │
└────────────────────────────────────────────┘
```

**Isso transforma o app de "ferramenta" em "companion de evento"**.

---

## 12. Sistema social: rivals, crews, mentores

### 12.1 Rivals (até 5)

Cada usuário pode marcar até 5 "rivais" — usuários próximos em rating. UI:

```
┌──────────────────────────────────────────────┐
│  ⚔️ Seus Rivais                              │
│                                              │
│  Beltrano (1.123, +12 vs semana passada)     │
│  Você: 4-2 vs ele  · H2H detalhado →         │
│                                              │
│  Cicrano (1.098, -3 vs semana passada)       │
│  Você: 1-3 vs ele  · H2H detalhado →         │
│                                              │
│  Dieguito (1.150, +25 vs semana passada)     │
│  Você: 2-2 vs ele  · H2H detalhado →         │
│                                              │
│  [+ Adicionar rival]  [+ Rival automático]  │
└──────────────────────────────────────────────┘
```

**Notificação semanal** (sexta 17h): "Beltrano subiu 12 pontos. Você está
8 abaixo. Bora uma revanche no torneio de sábado?"

**Auto-sugestão**: baseado em rating, mesma cidade/estado, jogou contra você
recentemente.

### 12.2 Crew (até 8 atletas — "meu grupo de duplas")

```
┌──────────────────────────────────────────────┐
│  👥 Sua Crew: "Smash da Segunda"             │
│                                              │
│  Beltrano (1.123)   · 12 duplas com você     │
│  Fulano  (1.045)   · 8 duplas com você      │
│  Marilia (1.180)   · 5 duplas com você      │
│  ...                                          │
│                                              │
│  Estatísticas da Crew:                        │
│   Média: 1.089  ·  18 duplas jogadas         │
│   11-7  ·  61% aproveitamento                │
│                                              │
│  Próximo evento:                             │
│   Open de POA 25/10 — todos inscritos ✓     │
│                                              │
│  [Convidar para crew]  [Sair]                │
└──────────────────────────────────────────────┘
```

**Bônus**: XP bônus por cada jogo de duplas com alguém da crew (+10%).

### 12.3 Mentoria (1 mentor + até 2 aprendizes)

```
┌──────────────────────────────────────────────┐
│  🎓 Mentoria                                  │
│                                              │
│  Você (Intermediário 3.5) é mentor de:       │
│                                              │
│   • Fulano (Iniciante 2.0) — 8 semanas      │
│     Progresso: 5 jogos, 1 conquista          │
│     Meta da semana: 3 jogos (faltam 1)       │
│                                              │
│   • Cicrano (Iniciante 2.5) — 3 semanas     │
│     Progresso: 2 jogos, 0 conquistas         │
│     Meta da semana: 2 jogos (faltam 0!) ✓    │
│                                              │
│  Bônus mentor: +100 XP por meta atingida     │
│  Próxima mentoria coletiva: domingo 10h      │
│                                              │
│  [Ver detalhes]  [Trocar mentor/aprendiz]    │
└──────────────────────────────────────────────┘
```

**Quando alguém atinge meta**: notificação pro mentor com
"Parabéns! Cicrano completou a meta. +100 XP pra você."

### 12.4 Kudos / 👏 (universal)

- Em qualquer lugar (perfil, jogo, conquista, post, foto): botão 👏.
- 1 usuário pode dar 1 👏 por item. Multi-usuários podem dar.
- Quem recebe: +1 XP por 👏 (cap 100/dia).
- Quem dá: +0,5 XP por 👏 (cap 50/dia), "badge Apreciador" ao chegar em 100.

### 12.5 Carta ao companheiro (pós-torneio de duplas)

```
┌──────────────────────────────────────────────┐
│  ✉️ Carta ao Companheiro                     │
│                                              │
│  Torneio: Open de Curitiba · Set/26          │
│  Parceiro: Beltrano                          │
│                                              │
│  Escreva uma frase para Beltrano:            │
│  (até 280 caracteres, anônima por padrão)    │
│                                              │
│  [__________________________________________]│
│  [__________________________________________]│
│                                              │
│  ☐ Mostrar meu nome                          │
│                                              │
│  [Enviar carta]                              │
└──────────────────────────────────────────────┘
```

Quem recebe a carta: notificação + bônus emocional de pertencimento.

### 12.6 Match Reviews (avaliação mútua)

Após cada jogo oficial de torneio, **ambos os jogadores** podem avaliar
(1–5 ⭐ + 1 linha).

```
┌──────────────────────────────────────────────┐
│  Como foi jogar com Beltrano?                │
│                                              │
│  ⭐⭐⭐⭐⭐                                    │
│                                              │
│  Comentário (opcional):                      │
│  [_________________________________________]│
│                                              │
│  Tags: [Companheiro] [Educado] [Justo]      │
│         [Pontual] [Bom esportista]           │
│                                              │
│  [Pular]  [Enviar]                            │
└──────────────────────────────────────────────┘
```

**Anti-abuse**: reviews são mútuas. Se um avalia 1⭐ e o outro 5⭐,
sistema flag para review. Score agregado só conta com ≥ 5 reviews.

---

## 13. Sistema de convites & viralidade

### 13.1 O que já existe

- `clubs/{id}.invite_code` (6 chars A-Z0-9) para entrar em clube.
- `tournaments/{id}.invite_code` para entrar em torneio.
- **NÃO existe** invite code da plataforma.
- **NÃO existe** rastreamento de quem convidou quem.

### 13.2 Proposta: 3 camadas de convite

#### Camada 1 — Invite da plataforma (por usuário)

Cada usuário ganha um código único de 8 chars:
```
SEU LINK: picklerush.web.app/r/FS42K9XP
```

**Recompensas**:
- Quem é indicado (usa o link): +200 XP no cadastro + 1 aula experimental
  grátis (cupom).
- Quem indicou: +50 XP por signup confirmado (email verificado).
- Quem indicou + indicado jogou 5+ jogos: +200 XP ao indicador.
- Quem indicou + indicado organizou 1 torneio: +500 XP ao indicador.
- **Cap**: máx 50 indicações válidas/mês (anti-farming).

#### Camada 2 — Invite de clube (existente, melhorado)

Já existe. Proposta: além do código, gerar **URL com tracking**:
```
picklerush.web.app/c/CLUB-XYZ?ref=USR123
```

Quando o novo membro entra via `?ref=`, o indicador ganha 30 XP, e o clube
ganha 1 no contador "ConvitesConvertidos" (admin vê).

#### Camada 3 — Invite de arena/parceiro (parcerias B2B)

```
┌──────────────────────────────────────────────┐
│  🏟️ Arena Smash Curitiba                     │
│  17 quadras · 4.6⭐ (84 reviews)             │
│                                              │
│  Indique esta arena e ganhe 100 XP + 10%    │
│  de desconto na sua próxima reserva!         │
│                                              │
│  Seu link: picklerush.web.app/a/X8K4?ref=USR│
│  [Compartilhar]                              │
│                                              │
│  Já indicou 12 pessoas · 8 ativaram (67%)    │
│  Você está em 47º no ranking de embaixadores │
└──────────────────────────────────────────────┘
```

**Regras**:
- Arena oferece desconto/cupom ao indicador quando indicado ativa.
- Plataforma rastreia ativação (1ª reserva da arena pelo indicado).
- Arena vê painel de "embaixadores" (gamificado).

### 13.3 Sequência de onboarding viral

```
Cadastro → Onboarding → Primeira ação genuína
   ↓            ↓               ↓
Tela "Convide um amigo" com preview do card de share
   ↓
Card de share (visual, IG/WhatsApp story ready)
   ↓
Indicado entra pelo link
   ↓
Indicado vê: "Você foi convidado por Beltrano" (com foto/nível)
   ↓
Indicado ganha +200 XP
   ↓
Beltrano recebe notificação: "Fulano entrou pelo seu link! +50 XP"
   ↓
Beltrano compartilha em stories (mecanismo de 2-step virality)
```

### 13.4 Compartilhamento nativo de cada conquista

Cada conquista (ao desbloquear) gera **automaticamente** um card pronto
para compartilhar:

```
┌───────────────────────────────┐
│  🏆 PRIMEIRA VITÓRIA!         │
│  1 jogo · 1 vitória · 100%    │
│  Beltrano · Curitiba/PR       │
│  picklerush.web.app/u/Beltrano│
│                               │
│  [Compartilhar]  [Baixar]     │
└───────────────────────────────┘
```

Compartilhar = +10 XP adicional. Quem vê o card e clica = rastreado.

### 13.5 "PickleRush Squad" (programa de embaixadores oficiais)

Top 100 usuários que mais trouxeram amigos nos últimos 90 dias:

- Badge "Embaixador PickleRush" no perfil.
- Acesso antecipado a novas features (beta-tester).
- 1 torneio fechado "Copa dos Embaixadores" com奖品 (prêmios).
- Merchandise físico (camiseta, squeeze, adesivos) grátis.

---

## 14. Onboarding gamificado + re-engajamento

### 14.1 Tour da 1ª sessão (3 min, +350 XP)

```
┌──────────────────────────────────────────────┐
│  🎾 Bem-vindo ao PickleRush, Fulano!         │
│                                              │
│  Vamos fazer um tour rápido? (+350 XP)       │
│                                              │
│  1. ☐ Defina seu nível (60s)        +50 XP  │
│  2. ☐ Foto de perfil (30s)          +30 XP  │
│  3. ☐ Bio + cidade (45s)           +40 XP  │
│  4. ☐ Veja o ranking (30s)         +20 XP  │
│  5. ☐ Inscreva-se no 1º torneio (60s) +50 XP│
│  6. ☐ Entre em 1 clube (45s)        +50 XP  │
│  7. ☐ Siga 3 atletas (30s)         +30 XP  │
│  8. ☐ Veja 1 torneio ao vivo (60s)  +30 XP  │
│  9. ☐ Compartilhe com 1 amigo (60s) +50 XP  │
│                                              │
│  Progresso: ████░░░░░░ 3/9                  │
│  [Continuar]  [Pular por agora]              │
└──────────────────────────────────────────────┘
```

**Por que funciona**:
- Mostra as features (descoberta forçada).
- Cada ação dá XP concreto (feedback imediato).
- "Pular por agora" não é escondido — onboarding não bloqueia (regra do
  PR #94: onboarding destravado).

### 14.2 "Sua semana em review" (segunda 7h)

```
┌──────────────────────────────────────────────┐
│  ☀️ Bom dia, Beltrano! Aqui está sua semana │
│                                              │
│  De 14 a 20 de setembro:                    │
│                                              │
│   📊 4 jogos (+2 vs semana passada)         │
│   🏆 3 vitórias (75% aproveitamento)         │
│   🎾 1 torneio participaste                  │
│   👏 7 kudos recebidos                       │
│   ⭐ Você subiu 12 pontos no rating          │
│   📈 Você ganhou 8 posições no ranking       │
│                                              │
│  Você está em 4 dias seguidos. Faltam 3     │
│  para o achievement "Constância".            │
│                                              │
│  Missões da semana passada:                  │
│   ✓ Jogue 3 partidas                        │
│   ✓ Inscreva-se em 1 torneio                │
│   ☐ Publique 1 resultado (faltam)           │
│                                              │
│  [Ver review completa]  [Pular essa semana]  │
└──────────────────────────────────────────────┘
```

### 14.3 Re-engajamento por ausência

| Dias parado | Ação | Tom |
|---|---|---|
| 3 dias | In-app: "Sua sequência de 7 dias tá esperando. Bora 1 joguinho?" | Leve |
| 7 dias | Push: "Fulano te mandou kudos! Volte para agradecer" | Social (instigante) |
| 14 dias | Email + push: "Seu rating 1.023 está congelado há 2 semanas. Bora?" | Suave |
| 30 dias | Email com cupom: "30 XP de boas-vindas + 1 aula experimental grátis ao voltar" | Generoso |
| 60 dias | Email: "Sua semana em review retroativa" + cupom arena 20% | Emocional |
| 90 dias | "Sentimos muito sua falta. Volte por 1 dia: ganhe troféu 'Loyalty Veteran' (one-shot, lendário)" | Nostálgico |

### 14.4 "Daily challenge" simplificado

Para usuários que retornam diariamente há 5+ dias:
```
┌────────────────────────────────┐
│  ⚡ Quick Play (5 min)         │
│                                │
│  3 ações rápidas, +30 XP:     │
│  ☐ Ver 1 torneio público       │
│  ☐ Mandar 1 kudos              │
│  ☐ Visitar 1 perfil            │
│                                │
│  [Começar]                     │
└────────────────────────────────┘
```

Cap: 1 por dia. Para manter o "ritmo".

---

## 15. Painel do professor (engajamento do lado "supply")

> "Se o lado demanda (atleta) está gamificado mas o supply (professor,
> arena, organizador) não, o sistema entra em colapso." — adaptar.

### 15.1 Dashboard do professor com health score

```
┌──────────────────────────────────────────────┐
│  🎓 Painel do Professor — Beltrano (3.5)     │
│                                              │
│  Health Score: 87/100 (Acima da média)       │
│  ████████████████████░░░ 87%                 │
│                                              │
│  📊 Métricas do mês                          │
│   • Aulas dadas: 23 (+12% vs ago mês)       │
│   • Pacotes vendidos: 4                     │
│   • Alunos ativos: 18                       │
│   • Receita: R$ 2.450                       │
│   • Avaliação: 4.8⭐ (32 reviews)            │
│   • Taxa de comparecimento: 94%              │
│   • NPS estimado: 72 (excelente)             │
│                                              │
│  🎯 Metas do mês (3/5)                      │
│   ✓ 20 aulas                                │
│   ✓ 5⭐ em 25+ reviews                       │
│   ✓ 5 validações de nível                    │
│   ☐ 30 aulas (faltam 7)                     │
│   ☐ 1 clínica aberta                         │
│                                              │
│  🏆 Conquistas recentes (3)                  │
│   ⭐ "Veterano do ensino" (10 aulas no mês)  │
│   ⭐ "Avaliador" (1ª validação de nível)    │
│   ⭐ "4.9⭐ com 20+ reviews"                 │
│                                              │
│  💡 Sugestões da plataforma:                 │
│   • Você tem 7 dias com horário vago na      │
│     terça 19h. Publique "Aula aberta" para   │
│     atrair 1 aluno. (+200 XP se preencher)  │
│   • 3 alunos seu estão sem aulas há 30+     │
│     dias. Mande um push: "volta pra         │
│     quadra?". (+50 XP/aluno)                │
└──────────────────────────────────────────────┘
```

### 15.2 Sistema de reputação do professor

- **Reviews mútuas** (1-5⭐) com tags.
- **NPS estimado** (de 1 review a cada 5 aulas).
- **"Super Professor"** (badge lendário): 4.9⭐ + 50+ reviews + 0
  cancelamentos últimos 90 dias.
- **Selo de "Resposta rápida"**: responde ≥90% das mensagens em < 24h.
- **Selo de "Mentor"**: ≥5 alunos com nível validado.

### 15.3 Gamificação de clínicas e workshops

- "Crie sua 1ª clínica" = +100 XP
- "Workshop lotado" (capacidade atingida em 24h) = +300 XP
- "Clínica 5⭐" (avaliação média 4.8+) = +500 XP
- "Workshop anual" (todo ano) = +1.000 XP (cria tradição)

---

## 16. Arena: CRM + health score

### 16.1 Dashboard da arena (arena_admin)

```
┌──────────────────────────────────────────────┐
│  🏟️ Painel da Arena — Smash Curitiba        │
│                                              │
│  Health Score: 92/100 (Excelente)            │
│                                              │
│  📊 Esta semana                              │
│   • Ocupação: 78% (↑ 12% vs semana passada) │
│   • Receita: R$ 8.230                       │
│   • Reservas: 142                            │
│   • No-shows: 3 (2.1%, dentro do aceitável) │
│   • Membros ativos: 87                       │
│   • NPS: 71                                  │
│                                              │
│  🎯 Metas do mês (2/4)                      │
│   ✓ 75% de ocupação média                    │
│   ✓ 0 cancelamentos por falta da arena       │
│   ☐ 1 evento aberto (torneio/clínica)        │
│   ☐ +20 novos membros                        │
│                                              │
│  💡 Sugestões:                               │
│   • Quinta 19h tem só 35% de ocupação.      │
│     Ative "preço dinâmico" ou crie um        │
│     "Pickle Casual" para encher. (+150 XP)  │
│   • 5 clientes seus têm 30+ dias sem voltar.│
│     Mande cupom "volta pra arena". (+50 XP) │
└──────────────────────────────────────────────┘
```

### 16.2 Arena pode criar "desafios sazonais"

```
┌──────────────────────────────────────────────┐
│  🏟️ Smash Curitiba — Desafio Outubro        │
│                                              │
│  "Semana das Duplas"                         │
│  Toda reserva de 2h+ em horário de pico     │
│  ganha cupom de R$ 20 para próxima visita.  │
│                                              │
│  Reservado por:                              │
│  Beltrano ⭐ Cicrano ⭐                      │
│  [Resgatar cupom]                            │
│                                              │
│  Compartilhe seu código e ganhe:             │
│  10% de cada reserva que amigos fizerem      │
│  por 30 dias.                                │
└──────────────────────────────────────────────┘
```

---

## 17. Clubes: vida social & leaderboards internos

### 17.1 "Atividade semanal do clube"

```
┌──────────────────────────────────────────────┐
│  🏛️ PickleCuritiba                          │
│  42 membros · 8º de 24 (Top 33%)            │
│                                              │
│  Esta semana:                                │
│   • 23 jogos (↑ 4 vs semana passada)        │
│   • 7 membros jogaram                        │
│   • 3 conquistas desbloqueadas              │
│   • 1 evento organizado                     │
│   • 1 novo membro                            │
│                                              │
│  Top contribuidores da semana:               │
│   1. Beltrano · 4 jogos · +250 XP           │
│   2. Fulano   · 3 jogos · +180 XP           │
│   3. Marilia  · 3 jogos · +170 XP           │
│                                              │
│  Conquista coletiva:                         │
│   "10 jogos da semana" ✓ (atingido!)         │
│   Recompensa: clínica grátis do PRO 4.5     │
│   Beltrano (12h) → todos do clube ganham     │
│   acesso a 1 aula experimental.             │
└──────────────────────────────────────────────┘
```

### 17.2 "Conquistas coletivas"

- "10 jogos da semana" → recompensa coletiva.
- "5 membros novos no mês" → expansão.
- "100 jogos no mês" → marca histórica.
- "1 torneio organizado por membro" → maturidade.

### 17.3 "Top 3 da semana" interno

Mostrar dinamicamente no mural do clube: top 3 por XP ganho, por kudos
recebidos, por jogos jogados, por novos amigos.

---

## 18. Mecânicas de "review da semana" & jornada emocional

> Strava, Duolingo, Apple Watch, Whoop — todos fazem. **PickleRush precisa
> fazer**.

### 18.1 Weekly review (resumo)

Ver 14.2.

### 18.2 Monthly review (sábado 1º do mês, 8h)

```
┌────────────────────────────────────────────────┐
│  📅 Seu mês em Setembro                       │
│                                                 │
│  Você subiu 1 nível! (Calouro → Aprendiz)     │
│  Rating: 1.012 → 1.058 (+46)                   │
│  Posição: 87º → 51º (↑ 36)                    │
│  Jogos: 23 (↑ 6)                               │
│  Aproveitamento: 61% (↑ 4%)                    │
│  Streak: 7 semanas (recorde pessoal!)          │
│                                                 │
│  Conquistas desbloqueadas (3):                  │
│  • Pegando ritmo (25 jogos)                     │
│  • Conversador (1º chat)                        │
│  • Disciplina (completou pacote de 5 aulas)     │
│                                                 │
│  Você interagiu com 7 atletas diferentes.       │
│  Os mais frequentes: Beltrano (4x), Cicrano    │
│  (3x), Dieguito (2x).                          │
│                                                 │
│  🏆 Você está em 12% dos usuários mais         │
│     ativos da sua cidade. Parabéns!            │
│                                                 │
│  [Compartilhar minha evolução]  [OK]            │
└────────────────────────────────────────────────┘
```

### 18.3 "Marco" detection

O sistema detecta automaticamente eventos dignos de celebração:

- Subiu de nível → notificação especial.
- Subiu de tier (Calouro → Aprendiz) → celebração.
- Rating pessoal recorde → "🏅 Novo recorde: 1.058!".
- Streak recorde pessoal → "🔥 7 semanas seguidas! Seu recorde é 7!".
- 1ª vitória contra alguém 200+ acima → "🚨 Nocaute Épico!".
- Atingiu meta pessoal → "🎯 Meta 'Jogar 50 jogos' atingida!".
- 100º jogo de duplas com alguém → "💍 100 jogos com Beltrano — sua dupla mais frequente!".

### 18.4 Review de temporada (a cada 3 meses)

```
┌────────────────────────────────────────────────┐
│  🏛️ Fim da Temporada de Inverno 2026          │
│                                                 │
│  Você entrou em:                                │
│   • 2 clubes novos                              │
│   • 5 arenas diferentes                         │
│   • 1 clínica com professor                     │
│                                                 │
│  Sua Crew teve 18 duplas, 12-6 (67%).          │
│  Você ganhou 4 rivais e venceu 3 deles.        │
│                                                 │
│  Comparado ao Brasil:                           │
│   Você jogou 23% mais que a média               │
│   Você subiu 2x mais rápido no rating           │
│   Você está em top 8% da sua faixa etária       │
│                                                 │
│  🏆 Troféu da Temporada: "Inverno Quente" (R)  │
│     (atingiu 12 jogos em jul/ago)               │
│                                                 │
│  Temporada de Primavera começa em 1 dia.       │
│  [Ver review]  [Compartilhar]                   │
└────────────────────────────────────────────────┘
```

---

## 19. Mecânicas de proteção (anti-burnout, anti-cheating)

### 19.1 Burnout

- **Aviso de frequência**: se jogou 5+ dias seguidos, sugerir descanso.
- **Health check semanal**: "Você está jogando 4 dias por semana. Continue
  assim, mas lembre de alongar e hidratar."
- **"Modo descanso"**: liga por 7 dias, streak congelado, sem perda.

### 19.2 Anti-cheating (XP / Rating)

- **Cap diário**: já mencionado.
- **Detecção de farm**: XP > 5.000/dia → review admin.
- **Torneios fantasmas**: organizador cria torneio com 1 só participante
  para farmar XP. **Solução**: XP só conta se torneio teve ≥ 4 atletas
  distintos OU foi torneio público com ≥ 8 atletas.
- **Self-reviews**: proibidas. Reviews 1⭐ precisam ser justificadas.
- **Clusters de IP**: 5 contas no mesmo deviceId → review.

### 19.3 No-show leve (não punição pesada)

- 1º no-show: warning.
- 2º no-show: -30 XP + flag.
- 3º no-show em 90 dias: -50% dos XP da reserva.
- **Recuperação**: jogar 5 reservas seguidas sem no-show → recupera 50%.

### 19.4 Streak com proteção

- 1 grace day por mês (não conta perda).
- Modo "férias" (liga 1x por temporada, congelado por 7 dias).
- Streak não é "tudo ou nada" — a cada semana adicionada, XP bônus
  crescente (semanal 4 = +100, 8 = +200, 12 = +500).

### 19.5 Acessibilidade

- **Não ter** (ainda) foto de perfil não deve impedir ninguém de jogar.
- **Não fazer** onboarding não deve impedir nada.
- **Sem XP por "curtir"**: kudos é opt-in, dá pouco, não penaliza quem
  não dá.

---

## 20. Roadmap sugerido (Fases) com feature flags

### Fase 0 — **Fundação** (já existe, mas consolidar)

- ✅ XP, streak, level, achievements, goals, smart matchmaking, H2H,
  level-validated-by-coach.
- 🔧 Refatorar `progression.js` para `progressionV2.js` (multi-fonte, skill
  trees). Manter compat via adapter.
- 🔧 Adicionar `tiers.js` (Calouro → Imortal).
- 🔧 Adicionar `XP_CAPS` e `streakRules` com grace.
- 🔧 Migrar `users/{uid}.xp_total` para `users/{uid}.xp_by_source`.
- 🔧 Adicionar `users/{uid}.streak_meta` (grace, frozen, last_play).

### Fase 1 — **Conquistas + Conquistas visuais** (2-3 sprints)

- 🔨 Domínio `achievementsV2.js` com 5 famílias + raridade.
- 🔨 80 conquistas catalogadas, cada uma com: `id`, `name`, `description`,
  `family`, `rarity`, `test`, `icon`, `lore` (texto curto), `shareable`.
- 🔨 Componente `AchievementCardV2` com visual de raridade.
- 🔨 Página `/conquistas` (perfil público) com filtros por família.
- 🔨 Componente `AchievementUnlockToast` (animação ao desbloquear).
- 🔨 Componente `AchievementShareCard` (gerar imagem para IG/WhatsApp).
- Feature flags: `ACHIEVEMENTS_V2`, `ACHIEVEMENT_SHARE_CARDS`.

### Fase 2 — **Missões** (2-3 sprints)

- 🔨 Domínio `missions.js` (gerador de missões diária/semanal/mensal).
- 🔨 Coleção `user_missions/{uid}_{missionId}` (estado).
- 🔨 Componente `MissionList` (em `/meu-desempenho` ou novo).
- 🔨 `MissionCompleteToast` (celebração ao cumprir).
- 🔨 Cloud Function opcional para gerar missões às 04:00 BRT.
- Feature flags: `MISSIONS_DAILY`, `MISSIONS_WEEKLY`, `MISSIONS_MONTHLY`.

### Fase 3 — **Níveis com nome + Skill trees** (2 sprints)

- 🔨 Domínio `tiers.js` (8 tiers).
- 🔨 Domínio `skillTrees.js` (5 trilhas).
- 🔨 Componente `TierBadge` (visual de tier).
- 🔨 Componente `SkillTreeBars` (5 barras de progresso).
- 🔨 Substituir `ProgressionCard` por `ProgressionCardV2`.
- Feature flags: `TIERS_NAMED`, `SKILL_TREES`.

### Fase 4 — **Streak com proteção** (1 sprint)

- 🔨 Refatorar `computeWeekStreak` para `computeWeekStreakV2` (grace day,
  freeze).
- 🔨 UI: shield icon quando usou grace.
- 🔨 UI: "modo férias" toggle.
- Feature flag: `STREAK_PROTECTION`.

### Fase 5 — **Referral program** (3 sprints)

- 🔨 `users/{uid}.referral_code` (gerado no 1º login, 8 chars A-Z0-9).
- 🔨 `referrals/{referrerId}_{refereeId}` (rastreamento).
- 🔨 Componente `ReferralCard` (compartilhável).
- 🔨 Landing `/r/:code` que pré-preenche o signup.
- 🔨 Recompensas (XP, cupons) atreladas.
- Feature flags: `REFERRAL_PROGRAM`, `REFERRAL_REWARDS`.

### Fase 6 — **Kudos + Match Reviews** (2 sprints)

- 🔨 Coleção `kudos/{kudoId}` (from, to, target_type, target_id).
- 🔨 Componente `KudosButton` (universal).
- 🔨 Componente `MatchReviewDialog` (pós-jogo).
- 🔨 Domínio `matchReview.js` (agregação, anti-abuse).
- Feature flags: `KUDOS`, `MATCH_REVIEWS`.

### Fase 7 — **Rivals + Crew** (3 sprints)

- 🔨 `rivals/{uid}_{rivalUid}` (até 5).
- 🔨 `crews/{crewId}` (até 8 membros).
- 🔨 UI de rivais: card com H2H, trend semanal.
- 🔨 UI de crew: dashboard, eventos, stats agregadas.
- 🔨 Auto-sugestão de rival (próximo em rating + mesma região).
- Feature flags: `RIVALS`, `CREWS`.

### Fase 8 — **Mentoria** (2 sprints)

- 🔨 `mentorships/{mentorId}_{apprenticeId}` (1 mentor + 2 aprendizes).
- 🔨 UI mentor: dashboard com aprendizes.
- 🔨 UI aprendiz: dashboard com metas.
- 🔨 Notificação para mentor quando aluno atinge meta.
- Feature flag: `MENTORSHIP`.

### Fase 9 — **Temporadas + Hall da Fama** (3 sprints)

- 🔨 Modelo `season` (4/ano, 3 meses cada).
- 🔨 `season_rankings/{seasonId}_{uid}` (XP sazonal).
- 🔨 UI de temporada (banner, ladder, countdown).
- 🔨 Página `/hall-da-fama` (público, indexável).
- Feature flags: `SEASONS`, `HALL_OF_FAME`.

### Fase 10 — **Desafios comunitários + 1v1** (2 sprints)

- 🔨 `challenges/{challengeId}` (tipo, regras, prêmio, fim).
- 🔨 UI de desafio (banner, leaderboard, progress).
- 🔨 Cron job de "duelo semanal" (emparelhamento por rating).
- Feature flags: `COMMUNITY_CHALLENGES`, `WEEKLY_DUEL`.

### Fase 11 — **Lendário: Troféus de plataforma** (1 sprint)

- 🔨 5 troféus one-shot lendários.
- 🔨 Visual especial (animação, partículas, "limited edition").
- 🔨 Frame de perfil baseado em troféu lendário.
- Feature flag: `LEGENDARY_TROPHIES`.

### Fase 12 — **Sazonal + Cartas + Crew bônus** (ongoing)

- 🔨 Coleção `seasonal_missions` (rotativa).
- 🔨 Coleção `letters` (carta ao companheiro).
- 🔨 Bônus XP por jogo com crew.
- Feature flags: `SEASONAL_QUESTS`, `CREW_BONUSES`, `LETTERS`.

### Fase 13 — **Readiness & Wellness** (1 sprint)

- 🔨 Score "Readiness to play" (verde/amarelo/vermelho).
- 🔨 Aviso de frequência (5+ dias seguidos).
- 🔨 Modo descanso.
- Feature flag: `READINESS_SCORE`.

### Fase 14 — **Embaixadores + Hall da Fama físico** (2 sprints)

- 🔨 Programa "PickleRush Squad" (top 100 embaixadores).
- 🔨 Acesso antecipado a features.
- 🔨 Torneio fechado "Copa dos Embaixadores".
- Feature flag: `EMBASSADOR_PROGRAM`.

### Fase 15 — **Compartilhamento nativo + Share Cards** (2 sprints)

- 🔨 `ShareCard` (gera PNG com foto, conquista, stats).
- 🔨 Integração com Web Share API.
- 🔨 Templates por tipo (conquista, stats, milestone).
- Feature flags: `SHARE_CARDS_V2`, `WEB_SHARE_API`.

---

## 21. Métricas de sucesso

Como saber se a gamificação está funcionando?

### 21.1 Métricas de retenção (core)

| Métrica | Meta | Como medir |
|---|---|---|
| **DAU/MAU ratio** | >25% | Firebase Analytics |
| **Retenção D+7** | >40% | Firebase Analytics |
| **Retenção D+30** | >20% | Firebase Analytics |
| **Retenção D+90** | >10% | Firebase Analytics |
| **Usuários ativos semanais** | +50% em 6 meses | query Firestore |
| **Streak médio** | >3 semanas | query Firestore |
| **Usuários com missões cumpridas no dia** | >30% | telemetry |

### 21.2 Métricas de engajamento (depth)

| Métrica | Meta | Como medir |
|---|---|---|
| **Jogos registrados/semana** | +100% | `games/{id}` + game-day |
| **Torneios criados/mês** | +80% | `tournaments/{id}.created_by` |
| **Clubes criados/mês** | +50% | `clubs/{id}.created_by` |
| **Aulas agendadas/mês** | +150% | `coach_lessons/{id}` |
| **Reviews escritas** | >30% dos jogos | `matchReviews` |
| **Fotos postadas** | +200% | `tournament_photos` + `club_posts` |
| **Mensagens de chat** | +100% | `messages` |

### 21.3 Métricas de viralidade

| Métrica | Meta | Como medir |
|---|---|---|
| **Convites enviados/usuário/mês** | >2 | `referrals/{id}` |
| **Taxa de conversão de convite** | >25% | `referrals/{id}.status === 'activated'` |
| **K-factor** (indicações × conversão) | >1.0 | calculado |
| **Compartilhamentos de share card** | >10% das conquistas | `shareCards` events |
| **Novos usuários orgânicos/mês** | +200% em 6 meses | Firebase Analytics source=referral |

### 21.4 Métricas de saúde da plataforma

| Métrica | Meta | Como medir |
|---|---|---|
| **No-show rate em arenas** | <5% | `bookings/{id}.no_show` |
| **Torneios cancelados** | <10% | `tournaments.status === 'cancelled'` |
| **Reviews 1⭐ rate** | <5% | `matchReviews.rating === 1` |
| **Casos de farming** | <1% dos usuários | detecção anomalia |
| **Casos de burnout (sinal)** | <5% | frequência >5 dias/semana |

### 21.5 Métricas de "value" para o usuário

Pesquisa NPS trimestral:
- "PickleRush me ajuda a jogar mais pickleball" (1-5)
- "PickleRush me ajuda a conhecer gente nova" (1-5)
- "PickleRush me ajuda a melhorar como jogador" (1-5)
- "PickleRush me ajuda a organizar bem torneios" (1-5) [se aplicável]

---

## 22. Anexo: lista exaustiva de ideias extras ("Cardápio")

> Ideias que não cabem nos pilares acima, mas que podem ser **votadas** pelo
> usuário no app (feature flag `IDEA_VOTING`).

### Comunidade
- [ ] "Carta aberta ao admin" (1x por temporada, lida publicamente)
- [ ] "Anônimo do dia" (1 atleta aleatório ganha destaque, sem identidade)
- [ ] "TBT (Throwback Thursday)" — post automático de "há 1 ano você jogou..."
- [ ] "Match of the week" — jogo destaque da semana (admin elege)
- [ ] "FOTO OFICIAL DA TEMPORADA" — arena top da estação ganha destaque
- [ ] "Linha do tempo" — visualização dos marcos do usuário
- [ ] "Estatística curiosa da semana" — gerada automaticamente
- [ ] "Wiki do clube" — página colaborativa com regras do clube
- [ ] "Hall of fame" individual por arena (top 3 que mais jogaram lá)
- [ ] "Mascote do clube" (avatar que muda de nível junto com o clube)

### Treinamento e skills
- [ ] "Drill do dia" (sugestão diária de drill baseado no seu nível)
- [ ] "Plano de 4 semanas para subir de USAP" (gerado por IA)
- [ ] "Comparação com PRO 5.0" (seu jogo vs o de um PRO 5.0 anonimizado)
- [ ] "Diagnóstico de fraqueza" (analisa seus jogos e sugere foco)
- [ ] "Biblioteca do PRO" — vídeos curtos de PROs (curadoria de professores)
- [ ] "Aula experimental grátis" ao entrar na plataforma (cupom 1x)
- [ ] "Desafio do professor" — 30 dias, 3 aulas, 1 jogo — redução no pacote

### Marketplace
- [ ] "Tabela de mercado" de preço de aulas por região
- [ ] "Black Friday do PickleRush" (cupons de arenas, pacotes, etc.)
- [ ] "Cashback de indicação" (10% do 1º pacote de quem você indicou)
- [ ] "Leilão de quadra" (arena com horário ocioso vende barato)
- [ ] "Pacote solidário" (1 aula sua = 1 aula grátis pra projeto social)
- [ ] "Match sponsor" (patrocinador que banca torneio em troca de logo)
- [ ] "PickleTrip" — eventos + estadia (parceria com hotel)

### Engajamento diário
- [ ] "Daily Pickle Quiz" (1 pergunta por dia, +10 XP)
- [ ] "Wordle do PickleRush" (descobrir o atleta do dia)
- [ ] "Pickle Crossword" (semanal)
- [ ] "Desafio do emoji" (1 emoji, 5 atletas adivinham)
- [ ] "Votação do mês" (ex: "qual arena é a melhor?" — todos votam)
- [ ] "Foto do dia" (foto de quadra com mais likes)

### Personalização
- [ ] Avatar customizável (frame + expressão + roupa virtual)
- [ ] "Cor do perfil" (cada tier tem uma cor — uso em lista)
- [ ] "Título customizado" (escolher entre "Veterano", "Mestre", etc.)
- [ ] "Bio em vídeo" (15s de Loom)
- [ ] "Estatísticas favoritas" (escolhe 3 pra mostrar no card)

### Realidade aumentada / Tech
- [ ] "Pintura virtual" do seu avatar com troféu
- [ ] "AR scoreboard" (escanear QR code na arena, vê placar em AR)
- [ ] "Voice command" no app ("PickleRush, registra resultado: Beltrano 11, Cicrano 7")
- [ ] "Watch app" (registrar jogo no Apple Watch / Wear OS)
- [ ] "AI buddy" (chat que ajuda a achar torneio, parceiro, professor)

### Social estendido
- [ ] "Speed dating do pickle" (5 min com 3 atletas aleatórios)
- [ ] "Torneio de duplas mistas obrigatórias" (1M+1F)
- [ ] "Linha do tempo compartilhada" (timeline do casal de duplas)
- [ ] "Família do tênis" (3 gerações — pai, filho, neto)
- [ ] "Alumni do clube" (membros antigos que viraram referência)

### Admin tools
- [ ] "Painel de saúde da plataforma" (admin)
- [ ] "Bot de moderação" (chat)
- [ ] "Relatório de impacto" (admin exporta dados p/ impressão)
- [ ] "Heatmap de uso" (mapa de calor de cidades/horários)

### Internacionalização
- [ ] Multi-idioma (espanhol, inglês) — Argentina, México, EUA
- [ ] Multi-moeda (USD, EUR, ARS, MXN)
- [ ] "PickleRush Global" (ranking intercontinental)
- [ ] "Amistoso internacional" (BR vs AR, BR vs US)

### Eventos especiais
- [ ] "PickleRush Summit" (encontro anual dos top 100)
- [ ] "Copa das Confederações" (top de cada estado)
- [ ] "24h de Pickleball" (maratona de torneio)
- [ ] "Mês do Iniciante" (todos os 2.0 com bônus XP)
- [ ] "Semana do Bem" (XP do mês vai pra projeto social)

---

## Apêndice: estrutura de dados proposta

```js
// users/{uid}/profile (existente, expansão)
{
  xp_total: 3020,
  xp_by_source: {
    tournament: 1660,
    social: 200,
    arena: 0,
    coach: 0,
    club: 0,
    bonus: 1160,
  },
  tier: 'Aprendiz',            // Calouro | Aprendiz | Jogador | ...
  tier_level: 4,
  skill_trees: {
    tournament: { xp: 1500, level: 5 },
    social: { xp: 200, level: 2 },
    arena: { xp: 0, level: 0 },
    coach: { xp: 0, level: 0 },
    club: { xp: 0, level: 0 },
  },
  streak: {
    weeks: 2,
    last_play_at: Timestamp,
    grace_used_month: '2026-09',
    frozen_until: null,
  },
  rivals: ['uid1', 'uid2', 'uid3'],   // até 5
  crew_id: 'crew_xyz' | null,
  mentor_id: 'uid_mentor' | null,
  apprentices: ['uid_a1', 'uid_a2'],
  referral_code: 'FS42K9XP',
  referred_by: 'uid_origin' | null,
  stats: { ... },  // existente
}

// achievements/{achId}/unlocks/{uid} (existente, expansão)
{
  unlocked_at: Timestamp,
  shared: false,
  shared_count: 0,
  progress: 100,         // 0-100
}

// user_missions/{uid}_{date}
{
  date: '2026-09-22',
  daily: [
    { id: 'play_1_game', desc: '...', xp: 30, done: true, done_at: Ts },
    ...
  ],
  weekly: [...],
  monthly: [...],
  bonus_claimed: { daily: true, weekly: false, monthly: false },
}

// kudos/{kudoId}
{
  from: uid, to: uid, target_type: 'game'|'conquest'|'post'|'profile',
  target_id: string, created_at: Ts,
}

// matchReviews/{reviewId}
{
  from: uid, to: uid, match_id: string,
  rating: 5, comment: '...', tags: ['companheiro', 'pontual'],
  created_at: Ts, both_submitted: false,
}

// rivals/{uid}_{rivalUid}
{
  owner: uid, rival: uid,
  rating_diff: 18,
  h2h: { owner: 4, rival: 2 },
  created_at: Ts,
  last_notified_at: Ts,
}

// crews/{crewId}
{
  name: 'Smash da Segunda',
  owner: uid,
  members: [uid, ...],   // até 8
  stats: { total_games: 18, total_wins: 11, total_losses: 7 },
  created_at: Ts,
}

// mentorships/{mentorId}_{apprenticeId}
{
  mentor: uid, apprentice: uid,
  started_at: Ts,
  apprentice_level_start: 'iniciante_2',
  apprentice_level_current: 'iniciante_plus',
  goals: [
    { metric: 'games', target: 20, current: 12 },
    { metric: 'tournaments', target: 2, current: 0 },
  ],
  active: true,
}

// referrals/{referrerId}_{refereeId}
{
  referrer: uid, referee: uid,
  status: 'pending' | 'signed_up' | 'first_action' | 'engaged' | 'farming',
  created_at: Ts,
  activated_at: Ts | null,
  rewards: {
    signup_bonus: { xp: 50, given: false },
    five_games_bonus: { xp: 200, given: false },
    one_tournament_bonus: { xp: 500, given: false },
  },
}

// season_rankings/{seasonId}_{uid}
{
  season: '2026-inverno',
  uid, xp_season, position, badges_earned: [...],
  final_position: 47 | null,    // null se temporada em andamento
}

// challenges/{challengeId}
{
  type: 'club' | 'arena' | 'global' | 'duel',
  name: 'O Clube Mais Ativo',
  scope: 'state' | 'national' | 'club' | 'arena',
  target: { metric: 'xp', value: 10000 },
  start: Ts, end: Ts,
  prize: { xp: 500, trophy: 'community_winner', ... },
  participants: [uid, ...], // clube/arena, ou 2 users
  leaderboard: [{ id, value }],
}
```

---

## Apêndice: telemetria mínima viável

Para validar se cada feature gera o comportamento esperado, sem instrumentar
**tudo** desde o dia 1.

```js
// src/core/telemetry/events.js (novo)
export const TELEMETRY = Object.freeze({
  XP_GAINED: 'xp_gained',
  ACHIEVEMENT_UNLOCKED: 'achievement_unlocked',
  MISSION_COMPLETED: 'mission_completed',
  STREAK_EXTENDED: 'streak_extended',
  REFERRAL_SENT: 'referral_sent',
  REFERRAL_ACTIVATED: 'referral_activated',
  KUDOS_GIVEN: 'kudos_given',
  KUDOS_RECEIVED: 'kudos_received',
  SHARE_CARD_GENERATED: 'share_card_generated',
  REVIEW_SUBMITTED: 'review_submitted',
  TOURNAMENT_CREATED: 'tournament_created',
  CLUB_JOINED: 'club_joined',
  GAME_DAY_CREATED: 'game_day_created',
  LESSON_BOOKED: 'lesson_booked',
  ARENA_BOOKED: 'arena_arena_booked',
  ...
});
```

Cada evento carrega: `{ uid, event, source, surface, value, ts }`. Stream
para Firebase Analytics events (custom). Permite calcular **tudo** do
capítulo 21 sem mudar a aplicação.

---

## Apêndice: lições finais

1. **Não apresse.** A Fase 0 (consolidação) é mais importante que tudo.
   Antes de adicionar feature nova, garanta que `progressionV2.js` está
   bem testado e migrado.

2. **Feature flag SEMPRE.** Tudo atrás de flag, default OFF. Migração
   via `migrateLegacyFlags`. Bump `FLAGS_MIGRATION_VERSION`. Ativação
   gradual (1% → 100%).

3. **Comece pelos universais.** Kudos e Conquistas V2 funcionam pra
   todo mundo. Antes de mexer em skill trees (que requer recálculo de
   stats existentes), garanta que as conquistas estão funcionando.

4. **Teste o anti-cheat junto.** Toda nova fonte de XP precisa de cap e
   detecção. Criar sem cap = farm fácil.

5. **Storytelling importa mais que números.** "Subiu para o Tier
   Aprendiz, agora você é Aprendiz!" é melhor que "Level 4".

6. **Acessibilidade é inegociável.** Tudo deve funcionar sem foto, sem
   bio, sem nivelamento, sem clube, sem arena. O "core" (XP por jogo)
   é o que importa.

7. **Re-collect feedback cedo.** A cada sprint com feature nova,
   perguntar a 5-10 usuários: "Você notou a mudança? Como se sentiu?".

8. **Hall da Fama e Embaixadores são os 2 mecanismos mais poderosos.**
   Nada gera tanta viralidade quanto ver o próprio nome em uma lista
   pública. Invista neles.

9. **Mantenha o core limpo.** O sistema de rating ELO, nivelamento USAP,
   conquistas, level-validated-by-coach — tudo isso é sagrado. Não toque
   na matemática. Adicione em volta.

10. **Lembre do longo prazo.** A PickleRush pode ser o **Strava do
    pickleball** na América Latina. Isso é uma jornada de 5+ anos.
    Cada feature deve ser pensada para o horizonte 2030, não só o sprint
    atual.

---

**FIM.** Pronto pra revisão. Próximo passo: você prioriza 3-5 Fases e
eu oriento a implementação. Nenhuma linha de código foi tocada ainda.
