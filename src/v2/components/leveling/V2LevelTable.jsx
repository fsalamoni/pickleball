import React, { useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { LEVEL_TABLE } from '@/modules/leveling/data/levels';
import { V2Surface } from '@/v2/ui/primitives';
import { cn } from '@/core/lib/utils';

function InfoList({ title, dotTone, items, marker = '•' }) {
  return (
    <div>
      <h4 className="mb-3 flex items-center gap-2 font-display text-sm font-bold text-ink">
        <span className={cn('h-2 w-2 rounded-full', dotTone)} /> {title}
      </h4>
      <ul className="space-y-2">
        {items.map((item) => (
          <li key={item} className="flex items-start gap-2 text-sm leading-6 text-gray-600">
            <span className="mt-0.5 shrink-0 font-bold text-gray-400">{marker}</span>
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default function V2LevelTable() {
  const [expandedLevel, setExpandedLevel] = useState(null);

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h2 className="font-display text-2xl font-bold text-ink sm:text-3xl">Tabela de Níveis de Pickleball</h2>
        <p className="mx-auto mt-3 max-w-2xl text-sm leading-6 text-gray-500">
          Sistema USAP adaptado para a realidade brasileira, definido por comportamentos observáveis em partidas reais.
        </p>
      </div>

      <div
        className="flex h-3 overflow-hidden rounded-full bg-paper"
        role="img"
        aria-label={`Progressão dos níveis`}
      >
        {LEVEL_TABLE.map((level) => (
          <div key={level.id} className={cn('flex-1', level.id === 'iniciante' ? 'bg-ink/10' : level.id === 'novato' ? 'bg-ink/20' : level.id === 'intermediario' ? 'bg-acid/60' : level.id === 'avancado' ? 'bg-acid/80' : 'bg-acid')} title={`${level.name} — USAP ${level.usap}`} />
        ))}
      </div>

      <div className="space-y-3">
        {LEVEL_TABLE.map((level) => {
          const isOpen = expandedLevel === level.id;
          return (
            <V2Surface key={level.id} className="overflow-hidden p-0 transition-shadow hover:shadow-md">
              <button
                type="button"
                onClick={() => setExpandedLevel(isOpen ? null : level.id)}
                className="flex w-full items-center gap-4 p-5 text-left sm:p-6"
              >
                <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-ink text-xl font-bold text-acid shadow-organic">
                  {level.badge}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="mb-1 flex flex-wrap items-center gap-2">
                    <span className="font-display text-xl font-bold text-ink sm:text-2xl">{level.name}</span>
                    <span className="rounded-full bg-paper px-3 py-0.5 text-xs font-bold text-gray-500">USAP {level.usap}</span>
                  </div>
                  <p className="text-sm text-gray-500">{level.tagline}</p>
                </div>
                <div className="hidden text-right md:block">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Score normalizado</p>
                  <p className="mt-1 font-display text-xl font-bold text-ink">{level.normalizedRange}</p>
                </div>
                <div className="ml-2 flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-gray-400 transition-colors hover:bg-paper hover:text-ink">
                  {isOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                </div>
              </button>

              {isOpen && (
                <div className="border-t border-gray-100 p-5 sm:p-6">
                  <p className="rounded-3xl border border-gray-100 bg-paper p-5 text-sm leading-relaxed text-gray-600">
                    {level.description}
                  </p>
                  <div className="mt-6 grid gap-8 md:grid-cols-3">
                    <InfoList title="Características" dotTone="bg-ink" items={level.characteristics} />
                    <div className="space-y-6">
                      <InfoList title="Pontos Fortes" dotTone="bg-emerald-500" items={level.strengths} marker="✓" />
                      <InfoList title="Pontos a Melhorar" dotTone="bg-red-400" items={level.weaknesses} marker="✗" />
                    </div>
                    <div>
                      <h4 className="mb-3 flex items-center gap-2 font-display text-sm font-bold text-ink">
                        <span className="h-2 w-2 rounded-full bg-acid" /> Próximo Passo
                      </h4>
                      <div className="rounded-2xl border border-acid/30 bg-acid/10 p-4 text-sm leading-relaxed text-ink">
                        {level.nextStep}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </V2Surface>
          );
        })}
      </div>
    </div>
  );
}
