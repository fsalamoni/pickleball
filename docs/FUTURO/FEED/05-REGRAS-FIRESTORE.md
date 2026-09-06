# 17.05 — Regras de segurança do Feed

> Aditivo: helpers novos + blocos `match` novos. Nenhuma regra existente é
> alterada. `follows`, `club_posts` e `club_forum_threads` ficam intactos.

## 1. Helpers novos

```javascript
// ---- Feed --------------------------------------------------------------
function feedPostData(postId) {
  return get(/databases/$(database)/documents/feed_posts/$(postId)).data;
}
function feedPostExists(postId) {
  return exists(/databases/$(database)/documents/feed_posts/$(postId));
}
// Autor efetivo do post: quem apertou publicar OU quem comanda a entidade.
// A checagem da entidade usa as coleções canônicas — perder o cargo tira
// o direito automaticamente.
function canActAsAuthor(authorType, authorId) {
  return isAuthed() && (
    (authorType == 'athlete'    && authorId == request.auth.uid)
    || (authorType == 'coach'   && authorId == request.auth.uid)
    || (authorType == 'arena'   && isArenaManager(authorId))
    || (authorType == 'club'    && isClubAdmin(authorId))
    || (authorType == 'tournament' && (isTournamentCreator(authorId)
                                       || isTournamentAdmin(authorId)))
    || (authorType == 'store'   && isMarketSeller('store_' + authorId))
    || (authorType == 'platform' && isPlatformAdmin())
  );
}
function isPostAuthor(postId) {
  return isAuthed() && feedPostExists(postId) && (
    feedPostData(postId).actor_uid == request.auth.uid
    || canActAsAuthor(feedPostData(postId).author_type,
                      feedPostData(postId).author_id)
  );
}
function follows(targetKey) {
  return isAuthed() && exists(/databases/$(database)/documents/
    feed_follows/$(request.auth.uid + '_' + targetKey));
}
// Post legível pelo público autenticado.
function feedPostReadable() {
  return resource.data.status in ['published','limited']
    && (
      resource.data.visibility == 'public'
      || (resource.data.visibility == 'followers'
          && (follows(resource.data.author_key)
              || resource.data.actor_uid == request.auth.uid))
      || (resource.data.visibility == 'club'
          && isClubMember(resource.data.club_id))
    );
}
// Bloqueio mútuo (docs/18): quem bloqueou não é lido pelo bloqueado e
// vice-versa. As REGRAS não conseguem checar isso barato numa listagem —
// o bloqueio é aplicado no CLIENTE (filtro do ranking) e no servidor
// (Cloud Function que remove o bloqueado do fan-out, Fase 2). Isto é uma
// limitação conhecida e precisa estar documentada, não escondida.
```

## 2. Blocos `match`

