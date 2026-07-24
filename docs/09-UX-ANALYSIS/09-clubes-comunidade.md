# 09 — Clubes e comunidade

Contexto: módulo maduro — clubes com feed, fóruns (com enquetes), membros com papéis, eventos multi-datas com RSVP/chat e o Game Day (`V2GameDayOrganizer.jsx` + `gameDayDraw.js`, sorteio americano testado, placares casuais com autosave). Clubes exigem login para tudo e cada data de evento é criada manualmente.

---

### CLU-01 — Eventos recorrentes (P1 · M)
**Problema:** o jogo semanal do clube (caso de uso nº 1) exige criar data a data manualmente.
**Proposta:** "repetir semanalmente" ao criar evento: gera datas rolantes (ex. próximas 8), reabre RSVP a cada semana, notifica membros no dia anterior ("Confirma presença amanhã?"). Reusa o padrão de recorrência do domínio de arenas.

### CLU-02 — King of the Court e Mexicano no Game Day (P2 · M)
**Problema:** Game Day só sorteia no formato americano; Mexicano existe no domínio de torneios (`mexicano.js`) e King of the Court não existe.
**Proposta:** seletor de formato no organizer: Americano (atual) / Mexicano (reusar domínio, rodadas dirigidas por resultado) / King of the Court (fila: vencedor fica, perdedor sai — precisa de nº de quadras). Explicação curta de cada formato inline.

### CLU-03 — Ranking interno do clube (P2 · M)
**Problema:** placares de Game Day são explicitamente casuais e se perdem.
**Proposta:** ranking do clube opt-in (separado do nacional): tabela por temporada configurável (mês/trimestre) com V/D/saldo dos game days; página no clube; zero impacto no ELO nacional.

### CLU-04 — Ligas internas (P3 · A)
**Proposta:** série de game days pontuados (liga com calendário, tabela e playoffs simples) — reusa CLU-03 + formatos do domínio de torneio em escala de clube.

### CLU-05 — Financeiro do clube (mensalidades) (P2 · M)
**Proposta:** admin define mensalidade/contribuição; checklist mensal de pagantes (marcação manual; PIX automático com TRV-05); membros veem seu status; relatório simples. Dor real de quem gere clube por planilha.

### CLU-06 — Aviso fixado e comunicação (P2 · B)
**Proposta:** post fixado no topo do feed (admin), aviso com notificação a todos os membros (limite anti-spam, ex. 2/semana), menções @nome no chat de evento.

### CLU-07 — Página pública do clube (P1 · M)
**Problema:** tudo do clube exige login — clube não serve de vitrine para captar membro novo.
**Proposta:** versão pública `/c/:clubId` (nome, descrição, cidade, foto, nº de membros, dias/horários de jogo, arena onde joga) com CTA "Quero participar" (login → pedido de entrada no fluxo existente). Segue o padrão do `/p/:id` de torneios.

### CLU-08 — Convite por link/QR (P2 · B)
**Proposta:** link de convite com código (validade/limite de usos) e QR (motor existente) — entra sem aprovação manual se o admin escolher; hoje o fluxo é pedido+aprovação um a um.

### CLU-09 — Papéis adicionais no clube (P3 · B)
**Proposta:** além de admin: "organizador de jogos" (gere eventos/game day sem administrar membros) e "tesoureiro" (CLU-05). `club_members.role` já existe — expandir enum + regras.

### CLU-10 — Descoberta de clubes por cidade (P2 · B)
**Proposta:** diretório `/clubes` com filtro cidade/UF e ordenação por atividade (eventos recentes); destaque "clubes da sua cidade" no dashboard do atleta sem clube.

### CLU-11 — Integração clube × arena (P3 · B)
**Proposta:** campo "jogamos na arena X" (link bidirecional: página da arena lista clubes da casa); evento herda endereço da arena automaticamente.

### CLU-12 — Fotos nos eventos (P3 · B)
**Proposta:** galeria por evento (reusar infra de galeria de torneio) — memória social é motor de recorrência.

### CLU-13 — Placar do Game Day em tempo real (P3 · M)
**Proposta:** durante o game day, visão espectadora simples (rodada atual, quadras, próximos descansos) acessível aos membros — evita o "quem joga agora?" gritado no ginásio.

### CLU-14 — Moderação e denúncias na comunidade (P2 · M)
**Problema:** só arenas têm fluxo de denúncia/moderação; feed/fórum de clube não têm.
**Proposta:** "denunciar" em posts/comentários → fila de moderação do admin do clube + escalonamento ao platform admin; padrão único de moderação na plataforma.

### CLU-15 — Digest semanal do clube (P3 · M)
**Proposta:** notificação/email semanal opcional: próximos eventos, novos membros, destaques do ranking interno — reengajamento sem depender de abrir o app (com TRV-01/02).
