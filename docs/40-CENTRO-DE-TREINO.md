# 40 — Centro de Treino (flag `training_center`)

> Flag `training_center` — **padrão DESLIGADA**. Desligada, nada aparece:
> `/treino` volta para o início, o card do início, a seção do admin, os artigos
> de ajuda e as dicas somem. Nenhuma tela antiga muda.
> Módulo: `src/modules/training/` (domínio, serviços, hooks, semente).
> Telas: `src/v2/pages/V2Training*.jsx` e `src/v2/components/training/`.
> Admin: `src/v2/components/admin/training/` (Painel admin → Treino).
> Regras: `firestore.rules` (bloco "Centro de Treino") e `storage.rules`
> (`treino/{uid}/`), provadas em `tests/rules/training.rules.test.js` e
> `tests/rules/storage.rules.test.js`.

## 1. O pedido, em uma frase

*"Um Centro de Treino completo para o atleta organizar, planejar e registrar
treinos e drills, tirar dúvidas e aprender jogadas, com texto, imagens e
vídeos; professores e qualquer usuário criando conteúdo com autoria visível,
público, privado ou só para os alunos; compartilhar e indicar entre atletas; a
remessa para alunos só do professor; e o admin com controle total."*

## 2. O que a pessoa encontra

`/treino` é uma página só, com as abas na URL (`?aba=`) em três grupos
(`V2SectionNav`, quebra em linhas, nunca rola para o lado):

| Grupo | Aba (`?aba=`) | Para quê |
|---|---|---|
| **Treinar** | `hoje` (padrão) | O treino do dia: plano ativo › recebido com prazo › recomendação pelo foco e pelo nível. Começar, "Modo quadra" (tela acesa, cronômetro por bloco), registrar |
| | `planos` | Planos de 1 a 16 semanas (assistente ou à mão). O plano ativo alimenta o Hoje |
| | `diario` | O que foi feito, semana a semana, planejado × feito (sem vermelho: "ficou para depois" nunca é falha). Compartilhar a sessão com o professor, comentários |
| | `evolucao` | Minutos e carga por semana (sRPE = RPE × minutos), monotonia, minutos por área, autoavaliação a cada 4 semanas, domínio dos itens. Mostra números, **não afirma causa** |
| **Conteúdo** | `biblioteca` | Tudo o que a pessoa pode ver: plataforma, professores, comunidade, o que o professor mandou. Busca, filtros (tipo, habilidade, nível, local, origem), destaques |
| | `meus` | O que a pessoa criou, com o estado de cada um (rascunho privado, esperando revisão, publicado, recusado com o motivo) |
| | `recebidos` | Indicações e envios do professor (com prazo; marcar como feito). Subaba "Enviados" |
| **Conversa** | `duvidas` | Perguntas privadas ao professor ativo, em conversa |
| | `alunos` | Só professor: os alunos ativos, o que receberam e fizeram, sessões compartilhadas (confirmar, comentar) |

Mais três rotas:

- `/treino/item/:id` — a **ficha**: diagrama primeiro, depois objetivo,
  montagem, passo a passo, **o corpo ponto a ponto** (fundamentos e jogadas),
  dicas, **certo ao lado do errado**, erros e correção, **"Fiz certo?"**, fases
  do movimento, variações, meta, segurança e mídia. Com seis seções ou mais, um
  índice **"Nesta ficha"** no topo (rola com `rolarAte`, nunca por `#`). O
  golpe da trilha mostra a posição dele na família (anterior/próximo) e os
  **drills para treinar este golpe** (`relatedDrills`). Autoria
  sempre visível ("Equipe PickleRush", "Professor X", o nome do atleta, selo
  "IA"). Ações: pôr no treino, registrar, salvar, copiar e adaptar, indicar,
  enviar aos alunos (professor), perguntar ao professor, editar/excluir (autor),
  denunciar. **Seção vazia nunca aparece.**
