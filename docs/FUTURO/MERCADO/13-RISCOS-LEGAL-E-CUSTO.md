# 16.13 — Riscos, aspectos legais e custo do Mercado

> Não sou advogado e isto não é parecer jurídico. É um levantamento do que
> **precisa ser revisado por um advogado antes do lançamento público**, com
> a posição técnica que o produto assume enquanto isso.

## 1. Enquadramento: o que a plataforma é (e não é)

**Posição da Fase 1**: o PickleRush é um **provedor de aplicação que
hospeda anúncios de terceiros** (classificados com registro de pedido).
Não é vendedor, não é intermediário de pagamento, não custodia dinheiro,
não emite nota.

Isso precisa estar:
- nos **Termos do Mercado** (`legal/`, doc `market_terms`);
- **visível no checkout** ("O pagamento é feito diretamente ao vendedor");
- na página do anúncio (rodapé discreto);
- no e-mail/notificação de pedido.

Se em algum momento a plataforma passar a **receber o dinheiro** (Fase 3),
o enquadramento muda por completo — vira intermediação de pagamento, com
obrigações de PLD/KYC, e a responsabilidade solidária pelo CDC fica muito
mais forte. **Não faça isso sem parecer jurídico.**

## 2. CDC (Lei 8.078/90)

- Quando o vendedor é **fornecedor** (arena, loja, professor, clube ou
  atleta que vende habitualmente), a relação é de consumo: direito de
  arrependimento de **7 dias** em compra a distância (art. 49), garantia
  legal, informação clara.
- A plataforma que **aproxima** consumidor e fornecedor pode ser
  responsabilizada solidariamente em algumas hipóteses (jurisprudência
  varia muito conforme o grau de participação — cobrar comissão e
  intermediar pagamento aumenta o risco; ser mural de anúncio diminui).
- **Consequências práticas no produto**:
  - política de devolução de 7 dias é o **default** para vendedores
    pessoa jurídica e não pode ser reduzida abaixo disso na configuração;
  - o vendedor precisa declarar se é PF ocasional ou PJ/habitual;
  - a plataforma disponibiliza canal de reclamação (disputa) e responde;
  - dados do vendedor precisam ser identificáveis para o comprador em caso
    de litígio (nome completo e um identificador, revelados no pedido).

## 3. Marco Civil da Internet (Lei 12.965/14)

- Art. 19: a plataforma só responde por conteúdo de terceiro após **ordem
  judicial** específica de remoção — **exceto** o art. 21 (conteúdo íntimo).
- Isso protege o modelo, **desde que** haja: canal de denúncia funcional,
  processo de moderação registrado, e guarda de logs.
- **Guarda de registros de acesso: 6 meses** (art. 15). Hoje o projeto não
  guarda IP. Para o Mercado, recomenda-se registrar em `audit_logs` ao
  menos: uid, ação, timestamp e user-agent nas ações comerciais. IP exige
  Cloud Function (o cliente não vê o IP real).

## 4. Itens proibidos e restritos (configurável, mas com base fixa)

**Proibidos** (bloqueio automático por termos + moderação):
- armas, munição, réplicas realistas;
- medicamentos, anabolizantes, substâncias controladas;
- suplementos sem registro ANVISA (restrito, exige declaração);
- produtos falsificados / réplicas de marca (**risco alto** — raquete
  falsificada é comum em marketplace esportivo);
- ingressos com revenda proibida pelo organizador (a "cambagem" é vedada
  em vários estados; a categoria `ingresso-de-evento` fica **desligada por
  padrão**);
- animais, partes de animais;
- documentos, contas, dados pessoais;
- serviços ilegais, apostas;
- qualquer coisa que viole os Termos gerais da plataforma.

**Restritos** (permitidos com declaração):
- suplementos com registro;
- produtos usados com defeito (exige declaração explícita no anúncio);
- serviços que envolvam menores (aula infantil) — exige que o professor
  tenha perfil verificado.

Lista editável em `platform_settings/marketplace.prohibited_categories` +
`auto_moderation.banned_terms`.

## 5. LGPD (Lei 13.709/18)

