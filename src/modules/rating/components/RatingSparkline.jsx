import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { TrendingUp } from 'lucide-react';

/**
 * Mini-gráfico (sparkline em SVG puro) da evolução do rating. Presentational —
 * o gating pela flag `rating_history` é feito pelo componente pai.
 *
 * @param {{ points: Array<{ at: number, rating: number }>, title?: string }} props
 */
export default function RatingSparkline({ points = [], title = 'Evolução do rating' }) {
  const valid = (points || []).filter((p) => Number.isFinite(p?.rating));
  if (valid.length < 2) return null;

  const width = 600;
  const height = 120;
  const pad = 10;
  const ratings = valid.map((p) => p.rating);
  const min = Math.min(...ratings);
  const max = Math.max(...ratings);
  const span = max - min || 1;
  const stepX = (width - pad * 2) / (valid.length - 1);

  const coords = valid.map((p, i) => {
    const x = pad + i * stepX;
    const y = pad + (height - pad * 2) * (1 - (p.rating - min) / span);
    return [x, y];
  });
  const polyline = coords.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' ');
  const last = valid[valid.length - 1].rating;
  const first = valid[0].rating;
  const delta = last - first;

  return (
    <Card>
      <CardContent className="p-4">
        <div className="mb-2 flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-800">
            <TrendingUp className="h-4 w-4 text-emerald-600" /> {title}
          </h2>
          <span className={`text-xs font-medium tabular-nums ${delta > 0 ? 'text-emerald-700' : delta < 0 ? 'text-red-600' : 'text-slate-500'}`}>
            {delta > 0 ? `+${delta}` : delta} desde o início
          </span>
        </div>
        <svg viewBox={`0 0 ${width} ${height}`} className="h-28 w-full" preserveAspectRatio="none">
          <polyline
            points={polyline}
            fill="none"
            stroke="rgb(5 150 105)"
            strokeWidth="2"
            strokeLinejoin="round"
            strokeLinecap="round"
          />
          {coords.length > 0 && (
            <circle cx={coords[coords.length - 1][0]} cy={coords[coords.length - 1][1]} r="3.5" fill="rgb(5 150 105)" />
          )}
        </svg>
        <div className="mt-1 flex justify-between text-[11px] text-slate-400 tabular-nums">
          <span>{min}</span>
          <span>{max}</span>
        </div>
      </CardContent>
    </Card>
  );
}
