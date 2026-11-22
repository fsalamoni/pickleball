# 58 — Avatar do jogador (criado por IA)

> Flag `avatar_creator` (default **OFF**, só o admin liga). Rota `/avatar`.
> Módulo `src/modules/avatar/`, servidor `functions/avatarAi.js`.
> Conferido no código em 2026-11-22.

## 1. O que é

Cada pessoa cria o **próprio jogador de pickleball** num desenho 3D estilizado
(o estilo dos avatares do celular: pele lisa, olhos grandes, cabelo esculpido).
Ela **toca em opções** — pessoa, cabelo, roupa, acessórios, raquete, pose e
fundo — e a imagem é criada na hora por um **serviço de inteligência
artificial**. O avatar pode virar a **foto do perfil**; aí ele aparece em toda
a plataforma (ranking, jogos, torneios, clubes) sem que nenhuma lista tenha
sido alterada, porque a imagem dele vira o `photo_url`.

### 1.1 Por que por IA (a história)

O dono pediu avatares "de extrema qualidade, como os do iPhone e do WhatsApp".
Três caminhos foram feitos e **recusados por ele em 2026-11-22**, nesta ordem:
o desenho 2D em SVG, o boneco 3D modelado em código com a three.js (PR #433,
chegou a ser publicado atrás da flag desligada) e um protótipo quase realista
sobre malha aberta. Nenhuma arte desenhada em código nem malha aberta chega ao
acabamento pedido; uma imagem gerada chega. O boneco 3D e a three.js **saíram
do código** neste PR.

O que o caminho por IA custa, e como é contido:

| Custo | Como é contido |
|---|---|
| Cada imagem é cobrada pelo provedor | limite por pessoa (dia e mês) e **teto do mês da plataforma**, conferidos no servidor |
| O resultado varia a cada criação | "Manter o rosto e mudar o resto" edita a partir da imagem-base guardada |
| A imagem é parada (não gira nem anima) | fora do escopo; ver §8 |
| Um terceiro recebe um pedido | o pedido é escrito pelo servidor só com ids do catálogo: nada pessoal sai (§5) |

## 2. Onde aparece

| Lugar | O quê |
|---|---|
| `/avatar` (`V2AvatarStudio`) | o criador: escolhas, criar, salvar, usar como foto, baixar |
| Minha área (`UserArea`, âncora `perfil-avatar`) e Editar perfil | o atalho "Criar avatar" / "Editar avatar", só com a flag |
| Toda a plataforma | a miniatura do avatar, **quando a pessoa o escolheu como foto** (é o `photo_url`) |
| Painel admin → Avatares → **Criador** (`AdminAvatarAiTab`) | ligar, chave do provedor, modelo, qualidade, limites, uso do mês |
| Painel admin → Avatares → **Raquetes de marca** (`AdminAvatarCatalogTab`) | as raquetes patrocinadas |

A seção Avatares do Painel admin **não depende da flag**, de propósito: o admin
salva a chave e os limites **antes** de ligar a funcionalidade para todos.

## 3. Dados

Nenhuma regra nova do Firestore nem do Storage. O que existe:

| Onde | O quê | Quem lê | Quem grava |
|---|---|---|---|
| `users/{uid}.avatar` | `{ v, recipe, url, full_url, path, full_path, as_photo, photo_backup, updated_at_ms }` | o dono | o dono |
| `athlete_profiles/{uid}.avatar` | `{ recipe, full_url, updated_at_ms }` só quando o avatar É a foto (`publicAvatar`); senão `null` | conta logada | o dono (espelho) |
| Storage `uploads/{uid}/avatar/` | a miniatura (384 px, a foto do perfil) e a imagem inteira (1024 px) do avatar **salvo** | regra de `uploads` | o dono |
| `platform_settings/avatar_catalog` | `brand_paddles[]` (§6) | todos | o admin |
| `platform_settings/avatar_ai` | `{ enabled, model, quality, per_day, per_month, platform_month, has_key, updated_at_ms, updated_by }` | todos | **só o servidor** (ação `config_save`) |
| `platform_secrets/avatar_ai` | `{ api_key }` — a chave do provedor | **ninguém pelo cliente** (nem o admin) | só o servidor |
| `avatar_usage/{uid}` | contagem do dia e do mês, trava "uma por vez", `base_recipe`, `last_recipe`, `last_ms`, `total` | **ninguém pelo cliente** | só o servidor |
| `avatar_usage/_platform` | contador do mês da plataforma | idem | só o servidor |
| Storage `avatar-ia/{uid}/base.jpg` e `last.jpg` | a imagem-base ("manter o rosto") e a última criada (recuperar a não salva) | **ninguém pelo cliente** (sem regra: negado) | só o servidor |

