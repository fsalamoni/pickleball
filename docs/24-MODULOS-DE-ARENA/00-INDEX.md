# Módulos adicionais da arena — guia-mestre

> **O que é**: o mecanismo de três camadas que permite (1) a plataforma
> desenvolver funcionalidades extras de arena, (2) o admin da plataforma
> LIBERAR cada uma para as arenas escolherem, e (3) cada arena ATIVAR para si
> e para os seus usuários as que quiser.
>
> Substitui e conserta o que estava documentado em `docs/10-ARENA-V3/`.
> Aquele conjunto de documentos descreve o desenho original (bom) e afirma
> um estado de entrega (**100% deployado**) que **não corresponde ao código**.
> Ver §1.

---

## 1. Ponto de partida: o que existia (e por que não funcionava)

Levantamento feito em 2026-09-13 sobre `main`. O esqueleto da Arena V3 existe
desde 2026-07-21, mas **nenhum módulo estava acessível a ninguém**. Três causas,
todas verificadas no código:

| # | Achado | Prova |
|---|---|---|
| 1 | As 51 flags `arena_modules` / `arena_module_*` foram **removidas** de `src/core/featureFlags.js` na "Onda O" (conversão de flags em código). `normalizeFeatureFlags` só devolve chaves conhecidas ⇒ `flags.arena_modules` é sempre `false`. | `canArenaUseModule` começa com `if (!platformFlags.arena_modules) return false;` — **todo módulo resolvia para OFF, sempre**. |
| 2 | A aba "Funcionalidades → Flags por assunto" tem um grupo "Arena V3 (módulos)" que **nunca renderiza nada**: `bucketAllFlags()` itera `FEATURE_FLAG`, que não tem mais nenhuma chave de arena. | `src/core/featureFlagGroups.js` + `V2AdminConsole.jsx` |
| 3 | A página de módulos da arena tinha o mapa de flags **escrito na mão como objeto vazio** (`const flags = {};`), então toda linha exibia "a plataforma ainda não ativou este módulo". | `src/v2/pages/V2ArenaModules.jsx:55` |

Além disso, as telas entregues eram **maquetes**: previsão de demanda com série
fixa no código (`forecastDemand([10, 20, 25, ...])`), formulário de branding que
não carrega o valor atual, e `useCanArenaUseModule(arenaId, 'iot_devices')` —
um id que **não existe** no catálogo.

E as regras do Firestore das 28 coleções V3 tinham uma família de defeitos reais:

| Regra | Defeito | Efeito |
|---|---|---|
| `arena_coaches`, `arena_classes`, `arena_coupons`, `arena_campaigns`, `arena_checklists`, `arena_devices`, `arena_matches`, `arena_ladders` | `delete` condicionado a `request.resource.data.arena_id` | Em `delete` **não existe** `request.resource` ⇒ **ninguém consegue apagar nada** |
| `arena_nps_responses`, `arena_maintenance_orders` | `read` condicionado a `request.resource.data.arena_id` | **Ninguém consegue ler** — a arena nunca veria o próprio NPS |
| `arena_sales`, `arena_payments` | `create: if isAuthed()` | Qualquer conta logada forja uma venda/pagamento em **qualquer** arena, com qualquer valor |
| `arena_referrals` | `create: if isAuthed()` | Qualquer conta cria indicação apontando **outra pessoa** como indicador |
| `arena_class_bookings` | `update/delete` só do aluno | A arena **não consegue** cancelar uma aula |

Conclusão: o chassi precisava ser **refeito e ligado**, não continuado.

---

## 2. As três camadas (o pedido, traduzido)

```
┌─ CAMADA 1 · PLATAFORMA ────────────────────────────────────────────┐
│ Painel admin → Funcionalidades → "Módulos de arena"                │
│ Para cada módulo: LIBERAR ou não; e como (opcional / obrigatório). │
│ Guardado em platform_settings/arena_modules (documento único).     │
│ Chave-mestra: feature flag `arena_modules` (default OFF).          │
└────────────────────────────────────────────────────────────────────┘
                              ↓ só o que foi liberado aparece abaixo
┌─ CAMADA 2 · ARENA ─────────────────────────────────────────────────┐
│ Gestão da arena → Configurações → "Módulos"                        │
│ A arena LIGA para si o que a plataforma liberou, e configura.      │
│ Guardado em arena_module_states/{arenaId}_{moduleId} (já existia). │
└────────────────────────────────────────────────────────────────────┘
                              ↓ só o que a arena ligou aparece abaixo
┌─ CAMADA 3 · USO ───────────────────────────────────────────────────┐
│ Atleta, professor e equipe da arena veem a funcionalidade.         │
│ Um hook só (useArenaModules) e um guarda (<ArenaModuleGuard>).     │
└────────────────────────────────────────────────────────────────────┘
```

