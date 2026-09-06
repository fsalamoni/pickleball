# PATCH P1-05 — Storage: leitura de arquivo alheio

> **NÃO APLICADO.**

## O achado
`storage.rules`: `match /uploads/{uid}/{allPaths=**}` com
`allow read: if isAuthed()`. Qualquer conta lê o arquivo de qualquer outra.
O caminho é previsível e o `uid` é descobrível em coleções públicas.

## Por que não dá para simplesmente fechar

Hoje **todo** upload cai em `uploads/{uid}/{folder}/...`
(`storageService.js`), e as URLs de download (com token) estão gravadas
dentro de documentos que outras pessoas legitimamente leem: foto de perfil,
foto de torneio, anexo de chat, logo de arena, comprovante de reserva.

Trocar para `allow read: if request.auth.uid == uid` **quebraria** foto de
perfil, foto de torneio, anexo de chat — tudo.

> Detalhe importante: a URL do `getDownloadURL()` carrega um **token de
> download**; quem tem a URL acessa o arquivo mesmo sem regra permissiva.
> A regra protege contra *enumeração de caminho*, não contra o vazamento da
> URL. Isso limita o ganho e precisa ser dito com honestidade.

## Solução: separar por prefixo, sem migrar o que existe

```javascript
service firebase.storage {
  match /b/{bucket}/o {
    function isAuthed() { return request.auth != null; }
    function sizeOk() { return request.resource.size < 25 * 1024 * 1024; }
    function isPlatformAdmin() {
      return isAuthed()
        && firestore.get(/databases/pickleball/documents/users/$(request.auth.uid))
             .data.role == 'platform_admin';
    }

    // NOVO — arquivos sensíveis. Só o dono e o admin.
    // Comprovantes, documentos, mídia de conteúdo restrito.
    match /uploads/{uid}/private/{allPaths=**} {
      allow read: if isAuthed() && (request.auth.uid == uid || isPlatformAdmin());
      allow write: if isAuthed() && request.auth.uid == uid && sizeOk();
      allow delete: if isAuthed() && (request.auth.uid == uid || isPlatformAdmin());
    }

    // EXISTENTE — inalterado. Conteúdo que já é exibido a outras pessoas.
    match /uploads/{uid}/{allPaths=**} {
      allow read: if isAuthed();
      allow write: if isAuthed() && request.auth.uid == uid && sizeOk();
      allow delete: if isAuthed() && request.auth.uid == uid;
    }

    match /{allPaths=**} { allow read, write: if false; }
  }
}
```

Aditivo puro: nada do que existe muda de comportamento. A partir daí,
**todo upload novo de natureza sensível** vai para `private/`:
- comprovante de pagamento (reserva, PDV e, no futuro, Mercado);
- documento de identidade, se algum dia houver verificação;
- mídia de post com visibilidade restrita (Feed);
- anexo de conversa de suporte com o admin.

## Complemento necessário: expiração de token

Para o que é realmente sensível, a URL permanente com token é o modelo
errado. Usar **signed URL de curta duração** gerada por Cloud Function
(15 min), em vez de `getDownloadURL()`. Aplicar em: comprovante de
pagamento e qualquer coisa que a área de suporte do admin exiba.
