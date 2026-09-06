# 17.01 — Visão e escopo do Feed

## 1. O problema

A comunidade de pickleball no Brasil vive em grupos de WhatsApp e no
Instagram. O PickleRush já tem **quem joga, onde joga, com quem joga e o
resultado** — mas a conversa sobre isso acontece fora.

Consequências:
1. **O conteúdo se perde.** A foto do torneio de domingo some no story.
2. **Arena e professor não têm canal próprio.** Divulgam no Instagram e
   competem com todo o resto da internet pela atenção de quem já é cliente.
3. **A plataforma não tem motivo de retorno diário.** Torneio é mensal,
   reserva é semanal. Feed é diário.
4. **A conquista não circula.** O atleta subiu de 3.5 para 4.0 e ninguém vê.
5. **O Mercado (docs/16) nasceria sem tráfego.** Feed é o motor de
   descoberta natural de anúncio.

## 2. A proposta

Um feed onde o conteúdo **nasce do que já acontece na plataforma**:

- resultado de jogo, evolução de rating, conquista, inscrição em torneio →
  viram post automático **com consentimento** do atleta;
- arena publica horário livre, promoção, evento, obra na quadra;
- professor publica dica técnica, vídeo curto, turma nova;
- atleta publica foto, vídeo, pergunta, procura de dupla;
- plataforma publica comunicado, novidade, destaque da semana.

O diferencial contra o Instagram não é volume — é **relevância absoluta**:
100% do feed é pickleball, e cada post carrega contexto real (quem é o
autor no ranking, em que arena joga, qual clube).

> "O Feed é a praça da comunidade: o que aconteceu, o que vai acontecer, e
> quem está fazendo acontecer."

## 3. Objetivos

| # | Objetivo | Métrica | Meta 90 dias |
|---|---|---|---|
| O1 | Dar motivo de retorno diário | DAU/MAU | > 25% |
| O2 | Fazer publicar | % de usuários que postaram no mês | > 15% |
| O3 | Fazer interagir | reações + comentários por post ativo | > 4 |
| O4 | Canal para arena/professor | posts de entidades / total | > 25% |
| O5 | Alimentar o Mercado | cliques do feed para anúncios | > 20% do tráfego do Mercado |
| O6 | Manter saudável | denúncias procedentes / posts | < 1% |
| O7 | Não virar deserto | % de posts com ao menos 1 interação | > 60% |

## 4. Não-objetivos (escopo NEGATIVO)

- ❌ **Stories / conteúdo efêmero.** Custo alto, valor duvidoso num
  público de nicho. Não entra.
- ❌ **Mensagem direta nova.** O `chat/` já existe. O Feed **linka** para
  o chat, não cria outro inbox.
