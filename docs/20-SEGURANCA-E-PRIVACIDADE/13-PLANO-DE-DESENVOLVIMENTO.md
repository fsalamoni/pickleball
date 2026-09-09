# 20.13 — Plano de desenvolvimento

> 12 PRs, ordenados por **risco reduzido por hora de trabalho**. Cada um é
> entregável e reversível sozinho. Estimativa total: **6 a 8 semanas** de
> trabalho focado de uma pessoa.

## Visão geral

| PR | Nome | Fecha | Esforço | Risco de quebrar | Estado |
|---|---|---|---|---|---|
| **S0** | Rede de proteção | P2-03, P3-05 | 4h | nenhum | 🟡 **parcial** — o dono executou o que dava; **backup agendado segue ⊖ nos 3 bancos**. Ver `16-ACHADO-ADMINS-EXTRAS.md` |
| **S1** | 🔴 Escalação de privilégio | P0-01 | 1 dia | baixo | ✅ **feito e no ar** (2026-09-07) |
| **S1b** | E-mail como nome público | P1-02 | 2h | nenhum | ✅ **feito e no ar** (2026-09-07) |
| **S2** | 🔴 E-mails públicos | P0-02 | 3 dias | **médio** (migração) | 🟡 **contido (2026-09-09)** — passos 1-5 feitos; falta só apagar os campos antigos, que exige S0 |
| **S3** | Endurecimento rápido | P1-04, P1-05, P1-07, P3-01 | 2 dias | baixo | ✅ **feito e no ar** (2026-09-07) |
| **S4** | Testes de regras no CI | P3-08, P1-06 | 3 dias | nenhum | ✅ **feito e no ar** (2026-09-09) — 125 asserções |
| **S5** | Custom claims e papéis | P0-01 etapa 2, P1-08 | 4 dias | médio |
| **S6** | App Check | P1-03 | 2 dias + 2 semanas de observação | médio |
| **S7** | 🛟 Console de suporte | o pedido do dono | 8 dias | baixo (aditivo) | 🟡 **parcial (2026-09-09)** — a ESCRITA (corrigir cadastro) está no ar; quebra-vidro, mascaramento e log de leitura seguem desenhados. Ver `18-CADASTROS-ADMIN.md` |
| **S8** | Direitos do titular | P2-04, P2-05, P2-06 | 5 dias | baixo |
| **S9** | Privacidade no servidor | P1-01, P1-02, P1-05, P1-06, P2-01, P2-02 | 4 dias | médio | 🟡 **parcial (2026-09-09)** — P1-01 corrigido (mais amplo do que o achado dizia: `club_members` também); P1-02, P1-05 e P1-06 já fechados; **P2-01 analisado e NÃO corrigido de propósito** — a correção óbvia derruba o ranking, ver `01-AUDITORIA-ACHADOS.md` |
| **S10** | Consentimento, imagem e menores | P2-09, P2-10, P2-11 | 5 dias + ⚖️ | baixo |
| **S11** | Retenção e ciclo de vida | P2-07, P2-08 | 4 dias | **alto** (exclui dados) |
| **S12** | Governança contínua | P3-01, P3-02, P3-04 | 2 dias | nenhum |

---

## S0 — Rede de proteção (fazer HOJE, antes de tudo)

> ⏳ **PENDENTE — depende de acesso ao console do Firebase.**
> Passo a passo executável, com os comandos `gcloud` prontos, em
> **`15-RUNBOOK-S0-CONSOLE.md`**. Concluir isto **desbloqueia o S2**.

**Nada de código.** Só console do Firebase. 4 horas.

- [ ] Habilitar **PITR** do Firestore (retenção 7 dias)
- [ ] Configurar **export diário** para bucket dedicado
- [ ] Bucket de backup em conta/projeto **separado**, acesso separado
- [ ] Testar **uma restauração** — backup não testado não é backup
- [ ] Alertas de orçamento: US$ 50 / 100 / 200
- [ ] Ativar proteção contra enumeração de e-mail (Firebase Auth)
- [ ] Ativar política de senha forte
- [ ] **MFA na conta do admin**
- [ ] Verificar quem tem `role == 'platform_admin'` hoje
      (`patches/P0-01` §Etapa 1b) — se houver alguém além do dono, é
      incidente

