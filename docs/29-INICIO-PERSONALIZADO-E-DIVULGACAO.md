# 29 — Início personalizado e divulgação da plataforma e dos professores (Onda CG)

> **Pedido**: *"melhorar a página início, para que seja personalizada por tipo
> de usuário, com base no cadastro, perfil e interesses declarados… itens
> atualizados (torneios, dias de jogo, horários disponíveis, cupons, campanhas)
> — se não houver, sumir ou dizer que não há… nunca itens antigos… acesso
> rápido ao último resultado, ranking e duplas"* e *"no admin da plataforma e
> para os professores, campanhas e cupons da plataforma e de professores… com
> as mesmas funcionalidades, detalhes e configuração que existem para
> campanhas e cupons de arena"*.
>
> Três flags novas, **todas default OFF**:
>
> | Flag | O que liga |
> |---|---|
> | `personalized_home` | a tela inicial personalizada (desligada, a clássica segue idêntica) |
> | `platform_marketing` | cupons e campanhas DA PLATAFORMA (Painel admin → Plataforma → Divulgação) |
> | `coach_marketing` | cupons e campanhas DE CADA PROFESSOR (Painel do professor → Divulgação) |
>
> Grupos no painel: `personalized_home` em **Engajamento**; as duas de
> divulgação num grupo próprio, **Campanhas e cupons (plataforma e professores)**.

---

## 1. A tela inicial personalizada (`personalized_home`)

> ⭐ **Onda CI**: com a flag `home_cards`, quem decide os cards do início é a
> PESSOA (padrão: Dias de jogo, Horários da arena e Ranking), e o que ela faz
> vira sugestão no seletor. O que está descrito abaixo continua valendo com
> `home_cards` desligada — e as regras de §1.2 e as seções valem nos dois
> casos. Ver `docs/31-INICIO-SOB-MEDIDA.md`.

### 1.1 Duas fontes, com pesos diferentes

`resolveHomeFoci` (`src/modules/home/domain/homeProfile.js`) decide as
**frentes** da tela a partir de:

1. **o que a pessoa FAZ** (papel real, lido dos dados): gere arena, é
   professor, organiza torneio que está valendo — vence qualquer declaração;
2. **o que ela DISSE que quer** (`users.interests`, os 12 interesses do
   cadastro) — decide a tela de quem ainda não faz nada;
3. a **atividade** (tem reserva, aula, clube, dia de jogo, torneio) traz a
   seção sem passar na frente da escolha.

Sem papel e sem interesse, vale um começo que serve a quase todo mundo
(competir, jogar, reservar, ranking) — nunca uma tela vazia. O botão
**Personalizar** (no topo) edita os interesses ali mesmo, pelo caminho de
sempre (`updateUserProfile({ interests })`).

Cada frente vira uma ou mais **seções** (`homeSectionsFor`), sempre depois da
**Agenda** (tudo o que a pessoa tem marcado, de todas as fontes). Cada seção
diz *por que* está ali ("porque você gere uma arena", "porque você marcou…").

### 1.2 Nada vencido — a régua única

`freshness.js` responde **"isto ainda está valendo?"** para todas as fontes
(texto `YYYY-MM-DD`, `Timestamp`, ms). Torneio encerrado, prazo de inscrição
vencido, dia de jogo de ontem: nada disso entra. ⚠️ Data sem hora é **dia
local** — `Date.parse('2026-09-26')` é meia-noite UTC, 21h do dia anterior no
Brasil, e o torneio de hoje sumiria às 21h de ontem.

De quebra, a tela inicial **clássica** também deixou de destacar torneio
encerrado (`isLive`/`isTournamentCurrent`) e de listar como "aberto" um
torneio com o prazo vencido (`isTournamentOpen`).

### 1.3 As seções

