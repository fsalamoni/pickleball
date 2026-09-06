# 17.06 — Rotas, telas e componentes do Feed

## 1. Rotas

Todas gated por `<FeedGuard>` = `FeatureFlagGuard flag="feed"`.

### Público (leitor)
| Rota | Página | O que é |
|---|---|---|
| `/feed` | `V2Feed` | Timeline com 4 abas |
| `/feed/p/:postId` | `V2FeedPost` | Permalink com comentários |
| `/feed/tag/:tag` | `V2FeedHashtag` | Posts da hashtag |
| `/feed/descobrir` | `V2Feed` (aba) | Em alta, sugestões |
| `/feed/salvos` | `V2FeedSaved` | Salvos |
| `/feed/a/:authorKey` | `V2FeedAuthor` | Perfil de feed da entidade (arena/clube/professor/loja) |
| `/novidades` | — | **Redireciona** para `/feed` (flag ON); mantém `V2Community` (flag OFF) |

### Gestão (autor)
| Rota | Página | O que é |
|---|---|---|
| `/feed/publicar` | `V2FeedComposer` | Composer em tela cheia (mobile) |
| `/feed/gerenciar` | `V2FeedManage` | Publicados, rascunhos, agendados, arquivados |
| `/feed/gerenciar/:postId` | `V2FeedPostInsights` | Métricas do post |
| `/feed/gerenciar/identidade/:authorKey` | `V2FeedIdentityManage` | Painel da entidade: quem publica, calendário, desempenho |
| `/feed/configuracoes` | `V2Settings` (aba) | Preferências do feed |

**12 rotas · 9 páginas V2 novas.**

## 2. Navegação

O Feed **não** ganha um hub próprio — ele entra no hub "Comunidade" que já
existe, como primeiro item, e ganha lugar no bottom nav do celular
(é a única mudança justificada no bottom nav de toda a plataforma, porque
feed é destino diário):

```js
// V2Layout — hub Comunidade
feedOn && { to: '/feed', label: 'Feed', icon: Newspaper },
{ to: '/atletas', label: 'Atletas', icon: Users },
{ to: '/clubes', label: 'Clubes', icon: Building2 },
!feedOn && { to: '/novidades', label: 'Novidades', icon: Zap },
{ to: '/chat', label: 'Mensagens', icon: MessageSquare },

// BOTTOM_NAV_ITEMS (mobile) — só com a flag ligada
[ Início, Feed, Torneios, Chat, Perfil ]     // "Atletas" sai
```
Com a flag desligada o bottom nav fica **exatamente** como está hoje.

Sino de notificações: o feed alimenta os mesmos `notifications`.

## 3. Wireframes

### 3.1 `/feed` — Timeline
```
┌──────────────────────────────────────────────────────────┐
│ [Para você] [Seguindo] [Descobrir] [Oficial]      [⚙]   │
├──────────────────────────────────────────────────────────┤
│ ┌──────────────────────────────────────────────────────┐ │
│ │ (avatar) O que rolou na quadra?    [📷][🎬][📊][📍]  │ │  composer
│ └──────────────────────────────────────────────────────┘ │
├──────────────────────────────────────────────────────────┤
│              ↑ 12 novas publicações                      │  (flutuante)
├──────────────────────────────────────────────────────────┤
│ ╔══════════════════════════════════════════════════════╗ │
│ ║ 📌 Arena Pickle SP · ✔ · 2h        porque você segue ║ │
│ ║ Sexta tem quadra livre das 18h às 20h!               ║ │
│ ║ [       imagem 4:3 com thumb       ]                 ║ │
│ ║ #arenapicklesp #quadralivre                          ║ │
│ ║ [Reservar]                                           ║ │
│ ║ 🔥 24  💬 6  ↻ 2  🔖        (barra de ação)          ║ │
│ ╚══════════════════════════════════════════════════════╝ │
│ ╔══════════════════════════════════════════════════════╗ │
│ ║ Fernando S. · 4.2 · 5h              você interagiu   ║ │
│ ║ Primeira vitória contra o Pedro! 🏓                  ║ │
│ ║ ┌── placar ──────────────────────┐                   ║ │
│ ║ │ Fernando/Ana   11  11          │  (match_result)   ║ │
│ ║ │ Pedro/Lu        7   9          │                   ║ │
│ ║ └────────────────────────────────┘                   ║ │
│ ╚══════════════════════════════════════════════════════╝ │
│ ╔══════════════════════════════════════════════════════╗ │
│ ║ Torneio de Verão · inscrições abertas   (system)     ║ │
│ ╚══════════════════════════════════════════════════════╝ │
│                    ⋮ scroll infinito                      │
└──────────────────────────────────────────────────────────┘
```

