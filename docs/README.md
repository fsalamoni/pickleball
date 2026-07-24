# docs/ — Base de conhecimento (para IA e humanos)

Documentação de referência da plataforma **PickleRush**, escrita para que
qualquer pessoa — ou IA — entenda a estrutura e o funcionamento com o **mínimo
de tokens/leitura**, sem precisar varrer o código.

## Ordem de leitura

1. **[`AI_CONTEXT.md`](./AI_CONTEXT.md)** — documento-mestre. Leia primeiro:
   o que é, stack, arquitetura, papéis, rotas, dados, notificações, deploy e
   convenções, tudo condensado.
2. **[`ARCHITECTURE.md`](./ARCHITECTURE.md)** — camadas, estado, design system,
   Firebase, PWA, testes, CI/CD e padrões de código.
3. **[`DATA_MODEL.md`](./DATA_MODEL.md)** — coleções Firestore (92 totais),
   campos, relacionamentos e princípios das regras de segurança.
4. **[`MODULES.md`](./MODULES.md)** — o que cada módulo (19) faz,
   arquivos-chave, fluxos e o mapa rota → módulo.
5. **[`DESIGN_STANDARD.md`](./DESIGN_STANDARD.md)** — padrão visual obrigatório
   para páginas, tabs e modais, com componentes-base e regras de composição.
6. **[`arena-roadmap.md`](./arena-roadmap.md)** — roadmap das arenas, com
   status atualizado dos Sprints 0–10.
7. **[`ARENA_V3/00-INDEX.md`](./ARENA_V3/00-INDEX.md)** — referência completa
   do Arena V3 (51+ módulos opt-in, Firestore rules, business logic).
   Comece por **`26-ARENA-V3-COMPLETE-REFERENCE.md`** para o status atual.
8. **[`ux-analysis/15-backlog-remanescente.md`](./ux-analysis/15-backlog-remanescente.md)**
   — backlog consolidado do que ainda falta. **Comece por aqui** se for
   implementar algo novo.

> O `README.md` da raiz cobre funcionalidades para o usuário final, como rodar
> e publicar. Estes docs cobrem **estrutura e funcionamento interno**.

## Estrutura dos docs

```
docs/
├── AI_CONTEXT.md           # documento-mestre (LEIA PRIMEIRO)
├── ARCHITECTURE.md         # camadas, design system, padrões
├── DATA_MODEL.md           # 92 coleções Firestore + regras
├── MODULES.md              # 19 módulos + mapa rota→módulo
├── DESIGN_STANDARD.md      # paleta/tipografia/componentes V2
├── arena-roadmap.md        # sprints 0-10 das arenas
├── README.md               # este arquivo
├── ARENA_V3/               # docs específicos da Arena V3
│   ├── 00-INDEX.md
│   ├── 26-ARENA-V3-COMPLETE-REFERENCE.md  # status atual
│   ├── 11-DATA-MODEL.md
│   ├── 12-FEATURE-FLAGS.md  # 51+ flags ARENA_MODULE_*
│   └── ... (sprints 1-10)
└── ux-analysis/            # auditoria UX/UI por persona
    ├── 01-fundacao-design-system.md (DS-*)
    ├── 02-navegacao-arquitetura-informacao.md (NAV-*)
    ├── 03-onboarding-perfil-conta.md (ONB-*)
    ├── 04-atleta.md (ATL-*)
    ├── 05-organizador-criacao-gestao.md (ORG-*)
    ├── 06-organizador-dia-de-jogo.md (DIA-*)
    ├── 07-arena.md (ARE-*)
    ├── 08-professor.md (PRO-*)
    ├── 09-clubes-comunidade.md (CLU-*)
    ├── 10-transversais-engajamento.md (TRV-*)
    ├── 11-quick-wins.md (QW-*)
    ├── 12-roadmap-priorizacao.md
    ├── 13-arena-refino.md           # refino entregue
    ├── 14-professor-implementacao.md # professor entregue
    └── 15-backlog-remanescente.md   # ⭐ o que ainda falta
```

## Como manter atualizado

Ao mudar **arquitetura, coleções Firestore, rotas ou papéis**, atualize o doc
correspondente (e o `AI_CONTEXT.md` se afetar o panorama). Mantenha o texto
**denso e factual** — o objetivo é custo baixo de leitura.

Toda **nova feature** deve atualizar:
- `AI_CONTEXT.md` (se afeta panorama)
- `DATA_MODEL.md` (se afeta schema)
- `MODULES.md` (se afeta módulo/rota)
- `ux-analysis/15-backlog-remanescente.md` (marcar como ✅ implementado)
</content>