**Por que primeiro**: todos os PRs seguintes mexem em dado ou em regra.
Sem backup testado, qualquer erro é permanente. Isto não tem risco nenhum e
transforma erro irreversível em erro recuperável.

## S1 — 🔴 Escalação de privilégio ✅ CONCLUÍDO (2026-09-07)

> Em produção. `firestore.rules` § `/users/{userId}` + 34 asserções no
> emulador (`tests/rules/users.rules.test.js`) + job de CI `firestore-rules`.
> A suíte acusa 9 falhas contra as regras antigas — prova de que pega a
> exploração. Pendente: etapa 2 (custom claims), planejada no S5.

`fix/seguranca-privesc-users` · `patches/P0-01` etapa 1

- [ ] Verificar admins existentes (etapa 1b)
- [ ] `firestore.rules`: restringir campos no create/update de `users`
- [ ] `tests/rules/users.rules.test.js` — 12 asserções
- [ ] Emulador verde
- [ ] Deploy só das regras
- [ ] Verificar em produção: login comum, login admin, exploração bloqueada

**Aceite**: usuário comum não consegue escrever `role` no próprio doc;
todos os fluxos de login e edição de perfil continuam funcionando.

## S2 — 🔴 E-mails públicos 🟡 CONTIDO (2026-09-09)

> **Feito**: nenhuma inscrição NOVA grava e-mail no documento público. O
> contato passou a viver em `tournament_registrations/{rid}/private/contact`,
> e a prova de inscrição provisória em `provisional_claims/{rid}_a|b`.
> Criação, edição, duplicação de torneio, *claim* no login, aba do
> organizador, exportação CSV e as ferramentas de admin já leem do lugar novo,
> **com fallback** para o campo público enquanto existirem documentos antigos.
> 29 asserções no emulador; uma delas prova que o *claim* das inscrições
> LEGADAS continua funcionando.
>
> **Falta**: apagar os campos `player_a_email`/`player_b_email`/`_lc` dos
> documentos que já existem. É irreversível e continua **preso ao S0**.
> Enquanto isso, o vazamento **parou de crescer** mas não foi eliminado.

### Histórico do bloqueio

> **Não iniciado, de propósito.** O passo de migração apaga campos de
> documentos existentes e, sem PITR/backup testado, é irreversível.
> Alcance medido: **9 arquivos, ~60 referências**, incluindo o CSV que
> organizadores usam para contatar participantes e o fluxo de inscrição
> provisória (`claimProvisionalRegistrationsForUser`, que consulta a
> coleção por e-mail no login de todo usuário).
>
> ⚠️ Fechar a leitura pública **não é alternativa**: `/p/:id`, `/imprimir`
> e `/telao` são páginas legítimas sem login que leem essa coleção.
> O e-mail tem de sair de dentro do documento — não a leitura de cima dele.

`fix/seguranca-inscricoes-pii` · `patches/P0-02`

- [ ] **Mitigação imediata**: parar de gravar e-mail no doc público
      (inscrições novas) — 1h, reduz o crescimento do vazamento
- [ ] Subcoleção `private/contact` + regra
- [ ] Coleção `provisional_claims` + regra + índice
- [ ] Migração em DRY-RUN → relatório → execução
- [ ] Código lê do novo lugar, com fallback · **7 dias em produção**
- [ ] Só então: apagar os campos antigos, em lotes
- [ ] Remover o fallback

**Aceite**: quadro público do torneio inalterado; `listMyRegistrations`
inalterado; inscrição provisória funciona; nenhum e-mail legível sem login.

