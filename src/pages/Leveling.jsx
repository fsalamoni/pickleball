import React, { useMemo, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Award, ChevronRight, RotateCcw } from 'lucide-react';
import { LEVEL_TABLE, getLevelByCode } from '@/modules/leveling/data/levels';
import { QUESTIONNAIRE, LIKERT_OPTIONS, calculateLevel, applyBiasMitigation } from '@/modules/leveling/domain/questionnaire';

export default function Leveling() {
  const [tab, setTab] = useState('tabela');
  return (
    <div className="max-w-4xl mx-auto space-y-5">
      <Card>
        <CardContent className="p-5">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <h1 className="text-2xl font-bold arena-heading flex items-center gap-2">
              <Award className="w-6 h-6 text-emerald-600" /> Nivelamento (CBPE / USAP)
            </h1>
            <div className="flex gap-2">
              <Button size="sm" variant={tab === 'tabela' ? 'default' : 'outline'} onClick={() => setTab('tabela')}>Tabela</Button>
              <Button size="sm" variant={tab === 'formulario' ? 'default' : 'outline'} onClick={() => setTab('formulario')}>Formulário</Button>
            </div>
          </div>
          <p className="text-sm text-slate-600 mt-2">
            Sistema de nivelamento adaptado ao Brasil, alinhado ao DUPR/USAP. Cinco níveis principais com indicadores objetivos de domínio técnico, tático, físico e de regras.
          </p>
        </CardContent>
      </Card>

      {tab === 'tabela' ? <LevelTable /> : <LevelQuestionnaire />}
    </div>
  );
}

function LevelTable() {
  return (
    <div className="space-y-3">
      {LEVEL_TABLE.map((l) => (
        <Card key={l.code}>
          <CardContent className="p-5">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <h3 className={`text-lg font-semibold border rounded-md px-3 py-1 ${l.color}`}>{l.name}</h3>
              <Badge variant="secondary">USAP {l.usap_range[0].toFixed(1)} – {l.usap_range[1].toFixed(1)}</Badge>
            </div>
            <p className="mt-2 text-sm text-slate-700">{l.summary}</p>
            <ul className="mt-3 space-y-1 text-sm text-slate-600 list-disc pl-5">
              {l.abilities.map((a, i) => <li key={i}>{a}</li>)}
            </ul>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function LevelQuestionnaire() {
  const [answers, setAnswers] = useState({});
  const [result, setResult] = useState(null);

  const totalQuestions = useMemo(
    () => QUESTIONNAIRE.reduce((s, sec) => s + sec.questions.length, 0),
    [],
  );
  const answered = Object.keys(answers).length;
  const progress = totalQuestions === 0 ? 0 : Math.round((answered / totalQuestions) * 100);

  function set(id, value) {
    setAnswers((a) => ({ ...a, [id]: value }));
  }

  function compute() {
    const r = calculateLevel(answers);
    const adjusted = applyBiasMitigation(answers, r.levelCode);
    setResult({ ...r, levelCode: adjusted, level: getLevelByCode(adjusted) });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function reset() {
    setAnswers({});
    setResult(null);
  }

  if (result) {
    return (
      <Card>
        <CardContent className="p-6 text-center">
          <Award className="w-12 h-12 mx-auto text-emerald-600" />
          <h2 className="mt-3 text-xl font-bold">Seu nível recomendado</h2>
          <div className={`mt-3 inline-block text-2xl font-bold border rounded-lg px-4 py-2 ${result.level?.color || ''}`}>
            {result.level?.name || result.levelCode}
          </div>
          <p className="mt-2 text-sm text-slate-600">
            Pontuação ponderada: <strong>{result.score.toFixed(2)}</strong> / 5,00
          </p>
          {result.level && <p className="mt-3 text-sm text-slate-700 max-w-xl mx-auto">{result.level.summary}</p>}
          <div className="mt-4 text-left max-w-md mx-auto">
            <h3 className="font-semibold text-sm">Detalhamento por área</h3>
            <ul className="mt-1 text-sm text-slate-700">
              {result.breakdown.map((b) => (
                <li key={b.section} className="flex justify-between border-b py-1">
                  <span>{b.section}</span>
                  <span className="font-mono">{b.average.toFixed(2)}</span>
                </li>
              ))}
            </ul>
          </div>
          <p className="mt-4 text-xs text-slate-500">
            Este resultado é uma estimativa. Confirme em quadra com um instrutor ou em torneios oficiais.
          </p>
          <Button className="mt-4" variant="outline" onClick={reset}>
            <RotateCcw className="w-4 h-4 mr-1" /> Refazer
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center justify-between text-sm">
            <span>Progresso: {answered}/{totalQuestions}</span>
            <span className="font-semibold">{progress}%</span>
          </div>
          <div className="mt-2 h-2 bg-slate-100 rounded overflow-hidden">
            <div className="h-full bg-emerald-500" style={{ width: `${progress}%` }} />
          </div>
        </CardContent>
      </Card>

      {QUESTIONNAIRE.map((section) => (
        <Card key={section.section}>
          <CardContent className="p-5">
            <h3 className="font-semibold text-slate-900">{section.section}</h3>
            <div className="mt-3 space-y-4">
              {section.questions.map((q) => (
                <div key={q.id}>
                  <p className="text-sm text-slate-800">{q.text}</p>
                  <div className="mt-2 flex flex-wrap gap-1">
                    {LIKERT_OPTIONS.map((o) => (
                      <Button
                        key={o.value}
                        size="sm"
                        variant={answers[q.id] === o.value ? 'default' : 'outline'}
                        onClick={() => set(q.id, o.value)}
                      >
                        {o.value} · {o.label}
                      </Button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      ))}

      <div className="flex justify-end">
        <Button onClick={compute} disabled={answered < totalQuestions}>
          Calcular meu nível <ChevronRight className="w-4 h-4 ml-1" />
        </Button>
      </div>
    </div>
  );
}
