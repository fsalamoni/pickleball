# Avaliação dos "100 drills" para o Centro de Treino

> Pedido do dono (2026-10-09): *"avalie os treinos e drills mapeados nos documentos em anexo… faça a importação de todos que forem adequados e relevantes para o esporte… avaliação individual de cada um, com pesquisa e análise técnica"*.

A fonte é um pacote de 100 drills (PDF + página HTML) escrito com ajuda de IA, em cinco níveis de 20. Cada drill foi lido inteiro, conferido contra as regras da USA Pickleball (livro de 2026) e contra fontes técnicas reconhecidas, e comparado com os 80 itens que a biblioteca já tinha. O que entrou foi **reescrito nas nossas palavras**, no modelo de item da plataforma (`docs/40-CENTRO-DE-TREINO.md` §4), e passa pelo mesmo teste da semente (`content/seed.test.js`).

## Resultado

| Veredito | Drills |
|---|---|
| Importado com correções | 45 |
| Importado como estava | 0 |
| Já existia na biblioteca | 47 |
| Rejeitado | 8 |

Nenhum drill entrou sem correção: a fonte tinha erro de regra (saque com pré-giro, poach na devolução), golpe descrito ao contrário (topspin "abaixo do centro"), números sem fonte, montagens que se contradiziam e português com inglês solto. Das sessões da fonte, **2 viraram treino** (ver o fim). As **imagens** do pacote (posturas geradas por IA) **não foram importadas**: não são verificáveis e a semente não leva mídia.

Arquivos: `src/modules/training/content/seed/importados-nivel1.js` … `importados-nivel5.js` e `treinos-importados.js`; `SEED_VERSION` passou para 2. Os 80 itens da versão 1 não mudaram.

## Os achados que mais pesaram

- **Saque com efeito**: a fonte ensinava girar a bola com a mão ou os dedos antes de bater (drills 8, 59 e o "saque corrente" 67). É falta desde 2023, e o livro de 2026 deixou explícito também o giro dos dedos ao soltar. O 8 e o 59 foram reescritos com o efeito só da raquete; o 67 foi rejeitado. Nos saques entrou o que o livro de 2026 exige "claramente" no saque de voleio (contato abaixo da cintura, raquete subindo em arco, cabeça abaixo do punho).
- **Poach na devolução (88)**: volear a devolução é falta pela regra dos dois quiques. Virou poach na terceira bola, combinado pela dupla que devolve.
- **Erne e ATP (63, 64, 83)**: o Erne responde ao dink paralelo, sem tocar a cozinha nem a linha durante o voleio; o ATP é batido depois do quique e pode passar ao lado do poste, sem limite de altura. A defesa do Erne joga no espaço que ele deixou, não "na linha".
- **Golpes descritos ao contrário**: roll drop, lob com topspin e dink com rolagem são escovados de baixo para cima pela parte de trás da bola; o drop cruzado é o de MAIOR margem (a rede é mais baixa no centro), não o mais difícil.
- **Bola do meio (78 e um diagnóstico)**: "o meio é responsabilidade compartilhada" é o que deixa a bola sem dono. O padrão ensinado: bola lenta é de quem tem o forehand ali; bola rápida, de quem está na diagonal de quem bateu; a chamada vem antes do contato.
- **Segurança**: "joelhos para dentro" (17) virou joelho alinhado com a ponta do pé; o diagnóstico que mandava quem sente o braço latejar fazer mais drill de parede foi rejeitado (dor persistente pede parar e procurar um profissional de saúde).

## Drill a drill

### Nível 1 da fonte

**1. Rebote na Parede** — Importado com correções → `rebatida-de-fundo-no-paredao`, nível 2.0–3.0

Rally de golpes de fundo (forehand e backhand depois do quique) contra a parede, em ritmo médio: treina contato, consistência e a passagem forehand/backhand, sozinho. É exercício solo clássico de iniciante. Distinto de dink-e-drop-no-paredao (toque suave numa faixa) e de voleio-no-paredao (sem quique).

Correções: Distância passou de 3–4 m para 4–5 m e ganhou a linha de 86 cm na parede como referência de altura. · Dicas da fonte eram de foco interno ("punho firme", "queixo doendo", "quadril") e foram trocadas por foco externo (bola, alvo, raquete). · Removida a afirmação sem base de que o braço esticado causa metade das lesões de cotovelo; removida a versão "sentado" e o rebote contra o piso. · Prescrição unificada: 4 séries de 2 min com 45 s de descanso.

Fontes: pickleball.com — What is the best way to practice pickleball alone · topspinpro.com — how to practice pickleball alone · seed_atual.json (biblioteca atual)

**2. Paddle Up (Bolo na Raquete)** — Importado com correções → `bola-quicando-na-raquete`, nível 2.0–3.0

Toques seguidos para cima na raquete (malabarismo de bola): desenvolve controle fino e mão leve, base do dink e do reset. Exercício de iniciante reconhecido, sem equivalente na biblioteca. Útil como aquecimento de mão ou treino em casa.

Correções: "arch: parede" da fonte não fazia sentido (o drill não usa parede); diagrama refeito andando pela linha da cozinha. · Medidas em graus e centímetros de postura e "olhos fechados para acelerar a propriocepção" removidos (sem base e sem utilidade para iniciante). · Progressão reorganizada: altura do peito → cintura → alternar faces → andando; versão fácil com quique no chão.

Fontes: olaben.com — 20+ essential drills for beginners (ball control) · seed_atual.json (biblioteca atual)

**3. Golpes na Sombra** — Importado com correções → `golpes-de-sombra-saque-drop-dink`, nível 2.0–3.0

Repetição do gesto sem bola (saque, drop e dink) diante de um reflexo: ferramenta reconhecida para fixar o desenho do golpe fora da quadra. A biblioteca só tinha golpes de sombra como estação de condicionamento em circuito-de-quadra, com outro objetivo. Encaixa como treino em casa.

Correções: Texto da fonte tinha inglês solto e erros ("conscious", "worked independently", "fila de banco"). · Cadeia "tornozelo, joelho, quadril, ombro, cotovelo, punho" e dicas de foco interno trocadas por referência externa (marca no chão, alvo). · Removida a promessa sem base de que "50 repetições por dia rendem mais que 300 jogando". · Volume reduzido de 50 para 20 por golpe, com conferência no reflexo; saque descrito dentro da regra (contato abaixo da cintura, de baixo para cima).

Fontes: pickleball.com — practice alone (shadow swings) · USA Pickleball Official Rulebook 2025/2026 (4.A.5, 4.A.7, 4.A.8, 4.E) via playpickleball.com/2025-usa-pickleball-rules-section-4 · seed_atual.json (biblioteca atual)

**4. Caixa-Alvo na Parede** — Importado com correções → `dois-alvos-na-parede-direcao`, nível 2.0–3.0

Alvo marcado na parede para treinar a direção do golpe de fundo, com anúncio do alvo antes de bater. Acrescenta decisão de direção, que não existe nos drills de parede atuais (que medem altura/toque ou voleio).

Correções: Passos 1 e 2 da fonte eram repetidos; a fonte falava em "alvo no chão" numa caixa na parede e em bater "de costas para a parede" (sem sentido). · Uma caixa virou duas (esquerda/direita), com anúncio do alvo: o que se treina é a escolha de direção. · Distâncias realistas (3 a 6 m) e regra de recuar só com 7/10 e voltar abaixo de 4/10. · Dicas de foco externo no lugar de "rotação do quadril".

Fontes: pickleball.com — practice alone · seed_atual.json (biblioteca atual)

**5. Controle de Ponto Curto** — Já existia → já coberto por `reset-de-bloqueio-nos-pes`

Treina a bola que quica no pé (meia-volée). A montagem da fonte é incoerente (dois jogadores no fundo, "sem rede entre eles") e a habilidade já está coberta por reset-de-bloqueio-nos-pes, cuja variação fácil é exatamente a alimentação com a mão e devagar, com devolução depois do quique ou de voleio.

Correções: Não importado.

Fontes: seed_atual.json (biblioteca atual)

**6. Saque de Cesto** — Já existia → já coberto por `saque-fundo-com-alvo`

Série de saques com cesto para consistência, nas duas diagonais: mesma habilidade, montagem e tarefa de saque-fundo-com-alvo (cuja variação fácil é a área inteira com meta de 8/10 válidos). A progressão saque com quique → saque de voleio já está no fundamento saque. A fonte tem erro de regra: diz que saque com contato na altura do peito é "sempre falta", o que vale para o saque de voleio, não para o saque com quique, que não tem restrição de altura (4.A.8.c).

Correções: Não importado; erro de regra registrado.

Fontes: USA Pickleball Official Rulebook 2025/2026 (4.A.5, 4.A.7, 4.A.8, 4.E) via playpickleball.com/2025-usa-pickleball-rules-section-4 · seed_atual.json (biblioteca atual)

**7. Alvos de Saque Profundo** — Já existia → já coberto por `saque-fundo-com-alvo`

Saque para além de uma corda perto da linha de fundo, com alvos: é o mesmo drill de saque-fundo-com-alvo (cones no terço final + alvo). A parte da devolução funda é devolucao-de-saque-funda. A fonte ainda se contradiz (corda a 0,9 m e exigência de "2 m de margem") e dá uma dica sem sentido ("encoste a rede com o topo da bola").

Correções: Não importado.

Fontes: seed_atual.json (biblioteca atual) · pickleball.global — Serves and Returns (coaching material)

**8. Rotação de Spin no Saque** — Importado com correções → `saque-com-efeito-da-raquete`, nível 3.0–4.0

O passo 1 da fonte manda girar a bola antes de bater ("pré-spin"), o que é falta desde 2023: a regra 4.A.5 proíbe dar efeito à bola na soltura com qualquer parte do corpo ou com a raquete, no saque de voleio e no de quique. O efeito gerado pela raquete no contato é legal, e saque com efeito tem lugar no jogo. Adaptado para efeito só da raquete, respeitando no saque de voleio a cabeça da raquete abaixo do punho, contato abaixo da cintura e arco para cima (4.A.7).

Correções: Removido o pré-giro com a mão/raquete (ilegal); a montagem explica a regra. · Nível subiu de L1 para 3.0–4.0: efeito no saque só depois de o saque liso entrar com consistência (a própria fonte pede 9/10 liso antes). · "Backspin/topspin no backhand" e "raqueta no ball" corrigidos; efeito lateral recomendado de preferência no saque com quique, que não tem as restrições do de voleio. · Errado sem certo ao lado corrigido: dois certos para um errado.

Fontes: USA Pickleball Official Rulebook 2025/2026 (4.A.5, 4.A.7, 4.A.8, 4.E) via playpickleball.com/2025-usa-pickleball-rules-section-4 · USA Pickleball Official Rulebook 2023 (proibição do saque com giro dado na soltura) · pickleheads.com — pickleball spin serve ban · thedinkpickleball.com — how new rules affect your spin serves

**9. Retorno Profundo sem Rally** — Já existia → já coberto por `devolucao-de-saque-funda`

Saque e devolução funda para além de uma marca, sem jogar o ponto, contando 10 e trocando: idêntico a devolucao-de-saque-funda. A dica "fique no lado de forehand" e "contato atrasado, perto do corpo" da fonte são discutíveis.

Correções: Não importado.

Fontes: seed_atual.json (biblioteca atual) · thedinkpickleball.com — return of serve placement

**10. Saque + Retorno Profundo** — Já existia → já coberto por `devolucao-de-saque-funda`

Junta saque fundo e devolução funda com contagem: a montagem e a tarefa são as de devolucao-de-saque-funda e saque-fundo-com-alvo; a parte de jogar o ponto e pontuar a terceira bola já está em terceira-bola-ao-vivo e devolver-e-chegar-a-cozinha. A fonte ainda manda "recuar para o fundo", o contrário do que a devolução pede (subir à cozinha).

Correções: Não importado.

Fontes: seed_atual.json (biblioteca atual)

**11. Alvos de Retorno por Zona** — Importado com correções → `devolucao-em-tres-alvos-fundos`, nível 2.5–3.5

Devolução com alvo anunciado antes do contato: acrescenta direção e decisão à devolução funda, o que a biblioteca não tinha. Fundo no meio (dúvida de quem bate) e fundo no backhand do sacador são os alvos defendidos por treinadores.

Correções: Removido o alvo "curto central" da fonte: devolução curta contradiz o próprio objetivo (e o drill 9) e entrega a terceira bola. · Todos os alvos ficam na faixa funda (cerca de 1 m da linha de fundo); o devolvedor anda à cozinha depois de cada bola. · Nível ajustado para 2.5–3.5: pede devolução funda já consistente.

Fontes: thedinkpickleball.com — return of serve placement: 3 spots · pickleball.global — Serves and Returns (Drill Seven) · thepickler.com — basic pickleball tips · seed_atual.json (biblioteca atual)

**12. Dink Reto** — Já existia → já coberto por `dink-paralelo-junto-a-lateral`

Dink reto, frente a frente, em meia quadra, contando seguidos: mesmo drill de dink-paralelo-junto-a-lateral (e primeiros-dinks-com-alimentador para quem começa). Conteúdo técnico da fonte é aceitável (contato baixo, face aberta), mas nada acrescenta.

