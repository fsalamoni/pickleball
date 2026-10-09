/**
 * "Criar com IA": a plataforma não chama IA nenhuma. Ela monta o PEDIDO
 * (`buildAiPrompt`) para a pessoa colar na IA que já usa e lê de volta o JSON
 * (`parseItemsJson`, com `fromAi` — mídia e link inventados são descartados).
 * O que volta preenche o formulário e o item fica marcado `ai_assisted`; quem
 * publica continua sendo a pessoa, e por isso ela revisa tudo antes.
 */
import React, { useState } from 'react';
import { ClipboardPaste, Copy, Sparkles, TriangleAlert } from 'lucide-react';
import { buildAiPrompt, parseItemsJson } from '@/modules/training/domain/aiTemplate';
import {
  EQUIPMENT, EQUIPMENT_LABELS, ITEM_KINDS, ITEM_KIND_LABELS, PLACES, PLACE_LABELS,
} from '@/modules/training/domain/taxonomy';
import { useClipboard } from '@/core/lib/useClipboard';
import { V2Button, V2Field, V2Input, V2Select, V2Textarea } from '@/v2/ui/primitives';
import { Avisos, MultiChips, SkillPicker } from './editorFields';
import { formatLevel, levelOptions } from './editorForm';

const NIVEIS = levelOptions();

