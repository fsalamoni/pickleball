# 20 — SEGURANÇA, PRIVACIDADE E CONFORMIDADE

> **Status: 📋 ESTUDO CONCLUÍDO · CORREÇÕES NÃO APLICADAS.**
> Este diretório é o levantamento completo do estado atual da plataforma em
> segurança de dados, LGPD, documentos legais, autorizações e direito de
> imagem — com o plano de correção priorizado por risco.
>
> **Nenhuma regra, código ou configuração foi alterada por este estudo.**
> As correções estão especificadas em `patches/`, prontas para aplicar,
> mas exigem decisão e validação antes do deploy.

---

## ⚠️ LEIA ISTO PRIMEIRO — achados críticos abertos

A auditoria encontrou **2 vulnerabilidades CRÍTICAS** ativas em produção
hoje. Elas estão detalhadas em `01-AUDITORIA-ACHADOS.md` e com correção
pronta em `patches/`.

| # | Achado | Impacto |
|---|---|---|
| ~~**P0-01**~~ ✅ | ~~Qualquer usuário autenticado pode se tornar `platform_admin` escrevendo no próprio documento `users/{uid}`~~ | **CORRIGIDO em 2026-09-07** (PR S1). 34 asserções no emulador, rodando no CI. |
| **P0-02** | `tournament_registrations` é `allow read: if true` e guarda `player_a_email`, `player_b_email` e `competition_gender` | E-mail e gênero de **todos os inscritos em torneios** legíveis por qualquer pessoa na internet, **sem login** |

Ambos são corrigíveis com alteração **aditiva e pequena** no
`firestore.rules`. Ver `patches/P0-01-*.md` e `patches/P0-02-*.md`.

---

## Por que este assunto vem antes do Mercado e do Feed

O Mercado (`docs/FUTURO/MERCADO/`) e o Feed (`docs/FUTURO/FEED/`)
**multiplicam** a superfície de dado pessoal: endereço de entrega, chave
Pix, comprovante de pagamento, foto e vídeo de pessoas, geolocalização em
EXIF, conteúdo de menores. Abrir qualquer uma das duas com os achados P0/P1
em aberto seria construir sobre alicerce rachado.

**Regra**: nenhuma das funcionalidades de `docs/FUTURO/` vai a público antes
de os itens P0 e P1 deste estudo estarem fechados.

---

## Mapa dos documentos

| Doc | Conteúdo | Leia se você vai... |
|---|---|---|
| `01-AUDITORIA-ACHADOS.md` | ⭐ **31 achados** com severidade, evidência no código, impacto e correção | entender o que está errado |
| `02-INVENTARIO-DE-DADOS.md` | Mapa de dados pessoais: o que a plataforma coleta, onde guarda, quem lê, base legal, retenção (ROPA) | responder à ANPD ou desenhar qualquer coisa nova |
| `03-MODELO-DE-AMEACAS.md` | STRIDE aplicado: quem ataca, o quê, como, e o que defende | avaliar risco de uma mudança |
| `04-CONTROLE-DE-ACESSO.md` | Papéis, matriz de permissão, custom claims, princípio do menor privilégio | mexer em autorização |
| `05-ADMIN-SUPORTE.md` | ⭐ **A aba de suporte do admin**: acesso total com segurança extrema, quebra-vidro, mascaramento, auditoria | construir o console de suporte |
| `06-LGPD-CONFORMIDADE.md` | Bases legais, princípios, encarregado, ANPD, transferência internacional, avaliação de impacto | conformidade |
| `07-DOCUMENTOS-LEGAIS.md` | Os **11 documentos versionados** que já existem, o que falta no conteúdo deles, e os 6 a criar | escrever ou revisar documento legal |
| `08-CONSENTIMENTO-E-IMAGEM.md` | Consentimento granular, direito de imagem, foto/vídeo, menores de idade | tratar imagem ou consentimento |
| `09-DIREITOS-DO-TITULAR.md` | Portal do titular: acesso, correção, portabilidade, exclusão, oposição, revogação | implementar os direitos LGPD |
| `10-SEGURANCA-TECNICA.md` | App Check, cabeçalhos HTTP, Storage, MFA, dependências, segredos, backup | endurecer a infraestrutura |
| `11-RETENCAO-E-EXCLUSAO.md` | Ciclo de vida do dado, anonimização, exclusão de conta, backups | definir retenção |
| `12-INCIDENTES.md` | Plano de resposta a incidente, notificação à ANPD e aos titulares, comunicação | responder a um vazamento |
| `13-PLANO-DE-DESENVOLVIMENTO.md` | ⭐ O plano em 12 PRs, priorizado por risco, com critérios de aceite | planejar a execução |
| `14-RUNBOOK-E-GOVERNANCA.md` | Operação contínua: checklists, revisões periódicas, o que fazer todo mês | manter no ar |
| `patches/` | ⭐ Correções **prontas para aplicar**, uma por achado crítico/alto | corrigir agora |
| `15-RUNBOOK-S0-CONSOLE.md` | ⭐ **Para o dono executar** — PITR, backup, teste de restauração, alertas, MFA. Console do Firebase, ~30 min. **Desbloqueia o P0-02.** | proteger a base agora |

## Princípios que guiaram este estudo

1. **Não estragar nada.** Toda correção proposta é aditiva ou restritiva de
   forma compatível com o fluxo atual. Cada patch declara explicitamente o
   que pode quebrar e como validar antes do deploy.
2. **Menor privilégio.** Ninguém deve poder ler o que não precisa — nem o
   admin, sem registro.
3. **O admin tem acesso total, mas nunca invisível.** Todo acesso a dado
   pessoal alheio é justificado, limitado no tempo e registrado.
4. **Privacidade aplicada no servidor.** Preferência de privacidade que só
   o cliente respeita não é privacidade — é sugestão.
5. **Minimização.** Não guardar o que não se usa; não expor o que não
   precisa ser exposto.
6. **Honestidade no que não protege.** Onde a defesa é fraca, o documento
   diz que é fraca, em vez de fingir cobertura.