**São coisas diferentes, de propósito.** Desenvolver ≠ liberar ≠ ativar.
Um módulo pode estar pronto no código e não liberado; liberado e não ativado.

### Impacto no banco

- **Camada 1**: `platform_settings/arena_modules` — um documento novo numa
  coleção que **já tem regra** (`match /platform_settings/{docId}`: leitura
  pública, escrita só do admin). **Zero regra nova, zero índice novo.**
- **Camada 2**: `arena_module_states` — coleção que **já existe**, com regra
  que já existe. Nenhum campo obrigatório novo.
- **Camada 3**: leitura pura.

---

## 3. Onde está cada coisa

| O quê | Arquivo |
|---|---|
| Catálogo (ids, metadados, público-alvo, dependências, status) | `src/modules/arenas/domain/modules.js` |
| Gate (resolve se o módulo vale para a arena) | `src/modules/arenas/domain/moduleAccess.js` |
| Camada plataforma (serviço) | `src/modules/arenas/services/platformModulesService.js` |
| Camada plataforma (UI) | `src/v2/components/admin/AdminArenaModulesTab.jsx` |
| Camada arena (UI) | `src/v2/components/arenas/ArenaModulesPanel.jsx` |
| Hook único de consumo | `src/modules/arenas/hooks/useArenaModules.js` |
| Guarda de UI | `src/v2/components/arenas/ArenaModuleGuard.jsx` |

## 4. Regras de ouro para quem for mexer

1. **O id do módulo é contrato de banco.** `arena_module_states` guarda
   `module_id`. Nunca renomeie um id existente; só acrescente.
2. **Nada de flag nova por módulo.** A `FEATURE_FLAG` continua sendo só para
   liga/desliga de CÓDIGO. A liberação por módulo mora no documento da camada 1.
   Colocar 45 módulos em `FEATURE_FLAG` estouraria a contagem "X ativas de Y"
   e misturaria dois conceitos.
3. **Uma consulta por arena, não uma por módulo.** `useArenaModules(arenaId)`
   lê os estados UMA vez e responde a todos os módulos em memória. Nunca
   chame um hook por módulo dentro de um `map`.
4. **Módulo desligado não é erro.** É ausência: a aba não existe, a seção some,
   a rota redireciona. Nunca renderize desabilitado.
5. **Segurança não depende de módulo.** A regra do Firestore é a única defesa;
   o módulo governa o que se MOSTRA. Uma coleção nunca fica aberta "porque o
   módulo está ligado".

## 5. Estado das ondas

| Onda | Tema | Status |
|---|---|---|
| 0 | Chassi (3 camadas, catálogo, gate, correção das regras) | ✅ |
| 1 | Matchmaking (vagas abertas, parceiro, fila de espera) | ✅ `01-MATCHMAKING.md` |
| 2 | Membros (níveis, pacotes, mensalidade, carteira) | ✅ `02-MEMBROS.md` |
| 3 | Marketing e fidelidade (cupom, pontos, indicação, NPS, campanha) | ✅ `03-MARKETING.md` |
| 4 | Operações (checklist, manutenção, estoque, equipe) | ✅ `04-OPERACOES.md` |
| 5 | Aulas e torneios internos | ✅ `05-AULAS.md` + `06-TORNEIOS-INTERNOS.md` |
| 6 | PDV, rede multi-unidade, branding e inteligência | ⏳ |

## 6. O que a plataforma NÃO consegue entregar sozinha

Honestidade de engenharia — três módulos do catálogo original dependem de
coisas fora do software:

| Módulo | Por quê |
|---|---|
| `iot_lighting`, `iot_sensors`, `iot_video_replay` | Exigem hardware do fabricante e um endpoint que o PickleRush não controla. Entregamos o **cadastro de dispositivos, o vínculo com a quadra e o registro de eventos**; o comando em si depende de integração do fornecedor. |
| `white_label_domain` | Domínio próprio é configuração de DNS + hosting, não código de aplicação. Entregamos o campo e o passo a passo. |
| `white_label_app` | App nativo próprio é outro produto, não uma flag. Fora de escopo. |

