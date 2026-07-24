# 12 — Roadmap e priorização

## Critérios

- **Impacto**: destrava receita/retenção ou remove beco sem saída de fluxo.
- **Esforço**: B (horas) / M (dias) / A (semanas).
- **Dependências técnicas**: push exige PWA/SW; lembretes exigem functions agendadas; mensalidades/pacotes exigem pagamento; ranking de dupla exige convite de dupla.

## Ondas

### Onda 0 — Correções e higiene (dias)
Todos os QW já implementáveis: QW-01…QW-11 (feitos neste branch), QW-12…QW-16, QW-20…QW-22.
**Meta:** zero becos sem saída visíveis; base visual coerente.

### Onda 1 — Fundação de experiência (semanas)
- Onboarding: ONB-01 → ONB-02, ONB-03, ONB-05
- Navegação: NAV-01, NAV-02, NAV-06, NAV-08, NAV-09
- Design system: DS-01…DS-07, DS-09, DS-10, DS-16, DS-17
- Atleta: ATL-01, ATL-03, ATL-07, ATL-04 (começar cedo — é a maior dívida de dados)
- Organizador: ORG-04, ORG-05, ORG-08
- Infra: TRV-03 (PWA), TRV-08 (analytics), TRV-18 (E2E)
**Meta de métricas:** ativação (perfil completo em D1) e taxa de inscrição concluída.

### Onda 2 — Monetização e operação (1–2 meses)
- Pagamentos: TRV-05 F1 (ATL-08) → F2 gateway; ORG-15
- Dia de jogo: DIA-02, DIA-01, DIA-04, DIA-05, DIA-11
- Arena: ARE-01, ARE-02, ARE-11, ARE-03, ARE-08, ARE-10
- Push: TRV-01 + TRV-06 (lembretes) + ONB-06 (preferências)
- Organizador: ORG-01, ORG-02, ORG-06, ORG-07, ORG-09
**Meta:** GMV de inscrições/reservas; % de pagamentos confirmados automaticamente; no-show de reservas.

### Onda 3 — Expansão de personas e ecossistema (contínuo)
- Professor: PRO-01…PRO-03 (vitrine) → PRO-05/06/09 (agenda) → PRO-10…PRO-14 (alunos/pacotes)
- Clubes: CLU-01, CLU-07, CLU-02, CLU-05
- Circuitos: ORG-20; ranking de duplas ATL-16; gamificação (ATL-19, TRV progressão)
- SEO/aquisição: TRV-09, DS-18, CLU-07, ORG-18
**Meta:** professores ativos, clubes com evento recorrente, tráfego orgânico das páginas públicas.

## Matriz resumida (P0/P1 por esforço)

| | Baixo | Médio | Alto |
| --- | --- | --- | --- |
| **P0** | QW-01…11, TRV-03, ARE-11, NAV-02, ONB-01 | ORG-04, ORG-05, ATL-08, DIA-02, ARE-01, NAV-01 | ATL-04, TRV-01, TRV-05, ARE-02 |
| **P1** | DS-02, DS-09, DS-10, DS-17, NAV-08, ORG-07, ATL-02, ATL-07 | DS-01, DS-03, DS-04, NAV-06, ONB-02*, ONB-05…09, ATL-01/03/09/12/15, ORG-01/02/03/06/08/09/11/15, DIA-04/11, ARE-03/04/05/08/10/12, PRO-01/02/03/05/09/10/13*, CLU-01/07, TRV-02/06/09/10/11/13/14/18 | NAV-03, DIA-01/03/05, PRO-06, ORG-20* |

\* itens P1 com componentes de esforço A.

## Regras de implementação

1. **Toda mudança visível nasce atrás de flag** (`src/core/featureFlags.js`), default off, ativável no admin console; declarar dependências entre flags (TRV-13).
2. **Domínio puro primeiro** (com testes, padrão da casa) → serviço → hook → UI.
3. **Nunca quebrar dados existentes**: campos novos opcionais, migrações lazy (ex.: ARE-01 mantém `court_count`; PRO-03 mantém campos texto até edição).
4. **Instrumentar antes de otimizar**: cada onda liga os eventos de funil correspondentes (TRV-08).
