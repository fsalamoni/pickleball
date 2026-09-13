# Onda 3 — Marketing e fidelidade

> **Módulos**: `marketing` · `marketing_coupons` · `marketing_campaigns` ·
> `marketing_nps` · `marketing_referral` · `marketing_loyalty`
> **Chave-mestra**: flag `arena_modules` (default OFF).
> **Banco**: zero coleção nova, zero índice novo, zero regra nova.

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
