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

---

## 12. Banners de campanha (Onda CC, 2026-09-25)

**Pedido:** *"Em marketing, em campanhas, precisa ter a possibilidade de
criação, dentro da plataforma, de banner específico da campanha, com
hiperlink para os detalhes da campanha ou para as funções específicas
(reservas, dia de jogo, torneio, produto, membros etc.). A arena deve ter
meios de ou gerar o respectivo banner na própria plataforma, ou fazer upload
do banner, caso em que deve ter expressas referências para o tamanho do
banner e demais detalhes que sejam importantes. Pode inclusive criar 5
padrões (modelos) para utilização e edição. As arenas devem poder salvar os
seus próprios modelos."*

Antes, a campanha era só um AVISO no aplicativo para um público. Agora ela
pode ter um **banner**, que aparece na página da arena ("Em destaque") e, se a
arena quiser, na tela inicial — e leva a um lugar da plataforma.

### 12.1 O editor (Central → Marketing → Campanhas)

`CampaignsPanel` + `CampaignForm` (`v2/components/arenas/marketing/campaigns/`),
na ordem da decisão de quem faz marketing:

1. **O que é** — o nome (título do aviso, e como a arena acha a campanha).
2. **Para onde leva** (`DestinationPicker`) — uma lista FECHADA de destinos,
   nenhum link digitado: página da campanha, reservar, jogos abertos, um dia
   de jogo, um torneio, um produto da loja, planos, aulas, promoções, ranking
   da casa. Só aparecem os destinos dos módulos que a arena ligou; destino de
   UM item pede "qual?" numa lista do que existe (e a lista que falhou diz que
   falhou).
3. **Banner** — criar na plataforma (`BannerDesigner`), enviar a imagem
   (`BannerUploader`) ou sem banner.
4. **Onde aparece e até quando** — página da arena (padrão), tela inicial
   (opcional), data de saída (padrão 14 dias, máximo 120).
5. **Aviso no aplicativo** — opcional; o público mostra quantas pessoas ANTES.

O botão não fica mudo: a linha **"Falta: …"** diz o quê. A confirmação resume
onde aparece, para onde leva e para quantas pessoas vai o aviso. Na lista, cada
campanha mostra o estado do banner (**no ar até** / **pausado** /
**encerrado** / só aviso), "Ver como o atleta vê", **Pausar / Voltar ao ar**
(só `banner_active`) e **Editar o banner** (desenho, destino, lugar e data — o
aviso já enviado nunca é reenviado). Falha ao carregar diz que falhou e **não**
oferece criar outra.

### 12.2 Os cinco modelos e os modelos da arena

`domain/bannerArt.js`. Cinco modelos da plataforma, congelados:
**Destaque**, **Oferta** (um número grande: "20% OFF"), **Evento** (a data em
destaque), **Vitrine** (com foto) e **Chamado**. A arena troca textos (com
contador e limite), cores ("Usar a cor da arena" aplica a marca) e vê o
resultado no computador (2:1) e no celular (16:9). Contraste abaixo de 4,5:1
vira aviso; a cor do texto é escolhida por contraste quando não informada.

**Modelos da arena**: "Salvar como meu modelo" grava em
`arena_settings.banner_templates` (até 20, ids `arena:…`). Os cinco da
plataforma **nunca mudam** — editar um e salvar cria um modelo da arena ao
lado deles. Atualizar e apagar valem só para os da arena, e apagar pede
confirmação. Trocar de modelo mantém os textos que a pessoa já escreveu
(`switchTemplate`).

### 12.3 Enviar a própria arte

A especificação vem **antes** do botão (`BANNER_UPLOAD_SPEC`,
`bannerUploadGuide`): **1600 × 800 px** (2:1), mínimo **1200 × 600**, JPG/PNG/
WebP, ideal até 2 MB (máximo 5 MB), **área segura** de 80% × 70% (no celular
as laterais são cortadas), sem botão desenhado (o banner já é clicável) e com
um desenho da área segura. A imagem é **conferida antes de subir**
(`checkBannerImage`): pequena demais não sobe; proporção diferente sobe com
aviso. A pré-visualização mostra os dois recortes com a área segura por cima.
A **descrição** é obrigatória (leitor de tela). O arquivo vai para
`uploads/{uid}/arena-banners/…` pela regra de Storage que já existia; a URL só
é aceita se for do Storage do projeto (`isAllowedImageUrl`).

### 12.4 Onde o atleta vê

- **Página da arena → "Em destaque"** (`ArenaCampaignsSection`, âncora
  `#arena-campanhas`), logo depois das perguntas de chegada e satisfação: um
  banner em largura inteira, ou uma fileira que desliza com o próximo
  aparecendo na borda. Nada gira sozinho aqui.
- **Tela inicial** — o mesmo carrossel das promoções (Onda BZ), com o mesmo
  filtro de região; o título vira "Destaques em …" quando há campanha.
- **Página da campanha** — `/arenas/:arenaId/campanhas/:campaignId`
  (`V2ArenaCampaign`): banner, mensagem, validade, o destino como ação
  principal e "Reservar um horário". Separa **falhou** (tentar de novo), **não
  existe** (leva à arena) e **acabou** (mostra o que era e diz que acabou).
- **Loja** — o destino "um produto" abre `/arenas/:id/loja?produto=…` com o
  produto **em destaque**, antes do catálogo.

