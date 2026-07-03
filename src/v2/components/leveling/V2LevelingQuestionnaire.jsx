import React, { useMemo, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, CheckCircle2, ChevronDown, Printer, RotateCcw, Trophy, TrendingUp, AlertCircle } from 'lucide-react';
import { cn } from '@/core/lib/utils';
import {
  CATEGORY_ORDER,
  INITIAL_LEVELING_ANSWERS,
  LIKERT_OPTIONS,
  NEUTRAL_BASELINE_VALUE,
  QUESTIONNAIRE_SECTIONS,
  calculateAssessment,
  countNonNeutralAnswers,
  CATEGORY_LABELS,
  SKILL_LEVELS,
} from '@/modules/leveling/domain/questionnaire';
import { V2Button, V2Surface } from '@/v2/ui/primitives';

export function V2LevelingResultCard({ result, onRestart, onPrint = () => window.print(), compact = false }) {
  if (!result) return null;
  const display = SKILL_LEVELS[result.level] || SKILL_LEVELS.novato;
  const breakdown = result.categoryBreakdown || {};

  return (
    <div className="mx-auto max-w-3xl space-y-5 print:max-w-none" id="leveling-print-area">
      <V2Surface className="p-5 shadow-organic-sm print:shadow-none sm:p-8">
        <div className="text-center">
          <Trophy className="mx-auto h-12 w-12 text-acid" />
          <p className="mt-3 font-display text-sm font-bold uppercase tracking-widest text-gray-400">Seu Nível de Pickleball</p>
          <div className="mx-auto mt-4 flex h-32 w-32 items-center justify-center rounded-full bg-ink text-5xl font-bold text-acid shadow-organic">
            {result.usapEquivalent.toFixed(1)}
          </div>
          <h2 className="mt-6 font-display text-3xl font-bold text-ink">{display.name}</h2>
          <p className="text-sm font-bold text-green-600">USAP {display.usap}</p>
          <p className="mt-3 text-sm text-gray-500">
            Pontuação Likert: <strong className="text-ink">{result.score}/520</strong> · Normalizado: <strong className="text-ink">{result.normalizedScore}/100</strong>
          </p>
        </div>

        <div className="mt-8 rounded-3xl border border-gray-100 bg-paper p-5 sm:p-6">
          <h3 className="font-display text-base font-bold text-ink">Sobre seu nível</h3>
          <p className="mt-2 text-sm leading-6 text-gray-600">{result.explanation}</p>
        </div>

        <div className="mt-6">
          <h3 className="font-display text-base font-bold text-ink">Análise por categoria</h3>
          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-5">
            {Object.entries(CATEGORY_LABELS).map(([key, label]) => (
              <div key={key} className="rounded-3xl border border-gray-100 bg-paper p-4 text-center">
                <p className="text-[11px] font-bold uppercase tracking-widest text-gray-400">{label}</p>
                <p className="mt-2 text-2xl font-bold text-ink">{Number(breakdown[key] || 0).toFixed(1)}</p>
                <p className="text-[10px] uppercase text-gray-400">de 5.0</p>
              </div>
            ))}
          </div>
        </div>

        {!compact && (
          <div className="mt-8">
            <h3 className="flex items-center gap-2 font-display text-base font-bold text-ink">
              <TrendingUp className="h-5 w-5 text-acid" /> Recomendações para melhoria
            </h3>
            <ul className="mt-4 space-y-3">
              {(result.recommendations || []).map((recommendation, index) => (
                <li key={recommendation} className="flex gap-3 rounded-2xl border border-gray-100 bg-paper-pure p-4 text-sm text-gray-600 shadow-organic-sm">
                  <span className="font-display font-bold text-acid">{index + 1}.</span>
                  <span>{recommendation}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="mt-8 rounded-3xl border border-blue-100 bg-blue-50/50 p-5 text-sm text-blue-900">
          <div className="flex gap-3">
            <AlertCircle className="h-5 w-5 shrink-0 text-blue-500" />
            <p className="leading-6">Este formulário é uma autoavaliação psicométrica baseada em comportamentos observáveis. Confirme seu nível em jogos, aulas ou torneios oficiais.</p>
          </div>
        </div>
      </V2Surface>

      <div className="flex flex-col gap-3 print:hidden sm:flex-row">
        {onRestart && (
          <V2Button onClick={onRestart} className="flex-1">
            <RotateCcw className="h-4 w-4" /> Refazer avaliação
          </V2Button>
        )}
        <V2Button onClick={onPrint} variant="ghost" className="flex-1">
          <Printer className="h-4 w-4" /> Imprimir nivelamento
        </V2Button>
      </div>
    </div>
  );
}

function getColorClass(value) {
  if (value === 1) return 'border-red-200 bg-red-50 text-red-900';
  if (value === 2) return 'border-orange-200 bg-orange-50 text-orange-900';
  if (value === 3) return 'border-amber-200 bg-amber-50 text-amber-900';
  if (value === 4) return 'border-lime-200 bg-lime-50 text-lime-900';
  if (value === 5) return 'border-green-200 bg-green-50 text-green-900';
  return 'border-gray-200 bg-paper text-gray-400';
}

function QuestionCard({ questionNumber, question, value, showContext, onToggleContext, onChange }) {
  return (
    <div className="rounded-4xl border border-gray-100 bg-paper-pure p-5 shadow-organic-sm transition hover:shadow-md sm:p-6">
      <div className="mb-5">
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <span className="rounded-full bg-ink px-3 py-1 font-display text-sm font-bold text-acid">Q{questionNumber}</span>
          <span className="text-[11px] font-bold uppercase tracking-widest text-gray-400">{question.category}</span>
        </div>
        <p className="font-display text-lg font-bold leading-relaxed text-ink">{question.statement}</p>
        <button type="button" onClick={onToggleContext} className="mt-3 flex items-center gap-2 text-xs font-bold text-acid transition-colors hover:text-ink">
          <ChevronDown className={cn('h-4 w-4 transition-transform', showContext ? 'rotate-180' : '')} />
          {showContext ? 'Ocultar' : 'Ver'} comportamento observável
        </button>
        {showContext && <div className="mt-4 rounded-2xl border border-gray-100 bg-paper p-4 text-sm leading-6 text-gray-600">{question.context}</div>}
      </div>

      <div className="grid gap-2 sm:grid-cols-5">
        {LIKERT_OPTIONS.map((option) => (
          <button
            type="button"
            key={option.value}
            onClick={() => onChange(option.value)}
            className={cn(
              'rounded-2xl border-2 p-3 text-center transition-all',
              value === option.value ? cn(getColorClass(option.value), 'ring-4 ring-acid/30') : 'border-gray-100 bg-paper hover:border-gray-300'
            )}
          >
            <div className="font-display text-xl font-bold">{option.value}</div>
            <div className="mt-1 text-xs font-bold text-ink">{option.label}</div>
            <div className="mt-1 text-[10px] text-gray-500">{option.sublabel}</div>
          </button>
        ))}
      </div>
    </div>
  );
}

const TOTAL_QUESTIONS = QUESTIONNAIRE_SECTIONS.reduce((sum, section) => sum + section.questions.length, 0);

export function V2LevelingQuestionnaire({
  initialAnswers,
  initialResult = null,
  onComplete,
  onSaveDraft,
  saveLabel = 'Salvar resultado',
}) {
  const mergedInitialAnswers = useMemo(() => ({ ...INITIAL_LEVELING_ANSWERS, ...(initialAnswers || {}) }), [initialAnswers]);
  const [answers, setAnswers] = useState(mergedInitialAnswers);
  const [result, setResult] = useState(initialResult);
  const [activeCategory, setActiveCategory] = useState(CATEGORY_ORDER[0]);
  const [expandedContext, setExpandedContext] = useState({});
  const topRef = useRef(null);

  const currentIndex = CATEGORY_ORDER.indexOf(activeCategory);
  const answered = countNonNeutralAnswers(answers);
  const progress = Math.round((answered / TOTAL_QUESTIONS) * 100);

  function updateAnswer(questionId, value) {
    setAnswers((current) => ({ ...current, [questionId]: value }));
  }

  function switchCategory(category) {
    setActiveCategory(category);
    topRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function handlePrevious() {
    if (currentIndex > 0) switchCategory(CATEGORY_ORDER[currentIndex - 1]);
  }

  function handleNext() {
    if (currentIndex < CATEGORY_ORDER.length - 1) switchCategory(CATEGORY_ORDER[currentIndex + 1]);
    else handleCalculate();
  }

  async function handleCalculate() {
    const nextResult = calculateAssessment(answers);
    setResult(nextResult);
    await onComplete?.({ answers, result: nextResult });
    topRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  async function handleSaveDraft() {
    await onSaveDraft?.({ answers, result: result || calculateAssessment(answers) });
  }

  function restart() {
    setAnswers(INITIAL_LEVELING_ANSWERS);
    setResult(null);
    setActiveCategory(CATEGORY_ORDER[0]);
  }

  if (result) {
    return <div ref={topRef}><V2LevelingResultCard result={result} onRestart={restart} /></div>;
  }

  const activeSection = QUESTIONNAIRE_SECTIONS.find(s => s.category === activeCategory);

  return (
    <div ref={topRef} className="space-y-6">
      <V2Surface className="p-4 sm:p-5">
        <div className="flex items-center justify-between text-sm">
          <span className="text-gray-500">Progresso geral: <strong className="text-ink">{answered}</strong> respostas alteradas ({NEUTRAL_BASELINE_VALUE})</span>
          <span className="font-display font-bold text-ink">{progress}%</span>
        </div>
        <div className="mt-3 h-2 overflow-hidden rounded-full bg-paper">
          <div className="h-full bg-acid transition-all duration-300" style={{ width: `${progress}%` }} />
        </div>
        <p className="mt-3 text-xs leading-5 text-gray-500">
          A opção 3 é neutra. Altere apenas quando a afirmação representar melhor ou pior seu comportamento real em partidas competitivas.
        </p>
      </V2Surface>

      <div className="overflow-x-auto">
        <div className="inline-flex gap-1.5 rounded-full border border-gray-100 bg-paper-pure p-1.5 shadow-sm">
          {CATEGORY_ORDER.map((category, index) => (
            <button
              key={category}
              onClick={() => switchCategory(category)}
              className={cn(
                'flex h-10 w-10 items-center justify-center rounded-full font-display text-sm font-bold transition-colors',
                activeCategory === category ? 'bg-ink text-acid shadow-md' : 'text-gray-500 hover:text-ink'
              )}
              title={category}
            >
              {index + 1}
            </button>
          ))}
        </div>
      </div>

      {activeSection && (
        <div className="space-y-5">
          <div className="rounded-3xl border border-gray-100 bg-paper p-5 text-sm leading-6 text-gray-600">
            <strong className="font-display text-ink">{activeSection.category}:</strong> avalie seu comportamento real em partidas competitivas e sob pressão.
          </div>
          {activeSection.questions.map((question, index) => (
            <QuestionCard
              key={question.id}
              questionNumber={index + 1}
              question={question}
              value={answers[question.id] ?? NEUTRAL_BASELINE_VALUE}
              showContext={expandedContext[question.id]}
              onToggleContext={() => setExpandedContext((current) => ({ ...current, [question.id]: !current[question.id] }))}
              onChange={(value) => updateAnswer(question.id, value)}
            />
          ))}
        </div>
      )}

      <div className="space-y-4 pt-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <V2Button onClick={handlePrevious} variant="ghost" disabled={currentIndex === 0}>
            <ArrowLeft className="h-4 w-4" /> Anterior
          </V2Button>
          <span className="text-sm font-bold text-gray-400">{currentIndex + 1} de {CATEGORY_ORDER.length}</span>
          <V2Button onClick={handleNext}>
            {currentIndex === CATEGORY_ORDER.length - 1 ? <CheckCircle2 className="h-4 w-4" /> : null}
            {currentIndex === CATEGORY_ORDER.length - 1 ? 'Ver resultado' : 'Próxima aba'}
            {currentIndex !== CATEGORY_ORDER.length - 1 ? <ArrowRight className="h-4 w-4" /> : null}
          </V2Button>
        </div>
        {onSaveDraft && (
          <div className="flex justify-center border-t border-gray-100 pt-4">
            <V2Button type="button" variant="ghost" onClick={handleSaveDraft}>{saveLabel}</V2Button>
          </div>
        )}
      </div>
    </div>
  );
}