- `/treino/novo` e `/treino/item/:id/editar` — o **editor** (um formulário,
  por seções, só as que valem para o tipo), com medidor de qualidade, prévia,
  rascunho no aparelho, editor de diagrama, mídia por link ou envio, e "Criar
  com IA".
- `/treino/planos/:id` — o plano semana a semana. Editar o dia é uma lista
  em ordem (subir, descer, tirar), **"Acrescentar da biblioteca"** abre o
  seletor (`ItemPickerDialog`: busca, tipo, "do meu nível", "salvos", vários de
  uma vez na ordem dos toques, até o máximo do dia), o **tempo do dia** contra
  os minutos do plano (`slotFit`, "passa N min" em âmbar, nunca bloqueia),
  **"Repetir nas próximas semanas"** (`repeatSlotInWeeks`) e, no dia de hoje,
  **"Treinar agora"** (Modo quadra com os itens do dia, e o registro já
  preenchido com o tempo cronometrado). Pôr um item no plano a partir da ficha
  mostra cada dia como livre, "N itens", "dia cheio" ou "já está neste dia".
- `/treino/golpes` — a **trilha dos golpes** (`V2TrainingTechniques`): os
  golpes e movimentos numa ordem de aprender, em sete famílias (base, saque e
  devolução, fundo, transição, cozinha, rede, avançados), com o domínio que a
  pessoa marcou, o **próximo golpe** ("Continue de onde parou" quando há um
  "Aprendendo") e o filtro "Só os que faltam dominar". Domínio que não carregou
  não vira "nada dominado": a trilha aparece sem ele. Domínio puro em
  `domain/techniqueTrail.js` (`TRAIL_FAMILIES`, `buildTechniqueTrail`,
  `trailPosition`, `relatedDrills`); o fundamento de outro autor entra pela
  habilidade principal, no fim da família. Chega-se pela faixa no topo da
  Biblioteca.

### 2.1 Entradas e links que as telas trocam entre si

| Link | Faz |
|---|---|
| `/treino?aba=diario&registrar=<item>` | Abre o registro já com o item |
| `/treino?aba=planos&adicionar=<item>` | Escolhe o plano/dia para pôr o item |
| `/treino?aba=duvidas&nova=1&item=<item>` | Abre a pergunta ao professor sobre o item |
| `/treino?aba=biblioteca&habilidade=&tipo=&q=` | Biblioteca já filtrada |
| `/treino/novo?tipo=<kind>` · `?copiar=<item>` · `?como=plataforma` | Criar de um tipo · copiar e adaptar (com crédito) · admin criando como "Equipe PickleRush" |
| `/treino/item/<id>?enviar=1` | Abre o envio/indicação na ficha |

O Treino é alcançado pela **Minha área** (`docs/41-MINHA-AREA.md`), pelo card
"Treino" do início (catálogo `home_cards`, não vem ligado) e, com a flag, pelo
interesse "Organizar meu treino" (atalho do início). Não entrou na barra
inferior, de propósito: ela já tem cinco destinos.

## 3. Quem pode o quê

| Ação | Atleta | Professor (`coaches/{uid}`) | Admin da plataforma |
|---|---|---|---|
| Criar item privado ("Só eu") | sim | sim | sim |
| Publicar na biblioteca | sim, **passa por revisão** (padrão) | sim, **passa por revisão até o admin verificar o professor**; verificado, publica direto (padrão) | sim, como "Equipe PickleRush" |
| Criar "Só meus alunos" | — | sim (vínculo **ativo**) | — |
| Indicar a outro atleta (`indicacao`) | o próprio item ou item público aprovado | idem | idem |
| Enviar para aluno, com prazo (`aluno`) | — | **só** para aluno com vínculo ativo | — |
| Editar/excluir | o próprio | o próprio | qualquer um (não troca o autor) |
| Ocultar, destacar, aprovar/recusar | — | — | sim, com auditoria |
| Perguntar | ao próprio professor ativo | responde aos alunos | lê |

