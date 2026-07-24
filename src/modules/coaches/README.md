# `coaches/` — Produto do professor (Sistema A)

> **Sistema A**: professor = usuário real (uid). NÃO conflita com Arena V3
> **Sistema C** (`arena_classes` — aulas operadas por arena).
> Perfil público, diretório, residência em arena, agenda/aulas, roster de
> alunos, pacotes/créditos, biblioteca, loja, clínicas, validação de nível.

## Status

- **Páginas V2**: `V2Coaches` (diretório), `V2CoachProfile` (público),
  `V2CoachAgenda` (painel 2 níveis), `V2StudentLessons` (aulas do aluno)
- **Services**: 10+ — `coachService`, `coachAvailabilityService`,
  `coachLessonService`, `coachStudentService`, `coachPackageService`,
  `coachPackageSaleService`, `coachContentService`, `coachClinicService`,
  `coachClinicSignupService`, `coachLevelValidationService`,
  `coachProductService`, `coachArenaService`
- **Domain**: 9 arquivos puros testados (availability, clinic, coach,
  coachProduct, content, lesson, package, student, validation)
- **Tests**: 100+

## Fases (PR #68)

- **Fase A** (Agenda/aulas): `coach_availability` (janelas),
  `coach_lessons` (aulas marcadas), `coach_products` (loja)
- **Fase B** (Roster): `coach_students` (vínculo professor↔aluno),
  agenda de aulas por aluno
- **Fase C** (Pacotes/financeiro): `coach_packages` (pacotes),
  `coach_package_sales` (vendas com créditos restantes)
- **Fase D** (Biblioteca): `coach_content` (drills, vídeos, planos)

## Ondas adicionais

- **Onda 7b**: `coach_leveling` (validação por professor) +
  `coach_clinics` (clínicas/workshops abertos)
- **Onda 7**: `partnership_mutual` (aceite mútuo professor↔arena)

## Schema (Firestore)

### `coaches/{uid}` (perfil público)
- `display_name`, `bio`, `hourly_rate`, `regions[]`, `modalities[]`,
  `certifications[]`, `accepting_students`, `active`
- `leveling_level`, `photos[]`, `cover_url`
- `linked_club_ids[]` (Fase 8a)

### `coach_arenas/{coachId_arenaId}` (id determinista — residência)
- `coach_id`, `arena_id`, `status` ('active'|'paused')
- `partnership_status` (Onda 7): 'invited'|'accepted'|'declined'|'ended'
- `weekly_schedule`, `notes`

### `coach_availability/{coachId}` (Fase A)
- `weekdays[]`, `start_time`, `end_time`, `location`
- `is_recurring`, `is_active`

### `coach_lessons/{lessonId}` (Fase A)
- `coach_id`, `student_ids[]` (vazio = aula aberta)
- `scheduled_at`, `duration_min`, `arena_id` (opcional)
- `booking_id` (FK → arena_bookings quando for aula em arena parceira)
- `status` ('scheduled'|'in_progress'|'completed'|'cancelled'|'no_show')
- `price`, `payment_status`, `notes`

### `coach_students/{coachId_studentId}` (Fase B, id determinista)
- `coach_id`, `student_id`, `student_name` (desnormalizado)
- `leveling_level`, `goals`, `notes`
- `status` ('active'|'paused'|'ended')

### `coach_packages/{packageId}` (Fase C)
- `coach_id`, `name`, `description`, `lesson_count`, `price`
- `validity_days`, `modality`, `leveling_level`, `active`

### `coach_package_sales/{saleId}` (Fase C)
- `package_id`, `coach_id`, `buyer_id`, `price_paid`, `payment_method`
- `lessons_remaining` (decrementa ao consumir)
- `status` ('active'|'expired'|'cancelled'), `purchased_at`, `expires_at`

### `coach_content/{contentId}` (Fase D)
- `coach_id`, `title`, `description`, `category` ('drill'|'video'|'plan'|'article')
- `content_url`, `thumbnail_url`, `leveling_level`
- `visibility` ('public'|'students_only')

### `coach_clinics/{clinicId}` (Onda 7b)
- `coach_id`, `title`, `description`, `scheduled_at`, `duration_min`
- `location`, `capacity`, `price`, `leveling_min`/`max`
- `status` ('draft'|'open'|'full'|'closed'|'cancelled')

### `coach_clinic_signups/{signupId}` (Onda 7b)
- `clinic_id`, `user_id`, `payment_status`

### `coach_level_validations/{validationId}` (Onda 7b)
- `coach_id`, `athlete_id`, `validated_level`, `notes`

### `coach_products/{productId}` (Fase A — loja)
- `coach_id`, `name`, `price`, `stock`, `image_url`, `category`, `active`

## Fluxos principais

### Aula avulsa em arena parceira
1. Professor agenda aula com `booking_type='coach_lesson'`
2. `coach_lessons/{id}` salva + `arena_bookings/{id}` com mesmo `booking_id`
3. Aluno vê aula no calendar da arena
4. Pode ingressar se aula for aberta (`student_ids` vazio + flag)

### Pacote de aulas
1. Professor cria `coach_packages/{id}` (5 aulas, R$ 250)
2. Aluno compra → `coach_package_sales/{id}` com `lessons_remaining=5`
3. A cada aula: decrementa `lessons_remaining`
4. Vencimento: `expires_at` baseado em `validity_days`

### Clínica
1. Professor cria `coach_clinics/{id}` (workshop aberto)
2. Alunos se inscrevem (`coach_clinic_signups`)
3. Capacidade atingida → status `full`
4. Após data → status `closed`

## Hooks expostos

```js
import { useCoachProfile } from '@/modules/coaches/hooks/useCoachProfile';
import { useCoachLessons } from '@/modules/coaches/hooks/useCoachLessons';
import { useCoachStudents } from '@/modules/coaches/hooks/useCoachStudents';
import { useCoachPackages } from '@/modules/coaches/hooks/useCoachPackages';
import { useCoachClinics } from '@/modules/coaches/hooks/useCoachClinics';
import { useCoachContent } from '@/modules/coaches/hooks/useCoachContent';
```

## Feature flags

- `COACH_DIRECTORY` — diretório de professores
- `COACH_RESIDENT` — residência em arena (vínculo)
- `COACH_LESSONS` — produto do professor (aulas, alunos, pacotes) — **master**
- `COACH_LEVELING` — validação de nível (Onda 7b)
- `COACH_CLINICS` — clínicas/workshops (Onda 7b)
- `PARTNERSHIP_MUTUAL` — aceite mútuo (Onda 7)

## Onde achar mais

- `docs/06-MODULES.md` § coaches
- `docs/09-UX-ANALYSIS/08-professor.md` — auditoria UX
- `docs/09-UX-ANALYSIS/14-professor-implementacao.md` — plano completo
- `docs/05-DATA-MODEL.md` § Professores
