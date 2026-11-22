# 58 — Avatar do jogador (3D)

> Flag `avatar_creator` (default **OFF**, só o admin liga em Painel admin →
> Funcionalidades → "Avatar do jogador"). Módulo `src/modules/avatar/`
> ([README](../src/modules/avatar/README.md)). Rota `/avatar`.
> **Zero coleção nova, zero índice, zero regra nova, zero Cloud Function.**

## 1. O que é

Cada pessoa monta o próprio jogador de pickleball **em 3D** — rosto, cabelo,
expressão, roupa, raquete, acessórios, pose e fundo — e pode usá-lo como foto
do perfil. O avatar é **vivo**: respira e pisca sozinho, **gira com o dedo** e,
ao toque, faz o movimento da pose (saque por baixo, golpe de forehand,
comemoração, aceno).

O catálogo já aceita **raquetes de marca** (itens patrocinados), cadastradas
pelo admin da plataforma. O fluxo comercial (contrato, cobrança, métricas da
marca) **não existe**: só o cadastro e a exibição, sempre com o selo
"Patrocinado".

### 1.1 Por que 3D feito em código (e o limite disso)

A primeira versão foi um desenho 2D em SVG e foi **recusada pelo dono** em
2026-11-22 ("quero extrema qualidade, avatar perfeito e não algo 2D simples").
O avatar passou a ser 3D de verdade, com a three.js (MIT), **modelado por
código**: nenhuma malha vem de arquivo, nenhum serviço de terceiros participa.

- Por que não um serviço pronto: o Ready Player Me (a referência do setor)
  foi desligado em 31/01/2026; depender de serviço de fora para a foto de
  perfil de todo mundo é um risco que já se materializou no mercado.
- Por que não modelos de artista agora: não há artista 3D contratado, e cada
  roupa, cabelo e raquete pediria modelagem, rig e textura.
- **O limite, dito com honestidade**: o acabamento é de boneco de vinil
  (estilo "toy"), não o de um Memoji esculpido por uma equipe de arte. O motor
  aceita trocar uma peça por um modelo `.glb` de artista sem mudar a receita
  nem as telas (§8) — é o caminho para subir o nível visual.

## 2. Onde aparece

| Lugar | O quê |
|---|---|
| `/avatar` (`V2AvatarStudio`) | o estúdio: palco 3D + escolhas por assunto + salvar |
| Minha área (`UserArea`) | botão "Criar avatar" / "Editar avatar" (`data-dica="perfil-avatar"`); com o avatar como foto, o cartão mostra o avatar vivo |
| Editar perfil (`V2ProfileEdit`) | link "Ou crie um avatar de pickleball para usar como foto" |
| Perfil do atleta (`V2AthleteProfile`) | com o avatar como foto, o avatar vivo no lugar da foto |
| **Toda tela que mostra a foto** | a imagem do avatar, porque ela É o `photo_url` (ranking, jogos, torneios, ligas, clubes, cartões de campeão, chat) — nenhuma dessas telas foi alterada |
| Painel admin → Avatares → Raquetes de marca | cadastro dos itens patrocinados (`AdminAvatarCatalogTab`) |
| Central de Ajuda | artigo `avatar` (atrás da flag) e pista de rota `/avatar` |

O avatar **vivo** só é montado onde ele é o assunto (estúdio, Minha área,
perfil do atleta). Nas listas vai a imagem parada: é leve e funciona em cartão
impresso ou compartilhado.

Com a flag **desligada**: o estúdio some, a Minha área e o Editar perfil não
oferecem, o perfil mostra a foto (que, para quem usa o avatar, é a imagem
dele — continua aparecendo). Quem abre `/avatar` vê "não está disponível" e,
se o avatar era a foto, o botão **"Voltar para a minha foto"**: nada fica preso
a uma funcionalidade fechada.

## 3. Dados

Nada de coleção nova. Tudo em documentos e pastas que já existiam, com as
regras que já existiam.

| Onde | Campo | Quem escreve |
|---|---|---|
| `users/{uid}` | `avatar` (opcional) — abaixo | o dono |
| `users/{uid}` | `photo_url` — a imagem do avatar, **só se a pessoa escolher** | o dono |
| `athlete_profiles/{uid}` | `avatar: { recipe, full_url, updated_at_ms }` ou `null` | o dono (espelho, via `updateUserProfile`) |
| `platform_settings/avatar_catalog` | `brand_paddles[]`, `updated_at`, `updated_by` | só o admin da plataforma |
| Storage `uploads/{uid}/avatar/` | as duas imagens (rosto 512×512, corpo 680×1040; WebP, ou PNG onde o navegador não codifica WebP) | o dono |

