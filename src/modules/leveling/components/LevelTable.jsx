import { useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { LEVEL_TABLE } from '@/modules/leveling/data/levels';

export default function LevelTable() {
  const [expandedLevel, setExpandedLevel] = useState(null);

  return (
    <div className="space-y-5">
      <div className="text-center">
        <h2 className="text-2xl font-bold text-slate-900">Tabela de Níveis de Pickleball</h2>
        <p className="mx-auto mt-2 max-w-2xl text-sm text-slate-600">
          Sistema USAP adaptado para a realidade brasileira, definido por comportamentos observáveis em partidas reais.
        </p>
      </div>

      <div
        className="flex h-4 overflow-hidden rounded-full shadow-inner"
        role="img"
        aria-label={`Progressão dos níveis: ${LEVEL_TABLE.map((level) => `${level.name}, USAP ${level.usap}`).join('; ')}`}
      >
        {LEVEL_TABLE.map((level) => (
          <div key={level.id} className={`${level.badgeBg} flex-1`} title={`${level.name} — USAP ${level.usap}`} />
        ))}
      </div>

      <div className="space-y-3">
        {LEVEL_TABLE.map((level) => {
          const isOpen = expandedLevel === level.id;
          return (
            <div key={level.id} className={`overflow-hidden rounded-xl border-2 ${level.borderColor} bg-white`}>
              <button
                type="button"
                onClick={() => setExpandedLevel(isOpen ? null : level.id)}
                className={`flex w-full items-center gap-4 p-4 text-left transition hover:brightness-95 ${level.bgColor}`}
              >
                <div className={`${level.badgeBg} flex h-14 w-14 shrink-0 items-center justify-center rounded-full text-lg font-bold text-white shadow-md`}>
                  {level.badge}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="mb-1 flex flex-wrap items-center gap-2">
                    <span className={`text-lg font-bold sm:text-xl ${level.textColor}`}>{level.name}</span>
                    <span className={`${level.badgeBg} rounded-full px-2 py-0.5 text-xs font-semibold text-white`}>USAP {level.usap}</span>
                  </div>
                  <p className="text-sm text-slate-600">{level.tagline}</p>
                </div>
                <div className="hidden text-right md:block">
                  <p className="text-xs font-medium text-slate-500">Score normalizado</p>
                  <p className={`text-lg font-bold ${level.textColor}`}>{level.normalizedRange}</p>
                </div>
                {isOpen ? <ChevronUp className={level.textColor} /> : <ChevronDown className={level.textColor} />}
              </button>

              {isOpen && (
                <div className="border-t border-slate-100 p-5 sm:p-6">
                  <p className="leading-relaxed text-slate-700">{level.description}</p>
                  <div className="mt-6 grid gap-6 md:grid-cols-3">
                    <InfoList title="Características" color="bg-blue-500" items={level.characteristics} />
                    <div className="space-y-4">
                      <InfoList title="Pontos Fortes" color="bg-emerald-500" items={level.strengths} marker="✓" />
                      <InfoList title="Pontos a Melhorar" color="bg-red-400" items={level.weaknesses} marker="✗" />
                    </div>
                    <div>
                      <h4 className="mb-3 flex items-center gap-2 font-bold text-slate-800">
                        <span className="h-2 w-2 rounded-full bg-orange-500" /> Próximo Passo
                      </h4>
                      <div className="rounded-r-lg border-l-4 border-orange-400 bg-orange-50 p-4 text-sm leading-relaxed text-orange-950">
                        {level.nextStep}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function InfoList({ title, color, items, marker = '•' }) {
  return (
    <div>
      <h4 className="mb-3 flex items-center gap-2 font-bold text-slate-800">
        <span className={`h-2 w-2 rounded-full ${color}`} /> {title}
      </h4>
      <ul className="space-y-2">
        {items.map((item) => (
          <li key={item} className="flex gap-2 text-sm text-slate-700">
            <span className="shrink-0 text-slate-400">{marker}</span>
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
