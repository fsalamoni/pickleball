# 17.02 — Personas e jornadas do Feed

## 1. Personas

| # | Persona | O que quer publicar | O que quer ver |
|---|---|---|---|
| F1 | **Atleta social** | foto do jogo, resultado, conquista, procura de dupla | o que a turma fez no fim de semana |
| F2 | **Atleta observador** (a maioria) | quase nada | conteúdo bom, sem esforço; reage e comenta |
| F3 | **Dono de arena** | horário livre, promoção, evento, obra, novidade | quem está falando da arena; concorrência |
| F4 | **Professor** | dica técnica, vídeo curto, turma nova, resultado de aluno | alunos e potenciais alunos |
| F5 | **Organizador de torneio** | chamada de inscrição, chaveamento, resultado, foto do pódio | engajamento com o torneio |
| F6 | **Clube** | dia de jogo, ranking interno, confraternização | membros |
| F7 | **Plataforma (admin)** | comunicado, novidade, destaque da semana, regras | saúde do feed |

**Regra dos 90-9-1**: 90% só lê, 9% reage, 1% publica. O feed precisa ser
excelente **para quem só lê** — senão morre. Por isso as fontes automáticas
(torneios, jogos, conquistas) são tão importantes: garantem conteúdo mesmo
com pouca publicação humana.

## 2. Jornadas

### JF1 — Atleta publica foto do jogo (F1)
```
/feed → composer no topo ("O que rolou na quadra?")
  ├─ escreve legenda, marca @parceiro e #torneiodeverao
  ├─ anexa 3 fotos (compressão automática, reordena arrastando)
  ├─ vincula contexto opcional: "Dia de jogo — Arena X" (autocomplete
  │   entre torneios, dias de jogo e arenas que ele frequenta)
  ├─ escolhe visibilidade: Público / Só quem me segue / Meu clube
  └─ [Publicar]  (ou salvar rascunho / agendar)
→ post entra no feed de quem o segue e no "Descobrir" da cidade dele
→ menções geram notificação; @parceiro pode aparecer no post dele também
```
Tempo alvo no celular: **< 30 segundos**.

### JF2 — Arena divulga horário livre (F3)
```
/feed → composer → seletor de identidade: [Eu ▾] → "Arena Pickle SP"
  (só aparecem entidades que o usuário realmente comanda)
  ├─ tipo "anúncio" (announcement) com card visual
  ├─ vincula a arena → o post ganha botão [Reservar]
  ├─ agenda para sexta 18h
  └─ publica como a arena
→ seguidores da arena recebem; aparece na aba "Oficial"
→ métricas: alcance, cliques em "Reservar", novos seguidores
```

### JF3 — Resultado automático (opt-in)
```
Atleta liga em /configuracoes → Feed → "Compartilhar meus resultados"
→ ao lançar um resultado de dia de jogo, um post 'match_result' é
  CRIADO COMO RASCUNHO e o atleta recebe: "Quer publicar?"
  ├─ publica (1 toque)  ou  ├─ edita a legenda  ou  ├─ descarta
```
**Nunca publicar automaticamente sem toque.** Post automático silencioso é
a forma mais rápida de fazer o usuário desconfiar da plataforma.

Mesma mecânica para: subida de nível/rating, conquista desbloqueada,
inscrição em torneio, primeira vitória sobre alguém de nível maior.

### JF4 — Professor publica vídeo de dica (F4)
```
composer → identidade "Prof. Ana" → tipo vídeo
  ├─ grava/seleciona vídeo (limite: 90s, 100MB, mp4/webm)
  ├─ escolhe a capa (frame extraído no cliente)
  ├─ legenda + #dica #saque
  └─ publica
→ card com player nativo, autoplay mudo no viewport, som ao tocar
→ CTA opcional: [Agendar aula] → /coaches/:id
```

### JF5 — Leitor consome (F2) — a jornada mais importante
```
/feed abre em "Para você"
  ├─ cada item mostra por que apareceu ("você segue Arena X")
  ├─ reage com duplo toque ou botão (5 reações)
  ├─ comenta; responde a um comentário (1 nível)
  ├─ salva para depois
  ├─ "não tenho interesse" → menos disso (sinal negativo no ranking)
  └─ puxa para atualizar; "12 posts novos" flutuante no topo
```
Requisitos duros de qualidade:
- primeira renderização com conteúdo em **< 1,5s**;
- scroll infinito com paginação real (12 por página);
- **nunca perder a posição** ao voltar de um post (scroll restoration);
- imagem com `aspect-ratio` reservado → zero layout shift.