Correções: Não importado.

Fontes: seed_atual.json (biblioteca atual)

**13. Dink Cruzado** — Já existia → já coberto por `dink-cruzado-pe-de-dentro`

Dinks cruzados na diagonal com contagem de 20 seguidos e troca de lado: coberto por dink-cruzado-pe-de-dentro (e dink-em-oito para a alternância). A fonte erra ao dizer que no cruzado o arco tem de ser mais alto; a vantagem do cruzado é a rede mais baixa no meio e a distância maior.

Correções: Não importado.

Fontes: seed_atual.json (biblioteca atual)

**14. Drop do Baseline** — Já existia → já coberto por `drop-terceira-bola-com-alimentador`

Drop do fundo com o parceiro na cozinha como referência e meta de acertos: é drop-terceira-bola-com-alimentador (e escada-do-drop para a progressão de distância). A dica de ápice do arco do lado de quem bate está correta.

Correções: Não importado.

Fontes: seed_atual.json (biblioteca atual)

**15. Rally de Groundstroke** — Já existia → já coberto por `drive-cruzado-de-fundo`

Troca de golpes de fundo com exigência de profundidade e contagem: mesma habilidade e montagem de drive-cruzado-de-fundo (cones marcando o fundo). A montagem da fonte ("sem rede entre eles") é incoerente.

Correções: Não importado.

Fontes: seed_atual.json (biblioteca atual)

**16. Shuffle Lateral de Linha** — Já existia → já coberto por `deslocamento-lateral-com-cones`

Deslocamento lateral sem cruzar as pernas entre cones na linha da cozinha, tocando com a raquete, 30 s de trabalho: idêntico a deslocamento-lateral-com-cones (inclusive séries e descanso). A dica da fonte "quadril abaixo do joelho" é exagerada.

Correções: Não importado.

Fontes: seed_atual.json (biblioteca atual)

**17. Escada de Agilidade** — Importado com correções → `escada-de-agilidade-pes-rapidos` (fisico), nível 2.0+

Padrões de escada (dentro-dentro-fora-fora, passo lateral) para frequência e leveza dos pés, terminando com freada e split step para aproximar do jogo. Não há item de escada na biblioteca (o material "escada" existe na taxonomia). Treino de agilidade ajuda o equilíbrio e o deslocamento, que estão ligados às quedas e entorses comuns no pickleball.

Correções: Corrigida a dica perigosa "joelhos para dentro": joelho caindo para dentro (valgo) aumenta o estresse no joelho; agora o certo é joelho alinhado com a ponta do pé. · Acrescentados aquecimento antes, qualidade antes de velocidade e a frase-padrão de segurança. · Freada em split step no fim de cada passagem, para levar o ganho para o jogo. · Removida a versão "de um pé só na parede".

Fontes: Harvard Health — Stay safe playing pickleball · tennis.com — Feet of strength: ladder drills for pickleball · seed_atual.json (biblioteca atual)

**18. Roda Rolante** — Rejeitado

Incoerente: "role a bola com a mão em direção à parede, bata contra a parede e volte" enquanto caminha 10 passos; o nome em inglês fala em pegar a bola e as progressões em "três bolas em rotação". Não há tarefa clara para virar drill, e o objetivo declarado (contato na altura do quadril, troca forehand/backhand) já é atendido por rebatida-de-fundo-no-paredao e voleio-no-paredao.

Correções: Não importado.

Fontes: seed_atual.json (biblioteca atual)

**19. Rotina de Ponto** — Já existia → já coberto por `rotina-entre-pontos`

Rotina curta entre pontos (soltar, respirar, decidir): mesma habilidade e tarefa do estudo rotina-entre-pontos, cujo objetivo já é usá-la em todos os pontos de um jogo. A fonte se contradiz (5, 8 e 10 segundos/passos); a referência de regra é que o sacador tem 10 s depois de cantado o placar (4.E).

Correções: Não importado; limite de tempo conferido na regra.

Fontes: USA Pickleball Official Rulebook 2025/2026 (4.A.5, 4.A.7, 4.A.8, 4.E) via playpickleball.com/2025-usa-pickleball-rules-section-4 · seed_atual.json (biblioteca atual)

**20. Jogo de Dink Skinny** — Já existia → já coberto por `dink-ate-11`

Jogo até 11 só com dinks: é dink-ate-11 (e skinny-singles para o jogo em meia quadra completo). A regra de pontuação da fonte é incoerente ("2+ erros consecutivos perde o ponto", "erro na rede custa 2 pontos").

Correções: Não importado.

Fontes: seed_atual.json (biblioteca atual)

### Nível 2 da fonte

**21. Dink de Pé Externo** — Importado com correções → `dink-cruzado-pe-de-fora`, nível 2.5–4.0

Treina o dink cruzado mirando o pé de fora do adversário, um alvo reconhecido para tirá-lo da linha e abrir o meio. É distinto do dink-cruzado-pe-de-dentro (outro alvo e outro efeito tático). Nível máximo estendido para 4.0 porque a variação mais difícil vira o padrão pé de fora, pé de fora, pé de dentro, usado por jogadores intermediários.

Correções: Retirada a orientação contraditória "evite o dink no pé interno" (o pé de dentro é alvo válido e complementar). · O alvo passou a ser uma faixa meio metro para dentro da lateral: a lateral é limite, não alvo. · Absorvido o seguimento "bola larga, depois o meio que abriu" do drill 24 na variação mais difícil. · Removidas instruções de corpo nas dicas; texto reescrito sem termos em inglês ("pace", "NVZ").

Fontes: Pickleball Union — padrão de dink pé de fora/pé de dentro (pickleballunion.com/pickleball-dink-pattern) · The Dink — erros do dink largo (thedinkpickleball.com/wide-pickleball-dink-mistakes-and-how-to-fix-them-fast) · USA Pickleball — Official Rulebook vigente (altura da rede, zona de não-voleio)

**22. Dink de Pé Interno** — Já existia → já coberto por `dink-cruzado-pe-de-dentro`

O drill pede dink "para o meio, entre os dois adversários", mas é montado para 2 jogadores, em que não existe "entre os dois"; com um só adversário, o alvo equivale ao pé de dentro, já treinado em dink-cruzado-pe-de-dentro. O aspecto de dupla (quem pega a bola do meio) está em bola-do-meio-quem-chama. Usa "Meet-in-the-Middle" de forma imprópria e contradiz o drill 21.

Fontes: Pickleball Union — inside foot dink (pickleballunion.com/inside-foot-dink) · Pickleball Union — padrão de dink pé de fora/pé de dentro (pickleballunion.com/pickleball-dink-pattern)

**23. Triângulo de Dinks** — Importado com correções → `dink-tres-alvos-ordem-chamada`, nível 2.5–3.5

Treina mudar a direção do dink com o mesmo gesto e o mesmo ritmo, primeiro em ordem fixa e depois com o alvo chamado pelo parceiro (prática aleatória). Não existe na biblioteca: o dink-em-oito tem papéis fixos e previsíveis. Bom para tirar a leitura do adversário.

Correções: A fonte mandava olhar o ombro do adversário "e não a bola" o tempo todo; corrigido: olho na bola e atenção à chamada. · Progressões 23C e 23D eram repetidas; substituídas por variações com alavanca clara (dois alvos / chamada tardia). · Montagem definida: três cones a um palmo da linha, um metro à esquerda, à frente e à direita do parceiro.

Fontes: Pickleball Union — padrão de dink pé de fora/pé de dentro (pickleballunion.com/pickleball-dink-pattern) · Pickleball Union — inside foot dink (pickleballunion.com/inside-foot-dink)

**24. Dink na Lateral** — Já existia → já coberto por `dink-paralelo-junto-a-lateral`

Dink com alvo junto à lateral: a montagem (faixa marcada perto da linha lateral) e a tarefa repetem dink-paralelo-junto-a-lateral, e a versão cruzada coincide com o drill 21. O único acréscimo, mandar a bola seguinte ao meio que abriu, foi incorporado à variação mais difícil de dink-cruzado-pe-de-fora.

Fontes: The Dink — erros do dink largo (thedinkpickleball.com/wide-pickleball-dink-mistakes-and-how-to-fix-them-fast) · Pickleball Union — padrão de dink pé de fora/pé de dentro (pickleballunion.com/pickleball-dink-pattern)

**25. Regra dos 10 Dinks** — Já existia → já coberto por `dink-ate-11`

Paciência no rally de dink com contagem e ataque liberado depois; dink-ate-11 já cobre o jogo só de dink, a contagem cooperativa (variação fácil) e o ataque da bola acima da rede (variação difícil), e dink-e-ataque-da-bola-alta ensina o gatilho certo do ataque. A fonte ainda liberava o ataque pela contagem (11ª bola), quando o critério correto é a altura da bola.

Fontes: Pickleball.com — dica do Parenteau para evitar a bola que sobe (pickleball.com/learn/parenteaus-pro-tip-how-to-prevent-pop-ups-in-pickleball)

**26. Drop e Avanço** — Já existia → já coberto por `reset-na-zona-de-transicao`

Drop do fundo, avanço curto e parada com split step no contato do adversário: é a sequência de reset-na-zona-de-transicao (drop, dois passos, split step, reset, avanço) e de split-step-no-tempo-certo. A fonte é confusa (o adversário "devolve um drop" para quem está no fundo) e as progressões C e D são idênticas.

Fontes: The Dink — por que o drop falha: split step antes do contato (thedinkpickleball.com/why-your-third-shot-drop-keeps-failing-fix-this)

**27. Drop Cruzado** — Importado com correções → `drop-cruzado-da-terceira-bola`, nível 2.5–4.0

Treina o drop da terceira bola na diagonal, que passa pela parte mais baixa da rede e tem mais quadra para cair. Os drops da biblioteca miram a cozinha da frente ou o meio, então o alvo diagonal é acréscimo real. Faixa 2.5–4.0, igual aos outros drills de drop.

Correções: A fonte dizia que o drop cruzado é "a versão de maior dificuldade" e "mais lento"; corrigido: é o alvo de maior margem (rede de 86 cm no centro × 91 cm nas laterais e diagonal mais longa), e a dificuldade é a mudança de direção. · Removida a referência ao "drill 41" e o termo "return". · Ordem "lado fácil primeiro" trocada por "lado mais fraco primeiro, depois o forte", coerente com o critério da própria fonte.

Fontes: The Dink — onde mirar o drop da terceira bola; rede de 36 pol. nas laterais e 34 no centro (thedinkpickleball.com/where-to-aim-your-third-shot-drop-every-time) · USA Pickleball — dica de drop para o meio na dúvida (usapickleball.org) · USA Pickleball — Official Rulebook vigente (altura da rede, zona de não-voleio)

**28. Drop na Corrida** — Importado com correções → `drop-em-deslocamento-bola-larga`, nível 3.0–4.0

Treina o drop depois de sair do meio da linha de fundo para uma bola funda e larga, situação real da terceira e da quinta bola. A biblioteca só tem drops com bola no meio (o deslocamento aparece só numa variação da escada-do-drop). Nível subido para 3.0 porque exige o drop já consistente parado.

Correções: A fonte mandava "soltar o drop no meio do passo, sem parar, porque parar é mais lento"; corrigido: chegar cedo com passos curtos e estar equilibrado no contato (pode estar em movimento, mas estável). · Acrescentada a decisão que os treinadores recomendam: esticado ao máximo, um lob alto e fundo no meio em vez de forçar o drop. · Progressões C e D eram iguais; reescritas.

Fontes: The Dink — 6 situações de drop: esticado na lateral, prefira lob (thedinkpickleball.com/6-third-shot-drop-situations-and-the-right-shot-each-time) · The Dink — por que o drop falha: split step antes do contato (thedinkpickleball.com/why-your-third-shot-drop-keeps-failing-fix-this)

**29. Corda de Profundidade** — Já existia → já coberto por `devolucao-de-saque-funda`

Devolução de saque com marca de profundidade perto da linha de fundo: mesma habilidade, mesma montagem (alvo marcado no terço final) e mesma meta de devolucao-de-saque-funda; aproximar a marca é só a variação mais difícil. A fonte tem trechos corrompidos ("saquesAlternate") e afirma que a devolução é batida "na altura do peito", o que não procede.

Fontes: USA Pickleball — Official Rulebook vigente (altura da rede, zona de não-voleio)

**30. Vôleio Bloqueado** — Já existia → já coberto por `voleio-de-bloqueio-contra-drive`

Bloqueio da bola rápida na cozinha, devolvendo curto: é voleio-de-bloqueio-contra-drive (e reset-de-bloqueio-nos-pes para as bolas baixas). A fonte tem erro técnico: diz que a bola que sobe é sinal de face "fechada" e manda "abrir"; é o contrário (face aberta demais ou mão apertando), e o movimento de "só punho" também contraria a técnica de punho firme.

Fontes: Pickleball.com — dica do Parenteau para evitar a bola que sobe (pickleball.com/learn/parenteaus-pro-tip-how-to-prevent-pop-ups-in-pickleball)

