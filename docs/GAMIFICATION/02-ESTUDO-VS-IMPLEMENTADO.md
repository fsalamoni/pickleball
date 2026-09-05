# 02 — O estudo × o que foi implementado

> Confronto seção a seção entre
> [`90-ESTUDO-ORIGINAL.md`](./90-ESTUDO-ORIGINAL.md) e o código em produção.
> Legenda: ✅ pronto · 🟡 parcial · ⏳ não iniciado · ❌ decidido não fazer.

---

## 1. Tabela-resumo (as 22 seções do estudo)

| § | Tema do estudo | Estado | Onde está / o que falta |
|---|---|---|---|
| 1 | Mapa do que existe | ✅ | serviu de base; continua válido |
| 2 | Anatomia de XP/níveis | ✅ | `xpTotal.js`, `progressionV2.js`, `tiers.js` |
| 3 | Como o sistema falha em gerar hábito | ✅ | diagnóstico endereçado por missões + streak |
| 4 | Padrões de mercado | ✅ | referência; não vira código |
| 5 | Princípios do plano | ✅ | respeitados (aditividade, flag, reversibilidade) |
| 6 | Pilares de gamificação | 🟡 | 5 dos 7 pilares; falta economia e eventos ao vivo |
| 7 | Mapa de gatilhos por feature | 🟡 | gatilhos de jogo/torneio/dia de jogo prontos; arena, professor e clube ⏳ |
| 8 | XP/Níveis expandido | 🟡 | curva e tiers ✅; **gasto de XP ⏳ (ver §4)** |
| 9 | Taxonomia de conquistas | ✅ | 83 conquistas, famílias derivadas do catálogo |
| 10 | Missões e desafios | 🟡 | missões diárias ✅; desafios semanais e de temporada ⏳ |
| 11 | Estações, temporadas, eventos ao vivo | 🟡 | temporada mensal + Cloud Function ✅; eventos ao vivo ⏳ |
| 12 | Rivals, crews, mentores | ✅ | domínio, service, hooks e tela `/vinculos` |
| 13 | Convites & viralidade | ✅ | código, captura e landing |
| 14 | Onboarding + re-engajamento | ⏳ | nada roteirizado ainda |
| 15 | Painel do professor | ⏳ | nenhum gancho de engajamento no módulo `coaches` |
| 16 | Arena: CRM + health score | 🟡 | CRM de membros existe (Onda N); **health score ⏳** |
| 17 | Clubes: vida social & leaderboards | 🟡 | ranking de clube existe; leaderboard **de temporada** ⏳ |
| 18 | "Review da semana" & jornada emocional | 🟡 | arena tem "Como foi sua semana"; **atleta ⏳** |
| 19 | Anti-burnout, anti-cheating | 🟡 | escudo de streak ✅; limites e detecção ⏳ |
| 20 | Roadmap por fases | ✅ | executado; histórico em `00-ROADMAP.md` |
| 21 | Métricas de sucesso | ⏳ | **nenhuma telemetria de funil instrumentada** |
| 22 | Cardápio de ideias extras | — | consulta livre |

**Contagem**: 8 ✅ · 8 🟡 · 5 ⏳ · 1 consulta.

---

## 2. O que ficou melhor do que o estudo pedia

Vale registrar, para não ser "corrigido" de volta por engano:

1. **XP derivado em vez de ledger incremental.** O estudo desenhava um livro-razão
   de XP (`xp_ledger`) com entradas por evento. Optamos por **recalcular** o total
   a partir da atividade real. Vantagens: não existe saldo para dessincronizar,
   recontar histórico antigo é rodar a função de novo, e não há como um evento
   duplicado inflar XP. O arquivo `xpLedger.js` existe como estrutura, mas o total
   que vale é o de `xpTotal.js`.

2. **Tiers com fonte única.** O estudo trazia três vocabulários de tier em pontos
   diferentes. `TIER_NAMES` em `tiers.js` é a única fonte; schema zod e regras do
   Firestore derivam dela.

