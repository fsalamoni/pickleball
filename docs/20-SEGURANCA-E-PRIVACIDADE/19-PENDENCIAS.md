# 20.19 — Pendências de segurança: onde paramos e como retomar

> **Documento de retomada.** Consolida tudo o que ficou em aberto quando o foco
> mudou para o desenvolvimento do dia de jogo (2026-09-10). Cada item diz o que
> falta, por que parou, e qual é o próximo passo concreto.
>
> Não substitui `01-AUDITORIA-ACHADOS.md` (o quê) nem
> `13-PLANO-DE-DESENVOLVIMENTO.md` (a ordem). É o marcador de página entre os
> dois.

---

## Quadro rápido

| # | Pendência | Bloqueio | Quem resolve |
|---|---|---|---|
| 1 | Backup agendado + PITR + teste de restauração | — | **dono** (console) |
| 2 | Migração destrutiva do P0-02 (apagar e-mails antigos das inscrições) | item 1 | agente |
| 3 | Migração destrutiva do P1-01 (apagar `user_email` legado) | item 1 | agente |
| 4 | Direitos do titular (exclusão, exportação, canal) — **obrigação legal** | nenhum | agente |
| 5 | App Check | nenhum (2 semanas de observação) | agente + dono |
| 6 | Console de suporte: quebra-vidro, mascaramento, log de LEITURA | exige Cloud Function | agente |
| 7 | P2-01 `directory_listed` no servidor | decisão de arquitetura | dono decide, agente faz |
| 8 | Custom claims, retenção, consentimento de imagem e menores | nenhum | agente |

---

## 1. Backup — o que trava mais coisa (com o dono)

Passo a passo pronto em **`15-RUNBOOK-S0-CONSOLE.md`**, com os comandos
`gcloud`. ~30-40 min, sem tocar em código.

Em 2026-09-29, o dono confirmou que o **restore no Console foi testado e está
funcionando**. Isso destrava a próxima etapa de privacidade, desde que ela
continue em passos pequenos, com relatório/dry-run e confirmação forte.

Regra que continua valendo: qualquer deleção precisa rodar primeiro em dry-run,
e a escrita precisa ficar em etapa separada e reversível por restore.

## 2. Contas admin extras — resolvido na última revalidação

Confirmado pelo dono: só `Kx7CC0NVgogh8cCF4wIRmpOvo7r2` deve ser
`platform_admin`. Na revalidação de 2026-09-28, a consulta atual devolveu
apenas esse uid; portanto, esta pendência não bloqueia mais o plano.

**Se voltar a acontecer**, a ferramenta já existe: Painel admin → Governança →
Acessos → *Revogar poder*. Contexto completo em
`16-ACHADO-ADMINS-EXTRAS.md`.

Lembrete que a tela já dá: revogar **não encerra a sessão** de quem já está
logado (o token vale até expirar). Para cortar na hora,
`revokeRefreshTokens(uid)` pelo Admin SDK.

## 3. As duas migrações destrutivas

Mesmo padrão nas duas: o vazamento **parou de crescer** (nada novo grava), mas
os documentos antigos ainda carregam o campo.

| | P0-02 | P1-01 |
|---|---|---|
| Campo | `player_a_email`, `player_b_email` e `_lc` | `user_email` |
| Coleção | `tournament_registrations` | `club_members`, `tournament_admins` |
| Exposição hoje | **sem login** (quadro público) | qualquer conta logada |
| Já não grava desde | 2026-09-08 | 2026-09-09 |
| Ainda exibido? | não | não |

**Passos agora disponíveis**:
1. `npm run privacy:legacy-email-cleanup -- report` — relatório, sem escrita.
2. `backfill-registration-contacts` — copia e-mails legados para
   `private/contact` e cria `provisional_claims` faltantes. Por padrão é
   dry-run; para escrever exige `APPLY=1 CONFIRM=CRIAR_CONTATOS_PRIVADOS`.
3. Observar o código em produção com fallback ativo. Se não houver falha de
   contato/claim, só então seguir.
4. `delete-registration-public-emails` — apaga os quatro campos públicos de
   `tournament_registrations`, mas só dos documentos que já têm contato privado
   e claims necessários. Exige
   `APPLY=1 CONFIRM=APAGAR_EMAILS_PUBLICOS_LEGADOS`.
5. `delete-wide-user-emails` — apaga `user_email` legado de `club_members` e
   `tournament_admins`. Exige `APPLY=1 CONFIRM=APAGAR_USER_EMAIL_LEGADO`.
