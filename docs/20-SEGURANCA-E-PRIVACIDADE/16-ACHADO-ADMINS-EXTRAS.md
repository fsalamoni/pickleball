# 20.16 — 🔴 ACHADO ABERTO: quatro contas com `platform_admin`

> **Data**: 2026-09-09 · **Origem**: verificação S0.1 do runbook, feita pelo dono
> **Estado**: ⏳ **precisa de decisão do dono** — não é corrigível por código

## O que foi visto

A consulta `users` com filtro `role == platform_admin` devolveu **quatro**
documentos, não um:

| uid | `role` | `hidden` | Último login | Perfil |
|---|---|---|---|---|
| `Kx7CC0NVgogh8cCF4wIRmpOvo7r2` | platform_admin | — | ativo | completo (é o dono) |
| `DgFaYXu7SjcOvRsDerToqa7Ogft2` | platform_admin | `true` | 22/07/2026 | **só role + hidden** |
| `trcjeEOFcpVLN63c2Trre1Sdz7s1` | platform_admin | `true` | 23/07/2026 | **só role + hidden** |
| `uF4F3aXzM5U0KCl8Uy3SEbcKDIx1` | platform_admin | `true` | 22/07/2026 | **só role + hidden** |

Os três foram ocultados **pelo próprio dono** (`hidden_by` =
`Kx7CC0NV…`) em 25/08/2026, num intervalo de 15 segundos
(10:38:59, 10:39:12, 10:39:14) — o padrão de quem usou a moderação de
atletas em lote para esconder contas de teste.

## Por que isso não se resolve olhando

Há duas histórias possíveis e as evidências visíveis não separam as duas:

- **(a) contas de teste do próprio dono**, promovidas a admin por ele e depois
  ocultadas — o batch de 15 segundos e o `hidden_by` apontam para cá;
- **(b) exploração do P0-01**, que ficou aberto até **07/09/2026**. Enquanto
  esteve aberto, QUALQUER conta autenticada podia gravar
  `role: 'platform_admin'` no próprio documento. Os últimos logins (22-23 de
  julho) são anteriores à correção, e os documentos contêm **exatamente** o que
  uma exploração produziria: `role` e nada mais.

O documento esquálido (sem nome, cidade, nível — nada) é compatível com as
duas: conta de teste nunca preenchida, ou conta criada só para escalar.

## ⚠️ `hidden: true` NÃO tira o poder

Este é o ponto que mais importa. `hidden` é **moderação de exibição**: tira o
atleta das listagens. Ele **não** mexe em `role`. As três contas continuam
sendo `platform_admin` para todos os efeitos do `firestore.rules` — leem
`users/{qualquer uid}`, apagam documentos, escrevem em `platform_settings`.

Se elas foram ocultadas na crença de que isso as neutralizava, a crença estava
errada.

## O que já está protegido (e o que não está)

✅ **Não nascem novas.** Desde 07/09 a regra de `users` proíbe qualquer
usuário de escrever `role` no próprio documento, e proíbe o `platform_admin`
de alterar `role` de terceiros — ele só pode tocar em `hidden*`. Verificado
por 34 asserções no emulador, rodando no CI.

❌ **As três existentes continuam lá.** E — consequência direta da regra
acima — **não é possível rebaixá-las pela aplicação**. Nenhuma tela do
PickleRush consegue fazer isso, de propósito.

## O que fazer (só o dono pode)

### 1. Decidir o que são
Cruze com a auditoria antes de mexer:

```bash
# o que essas contas fizeram
gcloud firestore export --help  # ou, no console: coleção `audit_logs`,
# filtro actor_id == <uid>, ordenado por created_at
```

Se aparecer qualquer ação que você não reconhece — leitura de perfis,
alteração de torneio, mudança de flag — pare e siga `12-INCIDENTES.md` §3:
contenção primeiro, evidência preservada.

### 2. Rebaixar, no console (a aplicação não faz isso)
Firebase Console → Firestore → `users` → cada um dos três documentos →
campo `role` → trocar `platform_admin` por `user`.

Não apague os documentos: eles são a evidência.

### 3. Revogar as sessões
Um token já emitido continua valendo até expirar. Depois de rebaixar:

```bash
# Admin SDK
admin.auth().revokeRefreshTokens('<uid>')
```

### 4. Conferir de novo
A consulta `role == platform_admin` tem de devolver **um** documento.

## Recomendação de produto (posso implementar)

Duas coisas fariam este achado ser impossível de passar despercebido:

1. **Uma lista de admins visível no ambiente admin** — hoje só dá para saber
   quem é `platform_admin` consultando o banco. Deveria estar na tela.
2. **Ocultar um atleta deveria avisar quando ele é admin** — ou recusar, ou
   dizer em voz alta que ocultar não remove privilégio.

Nenhuma das duas foi feita: são mudança de produto, e o achado precisa da sua
decisão antes.
