# 54 — Carreira (carreira do atleta)

> Estado: **PR 1 — núcleo, foto e passado** + **PR 2 — balanço, treino e
> retrospectiva** + **PR 3 — a dupla confirma** + **PR 4 — próximos, metas,
> ranking e professor** (2026-11-04). Flag
> `athlete_career` (`FEATURE_FLAG.ATHLETE_CAREER`, padrão **desligada**, só o
> admin liga; grupo "Carreira do atleta" no painel). O plano completo, com os
> PRs seguintes, está fora do repositório
> (`/mnt/project-files/carreira/plano-gestao-de-carreira.md`). Este documento
> descreve **só o que existe no código**.

## 1. O que é

`/carreira` é a linha do tempo da pessoa: os torneios da plataforma
(federados ou não) aparecem sozinhos, e ela **registra os torneios que jogou fora do
PickleRush** (o passado e os que vai jogar). O resultado registrado é
**declarado**: fica na carreira e na estante de troféus, mas **nunca** entra
em ranking, rating nem XP (guarda `src/core/guards/carreiraNaoPontua.test.js`).

| Peça | Onde |
|---|---|
| Domínio (puro, com teste) | `src/modules/career/domain/careerEvent.js`, `timeline.js`, `draftQueue.js`, `careerDebrief.js` (a origem do balanço), `seasonRecap.js` (a retrospectiva), `careerPartner.js` (a dupla: citação, impressão, maioridade, visão, selo, pendências), `careerUpcoming.js` (PR 4: descoberta, plano, contagem, prazo, ICS, foco sugerido, pendências do planejado), `careerGoals.js` (as métricas das metas e de onde contam), `careerRank.js` (a posição no ranking) |
| Servidor (PR 3/4) | `functions/career.js` (callable `career` + gatilho `careerEventWritten` + varredura diária `careerReminders`, PR 4), régua copiada em `functions/careerPolicy.js` (paridade `careerPolicy.parity.test.js`) |
| Serviço (I/O) | `src/modules/career/services/careerService.js`, `careerExportService.js` |
| Hooks (React Query) | `src/modules/career/hooks/useCareer.js` |
| Página | `src/v2/pages/V2Career.jsx` (lazy, em `<Isolada nome="carreira">`, `V2Page`) |
| Componentes | `src/v2/components/career/` |
| Catálogos en/es | `src/modules/career/i18n/locales/` |

## 2. O dado

### 2.1 `career_events/{uid}_{sufixo}`

Um documento por torneio de fora. Id = `newCareerEventId(uid)` (o uid é o
prefixo — a regra confere). Tudo passa por `normalizeCareerEvent` antes de
gravar (limites em `CAREER_LIMITS`).

| Campo | Tipo | Observação |
|---|---|---|
| `uid` | string | dono; imutável na prática (a regra exige o próprio) |
| `name` | string ≤ 120 | obrigatório |
| `organizer`, `city`, `state` | string | `state` só UF válida |
| `start_date`, `end_date` | `AAAA-MM-DD` | `date_precision`: `day` ou `year` (modo lista). `normalizeCareerEvent` recusa data que não existe (31/02) e ano fora de 1990 … ano atual + 5; `end_date` inválido, com ano fora da faixa ou antes do início é descartado (sem teto de duração) |
| `status` | `played` / `planned` / `cancelled` | derivado da data (`deriveCareerStatus`): futura ⇒ planejado; registro NOVO com a data de hoje ⇒ jogado. O que já era **planejado segue planejado até o último dia** (`end_date`, ou o início) — no dia do torneio a tela diz "É hoje", e só no dia seguinte ele vira jogado (a mesma régua do aviso D+1 do servidor); com a colocação já dita vale o início (quem lança o resultado no dia não fica preso em planejado). O gravado é o do dia em que se salvou; a LEITURA recalcula (`withDerivedStatus` em `listCareerEvents` e na ficha). `cancelled` ("não fui") nunca é recalculado |
| `entries[]` (≤ 6) | objeto | `format` (`singles`/`doubles`/`teams`/`americano`), `gender` (`male`/`female`/`mixed`/`open`), `age`, `level_bracket` (ver abaixo), `level_label` (com `other`), `placement` (`champion`/`runner_up`/`third`/`semis`/`quarters`/`round_of_16`/`groups`/`other`), `placement_n`, `points_declared`, `partner { name, uid }` — só nos formatos com dupla FIXA (`formatHasPartner`: duplas e equipe; simples e americano não têm, porque no americano a dupla troca a cada jogo) |
| `federated`, `federation_id`, `federation_name`, `federation_acronym`, `stage_tier` | | federação do diretório (com a flag `federations`) ou texto livre |
| `link` | `https://…` ≤ 300 | guardado, nunca aberto pela plataforma |
| `photos[]` (≤ 6) | `{ path, url, kind, alt }` | `kind`: `medal`/`podium`/`draw`/`other`; `alt` é a descrição |
| `notes` | ≤ 2000 | só o dono lê |
| `platform_tournament_id` | string \| null | gravado quando a pessoa responde "É este" (ver §4.3) |

**Faixa de nível (`level_bracket`).** É a faixa DECLARADA (como o torneio de
fora chamou a categoria) e nunca alimenta a régua 2.0–8.0. O seletor oferece,
nesta ordem (`LEVEL_BRACKETS`, texto em `LEVEL_BRACKET_LABEL`, lista do Flavio
de 2026-11-06): `2.000-2.999` (Entre 2,000 e 2,999), `3.000-3.499`,
`3.500-3.999`, `3.000-3.999` (a categoria inteira, que convive com as duas
metades), `4.000-4.499`, `4.500+` (Superior a 4,500), `beginner`
(Iniciante), `intermediate`, `advanced`, `pro`, `open` (OPEN) e `other`
(Outra, com `level_label` livre); "— Sem faixa —" grava `null`. A lista da
primeira versão (`2.5`, `3.0`, `3.5`, `4.0`, `4.5`, `5.0+`, `A`, `B`, `C`,
`D` — `LEGACY_LEVEL_BRACKETS`) saiu do seletor, mas **nada foi migrado**: o
registro antigo segue aceito ao salvar de novo, a ficha mostra o valor dele
como opção escolhida e `levelBracketText` o exibe como foi gravado.
| `created_at_ms`, `updated_at_ms` | número | |

**Zero índice composto**: a única consulta é `where('uid', '==', uid)`, com a
ordenação em memória. Os valores de enum (formato, gênero, colocação, tipo de
foto) são **gravados** — nunca renomeie.

### 2.2 Storage `carreira/{uid}/{arquivo}`

Só o dono lê, lista e apaga; cria só o dono, arquivo novo (`resource == null`),
`image/(webp|jpeg|png)` e < 3 MB. O envio passa por `prepareUpload`
(`{ imageMb: 3, videoEnabled: false }`), que reduz e recodifica a imagem — o
que descarta EXIF/GPS (`docs/20-SEGURANCA-E-PRIVACIDADE/08` item 5). Até 6
fotos por torneio; cada foto tem descrição (texto alternativo).

⚠️ A regra do Storage **não lê o banco**, então a flag `athlete_career` não
vale ali, e o teto de 6 fotos é do cliente — o mesmo limite do `treino/`. Com
a flag desligada uma conta ainda consegue subir imagens < 3 MB na PRÓPRIA
pasta (ninguém mais as lê; a exclusão de conta as apaga). A ficha apaga a
foto enviada quando a gravação do documento falha (sem foto órfã).

### 2.3 `dupr_links.rating_points`

Série do rating DUPR (`{ ms, singles, doubles }`, no máximo 120 pontos) que o
webhook do DUPR acrescenta **só quando o rating muda**
(`proximosPontosDupr`, `functions/dupr.js`). É a base do gráfico de evolução
de um PR futuro; neste PR nada a mostra. Ver `docs/51-DUPR.md`.

### 2.4 `career_partner/{eventoId}__{uidDaDupla}` (PR 3)

O pedido para a DUPLA confirmar um torneio de fora. **Só o servidor grava**
(`functions/career.js`); o dono e a dupla citada leem o próprio lado.

