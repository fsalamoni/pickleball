# 18.04 — Modelo de dados da moderação

## 1. `content_reports/{id}`
```js
{
  target_type: 'feed_post',          // REPORT_TARGET
  target_id: 'post123',
  target_owner_uid: 'uid_do_autor',
  target_owner_key: 'arena_arena123',
  target_snapshot: {                 // congela o que foi denunciado
    title:'', text:'', media_url:'', author_name:'', created_at:<ts>,
  },

  reporter_uid: 'uid',
  reporter_weight: 4,                // reporterWeight no momento
  reason: 'assedio_ou_odio',
  severity: 'high',                  // derivada do motivo
  description: '',                   // ≤ 1000

  status: 'open'|'triaged'|'resolved'|'dismissed'|'duplicate',
  resolution: null|'kept'|'limited'|'hidden'|'removed'|'sanctioned',
  resolved_by: null, resolved_at: null, resolution_note: '',

  is_appeal: false,                  // recurso de sanção
  appeal_of_action_id: null,

  priority_score: 128,               // recalculado por Function
  group_id: 'feed_post_post123',     // agrupa denúncias do mesmo alvo
  created_at, updated_at,
}
```

## 2. `moderation_actions/{id}` — trilha imutável
```js
{ target_type, target_id, target_owner_uid,
  action: 'keep'|'limit'|'hide'|'remove'|'strike'|'suspend'|'ban'|'restore',
  reason_code, note,                 // note OBRIGATÓRIA (exceto 'keep')
  report_ids: ['r1','r2'],
  moderator_uid, moderator_role: 'platform_admin',
  duration_days: null,               // suspensão
  reverted: false, reverted_by: null, reverted_at: null, revert_note: '',
  created_at }
```
Só `create` e um `update` restrito para `reverted`. Nunca delete.

## 3. `content_strikes/{id}`
Schema em `03-BLOQUEIO §4`.

## 4. `user_blocks/{blockerUid}_{blockedUid}`
```js
{ blocker_uid, blocked_uid, reason: '', created_at }
```
Id determinístico. Bloqueio mútuo = dois documentos? **Não**: um documento
representa "A bloqueou B", e o efeito é aplicado nos dois sentidos pela
leitura de ambas as direções (`{A}_{B}` e `{B}_{A}`). O cliente carrega a
lista própria uma vez por sessão (`where('blocker_uid','==',uid)` +
`where('blocked_uid','==',uid)`) e filtra localmente.

## 5. `user_mutes/{uid}_{targetKey}`
```js
{ user_id, target_kind:'author'|'hashtag'|'keyword', target_key,
  expires_at: null, created_at }
```
Só usado quando a lista em `feed_preferences` estoura 200 itens.

## 6. `user_rate_counters/{uid}`
Schema em `03-BLOQUEIO §5`.

## 7. `moderation_queue_stats/{dayKey}`
```js
{ day:'2026-09-06', open_count, critical_count, resolved_count,
  avg_resolution_minutes, by_reason:{spam:12,...},
  by_target:{feed_post:20,market_listing:5},
  reverted_on_appeal: 1, updated_at }
```

---

## Regras de segurança

