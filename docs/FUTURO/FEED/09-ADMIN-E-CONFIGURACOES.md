# 17.09 — Admin e configurações do Feed

## 1. Onde entra no painel admin

Seção nova **"Feed"** em `V2AdminConsole.jsx`, injetada por `buildSections`
só quando a flag `feed` está ligada (mesmo padrão do `dupr_match_export`):

```js
{ id: 'feedSection', label: 'Feed', icon: Newspaper, tabs: [
  { id: 'feed_overview',   label: 'Visão geral',   icon: LayoutDashboard },
  { id: 'feed_posts',      label: 'Publicações',   icon: FileText },
  { id: 'feed_moderation', label: 'Moderação',     icon: ShieldAlert },
  { id: 'feed_hashtags',   label: 'Hashtags',      icon: Hash },
  { id: 'feed_official',   label: 'Oficial',       icon: Megaphone },
  { id: 'feed_settings',   label: 'Configurações', icon: SlidersHorizontal },
] }
```

Componentes em `src/v2/components/admin/`: `AdminFeedOverviewTab`,
`AdminFeedPostsTab`, `AdminFeedModerationTab`, `AdminFeedHashtagsTab`,
`AdminFeedOfficialTab`, `AdminFeedSettingsTab`.

## 2. Aba a aba

### 2.1 Visão geral
- **Saúde**: DAU do feed, DAU/MAU, posts/dia, comentários/dia, reações/dia,
  % de posts com ≥1 interação, tempo médio na aba, taxa de retorno.
- **Composição**: posts por tipo, por tipo de autor, por cidade.
- **Alertas**: queda de engajamento, fila de moderação acima do limite,
  pico anormal de posts (possível spam), autores com muitas denúncias.
- Séries de 90 dias.

### 2.2 Publicações
Busca por texto, autor, hashtag, tipo, período, status.
Ver o post como ele aparece. Ações: limitar (tira do ranking), ocultar,
remover com motivo, restaurar, fixar, notificar o autor, abrir o autor.
Ações em massa (ex.: remover 12 posts de um spammer) com motivo obrigatório.

### 2.3 Moderação
**A mesma fila do Mercado** (docs/18), filtrada por
`target_type: 'feed_post' | 'feed_comment' | 'user'`.
- Ordenada por gravidade × nº de denunciantes distintos × idade.
- Contexto: post, autor, histórico do autor, denúncias anteriores, strikes.
- Ações: manter · limitar · ocultar · remover · avisar o autor · strike ·
  suspender publicação por N dias · banir · bloquear hashtag.
- Decisão sempre com motivo; tudo em `audit_logs` + `moderation_actions`.
- Atalhos de teclado (a fila precisa ser rápida ou não é usada).

### 2.4 Hashtags
Lista com contagem, tendência, primeiro uso.
Ações: bloquear (posts com ela não entram no ranking nem em Descobrir),
destacar, mesclar (apelido → canônica), ver posts.

### 2.5 Oficial
- Publicar **como a plataforma** (composer com a identidade `platform`).
- **Fixar** um post no topo do feed: escopo global, por cidade ou por
  clube, com janela de início/fim (`feed_pinned`).
- Agendar comunicados.
- Histórico de comunicados com alcance.

### 2.6 Configurações
Formulário sobre `platform_settings/feed` (schema em `04-DATA-MODEL §14`):
- Tipos de post permitidos **por tipo de autor** (matriz de checkboxes).
- Limites (posts/hora, posts/dia, comentários/min, mídia, vídeo, caracteres).
- Moderação: modo pré/pós, termos banidos, hashtags bloqueadas, limiar de
  auto-limitação por denúncias.
- Ranking: ligar/desligar (desligado = tudo cronológico), meia-vida,
  pesos de afinidade e engajamento, máximo por autor, boost oficial.
- Descoberta: janela de trending, mínimo de posts.
- Padrões de auto-compartilhamento (sempre `false` de fábrica).

## 3. Feature flags novas

Em `src/core/featureFlags.js`, grupo **"Feed"** em `featureFlagGroups.js`,
todas **default OFF**:

