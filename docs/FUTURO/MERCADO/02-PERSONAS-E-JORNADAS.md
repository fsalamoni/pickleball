# 16.02 — Personas e jornadas do Mercado

## 1. Personas

| # | Persona | Quem é | O que quer | Dor hoje |
|---|---|---|---|---|
| P1 | **Atleta vendedor casual** | joga há 2 anos, trocou de raquete, quer vender a antiga | vender rápido, sem burocracia, sem taxa | posta no grupo e some no scroll |
| P2 | **Atleta comprador** | iniciante/intermediário, orçamento apertado | achar equipamento bom e barato, confiar no vendedor | não sabe se o preço é justo nem se o cara é sério |
| P3 | **Dono de arena** | já usa PDV, membros, reservas | vender pra além do balcão, girar estoque parado, atrair gente à arena | vitrine limitada ao balcão |
| P4 | **Professor** | tem alunos, dá clínicas | vender pacote de aula, clínica, equipamento indicado | vende por DM, sem página |
| P5 | **Lojista / marca** | loja de artigos esportivos, importador, marca nacional | alcançar público 100% qualificado de pickleball | mídia paga cara e genérica |
| P6 | **Clube** | organiza dia de jogo, tem 80 membros | vender uniforme, kit de camiseta, rifa de evento | planilha e Pix na mão |
| P7 | **Admin de plataforma** | `fsalamoni@gmail.com` | ver o marketplace saudável, moderar, configurar, medir | — |

### Contexto de confiança de cada vendedor (o diferencial)

O card do vendedor exibe, conforme o tipo:

- **Atleta**: foto, nome, cidade, nível unificado (2.0–8.0), clube, nº de
  partidas na plataforma, tempo de conta, nº de vendas, nota média.
- **Arena**: logo, cidade, nº de quadras, avaliação da arena
  (`arena_reviews` — reaproveitado), nº de vendas, nota do Mercado.
- **Professor**: foto, nível, arenas onde dá aula, nº de alunos, avaliação
  de aulas + nota do Mercado.
- **Clube**: logo, cidade, nº de membros, nota do Mercado.
- **Loja**: logo, CNPJ verificado (badge), site, nota do Mercado.

## 2. Jornadas ponta a ponta

### J1 — Atleta anuncia uma raquete usada (P1)

```
/mercado → "Vender" → onboarding de vendedor (1ª vez)
  ├─ aceita os Termos do Mercado (registra em legal_consents)
  ├─ confirma nome, cidade, telefone (não fica público)
  ├─ informa chave Pix (fica privada; só vira QR no pedido)
  └─ escolhe formas de entrega padrão (retirada / envio / combinar)
→ "Novo anúncio"
  ├─ passo 1 Tipo: produto usado
  ├─ passo 2 O que é: typeahead no catalog_products → "Selkirk Vanguard"
  │     (preenche categoria, marca e atributos automaticamente)
  ├─ passo 3 Detalhes: condição (seminovo), peso, cor, descrição
  ├─ passo 4 Fotos: 1-10, arrasta pra ordenar, 1ª é a capa
  ├─ passo 5 Preço: R$ 690, [x] aceito ofertas, mínimo aceitável R$ 600
  │     (o mínimo é PRIVADO — só serve pro auto-recusar)
  ├─ passo 6 Entrega: retirada na Arena X + envio (R$ 25 fixo)
  └─ publicar (ou salvar rascunho / agendar)
→ moderação (auto ou fila, conforme config do admin)
→ anúncio no ar, aparece em /mercado e no perfil público do vendedor
```

**Tempo alvo**: < 3 min com typeahead, < 5 min sem.
**Estados de erro**: perfil incompleto (bloqueia com CTA pra `/perfil/editar`),
sem foto (bloqueia), preço fora de faixa sanitária (avisa, não bloqueia),
limite de anúncios ativos atingido (bloqueia, explica o limite e o tier).

### J2 — Comprador acha e compra (P2)

```
/mercado
  → busca "raquete" + filtro categoria=Raquetes, condição=seminovo,
    preço até 800, cidade=São Paulo, raio 30km
  → ordena por "mais perto"
  → abre o anúncio
     ├─ galeria, atributos, entrega, política de devolução do vendedor
     ├─ card do vendedor: 4.2 de nível, Arena X, 87 partidas, 12 vendas ★4.9
     ├─ [Favoritar] [Compartilhar] [Denunciar]
     └─ [Fazer oferta] [Conversar] [Comprar]
  → "Fazer oferta": R$ 620 + mensagem
     ├─ abaixo do mínimo privado (600)? não → vai pro vendedor
     └─ vendedor contrapropõe R$ 650 → comprador aceita
  → checkout do pedido (preço travado em 650)
     ├─ escolhe entrega: retirada na Arena X
     ├─ vê o resumo e a política
     └─ confirma → pedido em "aguardando aceite"
  → vendedor aceita → pedido "aguardando pagamento"
     ├─ AGORA aparece o QR Pix / chave do vendedor
     └─ comprador paga e anexa comprovante
  → vendedor confere e marca "pago" → "pronto pra retirada"
  → encontro na arena, comprador confirma recebimento
  → pedido "concluído" → os dois avaliam
```

