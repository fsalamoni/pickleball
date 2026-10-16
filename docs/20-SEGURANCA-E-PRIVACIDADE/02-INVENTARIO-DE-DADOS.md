# 20.02 — Inventário de dados pessoais (ROPA)

> **Registro de Operações de Tratamento** — LGPD art. 37 exige que o
> controlador mantenha registro das operações de tratamento. Este documento
> é a primeira versão desse registro.
>
> **Controlador**: PickleRush (a definir a pessoa jurídica —
> `06-LGPD-CONFORMIDADE.md` §2).
> **Encarregado (DPO)**: ⚠ **não indicado** — pendência LGPD art. 41.

## 1. Categorias de dado pessoal tratadas

| Categoria | Campos | Onde | Sensível? |
|---|---|---|---|
| **Identificação** | `full_name`, `platform_name`, `uid`, `photo_url` | `users`, `athlete_profiles` | não |
| **Contato** | `email`, `phone`, `address` | `users`, `athlete_profiles` (com opt-in), `tournament_registrations/{rid}/private/contact`, `provisional_claims`, `club_join_requests`, `club_member_invites`, `market_addresses`, `audit_logs` (ver §1.1) | não, mas alto risco |
| **Dado de menor** | `birth_date` de < 18 anos | `users` | ⚠ **sim** (LGPD art. 14) |
| **Data de nascimento** | `birth_date` | `users` (`athlete_profiles` guarda só `age` ✅) | não, mas identificador forte |
| **Gênero** | `gender`, `competition_gender` | `users`, `athlete_profiles`, `tournament_registrations` ⚠ | contextualmente sim |
| **Localização** | `city`, `state`, `address` | `users`, `athlete_profiles` | não |
| **Comportamental** | partidas, ratings, presença, reservas, XP | ~30 coleções | não |
| **Financeiro** | valores de reserva, venda no PDV, chave Pix da arena | `arena_bookings`, `arena_sales`, `arenas.payment` | sim (fraude) |
| **Imagem** | foto de perfil, foto de torneio, anexo | Storage `uploads/`, `tournament_photos` | ⚠ direito de imagem |
| **Comunicação** | mensagens de chat, posts de fórum | `conversations/messages`, `club_forum_threads` | ⚠ **sim** (sigilo) |
| **Técnico** | `push_tokens`, `last_login`, user-agent; relatório de erro (uid, rota sem ids, user-agent, pilha) | `push_tokens`, `users`, `audit_logs`; Cloud Logging / Error Reporting (fora do Firestore) | não |
| **Consentimento** | aceites, versões, datas | `legal_consents` | não |

**Não tratados** (e assim deve continuar, salvo decisão explícita):
CPF, RG, dado bancário do atleta, biometria, dado de saúde, origem racial,
convicção religiosa, opinião política, filiação sindical, orientação sexual.

> ⚠ Se algum dia a plataforma tratar **dado de saúde** (lesão, atestado
> médico para torneio) ou **CPF** (nota fiscal, pagamento), o regime muda:
> dado sensível exige base legal específica (art. 11) e controles maiores.
> Decidir isso conscientemente, nunca por acúmulo acidental.

### 1.1 Onde mora o contato HOJE (conferido no código e no `firestore.rules`, 2026-10-15)

**P1-01 resolvido** (2026-09-09): `tournament_admins` e `club_members` não
gravam mais e-mail (guarda `src/modules/clubs/domain/memberPayload.test.js`).
**P0-02 contido** (2026-09-09): inscrição nova não grava e-mail no documento
público. Nos dois casos, documentos ANTIGOS ainda podem carregar o campo até a
migração destrutiva (`19-PENDENCIAS.md`, itens 2 e 3).

| Coleção | Campos pessoais | Quem lê (regra) |
|---|---|---|
| `users/{uid}` | e-mail, telefone, nascimento, endereço | o titular e o admin da plataforma |
| `tournament_registrations/{rid}/private/contact` | `player_a_email`, `player_b_email` | admin da plataforma, organizador do torneio e as partes da inscrição (`isRegistrationParty`) |
| `provisional_claims/{rid}_{a\|b}` | `email_lc` (prova de inscrição provisória) | admin da plataforma e quem tem aquele e-mail no token |
| `club_join_requests`, `club_member_invites` | `user_email` | o próprio usuário, o admin do clube e o admin da plataforma |
| `athlete_profiles/{uid}` | telefone, e-mail, endereço **só com opt-in** (`*_public`), gravados vazios sem ele por `buildAthletePublicProfile` | qualquer conta logada — **a regra impõe o opt-in** (desde 2026-10-15): o dono só grava contato com a marca no espelho e no `users/{uid}`, o admin só com a marca no espelho (`athleteContacts.rules.test.js`). Espelho antigo pode guardar contato velho até a próxima sincronização ou a re-sincronização do admin, que o apaga |
| `market_addresses/{uid}` | endereço de entrega | só o titular (`get`) |
| `audit_logs` | e-mail e nome do ator e do alvo | só o admin da plataforma |

