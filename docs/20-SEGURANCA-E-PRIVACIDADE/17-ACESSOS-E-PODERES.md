# 20.17 — Acessos e poderes: a ferramenta e a avaliação das anteriores

> **Painel admin → Governança → Acessos** · `src/v2/components/admin/AdminAccessTab.jsx`
> Domínio puro em `src/modules/admin/domain/accessRoster.js`

## Por que esta tela existe

Havia **quatro** contas com `role: 'platform_admin'` em produção e **nenhum
lugar dentro do produto onde isso aparecesse**. Descobrir exigiu consultar o
banco à mão. Uma falha que só é visível pelo console não é monitorada — é
descoberta por acaso.

E havia um segundo engano, mais sutil: as três contas indevidas estavam
`hidden: true`. Ocultar é **moderação de exibição** — tira o atleta das
listagens e **não mexe no `role`**. Elas continuavam com acesso total.

## O que a tela mostra

| Bloco | O quê |
|---|---|
| **Alertas** | Contas com poder sem e-mail de dono · contas OCULTAS ainda com poder · admin sem e-mail no documento · nenhum admin |
| **Administradores** | Todos, com uid, e-mail, último acesso, se está oculto, e por que é (ou não é) esperado. Os problemáticos vêm primeiro |
| **Podem criar pools** | Poder menor, mas ainda é poder |
| **Se você perder o acesso** | As duas ferramentas de emergência, onde se procura por elas |
| **O que só se faz no console** | Promover, encerrar sessão, apagar conta — e o motivo de cada uma ficar de fora |

## A assimetria: revoga, nunca concede

A regra do Firestore ganhou um caminho novo — e ele é **deliberadamente
assimétrico**:

```javascript
|| (isPlatformOwnerEmail()
    && request.auth.uid != userId
    && request.resource.data.role == 'user'              // ← só chega em 'user'
    && request.resource.data.get('can_create_pools', false) == false
    && affectedKeys.hasOnly([...]))
```

O dono da plataforma pode **remover** poder de outra conta pela aplicação.
**Não existe caminho, em regra nenhuma, para promover alguém pelo cliente** —
foi exatamente isso que a correção do P0-01 fechou, e continua fechado.

**Por que abrir a revogação**: sem ela, tirar poder de uma conta indevida só
acontecia no console do Firebase, onde a ação **não gera `audit_logs`**. Pela
aplicação, gera. E como a permissão só reduz privilégio, uma conta de dono
comprometida não ganha nada que já não pudesse fazer.

### Uma armadilha do Firebase, de novo

A regra nova traz `request.auth.uid != userId`, e **isso não impede o dono de
se auto-rebaixar** — porque o branch anterior (`isOwner(userId) &&
isPlatformOwnerEmail()`) já o libera a escrever o próprio documento, e regras
do Firebase são **OR**: um bloco restritivo ao lado de um permissivo não
restringe nada. É a mesma semântica que tornou decorativa a primeira regra de
Storage.

Esse branch é a **escotilha de emergência** e tem de continuar existindo — foi
por ela que o dono recuperou o acesso quando o perdeu. Portanto:

> **Impedir o clique errado na própria linha é responsabilidade da INTERFACE.**
> `canRevokeAccount` não oferece o botão para si mesmo, e há teste de runtime
> provando. O teste de regra correspondente (`users.rules.test.js` §40)
> documenta explicitamente que a regra permite — em vez de fingir que não.

### As três negativas do botão

| Situação | Por quê |
|---|---|
| Não é o dono | A regra exige o e-mail do token; oferecer seria prometer o que não acontece |
| É a sua conta | Tiro no pé (a regra permitiria — ver acima) |
| E-mail de dono | `FirebaseAuthContext` re-promove a cada login; revogar não colaria |

## Avaliação das ferramentas que já existiam

O pedido incluía decidir o que manter. Resultado:

| Ferramenta | Veredito | Motivo |
|---|---|---|
| **`/admin/owner-restore`** | ✅ **manter** | Escotilha de emergência real, já usada. É a razão de o branch permissivo existir. **Passou a ser linkada da aba Acessos** — antes só era achável pela aba "Avançado" ou digitando a URL |
| **`/admin/owner-debug`** | ✅ **manter** | Diagnóstico de "por que não consigo ver X". Também linkada da aba Acessos |
| **Moderação de atletas (`hidden`)** | ✅ **manter, com aviso** | A função é legítima (esconder conta de teste). O que estava errado era o texto sugerir que resolvia mais do que resolve. A tela agora diz, em destaque, que **ocultar não remove poder** e aponta para a aba Acessos |
| **Aba Auditoria** | ✅ manter | É onde se investiga o histórico de uma conta suspeita antes de revogar |
| **Páginas legadas** (métricas/torneios/parceiros) | ➖ sem mudança | Duplicam abas do console, mas não têm relação com segurança. Fora do escopo deste trabalho |

### O que deliberadamente NÃO foi construído

- **Promover pela interface.** Seria reabrir, por conveniência, a porta do
  P0-01. Fica no console.
- **Encerrar a sessão de quem foi revogado.** Exige Admin SDK
  (`revokeRefreshTokens`), que não roda no navegador. A tela **diz isso** em
  vez de fingir que o corte é imediato.
- **Cruzar `athlete_profiles` com `users`** na lista de perfis, para marcar
  cada linha que tem poder. Custaria uma segunda leitura da coleção inteira
  numa tela que já lê outra. O aviso em texto + a aba dedicada cobrem o caso.

## O que a revogação faz — e o que não faz

**Faz**: `role → 'user'`, `can_create_pools → false`, guarda `role_previous`,
`role_revoked_at`, `role_revoked_by`, e grava `platform_access_revoked` na
auditoria. Exige confirmação digitada e aceita um motivo.

**Não faz**:
- não apaga o documento (o histórico é evidência);
- não apaga a conta do Firebase Authentication;
- **não encerra a sessão já aberta** — um token vale até expirar. A tela avisa.

## Cobertura

- 22 testes de domínio (`accessRoster.test.js`), incluindo o cenário real
- 9 testes de runtime (`AdminAccessTab.runtime.test.jsx`)
- 7 asserções no emulador (`users.rules.test.js` §35-41), entre elas a prova de
  que a revogação **não serve para promover** nem para o dono
