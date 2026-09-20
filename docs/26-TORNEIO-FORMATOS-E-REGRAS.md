# Torneio: formatos, grupos, classificação e chaves

> A referência completa de **como um torneio se organiza** no PickleRush — e
> de tudo o que o administrador do torneio pode mudar.
>
> Leia junto: `docs/12-TEAM-TOURNAMENTS.md` (equipes),
> `docs/13-NIVEL-UNIFICADO.md` (a régua 2.0–8.0 dos sorteios) e
> `docs/18-RANKINGS.md` (quando o resultado conta).

---

## 0. O princípio

**Existe um padrão bom, e o administrador pode mudar tudo.**

A plataforma traz as regras do regulamento (USA Pickleball) e as práticas dos
circuitos como PADRÃO — quem não quer pensar nisso aperta sortear e o torneio
sai certo. E traz, ao lado de cada uma, o controle para trocá-la, com a
explicação do que a troca causa.

Isso não é indecisão: torneio amador tem regulamento próprio, patrocinador,
quadra contada e público que espera uma coisa específica. Uma plataforma que
impõe um único jeito obriga quem organiza a mentir no papel ou a fazer conta no
caderno.

**Nada aqui é obrigatório.** Todo campo de configuração é aditivo: em branco,
a fase se comporta exatamente como se comportava antes de o campo existir.

---

## 1. Os formatos de fase

| Formato | O que é | Bom para |
|---|---|---|
| **Pontos corridos** | todos contra todos, uma tabela só | até ~10 inscritos, dia inteiro garantido |
| **Fase de grupos** | vários todos-contra-todos em paralelo | o padrão de torneio com mais de 12 |
| **Chave (mata-mata)** | eliminação simples | fase final, ou torneio curto |
| **Dupla eliminação** | só sai com duas derrotas | quando ninguém pode ir embora com um jogo |
| **Suíço** | pareia quem tem campanha parecida, sem eliminar | muitos inscritos e pouca quadra |
| **Americano** | rotação de parceiros: joga com todos | confraternização, individual |
| **Mexicano** | rotação por classificação a cada rodada | nivelamento dinâmico |

Cada um tem um explicador em tela (`formatExplain.js`) que, para o número REAL
de inscritos, mostra quantos jogos saem, quantas rodadas, quantos byes, e o que
não fecha.

---

## 2. Formar grupos com QUALQUER número de inscritos

### 2.1. O problema

Chegam 19. Em quantos grupos se divide? A plataforma respondia mal: dividia em
qualquer número e, quando os grupos saíam desiguais, avisava *"para grupos do
mesmo tamanho, use um número de inscritos múltiplo de 4"*. Isso não é conselho —
é pedir para alguém desistir da inscrição.

**Grupo desigual é o caso normal.** O que ele exige não é um inscrito a mais: é
a regra de comparação certa (§4.2).

### 2.2. O planejador

`groupPlan.js` faz a conta ao contrário: dado o que existe, mostra as divisões
possíveis com o que cada uma custa.

| Tamanho | Jogos por atleta | Leitura |
|---|---|---|
| 2 | 1 | não é grupo — quem perde vai embora depois de um jogo. **Bloqueado** |
| 3 | 2 | curto; com **ida e volta** vira 4 |
| **4** | **3** | o padrão dos circuitos |
| **5** | **4** | ótimo quando há quadra sobrando |
| 6 | 5 | pesado: 15 jogos no grupo |
| 7+ | 6+ | o grupo vira o torneio inteiro |

Exemplo real, 19 inscritos com 2 passando por grupo:

```
4 grupos [5+5+5+4] · 36 jogos · 8 classificados → chave de 8 cheia    ← sugerido
6 grupos [4+3+3+3+3+3] · 21 jogos · 12 classificados → chave de 16, 4 byes
5 grupos [4+4+4+4+3] · 27 jogos · 10 classificados → chave de 16, 6 byes
1 grupo [19] · 171 jogos
```

A tela de sorteio mostra isso **antes** de clicar, com o número real de
inscritos, e as alternativas ao lado.

### 2.3. Ida e volta

Fase de grupos e pontos corridos aceitam **1 ou 2 turnos**. Existe para o grupo
pequeno: com 3 atletas a ida dá 2 jogos e a ida e volta dá 4 — que é o que quem
paga inscrição espera. A volta repete os mesmos confrontos com os lados
invertidos, numerando as rodadas em seguida.

### 2.4. Tamanhos escritos à mão

O administrador pode escrever `6, 5, 5` e a plataforma não discute. Se o número
de inscritos mudar até a véspera, a lista é **ajustada** para caber (engorda ou
enxuga do último grupo para o primeiro) — ninguém fica de fora e ninguém é
sorteado sem existir. Se o encolhimento produzir grupo de menos de 2, cai no
equilíbrio automático: melhor um plano viável do que honrar uma lista que virou
impossível.