| Seção | Mostra | Sem conteúdo |
|---|---|---|
| Agenda | reservas, aulas, dias de jogo, jogos de torneio, jogo aberto, aulas de arena, eventos de clube — agrupados por dia | "agenda livre" **só** com todas as fontes carregadas; senão diz qual parte falhou |
| Minha arena | pedidos esperando, atalho à Central | leitura falhando nunca oferece "cadastrar arena" (duplicaria) |
| Suas aulas (professor) | pedidos esperando resposta, próximas aulas, alunos, clínicas; **"Divulgar com cupom ou campanha"** (com `coach_marketing`) | quem marcou "dou aulas" sem perfil vê "Ativar perfil" |
| Organizar | rascunho, inscrições abertas, hora do sorteio, acontecendo — e o **esquecido** (data de fim vencida sem encerrar); encerrado não aparece | convite a criar |
| Torneios | os meus em andamento + os abertos, perto de mim primeiro | diz que não há, com o caminho |
| Seu último torneio | a colocação na **classificação da modalidade** (e o texto diz isso — não promete pódio de chave) | some (quem nunca disputou não tem o que ver) |
| Ranking e duplas | rating nacional com a posição, nível 2.0–8.0 e as parcerias no ranking de duplas — três leituras pequenas, só da pessoa | — |
| Jogar | convites e dias de jogo públicos, perto de mim primeiro, e os jogos com vaga das arenas | caminho para criar/procurar |
| Reservar | os próximos horários livres da **arena de sempre** (a da última reserva confirmada, ou a favorita), pela mesma conta do calendário; ocupação só afirmada com dado na mão | caminho para achar arena |
| Aulas, Clubes, Comunidade | o que há de novo em cada | caminho |

Cada seção é **isolada** (`HomeSectionBoundary`): um defeito numa não derruba
as outras.

### 1.4 Chegar mais rápido

- **Atalhos** (`homeShortcuts`): um por frente, direto aonde a pessoa vai
  (a Central da arena com o número de pedidos, `/dia-de-jogo?criar=1`,
  `/torneios/criar`, `/aulas`…). O admin tem sempre o painel.
- `/dia-de-jogo?criar=1` abre o diálogo de criação e sai da URL.
- `/aulas?secao=divulgacao` (ou `?aba=<valor>`) abre o painel do professor na
  seção pedida — o painel **passou a ler a URL** (`coachTabFromUrl`).

### 1.5 Banco

**Zero** coleção, índice ou regra. Só leitura, das mesmas consultas (e chaves
de cache) das outras telas. Hooks ganharam `{ enabled }` opcional para a
seção que não é da pessoa **nem consultar**. A única escrita é o "Personalizar"
(os interesses, pelo caminho que já existia).

---

## 2. Divulgação da plataforma e dos professores

### 2.1 O que é igual ao marketing da arena — de propósito

Os **mesmos componentes**, não cópias: o tíquete do cupom (`CouponArt`, os
cinco modelos, a imagem enviada, o código copiável no canhoto), o editor de
arte do cupom (`CouponArtEditor`), o editor de banner (`BannerDesigner`, os
cinco modelos, "salvar como meu modelo", prévia computador/celular), o envio
de imagem (`BannerUploader`, com a especificação antes), o desenho do banner
(`BannerArt`) e as mesmas regras de domínio (`normalizeCouponInput`,
`couponError`, `normalizeCampaignBanner`, `campaignBannerState`, o filtro de
região da tela inicial).

Os dois editores ganharam um parâmetro **opcional** `templates` (a fonte dos
"meus modelos"), `brand` e `uploadFolder`. Sem eles, é a arena — exatamente
como antes (os testes da arena não mudaram).

### 2.2 O que muda por emissor

