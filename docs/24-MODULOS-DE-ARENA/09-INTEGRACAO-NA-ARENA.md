# Integração dos módulos à arena — plano e estado

> **Pedido** (2026-09-24): *"os módulos da arena V3 estão um tanto separados
> do restante da arena. Eu preciso que os módulos sejam integrados à arena e à
> gestão da arena em si. Vamos iniciar pelos módulos de membros, aulas e
> instrutores e torneios internos. […] Eles ainda precisam ser ativados pelo
> admin da plataforma e ativados pelo gestor da arena, se assim ele quiser.
> Mas as funcionalidades precisam ser integradas junto com as demais
> funcionalidades das arenas."*
>
> **O que NÃO muda**: as três camadas. A plataforma libera, a arena ativa, e
> só então a funcionalidade aparece. Módulo desligado = nada muda na arena.

---

## 1. O diagnóstico — por que parecia "algo adicional"

Levantamento de ponta a ponta (2026-09-24). Cinco causas, e só a primeira é
de aparência:

1. **Cada módulo era uma página separada**, alcançada por um botão de atalho
   no topo (`ArenaModuleShortcuts`). A gestão tem seções e abas
   (`buildArenaSections` em `V2ArenaManage.jsx`); os módulos ficavam fora
   delas. A página pública é uma coluna única com seções; os módulos, de novo,
   eram botões para fora.
2. **Dois cadastros de professor para a mesma arena.** O "Sistema A"
   (`coaches/{uid}` + `coach_arenas`: professor da plataforma, parceiro da
   arena, aba *Equipe → Professores*) e o do módulo de aulas
   (`arena_coaches`). O formulário de aulas buscava no diretório de ATLETAS,
   então o mesmo professor parceiro virava dois registros sem ligação.
3. **Dois lugares de torneio que não se viam.** Torneio da plataforma com
   `arena_id` aparece na página pública e em lugar nenhum da gestão; torneio
   interno só na página do módulo.
4. **O atleta não encontrava o que é dele.** Matrícula em aula só aparecia em
   `/arenas/:id/aulas`; inscrição em torneio interno, só em `/arenas/:id/torneios`.
   `/minhas-aulas` mostra só as aulas particulares do Sistema A; o professor
   vinculado a uma arena não via as aulas dela em `/aulas`.
5. **Membro e cliente eram dois mundos.** A aba *Clientes* (CRM) sai das
   reservas; `arena_members` é outro cadastro. Nenhum dos dois mostrava o
   outro.

### Defeitos encontrados no caminho

| # | Defeito | Onde |
|---|---|---|
| D1 | A gestão **não lê `?secao=&aba=`**: quatro links internos ("abrir os módulos", "abrir o mercado") caíam em *Reservas* | `V2ArenaManage.jsx`; links em Marketing, Avançado, Operações |
| D2 | A matrícula grava `partner: true` **fixo**: professor da casa paga comissão | `V2ArenaClasses.jsx` (divisão e matrícula) |
| D3 | `useArenaTournaments` e `useArenaCoaches` existem **duas vezes**, com dados diferentes, e a chave de cache do torneio interno é prefixo da do torneio da plataforma | `useArenaV3.js` × `useTournament.js` / `useCoaches.js` |
| D4 | "Encerrar torneio" (que pontua o ladder) **não tem botão**: `useFinishTournament` não é usado por tela nenhuma | `V2ArenaLeagues.jsx` |
| D5 | Parceria **pendente** aparece como "Ativo"; e pausar → retomar grava `active` pulando o aceite do professor | `V2ArenaCoaches.jsx`, `coachService.js` |

---

## 2. O desenho

### 2.1 A gestão da arena (Central)

As abas passam a ser **endereçáveis por URL** (`?aba=`, com `?secao=` aceito
por compatibilidade) — isso corrige D1 e permite que as rotas antigas dos
módulos virem atalhos para a aba certa, sem quebrar notificação antiga.

| Seção | Abas | Aparece quando |
|---|---|---|
| Reservas | … + **Clientes** (com selo de membro e "incluir como membro") | sempre (selo só com Membros) |
| **Membros** | **Membros** · **Planos e pacotes** | módulo `members` ativo |
| **Aulas** | **Agenda de aulas** · **Professores** (lista única: parceiros + quem dá aula) | módulo `classes` ativo |
| **Torneios** | **Da casa** (internos + ladder) · **Da plataforma** (torneios com `arena_id`) | internos: `leagues`; plataforma: sempre que houver |
| Equipe e parceiros | Administradores · Professores (quando Aulas está desligado) · Clubes | sempre |

