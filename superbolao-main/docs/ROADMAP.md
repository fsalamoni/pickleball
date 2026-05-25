# Roadmap — Bolão Copa 2026

## Status Atual — 05/05/2026

### ✅ Concluído em produção
- [x] SPA React/Vite publicada em `https://superbolao.web.app`
- [x] Firebase project `hocapp-44760`, Hosting target `superbolao`, Firestore database `bolao2026`
- [x] Autenticação Google, perfil obrigatório, bloqueio de menores e fluxo de uso responsável
- [x] Criação, ingresso e administração de bolões
- [x] Cartão de palpites por fase, palpites especiais, pênaltis independentes do placar e avisos de palpites pendentes
- [x] Engine de pontuação sincronizada front/functions, com zebra, pênaltis reais, super buchas e desempates
- [x] Admin Geral para solicitações, bolões, seed, métricas, jogos/resultados, zebras e sincronização FIFA
- [x] Políticas públicas e regras atualizadas, com sidebar e padrão visual Arena Copa
- [x] Deploy de hosting concluído em `https://superbolao.web.app`
- [x] Code splitting em produção: rotas lazy, `vendor` e chunks `vendor-firebase-*` separados, sem chunks acima de 500 kB

### 🔄 Em andamento agora
- [x] Segunda passada do redesign Arena Copa publicada: Admin restantes, shell do bolão, calendário, regras, pontuação, perfil, criar, ingressar e palpites especiais
- [x] Documentos de plano, índice, indexação e caching atualizados para retomada sem perda de contexto
- [x] Base Playwright para E2E/smoke criada com rotas públicas, chunks lazy, overflow e harness autenticado por storage state
- [x] Smoke público em produção aprovado: 23 testes desktop/mobile + 3 skips esperados de chunk mobile em `/`, `/regras`, `/politica-uso`, `/aviso-jogos` e `/login`
- [x] Observabilidade frontend opt-in publicada: page views sanitizados, erros do ErrorBoundary e Firebase Performance/Analytics por env
- [x] Healthcheck operacional de produção criado e agendado no GitHub Actions para rotas públicas, HTML SPA e cache de assets do Hosting
- [x] Smoke visual autenticado em `/inicio`, `/boloes/:poolId/*` e `/admin/*` com dados reais: 6 testes desktop/mobile aprovados

### ⏳ Próximos blocos planejados
- [ ] Ampliar testes E2E de fluxos críticos autenticados com sessão real salva em `tests/.auth`
- [ ] Cobertura de integração com Firebase Emulators para services/regras
- [ ] Revisar canais de notificação dos alertas GitHub Actions/Firebase Console

---

## Histórico do Planejamento Inicial (Março 2025)

## Status Atual (Março 2025)

### ✅ Concluído (antes desta reestruturação)
- [x] SPA React + Vite funcional
- [x] Autenticação Google Sign-In
- [x] Criação e ingresso em bolões
- [x] Palpites em partidas (placar, pênaltis)
- [x] Palpites especiais (campeão, artilheiro)
- [x] Engine de pontuação completa com zebra
- [x] Leaderboard e rankings
- [x] Painel admin da plataforma (gestão de jogos, métricas, seed)
- [x] Admin do bolão (configurações, membros)
- [x] Cloud Functions para scoring, revelação, notificações
- [x] Regras de segurança Firestore
- [x] Índices compostos
- [x] CI/CD com GitHub Actions
- [x] Emuladores locais
- [x] Documentação inicial (README)

### 🔄 Em Andamento
- [ ] **Fase 1: Fundação** — Database dedicado + reorganização Core/Módulos
- [ ] **Documentação** — Criação dos docs de arquitetura e planejamento

### ⏳ Planejado
- [ ] **Fase 2:** Migração dos módulos existentes para nova estrutura
- [ ] **Fase 3:** Cloud Functions modulares com banco dedicado
- [ ] **Fase 4:** Refinamento dos painéis admin
- [ ] **Fase 5:** Robustez e segurança
- [ ] **Fase 6:** Melhorias de frontend/UX

---

## Próximos Passos Imediatos

### Passo 1: Criar database `bolao2026`
```bash
gcloud firestore databases create --database=bolao2026 --location=southamerica-east1
```

### Passo 2: Atualizar configuração Firebase (Frontend + Functions)
- Modificar `getFirestore(app)` → `getFirestore(app, 'bolao2026')`
- Modificar `getFirestore()` nas Cloud Functions

### Passo 3: Criar estrutura Core + Módulos
- Criar diretórios
- Mover arquivos
- Atualizar todos os imports

### Passo 4: Validar
- Rodar build (`npm run build`)
- Rodar testes (`npm run test`)
- Rodar emuladores (`firebase emulators:start`)
- Testar fluxos principais

---

## Marcos (Milestones)

| Milestone | Descrição | Critério de Aceitação |
|-----------|-----------|------------------------|
| **M1** | Database `bolao2026` criado e isolado | Frontend e Functions usam o banco dedicado |
| **M2** | Core estável e isolado | Nenhum módulo depende de outro; build e testes passam |
| **M3** | Módulos migrados | Cada funcionalidade em seu módulo; interfaces públicas definidas |
| **M4** | Cloud Functions adaptadas | Funções usam database `bolao2026` e estrutura modular |
| **M5** | Painéis admin refinados | Admin da plataforma e admin do bolão 100% funcionais |
| **M6** | Testes e segurança | Cobertura de testes > 80% no core; regras Firestore validadas |
| **M7** | Deploy produção | Plataforma estável em produção com novo banco isolado |

---

## Convenções para Atualização

- **Concluído:** Marcar com `[x]` e adicionar data
- **Em andamento:** Mover para seção correspondente
- **Bloqueado:** Adicionar nota com motivo
- **Cancelado:** Riscar com `~~` e adicionar motivo

---

## Notas do Proprietário

> **Prioridade #1:** Isolamento do banco de dados. A plataforma Bolão Copa 2026 deve ter seu próprio database no Firebase, segregada das demais plataformas do projeto `hocapp-44760`.
>
> **Prioridade #2:** Estrutura modular. O core deve ser rígido e estável; cada funcionalidade deve ser um módulo independente.
>
> **Prioridade #3:** Painéis de administração. Proprietário (platform_admin) gerencia a plataforma; criador do bolão (pool_owner) gerencia seu bolão.

---

> **Última atualização:** 05/05/2026
> **Versão:** 1.1.0