- ❌ **Live / streaming.** Fora. Se um dia, é embed de YouTube/Twitch.
- ❌ **Algoritmo opaco.** O "Para você" precisa ser explicável ("você vê
  isto porque segue X"). Sempre com aba cronológica pura ao lado.
- ❌ **Anúncio pago no feed (ads).** Fase 4, no máximo, e sempre rotulado.
- ❌ **Feed público sem login na Fase 1.** SEO de post é Onda W.
- ❌ **Transcodificação de vídeo própria.** Fase 1 aceita o que o
  navegador grava/tem, com limite duro. Ver `08-MIDIA`.
- ❌ **Edição de vídeo, filtros, stickers.** Não somos editor de mídia.
- ❌ **Substituir o fórum do clube.** `club_forum_threads` continua sendo
  o espaço de discussão longa e privada do clube. Feed é a praça pública.

## 5. Escopo POSITIVO da Fase 1

### Público (leitor)
- `/feed` com 4 abas: **Para você** · **Seguindo** · **Descobrir** ·
  **Oficial**.
- Filtro por tipo de post e por hashtag.
- Post com: texto, 1-10 fotos, vídeo curto, enquete, link para
  torneio/arena/clube/anúncio, resultado/conquista automáticos.
- Reações (5 tipos), comentários com 1 nível de resposta, salvar,
  compartilhar (repost com comentário, e link externo).
- Menções `@` e hashtags `#`.
- Página do post (`/feed/p/:id`) — permalink com comentários.
- Perfil com aba de posts (atleta, arena, professor, clube).
- Seguir pessoas **e entidades** (arena, clube, professor, loja).
- Silenciar, bloquear, denunciar, "não tenho interesse".
- Notificações de reação, comentário, menção, novo post de quem sigo.

### Gestão (autor)
- Composer completo com rascunho e pré-visualização.
- **Trocar de identidade** ao publicar (eu / minha arena / meu clube /
  meu perfil de professor / plataforma se admin).
- Agendar publicação.
- Gerenciar publicações: lista, editar (com marca de editado), fixar no
  perfil, arquivar, excluir.
- Métricas por post: alcance, impressões, reações, comentários, cliques,
  salvamentos, novos seguidores atribuídos.
- Moderar os comentários dos próprios posts: ocultar, remover, bloquear
  autor, desativar comentários, restringir a seguidores.
- Painel da entidade (arena/clube/professor): quem pode publicar em nome
  dela, calendário de publicações, desempenho.

### Admin
- Configuração global (tipos permitidos por tipo de autor, limites de
  mídia, tamanho de vídeo, rate limits, hashtags bloqueadas).
- Fila de moderação unificada (docs/18).
- Post oficial fixado no topo, agendamento de comunicado.
- Métricas de saúde do feed.

## 6. Princípios de desenho

1. **Flag mestra `feed`, default OFF.** Sem ela, `/feed` não existe e
   `/novidades` fica exatamente como hoje.
2. **Aditividade absoluta.** `follows`, `club_posts`,
   `club_forum_threads` e `social/domain/feed.js` não mudam de shape.
3. **Ranking em `domain/` puro e testado.** O algoritmo é uma função
   pura de `(candidatos, contexto) → ordenado + explain`.
4. **Sempre explicável.** Todo item do "Para você" carrega um motivo
   legível: "porque você segue a Arena X".
5. **Cronológico sempre disponível.** A aba "Seguindo" nunca é ranqueada.
6. **Post automático só com consentimento.** Compartilhar resultado ou
   conquista é opt-in nas configurações, nunca padrão silencioso.
7. **Moderação desde o dia 1.** Denúncia, bloqueio e fila existem no
   mesmo PR em que o comentário existe — não depois.
8. **pt-BR em tudo.** Auditoria em ação de moderação.

## 7. Fases

| Fase | Conteúdo | Gatilho |
|---|---|---|
| 1 | Tudo do §5 (leitura client-side, feed calculado no cliente) | agora |
| 2 | Fan-out no servidor (`feed_timelines`), preview de link, tradução de legenda | > 500 posts/dia ou latência > 1,5s |
| 3 | Vídeo com transcodificação (Mux/Cloudflare Stream), legendas automáticas | > 30% de posts com vídeo |
| 4 | Conteúdo patrocinado rotulado, criadores destacados, monetização | demanda comercial real |
| 5 | Feed público sem login + SEO/OG por post | decisão sobre exposição pública |

## 8. Critério de "pronto" da Onda V

- [ ] Um atleta publica foto com legenda em < 30s no celular.
- [ ] Um dono de arena publica **como a arena** e os seguidores veem.
- [ ] O "Para você" traz conteúdo relevante e diz **por quê** em cada item.
- [ ] Comentário, reação, menção e resposta funcionam com notificação.
- [ ] Denunciar um post leva à fila do admin, que remove com motivo.
- [ ] Bloquear alguém o remove do feed, dos comentários e do chat.
- [ ] Um resultado de jogo vira post **só** se o atleta autorizou.
- [ ] Desligar a flag `feed` devolve a plataforma ao estado atual, com
      `/novidades` funcionando como hoje.
- [ ] Lint 0, build limpo, ~520 testes novos verdes.
