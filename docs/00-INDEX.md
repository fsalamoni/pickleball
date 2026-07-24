# 00-INDEX — Mapa de navegação da documentação

> **Você chegou aqui procurando algo específico?** Este é o índice
> principal de `docs/`. Use-o como mapa — o guia-mestre está na raiz em
> [`CLAUDE.md`](../CLAUDE.md).
>
> **Antes de qualquer tarefa**, leia o `CLAUDE.md` na raiz. Ele explica
> **como** usar este material. Este arquivo só diz **onde** está.

---

## 1. Leitura obrigatória (antes de qualquer coisa)

> **Você é uma IA?** Abra o `CLAUDE.md` na raiz e siga o fluxo de §1.
> **Você é humano novo no projeto?** Comece por `01-AI-CONTEXT.md`.

| Ordem | Doc | Pra quê |
|---|---|---|
| 0 | [`../CLAUDE.md`](../CLAUDE.md) | **GUIA-MESTRE** (raiz). Como usar este material, princípios, fluxos. |
| 1 | [`01-AI-CONTEXT.md`](./01-AI-CONTEXT.md) | Panorama condensado da plataforma. 1 leitura = tá orientado. |
| 2 | [`02-STANDARDS.md`](./02-STANDARDS.md) | **Padrões de código** (como codar, flags, services, domain). |
| 3 | [`03-WORKFLOW.md`](./03-WORKFLOW.md) | **Git, deploy, GitHub Actions, Firebase** (como mandar pra produção). |

## 2. Documentos de plataforma

| Doc | Conteúdo |
|---|---|
| [`01-AI-CONTEXT.md`](./01-AI-CONTEXT.md) | O que é, stack, arquitetura em 1 frase, papéis, rotas, dados, notificações, feature flags, deploy, convenções. **Leia 1x.** |
| [`04-ARCHITECTURE.md`](./04-ARCHITECTURE.md) | Camadas, estado, design system, Firebase, PWA, testes, CI/CD, padrões. Aprofunda o que o `01-AI-CONTEXT` cita. |
| [`05-DATA-MODEL.md`](./05-DATA-MODEL.md) | 92 coleções Firestore, campos, relacionamentos, princípios das regras. **Referência de schema.** |
| [`06-MODULES.md`](./06-MODULES.md) | 19 módulos: o que cada um faz, arquivos-chave, fluxos, mapa rota → módulo. |
| [`07-DESIGN-STANDARD.md`](./07-DESIGN-STANDARD.md) | Paleta (ink/acid/paper), tipografia (Outfit/Inter), componentes V2, padrões de composição. |
| [`08-ARENA-ROADMAP.md`](./08-ARENA-ROADMAP.md) | Roadmap das arenas: Sprints 0–10, status, métricas, próximo passo. |

## 3. Auditoria UX/UI

> Onde estão as melhorias por persona, o backlog e o que já foi feito.

| Doc | Conteúdo |
|---|---|
| [`09-UX-ANALYSIS/`](./09-UX-ANALYSIS/) | 15 docs de auditoria UX/UI por persona (atleta, organizador, arena, professor, clubes, transversais). |
| [`09-UX-ANALYSIS/15-backlog-remanescente.md`](./09-UX-ANALYSIS/15-backlog-remanescente.md) | ⭐ **Backlog consolidado do que ainda falta.** Comece por aqui pra novas features. |
| [`09-UX-ANALYSIS/14-professor-implementacao.md`](./09-UX-ANALYSIS/14-professor-implementacao.md) | Plano de implementação do professor (Sistema A greenfield). |
| [`09-UX-ANALYSIS/13-arena-refino.md`](./09-UX-ANALYSIS/13-arena-refino.md) | Refino de UX/UI das arenas (entregue). |

## 4. Arena V3 (sub-módulos opt-in)

> 51+ sub-módulos ativáveis por flag. O coração da customização da arena.

| Doc | Conteúdo |
|---|---|
| [`10-ARENA-V3/00-INDEX.md`](./10-ARENA-V3/00-INDEX.md) | Índice da documentação Arena V3. |
| [`10-ARENA-V3/26-ARENA-V3-COMPLETE-REFERENCE.md`](./10-ARENA-V3/26-ARENA-V3-COMPLETE-REFERENCE.md) | ⭐ **Referência rápida** (status atual, métricas, arquitetura). |
| [`10-ARENA-V3/10-MODULES-CATALOG.md`](./10-ARENA-V3/10-MODULES-CATALOG.md) | Catálogo dos 51+ módulos opt-in. |
| [`10-ARENA-V3/11-DATA-MODEL.md`](./10-ARENA-V3/11-DATA-MODEL.md) | Schema Firestore do Arena V3. |
| [`10-ARENA-V3/12-FEATURE-FLAGS.md`](./10-ARENA-V3/12-FEATURE-FLAGS.md) | Flags `ARENA_MODULE_*` → módulo. |
| [`10-ARENA-V3/15-BUSINESS-LOGIC.md`](./10-ARENA-V3/15-BUSINESS-LOGIC.md) | Domínio puro (regras) do Arena V3. |

