# Onda 3 — Marketing e fidelidade

> **Módulos**: `marketing` · `marketing_coupons` · `marketing_campaigns` ·
> `marketing_nps` · `marketing_referral` · `marketing_loyalty`
> **Chave-mestra**: flag `arena_modules` (default OFF).
> **Banco**: zero coleção nova, zero índice novo, zero regra nova.

> **Atualização 2026-09-24 — dentro da arena.** O console virou a seção
> **Marketing** da Central (uma aba por ferramenta), o cupom ganhou **"Divulgar
> na página da arena"** (vira promoção na página e no pedido de reserva) e o
> "Indique e ganhe" do atleta foi para a página da arena, criado quando a
> pessoa pede. No caminho, o defeito que fazia o código de indicação **nunca**
> ser criado e o primeiro crédito em carteira ser recusado — ver
> `09-INTEGRACAO-NA-ARENA.md` §10.

---

## 1. O que existia e o que não funcionava

O código do marketing da Arena V3 estava quase todo escrito — e nada dele
chegava ao mundo. Cinco defeitos independentes, cada um suficiente para
inutilizar a ferramenta inteira:

| # | Defeito | Sintoma para quem usa |
|---|---|---|
| 1 | **O cupom não descontava nada** | Havia tela para criar cupom, mas nenhum lugar para digitá-lo. O desconto existia no banco e nunca no preço. |
| 2 | **A campanha era um rascunho** | `createCampaign` gravava o documento e ninguém era notificado. A arena "enviava" e a comunidade nunca recebia. |
| 3 | **O NPS não mostrava o motivo** | A arena via um número. Os comentários — a única parte acionável de uma pesquisa de satisfação — nunca apareciam. E a `read` da regra estava quebrada (`request.resource.data` numa leitura), então **a arena não conseguia nem ler o próprio NPS**. |
| 4 | **A indicação não tinha resgate** | Havia código de indicação e nenhuma tela para registrar quem chegou por ele. |
| 5 | **Nada levava ao console** | `/arenas/:id/gerir/marketing` tinha rota e **nenhum link** na plataforma. Módulo ligado, tela inalcançável. |

A #5 é a mais instrutiva: uma funcionalidade pode estar 100% escrita, testada
e deployada e mesmo assim não existir para o usuário. Por isso a Onda 3 não
resolveu o link do marketing — resolveu **a classe do problema** (§6).

---

## 2. O cupom chega ao preço

O caminho do cupom hoje, ponta a ponta:

```
atleta digita o código no pedido de reserva
        │
        ▼
validateCouponCode(arenaId, code, { userId, amount })   ← lê o banco
        │   devolve { coupon, discount, error }
        │   o ERRO é específico: "venceu", "vale a partir de R$ 100",
        │   "você já usou este cupom" — nunca só "inválido"
        ▼
memberBookingPrice(...) com `coupon`                     ← domínio puro
        │   ordem: tabela → pacote → nível → CUPOM → carteira
        ▼
bookingService.precoComBeneficio()                       ← REFAZ a conta
        │   o cupom é RECONFERIDO contra o banco: o que veio da tela
        │   é um palpite, e conferir só no navegador deixaria qualquer
        │   pessoa gravar um desconto que a arena não criou
        ▼
grava `member_benefit` com coupon_code / coupon_id / coupon_value
        │
        ▼
a arena CONFIRMA a reserva
        │
        ▼
contabilizarCupom() → registrarUsoDeCupom(id, athleteId)
        used_count + 1, used_by += athleteId, audit log
```

**Por que o cupom vem depois do desconto do nível.** É a ordem conservadora: o
membro não acumula dois percentuais cheios, e a arena consegue prever o pior
caso de uma promoção antes de publicá-la.

**Por que o uso só é contabilizado na confirmação.** Mesmo motivo das horas de
pacote: queimar um uso num pedido que a arena ainda pode recusar gastaria o
cupom de alguém que não jogou.

**Por que `used_by` é uma lista.** É o que permite "uma vez por pessoa". Sem
guardar quem usou, o limite existiria no papel e não teria como ser conferido.