⚠ **É o PR mais arriscado do plano.** Não fazer os passos 5 e 6 no mesmo
deploy. Exige S0 concluído.

## S3 — Endurecimento rápido ✅ CONCLUÍDO (2026-09-07)

> Entregue: cabeçalhos de segurança (verificados no emulador de hosting) +
> CSP em Report-Only + `audit_logs` com ator verificado (13 asserções novas)
> + caminho `uploads/{uid}/private/**` no Storage (aditivo) + Dependabot e
> job informativo de `npm audit`.
>
> **Fora do S3, por decisão consciente**: `Strict-Transport-Security` (o
> Firebase já envia, mais forte), `Cross-Origin-Opener-Policy` e
> `X-Frame-Options` (ambos arriscam o `signInWithPopup` / os caminhos
> `/__/auth/*`), e o **EXIF** — que exige mexer no caminho de upload de
> imagem e por isso foi separado para um PR próprio, com fallback seguro.
> `P2-13` (exigir e-mail verificado) também saiu do S3: mexe no ingresso.

`fix/seguranca-endurecimento`

- [ ] Cabeçalhos de segurança (`patches/P1-04`, **sem CSP ainda**)
- [ ] CSP em `Report-Only`
- [ ] `audit_logs`: exigir `actor_id == request.auth.uid` (`patches/P1-06-07`)
- [ ] **Remover EXIF** em todo upload (`core/lib/imageProcessing.js`)
- [ ] Exigir e-mail verificado para criar torneio / inscrever / publicar
- [ ] Testar em canal de pré-visualização antes de `main`

**Aceite**: login Google funciona (COOP), upload funciona, foto sai sem
GPS, nenhuma violação de CSP legítima no relatório.

## S4 — Testes de regras no CI ✅ CONCLUÍDO (2026-09-09)

- [x] Emulador no CI (`ci.yml`, job `firestore-rules`)
- [x] Suíte cobrindo: `users`, `tournament_registrations`, `audit_logs`,
      `notifications`, `athlete_profiles`, `conversations`, Storage
      (+ `game_days` e gamificação, que já tinham cobertura)
- [x] Falha o CI se qualquer asserção quebrar

**125 asserções.** Fechou junto o **P1-06** (notificação forjada): o sino
agora só aceita tipo conhecido, título/mensagem dentro do limite, e **link
interno** — o teste pegou que `//site-falso.com` passava pela primeira versão
da regra, porque começa com `/` e o navegador o trata como outro domínio.

**Por que aqui**: é o que **impede a volta** do P0-01. Sem isto, a
correção do S1 dura até a próxima refatoração distraída.

## S5 — Custom claims e papéis
`feat/seguranca-claims`

- [ ] Function `setPlatformRole` (Admin SDK) + bootstrap do owner
- [ ] Papéis: `owner`, `platform_admin`, `support_agent`, `moderator`, `dpo`
- [ ] Regras aceitam claim **ou** campo (fase de transição)
- [ ] Validar 1 semana → regras passam a exigir só o claim
- [ ] `users.role` vira espelho somente-leitura
- [ ] Reautenticação para ação sensível

⚠ **Ordem crítica**: conceder o claim ao admin **antes** de as regras
passarem a exigi-lo, ou o admin perde o acesso sem caminho de volta.

## S6 — App Check
`feat/seguranca-appcheck`

- [ ] reCAPTCHA Enterprise + SDK no cliente
- [ ] **Monitoring por 2 semanas**
- [ ] > 98% verificadas → enforce: Functions → Storage → Firestore
- [ ] Debug token para dev e CI

## S7 — 🛟 Console de suporte do admin
`feat/admin-suporte` · especificação em `05-ADMIN-SUPORTE.md`

Depende de: S1, S5, S0 (MFA).

- [ ] `admin_support_sessions` + `admin_access_logs` + regras (log imutável)
- [ ] Functions: `supportOpenSession`, `supportSearchUser`,
      `supportGetUser`, `supportRevealField`, `supportUpdateUser`,
      `supportAction`, `supportExportUser`, `supportCloseSession`
