import { useMemo, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, CheckCircle2, ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import LevelingResultCard from './LevelingResultCard';
import {
  CATEGORY_ORDER,
  INITIAL_LEVELING_ANSWERS,
  LIKERT_OPTIONS,
  NEUTRAL_BASELINE_VALUE,
  QUESTIONNAIRE_SECTIONS,
  calculateAssessment,
  countNonNeutralAnswers,
} from '@/modules/leveling/domain/questionnaire';

const TOTAL_QUESTIONS = QUESTIONNAIRE_SECTIONS.reduce((sum, section) => sum + section.questions.length, 0);

export default function LevelingQuestionnaire({
  initialAnswers,
  initialResult = null,
  onComplete,
  onSaveDraft,
  saveLabel = 'Salvar resultado',
}) {
  const mergedInitialAnswers = useMemo(
    () => ({ ...INITIAL_LEVELING_ANSWERS, ...(initialAnswers || {}) }),
    [initialAnswers],
  );
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
    return <div ref={topRef}><LevelingResultCard result={result} onRestart={restart} /></div>;
  }

  return (
    <div ref={topRef} className="space-y-5">
      <Card className="p-4">
        <div className="flex items-center justify-between text-sm">
          <span>Progresso geral: {answered} respostas diferentes do padrão neutro ({NEUTRAL_BASELINE_VALUE})</span>
          <span className="font-semibold">{progress}%</span>
        </div>
        <div className="mt-2 h-2 overflow-hidden rounded bg-paper">
          <div className="h-full bg-green-500" style={{ width: `${progress}%` }} />
        </div>
        <p className="mt-2 text-xs text-gray-500">
          A opção 3 é neutra. Altere apenas quando a afirmação representar melhor ou pior seu comportamento real em partidas competitivas.
        </p>
      </Card>

      <Tabs value={activeCategory} onValueChange={switchCategory}>
        <TabsList className="grid h-auto w-full grid-cols-5 gap-1 lg:grid-cols-10">
          {CATEGORY_ORDER.map((category, index) => (
            <TabsTrigger key={category} value={category} title={category} className="text-xs">
              {index + 1}
            </TabsTrigger>
          ))}
        </TabsList>

        {QUESTIONNAIRE_SECTIONS.map((section) => (
          <TabsContent key={section.category} value={section.category} className="mt-5 space-y-4">
            <div className="rounded border-l-4 border-blue-500 bg-blue-50 p-4 text-sm text-blue-900">
              <strong>{section.category}:</strong> avalie seu comportamento real em partidas competitivas e sob pressão.
            </div>
            {section.questions.map((question, index) => (
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
          </TabsContent>
        ))}
      </Tabs>

      <div className="space-y-4">
        <div className="flex items-center justify-between gap-3">
          <Button onClick={handlePrevious} variant="outline" disabled={currentIndex === 0}>
            <ArrowLeft className="mr-2 h-4 w-4" /> Anterior
          </Button>
          <span className="text-center text-sm text-gray-500">{currentIndex + 1} de {CATEGORY_ORDER.length}</span>
          <Button onClick={handleNext} className="bg-ink hover:bg-ink-light">
            {currentIndex === CATEGORY_ORDER.length - 1 ? <CheckCircle2 className="mr-2 h-4 w-4" /> : null}
            {currentIndex === CATEGORY_ORDER.length - 1 ? 'Ver resultado' : 'Próxima aba'}
            {currentIndex !== CATEGORY_ORDER.length - 1 ? <ArrowRight className="ml-2 h-4 w-4" /> : null}
          </Button>
        </div>
        {onSaveDraft && (
          <div className="flex justify-center">
            <Button type="button" variant="ghost" onClick={handleSaveDraft}>{saveLabel}</Button>
          </div>
        )}
      </div>
    </div>
  );
}

function QuestionCard({ questionNumber, question, value, showContext, onToggleContext, onChange }) {
  return (
    <Card className="p-4 transition hover:shadow-md sm:p-5">
      <div className="mb-4">
        <div className="mb-2 flex flex-wrap items-center gap-2">
          <span className="rounded-full bg-ink px-3 py-1 text-sm font-semibold text-white">Q{questionNumber}</span>
          <span className="text-xs font-medium uppercase text-gray-500">{question.category}</span>
        </div>
        <p className="font-semibold leading-relaxed text-ink">{question.statement}</p>
        <button type="button" onClick={onToggleContext} className="mt-2 flex items-center gap-2 text-sm text-blue-700 hover:text-blue-800">
          <ChevronDown className={`h-4 w-4 transition-transform ${showContext ? 'rotate-180' : ''}`} />
          {showContext ? 'Ocultar' : 'Ver'} comportamento observável
        </button>
        {showContext && <div className="mt-3 rounded border-l-4 border-blue-500 bg-blue-50 p-3 text-sm text-blue-900">{question.context}</div>}
      </div>

      <div className="grid gap-2 sm:grid-cols-5">
        {LIKERT_OPTIONS.map((option) => (
          <button
            type="button"
            key={option.value}
            onClick={() => onChange(option.value)}
            className={`rounded-lg border-2 p-3 text-center transition ${value === option.value ? `${getColorClass(option.value)} ring-2 ring-offset-2` : 'border-gray-200 bg-white hover:border-gray-200'}`}
          >
            <div className="text-lg font-bold">{option.value}</div>
            <div className="mt-1 text-xs font-medium text-gray-600">{option.label}</div>
            <div className="mt-0.5 text-xs text-gray-500">{option.sublabel}</div>
          </button>
        ))}
      </div>
    </Card>
  );
}

function getColorClass(value) {
  if (value === 1) return 'border-red-300 bg-red-100';
  if (value === 2) return 'border-orange-300 bg-orange-100';
  if (value === 3) return 'border-yellow-300 bg-yellow-100';
  if (value === 4) return 'border-lime-300 bg-lime-100';
  if (value === 5) return 'border-green-300 bg-green-100';
  return 'border-gray-200 bg-paper';
}
