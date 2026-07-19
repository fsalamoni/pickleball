# Análise UX/UI da PickleRush — Catálogo de melhorias

> Gerado em 2026-07-19 a partir de auditoria completa do código (`src/v2`, `src/modules`, `src/core`, `functions/`, docs e Design System). Todas as evidências citam `arquivo:linha` do estado do repositório nesta data.

## Objetivo

Catálogo acionável de melhorias de usabilidade e experiência (UX/UI) para as 4 personas da plataforma — **atleta**, **organizador de torneios/eventos**, **proprietário de arena** e **professor** — cobrindo design, layout, navegação, funcionalidades, organização e estrutura. Cada proposta tem ID estável para virar issue/tarefa.

## Como ler cada proposta

- **ID** — prefixo por área (DS, NAV, ONB, ATL, ORG, DIA, ARE, PRO, CLU, TRV, QW) + número.
- **Prioridade** — P0 (crítico/destrava valor), P1 (alto impacto), P2 (importante), P3 (desejável).
- **Complexidade** — B (baixa: horas), M (média: dias), A (alta: semanas).
- **Problema** — o que existe hoje, com evidência no código.
- **Proposta** — o que construir, com comportamento, telas e microcopy quando relevante.
- **Dados/Reuso** — modelo Firestore e código existente a reutilizar.

## Índice

| Doc | Tema | Propostas |
| --- | --- | --- |
| [01](./01-fundacao-design-system.md) | Fundação e design system | DS-01…DS-20 |
| [02](./02-navegacao-arquitetura-informacao.md) | Navegação e arquitetura de informação | NAV-01…NAV-18 |
| [03](./03-onboarding-perfil-conta.md) | Onboarding, perfil e conta | ONB-01…ONB-15 |
| [04](./04-atleta.md) | Atleta | ATL-01…ATL-25 |
| [05](./05-organizador-criacao-gestao.md) | Organizador — criação e gestão | ORG-01…ORG-22 |
| [06](./06-organizador-dia-de-jogo.md) | Organizador — dia de jogo (operação ao vivo) | DIA-01…DIA-15 |
| [07](./07-arena.md) | Proprietário de arena | ARE-01…ARE-20 |
| [08](./08-professor.md) | Professor | PRO-01…PRO-18 |
| [09](./09-clubes-comunidade.md) | Clubes e comunidade | CLU-01…CLU-15 |
| [10](./10-transversais-engajamento.md) | Transversais e engajamento | TRV-01…TRV-20 |
| [11](./11-quick-wins.md) | Quick wins (baixo esforço, alto retorno) | QW-01…QW-25 |
| [12](./12-roadmap-priorizacao.md) | Roadmap e priorização | — |

## Diagnóstico em uma página

**A plataforma tem uma fundação de domínio excepcional e uma superfície de produto incompleta.** O domínio de torneios (`src/modules/tournament/domain/`) suporta 7 formatos de competição com ~25 arquivos de teste; arenas têm precificação e detecção de conflito testadas; existe rating ELO com Cloud Function. Mas a experiência que o usuário toca tem lacunas estruturais:

1. **Fluxos que terminam em beco sem saída** — pagamento de inscrição fica pendente até um admin clicar manualmente; check-in existe como status mas não tem UI; arquivar torneio exige status "Cancelado" que não tem botão.
2. **Personas invisíveis na interface** — dono de arena e professor usam o mesmo dashboard de atleta; a gestão só é alcançável por deep-link; professor é apenas 4 campos no perfil.
3. **Design system fragmentado** — 3–4 sistemas de tokens/componentes convivem (acid/ink/paper vs shadcn emerald vs `arena-*` vs `Platform*`), 4 fontes carregadas, dark mode 100% morto, primitivos duplicados 2–3×.
4. **Zero re-engajamento fora do app** — notificações só in-app (sino), sem push/email; PWA pronto porém desligado.
5. **Mobile subatendido no momento mais crítico** — placar courtside com inputs numéricos comuns, sem bottom nav, chaves como tabelas.
6. **Onboarding inexistente** — login Google → dashboard, sem completude de perfil (modal existente é código morto), sem seleção de interesse/persona.

## Top 10 problemas por impacto

1. Pagamento de inscrição manual e sem instrução ao atleta (ATL-08, TRV-05)
2. Dupla por texto livre, sem convite/aceite — corrompe identidade e ranking (ATL-04)
3. Check-in sem UI (ATL-03, ORG-08)
4. Sem "Cancelar torneio" apesar de exigido para arquivar (ORG-04 / QW-04)
5. Arena sem calendário visual de disponibilidade (ARE-02)
6. Sem push notifications — retenção depende do usuário abrir o app (TRV-01)
7. Onboarding ausente; perfil incompleto só descoberto na inscrição (ONB-01)
8. Placar courtside não otimizado para operação em quadra (DIA-02)
9. Design system fragmentado eleva custo de toda tela nova (DS-01…)
10. Professor sem produto (PRO-*) — persona anunciada sem experiência própria

## Convenção de implementação

Toda mudança que altera comportamento visível deve nascer atrás de **feature flag** no catálogo `src/core/featureFlags.js` (padrão já estabelecido: nasce desligada, é ativada em runtime pelo admin em `platform_settings/global.feature_flags`). Correções de defeitos evidentes (links quebrados, copy obsoleta) podem ser diretas.
