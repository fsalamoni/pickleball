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

`ambiente` = `uat` (padrão) ou `prod` (só depois da aprovação do DUPR).

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
