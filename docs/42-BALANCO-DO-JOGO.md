# 42 — Balanço do jogo (flag `game_debrief`)

> *"Ao final de um dia de jogo, de um torneio ou de jogo avulso, a plataforma
> poderia perguntar para o usuário (que habilitar essa funcionalidade para si,
> em suas configurações pessoais) como ele classifica o seu desempenho, quais
> seus pontos fortes e fracos, se ele entende que houve evolução etc. E, de
> acordo com as respostas, a plataforma poderia sugerir algum plano de
> desenvolvimento, treino ou drills para ser realizado naquela semana, que o
> atleta poderia ou não adicionar em seus dias de treino."* — Flavio,
> 2026-10-10

Ver também: `docs/40-CENTRO-DE-TREINO.md` (o Centro de Treino, sobre o qual
isto roda) e `docs/38-GAMIFICACAO-V2.md` (as missões).

## 1. As duas chaves

| Chave | Quem liga | O que faz |
|---|---|---|
| `game_debrief` (feature flag, default OFF) | admin da plataforma | a funcionalidade existe. **Só vale com `training_center` ligada** (`useGameDebriefAvailable`) |
| `training_meta/{uid}.debrief = { enabled, since }` | cada pessoa | ela quer o balanço. `since` é o dia em que ligou: **só jogos desse dia em diante pedem balanço** (ligar não cobra o passado) |

Desligada a flag, nada aparece: nem aba, nem cartão no início, nem
configuração, nem missão, nem artigo de ajuda. Desligado pela pessoa, a aba
Balanço só explica e oferece "Ligar para mim".

Onde se liga: **Configurações → Balanço do jogo** (`#balanco-do-jogo`) ou a
própria aba **Treino → Balanço** (`/treino?aba=balanco`).

## 2. O fluxo

1. **O jogo aparece.** `listRecentPlay(uid)` (`recentPlayService.js`) junta,
   dos últimos 7 dias, três fontes — cada uma falha sozinha
   (`Promise.allSettled`, `incompleto` diz qual ficou de fora; só lança se
   TODAS falharem):
   - **dia de jogo** em que a pessoa JOGOU (tem jogo com ela; inscrito que não
     jogou não conta) — `gameDayEvent`;
   - **torneio** em que está inscrita — `tournamentEvent`;
   - **reserva** de quadra confirmada ou concluída (falta não) — `bookingEvents`.

   O jogo só pede balanço **depois de terminar** (`ends_at_ms`).
   `pendingDebriefs` tira o que já foi respondido ou dispensado.
2. **Onde a pessoa vê**: a aba Balanço ("Jogos esperando balanço"), o cartão
   **"Como foi o seu jogo?"** no início (clássico e personalizado) e a faixa
   "Precisa de você" da Minha área. "Agora não" dispensa (grava `dispensado`).
   "Balanço de outro jogo" serve ao jogo fora da plataforma (`avulso`).
3. **As perguntas** (`DebriefDialog`, menos de um minuto): como foi (1–5), o
   que funcionou e o que faltou (até 3 cada, em palavras de quadra —
   `GAME_ASPECTS`; um aspecto não pode estar nos dois), se sentiu evolução,
   corpo e cabeça (opcionais) e uma nota.
4. **A sugestão** (`suggestWeek`, pura): até **2 focos** (o que faltou agora,
   pesando o que vem faltando nos balanços anteriores) + **1 ponto forte para
   manter**, com drills da biblioteca **que a pessoa enxerga**, no nível dela
   (régua 2.0–8.0), nos dias da rotina dela. Corpo ou cabeça em 1–2, ou nota
   muito baixa com piora ⇒ **semana leve** (menos dias, 70% dos minutos,
   intensidade ≤ 2). Mesmas respostas, mesma biblioteca e mesmo dia ⇒ mesma
   sugestão.
5. **A pessoa decide.** Desmarca os dias que não quer e toca **"Adicionar aos
   meus treinos"** (`debriefPlanChange`): com um plano ATIVO em andamento os
   dias entram nele; sem plano, nasce um plano curto "Semana do balanço"
   (`source: 'balanco'`). Ou não adiciona nada — a sugestão fica guardada no
   balanço.
6. **Tendências**: depois de alguns balanços, a aba mostra o que mais vem
   faltando e funcionando e a média das notas (`debriefTrends`).

## 3. Dados

