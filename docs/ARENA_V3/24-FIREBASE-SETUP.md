# Arena V3 — Setup Firebase & Google Cloud (Guia Completo)

> Tudo que você precisa configurar no Firebase + Google Cloud para colocar a
> Arena V3 (1000+ features em 11 sprints) em produção.

**Última atualização**: 2026-07-21
**Versão**: 1.0
**Database ID**: `pickleball` (Firestore nomeado, não default)
**Region**: `southamerica-east1` (São Paulo)

---

## ⚠️ Pré-requisito importante

A branch com o código está em: `feature/arena-management-v3` (NÃO mergeada em main).
Tudo neste doc assume que você já fez merge + deploy do código.

---

## 📋 Sumário

1. [Deploy das Firestore Rules (CRÍTICO)](#1-firestore-rules)
2. [Deploy dos Índices Compostos (CRÍTICO)](#2-firestore-indexes)
3. [Configurar Platform Admin](#3-platform-admin)
4. [Configurar Gestores de Arena](#4-gestores-de-arena)
5. [Migração de Feature Flags (OPCIONAL)](#5-feature-flags)
6. [Cloud Functions (4 novas)](#6-cloud-functions)
7. [Verificações Pós-Deploy](#7-verificacoes)
8. [Troubleshooting](#8-troubleshooting)

---

## 1. Firestore Rules

### O que está no `firestore.rules`

O arquivo `firestore.rules` na raiz do projeto **já contém**:

- ✅ 56+ coleções com regras (PickleRush original + 11 da Arena V3 sprint 0)
- ✅ **15 coleções NOVAS da V3** (sprints 1-11): `arena_matches`, `arena_coaches`, `arena_classes`, `arena_class_bookings`, `arena_internal_tournaments`, `arena_ladders`, `arena_coupons`, `arena_campaigns`, `arena_nps_responses`, `arena_referrals`, `arena_checklists`, `arena_maintenance_orders`, `arena_devices`, `arena_networks`, `arena_network_memberships`, `arena_tier_configs`

**Esta etapa já está 100% no código. Você só precisa fazer deploy.**

### Como fazer deploy

#### Opção A — Terminal (recomendado, rápido)

```bash
cd /workspace/pickleball
firebase deploy --only firestore:rules
```

#### Opção B — Console Firebase (manual)

1. Acesse https://console.firebase.google.com/project/picklerush/firestore/rules
2. Abra `/workspace/pickleball/firestore.rules` no editor local
3. Copie todo o conteúdo
4. Cole no editor do console Firebase
5. Clique **Publicar**

### Validação

Após deploy, o console deve mostrar:
- Última publicação: data/hora atual
- Sem erros de sintaxe (parser integrado do console)

---

## 2. Firestore Indexes

### O que está no `firestore.indexes.json`

O arquivo na raiz do projeto **já contém 12 índices compostos novos** para as queries da V3 (listagens filtradas por arena_id + ordenação por data).

### Como fazer deploy

```bash
cd /workspace/pickleball
firebase deploy --only firestore:indexes
```

**Atenção**: A criação de índices é **assíncrona** e pode levar de 2 a 30 minutos dependendo do tamanho. O console Firebase mostra o status.

### Validação

Firebase Console → Firestore → Indexes → deve listar:

```
✓ arena_open_slots: arena_id ASC + starts_at ASC
✓ arena_waitlist: arena_id ASC + created_at DESC
✓ arena_members: arena_id ASC + tier ASC
✓ arena_packages: arena_id ASC + active ASC
✓ arena_sales: arena_id ASC + created_at DESC
✓ arena_classes: arena_id ASC + starts_at ASC
✓ arena_internal_tournaments: arena_id ASC + date ASC
✓ arena_coupons: arena_id ASC + active ASC
✓ arena_campaigns: arena_id ASC + created_at DESC
✓ arena_maintenance_orders: arena_id ASC + created_at DESC
✓ arena_devices: arena_id ASC + name ASC
```

---

## 3. Platform Admin

### O que é

`platform_admin` é o papel que dá **acesso total à plataforma** (todas arenas, todos os módulos, Painel admin).

### Como configurar

#### Cenário 1: Você já é admin (mais comum)

Abra o Firebase Console → Firestore → `users/{seuUid}`. Verifique se tem:

```
role: "platform_admin"
```

Se já tiver, **não precisa fazer nada**.

Se não tiver, adicione manualmente:

1. Firebase Console → Firestore → users → seu UID
2. Editar documento
3. Adicionar campo:
   - Nome: `role`
   - Tipo: `string`
   - Valor: `platform_admin`
4. Salvar

#### Cenário 2: Quer promover outro user

Use o script Node.js incluído no projeto:

```bash
# No diretório /workspace/pickleball
# (precisa de credenciais de service account)

node scripts/promote-platform-admin.mjs grant email@exemplo.com
node scripts/promote-platform-admin.mjs grant <uid-direto>
```

Para configurar credenciais em CI/local:

```bash
# Opção A: gcloud CLI
gcloud auth application-default login

# Opção B: service account JSON
export GOOGLE_APPLICATION_CREDENTIALS="/path/to/serviceAccount.json"
```

#### Cenário 3: Verificar quem é admin

```bash
node scripts/check-platform-admin.mjs           # lista todos
node scripts/check-platform-admin.mjs me@x.com   # checa específico
```

### Custom Claims (OPCIONAL — performance)

Custom Claims são atributos no JWT do usuário, lidos **sem custo de leitura** no Firestore. Úteis para apps grandes.

Para setar (requer Cloud Function ou Admin SDK):

```javascript
// No Admin SDK (Node)
const admin = require('firebase-admin');
await admin.auth().setCustomUserClaims(uid, { platform_admin: true });
```

Depois, **OPCIONALMENTE** você pode modificar a função `isPlatformAdmin()` em `firestore.rules` para ler do token em vez do Firestore:

```javascript
function isPlatformAdmin() {
  return isAuthed() && request.auth.token.platform_admin == true;
}
```

**Recomendação**: comece com a leitura do Firestore (mais simples), promova para custom claims só se você medir custo de leitura significativo.

---

## 4. Gestores de Arena

### O que é

`arena_managers/{arenaId}_{uid}` concede a um user **acesso de gestão** apenas em uma arena específica. Eles podem:
- Ligar/desligar módulos da arena
- Editar configurações
- Ver bookings/membros
- Mas NÃO veem outras arenas nem o Painel

### Como configurar

#### Manual (Firebase Console)

1. Firebase Console → Firestore → adicionar coleção `arena_managers`
2. Doc ID: `{arenaId}_{userId}` (formato determinístico, ex: `arena_abc123_uid_xyz`)
3. Campos:
   ```
   arena_id: <arenaId>
   user_id: <userId>
   role: "manager"        // ou "owner" / "staff"
   created_at: <agora>
   ```

#### Script (mais rápido)

```bash
# Conceder
node scripts/grant-arena-manager.mjs grant <arenaId> email@exemplo.com
node scripts/grant-arena-manager.mjs grant <arenaId> <uid>

# Listar gestores de uma arena
node scripts/grant-arena-manager.mjs list <arenaId>

# Revogar
node scripts/grant-arena-manager.mjs revoke <arenaId> email@exemplo.com
```

### Quando você é o dono (owner) da arena

Não precisa criar doc em `arena_managers`. O dono é identificado pelo campo `owner_id` no documento da arena (em `arenas/{arenaId}`).

---

## 5. Feature Flags

### Como funciona

- **Padrão**: as 50+ flags da V3 estão em `src/core/featureFlags.js` com `value: false` por default.
- **Runtime**: o hook `useFeatureFlags()` lê do Firestore. Se não existir, usa o default do código.
- **Painel admin**: `/arenas/:id/gerir/modulos` permite ligar/desligar módulos POR ARENA (cria doc em `arena_module_states/{arenaId}_{moduleId}`).
- **Master switch**: o painel do platform admin pode ligar/desligar famílias inteiras (cria doc em `feature_flags/{flagKey}` com `value: true`).

### Você PRECISA rodar o script de migração?

**NÃO é obrigatório.** O código funciona sem nada no Firestore. Mas se você quiser gerenciar flags pelo painel admin, **sim, rode uma vez**:

```bash
cd /workspace/pickleball
node scripts/migrate-arena-v3-flags.mjs
```

Esse script cria docs em `feature_flags/` para todas as 50+ flags com `value: false`. Depois, basta usar o painel para ligar.

### Lógica de gate (4 níveis)

Para um módulo aparecer numa arena, **TODOS** devem ser true:

```
1. feature_flags/arena_modules                 = true   (master switch)
2. feature_flags/arena_module_{família}        = true   (ex: arena_module_marketing)
3. feature_flags/arena_module_{família}_{sub}   = true   (ex: arena_module_marketing_coupons)
4. arena_module_states/{arenaId}_{moduleId}     = enabled: true   (opt-in por arena)
```

O hook `useCanArenaUseModule(arenaId, 'modulo_x')` retorna `true` só se todos passarem.

### Verificação rápida

Depois de ligado, teste acessando a arena no app:
- `/arenas/{id}/membros` para members
- `/arenas/{id}/gerir/open-match` para open match
- etc.

Se aparecer "Módulo indisponível", alguma das 4 condições falhou.

---

## 6. Cloud Functions

### Já existentes

- `recomputeRankingOnTournamentChange` — gatilho em `tournaments/{id}` que recalcula o ranking. Não mexe.

### Novas (V3 sprints 1, 5, 6, 7)

Adicionadas em `functions/index.js`:

| Função | Schedule | Descrição |
|---|---|---|
| `expireStaleNotifications` | `0 3 * * *` (3h SP) | Arquiva notificações não lidas > 7 dias |
| `refreshLadderWeekly` | `0 23 * * 0` (dom 23h SP) | Recalcula ladder de arenas com módulo ativo |
| `aggregateNpsDaily` | `0 4 * * *` (4h SP) | Consolida NPS por arena/dia |
| `autoCloseChecklists` | `0 1 * * *` (1h SP) | Fecha checklists > 24h ou 100% completos |

### Como fazer deploy

```bash
cd /workspace/pickleball
firebase deploy --only functions
```

**Atenção**: deploy de functions pode levar 5-10 min. Cloud Functions Gen 2 + region `southamerica-east1` (cold start menor).

### Validação

```bash
firebase functions:list
```

Deve listar as 5 funções acima.

### Custos esperados

Cada função roda 1x por dia/semana e processa poucas centenas de docs no máx. Free tier (2M invocations/mês) cobre tranquilo.

---

## 7. Verificações Pós-Deploy

### Checklist

```bash
# 1. Rules deployadas?
firebase deploy --only firestore:rules

# 2. Índices criados?
firebase deploy --only firestore:indexes
# (esperar status = "enabled" no console)

# 3. Functions deployadas?
firebase deploy --only functions

# 4. Seu user é admin?
node scripts/check-platform-admin.mjs seu@email.com

# 5. Health check geral
node scripts/health-check-arena-v3.mjs
```

### Teste manual no app

1. Login com seu user
2. Acesse `/arenas/{id}/gerir/modulos` — deve listar 50+ módulos
3. Ligue `arena_modules` (master) + 1 sub-flag
4. Ative a sub-flag em uma arena
5. Acesse a rota correspondente (ex: `/arenas/{id}/gerir/open-match`)
6. Se aparecer "Módulo indisponível", reverifique as 4 condições

---

## 8. Troubleshooting

### "permission-denied" ao acessar

- Você não é `platform_admin` E não é gestor de arena
- Rode: `node scripts/check-platform-admin.mjs seu@email.com`

### "FAILED_PRECONDITION" em queries

- Falta índice composto
- Console do navegador mostra link direto para criar
- Ou rode: `firebase deploy --only firestore:indexes`

### Módulo não aparece mesmo ligado

Verifique as 4 condições:
1. `feature_flags/arena_modules` = true
2. `feature_flags/arena_module_{família}` = true
3. `feature_flags/arena_module_{família}_{sub}` = true
4. `arena_module_states/{arenaId}_{moduleId}.enabled` = true

### Custom claim não funciona após setar

- O JWT é cacheado. Force logout/login no app.
- Ou, no console: Authentication → Users → seu user → ⋯ → Refresh token.

### Cloud Function não dispara

- Verifique logs: `firebase functions:log --follow`
- Verifique timezone (estão em America/Sao_Paulo)
- Teste manualmente: `firebase functions:shell` → `expireStaleNotifications()`

### Erro "module not found" no app

- Service Worker cacheou versão antiga
- Bump SW version (procure por `sw-vN.js` no `public/`)
- Force reload: Ctrl+Shift+R

---

## 📞 Suporte

Problemas não cobertos aqui? Documente no `docs/ARENA_V3/25-TROUBLESHOOTING.md` (crie conforme necessário).

---

## 🗂️ Arquivos criados por este setup

```
firestore.rules                          (atualizado — 15 rules novas)
firestore.indexes.json                   (atualizado — 11 índices novos)
functions/index.js                       (atualizado — 4 functions novas)
scripts/migrate-arena-v3-flags.mjs       (migração de 50+ flags)
scripts/check-platform-admin.mjs         (verifica admin)
scripts/promote-platform-admin.mjs       (grant/revoke admin)
scripts/grant-arena-manager.mjs          (gestor de arena)
scripts/health-check-arena-v3.mjs        (health check geral)
docs/ARENA_V3/24-FIREBASE-SETUP.md       (este doc)
```

---

**Tudo pronto! Você só precisa rodar `firebase deploy` 3 vezes:**
```bash
firebase deploy --only firestore:rules,firestore:indexes,functions
```