A revisão é configurável (`platform_settings/training`): `public_review_atleta`
(padrão ligada), `public_review_professor` (padrão **ligada**) e
`allow_public_athlete` (o admin pode fechar a publicação de atletas). Cada
pessoa tem no máximo `max_pending_per_user` itens esperando revisão.

**Professor verificado** (decisão do dono, 2026-10-09). Qualquer conta pode
criar o próprio `coaches/{uid}` ("Sou professor"), então o professor também
passa pela fila até a equipe verificá-lo. Na Revisão, **"Aprovar e verificar o
professor"** publica o item e põe a pessoa em `verified_professors` (lista no
mesmo documento, que só o admin escreve); daí em diante o público dela entra
direto. A lista aparece em Configurações → "Professores verificados", com
"Remover" (o que já foi aprovado continua; a próxima edição volta à fila).
**A regra confere** (`trainingAutoApproved`): professor fora da lista gravando
`aprovado` é recusado. A lista fica fora de `settingsPatch`: o "Salvar" e os
"Padrões de fábrica" das configurações não a tocam.

**Copiar e adaptar** dá crédito (`derived_from`) e tem uma trava conferida
**pela regra**, não pelo formulário: a cópia de algo que não estava aberto a
quem copiou (o "só alunos" de um professor) **nunca** vira pública — é o que
impede a "lavagem" do conteúdo exclusivo.

## 4. O modelo do item (o que a técnica pede)

A pesquisa (`pesquisa-modelo-drill`, 29 fontes: federações, cursos de
treinador e aprendizagem motora) mostrou que todo cartão sério tem os mesmos
blocos. Viraram os campos do item e as seções do editor e da ficha:

| Bloco | Campo | Por quê |
|---|---|---|
| Objetivo | `objective` | Diz o que muda no jogo |
| Montagem | `setup`, `players_*`, `roles`, `equipment`, `place`, `duration_min` | Organização antes da atividade |
| Passo a passo | `steps[]` (≤ 15) | A atividade em ordem |
| Dicas curtas | `cues[]` (≤ 8, ≤ 120 car.) | **Foco externo** (bola, alvo, trajetória), uma por vez — `cueWarnings` avisa dica longa ou voltada ao corpo |
| Certo × errado | `positioning[]` | O errado **só ajuda ao lado do certo** — `positioningWarnings` avisa errado sozinho |
| Erros comuns | `common_errors[] {error, fix}` | Erro sempre com a correção |
| Técnica ponto a ponto | `technique.checkpoints[] {part, text}` (≤ 8, ≤ 300 car.) + `technique.self_check[]` (≤ 6, ≤ 200 car.) | Fundamento e jogada: o que cada parte do corpo faz (`TECHNIQUE_PARTS`: empunhadura, olhar, pés, pernas, tronco, braço, punho, raquete) e como a pessoa confere sozinha se fez certo. Sem lista fechada na regra: campo opcional, item antigo sem ele segue igual |
| Relação motora | `motor.phases` (preparação/execução/finalização) + `motor.abilities` | Fases do golpe e capacidades (coordenação, equilíbrio, tempo de reação…) |
| Variações | `variations {easier, harder}` | Regressão/progressão (alavancas STEP: espaço, tarefa, equipamento, pessoas) |
| Meta | `metric {type, target}` + `success_criteria` | Mensurável ("10 dinks seguidos") |
| Segurança | `safety` | Aquecimento, queda, entrada na cozinha |
| Diagramas | `diagrams[]` (≤ 4, ≤ 24 elementos, `neutro`/`certo`/`errado`) | Sinalização: setas e destaques no lugar certo |
| Mídia | `media[]` (≤ 8, `demo`/`certo`/`errado`) | Imagem ou vídeo curto, com legenda |

