# Onda 7 — A chegada: totem, presença e falta medida

> **Módulo**: `iot_qr_kiosk` (BETA no catálogo, depende de `iot`).
> **Chave-mestra**: flag `arena_modules` (default OFF).
> **Banco**: zero coleção, zero índice, **zero regra** — e 6 asserções novas no
> emulador provando exatamente isso.

---

## 1. 🐞 O módulo era uma frase no catálogo

```js
[ARENA_MODULE_ID.IOT_QR_KIOSK]: {
  status: BETA,
  benefit: {
    [ARENA]: 'Presença confirmada sem ninguém no balcão — e no-show medido de verdade.',
    [ATHLETE]: 'Chegou, apontou a câmera, entrou.',
  },
},
```

Nem rota, nem tela, nem uma linha de código. E a promessa da arena era falsa
por um motivo mais incômodo do que a ausência: **o número de faltas já
existia** — `no_show` alimenta o painel semanal e a ficha do cliente no CRM —,
só que só era preenchido pelo gestor, uma reserva por vez, de memória, depois
do expediente. Um número que quase ninguém preenche é pior do que nenhum
número: parece medido.

---

## 2. A decisão: onde mora a chegada

A tentação era criar `arena_checkins`. Não foi preciso:

```
match /arena_bookings/{bookingId} {
  allow update, delete: if isAuthed() && (
    resource.data.athlete_id == request.auth.uid
    || request.auth.uid in resource.data.get('participant_ids', [])
    || ...
    || isArenaManager(resource.data.arena_id) ...);
```

O titular já escreve na própria reserva. O gestor também. Então a chegada é um
**campo aditivo no documento que já existe** (`checked_in_at`, `checked_in_by`,
`checked_in_uid`, `checkin_device_id`) — zero coleção, zero índice, **zero
regra nova**, e a presença mora junto do horário a que ela se refere, que é
onde toda pergunta sobre ela vai começar.

O totem é um `arena_devices` de tipo `qr_kiosk`, que o cadastro de
equipamentos já previa.

> As 6 asserções novas no emulador (218 no total) travam esse contrato: o
> titular confirma a própria chegada, **um estranho não confirma a dos
> outros**, a arena confirma e desfaz, e **só o gestor gira o código do
> totem**. Se um dia alguma dessas cair, o módulo para em silêncio — a recusa
> chega como um `permission-denied` genérico, que ninguém liga a um check-in.

---

## 3. Como funciona

```
        TOTEM (tablet da recepção, logado na arena)
        ┌────────────────────────────────┐
        │  [QR]        A 2 B 4 C         │  código de 5, válido 90 s
        └────────────────────────────────┘
                  │ escreve em arena_devices.checkin_token
                  ▼
   atleta aponta a câmera ──► /arenas/:id/chegada?d=…&c=…
                  │
                  ├─ UM horário aberto  → confirma SOZINHO, sem tocar em nada
                  └─ dois ou mais       → a pessoa escolhe qual
                  │
                  ▼  grava na PRÓPRIA reserva
        checked_in_at · checked_in_by: 'athlete'
                  │
                  ▼
     PAINEL DA ARENA  /arenas/:id/gerir/presenca
     chegou · aguardando · não veio · taxa de falta
```

Sem totem na recepção o módulo continua útil: a arena confirma a chegada pelo
painel, e é o mesmo campo.

### O caminho curto é o produto

A promessa ao atleta tem sete palavras — *"chegou, apontou a câmera, entrou"*.
Por isso, quem vem pelo QR **e tem um único horário aberto** não toca em nada:
a tela abre já confirmando. Um botão ali seria transformar um gesto em dois
para não ganhar nada. Com dois horários abertos a escolha é dela — confirmar a
reserva errada deixaria a certa contando como falta.

### O código gira

Vale 90 segundos e é trocado a cada ~60. Um código fixo colado na parede
viraria mensagem de grupo ("manda aí que eu confirmo do carro"), e a arena
estaria medindo boa vontade. O alfabeto não tem `0/O`, `1/I/L` nem `5/S`:
quem digita em pé, com a mochila no ombro, não deve ter de decidir se aquilo é
um zero ou um ó.

Fechar a tela do totem **apaga o código** — totem desligado que deixa um
código válido para trás é exatamente a chegada de casa que a validade curta
evita.

> ### O limite, dito na cara
> `arena_devices` é `allow read: if isAuthed()`: o código pode ser lido de casa
> por qualquer conta autenticada. Ele impede a chegada confirmada **por
> engano**, não a fraude deliberada — e não precisa impedir: nada de valor
> depende dele. Não abre porta, não cobra, não libera quadra. Fechar isso de
> verdade exigiria um segredo que o cliente não pudesse ler, ou seja, uma
> função de servidor e uma coleção nova. Não vale o preço para um contador de
> presença.

