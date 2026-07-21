# Roteamento e UX — Arena V3

> Mapa completo de rotas, com gates de permissão e visibilidade. **Nenhuma rota existente é alterada.**

## Estrutura

### Páginas públicas (atleta vê)

```
/arenas                                     # diretório (já existe, mantém)
/arenas/:arenaId                            # detalhe público (já existe, refatora)
```

### Páginas de gestão (gestor da arena vê)

```
/arenas/:arenaId/gerir                      # hub admin (já existe, refatora para usar tabs)
/arenas/:arenaId/gerir/modulos              # NOVO — ligar/desligar módulos
/arenas/:arenaId/gerir/configuracoes        # NOVO — settings operacionais, branding
/arenas/:arenaId/gerir/matchmaking          # sprint 1
/arenas/:arenaId/gerir/membros              # sprint 2
/arenas/:arenaId/gerir/pdv                  # sprint 3
/arenas/:arenaId/gerir/aulas                # sprint 4
/arenas/:arenaId/gerir/torneios             # sprint 5
/arenas/:arenaId/gerir/marketing            # sprint 6
/arenas/:arenaId/gerir/operacoes            # sprint 7
/arenas/:arenaId/gerir/equipe               # sprint 7
/arenas/:arenaId/gerir/bi                   # sprint 6 — BI
```

### Páginas do atleta na arena (atleta vê, se arena habilitou)

```
/arenas/:arenaId/open-match                 # sprint 1 — vagas abertas
/arenas/:arenaId/matchmaking                # sprint 1 — encontrar parceiro
/arenas/:arenaId/membros                    # sprint 2 — minha conta na arena
/arenas/:arenaId/loja                       # sprint 3 — PDV
/arenas/:arenaId/aulas                      # sprint 4 — aulas
/arenas/:arenaId/torneios                   # sprint 5 — torneios da arena
/arenas/:arenaId/ladder                     # sprint 5 — ladder
```

### Páginas da plataforma (platform admin)

```
/admin/painel/arenas                        # NOVO — gestão global de arenas
/admin/painel/arenas/flags                  # NOVO — flags dos módulos
```

## Página pública da arena (refatoração)

### Antes (V2 atual)
- 1 página monolítica com tudo: info, reviews, fotos, gestor
- Atleta vê tudo o que existe
- Gestor tem que ir pra `/gerir` separado

### Depois (V3)
- **Público** (`/arenas/:id`): o que a arena decidiu mostrar
  - Cabeçalho: nome, foto, endereço, contato, horário
  - Tabs (só as que a arena habilitou):
    - **Sobre** (sempre)
    - **Quadras** (sempre — court_count + fotos)
    - **Reservar** (sempre — fluxo de booking)
    - **Open Match** (se flag + módulo)
    - **Aulas** (se flag + módulo)
    - **Torneios** (se flag + módulo)
    - **Produtos** (se flag + módulo + show_in_public)
    - **Reviews** (se arena.visibility.show_reviews = true)
- **Admin** (`/arenas/:id/gerir`): hub admin
  - Sidebar com módulos habilitados
  - Dashboard: ocupação, receita, NPS
  - Configurações: settings, branding, módulos
  - Cada módulo tem sua sub-página

## Layout do Hub Admin (V3)

```
┌──────────────────────────────────────────────────────┐
│ 🏠 Arena X · Gerenciar                👤 Flávio    │
├──────────┬───────────────────────────────────────────┤
│ Visão    │  Dashboard                                │
│ geral    │  ┌────────┐ ┌────────┐ ┌────────┐         │
│          │  │ Receita│ │Ocupação│ │ NPS    │         │
│ Quadras  │  │ R$ 5k  │ │  72%   │ │  8.5   │         │
│ Reservas │  └────────┘ └────────┘ └────────┘         │
│ Aulas    │  ...                                      │
│ Membros  │                                           │
│ Marketing│                                           │
│ PDV      │                                           │
│ Equipe   │                                           │
│ BI       │                                           │
│ Settings │                                           │
└──────────┴───────────────────────────────────────────┘
```

## Sidebar dinâmica

A sidebar do admin **só mostra** os módulos que:
1. Flag global está ON
2. Sub-flag específica está ON
3. Arena habilitou

```jsx
const MODULE_NAV = [
  { id: 'overview', label: 'Visão geral', icon: 'LayoutDashboard', alwaysOn: true },
  { id: 'courts', label: 'Quadras', icon: 'Square', alwaysOn: true },
  { id: 'bookings', label: 'Reservas', icon: 'CalendarCheck', alwaysOn: true },
  { id: 'matchmaking', label: 'Matchmaking', icon: 'Users', requiresModule: 'matchmaking' },
  { id: 'members', label: 'Membros', icon: 'UserCheck', requiresModule: 'members' },
  { id: 'pdv', label: 'PDV', icon: 'ShoppingCart', requiresModule: 'pdv' },
  { id: 'classes', label: 'Aulas', icon: 'GraduationCap', requiresModule: 'classes' },
  { id: 'leagues', label: 'Torneios', icon: 'Trophy', requiresModule: 'leagues' },
  { id: 'marketing', label: 'Marketing', icon: 'Megaphone', requiresModule: 'marketing' },
  { id: 'operations', label: 'Operações', icon: 'Wrench', requiresModule: 'operations' },
  { id: 'staff', label: 'Equipe', icon: 'UserCog', requiresModule: 'operations' },
  { id: 'bi', label: 'BI', icon: 'BarChart3', alwaysOn: true },
  { id: 'settings', label: 'Configurações', icon: 'Settings', alwaysOn: true },
  { id: 'modules', label: 'Módulos', icon: 'Puzzle', alwaysOn: true, platformAdminOnly: true },
];
```

## Permissões

### Papéis

| Papel | Pode ver público | Pode ver admin | Pode editar |
|---|---|---|---|
| Anônimo (não logado) | ✅ (do que a arena publicou) | ❌ | ❌ |
| Atleta comum | ✅ (do que a arena publicou) | ❌ | ❌ |
| Gestor da arena | ✅ | ✅ (do que habilitou) | ✅ (do que habilitou) |
| Platform admin | ✅ (tudo) | ✅ (tudo) | ✅ (tudo) |

### Função pura de gate

```js
function canViewArenaAdmin(user, arena, moduleId, moduleStates, platformFlags) {
  if (!user) return false;
  if (isPlatformAdmin(user)) return true;
  
  // Gestor da arena?
  if (!isArenaManager(user, arena)) return false;
  
  // Módulo existe e está habilitado?
  if (!canArenaUseModule(arena, moduleId, moduleStates, platformFlags)) return false;
  
  return true;
}
```

## Componentes compartilhados

- `<ArenaPublicPage arenaId />` — wrapper da página pública, esconde tudo o que a arena não habilitou
- `<ArenaAdminPage arenaId moduleId />` — wrapper da página admin, com sidebar e topbar
- `<ArenaModuleGuard arenaId moduleId>` — HOC/hook que retorna 404 se arena não tem o módulo
- `<ArenaPermissionGuard arenaId permission>` — gate por permissão específica (não só módulo)

## Performance

- Code splitting: cada sub-página é `lazy()`
- Pré-fetch: ao entrar em `/arenas/:id`, já carrega `arena_settings` e `arena_module_states`
- Cache: `useArenaSettings` e `useArenaModuleStates` usam React Query com `staleTime: 60s`

## Acessibilidade

- Keyboard navigation completa
- ARIA labels em todos os botões de ação
- Contraste AA mínimo
- Leitor de tela: anunciar módulo desabilitado como "Recurso indisponível" (não erro)