| Campo | O quê |
|---|---|
| `owner_uid`, `owner_name` | quem registrou o torneio |
| `partner_uid`, `partner_name` | a dupla citada (a conta escolhida da lista) |
| `event_id`, `entry_indexes[]` | o registro e as categorias de DUPLA em que ela aparece (simples não conta) |
| `summary` | nome, datas, cidade/UF e as categorias citadas (sem anotações nem foto) — o que a dupla lê sem abrir o registro |
| `status` | `invited` · `confirmed` · `declined` · `reconfirm` (gravados; nunca renomeie) |
| `fingerprint` | a impressão do que se confirma: datas, precisão e, de cada categoria citada, formato, gênero, idade, faixa e colocação — **o nome NÃO entra**, nem a POSIÇÃO da categoria na ficha (apagar ou reordenar outra categoria não pede nova confirmação) (`careerFingerprint`) |
| `feedback` | a visão da dupla: `strengths[]`/`improve[]` (até 3, ids de `GAME_ASPECTS`), `text_strength`/`text_improve`/`text_drill` (até 280) |
| `owner_decision` | `pending` · `use` ("Usar no meu treino") · `keep` ("Guardar") |
| `partner_event_id` | o registro espelhado da dupla ("Pôr na minha carreira também"), conferido pelo gatilho |

A **denúncia não mora no pedido** (que as duas pontas leem): fica em
`career_partner_reports/{pedido}__{owner|partner}` — `doc_id`, `event_id`,
`owner_uid`, `partner_uid`, `reporter_uid`, `role`, `reason` (`offensive` ·
`false_claim` · `personal_data` · `other`), `note`, `feedback_edited_at_ms`
(a versão da visão denunciada), `open`, `created_at_ms` e `moderation`
(`{ decision, reason, at_ms }`; o uid do admin vai só para a auditoria). Só o
servidor grava; lê só quem denunciou. Uma denúncia por lado: aberta, ou já
decidida sobre a mesma versão da visão, não abre outra. Com denúncia aberta a
dupla não EDITA a visão (só retira). "Retirar o pedido" (`remove_link`) apaga
o pedido mas a denúncia decidida fica — é ela que recusa pedir de novo.

`career_events` ganhou dois campos opcionais: `partner_uids[]` (as contas
citadas — é por ele que a exclusão de conta acha os registros dos outros) e
`linked_event` (`{ uid, id }` do registro de quem convidou, no espelho).
Zero índice composto (consultas de uma igualdade).

### 2.4a `career_partner_invites/{sha256(token)}` (PR 6 — dupla sem conta)

O convite pelo WhatsApp para a dupla digitada **só com o nome**. **Só o
servidor grava** (`functions/career.js`); lê só quem convidou (`owner_uid ==`).
O **token nunca é guardado**: o id do documento é o SHA-256 dele, e o token
(24 bytes aleatórios, base64url, 32 caracteres) só existe na resposta da ação
e no link. **Nenhum telefone**: o WhatsApp abre no aparelho do dono
(`https://wa.me/?text=…`, sem número) e ele escolhe o contato.

| Campo | O quê |
|---|---|
| `owner_uid`, `owner_name` | quem convidou |
| `event_id`, `event_name` | o registro |
| `name_key`, `partner_name` | o nome digitado (`partnerNameKey`: sem caixa, acento nem espaço repetido) |
| `created_at_ms`, `expires_at_ms` | validade de **14 dias** (`INVITE_TTL_DAYS`) |

Um convite por (registro, nome): gerar de novo apaga o anterior. **Uso
único**: aceito ou cancelado, o documento é apagado (na mesma transação do
aceite). Registro apagado leva os convites (gatilho). O pedido de
confirmação aberto pelo aceite (`career_partner`) leva `via_link: true`.

### 2.5 Os campos do planejado em `career_events` (PR 4)

Todos opcionais, gravados por `normalizeCareerEvent`; ausentes, nada muda.

| Campo | O quê |
|---|---|
| `registration_deadline` | `AAAA-MM-DD`, até a data de início — o prazo de inscrição (aviso D-3) |
| `registered` | `true` = "Já me inscrevi" (o aviso do prazo não sai) |
| `priority` | `main` · `important` · `casual` (Principal · Importante · Só para jogar; gravados) |
| `aim` | ≤ 120, a meta do torneio ("chegar às quartas") |
| `focus_aspect` | id de `GAME_ASPECTS` — o foco do treino até lá |
| `if_then` | ≤ 200, o plano "se… então…" |
| `focus_result` | `yes` · `partly` · `no` ("O foco funcionou?", só com `focus_aspect`; gravados) |
| `shared_coach_id` | o professor a quem a pessoa MANDOU o torneio (§4.12) |
| `origin_ref` | `fed:…` ou `tor:…` — de onde veio pelo "Pôr no meu plano" (a descoberta não oferece de novo) |

`planned_passed` não é gravado: a leitura marca o planejado cujo ÚLTIMO dia
passou (`withDerivedStatus`), e a ficha pergunta "Como foi?".

**O plano que passou sem resposta não é torneio jogado.** Enquanto nenhuma
colocação foi dita (`awaitsResult`), ele é pendência ("Como foi?") e fica
FORA de toda contagem: temporada, metas, retrospectiva, Minha área, Meu
desempenho, "N de ~M registrados", "repetir" e "com quem você já jogou". A
régua única de "torneio de fora jogado" é `isOutsidePlayed` (jogado, não é o
plano de um torneio daqui e não espera resposta) — os resumos não filtram
`status === 'played'` à mão. Na linha do tempo o item continua à vista, com
`pending: true` e o selo "Como foi?".

### 2.6 `career_rank/{uid}_{sufixo}` (PR 4)

A posição DIGITADA num ranking de fora (`normalizeCareerRank`):
`uid`, `federation_id` (opcional, do diretório), `federation_name`,
`ranking_label` (um dos dois é obrigatório), `date` (até hoje), `position`
(≥ 1), `points_total` (opcional), `created_at_ms`, `updated_at_ms`. Só o dono
lê e escreve, a flag vale na criação e na edição, zero índice
(`where('uid', '==', uid)`). A posição OFICIAL não é gravada: sai do
`federation_rankings` que o servidor já grava (`officialRankPoints`).

### 2.7 Metas da temporada em `player_goals` (PR 4)

A meta da aba Metas é a mesma coleção das metas da gamificação, com `kind`
(`outcome` · `process`), `title`, `since`, `due_date`, `status` (`active` ·
`done` · `dropped`), `if_then`, `aspect_id` e, conforme o tipo, `metric` +
`target` ou `progress_manual` (0–100). Valores gravados — nunca renomeie.
Meta SEM `kind` é a antiga e segue idêntica (o `GoalsCard` da gamificação
mostra só essas; a da temporada mora na carreira). As métricas novas
(`career_events_played`, `career_podiums`, `federated_events`,
`dupr_rating`) contam DATAS dentro da janela `since → due_date`
(`goalProgress`); os valores saem de `careerGoalValues`, nunca do motor de XP.
`player_goals` é só do dono, e desde 2026-11-11 o dono **não muda no update**
(`nd().uid == od().uid`): antes dava para passar a meta para a conta de outra
pessoa. A lista devolve o id do DOCUMENTO (`listGoals`), que é por onde a tela
edita e apaga. Prova em `tests/rules/career.rules.test.js`.

### 2.8 `career_public/{uid}_{evento}` — a vitrine pública (PR 7)

O id é o do registro (`career_events/{uid}_{sufixo}`). **Só o servidor
grava** (`functions/careerPublic.js`, régua em `careerPublicPolicy.js` com
paridade contra `src/modules/career/domain/careerPublic.js`); **quem tem conta
lê** (sem login, não), consultando por `uid ==`; com o perfil oculto pela
moderação, só o dono e o admin (§3). Campos: `uid`, `event_id`, `seal` (`official` · `confirmed` ·
`declared`, recalculado pelo servidor), os do torneio na lista fechada
`SHOWCASE_EVENT_FIELDS` (nome, datas e precisão, cidade/UF, federado, sigla e
nome da federação, etapa), `entries[]` na lista fechada
`SHOWCASE_ENTRY_FIELDS` (formato, gênero, idade, faixa de nível, colocação) +
`partner: { uid, name, photo_url }` **só com o "sim" da dupla** (senão
`with_partner: true`), `photos[] { path, url, kind, alt }`,
`published_at_ms`, `updated_at_ms`. Com selo Oficial a colocação **não** vai
(o selo confere só que a pessoa jogou; a colocação oficial é a do pódio, na
estante). Nunca vão: anotações, link, custo, plano, metas, balanço, visão da
dupla, equipe. Limites (`SHOWCASE_LIMITS`): 20 torneios, 6 fotos na vitrine
toda, 5 parcerias no perfil.

- **Storage `carreira-publica/{uid}/{evento}__{arquivo}`**: a cópia pública da
  foto, feita pelo servidor a partir de `carreira/{uid}/` (caminho de outra
  pasta ou com `..` é recusado), sem metadados (JPEG limpo; PNG/WebP com bloco
  de metadado recusado). `get` de quem tem conta (`isAuthed()`), sem listagem,
  escrita só do servidor.
