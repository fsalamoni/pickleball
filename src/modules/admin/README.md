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
seção ativa abre as abas, e tocar nela de novo recolhe e reabre as abas sem trocar de
aba (`AdminConsoleNav`; recolhida, volta a abrir quando a aba muda). **O id de cada aba é contrato** (links, avisos, dicas).
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
  `admin_access_logs` (hash, nunca o valor). O registro é INTERNO (decisão do
  dono, 2026-10-11): o titular não é avisado, não vê o registro e a regra só
  deixa o admin ler — um aviso "o suporte acessou seus dados" soaria como
  fragilidade de segurança. Paridade cliente×servidor com teste.
- **Aviso em massa** (Divulgação → Aviso em massa): `AdminBroadcastTab` com o
  público das campanhas da plataforma (`platformRecipients`, contado antes;
  conta oculta/suspensa/bloqueada fora), `notifyUsers` + auditoria
  `admin_broadcast_sent`. Zero coleção.

## Funções no ar (2026-10-23)

Sistema → Diagnóstico abre com o cartão **"Funções no ar"**
(`components/FunctionsHealthCard.jsx`, domínio `domain/functionsHealth.js`,
hook `useFunctionsHealth`). Ele lê `platform_settings/functions_health`, que a
vigilância (a cada 30 min) e o deploy gravam por `scripts/functions-health.cjs`:
quantas funções o código exporta × quantas estão publicadas, os nomes que
faltam, e se o último deploy das funções deu certo (com a linha do erro e
quando deu certo pela última vez). Do #315 ao #321 esse deploy falhou calado.
Sem conferência há mais de 90 min, o cartão diz que a vigilância parou;
leitura que falha é dita, nunca "tudo publicado". Guarda em
`src/core/guards/funcoesNoAr.test.js`.

## Hooks
```js
import { useAllPlatformUsers, useDeleteAccounts, useSetAccountStatus } from '@/modules/admin/hooks/usePlatformUsers';
// Sem hook próprio: o console chama o serviço e o provider das flags.
import { listAllTournaments } from '@/modules/admin/services/adminService';
import { setFeatureFlag } from '@/core/services/platformSettingsService'; // platform_settings/global
```

## Audit logs gerados
- `platform_archive_tournament`
- `platform_delete_tournament`
- `platform_unarchive_tournament`
- `feature_flag_changed`
- `admin_account_suspended` / `admin_account_blocked` / `admin_account_reactivated` (servidor)
- `admin_broadcast_sent`
- `admin_profile_reminder_sent` (pedido de completar o cadastro; um registro por lote de 400 uids — é o que a lista lê para "pedido enviado em…")
- `admin_user_records_exported` (planilha de Cadastros, sem contato)

## Cadastros para milhares de contas (2026-10-29)
Panorama, filtros que se somam, ordem, paginação 20/50/100 e o recorte na URL:
`domain/userRecordsView.js` (puro, com teste). Pedido de completar o cadastro:
`services/profileReminderService.js` + `useProfileReminderLogs`/`useSendProfileReminder`.
Detalhes em `docs/20-SEGURANCA-E-PRIVACIDADE/18-CADASTROS-ADMIN.md` § Gerir a base.

## Onde achar mais
- `docs/06-MODULES.md` § admin
- `docs/01-AI-CONTEXT.md` §4 (papéis)
