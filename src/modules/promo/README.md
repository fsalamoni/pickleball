# promo/ — cupons e campanhas da PLATAFORMA e dos PROFESSORES (Onda CG)

Flags `platform_marketing` e `coach_marketing` (default OFF). As mesmas
ferramentas do marketing da arena, para dois emissores novos. Documento
completo: `docs/29-INICIO-PERSONALIZADO-E-DIVULGACAO.md` §2.

```
promo/
├── domain/
│   ├── promo.js         # emissor, tipos por emissor, alcance (Brasil/estado/cidade), "só alunos",
│   │                    # destinos, públicos do aviso, controle de uso, itens da tela inicial,
│   │                    # o cupom na confirmação da aula (resolveLessonCoupon)
│   └── lessonCoupon.js  # a parte LEVE do cupom na aula (saneamento + texto) — sem dependências
├── services/
│   └── promoService.js  # cupons, recepção (transação), campanhas, vitrines, configurações privadas
└── hooks/
    └── usePromo.js      # chaves em `promoKeys`; `usePromoTemplatesSource` alimenta os editores de arte
```

O campo de cupom do PEDIDO DE AULA é `v2/components/promo/LessonCouponField`
(sob demanda): cupons do professor para tocar, estimativa com desconto, "só
alunos" e o uso que voltou.

A interface vive em `src/v2/components/promo/` e reaproveita os componentes
da arena (tíquete, editor de arte, editor de banner, envio de imagem) — **nunca
copie** esses componentes: eles aceitam `templates`/`brand`/`uploadFolder`.

Coleções (`firestore.rules` § Divulgação): `promo_coupons`, `promo_campaigns`
(leitura por conta logada; escrita só do emissor, que não muda no update) e
`promo_settings/{platform|uid}` (privada do emissor: custo dos vales e
modelos). Mais o campo opcional `coach_lessons.coupon`.

⚠️ O que não pode regredir:

1. o **custo do vale** nunca vai no cupom (legível por qualquer conta);
2. o cupom do pedido de aula nasce **pendente** e só o professor o aplica, na
   confirmação, conferindo contra o banco — e a regra de `coach_lessons`
   confere o mesmo (o aluno pede e cancela, nada além);
3. o link do **aviso** nunca leva `#` (`promoNoticeLink` / `linkDeAviso`) — a
   regra recusaria o lote inteiro;
4. **"só para os meus alunos" vale no USO**: o pedido recusa quem sabidamente
   não é aluno, e a confirmação confere `coach_students` (sem conseguir
   conferir, o cupom segue pendente);
5. **um uso é uma aula**: na série recorrente o cupom cobre a primeira
   (`lessonCouponBase`);
6. **aula desfeita devolve o uso** (`pendingCouponReturn`,
   `returnPendingCouponUses` no serviço de aulas) — numa transação que lê a
   aula, porque roda em mais de um lugar;
7. **"enviado para N" é o que foi gravado**: `notifyUsers` devolve a
   contagem, e a campanha guarda `recipients_count` e `sent_count` (o
   confirmado).
