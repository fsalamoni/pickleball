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
| 🔴 P0 | 2 | **imediato** — 1 ✅ corrigido, 1 em andamento |
| 🟠 P1 | 8 | 2 semanas — 3 ✅ corrigidos, 1 🟡 mitigado |
| 🟡 P2 | 13 | 90 dias |
| 🟢 P3 | 8 | backlog — 1 ✅ corrigido |
| **Total** | **31** | |

---

# 🔴 P0 — CRÍTICO

## P0-01 · Escalação de privilégio: qualquer usuário vira `platform_admin`

> ### ✅ CORRIGIDO — 2026-09-07 · PR S1 (`fix/seguranca-privesc-users`)
> `firestore.rules` § `match /users/{userId}`: o dono do documento não pode
> mais escrever `role`, `can_create_pools` nem `hidden*`. O bootstrap do dono
> da plataforma passou a depender do **e-mail do token de autenticação**
> (`isPlatformOwnerEmail()`), que não é dado gravável.
>
> **Prova**: `tests/rules/users.rules.test.js` — 34 asserções no emulador.
> Rodada contra as regras ANTIGAS, a suíte acusa **9 falhas** (a exploração
> é reproduzida); contra as novas, passa inteira, incluindo 25 asserções que
> exercitam cada caminho real de escrita em `users/` mapeado no código
> (login comum e do dono, cadastro, `updateUserProfile`, onboarding,
> nivelamento, privacidade, `mirrorCoachToUser`, `setAthleteHidden`,
> `V2AdminOwnerRestore`).
>
> Roda no CI a cada PR (job `firestore-rules`), o que impede a regressão.
>
> **Pendente (não bloqueia)**: migrar para custom claims — etapa 2 do
> `patches/P0-01`, planejada no PR S5. Enquanto isso, `isPlatformOwnerEmail()`
> depende do e-mail do token; endurecer com `email_verified` foi deixado para
> o S5 para não arriscar o acesso do dono agora.

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

> ### ✅ CORRIGIDO — 2026-09-09
> **O achado era mais amplo do que este texto descrevia.** Além de
> `tournament_admins`, o mesmo padrão estava em **`club_members`** — também
> `allow read: if isAuthed()`, também guardando `user_email`, e o e-mail era
> renderizado na lista de membros **sem nenhum gate de admin**. Na prática:
> qualquer conta logada tinha um diretório de contatos de todos os clubes.
>
> **Correção**: o e-mail saiu dos dois documentos (escrita e exibição). Onde a
> leitura JÁ é restrita — `club_join_requests` e `club_member_invites`, ambos
> limitados ao próprio usuário, ao admin do clube e ao admin da plataforma —
> o campo **permanece**, porque ali é legítimo: é como o admin do clube fala
> com quem pediu para entrar.
>
> Quem precisa contatar alguém tem o chat; o admin da plataforma tem a aba
> **Cadastros**, restrita e auditada.
>
> **Cauda legada**: os documentos que já existem ainda carregam o campo. Nada
> o exibe mais, mas ele só some do banco na migração — que, como a do P0-02,
> espera o backup testado (S0).
>
> 4 testes de regressão leem o código-fonte dos serviços para impedir que o
> campo volte numa refatoração distraída.
`firestore.rules:790` → `match /tournament_admins/{docId}` com
`allow read: if isAuthed();`, e
`src/modules/tournament/services/tournamentService.js:96,338` gravam
`user_email: creator.email`. Qualquer conta lê o e-mail de todos os
organizadores de torneio da plataforma.
**Correção**: remover `user_email` do documento (o `user_id` já identifica);
resolver o e-mail sob demanda, só para quem pode.

## P1-02 · E-mail vira nome público quando o perfil está incompleto

> ### ✅ CORRIGIDO — 2026-09-07 · PR S1b
> Nova função pura `src/core/lib/displayName.js` (`publicDisplayName`), com o
> mesmo critério que o diretório de atletas já aplicava: o último recurso é a
> parte ANTES do `@`, nunca o endereço completo. Aplicada nos 5 pontos que
> publicavam o e-mail como nome — `registrationService.js` (`officialPlayerData`
> e `player_a_name`) e `tournamentService.js` (`creator_name` e os dois
> `user_name` de `tournament_admins`). 14 testes novos, incluindo asserções de
> que a saída jamais contém `@`.
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

