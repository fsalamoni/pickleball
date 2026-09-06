# 16.07 — Ambiente de gestão do vendedor

> Este é o "segundo acesso" pedido: completo, profundo, organizado. Um
> vendedor sério precisa conseguir tocar o negócio dele inteiro aqui.

## 1. Onboarding de vendedor (4 passos, `V2MarketSellerOnboarding`)

Disparado no primeiro clique em "Vender". Não é pulável.

| Passo | Coleta | Bloqueia? |
|---|---|---|
| 1 · Quem vende | escolhe a identidade: eu mesmo / arena que gerencio / clube que administro / meu perfil de professor. Só aparecem as que o usuário realmente comanda (checado contra `arena_managers`, `club_members`, `coaches`) | sim |
| 2 · Seus dados | nome de exibição, cidade/estado, foto, bio curta, telefone (privado) | sim (perfil obrigatório completo) |
| 3 · Recebimento | chave Pix + tipo + nome do recebedor + QR opcional. Vai para a **subcoleção privada** | sim |
| 4 · Como entrega | formas padrão, locais de retirada (atalho para as arenas do usuário), frete fixo ou zonas, prazo de envio | sim |
| Final | aceite dos **Termos do Mercado** → grava `legal_consents/{uid}_market_terms` (reaproveita o módulo `legal/`) | sim |

Cria `market_sellers/{sellerKey}` com `status: 'active'` (ou `'pending'` se
o admin exigir aprovação para aquele tipo — `store` sempre exige).

## 2. Painel (`/mercado/vender`)

**Bloco "Precisa de você"** — a única coisa acima da dobra. Itens gerados
por uma função pura `buildSellerTodos(orders, offers, listings, config)`:

| Situação | Urgência | Ação |
|---|---|---|
| Oferta expira em < 12h | 🔴 | Responder |
| Pedido novo aguardando aceite (> 12h) | 🔴 | Aceitar/Recusar |
| Comprovante enviado, não conferido | 🟠 | Conferir |
| Pedido pago, não enviado, SLA estourando | 🔴 | Marcar enviado |
| Pedido entregue há 5 dias, sem avaliação | 🟡 | Lembrar comprador |
| Anúncio expira em 3 dias | 🟡 | Renovar |
| Anúncio rejeitado na moderação | 🟠 | Corrigir |
| Estoque zerado com visitas altas | 🟡 | Repor |
| Disputa aberta | 🔴 | Responder |

**KPIs** (`V2MarketStatCard`): anúncios ativos · visitas 7d · favoritos ·
conversas · ofertas abertas · pedidos abertos · receita do mês ·
ticket médio · taxa de conversão · nota média · tempo médio de resposta.

## 3. Anúncios (`/mercado/vender/anuncios`)

- Tabela/lista com: foto, título, preço, estoque, status, views, favoritos,
  ofertas, expira em, última edição.
- Filtros: status, categoria, com oferta pendente, sem foto, expirando.
- Busca por título.
- **Ações em massa**: pausar, ativar, renovar, alterar preço em %, mudar
  categoria, encerrar, duplicar, promover (se o admin permitir).
- Ação por linha: editar, duplicar, pré-visualizar, estatísticas,
  compartilhar (gera link + card para o Feed), encerrar.
- Ordenação por qualquer coluna.
- Aviso de qualidade por anúncio: "sem descrição", "1 foto só",
  "sem atributos" — com impacto estimado na busca (o `completeness` do score).

## 4. Ofertas (`/mercado/vender/ofertas`)

Caixa de entrada, agrupada por: **Precisam de resposta** · Contrapropostas
enviadas · Aceitas · Encerradas.
Cada linha: comprador (com contexto: nível, clube, nº de compras), anúncio,
preço pedido × oferta (com % de desconto), mensagem, tempo restante.
Ações: **Aceitar** · **Contrapropor** (com sugestão do meio-termo) ·
**Recusar** (com motivo opcional) · **Conversar**.
Aceitar cria o pedido e reserva a unidade por `offer_hold_minutes`.

