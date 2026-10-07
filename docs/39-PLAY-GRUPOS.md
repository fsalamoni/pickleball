# 39 — Play com GRUPOS (flag `play_groups`)

> Flag `play_groups` — **padrão DESLIGADA**. Desligada, nada muda: o Play segue
> uma fila única, exatamente como antes.
> Código: `src/modules/games/domain/playGroups.js` (modelo, nível, formação,
> distribuição) e `playGroupsDraw.js` (a escolha da partida dentro dos grupos).
> UI: `src/v2/components/games/playGroups/`.

## 1. O pedido, em uma frase

*"Direcionar o Play para criar partidas com pessoas de níveis semelhantes: criar
grupos dentro do Play, sortear dentro de cada grupo, respeitando uma ordem de
participação de grupos e de participantes, com formação mista ou de mesmo sexo
conforme o grupo, e um parâmetro de nível para o convidado avulso."*

## 2. O que existia e o que faltava

O Play tem **uma fila só** (`computePlayOrder`): quem espera há mais tempo entra.
Nível e sexo só entram **depois** de escolhidos os quatro, para dividir as
duplas (`assignPlayTeams`). Não havia como dizer "estes jogam entre si".

| Pergunta de quem organiza | Antes | Agora |
|---|---|---|
| Iniciantes jogando com avançados? | Sempre possível | Grupos por faixa de nível |
| Partida só de duplas mistas? | Só preferência fraca | Regra do grupo (exigir ou preferir) |
| Dois grupos disputando as quadras | Impossível | Política: fila, revezamento ou prioridade |
| Reservar a quadra 1 para o grupo A | Impossível | `courts` do grupo |
| Convidado sem conta | Nível 3.0 inventado | Nível e sexo informados na entrada; entra no grupo certo |
| Por que o grupo B não joga? | Ninguém sabia | O cartão diz: "Faltam 2 mulheres para duplas mistas" |

## 3. Conceitos

**Grupo** — um conjunto nomeado e colorido de participantes do dia, com duas
famílias de configuração:

- **Perfil** (quem é do grupo — usado para sugerir e conferir, nunca para
  barrar): faixa de nível (`level_min`–`level_max`, régua 2.0–8.0) e
  `gender` (todos / só mulheres / só homens).
- **Regras da partida** (como o grupo joga — valem no sorteio): `formation`
  (`free` | `mixed` | `same_sex`), `max_level_gap` (diferença máxima de nível
  entre os jogadores da partida) e `strict` (**exigir**: a partida só sai se
  respeitar; **preferir**: tenta, e se não der completa com o que há).

**Política entre grupos** (`play_groups_policy`) — quando duas ou mais
quadras/grupos disputam:

- `queue` (padrão) — entra o grupo cujo primeiro da fila espera há mais tempo.
  É a regra do Play de sempre, estendida: nenhum grupo é "esquecido".
- `rotate` — os grupos se revezam em círculo.
- `priority` — vale a ordem da lista de grupos (o de cima primeiro).

**Quem está sem grupo** forma um grupo implícito, "Sem grupo", de formação livre,
que joga entre si — nunca fica parado. Um grupo pode **completar** a partida
com quem está sem grupo (`fill`), quando faltar gente.

**Quadras do grupo** (`courts`) — vazio = qualquer quadra; preenchido = só
essas. Além disso, quem organiza pode **escolher o grupo de uma partida** na
hora, por quadra, sem mudar a configuração.

## 4. Modelo de dados — ZERO coleção, ZERO índice, ZERO regra

Só campos **opcionais** em documentos que já existem. Ausentes, o dia se
comporta como sempre.

`game_days/{id}`
```
play_groups: [{
  id, name, color,                  // identidade (id estável: nunca renomeie)
  level_min, level_max,             // número 2.0–8.0 ou null
  gender,                           // 'any' | 'male' | 'female'
  formation,                        // 'free' | 'mixed' | 'same_sex'
  max_level_gap,                    // número > 0 ou null
  strict,                           // boolean
  courts,                           // number[]  ([] = qualquer)
  fill,                             // boolean   (completa com "sem grupo")
  paused,                           // boolean   (fora do sorteio por ora)
  join,                             // 'open' | 'closed' (a pessoa pode escolher)
}]
play_groups_policy: 'queue' | 'rotate' | 'priority'
```
`game_days/{id}/participants/{pid}`: `play_group_id: string | null`.
`game_days/{id}/games/{gid}`: `group_id`, `group_name`, `group_color` (cópias,
para o telão e a lista sobreviverem à remoção do grupo).

