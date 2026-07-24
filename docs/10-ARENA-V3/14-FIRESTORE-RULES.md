# Firestore Rules — Arena V3

> Mudanças nas regras para suportar as novas coleções. **Nenhuma regra existente é alterada.** Apenas novas `match /...` blocks adicionados.

## Mudanças

### 1. `arena_settings/{arenaId}` (sprint 0)

```js
// ---- Arena V3 Settings (sprint 0) --------------------------------------
// Settings operacionais, de pagamento, branding por arena.
// Leitura: gestores da arena + platform admin + arena (própria).
// Escrita: gestores da arena + platform admin.
match /arena_settings/{arenaId} {
  allow read: if isAuthed() && (
    isArenaManager(arenaId) || isPlatformAdmin()
  );
  allow create, update: if isAuthed() && (
    isArenaManager(arenaId) || isPlatformAdmin()
  );
  allow delete: if isPlatformAdmin();
}
```

### 2. `arena_module_states/{docId}` (sprint 0)

```js
// ---- Arena V3 Module States (sprint 0) ---------------------------------
// Liga/desliga módulos por arena. Doc id: {arenaId}_{moduleId}.
// Leitura pública (para o atleta saber o que a arena oferece).
// Escrita: gestores da arena + platform admin.
match /arena_module_states/{docId} {
  allow read: if true;
  allow create, update: if isAuthed() && (
    isArenaManager(request.resource.data.arena_id) || isPlatformAdmin()
  );
  allow delete: if isAuthed() && (
    isArenaManager(resource.data.arena_id) || isPlatformAdmin()
  );
}
```

### 3. `arena_open_slots/{slotId}` (sprint 1)

```js
// ---- Arena V3 Open Match slots (sprint 1) -------------------------------
// Vagas abertas publicadas pela arena (open match).
// Leitura pública.
// Criação/atualização: gestores da arena.
// Deleção: gestor ou criador do slot (atleta que se inscreveu pode sair).
match /arena_open_slots/{slotId} {
  allow read: if true;
  allow create, update: if isAuthed() && (
    isArenaManager(request.resource.data.arena_id) || isPlatformAdmin()
  );
  allow delete: if isAuthed() && (
    isArenaManager(resource.data.arena_id) || isPlatformAdmin()
  );
}
```

### 4. `arena_waitlist/{waitlistId}` (sprint 1)

```js
// ---- Arena V3 Waitlist (sprint 1) ---------------------------------------
// Lista de espera por slot aberto.
// Leitura: próprio atleta na lista + gestores da arena.
// Criação: próprio atleta (solicitação).
// Atualização: gestores (promover/ordem).
// Deleção: próprio atleta (sair) ou gestor.
match /arena_waitlist/{waitlistId} {
  allow read: if isAuthed() && (
    resource.data.athlete_id == request.auth.uid
    || isArenaManager(resource.data.arena_id)
    || isPlatformAdmin()
  );
  allow create: if isAuthed() && request.resource.data.athlete_id == request.auth.uid;
  allow update: if isAuthed() && (
    isArenaManager(resource.data.arena_id) || isPlatformAdmin()
  );
  allow delete: if isAuthed() && (
    resource.data.athlete_id == request.auth.uid
    || isArenaManager(resource.data.arena_id)
    || isPlatformAdmin()
  );
}
```

### 5. `arena_members/{docId}` (sprint 2)

```js
// ---- Arena V3 Members (sprint 2) ----------------------------------------
// Relação atleta-arena (com tier, status).
// Doc id: {arenaId}_{uid}.
// Leitura: próprio atleta + gestores da arena + platform admin.
// Criação: gestor da arena (convidar) ou platform admin.
// Atualização: gestores (tier, status).
// Deleção: gestores ou o próprio atleta (sair).
match /arena_members/{docId} {
  allow read: if isAuthed() && (
    resource.data.user_id == request.auth.uid
    || isArenaManager(resource.data.arena_id)
    || isPlatformAdmin()
  );
  allow create, update: if isAuthed() && (
    isArenaManager(request.resource.data.arena_id) || isPlatformAdmin()
  );
  allow delete: if isAuthed() && (
    resource.data.user_id == request.auth.uid
    || isArenaManager(resource.data.arena_id)
    || isPlatformAdmin()
  );
}
```

### 6. `arena_packages/{pkgId}` (sprint 2)

```js
// ---- Arena V3 Packages (sprint 2) ---------------------------------------
// Pacotes pré-pagos (10h por R$X).
// Leitura pública (catálogo).
// Criação/atualização: gestores da arena.
match /arena_packages/{pkgId} {
  allow read: if true;
  allow create, update: if isAuthed() && (
    isArenaManager(request.resource.data.arena_id) || isPlatformAdmin()
  );
  allow delete: if isAuthed() && (
    isArenaManager(resource.data.arena_id) || isPlatformAdmin()
  );
}
```

