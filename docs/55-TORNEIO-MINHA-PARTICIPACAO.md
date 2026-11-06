# 55 — Torneio: "Minha participação" e "Acompanhar"

> Flag `tournament_personal_view` (default OFF; o admin liga em **Painel admin →
> Funcionalidades → Torneios → "Torneio — Minha participação e Acompanhar"**).
> Desligada, as duas abas e a faixa "Seu próximo jogo" somem e a página do
> torneio fica como antes.

## O pedido

Num torneio com várias categorias, o atleta tinha de abrir categoria por
categoria para achar os próprios jogos, e não havia um lugar que juntasse
horário, quadra, fase e o que vem depois na chave. Quem acompanha outra pessoa
(a dupla, os alunos, a família) tinha o mesmo problema. Depois do torneio,
também não havia um resumo da participação.

## 1. O que a pessoa vê

Dentro de `/torneios/:id`, ao lado das abas de sempre:

| Aba | Rota | Quem vê |
|---|---|---|
| **Minha participação** | `/torneios/:id/minha-participacao` | só quem está inscrito (a pessoa cuja conta aparece numa inscrição ativa); vem primeiro |
| **Acompanhar** | `/torneios/:id/acompanhar?pessoas=uid1,uid2` | qualquer pessoa que abre o torneio |

- **Linha do tempo** (o mesmo corpo nas duas abas): números (jogos, jogados,
  vitórias, derrotas, por jogar); as inscrições com colocação (quando a
  categoria termina), contagens, **"Ver a chave"** (a `V2BracketTree` com o
  nome da pessoa em negrito, prop `destaque`) e o link para a categoria; **"O
  que vem pela frente"**; e os **jogos por dia e horário** (Hoje/Amanhã/Ontem,
  o ano só quando não é o corrente), cada um com horário, quadra, categoria,
  fase e rodada, os dois lados, placar e Vitória/Derrota. O jogo em quadra
  aparece "ao vivo" e o próximo leva `aria-current`.
- **Jogos sem horário** vêm num bloco próprio, no fim, na ordem da chave (fase,
  rodada, posição) — a organização ainda não marcou o horário.
- **Faixa "Seu próximo jogo"** (`MyNextMatchStrip`) no topo do torneio, em
  todas as abas menos a própria Minha participação, com horário, quadra e
  adversário; tocar leva à aba.
- **Quem não está inscrito** e abre `minha-participacao` pelo link vê o convite
  para se inscrever (`V2EmptyState`), nunca uma lista vazia.