> ⚠️ **Nome de função.** O serviço se chamava `useCoupon`. O ESLint
> (`react-hooks/rules-of-hooks`) trata qualquer função `useX` como hook do
> React e derrubava o lint de todo arquivo que a invocasse fora de um
> componente. Hoje é `registrarUsoDeCupom`. Não volte atrás.

---

## 3. A campanha diz para quantas pessoas vai

Quatro públicos, poucos e concretos de propósito (`CAMPAIGN_AUDIENCE`):

| Público | Quem é |
|---|---|
| **Membros** | Está no programa de membros da arena. |
| **Sumidos** | Já jogou aqui e não reserva há mais de 60 dias (`LAPSED_DAYS`). |
| **Frequentes** | Reservou nos últimos 60 dias. |
| **Todo mundo** | Qualquer pessoa que já reservou ou é membro. |

"Segmentação avançada" com dez filtros combináveis é a funcionalidade que
ninguém usa: quem toca uma arena quer *avisar os sumidos*, não montar uma
consulta.

`campaignRecipients(audience, { members, bookings })` é **puro** e roda na
tela, a partir do que ela já carregou. Isso é o que permite mostrar
**quantas pessoas vão receber antes de enviar** — cada cartão de público traz
o número. Mandar mensagem para um número desconhecido de pessoas é como uma
arena queima a paciência da própria comunidade.

Duas travas:

- **Só reserva concluída ou confirmada conta como "já jogou aqui".** Um
  pedido recusado não é relação com a arena, e mandar "sentimos sua falta" a
  quem nunca veio é o tipo de mensagem que faz desinstalar o aplicativo.
- **Público vazio não envia.** O botão fica desabilitado e a tela diz por quê.

O envio (`sendCampaign`) grava a campanha **e** entrega as notificações. A
entrega está num `try` próprio: se algum aviso falhar, a campanha continua
gravada e a arena vê quantos foram — o contrário deixaria a arena sem saber se
mandou.

---

## 4. O NPS perguntado na hora certa

### Quando perguntar (domínio, `shouldAskNps`)

Três condições, todas por um motivo:

- **teve visita concluída** — perguntar a quem nunca veio não faz sentido;
- **a visita foi recente** (30 dias) — depois disso ninguém lembra;
- **não respondeu nos últimos 90 dias** (`NPS_COOLDOWN_DAYS`) — pedir nota
  toda semana é a forma mais rápida de a pessoa parar de responder para
  sempre.

### Onde perguntar

`ArenaNpsAsk` mora na **página da arena**, logo abaixo do cabeçalho. Ninguém
abre uma página para avaliar uma arena: a pergunta tem que aparecer onde a
pessoa já está. Quando não é hora, o componente **não renderiza nada** — nada
de caixa cinza dizendo "você ainda não pode avaliar".

A data da última visita sai de `useMyBookings()` (que a plataforma já carrega),
por `lastVisitAt(bookings, arenaId, hojeISO)` — **reserva futura não conta**,
porque o jogo ainda não aconteceu.

### Como perguntar

**A nota vai embora no clique.** Um número, um toque, gravado. O comentário é
opcional e vem *depois*, na tela de agradecimento. Pedir texto antes da nota
derruba a taxa de resposta e é o motivo de a maioria dos NPS não ter resposta
nenhuma.

### O que a arena vê

Nota, distribuição promotor/neutro/detrator em barras, e **os comentários** —
com a nota ao lado de cada um. O número diz que algo mudou; o comentário diz
o quê.

---

## 5. Fidelidade: pontos e indicação

### O resgate é da ARENA, não do atleta

Isto não é escolha de produto — é o que a regra do Firestore permite:

```
match /arena_members/{docId}  → create, update: isArenaManager(...)
match /arena_wallets/{docId}  → create, update: isArenaManager(...)
```

Um botão "resgatar" na tela do atleta produziria um *permissão negada* que ele
não tem como resolver. Então:

- **Na tela do atleta** (`/arenas/:id/membros`): os pontos aparecem como
  **valor** ("seus 420 pontos valem R$ 21,00") e o caminho — pedir na
  recepção. Pontos que não viram nada são um número decorativo.
