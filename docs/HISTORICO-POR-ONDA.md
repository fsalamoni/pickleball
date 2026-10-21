# Histórico por onda

> Movido do `CLAUDE.md` §10 em 2026-10-15 para o guia-mestre caber numa leitura.
> **Isto é história, não estado atual**: os números e as flags citados aqui são
> os da época (muitas flags "default OFF" daqui viraram código permanente em
> 2026-10-10). O estado atual é [`46-INVENTARIO.md`](./46-INVENTARIO.md),
> gerado do código; o mapa é [`00-INDEX.md`](./00-INDEX.md).
>
> Vale ler para entender **por que** uma regra existe: cada onda registra o
> defeito real que a motivou e a armadilha que ensinou.

## Registro histórico (snapshot de 2026-09-28; ondas posteriores estão em `docs/` e no `git log`)

> Última atualização: 2026-10-21 (Federações, PR 4: notícias com aviso aos filiados só pelo servidor, patrocinadores, governança, a federação como emissora de cupons e campanhas, loja oficial no Mercado e card Federação no início — ver `docs/50-FEDERACAO.md` §6.7). Antes: 2026-10-18 (Federações, PR 3: secretaria — CPF por regra da federação e responsável do menor em `private/data`, dependentes, documentos no Storage lidos pela secretaria por função, transferências de clube/federação com liberação automática, importação de filiados —, cursos com credencial verificável pelo mesmo código da carteirinha e disciplina/ouvidoria com suspensão imposta na regra da inscrição — ver `docs/50-FEDERACAO.md` §6.4–6.6). Antes: 2026-10-18 (Federações, PR 2: clubes e arenas filiados, chancela de torneios com "só filiados" imposto na regra da inscrição, envio da colocação do pódio e ranking oficial derivado pelo servidor — ver `docs/50-FEDERACAO.md` §6.1–6.3). Antes: 2026-10-18 (Federações: abertura aprovada pelo admin, planos mensais/anuais, filiação e cobrança Pix só pelo servidor, carteirinha digital com verificação pública, Central com 8 papéis — atrás de `federations`, ver `docs/50-FEDERACAO.md`). Antes: 2026-10-12 (Troféus e cartões de campeões — ver `docs/43-TROFEUS-E-CARTOES.md`). Antes: 2026-10-10 (Balanço do jogo, atrás de `game_debrief` e ligado por cada pessoa — ver `docs/42-BALANCO-DO-JOGO.md`). Antes: 2026-10-09 (Centro de Treino, atrás de `training_center`, e Minha área, atrás de `user_hub` — ver `docs/40-CENTRO-DE-TREINO.md` e `docs/41-MINHA-AREA.md`). Antes: 2026-10-07 (Grupos dentro do Play, atrás de `play_groups` — ver `docs/39-PLAY-GRUPOS.md`). Antes: 2026-10-02 (Gamificação V2: a sequência honesta, o guia, as dicas e a ajuda completos — ver `docs/38-GAMIFICACAO-V2.md`). Antes: 2026-10-02 (Gamificação V2 completa atrás de `gamification_v2`). Antes: 2026-10-02 (Cloud Functions do Node.js 20, desligado
> em 2026-10-31, para o Node.js 22). Antes: 2026-10-02 (conta excluída fora do ranking e a
> unificação do histórico na conta que ficou). Antes: 2026-10-02 (ranking, rating e contagem de jogos: o
> perfil conta os dias de jogo, o convidado sem conta ficou visível e
> vinculável, e o servidor diz o que deixou de fora). Antes: 2026-10-01
> (torneio: o meu torneio no início, check-in
> que não trava, 2 turnos e o Americano aprimorado em etapas). Antes:
> 2026-10-01 (notificações: o sino que rola e a central
> com os avisos antigos). Antes: 2026-09-30 (o "Jogar" abre no Dia de jogo, os dias do
> clube e o botão de entrar em todo lugar). Antes: 2026-09-30 (o "Jogar" com os
> dias de jogo das arenas + Minha região). Antes: 2026-09-30 (estoque que diz o que há para vender +
> cadastro essencial). Antes: 2026-09-30 (varredura da plataforma). Antes: 2026-09-27 (Onda CJ — dicas guiadas); Onda CI (início sob medida); Onda CH (modo escuro); revisão da Onda CG; 2026-09-20 (Onda AT); 2026-08-31, após **41 PRs
> novos** mergeados em main (#95 a #135) — Sprints 32 a 50+.
> Detalhes em `docs/08-ARENA-ROADMAP.md` (Seções 34-50) e
> memory topic `picklerush-sync-2026-08.md`.
>
> **Destaques por onda**:
>
> - **Federações, PR 4** (2026-10-21): a **comunicação** e quatro módulos.
>   **Notícias** (`news`, `federation_news`): a equipe de comunicação escreve
>   pelo cliente, pública ou "só filiados" (conferido na regra), e o **aviso**
>   aos filiados ativos é do servidor (`federationNews`), uma vez só
>   (`notified_at`, que a regra recusa ao cliente). **Patrocinadores**
>   (`sponsors`, ≤ 12, também na carteirinha) e **governança** (estatuto,
>   mandato, diretoria, atas — não é módulo) em campos opcionais da própria
>   federação. **Cupons e campanhas** (`promos`): a federação virou o terceiro
>   emissor do `promo/`, com "só filiados" e sem aviso de campanha (o canal é
>   a notícia). **Loja oficial** (`store`): vendedor `federation_{id}` no
>   Mercado, operado por `admin`/`finance`. Card **Federação** no início, só
>   com a flag. Lição: quem opera a loja é uma pergunta feita em três lugares
>   (regra, servidor, tela) — as três respostas têm de bater, e o teste prova
>   cada uma.
> - **Federações, PR 3** (2026-10-18): a **secretaria** e dois módulos.
>   Dado pessoal do filiado (CPF, só se a federação pede; nascimento;
>   responsável) vai para `federation_members/{id}/private/data`, nunca para
>   o documento da filiação; **menor de 12 só entra como dependente** da conta
>   do responsável (`user_id` nulo + `guardian_uid`, `fedMemberOwner` na
>   regra), que paga por ele. **Documentos** exigidos pelo plano ficam no
>   Storage do dono (`federacao/{uid}/`) e chegam à secretaria por função —
>   a regra do Storage não consulta o banco `pickleball`. **Transferência**:
>   a federação atual libera, e o silêncio no prazo libera pela varredura; os
>   pontos ficam onde foram feitos. **Importação** de até 500 linhas: quem
>   tem conta vira filiado ativo, quem não tem fica numa lista só da equipe.
>   **Cursos** (`courses`): inscrição, vaga, cobrança e credencial só pelo
>   servidor; a credencial verifica pelo mesmo código da carteirinha e nasce
>   privada. **Disciplina** (`discipline`): suspensão grava
>   `discipline_until_ms` na filiação e a regra da auto-inscrição "só
>   filiados" a lê — termina sozinha na data; multa vira cobrança; recurso
>   uma vez; ouvidoria com manifestação anônima (sem `reporter_uid`, imposto
>   na regra) e protocolo derivado do id. Lição: "é o dono?" numa filiação
>   nunca é só `user_id` — o dependente obrigou a trocar por `fedMemberOwner`
>   em toda regra e serviço; e um só caminho de confirmação de cobrança
>   (`origin` decide o efeito) evita o segundo escritor.
> - **Federações, PR 2** (2026-10-18): os três primeiros módulos ligáveis
>   por federação. **Clubes e arenas filiados** (`affiliations`): quem gere
>   pede na própria gestão, a secretaria aprova/recusa/suspende com motivo,
>   aprovado é público e vira selo "Filiado · SIGLA". **Chancela de torneio**
>   (`tournaments`): dois campos opcionais em `tournaments`; o organizador só
>   grava `pending`, a diretoria técnica decide (tipo = peso dos pontos; "só
>   filiados" imposto na REGRA da auto-inscrição — a tela avisa antes e não
>   oferece o botão). **Resultado e ranking oficial** (`ranking`): "Enviar ao
>   ranking oficial" por categoria completa manda a colocação do pódio
>   (`modalityPlacement`, a mesma dos cartões); o servidor deriva
>   `federation_rankings` por classe e geral (melhores N, peso por tipo, só
>   filiados em dia na data). Lição: a federação não pode depender de ler
>   `clubs`/`arenas` para a página pública — o pedido copia o que a página
>   mostra; e módulo desligado tem de valer na regra, não só na tela.
> - **Federações, PR 1** (2026-10-18): *"cada federação deve ter ranking
>   próprio, torneios próprios, clubes internos, arenas vinculadas, atletas
>   federados que pagam mensalidade ou anuidade, com carteirinha digital…
>   toda estrutura em flag próprio… sub-flags internas"*. Nasceu a base: flag
>   `federations` imposta na REGRA (`fedOn()`), seis coleções `federation*`
>   com zero índice, pedido de abertura que o admin aprova (quem pediu vira
>   presidente), planos por tipo de pessoa/vínculo/cobrança/validade com
>   descontos por idade, filiação e cobrança Pix que **só o servidor** cria e
>   confirma (o navegador só diz "Já paguei"), carteirinha com código que gira
>   e verificação pública mínima (`/f/verificar`), Central com dois grupos de
>   seções por permissão, Minha área → Federações, Painel admin → Federações,
>   termos legais, ajuda, guias, dicas e en/es. Os módulos internos (torneios
>   chancelados, ranking, clubes/arenas filiados, cursos, disciplina, notícias,
>   patrocinadores, loja) ficaram como catálogo "em breve" para os PRs 2–4.
>   Lição: a conta da validade (mensal, 12 meses, data fixa com carência) tem
>   cópia no servidor com paridade — a tela promete antes de pagar o que o
>   servidor grava depois.
> - **Balanço do jogo** (2026-10-10): *"ao final de um dia de jogo, de um
>   torneio ou de jogo avulso, a plataforma poderia perguntar… como ele
>   classifica o seu desempenho, quais seus pontos fortes e fracos, se houve
>   evolução… e sugerir… treino ou drills para aquela semana, que o atleta
>   poderia ou não adicionar"*. Flag `game_debrief` (sobre `training_center`)
>   **e** a escolha de cada pessoa (Configurações ou Treino → Balanço). Os jogos
>   dos últimos 7 dias (dia de jogo em que jogou, torneio, reserva) pedem
>   balanço na aba Balanço, no início e na Minha área; um minuto de perguntas
>   (nota, o que funcionou, o que faltou, evolução, corpo e cabeça); a semana
>   sugerida com drills da biblioteca no nível e nos dias da pessoa (semana
>   leve quando corpo ou cabeça pedem), e "Adicionar aos meus treinos" põe os
>   dias no plano ativo ou cria a "Semana do balanço". Tendências ao longo dos
>   balanços; duas missões opcionais na gamificação; artigo, guia e dicas.
>   **Banco**: uma coleção (`training_debriefs`, só do dono, regra provada no
>   emulador), um campo opcional em `training_meta`; zero índice.
>
> - **Centro de Treino e Minha área** (2026-10-09): *"um Centro de Treino
>   completo… professores e qualquer usuário criando conteúdo com autoria
>   visível, público, privado ou só para os alunos… o admin com controle
>   total"*. **(1) `training_center`**: `/treino` com Hoje, Planos (1 a 16
>   semanas), Diário (planejado × feito, sem vermelho), Evolução (carga sRPE,
>   autoavaliação), Biblioteca (127 itens da plataforma + professores +
>   comunidade), Meus, Recebidos, Dúvidas (conversa privada com o professor) e
>   Alunos (só professor). O item tem descrição, passo a passo, relação motora,
>   posicionamento certo × errado, dicas, diagrama da quadra e mídia (link ou
>   envio com limite); criado por atleta, professor ou com ajuda da IA (selo
>   "IA"). Público passa pela **revisão do admin**; denúncias, conteúdo,
>   biblioteca e configurações no Painel admin → Treino. Card no início,
>   o interesse "Organizar meu treino" levando ao /treino, guias de dica, pontos e artigos de ajuda — tudo atrás
>   da flag. **Exportação** ("Baixar meus dados") e **exclusão de conta** cobrem
>   o treino (o conteúdo criado para outras pessoas fica, com a autoria), com guarda; e a
>   categoria "Treino" silenciada também não vira **push** (antes o celular
>   ignorava qualquer categoria silenciada). **Banco**: sete coleções
>   `training_*`, regras aditivas provadas no emulador, `treino/{uid}/` no
>   Storage, zero índice. **(2) `user_hub`**: o perfil vira **Minha área** —
>   "Precisa de você" (reservas, aulas, convites, dúvidas, treinos recebidos)
>   e as seções por papel (Você / Gerencio). Zero banco.
>
> - **Grupos dentro do Play** (2026-10-07): *"direcionar o play para criar
>   partidas com pessoas de níveis semelhantes… grupos dentro do play, o sorteio
>   dentro desses grupos, observando uma ordem de participação… formação mista
>   ou de mesmo sexo… um parâmetro de nível para os convidados avulsos"*. Flag
>   `play_groups` (default OFF; desligada, o Play é a fila única de sempre).
>   **(1)** Um cartão **Grupos** no organizador do Play: três modelos (por
>   nível, por tipo de dupla, em branco), edição inline (faixa de nível, mista /
>   mesmo sexo, diferença máxima de nível, **exigir × preferir**, quadras do
>   grupo, completar com quem está sem grupo, entrada só pela organização,
>   pausa), **política** entre grupos (por tempo de espera, revezar, prioridade)
>   e **distribuir por nível** com prévia — sugestão, nunca imposição.
>   **(2)** O sorteio sai de **cada grupo** com o mesmo seletor de sempre (FIFO
>   ou rodízio equilibrado) e a política escolhe quem ocupa a quadra; com regra
>   exigida, vale o primeiro da fila que **consegue** formar partida. Cada grupo
>   que não joga diz **por quê** ("faltam 2 mulheres para duplas mistas").
>   **(3)** O convidado avulso ganha **nível e sexo** na entrada — é o que o
>   coloca no grupo certo (antes: nível 3.0 inventado) — e quem chega cai no
>   grupo do seu nível, também pelo jogo aberto e pelo convite público.
>   **(4)** Painel, jogador e **telão** mostram o grupo: selo em cada partida,
>   fila por grupo com numeração própria, "entra a seguir" pela previsão e o
>   aviso honesto quando nenhum grupo tem partida pronta. O jogador vê o seu
>   grupo e troca entre os abertos. **(5)** Resumo do dia, guia de dicas e
>   artigo da Central de Ajuda, todos atrás da flag. **Previsão = criação**:
>   um sorteador só (`makeGroupsDrawer`), injetado na previsão. **Banco**
>   — campos opcionais em `game_days`, `participants` e `games`; nenhuma
>   coleção ou índice, e uma cláusula estreita de regra para o administrador
>   nomeado editar os grupos (provada no emulador; o guarda confere). Ver `docs/39-PLAY-GRUPOS.md`.
>
> - **Gamificação V2 — a sequência honesta e a camada que explica** (2026-10-02):
>   *"desenvolver por completo… inclusive com os textos explicativos, as dicas e
>   tudo mais que é relacionado… usabilidade e experiência de todos os tipos de
>   usuário… não afete o banco de dados"*. **(1) 🐞 A sequência mentia**: a conta
>   antiga mantinha o número de quem parou (a pessoa abria o hub e via "12
>   semanas" sem jogar há dois meses), a "proteção" (dias de folga, congelamentos)
>   era decorativa — o motor nunca a lia — e as quatro trilhas sociais/de arena/
>   de aula/de clube ficavam zeradas. Agora há UMA conta (`weekStreak.js`): zera
>   quando a pessoa para, a semana de agora é "em risco" e não quebrada, uma folga
>   automática por mês e férias de verdade (até 4 semanas, intervalo de 90 dias,
>   recusadas pelo serviço), e as trilhas saem dos fatos reais. **(2) 🐞 O
>   convite prometia XP que não era creditado** (`REFERRAL_REWARDS`): o cartão
>   agora diz o que de fato acontece. **(3) A camada que explica**: o guia
>   completo `/gamification/como-funciona` (≈36 termos, por público, com busca),
>   um "?" em cada conceito, o "Como funciona" de cada aba — tudo com os números
>   lidos das constantes e da configuração do admin, com teste de paridade.
>   **(4) As dicas guiadas**: área "Gamificação" com 17 guias (atleta, arena,
>   professor e admin) e 20 pontos, `audience: 'admin'`. **(5) A Central de
>   Ajuda**: 11 artigos, 4 perguntas e 7 pistas de rota, só com a flag ligada.
>   **(6) Para o admin**: configuração agrupada por parte e o **funil dos
>   primeiros passos** nas métricas; 🐞 `listMetrics` pegava os 60 retratos mais
>   *antigos* — passados 60 dias o painel mostraria um retrato velho como o
>   último. **Banco: zero coleção, índice ou regra nova** — dois campos opcionais
>   (`user_streak_meta.vacations`, `gamification_metrics.onboarding`), com casos
>   do emulador provando que a regra de sempre os aceita. Ver
>   `docs/38-GAMIFICACAO-V2.md` §6.1–§6.3.
>
> - **Conta excluída e a unificação do histórico** (2026-10-02): *"o número
>   20 do ranking está como 'Atleta' e o perfil não existe… era um usuário que
>   tinha dois cadastros e um foi excluído… unificar os números no perfil
>   remanescente"*. **(1) 🐞 A conta excluída voltava ao ranking**: a exclusão
>   apaga o rating e deixa o uid nas partidas (é histórico dos adversários), e
>   a passada seguinte recriava a linha sem perfil. Agora o servidor a tira do
>   ranking nacional e do 2.0–8.0 (os jogos seguem valendo para os outros); no
>   de duplas a parceria fica como "Atleta removido". **(2) Unificar**: em
>   Cadastros → **Contas excluídas** (pela Auditoria, que guarda nome e e-mail
>   de quem foi excluído), o admin escolhe a conta que fica — com sugestão por
>   nome e e-mail —, vê a prévia do servidor lado a lado e o dono confirma: o
>   histórico esportivo (jogos publicados, dias de jogo, eventos de clube,
>   inscrições, torneios internos, validações) passa para a conta que ficou,
>   com o nome de volta, e o ranking se refaz. Só conta excluída vira origem,
>   conflito bloqueia, auditoria com os caminhos. **Banco: zero** coleção,
>   índice ou regra; uma função nova; os dados só mudam quando o dono confirma.
>
> - **Ranking, rating e a contagem de jogos** (2026-10-02): *"lancei vários
>   jogos e tem atletas que aparecem sem nenhum jogo. Atletas com vários jogos
>   que não aparecem no rating e nos seus perfis"*. O motor estava certo; eram
>   três defeitos em volta dele. **(1) 🐞 O perfil do atleta contava só
>   torneio**: quem joga em dia de jogo aparecia no ranking com dezenas de jogos
>   e no perfil com 0 — agora soma os jogos publicados, lista os recentes e o
>   confronto direto os inclui. **(2) 🐞 A partida com alguém sem conta saía do
>   ranking para todos, em silêncio**: a publicação do dia mostra antes quantos
>   jogos entram, quantos ficam de fora e quem os tira, com **Vincular a uma
>   conta**; no torneio, o selo "sem conta · não pontua" e a conta escolhida no
>   lápis da inscrição — os jogos já lançados passam a contar sozinhos.
>   **(3) Meu desempenho explica** quantos jogos não estão no ranking e por quê
>   (dia não publicado, alguém sem conta, torneio em rascunho/privado). O
>   servidor passou a contar o que deixa de fora, e o painel admin mostra com
>   link para cada torneio. Textos do ranking corrigidos (diziam "só torneios
>   encerrados"). **Banco: zero** coleção, índice, regra ou migração. Ver
>   `docs/18-RANKINGS.md` §10.
>
> - **Torneio: o meu torneio no início, check-in que não trava, 2 turnos e o
>   Americano aprimorado em etapas** (2026-10-01): *"criei um torneio e abri as
>   inscrições… ele não aparece na seção torneios do meu início… se fizer
>   checkin dá erro na modalidade… eu deveria poder criar modalidades com 2
>   turnos… americano aprimorado em etapas"*. **(1) 🐞 O meu torneio** sumia de
>   "Você está inscrito": o papel (`my_role`) dizia "organiza" e escondia a
>   inscrição; agora o início tem **"Seus torneios"** (o que a pessoa joga e o
>   que organiza, uma linha por torneio) e "Inscrições abertas" não repete os
>   dela. **(2) 🐞 O check-in** de quem foi inscrito pela organização ou pela
>   dupla dava "permissão negada" (a regra só aceita quem criou a inscrição) —
>   o botão só aparece para quem pode e os outros leem onde fazer; o check-in
>   da organização avisa quando falha; "inscrição que joga" virou fonte única
>   (`isActiveRegistration`, com guarda) e a ajuda deixou de dizer que o
>   check-in decide o sorteio. **(3) 🐞 2 turnos** não valiam em modalidade de
>   várias fases nem no Americano — agora valem, e a explicação conta o returno.
>   **(4) Americano aprimorado em etapas** (flag `tournament_americano_etapas`):
>   etapas de Americano em grupos refeitos a cada etapa para o máximo de jogos
>   inéditos (8 atletas em 3 etapas: todos jogam com e contra todos), quantas
>   etapas o organizador quiser, classificação única e, se quiser, uma chave
>   depois. De quebra: a tabela passou a usar a ordem de desempate da fase, e
>   "re-sortear os jogos restantes" deixou de renumerar rodadas de chave, suíço
>   e Mexicano. **Banco: zero coleção, índice ou regra** — `etapa_count` dentro
>   de `stages[]` e a etapa no nome do grupo. Ver
>   `docs/37-TORNEIO-ETAPAS-TURNOS-E-CHECKIN.md`.
>
> - **Notificações: o sino que rola e a central com os avisos antigos**
>   (2026-10-01): *"não há rolagem suficiente para ver todas as notificações
>   que existem ou um ambiente para ver notificações passadas"*. **🐞 O sino
>   escondia a maior parte dos avisos**: a caixa não tinha altura máxima e
>   crescia além da tela — medido com 46 avisos numa tela de 900 px, ela tinha
>   2.858 px, sem rolagem. Agora cabe no espaço abaixo do botão e só a lista
>   rola, com o ícone da área, a hora ("há 5 min", "ontem, 14:05"), o selo 99+ e
>   carregando/falha que não viram "nenhuma notificação" (sempre ligado). **A
>   central** `/notificacoes` (flag `notifications_center`): os avisos novos e
>   os antigos, por dia (Hoje, Ontem, últimos 7 dias, mês a mês), filtros de não
>   lidas, área e busca na URL, marcar lida e NÃO lida, 30 por vez, e o que está
>   silenciado dito; o sino mostra os 20 mais novos e "Ver todas" diz quantos
>   ficaram de fora. "Notificações" no menu do avatar e na gaveta. **A área** de
>   cada aviso sai do tipo e, no `generic` (quase todos), do destino do link.
>   **Uma escuta só por pessoa** — o sino e o início liam a mesma lista duas
>   vezes. De quebra: "Pendências" do início orientado a ação dizia "Nada
>   pendente" com os avisos falhando; e quatro testes de progressão que
>   reprovavam entre 0h e 3h UTC do dia 1º (o mês do grace é o do Brasil).
>   **Banco: zero.** Ver `docs/36-NOTIFICACOES.md`.
>
> - **O "Jogar" que abre no Dia de jogo, os dias do clube e o botão de entrar
>   em todo lugar** (2026-09-30): *"em jogar, a ordem de abas deve ser… dia de
>   jogo, procura-se jogo, encontrar jogadores… ao clicar em jogar, o usuário
>   deve entrar direto na aba dia de jogo… para os membros de clubes e arenas,
>   também deve aparecer os dias de jogo privados… em todos os locais que existe
>   a possibilidade de um usuário ingressar e participar, deve haver o botão
>   respectivo"*. **(1)** O menu: Dia de jogo → Procura-se jogo → Encontrar
>   jogadores, e "Jogar" abre o Dia de jogo, que ganhou **"Com vaga para você"**
>   (os dias em que a pessoa pode entrar, primeiro quando ela não tem nenhum).
>   **(2)** Os dias de jogo dos **CLUBES** de que a pessoa é membro (privados)
>   entram no início, no Procura-se jogo e no Dia de jogo — uma consulta por
>   clube, que a regra de sempre só deixa passar para o membro (provado no
>   emulador). Dia de arena "só para membros" não existe: todo dia de arena é
>   público. **(3)** Um botão só de entrar e sair (`PlayItemAction`) em cada
>   linha e cartão, pelo caminho da origem (teto da arena, quadra, faixa de
>   nível do jogo aberto, clube); o que a pessoa já tem fica com "Você vai" e
>   "Sair", e o início mostra só o que ela preenche os requisitos para entrar.
>   Dentro do dia do clube, o mesmo painel "Participar" (antes a aba do evento
>   tinha um cartão próprio, que gravava o gênero do perfil no lugar da categoria
>   de jogo). **(4) 🐞 Sair podia falhar**: a saída recontava a lista de membros e
>   a regra recusava quando havia administrador nomeado — agora tira só quem
>   saiu (`leaveGameDay`). **(5) Auditoria**: botão "Participar" no calendário
>   da arena (dia com dia de jogo), "Participar"/"Aceitar convite" nos eventos
>   dos clubes do início, "Inscreva-se" nos torneios abertos; e o dia privado
>   que não é seu diz que é privado (antes: "a conexão falhou"). **Banco: zero.**
>   Ver `docs/35-JOGAR-ENTRAR-E-SAIR.md`.
>
> - **O "Jogar" que mostra os dias de jogo, e a Minha região** (2026-09-30):
>   *"para muitos usuários, na sessão 'jogar', não estão aparecendo os dias de
>   jogo abertos e com vaga… que leve em consideração primeiro a sua cidade, mas
>   também uma margem de raio… em toda plataforma… e o que já passou, não mostre
>   mais"*. **🐞 O "Jogar" nunca mostrou o dia de jogo das ARENAS**: ele lia só
>   convites e jogos abertos, e o dia que a arena marca no calendário não cria
>   convite. Agora a lista é uma só no início e no Procura-se jogo (dias
>   públicos dos próximos 30 dias, do atleta e da arena, com as vagas; jogos
>   abertos; convites), numa consulta que dispensa índice novo — conferida na
>   produção. **Tocar no dia de jogo abre o próprio dia**, com um painel
>   "Participar" (vagas, quadra, entrar e sair). **🐞 E entrar pelo Play num dia
>   de arena lotado passava**: a entrada do atleta agora delega à da arena. **O
>   que já passou sai**: o dia que terminou hoje, o convite vencido de outra
>   pessoa, o convite sem data com mais de 14 dias, e os torneios encerrados da
>   aba Públicos (atrás de um botão). **Minha região** (flag `my_region`): a
>   cidade do perfil + 50 km por padrão, ou outro raio, o estado, outro lugar, a
>   localização do aparelho ou todo lugar — no início (Jogar, Torneios,
>   Destaques, Horários da arena), Procura-se jogo, Torneios, Arenas,
>   Professores, Clubes, Promoções e Encontrar jogadores, com a distância e o
>   que ficou de fora dito. A distância é entre cidades, pelo mapa do IBGE
>   baixado sob demanda. `Permissions-Policy` passa a `geolocation=(self)`.
>   **Banco: zero.** Ver `docs/34-MINHA-REGIAO.md`.
>
> - **Estoque, cadastro essencial e o índice do painel** (2026-09-30): três
>   pedidos do dono depois da varredura. **(1) O estoque** mostrava o
>   cadastro inteiro — cada item puxado do catálogo e nunca comprado virava
>   "Estoque: 0" e "Esgotado". Agora uma regra só (`stockPosition`) responde
>   ao Estoque (abre em "À venda", o resto em filtros), ao Resumo (reposição só
>   do que já foi comprado, validade só do que está na prateleira), à Operação
>   e à loja do app (esgotado e vencido saem da vitrine; campanha de produto
>   esgotado avisa). De quebra, "hoje" na arena era o dia de Greenwich em 17
>   lugares — das 21h à meia-noite o calendário tratava hoje como passado.
>   **(2) O cadastro**: a categoria em que joga e o nível nunca eram pedidos,
>   e a edição do perfil deixava apagar gênero, cidade, UF e lado. Com a flag
>   `essential_profile`, os dois viram obrigatórios, a UF vira lista e quem já
>   tinha cadastro vê só o que falta; o admin passou a contar o mesmo que o
>   cadastro, e o sorteio misto usa a categoria. **(3) O índice** criado à mão
>   no painel (`tournament_matches`: modalidade, fase, rodada) foi importado — é
>   ele que serve a lista de jogos da fase — e o guarda de índices, que o
>   deixava passar, passou a exigir índice exato. **Banco: zero** (o índice já
>   existia em produção; só entrou no arquivo). Ver `docs/33-CADASTRO-ESSENCIAL.md`.
>
> - **Varredura da plataforma** (2026-09-30): *"uma varredura completa…
>   estrutura, organização, segurança… não afete o banco de dados"*, depois de
>   o dono ter feito a parte de segurança, higiene e backups (PRs #173–#178).
>   O que faltava, conferido **no navegador** com as leituras negadas no
>   emulador e a mesma rodada contra a `main`: **(1) Falha não é vazio no resto
>   da plataforma** — clubes, chat, sino, rankings, comunidade, circuitos,
>   busca, aulas do aluno, parceiros, admin, tela inicial e perfil do atleta
>   (~30 telas; na `main`, oito afirmavam "não existe" numa falha). O chat e o
>   sino ganharam `retry`, porque assinatura em tempo real que falha está
>   encerrada. **(2) A família que a varredura por tela não via**: hooks que
>   engoliam o erro (`.catch(() => [])`) — a tela tratava `isError` e mentia
>   assim mesmo; guarda novo. **(3) 🐞 Adotar produtos do catálogo em lote
>   duplicava o Mercado** quando a conferência dos já adotados falhava — agora
>   não grava nada e diz por quê. **(4) Vinte componentes mortos** (o chat e o
>   nivelamento V1, seis peças da arena…) removidos, com um guarda que segue os
>   imports a partir de `main.jsx`. **(5)** O link de aviso passa por
>   `destinoDeAviso` antes do `navigate` (alerta do react-router 6, corrigido só
>   na v7). **Banco: zero.** Ver `docs/27-FALHA-NAO-E-VAZIO.md` §11 e
>   `docs/AUDIT-2026-09-28.md` §3.5.
>
> - **Onda CJ — Dicas guiadas** (2026-09-27): *"o tutorial não está bem da
>   forma como está. O ideal é que o usuário ligue ou desligue 'dicas'… com
>   setas e avisos reais na tela… elas não devem surgir depois de o usuário
>   ter feito algo, elas devem surgir se ele quiser e guiar ele para fazer o
>   que ele procura… não afete o banco de dados"*. Flag `guided_tips` (default
>   OFF; desligada, nada muda). Um botão **Dicas** no topo de toda tela abre o
>   painel: o **interruptor** (dicas na tela ligadas/desligadas, por pessoa),
>   os guias **desta tela** e **"O que você quer fazer?"** (busca e 27 guias
>   por área). **Nada aparece sozinho**: o guia começa quando a pessoa pede,
>   **leva à tela**, **escurece o resto e aponta o botão de verdade com uma
>   seta**, e **avança quando ela faz** (tocou no botão, a tela mudou, o
>   formulário abriu). Ligadas, **pontos pulsando** explicam os botões de cada
>   tela (40, em 20 telas; "Entendi" os marca como vistos). Dentro de um
>   formulário, o cartão vira uma faixa presa ao rodapé DELE e o guia rola até
>   o campo ficar acima dela. Ponto fora do lugar não vira beco: **"Levar-me
>   até lá"** abre a aba certa, **"Abrir de novo"** reabre o formulário
>   fechado. Os quatro **tutoriais viraram guias** (o mesmo texto) e deixam de
>   abrir sozinhos; a Central de ajuda ganhou **"Mostre na tela"** no fim dos
>   artigos, só com os guias que valem para a pessoa. **🐞 De quebra**: o
>   "Cancelar" do pedido de reserva quebrava quando o pedido vinha da grade
>   do dia; o painel do professor ignorava `?aba=` já aberto; e os tutoriais
>   ensinavam "Dia de jogo → Criar" e "o card Organização", que não existem
>   mais. **Banco: zero** (navegador, por usuário). Ver
>   `docs/32-DICAS-GUIADAS.md`.
>
> - **Onda CI — Início sob medida** (2026-09-27): *"nas configurações do
>   perfil de cada usuário eles possam escolher quais funcionalidades e cards
>   eles querem na sua página de início, pois a página está muito povoada. Em
>   regra, deve vir habilitados os cards de dia de jogo, horários de arena e
>   ranking… não afete o banco de dados"*. Flag `home_cards` (default OFF,
>   sobre `personalized_home`). O início passa a mostrar os CARDS que a pessoa
>   escolhe, na ordem dela — de começo **Dias de jogo, Horários da arena e
>   Ranking** —, e atalhos, destaques e evolução viram cards como os outros.
>   Escolhe-se em "Personalizar", no próprio início (a tela atrás muda na
>   hora), ou em **Configurações → Página inicial**: ligar/desligar, subir/
>   descer, restaurar o padrão, e **sugestões** pelo que a pessoa FAZ (a
>   arena, as aulas, os torneios que organiza) — sugestão, não imposição.
>   Card escondido **não é montado**, então não consulta nada (a faixa de
>   evolução lia o ranking nacional inteiro). O que tem prazo (a chamada da
>   fila) aparece sempre; desligar tudo é escolha ("Seu início está enxuto").
>   A grade **não deixa buraco**: o card que ficaria sozinho numa linha se
>   estica — o próprio padrão tinha um. A ajuda ganhou `flagsTodas`/`semFlags`
>   para o artigo do jeito antigo sair quando o novo entra. **🐞 De quebra**:
>   a rolagem até uma âncora presente no primeiro desenho era desfeita pelo
>   layout, e o `scrollIntoView` rolava a raiz do app (`overflow: hidden`),
>   deslocando tudo 131 px — agora `rolarAte` rola só o `<main>`. **Banco:
>   zero** (a escolha fica no navegador, por uid). Ver
>   `docs/31-INICIO-SOB-MEDIDA.md`.
>
> - **Onda CH — Modo escuro** (2026-09-27): *"agora vamos fazer o modo escuro
>   da plataforma, com opção de cada usuário alterar para a forma que melhor se
>   enquadra ao seu gosto… seguindo os padrões e cores da plataforma… não afete
>   o banco de dados"*. Flag `dark_mode` (default OFF): **Claro**, **Escuro** ou
>   **Automático** (acompanha o aparelho), escolhido no menu do avatar, na
>   gaveta do celular e em Configurações (três cartões com uma miniatura da
>   plataforma em cada modo). **Nenhuma tela foi reescrita**: a paleta
>   (`core/theme/palette.js`) compila cada cor como uma interpolação entre o
>   claro e o escuro por um interruptor CSS, e o plugin do Tailwind ensina cada
>   `bg-*` a dizer se é superfície "de cor" (o texto do design original volta a
>   valer dentro dela) ou neutra — com todas as variantes. O claro é idêntico
>   (teste token a token e comparação do CSS gerado); o escuro é a família ink
>   da marca em camadas, com o ácido intacto e **contraste AA conferido por
>   teste**. A primeira tela não pisca (script em `index.html` + espelho no
>   aparelho); a troca esmaece e não "derrete" em ondas. Telão, totem,
>   impressão, cards exportados, certificado, QR e o botão das chaves ficam
>   claros de propósito; o logo troca de versão. **🐞 Dois defeitos achados na
>   verificação em tela** (e travados por teste): o `:root` de `index.css`
>   vencia o `.dark` por ordem e deixava diálogos e menus CLAROS no escuro; e
>   uma regra de base com classe de utilitário virava cópia com variante no
>   Tailwind e vencia o `text-*` dos botões. **Banco: zero.** Ver
>   `docs/30-MODO-ESCURO.md`.
>
> - **Onda CG — revisão** (2026-09-27): pedida depois do deploy (*"Você fez
>   tudo o que pedi? Com profundidade e cuidado?"*), a revisão achou defeitos
>   reais e os corrigiu. **🐞 "Só para os meus alunos" não valia no uso**:
>   quem não era aluno e soubesse o código levava o desconto — agora o pedido
>   recusa e a confirmação confere o vínculo. **🐞 Na aula recorrente o
>   desconto era sobre a série inteira** ("aula experimental grátis" zerava
>   dez semanas) — um uso é uma aula. **🐞 Cancelar a aula não devolvia o uso
>   do cupom** — agora devolve, numa transação idempotente, pelo lado do
>   professor. **🐞 O aluno escrevia qualquer campo da própria aula** (criava
>   confirmada, gravava cupom "aplicado") — a regra de `coach_lessons` passou a
>   deixar o aluno só pedir e cancelar, como o serviço sempre fez (17
>   asserções). **🐞 `?marcar=1` não fazia nada** com o professor sem aceitar
>   alunos — agora a tela diz. **🐞 "Enviado para N" era o tamanho da lista**,
>   não o que foi gravado — `notifyUsers` devolve a contagem e a campanha
>   mostra "confirmado para X de N". **🐞 Aviso com âncora caía no topo da
>   página** — vira `?ancora=` e o layout rola. E o que faltava: o valor final
>   na aula, os cupons do professor para tocar no pedido (com a estimativa), a
>   vitrine sem corte que trocava cupom no ar por vencido, e três artigos na
>   central de ajuda — cada um atrás da flag da própria funcionalidade
>   (`helpCatalog`). **Banco**: campos opcionais (`coach_lessons.coupon.{lessons_count,
>   returned, returned_at}`, `promo_campaigns.recipients_count`) e a regra de
>   `coach_lessons` endurecida do lado do aluno. Zero coleção, zero índice.
>
> - **Onda CG — O início por pessoa, e a plataforma e os professores divulgando**
>   (2026-09-26): *"melhorar a página início, para que seja personalizada por
>   tipo de usuário… itens atualizados… nunca itens antigos"* e *"campanhas e
>   cupons da plataforma e de professores… com as mesmas funcionalidades,
>   detalhes e configuração que existem para campanhas e cupons de arena"*.
>   **(1) `personalized_home`**: a tela inicial montada por pessoa — o que ela
>   FAZ (gere arena, dá aula, organiza torneio) vence o que ela DISSE
>   (interesses), e a atividade traz a seção. Agenda unificada de todas as
>   fontes, atalhos diretos (a Central com os pedidos no selo,
>   `/dia-de-jogo?criar=1`), último resultado, ranking e duplas, horários
>   livres da "arena de sempre", e **nada vencido** (`freshness.js`: data sem
>   hora é dia LOCAL). "Personalizar" muda os interesses ali mesmo. De
>   quebra, a tela CLÁSSICA parou de destacar torneio encerrado e de listar
>   como aberto o que tem o prazo vencido. **(2) `platform_marketing` e
>   `coach_marketing`**: cupons e campanhas da PLATAFORMA (Painel admin →
>   Plataforma → Divulgação) e de CADA PROFESSOR (Painel do professor →
>   Divulgação), com os MESMOS componentes da arena — tíquete, cinco modelos,
>   imagem enviada, banner, destino de lista fechada, público contado antes,
>   pausa, página da campanha, controle de uso. Cada emissor com os seus tipos,
>   destinos e públicos (a plataforma fala com todos, um interesse, um estado,
>   uma cidade ou os professores; o professor, com os alunos), alcance na tela
>   inicial (Brasil/estado/cidade — o nacional aparece até para quem não disse
>   a cidade) e "só para os meus alunos". O desconto do professor entra no
>   **pedido de aula** e é aplicado na confirmação, conferido contra o banco
>   (recusado com o motivo, a aula segue). Vitrine `/promocoes`, página
>   `/campanhas/:id`, seção Promoções no perfil do professor (com "Usar ao
>   pedir a aula") e o carrossel da tela inicial. **🐞 E o aviso das campanhas
>   das ARENAS caía inteiro**: destino com `#` é recusado pela regra de
>   `notifications`, e o lote de 400 ia junto — a campanha dizia "enviada".
>   Agora `linkDeAviso`, com paridade contra a regra. **Banco**: três coleções
>   novas (`promo_coupons`, `promo_campaigns`, `promo_settings`) e um campo
>   opcional (`coach_lessons.coupon`); zero índice; regras aditivas com 23
>   asserções no emulador. Ver `docs/29-INICIO-PERSONALIZADO-E-DIVULGACAO.md`.
>
> - **Onda CF — Jogo simples ou em duplas, e um ranking do dia por tipo**
>   (2026-09-26): *"em todas as modalidades que restam, devem ser possível
>   criar jogo simples ou em duplas, manualmente ou por sorteio, observando a
>   ordem… um ranking do dia independente para cada um… e os resultados devem
>   entrar para ranking e rating da plataforma que seja apropriado"*. No Play e
>   no Americano aprimorado cada QUADRA tem "Duplas | Simples" e lembra o tipo
>   do último jogo; na de simples entram os dois primeiros da fila (no
>   aprimorado, o adversário é o que o primeiro menos enfrentou, com nível
>   parecido). No Americano o tipo se escolhe no sorteio — o "todos contra
>   todos" de simples, sem repetir adversário enquanto der. A criação manual
>   tem os dois tipos em todo formato, e o legado do clube ganhou o mesmo. Com
>   os dois tipos no dia, o ranking do dia vira DUAS tabelas (painel e telão),
>   e o ranking da casa separa as colocações. A publicação já levava o simples
>   ao rating de simples e para fora do ranking de duplas — agora está provado
>   no emulador e nos motores do servidor. De quebra, o cabeçalho dos cartões
>   recolhíveis passou a quebrar linha: no celular, "Criar próximo jogo" era
>   cortado pela borda. **Banco: zero** (o campo `kind` do jogo já existia).
>
> - **Onda CE — Mexicano e Rei da Quadra, cada um com a sua flag**
>   (2026-09-26): *"coloque as modalidades mexicano e rei da quadra em uma flag
>   própria para cada uma, a ser ativada pelo admin da plataforma… em todos os
>   formatos de dia de jogo… daqui para frente"*. Duas flags novas, default OFF
>   (`gameday_mexicano`, `gameday_king_of_court`), no grupo **Dia de jogo** do
>   painel, ao lado do Americano aprimorado. Desligadas, os dois formatos somem
>   de TODO lugar onde se escolhe formato — criação do atleta, da arena e do
>   clube, troca de formato, jogo aberto e os dois diálogos de sorteio (inclusive
>   o legado do clube). Os dias já gravados neles seguem funcionando, e o seletor
>   de cada um mostra o formato gravado. **🐞 A lista estava escrita em sete
>   telas**, cada uma com a sua ordem e as suas flags — o jogo aberto oferecia
>   Mexicano e Rei da Quadra sem flag nenhuma. Virou fonte única
>   (`gameDayFormatChoices` + `useGameDayFormatChoices`), com guarda varrendo
>   todas as telas. **Banco: zero.**
>
> - **Onda CD — O cupom vira tíquete, com o código para copiar**
>   (2026-09-25): *"a mesma coisa para cupons, deve ter padrões e modelos,
>   mas permitir que a arena também faça upload ou crie o seu próprio. E deve
>   ser possível copiar o código"*. Cada cupom é um TÍQUETE: a parte principal
>   diz o que ele dá, e o canhoto traz o código — sempre o de verdade, e
>   tocável para copiar (página da arena, tela inicial e a lista da Central).
>   **Cinco modelos** (Clássico, Neon, Quadra, Festa, Sol) com título e texto
>   em branco de propósito — em branco, valem o benefício e a descrição do
>   próprio cupom, então a arte nunca desmente o cupom; textos e cores
>   personalizáveis; **modelos da arena** em `arena_settings.coupon_templates`;
>   ou a **imagem enviada** (1200 × 600, sem o código escrito nela — ele fica
>   no canhoto e nunca desatualiza). O "copiar" virou uma peça só
>   (`CopyCodeButton`), com o caminho antigo quando a API do navegador recusa
>   e o código na mensagem de erro. Um campo opcional (`arena_coupons.art`),
>   zero regra; 8 cenários novos no emulador.
>
> - **Onda CC — Banners de campanha** (2026-09-25): *"banner específico da
>   campanha, com hiperlink para os detalhes da campanha ou para as funções
>   específicas… gerar o banner na própria plataforma, ou fazer upload… 5
>   modelos… as arenas devem poder salvar os seus próprios modelos"*. A
>   campanha ganhou BANNER: criado na plataforma a partir de **cinco modelos**
>   (Destaque, Oferta, Evento, Vitrine, Chamado — textos, cores, "usar a cor da
>   arena", prévia no computador e no celular) ou **enviado pronto**, com a
>   especificação ANTES do botão (1600 × 800, mínimo 1200 × 600, 2:1, área
>   segura desenhada) e a imagem conferida antes de subir. **Modelos da arena**
>   ficam em `arena_settings.banner_templates`, ao lado dos cinco, que nunca
>   mudam. O banner leva a um destino de uma lista FECHADA (página da campanha,
>   reservar, jogos abertos, um dia de jogo, um torneio, um produto — a loja
>   abre com ele em destaque —, planos, aulas, promoções, ranking) e aparece na
>   página da arena ("Em destaque") e, se a arena quiser, na tela inicial, no
>   mesmo carrossel e filtro de região das promoções, até uma data. Pausar e
>   retomar sem apagar; editar sem reenviar o aviso. Página "saiba mais" em
>   `/arenas/:id/campanhas/:cid`. Zero coleção, índice ou regra; campos
>   opcionais; 14 asserções novas no emulador.
>
> - **Onda CB — Torneios da casa e ranking da casa** (2026-09-25): *"os
>   torneios da plataforma viram os torneios da casa, excluindo o que foi
>   criado como torneio da casa"*. O torneio interno saiu da tela — começar um
>   criava um dia de jogo, e desde a Onda CA todo jogo aberto já é um. **Torneio
>   da casa = torneio da plataforma sediado na arena**, com as regras da
>   plataforma e "Criar torneio aqui". O que o interno tinha de bom virou o
>   **ranking da casa**: jogos abertos com placar (pela colocação no ranking do
>   dia) + torneios da casa encerrados (o dobro, e no mata-mata pela FINAL),
>   por temporada e por modalidade, **derivado** — soma sozinho, sem botão, sem
>   escrita; com "de onde vêm os pontos" e "o que ainda não entrou". Nada foi
>   apagado: o ladder antigo segue somando (sem contar duas vezes o dia de
>   jogo do torneio encerrado) e os torneios internos abertos aparecem na
>   Central para a arena cancelar avisando os inscritos. **🐞 E ninguém listava
>   os dias de jogo da arena**: a consulta só por `arena_id` era recusada pela
>   regra para todo mundo menos o admin da plataforma — o gestor inclusive.
>   Agora leva `visibility == 'public'`. Zero coleção, índice, regra ou função;
>   9 asserções novas no emulador.
>
> - **Onda CA — O jogo aberto é um dia de jogo** (2026-09-25): *"o jogo
>   aberto deve gerar um dia de jogo"*. Publicar cria a vitrine (nível, valor,
>   vagas, fila) E o dia de jogo (formato, quem conduz, quadras — mais de uma),
>   num lote; entrar e sair gravam as duas listas juntas, também num lote, e
>   marcar presença pelo dia de jogo é entrar no jogo aberto. O atleta vê, da
>   página da arena, "regras e quem vai" (a página do dia de jogo, com o painel
>   do jogo aberto e o mesmo botão); a arena organiza sorteio, placar e telão
>   por "Organizar o jogo". Convidado sem conta ocupa lugar (inclusive na fila,
>   no servidor). 🐞 Cancelar dizia "serão avisados" e ninguém era: agora avisa.
>   Jogo aberto antigo não é migrado ("Criar o dia de jogo", um por vez). Zero
>   coleção, zero índice, zero regra; campos opcionais; 10 asserções novas no
>   emulador provam que as regras de sempre aceitam os lotes.
>
> - **Onda BZ — As promoções na tela inicial, por região** (2026-09-25): a
>   promoção só aparecia na página da arena, ou seja, para quem JÁ tinha achado
>   a arena. Agora a arena pode marcar o cupom divulgado como **banner na tela
>   inicial**, e ele entra num carrossel (troca a cada 7 s, pausa, setas e
>   pontos com nome, respeita "menos movimento") com a marca da arena. O filtro
>   é por **localidade** (minha cidade, meu estado, outra cidade, Brasil todo),
>   porque arena e perfil não têm coordenadas; sem cidade no perfil, a tela
>   pede a cidade em vez de mostrar o país inteiro. Um campo opcional
>   (`arena_coupons.show_home`), zero regra, zero índice; duas asserções novas
>   no emulador provam a leitura da tela inicial.
>
> - **Onda BY — A indicação de ponta a ponta** (2026-09-25): o código de
>   indicação saiu da página de cada arena para o **Perfil** ("Meus códigos de
>   indicação", com as regras de cada arena), o pedido de reserva ganhou
>   **"Foi indicado por alguém?"** na primeira reserva, e a indicação passou a
>   ser **registrada sozinha quando a arena confirma**: o código é conferido
>   contra o banco e as regras, cada lado é creditado, o desconto de quem chega
>   entra no valor acordado e os dois são avisados. Recusada, fica com o
>   motivo. A reserva instantânea vai para a aba Indicações e para "Precisa de
>   você". Um campo opcional (`arena_bookings.referral`), e a regra só deixa a
>   arena decidir a indicação, com 8 asserções novas no emulador.
>
> - **Onda BX — Cupons com tipo, recepção de vales e controle de uso**
>   (2026-09-25): o cupom ganhou TIPO em três famílias — desconto e hora
>   grátis entram no preço da reserva; aula, clínica, comida, bebida, brinde,
>   aluguel e evento são VALES registrados na recepção; e a indicação virou um
>   cupom com REGRAS (quanto ganha cada lado, "só quem nunca reservou aqui",
>   limite por pessoa), mostradas no cartão público e no convite. Cupons
>   ganhou a aba **Controle de uso**: usos, custo e receita por tipo e cupom a
>   cupom, com "—" (nunca zero) para o que não se sabe. O custo interno do vale
>   mora em `arena_settings`, que só a arena lê. **🐞 Três brechas fechadas**:
>   o cupom e a campanha mudavam de arena no update; o código de indicação
>   podia ser sequestrado (id livre); o indicador reescrevia a própria
>   contagem. **🐞 E o cupom nunca chegava ao pedido**: a tela o conferia e
>   mostrava "aplicado", mas não enviava o código — a reserva saía com preço
>   cheio e o uso nunca era contado. Campos opcionais, zero coleção, zero
>   índice; regras só endurecidas, com asserções novas no emulador.
>
> - **Onda BW — A barra de seções em duas linhas** (2026-09-25): com os
>   módulos integrados, a Central da arena chegou a treze seções numa barra que
>   rolava para o lado, e o que não cabia não era visto. Agora são duas linhas
>   com nome: **Atender** (reservas, jogo aberto, membros, aulas, torneios,
>   loja, operação) e **Gerir** (perfil, estrutura, marketing, desempenho,
>   equipe, configurações). Nada rola para o lado, nem as abas de cada seção.
>   A mesma peça (`V2SectionNav`) serve ao painel do professor e à gestão do
>   torneio. **Banco: zero.**
>
> - **Onda BV — O que tem prazo vem primeiro** (2026-09-25): **(1)** a aba
>   Agenda do professor abria com o editor de disponibilidade semanal
>   (configuração, muda pouco) e deixava os pedidos de aula esperando resposta
>   no fim da página. Agora a ordem é próximas aulas → aulas nas arenas →
>   disponibilidade → quadras reservadas, com os pedidos solicitados primeiro
>   (`upcomingRepliesFirst`) e o selo "N pedidos esperando a sua resposta".
>   **(2)** A chamada da fila do jogo aberto (prazo de 1 hora) só aparecia na
>   arena e em Minhas reservas; agora aparece também na **tela inicial**
>   (`HomeWaitlistCalls`, o mesmo cartão), só quando há chamada e só com a
>   chave-mestra dos módulos de arena. **Banco: zero.**
>
> - **Onda BU — "Precisa de você" no topo da Central** (2026-09-25): cada
>   pendência morava na sua aba (reserva para confirmar, pedido do app para
>   entregar, falta para marcar, mensalidade atrasada) e quem abria a Central
>   não sabia por onde começar. Agora uma faixa no topo junta tudo, cada item
>   levando à aba que resolve, com as MESMAS contas das abas. Consulta que
>   falhou não vira zero, e a faixa não diz "tudo em dia". Só leitura, das
>   mesmas consultas das abas. **Banco: zero.**
>
> - **Onda BT — "Nesta página": o índice da página da arena** (2026-09-25): a
>   integração trouxe os módulos para dentro da página da arena, e ela ficou
>   longa, sem índice; quem procurava a aula ou a loja rolava tudo. Agora um
>   índice logo abaixo do cabeçalho lista só as seções que de fato
>   renderizaram (lendo o DOM: módulo desligado não vira atalho), inclui a que
>   chega depois e dá âncoras estáveis — `/arenas/:id#arena-planos` rola até a
>   seção, e o aviso "Pacote de horas creditado" já leva direto a Planos.
>   **Banco: zero.**
>
> - **Onda BS — A chamada da fila diz até quando** (2026-09-25): a chamada tem
>   60 minutos e nenhuma tela dizia o horário, só "com um prazo para
>   confirmar". O cartão da chamada passou a dizer "Confirme até 20:35"
>   (`waitlistCallDeadline`, lendo o `Timestamp` do servidor), e com o prazo
>   vencido não oferece o "Confirmar" que o serviço recusaria. Quem está na
>   fila lê "você tem 1 hora para confirmar", pela mesma constante do
>   servidor. De quebra, os dois últimos botões só-ícone sem nome acessível
>   (adicionar admin da arena, ações do membro do clube) ganharam rótulo, e
>   um guarda (`botaoSoIcone.test.js`) varre as telas da arena e do
>   professor. **Banco: zero.**
>
> - **Onda BR — "Planos e saldo nas arenas"** (2026-09-25): quem comprou
>   horas numa arena só sabia quanto restava abrindo a página DAQUELA arena.
>   Minhas reservas passou a juntar, de todas as arenas, as horas que restam
>   (e quando a primeira vence), o saldo, o nível e a mensalidade, com cada
>   linha obedecendo aos módulos da arena. É leitura só, por `user_id`, com
>   seis asserções novas no emulador provando que o dono lista os próprios
>   documentos e ninguém lista os de outra pessoa. A ajuda ganhou o artigo do
>   atleta sobre pacote, saldo e mensalidade, que não existia (41 artigos).
>   **Banco: zero.**
>
> - **Onda BQ — O pacote de horas e a chamada da fila, lidos do banco**
>   (2026-09-25): o Firestore devolve `Timestamp`, não `Date`, e o código lia
>   datas com `x instanceof Date ? x.getTime() : Number(x)`. `Number(timestamp)`
>   não falha: dá os segundos desde o ano 1, que ao lado de `Date.now()` caem
>   em 1972. **🐞 Todo pacote de horas "venceu"**: não aparecia, e o preço da
>   reserva nunca o abatia, então quem comprou horas pagava o preço cheio.
>   **🐞 Toda chamada da fila do jogo aberto "expirou" ao chegar**: "Aceitar"
>   respondia "Promoção expirou" com a hora inteira pela frente. E um segundo
>   defeito estava escondido pelo primeiro: o plano de consumo casava por
>   `p.id`, que o pacote da carteira não tem. **Corrigir só a data criaria
>   horas grátis para sempre** (abatidas no preço, nunca debitadas), por isso
>   saíram juntos: um conversor único (`instanteEmMs`), a baixa refeita na
>   confirmação sobre a carteira atual, pacote a pacote pela posição
>   (`applyPackageUse`), e um guarda contra `Number()` em campo de data. Os
>   testes não pegavam porque montavam a data com número, que é o que o código
>   grava, nunca o que o banco devolve; os novos usam `Timestamp` de verdade e
>   reprovam o código antigo. **Banco: zero.** Nenhum dado migrado.
>
> - **Onda BP — Falha não é vazio na arena e no professor** (2026-09-25): a
>   varredura da Onda BA parava na porta da arena — o filtro só enxergava dia
>   de jogo e torneio. Estendida à arena, ao professor e às reservas (111
>   arquivos), acusou **32**: 30 telas afirmando vazio sobre consulta que podia
>   ter falhado, e 2 isentas com motivo (preço chega por `props`). Ali o custo
>   passa da frase para o comando. **🐞 O que regravaria**: a disponibilidade
>   do professor abria em branco e salvar gravava a semana vazia; o perfil do
>   professor virava "Sou professor" com formulário vazio; o fechamento
>   financeiro gravava um relatório do mês com estoque zero. **🐞 O que
>   duplicaria**: quadras, janelas de horário, totem, adoção do catálogo,
>   entradas do Mercado, pacotes, membros, parceiros, e no professor pacotes,
>   alunos (reativando quem estava pausado), clínicas e conteúdo. **🐞 O que
>   mentia**: *"Você ainda não reservou"* para quem tem jogo à noite, a arena
>   "não encontrada" por queda de rede, o pedido de reserva mostrando tudo
>   livre, as Métricas em R$ 0,00 e o alarme de "quadra sem horário" com as
>   janelas sem carregar. Agora cada uma diz que falhou, com "Tentar de novo",
>   e **não renderiza** criar nem salvar sobre estado desconhecido; nas
>   Métricas, parte secundária falhando sai com "Ficou de fora: …". Guarda
>   estendido + testes de renderização nos casos de maior dano. **Banco:
>   zero.** Ver `docs/27-FALHA-NAO-E-VAZIO.md` §10.
>
> - **Onda BO — Operação, presença e avançado dentro da arena** (2026-09-24,
>   I-8, a última parte da integração): com ela, **todo módulo de arena que
>   tem tela está integrado** — nenhum vira mais botão para fora. A operação
>   virou a seção **Operação** da Central (Hoje · Rotinas · Manutenção ·
>   Equipamentos), com cada número de "Hoje" levando à aba que resolve; o
>   plantão foi para Equipe e parceiros; a presença virou a aba **Presença** de
>   Reservas; e a página-gaveta **"Avançado" deixou de existir** — Marca em
>   Perfil, Rede e Inteligência em Desempenho. O atleta ganhou **"Outras
>   unidades da rede"** na página da arena (sem prometer que o plano vale nelas).
>   **🐞 E as telas trazidas para a Central tratavam falha como vazio**, o que na
>   operação é pior que em qualquer lugar: "Nada pendente. A rotina do dia está
>   em dia." com a consulta falhando; e, no plantão, "Ninguém cadastrado" com
>   "Cadastrar a equipe" — como a equipe é UMA lista gravada inteira, salvar
>   **apagaria a equipe existente**. Também "Criar rede" e "Criar a primeira
>   rotina" sobre uma leitura que falhou (duplicatas) e a taxa de falta de um
>   dia vazio que não aconteceu. Agora cada uma mostra o erro com "Tentar de
>   novo" e esconde o comando que depende de ver o estado. **Banco: zero.** Ver
>   `docs/24-MODULOS-DE-ARENA/09-INTEGRACAO-NA-ARENA.md` §11.
>
> - **Onda BN — Marketing dentro da arena, e o documento que ainda não
>   existe** (2026-09-24, I-7 da integração): o console de marketing virou a
>   seção **Marketing** da Central (Cupons · Campanhas · Satisfação ·
>   Indicações, uma aba por ferramenta ligada). O cupom ganhou **"Divulgar na
>   página da arena"**: vira PROMOÇÃO, aparece na página da arena logo depois
>   dos preços e no pedido de reserva com um toque para aplicar — antes a
>   promoção só chegava a quem já tinha o código. E o **"Indique e ganhe"** foi
>   para a página da arena, para qualquer pessoa logada (antes só membro, e só
>   com o módulo de membros ligado, embora a indicação dependa só do
>   marketing), criado quando a pessoa pede.
>
>   **🐞 E o código nunca aparecia — nem ali, nem antes.** Membro, carteira,
>   mensalidade e indicação têm id `{arena}_{uid}` e o código lê antes de
>   criar; a regra de leitura olha `resource.data`, que num documento
>   inexistente é nulo, e o `get` dava **erro de permissão** para o atleta e
>   para a arena. Medido no emulador, isso escondia: o código de indicação
>   **nunca criado**; a arena **sem conseguir vender pacote a quem ainda não
>   era membro** (o caso normal do pedido de pacote da Onda BI); o **primeiro
>   crédito em carteira recusado** (e, por baixo, a carteira nova gravada sem
>   `arena_id`); o **saldo de não membro não debitado** na reserva (os pontos
>   tentavam criar um membro sem `arena_id` e o lote inteiro caía); **tornar
>   membro zerava a carteira** (dois `setDoc` sem `merge`); e três leituras
>   recusadas a cada visita de não membro. Correção: uma regra ADITIVA
>   (`canGetMissingArenaUserDoc` — o `get` de documento inexistente é do dono
>   do uid, da arena do prefixo e do admin; não abre documento existente nem
>   muda consulta), com **28 asserções novas no emulador**, e três correções de
>   código com teste. **Zero coleção, zero índice**; um campo opcional
>   (`arena_coupons.show_public`). Ver
>   `docs/24-MODULOS-DE-ARENA/09-INTEGRACAO-NA-ARENA.md` §10.
>
> - **Onda BM — A loja do app vira um canal do Mercado** (2026-09-24, I-6 da
>   integração): a arena tinha DOIS cadastros de produto sem ligação — o
>   Mercado (entradas, saídas, estoque, financeiro) e o catálogo próprio da
>   loja, com outro estoque. Agora o Mercado é o cadastro: o produto ganha
>   **"Vender pelo app"**, a vitrine aparece na página da arena (seção
>   **Loja**), o pedido é precificado pelo BANCO, a arena é **avisada** (antes
>   nunca era) e o balcão é a aba **Pedidos do app** da Central — onde
>   "Entreguei" vira saída do Mercado. **Minhas reservas** ganhou "Compras nas
>   arenas". No caminho, oito defeitos: 🐞 quem dividia a conta **não lia a
>   venda** (não via a própria parte); 🐞 o comprador criava a venda já
>   "paga"/"entregue"; 🐞 quem pagava marcava o próprio pagamento como pago;
>   🐞 qualquer conta semeava pagamentos em qualquer arena; 🐞 **a conta
>   dividida fechava como paga com gente devendo**; 🐞 **as Métricas contavam
>   a venda da loja duas vezes**; 🐞 **o pedido de pacote e a entrada no jogo
>   aberto nunca avisavam a arena** (`listArenaManagers` devolve documentos, e
>   o aviso ia para `"[object Object]"`); e o preço vinha da tela. **Zero
>   coleção, zero índice**; campos opcionais; regras de `arena_sales` e
>   `arena_payments` endurecidas com 20 asserções novas no emulador. Ver
>   `docs/24-MODULOS-DE-ARENA/09-INTEGRACAO-NA-ARENA.md` §9.
>
> - **Onda BL — Jogo aberto dentro da arena** (2026-09-24, I-5 da integração):
>   *"vamos fazer o mesmo tipo de integração para os demais módulos v3"*. O
>   jogo aberto e o buscar parceiro deixaram de ser botões para fora: viraram a
>   seção **Jogo aberto** da Central e a seção **Jogos abertos** da página da
>   arena, com "Quero jogar" ali mesmo e a chamada da fila (que tem prazo) em
>   destaque. E foram além da arena: **Minhas reservas** passou a mostrar os
>   jogos e as filas de todas as arenas, e **Procura-se jogo** os jogos com
>   vaga que as arenas publicaram (o hook global existia e nenhuma tela usava).
>   Na Central a arena passou a ver **quem vem jogar e quem está na fila** —
>   antes via "3 de 4" sem saber quem eram os três. Uma regra só decide "tem
>   vaga" e o botão da vaga em todas as telas. **Zero banco.** Ver
>   `docs/24-MODULOS-DE-ARENA/09-INTEGRACAO-NA-ARENA.md` §8.
>
> - **Onda BK — As funções do PickleRush num codebase próprio, com vigilância**
>   (2026-09-24): *"você não consegue isolar por completo o repositório e o
>   banco do PickleRush?"*. Dentro de um projeto Firebase compartilhado, por
>   completo não — mas o que apagava as nossas funções era o codebase comum.
>   Agora elas vivem no codebase `picklerush` (a CLI só apaga funções do MESMO
>   codebase — conferido no código dela), são publicadas por nome num script
>   único, e uma vigilância a cada 30 min recria o que sumir e avisa por
>   e-mail. O que segue compartilhado está escrito em `docs/03-WORKFLOW.md`
>   §9.1: Auth, bucket do Storage e a conta de serviço. Zero banco.
>
> - **Onda BJ — Um escritor só para o ranking, e a recuperação do gatilho
>   perdido** (2026-09-24): relatado — *"o rating voltou a calcular, mas os
>   demais ranking e duplas não estão atualizando automaticamente"*. Medido na
>   produção pela leitura pública: a última passada do SERVIDOR era de **18/09**;
>   o dia de jogo publicado em 22/09 caiu na janela em que o deploy de outro
>   aplicativo do mesmo projeto tinha apagado as funções, e gatilho não tem
>   fila. O ELO e as duplas "andaram" (22/09 14:54) só porque **o navegador do
>   admin** os recalculava a cada visita — um segundo escritor que nunca tocava
>   o 2.0–8.0. Três rankings discordando, sem nada na tela avisar.
>   **(1) O cliente parou de gravar ranking** (V2Layout, painel do torneio,
>   hooks e serviços de escrita), com guarda de fonte varrendo `src/`.
>   **(2) A regra recusa escrita de ranking para todo mundo, inclusive o
>   admin** — senão uma aba numa versão antiga continuaria gravando.
>   **(3) Recuperação agendada** (`catchUpPlatformRankings`, 30 min): compara a
>   impressão da última passada com o banco e recalcula só se faltou; na
>   primeira execução após o deploy ela recalcula e põe tudo em dia.
>   **(4) O histórico de ELO só ganha ponto quando o rating muda.**
>   **(5) O painel admin mostra a última passada do servidor** e o erro
>   recente. Zero coleção, zero índice; uma função nova; regra ENDURECIDA em
>   cinco coleções. Ver `docs/18-RANKINGS.md` §3 e §8.1.
>
> - **Onda BI — Pacote de horas: o atleta pede, a arena confirma**
>   (2026-09-24): o botão "Comprar" pacote gravava a carteira pelo atleta e
>   **falhava sempre** — a regra, com razão, só deixa a arena escrever
>   carteira. Virou pedido: o atleta toca "Quero este pacote", a arena recebe
>   o aviso que abre a Central direto na confirmação ("Recebi o pagamento —
>   creditar"), e as horas entram na carteira na hora. A mesma venda serve ao
>   balcão ("Vender pacote" em cada membro). Zero coleção — o pedido vive no
>   aviso. Ver `docs/24-MODULOS-DE-ARENA/02-MEMBROS.md`.
>
> - **Onda BH — O jogo aberto, a fila, as indicações e o caixa passam a
>   funcionar** (2026-09-24): uma sonda no emulador, feita para conferir as
>   consultas de outros módulos, achou que **o jogo aberto nunca funcionou para
>   o atleta**: entrar grava na vaga, e só a arena atualizava a vaga; entrar na
>   fila exige ler a fila, e o atleta não podia; aceitar/recusar a chamada é
>   atualizar a própria entrada, e só a arena podia; e "chamar o próximo" era
>   o navegador de quem saía escrevendo na entrada de outra pessoa. Agora as
>   regras deixam cada um mexer **só em si mesmo** (25 asserções novas) e
>   quem chama o próximo é o **servidor**, numa transação, na hora (dois
>   gatilhos novos). De quebra: **🐞 a arena nunca conseguiu resgatar uma
>   indicação** (não lia as próprias) e **🐞 confirmar pagamento no caixa
>   quebrava no meio** (a venda nunca virava paga) — as duas eram consultas que
>   a regra não conseguia provar. E o prazo da chamada era 5 min no aviso e 60
>   no servidor: agora é um só. **Zero coleção, zero índice, zero campo.**
>   Ver `docs/24-MODULOS-DE-ARENA/01-MATCHMAKING.md` (atualização 2026-09-24).
>
> - **Onda BG — Torneios dentro da arena** (2026-09-24): a terceira parte
>   da integração. **Torneios virou seção da Central**, com os torneios DA
>   CASA e — pela primeira vez na gestão — os DA PLATAFORMA sediados na arena
>   (antes só apareciam na página pública), com "Criar torneio aqui" já com a
>   arena escolhida. A página da arena ganhou **"Torneios da casa"** (inscrição
>   ali mesmo, o que está rolando, o topo do ladder) e "Meus torneios" passou a
>   mostrar os da casa. E o ciclo, que **nunca tinha fechado uma vez**, fechou:
>   **🐞 o atleta não conseguia se inscrever** — a inscrição grava no
>   documento do torneio e a regra só deixava a arena atualizá-lo; e **🐞
>   "Encerrar" não tinha botão**, então o ladder nunca pontuava. Agora
>   "Encerrar e pontuar" monta o pódio do ranking do dia, mostra os pontos de
>   cada um antes de confirmar, e o serviço confere no banco para não somar
>   duas vezes. De quebra: a chave de cache dos torneios da casa era o prefixo
>   da dos torneios da plataforma, e a página pública mostrava status cru e
>   rascunhos. Regra ampliada só para o atleta entrar/sair A SI MESMO, com dez
>   asserções no emulador. **Zero coleção, zero índice, zero campo.** Ver
>   `docs/24-MODULOS-DE-ARENA/09-INTEGRACAO-NA-ARENA.md` §6.
>
> - **Onda BF — Aulas e professores dentro da arena** (2026-09-24): a
>   segunda parte do pedido de integração. **Aulas virou seção da Central**
>   (Agenda · Professores) e a página da arena ganhou **"Aulas e
>   professores"**, com as próximas aulas e a matrícula ali mesmo. Os DOIS
>   cadastros de professor — parceiro da plataforma e professor das aulas —
>   viraram **uma lista**, juntada pela conta da pessoa, com "Colocar nas
>   aulas" num toque para o parceiro que ainda não dá aula. `/minhas-aulas`
>   passou a mostrar as matrículas de todas as arenas, e `/aulas` as aulas que
>   o professor dá nelas. **Cinco defeitos** no caminho: **🐞 o professor
>   não via os alunos** da própria aula (a regra não deixava, e o erro virava
>   "ninguém matriculado" com a turma cheia); **🐞 a aula marcada como "dada"
>   sumia**, e com ela o botão de registrar o pagamento de quem esteve lá;
>   **🐞 a matrícula gravava `partner: true` fixo** — o professor da casa
>   pagava comissão à própria arena; **🐞 comissão de 0% virava 20%**; e o
>   **corte da lista levava as aulas FUTURAS** (passando de cem aulas nunca
>   marcadas como dadas, a de amanhã deixava de ocupar a quadra). E **🐞 a
>   ARENA também não via os alunos**: a consulta filtrava só por aula, a
>   regra confere a arena, e o Firestore recusava tudo — cancelar a aula
>   quebrava no meio, sem avisar ninguém. A única
>   regra tocada, `arena_class_bookings`, **abriu** a leitura ao professor da
>   aula (pelo cadastro que só a arena escreve) e **fechou** o que estava
>   aberto: o aluno se matriculava já "pago", marcava a própria matrícula como
>   paga e podia plantá-la na lista de outra arena. Quinze asserções novas no
>   emulador. **Zero coleção, zero índice, zero campo.** Ver
>   `docs/24-MODULOS-DE-ARENA/09-INTEGRACAO-NA-ARENA.md` §5.
>
> - **Onda BE — Membros dentro da arena** (2026-09-24): *"os módulos da
>   arena V3 estão um tanto separados do restante da arena… precisamos
>   integrar esses módulos dentro da arena e não como algo adicional"*. O
>   levantamento achou cinco causas — só a primeira de aparência: cada módulo
>   era uma página alcançada por um BOTÃO; dois cadastros de professor sem
>   ligação; dois lugares de torneio que não se viam; o atleta não achava o
>   que é dele; e membro e cliente eram dois mundos. Esta onda resolve
>   Membros e a base de todas: **a Central passou a ter endereço** (`?aba=`,
>   `?secao=` pelos links antigos) — ela NÃO lia a URL, e todo "abrir os
>   módulos" / "abrir o mercado" das outras telas caía em Reservas (quatro
>   links mortos, três escritos nas ondas anteriores). Membros virou **seção
>   da Central** (Membros · Pacotes de horas), a aba **Clientes** passou a
>   mostrar o nível de quem é membro e **"Tornar membro"** para quem reservou
>   3+ vezes e ainda não é, e a página da arena ganhou **"Planos e
>   vantagens"** logo depois dos Preços — é olhando o preço da hora avulsa que
>   se decide comprar pacote. O módulo é `native` no catálogo: sem botão de
>   atalho para fora, e a rota antiga vira a aba certa. **Zero banco.** Ver
>   `docs/24-MODULOS-DE-ARENA/09-INTEGRACAO-NA-ARENA.md`.
>
> - **Onda BD — Excluir cadastro** (2026-09-24): *"há muitos cadastros de
>   exemplo e mock que foram criados e quero poder excluí-los"*. A primeira
>   descoberta decidiu o desenho: **conta de teste é conta de verdade** — todo
>   `users/{uid}` nasce do login, e apagar só os documentos faz o cadastro
>   VOLTAR no próximo login. Só o Admin SDK apaga a conta do Firebase
>   Authentication, e o admin, pelas regras, nem alcança tokens, favoritos,
>   votos, conversas e fotos. Então a exclusão é uma **função de servidor**
>   (`adminDeleteAccounts`), seguindo a tabela que já estava aprovada em
>   `09-DIREITOS-DO-TITULAR.md` §4: identidade e login **apagados**, histórico
>   esportivo **pseudonimizado** ("Atleta removido" — apagar reescreveria o
>   resultado e o rating de outras pessoas), reservas e pagamentos **retidos
>   sem o nome**, auditoria e consentimentos **retidos**. Prévia do servidor
>   antes de executar (a execução refaz a análise, nunca age sobre plano vindo
>   do navegador), motivo + `EXCLUIR`, 25 por vez, **só o dono executa**, e a
>   ordem que tolera falha: login PRIMEIRO, `users` POR ÚLTIMO. Impede quem
>   quebraria o serviço de outra pessoa (dona de arena, única admin de clube,
>   torneio vivo, dia de jogo futuro com gente, saldo em carteira). Na tela, o
>   filtro **Parecem de teste** sugere e MOSTRA o porquê — por palavra
>   inteira, para "Ernesto" e "Demóstenes" não caírem. **Três armadilhas
>   evitadas**: no jogo, `slot.id` é id de participante e não uid; o rótulo
>   "A / B" é derivado e os grupos o copiam; eventos de clube são achados por
>   presenças que a própria exclusão apaga. A cascata é testada contra um
>   Firestore falso com as especificações reais — **nenhum documento de outra
>   pessoa é apagado**. **Zero coleção, zero índice, zero regra**; uma função
>   nova. Ver `docs/20-SEGURANCA-E-PRIVACIDADE/18-CADASTROS-ADMIN.md`.
>
> - **Onda BC — Um cartão só, que abre** (2026-09-21): relatado sobre a onda
>   anterior, olhando a tela: *"a configuração da quantidade de quadras ainda
>   não libera as quadras e jogos abaixo"*, *"observe o espaço entre um card e
>   outro"* e *"os cards de configurações e de organização podem ser
>   unificados… seria mais fácil configurar abrindo o card do que clicando num
>   botão para abrir o modal"*. Os três procediam.
>
>   **🐞 (1) "Quem organiza as partidas" existia em DOIS cartões.** O cartão
>   *Organização* já trazia o modo de gestão desde a Onda T, montado por cada
>   um dos três organizadores; a Onda BB criou o mesmo campo no cartão de
>   configurações. Dois escritores no mesmo campo — exatamente o que aquela
>   onda dizia estar evitando. ⚠️ **E corrige o registro da BB**: o clube
>   *tinha* onde dizer quem conduz o dia (dentro de *Organização*); o que ele
>   não tinha era o número de quadras nos formatos de grade e um lugar óbvio
>   para as configurações.
>
>   **(2) A configuração estava repartida em três lugares** — formato e quadras
>   num cartão, quem organiza noutro, e nome/data/local atrás de um botão que
>   abria um modal. Agora é **um cartão, três seções**, montado pelo módulo:
>   `GameDayAdminsCard` deixou de existir (com as suas três montagens, uma por
>   organizador) e `CreateGameDayDialog` passou a só CRIAR — o botão "Editar"
>   saiu do cabeçalho. Configurar é parte de organizar o dia, não um desvio
>   para outra tela. **Arquivar** ficou: é o único ato que TIRA o dia da tela.
>   O cartão nasce recolhido, com resumo, porque aberto empurraria
>   participantes e quadras para baixo de quem está conduzindo o dia.
>
>   **🐞 (3) O espaçamento mudava a cada cartão.** `GameDayModule` devolvia um
>   FRAGMENTO: o cartão de regras carregava `mb-4` próprio, o de configurações
>   não tinha margem nenhuma e o organizador trazia o seu `space-y` por dentro.
>   E mudava por ORIGEM — o clube somava o `space-y` dele por fora, o atleta
>   não envolvia em nada e na arena o painel de Vagas encostava no cartão
>   seguinte. Agora o container é do módulo, e um teste de renderização reprova
>   filho que volte a se espaçar sozinho (é invisível a teste de
>   comportamento: tela desalinhada renderiza igual a tela alinhada).
>
>   **(4) E a quadra passou a dizer o que FAZER.** *"Faltam 4 jogador(es)
>   disponível(is)"* está correto e não ajuda: num dia recém criado o que trava
>   a quadra não é a quadra — é não haver ninguém. Quem organiza lê aquilo como
>   limite do sistema e vai procurar uma configuração que não existe. Foi
>   assim que "a quantidade de quadras não libera as quadras" chegou como
>   relato; o número de quadras sempre funcionou (há invalidação de cache
>   conferida). Com o dia vazio, a seção agora aponta **Inserir atletas**, e a
>   mensagem por quadra separa "sem atletas no dia ainda" de "ninguém livre
>   agora".
>
>   **Banco: zero.** Nenhuma coleção, campo, índice, regra, função ou
>   migração. +10 testes. Ver `docs/25-DIA-DE-JOGO-COMO-MODULO.md` §9.
>
> - **Onda BB — As configurações do dia de jogo, iguais em toda origem**
>   (2026-09-21): relatado em uso — *"no dia de jogo criado em clube não é
>   possível fazer as mesmas edições e configurações do dia de jogo do jogar;
>   por exemplo, não é possível indicar o número de quadras"*. E era isso mesmo.
>
>   A Onda AS unificou o **miolo** do dia de jogo e deixou de fora o que vem
>   antes dele: **o que dá para mudar**. Isso continuou montado origem a origem,
>   e as três divergiram — a mesma doença, um andar acima.
>
>   **🐞 (1) O clube não tinha como dizer quem conduz o dia.** Ele nasce
>   `manage_mode: 'participants'` de propósito (o evento legado era assim), e
>   não existia **nenhum** lugar para fechar. Um clube que quisesse o sorteio só
>   com a organização simplesmente não podia. O atleta e a arena tinham a opção
>   nos seus diálogos desde a Onda T.
>
>   **🐞 (2) E não achava o número de quadras.** Uma data de clube nasce em
>   **Americano**, que é formato de GRADE — e nos formatos de grade o campo não
>   aparecia em configuração nenhuma, **em nenhuma origem**. O número existia só
>   como um campo de texto **transitório dentro do diálogo de sorteio**:
>   redigitado a cada sorteio, invisível no resto da tela e nunca gravado.
>
>   **A correção.** As três configurações que não dependem da origem — formato,
>   quadras e quem organiza — viraram `GameDaySettingsCard`, montado **dentro do
>   `GameDayModule`**, que é o que as faz chegar às três origens por construção.
>   Uma diferença legítima sobrou: na **arena** as quadras são de leitura, porque
>   lá elas não são um número solto — são as quadras e horários **reservados no
>   calendário**, que fecham a grade para reserva.
>
>   **Um campo, um dono.** Os diálogos de criação seguem oferecendo os três; na
>   **edição** não, porque dois lugares editando o mesmo campo divergem — foi
>   exatamente assim que o clube ficou para trás. O diálogo do atleta, na
>   edição, diz onde eles foram parar.
>
>   **E as quadras viraram propriedade do dia**: nos formatos de grade o diálogo
>   de sorteio passou a ser semeado por `play_courts` — ⚠️ só a partir de **2**,
>   porque `play_courts` nasce valendo 1 em toda criação, inclusive onde nunca
>   significou nada; tratar esse 1 como escolha transformaria todo Americano já
>   existente num dia de uma quadra só.
>
>   **De quebra, a porta estreita do legado.** A data anterior à Onda AS segue
>   no organizador de sempre e **nada é migrado** — converter uma data com gente
>   ou jogo esconderia documentos que seguem no banco, e um dia já publicado
>   costuma estar no ranking de quem jogou. Mas a data ainda **vazia** não tem
>   nada para mover: ali a conversão é opt-in, com confirmação, e libera Play,
>   Americano aprimorado, telão, tutorial e as configurações. Consulta falhando
>   **não** conta como vazio.
>
>   **Banco: zero.** Nenhuma coleção, campo, índice, regra, função ou migração.
>   +25 testes. Ver `docs/25-DIA-DE-JOGO-COMO-MODULO.md` §8.
>
> - **Onda BA — A lista à mão virou varredura** (2026-09-20): a onda que
>   descobriu que **o guarda tinha a mesma doença que veio tratar**.
>
>   As Ondas AV, AW e AZ declararam a classe "falha não é lista vazia" fechada
>   — três vezes. O guarda que deveria garantir isso tinha uma **lista escrita
>   à mão** de telas, e lista à mão só sabe o que alguém lembrou de colocar
>   nela: é exatamente o *"confiar em quem lembrar"* que esta série documenta
>   em todas as outras páginas. Trocada por uma **varredura automática** do
>   escopo, apareceram **onze telas ainda vivas**.
>
>   **🐞 As duas que mais custam.** A **LISTA de torneios** — a porta de
>   entrada de toda a área — dizia *"Você ainda não tem torneios"* para quem
>   tem, e o desfecho é criar um duplicado. A **aba de modalidades** dizia
>   *"Comece criando a primeira modalidade"*: um convite a criar modalidade
>   DUPLICADA, com inscrições abertas.
>
>   **🐞 E o defeito de sorteio da Onda AW estava vivo no caminho LEGADO.** O
>   `GameDayOrganizer` do clube serve toda data anterior à Onda AS (não foi
>   migrado, de propósito), e a AW corrigiu só os três organizadores
>   modulares. Nele o `orderBase` continuava saindo dos jogos carregados: com
>   a consulta falhando ele vale 0 e a rodada nova nasce com a **mesma
>   numeração** das que já aconteceram.
>
>   **O resto**: visão de equipes, histórico de participação (*"Você ainda não
>   participou de nenhum torneio"* — apagar o histórico da pessoa na cara
>   dela), meus jogos (*"Nenhum jogo agendado"* faz alguém **não ir à
>   quadra**), o diálogo de dia de jogo da arena (*"cadastre as quadras"* — que
>   já estão cadastradas), buscar parceiro, e **três buscas de atleta** que
>   ofereciam *"preencha manualmente"* / *"use Convidado"*, criando inscrição
>   provisória para quem **já tem conta**.
>
>   **A correção estrutural.** `src/core/guards/afirmaVazio.js` varre o
>   diretório e examina **quem existe no escopo**, não quem foi lembrado. Os
>   hooks do próprio React ficam de fora do detector (`useMemo` não pode
>   falhar, e guarda que acusa inocente é guarda que alguém desliga). A
>   isenção continua possível e passa a exigir **motivo escrito**, conferido
>   por teste — hoje são cinco, de duas famílias só: fotos e texto que chega
>   por `props`.
>
>   **Banco: zero.** Nenhuma coleção, campo, índice, regra, função ou
>   migração. +19 testes. Ver `docs/27-FALHA-NAO-E-VAZIO.md` §9.
>
> - **Onda AZ — As telas públicas do torneio** (2026-09-20): as ondas AV e AW
>   fecharam a classe "falha não é vazio" **dentro** do aplicativo, e a AX
>   endureceu o telão. Ficaram de fora **quatro telas** — e não por descuido de
>   julgamento, mas porque a varredura tinha sido feita por PASTA: elas são V1,
>   roteadas direto em `src/App.jsx`, fora da árvore do V2. São exatamente as
>   que chegam a **quem não tem conta**.
>
>   **🐞 (1) `/p/:id` culpava o link da pessoa.** A página pública do torneio —
>   a que se manda por WhatsApp para espectador, familiar e jogador a caminho —
>   decidia por `if (!tournament)` e dizia *"Torneio não encontrado. **Verifique
>   o link recebido**"*. Numa falha de rede, a frase acusa justamente o que essa
>   pessoa não tem como conferir: o desfecho previsível é ela cobrar do
>   organizador um link que está certo. Mais três consultas por modalidade
>   tinham o mesmo defeito, cada uma com um sintoma diferente e silencioso —
>   sem os jogos, *"Jogos ainda não publicados"*; sem o ranking, a
>   classificação some; **sem os inscritos, `renderSide` cai no `id` e o
>   público lê identificadores do banco no lugar dos nomes**.
>
>   **🐞 (2) `/c/:clubId` era pior.** A falha virava uma AFIRMAÇÃO sobre a
>   escolha do clube — *"Clube não disponível publicamente"* — e oferecia, como
>   saída, **criar uma conta**, que não resolveria nada. Uma queda de rede
>   empurrando alguém para um cadastro inútil.
>
>   **🐞 (3) A impressão ficava em "Carregando…" para sempre.** `if
>   (!tournament) return 'Carregando…'` cobria os três desfechos, e quem ia
>   imprimir as chaves minutos antes do jogo encarava uma reticência eterna,
>   sem saber que havia falhado e sem nada em que clicar. **E o caso mais caro
>   da classe inteira mora aqui: o papel sobrevive à tela.** Modalidade que não
>   carregou não sai na folha, e a folha vai para a mesa da organização
>   **parecendo completa** — ninguém desconfia de uma ausência. Por isso este é
>   o único aviso da plataforma que **precisa ser impresso junto**.
>
>   **🐞 (4) O telão do TORNEIO tinha os quatro defeitos da Onda AX.** Mesma
>   exposição (horas numa TV na beira da quadra, ciclo de 20 s), e `isError`
>   ignorado por completo: numa falha as três seções afirmavam *"Nenhum jogo em
>   andamento"*, *"Sem próximos jogos"*, *"Sem resultados ainda"* — com o
>   torneio rolando. O pulso "ao vivo" era fixo, não havia `wakeLock` e não
>   havia estado de erro. Ganhou as mesmas peças do telão do dia de jogo.
>
>   **De quebra, um relógio só.** Os dois telões tinham cópias de `useRelogio`.
>   Não é apresentação: é o **mesmo instante** que mostra a hora e mede o
>   atraso do painel — duas cópias com tiques diferentes dariam tolerâncias
>   diferentes para a MESMA regra, sem nada na tela denunciando.
>
>   **A lição é a da série inteira, pela quarta vez**: a peça certa já existia,
>   testada e em produção, e não chegou aqui porque a tela mora noutra pasta.
>   Por isso o guarda passou a varrer os **dois** telões e as **duas** páginas
>   públicas, em lista, em vez de confiar em quem lembrar.
>
>   **Banco: zero.** Nenhuma coleção, campo, índice, regra, função ou migração.
>   +15 testes de guarda. Ver `docs/27-FALHA-NAO-E-VAZIO.md` §8 e
>   `docs/14-DIA-DE-JOGO-TELAO.md` §5.
>
> - **Onda AY — Um erro numa tela não derruba o aplicativo** (2026-09-20):
>   o `ErrorBoundary` global fica **acima do Router** (`main.jsx`) e **nunca
>   reseta**. Junte as duas coisas: um defeito em UMA tela — uma aba de
>   torneio, o organizador do dia de jogo, um componente que recebeu um
>   documento inesperado — substituía o **aplicativo inteiro** por "Algo deu
>   errado. Recarregue a página". Sem barra lateral, sem navegação, sem voltar.
>   Quem estava conduzindo um torneio perdia o lugar onde estava porque uma
>   aba quebrou.
>
>   **E o mecanismo certo já existia — no lugar errado.**
>   `GamificationErrorBoundary` faz exatamente o necessário (isola a rota,
>   recado amigável, "tentar de novo", resto da plataforma de pé), e era usado
>   em cinco rotas de gamificação — atrás de uma flag **desligada**. É a mesma
>   família do defeito da Onda AU: a ferramenta certa, construída e testada,
>   guardada onde não fazia falta.
>
>   **O telão precisava de outra coisa.** Ele fica horas sozinho numa TV, e ali
>   "clique para tentar de novo" não serve — não há ninguém para clicar. Com
>   `unattended` ele tenta sozinho, com espera crescente (3 s, 6 s, 12 s) e
>   **limite**: tentar para sempre sobre um defeito real é um laço que ninguém
>   vê, queimando bateria a noite inteira.
>
>   **De quebra, a versão velha pós-deploy deixou de ser tratada como bug.** A
>   plataforma publica a cada push e a aba de quem está num torneio fica aberta
>   o dia todo, apontando para pedaços de código que já não existem.
>   `isChunkLoadError` reconhece o caso e a tela diz a verdade — *"Uma versão
>   nova foi publicada"* — com o botão que resolve: **Recarregar**. "Tentar de
>   novo" ali nunca resolveria.
>
>   **Banco: zero.** Ver `docs/28-ERRO-NAO-DERRUBA-O-APP.md`.
>
> - **Onda AX — O telão aguenta o dia** (2026-09-20): a tela mais exposta da
>   plataforma — horas numa TV na beira da quadra, atualizando sozinha a cada
>   15 s — era frágil exatamente onde não podia ser.
>
>   **(1) 🐞 Uma falha de 15 s apagava o painel inteiro.** A tela decidia por
>   `isError || !gameDay`, e numa atualização de fundo o React Query **mantém o
>   dado** e só marca `isError`. Bastava UMA queda de rede — num ginásio, o
>   tempo todo — para o painel virar *"Dia de jogo não encontrado. Ele pode ter
>   sido arquivado"*, na frente de todo mundo, com o estado bom na memória. É o
>   caso mais caro da classe da Onda AV, e o que tem a maior plateia.
>
>   **(2) Continuar mostrando não pode virar mentir.** Depois de 60 s sem
>   atualizar, o telão DIZ há quanto tempo está parado e o pulso "ao vivo" para
>   de pulsar. A tolerância é de propósito: piscar "desatualizado" a cada ciclo
>   ensinaria a ignorar o aviso inclusive quando ele importa.
>
>   **(3) 🐞 E a tela apagava sozinha.** Não havia `wakeLock` em lugar nenhum
>   do projeto: um tablet apaga em 30 s–2 min sem toque, então alguém tinha de
>   cutucar o aparelho a noite inteira — uma funcionalidade inteira inutilizada
>   por um detalhe do sistema operacional. As duas sutilezas que separam
>   funcionar de parecer funcionar: o bloqueio é **perdido ao esconder a aba** e
>   precisa ser re-pedido (senão acende uma vez só), e o navegador **pode
>   recusar**, então o indicador só aparece quando está valendo.
>
>   De quebra, os dois últimos botões só-ícone sem nome acessível do dia de
>   jogo ganharam rótulo — o leitor de tela anunciava "botão" e nada mais.
>
>   **Banco: zero.** Ver `docs/14-DIA-DE-JOGO-TELAO.md`.
>
> - **Onda AW — A classe fechada** (2026-09-20): a AV cobriu as sete telas onde
>   a mentira era mais cara; esta fecha o resto do dia de jogo e do torneio —
>   resultados do torneio (*"Nenhum jogo gerado ainda"* na aba de RESULTADOS,
>   com os jogos acontecendo), operação, convites abertos e os três
>   organizadores de dia de jogo (*"Nenhum participante ainda"* com doze
>   pessoas na quadra).
>
>   **🐞 E o dia de jogo tinha a própria versão do sorteio cego.** No torneio,
>   sortear sobre estado desconhecido APAGAVA jogos disputados; aqui o estrago
>   é mais silencioso: o **`orderBase`** sai dos jogos já carregados, então com
>   a consulta falhando ele vale 0 e a rodada nova nasce com a **mesma
>   numeração** das que já aconteceram — duas "rodada 1" no mesmo dia, sem erro
>   nenhum na tela. Mesma regra da AV: comando sobre estado desconhecido não é
>   renderizado.
>
>   De quebra, um falso positivo que vale registrar: 38 diálogos pareciam sem
>   proteção de altura (o gotcha do rodapé cortado em paisagem), mas
>   `DialogContent` e `AlertDialogContent` **já trazem** `max-h-[90dvh]
>   overflow-y-auto` na base — conferido antes de "corrigir" 38 arquivos à toa.
>
>   **Banco: zero.**
>
> - **Onda AV — Falha não é lista vazia** (2026-09-20): auditoria do dia de
>   jogo com a lente da usabilidade, e o achado é uma classe inteira.
>
>   **(1) 🐞 28 de 30 telas tratavam falha de rede como "não existe".** O
>   padrão do projeto é `const { data = [] } = useX()`; numa falha, `data` vem
>   indefinido, cai no `[]` e a tela AFIRMA o vazio. Só que vazio quase nunca é
>   neutro: *"Nenhum dia de jogo ainda"* para quem tem dez, *"Dia de jogo não
>   encontrado — pode ter sido removido ou você não tem acesso"* na beira da
>   quadra, *"Torneio não encontrado. Verifique o link"* com o link certo.
>   Quem lê isso não tenta de novo: acredita, e vai criar um duplicado ou ligar
>   para o suporte. A mesma classe tinha sido corrigida na ARENA na Onda AE e
>   nunca chegou ao dia de jogo nem ao torneio.
>
>   **(2) 🐞 E o caso grave: o sorteio apagando o que não viu.**
>   `persistMatches` apaga TODOS os jogos da fase antes de gravar os novos — é
>   o que faz "re-sortear" funcionar, e a tela avisa disso. Só que o aviso era
>   decidido por `matches.length`. Com a consulta falhando: o botão vira
>   **"Sortear"** em vez de "Re-sortear", o cabeçalho diz "nenhum jogo gerado
>   ainda", o diálogo diz que vai **gerar** e **não menciona que apaga** — e o
>   organizador confirma. Resultado de torneio destruído por uma queda de rede,
>   sem ninguém ter como perceber. Fechado nos dois níveis: a tela **não
>   renderiza** comando sobre estado desconhecido (a regra do dia de jogo:
>   comando sem atribuição não aparece, nunca só desabilitado), e o serviço
>   **recusa** descartar jogo COM RESULTADO sem reconhecimento explícito. Jogo
>   sem resultado segue livre de propósito — confirmação demais treina a pessoa
>   a clicar em "sim" sem ler, e aí a confirmação que importa passa batida.
>
>   **(3) O dia de jogo não dizia o que ele É.** O cabeçalho tinha título,
>   origem, data e observações — **nem o formato**, que é o que decide se há
>   placar, ranking do dia, publicação no ranking da plataforma e dupla
>   vinculada. Pior: a LISTA da arena já mostrava o formato num selo, e a tela
>   do dia não — a lista dizia mais que o detalhe. Agora há um resumo, e ele
>   mora dentro do `GameDayModule`, para chegar às três origens **por
>   construção** — que é o antídoto da doença da Onda AS (o clube meses sem
>   Play e sem telão porque cada tela montava o próprio miolo).
>
>   **(4) Uma peça só para "falhou".** O bloco de erro estava escrito à mão em
>   SETE lugares e não havia primitivo: agora é `V2ErrorState`, que nunca diz
>   que o dado não existe, sempre oferece o caminho de volta e não despeja erro
>   técnico na cara de ninguém.
>
>   **(5) Nove componentes V1 de clube removidos**, sem caminho a partir de
>   `main.jsx`. Entre eles `EventDatesPanel.jsx`, gêmeo obsoleto do
>   `V2EventDatesPanel` que a Onda AS modificou e que **não conhece
>   `game_day_id`** — a mesma armadilha do `TournamentDrawTab` (AU) e do
>   `V2GameDayOrganizer` (AS).
>
>   **Banco: zero.** Nenhuma coleção, campo, índice, regra, função ou migração.
>   +68 testes. Ver `docs/27-FALHA-NAO-E-VAZIO.md`.
>
> - **Onda AU — A Onda AT chega onde ela fazia sentido** (2026-09-20):
>   auditoria do que a onda anterior entregou, e o achado foi constrangedor.
>
>   **(1) 🐞 A ENTRADA DIRETA era inalcançável em produção.** A aba de sorteio
>   tem dois ramos — `stages.length > 1` manda para o `MultiPhaseDrawBlock`, o
>   resto fica no `ModalityDrawBlock`. A Onda AT montou o planejador de grupos
>   e o painel de entrada direta **só no segundo**. E `DirectEntryPanel` começa
>   com `if (fases.length < 2) return null`: pular fase exige fase para pular.
>   Ou seja, a funcionalidade-título daquela onda foi montada **exatamente no
>   ramo onde ela nunca renderiza**, e faltava no único ramo em que ela
>   significa alguma coisa. Nenhum teste de comportamento pegava — cada tela,
>   isolada, funcionava. É a família do console de marketing da Onda AJ (módulo
>   ligado, tela inalcançável) e das quatro cópias do `handleDraw` da AS.
>   Corrigido nos dois ramos, com **guarda de fonte** travando o par.
>
>   **(2) A fase não dizia quais regras estavam em vigor.** A AT deu oito
>   controles ao admin; eles se configuram em **Modalidades** e o torneio se
>   sorteia em **Sorteio**. Quem organiza chegava no botão sem eco nenhum do
>   que tinha configurado — e esse botão faz uma conta invisível. Agora cada
>   fase mostra o que está valendo, **só o que foi MUDADO** por padrão (repetir
>   o padrão da plataforma para todo mundo vira paredão que ninguém lê), com
>   "ver todas as regras" ao lado. Linha que não se aplica **some**, não vira
>   "—".
>
>   **(3) "Gerar próxima fase" era caixa-preta.** O botão mais irreversível do
>   torneio classificava, comparava grupos desiguais, chamava repescados,
>   encaixava quem entra direto e sorteava — sem dizer nada antes. Agora a tela
>   mostra **quem passa, quem entra por repescagem e quem entra direto**, nome
>   por nome, e avisa quando ainda há jogo por decidir em vez de apresentar um
>   parcial como definitivo. ⚠️ A prévia e o avanço saem da **mesma função**
>   (`previewPhaseAdvance`): é a lição do dia de jogo, em que a previsão
>   anunciava uma partida e o sorteio criava outra — aqui o estrago seria
>   anunciar quem vai à próxima fase de um torneio.
>
>   **(4) 🐞 O tutorial ensinava uma regra revogada.** A Onda AR trocou o
>   gatilho do ranking de torneio do ENCERRAMENTO para o LANÇAMENTO, e o
>   tutorial seguia afirmando, com ênfase, *"torneio ainda em andamento não
>   pontua no ranking geral. É de propósito"* — a central de ajuda dizia o
>   mesmo. Tutorial errado é pior que tutorial nenhum: o organizador ia
>   procurar um botão de "encerrar" para liberar um ranking que já estava
>   atualizado. Corrigidos, com guarda comparando o texto contra
>   `RANKING_ELIGIBLE_STATUSES`. De quebra, a ajuda ganhou o artigo que faltava
>   — *"Quando o número de inscritos não é o ideal"* — e o tutorial passou a
>   ensinar planejador, repescagem, entrada direta e regras avançadas.
>
>   **(5) Onze componentes mortos removidos.** `TournamentAdminPanel` e as
>   cinco abas que ele montava, mais quatro cartões órfãos — sem nenhum caminho
>   a partir de `main.jsx` e fora do bundle. Entre eles, `TournamentDrawTab.jsx`,
>   uma **segunda cópia da aba de sorteio** importando o mesmo
>   `MultiPhaseDrawBlock`: exatamente a armadilha do `V2GameDayOrganizer` da
>   Onda AS. (Sobra um órfão conhecido, `services/courtService.js`, que ficou
>   de propósito por estar descrito no README do módulo.)
>
>   **Banco: zero.** Nenhuma coleção, campo, índice, regra, função ou migração.
>   Nenhum dado histórico lido ou reescrito. +46 testes.
>   Ver `docs/26-TORNEIO-FORMATOS-E-REGRAS.md` §11.
>
> - **Onda AT — O torneio com qualquer número de inscritos, e o admin no
>   comando** (2026-09-20): auditoria do torneio de ponta a ponta, com foco no
>   que ninguém tinha olhado: **o que acontece quando o número de inscritos não
>   é o ideal**.
>
>   **(1) 🐞 A chave incompleta nascia quebrada.** Dois defeitos no mesmo
>   lugar. A sequência canônica estava espelhada — numa chave de 8 o nº 1
>   estreava contra o nº 5, não contra o nº 8. E os não-cabeças eram despejados
>   nos slots vazios da ESQUERDA para a DIREITA, o que amontoava todo mundo na
>   metade de cima e deixava pares inteiros vazios: **uma chave de 16 com 9
>   inscritos nascia com TRÊS partidas de ninguém contra ninguém**, gravadas
>   como W.O. no banco, e um único bye entregue a quem calhasse. Agora todo
>   mundo entra pela posição canônica do seu número, o que dá exatamente
>   `tamanho − inscritos` byes, zero partida fantasma, e os byes nos **melhores
>   cabeças** — a regra do DUPR, que sai de graça da ordem certa.
>
>   **(2) 🐞 O desempate não tinha CONFRONTO DIRETO.** A ordem do regulamento
>   (USA Pickleball 15.B.4) põe o confronto direto logo depois das vitórias; a
>   plataforma pulava direto para o saldo. É a reclamação nº 1 de quadra — *"mas
>   eu ganhei dele"* — e quem organizava não tinha como explicar, porque a tela
>   mostrava o resultado certo de uma conta errada. Pior: a regra vivia
>   DUPLICADA em dois arquivos, as duas cópias igualmente erradas. Virou fonte
>   única, com mini-tabela para empate de três ou mais, recalculada a cada nível
>   (o empate menor é um empate NOVO).
>
>   **(3) Grupos desiguais deixaram de ser tratados como erro.** A tela avisava
>   *"para grupos do mesmo tamanho use um número de inscritos múltiplo de 4"* —
>   que é pedir para alguém desistir da inscrição. Grupo desigual é o caso
>   NORMAL de torneio amador; o que ele exige é a **regra de comparação certa**:
>   colocação primeiro, e dentro dela **aproveitamento**, não número absoluto
>   (3 vitórias em 3 vale mais que 3 em 4). No lugar do aviso inútil entrou um
>   **planejador**: dado o número real de inscritos, mostra as divisões viáveis
>   com jogos, jogos por atleta, classificados e se a chave fecha — e as
>   alternativas, na tela de sorteio, antes de clicar.
>
>   **(4) O que fazer quando os classificados não fecham a chave.** 10
>   classificados numa chave de 16 são 6 byes, e metade da primeira rodada não
>   acontece. Agora a plataforma mostra as duas saídas e implementa a primeira:
>   **repescagem** dos melhores da colocação seguinte ao corte, comparados entre
>   IGUAIS (um 4º nunca entra na frente de um 3º).
>
>   **(5) ⭐ Tudo passou a ser do ADMIN.** Existe um padrão bom e ele pode ser
>   trocado inteiro, com explicação ao lado de cada controle: tamanhos dos
>   grupos à mão, turnos (ida e volta, que é a saída para o grupo de 3),
>   classificados grupo a grupo, repescagem e de qual colocação, **ordem dos
>   critérios de desempate** (9 critérios, 4 ordens prontas) e **método de
>   comparação entre grupos** (aproveitamento / absoluto / descartar o último,
>   que é a regra da FIFA).
>
>   **(6) ⭐ Entrada direta: pular fases.** O pedido mais específico, e o que
>   não existia de jeito nenhum. Os N melhores cabeças — ou uma lista a dedo —
>   **pulam as fases anteriores** e entram numa fase à frente como cabeças. É o
>   modelo de qualificatória (os fortes esperam, os outros disputam as vagas), o
>   campeão defendendo título, o convidado da organização. Configura-se na aba
>   de SORTEIO, onde os nomes existem, e a tela mostra o resultado antes do
>   sorteio: *"2 entram direto na fase 2 (Ana, Bruno), pulando 1 fase; 12
>   começam na 1ª"*. Com as travas que importam: entra uma vez só, a 1ª fase
>   precisa sobrar com ao menos 2, e numa próxima fase de grupos os diretos são
>   espalhados em vez de formarem um grupo da morte por acidente.
>
>   **Banco: zero coleção, zero índice, zero regra, zero migração.** Oito campos
>   opcionais em `tournament_modalities.stages[]`, que não tem lista fechada de
>   campos. `normalizePhase` preenche os padrões na leitura, então uma
>   modalidade gravada antes desta onda se comporta exatamente como antes.
>   Ver `docs/26-TORNEIO-FORMATOS-E-REGRAS.md`.
>
> - **Onda AS — O clube entra no módulo, sem tocar no que já foi jogado**
>   (2026-09-19): a Onda AR unificou o SORTEIO e deixou uma tabela de
>   honestidade sobre o que ainda era diferente. Esta fecha o resto — **para o
>   futuro**.
>
>   **(1) 🐞 Havia QUATRO cópias do mesmo `? :`.** Não era só o `handleDraw`:
>   a escolha da VISÃO por formato (Play × Americano aprimorado × grade) e as
>   ferramentas do dia (tutorial do formato, telão) eram montadas tela a tela —
>   no atleta, na arena, e em lugar nenhum no clube. Foi assim que o clube
>   passou meses sem Play, sem Americano aprimorado e sem telão, com o próprio
>   documento do módulo registrando a dívida. Agora isso é `GameDayModule`, e
>   as três telas passam por ele; um guarda de FONTE reprova quem montar o
>   switch por fora, porque o defeito é invisível a teste de comportamento —
>   cada tela, isolada, funciona.
>
>   **(2) A data de evento de clube passou a NASCER como `game_days`.** É o
>   corolário da Onda AM (o torneio interno cria um dia de jogo em vez de
>   reescrever sorteio, placar, ranking e telão): sem armazenamento próprio,
>   não sobra o que unificar. O clube ganhou de graça Play, Americano
>   aprimorado, telão, tutorial e administradores nomeados — **zero tela
>   nova**. E ganhou permissão explícita: quem administra o CLUBE administra o
>   dia (mesmo sem ter agendado a data, e mesmo que quem agendou saia), o
>   membro LÊ e se inscreve sozinho, e quem não é do clube não vê nada. O dia
>   nasce com a gestão ABERTA de propósito: no evento legado qualquer membro
>   mexia em participantes e jogos, e nascer restrito tiraria da comunidade
>   algo que ela já tinha.
>
>   **(3) O legado NÃO foi migrado, e não vai ser.** A pergunta que separa é
>   uma só — `game_day_id` na data —, e ela mora num lugar só. Data anterior
>   segue no organizador de sempre, lendo e escrevendo exatamente onde sempre
>   leu e escreveu; nenhum documento publicado é lido, reescrito ou movido. Um
>   dia de jogo já jogado costuma já estar no ranking de quem jogou: migrar
>   seria reescrever histórico, e deixar como está não custa nada porque as
>   duas casas convivem. O legado encolhe sozinho.
>
>   **De quebra, três achados no caminho.** Uma QUINTA cópia do organizador
>   (`V2GameDayOrganizer.jsx`, 769 linhas) estava no repositório **sem um único
>   import** e fora do bundle — saiu. O espelho do ranking inferia o `club_id`
>   pelos atletas mesmo quando o clube dono era conhecido, e é justamente esse
>   campo que `isClubAdmin(club_id)` confere: sem a correção, só quem agendou a
>   data publicaria. E a aba de jogos do clube virou `lazy`, o que **reduziu**
>   a página do evento de clube de 48,6 kB para 31,7 kB — o organizador legado
>   também saiu do caminho crítico.
>
>   **Banco: quatro campos opcionais** (`game_day_id` na data do evento;
>   `club_id`, `club_name`, `club_event_id` no dia de jogo) e **duas condições
>   aditivas** no `firestore.rules`, ambas guardadas por `'club_id' in …` —
>   sem o campo, sempre falsas. Zero coleção, zero índice, zero migração. 85
>   asserções no emulador (eram 57), metade provando o que passou a funcionar e
>   metade o que continua barrado.
>   Ver `docs/25-DIA-DE-JOGO-COMO-MODULO.md` §5.
>
> - **Onda AR — O dia de jogo vira módulo, e o ranking deixa de esperar
>   botão** (2026-09-18): três frentes, todas nascidas da mesma pergunta —
>   *por que isto funciona diferente dependendo de onde está?*
>
>   **(1) A dupla vinculada, agora em todos os formatos.** Auditados os cinco:
>   Play e Americano aprimorado já honravam (o segundo desde a Onda AQ); o
>   sorteio de **grade** não tinha o recurso, e nem a tela para vincular. Ganhou
>   os dois. E o motor de grade expôs o que o Americano aprimorado já tinha
>   ensinado: o vínculo precisa valer em **TRÊS momentos** — quem joga a
>   rodada (`recortarComDuplas`), em que grupo de 4 (`ordenarComDuplas`) e de
>   que lado (`bestPairingOfFour`). Garantir só o último deixa a dupla em
>   quadras diferentes; só os dois primeiros a coloca uma CONTRA a outra.
>   **Mexicano e Rei da Quadra não honram**, e não é omissão: neles as duplas
>   saem da classificação da rodada e do resultado da anterior, que é o que
>   define os dois formatos — prender uma dupla ali seria deixar de ser
>   Mexicano. Então a tela **avisa** em vez de ignorar calada, que é o que faz
>   a pessoa achar que o sistema errou.
>
>   **(2) 🐞 O dia de jogo do CLUBE era uma versão mais pobre da mesma
>   ferramenta.** O painel do clube e o do atleta tinham duas cópias do mesmo
>   `handleDraw`, e elas divergiram: o do atleta ganhou Mexicano e Rei da
>   Quadra, o do clube ficou só no Americano — e **nada na tela dizia isso**.
>   Quem organizava pelo clube simplesmente não sabia que os outros formatos
>   existiam. Agora o sorteio tem fonte ÚNICA (`buildGameDayDraw`), usada pelas
>   três origens: formato, nível unificado 2.0–8.0, sorteio aditivo e duplas
>   vinculadas valem nas três por construção. O armazenamento continua
>   diferente (é migração de dados, ficou fora), mas a ORIGEM só pode mudar
>   três coisas: onde grava, quem organiza e o que o local acrescenta. Um
>   guarda de FONTE (`diaDeJogoUniforme.test.js`) reprova quem chamar os
>   motores por fora — porque este defeito é invisível a teste de
>   comportamento: cada tela, isolada, funciona.
>
>   **(3) 🐞 O resultado de torneio só contava depois de "encerrar".** A
>   elegibilidade exigia `status === 'finished'`: num torneio de três dias,
>   nada do que acontecia em quadra aparecia no rating até alguém clicar num
>   botão — às vezes dias depois, às vezes nunca. E o organizador não tinha
>   como saber que faltava um passo, porque lançar o resultado já parecia o
>   passo final. Em torneio o lançamento **não é facultativo**, então passou a
>   contar na hora; segue de fora o que não é resultado de verdade (rascunho,
>   cancelado, privado, arquivado), e como o recálculo é integral, cancelar
>   TIRA do ranking o que já contou. No dia de jogo o gatilho continua sendo a
>   **publicação** — ali lançar no ranking é decisão de quem organiza, e essa é
>   a única diferença legítima entre as origens. Apareceu também um caminho
>   sem gatilho nenhum: mudar o uid por trás de uma **inscrição** troca a quem
>   o jogo pertence sem tocar em partida alguma, e isso dependia de um admin
>   apertar "Recalcular ranking agora" — ganhou gatilho próprio.
>   E aí **os quatro botões de recalcular saíram**. Não por arrumação: botão de
>   recalcular mente sobre de quem é a responsabilidade (só o admin escreve
>   ranking, então quem publica depende de outra pessoa lembrar), compete com
>   o gatilho e esconde o defeito quando algo não entra. No lugar, um painel
>   que EXPLICA o que dispara o quê — botão que some sem explicação vira
>   chamado de suporte. O cliente também parou de tentar materializar ranking
>   ao publicar: era recusado pela regra e custava ler a coleção INTEIRA de
>   torneios a cada publicação.
>
>   **Banco: um campo opcional** (`partner_id` em `club_events/{id}/participants`,
>   sob a regra que já existia, sem lista fechada de campos) e **uma Cloud
>   Function nova**. Zero coleção, zero índice, zero regra, zero migração.
>   Ver `docs/25-DIA-DE-JOGO-COMO-MODULO.md` e `docs/18-RANKINGS.md` §3 e §8.
>
> - **Onda AQ — A dupla vinculada joga junta** (2026-09-18): relatado depois de
>   um dia de jogo real no Americano aprimorado — vinculou-se uma dupla, os dois
>   foram mantidos nas mesmas partidas e **jogaram um contra o outro**. O
>   sintoma enganava: parecia que o vínculo estava sendo ignorado, mas ele
>   valia — só que em **um** dos dois momentos em que precisa valer. Escolher
>   QUEM entra é `respectsFixedPairs`, e funcionava; escolher **COMO os quatro
>   se dividem em lados** é `pairFourBalanced`, que recebe **IDS** e não tem
>   como saber quem está vinculado a quem. Por isso o defeito só aparecia da
>   **segunda partida em diante**: na primeira o histórico está vazio e a
>   formação sai arbitrária (às vezes junta, por acaso); depois, repetir aquela
>   parceria custa 10, e o motor separava a dupla — colocando-a como
>   adversária. A correção é uma ponte, `fixedPairsWithin`, passada em **todos**
>   os caminhos de sorteio (partida avulsa, rede do Play, custo de cada grupo na
>   rodada e previsão da tela — esquecer um faria a tela anunciar uma dupla e a
>   quadra receber outra). E o vínculo entrou como **filtro ANTES do custo**,
>   não como mais um critério dentro dele: parceria inédita, adversário inédito,
>   nível e ordem da fila continuam valendo para todo o resto e decidem só entre
>   as formações que respeitam o vínculo. Duas consequências não óbvias: a
>   parceria vinculada **não é cobrada como repetição** (se fosse, o custo do
>   grupo cresceria 10 por partida e a dupla acabaria evitada — jogando cada vez
>   menos), e vínculo inconsistente **não trava** a partida. De quebra, a
>   **substituição** entrou na mesma regra: quem tem dupla ESPERANDO na fila vai
>   para o fim da lista de substitutos — continua elegível, mas só é chamado
>   quando não há mais ninguém, porque tirá-lo dali desfaria em silêncio um
>   vínculo que ninguém pediu para desfazer. Medido em dia inteiro simulado:
>   **zero** partidas com a dupla como adversária e **zero** com ela entrando
>   pela metade, com a participação tão equilibrada quanto antes. **Zero banco.**
>   Ver `docs/17-DIA-DE-JOGO-AMERICANO-APRIMORADO.md` §4a.
>
> - **Onda AP — Americano aprimorado: a rodada inteira, e as saídas que só o
>   telão tinha** (2026-09-14): três coisas no mesmo formato. **(1) 🐞 Não dava
>   para trocar quem estava em quadra** na visão normal do dia de jogo — no
>   telão dava, com o mesmo diálogo, desde a Onda S. **(2) 🐞 E não dava para
>   CANCELAR a partida sorteada**: para desfazer um sorteio que não servia, quem
>   organizava tinha de **lançar um resultado que não aconteceu** e apagá-lo
>   depois na lista de concluídas — um placar falso atravessando o ranking do
>   dia só para liberar a quadra. As duas ações agora existem nas duas telas,
>   pelo mesmo componente e pelo mesmo serviço; e `cancelPlayGame` passou a
>   **recusar** partida que já tem placar (entre abrir a confirmação e
>   confirmar, outra pessoa pode ter lançado o resultado, e aí "cancelar"
>   apagaria em silêncio algo já publicado). **(3) O sorteio foi revisto contra
>   o alvo do formato** — americano é *todos com todos, contra todos duas
>   vezes* —, e a medição foi constrangedora: com elenco estável e o número de
>   partidas que o formato pede, 8 atletas em 2 quadras formavam **12 das 28
>   duplas possíveis**; 12 em 3 quadras, **18 de 66**; 16 em 4, **24 de 120**.
>   Não era o motor de pareamento: era o sorteio ser GULOSO quadra a quadra — a
>   primeira leva o melhor quarteto e a última herda o que sobrou, e quando
>   atletas = 4 × quadras a última nem tem escolha. A rodada passou a ser
>   escolhida como um **todo** (`bestAmericanoLiveRound`): semente no sorteio
>   guloso de hoje — então nunca sai pior — e melhoria por trocas enquanto
>   baixarem o custo da rodada inteira. Os grupos são disjuntos, então o custo
>   da rodada é a SOMA dos custos dos grupos sobre o mesmo histórico, e a
>   otimização é barata. Resultado: **28/28**, **66/66** e **120/120**, com os
>   confrontos parelhos (nenhum par sem se enfrentar). Três restrições que
>   nenhuma troca viola: duplas fixas, o primeiro elegível da fila, e a FRENTE
>   da fila dentro da rodada — sem a última, procurar dupla inédita no fundo
>   empurra sempre a mesma pessoa para fora. Com uma quadra livre só, o caminho
>   é exatamente o de antes (teste travando). De quebra, a bússola do dia passou
>   a mostrar os DOIS alvos lado a lado: duplas com todos **e** confrontos duas
>   vezes — mostrar só o primeiro escondia metade do que o sorteio persegue.
>   **Zero banco.** Ver `docs/17-DIA-DE-JOGO-AMERICANO-APRIMORADO.md` §4b e §6b.
>   De quebra, **dois testes que dependiam da HORA do dia** foram estabilizados
>   (chegada e presença da arena): o fixture montava a HORA a partir de
>   `Date.now()` e a DATA sempre como "hoje", então rodar a suíte depois das 20h
>   fazia "daqui a três horas" virar 00:18 do mesmo dia — ou seja, um horário
>   VENCIDO. Passavam de manhã e reprovavam à noite. Agora o relógio é fixado ao
>   meio-dia (só `Date`, para não travar a renderização do React).
>
> - **Onda AO — A chegada: o totem, e a falta que passou a ser medida**
>   (2026-09-14): o último módulo `BETA` do catálogo era **uma frase e nenhuma
>   linha de código** — "presença confirmada sem ninguém no balcão, e no-show
>   medido de verdade". E a promessa incomodava mais do que a ausência, porque
>   **o número de faltas já existia**: `no_show` alimenta o painel semanal e a
>   ficha do cliente no CRM, e era preenchido pelo gestor, uma reserva por vez,
>   de memória, depois do expediente — um número que quase ninguém preenche é
>   pior que nenhum, porque parece medido. **A decisão que dispensou o banco**:
>   a tentação era criar `arena_checkins`, mas `arena_bookings` já deixa o
>   titular e o gestor escreverem no documento, então a chegada é um **campo
>   aditivo na própria reserva** — zero coleção, zero índice, **zero regra**, e
>   a presença mora junto do horário a que se refere. Seis asserções novas no
>   emulador (218) travam o contrato: o titular confirma a própria chegada, o
>   estranho não confirma a dos outros, a arena confirma e desfaz, e **só o
>   gestor gira o código do totem**. **O totem** é um tablet na recepção com um
>   QR e um código de cinco caracteres que **gira a cada 90 s** (fixo na parede
>   viraria mensagem de grupo — "manda aí que eu confirmo do carro") e morre ao
>   fechar a tela; sai com a **marca da arena** (Onda AN — é a tela mais vista
>   pelo cliente, e o único lugar onde o white label aparece de verdade) e
>   **não lista ninguém**: cumprimenta o último que chegou, primeiro nome, 20
>   segundos. Quem aponta a câmera **e tem um único horário aberto não toca em
>   nada** — a promessa ao atleta tem sete palavras, e um botão ali seria
>   transformar um gesto em dois. **A falta virou medida**: só é afirmada
>   depois que a janela fecha (+30 min), a taxa sai sobre o que já foi
>   DECIDIDO (dividir pelo total às 9h daria 95% de falta todo dia) e a arena
>   marca **em lote**, num toque, sobre exatamente quem o sistema já sabe que
>   não veio — era o trabalho manual que competia com fechar o caixa, e por
>   isso nunca era feito. Ver `docs/24-MODULOS-DE-ARENA/08-CHEGADA-E-TOTEM.md`.
>
> - **Onda AN — PDV, marca, rede e inteligência: o último quarteirão**
>   (2026-09-14): a onda que fechou os módulos de arena, e **seis defeitos**
>   independentes. **🐞 O atleta não conseguia comprar**: `createSale` gravava a
>   venda e em seguida dava baixa em `arena_products`, coleção que a regra só
>   deixa o gestor escrever — a segunda escrita era recusada e sobrava uma
>   **venda fantasma** no banco com um erro na tela. A correção não foi
>   afrouxar a regra: o estoque sai na **entrega**, com reconferência (entre a
>   compra e a retirada outra pessoa pode levar a última unidade), e cancelar
>   devolve o que já tinha saído. **🐞 Dividir a conta derrubava o pagamento do
>   próprio comprador**: ele criava um documento por participante, com
>   `payer_id` alheio, e como era um lote atômico a recusa de um matava todos.
>   Agora **cada um grava o seu** e quem entra na divisão é **avisado** — sem o
>   aviso, "dividir a conta" é o comprador cobrando os amigos por fora, que é
>   exatamente o que a funcionalidade promete resolver. **🐞 O caixa não
>   ordenava**: a lista comparava `created_at_ms`, campo que **nunca era
>   gravado**. **🐞 A marca ia para `arena_settings`**, que só o gestor lê — a
>   cor e o logo não tinham como chegar à página pública, e de fato **nada no
>   projeto lia aquele campo**; foram para `arenas/{id}.branding` e agora
>   pintam o cabeçalho da arena, com o texto escolhido por **contraste**
>   (luminância da WCAG), que é o que impede o amarelo-limão de apagar o
>   título. **🐞 A previsão da IA era calculada sobre lista vazia** —
>   `getHistoricalBookings` era `return []` com o comentário "só para
>   satisfazer a interface"; agora lê reservas confirmadas e concluídas, e sem
>   histórico a tela **não inventa**. O preço continua **sugestão**: nada muda
>   de preço sozinho. **🐞 A rede não podia ser criada** pela arena, embora o
>   módulo seja oferecido a ela, e `listNetworks()` mostrava **as redes de
>   todo mundo** para qualquer conta logada. Esta é a **única regra ampliada em
>   seis ondas**, e continua fechando o caso perigoso: incluir unidade exige
>   **gerir a unidade** *e* **ser dono da rede** — só a primeira e eu colocaria
>   a sua unidade na minha rede para ver os números dela; só a segunda e eu
>   poluiria a rede alheia. **Zero coleção, zero índice**; campos opcionais em
>   quatro coleções e **14 asserções novas no emulador** (212 no total), metade
>   provando o que passou a funcionar e metade provando o que continua barrado.
>   Ver `docs/24-MODULOS-DE-ARENA/07-PDV-MARCA-REDE-IA.md`.
>
> - **Onda AM — Torneios internos: o torneio vira jogo** (2026-09-14): cinco
>   defeitos. **🐞 O torneio não gerava partida nenhuma** — guardava
>   `format: 'single_elimination'` e nada no projeto sorteava nada: o atleta se
>   inscrevia e acabava ali. **🐞 O ladder era lido e nunca escrito**:
>   `getLadder` consultava `arena_ladders` e nada no projeto gravava naquela
>   coleção, então a classificação da arena estava vazia desde sempre, para
>   todo mundo. **🐞 O torneio não ocupava a quadra**, e **🐞 não dava para
>   sair** — só entrar. **A decisão que evitou reescrever a plataforma**: a
>   arena já tem uma máquina completa de dia de jogo (sorteio pela régua
>   2.0–8.0, Play, Americano, Americano aprimorado, placar, ranking do dia,
>   telão, tutoriais), e um torneio interno é exatamente isso com inscrição
>   antecipada e prêmio. Então **começar o torneio CRIA um dia de jogo da
>   arena** com os inscritos, e o ambiente do atleta não precisou de nada novo
>   — o mesmo corolário da Onda AA. O dia de jogo é criado ANTES de o status
>   mudar: se falhar, o torneio segue com inscrições abertas em vez de ficar
>   "em andamento" sem jogo. O **ladder** passou a existir de verdade (100/70/
>   50/35 por posição e **10 para quem participou** — um ladder em que só os
>   quatro primeiros somam faz todo mundo desistir na segunda semana), com id
>   determinístico `arenaId_periodo` que troca uma consulta de dois filtros por
>   um `getDoc`. De quebra: editar, cancelar avisando os inscritos, apagar, e
>   o `roster` com nome e foto — sem ele o sorteio nasceria com uma lista de
>   identificadores. **Zero coleção, zero índice, zero regra**; campos
>   opcionais numa coleção. Ver `docs/24-MODULOS-DE-ARENA/06-TORNEIOS-INTERNOS.md`.
>
> - **Onda AL — Aulas: a matrícula que nunca funcionou** (2026-09-13): o
>   defeito mais caro e mais invisível da Arena V3. **🐞 A regra de
>   `arena_class_bookings` exige `request.resource.data.user_id ==
>   request.auth.uid`, e o serviço gravava o campo como `athlete_id`** — campo
>   ausente vale `null`, `null` nunca é igual a um uid, e o Firestore recusava
>   **toda** matrícula em aula desde o dia em que a funcionalidade foi escrita.
>   O erro chegava como um "permission-denied" genérico, que ninguém liga a um
>   nome de campo. A lição vale para o projeto inteiro: **o nome do campo que a
>   regra usa é contrato**, e escrever um sinônimo não é estilo — é a operação
>   recusada em silêncio. **🐞 A aula também não ocupava a quadra**, embora o
>   catálogo prometesse que ela "passa a ocupar a grade": dava para marcar aula
>   às 19h e vender a mesma quadra às 19h. Agora ocupa (derivada, como o dia de
>   jogo — `arena_classes` é legível por todos), cancelada ou dada devolve, e
>   o bloqueio público **não carrega nome de aluno**. **🐞 E o professor era um
>   nome solto**: `arena_coaches` não tinha vínculo com a conta da pessoa, e o
>   catálogo prometia a ele "sua agenda na arena, com os alunos no mesmo
>   lugar". Com `user_id`, a tela passou a ter TRÊS donos — atleta, professor e
>   arena —, decidindo pelo que a pessoa É, não por um seletor. De quebra: a
>   comissão saiu do código (eram **50% fixos** ignorando os 20% configurados
>   no módulo, e professor da casa não paga nada), e apareceram editar aula,
>   cancelar avisando os matriculados, marcar como dada, desmarcar devolvendo a
>   vaga, registrar pagamento e editar professor — nada disso existia.
>   **O refactor que a onda exigiu**: a cadeia de merge de bloqueios estava
>   repetida em CINCO lugares e cada fonte nova pedia lembrar dos cinco; virou
>   `mergeArenaBlocks` (domínio, compõe) + `arenaOccupancy` (serviço, busca).
>   **Zero coleção, zero índice, zero regra**; campos opcionais em três
>   coleções. Ver `docs/24-MODULOS-DE-ARENA/05-AULAS.md`.
>
> - **Onda AK — Operações: a rotina que recomeça e a quadra que fecha**
>   (2026-09-13): quatro módulos `READY` no catálogo, cinco defeitos.
>   **(1) 🐞 O checklist não era uma ROTINA**: criado uma vez e marcado para
>   sempre — o fechamento cumprido na segunda continuava "concluído" na terça,
>   e a arena não tinha como responder a única pergunta que importa de manhã,
>   *hoje a abertura foi feita?*. Agora cada dia recomeça (virada ao abrir a
>   tela, idempotente) e o dia anterior vai para um histórico de 30 dias — o
>   que transforma o checklist numa PROVA ("a abertura de sábado foi cumprida,
>   8 de 8") em vez de uma lista de compras antiga. Lista marcada como não
>   recorrente não vira nunca, de propósito. **(2) 🐞 A manutenção não fechava
>   a quadra**, embora o catálogo prometesse: a ordem não tinha quadra nem
>   data, era um bilhete — trocar o piso da quadra 2 na quinta não impedia
>   ninguém de reservar a quadra 2 na quinta. Agora fecha, e **concluir ou
>   cancelar devolve a quadra à venda** (manutenção que termina e deixa a
>   quadra fechada é prejuízo silencioso). Aqui a cópia é GRAVADA, e não
>   derivada como no dia de jogo: a ordem é privada da arena e o atleta nunca a
>   leria — então o bloqueio público existe e diz só **"Manutenção
>   programada"**, sem o motivo ("trocar a fechadura do vestiário" não é
>   assunto de quem vai jogar; há teste garantindo que o título não vaza). E a
>   recusa da reserva ganhou texto próprio, com o "é temporário" que evita a
>   pessoa desistir da arena em vez do horário. **(3) 🐞 O alerta de estoque
>   não chegava a lugar nenhum**: 242 linhas de domínio testado e o aviso de
>   "acabando" só existia dentro da aba Mercado, que ninguém abre de manhã.
>   **(4) 🐞 A equipe não existia** — módulo `READY` sem uma linha de código;
>   agora é `arena_settings.staff`, com nome, função e turno e **sem telefone
>   nem e-mail** (para dizer quem estava de plantão isso basta). **(5) A tela
>   não respondia à pergunta do dia**: ganhou um topo **Hoje** com o que está
>   pendente agora — e que diz "nada pendente" numa linha em vez de encher a
>   tela de cartões verdes. **Zero coleção, zero índice, zero regra**; campos
>   opcionais em quatro coleções.
>   Ver `docs/24-MODULOS-DE-ARENA/04-OPERACOES.md`.
>
> - **Onda AJ — Marketing e fidelidade: o cupom desconta, a campanha chega**
>   (2026-09-13): o terceiro módulo entregue sobre o chassi, e **cinco defeitos
>   independentes** que o mantinham decorativo. **(1) O cupom não descontava
>   nada**: havia tela para criar e nenhum lugar para digitar — o desconto
>   existia no banco e nunca no preço. Agora o atleta digita no pedido, o erro
>   é específico ("venceu", "vale a partir de R$ 100", "você já usou"), a conta
>   entra em `memberBookingPrice` entre o nível e a carteira, e o **serviço
>   reconfere o cupom contra o banco antes de gravar** — conferir só no
>   navegador deixaria qualquer pessoa gravar um desconto que a arena não
>   criou. O uso é contabilizado na **confirmação**, e `used_by` é uma LISTA,
>   que é o que torna "uma vez por pessoa" conferível. **(2) A campanha era um
>   rascunho**: `createCampaign` gravava o documento e ninguém era notificado —
>   a arena "enviava" e a comunidade nunca recebia. Agora há quatro públicos
>   concretos (membros, sumidos, frequentes, todo mundo), cada cartão mostra
>   **quantas pessoas** vão receber ANTES de enviar, público vazio não envia, e
>   só reserva concluída conta como "já jogou aqui" (mandar "sentimos sua
>   falta" a quem nunca veio faz desinstalar o aplicativo). **(3) O NPS não
>   mostrava o motivo** — e a `read` da regra estava quebrada, então a arena
>   nem lia o próprio NPS. Agora vê nota, distribuição e **os comentários**; e
>   a pergunta ao atleta aparece na página da arena só para quem jogou nos
>   últimos 30 dias e não respondeu nos últimos 90, com a **nota indo embora no
>   clique** e o comentário depois (pedir texto antes da nota é o motivo de a
>   maioria dos NPS não ter resposta). **(4) A indicação não tinha resgate**:
>   agora o atleta vê o próprio código (copiar/convidar) e a arena registra
>   quem chegou por ele, creditando os dois lados. **(5) 🐞 Nada levava ao
>   console**: `/gerir/marketing` tinha rota e **nenhum link** na plataforma —
>   módulo ligado, tela inalcançável. Corrigido na classe, não no caso:
>   `ArenaModuleShortcuts` monta os atalhos a partir do CATÁLOGO, nos dois
>   lados do balcão, e módulo novo com rota aparece sozinho. De quebra, os
>   **pontos passaram a valer alguma coisa** (20 pontos = R$ 1, resgatados pela
>   arena porque só o gestor escreve carteira; o resto em pontos fica com o
>   atleta, nunca é arredondado para fora) e o cupom ganhou editar, desligar e
>   apagar — desligar vem antes de apagar, porque apagar leva junto a contagem
>   de usos e ninguém responde mais "quanto essa promoção rendeu?".
>   **Zero coleção, zero índice, zero regra**; quatro campos opcionais.
>   Ver `docs/24-MODULOS-DE-ARENA/03-MARKETING.md`.
>
> - **Onda AI — Membros: o benefício chega ao preço** (2026-09-13): o módulo
>   sabia calcular nível ("Ouro dá 10%") e vendia pacotes de horas — e **nada
>   disso chegava à reserva**. O valor gravado saía de `totalBookingPrice`, que
>   não conhece membro, e o pacote era um saldo que ninguém debitava: um
>   desconto que não desconta e um pacote que não abate. Agora a conta é
>   `memberBookingPrice` (tabela → horas de pacote → desconto do nível → saldo
>   da carteira, nessa ordem, com o pacote antes do desconto para não descontar
>   duas vezes), a tela mostra o detalhamento linha a linha, o serviço REFAZ a
>   conta antes de gravar e o consumo acontece só na **confirmação** — queimar
>   horas num pedido que a arena ainda pode recusar seria cobrar por um jogo que
>   não vai acontecer. Pontos passam a ser creditados por reserva concluída
>   (valor + horas: quem usa pacote pagou antes e continua vindo), e o pacote
>   consumido é sempre **o que vence primeiro**, para ninguém perder saldo por
>   uma decisão do sistema. **A arena também não conseguia incluir ninguém**: a
>   tela de gestão só listava, e o estado vazio dizia "conforme atletas
>   comprarem pacotes, eles aparecem aqui". Agora inclui pelo diretório, ajusta
>   pontos, credita carteira com motivo (que vai para a auditoria E para o
>   extrato do atleta) e cuida da mensalidade. E a **mensalidade foi escrita do
>   zero**: `arena_subscriptions` tinha regra e uma constante, nenhuma função.
>   Meses pagos são uma LISTA (não um "pago até", que esconderia quem pulou um
>   mês), e antes do vencimento o mês corrente não conta como atraso.
>   **Zero coleção, zero índice, zero regra**; dois campos opcionais. Ver
>   `docs/24-MODULOS-DE-ARENA/02-MEMBROS.md`.
>
> - **Onda AH — Jogo aberto, fila de espera e buscar parceiro** (2026-09-13): o
>   primeiro módulo de arena entregue de verdade sobre o chassi novo — e quatro
>   defeitos independentes que o mantinham inútil. **(1) 🐞 A lista de vagas
>   nunca carregou**: `where('arena_id')` + `orderBy('date')` exige índice
>   composto e o único índice de `arena_open_slots` é `[arena_id, starts_at]`;
>   a consulta falhava sempre e o erro virava lista vazia. O guarda de índices
>   não pegava porque estas consultas montam as condições num VETOR, com o
>   `orderBy` fora do `query(...)` — o guarda agora varre por função também (e
>   ignora comentários, que citavam `orderBy` e o faziam acusar a si mesmo).
>   Com ele, mais **quatro consultas mortas** apareceram: catálogo de
>   professores da arena, agenda de aulas, torneios internos e a lista global de
>   vagas. **(2) 🐞 A peneira de nível comparava escalas diferentes** — a vaga
>   validava 0–7 e comparava contra `profile.level`, que é código de faixa; ou
>   não filtrava, ou filtrava errado. Agora é a régua única 2.0–8.0 dos dois
>   lados, e nível desconhecido NÃO barra (a plataforma não inventa nível).
>   **(3) 🐞 A vaga não ocupava a quadra**: era texto livre, sem `court_id`, e
>   a arena vendia o mesmo horário duas vezes. Virou `court_id` opcional +
>   `openSlotBlocks`/`mergeOpenSlotBlocks`, o mesmo desenho do dia de jogo, e
>   entrou no conflito de reserva e nos três calendários. **(4) 🐞 A fila de
>   espera nunca chamou ninguém**: `notifyNextInLine` não era invocada de lugar
>   nenhum, a notificação apontava para `/minha-fila` (rota que nunca existiu) e
>   o prazo da promoção não era cumprido por ninguém — vaga presa para sempre.
>   Agora sair de um jogo lotado chama o próximo, a Cloud Function
>   `advanceOpenSlotWaitlist` expira e avança a cada 10 min, e o atleta tem onde
>   confirmar. De quebra: datas em pt-BR, "lotado" deixou de dizer "inscrições
>   encerradas" (era o que escondia a fila) e falha parou de virar lista vazia.
>   **Zero coleção, zero índice, zero regra**; um campo opcional e uma função
>   agendada. Ver `docs/24-MODULOS-DE-ARENA/01-MATCHMAKING.md`.
>
> - **Onda AG — Módulos adicionais da arena: o chassi** (2026-09-13): a Arena V3
>   existia no código desde julho e **não funcionava para ninguém** — a "Onda O"
>   removeu as 51 flags `arena_module_*` de `FEATURE_FLAG`, e como
>   `normalizeFeatureFlags` só devolve chave conhecida, `canArenaUseModule`
>   começava com `if (!platformFlags.arena_modules) return false` e **todo
>   módulo resolvia para desligado, sempre**. A aba "Arena V3" do painel admin
>   não renderizava nada (itera `FEATURE_FLAG`, que não tinha mais nenhuma), e a
>   tela de módulos da arena tinha o mapa de flags **escrito na mão como objeto
>   vazio** — toda linha dizia "a plataforma ainda não ativou". Agora são
>   **três camadas explícitas**: a plataforma LIBERA (Funcionalidades → Módulos
>   de arena), a arena ATIVA (Configurações → Módulos), o usuário VÊ. Catálogo
>   de **50 módulos** com público, benefício por persona, dependências, rotas e
>   configuração; gate puro que devolve o MOTIVO (a tela precisa dizer por que,
>   e o motivo é outro para o admin e para a arena); cascata avisada antes de
>   gravar (ligar a carteira liga membros junto; desligar membros derruba
>   carteira, pacotes e mensalidade — com a lista na tela) e gravada em LOTE.
>   **Zero coleção nova, zero regra nova, zero índice**: a camada da plataforma
>   é um documento em `platform_settings`, que já tinha regra. De quebra, **doze
>   regras quebradas** foram corrigidas — `delete` e `read` condicionados a
>   `request.resource.data`, que não existe nessas operações (ninguém apagava
>   professor, aula, cupom, campanha, checklist, dispositivo, ladder ou item de
>   estoque; a arena nunca leu o próprio NPS) — e três brechas fechadas
>   (`arena_sales`, `arena_payments` e `arena_referrals` aceitavam
>   `create: if isAuthed()`, então qualquer conta forjava venda em qualquer
>   arena e indicação em nome de outra pessoa). 43 asserções novas no emulador.
>   Ver `docs/24-MODULOS-DE-ARENA/00-INDEX.md`.
> - **Onda AG — Sortear a rodada inteira** (2026-09-14): com o número exato de
>   jogadores para encher as quadras — 8 em 2, 12 em 3 — os jogos saíam sempre
>   entre os mesmos. Não era o motor de rodízio: era o MOMENTO. Quando a quadra
>   1 termina, os únicos 4 na fila são os 4 que saíram dela, e com quatro
>   pessoas só existe um grupo possível; os dois quartetos jogavam a noite
>   inteira sem se cruzar. Agora quem organiza escolhe: **criar a próxima aqui**
>   (mantém o grupo, comportamento de sempre), **só encerrar** (libera a quadra
>   sem sortear — a novidade que torna a rodada possível no Play) ou **sortear
>   todas as quadras**, que com a fila inteira na mesa distribui e mistura. As
>   duas funções de rodada saem da PREVISÃO que a tela já mostra
>   (`simulatePlaySequence` / `forecastAmericanoLiveMatches`), não de um sorteio
>   paralelo: o que se anuncia é o que se cria, com teste travando a igualdade.
>   A rodada é gravada num lote só — meia rodada consumiria a fila pela metade.
>   O botão só aparece com mais de uma quadra e só habilita com duas livres e
>   fila para as duas; enquanto não dá, a tela **explica o caminho** em vez de
>   só desabilitar. Vale nas três telas: painel do atleta, painel da arena e
>   telão. **Zero banco.** Ver `docs/16-DIA-DE-JOGO-RODIZIO.md` §10.
>
> - **Onda AF — O dia de jogo fecha a quadra de verdade** (2026-09-13): três
>   defeitos vistos em tela. **(1) 🐞 O dia de jogo não bloqueava o
>   calendário**: um dia de jogo das 18h às 22h nas três quadras, e a grade
>   oferecendo os quatro horários como livres — com o aviso de que estavam
>   fechados logo acima. A quadra fechada saía SÓ da cópia gravada em
>   `arena_unavailabilities`, e cópia que não chega deixa o sistema inteiro sem
>   saber. Agora o dia de jogo é a FONTE (`gameDayBlocks`/`mergeGameDayBlocks`)
>   e as telas somam gravados + derivados sem duplicar. **(2) O pedido de
>   reserva nunca conferia bloqueio** — só outras reservas; o formulário
>   completo, que não passa pelo calendário, deixava pedir exatamente a quadra
>   fechada. `checkUnavailabilityConflict` recusa dizendo o motivo, nos três
>   caminhos de criação, a reserva manual da arena inclusive. E o bloqueio
>   deixou de depender de feature flag: a flag gateia o que se MOSTRA, não se a
>   quadra está ocupada. **(3) A tela repetia a si mesma**: o card
>   "Organização" saía duas vezes (da página e do organizador) e havia DUAS
>   listas das mesmas pessoas — "Inscritos", em cima, que só removia, e
>   "Participantes", recolhido embaixo, que é onde estão dupla, pausa e
>   exclusão. Uma lista, num lugar só; o painel da arena virou **Vagas**, que é
>   a pergunta dela e não é respondida em nenhum outro lugar. De quebra, o
>   bloqueio derivado não tem documento — a tela da arena tinha um botão
>   "Remover indisponibilidade" que apagaria o nada, e apagar a cópia GRAVADA
>   abriria a quadra com o dia de jogo ainda em cima; agora ali se vê o dia de
>   jogo e o caminho para ele. **Zero banco.**
>   Ver `docs/22-DIA-DE-JOGO-DA-ARENA.md`.
>
> - **Onda AE — A arena abre rápido, e para de mentir quando não sabe**
>   (2026-09-13): abrir uma arena era uma FILA de esperas que não dependiam
>   umas das outras — baixar o pacote, montar, só então pedir a arena, e só
>   então quadras, janelas, reservas e bloqueios. Cinco cortes, **zero banco**:
>   **pré-busca por intenção** (o dedo encosta no cartão e as consultas saem
>   enquanto o pacote da tela baixa), **a arena vem semeada da lista** (que já
>   trouxe o documento inteiro), **fim de um N+1 que rodava em TODA tela**
>   (`listMyManagedArenas` buscava as arenas em fila, e o menu pergunta isso
>   sempre), **as quinze abas da Central agora chegam sob demanda**
>   (170 kB → **37 kB**) e **o diálogo do dia baixa depois da pintura**, com
>   aquecimento no ocioso para o clique seguir instantâneo (80 kB → **60 kB**).
>   As chaves de cache viraram fonte única, com teste lendo o código-fonte:
>   chave escrita duas vezes diverge um dia, e o sintoma não é erro — é buscar
>   de novo o que já estava em cache, para sempre. **E duas mentiras caíram**:
>   o mês desenhava ANTES de as reservas chegarem (mês sem reserva parece mês
>   livre) e, quando a consulta FALHAVA, a lista vazia virava "esta arena não
>   publicou horários" — na lista de arenas, "Nenhuma arena encontrada,
>   cadastre uma arena", como se a plataforma estivesse vazia. Agora ocupação
>   só é afirmada com dado na mão, e falha tem texto próprio e botão. Por fim,
>   **datas em pt-BR em toda a arena**: `2026-07-23 · 19:00` virou
>   `Qui, 23/07 · 19:00–20:00`, com o ano quando não é o corrente — e o painel
>   da arena parou de mostrar o status cru do banco ("requested: 3").
>   Ver `docs/23-ARENA-CALENDARIO-E-RESERVA.md` §11-§13.
>
> - **Onda AD — O preço certo e a ocupação legível** (2026-09-13): duas coisas
>   que a tela dizia errado. **(1) O preço.** Selecionar três horários somava na
>   tela e a reserva chegava à arena valendo **uma hora** — e o mesmo número
>   reaparecia na lista do dia, várias quadras pendentes, todas com o preço de
>   uma hora. Não era exibição: `resolveArenaPrice` devolve o valor POR HORA e
>   era ele que ia para `proposed_price`. A conta virou domínio
>   (`totalBookingPrice`, cada horário na SUA faixa) e o **serviço a refaz antes
>   de escrever**, documento a documento, nos dois caminhos de criação — a tela
>   estima, quem grava confere. Para o que já estava gravado,
>   `bookingPriceInfo(booking, { arena })` recalcula na leitura, e a linha de
>   reserva do atleta busca a arena sozinha para que a MESMA reserva mostre o
>   MESMO número dos dois lados do balcão. **(2) A ocupação.** O calendário
>   mensal contava a arena como se fosse UMA quadra: uma reserva às 19h fazia as
>   19h contarem como ocupadas — com duas quadras livres. `aggregateDayStatus`
>   passou a contar em **horas-quadra** (`courts`), e cada dia ganhou barra
>   proporcional + "4h livres" / "Lotado" / "Bloqueado" (que não é a mesma
>   coisa), no lugar de dois números que eram horas contadas como reservas. O
>   mês ganhou resumo ("2 dias com horário livre em julho") e, quando não há
>   nenhum, **o próximo dia livre** em vez de um botão de "próximo mês" no
>   escuro. De quebra, reservas e bloqueios passaram a ser indexados por data —
>   a grade fazia 42 dias × quadras varreduras da lista inteira. E o resumo do
>   diálogo do dia parou de chamar HORÁRIOS de "solicitações". **Zero banco**:
>   nenhum campo, coleção, índice, regra ou função; nenhum dado histórico
>   reescrito. Ver `docs/23-ARENA-CALENDARIO-E-RESERVA.md` §8-§10.
>
> - **Onda AC — A reserva em duas telas, sem repetir pergunta** (2026-09-12):
>   reservar eram duas telas, e a segunda **re-perguntava tudo o que a primeira
>   já tinha respondido** — data, horário, "qualquer/específicas/todas",
>   "avulso/recorrente" —, num vocabulário diferente e com as respostas podendo
>   se contradizer. Agora: **calendário (o DIA) → grade (QUADRA e HORÁRIOS) →
>   confirmar**. A segunda tela mostra a escolha agrupada por quadra e faz só
>   as perguntas que sobraram. **E uma limitação escondida caiu**: o serviço
>   gravava uma reserva por quadra, mas todas com os MESMOS horários — então
>   "Quadra 1 às 19h e Quadra 2 às 20h" não cabia num pedido. A escolha virou
>   uma lista de CÉLULAS (`bookingSelection.js`), `groupSelectionByCourt` a
>   traduz para os pedidos certos e `createBookingsForSelection` valida todos
>   os pares antes de escrever e grava num lote só — tudo ou nada, com
>   `booking_group_id` comum. A matriz quadra × horário virou o padrão com mais
>   de uma quadra, e "toda semana" repete a escolha INTEIRA (o metadado
>   `recurrence` só é gravado quando é verdade — um horário só; com vários,
>   fica `null` em vez de mentir num campo que alguém exibe). O formulário
>   completo do botão "Solicitar reserva" da página da arena segue idêntico,
>   com teste travando os dois modos. **Zero banco**: nenhum campo novo,
>   coleção, índice, regra ou função. Ver `docs/23-ARENA-CALENDARIO-E-RESERVA.md` §6.
>
> - **Onda AB — Arena: calendário, reserva e prontidão** (2026-09-12):
>   auditoria de ponta a ponta da arena, dos dois lados do balcão. **Dois bugs
>   reais**: (1) o fim de um slot era "o próximo horário da grade" — numa arena
>   com horário PARTIDO (manhã e noite) a grade tem buracos, e clicar nas 09:00
>   pedia reserva **das 09:00 às 18:00**, nove horas, com preço e ocupação
>   correspondentes; (2) `hora + 1` cego passava meia hora além do fechamento
>   numa janela que acaba às 21:30. A conta virou domínio testado
>   (`slotEndTime`). **A quadra invisível**: quadra sem janela de horário não
>   entra no calendário, não aceita reserva, não entra em dia de jogo — e nada
>   dizia isso ao dono, que só descobria quando alguém reclamava; agora é
>   avisado em três alturas, e o atleta também deixou de ver um mês cinza sem
>   explicação. **A pergunta sem resposta**: "2 de 3 quadras livres" não dizia
>   QUAIS; o atleta ganhou a matriz quadra × horário (`CourtTimePicker`), em
>   que clicar ESCOLHE a quadra — escolha que agora chega ao pedido e ao preço,
>   em vez de se perder no último passo. E o diálogo do dia deixou de pedir
>   rolagem por reservas alheias antes de mostrar os horários: a grade vem
>   primeiro, "sem horário livre" virou aviso acima dela em vez de parede no
>   lugar dela, e as legendas mostram só as cores que estão na tela. O
>   calendário da ARENA passou a mostrar os dias de jogo que ela mesma marcou.
>   **Zero banco** — nenhuma regra, coleção, índice ou função tocada.
>   Ver `docs/23-ARENA-CALENDARIO-E-RESERVA.md`.
>
> - **Onda AA — Dia de jogo da arena** (2026-09-12): a arena passa a criar o
>   próprio dia de jogo, **marcado no calendário** — o que FECHA a data e as
>   quadras escolhidas para reserva. Horário do dia todo ou por quadra; mais de
>   um dia de jogo na mesma quadra no mesmo dia, desde que em horários
>   diferentes; limite de atletas no dia, por quadra, ou nenhum; e a escolha de
>   se só a equipe da arena conduz as partidas ou se os inscritos também. O
>   atleta marca presença pela página e pelo calendário da arena.
>   **Nenhuma coleção nova**: é o mesmo `game_days` com campos aditivos
>   (`arena_id`, `arena_slots`, `signup_mode`, `capacity`) — ausente `arena_id`,
>   nada muda. O corolário é o que importa: **o ambiente do atleta não precisou
>   de nada novo** (sorteio, Play, Americano aprimorado, ranking do dia, telão,
>   tutoriais). Fechar a quadra também não é código novo: grava
>   `arena_unavailabilities` com `source: 'game_day'`, e conflito de reserva,
>   status de slot e calendário mensal já respeitam. **Três bugs de regra
>   encontrados e corrigidos no caminho**: (1) nenhum gestor de arena conseguia
>   APAGAR o próprio bloqueio de calendário (a regra olhava
>   `request.resource.data` num delete); (2) SAIR de um dia de jogo público era
>   recusado, porque o recálculo de membros tira quem saiu da lista; (3) ENTRAR
>   era permissivo demais — bastava "eu estou na lista nova", o que deixava
>   qualquer membro remover os outros. **57 asserções no emulador** (30 já
>   existiam). Ver `docs/22-DIA-DE-JOGO-DA-ARENA.md`.
>
> - **Onda Z — Ajuda no momento em que dói** (2026-09-12): a central de ajuda
>   deixou de ser um manual bem escrito para virar uma tela que **responde
>   rápido**. Ninguém abre a ajuda por lazer: abre travado, no meio de outra
>   coisa, já irritado — e a primeira versão cobrava quatro passos ali (achar o
>   link, adivinhar a persona, varrer dez artigos, abrir). Agora: **o link de
>   ajuda de TODA tela leva a rota junto** (`helpLinkFor` → `?de=`) e a central
>   abre com "Ajuda para esta tela"; a tela inicial começa por **perguntas**
>   ("Como me inscrevo num torneio?"), porque buscar pressupõe saber o nome da
>   coisa e quem está perdido não sabe; **cartões de identificação** ("Eu
>   jogo", "Tenho uma arena", "Dou aulas") no lugar de abas abstratas, com a
>   escolha **lembrada por usuário**; a busca **destaca** o termo e mostra o
>   **trecho do corpo** onde ele apareceu, ganhou atalho `/`, `Esc`/X para
>   limpar, e **"nada encontrado" virou sugestão, não parede**; e todo artigo
>   aberto termina com **Próximo**, **Copiar link** e **Topo** — sem becos.
>   Os testes novos travam o contrato entre quem gera o link e quem o lê, a
>   existência de cada rota de origem, a ordem específico-antes-de-genérico das
>   pistas (o genérico engoliria o específico) e que o destaque nunca perde nem
>   inventa caractere. **Zero Firestore** — a única memória é a parte
>   preferida, no `localStorage` por usuário. Ver `docs/21-CENTRAL-DE-AJUDA.md`
>   §2.
>
> - **Onda Y — Central de ajuda** (2026-09-11): a página `/ajuda` (flag
>   `help_center`, default OFF) — o manual da plataforma dentro dela, dividido
>   por TIPO DE USUÁRIO: Começar aqui, **Atleta**, **Arena**, **Professor**,
>   Conta e privacidade. 33 artigos feitos de blocos tipados (parágrafo, passo
>   a passo, lista, dica, atenção, atalho), com busca que procura no CORPO dos
>   textos, ignora acento e em que vários termos estreitam o resultado.
>   Acesso em TRÊS pontos de toda tela (barra lateral, menu do usuário, gaveta
>   do celular), fora dos hubs de propósito: ajuda não é um tema da plataforma,
>   é o que se procura quando se está perdido em qualquer um deles. Estado na
>   URL (`?s=&a=&q=`) permite mandar alguém direto ao artigo. Dois testes
>   guardam o essencial: **todo link interno aponta para rota que existe**
>   (lendo `V2App.jsx`) e **a ajuda não documenta o que está atrás de flag
>   desligada** (a gamificação). **Zero banco** — nem localStorage.
>   Ver `docs/21-CENTRAL-DE-AJUDA.md`.
>
> - **Onda X — Tutoriais em tela** (2026-09-11): quatro tutoriais completos
>   dentro das próprias ferramentas — **torneio** (criar → modalidades →
>   inscrições → sorteio → resultados → encerramento/ranking → página pública e
>   telão) e **dia de jogo** nos formatos **Play**, **Americano** (que serve
>   também a Mexicano e Rei da Quadra: a tela é a mesma) e **Americano
>   aprimorado**. Abrem sozinhos na primeira vez que a pessoa entra na
>   ferramenta, podem ser DISPENSADOS de qualquer jeito (X, Dispensar, Entendi,
>   clicar fora) e o botão "Como funciona" fica sempre lá para REVER. No
>   diálogo de criação de dia de jogo o botão acompanha o formato selecionado —
>   sem isso os tutoriais só existiriam depois do dia criado, tarde demais para
>   ajudar a escolher. Conteúdo é domínio puro e testado (módulo novo `help/`);
>   a memória de "já viu" é `localStorage` por usuário — **zero coleção, zero
>   regra, zero migração**. Contra o bug clássico do modal que reaparece: marca
>   por USUÁRIO (não por sessão) + abertura latcheada por ref.
>   Ver `docs/19-TUTORIAIS.md`.
>
> - **Onda W — Rankings atualizados na publicação** (2026-09-11): todo resultado
>   publicado passa a atualizar, NA HORA, os três rankings de partida — ELO/
>   nacional, rating estilo DUPR (2.0–8.0) e duplas. São gatilhos do Firestore
>   (`club_event_games`, `tournament_matches`, elegibilidade de torneio) que
>   rodam no SERVIDOR: materializar ranking é escrita que só o admin pode fazer,
>   e quem publica um dia de jogo quase nunca é o admin — a tentativa do cliente
>   era recusada pela regra e morria num `catch`. Rajadas (publicar um dia
>   grava dezenas de partidas) são coalescidas por um lease, custando duas
>   passadas. **Bug corrigido junto**: o recálculo de servidor que já existia
>   lia só `tournament_matches` e ignorava `club_event_games`, então toda vez
>   que rodava apagava do ranking nacional os resultados de dia de jogo.
>   O ranking de **duplas** passou a ser materializado em `doubles_rankings`
>   (coleção nova, leitura pública, escrita só do admin; zero índice, zero
>   migração) e classificado por **aproveitamento → vitórias → derrotas →
>   saldo**; a página ganhou paginação 20/50/100 com estado na URL e deixou de
>   ler quatro coleções inteiras a cada abertura. Os motores duplicados
>   (cliente × Functions) ganharam **teste de paridade** sobre 400 partidas.
>   Ver `docs/18-RANKINGS.md`.
>
> - **Onda V — Dia de jogo: Americano aprimorado** (2026-09-10): formato NOVO
>   (`americano_live`, flag `gameday_americano_live`, default OFF) que junta a
>   organização do Play — quadra a quadra, fila de participação, pausa, dupla
>   fixa, entrar e sair a qualquer hora — ao **placar** do Americano: ranking do
>   dia, partidas concluídas com resultado, criação manual, edição e exclusão, e
>   publicação no ranking/rating da plataforma e no DUPR. O sorteio funde os dois
>   motores: o primeiro da fila SEMPRE entra (baseline do Play) e os outros três
>   saem de uma janela dos 8 primeiros, pareados por `pairFourBalanced` (o motor
>   do Americano). O fluxo é de DOIS passos — **"Lançar resultado"** libera a
>   quadra e só então aparece **"Gerar próxima partida"**. O telão ganhou o
>   terceiro arranjo, e `buildGameDayBoard` passou a aceitar `format`
>   (opcional; omitido, comportamento idêntico ao anterior). **Zero regra nova
>   no `firestore.rules`**, zero coleção, zero índice, zero migração: só mais um
>   valor possível em `game_days.format`. O formato NÃO herda o atalho
>   colaborativo do Play (`isPlayGameDayMember`), porque aqui o resultado
>   alimenta o ranking da plataforma — provado por 6 asserções no emulador.
>   Ver `docs/17-DIA-DE-JOGO-AMERICANO-APRIMORADO.md`.
>
> - **Onda T — Dia de jogo: quem organiza** (2026-09-06): o criador escolhe, na
>   criação e na edição, se **só ele e quem ele autorizar** operam as partidas
>   (sortear, criar próxima, substituir, indisponível, vincular dupla,
>   incluir/excluir participante) ou se isso fica **aberto a qualquer inscrito**;
>   e ganha um card **Organização** para nomear outros usuários da plataforma
>   como admin do dia de jogo. Comando sem atribuição **não aparece** (não é só
>   desabilitado). Configurar (editar, arquivar, mudar o modo, nomear admin,
>   publicar no ranking) continua exclusivo do criador — publicar exige
>   `isGameDayOwnerOf` em `club_event_games` e não afrouxamos essa regra.
>   Dois campos opcionais (`manage_mode`, `admin_uids`); **ausentes ⇒
>   comportamento antigo**, sem migração. Regras aditivas, provadas por 24
>   asserções no emulador. Ver `docs/15-DIA-DE-JOGO-PERMISSOES.md`.
>
> - **Onda S — Dia de jogo: colapsáveis + telão** (2026-09-05): toda seção do
>   dia de jogo (os quatro formatos + o dia de jogo do clube) recolhe e LEMBRA
>   por usuário (`v2:collapse:<uid>:<secao>`, só no navegador); e a rota
>   `/dia-de-jogo/:id/telao` abre um painel em tela cheia para a segunda tela,
>   adaptado a retrato e paisagem e atualizando sozinho a cada 15 s. O conteúdo
>   MUDA com o formato: na grade vão ranking do dia e últimos resultados; no
>   Play vão a próxima partida DE CADA QUADRA e a ordem de participação — **o
>   Play não grava placar**, então ali não existem resultados nem ranking. No
>   Play, quem ORGANIZA também conduz o dia pelo próprio telão (criar próxima
>   partida, criar jogo em quadra livre, cancelar, deixar indisponível ou
>   substituir clicando no nome,
>   pausar, vincular dupla); para todos os outros segue só leitura. Zero
>   impacto no banco.
>   Ver `docs/14-DIA-DE-JOGO-TELAO.md`.
>
> - **Onda R — Nível unificado nos sorteios** (2026-09-04): uma régua só
>   (2.0–8.0, a do DUPR) para TODOS os sorteios, alimentada por
>   DUPR informado → rating 2.0–8.0 da plataforma → ELO → nível declarado
>   (convertido para a mesma escala). Aplicada em dia de jogo
>   (Americano, Mexicano, Rei da Quadra e Play) e no seeding de torneios.
>   Leitura pura: **zero impacto no banco** (nenhuma coleção, campo, índice
>   ou regra novos). Ver `docs/13-NIVEL-UNIFICADO.md`.
> - **Gamificação V2** (#115): em produção atrás de `gamification_v2`
>   (default OFF). Documentação exclusiva em `docs/FUTURO/GAMIFICACAO/`.
>
> - **Onda G — DUPR / Rating estilo DUPR** (#128-#133, Sprints 38-43):
>   ranking próprio estilo DUPR (escala 2.0-8.0) em aba separada,
>   motor baseado em placar + confiabilidade, evolução por jogo,
>   redesign visual (#133). Flag `skill_rating_dupr` (default OFF).
>   ELO existente permanece intacto.
> - **Onda H — Engajamento (4 flags)** (#134, Sprints 44+):
>   `action_home` (Home orientada a ação), `smart_matchmaking`
>   (score 0-100 em Encontrar jogadores), `post_game_flow`
>   (Jogar de novo + Ver minha evolução), `push_notifications`
>   (PWA push com FCM + SW dedicado).
> - **Onda I — Torneio por equipes** (#105-#112, Sprints 32-37):
>   modalidade Equipes (sortear, jogar, ver ranking, etapas),
>   resultados espelhados em `club_event_games` com
>   `source='team_confrontation'`. Flag `team_tournaments`.
> - **Onda J — Arena Mercado** (#95-#100, Sprints 32-36):
>   catálogo padrão de produtos, mercado unificado, vendas
>   só do que está/esteve em estoque, gestão de catálogo.
> - **Onda K — Game Day Play** (#101-#109): formato Play
>   (open play) com organizador/participante separados,
>   sorteio aditivo, ranking do dia, visões separadas.
> - **Onda L — Admin + Moderation** (#110, #120): moderação
>   de atletas (ocultar contas falsas/teste), DUPR match CSV
>   export, bulk re-sync do diretório.
> - **Onda M — Coach** (#133-#135): descoberta aprimorada
>   (filtros + ordenação), alunos ligados à evolução, semente
>   de rating por nível validado.
> - **Onda N — Arena Ops** (#136+): painel "Como foi sua
>   semana" (arena_ops_kpis), preço dinâmico, checkout unificado,
>   CRM de membros (4 flags).
> - **Onda O — Refactor** (lotes 1-2): conversão de flags em
>   código (lotes 1 e 2) + enxugar catálogo para a única
>   flag remanescente. **137 feature flags viraram código**
>   (default ON em produção). Apenas 6 flags novas default OFF.
> - **Onda P — Tournament UX** (#113-#125): console de gestão
>   dedicado, "Meus torneios" no Perfil, inscrições/sorteio
>   colapsáveis, cards que iniciam fechados, fase de grupos
>   com múltiplos grupos, gêneros respeitados, visão pública
>   + impressão de grupos.
> - **Onda Q — V1 Legacy Cleanup** (`0f824b0`): remoção de
>   páginas V1 mortas em `src/modules/*/pages`.

## Federações — revisão geral (2026-10-21)

Depois dos quatro PRs (#281, #282, #283, #287), uma varredura de regra ×
servidor × cliente achou e corrigiu, no mesmo PR: a regra recusava ao admin da
plataforma o que a tela e o servidor lhe davam (`fedHas`); a equipe de uma
federação aprovada não era legível por quem via a página; `private/data` da
filiação podia ser gravado pelo dono (agora só o servidor); a filiação gratuita
com aprovação automática fazia `update` em documento que não existia; a
confirmação de cobrança de curso de não filiado quebrava por falta de
`member_id`; três telas liam "10.50" como R$ 1.000,00; a varredura expirava a
filiação no último dia válido; suspensões sobrepostas e futuras eram ignoradas;
`disabled` num `<Link>` deixava abrir a filiação de uma federação suspensa; e
o teste de navegador novo achou dois que só o navegador pega: a regra recusava
o `get` da própria filiação ainda inexistente (quem não é filiado nunca via o
"Filiar-se") e a lista de benefícios do plano derrubava a página pública.
A lição de teste que fica: `affectedKeys()` de um update idêntico é vazio, e um
`hasOnly` sobre ele passa sem provar nada. Detalhe em `docs/50-FEDERACAO.md` §12.

## Federações — indicadores e declaração de vínculo (2026-10-21)

Pedido do dono: "há algo mais para aprimorar a nova funcionalidade? Faça!".
Duas coisas que uma federação de verdade pede toda semana e a plataforma não
dava: os números para a diretoria e a prestação de contas (agora a seção
**Indicadores** da Central: 12 meses de filiados, renovação, recebido e atraso,
com CSV, das mesmas leituras que a Central já fazia) e a **declaração de
vínculo** que o atleta leva à Bolsa Atleta, à escola ou ao patrocinador (folha
imprimível com os resultados oficiais e o QR da verificação pública; a
federação decide se o filiado emite a própria). Zero banco: só a chave
opcional `rules.member_declarations`. Detalhe em `docs/50-FEDERACAO.md` §6.8.

## Federações — cargos, mandatos e acesso justificado (2026-10-21)

Pedido do dono: cargos criados pela própria federação, com atribuições
precisas e mandato de início e fim prorrogável; admins master (vários, nunca
nenhum) que passam a administração; e o admin da plataforma entrando só com
justificativa registrada e por prazo. Antes eram 8 papéis fixos, sem mandato,
um presidente só, e o admin da plataforma tinha toda permissão na Central sem
deixar rastro. Agora a equipe é gravada só pelo servidor, a regra lê a cópia
das permissões do cargo, o mandato vencido fecha o acesso (salvo o último
admin master) e o acesso do admin vai antes ao registro interno. Etapa 1 de
4 (acervo e mural, calendário e assembleias, comentários). Detalhe em
`docs/50-FEDERACAO.md` §13.

## Federações — acervo oficial e transparência (2026-10-21)

Pedido do dono: normas, regulamentos, atos, atas, convocações, súmulas,
avaliação de arenas, vídeo e áudio publicados pela federação, com envio de
arquivos e gestão completa. Antes não havia lugar para isso: a federação só
tinha notícias, e um ato oficial virava texto solto, sem número, sem versão e
sem como provar que o arquivo era o original. Agora o acervo é gravado só pelo
servidor, o ato ganha número por tipo e ano numa transação, o arquivo é
copiado para uma pasta oficial com SHA-256, o publicado não se edita (corrige
por retificação com motivo, errata ou ato que altera/revoga, com o histórico
visível) e o link do arquivo só existe enquanto o documento é público. A aba
Transparência confere o que a Lei 14.597/2023, art. 36, pede publicado. Etapa
2 de 4, parte 1 (a Central). Detalhe em `docs/50-FEDERACAO.md` §14.

Parte 2 (PR 8b): o acervo ganhou endereço público (`/f/:slug/acervo`) com
mural, busca e transparência; cada documento abre numa página para ler ali
mesmo, baixar, imprimir, compartilhar (link, WhatsApp, QR) e conferir se um
arquivo recebido é o oficial — o SHA-256 é calculado no aparelho, porque a
promessa do código de integridade só vale se qualquer pessoa conseguir
conferir. Quem segue o acervo recebe aviso de ato novo (só do que pode ler), e
a Central imprime o cartaz com QR para o mural da sede, que a lei também pede.
§14.8.

### Federação — calendário oficial (PR 9a, Etapa 3 do acervo, 2026-10-21)

Pedido do dono: agenda esportiva, de diretorias e setores, assembleias e
eventos, publicada pela federação. Antes não havia data oficial em lugar
nenhum: a assembleia era notícia, e quem a remarcava apagava a anterior sem
deixar rastro. Agora o calendário é gravado só pelo servidor, com catorze
tipos em três agendas (esportiva, institucional, eventos), quem vê (público,
só filiados, só a equipe) e documentos do acervo ligados. O evento já
divulgado não muda de data nem some calado: remarcar, adiar e cancelar pedem
motivo, ficam no histórico visível e avisam quem segue; apagar só o que só a
equipe viu. Os torneios chancelados entram sozinhos. O público tem
`/f/:slug/agenda`, cada evento com "Adicionar ao calendário" e Google Agenda,
e a agenda inteira assinável por ICS (`/api/agenda/{slug}.ics`), que atualiza
no celular quando a federação remarca. As reuniões com pauta, quórum e votação
são a parte 2. `docs/50-FEDERACAO.md` §15.

### Federação — reuniões e assembleias (PR 9b, Etapa 3 do acervo, 2026-10-21)

Segunda parte do calendário: a assembleia deixa de ser só uma data. Antes do
dia, a federação CONVOCA — data do edital (o ato publicado no acervo),
quórum de primeira e segunda chamada e a pauta, item a item, como
deliberação, eleição ou informe. O prazo mínimo do estatuto (padrão 8 dias,
em Configurações → Regras) só AVISA quando a convocação sai em cima da hora:
o estatuto pode prever urgência, e barrar seria decidir pela federação.
Depois do início, registra o RESULTADO: chamada, presentes e aptos, quórum e
o que se decidiu em cada item, com votos, resumo, o ato que saiu dele, a ata,
a lista de presença e o registro de votação. Sem quórum nada se decide. Mudar
a pauta divulgada e corrigir o resultado pedem motivo e ficam no histórico,
avisando quem segue. Tudo no campo `meeting` do evento, gravado só pelo
servidor, sem coleção nem regra nova. `docs/50-FEDERACAO.md` §15.9.

### Federação — comentários no acervo e na agenda (PR 10, Etapa 4 do acervo, 2026-10-21)

O pedido era que o público pudesse ler, baixar, compartilhar e COMENTAR os
documentos e os eventos da federação. Comentário num documento oficial é
diferente de comentário em rede social: o nome vai junto, a federação
responde em destaque (resposta oficial, com aviso a quem perguntou), e o que
fere alguém sai com motivo dito ao autor. Três denúncias de pessoas
diferentes ocultam sozinhas até a moderação olhar, para que um comentário
com o telefone de alguém não fique no ar a noite inteira esperando a
secretaria. Cada documento ou evento pode ficar com comentários abertos,
fechados ou em CONSULTA PÚBLICA até uma data — o caminho para ouvir os
filiados sobre um regulamento antes de aprová-lo. Tudo passa pelo servidor:
a coleção só o autor lê (é como a exportação encontra os dele) e a lista da
página sai de uma função que confere quem pode ler o documento e não entrega
o uid de ninguém. `docs/50-FEDERACAO.md` §16.