- **Acompanhar**: o seletor é o `PersonPicker` padrão (`multiple`, até 10,
  lista já aberta em ordem alfabética, busca só estreita) alimentado **só com os
  inscritos deste torneio** (`tournamentPeople`), sem a própria pessoa. A
  escolha vai na URL (`?pessoas=`, para mandar o link) e fica lembrada por
  pessoa e torneio no navegador (`viewPreference`, chave
  `v2:view:<uid>:torneio:<id>:acompanhar`) — **zero banco**. Quem estava no
  link e saiu do torneio é avisado ("1 pessoa do link não está mais inscrita
  neste torneio."), não some calado.

## 2. A regra (domínio puro)

`src/modules/tournament/domain/personalTimeline.js` (+ `.test.js`):

- `tournamentPeople(registrations, modalities)` — uma pessoa por CONTA
  (`user_id`) ou por vaga sem conta (`reg:{id}:a|b|m{i}`), em ordem alfabética,
  com as inscrições e categorias dela. Ignora inscrição provisória
  (`is_placeholder`) e cancelada/desistente. Equipes contam cada membro.
- `buildPersonalTimeline({ people, registrations, matches, modalities, tournament })`
  devolve `{ entries, items, days, projections, next, stats }`:
  - `items`: os jogos das inscrições das pessoas, **cancelados fora**, com o
    rótulo da fase ("Fase 2 · Chave" só quando há mais de uma fase), da rodada
    (Final, Semifinal, "Grupo A · rodada 2", disputa de 3º, repescagem, grande
    final), lados, perspectiva, placar e resultado. Ordem: com horário primeiro
    (horário, depois quadra); sem horário por categoria/fase/rodada/posição.
  - `entries`: uma por pessoa × inscrição, com `position` pelo pódio
    (`modalityPlacement`, só de categoria completa).
  - `projections`: na **eliminação simples**, a partir da estrutura da chave
    (`buildKnockoutDiagram`): "Se vencer: Final contra Edu ou Fê.", "Se vencer,
    é campeão.", "Parou em: Semifinal.", disputa de 3º. Em fase que não é chave e
    tem fase seguinte ainda não criada: quando saem os classificados. Dupla
    eliminação mostra só a chave (a projeção da repescagem não é óbvia o
    bastante para afirmar).
- **A colocação e a chave saem das mesmas funções do resto do torneio** (pódio,
  diagrama da chave, rótulos de fase) — nunca uma cópia.

## 3. Dados e permissões

- **Nada novo no banco**: zero coleção, zero campo, zero regra, zero índice.
  As três leituras são as que a página já faz e são públicas por regra
  (`tournament_modalities`, `tournament_registrations`, `tournament_matches`:
  `allow read: if true`) — o mesmo que o quadro, a impressão e o telão
  mostram. Nenhum contato (e-mail, telefone) entra: a inscrição pública não o
  guarda (P0-02).
- Hooks em `src/modules/tournament/hooks/usePersonalTimeline.js`:
  `useTournamentTimelineData(id)` junta as três consultas (as mesmas chaves de
  cache; os jogos se atualizam a cada 20 s) e `useMeInTournament(id)` acha "eu"
  pela conta logada. Id nulo (flag desligada) não consulta nada.
- **Falha não é vazio** (docs/27): `isError` se QUALQUER das três falhar ⇒
  `V2ErrorState` com "Tentar de novo"; "Você não está inscrito" e "sem jogos"
  só com tudo carregado.

## 4. Onde está

| Peça | Arquivo |
|---|---|
| Regra | `src/modules/tournament/domain/personalTimeline.js` |
| Hooks | `src/modules/tournament/hooks/usePersonalTimeline.js` |
| Telas (`V2MyParticipation`, `V2FollowPlayers`, `MyNextMatchStrip`) | `src/v2/components/tournament/TournamentTimeline.jsx` |
| Abas e faixa | `src/v2/pages/V2Tournament.jsx` |
| Chave com destaque | `src/v2/components/tournament/V2BracketTree.jsx` (prop `destaque`) |
| Flag | `src/core/featureFlags.js` + grupo "Torneios" em `featureFlagGroups.js` |
| Ajuda | artigo `minha-participacao-torneio` (com `flags: ['tournament_personal_view']`) e a pista `/torneios/*/*` em `helpCenter.js` |
| Traduções | `src/modules/tournament/i18n/locales/{en,es}.js`, `src/modules/help/i18n/locales/{en,es}.js` |

## 5. O que NÃO mudou (e por quê)

- A aba **Jogos** e a página da categoria seguem iguais: a linha do tempo é
  uma visão a mais, por pessoa, não substitui o quadro.
- Não há aviso por notificação do "próximo jogo": isso pediria escrita do
  servidor e horário confiável em todo torneio. Fica para quando a pessoa
  pedir.
- O vínculo com a Carreira (`/carreira`) já existe pelos torneios daqui; esta
  aba é o "durante e logo depois" dentro do próprio torneio.

## Testes

`personalTimeline.test.js` (pessoas por conta e por vaga, equipes, ordem por
horário e por dia, cancelados fora, resultado do ponto de vista de quem é
acompanhado, próximo jogo, projeções da chave e dos grupos, colocação, bye) e
`TournamentTimeline.runtime.test.jsx` (ordem por horário entre categorias,
"Ver a chave", não inscrito, falha ≠ vazio, faixa do próximo jogo, Acompanhar
só com inscritos e sem a própria pessoa, link com quem saiu).