- **Consentimento da dupla** em `career_partner`: `public_ok_partner`
  (true/false), `public_ok_at_ms` e `public_asked_at_ms` (o aviso "quer
  mostrar o torneio com você" sai uma vez só). Só a ação `public_consent` da
  PRÓPRIA dupla, maior de 18, com o pedido confirmado.

Revisão de privacidade: `docs/20-SEGURANCA-E-PRIVACIDADE/21-CARREIRA-VITRINE.md`.

## 3. Quem pode o quê

```
function careerW(id) {
  return isOwner(nd().uid) && id.matches(me() + '_.+') && id.size() < 100 && careerOn();
}
match /career_events/{id} {
  allow read: if isOwner(od().uid) || coachSees();
  allow delete: if isOwner(od().uid);
  allow create, update: if careerW(id) && coachOk();
  // deixar de mostrar ao professor vale mesmo com a flag desligada
  allow update: if isOwner(od().uid) && chg().hasOnly(['shared_coach_id', 'updated_at_ms'])
    && ng('shared_coach_id', null) == null;
}
match /career_rank/{id} {
  allow read, delete: if isOwner(od().uid);
  allow create, update: if careerW(id);
}
match /career_partner/{id} {
  allow read: if isOwner(od().owner_uid) || isOwner(od().partner_uid);
}
match /career_partner_reports/{id} {
  allow read: if isOwner(od().reporter_uid);
}
match /career_partner_invites/{id} {
  allow read: if isOwner(od().owner_uid);
}
match /career_public/{id} {          // PR 7: a vitrine; escrita: só o servidor
  allow read: if isOwner(od().uid) || (isAuthed()
    && !(exc('athlete_profiles', od().uid) && gdc('athlete_profiles', od().uid).get('hidden', false) == true)) || adm();
}
// storage.rules
match /carreira-publica/{uid}/{fileName} { allow get: if isAuthed(); }
```

- **Só o dono** lê e escreve. Nem o admin lê pelo cliente. A exceção (PR 4)
  é o **professor a quem a pessoa MANDOU** o torneio: `coachSees()` (o
  desenho do diário de treino) deixa ler o registro com `shared_coach_id ==`
  ele enquanto o vínculo `coach_students` estiver ATIVO, e o balanço do
  torneio vai junto (`training_debriefs` também tem `coachSees`/`coachOk`).
  Ao gravar, `coachOk()` só aceita mandar a quem é professor ativo da pessoa
  (manter o mesmo vale sempre). Vínculo encerrado ⇒ o acesso fecha sozinho.
  `training_sessions` passou a ler pelo atalho `isOwner` (mesma regra).
- `careerOn()` lê `platform_settings/global.feature_flags.athlete_career`:
  com a flag desligada, criar e editar são recusados; **ler e apagar
  continuam valendo** (a pessoa nunca fica presa ao próprio dado). A única
  edição que passa com a flag desligada é o segundo `allow update`: tirar o
  `shared_coach_id` (a leitura do professor não depende da flag, então
  desfazê-la também não pode depender).
- **O id tem teto** (`id.size() < 100`, em `career_events` e `career_rank`):
  o servidor monta o id dos avisos com ele (`carreira_prazo_{id}_{data}`), e
  um id gigante gravado pelo SDK derrubava a varredura dos lembretes de todo
  mundo. Nenhum caminho do código gera id perto disso.
- **`career_public`**: quem tem conta lê, **menos quando o perfil está oculto
  pela moderação** (`athlete_profiles/{uid}.hidden == true`) — aí só o dono e
  o admin. Quem não tem perfil não é barrado. Como a regra olha o perfil de
  `od().uid`, a consulta tem de fixar `uid ==` (é o que `listCareerPublic`
  faz); listar a coleção sem filtro é recusado. Conta suspensa **não** fecha a
  vitrine pela regra (custaria outra leitura em `users`).
- `career_partner` **ninguém grava pelo cliente** (nem o dono, nem a dupla,
  nem o admin): tudo passa pela função `career`. Terceiro não lê — a visão
  da dupla fica entre os dois. A fila de moderação o admin lê pelo servidor
  (ação `queue`), sem uid.
- `career_partner_invites` (PR 6) também **ninguém grava pelo cliente**: nem
  criar, nem estender a validade, nem cancelar, nem aceitar — e quem tem o
  link não lê o documento nem preenche a dupla do registro alheio (a regra de
  `career_events` segue só do dono; quem preenche é o servidor).
- Prova no emulador: `tests/rules/career.rules.test.js` (dono, dupla citada,
  terceiro, menor — nenhuma conta admin) e os casos de `carreira/` em
  `tests/rules/storage.rules.test.js`.

## 4. A tela

### 4.1 Abas (`?aba=`)

`linha-do-tempo` (padrão), `proximos`, `metas` (PR 4) e `conquistas`
(`CAREER_TAB`; valores são contrato de link). Não há aba vazia
"em breve". Outros parâmetros: `?evento=<id>` abre a ficha, `?registrar=1`
abre o registro rápido, `?lista=1` o modo lista. Com a flag desligada,
`/carreira` redireciona para `/perfil`. O título vem do `V2Layout`
(`PAGE_TITLES`) e o item "Carreira" fica dentro do hub do perfil (não
há hub novo na barra lateral).

### 4.2 Linha do tempo (`CareerTimeline`, `buildCareerTimeline`)

**Em regra só TORNEIOS** (da plataforma ou de fora, federados ou não). Dia
de jogo não é torneio: só entra quando a pessoa liga **"Incluir dias de
jogo"** (escolha por pessoa no navegador, `v2:view:<uid>:carreira:linha:dias-de-jogo`,
zero banco), e mesmo assim sem medalha, sem pódio e fora da contagem de
pódios do resumo (pedido do dono, 2026-11-05). Desligado, a consulta dos
dias de jogo nem sai.

Cinco fontes, cada uma falha sozinha: os torneios de fora (`career_events`),
os torneios da plataforma em que a pessoa jogou (`useMyTournaments`, mesma
chave do início), os pódios (`useTrophies`), os dias de jogo publicados
(`usePublishedGameDayGames`, só com "Incluir dias de jogo") e os pontos lançados pelas federações
(`federation_points` por `uid`, leitura pública). Fonte que falhou é **dita**
("Não deu para carregar …", com Tentar de novo só nelas) e o vazio "Sua
carreira começa aqui" só aparece quando nada falhou (`docs/27`). Só a aba
aberta consulta: as cinco leituras levam `enabled` (por isso
`useMyTournaments` aceita `{ enabled }`, padrão `true`).

- Filtros na URL (`podios=1`, `federados=1`, `origem=fora|plataforma`).
- "O que vem" (planejados), a divisória "Hoje" e uma seção por temporada —
  as temporadas fechadas nascem recolhidas.
- Selo por item (`careerSeal`): **Oficial** (veio da plataforma, ou o torneio
  de fora ligado por "É este") ou **Declarado**. Ninguém digita o selo.
- Torneio da plataforma conta só se a pessoa jogou e ele não é rascunho nem
  privado (`isCareerPlatformTournament`); o ligado por "É este" aparece uma
  vez só, sem repetir os pontos da federação num item à parte.
- **O selo Oficial confere que a pessoa JOGOU, não a colocação digitada.** No
  item ligado por "É este", posição, medalha e pontos saem da PLATAFORMA (os
  pódios do torneio e, na falta, o melhor dos pontos oficiais); a colocação
  declarada não aparece no subtítulo, não conta pódio nem gera troféu — a
  mesma régua da vitrine pública (§2.8). Sem pódio oficial, o item fica sem
  medalha.
- **Pódio se conta por PARTICIPAÇÃO, num jeito só** (`itemPodiums`): cada item
  leva `positions[]` (um degrau por categoria com pódio; `position` é o
  melhor, para a medalha do item e o filtro `podios=1`). Ouro em duplas e
  prata na mista no mesmo torneio são 2 pódios no resumo da temporada, na
  meta "Pódios", na retrospectiva, na estante, na Minha área e em Meu
  desempenho.
- O plano que passou sem resposta aparece com o selo "Como foi?" e não entra
  no resumo da temporada (§2.5).

### 4.3 Registrar (`CareerQuickRegister`)

Em 30 segundos: nome, data, formato (Simples / Duplas / Equipe / Americano), categoria
(Masc / Fem / Mista) e a medalha opcional. Data futura entra como planejado.
Depois de salvar: "Outra categoria", "Completar a ficha" e "Pronto".
"Repetir o torneio do ano passado" (`repeatableEvents` / `repeatEvent`)
preenche nome, organizador, cidade e federação. O ano do nome e a data
sugerida vêm para a edição seguinte à de hoje (364 dias por ano de
distância, mantendo o dia da semana): repetir um torneio de 2024 em 2026
sugere 2026, nunca uma data já passada. O plano de um torneio daqui e o
plano sem resposta não são oferecidos para repetir.