6. Só depois, em outro PR/deploy, remover o *fallback* de leitura do código.

O mesmo está disponível em GitHub Actions → **Limpeza de e-mails legados**.

⚠ **Nunca fazer backfill, deleção e remoção de fallback no mesmo deploy.**

## 5. Direitos do titular — é obrigação legal, não melhoria

**🟡 Primeiro passo feito (2026-09-24): o ADMIN exclui cadastro.**
*Painel admin → Comunidade → Cadastros → Excluir* (função de servidor
`adminDeleteAccounts`), seguindo a tabela de `09-DIREITOS-DO-TITULAR.md` §4:
identidade e conta de login apagadas, histórico esportivo pseudonimizado,
reservas e pagamentos retidos sem o nome, auditoria retida. Ver
`18-CADASTROS-ADMIN.md` §Excluir. Isso atende o pedido que chega pelo canal
do encarregado — o admin executa — mas **não** é o autoatendimento do
titular: a tela "Excluir minha conta", o prazo de arrependimento de 7 dias e
a reautenticação continuam por fazer, assim como exportação e canal formal.
Achados P2-04 (parcial), P2-05 e P2-06; especificação em
`09-DIREITOS-DO-TITULAR.md`.

Mínimo para sair do zero:
- **Exclusão de conta** — com anonimização do histórico competitivo (apagar a
  conta não pode apagar o resultado de um torneio de terceiros);
- **Exportação** dos dados do titular (portabilidade);
- **Canal formal** de requisição, com prazo e registro.

**É a pendência de maior risco jurídico da lista.** Recomendo que seja a
primeira coisa a fazer quando o dia de jogo estiver entregue.

## 6. App Check

Sem ele, as regras do Firestore são a **única** defesa contra um script
rodando fora do aplicativo. Achado P1-03.

Cuidado: ligar em modo *enforce* de uma vez pode derrubar clientes legítimos.
O caminho é registrar → observar 2 semanas em modo *monitor* → só então
*enforce*.

## 7. Console de suporte — a metade que falta

A **escrita** está no ar (aba Cadastros, `18-CADASTROS-ADMIN.md`). Falta a
metade de **leitura**, especificada em `05-ADMIN-SUPORTE.md`:

- sessão de quebra-vidro (motivo, prazo, encerramento);
- mascaramento por padrão + registro de cada REVELAÇÃO de campo;
- detecção de abuso;
- **leitura via Cloud Function**.

> **Por que a Cloud Function é obrigatória aqui**: o admin lê `users`
> diretamente, como sempre pôde. Enquanto essa leitura direta existir,
> qualquer registro feito no navegador é contornável — o log só é confiável
> se a leitura passar por um lugar que o cliente não controla.

## 8. P2-01 — precisa de uma decisão, não de código

`directory_listed` não vale no servidor: quem saiu do diretório continua
legível por consulta direta.

**A correção óbvia derruba o ranking** — a análise completa está no achado
(`01-AUDITORIA-ACHADOS.md` § P2-01). Resumo: quatro serviços leem
`athlete_profiles` inteira sem filtro, e numa consulta a regra é avaliada por
documento.

Os dois caminhos possíveis, ambos arquiteturais:
- **(a)** o espelho deixa de existir para quem optou por sair, e o ranking
  passa a ler de `users`;
- **(b)** o ranking ganha uma coleção própria com só o que precisa.

**Decisão do dono.** Nada será feito antes disso.

## 9. O resto do plano

`13-PLANO-DE-DESENVOLVIMENTO.md`: custom claims (S5), retenção e ciclo de vida
(S11 — **alto risco, exclui dados**), consentimento/imagem/menores (S10),
governança contínua (S12).

---

## Ordem recomendada de retomada

1. **Backup** (dono) — destrava as migrações destrutivas
2. **Direitos do titular** — é lei
3. **App Check** — em modo monitor primeiro
4. As duas migrações destrutivas
5. A metade de leitura do console de suporte

## O que NÃO pode ser esquecido ao retomar

- Regras do Firebase são **OR**: um bloco restritivo ao lado de um permissivo
  não restringe nada. Já mordeu duas vezes (Storage e auto-rebaixamento).
- Teste que não sabe falhar não prova nada — verifique neutralizando a regra.
- Toda correção de privacidade precisa provar o que **NÃO** mudou: metade das
  asserções deve ser dedicada ao fluxo legítimo que segue funcionando.
- Nada que apaga dado roda sem backup testado.
