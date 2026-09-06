# 20.09 — Direitos do titular (portal do usuário)

> Hoje a Política de Privacidade **promete** acesso, correção,
> portabilidade e exclusão (`legalDocuments.js:159`, `V2Privacy.jsx:58`) e
> **nada disso existe**. Prometer direito que não se entrega é, por si,
> descumprimento — e é o achado P2-04.

## 1. Os direitos (art. 18) e como atender cada um

| # | Direito | Como atender | Onde | Prazo |
|---|---|---|---|---|
| I | Confirmação de tratamento | tela "Meus dados" mostra que existe tratamento e quais categorias | `/perfil/privacidade` | imediato |
| II | Acesso aos dados | mesma tela + **exportação completa** | idem | imediato / 15d |
| III | Correção | edição do perfil (já existe) + solicitação para o que não é editável | `/perfil/editar` + formulário | imediato / 15d |
| IV | Anonimização, bloqueio ou eliminação de dado desnecessário | fluxo de exclusão seletiva | formulário | 15d |
| V | **Portabilidade** | export em JSON + CSV, formato interoperável | botão | 15d |
| VI | Eliminação dos dados tratados com consentimento | revogação + exclusão | toggles + exclusão de conta | imediato / 15d |
| VII | Informação sobre compartilhamento | lista de com quem os dados foram compartilhados | tela | imediato |
| VIII | Informação sobre não consentir | texto explicando a consequência de cada toggle | junto do toggle | imediato |
| IX | Revogação do consentimento | toggles com efeito imediato | `/configuracoes` | imediato |
| — | Revisão de decisão automatizada (art. 20) | explicar o ranking; oferecer a aba cronológica | quando o Feed existir | — |

**Prazo legal: 15 dias** (art. 19, II) para os que não são imediatos.
Sem processo, o prazo é descumprido por omissão — não por má-fé.

## 2. A tela: `/perfil/privacidade`

```
┌──────────────────────────────────────────────────────────────┐
│ Privacidade e meus dados                                     │
├──────────────────────────────────────────────────────────────┤
│ 📦 SEUS DADOS                                                │
│   O que guardamos sobre você, por categoria:                 │
│   • Identificação e contato                                  │
│   • Atividade esportiva (87 partidas, 12 torneios)           │
│   • Reservas e pagamentos (3 reservas)                       │
│   • Comunicação (2 conversas, 14 mensagens)                  │
│   • Consentimentos e documentos aceitos                      │
│                                                              │
│   [ Baixar todos os meus dados ]   JSON + CSV, chega por     │
│                                     e-mail em até 24h        │
├──────────────────────────────────────────────────────────────┤
│ 🔓 O QUE É PÚBLICO                                           │
│   ✅ Nome, cidade, nível, clubes  — visível no diretório      │
│   ❌ Telefone                      [tornar público]           │
│   ❌ E-mail                        [tornar público]           │
│   ❌ Endereço                      [tornar público]           │
│   ✅ Aparecer no diretório de atletas        [sair]           │
│   ✅ Meus resultados no ranking    — histórico esportivo      │
├──────────────────────────────────────────────────────────────┤
│ ✋ CONSENTIMENTOS                                             │
│   ❌ Comunicações de marketing              [ativar]          │
│   ❌ Uso da minha imagem em divulgação      [ativar]          │
│   ✅ Notificações push                      [desativar]       │
│   ❌ Exportar meus jogos para o DUPR        [ativar]          │
│   Cada um pode ser desativado a qualquer momento.            │
├──────────────────────────────────────────────────────────────┤
│ 🤝 COM QUEM COMPARTILHAMOS                                   │
│   • Google/Firebase — infraestrutura (operador)              │
│   • Arena Pickle SP — suas reservas                          │
│   • Prof. Ana — suas aulas                                   │
│   • Clube Vila — sua participação                            │
├──────────────────────────────────────────────────────────────┤
│ 👁 ACESSOS DA EQUIPE DE SUPORTE            (05-ADMIN-SUPORTE)│
│   06/09 14:22 · visualizou seu e-mail                        │
│      "Você pediu ajuda — não consigo ver minhas inscrições"  │
│                              [Isto não foi você? Avise-nos]  │
├──────────────────────────────────────────────────────────────┤
│ 📮 PEDIDOS                                                   │
│   [ Corrigir um dado ]  [ Excluir dados específicos ]        │
│   Encarregado: privacidade@picklerush.com.br · resposta em   │
│   até 15 dias                                                │
├──────────────────────────────────────────────────────────────┤
│ ⚠️ EXCLUIR MINHA CONTA                                        │
│   [ Excluir minha conta ]                                    │
└──────────────────────────────────────────────────────────────┘
```

## 3. Exportação (portabilidade)

Cloud Function `exportMyData` (`onCall`, só o próprio titular):
1. Reúne, do uid: `users`, `athlete_profiles`, inscrições, partidas,
   reservas, aulas, clubes, conquistas, ratings, consentimentos,
   notificações, mensagens (só as que ele enviou/recebeu), favoritos.
