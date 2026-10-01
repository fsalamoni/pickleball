# 36 — Notificações: o sino que rola e a central com os avisos antigos

> Uma onda sobre as notificações. A correção do sino vale para todos; a central
> de notificações nasce atrás da flag `notifications_center` (padrão OFF).
> **Banco: zero** — nenhuma coleção, campo, índice ou regra. A central lê a
> mesma consulta do sino, e marcar lida ou não lida usa os campos de sempre
> (`read`, `read_at`), que a regra já deixa o dono escrever.

## O pedido

*"Não há rolagem suficiente para ver todas as notificações que existem ou um
ambiente para ver notificações passadas. Eu preciso que você faça todos os
ajustes necessários e pertinentes para lidar com as notificações dos
usuários."*

## 1. 🐞 O sino escondia a maior parte dos avisos

A caixa do sino (`DropdownMenuContent`) tinha `overflow-hidden` e **nenhuma
altura máxima**: crescia com a lista e passava do fim da tela. Medido no
navegador, com 46 avisos numa tela de 900 px: a caixa tinha **2.858 px** de
altura, sem rolagem — só os primeiros avisos eram alcançáveis. E não existia
nenhum outro lugar para ver os antigos.

Agora (`v2/components/notifications/NotificationsBell.jsx`):

- a caixa cabe no espaço que sobra abaixo do botão
  (`max-height: min(36rem, var(--radix-dropdown-menu-content-available-height))`),
  com o cabeçalho e o rodapé presos e **só a lista rolando**;
- cada aviso tem o ícone da sua ÁREA, a hora ("há 5 min", "ontem, 14:05",
  "seg, 18:00", "02/08") e o texto inteiro (título em 2 linhas, mensagem em 3);
- o selo vira **99+** (um círculo de 16 px não cabe "137") e o nome acessível
  diz a contagem por extenso ("Notificações (5 não lidas)");
- **carregando** mostra esqueleto, e **falha** diz que falhou com "Tentar de
  novo" — antes as duas viravam "Nenhuma notificação";
- o rodapé tem a engrenagem das **preferências** (`/configuracoes#notificacoes`).

Sem a flag, o sino mostra a lista INTEIRA, agora com rolagem — nada fica
inalcançável.

## 2. A central de notificações (`/notificacoes`, flag `notifications_center`)

Com a flag, o sino mostra os **20 mais novos** e o rodapé leva a todos —
"Mais 26 avisos · 9 não lidas", porque o selo conta avisos que podem não estar
no sino. A página (`v2/pages/V2Notifications.jsx`):

- **agrupa por dia**: Hoje, Ontem, Nos últimos 7 dias e, daí para trás, um
  grupo por mês ("Agosto de 2026");
- **filtra** por "Não lidas", pela **área** (jogos, torneios, arenas, clubes,
  aulas, mensagens, promoções, conta — só as que têm aviso) e por **busca** no
  texto (sem acento, vários termos estreitam). No celular a área é uma lista de
  seleção: nove botões ocupariam cinco linhas antes do primeiro aviso;
- os **filtros moram na URL** (`?filtro=nao-lidas&area=torneios&q=…`): abrir um
  aviso e voltar devolve a pessoa exatamente onde estava;
- **marca como lida e como NÃO lida** (para lembrar de voltar num aviso) e
  todas de uma vez;
- mostra **30 por vez**, com "Mostrar mais";
- **diz o que está silenciado**: "Você silenciou Mensagens e fórum: 3
  notificações dessas categorias não aparecem aqui nem no sino", com "Mostrar
  também" (e cada uma marcada "Silenciada") e "Ajustar" — senão "não recebi o
  aviso" vira chamado de suporte para algo que a própria pessoa desligou;
- "Notificações" também no **menu do avatar** e na **gaveta do celular**, com o
  número de não lidas.

## 3. A área de cada aviso — sem nada novo no banco

Quase todo aviso da plataforma é gravado como `generic` (arenas, dia de jogo,
aulas, campanhas…), então o TIPO sozinho não diz de onde ele vem. A área sai do
tipo quando ele é específico (`chat_*`, `club_*`, `tournament_*`, `partner_*`,
`profile_*`) e, senão, do **destino** do aviso (`link`):

| destino | área |
|---|---|
| `/dia-de-jogo`, `/procura-jogo`, `/arenas/:id/open-match`, `/meus-jogos`, `/ranking` | Jogos |
| `/torneios`, `/p/:id`, `/arenas/:id/torneios`, `/perfil/torneios` | Torneios |
| `/arenas/…`, `/minhas-reservas`, **toda** `/arenas/:id/gerir…` | Arenas e reservas |
| `/clubes`, `/c/:id` | Clubes |
| `/aulas`, `/minhas-aulas`, `/coaches`, `/arenas/:id/aulas` | Aulas |
| `/chat`, `/atleta/:uid`, `/novidades` | Mensagens e comunidade |
| `/campanhas`, `/promocoes`, `/arenas/:id/campanhas/:cid` | Promoções e campanhas |
| `/perfil`, `/configuracoes`, `/nivelamento` | Sua conta |
| sem pista | Outros avisos |