```javascript
// ---- Moderação (compartilhada Feed + Mercado) -------------------------
match /content_reports/{reportId} {
  // O denunciante lê a PRÓPRIA denúncia (para ver o desfecho).
  // O denunciado NUNCA lê (anonimato do denunciante).
  allow read: if isAuthed() && (
    resource.data.reporter_uid == request.auth.uid || isPlatformAdmin());

  allow create: if isAuthed()
    && request.resource.data.reporter_uid == request.auth.uid
    && request.resource.data.status == 'open'
    && request.resource.data.resolution == null
    // não se autodenuncia (evita ruído)
    && request.resource.data.target_owner_uid != request.auth.uid
    && !request.resource.data.keys().hasAny(['resolved_by','resolved_at',
                                             'priority_score']);

  allow update: if isPlatformAdmin();
  allow delete: if false;    // denúncia nunca é apagada
}

match /moderation_actions/{actionId} {
  // O sancionado precisa ver a ação que sofreu (transparência + recurso).
  allow read: if isAuthed() && (
    resource.data.target_owner_uid == request.auth.uid || isPlatformAdmin());
  allow create: if isPlatformAdmin()
    && request.resource.data.moderator_uid == request.auth.uid
    && (request.resource.data.action == 'keep'
        || request.resource.data.note.size() > 0);   // motivo obrigatório
  allow update: if isPlatformAdmin()
    && request.resource.data.diff(resource.data).affectedKeys()
         .hasOnly(['reverted','reverted_by','reverted_at','revert_note']);
  allow delete: if false;
}

match /content_strikes/{strikeId} {
  allow read: if isAuthed() && (
    resource.data.user_id == request.auth.uid || isPlatformAdmin());
  allow create, update: if isPlatformAdmin();
  allow delete: if false;
}

match /user_blocks/{blockId} {
  // Leitura pelas DUAS pontas: o cliente precisa saber que foi bloqueado
  // para não tentar escrever (e as regras de escrita checam este doc).
  allow read: if isAuthed() && (
    resource.data.blocker_uid == request.auth.uid
    || resource.data.blocked_uid == request.auth.uid
    || isPlatformAdmin());
  allow create: if isAuthed()
    && blockId == request.auth.uid + '_' + request.resource.data.blocked_uid
    && request.resource.data.blocker_uid == request.auth.uid
    && request.resource.data.blocked_uid != request.auth.uid;
  allow delete: if isAuthed() && resource.data.blocker_uid == request.auth.uid;
  allow update: if false;
}

match /user_mutes/{muteId} {
  allow read, write: if isAuthed()
    && muteId.split('_')[0] == request.auth.uid;
}

match /user_rate_counters/{uid} {
  // O contador é do usuário, mas ele não pode zerá-lo à vontade — só
  // incrementar. A garantia real é a reconciliação por Function; a regra
  // apenas evita a manipulação trivial.
  allow read: if isOwner(uid) || isPlatformAdmin();
  allow create, update: if isOwner(uid)
    && request.resource.data.diff(resource.data).affectedKeys()
         .hasOnly(['windows','updated_at']);
  allow delete: if isPlatformAdmin();
}

match /moderation_queue_stats/{dayKey} {
  allow read: if isPlatformAdmin();
  allow write: if isPlatformAdmin();
}
```

### Helper para aplicar bloqueio nas escritas
```javascript
function isBlockedBetween(otherUid) {
  return exists(/databases/$(database)/documents/
           user_blocks/$(request.auth.uid + '_' + otherUid))
      || exists(/databases/$(database)/documents/
           user_blocks/$(otherUid + '_' + request.auth.uid));
}
```
Usar em: criar comentário (`!isBlockedBetween(autorDoPost)`), criar oferta,
criar pedido, criar mensagem de chat. **Custo**: 2 leituras extras por
escrita. Aceitável nessas ações (são raras); **não** usar em leitura de
lista (seria 2 leituras por item).

## Índices
```jsonc
content_reports: [status ASC, priority_score DESC, created_at ASC]
content_reports: [status ASC, severity ASC, created_at ASC]
content_reports: [target_type ASC, status ASC, created_at DESC]
content_reports: [group_id ASC, created_at DESC]
content_reports: [reporter_uid ASC, created_at DESC]
content_reports: [target_owner_uid ASC, created_at DESC]
moderation_actions: [target_owner_uid ASC, created_at DESC]
moderation_actions: [moderator_uid ASC, created_at DESC]
content_strikes: [user_id ASC, active ASC, expires_at ASC]
content_strikes: [active ASC, expires_at ASC]
user_blocks: [blocker_uid ASC, created_at DESC]
user_blocks: [blocked_uid ASC, created_at DESC]
```
**12 índices novos.**

## Domínio (`src/modules/moderation/domain/`)

| Arquivo | Responsabilidade | Testes |
|---|---|---|
| `constants.js` | alvos, motivos, gravidade, ações, labels | 8 |
| `report.js` | validar denúncia, derivar gravidade, agrupar | 22 |
| `priority.js` | `priorityScore`, envelhecimento, denunciantes distintos | 20 |
| `reporterWeight.js` | reputação do denunciante | 14 |
| `strikes.js` | soma de pesos, expiração, escala de sanção | 22 |
| `sanctions.js` | ação → efeitos, proporcionalidade, reversão | 18 |
| `blocks.js` | aplicar bloqueio em listas, direção dupla | 16 |
| `mutes.js` | silenciar autor/hashtag, expiração | 12 |
| `rateLimit.js` | chave de janela, contagem, mensagem de limite | 24 |
| `autoModeration.js` | termos banidos, links suspeitos, duplicidade | 26 |
| `coordination.js` | detecção de denúncia coordenada | 14 |
| **Total** | | **~196** |