- **Na tela da arena** (`/arenas/:id/gerir/membros`): o botão "Resgatar
  pontos", já preenchido com o resgate máximo, mostrando em reais antes de
  confirmar.

`redeemPoints` arredonda **para baixo** em reais inteiros e devolve o resto ao
atleta: resgatar 25 pontos a 20/real daria R$ 1,25 e sobraria um resto
invisível; aqui os 5 pontos ficam com ele, e a tela diz isso.

Ordem da escrita em `redeemMemberPoints`: **debita os pontos antes de creditar
a carteira**. Se a carteira falhar, o atleta fica com pontos a menos e crédito
nenhum — reclamável e corrigível. Na ordem inversa ele ficaria com o crédito
*e* os pontos, o que a arena não descobre.

### Indicação

O documento de indicação é do **indicador** (`referrer_id == eu`), que é
exatamente o que a regra permite escrever. Quem foi indicado não escreve nada:
chega no balcão, diz o código, e a arena registra — creditando os dois lados.
É também como funciona na vida real.

O atleta vê o próprio código na tela de membros, com **Copiar** e **Convidar**
(que usa `navigator.share` quando existe).

---

## 6. O problema de classe: módulo entregue tem que ser alcançável

O defeito #5 (rota sem link) já tinha acontecido antes e ia acontecer de novo
a cada onda. A correção não foi escrever mais um link:

`ArenaModuleShortcuts` monta os atalhos a partir do **catálogo**
(`manage` / `public` de `ARENA_MODULE_DETAIL`) cruzado com os módulos que a
arena ligou. Módulo novo com rota preenchida aparece sozinho, na página da
arena (público) e no console de gestão (`manage`). Módulo desligado some.

Duas decisões dentro dele:

- **Uma consulta, não cinquenta.** `useArenaModules` responde pelos 50 módulos
  em memória. Um `useCanArenaUseModule` por item — o padrão antigo, que a
  página da arena usava — multiplicaria isso pela quantidade de módulos.
- **Destinos repetidos viram um botão só.** A família avançada inteira aponta
  para `/gerir/avancado`; quatro botões idênticos seriam ruído, não navegação.

Há teste travando que o console de marketing é alcançável quando o módulo está
ligado.

---

## 7. O que foi tocado

### Domínio (puro, testado)

| Arquivo | O que ganhou |
|---|---|
| `domain/marketing.js` | `couponError`, `couponDiscount`, `couponLabel`, `redeemPoints`, `CAMPAIGN_AUDIENCE(+_META)`, `campaignRecipients`, `shouldAskNps`, `DEFAULT_POINTS_PER_REAL`, `LAPSED_DAYS`, `NPS_COOLDOWN_DAYS`; `normalizeCouponInput` com `min_amount`, `once_per_user`, `description` |
| `domain/memberBenefit.js` | o cupom entrou na conta, entre o desconto do nível e a carteira |

### Serviços

| Arquivo | O que ganhou |
|---|---|
| `services/marketingService.js` | `validateCouponCode`, `registrarUsoDeCupom` (era `useCoupon`), `sendCampaign`, `getOrCreateReferralCode`, `findReferralByCode`, `redeemReferral`, `listMyNpsAnswers`, `updateArenaCoupon`, `setCouponActive`, `deleteArenaCoupon` |
| `services/membersService.js` | `redeemMemberPoints` |
| `services/bookingService.js` | `contextoDeMembro` reconfere o cupom contra o banco; `contabilizarCupom` na confirmação |

### Telas

| Arquivo | Persona | O que é |
|---|---|---|
| `V2ArenaMarketing.jsx` (reescrita) | arena | console: cupons CRUD, campanhas com prévia de público e envio real, NPS com comentários, resgate de indicação |
| `ArenaNpsAsk.jsx` (novo) | atleta | a pergunta, no momento em que dá para responder |
| `ArenaModuleShortcuts.jsx` (novo) | ambos | as portas dos módulos ativos, vindas do catálogo |
| `V2ArenaMembers.jsx` | atleta | quanto valem os pontos + código de indicação |
| `V2ArenaAdminMembers.jsx` | arena | resgate de pontos por crédito |
| `BookingRequestDialog.jsx` | atleta | campo de cupom + detalhamento do preço |
| `V2ArenaDetail.jsx` / `V2ArenaManage.jsx` | ambos | atalhos dos módulos |

