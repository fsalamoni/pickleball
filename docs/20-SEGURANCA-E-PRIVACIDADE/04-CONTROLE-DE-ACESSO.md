# 20.04 — Controle de acesso e papéis

## 1. Estado atual

### Papéis existentes
| Papel | Onde é definido | Como é verificado | Problema |
|---|---|---|---|
| `platform_admin` | `users/{uid}.role` | `isPlatformAdmin()` lê o doc | **forjável — P0-01** |
| dono da plataforma | e-mail fixo no código | `isPlatformOwnerEmail()` lê `request.auth.token.email` | ✅ não forjável, mas fixo (P2-12) |
| admin de torneio | `tournament_admins/{tid}_{uid}` | `isTournamentAdmin(tid)` | ✅ |
| criador de torneio | `tournaments.creator_uid` | `isTournamentCreator(tid)` | ✅ |
| gestor de arena | `arena_managers/{arenaId}_{uid}` | `isArenaManager(arenaId)` | ✅ |
| admin de clube | `club_members/{clubId}_{uid}.role` | `isClubAdmin(clubId)` | ✅ |
| membro de clube | `club_members/{clubId}_{uid}` | `isClubMember(clubId)` | ✅ |
| admin de dia de jogo | `game_days.created_by` + `admin_uids` | `isGameDayAdminOf(gdId)` | ✅ |
| professor | `coaches/{uid}` | leitura direta | ✅ |

**O padrão de papéis por recurso é bom** — documento determinístico
`{recurso}_{uid}`, verificado com `exists()`. Barato e correto. O problema
é exclusivamente o papel **global**, que depende de campo auto-gravável.

### O que falta
- Autorização por **custom claim** (não forjável, sem custo de leitura).
- Papéis intermediários: hoje é "usuário comum" ou "deus".
- Revogação imediata (hoje depende de reescrever um documento).
- Registro de quem concedeu qual papel e quando.

## 2. Desenho proposto

### 2.1 Custom claims para papéis globais

```js
// definido só por Cloud Function, nunca pelo cliente
{
  platform_admin: true,       // acesso administrativo
  support_agent: true,        // console de suporte (§3)
  moderator: true,            // fila de moderação (futuro, docs/FUTURO)
  dpo: true,                  // encarregado: requisições do titular
}
```

Regras passam a ler o token:
```javascript
function hasClaim(c) { return isAuthed() && request.auth.token.get(c, false) == true; }
function isPlatformAdmin() { return hasClaim('platform_admin'); }
```

Ganhos: não forjável · **−1 leitura de documento por avaliação de regra**
(hoje `isPlatformAdmin()` faz `exists()` + `get()` — em telas com muitas
regras isso pesa) · revogação por refresh de token · pronto para granularidade.

Custo: o claim entra no token e o token demora até 1h para atualizar,
salvo `getIdToken(true)`. Conceder papel deve forçar refresh.

### 2.2 Papéis granulares (o que separar)

Hoje `platform_admin` faz **tudo**. Separar reduz o estrago de um
comprometimento e prepara para uma equipe:

| Papel | Pode | **Não** pode |
|---|---|---|
| `support_agent` | console de suporte: ver e corrigir dado de usuário, com sessão e log | mudar flags, alterar papéis, ver conversa privada, excluir conta |
| `moderator` | fila de moderação, ocultar/remover conteúdo, strikes | ver dado de contato, alterar dado de usuário |
| `dpo` | atender requisição do titular, exportar, aprovar exclusão | mudar configuração da plataforma |
| `platform_admin` | configuração, flags, branding, ferramentas técnicas | — |
| `owner` | tudo, inclusive **conceder e revogar papéis** | — |

**Regra de ouro**: `owner` é o único que concede papel. E a concessão é
sempre registrada em `audit_logs` **e** `admin_access_logs`.

Hoje, com um único operador, todos os papéis ficam com a mesma pessoa —
mas **separados**, para que a sessão de suporte não carregue o poder de
mudar flags, e para que a estrutura já exista quando houver um segundo
moderador.

