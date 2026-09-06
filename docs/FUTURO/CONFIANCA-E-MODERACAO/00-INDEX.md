# 18 — CONFIANÇA E MODERAÇÃO (infra compartilhada)

> **Status: 📐 PLANEJADO.** Camada transversal usada pelo **Mercado**
> (docs/16) e pelo **Feed** (docs/17). Existe para os dois **não**
> construírem denúncia, bloqueio e fila duas vezes.

## Por que uma camada separada

Denunciar um anúncio e denunciar um post são o mesmo problema: alguém viu
conteúdo de terceiro que não deveria estar lá, e a plataforma precisa
decidir. Se cada feature fizer a sua:
- o admin tem duas filas para olhar (e vai olhar mal as duas);
- bloquear alguém no feed não o impede de te comprar no Mercado;
- os strikes não somam, e o reincidente escapa;
- a auditoria fica espalhada.

Por isso: **uma fila, um bloqueio, um sistema de strikes, um registro**.

## Módulo

`src/modules/moderation/` — novo, com `domain/`, `services/`, `hooks/`,
`components/`. É o dono de:

| Coleção | O que é |
|---|---|
| `content_reports` | denúncias de qualquer alvo |
| `moderation_actions` | decisões tomadas (trilha imutável) |
| `content_strikes` | reincidência por usuário |
| `user_blocks` | bloqueio entre usuários |
| `user_mutes` | silenciar autor/hashtag |
| `user_rate_counters` | contadores para rate limit |
| `moderation_queue_stats` | agregados da fila |

## Documentos

| Doc | Conteúdo |
|---|---|
| `01-MODELO-DE-MODERACAO.md` | Filosofia, camadas, automação, SLA |
| `02-DENUNCIAS-E-FILA.md` | Motivos, priorização, fila do admin, ações |
| `03-BLOQUEIO-SILENCIAR-STRIKES.md` | Bloqueio, silenciar, strikes, sanções |
| `04-DATA-MODEL.md` | Schema das 7 coleções + regras + índices |
| `05-ADMIN-E-PLANO.md` | Painel admin, flags, plano de implementação |

## Ordem de implementação

Esta camada é entregue no **PR V8** (Onda do Feed), porque é lá que ela se
torna urgente. O Mercado a consome a partir do **U8**. Se o Mercado for
implementado **antes** do Feed, o V8 é antecipado e vira o **U7.5**.

**Regra dura**: nenhuma das duas features vai a público sem esta camada.
Conteúdo de usuário sem denúncia funcionando é passivo legal e reputacional.
