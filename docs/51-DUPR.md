# 51 — Integração oficial com o DUPR (RaaS)

> Estado: **em construção, só ambiente UAT**. Chave de produção só depois da
> revisão do DUPR (e-mail para tech@mydupr.com). Flag: `dupr_official_sync`
> (default OFF). Desligada, o cadastro manual de ID/rating DUPR segue como está.
> Feito: cliente da API, **vínculo da conta pelo login do DUPR**, rating por
> webhook e selo. A fazer: envio de partidas, suporte/disputa e produção.

## 1. O que o DUPR oferece (e o que exige)

| Peça | Como funciona | Regra do DUPR |
|---|---|---|
| Token de parceiro | `POST /auth/v1.0/token`, `x-authorization: base64(key:secret)`, vale 1 h | Segredo só no servidor |
| Login (SSO) | iframe `…/login-external-app/<base64(clientKey)>`, devolve `accessToken`/`refreshToken` do usuário (somente leitura) | **Única** forma de conectar a conta; ID digitado à mão não vale |
| Rating | webhook `RATING` (inscrever o `duprId`; chega `RATING_SEED` na inscrição) | Só usuário conectado pode ser inscrito |
| Assinatura | `BASIC_L1` obrigatório; `PREMIUM_L1`/`VERIFIED_L1` para eventos premium | Cache de até 24 h |
| Partidas | criar, lote (≤100), alterar, apagar; guardar o `matchCode` | `identifier` único; sem jogador repetido; só diretor/organizador envia |
| Clube | papéis DIRECTOR / ORGANIZER / PLAYER | Só DIRECTOR/ORGANIZER vinculam clube e enviam partidas do clube |
| Suporte | canal claro para o jogador contestar partida | Exigência da revisão |

Ambientes: UAT `https://uat.mydupr.com/api` (parceiro), `https://api.uat.dupr.gg`
(token do usuário), `https://uat.dupr.gg/login-external-app/` (SSO). Produção:
`prod.mydupr.com/api`, `api.dupr.gg`, `dashboard.dupr.com/login-external-app/`.

## 2. Onde ficam as credenciais

* **GitHub Actions** (segredos do repositório): `DUPR_CLIENT_KEY`, `DUPR_CLIENT_SECRET`.
  Só um workflow as lê; nunca aparecem no log nem no navegador.
* **Servidor**: `platform_secrets/dupr` (`client_key`, `client_secret`, `env`,
  `webhook_token`). A regra do Firestore bloqueia o navegador (nem o admin lê); só
  as Cloud Functions (Admin SDK) leem.
* O **`clientKey` em base64** vai na URL do SSO — não é o segredo. O segredo
  jamais sai do servidor.

## 3. Operação (workflow `DUPR — conferir e configurar a integração`)

Actions → o workflow → *Run workflow*:

| Ação | O que faz |
|---|---|
| `smoke` | A credencial vale? O DUPR e o login respondem? (só leitura) |
| `seed` | Copia as credenciais dos segredos para `platform_secrets/dupr` |
| `webhook` | Registra no DUPR a URL do nosso webhook de rating |
| `user` | Mostra os ratings públicos de um ID DUPR |
| `flag` | Liga (`on`) ou desliga (`off`) `dupr_official_sync` em `platform_settings/global` |

`ambiente` = `uat` (padrão) ou `prod` (só depois da aprovação do DUPR).

Além do "Run workflow", o workflow roda quando `.github/dupr-uat-run.json`
(`{ "acao", "ambiente", "arg" }`) muda na `main`. É o caminho de quem só consegue
mesclar PR (a sessão de desenvolvimento não dispara workflow): editar o arquivo e
mesclar executa a ação, e o log do Actions mostra o resultado.

## 4. Código

* `functions/duprClient.js` — cliente da API (token em cache de 50 min, uma
  renovação num 401, timeout, erros sem credencial). Testes em `duprClient.test.js`.
* `scripts/dupr-uat.cjs` — o que o workflow executa.

## 5. Vincular a conta (feito)

Perfil → Editar perfil, com a flag ligada: o cartão **Conta DUPR** (`DuprConnectCard`)
substitui os campos de ID e de rating digitados à mão.

1. **Conectar**: abre o login do DUPR num iframe (`ssoUrl`, vem do servidor). A
   mensagem do iframe só vale se a origem for a do DUPR **e** a janela for a do
   nosso iframe (`parseSsoMessage`, `modules/rating/domain/duprSso.js`).
2. Os tokens do login (somente leitura) vão **uma vez** ao servidor
   (`duprIntegration` → `link`). O navegador nunca guarda token nem credencial.
3. O servidor **confirma quem é a pessoa pelo DUPR** (ignora o ID que o navegador
   disser), exige a assinatura `BASIC_L1`, busca os ratings, reserva o ID
   (`dupr_ids/{ID}`: um ID pertence a **uma** conta; a segunda recebe "já vinculado")
   e inscreve a pessoa no webhook de rating.
