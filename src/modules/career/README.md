# career/ — Carreira (flag `athlete_career`)

A linha do tempo do atleta (`/carreira`): em regra só TORNEIOS — os da
plataforma (federados ou não) e os de FORA; dias de jogo só com "Incluir dias
de jogo" (escolha da pessoa, sem medalha). Os de fora a pessoa registra (resultado
declarado, foto, dupla). Documento completo: `docs/54-CARREIRA-DO-ATLETA.md`.

```
career/
├── domain/      # PURO e testado — nada de React/Firebase
│   ├── careerEvent.js  # o documento (normalizeCareerEvent), enums gravados, camadas da ficha,
│   │                   # "É este?" (matchPlatformTournament), selo, modo lista, "repetir",
│   │                   # formatos (com o Americano) e formatHasPartner, faixas de nível
│   │                   # (LEVEL_BRACKETS + as antigas aceitas, LEGACY_LEVEL_BRACKETS)
│   ├── timeline.js     # buildCareerTimeline (5 fontes, cada uma falha sozinha), temporadas,
│   │                   # filtros da URL, troféus de fora, abas (CAREER_TAB), resumo da Minha área
│   ├── draftQueue.js   # a fila do aparelho para quando não há sinal
│   ├── careerDebrief.js # torneio de fora → origem `externo` do balanço (sem importar debrief.js)
│   ├── careerPartner.js # a DUPLA (PR 3): citação, impressão, maioridade, visão, selo,
│   │                    # pendências, voz no balanço, espelho, "com quem já jogou";
│   │                    # PR 6: a dupla sem conta (namedPartners, convite, link do WhatsApp)
│   ├── careerUpcoming.js # PR 4: descoberta, plano, contagem, prazo, ICS, foco sugerido, pendências
│   ├── careerGoals.js  # PR 4: métricas das metas da temporada e de onde cada uma conta
│   ├── careerRank.js   # PR 4: posição no ranking (digitada × oficial), séries e tendência
│   ├── careerHabits.js # PR 5: a ÚNICA porta para a gamificação — ficha completa
│   │                   # (isCompleteCareerRecord, cópia em functions/careerXp.js) e
│   │                   # contagens de hábito; nunca lê o valor da colocação
│   ├── careerPublic.js # PR 7: a vitrine pública — campos que vão (lista fechada), fotos publicáveis,
│   │                   # maioridade, parcerias, contextId do parabéns (cópia em functions/careerPublicPolicy.js)
│   └── seasonRecap.js  # retrospectiva da temporada (zero banco): quando oferecer, parceria do ano
├── services/
│   ├── careerService.js        # career_events + career_rank + Storage carreira/{uid}/ + career_partner (ler) + career_public (ler, PR 7) + callable `career` + "mandar ao professor"
│   └── careerExportService.js  # o bloco `career` da exportação de dados
├── hooks/
│   ├── useCareer.js    # o arquivo LEVE: useCareerEvents, mutações, useCareerSaveWithDraft,
│   │                   # useCareerPartners, useCareerPartnerVoices, useCareerPartnerAction, useCareerModerationQueue,
│   │                   # PR 4: useCareerRanks, useOfficialRanks, useSaveCareerRank, useDeleteCareerRank,
│   │                   # useShareCareerWithCoach, useStudentCareerShares, useFederationAgendaForMe
│   │                   # (o serviço das federações só por import() dentro do queryFn)
│   └── useCareerTimeline.js # useCareerTimeline (torneios, pódios, dias de jogo) — importe DAQUI;
│                       # useCareer.js NÃO o reexporta (seria ciclo de import)
└── i18n/locales/       # en.js, es.js
```

