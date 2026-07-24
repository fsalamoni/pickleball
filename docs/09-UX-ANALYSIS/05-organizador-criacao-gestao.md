# 05 — Organizador: criação e gestão de torneios

Contexto: criação em `V2CreateTournament.jsx` (formulário único, valida só o nome), modalidades em `V2TournamentModalitiesTab.jsx` (447 linhas, sem rascunho), status em `TournamentAdminTab.jsx` (`STATUS_ACTIONS` linhas 69-94, sem guardas e sem "Cancelar"), inscrições em `V2TournamentRegistrationsTab.jsx`, sorteio em `V2TournamentDrawTab.jsx` (784 linhas, poderoso). O domínio suporta 7 formatos testados.

---

### ORG-01 — Wizard de criação em etapas (P1 · M)
**Problema:** "Monte um torneio" é um formulário único; a única validação é nome não-vazio (`V2CreateTournament.jsx:43`); modalidades/preços ficam para depois sem que o fluxo diga isso.
**Proposta:** stepper de 4 passos com preview persistente: (1) Básico (nome, cidade/UF, local, datas); (2) Modalidades (mínimo 1, com presets ORG-02); (3) Inscrições (visibilidade, prazo, taxas, instruções de pagamento ATL-08); (4) Revisão e publicação (checklist do que falta). Rascunho salvo a cada passo (o torneio já nasce DRAFT — usar o próprio doc como rascunho).
**Flag:** `TOURNAMENT_WIZARD`.

### ORG-02 — Templates/presets de torneio (P1 · M)
**Proposta:** galeria "Começar de um modelo": "Duplas mistas — 16 duplas, grupos + mata-mata", "Americano social — 12 jogadores", etc. Preset = tournament + modalities pré-configurados (o domínio `presets` já tem base testada; a duplicação `TOURNAMENT_DUPLICATION` já copia estruturas — reusar).

### ORG-03 — Editor de modalidade em seções com rascunho (P1 · M)
**Problema:** `V2TournamentModalitiesTab.jsx` é um formulário de ~15 campos (formato, nível, gênero, idade, vagas, taxa, formato de disputa, fases, quadras, duração, janela, notas) numa página só; fechar perde tudo.
**Proposta:** dividir em 4 seções colapsáveis (Identidade / Formato de disputa / Agenda e quadras / Inscrições e taxa) com autosave de rascunho (localStorage por tournamentId) e resumo lateral fixo; validação por seção com âncora no primeiro erro.

### ORG-04 — Máquina de status com guardas + Cancelar (P0 · M)
**Problema:** `STATUS_ACTIONS` permite pular para qualquer status a partir de qualquer status; **não há botão "Cancelar torneio"** embora `CANCELLED` exista e seja pré-requisito do arquivamento (aviso em `TournamentAdminTab.jsx:475-483`) — beco sem saída real.
**Proposta:** (a) adicionar ação "Cancelar torneio" com ConfirmDialog (consequências: sai das listas, permite arquivar; motivo opcional gravado); (b) matriz de transições válidas no domínio (`canTransitionTournamentStatus(from, to)`) com testes; botões inválidos desabilitados com tooltip explicando; (c) timeline visual do ciclo de vida no topo da aba (Rascunho → Inscrições → Em andamento → Encerrado) com o estado atual destacado.
**Flag:** `TOURNAMENT_CANCEL_ACTION` (item a); guardas podem entrar na mesma flag.

### ORG-05 — Dashboard operacional do torneio (P0 · M)
**Problema:** sinais operacionais existem fragmentados (contadores dentro das abas de sorteio/inscrições) — o organizador não tem visão de "como está meu torneio".
**Proposta:** primeira aba do painel admin vira "Resumo": cards (inscrições confirmadas/pendentes de pagamento/lista de espera; % jogos concluídos por modalidade; jogos sem quadra/horário; check-ins) cada um clicável para a aba correspondente; alertas ("3 inscrições aguardam pagamento há 5 dias", "modalidade X sem sorteio e torneio começa amanhã").
**Flag:** `TOURNAMENT_OPS_DASHBOARD`.

### ORG-06 — Ações em massa nas inscrições (P1 · M)
**Problema:** ações são linha a linha em `V2TournamentRegistrationsTab.jsx`.
**Proposta:** seleção múltipla com barra de ações (confirmar pagamento, cancelar, mover de modalidade quando compatível), filtro por status e busca por nome; contador "selecionadas: N".

### ORG-07 — Exportar inscrições/jogos em CSV (P1 · B)
**Proposta:** botões "Exportar CSV" nas abas de inscrições e jogos (geração client-side; colunas: nome, e-mail, telefone, status, pagamento, modalidade / jogo, fase, quadra, horário, placar). Necessidade básica de secretaria que hoje força copiar-colar manual.