| | Plataforma | Professor |
|---|---|---|
| Onde se gere | Painel admin → Plataforma → **Divulgação** | Painel do professor → **Divulgação** |
| Tipos de cupom | desconto, inscrição em evento, produto/brinde, clínica, aula em grupo/particular, aluguel, comida, bebida, outro | **desconto na aula**, aula particular, aula em grupo, clínica, produto/brinde, aluguel, evento, outro |
| Onde o desconto entra | registrado pela equipe (não há preço da plataforma) | **no pedido de aula**, aplicado quando o professor confirma |
| Destinos do banner | torneios, **um torneio**, procura-se jogo, **um dia de jogo**, arenas, professores, ranking, duplas, clubes, comunidade, parceiros, promoções | **o perfil**, **marcar aula**, clínicas, loja, conteúdo, promoções |
| Público do aviso | todo mundo · por interesse · por estado · por cidade · professores | alunos ativos · todos os alunos (ativos + em pausa) |
| "Só para os meus alunos" | — | sim (cupom e banner) |
| Onde o banner aparece | vitrine `/promocoes` e/ou tela inicial | perfil do professor (+ vitrine) e/ou tela inicial |

Não há **hora grátis** nem **indicação** fora da arena: a primeira abate o
preço de uma reserva, a segunda credita a carteira da arena.

### 2.3 Alcance na tela inicial

O emissor escolhe **até onde** o banner/cupom aparece: **todo o Brasil**, **um
estado** ou **uma cidade** (`normalizeReach`, `reachMatchesRegion`). O
nacional aparece **até para quem ainda não informou a cidade** — e aí o
convite "escolha a sua cidade" só vem se houver algo regional para ver. As
cidades com item regional entram no seletor "outra cidade", somadas às das
arenas (`mergeBannerCities`).

### 2.4 O cupom no pedido de aula

1. O aluno digita o código, **toca num dos cupons do professor** que o próprio
   pedido lista (os de aula, no ar, visíveis a ele e ainda não usados por ele —
   como as promoções no pedido de reserva da arena), ou chega por **"Usar ao
   pedir a aula"** / **"Pedir aula com este cupom"**
   (`/coaches/:id?marcar=1&cupom=CODIGO`). A tela **confere antes** — "venceu",
   "é de outro professor", "você já usou", "é só para quem já é aluno", "é um
   vale: mostre ao professor" — e mostra a **estimativa** ("de R$ 150 por
   R$ 135"), mas não aplica nada. O campo é `LessonCouponField`
   (`v2/components/promo/`), carregado **sob demanda** pelo diálogo.
2. O cupom vai **pendente** na aula (`coach_lessons.coupon`, campo opcional,
   saneado por `normalizeLessonCoupon`: o aluno nunca grava "aplicado" — e,
   desde a revisão, **a regra também não deixa**, ver §3).
3. Na **confirmação**, o serviço confere de novo contra o banco
   (`resolveLessonCoupon`): aplica (preço de referência = o da aula, ou
   valor-hora × horas; `price` passa a ser o valor já descontado, o cupom
   guarda `original_price` e `discount_value`, e o uso é contado) ou recusa
   com o motivo — **a aula é confirmada assim mesmo** e o aluno é avisado.
   Sem preço conhecido, o desconto em % fica `null` (combinado na hora, nunca
   inventado). No cupom **"só para os meus alunos"** a confirmação confere o
   vínculo em `coach_students` (ativo ou em pausa); se não conseguir conferir,
   o cupom segue **pendente** — nunca recusado nem aplicado às cegas.
4. Tipos aceitos no pedido: **desconto** e **vale de aula particular** (a aula
   sai por conta do professor). Os outros vales são entregues em mãos.
5. **Aula recorrente**: o cupom cobre **UMA aula** (a primeira da série,
   `lessonCouponBase`), porque conta um uso só — senão "aula experimental
   grátis" viraria a série inteira grátis. `price` é o valor da série menos
   esse desconto, e a aula guarda `lessons_count`.
6. **Aula desfeita** (cancelada ou recusada) com o cupom já contado: **o uso
   volta** para o aluno (`used_count − 1`, sai de `used_by`), numa transação
   que lê a aula — duas abas não descontam duas vezes. Quem devolve é o
   **professor** (só o emissor escreve o cupom): na hora, quando é ele quem
   cancela; quando é o **aluno**, ao abrir a agenda (`useReturnPendingCouponUses`)
   ou antes de conferir outro pedido do mesmo aluno. Para o aluno, a linha da
   aula já diz "devolvido", e o pedido novo não diz "você já usou"
   (`hasReturnableUse`).