2. Gera JSON estruturado + CSVs por categoria.
3. Sobe para `uploads/{uid}/private/export-{timestamp}.zip` (caminho
   privado — `patches/P1-05`).
4. Manda **signed URL de 24h** por e-mail. Nunca link permanente.
5. Registra em `audit_logs`.
6. Limite: 1 exportação por 24h (evita usar a Function como DoS).

⚠ **Cuidado**: a exportação inclui conversas, que contêm mensagens de
**outras pessoas**. Exportar só as mensagens do próprio titular e, nas
recebidas, o conteúdo (ele já o viu) sem o dado de contato do remetente.

## 4. Exclusão de conta — o desenho mais delicado

Nem tudo pode ser apagado, e isso é legítimo (art. 16): dado necessário
para cumprimento de obrigação legal, estudo, exercício de direito, ou uso
exclusivo do controlador (anonimizado).

### O que acontece com cada categoria

| Dado | Ação | Por quê |
|---|---|---|
| `users`, `athlete_profiles` | **excluído** | dado de identificação |
| Foto de perfil e uploads pessoais | **excluídos** do Storage | |
| Conta do Firebase Auth | **excluída** | |
| `push_tokens`, `notifications`, favoritos, buscas | **excluídos** | |
| Mensagens de chat | conteúdo **excluído**, autor vira "Usuário removido" | apagar unilateralmente destruiria a conversa da outra pessoa |
| Posts em fórum de clube | conteúdo mantido, autor **anonimizado** | idem |
| **Inscrições e resultados de torneio** | nome substituído por "Atleta removido", uid mantido | histórico esportivo é registro legítimo de um evento público; apagar reescreveria o resultado de um torneio de outras pessoas |
| Ratings e ranking | **anonimizados**, não apagados | idem — apagar recalcularia o rating de todos os adversários |
| Reservas e pagamentos | **retidos 5 anos**, com dado pessoal minimizado | obrigação fiscal do parceiro / exercício de direito |
| `audit_logs`, `admin_access_logs` | **retidos**, sem anonimizar | prova; é o único registro de que a exclusão foi feita corretamente |
| `legal_consents` | **retidos 5 anos** | prova do consentimento e da revogação |

**Isso precisa estar escrito na Política de Privacidade e ser mostrado na
tela de confirmação, antes de excluir.** Surpreender o usuário depois é
pior do que explicar antes.

### Fluxo
```
[Excluir minha conta]
  → tela explicando exatamente o que some, o que é anonimizado
    e o que fica (a tabela acima, em linguagem simples)
  → reautenticação (senha ou provedor)
  → digitar EXCLUIR para confirmar
  → conta entra em 'pending_deletion', sai do diretório
    imediatamente, login bloqueado
  → PERÍODO DE ARREPENDIMENTO: 7 dias, com e-mail
    "sua conta será excluída em 7 dias — [cancelar]"
  → Cloud Function agendada executa a exclusão
  → e-mail final de confirmação
  → registro do que foi feito (sem dado pessoal)
```

O período de 7 dias protege contra exclusão por impulso, por engano e por
conta comprometida (o atacante que exclui a conta dá 7 dias para o dono
perceber).

### Exclusão de gestor de arena / professor / organizador
Se o titular for o **único** gestor de uma arena com reservas ativas, ou
organizador de um torneio em andamento, a exclusão **não pode ser
imediata** — quebraria o serviço de terceiros. Fluxo: avisar, exigir
transferência da gestão, e só então excluir. Isso precisa estar previsto,
senão vira um incidente operacional.

## 5. Canal do encarregado

- E-mail dedicado (`privacidade@`), publicado na Política e na tela.
- Formulário na plataforma que cria `data_subject_requests/{id}`:
  ```js
  { user_id, type:'access'|'correction'|'deletion'|'portability'
          |'objection'|'info_sharing'|'revoke',
    description, status:'open'|'in_progress'|'fulfilled'|'refused',
    refusal_reason, due_at,        // created_at + 15 dias
    handled_by, handled_at, created_at }
  ```
- Aba no painel admin com a fila, prazo e alerta de vencimento.
- Recusa é permitida em hipóteses legais, mas **exige justificativa
  registrada** e comunicada ao titular (art. 18, §4º).

## 6. Ordem de implementação

```
1. Tela /perfil/privacidade (leitura: o que é público, consentimentos,
   compartilhamento)                                    ~1 PR
2. Canal do encarregado + data_subject_requests + fila  ~1 PR
3. Exportação (Function + e-mail + signed URL)          ~1 PR
4. Exclusão de conta (fluxo completo + 7 dias + Function)~1-2 PRs
5. Histórico de acessos do suporte (depende de 05)      junto do console
```

Os itens 1 e 2 já colocam a plataforma em conformidade **operacional**
(há canal e há resposta). Os itens 3 e 4 automatizam. Fazer 1 e 2 primeiro
é o que reduz risco mais rápido.