Por tipo: **treino** em blocos (aquecimento → técnica → tática → jogo → volta à
calma, cada bloco podendo apontar um item); **físico** com séries, repetições,
descanso e cadência; **estudo** com o tipo (regra, vídeo, leitura), a edição e
a seção da regra, link e perguntas; **fundamento/jogada** com "quando usar".

O **medidor de qualidade** (`itemQuality`) lista o que falta e nunca impede
salvar. A IA preenche o MESMO formato: `buildAiPrompt` monta o pedido (com
exemplo e enums fechados), a pessoa cola a resposta, e `parseItemsJson`
**valida localmente** — a saída estruturada garante o formato, não os limites.
O item criado assim leva o selo "IA" (`ai_assisted`) e o texto da tela pede
revisão antes de publicar.

## 5. Dados — sete coleções novas, zero índice composto

Toda consulta é por igualdade ou `array-contains`, com ordenação em memória
(guarda `indicesCompostos.test.js`).

| Coleção | O que guarda | Quem lê | Quem escreve |
|---|---|---|---|
| `training_items/{id}` | O item (autoria, visibilidade, revisão, conteúdo). Semente: `pickle_<slug>` (id reservado: só o admin cria) | autor; público aprovado não oculto; quem está em `shared_uids`; aluno ativo do autor ("só alunos"); admin | autor (sem tocar autoria/moderação); admin |
| `training_shares/{id}` | Indicação ou envio de professor (com prazo), lido/feito | quem mandou, quem recebeu, admin | quem manda (cria; "como professor" só com `coaches/{uid}`); quem recebe (só lido/feito) |
| `training_sessions/{id}` + `comments/` | O diário. **Nenhum campo de saúde** (o texto avisa) | dono; o professor com quem a sessão foi compartilhada, enquanto o vínculo estiver ativo; admin | dono; o professor só confirma e comenta |
| `training_plans/{id}` | Plano de semanas | dono, admin | dono |
| `training_meta/{uid}` | Favoritos, rotina, domínio por item, autoavaliações | dono, admin | dono |
| `training_questions/{id}` + `messages/` | Dúvida privada aluno ↔ professor | os dois, admin | quem pergunta abre (vínculo ativo) e apaga a conversa inteira; mensagens só se acrescentam |
| `training_reports/{id}` | Denúncia de conteúdo | quem denunciou, admin | qualquer conta cria; admin resolve |

E um documento: `platform_settings/training` (regra de `platform_settings`, que
já existia). Cinco tipos novos de aviso: `training_share`, `training_review`,
`training_comment`, `training_question`, `training_answer`.

**Duas correções em regras antigas (F0)**, que o treino exigiu porque passou a
decidir acesso pelo vínculo professor–aluno:

- `coach_students`: o id do vínculo tem de ser `{coach}_{aluno}` (antes qualquer
  conta gravava `{PROFESSOR}_{EU}` e lia o "só alunos" de outro professor), e o
  aluno só **aceita** o convite (`invited → active`) — antes reescrevia o
  documento inteiro, inclusive as notas privadas do professor.
- `coach_content`: o "só alunos" exige vínculo **ativo** (antes bastava existir,
  e o convidado que nunca aceitou lia).

**O vínculo vale enquanto o professor for professor do aluno** (decisão do
dono, 2026-10-09). Qualquer um dos dois encerra: status `ended`, com
`ended_at` e `ended_by` (o aluno em *Minhas aulas → Meus professores*; o
professor em *Alunos → Encerrar vínculo*). Com o fim, fecha tudo o que o
vínculo abria (só alunos, envios, diário compartilhado, dúvida nova) e a
conversa de uma dúvida fica só para consulta — a regra das mensagens também
exige vínculo ativo; ela ainda pode ser **encerrada** (não fica presa
"esperando resposta"), mas não reaberta. A tela pergunta pelo vínculo por
CONSULTA (`getStudent`), não por id: o `get` de um vínculo apagado seria
recusado em vez de dizer "não há vínculo". Com `ended_at` no documento, o professor só **convida de
novo** (`ended → invited`) ou desiste: não ativa, não pausa e não apaga (apagar
e recriar como ativo desfaria a saída do aluno). Quem reativa é o **aluno**, ao
aceitar o convite, e aí o `ended_at` sai. O botão de encerrar e reconvidar e o
bloco "Meus professores" saem atrás de `training_center` ou `user_hub`. A
exclusão da conta do aluno encerra o vínculo (`ended_reason: 'conta_excluida'`)
e aí o professor pode tirar a ficha da lista — a regra confere que
`users/{aluno}` não existe mais.
Vínculo sem `ended_at` segue exatamente como antes (o professor adiciona do
histórico de aulas como ativo, pausa, reativa e remove).

