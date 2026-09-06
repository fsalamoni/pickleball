# 20.11 — Retenção e eliminação de dados

> LGPD art. 15-16: o tratamento termina quando a finalidade é alcançada ou
> o dado deixa de ser necessário; aí o dado deve ser **eliminado**, salvo
> hipóteses legais. Hoje a plataforma **não elimina nada** (exceto
> notificações) — cresce para sempre.

## 1. Tabela de retenção proposta

| Dado | Prazo | Ao vencer | Justificativa |
|---|---|---|---|
| `users`, `athlete_profiles` | conta ativa | excluído na exclusão de conta | execução de contrato |
| Conta **inativa** (sem login) | 3 anos | avisar aos 30 meses; anonimizar aos 36 | necessidade |
| Inscrições e resultados de torneio | permanente, **anonimizado** ao excluir conta | nome → "Atleta removido" | registro histórico de evento público |
| Ratings e histórico de rating | permanente, anonimizado | idem | apagar recalcularia o rating de terceiros |
| Reservas de arena | 5 anos | anonimizar | obrigação fiscal do parceiro / defesa |
| Vendas e pagamentos (PDV) | 5 anos | anonimizar | idem |
| Mensagens de chat | 2 anos após a última do fio | conteúdo excluído | comunicação privada não precisa de eternidade |
| Posts e comentários de fórum | enquanto o clube existir | anonimizar autor ao excluir conta | contexto coletivo |
| `notifications` | 90 dias | excluído (**já implementado** ✅) | operacional |
| `audit_logs` | **5 anos** | excluído | prova em incidente e defesa |
| `admin_access_logs` | **5 anos** | excluído | prova de acesso do suporte |
| `legal_consents` | 5 anos após revogação/exclusão | excluído | prova do consentimento (art. 8º, §1º) |
| `push_tokens` | 90 dias sem uso | excluído | reduz superfície |
| Fotos de torneio | permanente ou até pedido de remoção | removida | direito de imagem prevalece |
| Uploads pessoais | conta ativa | excluídos | |
| Exports de dados do titular | 24h (signed URL) + 7 dias no bucket | excluído | minimização |
| Backups | 30 dias diários / 12 mensais | rotacionados | recuperação |
| `data_subject_requests` | 5 anos | excluído | prova de atendimento |

## 2. Os três destinos possíveis

**Exclusão** — o documento some. Para dado sem valor após a finalidade.

**Anonimização** — o dado deixa de ser pessoal (art. 12: dado anonimizado
não é dado pessoal). Substituir nome/e-mail/foto por marcador e **quebrar o
vínculo com o uid**. ⚠ Atenção: manter o uid não é anonimizar — é
pseudonimizar, e pseudônimo continua sendo dado pessoal. Anonimizar de
verdade exige remover o identificador, o que às vezes quebra a integridade
referencial. Onde isso acontecer (resultados de torneio), aceitar a
pseudonimização e **dizer que é pseudonimização**, não chamar de anônimo.

**Retenção com minimização** — manter só o campo necessário para a
obrigação legal (ex.: reserva mantém valor e data; apaga telefone e e-mail).

## 3. Conta inativa — a decisão a tomar

Conta sem login há 3 anos ainda serve a alguma finalidade? Provavelmente
não, mas o histórico esportivo dela sim (ela aparece em resultados).

**Proposta**:
```
30 meses sem login → e-mail: "sua conta será desativada em 6 meses"
33 meses           → segundo aviso
36 meses           → perfil sai do diretório, dado de contato apagado,
                     histórico esportivo pseudonimizado, conta bloqueada
48 meses           → conta do Auth excluída
```
Reversível até os 36 meses com um login.

⚠ Cuidado: um e-mail de "vamos apagar sua conta" para uma base inteira é
um evento de comunicação. Fazer em lotes, com texto revisado, e com um
caminho de um clique para manter a conta.

## 4. Implementação

Cloud Functions agendadas, todas em **modo relatório antes de executar**:

| Function | Frequência | O que faz |
|---|---|---|
| `retentionReport` | diária | **só conta e reporta** o que seria afetado — roda sozinha por 30 dias antes de qualquer exclusão |
| `expireStaleNotifications` | ✅ já existe | 90 dias |
| `expirePushTokens` | semanal | tokens sem uso há 90 dias |
| `pruneAuditLogs` | mensal | `audit_logs` e `admin_access_logs` > 5 anos |
| `pruneChatMessages` | mensal | fios sem atividade há 2 anos |
| `notifyInactiveAccounts` | mensal | avisos de 30/33 meses |
| `deactivateInactiveAccounts` | mensal | executa aos 36 meses |
| `cleanupOrphanStorage` | semanal | arquivos sem documento |
| `processAccountDeletions` | diária | filas de exclusão após os 7 dias |

**Regra de ouro**: nenhuma Function de exclusão vai para produção sem (a)
rodar 30 dias em modo relatório, (b) backup funcionando e testado, (c)
limite de itens por execução (para um bug não apagar a base inteira em uma
passada), e (d) log do que apagou.

## 5. Ordem correta

```
1. PITR + export diário funcionando e TESTADO      ← pré-requisito absoluto
2. retentionReport em modo relatório (30 dias)
3. Revisar o relatório: os números fazem sentido?
4. Ligar as Functions uma a uma, da menos arriscada
   (push_tokens) para a mais (contas inativas)
5. Documentar cada prazo na Política de Privacidade
```

**Nunca** ligar exclusão automática antes do passo 1. Exclusão sem backup é
irreversível por definição, e um erro de filtro apaga o que não devia.