Requisitos de qualidade da timeline:
- **Restauração de scroll** ao voltar de um post (guardar índice + offset).
- `aspect-ratio` reservado em toda mídia → **zero layout shift**.
- Skeleton de 3 cards no primeiro carregamento.
- Paginação de 12; prefetch da página seguinte no 9º card.
- "12 novas publicações" só aparece se o usuário está no topo há > 30s.
- Vídeo: poster estático; toca ao entrar no viewport **mudo** e só se
  `autoplay_video` estiver ligado e a conexão não for `save-data`.

### 3.2 Card do post (`V2FeedPostCard`) — o componente central

Estrutura fixa, conteúdo variável por tipo:
```
[cabeçalho]  avatar · nome · selo · contexto ("Arena X") · tempo · ⋯
[motivo]     "porque você segue Arena Pickle SP"   (só na aba Para você)
[texto]      com menções e hashtags clicáveis
[mídia]      galeria / player / enquete / card de evento / placar / anúncio
[contexto]   chip do torneio/arena/dia de jogo vinculado
[ações]      reagir (long press abre as 5) · comentar · repostar · salvar
[resumo]     "24 reações · 6 comentários" + 2 primeiros comentários
```
Menu `⋯`: copiar link, compartilhar, salvar, não tenho interesse,
silenciar autor, denunciar; se for do próprio: editar, fixar, desativar
comentários, arquivar, excluir, ver métricas.

### 3.3 Composer (`V2FeedComposer`)
```
┌──────────────────────────────────────────────────┐
│ Publicar como: [ (avatar) Eu ▾ ]        [✕]      │   ← seletor de identidade
├──────────────────────────────────────────────────┤
│ O que rolou na quadra?                           │
│                                                  │
│ [miniaturas de mídia, arrastáveis, com ✕]        │
├──────────────────────────────────────────────────┤
│ [📷 Fotos] [🎬 Vídeo] [📊 Enquete] [🔗 Link]     │
│ [📍 Vincular: torneio · arena · dia de jogo]     │
├──────────────────────────────────────────────────┤
│ Quem vê: [Público ▾]     Comentários: [Todos ▾]  │
│ 1.842/2000                    [Rascunho] [Publicar]│
└──────────────────────────────────────────────────┘
```
- Menção `@`: autocomplete sobre atletas seguidos + entidades.
- Hashtag `#`: autocomplete sobre `feed_hashtags` populares.
- Agendar: escondido atrás de "⋯" (não polui o caso comum).
- Autosave em rascunho a cada 5s.
- Pré-visualização exata do card antes de publicar.

### 3.4 `/feed/gerenciar` — Gestão
```
┌───────────────────────────────────────────────────────┐
│ Minhas publicações      Identidade: [Todas ▾]         │
│ [Publicados] [Rascunhos] [Agendados] [Arquivados]     │
├───────────────────────────────────────────────────────┤
│ Alcance 30d: 4.230 · Reações: 312 · Novos seguidores:8│
├───────────────────────────────────────────────────────┤
│ [thumb] "Sexta tem quadra livre..."      2 set        │
│         👁 1.204 · 🔥 24 · 💬 6 · 🔖 3 · ↗ 42 cliques │
│         [Ver] [Editar] [Fixar] [Métricas] [⋯]         │
└───────────────────────────────────────────────────────┘
```

