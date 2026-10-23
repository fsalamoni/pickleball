# 51 — Integração oficial com o DUPR (RaaS)

> Estado: **em construção, só ambiente UAT**. Chave de produção só depois da
> revisão do DUPR (e-mail para tech@mydupr.com). Flag: `dupr_official_sync`
> (default OFF). Desligada, o cadastro manual de ID/rating DUPR segue como está.

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