Sem e-mail (só nome público, que na falta de nome é a parte antes do `@` —
P1-02): `tournament_registrations` (documento novo), `tournament_admins`,
`club_members`, `tournaments.creator_name`.

## 2. Registro por coleção — as que contêm dado pessoal

Legenda de exposição: 🌍 público sem login · 🔓 qualquer autenticado ·
👥 relacionados · 🔒 titular + admin · 🛡 só admin

| Coleção | Dado pessoal | Exposição | Base legal | Retenção proposta | Achado |
|---|---|---|---|---|---|
| `users` | nome, e-mail, telefone, **nascimento**, endereço, gênero | 🔒 | execução de contrato (art. 7º, V) | conta ativa + 6 meses | **P0-01** ✅ corrigido |
| `athlete_profiles` | nome, cidade, idade, gênero, nível; contato **só com opt-in** ✅ | 🔓 | legítimo interesse / consentimento | enquanto listado | P2-01 |
| `tournament_registrations` | nome, gênero (e-mail só em documento legado; o novo vai para `{rid}/private/contact` 🔒👥) | 🌍 | execução de contrato | histórico esportivo: permanente (nome), e-mail: 0 | **P0-02** 🟡 contido (falta a migração) |
| `tournament_admins` | nome (e-mail só em documento legado) | 🔓 | execução de contrato | enquanto for admin | **P1-01** ✅ corrigido (falta a migração) |
| `tournaments` | `creator_name` (nunca o e-mail completo) | 🌍 | execução de contrato | permanente | **P1-02** ✅ corrigido |
| `audit_logs` | e-mail e nome do ator e do alvo | 🛡 | obrigação legal / legítimo interesse | **5 anos** (defesa) | P2-08 |
| `legal_consents` | uid, doc, versão, data | 🔒 | prova do consentimento | 5 anos após revogação | ✅ |
| `push_tokens` | token do dispositivo | 🔒 | consentimento | até revogar / 90d inativo | ✅ |
| `conversations` / `messages` | conteúdo de conversa privada | 👥 membros | execução de contrato | 2 anos | ✅ regra correta |
| `club_forum_threads` / `comments` | conteúdo, autoria | 👥 membros | execução de contrato | enquanto o clube existir | ✅ |
| `arena_bookings` | nome, contato, valor, responsáveis | 👥 | execução de contrato | 5 anos (fiscal do parceiro) | revisar |
| `arena_sales` / `arena_payments` | valor, comprador | 👥 arena | execução de contrato | 5 anos | revisar |
| `arena_reviews` | autoria, texto | 🌍 | legítimo interesse | permanente ou até remoção | ✅ |
| `coaches` / `coach_students` / `coach_lessons` | vínculo professor↔aluno, agenda | 🌍 / 👥 | execução de contrato | contrato + 2 anos | revisar |
| `coach_level_validations` | avaliação de nível do atleta | 🌍 | legítimo interesse | permanente | P2-02 |
| `coach_clinic_signups` | quem se inscreveu em quê | 🌍 | execução de contrato | 2 anos | P2-02 |
| `player_ratings` / `player_skill_ratings` / `rating_history` | desempenho vinculado ao uid | 🌍 | legítimo interesse (é ranking) | permanente | ✅ |
| `club_members` | filiação a clube | 🔓 | execução de contrato | enquanto membro | ✅ |
| `follows` | quem segue quem | 🔓 | execução de contrato | enquanto seguir | ✅ |
| `notifications` | conteúdo direcionado | 🔒 | execução de contrato | 90 dias (já expira ✅) | **P1-06** ⚠ |
| `user_progression_v2` / `user_achievements_v2` | progresso | 🔓 | execução de contrato | conta ativa | ✅ |
| `tournament_photos` | **imagem de pessoas** | 🌍 | ⚠ **base indefinida** | permanente | **P2-10** ⚠ |
| Storage `uploads/{uid}/**` | fotos, anexos, comprovantes | 🔓 ⚠ | execução de contrato | conta ativa | **P1-05** ⚠ |
| `training_items` (Centro de Treino, flag `training_center`) | autoria (uid, nome, foto), conteúdo, mídia | 🔒 privado · 👥 alunos/indicados · 🔓 público aprovado | execução de contrato | conta ativa; na exclusão, o que outras pessoas veem fica com a autoria (decisão do dono, 2026-10-09) e o privado não compartilhado é apagado | ✅ `docs/40` §9 |
| `training_sessions` + `comments` | o diário de treino (**sem campo de saúde**, aviso na tela) | 🔒 + o professor com quem foi compartilhada (vínculo ativo) | execução de contrato | conta ativa | ✅ |
| `training_plans` / `training_meta` | planos, rotina, autoavaliação | 🔒 | execução de contrato | conta ativa | ✅ |
| `training_shares` | quem mandou o quê a quem, com recado | 👥 os dois | execução de contrato | conta ativa (dos dois lados) | ✅ |
| `training_questions` + `messages` | conversa privada aluno ↔ professor | 👥 os dois | execução de contrato | conta ativa | ✅ |
| `training_reports` | denúncia: quem denunciou, o motivo | 🔒 denunciante + 🛡 | legítimo interesse (moderação) | retida na exclusão (só o uid) | ✅ |
| Storage `treino/{uid}/**` | fotos e vídeos de treino (≤ 60 s) | segue o item | execução de contrato | conta ativa; menor de 18 não envia | ✅ |
| `users.notification_channels` / `users.phone_verified_*` (2026-10-16, `external_messaging`) | escolhas de aviso por canal; o celular CONFIRMADO para WhatsApp/SMS | 🔒 (o `phone_verified_*` só o servidor grava) | consentimento (a pessoa liga cada canal) | conta ativa | ✅ |
| `message_outbox` | cada envio por e-mail/WhatsApp/SMS: uid, canal, área, situação e o endereço MASCARADO (`to_masked`) | 🔒 titular + 🛡 (só o servidor escreve) | execução de contrato (avisos do serviço) / consentimento (promoções) | 90 dias | ✅ |
| `phone_verifications` | celular em confirmação e o hash do código | ninguém pelo cliente | consentimento | 10 min; apagado ao confirmar | ✅ |
| `message_suppressions` | e-mail/celular bloqueado (devolução, reclamação, PARAR) | ninguém pelo cliente | legítimo interesse (não insistir em quem pediu para parar) | na exclusão o endereço sai, o bloqueio fica | ✅ |
| `message_reports` | denúncia de e-mail: quem denunciou e quem mandou | 🛡 | legítimo interesse (moderação) | retida (uids) | ✅ |

