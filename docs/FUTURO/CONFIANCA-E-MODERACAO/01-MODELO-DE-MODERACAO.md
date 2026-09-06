# 18.01 — Modelo de moderação

## 1. Filosofia

Três princípios, nesta ordem:

1. **A comunidade se protege primeiro.** Bloquear, silenciar e "não tenho
   interesse" resolvem 80% dos casos sem envolver ninguém. Essas
   ferramentas precisam ser óbvias e instantâneas.
2. **A automação filtra o óbvio.** Termo banido, link de golpe conhecido,
   spam repetido, preço absurdo: decidido por regra, não por gente.
3. **O humano decide o difícil.** A fila só recebe o que sobrou, já
   priorizado e com contexto.

Um quarto princípio, transversal: **toda decisão é registrada e reversível**
(exceto remoção por ordem judicial). Moderação sem registro vira arbítrio.

## 2. Quatro camadas

```
┌─ Camada 0 — PREVENÇÃO ────────────────────────────────────┐
│ rate limits · perfil obrigatório · aceite das diretrizes  │
│ limites de anúncio/post · exigência de foto real          │
└───────────────────────────────────────────────────────────┘
┌─ Camada 1 — AUTOMÁTICA (Cloud Function, no create) ───────┐
│ termos banidos · hashtag bloqueada · link suspeito        │
│ duplicidade · sanidade de preço · autor com strike ativo  │
│  → auto_approved | pending | flagged | rejected           │
└───────────────────────────────────────────────────────────┘
┌─ Camada 2 — COMUNIDADE ───────────────────────────────────┐
│ denúncia · bloquear · silenciar · não tenho interesse     │
│ N denunciantes distintos em X horas → 'limited' automático│
└───────────────────────────────────────────────────────────┘
┌─ Camada 3 — HUMANA (fila do admin) ───────────────────────┐
│ decisão com motivo · sanção proporcional · registro       │
└───────────────────────────────────────────────────────────┘
```

## 3. Pré vs. pós-moderação

| Modo | Quando usar | Custo |
|---|---|---|
| **Pós** (padrão) | comunidade pequena e conhecida, volume baixo | rápido para o usuário, exige fila ativa |
| **Pré** | vendedor novo, autor com strike, categoria sensível | seguro, mas trava o usuário e não escala |

**Configuração recomendada na Fase 1**: pós-moderação para todos, **exceto**:
- primeiro anúncio de um vendedor novo → pré;
- autor com strike ativo → pré;
- categorias sensíveis (suplementos, ingressos) → pré;
- posts com link externo de domínio desconhecido → pré.

Isso dá o melhor dos dois: a maioria publica na hora, e o risco fica na fila.

## 4. Auto-limitação (`limited`)

Estado intermediário que **não é remoção**:
- o conteúdo sai do ranking e do "Descobrir"/vitrine;
- continua acessível pelo permalink e para quem já tem o link;
- o autor é avisado, com o motivo e o prazo de revisão;
- é revertido automaticamente se o admin aprovar, ou vira remoção.

Gatilho: `auto_limit_report_threshold` (default 3) **denunciantes
distintos** dentro de `auto_limit_window_hours` (default 24).

Por que "distintos" importa: 3 denúncias da mesma pessoa (ou de 3 contas do
mesmo grupo coordenado) não podem derrubar conteúdo legítimo. Contar
denunciantes únicos, e ponderar por reputação do denunciante (quem denuncia
muito e erra sempre pesa menos) — `reporterWeight()` no domínio.

## 5. Escala de sanções (proporcionalidade)

```
1. Aviso                       (notificação, sem efeito prático)
2. Conteúdo limitado           (fora do ranking)
3. Conteúdo removido           (+ 1 strike)
4. Suspensão de publicação     (7 / 30 dias)
5. Suspensão de venda          (anúncios pausados)
6. Conta restrita              (só leitura)
7. Banimento                   (terminal, decisão do admin da plataforma)
```

Nunca pular etapas, **exceto** em: conteúdo envolvendo menor, ameaça
concreta, nudez não consentida, e golpe comprovado — esses vão direto para
6 ou 7.

## 6. Strikes

- Strike expira em **180 dias**.
- 3 strikes ativos → suspensão de 30 dias.
- 5 strikes ativos → banimento.
- Strike sempre com motivo, conteúdo vinculado e **direito de recurso**.
- Recurso: o usuário responde na notificação; vira um item de fila com
  prioridade e é decidido por um admin diferente quando possível.

## 7. SLA

Definido em `docs/FUTURO/FEED/13-RISCOS §5`. Regra: **prometer só o que se
cumpre**. Enquanto a moderação for uma pessoa, apertar os limites de
publicação em vez de prometer prazo curto.

## 8. O que a moderação NÃO faz

- ❌ Não modera opinião esportiva ("essa raquete é ruim").
- ❌ Não arbitra disputa comercial (isso é `market_disputes`).
- ❌ Não remove crítica a arena/professor por ser negativa — só se violar
  as diretrizes. Reputação sem crítica é propaganda, e a comunidade percebe.
- ❌ Não age sem registro.