### Banco

**Nada.** Nenhuma coleção, campo obrigatório, índice, regra ou função nova.
Os campos acrescentados a `arena_coupons` (`min_amount`, `once_per_user`,
`description`, `used_by`) são opcionais e ausentes valem como antes.

---

## 8. O que NÃO pode regredir

1. **O cupom é reconferido pelo serviço antes de gravar.** A tela estima; quem
   grava confere. Conferir só no navegador deixa qualquer pessoa gravar um
   desconto que a arena não criou.
2. **O uso do cupom é contabilizado na confirmação**, nunca no pedido.
3. **A campanha mostra o tamanho do público antes de enviar**, e não envia
   para zero pessoas.
4. **O NPS não é perguntado a quem não veio** — nem mais de uma vez a cada 90
   dias.
5. **Resgate de pontos e de indicação são escritas da ARENA.** Mover o botão
   para a tela do atleta produz *permissão negada*.
6. **Atalho de módulo vem do catálogo**, não de uma lista escrita à mão.
7. **O serviço não se chama `useCoupon`.** (`rules-of-hooks`.)
8. **O código de indicação não nasce numa visita.** A página da arena LÊ
   (`getMyReferralCode`); criar é quando a pessoa pede. E o `get` antes de
   criar depende de `canGetMissingArenaUserDoc` — tirá-la volta a quebrar a
   indicação, a venda de pacote e o crédito em carteira, em silêncio.
9. **Só cupom com `show_public: true` aparece em público** (`publicPromos`).

---

## 9. Tipos de cupom, recepção de vales e controle de uso (Onda BX, 2026-09-25)

**Pedido:** *"seria bom inserir as indicações como um tipo de cupom que é
possível criar, entre outros tipos como: indicação, desconto, hora grátis,
aula particular, aula em grupo, clínica, comida, bebida e vários outros…
dentro de cupons, deve ter a aba de criação dos cupons e uma aba de controle
de uso, com tabela indicativa de cada tipo de cupom criado, seus usos, custos,
ganhos"*.

### 9.1 O cupom ganhou TIPO — em três famílias

| Família | Tipos | Onde é usado |
|---|---|---|
| **Desconto na reserva** | Desconto (% ou R$), Hora grátis | Sozinho, no preço, quando a pessoa digita o código ao reservar |
| **Vale para usar na arena** | Aula particular, Aula em grupo, Clínica, Comida, Bebida, Produto ou brinde, Aluguel de equipamento, Inscrição em evento, Outro benefício | A pessoa mostra o código na recepção; a arena toca em **Registrar uso** |
| **Indique e ganhe** | Indicação | As REGRAS do programa; cada atleta tem o próprio código |

