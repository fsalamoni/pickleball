# 20.18 — Cadastros: o admin corrige e complementa

> **Painel admin → Comunidade → Cadastros** ·
> `src/v2/components/admin/AdminUserRecordsTab.jsx`
> Domínio puro em `src/modules/admin/domain/adminUserEdit.js`

## O pedido

> *"crie o espaço, na plataforma, em que eu (owner/admin) consiga editar,
> complementar, corrigir e ajustar os cadastros dos usuários. Preencher
> detalhes e informações que faltam, corrigir erros e tudo mais."*

## O que a tela faz

1. **Lista todos os cadastros**, com busca por nome, e-mail, cidade ou uid.
2. **Aponta o que falta** em cada um — antes, descobrir que um atleta está sem
   data de nascimento exigia abrir o banco. Quem tem campo **obrigatório**
   faltando aparece primeiro, porque é quem precisa de ação.
3. **Edita**: formulário agrupado (Identidade · Localização · Jogo), com os
   campos vazios marcados.
4. **Mostra o antes → depois** de cada campo **antes** de salvar.
5. **Exige motivo**, que vai para a Auditoria junto com o diff.
6. **Re-sincroniza o espelho público** (`athlete_profiles`) — sem isso a
   correção não aparece no diretório e alguém a refaz na semana seguinte.

## As listas são as MESMAS do cadastro normal

Onde o cadastro do usuário tem lista de seleção, a tela do admin tem a **mesma
lista** — importada da fonte, nunca recopiada:

| Campo | Fonte da lista |
|---|---|
| Gênero | `ATHLETE_GENDER_LABELS` (`athletes/domain/constants`) |
| Categoria competitiva | `COMPETITION_GENDER_LABELS` (`tournament/domain/constants`) |
| Experiência no pickleball | `PICKLEBALL_EXPERIENCE_LABELS` (idem) |
| Lado na quadra | `COURT_SIDE_OPTIONS` (`athletes/domain/profileMeta`) |
| Nível declarado | `LEVEL_OPTIONS` (`leveling/data/levels`) |

Cidade, endereço, telefone e **UF** seguem texto livre — porque no cadastro
normal também são. Não inventamos uma lista que a plataforma não tem.

**Por que importa**: o resto do sistema lê esses campos por CÓDIGO (`male`,
`right`, `1-2-anos`). Texto livre ali gravaria um valor que nenhuma tela
entende e que nenhum sorteio consegue usar. Um teste compara as opções da tela
com a fonte, campo a campo — se alguém recopiar uma lista, ele quebra.

**Valor legado fora da lista**: aparece no seletor, marcado como
*"valor antigo, fora da lista"*, com um aviso pedindo para escolher um válido.
Ele **não é apagado em silêncio** — sumir com a informação sem o admin ver
seria pior do que mantê-la. E um valor fora da lista nunca é GRAVADO: o
`sanitize` o descarta e registra em `ignored_fields` na auditoria.

## Campos irmãos: o nível grava quatro, não um

O formulário do usuário, ao salvar o nível, grava `leveling_level` (o código),
`level` (o texto que as telas exibem), `leveling_method` e
`leveling_manual_level`. Gravar só o código deixaria o texto exibido apontando
para o nível **antigo** — inclusive no espelho público.

É a mesma armadilha de `birth_date` / `birth_date_at`, e a solução é a mesma:
`derivedFieldsFor` monta os irmãos no domínio, o `sanitize` já os inclui, e a
regra do Firestore aceita os quatro juntos (uma escrita que trouxesse só parte
seria recusada inteira pelo `hasOnly`).

## O limite: corrigir o dado ≠ decidir quem o vê

A lista de campos editáveis é **fechada** e está em três lugares que não podem
divergir: o domínio (`ADMIN_EDITABLE_FIELDS`), a regra do Firestore, e o teste
que confere os dois. Três grupos ficam de fora **de propósito**:

| Fora do alcance | Por quê |
|---|---|
| `role`, `can_create_pools` | **Poder.** É o que a correção do P0-01 fechou. Revogar tem caminho próprio (aba Acessos); conceder é só pelo console |
| `email_public`, `phone_public`, `address_public`, `directory_listed` | **Privacidade é do titular.** Um admin ligando `email_public` exporia o e-mail de alguém contra a vontade dela. Se a pessoa quer mudar, ela muda no próprio perfil |
| `email` | **Identidade de login.** Mora no Firebase Authentication; mudar aqui só dessincronizaria o espelho |
| `hidden*` | Moderação de exibição, com caminho e aviso próprios |

Uma escrita que misture campo permitido com proibido é recusada **inteira**
pelo `hasOnly` da regra — não aplicada pela metade. E o serviço **descarta** o
campo proibido antes de gravar, para que uma correção legítima não se perca
junto com ele.

## Um bug que o teste pegou antes de ir ao ar