## 6. Mídia

- **Por link**: YouTube e Vimeo (`parseVideoUrl`, com início/fim) e imagem
  `https`. O vídeo abre por **fachada**: a miniatura só vira player
  (`youtube-nocookie.com`, `player.vimeo.com`) no toque — nada de terceiros
  carrega sem a pessoa pedir. Os cabeçalhos do Hosting liberam só esses dois
  `frame-src`.
- **Envio**: pasta `treino/{uid}/` no Storage. Imagem comprimida no aparelho
  (WebP ≤ 1600 px, sem GPS), ≤ 3 MB; vídeo mp4/webm/mov ≤ 60 MB e ≤ 60 s
  (medido antes de subir). A regra do Storage confere tipo e tamanho; o
  cliente confere duração e a cota (`max_uploads_per_user`). **Menor de 18 não
  envia** (link continua valendo). Tudo configurável pelo admin dentro do teto
  (`HARD_LIMITS`).

## 7. Admin — Painel admin → Treino

Conteúdo (tudo, com filtros; criar como plataforma; ocultar com motivo;
destacar; excluir), Revisão (aprovar/recusar com nota obrigatória — o autor é
avisado), Denúncias, Biblioteca inicial (instalar/atualizar a semente,
idempotente, sem recriar o que o admin apagou — `seed_removed`; importar JSON
em lote com prévia; pedido para IA) e Configurações. Toda escrita do admin vai
para `audit_logs`.

## 8. Biblioteca inicial

`src/modules/training/content/seed.js` — 127 itens da "Equipe
PickleRush" (drills, físicos, jogadas, fundamentos, treinos e estudos), escritos
no modelo do §4. **Só import dinâmico** (guarda de fonte): ela não entra no
pacote de quem só abre o app. Instalar é ato do admin (Painel → Treino →
Biblioteca inicial).

### 8.1 Versão 2 — os "100 drills" avaliados (2026-10-09)

O dono enviou um pacote de 100 drills (PDF + HTML, escrito com ajuda de IA) e
pediu a avaliação individual de cada um, com pesquisa, e a importação dos
adequados. Resultado, drill a drill, em
[`docs/40a-AVALIACAO-100-DRILLS.md`](40a-AVALIACAO-100-DRILLS.md): **45
importados, todos com correção** (regra de saque, poach, Erne/ATP, golpes
descritos ao contrário, segurança), **47 já existiam** e **8 rejeitados**; das
sessões da fonte, **2 viraram treino**. As imagens do pacote (posturas geradas
por IA) não entraram.

Os itens novos moram em `content/seed/importados-nivel1.js` … `nivel5.js` e
`treinos-importados.js`, com `version: 1` cada; `SEED_VERSION` foi a 2. Como
instalar é idempotente por slug, o admin clica em **Instalar/atualizar** e só
os 47 novos são criados — nada dos 80 de antes é regravado, e o que o admin
editou ou apagou continua como ele deixou.

### 8.2 Versão 3 — a trilha dos golpes (2026-10-10)