Fonte única: `noticeArea` (`modules/notifications/domain/noticeFeed.js`). A
gestão da arena (`/gerir…`) fica em Arenas mesmo quando o assunto é aula ou dia
de jogo — é o trabalho de quem cuida da arena.

## 4. Uma escuta só, compartilhada

`useNotifications` abria uma escuta (`onSnapshot`) **por componente**: com o
sino e o início orientado a ação na tela, a mesma lista era lida duas vezes do
banco a cada abertura do app — e a central seria a terceira. Agora é **uma
assinatura por usuário** (`useSyncExternalStore`), compartilhada pelo sino, pelo
menu do avatar, pela gaveta, pelo início e pela central. Ela nasce com o
primeiro que pede e é encerrada 2 s depois de o último sair (trocar de tela não
religa). A consulta é a de sempre — `user_id == uid`, sem `orderBy` (que pediria
índice composto) — e a ordem é feita em memória (`sortNotices`).

A hora de cada aviso sai de `noticeTime`: o `created_at` do servidor (lido por
`instanteEmMs`, nunca `Number()`), e na falta dele o `created_at_ms` do cliente —
logo depois de criado, o `serverTimestamp` ainda é `null`, e aviso gravado pelo
servidor não tem `created_at_ms`. Aviso sem data vai para o fim, nunca para o
topo fingindo ser novo.

## 5. O que mais mudou junto

- **Início orientado a ação** (`action_home`): "Pendências" dizia "Nada
  pendente" com os avisos carregando ou falhando — agora espera, e na falha diz
  que falhou. O número é o total de não lidas (era o tamanho do recorte, 4), e
  há "Ver todas" com a central.
- **Configurações → Notificações** ganhou âncora (`#notificacoes`), o texto diz
  o que silenciar faz (some do sino e do número) e, com a central, "Ver todas as
  notificações".
- **Ajuda**: o artigo "Notificações" foi refeito (a lista rola, marcar todas, a
  engrenagem); artigo novo "Ver as notificações antigas" (só com a flag); "Ajuda
  para esta tela" em `/notificacoes`; dois pontos de dica na central.
- **🐞 Testes que dependiam da hora**: quatro testes de progressão montavam o
  mês do *grace* pelo fuso da máquina, e o código o conta no fuso do Brasil.
  Entre 0h e 3h UTC do dia 1º os dois discordavam e os testes reprovavam (na
  `main` também). Agora usam a mesma régua, e um teste trava a virada.

## 6. O que NÃO mudou (e por quê)

- **Ninguém apaga aviso.** A regra só deixa o admin da plataforma apagar
  `notifications`, e abrir isso é mexer em regra. Para tirar do caminho,
  "marcar como lida".
- **A consulta continua trazendo tudo.** Paginar no servidor
  (`orderBy('created_at') + limit`) pediria um índice composto
  `notifications[user_id, created_at]` — mexer no banco. A paginação é na TELA
  (30 por vez); a leitura é a mesma que o sino sempre fez.
- **O campo `archived`** que a função agendada `expireStaleNotifications`
  grava em avisos não lidos com mais de 7 dias **não é lido** pela tela, como
  nunca foi: esconder agora mudaria o número de não lidas de todo mundo e
  sumiria com convites que ainda pedem resposta. (A consulta daquela função —
  `created_at <` + `read ==` — também pediria índice composto; ver o backlog.)
- **Silenciar campanhas** de arenas, da plataforma e de professores não existe:
  elas são gravadas como `generic`, sem marca própria, e as categorias de
  preferência são por tipo. Ver o backlog.

## Código

- Domínio: `modules/notifications/domain/noticeFeed.js` (área, hora, ordem,
  grupos, filtros, selo, recorte do sino, filtros na URL) e
  `preferences.js` (`mutedNotificationsSummary`).
- Hook: `modules/notifications/hooks/useNotifications.js` (assinatura única;
  `markAsUnread`; `allNotifications` e `muted`).
- Telas: `v2/components/notifications/` (`NotificationsBell`, `noticeParts`),
  `v2/pages/V2Notifications.jsx`, `V2Layout` (menu do avatar e gaveta),
  `V2Settings`, `V2ActionHome`.
- Testes: `noticeFeed.test.js`, `useNotifications.test.jsx`,
  `NotificationsBell.runtime.test.jsx`, `V2Notifications.runtime.test.jsx`.
