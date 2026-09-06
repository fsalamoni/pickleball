# 18.05 — Admin e plano da moderação

## 1. Painel admin

A moderação **não** ganha seção própria: ela aparece como aba dentro de
"Mercado" e dentro de "Feed", ambas apontando para o **mesmo componente**
`AdminModerationQueue`, com um filtro de origem pré-aplicado. Além disso,
entra na seção "Governança" já existente uma aba **"Moderação"** com a fila
completa (sem filtro), que é a visão de quem realmente opera.

```js
// seção 'governance' existente ganha:
{ id: 'moderation', label: 'Moderação', icon: ShieldAlert }
```

Componentes em `src/v2/components/admin/`:
`AdminModerationQueue` (fila + ações), `AdminModerationDetail` (item com
contexto), `AdminModerationStats` (métricas), `AdminUserSanctions`
(strikes, suspensões, banimentos por usuário).

## 2. Feature flag

```js
/** Confiança e moderação: denúncia, fila, bloqueio, silenciar, strikes
 *  e rate limits. Infra COMPARTILHADA pelo Mercado e pelo Feed.
 *  Ligar junto com a primeira das duas que for a público — nenhuma das
 *  duas deve ir sem esta. Aditiva. */
CONTENT_MODERATION: 'content_moderation',
```
Uma flag só. Não faz sentido ligar "denúncia" sem "fila".

## 3. Cloud Functions

| Função | Gatilho | O que faz |
|---|---|---|
| `scoreNewReport` | onCreate `content_reports` | calcula `priority_score`, agrupa por `group_id`, detecta coordenação |
| `autoLimitOnReports` | onWrite `content_reports` | N denunciantes distintos ponderados → alvo vira `limited` + avisa o autor |
| `expireStrikes` | schedule diário | `content_strikes` vencidos → `active:false`; reavalia sanções |
| `cleanupRateCounters` | schedule diário | remove janelas vencidas |
| `aggregateModerationStats` | schedule diário | `moderation_queue_stats` |
| `applyBlockCleanup` | onCreate `user_blocks` | remove follows mútuos, marca conversa como somente-leitura |

**6 funções novas.**

## 4. Plano de implementação (PR único)

**PR M1 — `feat/moderacao-fundacao`** (é o V8 da Onda do Feed, ou o U7.5
se o Mercado vier primeiro):

Entrega:
- `src/modules/moderation/` completo (domain ~196 testes, services, hooks).
- 7 coleções + regras + 12 índices.
- `ReportDialog` compartilhado, ligado no Feed e no Mercado.
- Bloquear / silenciar / "não tenho interesse" com efeito em todas as
  superfícies.
- Rate limits aplicados nos services de post, comentário, anúncio, oferta
  e denúncia.
- Fila de moderação no admin + aba em Governança.
- 6 Cloud Functions.
- Diretrizes de Comunidade no `legal/` (`community_guidelines`).
- Notificações de sanção e de desfecho de denúncia.

Testes: ~196 (domínio) + 25 (regras) + 12 (runtime) = **~233**.
Arquivos: ~34.
Esforço: **2 a 3 semanas**.

Aceite:
- [ ] Denunciar qualquer alvo leva à fila com a gravidade certa.
- [ ] 3 denunciantes distintos limitam o conteúdo automaticamente e o autor
      é avisado com motivo.
- [ ] Denunciante com peso negativo **não** dispara a auto-limitação sozinho.
- [ ] Bloquear some das duas pontas no feed, comentários, chat e Mercado.
- [ ] Comentar em post de quem me bloqueou é negado **pela regra**.
- [ ] 3 strikes ativos ⇒ pré-moderação automática.
- [ ] Strike expira em 180 dias sozinho.
- [ ] Recurso reverte strike e restaura o conteúdo.
- [ ] Toda ação de moderação tem motivo e está em `audit_logs`.
- [ ] Rate limit trava a 6ª publicação da hora com mensagem clara e o
      horário de liberação.
- [ ] Nenhuma denúncia é apagável, por ninguém.
- [ ] Flag OFF: nada disso existe e as duas features seguem sem denúncia
      (por isso **nenhuma vai a público com a flag OFF**).

## 5. Operação — o lado humano

Tecnologia não modera sozinha. Antes do lançamento público é preciso
definir, por escrito:

1. **Quem** olha a fila e com que frequência.
2. **SLA realista** por gravidade (e o que fazer se estourar).
3. **Régua pública**: as Diretrizes de Comunidade, com exemplos concretos
   de pickleball ("criticar a raquete: ok; xingar o vendedor: não").
4. **Escalada**: o que exige decisão do dono da plataforma (banimento,
   ordem judicial, conteúdo com menor).
5. **Registro de precedentes**: casos difíceis já decididos, para a
   próxima decisão ser consistente. Moderação inconsistente destrói mais
   confiança do que moderação rígida.
6. **Revisão trimestral** das métricas: taxa de procedência, reincidência,
   reversões em recurso.