| Dado | Base legal | Cuidado no produto |
|---|---|---|
| Nome, foto, cidade do vendedor | execução de contrato / legítimo interesse | público — já é hoje no perfil |
| Telefone e e-mail | execução de contrato | **nunca públicos**; ficam na subcoleção privada |
| Endereço do comprador | execução de contrato | só ao vendedor, só após aceite, nunca em listagem |
| Chave Pix | execução de contrato | só ao comprador do pedido aceito |
| Comprovante de pagamento | execução de contrato | ⚠ hoje fica em `uploads/{uid}` legível por qualquer autenticado com a URL. **Documentar e endurecer na Fase 2.** Orientar a cobrir dados no comprovante |
| Histórico de compras | execução de contrato | do titular e do outro lado da transação |
| Buscas salvas / favoritos | consentimento | opt-in explícito para alerta |

Direitos do titular: o Mercado precisa entrar no fluxo de **exclusão de
conta** já existente — anúncios são despublicados e anonimizados; pedidos
concluídos **são retidos** (obrigação legal/defesa em litígio) com o nome
substituído por "Usuário removido". Isso precisa estar na política de
privacidade.

Menores de 18: venda por menor exige representação. Posição da Fase 1:
**idade mínima de 18 anos para vender**, declarada no onboarding e
checada contra a data de nascimento do perfil quando existir.

## 6. Riscos de produto

| # | Risco | Impacto | Mitigação |
|---|---|---|---|
| R1 | Marketplace vazio (cold start) | mata o produto | semear com 3 arenas + 30 anúncios antes de abrir; convidar 20 vendedores |
| R2 | Golpe no Pix (pagou e não recebeu) | destrói confiança na plataforma inteira | avisos na UI, chave só após aceite, reputação, strike, disputa, banimento; comunicação clara de que o pagamento é direto |
| R3 | Produto falsificado | risco legal + reputacional | termos, denúncia, moderação, banimento, exigir foto real (não de catálogo) em usados |
| R4 | Custo de imagem estourar | conta cara | compressão + thumbnail + paginação (obrigatórios no U3); alerta de budget no Firebase |
| R5 | Fila de moderação crescer sem gente para tocar | conteúdo ruim no ar | moderação automática primeiro, fila com priorização, e um limite de anúncios/dia que segura o volume |
| R6 | Vendedor sumir com pedido em aberto | comprador irritado | SLA + expiração automática + `cancel_rate` na reputação |
| R7 | Avaliação como arma (retaliação) | injustiça | cegueira mútua, denúncia de avaliação, resposta pública |
| R8 | Canibalizar o PDV da arena | atrito com parceiro | espelho, não substituição; a arena controla o que publica |
| R9 | Escopo inflar até virar Mercado Livre | nunca lançar | não-objetivos são contrato (`01-VISAO §4`) |
| R10 | Busca degradar com volume | experiência ruim | contrato de `rankListings` isolado; migração é trocar a origem dos candidatos |

## 7. Custo

Ver `04-DATA-MODEL` (estimativa detalhada). Resumo com 3.000 MAU:

| | Mensal |
|---|---|
| Firestore (leitura + escrita) | ~US$ 3 |
| Storage (40 GB) | ~US$ 1 |
| **Egress de imagem** | **~US$ 36** |
| Cloud Functions (11 novas, majoritariamente agendadas) | ~US$ 2 |
| **Total** | **~US$ 42/mês** |

Com as mitigações de imagem (thumbnail 400px nos cards, WebP, cache
imutável, paginação), o egress cai para ~US$ 10-12. **Fazer as mitigações
não é opcional** — sem elas o custo cresce linear com o tráfego, que é
justamente o que se quer que cresça.

Alertas de budget no Firebase: avisar em US$ 50, US$ 100 e US$ 200/mês.

## 8. O que precisa de decisão humana antes de codar

1. **Comissão**: cobra ou não na Fase 1? (recomendação: **não** — 0%)
2. **Ingressos de evento**: categoria ligada ou desligada? (recomendação:
   **desligada**)
3. **Idade mínima para vender**: 18 confirmado?
4. **Vitrine sem login** (SEO): expõe anúncio de usuário à internet aberta?
   (recomendação: **Fase 2**, com opt-out por anúncio)
5. **Termos do Mercado**: quem redige e revisa?
6. **Quem opera a fila de moderação** no dia a dia?
7. **Loja (`store`)**: cadastro aberto com aprovação, ou só por convite?
   (recomendação: **só por convite** na Fase 1)
