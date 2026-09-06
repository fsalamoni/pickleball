# FUTURO — funcionalidades desenhadas, ainda NÃO implementadas

> **Nada aqui existe no código.** Esta pasta guarda o desenho completo de
> funcionalidades que o PickleRush pretende ganhar **depois**, para que o
> estudo não se perca e para que quem retomar não precise recomeçar do zero.
>
> Nenhuma coleção, flag, regra, rota ou linha de código destas quatro
> funcionalidades foi criada. Elas **não** influenciam o comportamento atual
> da plataforma.

## As quatro funcionalidades

| Pasta | O que é | Estado |
|---|---|---|
| [`GAMIFICACAO/`](./GAMIFICACAO/README.md) | Progressão V2: tiers, skill trees, XP multi-fonte, missões, achievements de 5 famílias, streak com proteção | 📐 desenhada · flag `gamification_v2` existe e está **OFF** |
| [`MERCADO/`](./MERCADO/00-INDEX.md) | **Marketplace aberto** — um eBay/Mercado Livre/Amazon de pickleball dentro da plataforma | 📐 desenhada · nada no código |
| [`FEED/`](./FEED/00-INDEX.md) | **Rede social** — um Instagram de pickleball, rolagem infinita de fotos, vídeos e posts | 📐 desenhada · nada no código |
| [`CONFIANCA-E-MODERACAO/`](./CONFIANCA-E-MODERACAO/00-INDEX.md) | Denúncia, fila de moderação, bloqueio, silenciar, strikes — **infra compartilhada** pelo Mercado e pelo Feed | 📐 desenhada · nada no código |

[`PLANO-MESTRE-MERCADO-FEED.md`](./PLANO-MESTRE-MERCADO-FEED.md) — cronograma
consolidado do Mercado + Feed + Moderação (21 PRs, ~1.490 testes).

A gamificação tem plano próprio em `GAMIFICACAO/00-ROADMAP.md`.

## Ordem de prioridade recomendada

```
1. SEGURANÇA E PRIVACIDADE   ← docs/20-SEGURANCA-E-PRIVACIDADE/ (FORA desta pasta)
   Prioridade máxima e pré-requisito das demais. Existem achados
   CRÍTICOS abertos hoje, e tanto o Mercado quanto o Feed multiplicam
   a superfície de dado pessoal. Não faz sentido abrir qualquer uma
   das quatro funcionalidades abaixo antes de fechar aquilo.

2. FEED           menor risco, menor custo, cria o hábito diário e o
                  tráfego que o Mercado vai precisar
3. MODERAÇÃO      nasce junto com o Feed; o Mercado herda pronta
4. MERCADO        depende de tráfego e de moderação para não nascer deserto
5. GAMIFICAÇÃO    já está desenhada e flagueada; entra quando houver folga
```

**Regra dura**: nem o Mercado nem o Feed vão a público sem a
`CONFIANCA-E-MODERACAO` implementada **e** sem os itens P0/P1 de
`docs/20-SEGURANCA-E-PRIVACIDADE/01-AUDITORIA-ACHADOS.md` resolvidos.

## Como retomar qualquer uma delas

1. Leia `CLAUDE.md` §2 (princípios não-negociáveis) — valem para tudo aqui.
2. Leia o `00-INDEX.md`/`README.md` da pasta da funcionalidade.
3. Leia o plano de desenvolvimento dela e escolha o próximo PR.
4. Leia o `README.md` do módulo em `src/modules/` (as pastas de
   `marketplace/`, `feed/` e `moderation/` já existem, só com README).
5. Worktree, branch, PR, checklist de entrega do CLAUDE.md §7.
