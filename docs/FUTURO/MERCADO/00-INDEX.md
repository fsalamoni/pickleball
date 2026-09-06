# 16 — MERCADO (Marketplace PickleRush)

> **Status: 📐 PLANEJADO — nada implementado.** Este diretório é o desenho
> completo da funcionalidade. Nenhuma linha de código, regra de segurança,
> coleção ou flag foi criada. Ao começar a implementar, siga
> `11-PLANO-DE-DESENVOLVIMENTO.md` na ordem e marque o progresso aqui.

## O que é

Um **marketplace aberto de pickleball dentro do PickleRush** — a referência
mental é **eBay / Mercado Livre / Amazon**, não a loja de uma arena: uma
página interna onde qualquer vendedor anuncia e qualquer usuário compra,
com vitrine, busca, negociação, pedido e reputação.

> **Esclarecimento do dono da plataforma (set/2026)**: o que se pretende é
> "um espaço interno, uma página interna, de marketplace aberto, exatamente
> como o eBay, o Mercado Livre e a Amazon". Isso é **diferente** do mercado
> que já existe nas arenas, que é basicamente gestão dos produtos vendidos
> por aquela arena.

### Duas estratégias possíveis (decisão em aberto)

| | **A · Marketplace próprio** | **B · Vitrine agregadora** |
|---|---|---|
| O que é | anúncios nascem e vivem no PickleRush | acesso, de dentro da plataforma, aos produtos de marketplaces externos |
| Quem vende | atletas, arenas, professores, clubes, lojas | lojas já presentes em Mercado Livre / Amazon / Shopee |
| Transação | dentro da plataforma (Pix manual na Fase 1) | fora — o clique leva ao marketplace de origem |
| Receita | comissão (Fase 3) | **afiliação** (o módulo `partners/` já faz link de afiliado) |
| Esforço | ~10 PRs, 9-12 semanas | ~2-3 PRs, 2-3 semanas |
| Risco legal | alto (CDC, intermediação, disputa) | baixo (é vitrine e link) |
| Estoque/preço | responsabilidade do vendedor | vem do parceiro, sempre atualizado |
| Diferencial | reputação com o contexto do PickleRush | catálogo grande no dia 1, sem cold start |

**Estes 14 documentos detalham a estratégia A**, que é a mais ambiciosa e a
que o pedido descreve. A estratégia B está desenhada em
`14-ALTERNATIVA-AGREGADOR.md` e pode ser feita **antes** — inclusive como
forma de medir demanda real antes de investir 3 meses na A. As duas
convivem: nada impede a vitrine agregadora continuar existindo depois que
o marketplace próprio nascer.

---

O marketplace próprio tem dois ambientes plenos:

- **Ambiente público (comprador)** — vitrine, busca com filtros profundos,
  página do anúncio, página do vendedor, negociação, oferta, pedido,
  pagamento, acompanhamento, avaliação.
- **Ambiente de gestão (vendedor)** — painel de vendas, CRUD de anúncios,
  estoque, caixa de ofertas, kanban de pedidos, entrega, financeiro,
  avaliações, políticas, analytics.

Vendem: **atletas** (usados entre pares), **arenas**, **professores**,
**clubes**, **lojas/marcas parceiras** e a **própria plataforma**.

## ⚠️ Colisão de nomes (leia antes de codar)

A palavra "mercado" já existe na plataforma com **outro** significado:

| Coisa | O que é | Rota | Coleções |
|---|---|---|---|
| **Mercado da arena** (existe hoje) | PDV/loja interna de UMA arena — estoque, venda no balcão, caixa | `/arenas/:id/loja`, `/arenas/:id/gerir/pdv` | `arena_products`, `arena_sales`, `arena_inventory_*`, `arena_market_reports` |
| **Catálogo padrão** (existe hoje) | Lista mestra de produtos compartilhada, alimenta o PDV das arenas | aba `catalog` do painel admin | `catalog_products` |
| **Mercado** (ESTE doc, novo) | Marketplace público multi-vendedor da plataforma | `/mercado` | `market_*` |

**Regra dura**: o marketplace novo usa **exclusivamente** o prefixo
`market_`. Não renomeie, não reaproveite e não escreva em nenhuma coleção
`arena_*` ou `catalog_products` — a integração com elas é por **espelho e
referência** (`10-INTEGRACOES.md`), nunca por escrita cruzada.

Na UI, para o usuário final: o novo é **"Mercado"**; o da arena passa a ser
chamado sempre de **"Loja da arena"** (mudança só de rótulo, sem mexer em
código, feita na Onda U8).

## Mapa dos documentos

| Doc | Conteúdo | Leia se você vai... |
|---|---|---|
| `01-VISAO-E-ESCOPO.md` | Problema, objetivos, não-objetivos, métricas de sucesso, fases | entender o porquê |
| `02-PERSONAS-E-JORNADAS.md` | 7 personas, 12 jornadas ponta a ponta, estados de erro | desenhar tela ou fluxo |
| `03-DOMINIO-E-TAXONOMIA.md` | Tipos de anúncio, categorias, atributos por categoria, condição, entrega, máquinas de estado | escrever `domain/` |
| `04-DATA-MODEL.md` | 18 coleções `market_*`, schema campo a campo, índices compostos | escrever `services/` ou `firestore.indexes.json` |
| `05-REGRAS-FIRESTORE.md` | `firestore.rules` aditivo, helpers novos, matriz de permissão, testes no emulador | mexer em segurança |
| `06-UX-ROTAS-E-TELAS.md` | 19 rotas, árvore de componentes, wireframes em texto, design tokens | escrever `v2/pages/` |
| `07-VENDEDOR-GESTAO.md` | O ambiente de gestão inteiro, tela a tela | construir o painel do vendedor |
| `08-NEGOCIACAO-PEDIDOS-PAGAMENTO.md` | Ofertas, chat contextual, checkout, Pix manual, disputas, estorno | construir pedido/pagamento |
| `09-ADMIN-E-CONFIGURACOES.md` | Seção nova do painel admin, todas as chaves de configuração | construir o admin |
| `10-INTEGRACOES.md` | PDV da arena, catálogo, professor, clube, chat, notificações, busca, feed, gamificação | integrar |
| `11-PLANO-DE-DESENVOLVIMENTO.md` | 9 PRs da Onda U, dependências, critérios de aceite, estimativas | planejar sprint |
| `12-TESTES-E-QUALIDADE.md` | Plano de testes: domain, runtime, regras, E2E | escrever teste |
| `13-RISCOS-LEGAL-E-CUSTO.md` | CDC, Marco Civil, LGPD, itens proibidos, custo Firestore/Storage | avaliar risco |
| `14-ALTERNATIVA-AGREGADOR.md` | ⭐ Estratégia B: vitrine de produtos de marketplaces externos (afiliação), comparação honesta com a A e recomendação | decidir a estratégia |

## Documentos irmãos

- `docs/FUTURO/FEED/` — a rede social (feed). Compartilha moderação e mídia.
- `docs/FUTURO/CONFIANCA-E-MODERACAO/` — denúncias, fila, strikes, bloqueio.
  **Infra compartilhada pelos dois** — leia antes de duplicar qualquer coisa.
- `docs/FUTURO/PLANO-MESTRE-MERCADO-FEED.md` — cronograma consolidado das duas
  ondas, com o que pode ser paralelizado.