```js
users/{uid}.avatar = {
  v: 1,
  recipe: { … },        // a RECEITA: só ids do catálogo, cores #rrggbb e o número do peito
  url, full_url,        // as duas imagens salvas
  path, full_path,      // caminhos no Storage
  as_photo: boolean,    // o avatar é a foto do perfil?
  photo_backup: string, // a foto de verdade, guardada para voltar
  updated_at_ms: number,
}
```

- **A receita não tem dado pessoal.** `normalizeRecipe` (`domain/recipe.js`)
  confere cada campo contra o catálogo e devolve só as chaves da receita:
  campo estranho não entra, valor desconhecido vira o padrão daquela parte
  (receita antiga ou adulterada nunca quebra o desenho).
- **O espelho público** (`publicAvatar`, `domain/publicAvatar.js`) só leva o
  avatar quando ele **é** a foto do perfil (`as_photo` **e** `photo_url ===
  avatar.url`) — trocar a foto por outra tira o avatar do espelho. Vai a
  receita, a imagem de corpo inteiro e a data; **nunca** `photo_backup` nem os
  caminhos do Storage. É um arquivo-folha sem imports de propósito: o perfil
  público é montado no login (pacote inicial) e o catálogo não pode ir junto.
- **A foto de verdade não se perde.** `avatarSaveUpdate`
  (`domain/profileAvatar.js`) guarda em `photo_backup` a foto que estava no
  perfil — e, se a foto atual já era um avatar, mantém a guardada (🐞 sem isso,
  salvar duas vezes guardaria o primeiro avatar como "foto de antes"). Voltar,
  usar de novo e apagar são `avatarRestorePhotoUpdate`,
  `avatarUseAsPhotoUpdate` e `avatarRemoveUpdate`.
- **Imagens antigas não são apagadas** ao salvar de novo: cópias do
  `photo_url` vivem em inscrições, membros de clube, jogos — apagar o arquivo
  quebraria a foto lá. Cada versão tem dezenas de kB.
- **Exclusão de conta**: `users/{uid}`, `athlete_profiles/{uid}` e a pasta
  `uploads/{uid}` já saem pela exclusão de sempre — nada novo a cobrir.

### 3.1 Raquetes de marca

`platform_settings/avatar_catalog.brand_paddles[]` (até 40), cada item limpo
por `normalizeBrandPaddle` (`domain/brandItems.js`):

`id` (`brand_…`, estável: a receita das pessoas aponta para ele), `brand`,
`name`, `wordmark` (o nome escrito na face, ≤ 14), `shape`, `art`
(`wordmark` · `stripe` · `split`), `color`, `color2`, `edge`, `grip`, `ink`,
`link_url` (**só https**), `active`, `starts_ms`, `ends_ms`.

- O item é **desenho, não imagem enviada**: formato, cores e o nome da marca
  escritos na raquete. Mantém o avatar leve e a imagem salva sem depender de
  arquivo de outro domínio.
- "No ar" = `active` e dentro da janela de datas (`isBrandItemLive`).
- A receita guarda só `paddleBrand: <id>`. Item fora do ar ⇒ `normalizeRecipe`
  devolve `null` e a pessoa volta a ter a própria raquete na próxima edição; a
  imagem já salva não muda sozinha.
- O selo **"Patrocinado"** aparece sempre ao lado do item no estúdio.
- Gravar passa por `saveAvatarCatalog`, que normaliza a lista e registra
  `avatar_catalog_changed` na auditoria.
- Se a leitura do catálogo falhar, o estúdio segue com as raquetes da casa e
  **diz** que as de marca não carregaram (marca é extra, não trava o avatar).

## 4. O que o avatar tem

Fonte única: `domain/catalog.js` (`RECIPE_OPTIONS`, uma lista por campo da
receita). **Os ids são gravados** — nunca renomeie; opção nova entra no fim.

Pele · formato do rosto · olhos e cor · sobrancelhas · nariz · bochechas ·
sardas · corte e cor do cabelo · barba e bigode · óculos · viseira, boné, boné
para trás, faixa e chapéu · parte de cima (camiseta, polo, regata, manga longa,
vestido), duas cores, estampa e marca no peito (com número) · parte de baixo ·
meias · tênis · munhequeira · raquete (formato, arte, quatro cores) ou raquete
de marca · bola · expressão · pose · fundo.

