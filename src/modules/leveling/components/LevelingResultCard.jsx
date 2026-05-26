import { Printer, RotateCcw, Trophy, TrendingUp, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { CATEGORY_LABELS, SKILL_LEVELS } from '@/modules/leveling/domain/questionnaire';

export default function LevelingResultCard({ result, onRestart, onPrint = () => window.print(), compact = false }) {
  if (!result) return null;
  const display = SKILL_LEVELS[result.level] || SKILL_LEVELS.novato;
  const breakdown = result.categoryBreakdown || {};

  return (
    <div className="mx-auto max-w-3xl space-y-5 print:max-w-none" id="leveling-print-area">
      <div className="rounded-lg bg-white p-5 shadow-sm ring-1 ring-slate-200 print:shadow-none">
        <div className="text-center">
          <Trophy className="mx-auto h-12 w-12 text-orange-500" />
          <p className="mt-3 text-sm text-slate-600">Seu Nível de Pickleball</p>
          <div className={`${display.bg} mx-auto mt-3 flex h-28 w-28 items-center justify-center rounded-full text-4xl font-bold text-white shadow-md`}>
            {result.usapEquivalent.toFixed(1)}
          </div>
          <h2 className={`mt-3 text-2xl font-bold ${display.color}`}>{display.name}</h2>
          <p className="text-sm font-semibold text-emerald-700">USAP {display.usap}</p>
          <p className="mt-2 text-sm text-slate-600">
            Pontuação Likert: <strong>{result.score}/520</strong> · Normalizado: <strong>{result.normalizedScore}/100</strong>
          </p>
        </div>

        <div className={`mt-6 border-l-4 ${display.border} rounded bg-slate-50 p-4`}>
          <h3 className="font-semibold text-slate-900">Sobre seu nível</h3>
          <p className="mt-2 text-sm leading-6 text-slate-700">{result.explanation}</p>
        </div>

        <div className="mt-6">
          <h3 className="font-semibold text-slate-900">Análise por categoria</h3>
          <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-5">
            {Object.entries(CATEGORY_LABELS).map(([key, label]) => (
              <div key={key} className="rounded bg-slate-50 p-3 text-center">
                <p className="text-xs font-medium text-slate-600">{label}</p>
                <p className="mt-1 text-2xl font-bold text-emerald-700">{Number(breakdown[key] || 0).toFixed(1)}</p>
                <p className="text-xs text-slate-500">de 5.0</p>
              </div>
            ))}
          </div>
        </div>

        {!compact && (
          <div className="mt-6">
            <h3 className="flex items-center gap-2 font-semibold text-slate-900">
              <TrendingUp className="h-5 w-5 text-blue-500" /> Recomendações para melhoria
            </h3>
            <ul className="mt-3 space-y-2">
              {(result.recommendations || []).map((recommendation, index) => (
                <li key={recommendation} className="flex gap-3 rounded bg-slate-50 p-3 text-sm text-slate-700">
                  <span className="font-bold text-blue-500">{index + 1}.</span>
                  <span>{recommendation}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="mt-6 rounded border-l-4 border-blue-500 bg-blue-50 p-4 text-sm text-blue-900">
          <div className="flex gap-2">
            <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-blue-500" />
            <p>Este formulário é uma autoavaliação psicométrica baseada em comportamentos observáveis. Confirme seu nível em jogos, aulas ou torneios oficiais.</p>
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-3 print:hidden sm:flex-row">
        {onRestart && (
          <Button onClick={onRestart} className="flex-1 bg-emerald-700 hover:bg-emerald-800">
            <RotateCcw className="mr-2 h-4 w-4" /> Refazer avaliação
          </Button>
        )}
        <Button onClick={onPrint} variant="outline" className="flex-1">
          <Printer className="mr-2 h-4 w-4" /> Imprimir nivelamento
        </Button>
      </div>
    </div>
  );
}
