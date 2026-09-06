# 20.07 — Documentos legais

> **Correção de premissa**: a auditoria começou supondo um conjunto legal
> raso. Ele **não é**. O módulo `legal/` tem **11 documentos versionados**,
> segmentados por papel, com portão de aceite bloqueante e registro
> individual de consentimento. É um dos pontos mais maduros da plataforma.
>
> O trabalho aqui é de **conteúdo e conformidade**, não de arquitetura.

## 1. O que já existe — e está bem construído

`src/modules/legal/domain/legalDocuments.js` — 11 documentos:

| # | `key` | Título | Audiência |
|---|---|---|---|
| 1 | `termos-de-uso` | Termos de Uso | todos |
| 2 | `privacidade` | Política de Privacidade | todos |
| 3 | `riscos-e-responsabilidade` | Termo de Ciência de Riscos e Isenção | todos |
| 4 | `politica-de-uso` | Política de Uso | todos |
| 5 | `cookies` | Política de Cookies | todos |
| 6 | `diretrizes-comunidade` | Diretrizes da Comunidade | todos |
| 7 | `pagamentos-reembolsos` | Política de Pagamentos e Reembolsos | todos |
| 8 | `cancelamento` | Política de Cancelamento | todos |
| 9 | `termos-organizador` | Termos do Organizador de Torneios | organizador |
| 10 | `termos-arena` | Termos do Proprietário de Arena | dono de arena |
| 11 | `termos-professor` | Termos do Professor | professor |

**Mecânica (correta e a preservar):**
- `version` inteiro; **bump força novo aceite** — versionamento real, não
  decorativo.
- `gate: true` marca o documento como bloqueante (portão de consentimento).
- `audience` segmenta por papel; `rolesForUser()` deriva os papéis dos
  sinais do usuário.
- `legal_consents/{uid}_{docKey}` com id determinístico → um aceite por
  documento por pessoa, impossível duplicar.
- Regra do Firestore correta: só o titular e o admin leem.
- `pendingGateConsents()` / `pendingRoleConsents()` — domínio puro, testado.

> Consequência para `docs/FUTURO/`: o Feed **não** precisa criar
> "Diretrizes da Comunidade" — já existe (`diretrizes-comunidade`). O que
> falta é o **conteúdo específico** de conteúdo gerado pelo usuário.
> Corrigir a menção em `docs/FUTURO/FEED/10-INTEGRACOES.md` §15 quando o
> Feed for implementado.

## 2. O que falta no CONTEÚDO dos documentos existentes

### `privacidade` — Política de Privacidade
| Falta | Artigo | Por quê |
|---|---|---|
| Identificação do **controlador** (nome/CNPJ/endereço) | 9º, I | hoje provavelmente genérico |
| **Encarregado (DPO)**: nome e e-mail | 41 | obrigatório |
| **Transferência internacional** (Google/Firebase fora do BR) | 33 | não declarada |
| **Bases legais por finalidade** (tabela) | 9º, II | hoje genérico |
| **Prazos de retenção** por categoria | 9º | inexistentes |
| **Como exercer cada direito** + prazo de 15 dias | 18-19 | promete, não diz como |
| Que a inscrição em torneio **publica** nome/categoria | 9º | não dito |
| Que arenas e professores são controladores independentes | 9º, V | não dito |
| Que o suporte pode acessar dados, com registro consultável | transparência | novo (`05-ADMIN-SUPORTE`) |
| Cookies/armazenamento local realmente usados | — | conferir com `cookies` |

### `termos-de-uso`
- Idade mínima e regra para menores (art. 14).
- Direito de imagem: como é tratado (remeter ao doc novo, §3).
- Regra de conta: uma pessoa, uma conta; consequência de fraude.
- Suspensão/banimento: hipóteses e recurso.
- Encerramento de conta pelo titular (e o que é retido, e por quê).

### `riscos-e-responsabilidade`
- Já cobre bem o risco físico. Falta: responsabilidade sobre encontros
  presenciais combinados pela plataforma (dia de jogo, procura-jogo) —
  relevante e hoje omisso.

### `diretrizes-comunidade`
- Conteúdo gerado pelo usuário (quando o Feed existir): o que é proibido,
  com exemplos de pickleball.