```js
/** Feed (rede social) — flag MESTRA. Sem ela: /feed não existe,
 *  /novidades segue como hoje, composer some, nenhuma leitura nova. */
FEED: 'feed',

/** Vídeo no feed. Desligada: só foto. Ver docs/FUTURO/FEED/08-MIDIA §2 —
 *  o custo de egress de vídeo é o maior risco financeiro da onda. */
FEED_VIDEO: 'feed_video',

/** Enquetes. */
FEED_POLLS: 'feed_polls',

/** Repost/compartilhar publicação. */
FEED_RESHARE: 'feed_reshare',

/** Publicar como entidade (arena, clube, professor, torneio, loja,
 *  plataforma). Desligada: todo post é do atleta. */
FEED_IDENTITIES: 'feed_identities',

/** Ranking personalizado "Para você". Desligada: tudo cronológico
 *  (a aba existe, mas ordena por data). */
FEED_RANKING: 'feed_ranking',

/** Posts automáticos opt-in (resultado, conquista, subida de rating). */
FEED_AUTO_SHARE: 'feed_auto_share',

/** Ponte com o Mercado: compartilhar anúncio como post. Exige
 *  `marketplace` também ligada. */
FEED_MARKET_BRIDGE: 'feed_market_bridge',
```

**8 flags novas.** Toda sub-flag só tem efeito com `FEED` ligada — testado.

## 4. Cloud Functions do Feed

| Função | Gatilho | O que faz |
|---|---|---|
| `publishScheduledPosts` | schedule 5 min | `scheduled` vencido → `published` |
| `updatePostEngagement` | onWrite `feed_reactions`, `comments` | recalcula `engagement_score`, `last_activity_ms`, contadores (reconciliação) |
| `updateHashtagStats` | onCreate `feed_posts` | `post_count`, `post_count_7d`, `trending_score` |
| `updateAuthorStats` | onWrite `feed_posts` | `feed_author_stats` |
| `autoModeratePost` | onCreate `feed_posts` | termos banidos, hashtag bloqueada, link suspeito → `moderation_status` |
| `autoLimitReportedContent` | onWrite `content_reports` | N denunciantes distintos em janela → `status: 'limited'` |
| `notifyFeedInteractions` | onCreate reação/comentário/menção | notificações (agrupadas: "Fernando e mais 4 reagiram") |
| `notifyNewPostFromFollowed` | onCreate `feed_posts` | só para seguidores com `notify: true`, com teto diário |
| `refreshAuthorSnapshots` | onWrite `users`,`arenas`,`clubs` | atualiza `author_name`/`author_avatar_url` nos posts |
| `cleanupPostMedia` | onDelete `feed_posts` | apaga arquivos do Storage |
| `recomputeTrendingDaily` | schedule diário | `trending_score` das hashtags |

**11 funções novas.**

## 5. Notificações novas

```
feed_reaction, feed_comment, feed_comment_reply, feed_mention,
feed_new_post_followed, feed_post_limited, feed_post_removed,
feed_reshare, feed_poll_ended, feed_milestone
```

**Agrupamento é obrigatório** — 40 notificações de reação em um post viram
uma: "Fernando e mais 12 reagiram à sua publicação". Sem agrupar, o
usuário desliga tudo e a plataforma perde o canal. Implementado com um
doc de agregação por (post, tipo) com janela de 30 min.

Preferências novas em `notifications/domain/preferences.js`, grupo "Feed":
reações · comentários · respostas · menções · novos posts de quem sigo ·
marcos. Default: menções e comentários ligados; reações agrupadas; novos
posts **desligado** (senão vira spam no dia 1).

## 6. Auditoria

```
feed_post_created, feed_post_edited, feed_post_removed, feed_post_limited,
feed_post_restored, feed_post_pinned, feed_comment_removed,
feed_hashtag_blocked, feed_settings_changed, feed_official_published,
feed_user_suspended
```
Toda ação de admin sobre conteúdo alheio grava **motivo obrigatório**.
