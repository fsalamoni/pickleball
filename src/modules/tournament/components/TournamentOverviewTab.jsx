import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useModalities, useRegistrationsByTournament } from '@/modules/tournament/hooks/useTournament';
import {
  MODALITY_FORMAT_LABELS,
  SKILL_LEVEL_LABELS,
  GENDER_CATEGORY_LABELS,
  AGE_CATEGORY_LABELS,
  RULESET_LABELS,
  REGISTRATION_STATUS,
} from '@/modules/tournament/domain/constants';

export default function TournamentOverviewTab({ tournament, isAdmin }) {
  const { data: modalities = [] } = useModalities(tournament.id);
  const { data: registrations = [] } = useRegistrationsByTournament(tournament.id);

  const confirmedByModality = (mid) =>
    registrations.filter((r) => r.modality_id === mid && r.status === REGISTRATION_STATUS.CONFIRMED).length;

  return (
    <div className="grid md:grid-cols-2 gap-4">
      <Card>
        <CardContent className="p-5 space-y-2">
          <h3 className="font-semibold text-slate-900">Resumo</h3>
          <p className="text-sm text-slate-700">
            <strong>Regras:</strong> {RULESET_LABELS[tournament.scoring?.ruleset || tournament.ruleset]}
          </p>
          <p className="text-sm text-slate-700">
            <strong>Pontos por game:</strong> {tournament.scoring?.target_score} (vantagem de 2)
          </p>
          <p className="text-sm text-slate-700">
            <strong>Sets por partida:</strong> {tournament.scoring?.sets_per_match}
          </p>
          <p className="text-sm text-slate-700">
            <strong>Pontos por vitória:</strong> {tournament.scoring?.points?.match_win}
            {tournament.scoring?.points?.per_set_won > 0
              ? ` (+${tournament.scoring.points.per_set_won} por set)`
              : ''}
          </p>
          {tournament.venue && (
            <p className="text-sm text-slate-700">
              <strong>Local:</strong> {tournament.venue}
            </p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-5">
          <h3 className="font-semibold text-slate-900">Modalidades ({modalities.length})</h3>
          {modalities.length === 0 ? (
            <p className="text-sm text-slate-500 mt-2">
              {isAdmin ? 'Vá em "Modalidades" para criar a primeira.' : 'O admin ainda não cadastrou modalidades.'}
            </p>
          ) : (
            <ul className="mt-2 space-y-2">
              {modalities.map((m) => (
                <li key={m.id} className="flex items-center justify-between text-sm">
                  <div>
                    <div className="font-medium">{m.name}</div>
                    <div className="text-xs text-slate-500">
                      {MODALITY_FORMAT_LABELS[m.format]} · {SKILL_LEVEL_LABELS[m.skill_level]} ·{' '}
                      {GENDER_CATEGORY_LABELS[m.gender_category]} · {AGE_CATEGORY_LABELS[m.age_category]}
                    </div>
                  </div>
                  <Badge variant="secondary">
                    {confirmedByModality(m.id)}/{m.max_entries}
                  </Badge>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
