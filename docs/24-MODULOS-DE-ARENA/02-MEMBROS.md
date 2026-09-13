# Módulo Membros — níveis, pacotes, mensalidade e carteira

> Família `members`, com quatro módulos: `members_tiers`, `members_packages`,
> `members_subscription`, `members_wallet`.
>
> Onda 2. Ver o chassi em `00-INDEX.md`.

---

## 1. A pergunta que este módulo responde

A arena vive de venda avulsa: cada reserva é uma transação nova, com alguém
decidindo do zero se vale a pena. Membro é o contrário disso — é a pessoa que
já decidiu. Este módulo dá à arena as quatro ferramentas que transformam
frequência em relação:

| Módulo | O que faz | Onde aparece para o atleta |
|---|---|---|
| `members_tiers` | Níveis por pontos, com desconto e vantagens | "Você nesta arena" + **no preço da reserva** |
| `members_packages` | Pacotes de horas pré-pagas, com validade | idem, e as horas **abatem na reserva** |
| `members_subscription` | Mensalidade com vencimento e histórico | "Você nesta arena" |
| `members_wallet` | Saldo e extrato na arena | idem, e o saldo **abate na reserva** |

---

## 2. 🐞 O elo que faltava: o benefício não chegava ao preço

O módulo já sabia calcular níveis ("Ouro dá 10%") e já vendia pacotes de
horas. Só que **nada disso chegava à reserva**: o preço saía de
`totalBookingPrice(arena, …)`, que não conhece membro, e o pacote era um saldo
que ninguém debitava.

Um desconto que não desconta e um pacote que não abate são promessas sem
efeito — e a arena descobre isso quando o membro reclama.

### A conta, e por que nesta ordem

`memberBookingPrice` (`domain/memberBenefit.js`):

```
1. preço de tabela        totalBookingPrice
2. − horas do pacote      abatem HORAS, não percentual
3. − desconto do nível    percentual sobre o que sobrou
4. − saldo da carteira    abate reais, até zerar
```

**Pacote antes de desconto, de propósito.** A hora do pacote já foi paga;
aplicar percentual sobre ela seria dar desconto duas vezes. Há teste travando
exatamente esse caso.

### Onde a conta entra

| Momento | O que acontece |
|---|---|
| A tela do pedido | mostra o detalhamento e o "você paga" (`BookingRequestDialog`) |
| O serviço, ao GRAVAR | **refaz a conta** e grava o valor e o `member_benefit` |
| A confirmação da arena | **aí sim** consome horas e saldo, e credita os pontos |

A tela estima, quem grava confere — a mesma regra que já valia para o preço de
tabela (`precoDaReserva`).

**Consumir só na confirmação** é a decisão que evita o pior caso: queimar
horas de um pedido que a arena ainda pode recusar é cobrar por um jogo que não
vai acontecer.

E o consumo **não recalcula**: segue o plano gravado em
`member_benefit.package_plan`, o mesmo que o atleta viu. Recalcular poderia
debitar de um pacote diferente do que foi mostrado, e o extrato ficaria
inexplicável.

### Pontos

`pointsForBooking({ amount, hours })` = 1 ponto por real **+** 10 por hora.

As horas entram porque quem usa pacote **pagou antes e continua vindo** — não
pontuar essa visita puniria justamente o cliente mais fiel.

### Qual pacote é consumido primeiro

`planPackageConsumption` gasta **o que vence antes**. Sem isso o pacote velho
expira com saldo enquanto o novo é usado — e o cliente perde dinheiro por uma
decisão do sistema.

---

## 3. 🐞 A arena não conseguia incluir ninguém

A tela de gestão só LISTAVA. O texto do estado vazio dizia "conforme atletas
comprarem pacotes, eles aparecem aqui" — ou seja, a arena não tinha como
convidar ninguém. Um programa de membros em que a arena não inclui membros
não é um programa de membros.

Agora, em `/arenas/:id/gerir/membros`:

- **incluir** pelo diretório de atletas;
- **ajustar pontos** (+/−) e **creditar carteira**, com motivo — que vai para
  a auditoria e para o **extrato do atleta**;
- **remover** (sem apagar pacotes comprados nem saldo);
- **mensalidade** por membro: criar plano, registrar o mês recebido, editar,
  encerrar.

---

## 4. Mensalidade — do zero

`arena_subscriptions` tinha regra no Firestore e uma constante no serviço.
**Nenhuma função.** Foi escrita agora.

### Duas decisões que valem explicação

**Os meses pagos são uma LISTA, não um "pago até".** `paid_months:
['2026-06', '2026-08']` mostra quem pulou julho e pagou agosto — e é
justamente esse caso que a arena precisa enxergar. Um campo "pago até" perderia
essa informação.

**Antes do vencimento, o mês corrente não conta como atraso.** Cobrar no dia 1
uma mensalidade que vence no dia 10 é chamar de caloteiro quem está em dia.

**O vencimento vai só até o dia 28.** Dia 29, 30 e 31 não existem em todo mês,
e um plano cujo vencimento muda de dia conforme o mês confunde os dois lados.
(`dueDateForMonth` ainda protege contra dados antigos, prendendo no último dia
do mês.)

Pagamento é **Pix manual**, como o resto da plataforma: quem confirma que caiu
é a arena. Não há adquirente e o código não finge que há.

---

## 5. Impacto no banco

| Item | Mudou? |
|---|---|
| Coleção nova | **não** (`arena_members`, `arena_packages`, `arena_wallets`, `arena_subscriptions` já existiam com regra) |
| Índice novo | **não** (todas as consultas usam um `where` só) |
| Regra nova | **não** |
| Campo novo | `bookings.member_benefit` (opcional), `arena_settings.member_tiers` (opcional) |
| Migração | **não** — reserva antiga e não-membro seguem idênticas |

Os níveis da arena moram em `arena_settings.member_tiers`, e **não** em
`arena_tier_configs`: aquela coleção só o admin da plataforma pode escrever,
o que impediria a arena de configurar os próprios níveis.

## 6. Onde está o quê

| Camada | Arquivo |
|---|---|
| Domínio | `domain/members.js`, `domain/memberBenefit.js`, `domain/subscription.js` |
| Serviço | `services/membersService.js` (`getMemberContext`, `consumeMemberBenefit`, mensalidade) |
| Reserva | `services/bookingService.js` (`precoComBeneficio`, `aplicarBeneficioNaConfirmacao`) |
| Telas | `V2ArenaMembers` (atleta), `V2ArenaAdminMembers` (arena), `BookingRequestDialog` (o preço) |