4. Grava o resumo em `dupr_links/{uid}` e espelha `dupr_id`, `dupr_rating` (duplas),
   `dupr_rating_singles` e o **selo** `dupr_verified` em `users` e `athlete_profiles`.
5. **Desconectar** cancela a inscrição, apaga tokens e reserva do ID e tira o selo;
   ID e rating ficam como dado comum (editáveis de novo).

### O que é do servidor (regras do Firestore)

* `dupr_verified` e `dupr_verified_at_ms`: o dono **não escreve** (nem na criação).
* Com o selo, o dono não reescreve `dupr_id`, `dupr_rating`, `dupr_rating_singles`
  (regravar o mesmo valor passa — a sincronização do perfil faz isso).
* `dupr_links/{uid}`: o dono e o admin leem; ninguém escreve. `dupr_link_tokens` e
  `dupr_ids`: fechados ao navegador. Provado em `tests/rules/dupr.rules.test.js`.

### Funções

* `duprIntegration` (callable, `config | link | unlink | status`): exige login.
  `status` renova as assinaturas (`BASIC_L1`, `PREMIUM_L1`, `VERIFIED_L1`) se
  passou de 24 h e, num 401, renova o token do usuário (o refresh gira).
* `duprWebhook` (HTTP público, `/api/dupr/webhook?k=<token>`, rewrite no hosting):
  confere o `k` em tempo constante, responde 200 depressa, atualiza o rating de
  `RATING` e `RATING_SEED`. ID desconhecido ou rating nulo → 200 e ignora.

### Para ligar (UAT)

1. Actions → *DUPR — conferir e configurar a integração* → `seed` (uat).
2. Depois do deploy das funções: o mesmo workflow → `webhook`.
3. Painel admin → Funcionalidades → *DUPR oficial* → ligar.
4. Perfil → Editar perfil → *Conectar com o DUPR* e entrar com a conta de teste.

Limite conhecido: se `athlete_profiles/{uid}` ainda não existe na hora do vínculo,
o espelho público só ganha o selo quando o perfil público for criado e o vínculo
renovado (o dono não pode criar o espelho já com o selo).

## 6. Política, piloto e o rating próprio suspenso

**Política** em `platform_settings/dupr_policy` (legível por todos, escrita só pelo
admin — regra de sempre de `platform_settings`), editada no cartão **Política do
DUPR** (Painel admin → Funcionalidades → grupo **DUPR**, `DuprPolicyCard`). Régua
pura em `src/modules/rating/domain/duprPolicy.js`, cópia no servidor em
`functions/duprPolicy.js` (paridade: `functions/duprPolicy.parity.test.js`).

* **Público** (`audience`): `admins` (padrão, **piloto**) ou `all`. No piloto, com
  a flag ligada, a integração vale só para o admin da plataforma; os demais seguem
  como antes. A tela pergunta a `useDuprMode()` (`modules/rating/hooks/useDuprMode.js`)
  e o servidor confere de novo (`liberadaPara` em `functions/dupr.js`: `config`
  diz `enabled: false` e `link` recusa para quem está fora do público).
* **Envio de partidas** (`mode`: `off` | `manual` | `rules`) e as **regras por
  grupo** (`duprBucket`): torneio de simples/duplas e de equipes = *sempre envia*;
  Americano/Mexicano do torneio (por modalidade) e dia de jogo com placar = *quem
  cria escolhe*; Play nunca (sem placar). `duprSubmissionDecision` decide;
  `duprMatchEligibility` barra partida sem placar, com game empatado, lados
  desiguais ou jogador repetido; `duprReadiness` exige conta conectada com
  `BASIC_L1` de todos; `duprIdentifier` dá o identificador único (`pr:tm:…`,
  `pr:gd:…`). Quem aplica a política é o envio automático (§8).

**Rating próprio suspenso.** Enquanto `useDuprMode().ownRatingOff` (= a integração
vale para quem vê), saem da tela o ELO "Nacional", o "Nível 2.0–8.0", as curvas de
evolução e a meta de rating; entram o **Ranking DUPR** (`V2DuprOfficialRankingView`,
só contas com o selo, ordem por `buildOfficialDuprRanking`), o selo DUPR no perfil
(`V2DuprRatingBadge`), os quadros DUPR no início, "Seu rating DUPR" na Minha área,
o nível DUPR em Encontrar jogadores e na lista de alunos do professor. O servidor
segue calculando o próprio em silêncio; desligar a flag (ou voltar ao piloto) traz
tudo de volta. O ranking de duplas por aproveitamento não é rating e continua.

## 7. Piloto no Painel admin (ambiente de teste)

**Painel admin → DUPR → Piloto** (`AdminDuprPilotTab`, só o admin da plataforma).
Um ambiente fechado para testar o envio ao DUPR **sem mudar nada para ninguém**:
funciona com a flag `dupr_official_sync` desligada e não lê nem escreve nenhuma
outra coleção (fora `audit_logs`). Ranking, perfis, telas dos usuários e a
exportação CSV não enxergam o piloto.

