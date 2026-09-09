# 20.05 — Console de Suporte do Admin

> **O pedido**: *"no ambiente admin, eu quero ter acesso aos dados dos
> usuários, como admin, para poder corrigir algo se for necessário ou
> auxiliar os usuários que precisarem de ajuda, então construa uma aba
> específica para isso, me dando acesso total, com segurança extrema."*
>
> Este documento é a especificação completa dessa aba.
>
> **Estado (2026-09-09): parcialmente implementado.** A parte de ESCRITA — o
> admin corrigir e complementar o cadastro, com lista fechada de campos, motivo
> obrigatório e auditoria com antes/depois — está no ar em
> **Comunidade → Cadastros** (`18-CADASTROS-ADMIN.md`). O restante desta
> especificação (quebra-vidro, mascaramento, log de revelação, notificação ao
> titular, detecção de abuso, leitura via Cloud Function) segue **desenhado e
> não implementado**.

---

## 1. O paradoxo que precisa ser resolvido

"Acesso total" e "segurança extrema" parecem opostos. Não são — desde que
se entenda o que cada um significa aqui:

| | O que **não** é | O que **é** |
|---|---|---|
| **Acesso total** | poder ler tudo, a qualquer momento, sem deixar rastro | poder chegar em **qualquer dado quando houver um motivo**, sem depender de ninguém e sem obstáculo burocrático |
| **Segurança extrema** | dificultar o trabalho do admin | garantir que, se a conta do admin for comprometida, o estrago seja **limitado, detectável e reversível** |

A pergunta certa não é *"o admin pode ver isso?"* — é
***"se a conta do admin for roubada hoje à noite, o que o atacante
consegue, e quando eu descubro?"***

Hoje a resposta é: **tudo, e nunca**. Este documento muda isso.

### O risco concreto que estamos mitigando
A plataforma tem **um** administrador. Se `fsalamoni@gmail.com` for
comprometido (phishing, senha reusada, sessão roubada, dispositivo
perdido), o atacante hoje: lê e-mail, telefone, **data de nascimento** e
endereço de toda a base; exclui usuários; altera rankings; apaga rastros
não — os `audit_logs` são imutáveis, o que é a única boa notícia.

Segurança extrema aqui significa: **o admin continua podendo tudo, mas o
atacante que virar admin não consegue fazer tudo em silêncio.**

---

## 2. Princípios do console

1. **Acesso justificado.** Toda consulta a dado pessoal de outra pessoa
   pede um motivo. Sem motivo, sem consulta. Não é burocracia — é o que
   torna o log útil (log sem motivo não distingue trabalho de abuso).
2. **Mínimo por padrão, tudo sob demanda.** A tela abre **mascarada**.
   Revelar cada bloco sensível é uma ação consciente e registrada.
3. **Sessão administrativa curta.** O poder de suporte dura 30 minutos e
   exige reautenticação. Sessão eterna é o que transforma um token roubado
   em acesso permanente.
4. **Tudo registrado, nada apagável.** Cada visualização, revelação,
   exportação e alteração vira uma entrada imutável.
5. **Transparência para o titular.** O usuário pode ver, no próprio perfil,
   quando seus dados foram acessados pelo suporte e por quê. Isso é o que
   separa suporte de vigilância — e é o controle mais poderoso de todos,
   porque cria uma testemunha.
6. **Escrita é a exceção.** Ler para ajudar é rotina. **Alterar** o dado de
   alguém é ação rara, com confirmação dupla, motivo obrigatório, valor
   anterior preservado e desfazer disponível.
7. **Nada que o admin não precise.** Senha nunca (nem existe — o Firebase
   Auth não a expõe). Conteúdo de conversa privada: só com autorização
   explícita do titular ou ordem judicial.
8. **Impersonação nunca é silenciosa.** "Ver como o usuário" é somente
   leitura, marcado na interface, e o titular é notificado.

---

## 3. Arquitetura

### 3.1 Por que passa por Cloud Function, e não direto pelo Firestore

Se o console lesse `users/{uid}` direto do cliente, seria preciso dar ao
`platform_admin` `allow read` em toda a base — e aí **nenhum** dos controles
acima existiria: sem motivo, sem sessão curta, sem mascaramento, sem log
confiável (o log seria escrito pelo próprio cliente, que o admin controla).

