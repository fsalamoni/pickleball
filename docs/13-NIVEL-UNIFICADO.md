# 13 — Nível unificado nos sorteios

> **Uma régua só para todos os sorteios da plataforma.**
> Antes, cada sorteio usava o nível declarado no formulário do atleta. Agora todos
> usam a mesma escala **2.0 – 8.0**, alimentada pela melhor fonte disponível.

---

## 1. O problema

A plataforma passou a ter quatro descrições diferentes da força de um atleta:

| Fonte | Escala | Onde vive |
|---|---|---|
| DUPR informado no perfil | 2.0 – 8.0 | `athlete_profiles/{uid}.dupr_rating` |
| Rating estilo DUPR da plataforma | 2.0 – 8.0 | `player_skill_ratings/{uid}.doubles_rating` |
| Rating ELO do ranking nacional | 800 – 1600 | `player_ratings/{uid}.rating` |
| Nível declarado no formulário | USAP 1.0 – 5.0+ | `athlete_profiles/{uid}.leveling_level` |

Os sorteios usavam só a última. E não adianta trocar de fonte sem equiparar as
escalas: comparar um ELO de 1200 com um nível declarado `avancado` não equilibra
nada — são réguas diferentes medindo a mesma coisa.

---

## 2. A solução

### 2.1 A régua canônica é a do DUPR (2.0 – 8.0)

Escolhida porque duas das quatro fontes já vivem nela, é a que o atleta entende e
é a que a plataforma exibe.

### 2.2 A prioridade

Definida pela **qualidade da evidência**, do melhor para o pior:

| # | Fonte | Quando é usada |
|---|---|---|
| 1 | **DUPR informado** | sempre que houver — é medição externa |
| 2 | **Rating 2.0–8.0 da plataforma** | se o atleta já tem jogos (`doubles_games > 0`) |
| 3 | **ELO do ranking nacional** | se o atleta já tem jogos (`games > 0`) |
| 4 | **Nível declarado no formulário** | último recurso — mas **convertido para a mesma régua** |

Os níveis 2 e 3 são ignorados quando o atleta tem **zero jogos**: nesse caso o
valor guardado é apenas a *semente*, que por sua vez foi derivada do nível
declarado. Usá-lo seria dar ares de medição a um palpite.

### 2.3 A equiparação das escalas

`src/modules/rating/domain/unifiedLevel.js`.

- **USAP → 2.0–8.0**: pela `usapToRating` que a plataforma já usava.
- **ELO → 2.0–8.0**: por interpolação linear por partes entre âncoras derivadas
  da **própria semente da plataforma** (`seedFromLevelOrdinal` × `LEVEL_TABLE`).

Essa segunda escolha dá uma propriedade verificável, e há um teste para ela:

> **Ponto fixo** — um atleta que nunca jogou tem ELO igual à sua semente.
> Converter essa semente de volta devolve exatamente o nível que ele declarou.

Ou seja: as quatro fontes descrevendo o mesmo "intermediário" caem dentro de
0,2 ponto umas das outras. Há um teste que verifica isso também.

### 2.4 Limite conhecido

A escala DUPR começa em 2.0. Os níveis `iniciante_1` (USAP 1.0–1.5) e
`iniciante_2` (USAP 2.0) portanto colapsam os dois em **2.0** — não é um bug, é o
piso da régua. Na prática não muda sorteio: são os dois níveis mais baixos e
continuam sendo os mais baixos.

---

## 3. Onde isso é aplicado

| Superfície | Arquivo | O que mudou |
|---|---|---|
| **Dia de jogo — Americano** | `clubs/domain/gameDayDraw.js` | novo custo de desequilíbrio de nível na formação das duplas, e ordenação por nível com jitter em metade das tentativas |
| **Dia de jogo — Mexicano** | `clubs/domain/gameDayFormats.js` | o clássico 1&4 vs 2&3 passa a valer de verdade: os quatro da quadra são ordenados por nível |
| **Dia de jogo — Rei da Quadra** | `clubs/domain/gameDayFormats.js` | rodada 1 sai escalonada (quadra 1 = a mais forte) e com duplas equilibradas |
| **Dia de jogo — Play** | `games/domain/gamePlay.js` | `playLevelValue` passa a resolver na régua unificada |
| **Torneios** | `tournament/domain/seeding.js` + `services/drawService.js` | o seeding usa o nível unificado quando disponível |

### 3.1 Os três organizadores de dia de jogo

