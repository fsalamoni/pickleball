# Arena V3 — Índice da Documentação

> Implementação de 1000+ sugestões para a seção de **Gestão de Arenas** do PickleRush, organizada em sprints progressivas.

## Arquitetura em camadas

```
┌────────────────────────────────────────────────────────────┐
│  Páginas V2 (V2ArenaPublic + V2ArenaAdmin + sub-páginas)   │
│  - públicas: o que a arena habilitou                        │
│  - admin: tudo, com permissões                             │
└────────────────────────────────────────────────────────────┘
                            ↓
┌────────────────────────────────────────────────────────────┐
│  Hooks React Query (modules/arenas/hooks/*)                 │
│  - useArenaSettings, useArenaModules, useArenaMembers...   │
└────────────────────────────────────────────────────────────┘
                            ↓
┌────────────────────────────────────────────────────────────┐
│  Services Firestore (modules/arenas/services/*)            │
│  - settingsService, modulesService, membersService...      │
└────────────────────────────────────────────────────────────┘
                            ↓
┌────────────────────────────────────────────────────────────┐
│  Domain puro (modules/arenas/domain/*) — testável          │
│  - normalizeArenaSettings, canArenaUseModule...            │
└────────────────────────────────────────────────────────────┘
                            ↓
┌────────────────────────────────────────────────────────────┐
│  Firestore + Rules                                          │
│  - arenas (extendido, sem breaking) + novas coleções       │
└────────────────────────────────────────────────────────────┘
```

## Documentos

| # | Arquivo | O quê |
|---|---------|-------|
| 00 | `00-INDEX.md` | Este arquivo |
| 01 | `01-PLAN.md` | Roadmap de 12 sprints |
| 02 | `02-FOUNDATION.md` | Sprint 0 — Fundação |
| 03 | `03-PROGRESS.md` | Status de cada sprint |
| 10 | `10-MODULES-CATALOG.md` | Catálogo de módulos opt-in (51+) |
| 11 | `11-DATA-MODEL.md` | Schema Firestore completo |
| 12 | `12-FEATURE-FLAGS.md` | Mapeamento flag → módulo |
| 13 | `13-ROUTING-UX.md` | Mapa de rotas + UX |
| 14 | `14-FIRESTORE-RULES.md` | Regras para novas coleções |
| 15 | `15-BUSINESS-LOGIC.md` | Domínio puro (regras) |
| 26 | `26-ARENA-V3-COMPLETE-REFERENCE.md` | Guia rápido de referência (status atual) |
| 20 | `20-SPRINT-1-MATCHMAKING.md` | Open Match + Matchmaking + Waitlist |
| 21 | `21-SPRINT-2-MEMBERS-PACKAGES.md` | Membros + Pacotes + Wallet |
| 22 | `22-SPRINT-3-PDV-PAYMENTS.md` | PDV + Pagamentos |
| 23 | `23-SPRINT-4-CLASSES-COACHES.md` | Aulas + Instrutores |
| 24 | `24-SPRINT-5-INTERNAL-LEAGUES.md` | Torneios internos + Ladder |
| 25 | `25-SPRINT-6-MARKETING-LOYALTY.md` | BI + Marketing + Fidelidade |
| 26 | `26-SPRINT-7-OPERATIONS.md` | Operações + Manutenção + Equipe |
| 27 | `27-SPRINT-8-IOT-INTEGRATIONS.md` | QR Totem + IoT + Integrações |
| 28 | `28-SPRINT-9-MULTI-UNIT.md` | Rede multi-unidade |
| 29 | `29-SPRINT-10-WHITE-LABEL.md` | White label + Personalização |

## Princípios (NÃO QUEBRAR)

1. **Nenhuma feature quebra a existente** — backward compat total
2. **Flags SEMPRE desligadas por padrão** — opt-in
3. **Por arena + global** — duas camadas de flag
4. **Público vê só o que a arena habilitou** — UI gated por `arena.modules.X`
5. **Admin da arena tem acesso a tudo que habilitou** — gated por role
6. **Platform admin tem acesso a tudo** — bypass
7. **Sem campos obrigatórios novos no doc arena** — tudo é opt-in
8. **Cada sprint é commit atômico + testes + docs**
9. **Domínio puro testável** — nada de lógica em componentes
10. **LGPD sempre respeitado** — consent + audit + export