Pedido: *"inserir na biblioteca as ações e movimentos do pickleball, com
descrição clara e precisa de como eles são feitos… o que é certo e o que é
errado"*. Entraram **22 golpes e movimentos** (`content/seed/golpes-base.js`,
`golpes-saque-fundo.js`, `golpes-cozinha.js`, `golpes-rede.js`, `version: 1`):
empunhaduras eastern e western, olhar na bola, split step, deslocamento
lateral, avançar e recuar, saque drop, saque com efeito, drive de backhand,
topspin, slice, lob, passada, meio-voleio, dink de backhand, dink com efeito,
dink-voleio, voleio punch, bloqueio, defesa de corpo, speed-up, contra-ataque e
flick de backhand. Os **10 fundamentos** de antes e as jogadas **Erne** e
**ATP** ganharam a técnica ponto a ponto, com correções de regra (o saque não
tem mais *let* desde 2021; as regras do saque drop; a linha da cozinha é
cozinha; o ATP só depois do quique). Cada fundamento tem pelo menos 5 pontos do
corpo (partes diferentes) e 3 "fiz certo?" — `seed.test.js` confere, e confere
que todo slug da trilha existe. São 149 itens (32 fundamentos).
`SEED_VERSION` foi a 3: **o admin clica em Instalar/atualizar** para os novos
chegarem e os atualizados (versão maior, não editados pelo admin) serem
regravados.

## 9. Privacidade

- Diário sem campo de saúde, com aviso na tela (`SESSION_HEALTH_HINT`).
- **Exportação** ("Baixar meus dados", `collectTrainingExport` +
  `buildDataExport`): itens que a pessoa criou, diário com os comentários,
  planos, rotina e preferências (`training_meta`), envios nos dois sentidos,
  dúvidas (feitas e, para professor, recebidas) com as mensagens, denúncias que
  ela fez, a lista de arquivos em `treino/{uid}/` e as metas
  (`player_goals`). Cada parte falha sozinha: o que não veio vai escrito em
  `incomplete` e no aviso da tela — o arquivo nunca sai "completo" com um
  buraco calado. Fica de fora, de propósito e escrito no arquivo
  (`training.not_included`), o comentário que um PROFESSOR fez no diário de um
  aluno (mora no diário de outra pessoa, e a consulta não é provável pela
  regra). Com a flag desligada, a exportação é exatamente a de antes.