**Por que não há regra nova.** `game_days` deixa o criador (e, na arena e no
clube, quem gere o dono) gravar qualquer campo; `participants` e `games` não têm
lista fechada de campos para quem opera o dia. Isso é conferido no
`firestore.rules`, não presumido. Configurar os grupos é *configurar* (criador,
gestor da arena, administrador do clube — `canConfigureGameDay`); colocar cada
pessoa num grupo é *operar* (`canManageGameDay`).

**Por que o array mora no dia** (e não numa subcoleção): são ≤ 10 itens
pequenos, lidos junto do dia por todas as telas, inclusive o telão. Uma
subcoleção custaria uma consulta a mais em cada aparelho e uma regra nova.

**Grupo removido.** `play_group_id` apontando para um grupo que não existe é
tratado como "sem grupo" na leitura (`groupIdOf`). Nenhuma cascata é necessária
para o dia continuar certo; o serviço ainda limpa o campo, mas é higiene.

**Flag desligada.** É chave de segurança: com ela desligada os grupos gravados
são **ignorados** no sorteio, na previsão e na tela (o serviço lê a flag como
já faz com `play_smart_rotation`).

## 5. O motor — uma conta só

```
fila de espera (computePlayOrder)
   └─ para cada quadra livre, na ordem de sempre:
        pickGroupedMatch(pool, { court, groups, policy, … })
           1. separa o pool por grupo (+ "sem grupo")
           2. cada grupo elegível propõe uma partida:
                · fora se pausado ou se a quadra não é dele (courts);
                · sem regras → o MESMO seletor de hoje (FIFO ou rodízio);
                · com regras → busca a combinação que respeita formação e
                  diferença de nível, partindo de quem espera há mais tempo
                  e PODE jogar (strict: senão nada; prefer: cai no seletor);
                · fill: completa com quem está sem grupo.
           3. a política escolhe entre as propostas
        → { ids, groupId }
```

Garantias, todas com teste:

- **Sem grupos, é idêntico a antes** — teste de propriedade sobre o motor.
  Grupos configurados mas **ninguém atribuído** também é idêntico.
- **Previsão = criação.** `simulatePlaySequence` (a previsão e a ordem de
  entrada) e o serviço escolhem pelo **mesmo sorteador**, `makeGroupsDrawer`
  (que envolve `pickGroupedMatch`). A previsão o recebe INJETADO (`groups`) em
  vez de importar o sorteio — `playGroupsDraw.js` precisa de peças de
  `playRotation.js`, e importar nos dois sentidos daria um ciclo. É a lição do
  Play: se forem dois códigos, a tela anuncia uma partida e cria outra.
- **Quem espera mais joga**: dentro de um grupo, o primeiro elegível entra
  sempre; com regra exigida, é o primeiro que **consegue** formar partida.
- **Nível desconhecido não barra ninguém** (regra da plataforma): sem nível, a
  pessoa é compatível com qualquer faixa e não entra na conta da diferença.
  Sexo desconhecido não preenche vaga de "mista" nem de "mesmo sexo" exigidas
  — e o cartão do grupo avisa quantos faltam informar.
- **Dupla vinculada** só vale dentro do grupo; vínculo entre grupos diferentes
  é ignorado no sorteio (e a tela avisa). Mover alguém move a dupla junto.
- **Substituição** prefere quem é do mesmo grupo da partida, e nunca trava: sem
  ninguém do grupo, oferece os demais.

Fonte única de nível: o nível unificado 2.0–8.0 (`docs/13-NIVEL-UNIFICADO.md`),
buscado **antes** de escolher (a regra de nível decide *quem entra*, não só as
duplas). Serviço e telas decoram os participantes com `level_value` em memória;
nada é gravado no participante.

## 6. Experiência por persona

**Organizador.** Um cartão **Grupos**, acima de Participantes:
1. *Sem grupos ainda* — três atalhos: **Por nível** (Iniciante · Intermediário ·
   Avançado), **Por tipo de dupla** (Mistas · Masculinas · Femininas) e
   **Em branco**. Um toque cria; depois se edita tudo.
2. *Política* em três cartões com explicação de uma linha.
3. *Cada grupo* mostra cor, nome, faixa, formação, quadras, quantos estão
   no grupo / aguardando / em quadra e **o motivo** quando não joga.
4. **Distribuir por nível** — prévia (quem vai para onde, quem ficou de fora e
   por quê) e só então grava. Sugestão, nunca imposição.
5. *Avisos de configuração* — quadra que nenhum grupo usa, faixa de nível sem
   grupo, gente sem sexo informado num grupo que exige.

Nos participantes: selo colorido do grupo (toque = trocar), e no convidado
avulso, **nível** e **sexo** na própria entrada. Nas quadras: selo do grupo da
partida e, na quadra livre, *"Sortear para: Automático ▾"*. Na previsão e na
ordem de participação, tudo **por grupo**, com numeração própria de cada fila.