### Quem dividiu a quadra também chega

`useMyBookings` consulta só `athlete_id` — quem entrou numa reserva
compartilhada ouviria *"você não tem horário aqui hoje"* na porta da arena. A
tela soma `useMyParticipations`, que já existia para o outro lado da reserva
compartilhada: uma consulta a mais, nenhum índice novo, e a mesma reserva nas
duas listas não vira duas.

---

## 4. A falta, medida como se mede

`attendanceOfDay` classifica cada reserva confirmada do dia em **presente**,
**aguardando** ou **faltou**, com duas decisões que definem se o número presta:

**A falta só é afirmada depois que a janela FECHA** (o horário mais 30
minutos). Enquanto ela está aberta a pessoa pode estar estacionando, e chamar
isso de falta é o tipo de número que faz a arena cobrar multa de quem chegou no
horário.

**A taxa sai sobre o que já foi decidido**, não sobre o dia inteiro. Dividir
pelo total às 9h da manhã daria 95% de falta todo dia — um número que só faz
sentido às 23h não é um número, é uma armadilha.

E a arena marca **em lote**: um toque sobre exatamente quem o sistema já sabe
que não apareceu (`noShowCandidates`). Era o trabalho manual que competia com
fechar o caixa — e que por isso nunca era feito. Quem a arena já marcou não
volta para a fila; desfazer continua possível.

---

## 5. O totem é o lugar do white label

A tela do totem sai com a **cor, o logo e a assinatura da arena**
(`arenas.branding`, Onda AN), com o texto escolhido por contraste. É a tela
mais vista pelo cliente da arena — sair com a cara da plataforma ali seria
desperdiçar o único lugar onde a marca realmente aparece.

**E ela não lista ninguém.** Cumprimenta a última pessoa que chegou, pelo
primeiro nome, por 20 segundos. Um painel público num corredor com a agenda
nominal do dia é exposição de dado pessoal que ninguém pediu; a única função
útil do aviso é a pessoa saber que deu certo.

---

## 6. Onde alguém encontra isso

| Quem | Onde |
|---|---|
| Atleta | um aviso na página da arena **só dentro da janela** ("Você tem quadra hoje às 19:00. Já chegou?"), e o atalho do catálogo |
| Arena | Gestão → **Presença**, com o botão que abre o totem numa aba |
| Totem | `/arenas/:id/totem`, fora do menu da plataforma |

O aviso ao atleta vem **antes** do "como foi?" do NPS: um é sobre o jogo de
agora, o outro sobre o da semana passada, e quem está na porta da arena não
deve passar por uma pesquisa antes.

---

## 7. O que foi tocado

**Domínio novo** (`domain/checkin.js`, +35 asserções): `checkinState`,
`myCheckinBookings`, `attendanceOfDay`, `noShowCandidates`, `newKioskToken`,
`kioskCodeMatches`, `bookingDayWindow`, `checkinBlockedReason`.

**Serviço novo** (`services/checkinService.js`): `rotateKioskToken`,
`markKioskOffline`, `checkInBooking` (reconfere janela e código no banco),
`confirmArrivalByArena`, `undoArrival`, `markNoShowBatch`.

**Hooks** (`hooks/useCheckin.js`): toda mutação invalida os DOIS lados
(`my-bookings` e `arenaKeys.reservas`).

**Telas**: `V2ArenaKiosk.jsx` (+11), `V2ArenaCheckin.jsx` (+8),
`V2ArenaAttendance.jsx` (+12), `ArenaCheckinAsk.jsx` na página da arena.

**Catálogo**: o módulo ganhou `manage` e `public` — e com isso o atalho
aparece sozinho nos dois lados, sem ninguém escrever link.

**Guarda nova** (`src/core/guards/rotasDeModulos.test.js`, +21): toda rota que
o catálogo promete tem de existir em `V2App.jsx`. O atalho vir do catálogo é o
desenho certo e tem um flanco — um caminho com erro de digitação **não dá
erro**, dá um botão bonito que leva a uma tela em branco. Agora reprova em CI,
para os sete ondas de uma vez.

---

## 8. O que NÃO pode regredir

1. **A chegada mora na reserva.** Nenhuma coleção nova; a regra existente é o
   que autoriza, e há asserção travando.
2. **A falta só depois da janela fechar** (+30 min).
3. **A taxa é sobre o decidido**, não sobre o dia inteiro.
4. **O código gira** e morre com a tela.
5. **Só o gestor escreve `arena_devices`** — inclusive o `checkin_token`.
6. **O totem não lista nomes**: um cumprimento, primeiro nome, 20 segundos.
7. **Um horário aberto + QR = zero toques.** O caminho curto é a promessa.