Poses (`domain/poses.js`): pronto, saque, raquete no ombro, comemoração e
aceno. Cada pose tem o seu movimento ao toque (`POSE_MOTION`): golpe, saque,
golpe, comemoração e aceno. Um movimento é uma lista de quadros-chave sobre a
pose de partida, interpolados por `poseAt`.

> 🐞 Quadro-chave que não cita uma junta **herda a pose de partida**: um quadro
> só com `ball: false` fazia o braço voltar de um salto no meio do saque. Todo
> quadro do meio leva os valores das juntas que estão em movimento (há teste).

## 5. Como é desenhado

```
src/modules/avatar/
├── domain/      puro, com teste: catalog, recipe, color, poses, brandItems,
│                profileAvatar, publicAvatar
├── three/       o 3D (só por import dinâmico):
│   ├── support.js    webglAvailable() — SEM three.js
│   ├── geom.js       superfícies por função, tubos, chapas com espessura
│   ├── tex.js        texturas em canvas (olhos, estampas, arte da raquete)
│   ├── head.js       cabeça, rosto, cabelo, barba, óculos, chapéus
│   ├── body.js       tronco, braços, pernas, roupa, raquete, bola
│   ├── character.js  monta o personagem e refaz só o que mudou
│   └── stage.js      cena, luz, câmera, laço de desenho, foto fora da tela
├── services/    avatarSnapshots (fila de fotos), avatarExport (imagem salva),
│                avatarService (envio e catálogo de marca)
├── hooks/       useAvatarCatalog
└── components/  Avatar3D (o vivo) e AvatarSnap (a foto parada)
```

- **Uma peça, um desenho**: `Character.update(recipe, paddle)` refaz só o
  grupo cujas chaves mudaram (cabeça, corpo ou raquete). Trocar a cor do tênis
  não reconstrói o cabelo.
- **Luz e material**: ambiente de estúdio (`RoomEnvironment` + PMREM), luz
  principal, de preenchimento e de contorno, tom neutro, sombra de contato no
  chão. O personagem olha para +z; a mão da raquete é a direita dele (à
  esquerda de quem olha).
- **Enquadramentos** (`VIEWS` em `stage.js`): `full` (corpo), `bust` (foto do
  perfil), `face` e `paddle` (só para as miniaturas do estúdio).

### 5.1 `Avatar3D` — o vivo

`<Avatar3D recipe view brandItems label fallback />` (ref: `play()`,
`resetView()`).

- A three.js e o palco entram por **import dinâmico**, só quando o componente
  aparece. Enquanto baixam — e onde o aparelho não desenha em 3D — fica o
  `fallback` (a foto de sempre, ou a imagem já salva). Nada pisca, ninguém
  fica sem ver.
- Arrastar gira (acima de 6 px é giro, abaixo é toque); tocar faz o movimento;
  duplo toque devolve o ângulo; **setas do teclado** giram. O botão tem nome
  acessível.
- Fora da tela (`IntersectionObserver`) ou com a aba escondida, o desenho
  **para** (bateria). Parado, desenha a 30 quadros; em movimento e giro, a 60.
- Com "reduzir movimento" ligado no aparelho: não respira, não pisca e o toque
  não anima (o giro segue).
- Contexto WebGL perdido ⇒ volta ao `fallback`.

### 5.2 `AvatarSnap` e a fila de fotos

As miniaturas do estúdio mostram **o próprio avatar** com cada opção (como o
Memoji), não um ícone genérico. Dezenas de canvas WebGL não cabem numa página
(o navegador mantém poucos contextos), então:

- **um palco só, fora da tela**, tira todas as fotos (`snapAvatar`);
- os pedidos entram numa **fila** (`avatarSnapshots.js`), saem um por vez e
  cedem a vez à tela entre um e outro — trocar a cor da pele redesenha uma
  dúzia de miniaturas sem travar o toque;
- pedido cancelado (a pessoa já mudou de novo) não é desenhado;
- as fotos ficam num cache pequeno (120), cuja chave (`snapKey`) leva a
  receita, o enquadramento, o tamanho **e a raquete de marca como ela está
  agora**;
- ao sair do estúdio, `releaseSnapshots()` devolve a memória.

### 5.3 A imagem salva

