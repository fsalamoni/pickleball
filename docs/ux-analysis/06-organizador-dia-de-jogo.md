# 06 — Organizador: dia de jogo (operação ao vivo)

Contexto: no dia do evento, o organizador opera pelas mesmas abas administrativas de gestão. O placar é lançado em `V2ScoreEntryDialog` (inputs numéricos comuns); as chaves são tabelas planas; a página pública `/p/:id` atualiza por polling (20–60s, `PublicTournament.jsx`). Não há modo operacional dedicado, telão, nem delegação a mesários.

---

### DIA-01 — Console "Dia de Jogo" (P1 · A)
**Proposta:** rota `/torneios/:id/operacao` (admins): colunas por quadra com o jogo atual e os 2 próximos; ações rápidas por card (Iniciar / Lançar placar / WO); fila de "aguardando quadra"; indicadores no topo (jogos concluídos/restantes, atraso médio). É a "torre de controle" que troca 5 abas por 1 tela durante o evento.
**Reuso:** hooks de matches existentes (`useMarkMatchInProgress`, `useRecordMatchResult`), `scheduling.js`.
**Flag:** `GAME_DAY_CONSOLE`.

### DIA-02 — Placar courtside otimizado (P0 · M)
**Problema:** `V2ScoreEntryDialog` usa `<input type=number>` pequenos — no sol, em pé, com pressa, é hostil; WO fica escondido num select.
**Proposta:** modo tela cheia mobile: dois painéis gigantes (lado A/B) com botões +1/−1 por set, número do set atual em destaque, botão WO explícito por lado (com confirmação), "Salvar e próximo da quadra" que navega ao próximo jogo pendente da mesma quadra. Manter o dialog atual no desktop.
**Flag:** `COURTSIDE_SCORING`.

### DIA-03 — Delegação de placar a mesários (P1 · A)
**Problema:** só admins lançam placar; delegar exige entregar poder total (ver ORG-21).
**Proposta:** por quadra, gerar link/QR de mesário (token com escopo: lançar placar apenas dos jogos daquela quadra/torneio, com expiração no fim do dia); página do mesário = DIA-02 restrito. Token em coleção `scorekeeper_tokens` validada por regras/function.
**Depende:** ORG-21 (papéis) ou tokens dedicados.

### DIA-04 — Modo Telão/TV (P1 · M)
**Proposta:** rota pública `/p/:id/telao`: tipografia gigante sobre fundo ink, 3 blocos auto-rotativos (Em quadra agora / Próximos chamados / Últimos resultados), relógio, logos de patrocinadores (ORG-17); sem interação — feita para TV/projetor no evento; atualização em tempo real (DIA-11).
**Flag:** `TOURNAMENT_TV_MODE`.

### DIA-05 — Árvore visual de chaves (P1 · A)
**Problema:** chaves de eliminação são tabelas com rótulo de rodada (admin, público e impressão) — ilegível como estrutura.
**Proposta:** componente `BracketTree` (SVG/CSS grid): colunas por rodada, conectores, avatar+nome+placar por confronto, zoom/pan horizontal no mobile, destaque do caminho do campeão; variantes para dupla eliminação (WB/LB) e versão print. Dados já têm `bracket`/`round` — é só renderização.
**Flag:** `BRACKET_TREE_VIEW`.

### DIA-06 — Quadro de quadras com drag-and-drop (P2 · A)
**Problema:** agenda só muda por reagendamento em massa (`useRescheduleMatches`); não dá para ajustar um jogo pontual.
**Proposta:** grade horária × quadras com cards de jogos arrastáveis (validação de conflito de participante no domínio `scheduling.js`); edição pontual de horário/quadra no card (fallback sem drag: selects no dialog do jogo).

### DIA-07 — Gestão de atraso em cascata (P2 · M)
**Proposta:** ação "Registrar atraso de N min" (por quadra ou geral) que reflui os horários projetados dos jogos pendentes e atualiza página pública/telão ("previsto 14:30 → 14:50"). Campo `delay_minutes` por quadra; cálculo derivado, sem regravar todos os docs.

### DIA-08 — Chamada de jogo (anúncio) (P2 · B)
**Proposta:** botão "Chamar" no jogo → destaca no telão ("QUADRA 2: Fulano × Beltrano"), notifica os 2–4 atletas (push/in-app) e opcionalmente sintetiza voz (Web Speech API, sem dependência externa).

### DIA-09 — Check-in kiosk (balcão) (P2 · M)
**Proposta:** rota `/torneios/:id/checkin-kiosk` (tablet no balcão, sessão de admin): busca por nome ou leitura do QR da carteirinha (ATL-14) → check-in em 1 toque, feedback grande verde. Complementa ATL-03/ORG-08.

### DIA-10 — Tela de pódio/premiação (P2 · M)
**Problema:** medalhas são emojis em tabela; não há momento de celebração.
**Proposta:** ao encerrar modalidade: página de pódio (1º/2º/3º com fotos, confete animado — respeitando reduced-motion), botão "foto oficial" (exporta imagem via `html-to-image`), CTA para certificados (`TOURNAMENT_CERTIFICATES` já existe). Link no telão e na página pública.

### DIA-11 — Tempo real na fase ao vivo (P1 · M)
**Problema:** `/p/:id` faz polling (matches 20s, ranking 30s) — placar "atrasado" no celular da torcida e custo de leitura desnecessário.
**Proposta:** enquanto o torneio está `IN_PROGRESS`, trocar polling por `onSnapshot` (Firestore já é a stack; listeners com limite e teardown fora da fase ao vivo). Telão (DIA-04) usa o mesmo mecanismo.

### DIA-12 — Impressão operacional (P2 · M)
**Proposta:** além do print atual por modalidade: súmula individual por jogo (nomes, sets, assinaturas), folha por quadra (sequência do dia) e etiquetas de chaveamento. Rotas print dedicadas reusando o padrão `print-mode` de `PrintTournament.jsx`.

### DIA-13 — Modo offline de emergência (P3 · A)
**Proposta:** o console DIA-01 mantém fila local (IndexedDB) de placares lançados sem rede e sincroniza ao reconectar, com indicador "N pendentes". Ginásios têm internet ruim; perder placar é o pior cenário do organizador.

### DIA-14 — Painel de pendências pós-evento (P3 · B)
**Proposta:** checklist de fechamento no encerramento: placares faltantes (bloqueiam ranking), WOs a revisar, pagamentos pendentes (ORG-15), fotos (galeria), certificados — com link direto para resolver cada item.

### DIA-15 — Vista do atleta no local ("modo evento") (P3 · M)
**Proposta:** quando o atleta com check-in abre o app durante torneio `IN_PROGRESS`, o dashboard prioriza o bloco do evento: próximo jogo, quadra, chave, telão link, avisos do organizador (ORG-09). Sai do modo ao encerrar o torneio.
