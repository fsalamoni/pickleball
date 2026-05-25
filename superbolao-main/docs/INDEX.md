# Documentação da Plataforma Bolão Copa 2026

## Checkpoint Rápido — 05/05/2026

| Item | Estado atual |
|------|--------------|
| Produção | `https://superbolao.web.app` |
| Branch principal | `main`; Hosting atualizado com validação autenticada e correção de overflow mobile |
| Firebase | projeto `hocapp-44760`, hosting target `superbolao`, Firestore database `bolao2026` |
| Último pacote publicado | Dashboard mobile sem overflow, autenticação E2E automática e smoke autenticado em produção aprovado: 6 testes desktop/mobile |
| Próximo pacote | Ampliar fluxos E2E críticos autenticados e revisar notificações dos alertas GitHub Actions/Firebase Console |
| Validação mínima | `npm run lint`, `npm test`, `npm run typecheck`, `npm run build`, `git diff --check`, `npm run e2e:public`, `npm run e2e:auth`, `npm run health:production` |

## Cache de Retomada

Use esta ordem para evitar releitura dispersa quando retomar o projeto:

1. [DEVELOPMENT_PLAN.md](./DEVELOPMENT_PLAN.md) — checkpoint operacional e próximo bloco de implementação.
2. [ROADMAP.md](./ROADMAP.md) — estado de produção, concluído/em andamento/próximos blocos.
3. [DATABASE_DESIGN.md](./DATABASE_DESIGN.md) — índices Firestore e política de caching.
4. [ARCHITECTURE.md](./ARCHITECTURE.md) — fronteiras `src/core`, `src/modules` e Functions.
5. [MODULE_SYSTEM.md](./MODULE_SYSTEM.md) — convenções para novos módulos.

## Índice de Documentos

| Documento | Descrição |
|-----------|-----------|
| [ARCHITECTURE.md](./ARCHITECTURE.md) | Arquitetura geral da plataforma, estrutura core e sistema de módulos |
| [DATABASE_DESIGN.md](./DATABASE_DESIGN.md) | Projeto do banco de dados Firestore, estratégia de isolamento, índices e caching |
| [MODULE_SYSTEM.md](./MODULE_SYSTEM.md) | Sistema de módulos independentes — como criar, acoplar e manter |
| [DEVELOPMENT_PLAN.md](./DEVELOPMENT_PLAN.md) | Plano de desenvolvimento faseado — refatoração core + implementação de módulos |
| [ROADMAP.md](./ROADMAP.md) | Status atual, etapas concluídas e planejamento futuro |

---

## Guia de Leitura Rápida

### Para retomar o desenvolvimento após pausa:
1. Abra o checkpoint no topo deste arquivo.
2. Leia [DEVELOPMENT_PLAN.md](./DEVELOPMENT_PLAN.md) — próximos passos exatos.
3. Consulte [ROADMAP.md](./ROADMAP.md) — status por frente.
4. Verifique [DATABASE_DESIGN.md](./DATABASE_DESIGN.md) — índices e caches que não devem ser quebrados.

### Para adicionar uma nova funcionalidade:
1. Leia [MODULE_SYSTEM.md](./MODULE_SYSTEM.md) — padrão de módulos
2. Consulte a estrutura de diretórios em [ARCHITECTURE.md](./ARCHITECTURE.md)

### Para entender o isolamento de dados:
1. Leia [DATABASE_DESIGN.md](./DATABASE_DESIGN.md) — seções 1 a 4

---

> **Última atualização:** 05/05/2026
> **Versão da documentação:** 1.1.0