### ORG-08 — Check-in pelo organizador (P1 · M)
**Problema:** ver ATL-03 — status existe, UI não.
**Proposta:** na aba de inscrições, modo "Check-in" (toggle): lista compacta com busca e botão único por linha ("Check-in" / "Desfazer"); contadores por modalidade (12/16); filtro "faltam". Sorteio já considera `CHECKED_IN` — nenhuma mudança no domínio.
**Flag:** `TOURNAMENT_CHECKIN`.

### ORG-09 — Comunicação em massa com inscritos (P1 · M)
**Proposta:** "Enviar aviso" (por torneio ou modalidade): título + mensagem → notificação in-app para todos os inscritos (push quando existir) + botão "copiar lista de telefones" e texto pronto para grupo de WhatsApp. Log de avisos enviados.
**Flag:** `TOURNAMENT_ANNOUNCEMENTS`.

### ORG-10 — Seeds/cabeças-de-chave manuais (P2 · M)
**Problema:** o sorteio usa seeding automático (`seeding.js`); organizador não consegue definir cabeças manualmente.
**Proposta:** antes do sorteio, lista ordenável (drag) de cabeças 1..N por modalidade; o motor de sorteio já aceita seeds — expor na UI com validação (N ≤ vagas).

### ORG-11 — Preview do sorteio antes de publicar (P1 · M)
**Problema:** "Sortear" publica imediatamente; refazer descarta placares (aviso só textual).
**Proposta:** sorteio gera estado "prévia" visível só a admins (banner "não publicado"), com "Publicar" e "Refazer prévia". Publicar notifica inscritos (ORG-09).

### ORG-12 — Histórico e desfazer de operações de sorteio (P2 · A)
**Proposta:** log de operações (sortear, re-sortear, mover grupo, substituir) com snapshot compacto antes de cada uma; "desfazer última operação" quando nenhum placar novo foi lançado depois dela. Complementa os ConfirmDialog existentes.

### ORG-13 — Terceiro lugar e consolação (P2 · M)
**Problema:** `third_place` existe no domínio de brackets, mas não há opção explícita de disputa de 3º nem chave de consolação para eliminados cedo.
**Proposta:** toggles na modalidade: "Disputa de 3º lugar" e "Consolação (repescagem dos eliminados na 1ª rodada)"; consolação gera mini-chave paralela — amadores pagam para jogar mais de um jogo.

### ORG-14 — Regulamento do torneio (P2 · B)
**Proposta:** campo markdown "Regulamento" no torneio (editor `markdown-editor` existente), exibido em aba/âncora na página do torneio e na pública; aceite opcional na inscrição ("li e concordo").

### ORG-15 — Financeiro do torneio (P1 · M)
**Problema:** pagamento é badge binária por inscrição; nenhuma visão agregada.
**Proposta:** aba "Financeiro": receita esperada × confirmada por modalidade, lista de pendentes (com dias em atraso e botão de cobrar → notificação), exportação CSV. Com gateway (TRV-05), conciliação automática.
**Flag:** `TOURNAMENT_FINANCE`.

### ORG-16 — Relatório pós-evento (P3 · M)
**Proposta:** ao encerrar: página-resumo (participantes, jogos, duração média, campeões por modalidade, NPS ATL-20) exportável em PDF/imagem para prestação de contas a patrocinadores.

### ORG-17 — Patrocinadores do torneio (P2 · M)
**Proposta:** cadastro de patrocinadores (logo + link) por torneio; exibição na página pública, no telão (DIA-04) e nos share cards/certificados. Monetização direta do organizador — diferencial competitivo.
**Flag:** `TOURNAMENT_SPONSORS`.

### ORG-18 — Página pública do organizador (P3 · M)
**Proposta:** perfil de organizador (`/organizador/:uid`): torneios realizados, próximos, avaliação média (ATL-20), botão seguir. Constrói reputação e recorrência.

### ORG-19 — Feedback dos atletas visível ao organizador (P2 · B)
**Proposta:** aba com os reviews de ATL-20 (média, distribuição, comentários). Fechamento de ciclo: organizador melhora a cada edição.

### ORG-20 — Circuitos/séries multi-etapas (P3 · A)
**Proposta:** entidade `circuit` agrupando torneios (etapas) com tabela de pontos por colocação e ranking agregado do circuito (página pública própria). O motor de ranking por modalidade já existe; o agregado é uma soma configurável.

### ORG-21 — Papéis de staff granulares (P2 · M)
**Problema:** `tournament_admins` é tudo-ou-nada; um mesário precisa de conta com poder total.
**Proposta:** papel por admin: `owner`/`admin`/`scorekeeper` (só lança placar)/`checkin` (só check-in); regras Firestore por papel; UI de convite já existe (por e-mail) — adicionar select de papel.

### ORG-22 — Duplicação promovida na UI (P3 · B)
**Proposta:** ao encerrar um torneio, sugerir "Criar próxima edição" (usa `TOURNAMENT_DUPLICATION` existente) já com datas +1 mês e nome incrementado ("Copa X — 2ª edição").
