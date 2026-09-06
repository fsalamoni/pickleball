# 16.12 — Testes e qualidade do Mercado

## 1. Pirâmide

```
        E2E (Playwright)              8 cenários
     Runtime (Vitest + RTL)          ~45 testes
   Regras (emulador Firestore)        40 asserções
 Domínio puro (Vitest)               ~284 testes
```

Total alvo: **~599 testes novos** (hoje o projeto tem 2867).

## 2. Domínio — o que precisa de teste (não negociável)

| Arquivo | Casos críticos |
|---|---|
| `pricing.js` | centavos, arredondamento, BRL com ponto e vírgula, frete grátis acima de X, taxa 0 e taxa futura, total negativo impossível |
| `orderStatus.js` | **matriz completa** de transições × 4 papéis; toda transição inválida negada; `nextActionsFor` nunca devolve ação sem permissão |
| `offers.js` | rodadas, limite, expiração, auto-recusa, oferta duplicada, oferta no próprio anúncio |
| `eligibility.js` | cada motivo de bloqueio isolado; limites por tier; strike |
| `search.js` | score determinístico, empate estável, haversine, boost sinalizado, `explain` coerente |
| `searchTerms.js` | acento, maiúscula, stopword, dedupe, corte em 60, string vazia |
| `reputation.js` | cegueira mútua, decaimento, mínimo de 3 avaliações, histograma |
| `taxonomy.js` | herança de atributos, categoria inexistente, tombstone, breadcrumb |
| `listing.js` | título vazio/longo, sem foto, preço 0, atributo obrigatório faltando, HTML injetado na descrição |

**Padrão de teste de máquina de estado** (usar em `orderStatus` e `offers`):
tabela exaustiva `[from, to, actor, esperado]`, para nenhuma transição
ficar sem cobertura por esquecimento.

## 3. Regras (emulador)

Arquivo `tests/rules/marketplace.rules.test.js`, no mesmo espírito das 24
asserções do dia de jogo. As 40 asserções estão listadas em
`05-REGRAS-FIRESTORE §5`. Rodar em CI:

```bash
firebase emulators:exec --only firestore "npx vitest run tests/rules/marketplace"
```

Casos que **não podem** faltar:
- comprador não lê `min_acceptable_cents`;
- comprador não lê a chave Pix antes de `accepted`;
- vendedor não lê o endereço antes de `accepted`;
- ninguém deleta `market_orders`;
- ninguém edita `market_orders/{id}/events`;
- avaliação sem pedido concluído é negada;
- ex-gestor de arena perde o acesso de venda.

## 4. Runtime (componentes V2 críticos)

`V2MarketListing.runtime.test.jsx`, `V2MarketCheckout.runtime.test.jsx`,
`V2MarketSellerOrders.runtime.test.jsx`, `V2MarketListingEditor.runtime.test.jsx`,
`V2Market.flagOff.runtime.test.jsx`.

O último é obrigatório em **todo PR a partir do U2**: com a flag desligada,
a página não renderiza, nenhum hook dispara, nenhuma leitura de Firestore
acontece. É o teste que protege o princípio da aditividade.

## 5. E2E (Playwright)

| # | Cenário |
|---|---|
| E1 | Anunciar produto usado com foto, publicar, achar na busca |
| E2 | Comprar com preço fixo, pagar Pix, concluir, avaliar |
| E3 | Negociar por oferta com contraproposta e fechar |
| E4 | Pedido expira por falta de pagamento e o estoque volta |
| E5 | Denunciar anúncio e o admin remover |
| E6 | Arena publica produto do PDV e a venda baixa o estoque |
| E7 | Flag desligada: `/mercado` some e o resto da plataforma segue igual |
| E8 | Mobile: filtrar, favoritar e conversar |

## 6. Checklist de qualidade por PR (além do CLAUDE.md §7)

- [ ] Nenhuma `V2Dialog` sem `max-h-[90dvh] overflow-y-auto`.
- [ ] Nenhum valor monetário em float — só centavos inteiros.
- [ ] Nenhum botão de ação sem permissão renderizado (nem desabilitado).
- [ ] Todo estado vazio tem CTA.
- [ ] Toda escrita relevante grava `audit_logs`.
- [ ] Nenhum `console.log` em `services/`.
- [ ] Toda string visível em pt-BR.
- [ ] `sectionId` de colapsável estável e documentado.
- [ ] Imagens com `alt` derivado do título.
- [ ] Toda query nova tem índice correspondente em `firestore.indexes.json`.

## 7. Dados de teste

`scripts/seed-marketplace.mjs` (não versionado em produção): cria 3
vendedores de cada tipo, 60 anúncios cobrindo todas as categorias, 15
ofertas em estados diferentes, 10 pedidos em cada etapa da máquina, 20
avaliações. Essencial para desenvolver a UI sem depender de dados reais.
