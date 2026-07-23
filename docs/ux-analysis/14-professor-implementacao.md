# 14 — Professor: plano de implementação completo

> Estrutura a implementação do **produto do professor** (aulas, agenda, alunos
> e pacotes) descrito em `08-professor.md` (PRO-01…PRO-18), sobre o que já
> existe, atrás de uma **flag própria e específica** (`coach_lessons`), de
> forma incremental e sem tocar no que já funciona.

## Contexto: o que JÁ existe (não reconstruir)

Há **três sistemas de coach independentes** no repositório:

| Sistema | Coleções | Identidade | Flag | Papel |
| --- | --- | --- | --- | --- |
| **A — Professores residentes** (`src/modules/coaches/`) | `coaches/{uid}`, `coach_arenas/{coachId_arenaId}` | usuário real (uid) | `coach_resident` | Perfil público + diretório `/coaches` + residência em arena |
| **B — Opt-in do atleta** | campos em `athlete_profiles/{uid}` | atleta com `is_coach` | `coach_directory` | Badge/filtro no diretório de atletas |
| **C — Aulas da arena (Arena V3)** | `arena_coaches`, `arena_classes`, `arena_class_bookings` | registro da arena | `arena_module_classes` | Aulas operadas por uma **arena** |

Sistema **A** já entrega: CRUD do perfil do professor, diretório `/coaches`
(`V2Coaches`), página pública `/coaches/:id` (`V2CoachProfile`), vínculo
professor↔arena (`coach_arenas`) exibido em `V2ArenaDetail`. Domínio puro
testado em `coaches/domain/coach.js`.

**Falta (greenfield):** disponibilidade do professor, solicitação/agenda de
aulas, roster de alunos, pacotes/créditos. O campo `weekly_schedule` em
`coach_arenas` existe mas não é usado; a coleção `coach_class_enrollments`
é citada mas nunca foi implementada.

## Decisão de arquitetura

O produto novo **estende o Sistema A** (professor = usuário). Motivos: o
professor tem alunos, agenda e pacotes **próprios**, independentes de uma
arena específica (Sistema C é arena-cêntrico e serve a outro caso: aulas que
a arena vende). Toda a camada nova é **aditiva**: coleções novas, uma flag
nova, zero alteração nos 3 sistemas existentes.

**Reuso de domínio (puro, já testado):**
- `arenas/domain/booking.js` — `expandRecurring`, `slotsConflict`,
  `hasConflictWithConfirmed`, `canTransition`, `BOOKING_STATUS`,
  `isValidSlot`, `weekdayOf` → base da agenda/recorrência/máquina de status.
- `arenas/domain/pricing.js` — `timeToMinutes`, `formatPrice` → horários/preço.
- `tournament/domain/capacity.js` — capacidade (alunos por turma).

## Flag

`COACH_LESSONS: 'coach_lessons'` — **"Aulas de professores (agenda, alunos e
pacotes)"**. Master único do produto novo. Nasce desligada. Não depende de
`coach_resident`, mas as telas convidam o usuário a criar o perfil de
professor (Sistema A) quando necessário. Rotas novas usam `FeatureFlagGuard`
(padrão das arenas).

## Modelo de dados (coleções novas)

### `coach_availability/{coachId}` — disponibilidade semanal (1 doc/professor)
```
{
  coach_id,                     // = uid
  windows: [                    // janelas recorrentes
    { id, weekdays:[0..6], start:'HH:MM', end:'HH:MM', arena_id?, location? }
  ],
  exceptions: [ { date:'YYYY-MM-DD', reason } ],  // folgas/férias
  slot_minutes: 60,             // duração padrão de 1 aula
  updated_at,
}
```

### `coach_lessons/{lessonId}` — aula (avulsa ou recorrente)
```
{
  coach_id, student_id|null, student_name, student_email,
  requested_by: 'student'|'coach',
  format: 'private'|'duo'|'group'|'clinic',
  kind: 'single'|'recurring', slots:[{date,start,end}], recurrence|null,
  max_students,                 // turma (group/clinic); 1 para private
  arena_id?|location?,
  price, payment_status,        // reusa PAYMENT_STATUS
  status,                       // reusa BOOKING_STATUS (requested→confirmed→completed/cancelled/declined)
  package_sale_id?|null,        // se pago por crédito de pacote
  notes, created_by, created_at, updated_at,
}
```

### `coach_students/{coachId_studentId}` — vínculo aluno-professor
```
{
  coach_id, student_id, student_name, student_email,
  status: 'invited'|'active'|'paused',
  level, tags:[],               // pontos fortes/fracos
  private_notes,                // só o professor vê
  lessons_done, last_lesson_at,
  joined_at, updated_at,
}
```

### `coach_packages/{packageId}` — pacote definido pelo professor
```
{ coach_id, name, lessons_count, validity_days, price, active, created_at }
```

### `coach_package_sales/{saleId}` — venda/crédito
```
{
  coach_id, student_id, package_id, package_name,
  credits_total, credits_used, expires_at, paid, sold_at,
}
```

## Regras Firestore (aditivas)

- `coach_availability/{coachId}`: leitura pública (aluno precisa ver horários);
  escrita só do próprio professor ou platform admin.
- `coach_lessons/{id}`: leitura do professor e do aluno vinculado (e admin);
  criar: o próprio professor OU o aluno (student_id == uid) OU admin; atualizar/
  excluir: professor ou admin (aluno só pode responder/cancelar campos próprios).