**31. Batalha de Vôleo** — Já existia → já coberto por `troca-rapida-de-voleios`

Troca rápida de voleios na rede, cooperativa e depois competitiva: idêntico a troca-rapida-de-voleios (inclusive a variação que vira ponto). A fonte foca o gesto no "punho e antebraço", o que vai contra o voleio compacto com punho firme, e traz números sem base ("8 minutos por semana é o teto").

Fontes: Pickleball.com — dica do Parenteau para evitar a bola que sobe (pickleball.com/learn/parenteaus-pro-tip-how-to-prevent-pop-ups-in-pickleball)

**32. Sobrecarga na Parede** — Rejeitado

Vago e contraditório: a montagem diz 6–7 m da parede e o mapa diz 2,5 m; a tarefa pede bola "quicando na altura do peito" e golpe "logo após o quique", o que não descreve um golpe identificável (voleio, meio-voleio ou drive). Também afirma, sem base, que é "o drill de ombro mais eficiente, impacto zero". O que se aproveitaria (troca rápida na parede) já está em voleio-no-paredao.

Fontes: Engage Pickleball — drills de reset na parede (engagepickleball.com/blogs/tips/drills-to-improve-resets-in-pickleball)

**33. Dinks na Parede** — Já existia → já coberto por `dink-e-drop-no-paredao`

Toque suave na parede com faixa logo acima da altura da rede: mesma montagem, mesma tarefa e mesma meta de dink-e-drop-no-paredao (que ainda inclui o recuo para o drop, a progressão 33D da fonte).

Fontes: Engage Pickleball — drills de reset na parede (engagepickleball.com/blogs/tips/drills-to-improve-resets-in-pickleball)

**34. Lóbulo da Cozinha** — Já existia → já coberto por `lob-de-ataque-no-dink`

"Lóbulo" é o lob: lob de ataque disfarçado no meio do rally de dink, já coberto por lob-de-ataque-no-dink (inclusive a progressão com bola na mão). A fonte tem erro grave: manda o lob "cair além da linha de fundo" (fora) e mistura alvo a 3 m da linha de fundo com o próprio texto; traz também estatística inventada ("3% do jogo").

Fontes: Pickleball.com — como jogar o lob; lob fundo: deixar quicar (pickleball.com/docs/en/article/how-to-hit-a-pickleball-lob)

**35. Smash Dirigido** — Já existia → já coberto por `smash-depois-do-lob`

Smash com alvo escolhido (pés, ângulo) em vez de força: smash-depois-do-lob já pede o smash para os pés ou o meio, virando de lado e apontando a bola com a mão livre, e a variação difícil inclui decidir entre smash e outra bola. Escolher entre mais alvos é só uma variação.

Fontes: The Dink — defesa do lob: lob curto é smash, fundo deixa quicar, virar e correr (thedinkpickleball.com/pickleball-lob-defense-for-seniors-5-fixes-that-work)

**36. Defesa de Lóbulo** — Já existia → já coberto por `smash-depois-do-lob`

Decidir entre smash e deixar quicar diante do lob: é a variação mais difícil de smash-depois-do-lob, e o recuo seguro (virar e correr, deixar quicar e devolver) está em lob-e-recuperacao e recuo-seguro-virar-e-correr. A fonte inverte a regra ("lob alto e bom, pegue no ar"): o lob curto se finaliza com smash, o lob fundo se deixa quicar.

Fontes: The Dink — defesa do lob: lob curto é smash, fundo deixa quicar, virar e correr (thedinkpickleball.com/pickleball-lob-defense-for-seniors-5-fixes-that-work) · Pickleball.com — como jogar o lob; lob fundo: deixar quicar (pickleball.com/docs/en/article/how-to-hit-a-pickleball-lob)

**37. Bloqueio de Absorção na Parede** — Importado com correções → `reset-de-absorcao-no-paredao`, nível 2.5–4.0

Treino solo do reset contra bola com força: drive na parede e a volta amortecida para tocar logo acima da linha da rede e cair perto. Os drills de parede da biblioteca treinam voleio e toque, não a absorção de força. Proposta reconhecida por treinadores (drive forte e reset na parede).

Correções: A fonte mandava bloquear "o mais perto possível do solo"; corrigido para uma faixa logo acima da linha de 86 cm (abaixo dela seria bola na rede). · Retirado o "movimento de 1–2 cm só de punho": gesto curto com a mão firme e a raquete quase parada. · Acrescentados o critério do quique a menos de 1 m e a progressão de aproximação à parede.

Fontes: Engage Pickleball — drills de reset na parede (engagepickleball.com/blogs/tips/drills-to-improve-resets-in-pickleball) · My Pickleball Connect — plano solo: drive forte e reset na parede (mypickleballconnect.com/guides/4-week-solo-pickleball-practice-plan) · Pickleball.com — dica do Parenteau para evitar a bola que sobe (pickleball.com/learn/parenteaus-pro-tip-how-to-prevent-pop-ups-in-pickleball)

**38. Shuffle Sem Cruzar** — Importado com correções → `dink-com-deslocamento-lateral-sem-aviso`, nível 2.5–3.5

Une o passo lateral ao dink com alimentação aleatória: a pessoa se desloca sem saber o lado e precisa chegar parada para dinkar. O físico deslocamento-lateral-com-cones treina só o passo, sem bola, e o dink-em-oito tem padrão fixo; por ter bola e dink como resultado, entrou como drill e não como físico.

Correções: A fonte proibia cruzar as pernas sempre; corrigido conforme a USA Pickleball: passos laterais para a bola perto e passo cruzado aceito na bola muito larga do backhand. · Retirado "olhe o ombro do alimentador, não a bola". · Lista de erros da fonte tinha o mesmo erro duas vezes; reescrita com três erros distintos.

Fontes: USA Pickleball — padrões de pés na linha da cozinha: passo lateral e cruzado só no backhand largo (usapickleball.org/pickleball-training-tips/advanced-kitchen-line-footwork-patterns-offensive-and-defensive)

**39. Subida Controlada (Earn Your Way)** — Já existia → já coberto por `reset-na-zona-de-transicao`

Avançar do fundo à cozinha em etapas, resetando e parando a cada bola: é a tarefa de reset-na-zona-de-transicao (avança se o reset caiu na cozinha), e a versão com pontos é o jogo-7-11. A fonte repete o drill 26 e tem trecho sem sentido ("diagonal reta em vez de diagonal").

Fontes: The Dink — por que o drop falha: split step antes do contato (thedinkpickleball.com/why-your-third-shot-drop-keeps-failing-fix-this)

**40. Aquecimento de Bolso** — Já existia → já coberto por `aquecimento-dinamico`

Aquecimento progressivo de 5 a 8 minutos (trote, mobilidade dinâmica, deslocamento lateral, golpes de sombra e dinks): mesma estrutura de aquecimento-dinamico, que já termina com dinks leves e tem as versões curta e longa. A fonte acrescenta saques progressivos, detalhe de variação, e números sem base ("nove de cada dez lesões", "causa nº 1 de lesão").

Fontes: Revisões sobre aquecimento dinâmico × alongamento estático (ACSM 2011; Lauersen et al. 2014, BJSM; Opplert & Babault 2018, Sports Med)

### Nível 3 da fonte

**41. Leitura Drop ou Drive** — Importado com correções → `terceira-bola-drop-ou-drive-anunciado`, nível 3.0–4.0

Treina a DECISÃO da terceira bola (drop × drive), não só o golpe — algo que a biblioteca não tinha isolado (há o padrão drive-3ª/drop-5ª e a terceira bola ao vivo). A regra da fonte está alinhada com o consenso (devolução funda/baixa ou adversário na cozinha → drop; curta/alta, você parado e adversário no meio → drive), mas faltava o critério da altura da bola e a montagem não fazia o adversário se mover. Recebeu o drill 44 (anúncio com sinal) como variação.

Correções: Montagem refeita: o devolvedor decide depois de bater se sobe à cozinha ou para no meio, para haver posição a ler · Critério da decisão completado com altura/profundidade da bola (bola baixa não se dribla com drive) · Removidos 'olhe o quadril/ombro do adversário' e o '0,3 s' sem base; anúncio no quique da bola · Drill 44 (sinal) incorporado como variação mais fácil · Typos ('porbir') e 'pré-giro de quadril' retirados das dicas

Fontes: pickleball.com — Drop or drive: mastering the third shot decision · The Kitchen Pickle — Drop vs. Drive: choosing your third shot · Pickleball Effect — third shot strategy (análise de ralis profissionais)

**42. Drop Roll** — Importado com correções → `drop-com-topspin-roll-drop`, nível 3.0–4.5

O drop com topspin (roll drop) é técnica reconhecida, distinta do drop empurrado que a biblioteca já tem: a bola passa com mais folga e mergulha. A fonte descrevia o gesto ao contrário ('de cima para baixo') e trazia afirmações sem sentido ('recupera atrás da rede'). Nível máximo estendido a 4.5 porque o golpe pede o drop sem efeito já consolidado e é usado sobretudo de 3.5 para cima.

Correções: Gesto corrigido: raquete de baixo para cima escovando a parte de trás da bola (o texto dizia de cima para baixo) · Contato depois do ponto mais alto, na frente do corpo (não 'no topo do quique') · Construção do meio da quadra para o fundo, como os treinadores recomendam · Removida a frase 'mais seguro que o push'; o push segue como padrão e o topspin como segunda opção · Alternância push × topspin (drill 43) entrou como variação mais difícil

Fontes: Pickleball Union — Topspin vs push drop · pickleball.com — Six third shot drops · The Dink — 6 third shot drop techniques

**43. Drop Empurrado** — Já existia → já coberto por `drop-terceira-bola-com-alimentador`

O drop empurrado (sem efeito, face aberta, pernas fazendo a força) é exatamente o drop que 'drop-terceira-bola-com-alimentador' e 'escada-do-drop' já treinam, com a mesma montagem (fundo × alimentador na cozinha) e o mesmo critério. O único elemento novo — alternar push e topspin — foi para a variação mais difícil do roll drop (42).

Fontes: Pickleball Union — Topspin vs push drop

**44. Mix de Drop e Drive com Sinal** — Já existia → já coberto por `terceira-bola-drop-ou-drive-anunciado`

Mesmo drill do 41 (anunciar drop ou drive antes de bater), só trocando quem anuncia. Não justifica item separado: virou a variação mais fácil do item criado a partir do 41 (o parceiro anuncia a devolução e você executa). Não duplica nada da semente atual; duplica o item novo do mesmo lote.

Correções: Fundido no item do drill 41

**45. Drop na Transição** — Já existia → já coberto por `escada-do-drop`

Drop a partir do meio da quadra e com deslocamento até a bola já está em 'escada-do-drop' (degrau da zona de transição e variação em que o executor sai do cone para buscar a bola) e em 'reset-na-zona-de-transicao' (drop, avanço, split step, repetição). A ideia central da fonte — bater 'sem parar', no meio da corrida — contraria o ensino do split step e do equilíbrio no contato, então não foi aproveitada como novidade.

Fontes: Pickleball Union — Transition to the kitchen safely · The Pickleball Clinic — How to master the transition zone

**46. Mix de Dinks Alto e Baixo** — Importado com correções → `dink-com-dois-arcos-rasante-e-alto`, nível 3.0–4.0

Variar arco e ritmo do dink (rasante × de arco, mais lento e fundo) é recurso reconhecido para quebrar o ritmo do adversário, e nenhum dink da biblioteca o treina. A justificativa da fonte estava errada ('dink baixo cria ângulo de smash', 'força o smash para bloquear', 'alto é mais seguro'). Reescrito com critério objetivo: os dois arcos caem na cozinha e nenhum pode ser alcançado no ar acima da fita.

Correções: Removida a lógica de 'ângulo de smash' e de forçar o smash · Dink 'alto' redefinido como dink de arco com o ponto mais alto do seu lado, caindo perto da linha · Critério de bola atacável (alcançada no ar acima da fita) zera a conta · Typos ('anthropogenic', 'crear') removidos

Fontes: Joola Brasil — Variação de dinks · My Pickleball Connect — Bump dink · pickleball.com — How to dink

**47. Dink por Pontos** — Já existia → já coberto por `dink-ate-11`

Jogo de dinks até 11 com speed-up liberado depois de alguns dinks é o 'dink-ate-11' (e sua variação mais difícil, que libera o ataque à bola acima da rede). A penalidade de 2 pontos para erro na rede é um ajuste de pontuação, não um drill novo. A fonte ainda se contradiz (primeiro a 7, depois a 11; limite de 5 bolas que impede os 10 dinks).

**48. Leitura de Ataque no Dink** — Já existia → já coberto por `dink-e-ataque-da-bola-alta`

Rally de dink em que só a bola alta pode ser atacada é o 'dink-e-ataque-da-bola-alta', com montagem e meta equivalentes. Além disso, a fonte tem dois erros técnicos: bola atacável é a que está acima da altura da rede (não 'acima do ombro', que já é bola de smash) e, depois de atacar, o jogador se mantém na linha pronto, não 'recua'.

Fontes: Selkirk — Master the pickleball speed-up

**49. Zona 7-11** — Rejeitado