## 5. Referência rápida (cheatsheet, FAQ, glossário)

| Doc | Conteúdo |
|---|---|
| [`11-REFERENCE/cheatsheet.md`](./11-REFERENCE/cheatsheet.md) | Cola de comandos, snippets, troubleshooting. |
| [`11-REFERENCE/glossary.md`](./11-REFERENCE/glossary.md) | Glossário de termos (CBPE, USAP, Onda X, etc). |
| [`11-REFERENCE/faq.md`](./11-REFERENCE/faq.md) | Perguntas frequentes: "como faço Y?", "onde está X?". |

## 6. Estrutura completa dos docs

```
docs/
├── 00-INDEX.md                       # ⭐ este arquivo
├── 01-AI-CONTEXT.md                  # panorama condensado
├── 02-STANDARDS.md                   # como codar
├── 03-WORKFLOW.md                    # como deployar
├── 04-ARCHITECTURE.md                # camadas + design system
├── 05-DATA-MODEL.md                  # 92 coleções Firestore
├── 06-MODULES.md                     # 19 módulos + fluxos
├── 07-DESIGN-STANDARD.md             # paleta + componentes
├── 08-ARENA-ROADMAP.md               # sprints 0-10
│
├── 09-UX-ANALYSIS/                   # 15 docs de auditoria
│   ├── 00-README.md
│   ├── 01-fundacao-design-system.md
│   ├── ... 13 docs ...
│   └── 15-backlog-remanescente.md   # ⭐ backlog
│
├── 10-ARENA-V3/                      # docs Arena V3
│   ├── 00-INDEX.md
│   ├── 26-ARENA-V3-COMPLETE-REFERENCE.md
│   └── ... sprints ...
│
└── 11-REFERENCE/                     # cheatsheet, FAQ, glossário
    ├── cheatsheet.md
    ├── glossary.md
    └── faq.md
```

## 7. Estrutura de docs por módulo (em `src/modules/X/README.md`)

> Cada um dos 19 módulos tem um `README.md` curto (50-80 linhas) com:
> visão, schema, hooks/services expostos, fluxos típicos, regras de
> negócio em domain/, exemplos.

```
src/modules/
├── tournament/README.md
├── arenas/README.md
├── coaches/README.md
├── clubs/README.md
├── circuits/README.md
├── chat/README.md
├── leveling/README.md
├── notifications/README.md
├── admin/README.md
├── games/README.md
├── partners/README.md
├── performance/README.md
├── progression/README.md
├── rating/README.md
├── sharing/README.md
├── social/README.md
├── athletes/README.md
├── analytics/README.md
└── achievements/README.md
```

## 8. Como manter atualizado

### Ao mudar **arquitetura, coleções, rotas, papéis**:
- Atualizar `01-AI-CONTEXT.md` (panorama)
- Atualizar `05-DATA-MODEL.md` (schema)
- Atualizar `06-MODULES.md` (módulo/rota)
- Atualizar `04-ARCHITECTURE.md` (camadas)
- Atualizar `CLAUDE.md` §10 (métricas, se mudaram)
- Atualizar memory do agente (se for lição crítica)

### Ao adicionar **feature nova**:
- Marcar como ✅ em `09-UX-ANALYSIS/15-backlog-remanescente.md`
- Criar/atualizar flag em `02-STANDARDS.md` §3
- Atualizar `01-AI-CONTEXT.md` §9 (catálogo de flags)
- Atualizar `src/modules/X/README.md` se for módulo novo
- Atualizar `08-ARENA-ROADMAP.md` se for arena

### Ao adicionar **módulo novo**:
- Criar `src/modules/X/README.md` (50-80 linhas, ver template em `tournament/README.md`)
- Adicionar entrada em `06-MODULES.md` § X
- Adicionar entrada em `CLAUDE.md` §3

### Ao mudar **padrão de código**:
- Atualizar `02-STANDARDS.md` (regra)
- Atualizar `03-WORKFLOW.md` (se for git/deploy)
- Atualizar `CLAUDE.md` §2 e §5 (princípios + decisão rápida)
- Atualizar memory do agente (lição crítica)

**Mantenha o texto denso e factual** — o objetivo é custo baixo de leitura.

---

> **Última atualização**: 2026-07-24. Mudou a estrutura de pastas?
> Atualize este arquivo **e** o `CLAUDE.md` §3.