- `coach_students/{id}`: leitura do professor e do aluno; escrita do professor
  (e o aluno aceita o convite alterando só `status`).
- `coach_packages/{id}`: leitura pública; escrita do professor/admin.
- `coach_package_sales/{id}`: leitura do professor e do aluno; escrita do
  professor/admin.

## Fases (cada uma: domínio puro testado → serviço → hooks → UI → validação)

### Fase A — Agenda e solicitação de aula (PRO-05/06/07/09) — núcleo
- Domínio `coaches/domain/availability.js`: normaliza janelas/exceções, gera
  os slots livres de um dia/semana (reusando `weekdayOf`, `timeToMinutes`,
  `hasConflictWithConfirmed` contra as aulas confirmadas).
- Domínio `coaches/domain/lesson.js`: normaliza a aula, máquina de status
  (reusa `canTransition`/`BOOKING_STATUS`), rótulos e chips.
- Serviço `lessonService.js` (+ availability): CRUD, solicitar/responder,
  recorrência (`expandRecurring`), notificações (novo tipo `coach_lesson`).
- Hooks `useLessons.js`.
- UI: editor de disponibilidade no `V2CoachProfile` (dono); "Solicitar aula"
  no perfil público; **agenda do professor** `/aulas`; "Minhas aulas" do aluno.

### Fase B — Alunos (PRO-10/11/12)
- Domínio de roster (vínculo, tags, presença) + serviço + hooks.
- UI: aba "Alunos" do professor (lista, ficha de evolução, notas privadas,
  presença) e convite/aceite (espelha o convite de dupla `partner_invites`).

### Fase C — Pacotes e financeiro (PRO-13/14)
- Domínio de pacotes/créditos (saldo, validade, débito por aula concluída).
- Serviço + hooks + UI: definição de pacotes, venda, saldo do aluno,
  financeiro do professor (receita, exportação CSV).

### Fase D — Diferenciação (PRO-16/17/18) — opcional, depois
- Clínicas como eventos, nivelamento validado por professor, biblioteca de
  conteúdo. Cada uma pode ganhar sub-flag própria.

## Verificação (a cada fase)

- `npx vitest run` verde (novos testes de domínio), `npm run lint` limpo,
  `npm run build` ok.
- Fluxo ponta a ponta descrito na fase (ex.: professor define disponibilidade
  → aluno solicita → professor confirma → aparece nas duas agendas).
- Nada dos 3 sistemas existentes é alterado; com a flag desligada, nenhuma
  rota/menu/telas novas aparecem.

## Status de implementação

**Fases A, B e C concluídas** (produto núcleo completo atrás de `coach_lessons`).

- **Fase A — Agenda e aula** ✓
  - Domínio: `coaches/domain/availability.js` (janelas, exceções, geração de
    slots livres) e `coaches/domain/lesson.js` (aula avulsa/recorrente,
    formatos, máquina de status reusando `BOOKING_STATUS`/`canTransition`,
    partição próximas/histórico). Testados.
  - Serviço `services/lessonService.js` (+ `coach_availability`, `coach_lessons`),
    hooks `hooks/useLessons.js`.
  - UI: `V2CoachAgenda` (`/aulas`) com editor de disponibilidade + agenda;
    `V2StudentLessons` (`/minhas-aulas`); `RequestLessonDialog` no perfil público.
- **Fase B — Alunos** ✓
  - Domínio `coaches/domain/student.js` (vínculo, status com guarda, tags,
    ficha, filtros/resumo). Testado. Serviço `studentService.js`
    (`coach_students`), hooks `useStudents.js`, `CoachStudentsSection`
    (adicionar do histórico, editar ficha, pausar/reativar, remover).
- **Fase C — Pacotes e financeiro** ✓
  - Domínio `coaches/domain/package.js` (créditos, validade, receita, CSV).
    Testado. Serviço `packageService.js` (`coach_packages`,
    `coach_package_sales`; débito best-effort ao concluir aula), hooks
    `usePackages.js`, `CoachPackagesSection` (financeiro, ofertar/vender,
    créditos, export CSV) e saldo do aluno em `V2StudentLessons`.

Regras Firestore aditivas para as 5 coleções novas. Nav (`V2Layout`): "Ensino"
(professor) e "Minhas aulas" (aluno), gated por `coach_lessons`.

**Fase D — Diferenciação (PRO-16/17/18): parcial.**

- **PRO-18 — Biblioteca de conteúdo do professor** ✓
  - Domínio `coaches/domain/content.js` (categorias, visibilidade público/
    só-alunos, sanitização de URL de vídeo, filtro por observador). Testado.
  - Serviço `contentService.js` (`coach_content`; `listPublicCoachContent`
    separado para visitantes, pois a query completa é rejeitada pelas regras
    quando há itens só-alunos), hooks `useContent.js`.
  - UI: `CoachContentSection` (gestão no hub) e seção "Biblioteca de conteúdo"
    no perfil público, respeitando a visibilidade (aluno vinculado vê os itens
    só-alunos). Regra Firestore usa `exists(coach_students/{coachId_uid})`.
- **PRO-16 — Clínicas como eventos** e **PRO-17 — Nivelamento validado**:
  pendentes. Tocam outros módulos (eventos de clube, `leveling`/ranking) e
  devem ganhar sub-flag própria; construir sobre o núcleo entregue.