> ### ✅ CORRIGIDO (parcial, por segurança) — 2026-09-07 · PR S3
> Adicionados em `firebase.json` (site `picklerush`), verificados no emulador
> de hosting: `X-Content-Type-Options: nosniff`, `Referrer-Policy:
> strict-origin-when-cross-origin` (impede vazar o código de convite de
> `/r/:code` para terceiros), `Permissions-Policy` e
> `X-Permitted-Cross-Domain-Policies: none`. CSP publicada em
> **`Report-Only`**, que por definição não bloqueia nada.
>
> **Três cabeçalhos foram DELIBERADAMENTE omitidos**, cada um por uma razão
> verificada — não por esquecimento:
> - **`Strict-Transport-Security`**: o Firebase Hosting **já envia**
>   `max-age=31556926; includeSubDomains; preload` (conferido com `curl` na
>   produção). Escrever o nosso só poderia enfraquecer.
> - **`Cross-Origin-Opener-Policy`**: o login usa `signInWithPopup`
>   (Google e Apple, `FirebaseAuthContext.jsx:227,232`). `same-origin`
>   quebraria o ingresso na plataforma.
> - **`X-Frame-Options`**: o mesmo site de hosting também atende
>   `<projeto>.firebaseapp.com`, onde vivem os caminhos reservados
>   `/__/auth/*` do Firebase Auth. Um `DENY` com `source: "**"` alcançaria
>   esses caminhos e arrisca o login. O `frame-ancestors 'none'` foi para a
>   CSP em modo relatório justamente para medir isso sem risco.
>
> **Próximo passo**: ler os relatórios da CSP por ~2 semanas, ajustar as
> origens e só então promover a bloqueante — e reavaliar o `X-Frame-Options`
> com escopo que não alcance `/__/`.
`firebase.json` → o array `headers` só tem `Cache-Control`. Faltam:
`Content-Security-Policy`, `X-Frame-Options`/`frame-ancestors`,
`X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy`,
`Strict-Transport-Security`, `Cross-Origin-Opener-Policy`.
Consequências: clickjacking (a plataforma pode ser embutida em iframe de
site malicioso), superfície de XSS ampliada, vazamento de referrer com
token de convite na URL.
**Correção**: `patches/P1-04-cabecalhos-de-seguranca.md`.

## P1-05 · Storage: qualquer autenticado lê os arquivos de qualquer usuário

> ### 🟡 MITIGADO (caminho privado, verificado) — 2026-09-07 · PR S3
> `storage.rules` ganhou `uploads/{uid}/private/**`, onde só o dono lê, grava
> e apaga. Nada escreve nesse caminho hoje, então **nenhum arquivo existente
> muda de comportamento** — é o destino de todo upload sensível novo
> (comprovante, documento, anexo de suporte).
>
> ⚠️ **Lição registrada — a primeira versão deste bloco NÃO protegia nada.**
> Em regras do Firebase, quando vários `match` alcançam o mesmo caminho, o
> acesso é concedido se **qualquer um** permitir. O bloco genérico
> `uploads/{uid}/{allPaths=**}` continuava liberando `private/`. O emulador
> mostrou: *"Expected request to fail, but it succeeded"*. Foi preciso o
> genérico **excluir `private` explicitamente**. Um bloco restritivo sozinho é
> decorativo — e regra decorativa é pior que regra ausente, porque cria
> confiança falsa.
>
> **Prova**: `tests/rules/storage.rules.test.js` — 17 asserções, metade delas
> dedicadas ao que **não pode ter mudado**: foto de perfil e anexo de chat
> continuam legíveis por outros, ninguém grava em pasta alheia, subpasta funda
> segue legível, arquivo solto sem pasta segue legível, anônimo não lê nada e
> caminho fora de `uploads/` segue bloqueado.
>
> **Limite honesto**: a URL do `getDownloadURL()` carrega um token, e quem tem
> a URL acessa o arquivo mesmo com a regra restritiva. Isto protege contra
> ENUMERAÇÃO de caminho, não contra o vazamento da URL. O fechamento completo
> exige signed URLs de curta duração — item do PR S9.
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

> ### ✅ CORRIGIDO — 2026-09-07 · PR S3
> `allow create` em `audit_logs` passou a exigir
> `request.resource.data.actor_id == request.auth.uid`.
>
> Verificado antes de aplicar: `auditService.createAuditLog` grava
> `actor_id: actor.uid` (`auditService.js:91`), retorna cedo quando não há
> ator (`:81`) e é **best-effort** (try/catch, `:104`) — nenhum fluxo quebra
> se uma escrita for recusada. Também foi conferido que **todos** os pontos de
> chamada passam o usuário atual como ator.
>
> **Prova**: `tests/rules/auditlogs.rules.test.js` — 13 asserções. Contra a
> regra antiga, 4 falham (a falsificação é reproduzida). Cobre também a
> imutabilidade, que já existia: ninguém edita nem apaga, nem o admin.
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