### 2.5. Como os grupos são preenchidos

Sorteio determinístico pela semente, equilibrando **tamanho** (diferença máxima
de 1, salvo tamanhos manuais), **gênero** e **nível** (serpentina pela régua
unificada 2.0–8.0). Ver `grouping.js` e `docs/13-NIVEL-UNIFICADO.md`.

---

## 3. Classificação dentro do grupo

### 3.1. A ordem oficial

É a sequência do regulamento (USA Pickleball 15.B.4):

1. mais **vitórias**;
2. **confronto direto** entre os empatados;
3. **saldo de pontos** em todos os jogos do grupo;
4. **saldo no confronto direto**;
5. mais **pontos a favor**;
6. menos **pontos sofridos**.

> 🐞 **O que faltava.** A plataforma pulava do 1 direto para o 3: dois
> empatados em vitórias eram separados pelo saldo GERAL, mesmo quando um tinha
> ganhado do outro em quadra. É a reclamação nº 1 de quadra — *"mas eu ganhei
> dele"* — e quem organizava não tinha como explicar, porque a tela mostrava o
> resultado certo de uma conta errada. E a regra vivia DUPLICADA em dois
> arquivos, as duas cópias igualmente erradas.

### 3.2. Empate de três ou mais: a mini-tabela

Com dois empatados, "confronto direto" é o jogo entre eles. Com três ou mais,
olha-se os jogos **entre os empatados** como um torneio à parte.

E o recorte é recalculado a cada nível: quando um critério parte o bloco, os
que continuam empatados são comparados de novo **a partir do primeiro
critério, só entre eles**. Sem isso, "B ganhou de C" deixaria de valer só
porque A estava na conversa e já saiu.

Quem não se enfrentou (desistência, fase interrompida): o critério é **pulado**,
nunca inventado.

### 3.3. A ordem é do administrador

Nove critérios disponíveis, montados na ordem que quiser, com quatro ordens
prontas:

| Preset | Quando usar |
|---|---|
| **Oficial (USA Pickleball)** | torneio sancionado, ou na dúvida |
| **Confronto direto acima de tudo** | torneio pequeno, em que todos viram todos os jogos |
| **Aproveitamento** | grupos desiguais ou com desistência no meio |
| **Saldo acima do confronto direto** | quem prefere premiar quem vence com folga |

Critérios: vitórias · confronto direto · saldo · saldo no confronto direto ·
pontos a favor · pontos sofridos · **aproveitamento (%)** · **saldo por
partida** · **saldo de games/sets**.

Fonte única em `tiebreak.js` — a mesma regra vale na classificação do grupo, no
ranking da modalidade e na progressão entre fases.

---

## 4. Quem passa de fase

### 4.1. Classificados

- **por grupo**: um número para todos (`qualifiers_per_group`);
- **por grupo, um a um**: `2, 2, 1` — passam 2 do grupo de 5 e 1 do de 3
  (`qualifiers_by_group`);
- **por gênero**: os melhores M e F de cada grupo (`qualifier_mode`).

### 4.2. Comparar quem veio de grupos DIFERENTES

Três escolas, todas em uso de verdade:

| Método | O que faz | Quando |
|---|---|---|
| **Aproveitamento** (padrão) | vitórias e saldo ÷ partidas jogadas | grupos de tamanhos diferentes. É o que os circuitos de pickleball usam |
| **Absoluto** | vitórias e saldo crus | só é justo com grupos do MESMO tamanho |
| **Descartar o último** | tira o jogo contra o último colocado do grupo, igualando o nº de partidas | regra da FIFA/UEFA; mais rigorosa, mais difícil de explicar na beira da quadra |

E, **antes de qualquer um deles, vem a COLOCAÇÃO**: todos os 1ºs, depois todos
os 2ºs. Um 2º nunca passa à frente de um 1º, por melhor que tenha sido a
campanha — o 1º ganhou o grupo dele, e o grupo é a prova que o torneio ofereceu.

> Com 19 em 4 grupos: quem está no grupo de 5 joga 4 partidas e quem está no de
> 4 joga 3. Comparar vitórias absolutas faz 3-em-4 (75%) passar à frente de
> 3-em-3 (100%) — e o segundo não perdeu para ninguém.

### 4.3. Repescagem (os "melhores terceiros")

Quando os classificados diretos não fecham uma chave, as vagas que faltam vão
para os melhores NÃO classificados.

```
10 classificados → chave de 16 com 6 byes
                   repescar 6 → chave de 16 cheia
                   2 classificados a menos → chave de 8 cheia
```