A família decide o que o formulário pergunta (o vale não tem "% de
desconto"; a indicação não tem código para digitar) e o que o cartão oferece
(o vale tem "Registrar uso"; o desconto conta sozinho na confirmação da
reserva). Criar começa escolhendo o tipo, em cartões; editar mantém o tipo.

**Hora grátis** abate a PROPORÇÃO das horas da reserva, pelo preço médio da
própria reserva (1 hora grátis numa reserva de 2 horas de R$ 200 = R$ 100) —
e só das horas que sobraram depois do pacote, para a hora já coberta não ser
dada duas vezes. Sem saber as horas, não abate nada.

**Cupom antigo não muda**: sem `kind`, ele é desconto, exatamente como sempre
foi (há teste travando).

### 9.2 A recepção do vale

`VoucherReception`: a equipe digita o código que o cliente mostra, a tela diz
o que o vale dá e se ainda vale (vencido, esgotado, desligado, "esta pessoa já
usou"), a pessoa é escolhida (opcional — vale divulgado serve a quem não tem
cadastro, e aí "uma vez por pessoa" não tem como ser conferido, o que a tela
diz) e o uso é registrado **numa transação** (`redeemVoucher`): duas pessoas
da equipe registrando o último uso ao mesmo tempo não passam do limite.
Desconto digitado ali é explicado ("entra sozinho no preço"), não registrado.

### 9.3 O controle de uso

`couponUsageReport` (domínio puro, sem consulta nova — as reservas a Central
já carrega): uma linha por cupom e um total por tipo, com **usos, custo e
receita**.

- **Desconto/hora grátis**: custo = o que foi abatido nas reservas
  CONFIRMADAS ou CONCLUÍDAS (`member_benefit.coupon_value`); receita = o que
  essas reservas pagaram. Recusada e cancelada não entram.
- **Vale**: custo = usos × o **custo unitário** que a arena informa.
- **Indicação**: custo = o que foi creditado (`reward_total`, gravado a cada
  resgate) + descontos; receita = as reservas que chegaram por indicação.

Número desconhecido é **"—", nunca zero** — zero afirma que não custou nada.
Um custo desconhecido torna desconhecido o total do tipo, e o resumo diz
"Falta o custo de algum vale". E, com qualquer consulta falhando, o relatório
**não aparece**: diz que falhou e oferece tentar de novo (falha não é vazio).

### 9.4 O custo do vale mora onde só a arena lê

`arena_coupons` é legível por qualquer conta logada (o atleta confere o código
e vê as promoções). Quanto a arena paga pela água de coco não é assunto do
cliente: o custo unitário vai para `arena_settings.coupon_costs.{couponId}`,
que só o gestor lê (`setCouponUnitCost`, criando o documento com os padrões se
ele não existir). Há teste garantindo que o cupom gravado não carrega o custo,
e asserção no emulador de que o atleta não lê `arena_settings`.

### 9.5 A indicação vira um cupom com regras

O programa "indique e ganhe" é um cupom do tipo **indicação**: quanto ganha
quem indica (crédito em carteira), quanto ganha quem chega (crédito, ou nada),
se vale só para quem nunca reservou na arena (padrão: sim), limite de
indicações por pessoa e valor mínimo da primeira reserva. **Um programa ativo
por arena** (o serviço recusa o segundo — duas regras dariam duas respostas a
"quanto eu ganho?"). As regras aparecem:

- na aba **Indicações** (`ReferralRulesCard`, editáveis ali mesmo — a
  indicação liga separada dos cupons), preenchendo o registro manual, que
  agora credita **um valor para cada lado** e confere o limite por pessoa e o
  "só quem nunca reservou aqui" (`hasPriorArenaBooking`, duas igualdades, sem
  índice);
- no cartão público **Indique e ganhe** e no convite que o atleta manda
  (`referralInviteText`) — antes o cartão prometia "nós dois ganhamos"
  qualquer que fosse o combinado.

### 9.6 🐞 Três brechas fechadas nas regras (com asserções no emulador)

1. **O cupom (e a campanha) mudava de arena.** O `update` conferia só a arena
   antiga: o gestor de A trocava o `arena_id` para B e o cupom virava
   promoção na página de B e desconto nas reservas de B.
2. **O código de indicação podia ser sequestrado.** O id era livre: dava para
   criar `{arena}_{uid da vítima}` com o próprio uid como indicador — o "Meu
   código" da vítima mostrava o código do atacante, e toda indicação dela o
   creditava. Agora o id é o da própria pessoa, o documento nasce zerado, e o
   serviço só aceita código **legítimo** (documento do dono + código que
   começa pelo uid dele, `isLegitReferral`), o que também neutraliza
   documentos forjados antes da trava.
3. **O indicador reescrevia a própria contagem e o próprio código.** Agora só
   a arena atualiza o documento — e sem trocar arena, dono ou código.

### 9.7 🐞 O cupom nunca chegava ao pedido

Achado no caminho, anterior a esta onda: o pedido de reserva **conferia** o
cupom contra o banco, mostrava "Cupom aplicado" e o total com desconto — e
**nunca enviava o código** ao serviço (`coupon_code` não estava no pedido). A
reserva era gravada com o preço cheio, o uso nunca era contado, e o atleta via
um desconto que não chegava à arena. Agora o código vai no pedido, o serviço o
reconfere antes de gravar (como sempre deveria), e há teste travando.

**Banco:** zero coleção, zero índice. Campos opcionais em `arena_coupons`,
`arena_referrals` (`reward_total`) e `arena_settings` (`coupon_costs`). Regras
ENDURECIDAS em três coleções, nenhuma ampliada. O código morto que criava
indicação com id livre (`createReferral`) saiu.

---

## 10. A indicação de ponta a ponta (Onda BY, 2026-09-25)

**Pedido:** *"as indicações, foram feitas todas as particularidades
necessárias, inserção do código de indicações nos perfis dos atletas, bem como
local para inserção desse código na arena, quando for marcar, pela primeira
vez uma quadra"*. Não estavam: o código só existia no cartão da página de cada
arena, e quem chegava indicado dependia de alguém na recepção lembrar de
registrar.

### 10.1 O código no perfil

**Perfil → "Meus códigos de indicação"** (`MyReferralCodes`): um código por
arena, com o nome da arena, as REGRAS dela, quantas pessoas já usaram e
copiar/convidar (o convite diz o que as regras dão). Consulta por
`referrer_id` (o campo que a regra confere) e só entram documentos legítimos
(`{arena}_{eu}`). Linha de arena com a indicação desligada some; sem código
nenhum, a seção não aparece.

### 10.2 O campo na primeira reserva

No pedido de reserva, **"Foi indicado por alguém?"** (`BookingReferralField`)
aparece quando a arena tem um programa valendo e — se ele vale só para quem
nunca reservou ali — só na primeira reserva (`shouldOfferReferral`; sem saber
as reservas da pessoa, NÃO oferece, porque prometer um prêmio que a arena vai
recusar é pior do que não oferecer). A tela confere só a forma e o óbvio ("é o
seu próprio código"), e com o código errado o pedido não segue.

O código vai na PRIMEIRA reserva do pedido, e só nela
(`referral: { code, status: 'pending' }`). **O atleta não confere o código**:
ele não lê os códigos dos outros (a regra só deixa o dono e a arena lerem
`arena_referrals`).

### 10.3 Registrado na confirmação

Quando a arena confirma a reserva, `applyBookingReferral`
(`services/bookingReferralService.js`) confere o código contra o banco e as
regras (limite por pessoa, "só quem nunca reservou aqui" desconsiderando a
própria reserva, valor mínimo), **credita cada lado**, **aplica o desconto de
quem chegou no valor acordado**, grava na reserva o que foi dado e **avisa os
dois**. Recusada, fica gravada COM O MOTIVO (e o atleta é avisado). Nunca
derruba a confirmação; regras que não carregaram deixam a indicação pendente.

A reserva **instantânea** nasce confirmada e não passa por ali: ela aparece na
aba Indicações, em "Indicações que chegaram com reservas", com **Conferir e
registrar** (a mesma função), e na faixa "Precisa de você" da Central.

A linha da reserva (`bookingReferralLine`) mostra a indicação dos dois lados:
pendente, aplicada (com o que foi dado) ou recusada (com o motivo).

### 10.4 Desconto na primeira reserva

Com a conferência na confirmação, o programa passou a oferecer, para quem
chega, **desconto na primeira reserva** (% ou R$) além de crédito em carteira.
O desconto entra no custo do programa no controle de uso
(`referral.discount_value`).

### 10.5 🔒 Só a arena decide a indicação da reserva

Regra de `arena_bookings`, com 8 asserções novas no emulador:

- **criar**: `referral` só com `code`, `status: 'pending'` e `created_at_ms`
  (`bookingReferralOkOnCreate`) — ninguém nasce "aplicada", nem com desconto ou
  prêmio preenchidos (o controle de uso lê esses campos);
- **atualizar**: `referral` só muda pela arena (ou admin); o atleta segue
  atualizando o resto da reserva;
- **apagar**: idêntico ao de antes (a trava é só no update — num delete não há
  `request.resource`, e ela recusaria toda exclusão).

**Banco:** zero coleção, zero índice. Um campo opcional
(`arena_bookings.referral`); regra endurecida numa coleção.

---

## 11. As promoções na tela inicial, por região (Onda BZ, 2026-09-25)

**Pedido:** *"as campanhas e cupons são divulgados dentro da arena apenas?
Talvez seja importante divulgar na página início, como banner, com rolagem
entre todos os banners criados e filtro de distância ou localidade, para que
alguém de determinado local não veja banner de região muito distante."*

Eram divulgados só dentro da arena: a promoção (`show_public`) aparecia na
página da arena e no pedido de reserva, ou seja, só para quem JÁ tinha
encontrado a arena.

### 11.1 A arena escolhe

No formulário do cupom, logo abaixo de "Divulgar na página da arena", aparece
**"Também como banner na tela inicial"** (`show_home`). São duas decisões
separadas de propósito: divulgar na própria página não põe o cupom na tela
inicial de todo mundo. `show_home` só é gravado `true` junto de `show_public`,
e **nunca** na indicação (ela tem o próprio cartão). Na lista de cupons, o
selo "Banner na tela inicial" diz quais estão lá.

### 11.2 O carrossel

Na tela inicial, **"Promoções em Porto Alegre (RS)"** (`HomePromoBanners`,
montado atrás da chave-mestra `arena_modules`):

- um cartão por promoção, com a **marca da arena** (`brandingOf` — a cor e o
  contraste da Onda AN) ou o cartão escuro padrão; o que vence primeiro vem
  primeiro (é o que a pessoa pode perder);
- **troca sozinha a cada 7 s**, com botão de pausar, setas e pontos com nome
  para leitor de tela; para quando o dedo, o mouse ou o foco estão no
  carrossel, e **não gira** para quem pediu menos movimento no sistema;
- o botão leva a `/arenas/:id#arena-promocoes` — "Reservar com esta promoção"
  quando o cupom entra no preço, "Ver na arena" quando é vale;
- falhando a leitura, ou sem promoção em lugar nenhum, a seção **não aparece**
  (é vitrine, não é informação de que a pessoa precise para agir — e não pode
  afirmar "não há promoção" sem saber).

### 11.3 Localidade, não distância

Nem as arenas nem os perfis têm coordenadas — têm **cidade e estado**. Medir
quilômetros exigiria geocodificar os endereços num serviço externo e gravar
coordenadas em todas as arenas; ficou fora, porque mexeria no banco. O filtro
é por localidade (`domain/homeBanners.js`):

| Região | O que mostra |
|---|---|
| Minha cidade (padrão) | arenas da cidade do perfil |
| Meu estado | arenas do estado do perfil |
| Outra cidade | só cidades que TÊM promoção agora, com a contagem — quem vai viajar |
| Todo o Brasil | tudo |

A comparação ignora acento e caixa ("São Paulo" = "sao paulo"). A escolha fica
guardada por usuário no navegador (`v2:view:<uid>:home:promocoes:regiao`,
`viewPreference`) — **nada no banco**. ⭐ **Sem cidade nem estado no perfil, a
tela NÃO mostra o Brasil inteiro**: era exatamente o que o pedido queria
evitar. Ela pede a cidade (seletor ou perfil). Região sem promoção diz isso e
oferece trocar.

### 11.4 De onde vem

`listHomeBannerCoupons`: `where('show_home','==',true)` +
`where('active','==',true)`, com `limit(100)`. Só igualdades — o Firestore
resolve sem índice composto, e `active` entra para o cupom desligado não
ocupar as vagas do limite. Validade (prazo, usos), módulo ligado na arena e
região são conferidos no domínio (`eligibleBanners`/`homeBanners`), e só as
arenas que TÊM banner são buscadas (`arenaQueries.arena`, já em cache quando a
pessoa passou pela lista). `arena_coupons` já era legível por conta logada, e
duas asserções novas no emulador provam: conta logada lista os banners;
anônimo, não.

### 11.5 O que NÃO pode regredir

1. Sem saber a cidade, **não** mostrar tudo — pedir.
2. `show_home` sem `show_public` não existe; indicação nunca vira banner.
3. O carrossel respeita "menos movimento", pausa com foco/toque e tem botão
   de pausar (WCAG 2.2.2).
4. Falha não vira "não há promoção" — a seção some.

**Banco:** zero coleção, zero índice, zero regra. Um campo opcional
(`arena_coupons.show_home`).