Então: **o console não lê o Firestore diretamente.** Ele chama Cloud
Functions (`onCall`, Admin SDK) que:
1. validam que quem chama é admin **pelo custom claim** (não pelo campo
   `role` — ver `patches/P0-01`, Etapa 2);
2. validam que há uma sessão de suporte aberta e válida;
3. escrevem o log **antes** de devolver o dado (log-then-serve: se o log
   falhar, o dado não sai);
4. devolvem **só os campos pedidos**, já mascarados conforme o nível.

Isso permite manter a regra do Firestore restritiva — o admin **não**
precisa de leitura ampla no banco — e concentra o poder num lugar auditável.

```
┌────────────────────────────────────────────────────────────┐
│ V2AdminSupport (aba no painel admin)                       │
│  ─ busca ─ ficha ─ ações ─ histórico do que EU acessei     │
└───────────────────────┬────────────────────────────────────┘
                        │ onCall (App Check + custom claim + sessão)
                        ▼
┌────────────────────────────────────────────────────────────┐
│ Cloud Functions de suporte (Admin SDK, região SP)          │
│  supportOpenSession · supportSearchUser · supportGetUser   │
│  supportRevealField · supportUpdateUser · supportAction    │
│  supportExportUser · supportCloseSession                   │
│                                                             │
│  cada uma: verifica claim → verifica sessão → GRAVA LOG →  │
│            executa → devolve mascarado                     │
└───────────────────────┬────────────────────────────────────┘
                        ▼
        Firestore (Admin SDK ignora as regras — por isso a
        validação TEM de estar completa na Function)
                        │
                        ▼
        admin_access_logs (imutável) + notificação ao titular
```

⚠ **Consequência que precisa estar clara**: o Admin SDK **ignora as regras
do Firestore**. Toda a segurança do console mora no código da Function.
Uma Function de suporte mal escrita é mais perigosa que uma regra
permissiva, porque não há segunda barreira. Por isso: revisão obrigatória,
testes, e nenhuma Function de suporte que aceite "nome da coleção" como
parâmetro livre (ver §9).

### 3.2 Sessão de suporte (quebra-vidro)

```js
// admin_support_sessions/{sessionId}
{
  admin_uid, admin_email,
  reason_category: 'suporte_solicitado' | 'correcao_de_dado'
                 | 'investigacao_de_abuso' | 'requisicao_do_titular'
                 | 'ordem_judicial' | 'incidente_de_seguranca' | 'outro',
  reason_text: '',                  // ≥ 20 chars, obrigatório
  ticket_ref: '',                   // opcional: e-mail/print do pedido
  target_uid: null,                 // preenchido ao abrir uma ficha
  scope: ['identidade','contato','jogos'],   // o que a sessão autoriza
  mfa_verified_at: <ts>,            // reautenticação no início
  opened_at, expires_at,            // +30 min, não renovável mais de 2x
  closed_at: null, closed_reason: '',
  actions_count: 0, reveals_count: 0,
  ip_hash: '', user_agent: '',
  created_at
}
```

Regras da sessão:
- **Reautenticação obrigatória** ao abrir (senha + 2º fator).
- Expira em **30 minutos**; renovável 2×, depois exige nova sessão.
- Uma sessão = **um titular**. Para ver outro usuário, abre outra sessão
  (com outro motivo). Isso impede a "pescaria": abrir uma sessão e navegar
  pela base inteira.
- Sessão aberta fica visível no topo do painel admin, com contador
  regressivo e botão "Encerrar agora".
- Fechamento automático ao sair da aba.

---

## 4. A aba: `/admin/painel?tab=support`

Entra como aba nova em `V2AdminConsole.jsx`, na seção **Governança**
(mesmo padrão aditivo de `buildSections(duprExportOn)`):

```js
{ id: 'support', label: 'Suporte ao usuário', icon: LifeBuoy }
```

### 4.1 Estado fechado (o padrão)

