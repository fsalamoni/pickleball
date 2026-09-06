# 17.13 — Riscos, aspectos legais e custo do Feed

> Levantamento técnico do que precisa de revisão jurídica antes do
> lançamento público. Não é parecer.

## 1. Marco Civil da Internet (Lei 12.965/14)

- **Art. 19**: a plataforma só responde civilmente por conteúdo de terceiro
  se, **após ordem judicial específica**, não remover. Isso protege o feed
  — desde que exista canal de denúncia funcionando e o processo seja
  registrado.
- **Art. 21** (exceção): conteúdo de nudez ou ato sexual privado precisa
  ser removido **por notificação extrajudicial** do participante, sem
  ordem judicial. Isso exige um caminho de denúncia **prioritário** para
  esse motivo específico — a fila precisa tratar `nudity_private` como
  urgência máxima, com SLA declarado.
- **Art. 15**: guarda de registros de acesso a aplicação por **6 meses**.
  Hoje o projeto não guarda IP. Para o feed, registrar em `audit_logs` ao
  menos uid + ação + timestamp + user-agent nas publicações; IP exige uma
  Cloud Function (o cliente não o enxerga).

## 2. ECA e menores de idade

- A plataforma tem atletas menores (pickleball infantil, aula de professor).
- **Riscos**: foto de criança publicada por terceiro; contato de adulto com
  menor; exposição de localização por EXIF (resolvido em `08-MIDIA §4`).
- **Posição do produto**:
  - idade mínima para ter conta: seguir o que os Termos gerais já definem;
  - perfil de menor: sem publicação pública por padrão (visibilidade
    `followers` como default), configurável pelo responsável;
  - denúncia de conteúdo envolvendo menor tem prioridade máxima na fila;
  - remoção de EXIF sempre;
  - proibir publicação de foto de menor identificável por terceiro sem
    autorização — regra nas Diretrizes de Comunidade, aplicada por denúncia.
- **Isto precisa de decisão humana explícita antes do V2.**

## 3. Direito autoral (Lei 9.610/98)

- Foto e vídeo publicados por usuários podem ser de terceiros (foto de
  fotógrafo de torneio, música de fundo em vídeo).
- **Posição**: nas Diretrizes de Comunidade, o usuário declara ter direito
  sobre o que publica; motivo de denúncia "direito autoral" existe;
  remoção por notificação do titular (procedimento de notice-and-takedown
  documentado, com contranotificação).
- **Música em vídeo**: risco real e conhecido. Aviso no composer de vídeo.

## 4. LGPD

| Dado | Cuidado |
|---|---|
| Post público | conteúdo do titular, publicado por escolha dele; a política precisa dizer que é público e indexável (quando houver SEO) |
| Menções | expõem terceiros; permitir "remover minha menção" |
| Foto de terceiro | direito de imagem; canal de denúncia + remoção |
| Localização (cidade) | derivada do perfil, já pública hoje |
| EXIF/GPS | **removido sempre** |
| Histórico de interação (afinidade) | usado para ranking; declarar na política; permitir desligar o ranking (aba cronológica) |
| Exclusão de conta | posts anonimizados ou removidos, conforme escolha; comentários viram "Usuário removido" |

Direito de oposição ao tratamento automatizado: a aba "Seguindo"
cronológica **é** a alternativa ao ranking. Isso não é só produto — é
argumento de conformidade.

## 5. Conteúdo problemático — política mínima

Motivos de denúncia (`content_reports.reason`):
```
spam · assedio_ou_odio · nudez_ou_sexual · nudez_privada_de_mim (⚠ art.21)
violencia · golpe_ou_fraude · desinformacao · direito_autoral
uso_indevido_de_imagem · conteudo_envolvendo_menor (⚠ prioridade máxima)
fora_do_tema · outro
```

SLA proposto:
| Gravidade | Motivos | Prazo |
|---|---|---|
| Crítica | nudez privada, menor, ameaça | 4h |
| Alta | assédio, golpe, nudez | 24h |
| Média | direito autoral, desinformação, imagem | 72h |
| Baixa | spam, fora do tema | 7 dias |

Um SLA que não se cumpre é pior que nenhum. Dimensionar pelo que a equipe
realmente consegue: enquanto for uma pessoa, limitar o volume de conteúdo
(rate limits mais apertados) em vez de prometer prazo curto.

## 6. Riscos de produto

| # | Risco | Impacto | Mitigação |
|---|---|---|---|
| RF1 | Feed vazio (ninguém publica) | mata a feature | fontes `system` desde o dia 1; semear com arenas/professores; opt-in de resultado |
| RF2 | Feed virar ruído | usuários abandonam | diversidade, limites de publicação, ranking com qualidade |
| RF3 | Notificação demais | usuário desliga tudo | agrupamento obrigatório, "novos posts" off por padrão |
| RF4 | Moderação insuficiente | conteúdo tóxico, risco legal | auto-moderação, auto-limitação, fila priorizada, rate limits |
| RF5 | Custo de vídeo | conta cara | flag por último, limites, medir, Fase 3 com Mux |
| RF6 | Performance ruim no celular | abandono | paginação, thumb, virtualização, orçamento de performance em CI |
| RF7 | Bolha / injustiça algorítmica | percepção de manipulação | explicabilidade + cota de descoberta + aba cronológica |
| RF8 | Conflito na comunidade (briga em comentário) | clima ruim | desativar comentários, restringir a seguidores, bloqueio, moderação do autor |
| RF9 | Vazamento de imagem restrita pela URL | privacidade | documentar honestamente; endurecer na Fase 2 |
| RF10 | Concorrer com o Instagram e perder | esforço desperdiçado | não competir em volume; competir em contexto — 100% pickleball, com dados que o Instagram não tem |

## 7. Custo

Com 3.000 MAU e 200 posts/dia (ver `04-DATA-MODEL`):

| Item | Mensal |
|---|---|
| Firestore | ~US$ 4 |
| Storage | ~US$ 0,6 (acumulando) |
| Egress de imagem (com thumb) | ~US$ 17 |
| **Egress de vídeo** | **~US$ 60** ⚠ |
| Cloud Functions (11) | ~US$ 3 |
| **Total com vídeo** | **~US$ 85/mês** |
| **Total sem vídeo** | **~US$ 25/mês** |

**O vídeo custa 3× todo o resto do feed.** Por isso `feed_video` é a
última flag a ligar e a primeira a desligar se o custo escapar. Alertas de
budget: US$ 50, US$ 100, US$ 200.

Custo somado Mercado + Feed com tudo ligado: **~US$ 130/mês**. Com as
mitigações de imagem/vídeo aplicadas: **~US$ 60/mês**.

## 8. Decisões humanas necessárias antes de codar

1. **Menores**: visibilidade padrão de perfil de menor? Quem responde?
2. **Vídeo**: entra na Fase 1 ou espera? (recomendação: entra **por
   último**, com limites duros)
3. **Quem opera a fila de moderação** e com que SLA realista?
4. **Diretrizes de Comunidade**: quem redige?
5. **Feed público sem login** (SEO): sim ou não? (recomendação: **não** na
   Fase 1)
6. **Ranking ligado no lançamento** ou começa cronológico? (recomendação:
   **cronológico** por 2 semanas, medir, depois ligar o ranking e comparar)
7. **Auto-share de resultado**: opt-in confirmado? (recomendação: **sim**,
   sempre, sem exceção)
