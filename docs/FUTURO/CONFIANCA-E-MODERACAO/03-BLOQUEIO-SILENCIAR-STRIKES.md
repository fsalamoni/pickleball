# 18.03 — Bloqueio, silenciar e strikes

## 1. Bloquear (`user_blocks`)

**Bloquear é a ferramenta mais importante da moderação**, porque resolve o
caso na hora, sem fila, sem espera, sem julgamento de ninguém.

### Efeito (simétrico e completo)
Ao A bloquear B:

| Onde | Efeito |
|---|---|
| Feed | A não vê posts/comentários de B; B não vê os de A |
| Comentários | B não comenta em post de A e vice-versa |
| Menções | nenhum dos dois menciona o outro |
| Chat | conversa existente fica somente-leitura; nova conversa bloqueada |
| Mercado | B não faz oferta nem pedido em anúncio de A, e vice-versa |
| Perfil | perfil mutuamente inacessível |
| Notificações | nenhuma entre os dois |
| Seguir | follows existentes são removidos nos dois sentidos |

### O que o bloqueado vê
**Nada de especial.** Sem aviso, sem tela de "você foi bloqueado" — isso
só gera retaliação por outros meios. O conteúdo simplesmente não aparece.

### Onde é aplicado (honestidade técnica)
- **Cliente**: filtro no ranking do feed, na lista de comentários e na
  vitrine do Mercado. É a aplicação principal na Fase 1.
- **Regras**: consegue barrar escrita direcionada (comentar em post de
  quem me bloqueou) com um `exists()`, ao custo de uma leitura por escrita.
  Aplicar nas escritas que importam: comentário, oferta, pedido, mensagem.
- **Servidor**: no fan-out da Fase 2.

⚠ Um bloqueado determinado consegue **ver** conteúdo público deslogado ou
por outra conta. Isso vale para qualquer rede social. Não prometer o que
não se entrega: a UI diz "não verá mais o conteúdo dele por aqui", não
"ele nunca mais verá você".

### Limites
Máximo 1000 bloqueios por usuário. Desbloquear a qualquer momento (mas
follows não voltam sozinhos).

## 2. Silenciar (`user_mutes`)

Mais leve que bloquear: **eu** deixo de ver, mas nada mais muda. A pessoa
não sabe, continua interagindo comigo, e eu volto quando quiser.

Alvos: autor (`author_key`), hashtag, palavra-chave (Fase 2).
Guardado em `feed_preferences.muted_authors` / `muted_hashtags` (1 doc,
leitura barata) — `user_mutes` só existe se a lista passar de 200 itens.

Duração: permanente ou temporária (7/30 dias) — útil para "silenciar o
torneio X até acabar".

## 3. "Não tenho interesse"

Sinal negativo leve, sem consequência social:
- aquele post some do feed do usuário;
- o autor perde peso na afinidade por **30 dias** (não para sempre);
- guardado em `feed_preferences.not_interested` (rolling de 500).

## 4. Strikes (`content_strikes`)

```js
{ user_id, reason_code, target_type, target_id,
  severity: 'low'|'medium'|'high',
  issued_by, issued_at, expires_at,        // +180 dias
  note, moderation_action_id,
  appealed: false, appeal_result: null, active: true }
```

### Regras
- Expira em 180 dias (`active` vira false por Function agendada).
- Peso por gravidade: baixa 1 · média 2 · alta 3.
- Soma de pesos ativos:
  - **≥ 3** → pré-moderação obrigatória em tudo que publicar;
  - **≥ 5** → suspensão de publicação por 30 dias;
  - **≥ 8** → banimento (decisão humana, nunca automática).
- Todo strike é **notificado** com: o que foi, por quê, quanto tempo dura,
  o que acontece se repetir, e **como recorrer**.
- Recurso aceito → strike removido e conteúdo restaurado.

### Onde o strike pesa
- Feed: pré-moderação, sem boost de descoberta, limites reduzidos.
- Mercado: pré-moderação de anúncio, sem promoção, limite de anúncios
  reduzido, badge de vendedor destaque removido.

## 5. Rate limits (`user_rate_counters`)

```js
// user_rate_counters/{uid}
{ user_id,
  windows: {
    'post_hour_2026090614':   { count: 3, expires_at },
    'post_day_20260906':      { count: 11, expires_at },
    'comment_min_202609061422':{ count: 2, expires_at },
    'listing_day_20260906':   { count: 4, expires_at },
    'report_day_20260906':    { count: 2, expires_at },
    'offer_day_20260906':     { count: 6, expires_at },
  },
  updated_at }
```

- Chave da janela derivada de `(ação, granularidade, timestamp)` — pura e
  testada em `domain/rateLimit.js`.
- Checado no **service** antes da escrita e refletido na **UI**
  (botão explica o limite e quando libera, nunca só falha).
- As regras do Firestore **não** fazem rate limit. Uma Cloud Function
  reconcilia e sanciona abuso detectado a posteriori.
- Limpeza das janelas vencidas por Function agendada.

Limites default: ver `docs/FUTURO/FEED/03 §7` (feed) e
`docs/FUTURO/MERCADO/03 §5` (mercado). Denúncias: 20/dia (impede uso da
denúncia como assédio).

## 6. Reputação do denunciante

```js
reporterWeight(user, history) → -10 .. +10
```
- +: denúncias procedentes, conta antiga, perfil completo, sem strikes.
- −: muitas denúncias improcedentes, conta nova, muitas denúncias no mesmo
  dia, denúncias sempre contra a mesma pessoa.

Entra no `priorityScore` da fila e no gatilho de auto-limitação. Um
denunciante com peso muito negativo **não** dispara auto-limitação sozinho.

## 7. Detecção de coordenação

Sinal de brigada (denúncia coordenada) a destacar na fila:
- ≥ 3 denúncias do mesmo conteúdo em < 10 min;
- denunciantes que se seguem mutuamente;
- denunciantes com contas criadas na mesma semana;
- mesmo padrão de texto na descrição.

Não bloqueia nada automaticamente — só **avisa o moderador**, que decide
com o contexto na tela.