**Jogador.** Entra e cai no grupo do seu nível (se o grupo é aberto). Vê
**"Seu grupo"**, a posição na fila *do grupo* e, se o grupo for aberto, troca.

**Arena e clube.** Nada a fazer: o cartão vive dentro do organizador do Play,
que o `GameDayModule` monta nas três origens. Na arena, `courts` mapeia as
quadras reservadas (1..N).

**Telão.** Selo do grupo (versão escura, com o nome sempre escrito — a cor
ajuda, nunca é a única pista) em cada partida em quadra e em cada linha da
previsão; a fila se divide em **seções por grupo**, cada uma com a sua
numeração. O "entra a seguir" **não** é "os quatro primeiros da lista": com
grupos, quatro na fila não quer dizer partida (cada grupo tem as suas regras),
então ele destaca quem a PREVISÃO põe nas quadras livres. Quando nenhum grupo
tem partida pronta, o telão diz isso — *"Nenhum grupo tem partida pronta
ainda (8 na fila)"* — em vez de culpar a falta de gente, e o botão "Criar jogo"
fica travado dizendo o porquê. Quem organiza pelo telão sorteia pela mesma
conta (`courtHasMatch`); a escolha de grupo por quadra é do painel, não do
telão.

**Resumo do dia** (`GameDayRulesCard`). Ganha a linha **Grupos** (nomes e
política) e a nota de que a dupla vinculada só vale dentro do grupo — só com a
flag ligada e o dia em Play.

**Ajuda.** Guia "Dividir o Play em grupos" (dicas guiadas), artigo na Central
de Ajuda e pista de rota em `/dia-de-jogo/*` — os três com
`flags: ['play_groups']`. O guia usa `flagObrigatoria`: ao contrário do guia de
um FORMATO (que vale num dia já gravado mesmo com a flag do formato desligada),
a flag de uma FUNCIONALIDADE tem de valer sempre — ensinar um cartão que não
existe manda a pessoa procurar o que não está lá. O tutorial "Como funciona" do
Play não foi alterado: ele é estático e vale com a flag desligada.

## 7. O que ficou de fora, de propósito

- **Uma pessoa em dois grupos.** A fila é por pessoa e o tempo de espera é um
  só; duas pertenças pediriam duas posições. Quem joga "acima" é movido de
  grupo — um toque.
- **Pesos por grupo** (2 vagas de cada 3 para o grupo A). `priority` e
  `rotate` cobrem o uso real; peso é regra para ninguém conseguir explicar.
- **Grupos nos formatos Americano aprimorado, Mexicano e Rei da Quadra.** Eles
  não têm fila de espera; o motor deles é outro. O domínio é puro e agnóstico
  de formato, então um dia é possível — mas hoje seria prometer o que não há.
- **Empréstimo entre grupos** ("pega do vizinho de nível mais próximo"). Tirar
  gente da fila de outro grupo desfaz a ordem que o outro grupo esperava.

## 8. Onde mexer

| Quero… | Onde |
|---|---|
| Mudar a regra de formação/diferença de nível | `fitsFormation` / `fitsLevelGap` em `playGroups.js` |
| Mudar como o grupo é escolhido | `pickGroupedMatch` em `playGroupsDraw.js` |
| Mudar o motivo mostrado na tela | `explainGroups` em `playGroupsDraw.js` |
| Mudar os atalhos de criação | `PLAY_GROUP_TEMPLATES` em `playGroups.js` |
| Mexer em cor | `PLAY_GROUP_COLORS` (chave, domínio) + `playGroupTheme.js` (classes, UI) |

⚠️ **Nunca** chame `pickGroupedMatch` de uma tela: a previsão recebe o
sorteador (`makeGroupsDrawer`) e o serviço usa o mesmo. Guarda de fonte em
`src/core/guards/playGrupos.test.js`, que também reprova tela que leia
`gameDay.play_groups` por fora de `usePlayGroups` (ignoraria a flag desligada)
e regra/índice do Firestore que mencione os grupos.

⚠️ **Mutações dos grupos moram em `usePlayGroupMutations.js`**, não em
`useGameDays.js`: as seções compartilhadas (participantes, quadras, ordem)
também servem ao Americano aprimorado, e pôr as mutações no hook comum as faria
depender dos grupos — foi o que quebrou 27 testes de tela na primeira tentativa.
Quem precisa delas é um componente-filho (`ParticipantGroupSelect`, `MeuGrupo`,
`PlayGroupsCard`), que só existe com grupos ativos.

## 9. Riscos considerados