Não é o 'jogo 7-11' da biblioteca (que é um jogo de pontuação 7 × 11 entre quem está no fundo e quem está na rede, o formato usado por DUPR e treinadores). A fonte inventa uma 'faixa entre as linhas 7 e 11' (2,1 a 3,4 m da rede), que é o primeiro metro atrás da linha da cozinha — não a terra de ninguém —, e manda parar ali, onde o certo é terminar de chegar à linha. O núcleo válido (parar no tempo do adversário e resetar no meio da quadra) já está em 'reset-na-zona-de-transicao' e 'split-step-no-tempo-certo'.

Fontes: DUPR — This 7/11 pickleball drill feels unfair · The Dink — two-person drills (7-11)

**50. Reset e Avanço** — Já existia → já coberto por `reset-na-zona-de-transicao`

Avançar do fundo, parar, resetar a bola forte para a cozinha e avançar de novo até a linha é exatamente 'reset-na-zona-de-transicao' (mesma montagem, mesma sequência, meta de chegar à linha em poucos golpes). O treino de transição da biblioteca também já combina split step, reset e o jogo 7-11.

Fontes: The Pickleball Clinic — How to master the transition zone

**51. Rampa de Ataque** — Importado com correções → `voleio-na-rede-decidir-pela-altura`, nível 3.0–4.0

A ideia útil — decidir entre amortecer e atacar pela altura da bola — é central no jogo de rede, mas a fonte a inverte ('acima do ombro é rápida demais, resete' e, ao mesmo tempo, 'acima do ombro é smash'). Refeito como prática aleatória de voleio com três alturas: abaixo da fita amortece, entre fita e peito voleio firme, alta e curta smash. Distinto dos drills de voleio existentes, que treinam um golpe por vez.

Correções: Regra da decisão corrigida: contato abaixo da altura da rede → amortecer; acima → atacar para baixo · Fases da fonte (cintura/peito/acima do ombro, contraditórias) trocadas por bloco e depois aleatório · Alvo do ataque nos cones ao lado do alimentador, com óculos (segurança) · Progressões 51C e 51D da fonte eram idênticas; reescritas

Fontes: Selkirk — Master the speed-up (contato acima da rede)

**52. Menu de Speed-Up** — Importado com correções → `speed-up-tres-alvos-anunciados`, nível 3.0–4.0

O drill existente 'speed-up-e-contra-ataque' tem um alvo só e foca no contra-ataque; este acrescenta a variação de alvos (ombro do lado da raquete, quadril do lado da raquete, pés), primeiro anunciada e depois escondida — decisão e critério novos. A fonte errava ao mandar evitar o meio do corpo (quadril/umbigo é alvo recomendado) e ao falar em 'acender o ombro do adversário'.

Correções: Alvos alinhados às fontes: ombro do lado da raquete, quadril do lado da raquete e pés; o erro é a quadra aberta, não o corpo · Speed-up só em bola na altura da fita ou acima, com cerca de dois terços da força · Removida a ideia de 'telegrafar' o ataque; a preparação é igual à do dink · Segurança: óculos e rosto fora do combinado

Fontes: Selkirk — Master the pickleball speed-up and where to aim · The Kitchen Pickle — Speed-up tips guide · The Dink — Where to attack your opponent

**53. Contra-ataque Imediato** — Já existia → já coberto por `speed-up-e-contra-ataque`

Um acelera e o outro defende/contra-ataca: é o 'speed-up-e-contra-ataque', com o bloqueio já coberto por 'voleio-de-bloqueio-contra-drive' e a troca rápida por 'troca-rapida-de-voleios'. A fonte ainda confunde contra-ataque (devolver a aceleração) com 'bloquear e depois reatacar em dois movimentos'.

**54. Quatro Cantos da Cozinha** — Importado com correções → `dink-nos-quatro-cantos-entrar-e-sair-da-cozinha`, nível 3.0–4.0

Os físicos 'reacao-aos-quatro-cones' e 'deslocamento-lateral-com-cones' treinam o deslocamento sem bola; este é com bola e acrescenta o que falta: entrar na cozinha para o dink curto e sair a tempo de volear (voleio com pé na cozinha é falta). A montagem da fonte (quadrado de 2,5 m atrás da linha) levava a bolas fundas fora do contexto do dink, então os cantos foram levados para dentro da cozinha. Ficou como drill, não como físico.

Correções: Cantos redesenhados: dois junto à linha nas laterais e dois curtos perto da rede · Incluída a regra de sair da cozinha antes de volear · Dica 'cotovelo na frente' e proibição absoluta de afundo retiradas (afundo é permitido quando necessário; preferem-se passos curtos) · Recuperação ao centro passou a fazer parte do critério

Fontes: USA Pickleball — regra da zona de não voleio (pode entrar para bola quicada; voleio exige os dois pés fora)

**55. Figura-8 nos Cones** — Rejeitado

A descrição se contradiz: pede passos laterais 'sem nunca cruzar' num traçado em oito (que exige curvas e troca de frente), 'mãos na cintura' quando a postura de jogo é raquete na frente, e 'ritmo de xadrez'. O objetivo (resistência de deslocamento com postura) já é atendido com mais segurança por 'deslocamento-lateral-com-cones' e 'circuito-de-quadra', que têm séries, descanso e progressão.

**56. Rallies de Micro-Passos** — Já existia → já coberto por `dink-em-oito`

Rally de dink exigindo que os pés levem o jogador até a bola em vez de esticar a raquete é o foco do 'dink-em-oito' (dicas 'ande até a bola, depois bata' e 'pare antes de bater'). A regra 'nenhum passo maior que um sapato' é arbitrária (às vezes um passo longo é o certo) e a fonte atribui a ela prevenção de 'lesão de cotovelo' sem base.

**57. Split-Step na Transição** — Já existia → já coberto por `split-step-no-tempo-certo`

Avançar para a rede e fazer o split step no instante do golpe do adversário é o 'split-step-no-tempo-certo', com a repetição ao longo do caminho já presente em 'reset-na-zona-de-transicao'. Nada de montagem ou critério novo.

Fontes: Pickleball Union — Transition to the kitchen safely

**58. Saque no Backhand Adversário** — Importado com correções → `saque-fundo-no-backhand-de-quem-devolve`, nível 3.0–4.0

O 'saque-fundo-com-alvo' treina profundidade e lado anunciado, mas não a leitura de ONDE está o backhand, que muda com a área de saque (para um destro: meio na área da direita, lateral na da esquerda) e com a mão do devolvedor. Essa decisão é o que o drill acrescenta. A fonte confundia o lado ('o adversário fica no seu lado de forehand') e não dizia que o alvo muda de lado.

Correções: Explicado onde fica o backhand em cada área e contra destro/canhoto, com dois diagramas · Profundidade antes do lado, mantendo o terço final · Regra do saque conferida: por baixo, contato abaixo da cintura, raquete subindo em arco e cabeça abaixo do punho; desde 2026 saque duvidoso é falta; saque com quique permitido · Removida a 'rotação de quadril' como dica

Fontes: USA Pickleball — regras 2026 (saque de voleio com 'clearly'; saque com quique) · The Kitchen Pickle — USA Pickleball rule changes 2026

**59. Rotação de 4 Saques** — Importado com correções → `saque-com-quatro-efeitos-da-raquete`, nível 3.0–4.5

Variar o efeito do saque é legítimo e não existe na biblioteca, mas a fonte ensinava um saque ILEGAL: 'a rotação é feita entre dois dedos' e 'a rotação tem que estar na bola antes do contato' — o giro dado com a mão é proibido desde 2023 e a edição 2026 fechou também o 'peteleco' com os dedos. Reescrito com todo efeito vindo da raquete, contato claramente abaixo da cintura e a opção do saque com quique. Nível máximo 4.5 porque o efeito cortado exige mais controle.

Correções: Removido o giro dado com a mão/dedos (proibido); a bola é solta parada · Mecânica de cada efeito descrita pelo caminho da raquete · Incluídas as exigências do saque de voleio e a regra 2026 (saque duvidoso é falta) · Removidos 'spin vem do pulso' e 'servir com o braço inteiro elimina o spin' · Typos ('Servar') e inglês solto (flat, sidespin) trocados

Fontes: USA Pickleball — regras 2026 (efeito só da raquete; sem giro com os dedos) · My Pickleball Connect — Pickleball serve rules 2026 · The Dink — 7 new USAP rules for 2026

**60. Lóbulo Topspin** — Importado com correções → `lob-com-topspin-a-partir-do-dink`, nível 3.5–4.5

O lob ofensivo com topspin a partir do dink é técnica reconhecida e diferente do 'lob-de-ataque-no-dink' (sem efeito): o topspin permite mais altura e faz a bola mergulhar e fugir depois do quique. A fonte errava a mecânica ('contato abaixo do centro', 'snap de pulso') e escrevia 'Lóbulo'. Nível mínimo subiu para 3.5 porque o golpe pressupõe dink e lob sem efeito estáveis.

Correções: 'Lóbulo' → 'lob' em todo o texto · Mecânica: raquete de baixo para cima escovando a parte de trás da bola, preparação igual à do dink · Alvo: últimos 1,5 m, na diagonal (mais quadra para cair) · Segurança: quem recua vira e corre, sem andar de costas · Progressões duplicadas (60B/60C) reescritas

Fontes: Pickleball Union — Perfect pickleball shot: topspin lob · pickleball.com — How to hit a pickleball lob · The Pickler — offensive lob

### Nível 4 da fonte

**61. Rola de Costas** — Importado com correções → `dink-com-rolagem-de-backhand`, nível 3.5–4.5

É o dink (e, na progressão, o voleio) com rolagem de backhand: topspin gerado por uma escovada curta de baixo para cima. Golpe legítimo e muito usado a partir do 3.5 para pressionar sem dar bola alta; não há item de rolagem/topspin na biblioteca. A física da fonte estava errada (a bola com topspin cai rápido e segue para a frente, não "quica alta e recua") e a postura era cópia do Erne.

Correções: "Rola de Costas" virou "Dink com rolagem de backhand (topspin)" · Bola com topspin cai e segue para a frente depois do quique; removido "quica alta e recua" · Gesto descrito como escovada curta de baixo para cima, sem "girar o pulso" (excesso de punho levanta a bola, segundo os técnicos consultados) · Acrescentado o critério de não rolar bola abaixo do joelho · Texto de postura (copiado do Erne: aterrissagem, perna estendida) descartado

Fontes: Pickleball 360 — Backhand Roll Volley Dink (pickleball360.com) · The Dink — Topspin dink vs roll dink (thedinkpickleball.com) · Paddletek — Mastering the backhand roll · Pickleball Union — Ben Johns backhand roll

**62. Punch Volley** — Importado com correções → `punch-de-voleio-com-alvo-anunciado`, nível 3.5–4.5

Punch é o voleio curto e firme de ataque na rede. Existe "voleio-firme-nos-pes", mas com o alvo nos pés de quem está na zona de transição; aqui os dois estão na cozinha e o treino é escolher e anunciar o alvo (pés, cintura e ombro do lado da raquete) e decidir pela altura da bola. A fonte misturava parede e quadra e dizia que o punch é "só o punho".

Correções: Alvos marcados na parede (incoerente com a montagem em quadra) trocados por cone nos pés e zonas no lado da raquete do alimentador · Incluída a regra técnica: bola abaixo da fita não é punch, é bloqueio/reset · "Só o punho, braço parado" trocado por gesto curto com a raquete na frente · Segurança: ritmo de 60–70%, nunca no rosto, óculos

Fontes: The Dink — Roll volley vs punch volley (thedinkpickleball.com) · pickleball.com — Shots & techniques library

**63. Passos do Erne** — Importado com correções → `erne-passos-e-voleio-com-alimentador`, nível 4.0–5.5

A jogada "erne" já explica quando e como usar; este drill acrescenta a progressão de treino (sem bola, bola lenta, ritmo de jogo e rally) e a decisão paralelo × cruzado, por isso não é duplicado. A fonte tinha erros de regra: falava em dink cruzado, em "cruzar a rede por fora" e em "pé de fora toca primeiro". Conferido na regra: o voleio não pode tocar a cozinha nem a linha (embalo incluído), quem pisou na cozinha só voleia com os dois pés fora dela, o salto sobre o canto sai de fora e cai fora, e a bola tem de ter passado a rede. Nível subido para 4.0 (a jogada existente é 4.5+).

Correções: Erne é contra o dink PARALELO junto à sua lateral, não cruzado · Ninguém cruza a rede: o caminho é por fora da cozinha, ao lado do poste · Regra explicitada: nada na cozinha nem na linha durante o voleio e o embalo; com pé na cozinha, os dois pés voltam para fora antes; a bola tem de ter cruzado a rede · Salto sobre o canto só depois de dominar o caminho andando; nível 3.5 → 4.0 · Postura com "quadril 90 graus" e "cotovelo baixo" descartada

Fontes: USA Pickleball Official Rulebook (usapickleball.org/docs/rules) — seção 9 (cozinha) · The Pickler — What is an Erne / Jumping in the kitchen · PlayPickleball — 2025 USA Pickleball rules section 9

