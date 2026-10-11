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

## Navegação do Painel admin (2026-10-11)
Nove seções por tarefa (Hoje · Pessoas · Torneios · Arenas · Treino · Gamificação ·
Divulgação · Funcionalidades · Sistema) em `SECTIONS` (`V2AdminConsole.jsx`); só a
seção ativa abre as abas. **O id de cada aba é contrato** (links, avisos, dicas).
"Precisa de você" (`domain/adminInbox.js` + `useAdminInbox`) junta as filas que já
existem e põe o selo na barra; fonte que não respondeu é "desconhecida", nunca zero.
Fila nova que espera decisão do admin entra em `buildInbox`. Branding e Conteúdo
saíram (nada lia o que gravavam).

## Suspender/bloquear, acesso de suporte e aviso em massa (2026-10-11)
- **Suspender · Bloquear · Reativar** (Cadastros): `domain/accountStatus.js` decide
  a ação e valida; `services/accountStatusService.js` chama `adminSetAccountStatus`
  (`functions/accountStatus.js`: desliga o login no Auth, revoga tokens, grava
  `users.account_status*`, audita). As três portas da exclusão valem (nunca a
  própria conta, outro admin, e-mail de dono). Suspensão vencida entra em
  "Precisa de você" — **nada reativa sozinho**. `FirebaseAuthContext` desloga a
  conta fechada com o motivo.
- **Acesso de suporte**: a ficha abre mascarada (`domain/supportAccess.js`,
  `maskValue`); "Revelar dados de contato" pede categoria + motivo ≥ 20 e passa
  por `adminSupportReveal` (`functions/supportAccess.js`), que grava
  `admin_access_logs` (hash, nunca o valor) e avisa o titular; a pessoa vê em
  Configurações → "Acessos do suporte" (`SupportAccessCard`). Paridade
  cliente×servidor com teste.
- **Aviso em massa** (Divulgação → Aviso em massa): `AdminBroadcastTab` com o
  público das campanhas da plataforma (`platformRecipients`, contado antes;
  conta oculta/suspensa/bloqueada fora), `notifyUsers` + auditoria
  `admin_broadcast_sent`. Zero coleção.

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
- `admin_account_suspended` / `admin_account_blocked` / `admin_account_reactivated` (servidor)
- `admin_broadcast_sent`

## Onde achar mais
- `docs/06-MODULES.md` § admin
- `docs/01-AI-CONTEXT.md` §4 (papéis)