A linha do cupom na aula (`lessonCouponLine`) diz o **valor final** — "−R$ 15
· aula de R$ 150 por R$ 135" (numa série: "na 1ª aula · série de …"). A
conferência é carregada **sob demanda**: o serviço de aulas é usado pela tela
inicial, que nunca confirma aula.

### 2.5 Controle de uso

`promoUsageReport`: usos por cupom; custo do **vale** = usos × custo unitário
(o custo mora nas configurações **privadas**, nunca no cupom); no **desconto
do professor**, custo e receita saem das aulas confirmadas com o cupom. O
desconto da plataforma não passa por preço — só os usos. **"—" é
desconhecido, nunca zero**, e o relatório só aparece com todas as consultas em
mãos.

### 2.6 Telas

| Rota / lugar | O quê |
|---|---|
| `/admin/painel?tab=promo` | a divulgação da plataforma (`PlatformPromoConsole`, sob demanda) |
| `/aulas?secao=divulgacao` | a divulgação do professor (`CoachPromoConsole`, sob demanda) |
| `/promocoes` | a vitrine: banners em destaque, cupons da plataforma e dos professores |
| `/campanhas/:campaignId` | a página "saiba mais" da campanha (falha ≠ inexistente ≠ encerrada) |
| `/coaches/:coachId` | seção **Promoções** logo depois do cabeçalho; âncoras `#professor-promocoes`, `#professor-agenda`, `#professor-loja`, `#professor-clinicas`, `#professor-conteudo` (rolagem por `useHashScroll`); `?marcar=1` abre o pedido de aula — e, com o professor **sem aceitar alunos**, a tela **diz isso** e guarda o código (antes o link não fazia nada) |
| tela inicial (as duas) | o mesmo carrossel das arenas, com os itens da plataforma e dos professores e o atalho **Ver todas** |

Os dois consoles (`?divulgacao=cupons|campanhas`) guardam a aba na URL.

### 2.7 O aviso

`notifyUsers` com tipo `generic`. O link do **aviso** nunca leva `#` — a regra
de `notifications` recusa, e o lote inteiro cairia em silêncio (é o defeito
que a Onda CG achou e corrigiu nas campanhas das **arenas**: `linkDeAviso`).
Destino com âncora ⇒ o aviso da campanha leva à página da campanha, que tem o
botão para o lugar certo. Público vazio não envia.