**64. ATP (Around the Post)** — Importado com correções → `atp-ou-dink-leitura-da-bola-aberta`, nível 4.0–5.5

A jogada "atp-por-fora-do-poste" explica o golpe; este drill treina a DECISÃO (ATP só com a bola já fora da lateral; dentro, por cima da rede) com contagem, o que o torna distinto. A fonte dizia "bata no ar", mas o ATP sai da bola que quicou do seu lado e foi para fora da quadra; pela regra a bola não precisa passar por cima da rede nem tem limite de altura, só precisa cair na quadra adversária.

Correções: "Bata no ar" corrigido: o ATP é batido depois do quique, fora da quadra · Removida a ideia de que o ATP pede força; pode passar abaixo da altura da rede · Instruções de postura sem sentido ("mão abaixo do punho") descartadas · "Lóbulo" → lob (a progressão com lob foi trocada pela decisão ATP × dink) · Segurança: espaço livre fora da quadra

Fontes: USA Pickleball Official Rulebook (usapickleball.org/docs/rules) — 11.M (around the post) · pickleball.com — What is an ATP shot · Selkirk — Around-the-post shot explained (Maddie Toren) · PlayPickleball — crossing the plane of the net

**65. Parede: Lóbulo e Smash** — Importado com correções → `smash-continuo-na-parede`, nível 3.0–4.5

Smash contínuo na parede: o smash quica no chão perto da parede, sobe e volta alto para o próximo — exercício solo clássico de golpe por cima da cabeça. Distinto de "smash-depois-do-lob" (com parceiro). A fonte tinha a distância errada (3 m é perto demais), chamava lob de "lóbulo" e tinha frases sem sentido sobre isometria. Nível desceu para 3.0, coerente com o smash da biblioteca.

Correções: "Lóbulo" → lob · Montagem refeita: 5 m da parede, fita no chão onde o smash deve quicar · Recuo sempre de lado, nunca de costas · Volume de ombro controlado: séries curtas e pausa · Removido o texto de "isometric em decúbito"

Fontes: Drill de parede de golpe por cima da cabeça (prática corrente de tênis e pickleball) · Seed atual: smash-depois-do-lob e recuo-seguro-virar-e-correr (coerência de técnica e segurança)

**66. Retorno Slice Profundo** — Importado com correções → `devolucao-com-slice-funda`, nível 3.5–4.5

Devolução com corte (slice), funda e baixa: fica baixa depois do quique, dificulta o drive da terceira bola e dá tempo de chegar à cozinha. "devolucao-de-saque-funda" trata da profundidade com drive; o corte é outra técnica e outra intenção. A fonte tratava slice e backspin como coisas diferentes (são o mesmo efeito) e citava "kick serve", que não existe no saque por baixo.

Correções: Slice e backspin são o mesmo efeito (corte); removida a distinção inventada · O objetivo é bola BAIXA e funda; corte que flutua alto e curto vira terceira bola fácil · Removido "kick serve" · Acrescentado o avanço até a cozinha com split step

Fontes: The Pickler — Pickleball return slice · Prime Time Pickleball — Deep slice returns · Pickleball Union — Slice or topspin return of serve

**67. Saque Corrente** — Rejeitado

O "chainsaw serve" depende de girar a bola com a mão antes do saque, o que a USA Pickleball proibiu (pré-giro com a mão ou os dedos; vale em todo jogo sancionado desde 2023). A fonte afirmava que o pré-giro "abaixo do quadril é legal", o que é falso. Efeito dado pela raquete continua legal, mas o drill inteiro foi montado sobre o gesto proibido.

Fontes: USA Pickleball Official Rulebook (usapickleball.org/docs/rules) — seção 4 (saque): proibido dar efeito à bola com a mão · Pickleheads — Pickleball spin serve ban · pickleball.com — What is the chainsaw serve

**68. Disfarce Drop e Drive** — Importado com correções → `disfarce-drop-ou-drive-na-terceira`, nível 3.5–5.0

Treina a terceira bola com a mesma preparação para drop e drive, com o parceiro tentando adivinhar. É distinto de "drive-da-terceira-e-drop-da-quinta" (padrão de dois golpes) e de "lob-de-ataque-no-dink". A meta da fonte (adivinhador abaixo de 50%) é chute puro numa escolha binária; virou 6 de 10 ou menos, e só valem golpes bons.

Correções: Meta "abaixo de 50%" (nível de chute) trocada por 6 de 10 ou menos, contando só drop na cozinha e drive baixo · Palpite só vale antes de a bola passar a rede · Dicas no corpo ("ombro é o tell") trocadas por foco na raquete · Segurança: parceiro na rede de óculos e raquete na frente

Fontes: Princípio de disfarce do golpe (PPR/IPTPA, prática corrente de técnicos) · Seed atual: drive-da-terceira-e-drop-da-quinta, drop-terceira-bola-com-alimentador

**69. Construção 3-5-7** — Importado com correções → `pontos-roteirizados-terceira-quinta-setima`, nível 3.0–4.5

Jogo com roteiros combinados (padrões de 3, 5 e 7 bolas), primeiro colaborativo e depois disputado: é a prática de padrões táticos usada por técnicos para ensinar a jogar com plano. A fonte era vaga (o roteiro de 7 terminava "até smash") e afirmava que isso "separa 3.5 de 4.0". Os roteiros foram definidos de forma concreta: saque, devolução funda, drop; reset da quinta; dink até a bola alta atacável.

Correções: Roteiros concretos e coerentes com a regra dos dois quiques · Removida a afirmação "é o que separa 3.5 de 4.0" · Fase final com adversário que tenta impedir o roteiro

Fontes: Seed atual: terceira-bola-ao-vivo, jogo-7-11 (para não duplicar) · Prática de padrões em treinos de duplas (PPR/IPTPA)

**70. Skinny Singles na Diagonal** — Já existia → já coberto por `skinny-singles`

"skinny-singles" já é o simples em meia quadra, de frente ou na diagonal, com a mesma montagem e a mesma tarefa (drop, dink, paciência). O canal mais estreito e a troca de lado a cada 5 pontos da fonte são variações que não justificam outro item.

Fontes: Seed atual: skinny-singles

**71. Dupla: Corda de 10 Pés** — Já existia → já coberto por `dupla-como-corda`

A jogada "dupla-como-corda" já traz o conceito (corda de cerca de 3 m), a mesma montagem com quatro jogadores e o passo de treino com alimentador. A penalidade por "quebrar a corda" é um detalhe de pontuação, não uma montagem nova.

Fontes: Seed atual: dupla-como-corda

**72. Sinais de Punho e Olho** — Importado com correções → `sinais-da-dupla-antes-da-devolucao`, nível 3.5–5.0

Sinais com a mão atrás das costas são prática real no pickleball, mas quem os dá é o parceiro de quem DEVOLVE, já na linha da cozinha (ficar, trocar de lado no stacking, atravessar na terceira bola). A fonte copiou o tênis: punha o parceiro do sacador "na rede", o que a regra dos dois quiques torna sem sentido, e incluía "piscar". Não há item de sinais na biblioteca.

Correções: Quem sinaliza é o parceiro de quem devolve, na linha da cozinha, e não um "jogador de rede" da dupla que saca · Removidos os sinais com o olho · Código de sinais apresentado como combinação da dupla (as fontes divergem sobre punho/mão aberta) · Falso ataque como variação, usado poucas vezes

Fontes: Pickleball Central — Pickleball hand signals · DUPR — What is stacking in pickleball · The Dink — How to communicate with your partner

**73. Chamadas Meu e Seu** — Importado com correções → `jogo-das-chamadas-da-dupla`, nível 3.0–4.5

"bola-do-meio-quem-chama" treina a chamada "minha/sua" com alimentador; aqui é jogo disputado com penalidade e com todas as chamadas da dupla (minha, sua, troca e deixa para a bola que vai sair), por isso entra como jogo reduzido. Conteúdo correto; texto reescrito e nível começando em 3.0, porque o hábito deve vir cedo.

Correções: Ampliado para as quatro chamadas (incluída "deixa" na bola que vai sair) · Regra de quem pega o meio explicitada · "Lóbulo" removido; nível 3.5 → 3.0

Fontes: The Dink — How to communicate with your partner · forwrd — Doubles communication tips · Seed atual: bola-do-meio-quem-chama, cobertura-do-lob-troca

**74. Recuperação Diagonal** — Rejeitado

A premissa está tecnicamente confusa: o que fecha ângulo é ONDE você se posiciona depois do golpe (acompanhando a bola, cobrindo o ângulo do adversário), não o caminho "em diagonal" de volta. O texto se contradiz (alterna "centro" e "ponto de corte") e na rede o deslocamento é lateral. A parte útil — deslocar até a bola aberta e voltar à posição de cobertura — já está em "deslocamento-lateral-com-cones", "dink-em-oito" e "dupla-como-corda".

Fontes: Seed atual: deslocamento-lateral-com-cones, dink-em-oito, dupla-como-corda

**75. Crossover Sprint e Reset** — Importado com correções → `passo-cruzado-e-volta-lateral` (fisico), nível 3.0+

Físico de agilidade: passo cruzado para cobrir distância até a bola longe, freada equilibrada, volta em passos laterais e split step no centro. Distinto do deslocamento lateral e da reação aos cones da biblioteca. A fonte se contradizia (pedia "crossover-shuffle" na volta e ao mesmo tempo "pés nunca cruzando") e o "reset" do nome não era o golpe.

Correções: Ida com passo cruzado; volta só com passos laterais (contradição resolvida) · Nome sem "reset", para não confundir com o golpe · Séries, repetições, descanso e segurança no padrão da biblioteca; progressão de velocidade ao longo de semanas

Fontes: Seed atual: deslocamento-lateral-com-cones, reacao-aos-quatro-cones, recuo-seguro-virar-e-correr · Princípios de treino de agilidade (aquecimento, progressão de carga)

**76. Bola no Dime** — Já existia → já coberto por `reset-de-bloqueio-nos-pes`

Descontado o texto confuso ("dime", "terceira perna", "boiando na altura do ponto"), o drill é amortecer para a cozinha, na zona de transição, a bola que chega no pé logo depois do quique, e depois resetar a seguinte. É a mesma montagem e tarefa de "reset-de-bloqueio-nos-pes" (bola nos pés, depois do quique ou de voleio) e de "reset-na-zona-de-transicao".

Fontes: Seed atual: reset-de-bloqueio-nos-pes, reset-na-zona-de-transicao

**77. Parede de Defesa de Dupla** — Importado com correções → `bloqueio-em-dupla-contra-o-drive`, nível 3.5–4.5

Dois defensores na cozinha contra um atacante no fundo batendo drive: bloqueio para a cozinha e cobertura do meio em dupla. "voleio-de-bloqueio-contra-drive" é individual; aqui entra a decisão de quem pega o meio e o deslocamento conjunto. A fonte dizia "nenhum dos dois ataca", absoluto demais: a bola que chega alta pode e deve ser atacada.

Correções: Montagem com 3 jogadores (4 com quem alimenta), não 4 obrigatórios · "Ninguém ataca" trocado por "ataque só a bola alta" · Regra do meio (forehand do meio pega, salvo chamada) · Segurança: óculos, drive abaixo do peito, poucas séries

Fontes: Seed atual: voleio-de-bloqueio-contra-drive, bola-do-meio-quem-chama

**78. Fechar o Meio** — Já existia → já coberto por `bola-do-meio-quem-chama`

A cobertura do meio já está em "bola-do-meio-quem-chama" (drill) e em "dupla-como-corda" (jogada). A "regra de ouro" da fonte (o jogador da rede cruza a linha central e o parceiro recua na diagonal) é confusa e contradiz o deslocamento conjunto ensinado nesses itens; a parte correta já está coberta.

Fontes: Seed atual: bola-do-meio-quem-chama, dupla-como-corda

**79. Intervalos na Quadra** — Já existia → já coberto por `circuito-de-quadra`

"circuito-de-quadra" já é o condicionamento em estações com os movimentos do jogo, com variação 40/20 na versão difícil. A fonte muda só a proporção (45/15) e soma 3 circuitos de 8 rodadas, volume alto para o nível sem progressão, e põe "saque a 100%" como estação de condicionamento, o que não faz sentido físico.

Fontes: Seed atual: circuito-de-quadra

**80. Regra dos 3 Segundos** — Importado com correções → `reset-mental-depois-do-erro`, nível 3.0–5.0

Rotina curta depois do erro (contagem, gesto, expiração longa, palavra para a frente), treinada em pontos reais e contada. A biblioteca tem "rotina-entre-pontos" como estudo; este é a prática com meta, por isso entra como drill. Os três segundos são uma convenção útil de treino, não um número científico, e a promessa da fonte de "baixar a frequência cardíaca em meio segundo" foi retirada.

Correções: Removido "baixa a frequência cardíaca em meio segundo" · Respiração descrita como uma expiração mais longa que a inspiração · Typo "Rar para verbalizar" corrigido; comentário técnico guardado para a troca de lado

Fontes: Seed atual: rotina-entre-pontos (estudo) · Literatura de psicologia do esporte sobre rotinas pré-desempenho e respiração com expiração prolongada

