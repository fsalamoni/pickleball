# 20.10 — Segurança técnica

> Endurecimento da infraestrutura. Cada item traz o estado real verificado
> no repositório, o alvo e o esforço.

## 1. Autenticação

| Controle | Hoje | Alvo | Esforço |
|---|---|---|---|
| Provedores | Google + e-mail/senha | manter | — |
| **MFA para admin** | ❌ | obrigatório (Firebase Auth MFA) | pequeno |
| MFA opcional para usuário | ❌ | oferecer | médio |
| Verificação de e-mail | não exigida | exigir antes de criar torneio/inscrever/publicar | pequeno |
| Política de senha | padrão do Firebase | ativar política forte no console | trivial |
| Proteção contra enumeração de e-mail | não configurada | ativar no Firebase Auth | trivial |
| Bloqueio por tentativas | padrão do Firebase | verificar e ajustar | trivial |
| Sessões ativas visíveis ao usuário | ❌ | listar e permitir encerrar | médio |
| Revogação de token pelo admin | ❌ | `revokeRefreshTokens()` por Function | pequeno |
| Alerta de login novo | ❌ | e-mail, ao menos para admin | médio |

**Prioridade**: MFA do admin (P1-08) e proteção contra enumeração são os
dois de maior retorno por esforço.

## 2. Autorização
Ver `04-CONTROLE-DE-ACESSO.md`. Resumo: migrar para **custom claims**,
corrigir P0-01, separar papéis, admin lê por Function auditada.

## 3. App Check (P1-03) — a defesa que não existe

**Estado verificado**: `grep AppCheck|ReCaptcha` → **zero ocorrências**.

Sem App Check, qualquer script fora do navegador conversa com o Firestore,
o Storage e as Functions usando o `projectId` do bundle. Não há como
distinguir a aplicação legítima de um robô.

**Implantação (sem risco, se feita nesta ordem):**
```
1. Registrar o app no App Check com reCAPTCHA Enterprise (web).
2. Adicionar o SDK no cliente (initializeAppCheck) — 1 arquivo.
3. Deixar em MONITORING por 2 semanas. Nada é bloqueado; o console
   mostra a proporção de requisições verificadas.
4. Confirmar > 98% verificadas (o resto é cache velho e PWA offline).
5. Só então ENFORCE, um serviço por vez: Functions → Storage → Firestore.
6. Manter debug token para desenvolvimento e para o CI.
```

⚠ **Nunca ligar enforce direto.** Vai derrubar usuários com service worker
antigo em cache. O modo monitoring existe exatamente para isso.

## 4. Cabeçalhos HTTP (P1-04)
Ver `patches/P1-04-cabecalhos-de-seguranca.md`. Resumo: nenhum cabeçalho
de segurança hoje; CSP em `Report-Only` por 2 semanas antes de bloquear.

## 5. Firestore

| Controle | Hoje | Alvo |
|---|---|---|
| Regras como única defesa | sim | + App Check |
| 62/113 coleções com leitura irrestrita | sim (P2-02) | revisar caso a caso (`02-INVENTARIO`) |
| Preferência de privacidade no servidor | não (P2-01) | aplicar na regra |
| Teste automatizado de regras no CI | não (P3-08) | suíte a cada PR |
| Validação de shape na escrita | parcial (`hasOnly` em várias) | ampliar nas coleções com PII |
| Limite de tamanho de campo | não | validar nas regras onde couber |

**P3-08 é mais importante do que a severidade sugere**: uma suíte de regras
rodando no CI é o que **impede a volta** do P0-01. Sem ela, a correção é
uma foto; com ela, é permanente.

## 6. Storage

Ver `patches/P1-05-storage-leitura.md`. Além disso:
- **Remover EXIF** de toda imagem (vazamento de GPS — hoje acontece).
- Validar `contentType` na regra (hoje só valida tamanho).
- Signed URL de curta duração para o que é sensível, em vez de
  `getDownloadURL()` permanente.
- Limpeza de órfãos: excluir documento não apaga o arquivo. Function
  `onDelete` para limpar.

## 7. Cloud Functions

**Estado**: boas práticas já presentes — `onCall` verificam
`platform_admin` com custom claim **e** fallback ao campo
(`functions/index.js:546-571`).

| Controle | Hoje | Alvo |
|---|---|---|
| Verificação de auth | ✅ | manter |
| App Check nas Functions | ❌ | `enforceAppCheck: true` |
| Rate limit por chamador | ❌ | contador ou `maxInstances` |
| Validação de entrada | parcial | validar todo parâmetro |
| Segredos | env do Firebase | migrar para Secret Manager |
| Menor privilégio da service account | padrão (amplo) | SA dedicada por função sensível |
| Timeout e memória | padrão | ajustar (limita custo de abuso) |

