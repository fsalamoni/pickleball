# Módulo Matchmaking — vagas abertas, parceiro e fila de espera

> Família `matchmaking`, com três módulos:
> `matchmaking_open_match`, `matchmaking_partner_finder`, `matchmaking_waitlist`.
>
> Onda 1. Ver o chassi em `00-INDEX.md`.

---

## 1. O que a arena ganha

Quadra parada não volta. O horário das 15h de uma terça não é vendido no dia
seguinte — ele simplesmente não existiu. Este módulo transforma o horário
ocioso em jogo, **sem ninguém precisar montar o grupo**: a arena publica, os
atletas do nível certo entram sozinhos, e quando lota a fila segura quem
sobrou para o primeiro cancelamento.

## 2. O que estava quebrado (e por quê)

O código do Open Match existia desde julho e **não funcionava por quatro
motivos independentes**. Todos verificados, todos corrigidos nesta onda.

### 2.1 🐞 A lista de vagas nunca carregou

```js
where('arena_id', '==', arenaId) + orderBy('date', 'asc')
```

Igualdade num campo mais ordenação noutro exige **índice composto**. O único
índice de `arena_open_slots` é `[arena_id, starts_at]` — e a consulta ordenava
por `date`. Ela **falhava sempre**, em toda arena, desde que foi escrita. Como
o padrão do projeto é `const { data = [] } = useX()`, o erro virava lista
vazia: a arena publicava e não via nada.

O mesmo defeito estava em `listOpenSlotsGlobal`, `listArenaCoaches`,
`listArenaClasses` e `listArenaTournaments` (torneios internos) — **cinco
consultas mortas**.

**Por que o guarda não pegou.** `src/core/guards/indicesCompostos.test.js` já
existia, mas só olhava dentro de `query(...)`. Estas montam a consulta noutro
estilo:

```js
const c = [where('arena_id', '==', id)];
c.push(orderBy('date', 'asc'));
getDocs(query(collection(db, COL), ...c));
```

O `orderBy` está **fora** do `query(...)`. O guarda agora varre por FUNÇÃO
também, e ignora comentários (os comentários que explicavam defeitos antigos
citavam `orderBy('created_at')` e o varredor lia a explicação como consulta).

### 2.2 🐞 A peneira de nível comparava escalas diferentes

`min_level`/`max_level` eram validados de **0 a 7** e comparados contra
`userProfile.level`. A régua da plataforma é **2.0–8.0**
(`docs/13-NIVEL-UNIFICADO.md`), e `profile.level` é um CÓDIGO de faixa, não um
número nessa escala. A peneira ou não filtrava nada, ou filtrava errado.

Agora os dois lados vêm de `resolveUnifiedLevel`, e o serviço resolve o nível
de quem entra (`fetchUnifiedLevelValues`) antes de conferir.

**Sem nível conhecido, a peneira NÃO barra.** A plataforma nunca inventa um
nível, e barrar quem não tem histórico afastaria justamente quem mais precisa
achar jogo.

### 2.3 🐞 A vaga aberta não ocupava a quadra

Uma vaga publicada às 19h na Quadra 1 é a Quadra 1 comprometida às 19h. Só que
a quadra era **texto livre** (`court: 'Quadra 1'`), sem `court_id` — não havia
como o calendário saber de qual quadra se tratava. A arena vendia o mesmo
horário duas vezes.

A correção segue exatamente o desenho do dia de jogo da arena
(`games/domain/arenaGameDay.js`):

| Peça | O que faz |
|---|---|
| `court_id` | campo novo, **opcional**, na vaga |
| `openSlotBlocks(slots)` | deriva bloqueios no formato de `arena_unavailabilities` |
| `mergeOpenSlotBlocks(blocos, slots)` | soma aos existentes, sem duplicar |
| `openSlotConflict(vaga, blocos, reservas)` | recusa publicar em cima do que já existe, **dizendo o quê** |

Onde entrou: o serviço de reserva (`bloqueiosDaArena`), o calendário mensal,
o calendário do admin e a grade do dia.

**Nada é gravado**: diferente do dia de jogo, aqui o bloqueio é sempre
derivado. Não existe cópia para faltar.

E, como no dia de jogo: **o bloqueio não depende de feature flag**. A flag
gateia o que se MOSTRA, não se a quadra está ocupada.

### 2.4 🐞 A fila de espera nunca chamou ninguém

Três defeitos numa funcionalidade só:

1. **Ninguém era chamado.** `notifyNextInLine` existia e não era invocada de
   lugar nenhum. Alguém saía do jogo, a vaga abria, e a fila não sabia.
   Agora `leaveOpenSlot` chama o próximo — e só quando o jogo estava **lotado**
   e passou a ter vaga.
2. **A notificação levava a lugar nenhum.** O link era `/minha-fila`, rota que
   **nunca existiu**. Agora vai para os jogos abertos da arena, onde se aceita.
3. **A promoção tinha prazo que ninguém cumpria.** `expireStaleNotifications`
   (a do lado do cliente) não era chamada — e não poderia ser: expirar a
   promoção de OUTRA pessoa é escrita que o navegador dela não vai fazer. Se o
   chamado não respondia, a vaga ficava presa **para sempre**.

   Virou Cloud Function: **`advanceOpenSlotWaitlist`**, a cada 10 minutos,
   expira o prazo vencido e chama o próximo. Sem índice novo (um `where` de
   igualdade só).

E faltava a outra metade na tela: quem era chamado **não tinha onde aceitar**.
Agora a página do atleta abre com "Vagou um lugar para você", com Confirmar e
Não vou poder.

