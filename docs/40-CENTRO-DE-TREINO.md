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
  montagem, passo a passo, dicas, **certo ao lado do errado**, erros e
  correção, fases do movimento, variações, meta, segurança e mídia. Autoria
  sempre visível ("Equipe PickleRush", "Professor X", o nome do atleta, selo
  "IA"). Ações: pôr no treino, registrar, salvar, copiar e adaptar, indicar,
  enviar aos alunos (professor), perguntar ao professor, editar/excluir (autor),
  denunciar. **Seção vazia nunca aparece.**
- `/treino/novo` e `/treino/item/:id/editar` — o **editor** (um formulário,
  por seções, só as que valem para o tipo), com medidor de qualidade, prévia,
  rascunho no aparelho, editor de diagrama, mídia por link ou envio, e "Criar
  com IA".
- `/treino/planos/:id` — o plano semana a semana.

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
| Publicar na biblioteca | sim, **passa por revisão** (padrão) | sim, **publica direto** (padrão) | sim, como "Equipe PickleRush" |
| Criar "Só meus alunos" | — | sim (vínculo **ativo**) | — |
| Indicar a outro atleta (`indicacao`) | o próprio item ou item público aprovado | idem | idem |
| Enviar para aluno, com prazo (`aluno`) | — | **só** para aluno com vínculo ativo | — |
| Editar/excluir | o próprio | o próprio | qualquer um (não troca o autor) |
| Ocultar, destacar, aprovar/recusar | — | — | sim, com auditoria |
| Perguntar | ao próprio professor ativo | responde aos alunos | lê |

A revisão é configurável (`platform_settings/training`): `public_review_atleta`
(padrão ligada), `public_review_professor` (padrão desligada) e
`allow_public_athlete` (o admin pode fechar a publicação de atletas). Cada
pessoa tem no máximo `max_pending_per_user` itens esperando revisão.

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
| `training_items/{id}` | O item (autoria, visibilidade, revisão, conteúdo). Semente: `pickle_<slug>` | autor; público aprovado não oculto; quem está em `shared_uids`; aluno ativo do autor ("só alunos"); admin | autor (sem tocar autoria/moderação); admin |
| `training_shares/{id}` | Indicação ou envio de professor (com prazo), lido/feito | quem mandou, quem recebeu, admin | quem manda (cria); quem recebe (só lido/feito) |
| `training_sessions/{id}` + `comments/` | O diário. **Nenhum campo de saúde** (o texto avisa) | dono; o professor com quem a sessão foi compartilhada, enquanto o vínculo estiver ativo; admin | dono; o professor só confirma e comenta |
| `training_plans/{id}` | Plano de semanas | dono, admin | dono |
| `training_meta/{uid}` | Favoritos, rotina, domínio por item, autoavaliações | dono, admin | dono |
| `training_questions/{id}` + `messages/` | Dúvida privada aluno ↔ professor | os dois, admin | quem pergunta abre (vínculo ativo); mensagens só se acrescentam |
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

`src/modules/training/content/seed.js` — cerca de 80 itens da "Equipe
PickleRush" (drills, físicos, jogadas, fundamentos, treinos e estudos), escritos
no modelo do §4. **Só import dinâmico** (guarda de fonte): ela não entra no
pacote de quem só abre o app. Instalar é ato do admin (Painel → Treino →
Biblioteca inicial).

## 9. Privacidade

- Diário sem campo de saúde, com aviso na tela (`SESSION_HEALTH_HINT`).
- Exportação de dados ("Baixar meus dados") inclui as coleções do treino.
- Exclusão de conta (`functions/accountDeletion.js`) cobre as coleções do
  treino e a pasta `treino/{uid}/` do Storage (ver
  `docs/20-SEGURANCA-E-PRIVACIDADE/18-CADASTROS-ADMIN.md`).
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
6. **Âncoras de dica** (`data-dica="treino-…"`) são contrato do guia de dicas.

## 11. Fica para depois

- Arena e clube como emissores de conteúdo.
- Validação do arquivo enviado também no servidor (função ao finalizar o envio).
- XP do treino confirmado pelo professor, pelo servidor.
- Apagar do Storage o arquivo de um item que o ADMIN excluiu (o autor que
  remove a mídia já apaga).
