# avatar/ — Avatar do jogador em 3D (flag `avatar_creator`)

Cada pessoa monta o próprio jogador de pickleball em 3D (`/avatar`) e pode
usá-lo como foto do perfil. Respira, pisca, gira com o dedo e faz o movimento
da pose ao toque. Aceita raquetes de marca (itens patrocinados) cadastradas
pelo admin. Documento completo: `docs/58-AVATARES.md`.

**Zero coleção, zero índice, zero regra nova, zero Cloud Function.**

```
avatar/
├── domain/      # PURO e testado — nada de React, Firebase ou three.js
│   ├── catalog.js        # RECIPE_OPTIONS: tudo o que dá para escolher. Os ids são GRAVADOS
│   ├── recipe.js         # normalizeRecipe (só o que é do catálogo), sameRecipe, randomRecipe
│   ├── color.js          # cores #rrggbb: validar, misturar, sombrear, contraste
│   ├── poses.js          # as 5 poses, POSE_MOTION e poseAt (quadros-chave)
│   ├── brandItems.js     # raquetes de marca: limpar, "no ar", resolvePaddle
│   ├── profileAvatar.js  # o que gravar no cadastro: salvar, voltar à foto, usar, apagar
│   └── publicAvatar.js   # o que vai ao espelho público (arquivo-folha, sem imports)
├── three/       # o desenho 3D — SÓ por import dinâmico
│   ├── support.js        # webglAvailable() — o único arquivo daqui SEM three.js
│   ├── geom.js · tex.js  # superfícies/tubos e texturas em canvas
│   ├── head.js · body.js # as peças
│   ├── character.js      # monta o personagem; refaz só o grupo que mudou
│   └── stage.js          # cena, luz, câmera, laço, foto fora da tela (VIEWS)
├── services/
│   ├── avatarSnapshots.js # fila + cache das fotos (miniaturas e imagem salva)
│   ├── avatarExport.js    # renderAvatarBlob: WebP (ou PNG)
│   └── avatarService.js   # envio ao Storage e catálogo de marca (com auditoria)
├── hooks/useAvatarCatalog.js
├── components/
│   ├── Avatar3D.jsx       # o avatar VIVO (um canvas); fallback sem 3D
│   └── AvatarSnap.jsx     # a foto parada (miniaturas do estúdio)
└── i18n/locales/{en,es}.js
```

Telas (fora do módulo): `src/v2/pages/V2AvatarStudio.jsx`,
`src/v2/components/avatar/{AvatarStudio,ProfileAvatarSlot}.jsx`,
`src/v2/components/admin/AdminAvatarCatalogTab.jsx`.

## Como usar

```jsx
// o avatar vivo (sempre por lazy: ele puxa a three.js quando aparece)
const Avatar3D = lazy(() => import('@/modules/avatar/components/Avatar3D'));
<Avatar3D recipe={recipe} view="bust" fallback={<img src={fotoSalva} alt="" />} />

// numa lista: NÃO monte o vivo. A imagem salva já é o photo_url.
```

## Dados

- `users/{uid}.avatar` — `{ v, recipe, url, full_url, path, full_path,
  as_photo, photo_backup, updated_at_ms }`.
- `users/{uid}.photo_url` — a imagem do avatar, só se a pessoa escolher.
- `athlete_profiles/{uid}.avatar` — `{ recipe, full_url, updated_at_ms }`, só
  quando o avatar é a foto (`publicAvatar`).
- `platform_settings/avatar_catalog.brand_paddles[]` — só o admin escreve.
- Storage `uploads/{uid}/avatar/` — as imagens (regra que já existia).

## O que não pode regredir

1. **three.js fora do pacote inicial**: só `three/stage.js` a importa, e só
   por `import()`. Para saber se o aparelho desenha em 3D, `three/support.js`.
2. **A receita só guarda ids do catálogo, cores e o número do peito**
   (`normalizeRecipe`) — é o que permite pô-la no espelho público.
3. **A foto de verdade fica em `photo_backup`** e volta com um toque, mesmo
   com a flag desligada.
4. **Ids do catálogo, das poses e dos itens de marca são gravados.**
5. **Item de marca sempre com o selo "Patrocinado"**; link de saída só `https`.
6. **Nunca um canvas WebGL por miniatura**: `AvatarSnap` (um palco, uma fila).
7. Quadro-chave do meio de um movimento leva o valor de toda junta em
   movimento (junta omitida herda a pose de partida e o braço dá um salto).