**Sem sinal**: `useCareerSaveWithDraft` guarda o registro no aparelho
(`v2:view:<uid>:carreira:pendentes`; teto de 20 em `MAX_PENDING`, e a fila
**nunca descarta** o que já guardou — `pendingFull` diz a quem guarda que o
teto chegou) e envia quando a conexão volta;
a linha do tempo mostra quantos estão esperando, com "Enviar agora".
O servidor tem 8 s para confirmar (`setDoc` com sinal ruim e `navigator.onLine`
não falha — fica esperando); passou, vale "Guardado neste aparelho". Erro
definitivo (regra recusou, dado inválido) tira o rascunho da fila em vez de
travá-la, e excluir o torneio também o tira da fila.

### 4.4 A ficha (`CareerEventSheet`)

Completa-se em camadas (`careerCompleteness`): **resultado** (colocação,
faixa, idade, pontos declarados, federação, etapa, link), **foto**,
**dupla** (nome livre ou a conta escolhida da lista de usuários) e
**balanço**. O cartão diz "3 de 4" e o ÚNICO próximo passo; quando o que
falta é o balanço, o próprio próximo passo o abre.

**Camada 4 — Balanço** (PR 2, âncora `carreira-balanco`): só para torneio
JOGADO (`careerDebriefSource`, `career/domain/careerDebrief.js`). "Fazer o
balanço" abre o MESMO `DebriefDialog` do Centro de Treino
(`CareerDebriefDialog`, lazy) com a origem `externo` já preenchida — id
`training_debriefs/{uid}_externo_{eventoId}`, um por torneio (docs/42 §2a).
Salvo, o diálogo mostra a semana de drills sugerida (`suggestWeek`); **nada
entra nos treinos sem "Adicionar"**. Feito, a camada diz o foco sugerido e
se a semana entrou nos treinos, com "Refazer o balanço". Os balanços são
lidos só com a ficha aberta (`useMyDebriefs`); falhou, a camada diz que não
carregou e o "N de 4" some (sem saber do balanço, "3 de 3" diria que está
completo). O torneio de fora **não vira pendência de balanço** — o convite
é o botão. **Apagar o torneio apaga o balanço dele** (`deleteCareerEvent`,
best-effort: o balanço não seguiria pesando no foco das semanas). No
histórico do Centro de Treino, o balanço de torneio só com o ano mostra o
ano, não "1 jan".

**Camada 3 — Dupla** (PR 3, âncora `carreira-dupla`, `CareerPartnerLayer`
em `CareerPartnerUi.jsx`): a dupla de cada categoria é escolhida pelo
seletor ÚNICO de parceiro (`v2/components/people/PartnerPicker.jsx`, o
mesmo da inscrição de torneio, que embrulha o seletor padrão de pessoas
`PersonPicker` — `docs/07-DESIGN-STANDARD.md` §3.2), que mostra antes da busca "Com quem você
já jogou" (`pastPartners`: torneios de fora + pódios da plataforma). Com o
registro SALVO, JOGADO e a pessoa maior de 18, "Pedir confirmação a
{nome}" chama `career` → `invite`. A camada mostra o estado, a visão da
dupla com "Usar no meu treino" / "Guardar", "Denunciar" e "Apagar o
pedido". Lista dos pedidos que falhou é dita (`V2ErrorState`), nunca "sem
pedido".

"É este torneio do PickleRush?": `matchPlatformTournament` compara o nome
normalizado e a data com os torneios em que a pessoa jogou; confirmando,
grava `platform_tournament_id` e o item aparece uma vez só, com selo
oficial. "Não é" fica no aparelho (`carreira:nao-e`). Excluir pede dois
toques e apaga as fotos junto. Link `?evento=` com a lista falhando diz
que a ficha não abriu (`V2ErrorState`), em vez de não fazer nada.

### 4.5 Vários de uma vez (`CareerListMode`)

Para o passado: uma linha por torneio (ano, nome, formato, categoria,
medalha), até 30, gravadas num lote (`writeBatch`). Pergunta antes "Quantos
torneios você já jogou fora do PickleRush?" (estimativa no aparelho,
`carreira:estimativa`, com "Agora não") e mostra "N de ~M registrados" —
só com a lista carregada (consulta própria, também aberto da aba Conquistas).

### 4.6 Conquistas

A aba abre a `TrophyShelf` na aba **"Fora da plataforma"** (`ABA_FORA`):
os pódios declarados (`careerTrophies`), com selo "Declarado" e o cartão de
compartilhar com o rodapé **"Resultado declarado"** (`MedalCard`,
`event.declared`). O ligado por "É este" com selo Oficial **não gera troféu
aqui**: a colocação dele é a oficial, e o troféu verdadeiro (se houve pódio)
está na aba Torneios. Torneio do modo
lista mostra só o ano (`dateLabel`), na estante e no cartão. Ver
`docs/43-TROFEUS-E-CARTOES.md`.

### 4.6a Gamificação da carreira (PR 5)

Premia **registrar, refletir e completar**; o resultado declarado rende
**zero**. O motor de XP continua um só (`useGamificationEngine`).

- **Ficha completa** — torneio de fora JÁ JOGADO (`status: 'played'`, data
  até hoje) com a colocação de toda participação, ao menos uma foto e o
  balanço `externo` respondido. A foto só conta se o `path` está na pasta da
  pessoa (`carreira/{uid}/`): a regra do registro é rasa e `photos: [{}]`
  gravado pelo SDK não completa nada. A régua é `isCompleteCareerRecord`
  (`career/domain/careerHabits.js`) com cópia no servidor
  (`functions/careerXp.js`, paridade em `careerHabits.test.js`). A dupla não
  entra (plano §7.1).
- **XP da ficha** — `user_xp_grants/{uid}_career_{eventoId}` (`kind:
  'career'`, campo novo `month` AAAA-MM de Brasília), gravado SÓ pelo
  servidor: o gatilho do registro (`careerEventWritten`) e o do balanço
  (`careerDebriefWritten`, `training_debriefs/{uid}_externo_{evento}`)
  chamam `careerXp.sync`, numa transação. `career.xpPerRecord` (padrão 25)
  e `career.monthlyCap` (padrão 4) vêm de `platform_settings/gamification`.
  Paga só com a flag E o módulo de gamificação `career_xp` ligados.
  - campeão e fase de grupos pagam o mesmo (o VALOR da colocação nunca é lido);
  - a mesma ficha nunca paga duas vezes (o documento existe ⇒ não paga);
  - registro apagado, foto ou balanço retirados ⇒ grant ZERADO (`xp: 0`,
    `revoked_at`), não apagado — refazer não paga de novo;
  - o teto conta todos os grants de carreira do mês, os zerados também:
    apagar e criar outro registro cai no mesmo teto;
  - torneio ligado a um da plataforma (`platform_tournament_id`) não paga —
    o oficial já conta;
  - o XP concedido sai do placar da temporada (`xpTotal − grantsXp`) e do
    sinal `xp_unverified`, como todo grant;
  - **menor de 18 (ou nascimento desconhecido) não ganha** o XP de carreira
    (`'minor'`, `isAdult` de `careerPolicy.js`): ele entraria no placar
    público de sempre (plano §13.4);
  - o gatilho do balanço tira o evento do ID do documento, não do `source`
    de agora: trocar o tipo ou o `ref_id` do balanço também zera;
  - **não há reprocessamento**: a ficha barrada pelo teto, completada com a
    flag/o módulo desligados, ou já completa antes do deploy só é conferida
    de novo quando o registro ou o balanço mudam. Acima do teto ela não rende
    XP, nem no mês seguinte (a ajuda diz isso).
- **Conquistas da família "Carreira"** (`CAREER_ACHIEVEMENTS`,
  família `my_career`, `xpBonus` 0): Primeiro registro, Historiador (20),
  Ficha completa, Arquivo em dia (10 fichas), Olhar para trás (5 balanços),
  Meta de processo cumprida. Fora de `ACHIEVEMENTS_V2` de propósito: só
  entram em `computeAchievementsV2(user, { career: true })`. Os fatos vêm
  das fontes `careerEvents` e `careerGoals` de `FACT_SOURCES`, buscadas só
  com a flag (`useActivityFacts`); fonte que falhou deixa o campo
  `undefined` ("não deu para medir"), nunca zero. A família **não é gravada**
  em `user_achievements_v2` (legível por qualquer conta logada): o motor a
  calcula para o dono a cada visita e o sync a filtra
  (`useGamificationEngine`). Por isso ela não entra na contagem pública, no
  Hall da Fama, nos títulos nem no aviso de desbloqueio — a vitrine é o PR 7.
  "Subi de faixa" e "Primeiro federado confirmado" (plano §7.2) ficam para
  depois: a primeira pede o histórico de faixa, a segunda ler
  `career_partner`, que só o servidor grava.
