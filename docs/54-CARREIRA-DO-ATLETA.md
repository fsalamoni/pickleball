# 54 — Minha carreira (carreira do atleta)

> Estado: **PR 1 — núcleo, foto e passado** + **PR 2 — balanço, treino e
> retrospectiva** + **PR 3 — a dupla confirma** (2026-11-04). Flag
> `athlete_career` (`FEATURE_FLAG.ATHLETE_CAREER`, padrão **desligada**, só o
> admin liga; grupo "Carreira do atleta" no painel). O plano completo, com os
> PRs seguintes, está fora do repositório
> (`/mnt/project-files/carreira/plano-gestao-de-carreira.md`). Este documento
> descreve **só o que existe no código**.

## 1. O que é

`/carreira` é a linha do tempo da pessoa: os torneios e dias de jogo da
plataforma aparecem sozinhos, e ela **registra os torneios que jogou fora do
PickleRush** (o passado e os que vai jogar). O resultado registrado é
**declarado**: fica na carreira e na estante de troféus, mas **nunca** entra
em ranking, rating nem XP (guarda `src/core/guards/carreiraNaoPontua.test.js`).

| Peça | Onde |
|---|---|
| Domínio (puro, com teste) | `src/modules/career/domain/careerEvent.js`, `timeline.js`, `draftQueue.js`, `careerDebrief.js` (a origem do balanço), `seasonRecap.js` (a retrospectiva), `careerPartner.js` (a dupla: citação, impressão, maioridade, visão, selo, pendências) |
| Servidor (PR 3) | `functions/career.js` (callable `career` + gatilho `careerEventWritten`), régua copiada em `functions/careerPolicy.js` (paridade `careerPolicy.parity.test.js`) |
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
| `start_date`, `end_date` | `AAAA-MM-DD` | `date_precision`: `day` ou `year` (modo lista) |
| `status` | `played` / `planned` / `cancelled` | derivado da data (`deriveCareerStatus`): futura ⇒ planejado. O gravado é o do dia em que se salvou; a LEITURA recalcula (`withDerivedStatus` em `listCareerEvents` e na ficha), então o planejado cuja data passou é jogado |
| `entries[]` (≤ 6) | objeto | `format` (`singles`/`doubles`/`teams`), `gender` (`male`/`female`/`mixed`/`open`), `age`, `level_bracket`, `placement` (`champion`/`runner_up`/`third`/`semis`/`quarters`/`round_of_16`/`groups`/`other`), `placement_n`, `points_declared`, `partner { name, uid }` |
| `federated`, `federation_id`, `federation_name`, `federation_acronym`, `stage_tier` | | federação do diretório (com a flag `federations`) ou texto livre |
| `link` | `https://…` ≤ 300 | guardado, nunca aberto pela plataforma |
| `photos[]` (≤ 6) | `{ path, url, kind, alt }` | `kind`: `medal`/`podium`/`draw`/`other`; `alt` é a descrição |
| `notes` | ≤ 2000 | só o dono lê |
| `platform_tournament_id` | string \| null | gravado quando a pessoa responde "É este" (ver §4.3) |
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

## 3. Quem pode o quê

```
match /career_events/{id} {
  allow read, delete: if isOwner(od().uid);
  allow create, update: if isOwner(nd().uid) && id.matches(me() + '_.+') && careerOn();
}
match /career_partner/{id} {
  allow read: if isOwner(od().owner_uid) || isOwner(od().partner_uid);
}
match /career_partner_reports/{id} {
  allow read: if isOwner(od().reporter_uid);
}
```

- **Só o dono** lê e escreve. Nem o admin lê pelo cliente.
- `careerOn()` lê `platform_settings/global.feature_flags.athlete_career`:
  com a flag desligada, criar e editar são recusados; **ler e apagar
  continuam valendo** (a pessoa nunca fica presa ao próprio dado).
- `career_partner` **ninguém grava pelo cliente** (nem o dono, nem a dupla,
  nem o admin): tudo passa pela função `career`. Terceiro não lê — a visão
  da dupla fica entre os dois. A fila de moderação o admin lê pelo servidor
  (ação `queue`), sem uid.
- Prova no emulador: `tests/rules/career.rules.test.js` (dono, dupla citada,
  terceiro, menor — nenhuma conta admin) e os casos de `carreira/` em
  `tests/rules/storage.rules.test.js`.

## 4. A tela

### 4.1 Abas (`?aba=`)

`linha-do-tempo` (padrão) e `conquistas` (`CAREER_TAB`). Não há aba vazia
"em breve". Outros parâmetros: `?evento=<id>` abre a ficha, `?registrar=1`
abre o registro rápido, `?lista=1` o modo lista. Com a flag desligada,
`/carreira` redireciona para `/perfil`. O título vem do `V2Layout`
(`PAGE_TITLES`) e o item "Minha carreira" fica dentro do hub do perfil (não
há hub novo na barra lateral).