### 2.3 Matriz de acesso a dado pessoal

| Dado | Titular | Relacionado | `support_agent` | `moderator` | `platform_admin` | `owner` |
|---|---|---|---|---|---|---|
| Perfil público | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| E-mail / telefone | ✅ | ❌ | 🔓 com sessão + log | ❌ | 🔓 com sessão + log | 🔓 |
| Endereço | ✅ | parcial (reserva) | 🔓 com sessão + log | ❌ | 🔓 | 🔓 |
| Data de nascimento | ✅ | ❌ (só `age`) | 🔓 com sessão + log | ❌ | 🔓 | 🔓 |
| Conversa privada | ✅ | membros | ⛔ procedimento à parte | ⛔ | ⛔ procedimento | ⛔ procedimento |
| Consentimentos | ✅ | ❌ | ✅ leitura | ❌ | ✅ | ✅ |
| Logs de acesso aos próprios dados | ✅ | ❌ | ❌ | ❌ | ✅ | ✅ |
| Alterar dado do usuário | ✅ | ❌ | 🔓 com motivo + desfazer | ❌ | 🔓 | 🔓 |
| Excluir conta | ✅ (pedido) | ❌ | ❌ | ❌ | ⛔ só com `dpo` | ✅ |
| Conceder papel | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ |

🔓 = permitido **apenas** através do console de suporte, com sessão,
motivo e registro. Nunca por leitura direta no Firestore.

### 2.4 O princípio que resolve a tensão

> O admin **não** ganha `allow read` amplo nas regras do Firestore.
> Ele ganha uma **Cloud Function** que lê por ele, registra, e devolve.

Assim: acesso total na prática, sem que a chave do banco fique pendurada na
sessão do navegador do admin. Se o token do admin vazar, o atacante ainda
precisa passar pela Function — que exige sessão com motivo, App Check, MFA
recente, e que grava tudo e dispara alerta.

## 3. Migração (sem quebrar nada)

```
Fase 1  Regras aceitam claim OU campo role (as Functions já fazem
        isso — functions/index.js:551-556). Nada quebra.
Fase 2  Cloud Function `setPlatformRole` + bootstrap do owner por
        Admin SDK. Conceder o claim ao admin atual.
Fase 3  Validar por 1 semana: painel admin funciona pelo claim.
Fase 4  Regras passam a exigir SÓ o claim. `users.role` vira espelho
        somente-leitura (escrito só pela Function) para exibição.
Fase 5  Aplicar patches/P0-01 na íntegra: o dono não escreve mais
        `role` no próprio documento — nem que quisesse, o campo
        deixou de valer.
```

A ordem importa: se a Fase 5 vier antes da Fase 2, o admin atual perde o
acesso e não há como recuperá-lo pela interface.

## 4. Higiene de sessão

| Controle | Hoje | Proposto |
|---|---|---|
| MFA no admin | ❌ | obrigatório (P1-08) |
| Duração da sessão admin | igual à do usuário | 30 min para ações de suporte |
| Reautenticação para ação sensível | ❌ | obrigatória |
| Revogação de sessão | ❌ | `revokeRefreshTokens()` por Function |
| Alerta de login novo (admin) | ❌ | e-mail fora da plataforma |
| Lista de sessões ativas | ❌ | no perfil, para todo usuário |

## 5. Regra permanente para novas features

Todo PR que criar coleção com dado pessoal responde, **no corpo do PR**:

1. Quem precisa ler? (o mínimo possível)
2. A regra reflete exatamente isso, ou está delegando ao cliente?
3. Preferência de privacidade — é aplicada no servidor?
4. O admin precisa ler? Se sim, **por Function auditada**, não por regra.
5. Qual a retenção?
6. `02-INVENTARIO-DE-DADOS.md` foi atualizado?

Isso vira item do checklist de entrega do `CLAUDE.md` §7.