- **Ajuda** — termo "Ficha completa" (`ficha-completa`) no guia da
  gamificação, só com a flag, com os números da configuração; pergunta
  "Ser campeão num torneio de fora rende XP?"; artigo `carreira-xp`.

### 4.7 Retrospectiva da temporada (PR 2)

Na linha do tempo, cada temporada que já pode tê-la ganha o botão
"Retrospectiva {ano}", e a mais recente (o ano passado, ou o corrente) ganha
a faixa "Sua temporada {ano} num cartão" (âncora `carreira-retrospectiva`).
O cartão é o `MedalCard`/`MedalCardDialog` no modo `temporada`
(`buildSeasonCard`, `trophies/domain/medalCard.js`): torneios,
ouro/prata/bronze (só de torneio) e a **parceria da temporada** (`bestPartnership`: quem mais
jogou junto, depois mais medalhas juntos — das duplas dos torneios de fora e
dos pódios da plataforma; o "É este" conta uma vez só e a colocação digitada
nele não é medalha; plano sem resposta e plano de torneio daqui não contam;
a mesma pessoa com conta e só com o nome digitado é uma). Limite conhecido: da plataforma só
entram os torneios com PÓDIO (a única fonte daqui que diz a dupla) — torneio
jogado aqui sem medalha não soma em "torneios juntos". PNG, compartilhar,
imprimir/PDF e copiar o texto, como os outros cartões. **Zero banco**: sai
da linha do tempo já montada (`buildSeasonRecap`, `seasonRecap.js`).

- **Quando**: temporada fechada sempre; a corrente só a partir de 1º de
  dezembro (`seasonRecapOffered`). Antes, a tela não promete nada.
- Com **fonte faltando** na linha do tempo, não há cartão (número parcial num
  cartão para compartilhar é número errado). Os pódios vêm de duas leituras
  (`listMyTrophies`, `allSettled`): a metade que falhou também conta como
  fonte faltando, na linha do tempo e no cartão.
- A conta usa a linha do tempo **sem filtro** (o filtro é da tela).
- Com torneio de fora DECLARADO na temporada, o rodapé diz **"Inclui
  resultado declarado"** (e o texto compartilhado também).

### 4.9 Próximos (`CareerUpcomingTab`, `?aba=proximos`, PR 4)

- **Contagem** do torneio principal mais próximo (`mainCountdown`: o de
  prioridade Principal; sem ele, o planejado mais próximo). No dia do
  torneio e durante um torneio de vários dias a contagem é 0 ("É hoje").
- O torneio daqui só some do plano enquanto o planejado ligado a ele ESTÁ na
  lista (`upcomingPlan`): plano que já virou jogado não esconde o torneio em
  andamento.
- **Meu plano** (âncora `carreira-plano-lista`, `upcomingPlan`): os
  planejados de fora e os torneios da plataforma em que a pessoa está
  inscrita, do mais cedo ao mais tarde — prioridade, "Já me inscrevi",
  selo do prazo (`deadlineInfo`: fecha em N dias / fechou) e "Adicionar à
  agenda" (`careerEventIcs`, o mesmo `AddToCalendarButton`).
- **Para pôr no plano** (âncora `carreira-descoberta`, `buildDiscovery`): a
  agenda das federações em que a pessoa é filiada (só com a flag
  `federations`, `useFederationAgendaForMe`), os torneios chancelados e os
  públicos da plataforma (`usePublicTournaments`), na região da pessoa
  (`useRegionalList` + `RegionBar`/`RegionEmptyHint`). "Pôr no meu plano"
  cria o planejado já preenchido (`planDraftFrom`, com `origin_ref`) — nada
  entra sem o toque. Fonte que falhou é dita; o bloco só aparece com os
  registros carregados (senão ofereceria o que já está no plano), e sem a
  lista das inscrições o torneio daqui não ganha o botão. O item da agenda
  da federação abre a aba Agenda dela; filiação cancelada ou recusada não
  traz agenda.
- **O plano de um torneio DAQUI** (`origin_ref: 'tor:…'`, `isPlatformPlan`)
  é só plano: grava **só** `origin_ref`, nunca `platform_tournament_id` (que
  é o "É este" e daria o selo Oficial a um resultado digitado). Inscrita, a
  pessoa vê o torneio da plataforma no lugar dele (plano e linha do tempo);
  passada a data, ele não pergunta "Como foi?" (nem a ficha, nem a pendência,
  nem o aviso D+1) e sai da linha do tempo — se jogou, vale o oficial.
- **Na ficha do planejado** (`CareerPlanFields`): contagem, prioridade,
  prazo, "Já me inscrevi", a meta (`aim`), o foco (`focus_aspect`, com "Usar
  como foco" sugerido por `suggestedFocus` — o que mais aparece a melhorar
  nos balanços), "Mais" com o se-então e o ICS. Último dia passado ⇒ "Como
  foi?" (`CareerHowItWent`, grava `focus_result`).
- **Avisos do servidor** (`careerReminders`, todo dia às 9h de Brasília, só
  com a flag): **D-3 do prazo** (planejado, não inscrito; id
  `carreira_prazo_{evento}_{prazo}`, link `/carreira?aba=proximos&evento=`)
  e **D+1 do torneio** ("Como foi?", pelo fim — ou pelo início sem fim; id
  `carreira_d1_{evento}`, link `/carreira?evento=`). Ids determinísticos: o
  aviso nunca repete. `type: 'career'`, `origin: 'server'`, categoria
  **Carreira** das preferências (silenciada ⇒ nem push; cópia em
  `functions/notificationPrefs.js`). O tipo `career` era de "Parcerias de
  dupla" no PR 3: sem escolha própria gravada, "Carreira" herda "Parcerias
  de dupla" silenciada (nas duas cópias, com paridade), e a categoria só
  aparece nas Configurações com a flag.
- **Mandar ao meu professor**: o balanço do torneio só leva o professor com
  o vínculo ATIVO (com ele encerrado a regra recusaria criar o balanço);
  "Deixar de mostrar" vale mesmo com a flag desligada; mandar não apaga o
  que está sendo editado na ficha.

### 4.10 Metas (`CareerGoalsTab`, `?aba=metas`, PR 4)

Meta de **resultado** (métrica de `seasonGoalMetrics` com alvo; ou "Eu marco
à mão") ou de **processo** (0/25/50/75/100), com início, prazo (padrão +180
dias) e o se-então. Cada número diz DE ONDE conta
(`SEASON_GOAL_METRIC_SOURCE`): torneios jogados e pódios somam os da
plataforma e os declarados (dia de jogo não entra; o plano sem resposta
também não; pódio por participação — §4.2); federados, os marcados
como federados e os que lançaram pontos no ranking oficial. Torneio lançado
só com o ANO (modo lista) é gravado em 1º de janeiro e pode ficar fora da
janela da meta: `careerGoalValues` devolve `soAno` (quantos por ano) e
`yearOnlyInGoalWindow(meta, soAno)` diz quantos a janela da meta cruza, para
a tela avisar. O rating DUPR só
aparece com `useDuprMode().official` e conta só com a conta verificada
(`dupr_verified`). Concluir, "Deixar de lado" (não é falhar), Retomar e
Excluir. Nada disso entra em XP.

### 4.11 Posição no ranking (`CareerRankPanel`, PR 4)

Na linha do tempo, depois de carregada: um gráfico pequeno por ranking
(`rankSeries`; posição invertida, 1º em cima), com o selo **Oficial** (do
`federation_rankings`) ou **Declarado** (`career_rank`) — as duas nunca
na mesma linha —, a tendência (`rankTrend`), "Ver como tabela" e "Anotar
posição". Leitura que falhou é dita.

### 4.12 Mandar ao meu professor (PR 4)

Na ficha, `CareerCoachShare` lista os professores com vínculo ativo
(`useTrainingIdentity().coachLinks`) e grava `shared_coach_id` na hora (e no
balanço, `saveDebrief(…, { sharedCoachId })`). O professor vê em Centro de
Treino → Alunos → o aluno (`CoachStudentCareer`, lazy, só com a flag): os
torneios mandados, categorias, meta, foco e os pontos fortes e a melhorar do
balanço. Recusa da regra ⇒ "O acesso fechou", nunca "nada mandado".

### 4.13 A vitrine pública (PR 7)