### 2.5 A tela falava a língua errada

- `2026-07-23 · 19:00` → `Qui, 23/07 · 19:00–21:00` (`formatSlotLabel`).
- "Open Match" / "Matchmaking" → "Jogos abertos" / "Encontrar parceiro".
- Lotado dizia **"inscrições encerradas"** — e escondia a fila. Lotado e
  encerrado são coisas diferentes; `isSlotOpenForJoin` responde `false` para as
  duas, e o cartão tratava as duas igual.
- Falha de leitura virava "nenhum jogo aberto". Agora é erro com "tentar de
  novo".
- Buscar parceiro recarregava a página inteira (`window.location.href`) para
  abrir uma conversa.

## 3. Como funciona hoje

### Arena — `/arenas/:id/gerir/open-match`

Publica data, horário, **quadra (da lista)**, vagas, formato, valor e faixa de
nível na régua 2.0–8.0. Ao publicar, confere contra reservas, dias de jogo e
outras vagas; conflito é recusado com o motivo.

Vaga sem quadra escolhida é permitida — e a tela **avisa** que ela não ocupa
horário nenhum.

### Atleta — `/arenas/:id/open-match`

Lista o que dá para jogar, com a faixa de nível **e o nível de quem olha**
lado a lado. Lotado oferece a fila no mesmo lugar. Chamado da fila aparece em
destaque no topo.

### Encontrar parceiro — `/arenas/:id/matchmaking`

Compatibilidade por nível na régua única (uma consulta para o lote inteiro de
candidatos), com a cidade da **arena** como referência — quem procura parceiro
aqui quer alguém que jogue aqui.

## 4. Impacto no banco

| Item | Mudou? |
|---|---|
| Coleção nova | **não** |
| Índice novo | **não** (as consultas deixaram de precisar) |
| Regra nova | **não** |
| Campo novo | `court_id` na vaga — **opcional e aditivo** |
| Migração | **não** (vaga antiga segue válida; só não bloqueia quadra) |
| Cloud Function | +1 (`advanceOpenSlotWaitlist`) |

## 5. Onde está o quê

| Camada | Arquivo |
|---|---|
| Domínio | `modules/arenas/domain/openMatch.js`, `waitlist.js`, `matchmaking.js` |
| Serviços | `services/openMatchService.js`, `waitlistService.js` |
| Nível | `modules/rating/hooks/useMyUnifiedLevel.js` (`useMyUnifiedLevel`, `useUnifiedLevels`) |
| Telas | `V2ArenaAdminOpenMatch`, `V2ArenaOpenMatch`, `V2ArenaMatchmaking` |
| Servidor | `functions/index.js` → `advanceOpenSlotWaitlist`, `promoteOpenSlotWaitlistOnSlot`, `promoteOpenSlotWaitlistOnEntry`; lógica em `functions/openSlotWaitlist.js` |

---

## Atualização 2026-09-24 — o atleta passou a conseguir usar

Um levantamento no emulador mostrou que **nada disto funcionava para o
atleta** desde a entrega, e nenhum teste de regra existia para mostrar:

| Passo | Por que falhava |
|---|---|
| Entrar / sair do jogo aberto | grava `participants` na vaga, e só a ARENA atualizava `arena_open_slots` |
| Entrar na fila | o serviço lê a fila da vaga para calcular a posição, e o atleta só podia ler a própria entrada |
| Aceitar / recusar a chamada | é atualizar a PRÓPRIA entrada, e só a arena podia |
| Sair da fila, recusar | "reordenava" e "chamava o próximo" — escrita na entrada de OUTRA pessoa |
| A arena ver a fila | a consulta era por `slot_id`, e a regra da arena confere `arena_id` |

O que mudou:

- **Regras.** Na vaga, o atleta entra e sai **só a si mesmo**, com a vaga de
  pé, sem passar dos lugares, e com contagem e "lotada" coerentes com a lista.
  A fila passou a ser **legível por quem tem conta** (nome e posição — o mesmo
  nível de exposição de quem está na vaga, que é público); entrar é em nome
  próprio, **esperando** (nunca já chamado), uma entrada por pessoa por vaga e
  na arena da vaga; o chamado só **responde** (aceitar/recusar) à própria
  chamada. Vinte e cinco asserções no emulador
  (`tests/rules/matchmaking.rules.test.js`).
- **Chamar o próximo é do servidor.** `promoverProximo`
  (`functions/openSlotWaitlist.js`) roda numa transação quando alguém **sai**
  da vaga (`promoteOpenSlotWaitlistOnSlot`), quando uma chamada é **recusada,
  expira ou some** (`promoteOpenSlotWaitlistOnEntry`) e na varredura de 10 em
  10 minutos. Lugares = total − quem está na vaga − quem já foi chamado e está
  no prazo; chama quantos couberem, na ordem da fila.
- **Sem "reordenar".** A fila anda pela menor posição entre quem espera; um
  buraco na numeração não muda quem é o próximo.
- **Um prazo só: 60 minutos.** O cliente dizia 5 e o servidor aplicava 60; há
  teste de paridade.

---

## Atualização 2026-09-24 (tarde) — o jogo aberto dentro da arena

O jogo aberto deixou de ser uma página alcançada por botão: é a seção **Jogo
aberto** da Central (com quem vem e a fila de cada jogo), a seção **Jogos
abertos** da página da arena (entrar ali mesmo), e aparece em **Minhas
reservas** e em **Procura-se jogo**. Detalhes e defeitos corrigidos em
`09-INTEGRACAO-NA-ARENA.md` §8.