Esses aparecem no catálogo com status **`external`**: visíveis ao admin da
plataforma, com o motivo escrito na tela, e não liberáveis por engano.

---

## 7. O chassi, em detalhe (Onda 0 — entregue)

### 7.1 O catálogo

`src/modules/arenas/domain/moduleCatalog.js` — **50 módulos** em 11 famílias.
Cada um declara, além do que já havia (rótulo, descrição, ícone, cor, pai/filhos):

| Campo | Para quê |
|---|---|
| `status` | `ready` / `beta` / `planned` / `external` — governa o que é liberável |
| `audience` | atleta, professor, arena |
| `benefit` | uma frase **por público**, escrita na voz de quem lê |
| `summary` | a promessa em uma linha, para o cartão |
| `requires` | dependências além do pai (carteira → membros) |
| `manage` / `public` | rota da gestão e rota do atleta, quando existem |
| `config` | campos de configuração por arena, com padrão e limites |
| `collections` | quais coleções o módulo usa |
| `externalNote` | por que depende de terceiro (obrigatório em `external`) |

Há teste de integridade: nenhum módulo sem detalhamento, nenhum detalhamento
órfão, toda dependência existe, ninguém depende de si mesmo, todo filho é
listado pelo pai, todo `external` explica o motivo, todo módulo tem público e
benefício escritos.

### 7.2 O gate

`src/modules/arenas/domain/moduleAccess.js` — puro e testado.

```js
resolveArenaModule({ masterOn, platformModules, arenaStates, moduleId })
// → { on, reason, mode, config, missing }
```

Ordem das conferências, e o motivo devolvido quando cada uma falha:

1. `masterOn` .................. `master_off`
2. módulo existe ............... `unknown`
3. está implementado ........... `not_implemented`
4. a plataforma liberou ........ `not_released`
5. a família vale .............. `family_off`
6. as dependências valem ....... `requires`
7. a arena ligou (ou é forçado)  `arena_off`

`buildArenaModuleAccess` resolve os 50 de uma vez e devolve `isOn`,
`configOf`, `reasonFor`, `missingFor`, `enabledIds`, `releasedIds`.

**Nunca** um hook por módulo dentro de um `map`: são 50.

### 7.3 As duas escritas

| Camada | Onde | Quem escreve | Como |
|---|---|---|---|
| 1 | `platform_settings/arena_modules` (documento único) | só o admin da plataforma (regra já existente) | `platformModulesService` |
| 2 | `arena_module_states/{arenaId}_{moduleId}` | gestor da arena e admin | `moduleStateService` |

A camada 2 grava em **lote** (`setArenaModuleStates`) por causa da cascata:
ligar a carteira liga membros junto. Em N escritas, uma falha no meio deixaria
a arena com metade ligada; em lote é tudo ou nada.

### 7.4 Cascata, na tela

- **Ligar** um módulo com dependência pendente → diálogo: “precisa de X, vamos
  ativar junto”.
- **Desligar** uma família → diálogo **com a lista** do que cai junto, e a
  frase que importa: *nada é apagado, some da tela e volta se você ativar de
  novo*.

`modulesToEnableWith` e `modulesToDisableWith` calculam as duas listas; a
segunda é um ponto fixo (quem depende de quem depende também cai).

### 7.5 Modo de liberação

Cada módulo liberado tem um modo:

- `opt_in` (padrão) — a arena escolhe.
- `forced` — vale para **todas** as arenas, sem escolha. Na tela da arena
  aparece como “Incluído pela plataforma”, ativo e **sem interruptor**.

Serve para o dia em que um módulo deixar de ser opcional e virar parte do
produto — sem precisar escrever em `arena_module_states` de cada arena.

### 7.6 Regras corrigidas nesta onda

Ver §1. Provadas por `tests/rules/arenaModules.rules.test.js` (43 asserções no
emulador), que cobre as duas metades: o gestor volta a conseguir, e o estranho
continua não conseguindo.

### 7.7 Contagem do catálogo

| Estágio | Quantos |
|---|---|
| Disponível (`ready`) | 43 |
| Novo (`beta`) | 2 |
| Depende de terceiro (`external`) | 4 |
| Em construção (`planned`) | 1 |
| **Total** | **50** |