`V2GameDayOrganizer` (clube), `AthleteGameDayOrganizer` (atleta) e
`GameDayOrganizer` (legado) buscam os níveis com
`fetchUnifiedLevelsByParticipant(participants)` antes de sortear.
A leitura é **best-effort**: se falhar, o sorteio acontece do mesmo jeito, só
sem equilibrar por nível.

### 3.2 O caso do Play

Aqui havia um bug real. `playLevelValue` só sabia extrair dígitos da string do
formulário — então `intermediario` e `avancado` caíam os dois no padrão 3.0
(o equilíbrio por nível do Play **não existia de fato**) e `iniciante_1` virava
1.0, um número de outra escala. Agora os IDs do formulário são convertidos, e o
nível unificado, quando existe, tem prioridade.

---

## 4. As garantias que NÃO podem ser quebradas

Estas são estruturais, não calibragem — há teste para cada uma.

1. **O nível nunca vence uma parceria inédita.** No Americano, o peso do nível
   (`W_LEVEL = 2`) e o teto do espalhamento de quadra (`MAX_COURT_SPREAD_COST = 9`)
   ficam **por construção** abaixo do peso de repetir uma dupla (`W_PARTNER = 10`).
   Variedade continua acima de equilíbrio.
2. **Sem nível não é nível zero.** `Number(null)` é `0`, que é finito — sem guarda
   explícita, "sem nível" viraria o piso da régua e o atleta entraria no sorteio
   como o mais fraco de todos. Todas as funções guardam `== null` antes de
   converter. Quem não tem nível entra pela **mediana** do grupo.
3. **O nível não decide quem fica de fora.** No Rei da Quadra, quem joga é
   escolhido pelo sorteio **antes** de qualquer ordenação por nível.
4. **Sem níveis, o comportamento é byte a byte o de antes.** Há teste comparando
   a saída com e sem o parâmetro `levels`.
5. **As duas réguas nunca se misturam numa mesma comparação.** No seeding de
   torneio, ou todos os inscritos são comparados pelo nível unificado, ou todos
   pelo ordinal do nível declarado — nunca metade de cada.
6. **A dupla fixa e a dupla mista continuam acima do nível** no formato Play.

---

## 5. Efeito medido

Americano, 10 sorteios × 6 rodadas, 12 atletas espalhados de 2,5 a 5,5, 3 quadras:

| Métrica | Antes | Depois | |
|---|---|---|---|
| Desequilíbrio médio da dupla | 0,79 | **0,49** | −38 % |
| Amplitude de nível dentro da quadra | 2,08 | **1,78** | −14 % |
| Parcerias repetidas | 0,0 % | 0,6 % | custo aceito e limitado por construção (§4.1) |

---

## 6. Impacto no banco de dados

**Nenhum.** A resolução do nível é feita **em memória**, no momento do sorteio.

- Nenhuma coleção nova.
- Nenhum campo novo.
- Nenhum índice novo — as três coleções são lidas **por id de documento**.
- Nenhuma regra de segurança alterada: `player_ratings` e `player_skill_ratings`
  já são de leitura pública; `athlete_profiles` já é legível por autenticado.
- Nenhuma escrita: `unifiedLevelService` é read-only por princípio.

Travas de custo: no máximo **300 atletas** por chamada, em lotes de 30 (o limite
do `in` do Firestore).

---

## 7. Arquivos

```
src/modules/rating/domain/unifiedLevel.js          # a régua e a prioridade (puro)
src/modules/rating/domain/unifiedLevel.test.js     # 27 testes
src/modules/rating/services/unifiedLevelService.js # leitura das 3 coleções

src/modules/clubs/domain/gameDayDraw.js            # Americano
src/modules/clubs/domain/gameDayDrawLevels.test.js
src/modules/clubs/domain/gameDayFormats.js         # Mexicano + Rei da Quadra
src/modules/clubs/domain/gameDayFormatsLevels.test.js
src/modules/games/domain/gamePlay.js               # Play
src/modules/games/domain/gamePlayLevels.test.js
src/modules/tournament/domain/seeding.js           # torneios
src/modules/tournament/services/drawService.js
```

---

## 8. Como adotar em uma superfície nova

```js
import { fetchUnifiedLevelsByParticipant } from '@/modules/rating/services/unifiedLevelService';

// Best-effort: um sorteio precisa acontecer mesmo com o ranking fora do ar.
let levels = null;
try {
  levels = await fetchUnifiedLevelsByParticipant(participants);
} catch {
  levels = null;
}
```

Para uids em vez de participantes, use `fetchUnifiedLevelValues(uids, { side })`.
Use `side: 'doubles'` (padrão) para formar duplas — usar o rating de simples para
montar duplas compararia habilidades diferentes.
