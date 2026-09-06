# 20.01 — Auditoria: achados

> Auditoria do código em `main` (`f78c19d`, 2026-09-06). Cada achado tem
> **evidência no arquivo e linha**, impacto concreto e correção proposta.
> Nada foi alterado.
>
> Severidade: 🔴 **P0 crítico** (explorável hoje, impacto grave) ·
> 🟠 **P1 alto** · 🟡 **P2 médio** · 🟢 **P3 baixo/melhoria**.

## Resumo

| Severidade | Qtd. | Prazo recomendado |
|---|---|---|
| 🔴 P0 | 2 | **imediato** |
| 🟠 P1 | 8 | 2 semanas |
| 🟡 P2 | 13 | 90 dias |
| 🟢 P3 | 8 | backlog |
| **Total** | **31** | |

---

# 🔴 P0 — CRÍTICO

## P0-01 · Escalação de privilégio: qualquer usuário vira `platform_admin`

**Evidência**

`firestore.rules:689-700`:
```javascript
match /users/{userId} {
  allow read: if isOwner(userId) || isPlatformAdmin();
  allow create: if isOwner(userId);
  allow update: if isOwner(userId)
    || (isPlatformAdmin()
        && request.resource.data.diff(resource.data).affectedKeys()
             .hasOnly(['hidden', 'hidden_at', 'hidden_by', 'updated_at']));
  allow delete: if isPlatformAdmin();
}
```

`firestore.rules:7-11`:
```javascript
function isPlatformAdmin() {
  return isAuthed()
    && exists(/databases/$(database)/documents/users/$(request.auth.uid))
    && get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == 'platform_admin';
}
```

**O problema**

`allow update: if isOwner(userId)` **não restringe campo nenhum**. O próprio
usuário pode escrever qualquer chave no seu documento — inclusive `role`.
E `isPlatformAdmin()` é decidido lendo exatamente esse campo.

Confirmado que **não existe custom claim** em lugar nenhum
(`grep customClaims|setCustomUserClaims|token.role` → 0 resultados em
`src/`, `functions/` e `firestore.rules`). A autorização da plataforma
inteira depende de um campo que o próprio usuário pode escrever.

**Exploração** (qualquer usuário logado, no console do navegador):
```js
// não precisa de ferramenta nenhuma além do SDK que a própria página carrega
updateDoc(doc(db, 'users', auth.currentUser.uid), { role: 'platform_admin' });
```

**Impacto** — a partir daí o atacante:
- lê `users/{qualquer uid}`: e-mail, telefone, nome completo, **data de
  nascimento**, endereço de todos os usuários;
- **apaga** qualquer usuário (`allow delete: if isPlatformAdmin()`);
- escreve `player_ratings`, `player_skill_ratings` e `season_rankings`
  (rankings da plataforma);
- lê `audit_logs` inteiro;
- lê `legal_consents` e `push_tokens` de todos;
- edita `platform_settings` (flags, branding, conteúdo);
- modera, arquiva e exclui torneios, arenas e clubes;
- ganha todas as capacidades que forem adicionadas ao papel no futuro.

É **tomada total da plataforma e vazamento de toda a base de dados
pessoais**, a partir de uma conta comum criada em 30 segundos.