### 4.2 Linha do tempo (`CareerTimeline`, `buildCareerTimeline`)

Cinco fontes, cada uma falha sozinha: os torneios de fora (`career_events`),
os torneios da plataforma em que a pessoa jogou (`useMyTournaments`, mesma
chave do início), os pódios (`useTrophies`), os dias de jogo publicados
(`usePublishedGameDayGames`) e os pontos lançados pelas federações
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

### 4.3 Registrar (`CareerQuickRegister`)

Em 30 segundos: nome, data, formato (Simples / Duplas / Equipe), categoria
(Masc / Fem / Mista) e a medalha opcional. Data futura entra como planejado.
Depois de salvar: "Outra categoria", "Completar a ficha" e "Pronto".
"Repetir o torneio do ano passado" (`repeatableEvents` / `repeatEvent`)
preenche nome, organizador, cidade e federação.

**Sem sinal**: `useCareerSaveWithDraft` guarda o registro no aparelho
(`v2:view:<uid>:carreira:pendentes`, até 20) e envia quando a conexão volta;
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
mesmo da inscrição de torneio), que mostra antes da busca "Com quem você
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
`event.declared`). O ligado por "É este" sai com selo Oficial e, se o pódio
da plataforma já está na aba Torneios, não se repete aqui. Torneio do modo
lista mostra só o ano (`dateLabel`), na estante e no cartão. Ver
`docs/43-TROFEUS-E-CARTOES.md`.

### 4.7 Retrospectiva da temporada (PR 2)

Na linha do tempo, cada temporada que já pode tê-la ganha o botão
"Retrospectiva {ano}", e a mais recente (o ano passado, ou o corrente) ganha
a faixa "Sua temporada {ano} num cartão" (âncora `carreira-retrospectiva`).
O cartão é o `MedalCard`/`MedalCardDialog` no modo `temporada`
(`buildSeasonCard`, `trophies/domain/medalCard.js`): torneios, dias de jogo,
ouro/prata/bronze e a **parceria da temporada** (`bestPartnership`: quem mais
jogou junto, depois mais medalhas juntos — das duplas dos torneios de fora e
dos pódios da plataforma; o "É este" conta uma vez só; a mesma pessoa com
conta e só com o nome digitado é uma). Limite conhecido: da plataforma só
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

## 5. Outros lugares

- **Minha área**: seção `carreira` (grupo "Você", `userAreaSections` com
  `carreira: flag`), `CareerAreaSection` — contagens, o último registro com o
  que falta ("N de 4", com os balanços lidos; sem eles a conta não aparece) e
  os atalhos. Ver `docs/41-MINHA-AREA.md`.
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
  `dataExport.js`, com as fontes que falharam ditas (`careerExportService`).
- **Exclusão de conta**: `career_events` por `uid` e o prefixo `carreira/`
  do Storage (`functions/accountDeletion.js`); a guarda
  `exclusaoCobreColecoes` cobre o prefixo `career_`.
- **Ajuda**: artigos `carreira-registrar`, `carreira-balanco` (o balanço, o
  bloco de Meu desempenho e a retrospectiva) e `carreira-selos` (parte
  Atleta), pistas de rota `/carreira` e `/meu-desempenho` e o guia
  `carreira-registrar` (âncoras `carreira-registrar`,
  `carreira-registrar-formato`, `carreira-lista`, `carreira-foto`,
  `carreira-balanco`, `carreira-abas`) — todos com `flags: ['athlete_career']`.
- **E2E**: `tests/e2e/logado.spec.js`, teste "Minha carreira" (liga a flag,
  abre as duas abas e `/meu-desempenho?declarados=1`).

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

## 6. O que não pode regredir

1. **Declarado nunca pontua**: nenhum motor de ranking, rating, federação ou
   XP lê `career_*` (guarda `carreiraNaoPontua.test.js`).
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

## 7. Fora destes PRs

Abas "Próximos" e "Metas", ranking da carreira, visão do professor, card
no início, XP da ficha, vitrine pública, dupla sem conta (convite por link)
e importação do DUPR.

**Pendências registradas na revisão do PR 1:**

- **Vitrine pública (antes dela)**: o selo Oficial confere só que a pessoa
  JOGOU o torneio da plataforma; a colocação continua a declarada. Antes de
  qualquer cartão público, a colocação do vínculo oficial tem de vir do pódio
  (`modalityPodium`), ou o selo diz só "torneio da plataforma".
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
