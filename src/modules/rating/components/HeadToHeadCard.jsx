import React from 'react';
import { Swords } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';

/**
 * Lista de confrontos diretos do atleta (V/D por adversário). Presentational —
 * o gating pela flag `head_to_head` é feito pelo componente pai.
 *
 * @param {{ records: Array<{opponent,played,wins,losses}>, limit?: number }} props
 */
export default function HeadToHeadCard({ records = [], limit = 10 }) {
  if (!records || records.length === 0) return null;
  const rows = records.slice(0, limit);

  return (
    <Card>
      <CardContent className="p-4">
        <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-800">
          <Swords className="h-4 w-4 text-emerald-600" /> Confrontos diretos
        </h2>
        <div className="space-y-2">
          {rows.map((r) => {
            const positive = r.wins > r.losses;
            const negative = r.wins < r.losses;
            return (
              <div key={r.opponent} className="flex items-center justify-between gap-3 rounded-md border border-slate-200 p-3">
                <span className="min-w-0 truncate text-sm text-slate-800">{r.opponent}</span>
                <span className={`shrink-0 text-sm font-semibold tabular-nums ${positive ? 'text-emerald-700' : negative ? 'text-red-600' : 'text-slate-600'}`}>
                  {r.wins}V – {r.losses}D
                </span>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