### Nível 5 da fonte

**81. Velocidade de Mãos em Transição** — Já existia → já coberto por `reset-na-zona-de-transicao`

Treina o reset/bloqueio vindo do meio da quadra contra um atacante na cozinha, avançando só depois de bolas bem amortecidas. É exatamente a montagem, a tarefa e a regra de avanço de 'reset-na-zona-de-transicao' (cuja variação difícil já põe o atacante jogando para valer); 'reset-de-bloqueio-nos-pes' cobre a repetição parada. A afirmação de que 'a maior parte dos pontos de elite é decidida na transição' não tem fonte e foi descartada.

Correções: Não importado: equivale a reset-na-zona-de-transicao; a parte de decidir atacar × resetar foi aproveitada em atacar-ou-resetar-na-transicao (drill 93).

Fontes: Comparação com seed_atual.json e o código da semente (drills.js, jogadas.js, fisicos.js, estudos.js)

**82. Shake and Bake** — Já existia → já coberto por `shake-and-bake`

O drill repete a jogada já existente: drive na terceira bola e o parceiro correndo para finalizar o bloqueio alto, 4 jogadores. A fonte ainda mistura Shake and Bake com poach e Erne ('cruza a rede e se posiciona fora, sem tocar a linha da cozinha', 'o driver desliza para o lado que o poach abandonou'), o que está errado: no shake and bake o parceiro sobe no próprio lado e quem bateu o drive vem atrás. A escolha drive × drop na terceira bola já está em terceira-bola-ao-vivo.

Correções: Não importado. Erro técnico registrado: confusão entre shake and bake, poach e Erne; o 'postura' da fonte descreve outro golpe ('Mão Fora').

Fontes: Comparação com seed_atual.json e o código da semente (drills.js, jogadas.js, fisicos.js, estudos.js) · Selkirk/PPA — descrição do 'shake and bake' (drive + parceiro na rede)

**83. Contra o Erne** — Importado com correções → `defesa-contra-o-erne`, nível 4.0–5.5

A jogada 'erne' da biblioteca ensina a FAZER o Erne; defender-se dele é outra habilidade (leitura e alvo), então o drill é distinto. Mas a fonte está tecnicamente confusa: manda 'bloquear na linha, não no meio' e 'fechar o meio' — a linha é justamente onde está quem faz o Erne. As fontes de treinadores convergem em prevenir (dink paralelo baixo e variado) e, lida a saída, jogar no espaço que o adversário deixou ou cruzado. Reescrito com essa lógica, placar dos dois lados e cuidado com o espaço fora da quadra.

Correções: Resposta correta: bola para onde o adversário estava (meio da quadra dele) ou cruzada, não na linha. · Removida a ideia de 'smashar' ou contra-atacar com força: bloqueio curto. · Removida a 'leitura do ombro' (dica de parte do corpo) e o 'postura' da fonte, que descrevia um dink alto. · Lóbulo → lob na variação; acrescentada a segurança do espaço fora da quadra.

Fontes: Defesa contra o Erne: thepickler.com, pickleheads.com/guides/erne-in-pickleball, pickleballunion.com · Comparação com seed_atual.json e o código da semente (drills.js, jogadas.js, fisicos.js, estudos.js)

**84. Sequências em Velocidade** — Rejeitado

Propõe 'sequências de construção de ponto' combinadas antes do ponto, mas nunca diz quais são as sequências, o que é 'quebra', nem como se pontua num ponto vivo (+1/−1). Contradiz o número de jogadores (2 no cabeçalho, duas duplas na montagem) e a versão 'sozinho' e 'sentado' não fazem sentido para um jogo de duplas. Vago demais para virar um drill útil; a ideia de jogar pontos com plano já existe em terceira-bola-ao-vivo e no treino treino-avancado-padroes-duplas.

Correções: Rejeitado por falta de conteúdo verificável.

Fontes: Comparação com seed_atual.json e o código da semente (drills.js, jogadas.js, fisicos.js, estudos.js)

**85. Ataque ao Backhand Dinâmico** — Importado com correções → `dink-no-backhand-quebra-de-padrao`, nível 4.0–5.5

O núcleo é bom e não existe na biblioteca: pressionar o lado fraco (geralmente o backhand) no dink e quebrar o padrão antes de o adversário se ajustar. A fonte é contraditória: manda quebrar 'a cada 4 bolas' e depois diz que fixar a quebra no 4º dink ensina a contagem; o objetivo ('construir a preferência de forehand do adversário') não faz sentido e o nome em inglês ('Backhand Down Attack') não corresponde. Reescrito com quebra escolhida pela posição do adversário e critério de bolas forçadas.

Correções: Quebra de padrão pela leitura, não por contagem fixa. · Objetivo reescrito (explorar o lado fraco sem ficar previsível). · Removidas a 'leitura do saucer'/do ombro e o 'postura' da fonte, que descrevia um push.

Fontes: Comparação com seed_atual.json e o código da semente (drills.js, jogadas.js, fisicos.js, estudos.js) · Princípio tático de alvo no dink (pickleball.com/docs, thedinkpickleball.com — how to win a dink battle)

**86. Stacking: Passagem a Pé** — Já existia → já coberto por `stacking-empilhamento`

Percorrer as quatro situações de stacking (sacando e devolvendo, de cada lado) é o conteúdo da jogada 'stacking-empilhamento', que já tem os passos e diagramas do saque e da devolução empilhados. A passagem a pé foi aproveitada como primeiro passo do drill 87 importado. A fonte traz número sem fonte ('55% dos pontos de elite') e uma frase errada ('o servidor segura a posição até a troca terminar').

Correções: Não importado; a passagem a pé virou o passo 1 de stacking-em-jogo-empilhar-ou-nao. · Descartada a estatística de 55% (sem fonte).

Fontes: USA Pickleball 4.B.7 (citado por pickleheads.com/guides/what-is-stacking-in-pickleball): fora o sacador, não há restrição de posição; só sacador e recebedor têm quadra certa · Comparação com seed_atual.json e o código da semente (drills.js, jogadas.js, fisicos.js, estudos.js)

**87. Stacking em Jogo** — Importado com correções → `stacking-em-jogo-empilhar-ou-nao`, nível 4.0–5.5

Distinto da jogada: aqui a dupla joga pontos alternando formação normal e stacking e DECIDE, com anotações, qual funciona contra aqueles adversários, incluindo o sinal da devolução e o 'anti-stacking'. Regra conferida: fora o sacador, ninguém tem posição obrigatória; sacador e recebedor precisam estar na quadra que o placar manda, e errar isso é falta de posição. Reescrito com a passagem a pé do drill 86 como aquecimento e critério sem falta de posição.

Correções: Incorporada a passagem a pé do 86. · Sinal da devolução definido (fica/troca) e confirmação por voz. · 'Saquetador', 'swich', 'anti-stacking' sem explicação e o 'postura' genérico foram reescritos ou removidos.

Fontes: USA Pickleball 4.B.7 (citado por pickleheads.com/guides/what-is-stacking-in-pickleball): fora o sacador, não há restrição de posição; só sacador e recebedor têm quadra certa · Comparação com seed_atual.json e o código da semente (drills.js, jogadas.js, fisicos.js, estudos.js)

**88. Poach e Cobertura** — Importado com correções → `poach-da-terceira-bola-com-sinal`, nível 4.0–5.5

A fonte descreve o poach planejado com 'o sacador confirma' e 'o devolvedor bate cruzado, o poacher intercepta' — se o poacher é da dupla que saca, volear a devolução é FALTA pela regra dos dois quiques. Adaptado para o padrão legal e clássico: a dupla que DEVOLVE combina o sinal antes do saque e o parceiro na cozinha faz o poach da terceira bola, com quem devolveu cobrindo o lado vazio. Isso é distinto de poach-no-dink-cruzado (rally de dink) e da jogada poach-na-rede (explicação geral).

Correções: Corrigida a ilegalidade: o poach passa a ser da dupla que devolve, na terceira bola; a devolução nunca é voleada. · Lembrete de voleio só com os dois pés fora da cozinha ao atravessar. · Removidos 'attackable', 'quadril girado 90 graus' e o 'postura' da fonte (descrevia dink alto).

Fontes: USA Pickleball — regra dos dois quiques (resumo oficial em pickleball.com/docs e thekitchenpickle.com/pickleball-terms/two-bounce-rule) · USA Pickleball — estratégia de poach planejado (usapickleball.org, artigo de estratégia de duplas) · Comparação com seed_atual.json e o código da semente (drills.js, jogadas.js, fisicos.js, estudos.js)

**89. Falso Poach** — Importado com correções → `falso-poach-no-dink-cruzado`, nível 4.0–5.5

A finta de poach é legal: a regra só proíbe distração com ação física 'não comum ao jogo' (barulho, pisada, raquete agitada) e não restringe a posição dos jogadores; um passo de poach é movimento normal de jogo. A fonte, porém, descreve o falso poach como um 'sinal' de mão que o adversário leria, o que não funciona; o correto é a finta de deslocamento que induz a paralela, com quem fingiu esperando nela. Reescrito assim, com aviso explícito sobre a falta de distração e a frequência variada.

Correções: Finta passa a ser um passo visível de poach, não um sinal de mão mostrado ao adversário. · Acrescentado o limite da regra: sem barulho, pisada ou raquete agitada enquanto o adversário bate (falta de distração). · Removida a frequência fixa '1 em cada 8 pontos' (sem fonte).

Fontes: USA Pickleball 2026 (cópia do livro em pickleballcanada.org): definição de distração — ação física 'não comum ao jogo' que atrapalha o adversário (barulho, pisada, raquete agitada) · Posição livre dos jogadores (thedinkpickleball.com, never fall for these fake pickleball rules) · Comparação com seed_atual.json e o código da semente (drills.js, jogadas.js, fisicos.js, estudos.js)

**90. Switch no Meio** — Já existia → já coberto por `bola-do-meio-quem-chama`

A habilidade é a cobertura e a comunicação na bola do meio, já tratada em 'bola-do-meio-quem-chama' (e a troca de lado depois de atravessar, em poach-no-dink-cruzado e cobertura-do-lob-troca). A regra da fonte está errada: 'bola no meio, os dois trocam de lado' — numa bola do meio não se troca de lado; um chama e pega, o outro cobre. A lista 'errado' repete o mesmo item duas vezes.

Correções: Não importado; regra incorreta registrada (troca de lado não é a resposta à bola do meio).

Fontes: Comparação com seed_atual.json e o código da semente (drills.js, jogadas.js, fisicos.js, estudos.js)

**91. Dinks Cruzados Competitivos** — Já existia → já coberto por `dink-ate-11`

Jogo de dinks cruzados na diagonal com placar: é o mesmo formato de 'dink-ate-11' (1 contra 1 na diagonal, toda bola na cozinha), só que até 5. A pontuação da fonte é incoerente ('erro na rede zera todos os pontos da sequência, para qualquer um dos dois') e ela se contradiz sobre o deslocamento (pede passo cruzado e depois diz que pés cruzados custam ponto).

Correções: Não importado. Incoerência de pontuação e de deslocamento registrada.

Fontes: Comparação com seed_atual.json e o código da semente (drills.js, jogadas.js, fisicos.js, estudos.js)

**92. Ataque na Diagonal** — Rejeitado

A geometria é contraditória: o alvo seria 'a diagonal entre o adversário e o parceiro', mas o espaço entre os dois é o MEIO, e o drill é para 2 jogadores enquanto fala de poach do parceiro e da cobertura do outro lado. O que é válido (atacar o meio e só bola atacável) já está na jogada 'ataque-ao-meio' e no drill 'speed-up-e-contra-ataque'. 'Quadril gira 45 graus' é instrução de corpo sem base.

Correções: Rejeitado: tarefa e alvo mal definidos; o conteúdo válido já existe.

Fontes: Comparação com seed_atual.json e o código da semente (drills.js, jogadas.js, fisicos.js, estudos.js)

**93. Reset de Transição Avançado** — Importado com correções → `atacar-ou-resetar-na-transicao`, nível 4.0–5.5

A ideia boa — decidir pela altura do contato entre reset, ataque e smash — é distinta dos dois drills de reset existentes, que só resetam. A fonte está cheia de erros: 'resete apenas bolas claramente atacáveis' (é o contrário), 'abaixo do joelho, recue', 'recuo em diagonal', 'peito é reset'. Reescrito com a regra aceita pelos treinadores: contato abaixo da altura da rede amortece (reset); acima, ataca para baixo; bola alta e curta, smash. Absorve o 'implantar' do drill 97.

Correções: Critério de decisão corrigido: altura do contato em relação à rede. · Removidos 'recue e resete de novo' e 'recuo em diagonal'. · Segurança: nunca andar de costas atrás da bola alta.

Fontes: Reset e ataque pela altura da bola (pickleball.com/docs — kitchen line; thekitchenpickle.com — volley) · Comparação com seed_atual.json e o código da semente (drills.js, jogadas.js, fisicos.js, estudos.js)

**94. Perseguir o Pique** — Importado com correções → `meio-voleio-no-pe-na-linha-da-cozinha`, nível 4.0–5.5

