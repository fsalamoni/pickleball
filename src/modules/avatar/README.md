# avatar/ — Avatar do jogador, criado por IA (flag `avatar_creator`)

Cada pessoa toca nas escolhas do próprio jogador de pickleball (`/avatar`) e o
servidor pede a imagem a um serviço de inteligência artificial; o avatar pode
virar a foto do perfil. Aceita raquetes de marca (itens patrocinados)
cadastradas pelo admin. Documento completo: `docs/58-AVATARES.md`.

**Nenhuma regra nova.** Uma coleção só do servidor (`avatar_usage`) e uma
Cloud Function (`avatarAi`).

```
avatar/
├── domain/      # PURO e testado — nada de React nem Firebase
│   ├── catalog.js        # RECIPE_OPTIONS: tudo o que dá para escolher. Os ids são GRAVADOS
│   ├── recipe.js         # normalizeRecipe (só o que é do catálogo), sameRecipe, randomLook
│   ├── aiConfig.js       # padrões da configuração do admin e a frase de cada limite
│   ├── brandItems.js     # raquetes de marca: limpar, "no ar"
│   ├── profileAvatar.js  # o que gravar no cadastro: salvar, voltar à foto, usar, apagar
│   └── publicAvatar.js   # o que vai ao espelho público (arquivo-folha, sem imports)
├── services/
│   ├── avatarAiService.js # a callable `avatarAi`; a imagem em base64 → arquivo; o recorte da miniatura
│   └── avatarService.js   # envio ao Storage e catálogo de marca (com auditoria)
├── hooks/
│   ├── useAvatarAi.js     # status, criar, e a configuração do admin
│   └── useAvatarCatalog.js
└── i18n/locales/{en,es}.js
```

Telas (fora do módulo): `src/v2/pages/V2AvatarStudio.jsx` (criar e salvar),
`src/v2/components/avatar/AvatarStudio.jsx` (as escolhas),
`src/v2/components/admin/AdminAvatarAiTab.jsx` (configuração) e
`AdminAvatarCatalogTab.jsx` (raquetes de marca).

Servidor: `functions/avatarAi.js` (a callable) e `functions/avatarAiPolicy.js`
(o catálogo → as frases do pedido, os limites, a configuração).

## Dados

- `users/{uid}.avatar` — `{ v, recipe, url, full_url, path, full_path,
  as_photo, photo_backup, updated_at_ms }`.
- `users/{uid}.photo_url` — a miniatura do avatar, só se a pessoa escolher.
- `athlete_profiles/{uid}.avatar` — `{ recipe, full_url, updated_at_ms }`, só
  quando o avatar é a foto (`publicAvatar`).
- `platform_settings/avatar_catalog.brand_paddles[]` — só o admin escreve.
- `platform_settings/avatar_ai` — a configuração do criador; só o servidor grava.
- `platform_secrets/avatar_ai` — a chave do provedor; ninguém lê pelo cliente.
- `avatar_usage/{uid}` e Storage `avatar-ia/{uid}/` — só o servidor (sem regra).
- Storage `uploads/{uid}/avatar/` — o avatar salvo (regra que já existia).

## O que não pode regredir

1. **Nenhum texto e nenhuma imagem do navegador chega ao provedor**: a tela
   manda ids do catálogo e `keep`; o pedido é escrito no servidor.
2. **A receita só guarda ids do catálogo** (`normalizeRecipe`) e **os ids são
   gravados**: nunca renomeie; opção nova entra no fim, aqui **e** em
   `functions/avatarAiPolicy.js` (com a frase em `FRAG`) — a paridade reprova
   um lado só.
3. **A foto de verdade fica em `photo_backup`** e volta com um toque, mesmo
   com a flag desligada.
4. **A chave do provedor é só de escrita**: a tela do admin nunca a recebe.
5. **Item de marca sempre com o selo "Patrocinado"**; link de saída só `https`.
6. **Falha ao consultar não é "indisponível"**: `useAvatarAiStatus` devolve
   `isError` e a tela oferece tentar de novo.
7. O limite é do servidor: a tela só mostra quantas restam.
