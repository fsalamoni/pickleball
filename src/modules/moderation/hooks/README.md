# `moderation/hooks/` — React Query (PLANEJADO)

| Hook | Uso |
|---|---|
| `useReportContent()` | mutação de denúncia, usada pelo `ReportDialog` |
| `useModerationQueue(filters)` | fila do admin, ordenada por `priorityScore` |
| `useModerationItem(reportId)` | item com contexto (alvo, autor, histórico) |
| `useBlocks()` | lista de bloqueios nas duas direções, 1× por sessão |
| `useMutes()` | silenciados |
| `useMyStrikes()` | strikes do usuário (banner + recurso) |
| `useRateLimit(action)` | estado do limite para a UI explicar antes de falhar |