### J3 — Arena publica o estoque do PDV no Mercado (P3)

```
/arenas/:id/gerir/pdv → aba "Mercado" (nova, gated)
  → lista os produtos do estoque com um toggle "publicar no Mercado"
  → ao ligar: cria market_listings com source={kind:'arena_product',id}
     ├─ preço e estoque ficam ESPELHADOS (o PDV continua sendo a fonte)
     ├─ vender no PDV baixa o estoque → o anúncio reflete
     └─ vender no Mercado gera arena_sales (canal='marketplace')
  → em massa: "publicar 12 selecionados"
```

**Regra dura**: a fonte da verdade do estoque continua sendo
`arena_inventory_*`. O Mercado **lê e referencia**, nunca duplica.

### J4 — Professor vende pacote de aula (P4)
```
/mercado/vender → novo anúncio → tipo "serviço"
  → vincula ao coach_packages existente (se houver) ou cria avulso
  → define: nº de aulas, validade, arena, o que inclui
  → pedido concluído gera crédito no roster do aluno (integração)
```

### J5 — Lojista publica catálogo (P5)
```
admin aprova o cadastro de loja (market_sellers com type='store')
  → loja ganha /mercado/loja/:slug
  → publica anúncios (produto novo, estoque, variações tamanho/cor)
  → Fase 5: importa CSV
```

### J6 — Procura-se (demanda invertida)
```
comprador não acha → "Publicar o que procuro"
  → market_listings com type='wanted' (categoria, faixa de preço, região)
  → vendedores com anúncio compatível recebem notificação
  → aba "Procurados" na vitrine
```

### J7 — Negociação que não vira venda
Oferta expira em 72h (config). Chat fica aberto. Anúncio volta ao normal.
Nada trava. O vendedor vê "3 ofertas expiradas" no painel — sinal de preço.

### J8 — Pedido que dá errado (disputa)
```
comprador não recebe / produto diferente do anunciado
  → "Abrir disputa" (até 7 dias após entrega prevista)
  → pedido vai pra 'disputed', congela avaliações
  → chat vira 3 vias (comprador, vendedor, moderação)
  → admin decide: 'resolved_refund' | 'resolved_release' | 'inconclusive'
  → registra strike no vendedor se procedente
```
Sem gateway na Fase 1, a plataforma **media, não estorna** — isso precisa
estar explícito nos Termos (`13-RISCOS-LEGAL-E-CUSTO.md`).

### J9 — Vendedor de férias
Toggle "modo férias": anúncios ficam visíveis mas sem botão de compra,
com aviso "Vendedor retorna em DD/MM". Nada é despublicado.

### J10 — Admin modera um anúncio denunciado
```
/admin/painel?tab=market_moderation
  → fila ordenada por gravidade × nº de denúncias
  → preview do anúncio + histórico do vendedor + denúncias
  → ações: aprovar / pedir ajuste (notifica) / ocultar / remover +
    strike / suspender vendedor / banir
  → tudo em audit_logs
```

### J11 — Comprador reincidente
"Comprar de novo" na página do vendedor; buscas salvas com alerta;
"lista de desejos" com aviso de queda de preço.

### J12 — Desligar a flag
Admin desliga `marketplace`: rotas somem, menu some, nenhum hook dispara,
dados ficam intactos. Religar restaura tudo. **Isso é um requisito testável.**

## 3. Estados vazios (empty states) — todos precisam existir

| Tela | Estado vazio | CTA |
|---|---|---|
| Vitrine | sem anúncios na região | "Ver de todo o Brasil" + "Seja o primeiro a anunciar" |
| Busca | 0 resultados | "Salvar esta busca e ser avisado" + "Publicar procura-se" |
| Meus anúncios | nenhum | "Criar o primeiro anúncio" |
| Ofertas | nenhuma | explica como funciona oferta |
| Pedidos (vendedor) | nenhum | dicas de o que melhora conversão |
| Minhas compras | nenhuma | "Explorar o Mercado" |
| Favoritos | nenhum | — |
| Avaliações | nenhuma | — |

## 4. Acessibilidade e mobile

- Mobile-first: a vitrine é grade de 2 colunas no celular, 3-4 no desktop.
- Filtros no celular: bottom sheet, nunca sidebar espremida.
- Galeria: swipe + zoom, com `alt` obrigatório derivado do título.
- Todo diálogo com `max-h-[90dvh] overflow-y-auto` (gotcha conhecido do
  CLAUDE.md §11 — paisagem no tablet corta o rodapé).
- Contraste mínimo AA nos badges de status do pedido.