Treina o meio-voleio (bola logo depois do quique) no pé, na linha da cozinha, sem recuar — os drills existentes de reset são na zona de transição. Manter a linha em vez de recuar é a orientação dos guias de jogo na cozinha. O texto da fonte é confuso ('bola rolada boiando', 'toque de punho', progressões repetidas 94D) e a 'versão sentado' não se aplica. Reescrito com montagem de alimentador, alvo e critério.

Correções: 'Short hop'/'pique' → meio-voleio; 'toque de punho' trocado por toque curto com a face aberta. · Progressões duplicadas da fonte reorganizadas em variação fácil e difícil.

Fontes: Linha da cozinha e meio-voleio: pickleball.com/docs (how to play the kitchen line), thedinkpickleball.com (half-volley hunt) · Comparação com seed_atual.json e o código da semente (drills.js, jogadas.js, fisicos.js, estudos.js)

**95. Pique sob Pressão** — Já existia → já coberto por `speed-up-e-contra-ataque`

Apesar do nome, não é sobre meio-voleio: é bloquear/resetar bolas aceleradas no corpo, na rede, sem devolver alto. Isso está coberto por 'speed-up-e-contra-ataque' (defensor bloqueia curto primeiro) e 'reset-de-bloqueio-nos-pes'. O conselho de 'três semanas só com reset' e a 'pressão no quadril' não têm base.

Correções: Não importado.

Fontes: Comparação com seed_atual.json e o código da semente (drills.js, jogadas.js, fisicos.js, estudos.js)

**96. Lóbulo Topspin Disfarçado** — Importado com correções → `lob-com-topspin-escondido-no-dink`, nível 4.0–5.5

'lob-de-ataque-no-dink' treina o lob disfarçado comum; este acrescenta a mecânica do topspin e um critério diferente (o parceiro anuncia quando percebe; meta de menos da metade lida), por isso entra como item próprio. Correção técnica: a fonte manda 'contato abaixo do centro com snap de pulso', que produz efeito para trás; o topspin sai escovando a bola por trás, de baixo para cima, com a mesma preparação do dink. 'Lóbulo' → lob; o 'postura' da fonte descrevia o Erne.

Correções: Mecânica do topspin corrigida (escovar de baixo para cima, terminar alto). · Efeito descrito corretamente: a bola cai mais cedo e escapa depois do quique. · Segurança: quem defende vira e corre, sem andar de costas.

Fontes: Lob com topspin e disfarce: thedinkpickleball.com (5 keys to disguise the lob), pickleballunion.com (unreturnable topspin lob), thepickler.com · Comparação com seed_atual.json e o código da semente (drills.js, jogadas.js, fisicos.js, estudos.js)

**97. Mover, Fechar, Implantar** — Já existia → já coberto por `reset-na-zona-de-transicao`

Os 'três estados' são o avanço por etapas já ensinado na biblioteca: bola boa, anda; adversário bate, para (split step) e reseta — em reset-na-zona-de-transicao, jogo-7-11 e split-step-no-tempo-certo. O terceiro estado (atacar só bola alta) foi incorporado em atacar-ou-resetar-na-transicao. 'Implantar'/'deploy' é tradução ao pé da letra.

Correções: Não importado; o critério 'ataque só com bola alta' foi para atacar-ou-resetar-na-transicao.

Fontes: Comparação com seed_atual.json e o código da semente (drills.js, jogadas.js, fisicos.js, estudos.js)

**98. Visualização de 3 Cenários** — Importado com correções → `visualizacao-de-tres-cenarios-antes-do-jogo`, nível 3.0–5.5

Distinto do estudo 'rotina-entre-pontos' (que é a rotina durante o jogo): é imagem mental pré-jogo, com evidência de ganho quando combinada à prática física e quando ensaia o processo em condições realistas (modelo PETTLEP). Nível ampliado para 3.0 porque a técnica não depende de habilidade de elite. O placar do cenário passou a 9-9, mais perto do fim do jogo; trocada a respiração '4-7-8' com afirmação de queda 'mensurável' por respiração lenta com expiração longa, e removida a frase sobre 'ativar vias neurais'.

Correções: Nível 3.0–5.5 (justificado: habilidade mental útil a partir do intermediário). · Respiração 4-7-8 e afirmações fisiológicas sem fonte removidas. · O 'postura' da fonte descrevia um voleio e foi descartado.

Fontes: Imagem mental (PETTLEP): revisão sistemática Applied Sciences 2022 (doaj.org), Holmes & Collins 2001 · Comparação com seed_atual.json e o código da semente (drills.js, jogadas.js, fisicos.js, estudos.js)

**99. Drill de Match Point** — Importado com correções → `pontos-decisivos-jogos-a-partir-de-9-9`, nível 3.5–5.5

Jogos curtos que começam no fim do placar criam pressão real e treinam o golpe de maior porcentagem e a rotina entre pontos na prática — o estudo existente só explica a rotina. A fonte era incoerente ('cada rally começa em 10-10, qualquer erro e o ponto acaba', '99C' repetido, referência ao 'drill 19'). Reescrito com jogos de 9-9 a 11 em pontuação por rally (declarada como formato de treino) e a variação difícil na contagem tradicional, só quem saca pontua.

Correções: Formato definido: 9-9 até 11, 2 de diferença, todo rally vale ponto (formato de treino); variação na contagem oficial. · Critério mensurável: erros por arriscar. · Nível 3.5–5.5: pressão de placar serve antes do nível de elite.

Fontes: Contagem oficial de duplas (estudo contagem-do-placar da biblioteca) · Comparação com seed_atual.json e o código da semente (drills.js, jogadas.js, fisicos.js, estudos.js)

**100. Circuito Aeróbico** — Já existia → já coberto por `circuito-de-quadra`

Mesmo desenho do físico 'circuito-de-quadra' (quatro estações com os movimentos do jogo, trabalho e pausa, várias voltas), cuja variação difícil já aumenta o volume. A dose da fonte é incoerente e insegura: '15 min' no cabeçalho, mas 3 circuitos × 6 voltas × 4 estações de 60 s (cerca de 72 min de trabalho), e 'saques a 100%' por minutos seguidos. O pickleball é intermitente, de intensidade moderada a vigorosa; o circuito existente, com aquecimento e frase de segurança, já atende.

Correções: Não importado; volume da fonte inconsistente e excessivo.

Fontes: Demanda fisiológica do pickleball (intermitente, moderada a vigorosa): ACE/Dalleck 2018 (acefitness.org), DUPR research summary · Comparação com seed_atual.json e o código da semente (drills.js, jogadas.js, fisicos.js, estudos.js)

## Sessões, sequências, plano de 8 semanas e diagnósticos

**Sessão de 60 min** — Virou treino (com correções) → `treino-sessao-completa-cozinha-ao-fundo`

Modelo de 60 min (aquecimento 8 → dink e cozinha 18 → terceiro golpe 14 → transição 14 → resfriamento 6) segue a estrutura que treinadores de referência recomendam para uma hora (aquecer com dinks, jogo de cozinha, drop/transição, jogo, volta à calma) e cabe exatamente no tipo `treino`. Problemas: não termina com bloco de jogo (a transferência para a partida pede prática variada/aleatória no fim — interferência contextual), a meta de '10 acertos seguidos' de drop é alta demais para o público que o próprio texto descreve, e o texto tem inglês solto ('Earn your way', 'takeaway') e o termo inventado 'Recreante'. Não duplica os treinos atuais: os da biblioteca são focados (cozinha, terceira bola, transição); este é a sessão equilibrada pelas três partes do ponto, para 2.5–3.5.

Correções: Aquecimento de 8 para 10 min, para usar o 'Aquecimento dinâmico de 10 minutos' da biblioteca. · Transição dividida em reset na zona de transição (9 min, tática) + 'Jogo 7-11' (10 min, jogo): a sessão passa a terminar em situação de jogo. · Meta do drop trocada de '10 acertos seguidos' por '6 de 10 na cozinha, com a bola subindo do seu lado da rede' (o ápice do drop fica do lado de quem bate). · Dink de 18 para 14 min, mantendo a meta de 20 dinks seguidos antes de acelerar; volta à calma de 6 para 5 min (soma 60). · Removidos 'Earn your way', 'takeaway' e 'Recreante'; incluído `when_to_use` dizendo quando usar e como redistribuir o tempo.

Fontes: The Dink — The perfect 60-minute pickleball practice plan (thedinkpickleball.com) · Pickleball.com — The best one-hour practice plan (John Cincola) · MyPickleballConnect — Partner drills (jogo ao vivo no fim, foco cai após 60 min) · Czyż et al. 2024, Frontiers in Psychology — meta-análise de interferência contextual (transferência) · Pickleball Union / Primetime Pickleball — ápice do drop do lado de quem bate

**Sequência: Do zero à cozinha** — Não virou item: é progressão de várias semanas

É uma trilha de semanas (controle na parede → dink reto → dink cruzado → saque fundo → devolução funda → drop do fundo), não uma sessão: cada degrau só sobe 'por critério', o que leva várias sessões. A ordem é defensável (do mais fechado ao mais aberto, coerente com o ponto de desafio de Guadagnoli e Lee), mas para iniciante o saque e a devolução precisam entrar cedo, porque sem eles não há jogo — na prática os blocos devem se alternar, não esperar o dink 'fechar'. A frase 'pular a etapa 2 é a causa nº 1 de quem trava no 2.5' é afirmação sem base. O conteúdo já está coberto pelos três treinos de iniciante da biblioteca (primeiro treino, saque e devolução, cozinha).

Correções: Retirar a afirmação causal sem base ('causa nº 1'). · Saque e devolução intercalados desde o começo, não depois do dink. · Uso recomendado: um professor monta um plano de 4 a 6 semanas (Planos, com remessa ao aluno) com 'Primeiros dinks', 'Dink paralelo junto à lateral', 'Dink cruzado no pé de dentro', 'Saque fundo com alvo', 'Devolução de saque funda' e 'Drop da terceira bola com alimentador', subindo de item só quando a meta do anterior for batida.

Fontes: Guadagnoli & Lee 2004 — Challenge Point framework (Journal of Motor Behavior) · MyPickleballConnect — Beginner to 3.0 eight-week plan

**Sequência: Fechar a transição** — Não virou item: já coberto

Progressão tecnicamente boa: drop e avanço → subida controlada → reset e avanço → zona 7-11 → bola na meia-quadra (dime) → reset avançado, indo do fechado ao aberto e acrescentando uma condição por degrau. Como sessão única, coincide com o treino existente 'Transição: parar, amortecer e subir' (split step, reset nos pés, reset na zona de transição, jogo 7-11). Como trilha de semanas, serve de roteiro de plano para 2.5–3.5.

Correções: Sem treino novo: duplicado de `treino-intermediario-transicao` como sessão. · Uso recomendado como plano de professor: 'Drop da terceira bola com alimentador' → 'Escada do drop' → 'Split step no tempo do adversário' → 'Reset de bloqueio nos pés' → 'Reset na zona de transição' → 'Jogo 7-11', mais os drills de transição da fonte que forem importados pelos outros agentes.

Fontes: Pickleball.com — plano de 1 hora com roll-and-reset na transição · seed_atual.json — treino-intermediario-transicao

**Sequência: Mão macia na rede** — Não virou item: é progressão de várias semanas

Mistura duas coisas: controle de dink (alto/baixo, leitura de ataque) e golpes de oportunidade (punch, ATP, Erne, roll de backhand). Como sessão seriam seis drills com níveis de 3.0 a 4.5 numa hora, sem bloco de jogo. A ordem tem um problema: ATP vem antes do Erne e o texto diz que os dois 'entram no fim', mas a trilha termina no roll de backhand. ATP e Erne são legais (o Erne exige não tocar a cozinha antes/durante/depois do voleio; o ATP pode passar abaixo da altura da rede, por fora do poste), mas dependem de bola larga do adversário — não são prioridade para 3.0. A parte de rede já tem o treino 'Mãos rápidas na rede' (4.0–5.5) e o 'Cozinha: dink, bola alta e o meio' (3.0–4.0).

Correções: Reordenar: dink alto/baixo → leitura de bola atacável → voleio firme → roll de backhand → Erne → ATP (o ATP por último, por depender da bola mais rara). · Erne e ATP marcados como 3.5+ e oportunistas, com a regra da cozinha explicada (ver jogadas `erne` e `atp-por-fora-do-poste`). · Uso recomendado: plano de professor de 4 semanas; sem treino novo.

Fontes: USA Pickleball Official Rulebook — zona de não voleio (Erne) e retorno por fora do poste (ATP) · seed_atual.json — jogadas erne e atp-por-fora-do-poste; treinos de cozinha e mãos rápidas

**Sequência: Derrubar a bola rápida** — Não virou item: já coberto

A ideia central — absorver, depois bloquear, só então contra-atacar — é a progressão correta de defesa na rede. Mas a trilha inclui 'Defesa de lob', que não tem relação com bola rápida, e termina em 'Contra o Erne', que é situação específica de 4.5. O público descrito ('o joelho cede contra o drive') é tradução literal sem sentido. Como sessão, coincide em grande parte com 'Mãos rápidas na rede' (bloqueio contra o drive, speed-up e contra-ataque) e com 'Transição: parar, amortecer e subir'.