* **Jogadores do piloto** (`dupr_pilot_players`): existem só aqui. Nascem com o
  nome e, se quiser, o e-mail da conta de teste ("aguardando conta DUPR"). O ID
  DUPR entra depois — digitado e **conferido no DUPR** (`GET /user/{id}`, guarda o
  ID canônico, nome e ratings) — ou gerado por **Criar conta no DUPR**
  (`POST /user/invite`, que o DUPR só libera com a permissão `USER::INVITE`; sem
  ela a tela explica o caminho manual). Um ID DUPR vale para um jogador só.
* **Partidas de teste** (`dupr_pilot_matches`): simples ou duplas, até 5 games,
  side-out ou rally. O servidor valida com `duprMatchEligibility` (sem game
  empatado, sem jogador repetido, lados iguais), monta o corpo do DUPR com
  `duprMatchPayload` (a mesma montagem que o envio automático vai usar;
  `matchSource: PARTNER`, sem `clubId`, `identifier` = `pr:pl:{id}`) e envia.
  Fica o `matchCode`, ou a recusa com a mensagem do DUPR. **Apagar no DUPR**
  chama `DELETE /match/delete` com `identifier` + `matchCode`.
* **Só no UAT**: com as credenciais de produção, o piloto não envia (partida de
  quem não conectou a conta fere o contrato).
* Quem escreve é o servidor: ações `pilot_*` de `duprIntegration`
  (`functions/duprPilot.js`, testes em `duprPilot.test.js`). A regra deixa só o
  admin ler as duas coleções e ninguém escrever (`tests/rules/dupr.rules.test.js`).
* A aba **Exportar DUPR** (CSV) mudou de Sistema para a mesma seção DUPR; o id da
  aba (`?tab=dupr`) não mudou.

## 8. Envio automático das partidas (`dupr_submissions`)

**Painel admin → DUPR → Envios** (`AdminDuprSubmissionsTab`). O servidor mantém um
livro, um documento por partida em `dupr_submissions/{identifier}`
(`functions/duprSubmissions.js`, testes em `duprSubmissions.test.js`).

* **Quando roda**: a varredura `duprSubmitWorker` (a cada 15 min) e o botão
  **Processar agora** (ação `submissions_run`). Só com a flag `dupr_official_sync`
  ligada **e** a política fora de *Desligado*; um lease em
  `platform_settings/dupr_submissions` impede duas passadas ao mesmo tempo. Cada
  passada faz até 60 chamadas ao DUPR; o resto fica para a próxima.
* **O que lê**: as mesmas partidas decididas do ranking — `tournament_matches`
  (torneio elegível, como em `isEligible`) e `club_event_games` (dias de jogo
  publicados e confrontos de equipe). W.O. e partida sem vencedor ficam de fora.
  Torneio **chancelado por federação** também: quem envia é a federação (planilha
  DUPR). Partida nova só entra se foi decidida nos últimos 30 dias; histórico
  antigo vai pela exportação CSV.
* **Quem decide**: `duprSubmissionDecision` (política + grupo + escolha de quem
  criou, em `tournament_modalities.dupr_submit` / `game_days.dupr_submit`). No
  piloto (`audience: admins`) só entram partidas com algum admin da plataforma.
* **Estados**: `held` (retida: jogador sem conta, sem DUPR conectado ou sem
  `BASIC_L1` — a tela diz quem falta, e ela sai sozinha quando todos conectarem),
  `awaiting_approval` (modo manual: o admin aprova), `queued` (torneio espera a
  carência `grace_minutes`, para corrigir placar; dia de jogo vai já), `sent`
  (guarda o `match_code`), `failed` (nova tentativa em 15 min, 30, 60… até 1 dia,
  no máximo 6; recusa 4xx do DUPR não se repete sozinha) e `deleted`.
* **Placar mudou** depois de enviado → `update` no DUPR (o hash do corpo muda).
  **Resultado deixou de existir** (placar apagado, dia despublicado, torneio
  cancelado/arquivado/privado) → `delete` no DUPR. Mudança de política ou alguém
  desconectar a conta **não** apaga o que já foi enviado.
* **Ações do admin** (`submissions_approve|retry|remove|unblock`, só
  `platform_admin`): aprovar, tentar de novo, **Apagar no DUPR / Não enviar**
  (motivo obrigatório; trava a partida para não voltar) e **Destravar**. Tudo em
  `audit_logs` (`dupr_submission_*`).
* **Quem lê o livro**: o admin, quem jogou (`uids`) e quem organizou
  (`organizer_uid`); ninguém escreve pelo navegador
  (`tests/rules/dupr.rules.test.js`). O corpo enviado é o mesmo do piloto
  (`duprMatchPayload`).
* **Exclusão de conta** apaga `dupr_links`, `dupr_link_tokens` e o ID reservado em
  `dupr_ids`.