### `training_debriefs/{uid}_{tipo}_{ref}` (NOVO)

`uid`, `source { type, ref_id, title, date, games, wins }`, `status`
(`respondido|dispensado`), `rating` (1–5), `strengths[]`, `weaknesses[]`
(≤ 3, ids de `GAME_ASPECTS` — **nunca renomeie um id**), `evolution`
(`melhorou|igual|piorou|nao_sei`), `body`, `mind` (1–5 ou nulo), `note`
(≤ 500), `suggestion { focus[], item_ids[], light }`, `applied { plan_id,
mode, dates[], at }`, `created_at`, `updated_at`.

- O id é **determinístico**: um balanço por jogo; refazer sobrescreve.
- **Só o dono** lê e escreve; o admin lê e apaga. A regra confere o prefixo do
  id (`uid_…`), o dono e a forma (`trainingDebriefShapeOk`). Provado em
  `tests/rules/training.rules.test.js`.
- Consulta por `uid ==` (uma igualdade, a que a regra confere): **zero índice**.
- Entra na **exportação** ("Baixar meus dados") e na **exclusão de conta**
  (`functions/accountDeletion.js`) — o guarda `exclusaoCobreColecoes.test.js`
  reprova se sair.

### `training_meta/{uid}.debrief` (campo novo, opcional)

`{ enabled: boolean, since: 'AAAA-MM-DD'|null }`. Ausente = desligado.

## 4. Gamificação

Duas missões **opcionais** (`optIn: true`, módulo `game_debrief`): *"Faça o
balanço de um jogo"* (semanal) e *"Faça 3 balanços de jogo"* (mensal), métrica
`debrief_done` (fato `debriefs` em `activityFacts`, só os `respondido`). Só
são sorteadas para quem LIGOU o balanço — a página da gamificação espera a
preferência carregar antes de gerar as missões, para não deixar sem a missão
quem acabou de ligar. Nenhuma conquista nova (conquista não tem como ficar
atrás de uma preferência pessoal).

## 5. Ajuda e dicas

Artigo `balanco-do-jogo` (parte Atleta) e guia `treino-balanco`, ambos com
`flagsTodas: ['training_center', 'game_debrief']`. Âncoras: `treino-aba-balanco`,
`treino-balanco-ligar`, `treino-balanco-pendentes`, `treino-balanco-avulso`,
`treino-balanco-fortes`, `treino-balanco-fracos`, `treino-balanco-nota`,
`treino-balanco-sugestao`, `inicio-balanco`, `config-balanco`.

## 6. Código

| Camada | Arquivo |
|---|---|
| Domínio | `training/domain/debrief.js` (perguntas, pendências, focos, semana, plano, tendências) · `debriefEvents.js` (dia de jogo/torneio/reserva → evento) |
| Serviço | `training/services/debriefService.js` · `recentPlayService.js` · `metaService.js` (`debrief`) |
| Hooks | `training/hooks/useDebriefs.js` (`useGameDebriefAvailable`, `useDebriefSettings`, `usePendingDebriefs`, `useDebriefActions`) |
| Telas | `v2/components/training/tabs/DebriefTab.jsx` · `training/debrief/DebriefDialog.jsx` · `HomeDebriefPrompt.jsx` (lazy) · `DebriefSettingsCard.jsx` |

## 7. O que não pode regredir

1. **Opt-in de verdade**: sem `debrief.enabled` nada pergunta, e só jogos desde
   `since` pedem balanço.
2. **Falha não é vazio**: a lista de jogos só diz "nenhum" com a consulta em
   `isSuccess`; fonte que falhou é dita (`incompleto`); a Minha área não conta
   falha como zero; o cartão do início, cortesia, some na falha.
3. **A sugestão é sugestão**: nada entra nos treinos sem o toque em "Adicionar".
4. **Privado**: só a pessoa (e o admin) lê o balanço — nada vai para professor,
   ranking ou perfil público.
5. **Coleção na exclusão e na exportação** (guarda).
6. **Âncoras são contrato** (guarda `dicas.test.js`).

## 8. Fica para depois

- Enviar o balanço ao professor (com a permissão da pessoa) e o professor
  sugerir a semana.
- Usar o placar real do jogo (pontos perdidos por golpe) quando a plataforma
  passar a registrá-lo.
- Push lembrando do balanço (hoje só aparece ao abrir o app).
