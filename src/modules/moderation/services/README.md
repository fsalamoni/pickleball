# `moderation/services/` — I/O Firestore (PLANEJADO)

| Arquivo | Responsabilidade |
|---|---|
| `reportService.js` | criar denúncia (com snapshot do alvo), listar fila, agrupar |
| `moderationActionService.js` | registrar ação (motivo obrigatório), reverter, aplicar efeito no alvo |
| `strikeService.js` | emitir, expirar, recorrer, somar peso |
| `blockService.js` | bloquear/desbloquear, limpar follows, marcar conversa somente-leitura |
| `muteService.js` | silenciar autor/hashtag (lista em `feed_preferences` ou `user_mutes`) |
| `rateLimitService.js` | ler/incrementar `user_rate_counters`; chamado **antes** de toda escrita limitada |