`avatar_usage` e `avatar-ia/` não têm regra (o padrão nega tudo): a tela sabe o
que precisa pela própria callable (`status`, `last`). Na **exclusão de conta**
(`functions/accountDeletion.js`) saem `avatar_usage/{uid}` e a pasta
`avatar-ia/{uid}/`; as imagens salvas saem com `uploads/{uid}/`.

### 3.1 A receita

`users.avatar.recipe` guarda **só ids do catálogo**, o sim/não das sardas e o
id da raquete de marca — nenhum texto livre (`normalizeRecipe`,
`domain/recipe.js`, versão 2). É isso que permite pô-la no espelho público e,
principalmente, é dela que o servidor escreve o pedido da imagem. Receita
antiga (a do boneco 3D, v1) ou adulterada cai no padrão campo a campo; nada
antigo é migrado, e a imagem já salva de quem tinha o boneco continua valendo.

Os campos: `body`, `age`, `build`, `skin`, `face`, `eyeColor`, `freckles`,
`hair`, `hairColor`, `beard` (a **pessoa** — `IDENTITY_FIELDS`), e `glasses`,
`headwear`, `headwearColor`, `top`, `topColor`, `bottom`, `bottomColor`,
`paddleColor`, `paddleBrand`, `expression`, `pose`, `background`, `frame` (o
**visual**). Catálogo em `domain/catalog.js`.

⚠️ **Os ids do catálogo são gravados**: nunca renomeie; opção nova entra no fim.

## 4. Como a pessoa usa (`/avatar`)

1. Escolhe nas abas Pessoa · Cabelo · Roupa · Acessórios · Raquete · Pose ·
   Fundo (`AvatarStudio`). "Surpreenda-me" sorteia o visual (`randomLook`) sem
   gastar criação.
2. **Criar avatar**: a tela manda `{ recipe, keep: false }`; em cerca de meio
   minuto a imagem aparece. A tela mostra quantas criações restam hoje.
3. **Salvar avatar**: a página recorta a miniatura (`thumbCrop`: no corpo
   inteiro a foto é o rosto), envia as duas imagens e grava `users.avatar`
   (`avatarSaveUpdate`). Com "Usar como foto do perfil", o `photo_url` passa a
   ser a miniatura e **a foto de verdade fica em `photo_backup`**.
4. **Manter o rosto e mudar o resto** (aparece depois do primeiro avatar criado
   do zero): `keep: true`. A pessoa (os `IDENTITY_FIELDS`) vem da receita-base
   guardada no servidor; as abas Pessoa e Cabelo não mudam nada.
5. Criou e saiu sem salvar? Ao voltar, a tela oferece **ver o avatar** de novo
   (ação `last`): a criação já foi paga, não se perde.

Estados que a tela separa: consulta falhou (`V2ErrorState` com tentar de novo —
nunca "indisponível"), criador ainda não ligado pelo admin, limite atingido (o
botão trava e a frase diz qual limite) e flag desligada (`AvatarDesligado`:
quem usa o avatar como foto ainda **volta para a foto de antes**).

## 5. O servidor (`avatarAi`)

Callable `avatarAi` (`functions/avatarAi.js`, régua pura em
`functions/avatarAiPolicy.js`), ações por chave própria (`Object.hasOwn`):

| Ação | Quem | O que faz |
|---|---|---|
| `status` | conta logada | disponível? quantas restam hoje e no mês, `last_ms`, `base_recipe` |
| `generate` | conta logada | reserva a criação, escreve o pedido, chama o provedor, guarda `last.jpg` (e `base.jpg` se do zero), devolve a imagem em base64 |
| `last` | conta logada | devolve a última imagem criada (a não salva) |
| `config` | admin | a configuração, **sem a chave** (só `has_key` e os 4 últimos caracteres) e o uso do mês |
| `config_save` | admin | grava configuração e/ou chave; recusa ligar sem chave; auditoria `avatar_ai_config_changed` (sem a chave) |

O que **não pode regredir**:

1. **Nenhum texto e nenhuma imagem do navegador chega ao provedor.** A tela
   manda ids; `buildPrompt` os troca por frases fixas em inglês (tabela `FRAG`).
   A edição usa a `base.jpg` que o próprio servidor guardou — aceitar imagem
   enviada faria da função um editor gratuito de fotos alheias. O nome escrito
   na raquete de marca vem do cadastro do admin, limpo (`cleanWordmark`).
