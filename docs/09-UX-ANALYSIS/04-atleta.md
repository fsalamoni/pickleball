# 04 — Atleta

Contexto: o atleta encontra torneios em `/torneios` (`V2Tournaments.jsx`), se inscreve via `ModalityRegistrationDialog.jsx`, acompanha em "Meus próximos jogos" (`MyUpcomingMatches.jsx`, flag `TOURNAMENT_UX`) e vê estatísticas em `/meu-desempenho` (flag). Pagamento é manual, check-in não existe, dupla é texto livre.

---

### ATL-01 — Página "Meus jogos" unificada (P0 · M)
**Problema:** o único "quando eu jogo?" é um card no dashboard (`MyUpcomingMatches.jsx`); resultados passados só existem espalhados dentro de cada torneio. Não há visão única da vida esportiva do atleta.
**Proposta:** rota `/meus-jogos` com abas **Próximos** (data/hora, quadra, adversário, torneio; ordenado por horário; destaque "hoje") e **Disputados** (placar, V/D com cor, link para o torneio). Fonte: `upcomingService.js` (já existe) + query de matches finalizados por participante.
**Flag:** `MY_MATCHES_PAGE`.

### ATL-02 — Exportar jogos para o calendário (P1 · B)
**Proposta:** botão "Adicionar ao calendário" por jogo e por torneio: arquivo `.ics` gerado no cliente (sem lib: template texto) + link Google Calendar pré-preenchido. Entrada em ATL-01 e na página do torneio.

### ATL-03 — Self check-in do atleta (P1 · M)
**Problema:** `REGISTRATION_STATUS.CHECKED_IN` (`constants.js:319`) é lido pelo sorteio mas nenhuma UI o escreve.
**Proposta:** quando o torneio está `IN_PROGRESS` ou próximo (janela configurável, ex. 2h antes), o atleta vê banner "Confirme sua presença" na página do torneio e em ATL-01 → 1 toque faz check-in (grava status + `checked_in_at`). Organizador vê contadores (ORG-08). QR no balcão como alternativa (DIA-09).
**Flag:** `TOURNAMENT_CHECKIN` (compartilhada com ORG-08).

### ATL-04 — Convite e aceite de dupla (P0 · A)
**Problema:** na inscrição de duplas o atleta digita nome/email/nível do parceiro como texto livre (`ModalityRegistrationDialog.jsx`); o `user_id` do jogador B fica `null`, o parceiro não fica sabendo, e a identidade solta corrompe histórico/ranking (mesma pessoa pode existir N vezes com grafias diferentes).
**Proposta:** fluxo de convite — o inscrito busca o parceiro na plataforma (typeahead no diretório) OU convida por link/WhatsApp se não tiver conta; a inscrição nasce `PENDING_PARTNER` e só vira efetiva com o aceite (notificação + tela de aceite); prazo de expiração; fallback "inscrever sem conta" mantém o fluxo atual para convidados de fora.
**Dados:** `registrations.partner_invite {uid|email, status, expires_at}`; novo tipo de notificação; claim posterior de conta convidada (mecanismo de inscrição provisória já existe — reusar).
**Flag:** `PARTNER_INVITES`.

### ATL-05 — Parceiros salvos (P2 · B)
**Proposta:** após jogar com alguém, sugerir "salvar como parceiro"; na próxima inscrição de dupla, lista "Parceiros frequentes" com 1 toque. Subcoleção `users/{uid}/partners`.

### ATL-06 — "Procuro parceiro para este torneio" (P2 · M)
**Proposta:** na modalidade com formato dupla, botão "Procurar parceiro" cria anúncio visível aos elegíveis (nível/gênero compatíveis via `evaluateRegistrationEligibility` existente); match → convite ATL-04. Integra o matchmaking (`V2FindPlayers`) que hoje é desconectado da inscrição.

### ATL-07 — Timeline visual da inscrição (P1 · B)
**Problema:** o atleta vê apenas uma badge de status; não entende o que falta.
**Proposta:** stepper horizontal na página do torneio e em ATL-01: Inscrito → Pagamento → Confirmado → Check-in, com o passo atual pulsando e CTA do próximo passo (ex.: "Pagar agora", "Fazer check-in").

### ATL-08 — Instruções de pagamento na inscrição (P0 · M)
**Problema:** com `entry_fee_cents > 0`, o dialog diz apenas "pagamento será solicitado em seguida" e a inscrição fica `PENDING_PAYMENT` até um admin confirmar manualmente — o atleta não tem nenhuma instrução de como pagar.
**Proposta (fase 1, sem gateway):** organizador configura na modalidade os dados de pagamento (chave PIX, instruções); pós-inscrição mostra tela com QR PIX estático (lib `qrcode` já existe — payload EMV "copia e cola"), valor, prazo e botão "Já paguei" (grava `payment_declared_at`, notifica o organizador para conciliar). Fase 2: gateway com confirmação automática (TRV-05).
**Flag:** `PAYMENT_INSTRUCTIONS`.