Só concorre quem ficou **exatamente na colocação seguinte ao corte** — e o
corte é o DE CADA GRUPO quando os classificados variam por grupo. Um 4º de um
grupo forte não entra na frente de um 3º de um grupo fraco: o torneio não tem
como provar que ele é melhor. A repescagem premia a melhor campanha **entre
iguais**.

O administrador pode fixar outra colocação (`wildcard_from_position`) quando o
regulamento dele repesca de outro lugar.

### 4.4. Como a próxima fase recebe

- **por grupo da fase anterior** (o 1º do A enfrenta o 2º do B…);
- **fundindo grupos** (A+B → AB);
- **juntando todos e redividindo**.

E os classificados podem virar **duplas** (mista por grupo, ou os 2 melhores do
grupo) — é assim que um torneio individual vira de duplas na fase seguinte.

---

## 5. ⭐ Entrar direto numa fase (pular fases)

Nem todo mundo entra no mesmo ponto. É comum, e o administrador precisa poder
dizer isso:

- **cabeças que pulam a eliminatória**: os 8 melhores entram direto na chave
  principal e os outros disputam um pré-torneio pelas vagas restantes — o
  modelo de qualificatória dos circuitos grandes;
- **campeão defendendo título** que entra direto nas quartas;
- **grupo que só peneira**: 20 inscritos, 12 jogam a primeira fase por 4 vagas,
  e 8 já estão na segunda;
- **convidados da organização** que entram numa fase específica.

### 5.1. Como funciona

Quem entra direto na fase 3 **pula as fases 1 e 2**: não aparece no sorteio
delas, não conta para os grupos delas, e a classificação delas não fala dele.
Ele aparece quando a fase dele começa, **como cabeça** — à frente de todos os
classificados na ordem da chave, que é o ponto de ter esperado.

Dois modos:

- **os N melhores cabeças** — pelo nível/ranking usado no sorteio;
- **uma lista escolhida a dedo** — para campeão, convidado, ou qualquer
  critério que não seja o ranking.

### 5.2. As regras que isto respeita

- **uma pessoa entra uma vez só**. Declarada em duas fases, vale a **mais
  cedo** — e um aviso é emitido, porque vantagem duplicada por engano de
  configuração não pode passar em silêncio;
- **a 1ª fase precisa continuar com ao menos 2**. Se a configuração esvaziar a
  primeira fase, é ERRO na tela, não um sorteio impossível na hora H;
- numa próxima fase de GRUPOS, os diretos são **espalhados** um por grupo —
  amontoá-los criaria um grupo da morte por acidente.

### 5.3. Onde se configura

Na **aba de sorteio**, onde os nomes existem — o editor de formato pode ser
usado antes de haver qualquer inscrição. O painel mostra, acima de tudo, o
RESULTADO: *"2 entram direto na fase 2 (Ana, Bruno), pulando 1 fase; 12 começam
na 1ª fase"*.

---

## 6. Chaves (mata-mata)

### 6.1. A ordem canônica

Cada número de cabeça ocupa uma posição fixa, pela regra clássica (a cada dobra
de tamanho, `s` vira o par `s` × `m+1−s`):

```
tamanho 2 → [1, 2]
tamanho 4 → [1, 4, 2, 3]              (1×4 e 2×3)
tamanho 8 → [1, 8, 4, 5, 2, 7, 3, 6]  (1×8, 4×5, 2×7, 3×6)
```

Isso garante as duas propriedades que se espera de uma chave: **o nº 1 estreia
contra o mais fraco** e **o nº 1 e o nº 2 só podem se encontrar na final**.

### 6.2. ⭐ Chave incompleta: os byes vão para os cabeças

Quando o número de inscritos não é potência de 2, quem recebe bye são os
**melhores cabeças** — é a regra do DUPR, e recompensa quem foi bem no ranking.

Sai de graça da ordem canônica: todos entram pela posição do seu número, as
posições vazias são as dos números altos, e cada uma delas é o par de um número
baixo.

> 🐞 **Dois defeitos reais, no mesmo lugar.** A sequência canônica estava
> espelhada (produzia 1×5, 3×7, 4×8, 2×6 numa chave de 8 — o nº 1 pegava o nº 5
> na estreia). E os não-cabeças eram despejados nos slots vazios da esquerda
> para a direita, o que amontoava todo mundo na metade de cima e deixava pares
> inteiros vazios: **uma chave de 16 com 9 inscritos nascia com TRÊS partidas de
> ninguém contra ninguém**, gravadas como W.O. no banco, e um único bye dado a
> quem calhasse. Agora são sempre exatamente `tamanho − inscritos` byes, e zero
> partidas fantasma — para todo n de 2 a 33, com teste.

Na tela, um lado vazio numa partida de bye diz **"Passa direto (bye)"** — e não
"A definir", que fazia parecer que faltava sortear um adversário que nunca ia
existir.

---

## 7. O que é configurável, e onde