### 3.5 `/feed/gerenciar/identidade/:authorKey` — Painel da entidade
Para arena, clube, professor e loja:
- Desempenho: seguidores (série), alcance, engajamento, melhores posts.
- **Equipe**: quem pode publicar em nome da entidade (derivado de
  `arena_managers` / `club_members` — a tela mostra, não redefine; para
  mudar, manda para a tela canônica de gestores).
- Calendário de publicações (agendadas).
- Comentários recebidos, para moderar num lugar só.

### 3.6 `/feed/p/:postId` — Permalink
Post em destaque + comentários (ordenáveis) + composer de comentário
fixo no rodapé no mobile + posts relacionados do mesmo autor.

## 4. Componentes novos

`src/v2/components/feed/` (~28 componentes)
```
V2FeedTabs.jsx                 abas com estado na URL
V2FeedList.jsx                 lista virtualizada + paginação + restauração
V2FeedPostCard.jsx             ⭐ card, orquestra os renderers
V2FeedPostHeader.jsx           autor, selo, contexto, tempo, menu
V2FeedPostReason.jsx           "porque você segue X"
V2FeedPostText.jsx             tokenizador (menção/hashtag/link) — sem HTML
V2FeedPostActions.jsx          reagir/comentar/repostar/salvar
V2FeedReactionPicker.jsx       long press → 5 reações
V2FeedMediaGallery.jsx         carrossel de fotos com swipe/zoom
V2FeedVideoPlayer.jsx          poster, autoplay mudo condicional, controles
V2FeedPollCard.jsx             enquete + votar + resultado
V2FeedEventCard.jsx            evento/torneio com CTA
V2FeedListingCard.jsx          anúncio do Mercado
V2FeedMatchResultCard.jsx      placar
V2FeedAchievementCard.jsx      selo de conquista
V2FeedAnnouncementCard.jsx     comunicado oficial
V2FeedReshareCard.jsx          post embutido
V2FeedSystemCard.jsx           itens do buildFeed (torneio/procura-jogo)
V2FeedComposer.jsx             ⭐ composer completo
V2FeedIdentityPicker.jsx       trocar identidade
V2FeedMediaPicker.jsx          upload, compressão, ordenar, capa, alt
V2FeedMentionInput.jsx         textarea com @ e #
V2FeedVisibilityPicker.jsx
V2FeedComments.jsx             lista + ordenação + paginação
V2FeedCommentItem.jsx          + 1 nível de resposta
V2FeedCommentComposer.jsx
V2FeedPostMenu.jsx             menu ⋯ com ações por papel
V2FeedEmptyState.jsx           vazios com CTA por aba
V2FeedSuggestions.jsx          "siga estas arenas/professores"
V2FeedReportDialog.jsx         denunciar (compartilhado com docs/18)
```

## 5. Design

- Card com respiro generoso; conteúdo do usuário é o herói, o cromo some.
- Largura máxima de leitura ~620px no desktop, centralizado, com coluna
  lateral de sugestões/trending em telas largas.
- Reações com microanimação curta (respeitar `prefers-reduced-motion` e a
  preferência `reduce_motion`).
- Selo de identidade: cor por tipo (arena, clube, professor, plataforma),
  sempre com **texto**, nunca só cor.
- Post oficial da plataforma: borda `acid` sutil + rótulo "Oficial".
- Post `limited` (sob denúncia): visível só no permalink, com aviso ao autor.
- Toda `V2Dialog`: `max-h-[90dvh] overflow-y-auto`.
- Skeletons que **coincidem** com o layout final (senão o feed "pula").
