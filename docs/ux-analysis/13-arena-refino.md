# 13 — Refino de UX/UI das Arenas (pública + admin)

> Atualização de planejamento após a sincronização do branch de análise com o
> `main` (merge do Arena V3 + Sprints 0–5). O roadmap `docs/arena-roadmap.md`
> entregou as **funcionalidades**; este documento cobre o **refinamento** de
> UX/UI, design e navegação das duas telas centrais da persona proprietário:
> a página **pública** (`V2ArenaDetail`) e a de **admin** (`V2ArenaManage`).

## Contexto

O merge trouxe todo o módulo de arenas do `main`: quadras, calendário
interativo (público e admin), reserva instantânea, métricas, PIX, regras
estruturadas, mercado/estoque, membros, PDV, aulas, ligas, além de circuitos
e professores. Ao integrar, foram corrigidos bugs reais herdados (imports
`GraduationCap`/`Navigate` ausentes, `useMemo` condicional em
`V2ArenaMatchmaking`, aspas não escapadas) — lint agora 100% limpo, 1085
testes verdes, build ok.

## Princípios do refino (não quebrar nada)

1. **Dentro do modelo da plataforma**: paleta `ink`/`acid`/`paper`, ícones
   `lucide`, primitivos `V2*` (`src/v2/ui/primitives.jsx`), squircles e sombra
   orgânica. Nada de nova identidade visual.
2. **Aditivo e reversível**: refino é visual/organizacional; sem mudança de
   modelo de dados nem de regras Firestore.
3. **Verificar cada incremento**: lint + testes + build a cada passo, commits
   pequenos e descritivos.

## Diagnóstico das duas telas

### Página pública (`V2ArenaDetail`)
- **Ícones emoji** fora do design (`💳 Pagar com PIX`, `📋 Regras da arena`,
  `📍 cidade`) — o resto da plataforma usa `lucide`.
- **Cores fora da paleta**: avatar de professor com gradiente
  `from-emerald-500 to-amber-500`; preço `text-emerald-700`; categoria de
  regra `text-emerald-700`.
- **Datas cruas** nos "Próximos horários confirmados" (`2026-07-20 · 08:00`)
  em vez de formato pt-BR.
- **Hierarquia**: a reserva (CTA principal) aparece no hero e o calendário
  interativo fica abaixo de regras/contato — ordenação pode destacar melhor
  reserva/preços.

### Admin (`V2ArenaManage`)
- **13 abas em 2 linhas** sem rótulo de grupo — a intenção (linha 1 =
  operação; linha 2 = configuração) só existe em comentário; o usuário não a
  enxerga. Três abas de reserva (`Reservas`, `Calendário`, `Reservas (Admin)`)
  sem contexto podem confundir.
- **Comentários com encoding corrompido** (mojibake) no componente.
- **Ícones emoji / cores emerald** nas abas renderizadas (Pagamento, Regras,
  Mercado, DaySlots).

## Plano de refino (incrementos)

1. **Navegação do admin**: rótulos de grupo visíveis acima de cada linha de
   abas ("Operação" / "Configuração da arena"); ícone por aba para leitura
   rápida; limpar mojibake dos comentários. (`V2ArenaManage.jsx`)
2. **Consistência de design — pública**: emoji → `lucide`; emerald/amber →
   paleta (`green-*` semântico / `bg-ink text-acid`); datas em pt-BR.
   (`V2ArenaDetail.jsx`)
3. **Consistência de design — abas do admin**: emoji → `lucide`; emerald →
   paleta nas abas Pagamento/Regras/Mercado e no `V2DaySlotsDialog`.
4. **Polimento de estados**: revisar vazios/carregamento e microcopy das duas
   telas conforme necessário, usando `V2EmptyState`/`V2Skeleton`.

## Verificação

- `npm run lint` limpo, `npx vitest run` verde, `npm run build` ok a cada passo.
- Revisão visual das seções alteradas (sem mudança funcional de reserva,
  pagamento, regras ou métricas — apenas apresentação e navegação).