Telas: `src/v2/pages/V2Career.jsx` + `src/v2/components/career/`. A seção da
Minha área é `CareerAreaSection`; o bloco de Meu desempenho é
`CareerPerformanceBlock`; o balanço da ficha abre `CareerDebriefDialog` (lazy);
a retrospectiva é o `MedalCardDialog` com `season`; a aba "Fora da plataforma" da estante é a
`TrophyShelf` (`ABA_FORA`). A dupla (PR 3): `CareerPartnerUi.jsx` (camada 3 da
ficha e os pedidos que chegaram, no topo da linha do tempo), o seletor único
`v2/components/people/PartnerPicker.jsx` e a fila do admin
`v2/components/admin/career/AdminCareerModeration.jsx`. Servidor:
`functions/career.js` (+ `careerPolicy.js`, com paridade; PR 4: a varredura
`careerReminders`). PR 4: abas `CareerUpcomingTab` (`?aba=proximos`) e
`CareerGoalsTab` (`?aba=metas`), `CareerPlanFields` (plano, "Como foi?" e
"Mandar ao meu professor" na ficha), `CareerRankPanel` (linha do tempo),
`CoachStudentCareer` (Centro de Treino → Alunos) e `HomeCareerCard` (card
Carreira do início). PR 5: o XP da ficha completa é do servidor
(`functions/careerXp.js`, gatilhos `careerEventWritten` e
`careerDebriefWritten`, `user_xp_grants` com `kind: 'career'`, módulo de
gamificação `career_xp`) e as conquistas da família `my_career` vêm das
fontes `careerEvents`/`careerGoals` dos fatos da gamificação (docs/54 §4.6a).

## Serviço e hooks: conexão ruim (pente fino, 2026-11)

- **Leitura sempre do servidor** (`getDocsFromServer` em todo `list*`): sem
  persistência, a leitura comum com sinal ruim resolve com o cache vazio e a
  tela afirmaria "sua carreira começa aqui". Sem rede a consulta FALHA
  (docs/27). `careerService.test.js` não oferece `getDocs` de propósito.
- **Rascunho sem sinal** (`useCareerSaveWithDraft`): `saved: false` só quando
  guardou MESMO — navegador que recusa guardar ou fila cheia (`pendingFull`)
  sem resposta do servidor LANÇA. O envio que chega depois do prazo de 8 s sai
  da fila (só se o rascunho guardado ainda for o mesmo). `flush` devolve
  `{ enviados, esperando, recusados }` e `flushing`; o recusado no reenvio fica
  na fila com `refused: true` (não é reenviado, não some calado). O reenvio
  chama `saveCareerEvent(…, { resend: true })`, que relê antes de gravar.
- **Excluir** (`useDeleteCareerEvent`, `networkMode: 'always'`): tira da fila
  antes de qualquer espera, não espera o servidor por rascunho que só existia
  no aparelho, não espera o Storage, e invalida também `['treino','balanco']`.
- **Modo lista** (`useSaveCareerBatch`): offline recusa na hora; sem
  confirmação em 8 s a mutação falha dizendo que o envio ainda pode chegar.
- **"Mandar ao meu professor"**: balanço lido antes, torneio + balanço num
  lote só, invalida também na falha, e o professor é AVISADO quando passa a
  ver (`notifyUsers`, tipo do treino, link `/treino?aba=alunos`); retirar não avisa.
- **Foto**: envio com prazo de 45 s (`CAREER_PHOTO_TIMEOUT_MS`), cancelado ao
  vencer. PNG/WebP sobem sempre recodificados (`compressImage`): só o JPEG
  pode voltar o original, porque só dele o EXIF é tirado.
- `careerKeys.officialRanks`/`fedAgenda` ficam fora do prefixo `['career']`
  (cada salvar invalidava até 12 rankings de federação).
- `useCareerTimeline` devolve `isPaused` (consultas pausadas por falta de conexão).

## Telas (pente fino, etapa 2, 2026-11)

- A ficha confirma descartar/excluir/tirar foto, valida por campo
  (`conferirFicha`) e o "Como foi?" responde "Joguei" ou "Não fui"
  (`status: 'cancelled'`). Detalhe em `docs/54` §4.15.
- Quem AFIRMA "não existe mais" a partir da URL (`?evento=`, `?dupla=`) espera
  `eventsFetching`/`partnersFetching` de `useCareerTimeline`: cache velho não
  decide.
- Com a flag desligada, `/carreira` vira a página de apagar registros e tirar da
  vitrine (`CarreiraDesligada`, em `V2Career.jsx`).
- Confirmação no próprio lugar: `ConfirmarInline` (em `CareerPartnerUi.jsx`);
  em diálogo: o `ConfirmDialog` do projeto. "Cancelar o convite" é um toque só.
- O modo lista guarda as linhas no navegador, por pessoa
  (`v2:view:<uid>:carreira:lista`, `CAREER_LIST_PREF`), até salvar.
- O guia `carreira-registrar` (`help/domain/guias.js`) segue a ordem da tela e,
  depois que um diálogo abre, tenta primeiro as âncoras de dentro dele; salvar
  é o último passo, porque "Completar a ficha" ainda não tem `data-dica`
  (`guias.test.js` trava a ordem e os alvos; `docs/54` §4.16). Mudou a ordem das camadas da ficha ou um
  `data-dica="carreira-…"`? Mude o guia junto.