### 7. `arena_wallets/{docId}` (sprint 2)

```js
// ---- Arena V3 Wallets (sprint 2) ----------------------------------------
// Wallet do atleta na arena.
// Doc id: {arenaId}_{uid}.
// Acesso só do próprio atleta + gestores (auditoria).
match /arena_wallets/{docId} {
  allow read: if isAuthed() && (
    resource.data.user_id == request.auth.uid
    || isArenaManager(resource.data.arena_id)
    || isPlatformAdmin()
  );
  allow create, update: if isAuthed() && (
    isArenaManager(request.resource.data.arena_id) || isPlatformAdmin()
  );
  allow delete: if isPlatformAdmin();
}
```

### 8. `arena_subscriptions/{subId}` (sprint 2)

```js
// ---- Arena V3 Subscriptions (sprint 2) ----------------------------------
// Mensalidades recorrentes.
// Leitura: próprio atleta + gestores.
// Criação/atualização: gestores.
match /arena_subscriptions/{subId} {
  allow read: if isAuthed() && (
    resource.data.user_id == request.auth.uid
    || isArenaManager(resource.data.arena_id)
    || isPlatformAdmin()
  );
  allow create, update: if isAuthed() && (
    isArenaManager(request.resource.data.arena_id) || isPlatformAdmin()
  );
  allow delete: if isPlatformAdmin();
}
```

### 9. `arena_products/{prodId}` (sprint 3)

```js
// ---- Arena V3 Products / PDV Catalog (sprint 3) -------------------------
// Produtos do PDV (água, raquete, etc.).
// Leitura: pública (se arena.visibility.show_catalog = true) ou authed (se restrito).
// Escrita: gestores.
match /arena_products/{prodId} {
  allow read: if true;
  allow create, update: if isAuthed() && (
    isArenaManager(request.resource.data.arena_id) || isPlatformAdmin()
  );
  allow delete: if isAuthed() && (
    isArenaManager(resource.data.arena_id) || isPlatformAdmin()
  );
}
```

### 10. `arena_sales/{saleId}` (sprint 3)

```js
// ---- Arena V3 Sales (sprint 3) ------------------------------------------
// Vendas do PDV.
// Leitura: próprio atleta (suas compras) + gestores.
// Criação: gestores (PDV manual) ou próprio atleta (auto-atendimento).
match /arena_sales/{saleId} {
  allow read: if isAuthed() && (
    resource.data.buyer_id == request.auth.uid
    || isArenaManager(resource.data.arena_id)
    || isPlatformAdmin()
  );
  allow create: if isAuthed();  // qualquer authed pode comprar
  allow update, delete: if isAuthed() && (
    isArenaManager(resource.data.arena_id) || isPlatformAdmin()
  );
}
```

### 11. `arena_payments/{paymentId}` (sprint 3)

```js
// ---- Arena V3 Payments (sprint 3) ---------------------------------------
// Pagamentos (Pix, cartão, etc.).
// Leitura: próprio atleta + gestores.
// Criação: próprio atleta (checkout) ou gestor (PDV manual).
match /arena_payments/{paymentId} {
  allow read: if isAuthed() && (
    resource.data.payer_id == request.auth.uid
    || isArenaManager(resource.data.arena_id)
    || isPlatformAdmin()
  );
  allow create: if isAuthed();
  allow update: if isAuthed() && (
    resource.data.payer_id == request.auth.uid
    || isArenaManager(resource.data.arena_id)
    || isPlatformAdmin()
  );
  allow delete: if isPlatformAdmin();
}
```

### 12-19. Demais coleções (sprints 4-11)

Padrão similar: leitura pública quando aplicável, leitura privada quando sensível, escrita por gestor ou platform admin, deleção rara (sempre platform admin ou próprio dono).

## Helpers adicionais

```js
// Já existe: isArenaManager(arenaId)
// Novo:
function isArenaMember(arenaId) {
  return isAuthed()
    && exists(/databases/$(database)/documents/arena_members/$(arenaId + '_' + request.auth.uid));
}
```

## Como aplicar

Adicionar os novos `match /...` blocks DEPOIS dos blocos existentes de arenas (linha ~280+ do `firestore.rules`). Não mexer em nada antes.

## Testes

Cada sprint deve incluir:
- Teste manual com emulador
- 2+ casos de teste por coleção (read allowed, read denied, write allowed, write denied)
- Verificar que platform admin sempre passa

## Migration

Sem migration de dados — só adição de regras. Documentos existentes não são afetados.