```
┌──────────────────────────────────────────────────────────────┐
│ 🛟 Suporte ao usuário                                        │
│                                                              │
│ Esta área dá acesso a dados pessoais de usuários. Todo       │
│ acesso é registrado e o titular pode consultá-lo.            │
│                                                              │
│ Para começar, abra uma sessão de suporte:                    │
│                                                              │
│ Motivo *   [ Usuário pediu ajuda            ▾ ]              │
│ Detalhe *  [ Fulano não consegue ver as inscrições dele  ]   │
│ Referência [ e-mail de 06/09 14:12                       ]   │
│                                                              │
│ A sessão dura 30 minutos e cobre um único usuário.           │
│                                                              │
│              [ Cancelar ]  [ Confirmar identidade e abrir ]  │
└──────────────────────────────────────────────────────────────┘
```

### 4.2 Sessão aberta — busca do usuário

```
┌──────────────────────────────────────────────────────────────┐
│ ⏱ Sessão ativa · 27:41 · "Usuário pediu ajuda"  [Encerrar]  │
├──────────────────────────────────────────────────────────────┤
│ 🔎 [ e-mail, uid, nome ou telefone                        ]  │
│                                                              │
│ A busca por e-mail/telefone exige o valor EXATO. Não há      │
│ listagem da base — busca por prefixo permitiria varredura.   │
└──────────────────────────────────────────────────────────────┘
```

**Decisão de desenho importante**: não existe "listar todos os usuários"
nesta aba. Listagem é o que transforma um acesso comprometido em vazamento
de base inteira. Métricas agregadas continuam na aba "Perfis" (que já
existe e não expõe contato).

### 4.3 Ficha do usuário — tudo mascarado por padrão

```
┌──────────────────────────────────────────────────────────────┐
│ ⏱ 24:03  ·  Fernando S.  ·  uid Kx7C…o7r2         [Encerrar] │
├──────────────────────────────────────────────────────────────┤
│ 👤 IDENTIDADE                                                │
│   Nome de exibição   Fernando S.                             │
│   Nome completo      Fernando S•••••••                [Ver]  │
│   Data de nascimento ••/••/1985  (40 anos)            [Ver]  │
│   Conta criada       12/03/2024 · último login hoje 09:14    │
│   Papel              user      Status: ativo                 │
│                                                              │
│ 📇 CONTATO                                        🔒 sensível │
│   E-mail             f•••••@gmail.com                 [Ver]  │
│   Telefone           (11) ••••-••32                   [Ver]  │
│   Endereço           ••••••••                         [Ver]  │
│   Preferências: telefone privado · e-mail privado ·          │
│                 listado no diretório                         │
│                                                              │
│ 🏓 ATIVIDADE                          (sem dado sensível)    │
│   87 partidas · 12 torneios · nível 4.2 · 2 clubes           │
│   3 reservas · 1 dia de jogo criado                          │
│   [Ver torneios] [Ver reservas] [Ver clubes] [Ver jogos]     │
│                                                              │
│ ⚖️ CONSENTIMENTOS E DOCUMENTOS                                │
│   Termos de Uso            v3 · aceito 12/03/2024            │
│   Política de Privacidade  v2 · aceito 12/03/2024            │
│   Ciência de Riscos        ⚠ NÃO ACEITO                      │
│   Uso de imagem            v1 · aceito 04/01/2026            │
│                                                              │
│ 🔐 SEGURANÇA DA CONTA                                        │
│   Provedores: Google · E-mail verificado: sim                │
│   Sessões ativas: 2   [Encerrar todas as sessões]            │
│   [Enviar link de redefinição de senha]                      │
│                                                              │
│ 🛠 AÇÕES DE CORREÇÃO                          (§5)           │
│ 📜 HISTÓRICO DE ACESSOS A ESTE USUÁRIO        (§7)           │
└──────────────────────────────────────────────────────────────┘
```

Cada `[Ver]`:
1. abre um diálogo — "Revelar o e-mail de Fernando S.? Isto será
   registrado e o titular poderá ver.";
2. chama `supportRevealField(sessionId, uid, field)`;
3. a Function grava o log **e só então** devolve o valor;
4. o valor fica visível por **60 segundos** e volta a mascarar;
5. o contador de revelações da sessão sobe (5 revelações num minuto
   dispara alerta — §8).

**O que nunca aparece, em nenhuma circunstância:**
- senha ou hash (o Firebase Auth não expõe — bom);
- conteúdo de conversa privada (`messages`) — só com autorização registrada
  do titular ou ordem judicial, e por procedimento à parte (§6);
- dado de terceiro que apareça de raspão (ex.: ao abrir uma reserva, o
  nome do outro responsável vem mascarado).