- [ ] Aba `V2AdminSupport` (busca exata, ficha mascarada, revelar, ações)
- [ ] Desfazer (30 dias) para toda escrita
- [ ] Notificação ao titular
- [ ] Tela do titular: "acessos da equipe de suporte"
- [ ] Alertas de anomalia (§8 do 05)
- [ ] Testes: nenhuma Function aceita coleção/campo livre; sem sessão não
      há dado; log é escrito antes de servir

**Aceite**: o admin consegue ajudar um usuário de ponta a ponta; e nenhum
acesso a dado pessoal acontece sem motivo registrado e visível ao titular.

## S8 — Direitos do titular
`feat/privacidade-direitos` · `09-DIREITOS-DO-TITULAR.md`

- [ ] `/perfil/privacidade`
- [ ] Canal do encarregado + `data_subject_requests` + fila no admin
- [ ] Exportação (Function + signed URL 24h + e-mail)
- [ ] Exclusão de conta (7 dias de arrependimento + Function)
- [ ] Tratamento do caso "único gestor de arena"

## S9 — Privacidade aplicada no servidor
`fix/privacidade-servidor`

- [ ] `directory_listed` aplicado na **regra**, não só no cliente
- [ ] Remover `user_email` de `tournament_admins`
- [ ] Fallback de nome sem e-mail (função compartilhada)
- [ ] Storage: prefixo `private/` + signed URLs
- [ ] `notifications`: validar criação
- [ ] Revisar as 62 coleções abertas, caso a caso

## S10 — Consentimento, imagem e menores
`feat/privacidade-consentimento` · ⚖️ exige advogado

- [ ] `user_consents` (finalidades granulares) + toggles
- [ ] Documento `uso-de-imagem` + escopos
- [ ] Documento `menores-e-responsavel`
- [ ] Regime de menores (13-17, < 13)
- [ ] Canal de remoção de foto
- [ ] `legal_document_versions` (congelar texto + hash)
- [ ] Revisar `tournament_photos: if true`

## S11 — Retenção
`feat/privacidade-retencao` · `11-RETENCAO-E-EXCLUSAO.md`

- [ ] `retentionReport` em **modo relatório por 30 dias**
- [ ] Revisar números
- [ ] Ligar as Functions uma a uma, da menos para a mais arriscada
- [ ] Documentar prazos na Política de Privacidade

⚠ **PR de maior risco de dano.** Exige S0 testado. Limite de itens por
execução, sempre.

## S12 — Governança contínua
`chore/seguranca-governanca`

- [ ] Dependabot + `npm audit` no CI
- [ ] Secret scanning
- [ ] Alertas de anomalia (leitura, escrita, permission-denied)
- [ ] Checklist de segurança no template de PR
- [ ] `14-RUNBOOK-E-GOVERNANCA.md` em operação

---

## Caminho crítico

```
S0 ──▶ S1 ──▶ S3 ──▶ S4
 │      │
 │      └──▶ S2 (exige S0)
 │
 └──▶ S5 ──▶ S6
       │
       └──▶ S7 (console de suporte)

S8, S9, S10, S11, S12 seguem depois, em qualquer ordem
```

## Se só der para fazer três coisas

1. **S0** (4h) — transforma erro irreversível em recuperável
2. **S1** (1 dia) — fecha a tomada da plataforma
3. **S2** (3 dias) — fecha o vazamento de e-mails

Quatro dias de trabalho eliminam os dois riscos críticos e criam a rede de
proteção. Todo o resto é melhoria sobre uma base já segura.

## Relação com `docs/FUTURO/`

| Antes de... | É preciso |
|---|---|
| qualquer coisa pública nova | S0, S1, S2 |
| o **Feed** | + S3 (EXIF!), S9, S10 (imagem e menores) |
| o **Mercado** | + S7, S8, S11 |
| abrir moderação a terceiros | + S5 (papéis separados) |
