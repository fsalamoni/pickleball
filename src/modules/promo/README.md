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

A interface vive em `src/v2/components/promo/` e reaproveita os componentes
da arena (tíquete, editor de arte, editor de banner, envio de imagem) — **nunca
copie** esses componentes: eles aceitam `templates`/`brand`/`uploadFolder`.

Coleções (`firestore.rules` § Divulgação): `promo_coupons`, `promo_campaigns`
(leitura por conta logada; escrita só do emissor, que não muda no update) e
`promo_settings/{platform|uid}` (privada do emissor: custo dos vales e
modelos). Mais o campo opcional `coach_lessons.coupon`.

⚠️ Três coisas que não podem regredir:

1. o **custo do vale** nunca vai no cupom (legível por qualquer conta);
2. o cupom do pedido de aula nasce **pendente** e só o professor o aplica, na
   confirmação, conferindo contra o banco;
3. o link do **aviso** nunca leva `#` (`promoNoticeLink`) — a regra recusaria o
   lote inteiro.
