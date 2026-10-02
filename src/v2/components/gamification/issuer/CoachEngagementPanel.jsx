import React, { useMemo } from 'react';
import { V2Badge, V2Surface } from '@/v2/ui/primitives';
import { useCoachLessons } from '@/modules/coaches/hooks/useLessons';
import { useCoachStudents } from '@/modules/coaches/hooks/useStudents';
import { useCoachPackages } from '@/modules/coaches/hooks/usePackages';
import { useCoachClinics } from '@/modules/coaches/hooks/useClinics';
import { useCoachContent } from '@/modules/coaches/hooks/useContent';
import { useCoachValidations } from '@/modules/coaches/hooks/useValidations';
import { coachMetrics, monthWindow } from '@/modules/progression/domain/supplyMetrics';
import { coachBadges, coachSuggestions, computeCoachHealth } from '@/modules/progression/domain/supplyHealth';
import OwnerEngagementPanel from './OwnerEngagementPanel';
import HealthCard from './HealthCard';

/** Engajamento do professor: saúde, selos, metas, desafios e recompensas. @param {{ coach: { id: string, name?: string } }} props */
export default function CoachEngagementPanel({ coach }) {
  const lessons = useCoachLessons(coach.id);
  const students = useCoachStudents(coach.id);
  const packages = useCoachPackages(coach.id);
  const clinics = useCoachClinics(coach.id);
  const content = useCoachContent(coach.id);
  const validations = useCoachValidations(coach.id);

  // Fonte que falhou é `undefined` (não "lista vazia"): o número que dependeria dela fica de fora.
  const ok = (q) => (q.isError ? undefined : q.data);
  const m = useMemo(() => coachMetrics({
    lessons: ok(lessons), students: ok(students), packages: ok(packages), clinics: ok(clinics),
    contents: ok(content), validations: ok(validations),
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [lessons.data, lessons.isError, students.data, students.isError, packages.data, packages.isError, clinics.data, clinics.isError, content.data, content.isError, validations.data, validations.isError]);

  const health = useMemo(() => computeCoachHealth(m.health), [m.health]);
  const badges = useMemo(() => coachBadges(m.health), [m.health]);
  const suggestions = useMemo(() => coachSuggestions(m.health), [m.health]);

  const summary = (
    <>
      <HealthCard health={health} suggestions={suggestions} unknown={m.unknown} title="Saúde do seu trabalho" basePath="/aulas" />
      {badges.length > 0 && (
        <V2Surface data-testid="coach-badges">
          <h2 className="mb-2 font-display text-lg font-bold text-ink">Seus selos</h2>
          <ul className="space-y-2">
            {badges.map((b) => (
              <li key={b.id} className="flex items-start gap-3">
                <V2Badge tone="amber"><span aria-hidden="true">{b.emoji}</span> {b.label}</V2Badge>
                <span className="text-xs text-gray-500">{b.criterion}</span>
              </li>
            ))}
          </ul>
        </V2Surface>
      )}
    </>
  );

  return (
    <OwnerEngagementPanel ownerType="coach" issuer={{ type: 'coach', id: coach.id, name: coach.name }} summary={summary} actuals={m.actuals} monthKey={monthWindow().key} />
  );
}
