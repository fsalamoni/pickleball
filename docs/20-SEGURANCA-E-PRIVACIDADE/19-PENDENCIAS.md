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
| 2 | Revogar as 3 contas `platform_admin` indevidas | nenhum, a ferramenta existe | **dono** (2 min) |
| 3 | Migração destrutiva do P0-02 (apagar e-mails antigos das inscrições) | item 1 | agente |
| 4 | Migração destrutiva do P1-01 (apagar `user_email` legado) | item 1 | agente |
| 5 | Direitos do titular (exclusão, exportação, canal) — **obrigação legal** | nenhum | agente |
| 6 | App Check | nenhum (2 semanas de observação) | agente + dono |
| 7 | Console de suporte: quebra-vidro, mascaramento, log de LEITURA | exige Cloud Function | agente |
| 8 | P2-01 `directory_listed` no servidor | decisão de arquitetura | dono decide, agente faz |
| 9 | Custom claims, retenção, consentimento de imagem e menores | nenhum | agente |

---

## 1. Backup — o que trava mais coisa (com o dono)

Passo a passo pronto em **`15-RUNBOOK-S0-CONSOLE.md`**, com os comandos
`gcloud`. ~30-40 min, sem tocar em código.

Na última verificação (tela do console enviada pelo dono em 2026-09-09),
**"Backups programados" estava ⊖ nos três bancos** (`(default)`, `gerador3d`,
`pickleball`).

Enquanto isso não existir, **nada que apaga dado será executado** — é a regra
que temos seguido desde o início e não deve ser afrouxada.

## 2. As três contas admin indevidas (com o dono, 2 minutos)

Confirmado pelo dono: só `Kx7CC0NVgogh8cCF4wIRmpOvo7r2` deve ser
`platform_admin`. As outras três são sobra de um ajuste antigo.

**A ferramenta já existe**: Painel admin → Governança → Acessos → *Revogar
poder*. Contexto completo em `16-ACHADO-ADMINS-EXTRAS.md`.

Lembrete que a tela já dá: revogar **não encerra a sessão** de quem já está
logado (o token vale até expirar). Para cortar na hora,
`revokeRefreshTokens(uid)` pelo Admin SDK.

## 3 e 4. As duas migrações destrutivas

Mesmo padrão nas duas: o vazamento **parou de crescer** (nada novo grava), mas
os documentos antigos ainda carregam o campo.

| | P0-02 | P1-01 |
|---|---|---|
| Campo | `player_a_email`, `player_b_email` e `_lc` | `user_email` |
| Coleção | `tournament_registrations` | `club_members`, `tournament_admins` |
| Exposição hoje | **sem login** (quadro público) | qualquer conta logada |
| Já não grava desde | 2026-09-08 | 2026-09-09 |
| Ainda exibido? | não | não |

**Passos, quando houver backup** (mesma receita para os dois):
1. Script Admin SDK em **DRY-RUN** → relatório de quantos documentos e campos.
2. Execução em lotes de 400, com log, em janela de baixo tráfego.
3. Só depois, remover o *fallback* de leitura do código.

⚠ **Nunca fazer 2 e 3 no mesmo deploy.**

## 5. Direitos do titular — é obrigação legal, não melhoria

**Nada implementado.** Hoje, se alguém pedir exclusão da conta, não há caminho
no produto. Achados P2-04, P2-05 e P2-06; especificação em
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

1. **Backup** (dono) — destrava 3 e 4
2. **Revogar as 3 contas** (dono, 2 min)
3. **Direitos do titular** — é lei
4. **App Check** — em modo monitor primeiro
5. As duas migrações destrutivas
6. A metade de leitura do console de suporte

## O que NÃO pode ser esquecido ao retomar

- Regras do Firebase são **OR**: um bloco restritivo ao lado de um permissivo
  não restringe nada. Já mordeu duas vezes (Storage e auto-rebaixamento).
- Teste que não sabe falhar não prova nada — verifique neutralizando a regra.
- Toda correção de privacidade precisa provar o que **NÃO** mudou: metade das
  asserções deve ser dedicada ao fluxo legítimo que segue funcionando.
- Nada que apaga dado roda sem backup testado.
