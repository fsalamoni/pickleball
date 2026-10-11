# `admin/` — Painel da plataforma

Painel exclusivo de `platform_admin` (`/admin/*`).

## Status
- **Páginas V2**: `V2AdminConsole` (`/admin/painel`, navegação lateral com
  busca; abas Torneios, Parceiros, Cadastros+Perfis, flags…), `V2AdminProfiles`
  (só embutido em Cadastros), `V2AdminOwnerDebug`, `V2AdminOwnerRestore`.
  `/admin/torneios`, `/admin/metricas`, `/admin/parceiros` e `/admin/perfis`
  redirecionam para a aba (Fase 3.4 do plano de UX, 2026-10-11)
- **Services**: `adminService`, `platformSettingsService` (feature flags)
- **Tests**: 30+

## Funcionalidades
- Arquivar/excluir/desarquivar torneios (status='cancelled' required)
- Métricas gerais
- Espaço de parceiros (logos, banners, links)
- **Feature flags console** (`/admin/console`) — 1-click on/off
- Profiles admin
- Bootstrap Arena V3 (executa migração, ativa sub-flags)
- Owner debug/restore (cuidado!)

## Hooks
```js
import { useAdminTournaments } from '@/modules/admin/hooks/useAdminTournaments';
import { usePlatformSettings } from '@/modules/admin/hooks/usePlatformSettings';
```

## Audit logs gerados
- `platform_archive_tournament`
- `platform_delete_tournament`
- `platform_unarchive_tournament`
- `feature_flag_changed`

## Onde achar mais
- `docs/06-MODULES.md` § admin
- `docs/01-AI-CONTEXT.md` §4 (papéis)