| Configuração | Onde | Padrão |
|---|---|---|
| Formato da fase | editor de formato | pontos corridos |
| Divisão em grupos (único / nº / máx. por grupo) | editor de formato | único |
| **Tamanhos dos grupos à mão** | editor → regras avançadas | equilíbrio automático |
| **Turnos (ida / ida e volta)** | editor de formato | só ida |
| Cabeças-de-chave | editor de formato | 0 (sorteio livre) |
| Classificados por grupo | editor de formato | 2 |
| **Classificados grupo a grupo** | editor → regras avançadas | o mesmo para todos |
| Critério (geral / por gênero) | editor de formato | geral |
| **Repescagem (vagas)** | editor de formato | 0 |
| **Repescagem (de qual colocação)** | editor → regras avançadas | automático |
| **Ordem dos critérios de desempate** | editor → regras avançadas | oficial |
| **Comparação entre grupos** | editor → regras avançadas | aproveitamento |
| Alimentação da próxima fase | editor de formato | juntar todos |
| Formar duplas com os classificados | editor de formato | não |
| Chaveamento (clássico / cruzado) | editor de formato | clássico |
| Disputa de 3º lugar | editor de formato | não |
| **Entrada direta (pular fases)** | **aba de sorteio** | ninguém |
| Pontuação (games, pontos, vantagem) | editor de formato | do torneio |

---

## 8. Receitas

**Torneio de clube, 16 duplas, um sábado**
4 grupos de 4 · passam 2 · chave de 8. Padrões em tudo.

**19 inscritos, e todos querem jogar bastante**
4 grupos [5+5+5+4] · passam 2 · chave de 8. 36 jogos, 3 ou 4 por atleta.

**11 inscritos e três quadras**
3 grupos [4+4+3] com **ida e volta** no grupo de 3 · passam 2 · repescar 2 →
chave de 8 cheia.

**Qualificatória: 24 inscritos, 8 cabeças esperam**
Fase 1: grupos com os 16 não-cabeças, passam 8. Fase 2: chave de 16 com
**entrada direta de 8 cabeças**. Os cabeças jogam a partir das oitavas.

**Campeão defendendo título**
Entrada direta **manual** na fase das quartas, escolhendo o nome.

**Grupos desiguais e regulamento próprio**
Tamanhos à mão (`6, 5, 5`), classificados grupo a grupo (`2, 2, 1`), comparação
por **descartar o último**, desempate com **confronto direto acima de tudo**.

**Torneio relâmpago, 12 inscritos, 2 horas**
Suíço com 4 rodadas — ninguém é eliminado e todos jogam o mesmo tanto.

---

## 9. Banco de dados

**Zero coleção, zero índice, zero regra, zero migração.**

Tudo mora em `tournament_modalities/{id}.stages[]`, que não tem lista fechada
de campos na regra (`allow create, update, delete: if isTournamentAdmin(...)`).
Campos novos, todos opcionais:

| Campo | Padrão | Efeito quando ausente |
|---|---|---|
| `round_robin_legs` | 1 | só ida, como sempre |
| `custom_group_sizes` | `[]` | equilíbrio automático |
| `qualifiers_by_group` | `[]` | o mesmo número para todos |
| `wildcard_slots` | 0 | sem repescagem |
| `wildcard_from_position` | 0 | a colocação seguinte ao corte |
| `tiebreak_order` | `[]` | a ordem oficial |
| `cross_group_method` | `rate` | aproveitamento |
| `direct_entry` | `{mode:'none'}` | ninguém pula fase |

`normalizePhase` preenche os padrões na leitura, então uma modalidade gravada
antes desta onda se comporta exatamente como antes.

---

## 10. Ao mexer nesta área, cuidado com

1. **Não escreva um segundo comparador de classificação.** Ele é um só, em
   `tiebreak.js`, e vale na classificação do grupo, no ranking da modalidade e
   na progressão entre fases. Já houve duas cópias, as duas erradas.
2. **Não compare grupos de tamanhos diferentes por número absoluto** sem que o
   administrador tenha escolhido isso. O padrão é taxa, e é o padrão por um
   motivo aritmético.
3. **Não preencha uma chave da esquerda para a direita.** Todo mundo entra pela
   posição canônica do seu número; é isso que põe o bye no lugar certo e
   impede par vazio.
4. **Não deixe um campo novo sem padrão inerte.** Toda configuração desta área
   é aditiva: em branco, comportamento de antes.
5. **Não esconda a regra do usuário.** Classificação que ninguém consegue
   explicar vira discussão na beira da quadra. Toda configuração tem texto ao
   lado dizendo o que ela causa.
6. **Não presuma que quem entra direto jogou as fases anteriores.** Ele não
   aparece no sorteio delas, e a exclusão acontece na origem
   (`planPhaseEntries`), não como remendo em cada tela.