> ### ⚠️ ANALISADO, NÃO CORRIGIDO — 2026-09-09 · a correção óbvia QUEBRA o ranking
>
> A correção que salta aos olhos é endurecer a regra:
> ```javascript
> allow read: if isAuthed() && (resource.data.directory_listed == true
>                               || isOwner(uid) || isPlatformAdmin());
> ```
> **Não faça isso sem ler o parágrafo seguinte.**
>
> Quatro serviços leem a coleção INTEIRA, sem filtro:
> `ratingService.js:119` e `:371` (ranking nacional), `duprRatingService.js:77`
> e `duprExportService.js:81`. Numa consulta, a regra é avaliada por documento
> e a query precisa ser **provadamente** restrita — então uma consulta sem
> `where('directory_listed','==',true)` passa a ser **negada por inteiro**.
> Resultado: o ranking para de carregar para todo mundo.
>
> E filtrar essas consultas também é errado: `directory_listed` significa
> *"não me liste no diretório de atletas"*, **não** *"não me inclua no
> ranking"*. São coisas diferentes; tratar como a mesma tira do ranking quem
> nunca pediu isso.
>
> **O que de fato vaza hoje**: nome, cidade, nível e idade de quem saiu do
> diretório. **Não** vaza contato — `buildAthletePublicProfile` já só espelha
> telefone, e-mail e endereço com opt-in explícito, e converte a data de
> nascimento em `age`.
>
> **Caminho correto (a decidir)**: ou o espelho deixa de existir para quem
> optou por sair — e o ranking passa a ler de `users` —, ou o ranking ganha
> uma coleção própria com só o que precisa. As duas são mudanças
> arquiteturais, não um ajuste de regra.
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

> ### 🟡 PARCIALMENTE ENDEREÇADO — 2026-09-07 · PR S3b
> O vazamento **técnico** foi fechado: todo upload de imagem passa agora por
> `core/lib/imageMetadata.js`, que remove **EXIF, XMP e IPTC** — onde vive a
> coordenada GPS de foto de celular. Isso importava porque
> `tournament_photos` é `allow read: if true` (público, sem login) e a foto de
> perfil aparece no diretório: era localização residencial publicada junto com
> a foto, inclusive de menores.
>
> **A remoção não recodifica a imagem.** Os segmentos JPEG são percorridos e
> os de metadado descartados byte a byte; JFIF, perfil de cor ICC, tabelas,
> quadro e todo o dado após o SOS ficam idênticos — a qualidade original é
> preservada, como o `storageService` sempre prometeu. Diante de qualquer
> estrutura inesperada a função devolve o arquivo original: nunca corrompe e
> nunca bloqueia um upload.
>
> **Prova**: 22 testes, incluindo preservação do ICC (removê-lo mudaria as
> cores), preservação byte a byte do dado codificado, e o caso de arquivo
> truncado/inválido.
>
> **Continua aberto** o lado jurídico: documento `uso-de-imagem` com escopos,
> canal de pedido de remoção de foto, e a revisão do
> `tournament_photos: if true`. Ver `08-CONSENTIMENTO-E-IMAGEM.md` §2.
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

- **P3-01** · ✅ **CORRIGIDO em 2026-09-07 (PR S3)** — `.github/dependabot.yml`
  (npm da raiz, npm de `functions/`, actions do GitHub), semanal, agrupado,
  com teto de PRs e **ignorando `major`** (exige changelog e teste manual; num
  caso é o `firebase`, núcleo da aplicação). Mais um job `dependencias` no CI,
  **informativo** (`continue-on-error`), separando o que chega ao usuário
  (`--omit=dev`) do ferramental de build.
  **Estado analisado**: 22 achados (1 crítico, 10 altos). O crítico é
  `websocket-driver`, que vem por `firebase → @firebase/database →
  faye-websocket` — o polyfill de **Node**; o navegador usa WebSocket nativo,
  então não chega ao bundle. `@grpc/grpc-js` e `protobufjs` são os caminhos
  Node do mesmo SDK; `postcss` e `nanoid` são build. Nenhum é explorável num
  SPA de navegador. Por isso o job **não bloqueia**: travar o CI hoje pararia
  o trabalho sem reduzir risco real. Resolver de verdade passa por atualizar o
  `firebase`, que merece PR próprio e teste manual.
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