| Risco | Tratamento |
|---|---|
| Quebrar o Play atual | Flag OFF + opção `groups` ausente = mesmo caminho; teste de propriedade |
| Previsão ≠ criação | `pickGroupedMatch` único, usado pelos dois |
| Nível lido diferente na tela e no serviço | Mesma função de nível; a tela decora igual ao serviço. Falha de leitura cai no nível declarado nos dois |
| Grupo que nunca joga (regra exigida) | `explainGroups` diz o porquê; `groupsConfigWarnings` avisa antes |
| Quadra sem grupo | Aviso na configuração; "Sem grupo" pode usar qualquer quadra |
| Escrita em lote grande | Distribuir grava ≤ 64 participantes (limite do dia) num lote só |
| Dado pessoal | Nenhum: só id de grupo no participante; sexo e nível já existiam |
| Backward-compat | Campos opcionais; nenhuma migração; `play_group_id` órfão = sem grupo |

## 10. Mapa de arquivos

| Camada | Arquivo |
|---|---|
| Flag | `src/core/featureFlags.js` (`PLAY_GROUPS`) + `featureFlagGroups.js` (grupo "Dia de jogo") |
| Domínio — modelo | `modules/games/domain/playGroups.js` (config, validação, nível, formação, distribuição, descrição) |
| Domínio — sorteio | `modules/games/domain/playGroupsDraw.js` (`pickGroupedMatch`, `makeGroupsDrawer`, `explainGroups`, `buildGroupedPlayView`, `courtHasMatch`) |
| Domínio — motor | `modules/games/domain/playRotation.js` (previsão, ordem de entrada e rodada aceitam `groups`) e `gamePlay.js` (`assignPlayTeams` com `pairing`, `eligibleSwapReplacements` com `preferGroupId`) |
| Serviço | `modules/games/services/gameDayService.js` (`setPlayGroups`, `setPlayParticipantGroup`, `assignPlayGroups`, `resolveEntryGroup`, criação com grupos) |
| Entrada pelo jogo aberto | `modules/arenas/services/openMatchService.js` (`entrarNoJogoLigado` cai no grupo do nível) |
| Hooks | `usePlayGroups.js` (leitura, nível, sorteador) e `usePlayGroupMutations.js` (gravação) |
| UI | `v2/components/games/playGroups/` (`PlayGroupsCard`, `GroupEditor`, `DistributePanel`, `GroupSelect`, `PlayGroupBadge`) + `AthletePlayOrganizer.jsx`, `AthletePlayParticipant.jsx`, `v2/pages/V2GameDayTelao.jsx`, `GameDayRulesCard.jsx` |
| Ajuda | `help/domain/guias.js` (`play-grupos`), `helpCenter.js` (artigo `play-grupos`) |
| Guardas | `src/core/guards/playGrupos.test.js` |

## 11. Limites conhecidos (por desenho, não por esquecimento)

- **Só o Play.** Os outros formatos não têm fila de espera (§7).
- **Quem configura é quem pode escrever o dia.** Criar, editar, pausar e
  reordenar grupos grava `game_days`, e a regra só deixa isso ao criador, ao
  gestor da arena e ao administrador do clube. O administrador **nomeado** do
  dia opera (move gente, sorteia) mas não edita os grupos — e a tela diz isso
  em vez de oferecer um botão que o Firestore recusaria.
- **A escolha de grupo por quadra é do painel**, não do telão: o telão sorteia
  pela política configurada.
- **Convidado sem conta e sem nível** entra "sem grupo" (nível desconhecido não
  barra, mas também não decide) — o formulário pede nível e sexo na entrada
  para evitar isso. O cartão avisa só do SEXO que falta (a conta mista e a de
  mesmo sexo dependem dele); nível ausente é o caso normal de quem acabou de
  chegar e não vira alarme.
- **Sexo não informado** não preenche vaga de formação mista nem de mesmo sexo
  exigida: o cartão diz quantos faltam informar.
- **Dia de Play que já tinha gente** não é redistribuído sozinho: criar grupos
  não mexe em ninguém até quem organiza tocar em "Distribuir por nível" (com
  prévia).

## 12. Verificação feita

- Regras do `firestore.rules` **lidas**, não presumidas: `game_days` aceita
  qualquer campo do criador/gestor; `participants` e `games` não têm lista
  fechada de campos. `git diff` de `firestore.rules`, `firestore.indexes.json`,
  `storage.rules` e `firebase.json` vazio — o guarda confere os dois primeiros.
- Propriedade: grupos ativos com **ninguém atribuído** produzem as mesmas
  partidas que o Play sem grupos (200 cenários).
- Testes de mutação nos três níveis (motor, serviço, tela e telão): cada
  quebra deliberada foi detectada.