Correções: Trocar 'Defesa de lob' por 'Reset de bloqueio nos pés'. · Reescrever o público como 'quem perde a troca contra o drive e o speed-up'. · Sem treino novo: sessão coberta por `treino-avancado-maos-rapidas` e `treino-intermediario-transicao`; usar como plano de professor.

Fontes: seed_atual.json — treino-avancado-maos-rapidas, voleio-de-bloqueio-contra-drive, reset-de-bloqueio-nos-pes

**Sequência: Duas pessoas, uma quadra** — Virou treino (com correções) → `treino-dupla-chamada-meio-e-cobertura`

A premissa é boa e comum entre treinadores: comunicação e cobertura antes do poach, senão o poach abre buraco. Os quatro primeiros degraus (corda, chamada, meio, sinais) cabem numa sessão de 75 min para quatro pessoas e não há treino na biblioteca dedicado a isso — o 'Padrões de duplas' trata de poach, drive e stacking. Erro técnico importante na fonte: 'Fechar o meio' diz que 'o meio é responsabilidade compartilhada', que é justamente a causa da bola que passa entre os dois; o padrão ensinado é uma regra definida (bola lenta: forehand no meio; bola rápida: quem está na diagonal de quem bateu) com chamada cedo. O stacking a pé no fim não tem relação com a progressão e já está no treino de padrões.

Correções: Regra do meio corrigida: forehand na bola lenta, diagonal na bola rápida, sempre com chamada antes do contato. · Stacking retirado da sessão (fica no `treino-avancado-padroes-duplas`). · Sinais de mão viraram 'sinal combinado antes do saque' dentro do bloco de poach com cobertura. · Nível ampliado para 3.0–4.5: comunicação vale desde o 3.0. · Bloco de jogo final com chamada obrigatória (bola do meio sem chamada vale ponto ao adversário). · `when_to_use` aponta este treino como pré-requisito do de padrões de duplas.

Fontes: DUPR — Middle ball: who takes it and when · Pickleball Union — Cover the middle correctly in doubles · The Dink — Who covers the middle / X rule · seed_atual.json — dupla-como-corda, bola-do-meio-quem-chama, poach-no-dink-cruzado, cobertura-do-lob-troca

**Plano de 8 semanas** — Não virou item: a plataforma não tem semente de plano

Plano de 8 semanas com uma boa espinha dorsal: base fechada → terceira bola → velocidade de rede → semana de teste/alívio → decisão → transição e defesa → duplas → teste, e manutenção depois. As semanas 4 e 8 sem carga nova seguem o modelo 3:1 de periodização (três semanas de carga, uma de alívio). Falhas: não diz quantas sessões por semana nem a duração, lista 4 a 6 drills por semana sem dizer em que dia; cada semana concentra um tema só, o que favorece o desempenho no treino mas não a retenção — os temas anteriores deveriam voltar em parte de cada semana (prática intercalada); não há bloco físico; e cita drills que a avaliação reprovou ou corrigiu (o 'Saque Corrente' da semana de manutenção não entra, mas o 'Fechar o meio' da semana 7 traz a regra errada do meio). Planos (`training_plans`) são do atleta e não têm semente, então nada foi criado.

Correções: Não importado: não há plano-modelo na semente e não se cria estrutura nova de banco. · Como aproveitar: um professor monta o plano em Planos (8 semanas, 2 a 3 dias, 60 min) e o remete ao aluno; cada dia leva o aquecimento + 2 itens do tema da semana + 1 item de uma semana anterior (revisão intercalada), e um treino da biblioteca no dia de jogo. · Semanas 4 e 8: menos volume, mesmo nível — usar 'Dink até 11', 'Jogo 7-11' e 'Terceira bola ao vivo' com placar, sem drill novo. · Trocar 'Fechar o meio' por 'Bola do meio: quem chama?' (regra definida) e retirar o saque com pré-giro na mão. · Sugestão de produto (não implementada): o assistente de plano (`buildPlanSlots`) não tem semana de alívio; poderia reduzir itens a cada 4ª semana.

Fontes: Sports Medicine – Open 2023 (s40798-023-00633-0) — deload a cada 4–6 semanas, corte de volume · Malone Perform — modelo 3:1 de carga · Czyż et al. 2024 (Scientific Reports e Frontiers) — interferência contextual: retenção e transferência · src/modules/training/domain/plan.js — buildPlanSlots, PLAN_LIMITS

**Diagnóstico: A bola vai na rede toda vez que eu solto o drop** — Correto; serve como "quando usar"

Diagnóstico correto na essência: o drop deve ter o ápice do lado de quem bate e já estar descendo ao cruzar a rede; drop na rede costuma ser ápice baixo/do outro lado ou golpe 'freado' (o texto usa 'stiff' e 'braço'). Útil como `when_to_use` dos itens de drop, com linguagem de foco externo.

Correções: 'Stiff' trocado por 'golpe freado/rígido'; foco na trajetória da bola (subir do seu lado, cair na cozinha) e não no braço. · Recomendação: texto curto no `when_to_use` de 'Drop da terceira bola com alimentador' e 'Escada do drop', e dos drills de drop importados (Drop do fundo, Drop com topspin, Drop empurrado, Drop na transição).

Fontes: Pickleball Union — How high should a third shot drop be · Primetime Pickleball — 3rd shot drop arc

**Diagnóstico: Eu chego na rede e o outro me destrói** — Correto; serve como "quando usar"

Correto: chegar desequilibrado na transição é a causa típica; parar em split step no contato do adversário e resetar antes de avançar é o que se ensina. Já está refletido no `when_to_use` do treino 'Sessão completa' e combina com 'Reset na zona de transição', 'Split step no tempo do adversário' e 'Jogo 7-11'.

Correções: Usado no `when_to_use` de `treino-sessao-completa-cozinha-ao-fundo`; recomendado também no `treino-intermediario-transicao`.

Fontes: Pickleball.com — plano de 1 hora (roll and reset na transição)

**Diagnóstico: Erro de drive e erro de rede no mesmo ponto** — Útil depois de reescrito

O sintoma está mal formulado (não se entende a situação), mas a causa apontada é real: acelerar bola baixa, abaixo da altura da rede. A correção é ler a altura do contato — só acelerar a bola acima da fita. Serve para 'Dink e ataque da bola alta' e 'Speed-up e contra-ataque'.

Correções: Reescrever como 'Acelero bola baixa e erro na rede ou fora'. · Indicar 'Dink e ataque da bola alta' e 'Speed-up e contra-ataque' (e o drill de leitura de ataque importado).

Fontes: seed_atual.json — dink-e-ataque-da-bola-alta, speed-up-e-contra-ataque

**Diagnóstico: Meu dink morre quando o adversário aperta** — Útil depois de reescrito

Mão firme demais é causa plausível de bola que sobe ou morre na rede sob pressão; a pressão leve na empunhadura é recomendação comum. A afirmação 'face fechada' generaliza: o dink pede face ligeiramente aberta, e o erro sob pressão também vem de não se deslocar até a bola. A lista mistura absorção na parede e defesa de quique com dink.

Correções: Explicar como 'raquete solta e face levemente aberta; desloque-se até a bola' em foco externo. · Indicar 'Dink em oito', 'Voleio de bloqueio contra o drive' e 'Reset de bloqueio nos pés'.

Fontes: Harvard Health — pressão da empunhadura (contexto) · seed_atual.json — fundamento dink, dink-em-oito

**Diagnóstico: Eu não sei quando acelerar** — Correto; serve como "quando usar"

Correto: falta ler a bola atacável (acima da rede, à frente do corpo). Anunciar a decisão em voz alta antes de bater é um recurso válido de treino de decisão. Útil no `when_to_use` de 'Dink e ataque da bola alta' e do drill de leitura de ataque importado.

Correções: Sem mudança de conteúdo; só texto em português e foco externo.

Fontes: seed_atual.json — dink-e-ataque-da-bola-alta

**Diagnóstico: Perco pontos no meio da quadra com a dupla** — Errado como está

O sintoma é real, mas a solução da fonte está errada: 'o meio é responsabilidade compartilhada' é exatamente o que produz a bola sem dono. O que se ensina é uma regra combinada (forehand na bola lenta, diagonal na bola rápida) com chamada antes do contato. Com a correção, vira o `when_to_use` do treino de dupla criado.

Correções: Regra do meio corrigida e aplicada no `treino-dupla-chamada-meio-e-cobertura` (bloco 'Bola do meio: quem chama?' e `when_to_use`). · Indicar 'Bola do meio: quem chama?' e a jogada 'Ataque ao meio: a bola da dúvida'; não indicar o drill 'Fechar o meio' da fonte sem corrigir a regra.

Fontes: DUPR — Middle ball: who takes it and when · Pickleball Union — Cover the middle correctly · The Dink — Covering the middle: 4 rules

**Diagnóstico: Meu backhand é o ponto fraco** — Útil depois de reescrito

A lista tem um erro: 'Saque no backhand adversário' treina o saque em quem joga do outro lado, não o backhand de quem tem o problema. A frase 'a lacuna mais comum entre 3.5 e 4.0' é afirmação sem base. Roll de backhand, devolução e dink cruzado de backhand fazem sentido.

Correções: Retirar o drill de saque da lista e a afirmação estatística. · Indicar 'Dink cruzado no pé de dentro' e 'Dink em oito' feitos só de backhand, 'Reset de bloqueio nos pés' na versão só de backhand e 'Devolução de saque funda' para o backhand.

Fontes: seed_atual.json — reset-de-bloqueio-nos-pes (versão só de backhand)

**Diagnóstico: Erro duas vezes o mesmo ponto em sequência** — Correto; serve como "quando usar"

Rotina entre pontos e limitar o tempo de frustração são recomendações correntes de psicologia do esporte; 'não é falta de técnica' é exagero (pode ser as duas coisas). Já existe o estudo 'Rotina entre pontos' na biblioteca, que é o lugar natural do texto.

Correções: Trocar 'não é falta de técnica' por 'nem sempre é técnica'. · Indicar o estudo `rotina-entre-pontos`.

Fontes: seed_atual.json — estudo rotina-entre-pontos

**Diagnóstico: Meu serviço não incomoda ninguém** — Errado como está

Indica drills de saque com pré-giro da bola na mão ('Saque Corrente' e o passo de pré-spin da 'Rotação de Spin no Saque'), proibido pela USA Pickleball (a bola não pode ser girada com a mão/dedos antes do saque; efeito dado pela raquete continua legal). Fora isso, a ideia é certa: primeiro profundidade e direção, depois variação de efeito com a raquete — e para o amador a prioridade é consistência.

Correções: Retirar qualquer indicação de pré-giro na mão. · Indicar 'Saque fundo com alvo' e o fundamento 'Saque por baixo', com variação de efeito só pela raquete.

Fontes: USA Pickleball (help center) — Can you spin serve / chainsaw serve proibido · Pickleball.com docs — Why was the spin serve banned

**Diagnóstico: Só acelero quando alguém me obriga** — Útil depois de reescrito

Correto em parte: falta plano de ponto e iniciativa na bola atacável. Indicar construção de ponto (terceira, quinta bola) e o jogo de dink com ataque liberado é coerente.

Correções: Indicar 'Drive da terceira e drop da quinta', 'Dink até 11' com ataque e o treino 'Mãos rápidas na rede'.

Fontes: seed_atual.json — drive-da-terceira-e-drop-da-quinta, dink-ate-11

**Diagnóstico: Me perco nos primeiros 5 minutos do set** — Útil depois de reescrito

Aquecimento específico antes de jogar e rotina entre pontos resolvem o começo lento — correto. A frase 'o ponto final do set é físico, não tático' não tem relação com o sintoma e foi descartada.

Correções: Descartar a frase sem sentido. · Indicar 'Aquecimento dinâmico de 10 minutos' e o estudo 'Rotina entre pontos'.

Fontes: seed_atual.json — aquecimento-dinamico, rotina-entre-pontos

**Diagnóstico: Com a raquete na mão, o braço lateja** — Rejeitado

Dor que lateja no braço é sinal de sobrecarga (o 'cotovelo de pickleball', epicondilite lateral, é a lesão mais citada) e pede reduzir ou parar e procurar um profissional de saúde se persistir — não um drill. A prescrição da fonte é insegura: manda para 'drills de parede, de menor impacto', mas a parede é volume alto e contínuo, e um deles é literalmente 'Sobrecarga na Parede' (4 × 30); o circuito aeróbico e os intervalos também aumentam a carga. A plataforma não deve dar diagnóstico nem tratamento.

Correções: Não usar como diagnóstico com drills. · Se aproveitado, só como orientação de segurança: 'dor que não passa: pare, reduza o volume e procure um profissional de saúde; confira o tamanho da empunhadura e use pressão leve na raquete'. O físico 'Antebraço com descida lenta' só com orientação profissional.

Fontes: Harvard Health — How to avoid this common pickleball injury · PPA Tour blog — The pain of pickleball elbow · Selkirk — Tennis elbow in pickleball

