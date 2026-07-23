# Sprint 2 — MEMBROS & PACOTES

**Status**: 🚧 Em andamento

**Pré-requisito**: Sprint 0 e 1 completos.

## Flags

- `arena_module_members` (pai)
- `arena_module_members_tiers` (filho)
- `arena_module_members_packages` (filho)
- `arena_module_members_subscription` (filho)
- `arena_module_members_wallet` (filho)

**Todas desligadas por padrão.**

## Funcionalidades

### Member Tiers
- Arena define tiers (ex: Bronze/Prata/Ouro/Platina)
- Cada tier tem: nome, cor, pontos mínimos, desconto %, benefícios
- Atleta acumula pontos (1 ponto por R$ gasto)
- Tier aparece no perfil do atleta na arena

### Packages (Pacotes pré-pagos)
- Arena vende pacotes: "10 horas por R$ 250, vence em 60 dias"
- Atleta compra e saldo fica no wallet
- Ao reservar, sistema consome horas do pacote
- Histórico de consumo

### Subscription (Mensalidades)
- Arena cobra mensalidade recorrente
- Pix automático (sandbox: só registra o intent)
- Atleta pode pausar/cancelar
- Histórico de faturas

### Wallet
- Saldo do atleta na arena
- Cashback progressivo
- Pontos de fidelidade
- Histórico de transações

## Novas coleções

- `arena_members/{arenaId_uid}` — relação atleta-arena com tier, status
- `arena_packages/{pkgId}` — pacotes pré-pagos
- `arena_wallets/{arenaId_uid}` — saldo do atleta
- `arena_subscriptions/{subId}` — mensalidades
- `arena_tier_configs/{arenaId}` — config de tiers da arena
