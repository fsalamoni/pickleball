# 17 — FEED (Rede social do PickleRush)

> **Status: 📐 PLANEJADO — nada implementado.** Este diretório é o desenho
> completo. Nenhuma linha de código, regra, coleção ou flag foi criada.

## O que é

Uma **rede social de pickleball dentro do PickleRush** — a referência mental
é o **Instagram**: uma página interna com **rolagem infinita** por onde
passam fotos, vídeos e postagens de usuários, arenas, lojas, professores e
da própria plataforma.

> **Esclarecimento do dono da plataforma (set/2026)**: "para ser muito maior
> do que é hoje, como um Instagram próprio de pickleball dentro da
> plataforma, com rolagem infinita em que passam fotos, vídeos e postagens
> de usuários, arenas, lojas, professores e da própria plataforma. uma
> página interna que funcione exatamente como o Instagram."

O que isso implica, concretamente, e que os documentos abaixo tratam:

| Característica do Instagram | Onde está tratada |
|---|---|
| Rolagem infinita fluida | `06-UX` §3.1 (paginação, prefetch, restauração de scroll, zero layout shift) |
| Mídia em primeiro lugar (foto/vídeo) | `08-MIDIA` (pipeline de compressão, thumb, vídeo, custo) |
| Feed algorítmico + cronológico | `07-RANKING` (score puro, explicável, com aba cronológica sempre) |
| Perfis com grade de publicações | `06-UX` §1 (`/feed/a/:authorKey`) e `10-INTEGRACOES` §12 |
| Contas de entidade (arena, loja, professor) | `03-TIPOS-DE-POST-E-IDENTIDADES` §2 |
| Seguir, reagir, comentar, salvar, compartilhar | `03` §5-§6, `04-DATA-MODEL` |
| Hashtags e descoberta | `07-RANKING` §5 |
| Denúncia, bloqueio, silenciar | `docs/FUTURO/CONFIANCA-E-MODERACAO/` |

**O que deliberadamente NÃO copia do Instagram**: stories, DM paralela ao
chat que já existe, live, filtros/edição de mídia, e ranking opaco. Os
motivos estão em `01-VISAO-E-ESCOPO.md` §4.

---

São dois ambientes plenos:

- **Ambiente público (leitor)** — timeline personalizada, descobrir,
  hashtags, perfis, comentários, reações, compartilhamento, busca.
- **Ambiente de gestão (autor)** — composer, rascunhos, agendamento,
  gestão de publicações, identidades (postar como arena/clube/professor/
  plataforma), métricas de alcance, moderação dos próprios comentários.

Publicam: **atletas**, **arenas**, **professores**, **clubes**,
**organizadores de torneio**, **lojas** e a **plataforma**.

## ⚠ Relação com `/novidades` (o que existe hoje)

Hoje existe `V2Community` na rota `/novidades`: um **feed automático de
sistema** que normaliza torneios públicos e convites de "procura-se jogo"
(`social/domain/feed.js` → `buildFeed`). Não tem post de usuário, reação,
comentário nem mídia.

**Decisão de arquitetura**: o Feed novo **absorve** esse feed em vez de
competir com ele.

- `buildFeed` continua existindo e vira **uma das fontes** do novo feed
  (itens do tipo `system`), preservado e testado.
- A rota `/novidades` passa a **redirecionar** para `/feed` quando a flag
  `feed` está ligada; com a flag desligada, `/novidades` segue exatamente
  como está hoje. Zero regressão.
- O módulo novo é `src/modules/feed/`. O módulo `social/` **permanece**
  com follows, metas e busca global — não é renomeado nem esvaziado.

## Mapa dos documentos

| Doc | Conteúdo |
|---|---|
| `01-VISAO-E-ESCOPO.md` | Problema, objetivos, não-objetivos, métricas, fases |
| `02-PERSONAS-E-JORNADAS.md` | 7 personas, 14 jornadas, estados vazios |
| `03-TIPOS-DE-POST-E-IDENTIDADES.md` | 11 tipos de post, identidades de autor, visibilidade, permissões |
| `04-DATA-MODEL.md` | 15 coleções `feed_*`, schema, índices |
| `05-REGRAS-FIRESTORE.md` | Regras aditivas, helpers, matriz, testes |
| `06-UX-ROTAS-E-TELAS.md` | 12 rotas, componentes, wireframes |
| `07-RANKING-E-DESCOBERTA.md` | Algoritmo do "Para você", hashtags, trending, anti-bolha |
| `08-MIDIA-FOTO-VIDEO.md` | Upload, compressão, vídeo, limites, custo, Storage rules |
| `09-ADMIN-E-CONFIGURACOES.md` | Seção admin, configurações, flags |
| `10-INTEGRACOES.md` | Torneio, arena, clube, mercado, gamificação, chat, push |
| `11-PLANO-DE-DESENVOLVIMENTO.md` | 9 PRs da Onda V, aceite, estimativas |
| `12-TESTES-E-QUALIDADE.md` | Plano de testes |
| `13-RISCOS-LEGAL-E-CUSTO.md` | Marco Civil, ECA, direito autoral, custo de vídeo |

## Documentos irmãos
- `docs/FUTURO/MERCADO/` — o marketplace.
- `docs/FUTURO/CONFIANCA-E-MODERACAO/` — moderação, denúncias, bloqueio,
  strikes: **infra compartilhada**, leia antes de duplicar qualquer coisa.
- `docs/FUTURO/PLANO-MESTRE-MERCADO-FEED.md` — cronograma consolidado.