### JF6 — Comentário e conversa
Comentários com 1 nível de resposta (não árvore infinita — vira caos).
Ordenação: mais relevantes (reações + respostas) ou mais recentes.
Autor do post pode: fixar 1 comentário, ocultar, remover, bloquear autor,
desativar comentários.

### JF7 — Compartilhar (repost)
Repost com comentário próprio (`reshare_of`). O card original é embutido e
**segue o original**: se o original for removido, o repost mostra
"publicação indisponível". Sem cadeia infinita — repost de repost aponta
para o post raiz.

### JF8 — Hashtag e descoberta
`/feed/tag/:tag` com os posts da hashtag, contagem e "em alta".
"Descobrir": trending da semana, posts com mais engajamento da cidade,
autores sugeridos (arenas e professores que você ainda não segue),
torneios acontecendo.

### JF9 — Compartilhar um anúncio do Mercado (ponte com docs/16)
```
/mercado/anuncio/:id → [Compartilhar] → "Publicar no Feed"
→ post type='listing' com card do anúncio (foto, preço, vendedor)
→ clique volta pro anúncio e conta como impressão no market_listing_stats
```

### JF10 — Gestão das próprias publicações
```
/feed/gerenciar
  ├─ abas: Publicados · Rascunhos · Agendados · Arquivados
  ├─ por post: alcance, reações, comentários, cliques, salvos
  ├─ ações: editar (marca "editado"), fixar, arquivar, excluir,
  │          desativar comentários, republicar
  └─ filtro por identidade (eu / minha arena / meu clube)
```

### JF11 — Moderar o próprio post
Comentário ofensivo → autor do post oculta na hora (efeito imediato para
todos) e, se quiser, denuncia (vai para a fila do admin) e bloqueia.

### JF12 — Denúncia e fila (docs/18)
```
qualquer post/comentário → ⋯ → Denunciar
  ├─ motivo: spam, ofensivo, golpe, nudez, violência, direito autoral,
  │           informação falsa, outro
  ├─ descrição opcional
  └─ envia → content_reports
→ 3 denúncias distintas em 24h ⇒ post entra em 'limited' automaticamente
  (some do "Para você" e do "Descobrir", segue visível no permalink)
  até a decisão do admin — reversível, registrado e comunicado ao autor.
```

### JF13 — Bloquear
Bloquear alguém remove **de tudo**: feed, comentários, menções, chat,
Mercado (não pode comprar de você nem você dele). Simétrico e silencioso
para o bloqueado. Coleção `user_blocks` compartilhada (docs/18).

### JF14 — Desligar a flag
Admin desliga `feed`: `/feed` some, `/novidades` volta ao comportamento
atual, composer some, nenhuma leitura nova acontece, dados intactos.

## 3. Estados vazios

| Tela | Estado | CTA |
|---|---|---|
| Para você (usuário novo) | não segue ninguém | sugestões de arenas/professores/atletas do clube e da cidade + "Siga 5 para começar" |
| Seguindo | segue, mas ninguém postou | "Veja o que está em alta" |
| Descobrir | cidade sem conteúdo | ampliar para o estado/Brasil |
| Perfil sem posts | — | "Publique o primeiro" (se for o próprio) |
| Hashtag vazia | — | "Seja o primeiro a usar #x" |
| Comentários | nenhum | "Comece a conversa" |
| Salvos | nenhum | explica como salvar |

## 4. Anti-padrões a evitar (aprendidos de feeds ruins)

- ❌ Feed que recarrega e perde a posição ao voltar de um post.
- ❌ Ranking que esconde o post do amigo por 3 dias.
- ❌ Notificação de tudo (vira ruído e a pessoa desliga todas).
- ❌ Autoplay com som.
- ❌ Composer escondido atrás de 2 cliques.
- ❌ Comentário em árvore infinita.
- ❌ Post automático que a pessoa não autorizou.
- ❌ Contador de seguidores como métrica principal (vira competição vazia).