3. **Boundary de erro dedicado.** Não estava no estudo. `GamificationErrorBoundary`
   garante que um erro na gamificação nunca derruba a tela que a hospeda — o que
   torna seguro montar componentes de gamificação dentro de telas críticas.

4. **Suíte de regras contra o emulador real.** 54 asserções. Foi ela que pegou o
   bug em que nenhuma missão era criada: o Firestore mockado aceitava `undefined`
   em um campo, o real rejeitava o documento inteiro em silêncio.

---

## 3. Os cinco buracos que importam (por ordem de valor)

### 3.1 Telemetria (§21) — **faça isto primeiro**
Sem instrumentar o funil, não há como saber se a gamificação funciona. Hoje não
existe nenhum evento medindo: quantos atletas veem o hub, quantos completam a
primeira missão, quantos voltam no dia seguinte, quantos convites viram cadastro.
**Ligar a flag sem telemetria é ligar no escuro.** É também o item mais barato:
não muda schema, não muda regra, não muda UI.

### 3.2 Onboarding gamificado (§14)
O estudo é enfático: o hábito se forma nos primeiros 7 dias. Hoje o atleta novo
cai no hub e vê um estado vazio. Falta a sequência roteirizada (primeira missão
trivial, primeira conquista garantida, primeiro convite).

### 3.3 "Review da semana" do atleta (§18)
A arena já tem o painel "Como foi sua semana" (Onda N) e ele funciona bem — é o
modelo a copiar. O atleta não tem equivalente. É o gancho de retorno semanal mais
óbvio e reaproveita dados que já existem.

### 3.4 Engajamento do lado "supply" (§15, §16, §17)
Professor, arena e clube são quem traz gente para a plataforma. O estudo dedica
três seções a eles e nenhuma virou código de gamificação. O health score de arena
(§16) é o de maior alavancagem: mede a saúde do parceiro, não do atleta.

### 3.5 Anti-cheating (§19)
Hoje só existe o escudo de streak (anti-burnout). Não há limite de ganho por dia
nem detecção de conluio. Enquanto o XP não comprar nada, o risco é baixo — mas
ele passa a ser real **no mesmo dia** em que existir economia de gasto.

---

## 4. A decisão que precisa ser revista antes de qualquer economia de XP

O XP é **derivado**, não gravado como saldo (§2 acima). Isso é ótimo enquanto o
XP só serve para mostrar progresso. Mas o estudo (§8) propõe uma economia com
gasto — loja, cosméticos, resgates.

**Gastar exige saldo, e saldo exige ledger.** Se um dia essa mecânica entrar:

1. Um total derivado não sabe o que já foi gasto. Vai ser preciso um segundo
   número (`xp_gasto`) persistido, e o disponível passa a ser `derivado − gasto`.
2. `xpLedger.js` já existe como estrutura e é o lugar natural para isso.
3. Nesse momento, o anti-cheating (§3.5) deixa de ser opcional.
4. E aí sim vale reler §8 e §19 do estudo por inteiro antes de escrever a
   primeira linha.

**Não comece pela loja.** Ela é a parte do estudo com maior custo de reversão.

---

## 5. O que decidimos NÃO fazer

| Item do estudo | Por quê |
|---|---|
| `xp_ledger` como fonte do total | substituído pelo total derivado (§2.1) — mais robusto |
| Notificação push a cada XP ganho | ruído; a plataforma já tem push e ele deve ser escasso |
| Tier visível para terceiros por padrão | privacidade; hoje é opt-in pela tela pública |

---

## 6. Estimativa grosseira, se for retomar

| Bloco | Tamanho | Depende de |
|---|---|---|
| Telemetria de funil | 1 sprint | nada |
| Onboarding gamificado | 1–2 sprints | telemetria (para medir se funcionou) |
| Review da semana do atleta | 1 sprint | nada (copia o padrão da arena) |
| Health score de arena | 1–2 sprints | dados de `arena_ops_kpis` |
| Desafios semanais / temporada | 1 sprint | temporadas (já pronto) |
| Economia com gasto de XP | 3+ sprints | ledger + anti-cheating (§4) |
