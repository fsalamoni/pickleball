# Módulo `leagues` — Ligas

Temporada com rodadas no calendário, divisões por nível e classificação
acumulada. **Módulo próprio, ao lado do torneio** — não importa nada de
`tournament/` e o torneio não importa nada daqui. O que as duas competições
dividem mora no núcleo: a lista oficial de faixas (`core/domain/levelBrackets.js`),
o desempate (`core/domain/tiebreak.js`), os grupos e o rodízio do Americano
(`core/domain/americanoGroups.js`, usado pela escada) e o editor da ordem
(`v2/components/competition/TiebreakOrderEditor.jsx`). Doc completo:
[`docs/57-LIGAS.md`](../../../docs/57-LIGAS.md).

## Camadas

| Pasta | Arquivo | O quê |
|---|---|---|
| `domain/` | `leagueFlags.js` | as 5 flags (uma por grupo de quem cria) e `leaguesVisible` |
| | `leagueAccess.js` | `groupCanCreate`, `leagueOrganizerOptions`, `canManageLeague` (espelho do `podeGerir` do servidor) |
| | `leagueFormats.js` | formatos (DUPR/MiLP), status e transições, pontos padrão; nas equipes `lines`, `dreambreaker`, `composition` e `resultRules` |
| | `leagueDivisions.js` | regra da divisão (livre, faixa da lista oficial, faixa de DUPR antiga, teto da soma), gênero, `divisionEligibility`, `teamCompositionError` (montagem da equipe) |
| | `leagueSeason.js` | calendário (`normalizeSeason`, `roundsFor`, `roundCalendar`, `currentRound`) |
| | `leagueResults.js` | `validateResult`, `matchWinner`, `computeLeagueStandings` (desempate configurável pela regra do núcleo, `LEAGUE_DEFAULT_TIEBREAK_ORDER`) |
| | `leagueLadder.js` | a ESCADA (King of the Court e duplas): `computeLadder` (derivada dos jogos), `buildSessionGroups`, `nextSessionState`, `ladderNearestFits` — cópia em `functions/leagueLadder.js` com paridade |
| | `leaguePlayoff.js` | o PLAYOFF: `playoffSize`, `playoffFirstRound` (cruzamento pelas cabeças), `playoffState` (quem avança, campeão, 3º lugar — derivado), `playoffRoundLabel` — cópia em `functions/leaguePlayoff.js` com paridade |
| `services/` | `leagueService.js` | leituras (`leagues/**`) e `leagueAction` (callable `leagues`); `collectLeagueExport` |
| `hooks/` | `useLeagues.js` | React Query (`leagueKeys`), `useLeaguesVisible`, `useLeagueAction` |
| `i18n/` | `locales/{en,es}.js` | traduções |

Telas em `src/v2/pages/V2Leagues.jsx`, `V2CreateLeague.jsx`, `V2League.jsx` e
componentes em `src/v2/components/leagues/`.

## Regras que não podem regredir

1. **O cliente nunca escreve** em `leagues/**`: toda escrita é a função
   `leagues` (`functions/leagues.js`). A regra do domínio que o servidor usa
   está COPIADA em `functions/leaguePolicy.js`, com paridade
   (`functions/leaguePolicy.parity.test.js`) — mexer num lado só quebra o teste.
2. **Classificação e datas são derivadas**, nunca gravadas.
3. **A flag gateia criar, não ver**: liga já criada segue funcionando com a flag
   desligada.
4. Inscrição sem contato (conta, nome público, DUPR, categoria). Coleção nova
   aqui entra na exclusão (`coletarLigas`) e na exportação (`collectLeagueExport`).
5. Ids de formato, status, regra, gênero, aba (`?tab`) e seção (`?secao=`) são
   gravados ou contrato de link: nunca renomeie.
6. A organização inscreve **fora da regra** como no torneio: a tela avisa o
   motivo e o servidor marca `override` sozinho — não existe interruptor.
7. **A escada é derivada** (`computeLadder`): nenhuma posição é gravada; quem
   falta fica no lugar; sessão com placar só dá lugar à próxima depois de
   fechada. As quadras da sessão saem da MESMA conta no cliente (prévia) e no
   servidor (`buildSessionGroups`), travada pela paridade.
8. **Equipes**: o confronto tem um game por linha do formato (`lines`) e o
   DreamBreaker só existe no empate (`resultRules` + `validateResult`, nos dois
   lados); a montagem (2+2 na MiLP, mesma categoria na v4) sai do PERFIL e
   categoria desconhecida não vira palpite. Ids de `lines` e `composition`
   são contrato.
9. **O playoff é derivado**: só os jogos são gravados (`phase: 'playoff'`); a
   chave vem da tabela da temporada e cada fase dos vencedores da anterior, pela
   MESMA conta nos dois lados. Corrigir o placar de uma fase apaga a seguinte sem
   placar e é recusado se ela já tiver placar.
10. **Liga flexível**: quem joga lança (`report`) e o OUTRO lado confirma ou
    contesta (`confirm`); o servidor confere o lado pelas inscrições do jogo, o
    placar a confirmar não conta na tabela e o `result` da organização sempre
    vence. `self_report` mora no formato (paridade). Sem resposta em
    `AUTO_CONFIRM_HOURS` (72 h) o placar vale pela varredura
    `leagueAutoConfirmWorker`, e `pending_confirm` (só o servidor refaz) alimenta
    a faixa "Precisa de você" da Minha área (`myLeaguePending`).