**Por que passou despercebido**: a regra parece razoável ("o dono edita o
próprio perfil") e o `platform_admin` foi corretamente restringido a
`hasOnly([...])` na linha de baixo — o cuidado foi aplicado ao admin, mas
não ao dono.

**Correção**: `patches/P0-01-users-escalacao-de-privilegio.md`
(restringir os campos que o dono pode escrever + migrar para custom claims).

---

## P0-02 · E-mail e gênero de todos os inscritos, públicos sem login

**Evidência**

`firestore.rules:754-765`:
```javascript
match /tournament_registrations/{rid} {
  // Inscritos: leitura pública (quadro do torneio inclui nomes).
  allow read: if true;
```

`src/modules/tournament/services/registrationService.js:113-128`:
```js
const payload = {
  ...
  player_a_name: player_a?.name?.trim() || actor?.displayName || actor?.email || '',
  player_a_email: playerAEmail,
  player_a_email_lc: playerAEmail,
  player_a_competition_gender: player_a?.competition_gender || null,
  ...
  player_b_email: playerBEmail,
  player_b_email_lc: playerBEmail,
  player_b_competition_gender: player_b?.competition_gender || null,
```

**O problema**

A regra é `if true` — leitura **sem autenticação nenhuma**. O documento
guarda o e-mail de ambos os jogadores (duas vezes cada) e o gênero
competitivo. A config do Firebase Web é pública por natureza (vai no bundle
JS, como deve ser), então qualquer pessoa com o `projectId` — que está no
código-fonte servido ao navegador — consulta a coleção pela API REST do
Firestore e baixa **a base inteira de e-mails de inscritos**.

O comentário na regra justifica a abertura por um motivo legítimo (o quadro
do torneio é público e `listMyRegistrations` estourava o limite de 20
lookups por query). O erro não é a leitura pública do **quadro** — é o
e-mail estar no mesmo documento do quadro.

**Impacto**
- Vazamento de base de e-mails → spam, phishing direcionado
  ("sua inscrição no Torneio X foi cancelada, clique aqui"), enriquecimento
  de base de terceiros.
- Gênero é dado pessoal; conforme o contexto e o cruzamento, aproxima-se de
  categoria sensível (LGPD art. 5º, II).
- **Incidente de segurança notificável à ANPD** se explorado (LGPD art. 48).
- Viola o princípio da necessidade (art. 6º, III): o quadro do torneio não
  precisa do e-mail para funcionar.

**Correção**: `patches/P0-02-inscricoes-email-publico.md`
(mover contato para subcoleção privada, manter o quadro público).

---

# 🟠 P1 — ALTO

## P1-01 · E-mail de organizadores exposto a qualquer usuário logado
`firestore.rules:790` → `match /tournament_admins/{docId}` com
`allow read: if isAuthed();`, e
`src/modules/tournament/services/tournamentService.js:96,338` gravam
`user_email: creator.email`. Qualquer conta lê o e-mail de todos os
organizadores de torneio da plataforma.
**Correção**: remover `user_email` do documento (o `user_id` já identifica);
resolver o e-mail sob demanda, só para quem pode.

## P1-02 · E-mail vira nome público quando o perfil está incompleto
`registrationService.js:62` e `:114`, `tournamentService.js:85,97,339`:
```js
profile.platform_name || profile.full_name || user?.displayName || user?.email || ''
```
Usuário sem nome preenchido tem o **e-mail exibido como nome** em coleções
públicas (`tournaments.creator_name`, `tournament_registrations.player_a_name`).
`buildAthletePublicProfile` já faz certo (`trimmed(profile.email).split('@')[0]`),
mas os serviços de torneio não seguem o mesmo cuidado.
**Correção**: fallback único e seguro (`'Atleta'` ou a parte antes do `@`),
extraído para uma função compartilhada em `core/lib/`.

## P1-03 · Nenhum App Check — as regras são a única defesa
`grep AppCheck|ReCaptcha` → **zero resultados**. Sem App Check, qualquer
script fora do navegador fala direto com o Firestore e o Storage usando o
`projectId` público. Não há como distinguir a aplicação legítima de um
robô, nem limitar taxa de leitura.
Consequências: raspagem em massa das 62 coleções abertas, enumeração de
usuários, custo de leitura inflado por abuso.
**Correção**: habilitar App Check (reCAPTCHA Enterprise para web),
primeiro em modo *monitoring* por 2 semanas, depois *enforce*.

## P1-04 · Nenhum cabeçalho de segurança no hosting
`firebase.json` → o array `headers` só tem `Cache-Control`. Faltam:
`Content-Security-Policy`, `X-Frame-Options`/`frame-ancestors`,
`X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy`,
`Strict-Transport-Security`, `Cross-Origin-Opener-Policy`.
Consequências: clickjacking (a plataforma pode ser embutida em iframe de
site malicioso), superfície de XSS ampliada, vazamento de referrer com
token de convite na URL.
**Correção**: `patches/P1-04-cabecalhos-de-seguranca.md`.

## P1-05 · Storage: qualquer autenticado lê os arquivos de qualquer usuário
`storage.rules`:
```javascript
match /uploads/{uid}/{allPaths=**} {
  allow read: if isAuthed();
  allow write: if isAuthed() && request.auth.uid == uid && sizeOk();
}
```
Escrita está correta. **Leitura não**: qualquer conta lê o que qualquer
outra subiu — anexos de chat, documentos, comprovantes. Com o Mercado e o
Feed isso passa a incluir comprovante de Pix e mídia de post restrito.
Agravante: o caminho é previsível (`uploads/{uid}/...`) e o `uid` é
descobrível em coleções públicas.
**Correção**: separar `uploads/{uid}/public/**` (leitura ampla) de
`uploads/{uid}/private/**` (só o dono e o admin), migrando por prefixo novo
sem mexer no que já existe.

## P1-06 · Qualquer usuário cria notificação para qualquer outro
`firestore.rules:850-853`:
```javascript
match /notifications/{nid} {
  allow read, update: if isAuthed() && resource.data.user_id == request.auth.uid;
  allow create: if isAuthed();
}
```
`create` não valida nada. Um atacante escreve notificações no sino de
qualquer usuário, com texto e link arbitrários — **phishing dentro da
plataforma**, com a credibilidade da interface oficial.
**Correção**: validar que o criador tem relação com o destinatário, ou
migrar a criação para Cloud Function (Admin SDK) e fechar a escrita direta.

## P1-07 · Trilha de auditoria forjável
`firestore.rules:857-860`:
```javascript
match /audit_logs/{lid} {
  allow read: if isPlatformAdmin();
  allow create: if isAuthed();
  allow update, delete: if false;
}
```
Imutabilidade está correta (`update, delete: if false` — bom). Mas o
`create` não valida que `actor_uid == request.auth.uid`: qualquer usuário
grava entradas de auditoria **em nome de outra pessoa**, poluindo ou
desacreditando a trilha — que é justamente a prova em caso de incidente.
**Correção**: exigir `request.resource.data.actor.uid == request.auth.uid`
(ou o campo equivalente) no create.

## P1-08 · Sem MFA para a conta de administrador
A conta `fsalamoni@gmail.com` tem, hoje, poder total sobre os dados
pessoais de toda a base. Não há segundo fator obrigatório. O
comprometimento dessa única conta (phishing, reuso de senha, sessão
roubada) é o comprometimento da plataforma inteira.
**Correção**: MFA obrigatório no Firebase Auth para contas com papel
administrativo + sessão administrativa curta. Ver `05-ADMIN-SUPORTE.md`.

---

# 🟡 P2 — MÉDIO

## P2-01 · Preferência de privacidade não aplicada no servidor
`athlete_profiles` tem `directory_listed`, mas a regra é
`allow read: if isAuthed()` (`firestore.rules:866-867`) e o filtro
`where('directory_listed','==',true)` só existe em `listAthletes()`, no
cliente. Quem **optou por sair do diretório** continua legível por consulta
direta. Privacidade que só o cliente respeita não é privacidade.
**Nota positiva**: `buildAthletePublicProfile`
(`athletes/domain/publicProfile.js`) **faz certo** o que importa mais —
telefone, e-mail e endereço só entram no espelho com opt-in explícito, e a
data de nascimento vira apenas `age`. Esse é o padrão a replicar.

## P2-02 · 62 de 113 coleções com leitura irrestrita
55% da base é legível sem qualquer condição — 36 delas **sem login**
(`if true`). Muitas são legitimamente públicas (torneios, arenas, quadras).
Outras merecem revisão caso a caso: `arena_managers` (revela quem gerencia
o quê), `coach_level_validations` (avaliação de nível de atletas),
`coach_clinic_signups` (quem se inscreveu em quê), `club_internal_ratings*`,
`arena_coupons`, `arena_campaigns`, `arena_devices`, `arena_checklists`
(dados operacionais internos de negócio de terceiros).
**Correção**: revisão coleção a coleção em `02-INVENTARIO-DE-DADOS.md`.

## P2-03 · Sem backup nem PITR configurado
Nenhuma referência a backup, export agendado ou *point-in-time recovery*
em `firebase.json` ou nos workflows. Um `delete` acidental, um bug de
migração ou uma ação maliciosa (ver P0-01) são **irreversíveis** hoje.
**Correção**: habilitar PITR (7 dias) + export diário agendado para bucket
com retenção e acesso separado.

## P2-04 · Exclusão de conta não implementada
A Política de Privacidade (`legalDocuments.js:159`) e `V2Privacy.jsx:58`
prometem exclusão, correção e portabilidade — mas **não existe fluxo**.
`grep deleteAccount|excluir conta` → nada. Prometer direito que não se
entrega é, por si, descumprimento (LGPD art. 18, §3º: prazo de resposta).
**Correção**: `09-DIREITOS-DO-TITULAR.md`.

## P2-05 · Portabilidade/exportação não implementada
Idem acima. O titular não consegue baixar os próprios dados.

## P2-06 · Sem canal formal de requisição do titular
Não há e-mail de encarregado, formulário, nem SLA. LGPD art. 41 exige
**encarregado (DPO) indicado e publicamente identificado**.

## P2-07 · Sem registro de operações de tratamento (ROPA)
LGPD art. 37: o controlador deve manter registro das operações. Não existe.
**Correção**: `02-INVENTARIO-DE-DADOS.md` é a primeira versão desse registro.

## P2-08 · Sem política de retenção
Nenhum dado tem prazo definido. `notifications` tem expiração
(`expireStaleNotifications`), o resto cresce para sempre. Viola o princípio
da necessidade (art. 6º, III) e infla custo.

## P2-09 · Consentimento sem granularidade
`legal_consents/{uid}_{docKey}` registra o aceite de um documento inteiro.
Não há consentimento separado para: uso de imagem, comunicação de
marketing, aparecer no diretório, compartilhamento com arenas/professores.
LGPD art. 8º, §4º: o consentimento deve ser para finalidades **determinadas**.

## P2-10 · Direito de imagem não tratado
A plataforma já hospeda `tournament_photos` (leitura pública, `if true`) e
`photo_url` de perfil. Não há autorização de uso de imagem, nem caminho
para pedir remoção. Com o Feed, isso vira central.

## P2-11 · Menores de idade sem tratamento específico
`users.birth_date` existe, mas não há verificação de idade, consentimento
de responsável (LGPD art. 14, §1º), nem restrição de visibilidade para
perfil de menor — que hoje entra no diretório público por padrão
(`directory_listed: true`).

## P2-12 · E-mail do dono da plataforma fixo em código
`firestore.rules:12` (`isPlatformOwnerEmail`) e
`FirebaseAuthContext.jsx:134,170` contêm `fsalamoni@gmail.com` em texto.
Funciona, mas: expõe o e-mail do administrador no bundle público (alvo de
phishing) e torna a troca de titularidade uma alteração de código + deploy.

## P2-13 · Sem verificação de e-mail obrigatória
Não há checagem de `emailVerified` antes de criar torneio, inscrever-se ou
publicar. Facilita conta descartável, spam e a exploração do P1-06.

---

# 🟢 P3 — BAIXO / MELHORIA

- **P3-01** · Sem varredura automática de dependências (Dependabot ou
  `npm audit` no CI).
- **P3-02** · Sem SAST/secret scanning no pipeline (o `gitleaks` ou o
  secret scanning do GitHub pegariam um segredo commitado por engano).
- **P3-03** · `logger.warn`/`logger.error` disparam em produção com
  argumentos livres; um objeto de usuário passado por engano vai para o
  console do navegador. Sanitizar o que é logado.
- **P3-04** · Sem monitoramento/alerta de anomalia (pico de leitura,
  explosão de escrita, erro de permissão em massa).
- **P3-05** · Sem alerta de orçamento no Firebase — abuso vira fatura antes
  de virar aviso.
- **P3-06** · Sem `robots.txt`/`noindex` definido para rotas com dado
  pessoal, caso alguma vire pública.
- **P3-07** · Sem rotação documentada do `FIREBASE_SERVICE_ACCOUNT` usado
  no deploy (GitHub Actions).
- **P3-08** · Sem teste automatizado das regras do Firestore no CI. Existem
  asserções pontuais (24 no dia de jogo), mas não uma suíte que rode a cada
  PR — que é o que impediria uma regressão como o P0-01.

---

## O que está BEM feito (para não ser desfeito)

Auditoria não é só lista de problema. Estes pontos estão corretos e devem
ser preservados e replicados:

| Ponto | Onde |
|---|---|
| Espelho público de atleta com opt-in de contato e minimização de data de nascimento (`age` em vez da data) | `athletes/domain/publicProfile.js` |
| `audit_logs` imutável (`update, delete: if false`) | `firestore.rules:860` |
| Chat corretamente restrito aos membros da conversa | `firestore.rules:1164-1175` |
| `legal_consents` e `push_tokens` restritos ao dono + admin | `firestore.rules:339-358` |
| Nenhum segredo versionado; `.env` no `.gitignore`; deploy por secrets do GitHub | `.gitignore`, `deploy-firebase.yml` |
| `logger` em vez de `console` nos services (0 ocorrências de `console.*`) | `src/modules/*/services/` |
| Cloud Functions `onCall` verificam `platform_admin` (com custom claim **e** fallback) | `functions/index.js:546-571` |
| Rules com `hasOnly()` para limitar campos em várias coleções | diversas |
| Documentos legais existentes, versionados e com registro de aceite | `legal/` |

O padrão de qualidade da plataforma é alto. Os achados P0 são pontos cegos
específicos, não descuido generalizado.