- **Na ficha** (`CareerShowcaseLayer`, seção "Perfil público",
  `data-dica="carreira-vitrine"`): só para torneio JOGADO e salvo, e só para
  maiores de 18. Diz antes o que vai e o que nunca vai, escolhe as fotos (com
  descrição, até 6 na vitrine toda) e chama `publish` / `unpublish` da função
  `career`. Ficha com mudança não salva não publica ("a vitrine mostra o que
  está salvo"). Leitura falhando ⇒ "Não deu para saber se este torneio está no
  seu perfil", nunca "não publicado".
- **Nos pedidos das duplas** (`CareerPartnerUi`): no pedido confirmado, o
  interruptor "Meu nome na vitrine de {quem}" (`public_consent`), revogável.
- **No perfil público** (`/atleta/:uid`, `CareerPublicBlock`, lazy, só com a
  flag, `data-dica="carreira-publica"`): o bloco "Carreira" com o selo à vista,
  as **Parcerias** (`showcasePartnerships`: só duplas com nome publicado,
  quem mais jogou junto primeiro) e as fotos. Sem nada publicado o bloco some;
  leitura falhando diz "Não carregou a carreira". **Parabenizar** um pódio de
  fora é o kudo `positive` de sempre (`CongratulateButton`, `contextId =
  trofeu:ext:{evento}:{categoria}:{colocação}`, `showcaseTrophyContextId`).
- **O servidor** (`functions/careerPublic.js`): `publish` exige a flag, o dono,
  maior de 18 (menor recebe a MESMA resposta e nada é gravado), torneio jogado
  (não planejado, não cancelado, data ≤ hoje, não plano de torneio daqui),
  fotos da própria pasta e com descrição, e os limites; avisa uma vez as duplas
  confirmadas que ainda não decidiram. `unpublish` vale mesmo com a flag
  desligada. Os gatilhos `careerEventWritten` (editou/apagou o torneio) e
  `careerPartnerWritten` (a dupla confirmou, desfez, permitiu ou retirou)
  reconstroem ou removem o item — `rebuild` só regrava quando algo mudou e
  apaga as fotos que saíram. Toda ação grava auditoria
  (`career_public_published|unpublished|partner_allowed|partner_revoked`).

## 5. Outros lugares

- **Início** (PR 4): card **Carreira** (`HOME_CARD.CARREIRA`, grupo
  Competir, `requer: 'carreira'`, `HomeCareerCard` lazy): a contagem do
  principal, "Como foi o {torneio}?" e até 3 do plano com o prazo; falha ≠
  vazio. A **agenda** do início ganha os planejados sem vínculo com a
  plataforma (`agendaFromCareerEvents`, "Planejado"; ação quando o prazo
  fecha em 0–3 dias e a pessoa não se inscreveu). O plano `tor:<id>` de um
  torneio daqui não se repete ao lado dos jogos dele: quem tira é a junção
  (`mergeAgenda`, `originRef` do plano × `tournamentId` do jogo), sem depender
  de quem chama; o parâmetro `torneios` segue como atalho opcional. Ver `docs/31`.
- **Precisa de você** (PR 4): "Como foi?" dos planejados que passaram e os
  prazos que fecham em até 3 dias (`careerPlanPending`, itens
  `carreira:como-foi` e `carreira:prazos`); lista que falhou vai para "ficou
  de fora".

- **Minha área**: seção `carreira` (grupo "Você", `userAreaSections` com
  `carreira: flag`), `CareerAreaSection` — contagens, o último registro com o
  que falta ("N de 4", com os balanços lidos; sem eles a conta não aparece) e
  os atalhos. "Jogados", "pódios" e o último registro usam só o torneio de
  fora jogado (`isOutsidePlayed`): o plano de um torneio daqui e o plano sem
  resposta não entram (`careerAreaSummary`). Ver `docs/41-MINHA-AREA.md`.
- **Meu desempenho** (`/meu-desempenho`, PR 2): o bloco "Fora da plataforma"
  (`CareerPerformanceBlock`, lazy, só com a flag; âncora `desempenho-fora`) —
  torneios, pódios e títulos DECLARADOS (`careerPerformanceSummary`; o ligado
  por "É este" fica fora da conta porque já está no verificado), à parte dos
  seis cartões verificados, que não mudam. O interruptor **"Incluir
  declarados"** (`?declarados=1`, padrão desligado) mostra a soma verificado +
  declarado em outra cor, com o selo e dizendo "N daqui + M declarados"; o
  aproveitamento continua só com os jogos daqui — **desvio consciente do
  plano**, que dizia "soma os declarados ao aproveitamento": o torneio de fora
  não guarda jogos nem vitórias, então qualquer aproveitamento com ele seria
  inventado. Lista que falhou é dita. A
  aba da tela também foi para a URL (`?aba=jogos`; sem `aba`, a estatística)
  e a rota entrou em `<Isolada nome="meu-desempenho">`.
- **Exportação de dados** (Configurações): bloco `career` em
  `dataExport.js`, com as fontes que falharam ditas (`careerExportService`;
  PR 4: as posições anotadas, `ranks`).
- **Exclusão de conta**: `career_events` e `career_rank` por `uid` e o prefixo `carreira/`
  do Storage (`functions/accountDeletion.js`); a guarda
  `exclusaoCobreColecoes` cobre o prefixo `career_`.
- **Ajuda**: artigos `carreira-registrar`, `carreira-balanco` (o balanço, o
  bloco de Meu desempenho e a retrospectiva) e `carreira-selos` (parte
  Atleta), pistas de rota `/carreira` e `/meu-desempenho` e o guia
  `carreira-registrar` (âncoras `carreira-registrar`,
  `carreira-registrar-formato`, `carreira-lista`, `carreira-foto`,
  `carreira-balanco`, `carreira-abas`) — todos com `flags: ['athlete_career']`.
  PR 4: artigo e guia `carreira-planejar` (âncoras `carreira-aba-proximos`,
  `carreira-aba-metas`, `carreira-descoberta`, `carreira-plano-lista`) e o
  ponto de dica `carreira:descoberta`.
- **E2E**: `tests/e2e/logado.spec.js`, teste "Carreira" (liga a flag,
  abre as quatro abas e `/meu-desempenho?declarados=1`).

### 4.8 A dupla confirma (PR 3)

- **Pedir** (`invite`): só o dono, com a flag, registro jogado (nem futuro
  nem cancelado), a dupla citada numa categoria de dupla e **os dois maiores
  de 18** (nascimento desconhecido conta como menor; a recusa por idade da
  dupla não revela a idade). Pedido em aberto ou confirmado com a mesma
  impressão não duplica; recusado com a mesma impressão é recusado de novo
  (corrija a ficha e peça). Avisa a dupla.
- **Responder** (`respond`): só a dupla citada, "Confirmo" / "Não foi
  assim". O servidor relê o registro: se ela não está mais nele, o pedido
  some. Avisa o dono.
- **Mudou a data ou o resultado** → o gatilho `careerEventWritten` compara a
  impressão: confirmado vira `reconfirm` e a dupla é avisada. **Trocar o
  nome não pede nada.** A dupla tirada do registro perde o pedido. Registro
  apagado leva os pedidos e solta os `linked_event` que apontavam para ele.
- **A visão** (`feedback`): só a dupla, depois de confirmar e enquanto o
  dono não decidiu; 3+3 aspectos e três textos curtos. O dono decide
  (`decide`): `use` põe a visão no foco dos balanços (`partnerVoices` →
  `debriefFocus(…, { partnerVoices })`, +1 por aspecto, o motivo diz que
  veio da dupla e o diálogo do balanço mostra "Também da sua dupla"), `keep`
  guarda só na ficha. **A crítica nunca sai do par**: nem página pública,
  nem ranking, nem XP, nem a fila do admin sem denúncia.
- **"Pôr na minha carreira também"**: a dupla grava um registro dela já
  preenchido (`mirrorEventDraft`, com `linked_event`); o gatilho confere
  (pedido confirmado, os dois uids certos) e liga os dois
  (`partner_event_id`) — vínculo forjado é desfeito.
- **Retirar** (`remove`): o dono apaga o pedido; a dupla retira a visão ou,
  sem visão, desfaz a confirmação.
- **Denunciar** (`report`, qualquer dos dois) → **Painel admin → Carreira →
  Denúncias de dupla** (`AdminCareerModeration`, aba `carreira-moderacao`,
  também em "Precisa de você" do admin): `dismiss`, `remove_feedback` (avisa
  a dupla) ou `remove_link` (avisa o dono), sempre com motivo (≥ 5 letras).
- **Auditoria** em toda ação (`audit_logs`, sem o texto da visão).
- **Avisos** do servidor: `type: 'career'`, `origin: 'server'`, link
  `/carreira?dupla=<pedido>` ou `/carreira?evento=<id>` passado por
  `linkDeAviso` (a regra de `notifications` recusa `#`).
- **Onde a dupla responde**: no topo da linha do tempo
  (`CareerPartnerInbox`, âncora `carreira-duplas`; `?dupla=` destaca o
  pedido do aviso). **Precisa de você** (Minha área): "torneios para
  confirmar como dupla" e "visões da dupla para decidir"
  (`careerPartnerPending`; lista que falhou vai para "ficou de fora").
- **Selo**: `careerSeal(ev, myTournaments, partnerSeal)` — `official` >
  `confirmed` ("Confirmado pela dupla", azul) > `declared`; pedido em aberto
  acrescenta "Aguardando a dupla". Confirmado continua **declarado** para
  pontuação: não entra em ranking, rating, federação nem XP.

### 4.13 A dupla sem conta: "Convidar pelo WhatsApp" (PR 6)

- **Na ficha** (camada Dupla, `NamedPartnerInvites` em `CareerPartnerUi.jsx`):
  cada dupla digitada só com o nome (`namedPartners`, uma por nome) ganha
  "Convidar pelo WhatsApp" (âncora `carreira-convidar-whatsapp`) — só com a
  ficha salva, torneio jogado e o dono maior de 18. A ação `invite_link`
  devolve o token; a tela monta a mensagem com o link
  `/carreira/convite/:token` e abre `wa.me/?text=…` (sem número), com o
  link "Abrir o WhatsApp" de reserva se o navegador bloquear a janela.
  Depois: **"Convite enviado · aguardando"**, até quando vale, "Mandar um
  link novo" (derruba o anterior) e **"Cancelar o convite"** (`invite_cancel`,
  o link para de valer na hora). Vencido: "O convite venceu". A lista dos
  convites que falhou é dita (`V2ErrorState`), nunca "nenhum convite".