## O que não pode regredir

1. **Declarado nunca pontua**: nenhum motor de ranking, rating ou federação
   lê `career_*`; o XP conta só hábitos (ficha completa, registros, balanços,
   meta de processo) por `careerHabits.js`, e a colocação declarada não muda
   conquista, XP nem temporada (`src/core/guards/carreiraNaoPontua.test.js`).
2. **Só o dono** escreve `career_events` (o id começa pelo uid) e, fora o
   professor do item 13, só ele lê; a flag
   vale na regra (`careerOn()`) só para criar e editar — ler e apagar seguem.
3. **Fonte que falhou é dita**, nunca vira vazio (`timeline.faltou`).
4. Foto só por `prepareUpload` (sem EXIF), com descrição, até 6.
5. Coleção `career_*` nova entra na exclusão de conta **e** na exportação.
6. Os valores de enum (formato, gênero, colocação, tipo de foto) e os
   `?aba=`/`?origem=` são gravados/contrato — nunca renomeie.
7. Zero índice composto: só `where('uid', '==', uid)`.
8. O balanço do torneio é o do jogo (`DebriefDialog`, origem `externo`): nada
   entra nos treinos sem "Adicionar", e o torneio de fora nunca vira pendência.
9. Em Meu desempenho o declarado só soma com "Incluir declarados"
   (`?declarados=1`), dizendo de onde vem cada parte; a retrospectiva não sai
   com fonte faltando.
10. `career_partner` só o servidor grava; só a dupla citada confirma; data ou
    resultado mudou ⇒ nova confirmação (o nome não); menor de 18 nunca
    convida nem é convidado; a visão nunca sai do par; tudo auditado. A régua
    tem cópia em `functions/careerPolicy.js` com paridade. A denúncia mora
    em `career_partner_reports` (fora do pedido: o denunciado não a lê) e
    editar a visão denunciada é recusado.
11. O seletor de dupla é UM (`PartnerPicker`, o da inscrição de torneio).
12. Plano, metas e posição anotada nunca pontuam; Oficial e Declarado
    nunca dividem a linha do gráfico; "Pôr no meu plano" nunca grava sozinho.
13. O professor só lê o que foi MANDADO, com vínculo ATIVO (`coachSees`) — e
    o mandado é o documento INTEIRO do torneio (anotações, link, duplas e o
    link das fotos): nenhum texto promete "só você vê" num torneio com
    `shared_coach_id`.
14. Os avisos D-3/D+1 são do servidor, com id determinístico, e a categoria
    Carreira existe nas duas cópias das preferências.
15. **Dupla sem conta (PR 6)**: "Convidar pelo WhatsApp" na ficha
    (`NamedPartnerInvites`, em `CareerPartnerUi.jsx`) e o link
    `/carreira/convite/:token` (`V2CareerInvite`; sem login, o `App.jsx`
    mostra a explicação). `career_partner_invites/{sha256(token)}` só o
    servidor grava (`invite_link`/`invite_cancel`/`invite_peek`/`invite_accept`);
    o token nunca é guardado e não há telefone; uso único, 14 dias; o aceite
    só preenche a dupla VAZIA (`namedPartners`) e nunca troca uma conta; o
    dono não aceita o próprio; menor não convida nem é convidado; usado,
    vencido, cancelado e inexistente respondem igual. `INVITE_TTL_DAYS`,
    `INVITE_TOKEN_PATTERN`, `partnerNameKey` e `namedPartners` têm cópia em
    `functions/careerPolicy.js` com paridade. Hook `useCareerPartnerInvites`.
16. **Vitrine pública (PR 7)**: `career_public` (lê quem tem conta) e o Storage `carreira-publica/`
    só o servidor grava (`functions/careerPublic.js`); só o que o dono
    escolheu, lista fechada de campos, selo calculado (Oficial sem a colocação
    declarada), nome da dupla só com o "sim" dela (`public_consent`, com a impressão `public_fp` do que ela viu), menor
    nunca publica (mesma resposta), foto só da própria pasta e sem metadados;
    tirar ou apagar remove item e fotos. Revisão de privacidade em
    `docs/20-SEGURANCA-E-PRIVACIDADE/21-CARREIRA-VITRINE.md`.