- Processo de denúncia, prazo e recurso.

### `pagamentos-reembolsos` / `cancelamento`
- Deixar explícito que a plataforma **não intermedia pagamento** (Pix
  direto ao parceiro) — hoje é o modelo real, e isso muda quem responde.
- Com o Mercado, revisar por inteiro.

## 3. Documentos que faltam CRIAR

| # | Proposta de `key` | Título | Por quê | Prioridade |
|---|---|---|---|---|
| 12 | `uso-de-imagem` | Autorização de Uso de Imagem | a plataforma **já** publica foto de pessoas (`tournament_photos`, perfil) sem autorização registrada. Base legal indefinida hoje — P2-10 | 🔴 alta |
| 13 | `menores-e-responsavel` | Termo do Responsável por Menor de 18 | art. 14, §1º — consentimento específico e destacado do responsável | 🔴 alta |
| 14 | `seguranca-e-incidentes` | Aviso de Segurança e Incidentes | como a plataforma comunica incidente; o que o usuário deve fazer | 🟡 média |
| 15 | `contrato-parceiro` | Contrato de Compartilhamento com Arena/Professor | art. 39 — define papéis, responsabilidades e o que cada um pode fazer com o dado | 🟡 média |
| 16 | `termos-mercado` | Termos do Mercado | quando o Mercado existir — `docs/FUTURO/MERCADO/13-RISCOS` | ⏳ futuro |
| 17 | `termos-vendedor` | Termos do Vendedor | idem | ⏳ futuro |

**Nota**: como já existe `audience` por papel, `uso-de-imagem` e
`menores-e-responsavel` entram naturalmente na mecânica atual — sem
mudança de arquitetura, só conteúdo + um `audience` novo (`minor_guardian`).

## 4. Versionamento e re-aceite — o cuidado a tomar

O `version` funciona e força re-aceite. Isso é ótimo **e perigoso**:
bumpar a versão de um documento `gate: true` **bloqueia toda a base** até
cada pessoa aceitar de novo.

Regras de operação:
1. Bumpar `version` **só** quando a mudança for material (direito, dado,
   finalidade). Correção de vírgula não bumpa.
2. Mudança material exige aviso prévio — LGPD e boa-fé. Publicar o novo
   texto com data de vigência futura, avisar por notificação, e só então
   bumpar.
3. Nunca bumpar mais de um documento `gate` por vez — o portão fica
   intransponível na prática e a taxa de abandono explode.
4. Guardar o **texto** de cada versão, não só o número. Hoje o texto vive
   em código: uma versão antiga só existe no histórico do git. Para prova
   de consentimento, isso é frágil.
   **Melhoria proposta**: coleção `legal_document_versions/{key}_{version}`
   com o texto integral congelado e o hash. O `legal_consents` passa a
   guardar o `content_hash` aceito. Aí sim há prova do que a pessoa aceitou.

## 5. Onde os documentos aparecem

- `/legal` — central (`V2Legal`)
- `/legal/:docKey` — documento (`V2LegalDocument`)
- Portão de consentimento — bloqueante para `gate: true`
- Rodapé — link
- ⚠ **Falta**: link para a Política de Privacidade **no momento da coleta**
  (formulário de cadastro, upload de foto, ativação de push). LGPD art. 9º
  espera informação **no momento** do tratamento, não só num rodapé.

## 6. Ações concretas

| # | Ação | Depende de |
|---|---|---|
| 1 | Definir controlador e encarregado | ⚖️ decisão + advogado |
| 2 | Reescrever `privacidade` com o conteúdo do §2 | 1 + `02-INVENTARIO` |
| 3 | Criar `uso-de-imagem` e `menores-e-responsavel` | ⚖️ advogado |
| 4 | Congelar o texto por versão (`legal_document_versions`) | 1 PR |
| 5 | Link para a política no ponto de coleta | 1 PR pequeno |
| 6 | Revisão jurídica dos 11 + 2 novos | ⚖️ |

⚖️ = precisa de advogado. **Nenhum destes textos deve ir ao ar sem
revisão jurídica** — um documento legal errado é pior que a ausência dele,
porque cria obrigação que não se cumpre (é exatamente o caso do P2-04:
a política promete exclusão que não existe).
