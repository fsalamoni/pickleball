# 33 — Cadastro essencial: o que o sorteio e a busca por perto precisam

> Flag `essential_profile` (default OFF). Desligada, o cadastro segue como
> estava. Zero banco: todos os campos já existiam no perfil.

## O pedido

*"Nem todos os usuários estão preenchendo algumas informações que são
imprescindíveis, como cidade, UF, data de nascimento, lado que gosta de jogar,
sexo, gênero pelo qual pretende jogar, nível… Em regra, são essenciais aqueles
que facilitem encontrar a pessoa ou jogos por cidade, localidade e distância,
bem como aqueles que permitam um melhor funcionamento dos sorteios… O ID e o
nível DUPR não são obrigatórios, mas são importantes."*

## O que já era obrigatório (e onde)

O assistente de cadastro (`V2OnboardingWizard`, montado em todo `V2Layout`)
abre para quem tem o cadastro incompleto e **não pode ser fechado**. A regra é
`missingRegistrationFields` (`src/core/lib/profileValidation.js`):

| Campo | Para quê | Antes | Com a flag |
|---|---|---|---|
| Nome de exibição | rankings, listas | obrigatório | obrigatório |
| Data de nascimento | categorias de idade dos torneios | obrigatório | obrigatório |
| Telefone | contato da organização | obrigatório | obrigatório |
| Tempo de experiência | nivelamento | obrigatório | obrigatório |
| Gênero | perfil, diretório | obrigatório (inclui "Outro" e "Prefiro não informar") | obrigatório |
| Cidade | busca por perto, região da tela inicial | obrigatório | obrigatório |
| UF | idem | obrigatório (texto livre) | obrigatório, **de uma lista** das 27 |
| Lado da quadra | parcerias, sorteio | obrigatório | obrigatório |
| Interesses | o que a plataforma sugere | obrigatório | obrigatório |
| **Categoria em que joga** (`competition_gender`) | duplas mistas do dia de jogo, categorias dos torneios | opcional — e o assistente **nem perguntava** | **obrigatório** (masculina/feminina) |
| **Nível** (`leveling_level`) | equilíbrio de todo sorteio (régua 2.0–8.0) | opcional ("Concluir sem informar nível") | **obrigatório** — vale a autoindicação da lista, o teste ou um rating DUPR válido |
| ID DUPR, rating DUPR | ranking, sorteio mais preciso | opcional | opcional, **pedido junto do nível** |
| Endereço | — | opcional | opcional |

Os dois buracos reais eram a **categoria** e o **nível**: nenhum dos dois era
pedido, e são exatamente o que o sorteio usa. Os campos da tabela que já eram
obrigatórios ficavam vazios por outro motivo: **a edição do perfil deixava
apagá-los** (gênero tinha "Não informar", cidade e UF aceitavam branco, lado da
quadra também) — e aí o assistente reabria na entrada seguinte pedindo de volta.

## O que mudou

**Sempre (sem flag), porque era inconsistência:**

- A edição do perfil não salva gênero, cidade, UF nem lado da quadra em branco
  — os mesmos campos que o cadastro exige ("Prefiro não informar" continua
  sendo uma resposta válida para gênero).
- O painel do admin (**Comunidade → Cadastros**) chama de obrigatório o MESMO
  que o cadastro. Antes eram só nome, nascimento, telefone e experiência, e o
  painel dizia "completo" de um cadastro que o assistente ia reabrir.
- O sorteio misto do dia de jogo (`play_gender`) usa a **categoria em que a
  pessoa joga** e só na falta dela o gênero do perfil (`playGenderOf`). "Outro"
  e "Prefiro não informar" não viram palpite.

**Com a flag `essential_profile`:**

- O assistente pede a **categoria** (no passo do jogo) e o **nível** (no último
  passo, sem "concluir sem informar"), com ID e rating DUPR opcionais ao lado.
- A **UF** vira lista (a mesma do núcleo, `src/core/domain/ufs.js`).
- **Quem já tinha concluído o cadastro vê SÓ o que falta**, com um aviso de
  por quê ("o cadastro passou a pedir a categoria e o nível…") — refazer o
  cadastro inteiro para responder duas perguntas é motivo para fechar o app.
- O perfil marca categoria e nível como obrigatórios, e o painel do admin passa
  a contá-los.

## Ligar

Painel admin → Funcionalidades → grupo **Atleta, rating e social** →
**Cadastro essencial (categoria e nível obrigatórios)**. Na próxima entrada,
cada pessoa com categoria ou nível em branco é chamada a completar.
Para acompanhar: **Comunidade → Cadastros → Falta obrigatório**.

## Privacidade

Nada novo sai do perfil. A data de nascimento continua só em `users` (nunca no
diretório público); categoria e nível já eram espelhados no diretório, como
antes.

## Código

- Regra: `missingRegistrationFields(profile, { essencial })`,
  `hasDeclaredLevel`, `parseDuprRating`, `REGISTRATION_FIELD_LABELS`
  (`src/core/lib/profileValidation.js`).
- Assistente: `src/v2/components/onboarding/V2OnboardingWizard.jsx` (+ teste de
  tela).
- Perfil: `src/v2/pages/V2ProfileEdit.jsx`.
- Admin: `isRequiredField` / `userRecordStatus(user, { essencial })`
  (`src/modules/admin/domain/adminUserEdit.js`).
- Sorteio: `playGenderOf` (`src/modules/athletes/domain/profileMeta.js`),
  usado ao entrar em dia de jogo (atleta, arena) e em jogo aberto.