### ATL-09 — Filtros e mapa na descoberta de torneios (P1 · M)
**Problema:** `/torneios` é uma lista sem filtros de proximidade/nível/data.
**Proposta:** filtros por UF/cidade (chips `V2FilterChip`), período, formato, nível com vagas; visão mapa opcional (pins por cidade); ordenação "mais próximos" usando cidade do perfil.

### ATL-10 — Alertas de novos torneios (P2 · M)
**Proposta:** "Me avise sobre torneios em [minha cidade/UF] do meu nível" — assinatura em `users/{uid}/subscriptions`; Cloud Function na criação/abertura de torneio dispara notificação (push quando TRV-01 existir).

### ATL-11 — Página do torneio com informações práticas (P2 · B)
**Proposta:** seção "Informações" com local em mapa embutido (link Google Maps), regulamento (ORG-14), contato do organizador (wa.me), FAQ. Hoje o hero mostra apenas cidade/datas.

### ATL-12 — "Você joga em X min" na página pública (P1 · M)
**Proposta:** em `/p/:id`, se o visitante logado é participante, banner fixo com o próximo jogo dele (quadra, horário, adversário) e auto-scroll para a linha do seu jogo. Os dados já estão na página; falta a personalização.

### ATL-13 — Cartão de resultado compartilhável (P2 · M)
**Proposta:** pós-jogo finalizado, botão "Compartilhar resultado" gera card (motor `SHARE_CARDS`/`html-to-image` existente): placar, parceiro, fase, logo do torneio. Distribuição orgânica.

### ATL-14 — Carteirinha digital do atleta (P3 · M)
**Proposta:** card com QR (identidade para check-in DIA-09), foto, nível, cidade, rating; exportável como imagem. Reusa `qrcode` + `html-to-image`.

### ATL-15 — Ranking com paginação e busca server-side (P1 · M)
**Problema:** `V2Ranking.jsx` renderiza todos os jogadores e monta as opções de filtro iterando o array inteiro no cliente.
**Proposta:** paginação (50/página) com "minha posição" fixada no topo; virtualização da lista; filtros a partir de valores agregados pré-computados.

### ATL-16 — Ranking de duplas (P3 · A)
**Proposta:** rating de dupla (par ordenado de uids com histórico conjunto) exibido como aba no ranking. Depende de ATL-04 (identidade do parceiro).

### ATL-17 — Filtro "quem eu sigo" no ranking e feed (P3 · B)
**Proposta:** com `FOLLOW_ATHLETES` on, chip "Seguindo" no ranking e no feed — comparação social é motor de retenção.

### ATL-18 — Comparador head-to-head entre dois atletas (P2 · M)
**Proposta:** em `/atleta/:uid`, botão "Comparar comigo": tela lado a lado (rating, V/D, títulos, confrontos diretos usando `headToHead.js` existente).

### ATL-19 — Metas pessoais visíveis (P3 · B)
**Proposta:** o módulo `progression` (XP, streak, metas em `player_goals`) existe atrás de flag; promover as metas ao dashboard ("2 de 3 torneios da meta anual") com edição inline.

### ATL-20 — Avaliação pós-torneio (NPS do evento) (P2 · B)
**Proposta:** ao encerrar torneio em que jogou, notificação "Como foi o torneio X?" → 1–5 estrelas + comentário opcional; agregado visível só ao organizador (ORG-19). Coleção `tournament_reviews`.

### ATL-21 — Disponibilidade semanal "quero jogar" (P3 · M)
**Proposta:** grade semanal simples no perfil (manhã/tarde/noite × dias); alimenta matchmaking e "Procura-se jogo" com compatibilidade de horário.

### ATL-22 — Histórico de posição no ranking (P3 · B)
**Proposta:** além do sparkline de rating (`RATING_HISTORY`), mostrar variação de posição ("↑3 esta semana") no card do ranking e no perfil.

### ATL-23 — Central de notificações como página (P2 · M)
**Problema:** notificações vivem só num dropdown de 320px (`NotificationsMenu`); sem histórico navegável, sem agrupamento.
**Proposta:** rota `/notificacoes` com lista completa, agrupamento por dia, filtros por tipo, "marcar todas como lidas" (QW-08); dropdown mantém as 8 últimas + link "Ver todas".

### ATL-24 — Estados vazios orientados a ação (P2 · B)
**Proposta:** auditar os vazios do atleta: sem torneios → CTA "explorar públicos" + "criar alerta" (ATL-10); sem jogos → CTA nivelamento/procura-jogo; sem notificações → dica de ativar push. Padronizar com `V2EmptyState` + ilustrações DS-14.

### ATL-25 — Acessibilidade das tabelas de jogos (P2 · B)
**Proposta:** tabelas de jogos/ranking com `scope`/`caption`, navegação por teclado nas linhas clicáveis, placar anunciado por screen reader ("6 a 4 para dupla A"); contraste dos badges revisado (DS-09).
