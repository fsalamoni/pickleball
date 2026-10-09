/**
 * Os blocos de um TREINO: tipo, título, minutos, item da biblioteca ligado e
 * observações. A lista de itens para ligar vem do que a pessoa pode ver; se
 * ela falhar, os blocos continuam editáveis (só sem ligar item novo).
 */
import React from 'react';
import { BLOCK_TYPES, BLOCK_TYPE_LABELS, ITEM_KIND_LABELS } from '@/modules/training/domain/taxonomy';
import { ITEM_LIMITS } from '@/modules/training/domain/trainingItem';
import { useVisibleTrainingItems } from '@/modules/training/hooks/useTrainingItems';
import { V2Button, V2ErrorState, V2Field, V2Input, V2Select, V2Textarea } from '@/v2/ui/primitives';
import { ErroDoCampo, ListEditor } from './editorFields';
import { campoId } from './editorForm';

const novoBloco = () => ({ type: 'tecnica', title: '', duration_min: null, item_id: null, notes: '' });

export default function BlocksEditor({ blocks = [], onChange, identity, currentItemId = null, erro = '', duration = null, onUseTotal }) {
  const visiveis = useVisibleTrainingItems(identity);
  const opcoes = visiveis.items
    .filter((it) => it.id !== currentItemId && it.kind !== 'treino')
    .sort((a, b) => String(a.title).localeCompare(String(b.title), 'pt-BR'));
  const total = blocks.reduce((s, b) => s + (Number(b?.duration_min) || 0), 0);

  return (
    <div className="space-y-3">
      {visiveis.isError && (
        <V2ErrorState
          inline
          title="A biblioteca não carregou inteira"
          description="Os blocos seguem editáveis; só a lista de itens para ligar pode estar incompleta."
          onRetry={visiveis.refetch}
        />
      )}
      <ListEditor
        id={campoId('blocks')}
        items={blocks}
        onChange={onChange}
        max={ITEM_LIMITS.blocks}
        addLabel="Adicionar bloco"
        makeNew={novoBloco}
        itemLabel="bloco"
        renderItem={(b, i, set) => {
          const ligado = b.item_id ? visiveis.byId[b.item_id] : null;
          return (
            <div className="grid gap-3 sm:grid-cols-2">
              <V2Field label="Tipo" htmlFor={`bloco-${i}-tipo`}>
                <V2Select
                  id={`bloco-${i}-tipo`}
                  value={b.type || 'tecnica'}
                  onChange={(e) => set({ ...b, type: e.target.value })}
                  options={BLOCK_TYPES.map((t) => ({ value: t, label: BLOCK_TYPE_LABELS[t] }))}
                />
              </V2Field>
              <V2Field label="Minutos" htmlFor={`bloco-${i}-min`}>
                <V2Input
                  id={`bloco-${i}-min`}
                  type="number"
                  inputMode="numeric"
                  min={0}
                  max={240}
                  value={b.duration_min ?? ''}
                  onChange={(e) => set({ ...b, duration_min: e.target.value === '' ? null : Number(e.target.value) })}
                />
              </V2Field>
              <V2Field label="Título do bloco" htmlFor={`bloco-${i}-titulo`} hint="Bloco sem título não é salvo." className="sm:col-span-2">
                <V2Input
                  id={`bloco-${i}-titulo`}
                  maxLength={ITEM_LIMITS.blockTitle}
                  value={b.title || ''}
                  onChange={(e) => set({ ...b, title: e.target.value })}
                  placeholder="Ex.: Dinks cruzados"
                />
              </V2Field>
              <V2Field label="Item da biblioteca (opcional)" htmlFor={`bloco-${i}-item`} className="sm:col-span-2">
                <V2Select
                  id={`bloco-${i}-item`}
                  value={b.item_id || ''}
                  disabled={visiveis.isLoading}
                  onChange={(e) => {
                    const id = e.target.value || null;
                    const it = id ? visiveis.byId[id] : null;
                    set({ ...b, item_id: id, title: b.title || it?.title || '' });
                  }}
                >
                  <option value="">{visiveis.isLoading ? 'Carregando a biblioteca…' : 'Sem item ligado'}</option>
                  {b.item_id && !ligado && <option value={b.item_id}>Item ligado (fora da sua biblioteca)</option>}
                  {opcoes.map((it) => (
                    <option key={it.id} value={it.id}>{it.title} · {ITEM_KIND_LABELS[it.kind] || it.kind}</option>
                  ))}
                </V2Select>
              </V2Field>
              <V2Field label="Observações" htmlFor={`bloco-${i}-notas`} className="sm:col-span-2">
                <V2Textarea
                  id={`bloco-${i}-notas`}
                  rows={2}
                  maxLength={ITEM_LIMITS.blockNotes}
                  value={b.notes || ''}
                  onChange={(e) => set({ ...b, notes: e.target.value })}
                />
              </V2Field>
            </div>
          );
        }}
      />
      <ErroDoCampo id={`${campoId('blocks')}-erro`} erro={erro} />
      {total > 0 && (
        <p className="flex flex-wrap items-center gap-2 text-sm text-gray-500">
          Soma dos blocos: <strong className="text-ink">{total} min</strong>
          {Number(duration) !== total && onUseTotal && (
            <V2Button type="button" variant="ghost" size="sm" onClick={() => onUseTotal(total)}>Usar como duração total</V2Button>
          )}
        </p>
      )}
    </div>
  );
}
