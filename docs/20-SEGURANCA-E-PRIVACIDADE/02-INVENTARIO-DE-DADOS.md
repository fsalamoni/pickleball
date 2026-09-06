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
| **Contato** | `email`, `phone`, `address` | `users`, `athlete_profiles` (com opt-in), `tournament_registrations` ⚠, `tournament_admins` ⚠, `audit_logs` | não, mas alto risco |
| **Dado de menor** | `birth_date` de < 18 anos | `users` | ⚠ **sim** (LGPD art. 14) |
| **Data de nascimento** | `birth_date` | `users` (`athlete_profiles` guarda só `age` ✅) | não, mas identificador forte |
| **Gênero** | `gender`, `competition_gender` | `users`, `athlete_profiles`, `tournament_registrations` ⚠ | contextualmente sim |
| **Localização** | `city`, `state`, `address` | `users`, `athlete_profiles` | não |
| **Comportamental** | partidas, ratings, presença, reservas, XP | ~30 coleções | não |
| **Financeiro** | valores de reserva, venda no PDV, chave Pix da arena | `arena_bookings`, `arena_sales`, `arenas.payment` | sim (fraude) |
| **Imagem** | foto de perfil, foto de torneio, anexo | Storage `uploads/`, `tournament_photos` | ⚠ direito de imagem |
| **Comunicação** | mensagens de chat, posts de fórum | `conversations/messages`, `club_forum_threads` | ⚠ **sim** (sigilo) |
| **Técnico** | `push_tokens`, `last_login`, user-agent | `push_tokens`, `users`, `audit_logs` | não |
| **Consentimento** | aceites, versões, datas | `legal_consents` | não |

**Não tratados** (e assim deve continuar, salvo decisão explícita):
CPF, RG, dado bancário do atleta, biometria, dado de saúde, origem racial,
convicção religiosa, opinião política, filiação sindical, orientação sexual.

> ⚠ Se algum dia a plataforma tratar **dado de saúde** (lesão, atestado
> médico para torneio) ou **CPF** (nota fiscal, pagamento), o regime muda:
> dado sensível exige base legal específica (art. 11) e controles maiores.
> Decidir isso conscientemente, nunca por acúmulo acidental.

## 2. Registro por coleção — as que contêm dado pessoal

Legenda de exposição: 🌍 público sem login · 🔓 qualquer autenticado ·
👥 relacionados · 🔒 titular + admin · 🛡 só admin

| Coleção | Dado pessoal | Exposição | Base legal | Retenção proposta | Achado |
|---|---|---|---|---|---|
| `users` | nome, e-mail, telefone, **nascimento**, endereço, gênero | 🔒 | execução de contrato (art. 7º, V) | conta ativa + 6 meses | **P0-01** ⚠ |
| `athlete_profiles` | nome, cidade, idade, gênero, nível; contato **só com opt-in** ✅ | 🔓 | legítimo interesse / consentimento | enquanto listado | P2-01 |
| `tournament_registrations` | nome, **e-mail**, gênero | 🌍 | execução de contrato | histórico esportivo: permanente (nome), e-mail: 0 | **P0-02** ⚠ |
| `tournament_admins` | **e-mail**, nome | 🔓 | execução de contrato | enquanto for admin | **P1-01** ⚠ |
| `tournaments` | `creator_name` (pode ser e-mail) | 🌍 | execução de contrato | permanente | **P1-02** ⚠ |
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

## 3. Fluxos de dado para fora

| Destino | O que sai | Base | Situação |
|---|---|---|---|
| **Google / Firebase** (Auth, Firestore, Storage, Functions, Hosting, FCM) | tudo | operador (art. 39) | ⚠ **transferência internacional** (servidores fora do BR, exceto a região SP das Functions). Exige cláusula na Política de Privacidade e contrato de operador. Ver `06-LGPD` §6 |
| **DUPR** (exportação CSV — flag OFF) | nome, e-mail, resultados | consentimento | ⚠ documentar antes de ligar a flag |
| **Google Analytics / Performance** | uso (env `false` hoje ✅) | consentimento | desligado — se ligar, exige banner de cookies funcional |
| **Parceiros/afiliados** (`affiliate_links`) | nenhum dado pessoal | — | ✅ só link |
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