`Number('')` é `0`, e é finito. A primeira versão tratava campo numérico com
`Number()` cru — então **abrir um cadastro sem DUPR e salvar gravaria
`dupr_rating: 0`**, um valor errado que ninguém digitou. Pior: o diff acusava
uma alteração inexistente, deixando o botão "salvar" habilitado sozinho.

A correção foi um normalizador único (`numeroOuNulo`) usado tanto na limpeza
quanto na comparação, para `''`, `null` e `undefined` serem sempre a mesma
coisa — e um zero digitado de verdade continuar sendo zero. Três testes
guardam isso.

## Auditoria

`admin_user_record_edited` grava:

```js
{ target_uid, reason,
  changes: [{ field, from, to }],   // antes/depois campo a campo
  ignored_fields: [...] }           // o que foi descartado por não ser editável
```

Sem o antes/depois, "o admin editou o cadastro" não diz nada a quem for
investigar depois.

## Excluir cadastro (2026-09-24)

> *"Quero que tenha a possibilidade de excluir cadastros. Pois há muitos
> cadastros de exemplo e mock que foram criados e quero poder excluir eles."*

### Onde e como

Cada linha ganhou **Excluir** e uma caixa de seleção; há **Selecionar os que
aparecem** (até 25) e um filtro **Parecem de teste**. O filtro sugere a partir
de sinais simples — conta oculta na moderação, e-mail de domínio de exemplo
(`@example.com`…), nome ou e-mail com "teste", "mock", "demo", "fake" — e
**mostra em cada linha o que levantou a suspeita**. As palavras são comparadas
INTEIRAS: "Ernesto" e "Demóstenes" não caem no filtro (há teste).

Excluir tem três momentos, e nenhum pode ser pulado:

1. **Prévia do servidor** — para cada conta: o que será apagado, o que fica no
   histórico como "Atleta removido", o que fica guardado sem o nome, e o que
   **impede**. Só lê.
2. **Confirmação** — motivo (vai para a Auditoria) e digitar `EXCLUIR`. Conta
   impedida fica de fora sozinha.
3. **Resultado** — conta a conta.

### Por que no servidor

Conta de teste é **conta de verdade**: todo `users/{uid}` nasce do login. Apagar
só os documentos faz o cadastro **voltar** no próximo login
(`FirebaseAuthContext` recria perfil e espelho). Só o Admin SDK apaga a conta
do Firebase Authentication — e o admin, pelas regras, não alcança tokens de
push, favoritos, votos, conversas nem as fotos do Storage. A função é
`adminDeleteAccounts`; o motor, com o desenho inteiro, é
`functions/accountDeletion.js`.

### O que acontece com cada coisa

Segue a tabela aprovada em `09-DIREITOS-DO-TITULAR.md` §4:

| Destino | O quê |
|---|---|
| **Apagado** | `users`, `athlete_profiles`, conta de login, fotos (`uploads/{uid}/`), tokens de push, notificações, favoritos, seguidores, metas, gamificação pessoal, ratings materializados, vínculos (clube, crew, gestão de arena, admin de torneio/circuito), pedidos e convites, filas de espera, associação a arena, respostas de NPS, parcerias de professor |
| **Pseudonimizado** (uid fica, nome sai) | inscrições e partidas, dias de jogo, conversas, fórum, avaliações — apagar reescreveria resultado e rating de outras pessoas |
| **Retido, sem o nome** | reservas, vendas, pagamentos, carteira, mensalidade (obrigação do parceiro) |
| **Retido como está** | `audit_logs` e `legal_consents` — prova de que a exclusão foi feita direito |

### O que IMPEDE (e o que fazer)

A pergunta é *excluir quebra o serviço de outra pessoa?* Se sim, o admin
resolve antes:

| Impedimento | O que fazer |
|---|---|
| dona de arena ou de rede de arenas | transferir ou excluir a arena/rede |
| única admin de clube | nomear outro admin ou excluir o clube |
| organiza torneio **vivo** (inscrições abertas/encerradas, em andamento) | encerrar, cancelar ou excluir — rascunho NÃO impede |
| criou dia de jogo **ativo, futuro e com outras pessoas** | arquivar ou excluir |
| saldo positivo em carteira de arena | resolver com a arena — o saldo é da pessoa |

### As travas

- **Nunca**: a própria conta, conta com `platform_admin` (tire o poder em
  *Governança → Acessos* antes) e e-mail de dono — conferido na tela E no
  servidor. A lista de donos do servidor é cópia da do cliente, com teste
  exigindo que sejam iguais.
- **Só o dono executa.** Outro admin vê a prévia e a tela diz por que não há
  botão. É o mesmo critério da revogação de poderes — e excluir é mais
  destrutivo que revogar, com o achado de admins extras ainda aberto.
- **Prévia e execução são a mesma análise**: a execução refaz tudo no
  servidor e nunca age sobre um plano vindo do navegador.
- **Limite**: 25 contas por vez, 400 documentos por consulta (acima disso o
  relatório avisa, e rodar de novo termina).
