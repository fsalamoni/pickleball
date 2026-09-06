# PATCH P1-06 / P1-07 — Notificação forjada e auditoria forjável

> **NÃO APLICADO.** Dois patches pequenos, no mesmo arquivo por serem
> vizinhos em `firestore.rules`.

## P1-06 · Notificação: qualquer um escreve no sino de qualquer um

### Achado
```javascript
match /notifications/{nid} {
  allow read, update: if isAuthed() && resource.data.user_id == request.auth.uid;
  allow create: if isAuthed();     // ← sem validação nenhuma
}
```
Vetor de phishing interno: notificação com a credibilidade da interface
oficial, texto e `data.link` arbitrários.

### Dificuldade real
`notificationService.js` é chamado de dezenas de lugares por usuários
comuns e legítimos (convite de dupla, mensagem de chat, resposta de fórum,
inscrição em clube). Não existe uma relação única e barata de validar nas
regras que cubra todos os casos.

### Duas opções

**Opção A — endurecer nas regras (rápido, cobertura parcial)**
```javascript
allow create: if isAuthed()
  && request.resource.data.actor_id == request.auth.uid
  && request.resource.data.user_id != request.auth.uid
  && request.resource.data.type in [ /* lista fechada de tipos conhecidos */ ]
  && request.resource.data.title.size() <= 120
  && request.resource.data.body.size() <= 300
  && (!('link' in request.resource.data)
      || request.resource.data.link.matches('^/[a-zA-Z0-9/_:-]*$'));  // só rota interna
```
Ganho grande e barato: o atacante não consegue mais forjar o remetente nem
colocar link externo. Ainda pode mandar notificação de tipo válido para
quem quiser — spam, não phishing.
**Verificado no código** (`notificationService.js:82-99`): o payload **grava
`actor_id`**, mas com `actor?.uid || null` — ou seja, **pode ser `null`**
quando o chamador não passa o ator. Uma regra que exija
`actor_id == request.auth.uid` quebraria essas chamadas.

Ordem correta:
1. Mapear os pontos de chamada que hoje não passam `actor`.
2. Fazer o `notificationService` preencher o ator a partir de
   `auth.currentUser` quando o parâmetro vier vazio (nunca deixar `null`).
3. Só então aplicar a regra com `actor_id == request.auth.uid`.

Aceitar `actor_id == null` na regra **não resolve nada**: o atacante
simplesmente omite o campo e forja anonimamente.

**Opção B — mover a criação para Cloud Function (correto, mais caro)**
`allow create: if false` no cliente; toda notificação nasce de uma
`onDocumentCreated` que observa o fato de origem (mensagem, convite,
inscrição). Elimina a classe inteira de abuso e ainda permite agrupamento.
Custo: reescrever todos os pontos de chamada.

**Recomendação**: A agora, B quando o Feed entrar (o Feed vai precisar de
notificação agrupada por Function de qualquer forma —
`docs/FUTURO/FEED/09-ADMIN-E-CONFIGURACOES.md` §4).

---

## P1-07 · Auditoria: entrada forjável

### Achado
```javascript
match /audit_logs/{lid} {
  allow read: if isPlatformAdmin();
  allow create: if isAuthed();      // ← não valida o ator
  allow update, delete: if false;   // ✅ imutabilidade correta
}
```
Qualquer usuário grava uma entrada **em nome de outra pessoa**. A trilha é
justamente o que serve de prova em incidente — e a do P0-01 dependeria dela.

### Patch

**Shape verificado** em `src/core/services/auditService.js:81-97`: o campo é
**`actor_id`** (string), e o serviço já faz `if (!actor?.uid || !action) return;`
— ou seja, **nunca grava sem ator**. A regra abaixo é exata e não quebra
nenhum ponto de chamada existente.

```diff
     match /audit_logs/{lid} {
       allow read: if isPlatformAdmin();
-      allow create: if isAuthed();
+      // O ator registrado tem de ser quem está escrevendo. Sem isso a
+      // trilha pode ser poluída ou atribuída a terceiros — e ela é a
+      // prova em caso de incidente (inclusive do P0-01).
+      allow create: if isAuthed()
+        && request.resource.data.actor_id == request.auth.uid;
       allow update, delete: if false;
     }
```

**Risco de quebra: nenhum conhecido.** Ainda assim, validar no emulador:
criar log com `actor_id` próprio (permitido) e com `actor_id` de terceiro
(negado).

### Observação de privacidade (não é do patch, mas anotar)
`audit_logs` guarda `actor_email`, `user_email` e `user_name`
(`auditService.js:93,96,97`). Leitura é só do `platform_admin` — correto —
mas isso torna a coleção um **repositório de e-mails** que cresce para
sempre, sem retenção. Ver `11-RETENCAO-E-EXCLUSAO.md` e o inventário em
`02-INVENTARIO-DE-DADOS.md`.