export default function AiAssistPanel({ form, onApply }) {
  const [aberto, setAberto] = useState(false);
  const [pedido, setPedido] = useState(() => ({
    kind: form?.kind || 'drill',
    skills: form?.skills || [],
    level: form?.level_min ?? '',
    players: form?.players_max ?? form?.players_min ?? '',
    minutes: form?.duration_min ?? '',
    place: form?.place?.[0] || '',
    equipment: form?.equipment || [],
    notes: '',
  }));
  const [resposta, setResposta] = useState('');
  const [lido, setLido] = useState(null);
  const [aplicado, setAplicado] = useState(false);
  const { copy, copied } = useClipboard();

  const set = (k, v) => setPedido((p) => ({ ...p, [k]: v }));
  const numero = (v) => (v === '' || v === null || v === undefined ? null : Number(v));

  const copiarPedido = () => copy(
    buildAiPrompt({
      kind: pedido.kind,
      skills: pedido.skills,
      level: numero(pedido.level),
      players: numero(pedido.players),
      minutes: numero(pedido.minutes),
      place: pedido.place ? PLACE_LABELS[pedido.place].toLowerCase() : '',
      equipment: pedido.equipment.map((e) => EQUIPMENT_LABELS[e].toLowerCase()),
      notes: pedido.notes,
    }),
    'Pedido copiado. Cole na sua IA e traga a resposta.',
    'Não deu para copiar. Selecione e copie o pedido à mão.',
  );

  const ler = () => {
    setAplicado(false);
    setLido(parseItemsJson(resposta, { fromAi: true }));
  };

  const aplicar = (onlyEmpty) => {
    const primeiro = lido?.items?.[0];
    if (!primeiro) return;
    onApply(primeiro.value, { onlyEmpty });
    setAplicado(true);
  };

  const primeiro = lido?.ok ? lido.items[0] : null;
  const errosDoItem = primeiro ? Object.values(primeiro.errors || {}) : [];

  return (
    <section
      data-dica="treino-editor-ia"
      aria-labelledby="treino-ia-t"
      className="rounded-4xl border border-gray-100 bg-paper-pure p-5 shadow-organic-sm sm:p-8"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 id="treino-ia-t" className="flex items-center gap-2 font-display text-xl font-bold text-ink">
            <Sparkles className="h-5 w-5" aria-hidden="true" /> Criar com IA
          </h2>
          <p className="mt-1 text-sm text-gray-500">
            Monte o pedido aqui, cole na IA que você já usa e traga a resposta de volta. Você revisa tudo antes de publicar.
          </p>
        </div>
        <V2Button type="button" variant="secondary" size="sm" aria-expanded={aberto} onClick={() => setAberto((v) => !v)}>
          {aberto ? 'Fechar' : 'Usar a IA'}
        </V2Button>
      </div>

      {aberto && (
        <div className="mt-6 space-y-6">
          <div className="space-y-4">
            <h3 className="text-sm font-bold text-ink">1. O que pedir</h3>
            <div className="grid gap-3 sm:grid-cols-2">
              <V2Field label="Tipo" htmlFor="ia-tipo">
                <V2Select
                  id="ia-tipo"
                  value={pedido.kind}
                  onChange={(e) => set('kind', e.target.value)}
                  options={ITEM_KINDS.map((k) => ({ value: k, label: ITEM_KIND_LABELS[k] }))}
                />
              </V2Field>
              <V2Field label="Nível" htmlFor="ia-nivel">
                <V2Select id="ia-nivel" value={pedido.level === '' ? '' : String(pedido.level)} onChange={(e) => set('level', e.target.value)}>
                  <option value="">A definir</option>
                  {NIVEIS.map((n) => <option key={n} value={String(n)}>{formatLevel(n)}</option>)}
                </V2Select>
              </V2Field>
              <V2Field label="Jogadores" htmlFor="ia-jogadores">
                <V2Input id="ia-jogadores" type="number" inputMode="numeric" min={1} max={8} value={pedido.players} onChange={(e) => set('players', e.target.value)} />
              </V2Field>
              <V2Field label="Minutos" htmlFor="ia-minutos">
                <V2Input id="ia-minutos" type="number" inputMode="numeric" min={1} max={240} value={pedido.minutes} onChange={(e) => set('minutes', e.target.value)} />
              </V2Field>
              <V2Field label="Local" htmlFor="ia-local">
                <V2Select id="ia-local" value={pedido.place} onChange={(e) => set('place', e.target.value)}>
                  <option value="">A definir</option>
                  {PLACES.map((p) => <option key={p} value={p}>{PLACE_LABELS[p]}</option>)}
                </V2Select>
              </V2Field>
            </div>
            <SkillPicker id="ia-habilidades" value={pedido.skills} onChange={(v) => set('skills', v)} max={3} />
            <MultiChips
              id="ia-equipamento"
              legend="Equipamento"
              options={EQUIPMENT.map((e) => ({ value: e, label: EQUIPMENT_LABELS[e] }))}
              value={pedido.equipment}
              onChange={(v) => set('equipment', v)}
            />
            <V2Field label="Observações" htmlFor="ia-notas" hint="O que a IA precisa saber: o público, a dificuldade, o que evitar.">
              <V2Textarea id="ia-notas" rows={3} maxLength={500} value={pedido.notes} onChange={(e) => set('notes', e.target.value)} />
            </V2Field>
            <V2Button type="button" onClick={copiarPedido}>
              <Copy className="h-4 w-4" aria-hidden="true" /> {copied ? 'Pedido copiado' : 'Copiar o pedido'}
            </V2Button>
          </div>

          <div className="space-y-3">
            <h3 className="text-sm font-bold text-ink">2. Cole a resposta da IA</h3>
            <V2Field label="Resposta (o JSON)" htmlFor="ia-resposta" hint="Pode colar a resposta inteira: o texto em volta do JSON é ignorado.">
              <V2Textarea
                id="ia-resposta"
                rows={6}
                value={resposta}
                onChange={(e) => { setResposta(e.target.value); setLido(null); }}
                className="font-mono text-xs"
              />
            </V2Field>
            <V2Button type="button" variant="secondary" onClick={ler} disabled={!resposta.trim()}>
              <ClipboardPaste className="h-4 w-4" aria-hidden="true" /> Ler a resposta
            </V2Button>

            {lido && !lido.ok && <p role="alert" className="text-sm font-medium text-red-500">{lido.error}</p>}

            {primeiro && (
              <div className="space-y-3 rounded-3xl border border-gray-100 bg-paper p-4">
                <p className="text-sm text-ink">
                  <strong>{primeiro.value.title || 'Item sem nome'}</strong> · {ITEM_KIND_LABELS[primeiro.value.kind]} · ficha {primeiro.quality.score} de {primeiro.quality.total}
                </p>
                {lido.items.length > 1 && (
                  <p className="text-xs text-gray-500">Vieram {lido.items.length} itens; usei o primeiro. Para vários de uma vez, use a importação da biblioteca.</p>
                )}
                {errosDoItem.length > 0 && (
                  <ul className="space-y-1 text-xs text-red-600">
                    {errosDoItem.map((e) => <li key={e}>{e}</li>)}
                  </ul>
                )}
                <Avisos itens={primeiro.warnings} />
                <div className="flex flex-wrap gap-2">
                  <V2Button type="button" size="sm" onClick={() => aplicar(false)}>Preencher tudo</V2Button>
                  <V2Button type="button" variant="secondary" size="sm" onClick={() => aplicar(true)}>Só os campos vazios</V2Button>
                </div>
                {aplicado && (
                  <p role="status" className="flex gap-2 text-sm font-medium text-amber-800">
                    <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                    Preenchido. Revise cada parte antes de salvar: a IA erra, inventa e não conhece a sua quadra.
                  </p>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