## 3. Fluxos de dado para fora

| Destino | O que sai | Base | Situação |
|---|---|---|---|
| **Google / Firebase** (Auth, Firestore, Storage, Functions, Hosting, FCM) | tudo | operador (art. 39) | ⚠ **transferência internacional** (servidores fora do BR, exceto a região SP das Functions). Exige cláusula na Política de Privacidade e contrato de operador. Ver `06-LGPD` §6 |
| **DUPR** (exportação CSV pelo admin — `dupr_match_export`, sempre ligada desde 2026-10-10) | nome, DUPR ID, uid como id externo, resultados (sem e-mail — `DUPR_CSV_HEADERS`) | consentimento | ⚠ documentar a transferência |
| **Google Analytics / Performance** | uso (env `false` hoje ✅) | consentimento | desligado — se ligar, exige banner de cookies funcional |
| **Google Cloud Logging / Error Reporting** (mesmo projeto, desde 2026-10-15) | relatório de erro do navegador: mensagem (e-mail apagado pelo servidor), pilha, rota com ids trocados por `:id`, versão, user-agent e o uid de quem estava logado | legítimo interesse (segurança e funcionamento do serviço) | ✅ sem terceiro novo (o mesmo Google, operador); sem nome, e-mail ou telefone; some com a retenção padrão do Cloud Logging (30 dias) — `functions/clientErrors.js` |
| **Provedores de e-mail, WhatsApp e SMS** (Amazon SES ou Resend; Cloud API da Meta; Twilio ou Zenvia — `external_messaging`, desligada até o admin conectar cada um) | e-mail ou celular de quem ligou o canal, o texto do aviso e o primeiro nome | operador (art. 39) | ⚠ antes de ligar: contrato de operador com cada provedor escolhido, e citar os provedores (e a transferência internacional, salvo Zenvia) na Política de Privacidade — hoje ela cita só o Google Firebase como exemplo (`legalDocuments.js`). Ver `docs/49` |
| **Parceiros/afiliados** (`affiliate_links`) | nenhum dado pessoal | — | ✅ só link |
| **YouTube / Vimeo** (vídeo por link no Treino) | o IP de quem toca no vídeo | consentimento (o toque) | ✅ fachada: o player (`youtube-nocookie.com`, `player.vimeo.com`) só carrega quando a pessoa toca |
| **Arenas e professores** | dado do aluno/cliente | execução de contrato | ⚠ são **controladores independentes** ou operadores? Definir e contratualizar (`07-DOCUMENTOS-LEGAIS.md` §3) |

## 4. O que precisa ser decidido

1. **Quem é o controlador** (pessoa física ou jurídica)? Isso muda
   responsabilidade e o que vai nos documentos.
2. **Encarregado (DPO)**: nome e e-mail públicos. Obrigatório.
3. **Arena e professor são operadores ou controladores independentes?**
   Muda o contrato e a responsabilidade por vazamento do lado deles.
4. **Menores de idade**: a plataforma aceita? A partir de que idade? Com
   consentimento de quem? (`08-CONSENTIMENTO-E-IMAGEM.md` §4)
5. **Retenção do histórico esportivo**: resultado de torneio é registro
   histórico legítimo e permanente, mas nome vinculado a ele, para sempre,
   depois da conta excluída? Proposta em `11-RETENCAO-E-EXCLUSAO.md`.

## 5. Manutenção deste documento

Este inventário **desatualiza a cada feature nova**. Regra: todo PR que
criar coleção ou campo com dado pessoal **atualiza esta tabela** — vira
item do checklist de entrega do `CLAUDE.md` §7.