- **Exclusão de conta** (`functions/accountDeletion.js`, ver
  `docs/20-SEGURANCA-E-PRIVACIDADE/18-CADASTROS-ADMIN.md` §Excluir):

  **O conteúdo criado fica, com a autoria** (decisão do dono, 2026-10-09:
  *"o conteúdo criado não deve ser excluído e deve permanecer indicando a
  autoria do conteúdo"*). Sai o que é só da pessoa.

  | O que | Destino |
  |---|---|
  | Item **privado que ninguém mais recebeu** | apagado, com os arquivos |
  | Item público (aprovado, em revisão ou recusado), só para alunos ou compartilhado | **fica, com o nome de quem criou** e as fotos e vídeos; sai só a foto de perfil (mora em `uploads/{uid}/`, que é apagada). O "só para alunos" deixa de ter quem o leia (o vínculo acaba), mas fica guardado |
  | Cópia que outra pessoa fez de um item dela | o "copiado de" fica com o nome; perde só o link das mídias do item que foi apagado (o vídeo de fora fica); na cópia de uma cópia, que não é achada, a ficha diz "Não foi possível carregar" |
  | Diário (dela) e comentários | apagados |
  | Diário de ALUNO que ela acompanhava | fica com o aluno; sai o compartilhamento (`shared_coach_id`); **os comentários dela ficam**, com o nome |
  | Dúvidas que ela fez + mensagens | apagadas |
  | Dúvidas que respondeu como professor | **ficam como estão**, com as respostas e o nome (a conversa vira só leitura: sem vínculo ativo) |
  | Treinos que ela ENVIOU ou indicou | **ficam** na caixa de quem recebeu |
  | Planos, rotina, treinos que ela recebeu, acesso a itens alheios (`shared_uids`) | apagados / o uid sai da lista |
  | Conteúdo, pacotes e produtos do professor | **ficam guardados** (só aparecem no perfil dele, que sai) |
  | Cupons e campanhas do professor | **ficam, fora do ar** (`active` / `banner_active` = falso; a campanha também `status: 'cancelled'`, para a página dela não dizer que vale): seguiriam no carrossel do início oferecendo aula de quem não existe mais. A **arte enviada** (em `uploads/{uid}/`) fica, como a das campanhas de arena e dos cupons e campanhas da plataforma que a pessoa criou |
  | `promo_settings` (modelos e custo interno dos vales) | apagado |
  | Ficha de aluno na lista dela, como professora | apagada (ela deixou de ser professora dele) |
  | Ficha dela na lista de um professor, como ALUNA | o vínculo **encerra** (`ended_reason: 'conta_excluida'`) e o nome sai; o professor pode removê-la |
  | Denúncias (feitas ou sobre o conteúdo dela), aulas dadas e pacotes vendidos | **retidos como estão** (só o uid; registro de moderação e financeiro) |
  | Storage `treino/{uid}/` e `uploads/{uid}/` | apagados — menos a mídia dos itens que ficam (os dela e os da **plataforma** que ela, como admin, enviou) e a arte dos cupons e campanhas que ficam. Se a consulta do que fica bater no limite (400), a pasta fica **inteira** e a exclusão sai parcial: nunca se apaga arquivo de conteúdo que fica |

  O guarda `src/core/guards/exclusaoCobreColecoes.test.js` lê o
  `firestore.rules` e reprova coleção `training_*` (e `coach_content`,
  `coach_packages`, `coach_products`) que não esteja na exclusão, ou do treino
  que não esteja na exportação.
- **Push**: a categoria "Treino" silenciada nas Configurações também não chega
  no celular (`functions/notificationPrefs.js`, com teste de paridade contra o
  cliente).
- O treino registrado pelo próprio atleta **não dá XP** (seria fácil de
  inflar).

## 10. O que não pode regredir

1. **Falha não é vazio**: biblioteca, recebidos, diário e alunos só afirmam
   "nenhum" com a consulta em `isSuccess`; o conteúdo dos professores vem
   marcado `incompleto` quando um professor falhou.
2. **Autoria imutável** e moderação só do admin — a regra confere, não a tela.
3. **Remessa para aluno só com vínculo ativo**, conferido pela regra.
4. **Compartilhamento em lotes de 4** (`SHARE_BATCH`): cada indicação faz
   leituras de regra, e um lote do Firestore tem teto de 20 leituras de regra.
5. **A semente nunca entra no pacote principal** (import dinâmico).
6. **Âncoras de dica** (`data-dica="treino-…"`) são contrato dos guias
   `treino-*` e dos pontos `treino:*` (guarda `dicas.test.js`).
7. **Coleção nova do treino entra na exclusão e na exportação** (guarda
   `exclusaoCobreColecoes.test.js`).
8. **O slug é contrato da trilha**: `TRAIL_FAMILIES` lista `seed_slug`;
   renomear um golpe da semente o tira da trilha (o teste da semente reprova).

## 11. Fica para depois

> O **balanço do jogo** (perguntas depois de jogar + semana sugerida) é a
> flag `game_debrief`: ver `docs/42-BALANCO-DO-JOGO.md`.

- Arena e clube como emissores de conteúdo.
- Validação do arquivo enviado também no servidor (função ao finalizar o envio).
- XP do treino confirmado pelo professor, pelo servidor.
- Apagar do Storage o arquivo de um item que o ADMIN excluiu (o autor que
  remove a mídia já apaga).
- Exclusão de conta: professor com aula futura marcada não bloqueia a
  exclusão.
- Exportação: os comentários do professor no diário dos alunos.
