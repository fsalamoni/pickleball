import React from 'react';
import { Plus, Trash2, BarChart3 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { FORUM_POLL } from '@/modules/clubs/domain/constants';

/**
 * Construtor de enquete (controlado). `value` = { question, options[], multiple,
 * closesAt }. Permite de 2 a FORUM_POLL.MAX_OPTIONS opções, voto único ou
 * múltiplo e data de encerramento opcional.
 */
export default function PollBuilder({ value, onChange }) {
  const options = value.options.length ? value.options : ['', ''];

  const setField = (key, val) => onChange({ ...value, [key]: val });

  const setOption = (index, text) => {
    const next = [...options];
    next[index] = text;
    onChange({ ...value, options: next });
  };

  const addOption = () => {
    if (options.length >= FORUM_POLL.MAX_OPTIONS) return;
    onChange({ ...value, options: [...options, ''] });
  };

  const removeOption = (index) => {
    if (options.length <= FORUM_POLL.MIN_OPTIONS) return;
    onChange({ ...value, options: options.filter((_, i) => i !== index) });
  };

  return (
    <div className="space-y-3 rounded-xl border border-emerald-950/10 bg-secondary/30 p-4">
      <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
        <BarChart3 className="h-4 w-4 text-emerald-700" /> Enquete
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="poll-question">Pergunta</Label>
        <Input
          id="poll-question"
          value={value.question}
          onChange={(e) => setField('question', e.target.value)}
          maxLength={FORUM_POLL.QUESTION_MAX_CHARS}
          placeholder="Ex.: Qual o melhor dia para o torneio interno?"
        />
      </div>

      <div className="space-y-2">
        <Label>Opções</Label>
        {options.map((option, index) => (
          <div key={index} className="flex items-center gap-2">
            <Input
              value={option}
              onChange={(e) => setOption(index, e.target.value)}
              maxLength={FORUM_POLL.OPTION_MAX_CHARS}
              placeholder={`Opção ${index + 1}`}
            />
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-9 w-9 shrink-0 text-slate-400 hover:text-red-600"
              onClick={() => removeOption(index)}
              disabled={options.length <= FORUM_POLL.MIN_OPTIONS}
              aria-label="Remover opção"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        ))}
        {options.length < FORUM_POLL.MAX_OPTIONS && (
          <Button type="button" variant="outline" size="sm" onClick={addOption}>
            <Plus className="mr-1.5 h-4 w-4" /> Adicionar opção
          </Button>
        )}
      </div>

      <div className="flex items-center justify-between gap-3 rounded-lg border border-emerald-950/10 bg-white/60 px-3 py-2">
        <div>
          <div className="text-sm font-medium text-slate-800">Permitir múltiplas escolhas</div>
          <div className="text-xs text-slate-500">Cada participante pode marcar mais de uma opção.</div>
        </div>
        <Switch checked={!!value.multiple} onCheckedChange={(checked) => setField('multiple', checked)} />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="poll-closes">Encerrar automaticamente em (opcional)</Label>
        <Input
          id="poll-closes"
          type="datetime-local"
          value={value.closesAt || ''}
          onChange={(e) => setField('closesAt', e.target.value)}
        />
        <p className="text-xs text-slate-500">Após esta data a votação é encerrada automaticamente.</p>
      </div>
    </div>
  );
}
