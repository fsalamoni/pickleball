# 11 — Quick wins

Itens de esforço baixo (horas, não dias) com retorno imediato. ✅ = implementado no branch desta análise.

| ID | Item | Evidência | Ação | Status |
| --- | --- | --- | --- | --- |
| QW-01 | Remover link "App anterior" quebrado | `V2Layout.jsx:286-292` → `/v1/inicio` não existe; cai no catch-all | Remover o link do header | ✅ |
| QW-02 | Unificar cor do spinner | `App.jsx:58` `border-primary` (esmeralda) vs `V2App.jsx:58` `border-ink` | Ambos `border-ink` | ✅ |
| QW-03 | Copy obsoleta no perfil | `V2Profile.jsx:96-99` "continua no app atual" | Texto neutro apontando o editor | ✅ |
| QW-04 | Botão "Cancelar torneio" | `TournamentAdminTab.jsx:69-94` sem ação para `CANCELLED`, exigido p/ arquivar (l. 475-483) | Ação com ConfirmDialog (flag `TOURNAMENT_CANCEL_ACTION`) | ✅ |
| QW-05 | Link para rota redirecionante | `V2ParticipationHistoryCard.jsx:147` e `tournamentService.js:159` → `/torneios/publicos` | Apontar direto para `/torneios` | ✅ |
| QW-06 | Placeholder da busca enganoso | `V2Layout.jsx:280` promete cidades/clubes; busca só atletas | Placeholder "Buscar atletas..." até NAV-03 | ✅ |
| QW-07 | Montar completude de perfil | `ProfileCompletionModal.jsx` nunca importado | Montar no layout com "Deixar para depois" (flag `PROFILE_ONBOARDING`) | ✅ |
| QW-08 | "Marcar todas como lidas" | `useNotifications.js` só tem `markAsRead` unitário | Batch update + botão no dropdown (flag `NOTIFICATIONS_MARK_ALL`) | ✅ |
| QW-09 | Logout no desktop | Único "Sair" está no drawer mobile (`V2Layout.jsx:353`) | Menu do usuário no topbar (flag `NAV_USER_MENU`) | ✅ |
| QW-10 | Check-in mínimo | `CHECKED_IN` sem UI (`constants.js:319`) | Ação na aba de inscrições (flag `TOURNAMENT_CHECKIN`) | ✅ |
| QW-11 | Bottom nav mobile | `pb-24` reservado sem uso (`V2Layout.jsx:303`) | 5 itens fixos (flag `MOBILE_BOTTOM_NAV`) | ✅ |
| QW-12 | Título do documento por rota | `document.title` fixo em todas as páginas | Hook de título no layout (NAV-08) | — |
| QW-13 | Migrar imports legados em componentes V2 | `V2GameDayOrganizer.jsx:9-10`, `V2EventDatesPanel.jsx:9-10` (Skeleton/EmptyState), `V2MatchesBlock.jsx:12` (Button) | Trocar por primitivos V2 (DS-04/05) | — |
| QW-14 | "Minhas reservas" visível com ARENAS off | `V2Layout.jsx:87` item incondicional | Condicionar à flag `ARENAS` | — |
| QW-15 | Atualizar docs desatualizados | `AI_CONTEXT.md`/`README.md` citam `V1Routes.jsx` inexistente; rotas admin não documentadas | Revisar docs | — |
| QW-16 | `DESIGN_STANDARD.md` desalinhado | Manda `Platform*`/slate; código usa `V2*`/ink | Reescrever (DS-01) | — |
| QW-17 | Ativar PWA | `VITE_PWA_ENABLED` off com SW pronto | Ligar + banner de instalação (TRV-03) | — |
| QW-18 | WO mais visível no placar | WO enterrado em select no `V2ScoreEntryDialog` | Botões explícitos "WO lado A/B" | — |
| QW-19 | Máscara de telefone | Inputs `tel` sem máscara (perfil, modal) | Máscara + normalização (ONB-11) | — |
| QW-20 | 404 interna em vez de redirect mudo | Catch-all `V2App.jsx` → `/` | Página 404 com busca (NAV-09) | — |
| QW-21 | Tokens shadcn esmeralda | `--primary 161 78% 28%` em `index.css` | Mapear para ink/acid (DS-03) | — |
| QW-22 | Remover fontes Manrope/Sora | `index.css:1` importa 2 famílias extras | Padronizar Outfit/Inter (DS-02) | — |
| QW-23 | ICS "Adicionar ao calendário" | Sem integração de agenda | Gerar .ics client-side (ATL-02) | — |
| QW-24 | Exportar inscrições CSV | Secretaria copia/cola manualmente | Botão exportar (ORG-07) | — |
| QW-25 | Heatmap de preços da arena | Regras de preço como lista abstrata | Grade colorida (ARE-07) | — |
