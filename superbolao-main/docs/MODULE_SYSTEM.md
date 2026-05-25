# Sistema de Módulos — Bolão Copa 2026

## 1. Conceito

A plataforma é dividida em **módulos funcionais independentes**. Cada módulo:
- Contém toda a lógica relacionada a uma funcionalidade específica
- **NUNCA** importa código interno de outro módulo
- Só depende do **CORE** e de **bibliotecas externas**
- Expõe uma **interface pública** (hooks, componentes, serviços) para uso por outros módulos
- Pode ser **adicionado**, **removido** ou **substituído** sem quebrar a plataforma

---

## 2. Estrutura de um Módulo

```
src/modules/<module-name>/
├── index.js            ← Interface pública (exporta apenas o que outros módulos podem usar)
├── components/         ← Componentes React específicos do módulo
│   └── ...
├── hooks/              ← Hooks React (podem ser consumidos por outros módulos)
│   └── ...
├── services/           ← Serviços de dados (operações Firestore)
│   └── ...
├── domain/             ← Lógica de negócio específica do módulo
│   └── ...
├── types.js            ← Tipos e constantes do módulo
└── README.md           ← Documentação do módulo
```

### Exemplo: Módulo `pool`

```
src/modules/pool/
├── index.js            ← Exporta usePools, usePool, PoolCard, PoolDashboardTab, etc.
├── components/
│   ├── PoolCard.jsx
│   ├── PoolDashboardTab.jsx
│   ├── PoolLeaderboard.jsx
│   ├── PoolRulesTab.jsx
│   ├── PoolAdminTab.jsx
│   ├── BettingCard.jsx
│   ├── MatchBetRow.jsx
│   ├── DeadlineBadge.jsx
│   └── SpecialBetsForm.jsx
├── hooks/
│   ├── usePools.js
│   ├── usePool.js
│   ├── useMyMembership.js
│   └── usePoolLeaderboard.js
├── services/
│   └── poolsService.js
├── domain/
│   ├── poolSettings.js
│   └── types.js
└── README.md
```

---

## 3. Regras de Ouro (Enforced by Convention)

### 3.1 O que um módulo PODE fazer:
- ✅ Importar do CORE (`@/core/domain`, `@/core/config`, `@/core/lib`, `@/core/services`)
- ✅ Importar de bibliotecas externas (react, firebase, etc.)
- ✅ Importar de outros módulos APENAS via `index.js` (interface pública)
- ✅ Ter suas próprias dependências internas

### 3.2 O que um módulo NÃO PODE fazer:
- ❌ Importar arquivos internos de outro módulo (ex.: `../pool/components/PoolCard`)
- ❌ Modificar o CORE diretamente (deve propor alteração via PR)
- ❌ Acessar coleções do Firestore que não são de sua responsabilidade
- ❌ Criar dependências circulares

### 3.3 Interface Pública (index.js)

Cada módulo DEVE ter um `index.js` que exporta APENAS o que é seguro para consumo externo:

```javascript
// src/modules/pool/index.js

// Hooks públicos
export { useMyPools } from './hooks/usePools';
export { usePool } from './hooks/usePool';
export { useMyMembership } from './hooks/useMyMembership';
export { usePoolLeaderboard } from './hooks/usePoolLeaderboard';

// Componentes públicos
export { PoolCard } from './components/PoolCard';
export { PoolDashboardTab } from './components/PoolDashboardTab';
export { PoolLeaderboard } from './components/PoolLeaderboard';

// Constantes e tipos
export { POOL_TEMPLATE_CODES } from './domain/poolSettings';
```

---

## 4. Módulos Planejados

| Módulo | Responsabilidade | Depende de |
|--------|-----------------|------------|
| **auth** | Autenticação, perfil, roles, Google Sign-In | core |
| **pool** | Criação, ingresso, gestão de bolões, leaderboard | core, auth |
| **bets** | Palpites em partidas, palpites especiais (campeão/artilheiro) | core, auth, pool |
| **scoring** | Cálculo de pontuação, rankings, critérios de desempate | core |
| **tournament** | Torneio, fases, times, partidas, seed de dados | core |
| **admin** | Painel admin da plataforma (métricas, aprovações, jogos) | core, auth, pool |
| **notifications** | Sistema de notificações (in-app) | core, auth |

---

## 5. CORE — O Que É e O Que Não É

### 5.1 O CORE contém:
- `config/firebase.js` — Inicialização do Firebase
- `domain/scoringEngine.js` — Engine de pontuação (pura, sem dependências externas)
- `domain/types.js` — Tipos e constantes globais
- `lib/FirebaseAuthContext.jsx` — Contexto de autenticação
- `lib/logger.js` — Logger da plataforma
- `lib/utils.js` — Utilitários genéricos
- `services/baseService.js` — Serviços base (a ser criado na refatoração)

### 5.2 O CORE NÃO contém:
- Lógica específica de bolão, palpites, notificações, admin
- Componentes de UI específicos de funcionalidades
- Hooks de domínio específico

---

## 6. Como Adicionar um Novo Módulo

1. **Criar diretório** `src/modules/<nome>/`
2. **Criar estrutura mínima:** `index.js`, `components/`, `hooks/`, `services/`
3. **Implementar funcionalidade** dependendo apenas do CORE
4. **Criar `index.js`** com interface pública
5. **Atualizar `docs/MODULE_SYSTEM.md`** com informações do novo módulo
6. **Adicionar testes** (se aplicável)
7. **Atualizar `App.jsx`** para usar os novos componentes/hooks via interface pública

---

## 7. Comunicação Entre Módulos

### 7.1 Via Hooks Públicos
```javascript
// No módulo bets, consumindo hooks do módulo pool
import { useMyMembership } from '@/modules/pool';

function BettingCard() {
  const { membership } = useMyMembership(poolId);
  // ...
}
```

### 7.2 Via Contextos Globais (CORE)
```javascript
// Qualquer módulo pode usar o contexto de auth
import { useAuth } from '@/core/lib/FirebaseAuthContext';
```

### 7.3 Via Serviços Core
```javascript
// Módulos usam serviços base do core
import { db } from '@/core/config/firebase';
import { baseService } from '@/core/services/baseService';
```

### 7.4 Eventos (futuro)
Para comunicação assíncrona entre módulos, podemos implementar um sistema de eventos:
```javascript
import { eventBus } from '@/core/lib/eventBus';

// Módulo scoring emite evento
eventBus.emit('score:updated', { poolId, userId, points });

// Módulo notifications escuta
eventBus.on('score:updated', ({ poolId, userId, points }) => {
  // criar notificação
});
```

---

## 8. Testes

- **CORE:** Testes unitários obrigatórios (engine de pontuação já tem)
- **Módulos:** Testes de integração para serviços (Firestore emulator)
- **Componentes:** Testes de renderização (Vitest + jsdom)

---

> **Última atualização:** Março 2025
> **Versão:** 1.0.0