- **O link** (`/carreira/convite/:token`, `V2CareerInvite`, lazy, em
  `<Isolada>`): sem conta, o `App.jsx` (`MainEntry`) mostra a explicação e
  "Criar conta ou entrar" → `/login?next=<este link>` (o redirecionamento do
  login de sempre; nada é gravado). Com conta, `invite_peek` mostra de quem é
  o convite ("{quem} registrou o {torneio} com "{nome}" como dupla") e
  **"Sou eu, aceitar o convite"** chama `invite_accept`: numa TRANSAÇÃO, o
  servidor confere o convite (existe, não venceu, registro do mesmo dono,
  não cancelado, quem aceita é maior de 18) e que a dupla com aquele nome
  **ainda está vazia**; preenche `entries[i].partner.uid` (o nome digitado
  fica) e `partner_uids`, apaga o convite, abre o pedido `career_partner`
  (`invited`) e avisa o dono ("{nome} aceitou o seu convite",
  `type: 'career'`, `origin: 'server'`). A tela vai para
  `/carreira?dupla=<pedido>` — a confirmação de sempre (§4.8).
- **Resposta neutra**: link usado, vencido, cancelado, inexistente,
  malformado, de registro apagado, com a dupla já preenchida ou aberto por
  menor recebem a MESMA mensagem ("Este convite não vale mais…"), e nada é
  gravado. O dono que abre o próprio link vê "Este convite é seu".
  Também valem neutros: o torneio que voltou a ter data futura e o pedido que
  a moderação retirou (`remove_link`) — o link não o faz renascer.
- **Conta recém-criada sem nascimento**: a tela não consulta o servidor (ele
  trataria como menor); pede "Complete o seu cadastro" e consulta assim que a
  data chega ao perfil (a data está na chave da consulta). Com a flag
  desligada, quem não entrou vê "Este link não está disponível agora".
- **Nunca troca uma conta**: dupla que já tem `uid` não está em
  `namedPartners`, então o link é recusado; o dono não aceita o próprio.
- **Ficha aberta durante o aceite**: salvar a ficha carregada antes do aceite
  não apaga a conta ligada — `saveCareerEvent` relê o registro e, se ele é
  mais novo que o carregado, a categoria com o mesmo nome recupera a conta
  (`keepServerLinkedPartners`).
- **Um convite por NOME**: o mesmo nome em várias categorias recebe um link
  só, e quem aceita vira a dupla de todas — a ficha diz "o mesmo link vale
  para as N categorias". Pessoas diferentes com o mesmo nome precisam de
  nomes que as distingam. Gerar um link novo apaga também os convites
  vencidos do torneio; o resto vence sozinho ou sai com o registro/a conta.
- **O token não vai para a ajuda**: `helpLinkFor` troca o token da rota por
  `link` (a pista `/carreira/convite/*` segue valendo).
- **Ajuda**: artigo `carreira-dupla-sem-conta`, passo `whatsapp` do guia
  `carreira-registrar`, ponto `carreira:convidar-whatsapp` e a pista
  `/carreira/convite/*` (antes de `/carreira`), todos com
  `flags: ['athlete_career']`.

### 4.14 Pente fino de 2026-11-11 (Etapa 1: servidor, regras, domínio e gravação)

O que mudou de comportamento para quem usa (o detalhe do servidor está em
`docs/47` §7a):

- **Pedir confirmação tem teto**: 20 pedidos enviados em 24 h e 3 abertos para
  a mesma pessoa. Quem cadastra o histórico com dupla fixa pede o 4º torneio
  depois que ela responder aos primeiros.
- **Excluir sem conexão** só conclui sozinho para o registro que nunca chegou
  ao servidor. Torneio já gravado (mesmo com edição esperando na fila) pede a
  confirmação do servidor; apagar o que já não existe conta como feito.
- **Salvar que não pôde guardar** (navegador bloqueou ou fila cheia) lança um
  erro que leva o registro com o id: a ficha o reaproveita e tentar de novo
  regrava o MESMO torneio, sem duplicar. Rascunho recusado (`refused`) não
  conta no teto de 20 da fila.
- **Mandar ao professor** não espera o aviso sair (com sinal ruim o botão
  ficava preso depois de o envio já estar gravado).
- **Vitrine de perfil oculto**: a regra recusa a consulta de terceiros e o
  bloco "Carreira" do perfil some (não é erro de conexão).
- **Retrospectiva**: plano sem resposta não acende o rodapé "resultado
  declarado".
- `useCareerTimeline` mora em `hooks/useCareerTimeline.js`; `useCareer.js` não
  o reexporta (seria ciclo de import — guarda `fronteirasDeModulos`).

### 4.15 Pente fino de 2026-11-11 (Etapa 2: telas, toque, teclado e idiomas)

Zero banco, zero regra, zero função. O que mudou para quem usa (onde este
texto e as seções anteriores divergirem, vale este):

**Ficha (`CareerEventSheet`)**
- "Alterações não salvas" compara com o que está GRAVADO; fechar com alteração,
  excluir e tirar foto perguntam num `ConfirmDialog` (um toque não apaga).
- O Salvar fica preso embaixo (alcance do polegar) e o Enter salva. Durante o
  envio de uma foto o Salvar espera.
- Validação por campo (`conferirFicha`): o primeiro campo errado recebe o foco e
  a mensagem; o link só abre se for `https` válido.
- **"Como foi?" tem duas respostas: "Joguei" e "Não fui".** "Não fui" grava
  `status: 'cancelled'` (o enum que já existia); o plano que passou não salva
  sem resposta. Num torneio "Não fui" não há colocação nem foto, não dá para
  pedir confirmação da dupla, e a resposta pode ser desfeita na própria ficha.
- Mudar a data refaz o status na hora, mas só com a data inteira e dentro de
  `careerDateBounds()`; o torneio já gravado como jogado que passeou pelo
  futuro não volta perguntando "Como foi?".
- Dupla ligada a uma conta mostra o nome só para leitura.
- Com `shared_coach_id`, os textos deixam de dizer "só você vê": a regra entrega
  o documento do torneio ao professor com vínculo ativo (anotações e fotos
  inclusive). Voltar a prometer "só você" pede mover `notes`/`photos` para um
  subdocumento privado: decisão do dono (toca o banco), fora desta etapa.

**Página, linha do tempo, registro rápido e modo lista**
- Com a flag desligada, quem tem registros vê uma página só para apagar os
  registros e tirar do perfil o que estava na vitrine (ler e apagar seguem
  valendo na regra); quem não tem nada vai para a Minha área.
- `?evento=` e `?dupla=` de algo que não existe mais são ditos e limpos da URL,
  **só com dado fresco** (`eventsFetching`/`partnersFetching` de
  `useCareerTimeline`): o cache de outra tela não decide. A ficha aberta a
  partir do registro rápido toma o lugar dele no histórico (o Voltar não reabre
  o registro em branco).
- Modo lista: as linhas ficam guardadas no navegador (`carreira:lista`, por
  pessoa) até salvar, com ids estáveis: tentar de novo regrava as mesmas, sem
  duplicar. Linha sem nome é apontada, não descartada.
