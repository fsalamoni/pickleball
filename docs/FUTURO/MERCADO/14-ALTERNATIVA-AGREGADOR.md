# 16.14 — Alternativa B: vitrine agregadora (acesso a marketplaces externos)

> Segunda estratégia levantada no pedido: *"ou então, criar um modo de
> acesso aos produtos desses mercados dentro da plataforma"*.
>
> Este documento existe para a decisão ser tomada com os dois caminhos na
> mesa. **Ela não é um plano B pior — em várias dimensões é melhor.**

## 1. A ideia

Em vez de hospedar anúncios, o PickleRush exibe **produtos de pickleball que
já existem** no Mercado Livre, Amazon, Shopee e nas lojas parceiras, dentro
de uma página interna com a cara da plataforma. O clique leva à loja de
origem, com link de afiliado.

O usuário ganha: catálogo grande e curado **de pickleball**, sem o ruído de
buscar "raquete" num marketplace generalista e receber raquete de tênis.
A plataforma ganha: receita de afiliação desde o dia 1, sem cold start, sem
risco de intermediação.

## 2. O que já existe no código e serve

O módulo **`partners/`** já faz exatamente o embrião disso:
- coleção `affiliate_links` (leitura pública, escrita só do admin);
- página `/parceiros` (`V2Partners`);
- aba "Parceiros" no painel admin, com CRUD e categorias
  (`AFFILIATE_CATEGORY_LABELS`);
- domínio `partners/domain/affiliate.js` com normalização, testado.

A alternativa B é, em boa medida, **fazer o `partners/` crescer** — não
começar do zero.

## 3. Escopo

### Fase A1 — Catálogo curado manual (2 PRs, ~2 semanas)
- Coleção `market_external_products` (prefixo `market_` mantido, sem
  colisão com `arena_products`/`catalog_products`):
  ```js
  { title, description, image_url, price_cents, currency:'BRL',
    original_price_cents, marketplace:'mercado_livre'|'amazon'|'shopee'|'loja',
    seller_name, affiliate_url, category_slug, brand, attributes:{},
    rating, review_count, in_stock, last_checked_at,
    curated_by, active, sort_order, created_at, updated_at }
  ```
- Admin cadastra produto colando o link + preenchendo os campos; ou cola só
  o link e uma Cloud Function busca os metadados (ver §5 — cuidado com SSRF).
- Página `/mercado` com vitrine, busca, filtros por categoria/marca/preço/
  marketplace, e cards que abrem o link de afiliado em nova aba.
- Rótulo obrigatório em **todo** card: "Você será levado ao {marketplace}.
  A compra acontece lá." + divulgação de afiliação (exigência do CDC e das
  próprias regras dos programas de afiliados).
- Regras: leitura pública, escrita só `isPlatformAdmin()`. Simples e seguro.

### Fase A2 — Integração por API (2 PRs, ~2-3 semanas)
- Cloud Function agendada que consulta as APIs de afiliado (Mercado Livre
  tem API pública de busca; Amazon exige o Product Advertising API com
  volume mínimo de vendas; Shopee tem programa próprio) e atualiza preço,
  estoque e disponibilidade.
- Alerta de queda de preço para quem favoritou.
- Comparação de preço do mesmo produto entre marketplaces — **este é o
  recurso que ninguém mais oferece para pickleball no Brasil.**

### Fase A3 — Ponte com o catálogo interno (1 PR)
- Cruzar `market_external_products` com `catalog_products` (o catálogo
  padrão que as arenas já alimentam) pela `dedup_key`, para a ficha do
  produto mostrar: onde comprar novo (externo) **e** quem tem usado à venda
  (marketplace próprio, se a estratégia A existir) **e** qual arena tem no
  balcão (PDV).

## 4. Comparação honesta

| Critério | A · Marketplace próprio | B · Vitrine agregadora |
|---|---|---|
| Tempo até o ar | 9-12 semanas | 2-3 semanas |
| Cold start | grave (prateleira vazia) | inexistente |
| Receita | comissão, só na Fase 3 | afiliação desde o dia 1 |
| Margem por venda | maior (5-10%) | menor (1-5%) |
| Risco legal | alto (CDC, disputa, intermediação) | baixo (vitrine + link) |
| Moderação | obrigatória e pesada | quase nenhuma (catálogo curado) |
| Custo de infra | ~US$ 42/mês | ~US$ 3/mês |
| Diferencial competitivo | reputação com contexto do PickleRush | curadoria + comparação de preço |
| Retém o usuário | sim (transação dentro) | não (manda pra fora) |
| Usado entre atletas | ✅ o caso mais pedido | ❌ não cobre |
| Arena/professor vendendo | ✅ | ❌ |

**A limitação decisiva da B**: ela **não** resolve o caso que originou a
ideia — o atleta que quer vender a raquete usada. Marketplace externo não
tem "a raquete do Fernando, que joga na Arena X".

## 5. Riscos específicos da B

| Risco | Mitigação |
|---|---|
| **SSRF** no scraping de metadados por link | allowlist de domínios, timeout curto, bloquear IPs privados, no máx. 2 redirects, roda só em Cloud Function e só para admin |
| Direito de imagem/uso das fotos dos produtos | usar só as imagens que o programa de afiliados autoriza; nunca fazer hotlink fora dos termos |
| Termos dos programas de afiliados | Amazon e Mercado Livre exigem divulgação explícita e proíbem certos usos; ler os termos **antes** de codar |
| Preço desatualizado (usuário chega e é outro valor) | `last_checked_at` visível; API na Fase A2; nunca prometer preço |
| Virar catálogo morto | curadoria ativa; sem dono, o catálogo apodrece em 3 meses |
| Percepção de "propaganda" | curadoria de qualidade, sem encher de link; rótulo honesto |

## 6. Recomendação

**Fazer a B primeiro, e usá-la como teste de demanda para a A.**

Racional:
1. Em 2-3 semanas há algo no ar, gerando dado real sobre o que a comunidade
   procura (as buscas do agregador são um mapa de demanda gratuito).
2. A receita de afiliação, ainda que pequena, financia a conversa sobre a A.
3. Se em 3 meses o agregador tiver tráfego consistente, a A tem justificativa
   e um catálogo de referência pronto (`market_external_products` vira
   dicionário de produto no wizard de anúncio).
4. Se não tiver tráfego, a plataforma economizou 3 meses de trabalho.
5. As duas convivem: a vitrine agregadora vira uma aba do marketplace
   próprio ("Comprar novo") ao lado de "Usados da comunidade".

Isso **não** é abandonar a A — é ordená-la depois de um teste barato.
A decisão final é do dono da plataforma; ambos os caminhos estão desenhados.