`renderAvatarBlob(recipe, { view })` usa a mesma fila (com prioridade e sem
cache) e gera WebP — ou PNG onde o navegador não codifica WebP. Tudo no
aparelho da pessoa: sem servidor, sem serviço de terceiros.

## 6. O estúdio (`/avatar`)

- **Palco** com o avatar vivo; alterna "Corpo" e "Foto" (como vai ficar no
  círculo do perfil). No celular o palco fica **preso no alto** enquanto as
  escolhas rolam por baixo — a pessoa vê o avatar mudar ao tocar numa opção — e
  o botão de salvar vai para o fim.
- **Oito assuntos**: Rosto, Cabelo, Expressão, Roupa, Raquete, Acessórios,
  Pose e Fundo. Opções de formato são miniaturas do próprio avatar; cores são
  bolinhas de 44 px com nome acessível; o resto são botões de texto. Tudo é
  `radiogroup`/`radio`.
- **Surpreenda-me** sorteia o avatar inteiro; **Sortear só o visual** mantém
  rosto, pele e cabelo. **Desfazer / Refazer** (60 passos).
- **Salvar**: gera as duas imagens, envia e grava o cadastro. "Usar como foto
  do perfil" vem ligado para quem não tem foto e desligado para quem tem.
- Avatar já salvo: "Voltar para a minha foto" / "Usar o avatar salvo como
  foto" / "Apagar avatar" (com confirmação em dois toques).
- Sair com mudança não salva pede confirmação do navegador.
- **Sem 3D no aparelho**: o palco diz isso (ou mostra a imagem já salva), as
  escolhas seguem funcionando e salvar avisa que ali não dá.

## 7. O que não pode regredir

1. **A three.js nunca entra no pacote inicial.** Só `three/stage.js` (e o que
   ele importa) toca a biblioteca, e só por `import()`. Quem só quer saber se o
   aparelho desenha em 3D importa `three/support.js`. Conferido no build
   (`npm run build:budget`) e nos testes, que fazem o módulo do palco lançar
   erro se alguém o importar sem WebGL.
2. **A receita só guarda o que é do catálogo** (`normalizeRecipe`) — é o que
   permite pô-la no espelho público.
3. **O espelho público só leva o avatar quando ele é a foto**, e nunca a foto
   guardada.
4. **A foto de verdade fica em `photo_backup`** e volta com um toque, inclusive
   com a flag desligada.
5. **Ids do catálogo, das poses e dos itens de marca são gravados**: nunca
   renomeie.
6. **Item de marca aparece sempre como "Patrocinado"** e o link de saída é só
   `https`.
7. **Não crie um canvas WebGL por miniatura**: use `AvatarSnap` (a fila).
8. Texto em `t()`/`tk()` com en e es em `src/modules/avatar/i18n/locales/`.

## 8. O que ficou de fora (e o caminho)

| Ficou de fora | Caminho |
|---|---|
| Peças esculpidas por artista 3D (acabamento de Memoji) | o `Character` monta grupos por peça; uma peça pode passar a carregar um `.glb` sem mudar receita nem telas |
| Fluxo comercial das marcas (contrato, cobrança, cliques, relatório) | o catálogo já tem `link_url` e janela de datas; falta a parte comercial |
| Outros itens de marca (roupa, tênis, bola) | hoje só a raquete; o desenho de `brandItems.js` serve de molde |
| Avatar vivo nas listas (ranking, chat) | de propósito: um contexto WebGL por linha não cabe; vai a imagem |
| Limpeza das imagens antigas do avatar | exige saber quem ainda aponta para cada uma |
| Avatar em vídeo/figurinha para compartilhar | o palco já desenha quadro a quadro; falta o exportador |

## 9. Testes

- `domain/*.test.js` — cores, catálogo e receita (normalização, sorteio com
  semente), poses e movimentos (inclusive o salto do saque), raquetes de marca,
  o avatar no perfil e o espelho público.
- `services/avatarSnapshots.test.js` — a chave das fotos e a falha sem 3D.
- `src/v2/components/avatar/AvatarStudio.runtime.test.jsx` — o estúdio sem 3D:
  aviso, imagem salva, escolher, desfazer, sortear, raquete de marca.
- O desenho 3D em si foi conferido no navegador (computador e celular, todas
  as opções, os quatro movimentos). **Não há teste visual automático** e o
  desempenho em celular real ainda não foi medido — pendente do dono.
