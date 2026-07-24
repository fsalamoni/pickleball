# `admin/` — Painel da plataforma

Painel exclusivo de `platform_admin` (`/admin/*`).

## Status
- **Páginas V2**: `V2AdminTournaments` (arquivar/excluir/desarquivar),
  `V2AdminMetrics`, `V2AdminPartners`, `V2AdminConsole` (feature flags
  1-click), `V2AdminProfiles`, `V2AdminBootstrap`, `V2AdminOwnerDebug`,
  `V2AdminOwnerRestore`
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