### `feed_posts`
```javascript
match /feed_posts/{postId} {
  allow read: if isAuthed() && (
    feedPostReadable()
    || isPostAuthor(postId)
    || isPlatformAdmin());

  allow create: if isAuthed()
    && request.resource.data.actor_uid == request.auth.uid
    && canActAsAuthor(request.resource.data.author_type,
                      request.resource.data.author_id)
    && request.resource.data.author_key ==
         request.resource.data.author_type + '_' + request.resource.data.author_id
    && request.resource.data.status in ['draft','scheduled','published']
    && request.resource.data.visibility in ['public','followers','club','private']
    && request.resource.data.text.size() <= 2000
    && request.resource.data.media.size() <= 10
    && request.resource.data.hashtags.size() <= 8
    && request.resource.data.mentions.size() <= 10
    // campos exclusivos do sistema/moderação
    && !request.resource.data.keys().hasAny([
         'engagement_score','report_count','limited_at','limited_by',
         'removed_at','removed_by','removed_reason','author_verified'])
    // contadores nascem zerados
    && request.resource.data.reaction_total == 0
    && request.resource.data.comment_count == 0
    // post de clube exige ser membro
    && (request.resource.data.visibility != 'club'
        || isClubMember(request.resource.data.club_id));

  allow update: if
    // autor edita o próprio post
    (isPostAuthor(postId)
      && request.resource.data.author_key == resource.data.author_key
      && request.resource.data.actor_uid == resource.data.actor_uid
      && request.resource.data.status in
           ['draft','scheduled','published','hidden','archived']
      && !request.resource.data.diff(resource.data).affectedKeys()
            .hasAny(['engagement_score','report_count','limited_at',
                     'removed_at','removed_by','removed_reason',
                     'author_verified','created_at',
                     'reaction_counts','reaction_total','comment_count',
                     'reshare_count','save_count']))
    // qualquer leitor mexe SÓ nos contadores agregados
    || (isAuthed() && feedPostReadable()
        && request.resource.data.diff(resource.data).affectedKeys()
             .hasOnly(['reaction_counts','reaction_total','comment_count',
                       'reshare_count','save_count','last_activity_ms',
                       'report_count','updated_at']))
    || isPlatformAdmin();

  allow delete: if isPostAuthor(postId) || isPlatformAdmin();
  // Nota: excluir de verdade apaga comentários órfãos na subcoleção.
  // O caminho recomendado no produto é status 'archived'/'removed'; a
  // exclusão real dispara uma Function de limpeza.

  // ---- comentários -----------------------------------------------------
  match /comments/{commentId} {
    allow read: if isAuthed() && (
      resource.data.status == 'published'
      || resource.data.actor_uid == request.auth.uid
      || isPostAuthor(postId)
      || isPlatformAdmin());

    allow create: if isAuthed()
      && request.resource.data.actor_uid == request.auth.uid
      && canActAsAuthor(request.resource.data.author_type,
                        request.resource.data.author_id)
      && request.resource.data.text.size() <= 1000
      && request.resource.data.status == 'published'
      && feedPostData(postId).comments_enabled == true
      && (feedPostData(postId).comments_restricted != true
          || follows(feedPostData(postId).author_key)
          || isPostAuthor(postId));

    allow update: if
      // autor do comentário edita o texto
      (isAuthed() && resource.data.actor_uid == request.auth.uid
        && request.resource.data.diff(resource.data).affectedKeys()
             .hasOnly(['text','media','edited_at','updated_at']))
      // autor do POST oculta/fixa
      || (isPostAuthor(postId)
        && request.resource.data.diff(resource.data).affectedKeys()
             .hasOnly(['status','pinned','updated_at']))
      // contadores
      || (isAuthed()
        && request.resource.data.diff(resource.data).affectedKeys()
             .hasOnly(['reaction_count','reply_count','report_count','updated_at']))
      || isPlatformAdmin();

    allow delete: if (isAuthed() && resource.data.actor_uid == request.auth.uid)
      || isPostAuthor(postId) || isPlatformAdmin();

    match /reactions/{uid} {
      allow read: if isAuthed();
      allow create, update, delete: if isAuthed() && uid == request.auth.uid;
    }
  }
}
```

### Reações, votos, salvos
```javascript
match /feed_reactions/{reactionId} {
  allow read: if isAuthed();
  allow create: if isAuthed()
    && reactionId == request.resource.data.post_id + '_' + request.auth.uid
    && request.resource.data.user_id == request.auth.uid
    && request.resource.data.type in ['like','fire','clap','ball','idea'];
  allow update, delete: if isAuthed() && resource.data.user_id == request.auth.uid;
}

match /feed_poll_votes/{voteId} {
  allow read: if isAuthed();
  allow create, update: if isAuthed()
    && voteId == request.resource.data.post_id + '_' + request.auth.uid
    && request.resource.data.user_id == request.auth.uid;
  allow delete: if isAuthed() && resource.data.user_id == request.auth.uid;
}

match /feed_saves/{saveId} {
  allow read, update, delete: if isAuthed()
    && resource.data.user_id == request.auth.uid;
  allow create: if isAuthed()
    && saveId == request.auth.uid + '_' + request.resource.data.post_id
    && request.resource.data.user_id == request.auth.uid;
}
```

### Follows de entidade
```javascript
match /feed_follows/{followId} {
  // Público: permite mostrar "quem segue esta arena" e contar seguidores.
  allow read: if isAuthed();
  allow create: if isAuthed()
    && followId == request.auth.uid + '_' + request.resource.data.target_key
    && request.resource.data.follower_uid == request.auth.uid
    && request.resource.data.target_type in
         ['arena','club','coach','store','tournament','platform'];
  allow update, delete: if isAuthed()
    && resource.data.follower_uid == request.auth.uid;
}
```