- **Ordem que tolera falha**: conta de login PRIMEIRO (sem ela o cadastro não
  volta); `users/{uid}` POR ÚLTIMO (enquanto existe, o admin ainda vê a conta
  e pode rodar de novo). Se a conta de login não puder ser apagada, **nada**
  é apagado. Rodar duas vezes é seguro.
- Contador de clube/crew só desce se o clube/crew existe — `update` num
  documento ausente derrubaria o lote.
- **Auditoria** `admin_account_deleted`: motivo, se a conta de login foi
  apagada, e o que foi apagado / pseudonimizado / retido, item a item.

### Os limites, ditos na cara

- **Ranking**: enquanto existirem partidas com o uid, o recálculo de ranking
  recria a linha dessa pessoa, com o nome "Atleta". Se o **torneio inteiro**
  era de teste, exclua o torneio (Torneios) — as partidas somem e o ranking
  se corrige sozinho no recálculo seguinte.
- **Deploy**: a função sai no deploy de Functions do CI, que **não derruba** o
  deploy do site quando falha. Se a tela estiver no ar e a função não, o
  diálogo diz exatamente isso em vez de "internal".
- **Não é o autoatendimento do titular** ("Excluir minha conta", 7 dias de
  arrependimento, reautenticação) — isso continua em `19-PENDENCIAS.md` §5.
- **O que a descoberta não alcança** (sem índice de grupo de coleções, que
  seria mexer no banco): conversa de que a pessoa JÁ SAIU (as mensagens dela
  ficam lá), participante que RECUSOU convite de reserva, e dia de jogo do
  qual ela foi removida e que não tem jogo publicado. São casos de borda de
  conta real; para conta de teste, que é o pedido, não aparecem.

### Armadilhas que o código evita (e os testes travam)

1. **No jogo, `slot.id` é o id do documento de PARTICIPANTE, não o uid.**
   Tratar `id` como uid trocaria o nome da pessoa errada. E ao trocar o nome,
   o uid é gravado no lado: o ranking resolve pessoa por nome único como
   último recurso, e dois "Atleta removido" no mesmo dia ficariam
   indistinguíveis.
2. **O rótulo "A / B" é derivado.** Trocar só `player_a_name` deixaria o
   quadro, a impressão e o telão com o nome antigo — o rótulo é recalculado,
   e os grupos (`tournament_groups.entrants[].label`), que copiam o rótulo,
   também.
3. **A descoberta vem antes de qualquer escrita.** Eventos de clube são
   achados pela presença e pelo convite, que a própria exclusão APAGA.
4. **Nome pode ser e-mail.** Vários serviços usam o e-mail quando falta nome;
   trocar o campo de nome remove também o e-mail que vazou para ele.
5. **Mensagem perde o conteúdo e os anexos** — o arquivo está em
   `uploads/{uid}/`, que é apagado junto.

### Cobertura

- 19 testes do domínio da tela (`accountDeletion.test.js`)
- 34 do domínio do servidor, **13 da cascata** e **27 da pseudonimização com
  as especificações reais** contra um Firestore falso
  (`functions/accountDeletion*.test.js`): conta impedida não perde nada, a
  conta de login sai antes de qualquer escrita, `users` sai por último, falha
  no login = nada apagado, reexecução idêntica, auditoria gravada, e **nenhum
  documento de outra pessoa é apagado**
- 10 de tela (`AdminUserRecordsTab.deletion.runtime.test.jsx`)

## O que esta entrega NÃO é

A especificação completa do console de suporte (`05-ADMIN-SUPORTE.md`) desenha
bem mais: sessão de quebra-vidro com motivo e prazo, mascaramento por padrão,
registro de cada REVELAÇÃO de campo, notificação ao titular, detecção de abuso
e leitura via Cloud Function. **Nada disso está aqui.**

O que existe é a parte de ESCRITA, com lista fechada, motivo obrigatório e
auditoria com diff. A leitura continua sendo o que já era: o admin lê a coleção
`users` direto, como sempre pôde — o que significa que **acesso de leitura
ainda não é registrado**. Fechar isso exige a Cloud Function do S7, porque
enquanto a leitura direta existir, qualquer registro no cliente é contornável.

| Item do S7 | Estado |
|---|---|
| Editar/corrigir cadastro | ✅ esta entrega |
| Motivo obrigatório + auditoria com diff | ✅ esta entrega |
| Campos de poder e privacidade fora do alcance | ✅ esta entrega |
| Sessão de quebra-vidro (prazo, motivo, encerramento) | 📐 desenhado |
| Mascaramento por padrão + log de revelação | 📐 desenhado |
| Notificar o titular | 📐 desenhado |
| Detecção de abuso | 📐 desenhado |
| Leitura via Cloud Function (registro inescapável) | 📐 desenhado |

## Cobertura

- 35 testes de domínio (`adminUserEdit.test.js`)
- 16 de runtime (`AdminUserRecordsTab.runtime.test.jsx`)
- 10 asserções no emulador (`users.rules.test.js` §42-50), metade dedicada ao
  que o admin **não** consegue