O banner inteiro é UM link (um alvo grande; o leitor de tela anuncia "título.
Chamada — arena", não cada pedaço do desenho).

### 12.5 De onde vem

- Página da arena: `where arena_id == X` + `where show_on_arena == true`.
- Tela inicial: `where show_home == true` + `where banner_active == true`,
  `limit`.

Só igualdades — sem índice composto. "No ar" (ativo e dentro da data), módulo
ligado e região são conferidos no domínio (`campaignBanner.js`,
`homeBanners.js`). O serviço (`campaignBannerService.js`) **refaz toda a
validação** antes de gravar.

### 12.6 O que NÃO pode regredir

1. Os cinco modelos da plataforma não mudam; salvar cria modelo da arena.
2. Destino é lista fechada — nenhum link digitado.
3. Imagem enviada: especificação antes, conferência antes de subir,
   descrição obrigatória, só URL do Storage do projeto.
4. Falha não vira "nenhuma campanha" nem "não há promoção"; sem a lista não
   se oferece criar outra.
5. Com uma fonte falhando na tela inicial, a região vazia não afirma nada.

**Banco:** zero coleção, zero índice, **zero regra**. Campos opcionais em
`arena_campaigns` (`banner`, `destination`, `show_on_arena`, `show_home`,
`banner_until`, `banner_active`) e `arena_settings.banner_templates`. As
regras de sempre já deixavam a arena escrever as campanhas dela (com a trava de
não trocar de arena, Onda BX) e as configurações dela; 14 asserções novas no
emulador (`tests/rules/campaignBanners.rules.test.js`) provam as escritas, as
duas consultas e que o atleta e outra arena não mexem em nada.

---

## 13. A arte do cupom e o "copiar o código" (Onda CD, 2026-09-25)

**Pedido:** *"A mesma coisa para cupons, deve ter padrões e modelos, mas
permitir que a arena também faça upload ou crie o seu próprio. E deve ser
possível copiar o código."*

### 13.1 O cupom vira um TÍQUETE

`CouponArt` (`v2/components/arenas/marketing/coupons/`): a parte principal diz
o que o cupom dá; o **canhoto**, do outro lado do picote, traz o **código** —
sempre o de verdade, montado pela tela. Com `copyable`, o código do canhoto é
o botão de copiar. O tíquete responde à própria largura (container query):
largo, o canhoto fica ao lado; estreito (celular, carrossel), ele desce e vira
uma faixa. Aparece em: **página da arena → Promoções**, **tela inicial** (o
cupom com arte vira tíquete no carrossel), **Central → Cupons** (a lista mostra
o cupom como o atleta vê) e na **prévia do editor**.

### 13.2 Cinco modelos, os da arena, e a imagem enviada

`domain/couponArt.js`: **Clássico**, **Neon**, **Quadra**, **Festa** e **Sol**,
congelados. Título e texto vêm **em branco** de propósito: em branco, valem o
benefício ("10% de desconto", "1 água de coco") e a descrição do próprio
cupom — a arte nunca desmente o cupom, nem quando o desconto muda depois. A
arena personaliza chamada, título, texto e as três cores (fundo, texto,
canhoto), com "Usar a cor da arena" e aviso de contraste.

**Modelos da arena** em `arena_settings.coupon_templates` (até 20, ids
`arena:…`), com as mesmas regras dos modelos de banner (`saveArenaTemplate`
generalizado com `normalize`); apagar pede confirmação; os cinco da plataforma
nunca mudam.

**Imagem enviada** (`COUPON_UPLOAD_SPEC`): 1200 × 600 (2:1), mínimo 800 × 400,
JPG/PNG/WebP, até 1 MB (máximo 5 MB), margem de 90% × 80% — e **sem o código
escrito nela**: a plataforma mostra o código no canhoto, copiável, e ele nunca
fica desatualizado. Descrição obrigatória. Vai para
`uploads/{uid}/arena-coupons/…` pela regra de Storage de sempre. O envio
reaproveita o `BannerUploader` da Onda CC (agora com `spec`/`guide`/`folder`/
`preview`).

### 13.3 Copiar o código

`CopyCodeButton` (`v2/ui/`): o código **é** o botão — alvo grande, código à
vista, ícone de copiar, ✓ por dois segundos, nome acessível ("Copiar o código
VERAO10") e o resultado anunciado ao leitor de tela. `useClipboard` ganhou o
caminho antigo (`execCommand`) quando a API moderna recusa, e a mensagem de
erro de um código **traz o código** — é o que a pessoa vai anotar.

### 13.4 O que NÃO pode regredir

1. O código nunca vai dentro da imagem; é sempre o do cupom, copiável.
2. Os cinco modelos não mudam; salvar cria modelo da arena.
3. Editar um cupom antigo **sem mexer na arte** não grava arte nenhuma
   (`art` só entra no que se grava quando o formulário a manda — e `update`
   sem ela não apaga a de ninguém).
4. A indicação não tem arte (ela tem o próprio cartão).

**Banco:** zero coleção, zero índice, **zero regra**. Um campo opcional
(`arena_coupons.art`) e `arena_settings.coupon_templates`. 8 cenários novos no
emulador (`tests/rules/couponArt.rules.test.js`): a arena cria/edita/tira a
arte do cupom dela; outra arena e o atleta não; o atleta lê; os modelos só a
arena lê e grava.