### Preferências, estatísticas, hashtags, fixados
```javascript
match /feed_preferences/{uid} {
  allow read, write: if isOwner(uid);
}

match /feed_post_stats/{postId} {
  allow read: if isAuthed();
  allow create, update: if isAuthed()
    && request.resource.data.diff(resource.data).affectedKeys()
         .hasOnly(['impressions','views','unique_views','profile_clicks',
                   'link_clicks','cta_clicks','video_plays',
                   'video_completions','by_day','updated_at']);
}

match /feed_author_stats/{authorKey} {
  allow read: if isAuthed();
  allow write: if isPlatformAdmin();       // Function usa Admin SDK
}

match /feed_hashtags/{tag} {
  allow read: if isAuthed();
  allow create, update: if isAuthed()
    && request.resource.data.diff(resource.data).affectedKeys()
         .hasOnly(['post_count','post_count_7d','last_used_at',
                   'trending_score','updated_at']);
  allow delete: if isPlatformAdmin();
  // bloquear hashtag: só admin (campo 'blocked' fora do hasOnly acima)
}

match /feed_pinned/{scope} {
  allow read: if isAuthed();
  allow write: if isPlatformAdmin();
}
```

## 3. Limitações honestas das regras

Coisas que as regras do Firestore **não** conseguem garantir aqui, e que
precisam de outra camada:

| Garantia | Onde é aplicada de verdade |
|---|---|
| Rate limit (5 posts/hora) | service + `user_rate_counters` + Cloud Function |
| Bloqueio mútuo em listagem | filtro no cliente (ranking) + fan-out Fase 2 |
| Contadores não serem inflados | regra restringe *quais* campos, não o *valor*; uma Function reconcilia periodicamente |
| Conteúdo proibido | moderação automática (Function) + fila humana |
| `visibility: followers` em query de lista | a query filtra `public`; `followers` só aparece na consulta por `author_key` de quem o usuário segue |

**Isto está documentado de propósito.** Fingir que a regra protege o que
ela não protege é como bugs de segurança nascem.

## 4. Matriz de permissão

| Ação | Autenticado | Autor | Autor do post | Gestor da entidade | Admin |
|---|---|---|---|---|---|
| Ler post público | ✅ | ✅ | ✅ | ✅ | ✅ |
| Ler post `followers` sem seguir | ❌ | ✅ | ✅ | ✅ | ✅ |
| Ler rascunho | ❌ | ✅ | ✅ | ✅ | ✅ |
| Publicar como si mesmo | ✅ | — | — | — | ✅ |
| Publicar como arena | ❌ | ❌ | ❌ | ✅ | ✅ |
| Publicar como plataforma | ❌ | ❌ | ❌ | ❌ | ✅ |
| Editar post alheio | ❌ | ❌ | ❌ | ❌ | ✅ |
| Reagir | ✅ | ✅ | ✅ | ✅ | ✅ |
| Comentar (comentários abertos) | ✅ | ✅ | ✅ | ✅ | ✅ |
| Comentar (restrito a seguidores) | ❌ | ✅ | ✅ | ✅ | ✅ |
| Ocultar comentário | ❌ | própr. | ✅ | ✅ | ✅ |
| Fixar comentário | ❌ | ❌ | ✅ | ✅ | ✅ |
| Remover post | ❌ | ❌ | ✅ | ✅ | ✅ |
| Bloquear hashtag | ❌ | ❌ | ❌ | ❌ | ✅ |
| Fixar post global | ❌ | ❌ | ❌ | ❌ | ✅ |

## 5. Testes de regras (emulador) — 45 asserções

1-8 · leitura por `status` × `visibility` × relação (segue / não segue /
membro do clube / autor / admin)
9-14 · criação: `actor_uid` forjado, entidade sem cargo, texto acima do
limite, mídia acima do limite, contador não-zero, campo de moderação
15-20 · edição: campo de moderação bloqueado, contadores liberados,
`author_key` imutável, autor alheio negado
21-26 · comentário: post com comentários desativados, restrito a
seguidores, texto longo, ocultar por não-autor, fixar por não-autor
27-31 · reação: id determinístico, reagir por outro uid, tipo inválido,
troca de reação, remover a própria
32-35 · follows: id determinístico, seguir por outro uid, tipo inválido
36-39 · preferências: ler/escrever de outro usuário negado
40-42 · hashtag: bloquear só admin; contador liberado
43-45 · admin: remover post, fixar global, moderar comentário
