# Catálogo de Módulos Opt-in por Arena

> Cada arena pode ligar/desligar módulos individualmente. Por padrão, **TODOS desligados**. A plataforma (admin master) pode forçar on/off globalmente via flag master.

## Flag master

| Flag | Tipo | Default | Descrição |
|---|---|---|---|
| `arena_modules` | Global (master) | OFF | Mata-switch. Se OFF, TODOS os módulos ficam ocultos mesmo se a arena habilitou. |

## 11 famílias de módulos

### 1. MATCHMAKING (`arena_module_matchmaking`)

| Sub-flag | Default | O que faz |
|---|---|---|
| `arena_module_matchmaking_open_match` | OFF | Open Match: arena publica horário com vagas ociosas; atletas do nível se inscrevem |
| `arena_module_matchmaking_partner_finder` | OFF | Matchmaking: atleta procura parceiro/adversário por nível + cidade |
| `arena_module_matchmaking_waitlist` | OFF | Lista de espera: quando horário lota, entra na fila; notifica ao liberar |

### 2. MEMBROS (`arena_module_members`)

| Sub-flag | Default | O que faz |
|---|---|---|
| `arena_module_members_tiers` | OFF | Membros com tiers (Bronze/Prata/Ouro/Platina) com benefícios |
| `arena_module_members_packages` | OFF | Pacotes pré-pagos (10h por R$ X, vence em 60 dias) |
| `arena_module_members_subscription` | OFF | Mensalidades recorrentes (Pix automático) |
| `arena_module_members_wallet` | OFF | Wallet do atleta na arena (saldo, cashback) |

### 3. PDV (`arena_module_pdv`)

| Sub-flag | Default | O que faz |
|---|---|---|
| `arena_module_pdv_catalog` | OFF | Catálogo de produtos (água, raquete, grip, vestuário) |
| `arena_module_pdv_pix_native` | OFF | Pix nativo: QR gerado no app, sem maquininha |
| `arena_module_pdv_split` | OFF | Split payment: divide entre 2-4 jogadores |

### 4. AULAS (`arena_module_classes`)

| Sub-flag | Default | O que faz |
|---|---|---|
| `arena_module_classes_catalog` | OFF | Catálogo de instrutores (perfil, vídeo, valor) |
| `arena_module_classes_packages` | OFF | Pacotes de aula (4 aulas por R$X) |
| `arena_module_classes_marketplace` | OFF | Marketplace: instrutores autônomos se cadastram |

### 5. TORNEIOS INTERNOS (`arena_module_leagues`)

| Sub-flag | Default | O que faz |
|---|---|---|
| `arena_module_leagues_internal` | OFF | Torneios só da arena (não aparece no feed público de torneios) |
| `arena_module_leagues_ladder` | OFF | Ladder semanal com pódio e rating |
| `arena_module_leagues_open_play` | OFF | Sessões de Open Play (categoria + dia) |
| `arena_module_leagues_prizing` | OFF | Premiação (R$, brinde, crédito na wallet) |

### 6. MARKETING & FIDELIDADE (`arena_module_marketing`)

| Sub-flag | Default | O que faz |
|---|---|---|
| `arena_module_marketing_campaigns` | OFF | E-mail, SMS, WhatsApp, push segmentados |
| `arena_module_marketing_loyalty` | OFF | Programa de pontos (10 reservas = 1h grátis) |
| `arena_module_marketing_coupons` | OFF | Cupons e promoções (Carnaval, Black Friday) |
| `arena_module_marketing_referral` | OFF | Indique e ganhe (R$ X pra cada lado) |
| `arena_module_marketing_nps` | OFF | NPS automatizado pós-visita |

### 7. OPERAÇÕES (`arena_module_operations`)

| Sub-flag | Default | O que faz |
|---|---|---|
| `arena_module_operations_checklist` | OFF | Checklist de abertura/fechamento (foto de tarefa) |
| `arena_module_operations_maintenance` | OFF | Manutenção preventiva (troca de rede, revisão) |
| `arena_module_operations_inventory` | OFF | Estoque com alerta de mínimo |
| `arena_module_operations_staff` | OFF | Equipe: turno, comissão, folha |

### 8. IOT (`arena_module_iot`)

| Sub-flag | Default | O que faz |
|---|---|---|
| `arena_module_iot_qr_kiosk` | OFF | Totem QR de check-in (entrada da arena) |
| `arena_module_iot_lighting` | OFF | Controle de iluminação por app |
| `arena_module_iot_sensors` | OFF | Sensor de presença (conta uso real vs reservado) |
| `arena_module_iot_video_replay` | OFF | Câmeras + IA para replay do jogo |

### 9. MULTI-UNIDADE (`arena_module_multi_unit`)

| Sub-flag | Default | O que faz |
|---|---|---|
| `arena_module_multi_unit_network` | OFF | Várias arenas na mesma rede/franqueador |
| `arena_module_multi_unit_consolidated_bi` | OFF | BI consolidado da rede |
| `arena_module_multi_unit_cross_booking` | OFF | Membro usa qualquer unidade da rede |

### 10. WHITE LABEL (`arena_module_white_label`)

| Sub-flag | Default | O que faz |
|---|---|---|
| `arena_module_white_label_branding` | OFF | Cores e logo customizados por arena |
| `arena_module_white_label_domain` | OFF | Domínio próprio (app.minhaarena.com.br) |
| `arena_module_white_label_app` | OFF | App próprio da arena (white label) |

### 11. AI (`arena_module_ai`)

| Sub-flag | Default | O que faz |
|---|---|---|
| `arena_module_ai_pricing` | OFF | Dynamic pricing (tarifa por demanda/horário/clima) |
| `arena_module_ai_matchmaking` | OFF | Smart matchmaking com ML |
| `arena_module_ai_forecast` | OFF | Previsão de demanda, churn, receita |

---

## Estado por arena

### Coleção `arena_module_states`

Doc id: `{arenaId}_{moduleId}` (determinístico)

Schema:
```js
{
  id: 'arena_123_matchmaking',
  arena_id: 'arena_123',
  module_id: 'matchmaking',        // ver ARENA_MODULE_ID
  enabled: true,                   // arena habilitou?
  enabled_at: Timestamp,           // quando ligou
  enabled_by: 'uid_xxx',           // quem ligou
  config: {                         // config específica do módulo
    // ex: matchmaking → { min_level_diff: 0.5, max_level_diff: 1.5 }
  },
  created_at: Timestamp,
  updated_at: Timestamp,
}
```

## Resolução final (gate logic)

```js
function canArenaUseModule(arena, moduleId, platformFlags) {
  // 1. Master switch
  if (!platformFlags.arena_modules) return false;
  // 2. Sub-flag global
  const subFlagKey = `arena_module_${moduleId}`;
  if (!platformFlags[subFlagKey]) return false;
  // 3. Arena habilitou?
  const state = getArenaModuleState(arena.id, moduleId);
  return state?.enabled === true;
}
```