---

## 5. Ações de correção (escrita)

Toda ação: **motivo obrigatório**, confirmação digitando o nome do usuário,
valor anterior guardado, desfazer por 30 dias, notificação ao titular.

| Ação | Para quê | Confirmação | Notifica o titular |
|---|---|---|---|
| Corrigir nome/cidade/nível | erro de digitação que o usuário pediu para arrumar | dupla | ✅ |
| Corrigir e-mail/telefone | mudança que o usuário não conseguiu fazer | dupla + motivo detalhado | ✅ |
| Re-sincronizar perfil público | espelho desatualizado (problema conhecido, já existe ferramenta) | simples | ❌ (técnica) |
| Ocultar/reexibir atleta | conta falsa ou de teste | dupla | ✅ (se reexibir) |
| Enviar redefinição de senha | usuário sem acesso | simples | ✅ (é o próprio e-mail) |
| Encerrar todas as sessões | suspeita de conta comprometida | simples | ✅ |
| Verificar e-mail manualmente | provedor com problema | dupla | ✅ |
| Desvincular inscrição errada | inscrição atribuída à pessoa errada | dupla | ✅ ambos |
| Restaurar item excluído | exclusão acidental | dupla | ✅ |
| Exportar dados do titular | atender requisição LGPD | dupla + registro da requisição | ✅ |
| Anonimizar/excluir conta | pedido de exclusão | **tripla** + espera de 7 dias | ✅ |
| Alterar papel/permissão | promover admin | **tripla** + só o dono da plataforma | ✅ |

**Nunca disponível pelo console**: alterar resultado de partida, rating ou
ranking de forma avulsa (isso passa pelo fluxo do torneio, que tem regra
própria e histórico); apagar `audit_logs`; apagar `admin_access_logs`.

### Desfazer
Cada escrita grava `admin_action_undo/{actionId}` com o documento
**anterior** completo. "Desfazer" restaura e registra a restauração. Sem
isso, um erro do suporte é permanente — e um admin comprometido causa dano
irreversível.

---

## 6. Conversas privadas — procedimento à parte

Chat é a categoria mais sensível da plataforma. O console **não** dá acesso
a `messages`. Quando for necessário (denúncia de assédio, ordem judicial):

1. O acesso exige **duas** justificativas: categoria `investigacao_de_abuso`
   ou `ordem_judicial` **e** um número de referência.
2. Escopo **limitado**: só a conversa indicada, só a janela de tempo
   indicada, nunca a caixa inteira.
3. O titular é notificado **depois**, salvo vedação legal expressa
   (nesse caso a notificação fica pendente e é liberada quando puder).
4. O acesso expira em 24h e precisa ser reaberto.
5. Registro em `admin_access_logs` com marcação especial, revisado
   mensalmente (§ `14-RUNBOOK`).

Isso protege o admin tanto quanto o usuário: com procedimento, o acesso é
defensável; sem, é indefensável.

---

## 7. Registro e transparência

### `admin_access_logs/{id}` — imutável
```js
{
  session_id, admin_uid, admin_email,
  target_uid, target_name_snapshot,
  action: 'search' | 'open_profile' | 'reveal_field' | 'update_field'
        | 'export' | 'impersonate_view' | 'security_action'
        | 'chat_access' | 'delete_account',
  field: 'email',                      // no reveal/update
  old_value_hash: '', new_value_hash: '',  // HASH, nunca o valor
  reason_category, reason_text, ticket_ref,
  result: 'ok' | 'denied' | 'error',
  ip_hash, user_agent, at: <ts>,
}
```

**O log guarda hash, nunca o valor.** Um log de auditoria que contém os
e-mails que o admin visualizou vira, ele mesmo, um repositório de dados
pessoais — e um alvo. O hash prova que mudou e permite verificar, sem
armazenar de novo.

Regras:
```javascript
match /admin_access_logs/{id} {
  // O titular vê os acessos aos PRÓPRIOS dados. Essa é a transparência
  // que transforma o log de formalidade em controle real.
  allow read: if isAuthed() && (
    resource.data.target_uid == request.auth.uid || isPlatformAdmin());
  allow create: if false;         // só Admin SDK (Cloud Function)
  allow update, delete: if false; // imutável, para todos, sempre
}
```

