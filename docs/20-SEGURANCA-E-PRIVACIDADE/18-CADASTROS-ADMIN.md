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