- "Repetir" não cria torneio jogado com data no futuro nem plano no passado.
- Rascunhos do aparelho aparecem como botões de 44 px que abrem a ficha.

**Dupla, convite e moderação**
- Apagar pedido, cancelar convite e mandar link novo pedem um segundo toque no
  próprio lugar (`ConfirmarInline`); a recusa do servidor fica dita no item e
  num aviso.
- O link do convite aparece na tela com "Copiar link" (o WhatsApp é uma âncora,
  não `window.open`).
- `/carreira/convite/:token`: "Tentar de novo" depois de queda de rede; recusa
  definitiva trava. Se uma tentativa caiu sem resposta e a seguinte é recusada,
  a tela diz que o aceite pode já ter passado e leva à Carreira (o convite é de
  uso único). A tela diz com QUAL conta a pessoa entrou e oferece trocar.
- Torneio "Não fui" não oferece pedir confirmação nem convidar.

**Próximos, Metas e Ranking**
- "Já me inscrevi" não depende do prazo de inscrição e ganhou "Desmarcar
  inscrição". A agenda das federações que falhou não segura o esqueleto.
- Metas: editar (o tipo não muda), estado em palavras (Alcançada, Concluída,
  Deixada de lado, Prazo encerrado), aviso do torneio lançado só com o ano,
  excluir com confirmação, rating DUPR com três casas e o separador do idioma.
- Ranking: datas no eixo, "Anotar nova posição" na série, apagar com confirmação.

**Ligações**
- A família de conquistas `my_career` chama-se **"Torneios de fora"** (a família
  `career`, da trajetória na plataforma, já se chama "Carreira").
- Estante: pódio de fora ligado a um torneio daqui fica de fora (e é dito)
  enquanto os torneios da plataforma não carregam; "Ver todos" abre ali mesmo
  no perfil de outra pessoa; parabéns de pódio de fora leva a
  `/carreira?aba=conquistas`.
- Exportação da conta: o bloco `career` traz sete listas (`events`, `partners`,
  `partner_reports`, `partner_invites`, `public`, `ranks`, `photos`) e
  `not_included` dizendo o que fica só com a moderação.
- Idiomas: todo texto novo em en/es no catálogo da carreira.

## 6. O que não pode regredir

1. **Declarado nunca pontua**: nenhum motor de ranking, rating ou federação
   lê `career_*`; o motor de XP conta só HÁBITOS, pela fonte `careerEvents` e
   por `careerHabits.js`, e a colocação declarada não muda conquista, XP da
   ficha nem placar da temporada (guarda `carreiraNaoPontua.test.js`, por
   leitura do código e por comportamento).
2. **Só o dono** lê e escreve; a flag vale **na regra** só para criar e
   editar.
3. **Fonte que falhou é dita**, nunca vira "você ainda não jogou".
4. Toda coleção `career_*` nova entra na exclusão **e** na exportação.
5. Foto só pelo `prepareUpload` (sem EXIF), com descrição, até 6.
6. **O balanço do torneio é o balanço do jogo**: um `DebriefDialog`, um
   `suggestWeek`, uma coleção — origem `externo` (gravada; nunca renomeie);
   nada entra nos treinos sem "Adicionar"; nunca vira pendência.
7. **O declarado nunca se mistura calado com o verificado**: em Meu
   desempenho os seis cartões ficam como estão e a soma só aparece com o
   interruptor, dizendo de onde vem cada parte.
8. A retrospectiva é **zero banco** e não aparece com fonte faltando.
9. **`career_partner` só o servidor grava**; só quem foi citado confirma;
   data ou resultado mudou ⇒ nova confirmação, nome mudou ⇒ não; menor de
   18 nunca é convidado nem convida; a visão nunca sai do par; toda ação
   grava auditoria. A régua tem cópia no servidor (`careerPolicy.js`, com
   paridade) — mexer num lado só quebra o teste.
10. O seletor de dupla é UM (`PartnerPicker`): nunca bifurque.
11. **Nada do PR 4 pontua**: plano, metas e posição digitada nunca entram
    em ranking, rating nem XP; a posição Oficial e a Declarada nunca
    dividem a linha do gráfico.
12. **Professor só vê o que foi MANDADO** e só com vínculo ATIVO (regra
    `coachSees`/`coachOk`, provada em `tests/rules/career.rules.test.js`).
13. Os avisos D-3/D+1 são do servidor, com id determinístico (nunca
    repetem), e só com a flag; a categoria Carreira existe nas DUAS cópias
    das preferências.
14. "Pôr no meu plano" nunca grava sozinho; enums `priority`/`focus_result`,
    `kind`/`status` das metas e `?aba=proximos|metas` são gravados/contrato.
15. **XP da ficha só o servidor grava** (`careerXp.js`): id determinístico,
    zerar em vez de apagar, teto do mês com os zerados, números da
    configuração, flag + módulo `career_xp`. `kind: 'career'` existe nos DOIS
    lados (`xpGrants.js` × `XP_GRANT_KINDS`, paridade).
16. **Convite da dupla sem conta (PR 6)**: `career_partner_invites` só o
    servidor grava; o token nunca é guardado (o id é o hash) e nenhum
    telefone; o link vale UMA vez e por 14 dias; o aceite só preenche a dupla
    VAZIA e nunca troca uma conta; o dono não se liga a si mesmo; menor não
    convida nem é convidado; usado, vencido, cancelado e inexistente
    respondem igual. Provado em `functions/careerInvite.test.js` e
    `tests/rules/career.rules.test.js`; validade, token e `namedPartners`
    com paridade em `careerPolicy.parity.test.js`. A rota
    `/carreira/convite/:token` é contrato (o link vai no WhatsApp).
17. **A vitrine (PR 7) só o servidor grava** (`career_public` e
    `carreira-publica/`): só o que o dono escolheu, só a lista fechada de
    campos, o selo calculado (com Oficial, sem a colocação declarada), o nome
    da dupla só com o "sim" dela, menor nunca publica (resposta igual), foto
    só da própria pasta e sem metadados, e tirar/apagar remove item e fotos.
    A régua tem cópia (`careerPublicPolicy.js`, paridade); a vitrine entra na
    exclusão e na exportação. O declarado à vista nunca pontua.

## 7. Fora destes PRs

Faixas
de preparação e o histórico do DUPR (a série `rating_points` existe; nada a
mostra ainda).

**Pendências registradas na revisão do PR 1:**

- ✅ **Vitrine pública (PR 7)**: o selo Oficial confere só que a pessoa
  JOGOU o torneio da plataforma; por isso o item da vitrine com selo Oficial
  sai **sem** a colocação declarada (a oficial é a do pódio, na estante).
  Puxar a colocação do `modalityPodium` para o item fica para depois.
- **Vitrine — o que ficou para depois**: denúncia de item/foto da vitrine por
  terceiros; a "frase de ponto forte" da dupla NÃO é publicada (a visão da
  dupla nunca sai do par); em **Parcerias**, tocar no nome da dupla e ver os
  resultados que os dois tiveram juntos (no `/carreira`, derivado da linha do
  tempo) — hoje o perfil mostra só a lista de quem mais jogou junto, das
  participações publicadas e consentidas. A vitrine já é só para contas
  logadas (`isAuthed()`, como o perfil). Ver
  `docs/20-SEGURANCA-E-PRIVACIDADE/21-CARREIRA-VITRINE.md` §10.
- ✅ **PR 3 (dupla)**: a exclusão de conta apaga os `career_events` e os
  `career_partner` da pessoa (os dois lados) e, nos registros de quem a
  escolheu como dupla, tira `partner.uid`/`partner_uids`/`linked_event` e
  mantém o nome digitado (`patchCareerPartner`, consulta por
  `partner_uids array-contains`; `functions/accountDeletion.carreira.test.js`).
  Registros salvos ANTES do PR 3 não têm `partner_uids` e não são achados —
  ficam com o uid solto até a próxima gravação (nada é migrado sozinho). A
  unificação de contas não move a carreira (não é histórico esportivo).
- **Convite a menor (ou conta sem nascimento)**: o servidor devolve a MESMA
  resposta do convite que saiu, sem gravar nem avisar (fica só a auditoria
  `career_partner_invite_held`), para a resposta não virar sonda de idade. O
  limite: quem convida não vê o pedido "aguardando" depois de recarregar —
  quem lê o banco ainda nota a ausência do documento.
- **"Com quem você já jogou"** soma os torneios de fora e os PÓDIOS da
  estante; as duplas de torneio e de dia de jogo da plataforma sem pódio
  ainda não entram (o plano §5.1 pede; fica para quando a linha do tempo
  carregar as inscrições com o parceiro).