### O que o titular vê (`/perfil` → "Privacidade e acessos")
```
Acessos da equipe de suporte aos seus dados

06/09/2026 14:22 · Suporte visualizou seu e-mail
   Motivo: Você pediu ajuda — "não consigo ver minhas inscrições"
04/09/2026 09:10 · Suporte corrigiu sua cidade
   Motivo: Correção solicitada por você
                                          [Isto não foi você? Avise-nos]
```

O botão "Isto não foi você?" abre um canal direto com o encarregado. É o
sistema de alarme mais barato e mais eficaz que existe: **o titular é o
melhor detector de acesso indevido aos seus próprios dados.**

---

## 8. Detecção de abuso (o admin também é vigiado)

Cloud Function agendada + gatilhos:

| Sinal | Limiar | Ação |
|---|---|---|
| Revelações de campo por sessão | > 10 | alerta por e-mail ao dono |
| Sessões abertas por dia | > 15 | alerta |
| Usuários distintos acessados por dia | > 20 | alerta |
| Exportações por semana | > 3 | alerta |
| Acesso fora do horário habitual | 00h-06h | alerta |
| Acesso de IP/país novo | qualquer | alerta + exige nova reautenticação |
| Acesso a chat | qualquer | alerta imediato |
| Alteração de papel | qualquer | alerta imediato |
| Sessão sem `reason_text` significativo | heurística | bloqueio |

O alerta vai para um canal **fora da plataforma** (e-mail do dono +,
idealmente, um segundo endereço). Alerta que só aparece dentro do sistema
comprometido não serve para nada.

Relatório mensal automático: quantos acessos, a quantos titulares, por
quais motivos, quantas escritas, quantos desfazeres.

---

## 9. Erros a não cometer (armadilhas conhecidas deste tipo de tela)

1. ❌ **Function genérica** `getDocument(collection, id)` com nome de
   coleção como parâmetro livre → é uma porta para ler o banco inteiro.
   Cada Function de suporte lê **coleções fixas, campos fixos**.
2. ❌ **Listar a base** ("todos os usuários") → transforma conta
   comprometida em vazamento total. Só busca exata.
3. ❌ **Log escrito pelo cliente** → o admin controla o cliente. Log é
   escrito pela Function, antes de servir o dado.
4. ❌ **Guardar o valor revelado no log** → o log vira o vazamento.
5. ❌ **Sessão longa ou infinita** → token roubado = acesso permanente.
6. ❌ **Motivo opcional** → sem motivo, o log não distingue trabalho de
   abuso, e não serve como defesa.
7. ❌ **Impersonação com escrita** → ação atribuída ao usuário que não a
   fez. "Ver como" é sempre somente leitura e sempre marcado.
8. ❌ **Dar `allow read` amplo ao admin nas regras** → destrói todos os
   controles acima de uma vez, porque abre o caminho paralelo.
9. ❌ **Exibir dado de terceiro sem mascarar** ao abrir um registro
   relacionado (reserva, inscrição, conversa).
10. ❌ **Confiar no campo `role`** para autorizar a Function → é
    exatamente o P0-01. Usar custom claim.

---

## 10. Dependências

Este console **não deve ser construído antes** de:

| Pré-requisito | Por quê |
|---|---|
| `patches/P0-01` (privesc) | sem isso, qualquer usuário vira admin e o console vira a ferramenta perfeita de vazamento |
| Custom claims (P0-01 etapa 2) | a Function precisa de uma fonte de autorização não forjável |
| MFA na conta admin (P1-08) | a sessão de suporte exige segundo fator |
| App Check (P1-03) | impede chamar as Functions fora do app |
| `admin_access_logs` + regras | o log tem de existir antes do primeiro acesso |

Ordem no plano: **PR S1 → S3 → S5 → S7** (ver `13-PLANO-DE-DESENVOLVIMENTO.md`).

---

## 11. Resumo em uma frase

> O admin passa a ter acesso a **qualquer** dado de **qualquer** usuário,
> a qualquer hora, sem depender de ninguém — e passa a ser **impossível**
> fazer isso sem deixar um rastro que o próprio titular consegue ver.

Isso é mais acesso do que existe hoje (hoje não há ferramenta de suporte
nenhuma — só o Firestore cru) e, ao mesmo tempo, muitíssimo mais seguro.