⚠ **Regra dura para as Functions de suporte** (`05-ADMIN-SUPORTE.md` §9):
o Admin SDK ignora as regras do Firestore. Nenhuma Function pode aceitar
nome de coleção ou campo como parâmetro livre.

## 8. Segredos e pipeline

**Estado: bom.**
- Nenhum segredo versionado (verificado).
- `.env`, `.env.local` no `.gitignore` ✅.
- Deploy usa `secrets.FIREBASE_SERVICE_ACCOUNT` do GitHub ✅.
- Config do Firebase Web no bundle: **correto e inevitável** — não é
  segredo, é identificador público. A proteção é regra + App Check.

| Melhoria | Prioridade |
|---|---|
| Rotação documentada da service account (P3-07) | média |
| Secret scanning no CI (P3-02) | média |
| Dependabot / `npm audit` no CI (P3-01) | média |
| SA de deploy com o mínimo de papéis | média |
| Ambiente de staging separado de produção | alta a médio prazo |

⚠ **Ambiente único**: hoje `main` → produção, direto. Não há staging.
Para mudanças de **regra** e de **CSP**, isso é arriscado. Mitigação barata:
usar canais de pré-visualização do Firebase Hosting (`hosting:channel:deploy`)
e o emulador para regras — já é o suficiente sem criar um segundo projeto.

## 9. Backup e recuperação (P2-03) — a lacuna mais silenciosa

**Estado verificado**: nenhuma configuração de backup, export ou PITR.

Isso significa que **hoje não há como voltar atrás** de: exclusão
acidental, bug de migração, ou ação de um admin comprometido (P0-01).

| Controle | Alvo |
|---|---|
| **PITR do Firestore** | habilitar (retenção de 7 dias) |
| Export diário agendado | bucket dedicado, **projeto/conta separada** |
| Retenção dos exports | 30 dias diários + 12 mensais |
| Acesso ao bucket de backup | separado do acesso à plataforma |
| **Teste de restauração** | trimestral — backup nunca testado é esperança, não backup |
| Backup do Storage | replicação ou versionamento de objeto |
| Backup das regras e config | já no git ✅ |

O bucket de backup em conta separada é o que protege contra o pior caso:
admin comprometido que apaga a base **e** os backups.

**Custo**: PITR e export diário de uma base deste tamanho ficam na casa de
poucos dólares por mês. É o item de melhor relação custo/benefício de todo
este documento.

## 10. Monitoramento e resposta

| Controle | Hoje | Alvo |
|---|---|---|
| Alerta de orçamento (P3-05) | ❌ | US$ 50 / 100 / 200 |
| Alerta de pico de leitura | ❌ | Cloud Monitoring |
| Alerta de erro de permissão em massa | ❌ | sinal de tentativa de exploração |
| Alerta de ação administrativa | ❌ | `05-ADMIN-SUPORTE` §8 |
| Log de erro do cliente | `observabilityService` ✅ | garantir que não capture PII |
| Painel de saúde | parcial | consolidar |

## 11. Dependências e cliente

- `npm audit` no CI, falhando em `high`/`critical`.
- Dependabot com PRs agrupados.
- Revisar dependência nova: quem mantém, com que frequência, quantos
  downloads. Uma dependência abandonada é uma porta futura.
- Sem `dangerouslySetInnerHTML` hoje ✅ — manter como regra de revisão.
- Sanitizar toda URL vinda de usuário antes de virar `href` (bloquear
  `javascript:`).

## 12. Ordem por relação risco/esforço

```
IMEDIATO (horas)
  1. Alerta de orçamento no Firebase
  2. Habilitar PITR do Firestore
  3. Proteção contra enumeração de e-mail (console)
  4. MFA na conta do admin

CURTO (dias)
  5. patches/P0-01 (privesc)          ← maior risco da plataforma
  6. patches/P0-02 (e-mails públicos)
  7. Remover EXIF nos uploads
  8. Cabeçalhos de segurança (sem CSP)
  9. Export diário agendado

MÉDIO (semanas)
 10. App Check (monitoring → enforce)
 11. CSP (report-only → enforce)
 12. Custom claims + papéis
 13. Suíte de testes de regras no CI
 14. patches/P1-05, P1-06, P1-07
 15. Storage privado + signed URLs
```