**Revisão**: para qualquer OUTRO aviso com âncora (ex.: "Pacote de horas
creditado" → `/arenas/X#arena-planos`), `linkDeAviso` passou a converter o
`#secao` em **`?ancora=secao`** (que a regra aceita), e o layout
(`useAncoraDoAviso`) devolve o `#secao` à URL ao abrir — a página rola até a
seção como sempre rolou. Antes da revisão o fragmento era só descartado e o
aviso caía no topo da página.

**Quanto chegou.** `notifyUsers` devolve quantos avisos foram **gravados**. A
campanha grava `recipients_count` (o público) e `sent_count` (o CONFIRMADO,
que começa em 0 e só sobe depois dos avisos): se a aba fechar ou a conexão
cair no meio, a lista mostra "Aviso confirmado para X de N pessoas" em vez de
"para todos". O diálogo pede para manter a tela aberta até terminar.

### 2.8 Vitrines: o teto de leituras

As quatro consultas das vitrines (tela inicial e `/promocoes`) só usam
igualdades e **não ordenam** (ordenar pediria índice composto). E o cupom
vencido continua `active` até o emissor desligá-lo — então um corte baixo
podia deixar de fora um cupom no ar, trocado por um vencido, sem erro nenhum.
Desde a revisão o corte é um **teto** (`VITRINE_LIMITE = 300`), bem acima do
volume real, e atingi-lo gera aviso no log. Se chegar perto, o caminho é um
índice com o prazo.

### 2.9 Ajuda

Três artigos na central, **cada um atrás da flag da própria funcionalidade**
(campo `flags` do artigo, `helpCatalog(flags)`): "A sua tela inicial"
(`personalized_home`), "Promoções da plataforma e dos professores"
(`platform_marketing` **ou** `coach_marketing`) e "Cupons e campanhas do
professor" (`coach_marketing`). Desligada a flag, o artigo não aparece em
lugar nenhum — parte, busca, link direto, "Ajuda para esta tela"; ligada,
aparece sozinho. Pistas de rota: `/promocoes`, `/campanhas/*`, `/aulas`,
`/minhas-aulas`, `/coaches/*`. Ver `docs/21-CENTRAL-DE-AJUDA.md`.

---

## 3. Banco de dados (aditivo)

Três coleções novas, sem índice composto (só igualdades), e **um** campo
opcional:

| Coleção | Documento | Leitura | Escrita |
|---|---|---|---|
| `promo_coupons/{id}` | `issuer_type` (`platform`/`coach`), `issuer_id` (`platform` ou uid), `issuer_name`, os campos do cupom da arena (sem os de indicação e sem `min_amount`), `reach`, `visibility`, `art`, `used_count`, `used_by` | qualquer conta logada | o emissor (admin para a plataforma; o próprio professor, **com perfil** em `coaches/{uid}`); o emissor não muda no update; admin pausa/apaga (moderação) |
| `promo_campaigns/{id}` | emissor + `name`, `message`, `target_audience`, `audience_detail`, `recipients_count` (o público), `sent_count` (o confirmado), `destination`, `banner`, `show_on_page`, `show_home`, `banner_until`, `banner_active`, `reach`, `visibility` | qualquer conta logada | idem |
| `promo_settings/{platform\|uid}` | `coupon_costs`, `banner_templates`, `coupon_templates` | **só o emissor** (e o admin) | idem |
| `coach_lessons.coupon` (campo) | `{ coupon_id, code, benefit, kind, status: pending\|applied\|rejected, discount_value?, original_price?, lessons_count?, returned?, returned_at?, reason? }` | regra de sempre | o aluno só grava **pendente** (ver abaixo) |

Regras em `firestore.rules` § "Divulgação da PLATAFORMA e dos PROFESSORES",
provadas por **23 asserções** no emulador (`tests/rules/promoMarketing.rules.test.js`),
metade provando o que funciona e metade o que continua barrado — inclusive
que o cupom da ARENA segue a regra de sempre.

**Revisão — a regra de `coach_lessons` foi ENDURECIDA do lado do aluno.**
Antes o aluno escrevia qualquer campo da própria aula: criava já confirmada e
podia gravar um cupom "aplicado" com o desconto que quisesse (a agenda do
professor mostraria o preço forjado). Agora o aluno (quem é só `student_id`)
**pede** — a aula nasce `requested`, sem `price`, com o cupom só `pending` e
só com os cinco campos do pedido — e **cancela** — só `status` → `cancelled`
(+ `updated_at`) a partir de solicitada, em negociação ou confirmada; não
apaga. O professor e o admin seguem escrevendo tudo. É exatamente o que o
serviço (`requestLesson`/`respondLesson`) sempre fez: nenhuma tela perde
nada. Provado por **17 asserções** no emulador
(`tests/rules/coachLessons.rules.test.js`), inclusive o lote do professor que
cancela e devolve o uso do cupom, e as duas consultas da confirmação.

---

## 4. Código

```
src/modules/home/                 ← a tela inicial personalizada (domínio + hook)
  domain/ freshness · homeProfile · homeAgenda · homeTournaments · homeShortcuts · homePlay
  hooks/  useHomeAgenda
src/v2/components/home/personal/  ← as seções, o topo, os atalhos, "Personalizar"
src/modules/promo/                ← a divulgação
  domain/ promo.js (tipos, alcance, visibilidade, destinos, públicos, uso, tela inicial, aula)
          lessonCoupon.js (a parte LEVE: saneamento e texto — importada pelo domínio de aulas)
  services/ promoService.js
  hooks/  usePromo.js (chaves de cache em `promoKeys`)
src/v2/components/promo/          ← consoles, formulários, recepção, uso, banner, cartão, seção do perfil
src/v2/pages/ V2Promotions · V2PromoCampaign
src/v2/ui/useHashScroll.js
src/core/domain/internalLink.js   ← o link de aviso que a regra aceita (paridade com a regra)
```

## 5. Guardas e testes

- Domínio: `home/domain/*.test.js`, `promo/domain/promo.test.js` — inclui,
  desde a revisão, "só alunos", a série (uma aula coberta), o valor final na
  linha e o uso a devolver.
- Serviço: `promo/services/promoService.test.js` — custo fora do cupom,
  código repetido, recepção, aviso sem `#`, cupom na confirmação da aula e,
  desde a revisão: o uso volta (uma vez só), cancelamento pelo aluno acertado
  pelo professor, "só alunos" na confirmação e o envio parcial da campanha.
- Telas: `V2PersonalHome.runtime.test.jsx`, `promo.runtime.test.jsx`,
  `LessonCouponField.runtime.test.jsx` (cupons para tocar, estimativa, "só
  alunos", uso devolvido), `HomePromoBanners.runtime.test.jsx`.
- Regras: `promoMarketing.rules.test.js` (23) e `coachLessons.rules.test.js` (17).
- Aviso com âncora: `core/domain/internalLink.test.js` e
  `v2/ui/useAncoraDoAviso.test.jsx` (ida e volta).
- Varredura "falha não é vazio" estendida à **tela inicial e à divulgação**
  (`falhaNaoEVazio.test.js`).
- Guarda de fonte: as DUAS telas iniciais montam o carrossel sob demanda, cada
  fonte com a sua flag.

## 6. Lições

1. **O aviso da arena com `#` caía inteiro.** Destinos como
   `/arenas/X#arena-reservar` eram recusados pela regra de `notifications` —
   o lote de 400 caía, a campanha dizia "enviada". Agora há uma fonte única
   (`core/domain/internalLink.js`) com teste de paridade contra a regra.
2. **Import leve de propósito.** O domínio de aulas precisa sanear o cupom e a
   tela inicial usa o serviço de aulas; importar o domínio inteiro da
   divulgação ali levaria o marketing das arenas para toda tela que mostra uma
   aula. Por isso `lessonCoupon.js` existe e a conferência é `import()` sob
   demanda.
3. **"Só para os meus alunos" não é segredo, mas VALE na hora de usar.** O
   cupom é legível por qualquer conta logada (como o da arena) — não prometa
   sigilo que a regra não dá. O que a revisão fechou é o USO: na primeira
   versão, quem não era aluno e soubesse o código recebia o desconto, porque
   a conferência olhava professor, tipo e validade, mas não para quem o cupom
   era. Agora o pedido recusa (quando SABE que não é aluno) e a confirmação
   confere o vínculo no banco.
4. **Um uso de cupom é uma aula.** Na série recorrente o desconto era
   calculado sobre o preço da série inteira — "aula experimental grátis"
   zerava dez semanas. O cupom conta um uso, então cobre uma aula.
5. **O que foi contado tem de poder ser devolvido.** Cancelar uma aula com o
   cupom aplicado deixava o aluno sem o "uma vez por pessoa" e o relatório
   com um uso que não aconteceu. Como só o emissor escreve o cupom, a
   devolução é do professor — e idempotente, porque roda em mais de um lugar.
6. **"Enviado para N" tem de ser o que foi gravado**, não o tamanho da lista
   que se pediu para enviar.
