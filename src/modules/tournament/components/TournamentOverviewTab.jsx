import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Calendar, Clock, MapPin, Wallet, Trophy } from 'lucide-react';
import { useModalities, useRegistrationsByTournament } from '@/modules/tournament/hooks/useTournament';
import {
  MODALITY_FORMAT_LABELS,
  SKILL_LEVEL_LABELS,
  GENDER_CATEGORY_LABELS,
  AGE_CATEGORY_LABELS,
  RULESET_LABELS,
  REGISTRATION_STATUS,
} from '@/modules/tournament/domain/constants';

function formatDate(value) {
  if (!value) return null;
  try {
    // value pode ser uma string ISO (YYYY-MM-DD) ou Timestamp do Firestore
    const date = typeof value === 'string'
      ? new Date(`${value}T00:00:00`)
      : value?.toDate
        ? value.toDate()
        : new Date(value);
    if (Number.isNaN(date.getTime())) return null;
    return date.toLocaleDateString('pt-BR');
  } catch {
    return null;
  }
}

function formatBRL(cents) {
  const value = Number(cents || 0) / 100;
  return `R$ ${value.toFixed(2).replace('.', ',')}`;
}

export default function TournamentOverviewTab({ tournament, isAdmin }) {
  const { data: modalities = [] } = useModalities(tournament.id);
  const { data: registrations = [] } = useRegistrationsByTournament(tournament.id);

  const confirmedByModality = (mid) =>
    registrations.filter((r) => r.modality_id === mid && r.status === REGISTRATION_STATUS.CONFIRMED).length;

  const startsAt = formatDate(tournament.starts_at);
  const endsAt = formatDate(tournament.ends_at);
  const deadline = formatDate(tournament.registration_deadline);

  return (
    <div className="grid md:grid-cols-2 gap-4">
      <Card>
        <CardContent className="p-5 space-y-3">
          <h3 className="font-semibold text-slate-900 flex items-center gap-2">
            <Trophy className="w-4 h-4 text-emerald-600" /> Informações do torneio
          </h3>
          {(startsAt || endsAt) && (
            <p className="text-sm text-slate-700 flex items-center gap-2">
              <Calendar className="w-4 h-4 text-slate-500" />
              <span>
                <strong>Data:</strong>{' '}
                {startsAt && endsAt
                  ? startsAt === endsAt ? startsAt : `${startsAt} a ${endsAt}`
                  : startsAt || endsAt}
              </span>
            </p>
          )}
          {deadline && (
            <p className="text-sm text-slate-700 flex items-center gap-2">
              <Clock className="w-4 h-4 text-slate-500" />
              <span><strong>Inscrições até:</strong> {deadline}</span>
            </p>
          )}
          {tournament.venue && (
            <p className="text-sm text-slate-700 flex items-center gap-2">
              <MapPin className="w-4 h-4 text-slate-500" />
              <span><strong>Local:</strong> {tournament.venue}</span>
            </p>
          )}
          <div className="border-t pt-3 space-y-1">
            <p className="text-sm text-slate-700">
              <strong>Regras:</strong> {RULESET_LABELS[tournament.scoring?.ruleset || tournament.ruleset] || '—'}
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
          </div>
          {tournament.description && (
            <p className="text-sm text-slate-600 border-t pt-3 whitespace-pre-line">{tournament.description}</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-5">
          <h3 className="font-semibold text-slate-900">Modalidades ({modalities.length})</h3>
          {modalities.length === 0 ? (
            <p className="text-sm text-slate-500 mt-2">
              {isAdmin ? 'Vá em "Admin" para criar a primeira modalidade.' : 'O admin ainda não cadastrou modalidades.'}
            </p>
          ) : (
            <ul className="mt-2 space-y-3">
              {modalities.map((m) => {
                const fee = Number(m.entry_fee_cents || 0);
                return (
                  <li key={m.id} className="text-sm border-b last:border-b-0 pb-2 last:pb-0">
                    <div className="flex items-center justify-between gap-2">
                      <div className="font-medium">{m.name}</div>
                      <Badge variant="secondary">
                        {confirmedByModality(m.id)}/{m.max_entries}
                      </Badge>
                    </div>
                    <div className="text-xs text-slate-500 mt-0.5">
                      {MODALITY_FORMAT_LABELS[m.format]} · {SKILL_LEVEL_LABELS[m.skill_level]} ·{' '}
                      {GENDER_CATEGORY_LABELS[m.gender_category]} · {AGE_CATEGORY_LABELS[m.age_category]}
                    </div>
                    <div className="text-xs text-slate-600 mt-1 flex items-center gap-1">
                      <Wallet className="w-3 h-3" />
                      <strong>Taxa:</strong>{' '}
                      {fee > 0 ? formatBRL(fee) : 'Gratuita'}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
