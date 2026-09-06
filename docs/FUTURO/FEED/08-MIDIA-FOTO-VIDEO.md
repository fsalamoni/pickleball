# 17.08 — Mídia: foto e vídeo

> A mídia é ao mesmo tempo o que faz o feed valer a pena e o que pode
> quebrar a conta do Firebase. Este documento existe para as duas coisas
> serem resolvidas no mesmo lugar.

## 1. Foto

### Pipeline (client-side, obrigatório)
```
arquivo escolhido
  → validação (tipo, tamanho bruto ≤ 15MB — reusa validateImageFile)
  → correção de orientação (EXIF)
  → redimensiona: lado maior ≤ 1600px          (canvas)
  → converte para WebP q=0.82 (fallback JPEG q=0.85)
  → gera THUMB 400px q=0.75
  → remove metadados EXIF (privacidade: GPS!)
  → upload das duas versões
```

Resultado típico: foto de celular de 4,5 MB → **~180 KB** (full) +
**~28 KB** (thumb).

Novo utilitário `src/core/lib/imageProcessing.js` (é API de navegador, não
é lógica de domínio; por isso vai em `core/lib`, não em `domain`):
```js
processImage(file, { maxSide=1600, quality=0.82, format='webp' })
  → { blob, width, height, mime }
generateThumbnail(file|blob, { size=400 })
stripExif(blob)
```
Testável com `canvas` mockado; os casos de borda (imagem gigante, PNG com
transparência, HEIC do iPhone) precisam de teste.

> ⚠ **HEIC**: iPhone entrega `.heic` que o Chrome desktop não decodifica.
> O `<input type=file accept="image/*">` no iOS já converte para JPEG na
> maioria dos casos, mas **não sempre**. Detectar e avisar em pt-BR:
> "Formato não suportado. Tire a foto pelo app ou converta para JPG."

### Caminhos no Storage
```
uploads/{uid}/feed/{postId}/{n}.webp        full
uploads/{uid}/feed/{postId}/{n}_thumb.webp  thumbnail
uploads/{uid}/feed/{postId}/poster.webp     capa de vídeo
uploads/{uid}/feed_video/{postId}.mp4       vídeo
```

### Regras de exibição
- Card usa **sempre o thumb**; a versão full só abre no lightbox.
- `loading="lazy"` + `decoding="async"` em tudo abaixo da dobra.
- `aspect-ratio` do container vem de `width/height` gravados no post →
  zero layout shift.
- `alt` obrigatório: sugerido a partir da legenda, editável pelo autor.

## 2. Vídeo (flag `feed_video`)

### O problema honesto
O Firebase **não transcodifica vídeo**. Sem transcodificação:
- o arquivo vai como está (um vídeo de celular de 60s pode ter 80-150 MB);
- não há versão de baixa resolução para conexão ruim;
- não há HLS/adaptativo — é download progressivo.

### Posição da Fase 1
Aceitar isso com **limites duros** e ser honesto na UI:

| Limite | Valor | Por quê |
|---|---|---|
| Duração | 90s | acima disso não é feed, é YouTube |
| Tamanho | 100 MB | teto de upload viável em 4G |
| Formato | `video/mp4` (H.264) e `video/webm` | o que o navegador toca |
| Resolução recomendada | 1080p | o cliente **avisa** se for maior |

Verificação no cliente antes do upload: cria um `<video>` fora da tela,
lê `duration` e `videoWidth/Height`, extrai o **poster** do frame de 1s
(canvas → WebP), e só então envia. Se estourar limite, erro claro em
pt-BR com o que fazer.

### Regras do Storage — a única mudança necessária
```javascript
// storage.rules — ADITIVO, o bloco existente uploads/{uid} não muda
match /uploads/{uid}/feed_video/{allPaths=**} {
  allow read: if isAuthed();
  allow write: if isAuthed() && request.auth.uid == uid
    && request.resource.size < 100 * 1024 * 1024
    && request.resource.contentType.matches('video/.*');
  allow delete: if isAuthed() && request.auth.uid == uid;
}
```
⚠ **Atenção**: o bloco genérico `uploads/{uid}/{allPaths=**}` existente já
casa esse caminho com limite de 25 MB. Regras do Storage combinam por
`allow` em **qualquer** match, então o bloco mais específico concede o
que ele permite. Ainda assim, coloque o bloco de vídeo **antes** e teste
no emulador — este é exatamente o tipo de coisa que passa despercebida.

### Reprodução
- **Nunca** autoplay com som.
- Autoplay mudo só se: preferência `autoplay_video` ligada **e**
  `navigator.connection.saveData !== true` **e** o card está > 50% no
  viewport **e** `prefers-reduced-motion` não está ativo.
- Fora disso: poster + botão de play.
- Um vídeo tocando por vez na tela.
- Contar `video_plays` e `video_completions` em `feed_post_stats`.

### Fase 3 — transcodificação de verdade
Quando > 30% dos posts tiverem vídeo, migrar para **Mux** ou **Cloudflare
Stream**: upload direto para o provedor, o post guarda só o `playback_id`,
e o custo de egress sai do Firebase. Custo típico: US$ 1/1000 min
armazenados + US$ 1/1000 min entregues — mais previsível que egress bruto.
O schema já prevê isso: `media[]` com `kind:'video'` e um campo
`provider_ref` opcional.

## 3. Enquete, link e áudio

- **Enquete**: sem mídia, custo zero. Ótimo custo-benefício de engajamento.
- **Link**: Fase 1 o autor digita título/descrição. Preview automático
  exige uma Cloud Function que busca a página e lê as meta tags OG — isso
  é **SSRF em potencial** (a função vira um proxy para a rede interna).
  Se implementar na Fase 2: allowlist de domínios, timeout curto, bloquear
  IPs privados, e nunca seguir mais de 2 redirects.
- **Áudio**: fora do escopo.

## 4. Privacidade da mídia

- **EXIF removido sempre.** Uma foto de celular carrega coordenada GPS. Um
  feed que publica isso sem tirar é um vazamento de localização de menores
  de idade. Não negociável.
- Fotos ficam em `uploads/{uid}`, legíveis por qualquer autenticado com a
  URL. Um post `followers` ou `club` tem o **documento** protegido, mas a
  **URL da imagem** não é secreta. Documentar nos Termos e não prometer
  privacidade que não existe. Endurecer é Fase 2 (mover mídia restrita para
  um caminho com regra por audiência, ou usar URLs assinadas de curta vida).

## 5. Exclusão

Excluir um post precisa apagar a mídia (Storage não é limpo sozinho). Uma
Cloud Function `onDocumentDeleted('feed_posts/{id}')` remove os arquivos
pelo `media[].path`. Sem isso, o Storage cresce para sempre com lixo.
Mesma coisa para comentários com imagem.

## 6. Mitigações de custo — checklist obrigatório do PR de mídia

- [ ] Thumb 400px usado em **todos** os cards.
- [ ] WebP com fallback.
- [ ] `cacheControl: public, max-age=31536000, immutable` (já é o padrão
      do `storageService`).
- [ ] Paginação de 12 itens; nunca renderizar 100 cards.
- [ ] `loading="lazy"` abaixo da dobra.
- [ ] Vídeo: poster no card, arquivo só ao tocar.
- [ ] Sem autoplay em `save-data`.
- [ ] Function de limpeza no delete.
- [ ] Alertas de budget no Firebase (US$ 50 / 100 / 200).
- [ ] Medir egress semanalmente durante o beta.