Com o módulo desligado, a gestão fica **idêntica** ao que era.

### 2.2 A página pública da arena

Os botões de atalho dos três módulos saem; entram **seções nativas**, no
fluxo da página, com a ação principal ali mesmo (matricular, inscrever,
comprar pacote) e "ver tudo" para a página completa:

- **Planos e vantagens** — minha situação (nível, horas, saldo) e os pacotes.
- **Aulas e professores** — próximas aulas + professores (a seção
  "Professores parceiros" que já existia vira parte dela).
- **Torneios** — os da casa com inscrição aberta + ladder, junto dos da
  plataforma que já apareciam.

### 2.3 O lado do atleta e do professor

- `/minhas-aulas` ganha **Aulas nas arenas** (matrículas de todas as arenas).
- `/aulas` (agenda do professor) ganha **Aulas que você dá nas arenas**.
- As inscrições em torneio interno aparecem junto dos outros torneios da
  pessoa.

### 2.4 Banco

Mesma regra das ondas anteriores: **nenhuma coleção nova, nenhum índice
novo**; consultas com um `where` só e ordenação em memória.

---

## 3. Ordem de entrega

| PR | Conteúdo | Estado |
|---|---|---|
| I-1 | Abas por URL (D1) + seção **Membros** na gestão + membros na página pública + selo no CRM | ✅ §4 |
| I-2 | Seção **Aulas**, lista única de professores (Sistema A + aulas), D2, D5, aulas no lado do atleta e do professor | ⏳ |
| I-3 | Seção **Torneios** (casa + plataforma), D3, D4, torneios na página pública e no lado do atleta | ⏳ |
| I-4 | Receita de aulas, planos e torneios no painel de métricas | ⏳ |

---

## 4. I-1 — Membros dentro da arena (entregue)

### A Central passa a ter endereço

`?aba=` escolhe a aba (e `?secao=` abre a primeira aba da seção, pelos links
antigos). Clicar numa aba grava o lugar na URL — recarregar não devolve a
pessoa para Reservas. **Isso corrigiu D1**: "abrir os módulos" (Marketing,
Avançado, Operações) e "abrir o mercado" caíam sempre em Reservas.

Duas regras que a navegação depende:

- **O valor de cada aba é único em toda a Central.** A seção ativa é achada
  pela aba; um valor repetido tornaria a segunda inalcançável. A estrutura
  mora em `v2/components/arenas/arenaManageSections.js` e há teste travando.
- **Aba de módulo desligado cai em Reservas** — nunca tela em branco. Enquanto
  os módulos ainda CARREGAM, a aba pedida espera (esqueleto) em vez de mostrar
  Reservas por meio segundo e trocar.

### Onde os membros estão agora

| Lugar | O quê |
|---|---|
| Central → **Membros** → *Membros* | quem é membro, incluir, pontos, carteira, mensalidade |
| Central → **Membros** → *Pacotes de horas* | a vitrine de pacotes (só com o módulo de pacotes) |
| Central → Reservas → **Clientes** | selo do nível de quem é membro; **"Tornar membro"** para quem reservou 3+ vezes confirmadas e ainda não é; filtro "Ver só esses" |
| Página da arena → **Planos e vantagens** | membro: nível, desconto, horas que restam, saldo, mensalidade em atraso; quem não é: até 2 pacotes, compra ali mesmo |

- A seção pública fica **logo depois dos Preços** — é olhando o preço da hora
  avulsa que se decide comprar pacote.
- Sem ser membro e sem pacote à venda, a seção **não aparece** (uma caixa
  dizendo "fale com a arena" no meio da página não ajuda ninguém).
- Cliente **avulso** (reserva manual, sem conta) nunca é candidato a membro:
  não há a quem dar o benefício.

### O que deixou de existir

- O **botão de atalho** de Membros, nos dois lados: o catálogo marca o módulo
  como `native` e `ArenaModuleShortcuts` não gera atalho para ele.
- A **tela avulsa** `/gerir/membros`: a rota continua (notificações antigas
  apontam para ela) e leva à aba da Central.

### De quebra

- A data da última reserva na aba Clientes e as datas especiais de preço na
  página da arena saíam em ISO cru (`2026-09-01`); agora em pt-BR.
- O cartão de pacote virou componente compartilhado
  (`PackageForSaleCard`): importá-lo da página de membros traria a página
  inteira para o pacote da página da arena.