## 5. Pedidos (`/mercado/vender/pedidos`)

Kanban descrito em `06-UX` §3.7. Detalhe do pedido (`V2MarketOrder`,
compartilhado com o comprador, com `viewerRole` diferente):

```
Pedido PR-8F3K2                              [badge status]
Linha do tempo (a partir de market_orders/{id}/events)
Item · snapshot congelado do anúncio
Comprador: nome, contexto, nota como comprador
Entrega: retirada/envio · endereço (só após aceite) · rastreio
Pagamento: método, chave Pix usada, comprovante (miniatura + ampliar),
           [Confirmar recebimento do Pix] [Recusar comprovante]
Conversa: link para o chat contextual
Ações permitidas (só as visíveis pelo nextActionsFor)
Notas internas (privadas do vendedor)
```

## 6. Avaliações (`/mercado/vender/avaliacoes`)

- Recebidas (com filtro por nota), histograma, evolução no tempo.
- **Responder publicamente** (uma resposta por avaliação, editável 24h).
- Avaliações a fazer (o vendedor também avalia o comprador).
- Denunciar avaliação abusiva → vai para a fila de moderação (docs/18).

## 7. Financeiro (`/mercado/vender/financeiro`)

Fase 1 (sem gateway) é um **livro-caixa do que foi combinado**, não um
extrato bancário. A UI precisa deixar isso explícito.

- Cards: recebido no mês · a receber (pedidos pagos não concluídos) ·
  em aberto (aguardando pagamento) · cancelado/perdido.
- Tabela de lançamentos: data, pedido, comprador, bruto, frete, taxa (0),
  líquido, status.
- Filtros por período (mês, trimestre, personalizado).
- **Exportar CSV** (mesmo padrão do export DUPR já existente).
- Gráfico de receita por mês e por categoria.
- Aviso: "Estes valores são o registro dos pedidos no PickleRush. A
  conferência bancária e as obrigações fiscais são do vendedor."

## 8. Configurações (`/mercado/vender/configuracoes`)

Seções colapsáveis (`V2CollapsibleCard`, `sectionId` estável):
- **Perfil da loja**: nome, slug, capa, bio, links.
- **Recebimento**: chave Pix, QR, instruções.
- **Entrega**: formas, locais de retirada, zonas de frete, prazo de envio.
- **Políticas**: devolução (dias + texto), garantia, termos próprios.
- **Ofertas**: aceitar por padrão? mínimo padrão? auto-recusa?
- **Modo férias**: liga/desliga, data de retorno, mensagem.
- **Notificações**: o que quero receber (in-app, push, e-mail).
- **Equipe** (arena/clube/loja): quem mais pode operar as vendas — lista de
  `manager_uids`, com busca de usuário. Só o `owner_uid` mexe.
- **Encerrar loja**: despublica tudo, mantém histórico (nunca apaga pedido).

## 9. Analytics (`/mercado/vender/analytics`)

- Funil: impressões → visitas → favoritos/conversas → ofertas → pedidos →
  concluídos, com taxa entre etapas.
- Por anúncio: série de 30 dias, origem do tráfego (vitrine, busca,
  categoria, perfil, feed, link externo).
- Termos de busca que levaram ao anúncio (a partir de `search_terms`
  casados — Fase 2, exige log de busca).
- Comparação com a média da categoria ("seu CTR está 30% abaixo").
- Sugestões acionáveis derivadas do `completeness`.

## 10. Estados especiais

| Estado | Efeito |
|---|---|
| `vacation_mode` | anúncios visíveis, sem botão de compra/oferta, aviso com data de retorno |
| `status: 'suspended'` | anúncios pausados automaticamente, painel em modo leitura, aviso com motivo e como recorrer |
| `status: 'banned'` | anúncios `removed`, painel bloqueado, pedidos em aberto entram em mediação do admin |
| strike ativo | limite de anúncios reduzido, sem promoção, aviso no painel |
| limite atingido | "Novo anúncio" desabilitado com explicação e o que fazer (encerrar antigos / subir de tier) |