2. **Toda criação é reservada numa transação antes da chamada** (limite do dia
   e do mês da pessoa, teto do mês da plataforma, uma por vez com trava que
   vence sozinha) e **devolvida se a chamada falhar** — a pessoa não perde a vez
   por erro do provedor nem por recusa da moderação.
3. **A chave nunca sai do servidor**: não vai na resposta nem no log, e a tela
   do admin só a escreve.
4. Dia e mês dos limites são os de **Brasília**.
5. O catálogo, a receita padrão, os campos da pessoa e os padrões da
   configuração têm **cópia no servidor com paridade**
   (`functions/avatarAi.parity.test.js`): opção nova entra nos dois lados, com a
   frase dela em `FRAG`.
6. O provedor recebe um `safety_identifier` embaralhado (hash do uid): barra
   abuso sem saber quem é a pessoa.

Provedor: API de imagens da OpenAI (`/v1/images/generations` do zero,
`/v1/images/edits` no "manter o rosto"), 1024 × 1024, JPEG. O modelo e a
qualidade são do admin (`platform_settings/avatar_ai`); os padrões estão em
`DEFAULT_CONFIG`.

## 6. Raquetes de marca

`platform_settings/avatar_catalog.brand_paddles[]` (até 40), cada item limpo
por `normalizeBrandPaddle`: marca, modelo, nome escrito na face (até 14),
formato, **duas cores** (face e segunda cor), link `https`, ligada e datas. A
raquete é **descrição**, não imagem enviada: o servidor a põe no pedido
(formato, cores e o nome na face). Na tela ela aparece sempre com o selo
**"Patrocinado"**; marca que não carregou não trava o criador. O servidor
confere de novo se a raquete está **no ar** na hora de criar. Os campos `art`,
`edge`, `grip` e `ink` do cadastro antigo seguem gravados, sem uso.

## 7. O que depende do dono para ligar

1. Criar a chave da API de imagens no provedor e colá-la em **Painel admin →
   Avatares → Criador** (a conta do provedor pode exigir verificação da
   organização para o modelo de imagem).
2. Conferir os limites (padrão: 3 por dia e 15 por mês por pessoa; 2.000 por
   mês na plataforma) e ligar "Criador ligado".
3. A política de privacidade passar a **nomear o provedor** de imagens.
4. Ligar `avatar_creator` em Painel admin → Funcionalidades.

## 8. O que ficou de fora

- **Movimento** (girar, animar): uma imagem não se move. Voltaria com arte 3D
  contratada, que não pode morar neste repositório (público).
- **Avatar a partir de uma selfie**: só com consentimento explícito (LGPD) e
  revisão de privacidade própria.
- Figurinhas, fundo transparente e conjunto de expressões da mesma pessoa.
- Limpeza das imagens antigas em `uploads/{uid}/avatar/` (cópias do
  `photo_url` vivem em inscrições e membros de clube).
- Esconder o atalho "Criar avatar" enquanto o criador não está configurado: por
  isso a ordem do §7 (chave antes da flag).

## 9. Testes

| Arquivo | O que prova |
|---|---|
| `functions/avatarAi.test.js` | pedido só com frases do catálogo; limites; reserva e devolução; trava; flag/config/chave; marca fora do ar; "manter o rosto" só com a base do servidor; `last`; admin e segredo da chave |
| `functions/avatarAi.parity.test.js` | catálogo, receita, campos da pessoa e configuração iguais nos dois lados |
| `src/modules/avatar/domain/*.test.js` | receita, raquetes de marca, o avatar no perfil (foto guardada) |
| `src/v2/pages/V2AvatarStudio.runtime.test.jsx` | a tela manda só as escolhas; limite trava; falha não vira "indisponível"; salvar guarda a foto de antes; recuperar a não salva; flag desligada devolve a foto |

A exclusão de `avatar_usage/{uid}` e de `avatar-ia/{uid}/` está nas listas
`DELETE_BY_ID` e `STORAGE_PREFIXES` de `functions/accountDeletion.js`. O guarda
`exclusaoCobreColecoes` não a enxerga (ele lê o `firestore.rules`, e a coleção
não tem regra): ao criar outra coleção só do servidor, lembre da lista à mão. A
exportação de conta não leva `avatar_usage` (são contadores; o avatar em si
está em `users.avatar`, que já é exportado).
