/**
 * O formulário do item, por seções — só as que valem para o tipo escolhido
 * (`secoesVisiveis`), cada uma com a linha do porquê. O formulário é o próprio
 * item (`formFromItem`); quem decide o que é gravado é `normalizeItemInput`.
 * Todas as seções ficam ABERTAS: o erro de um campo nunca fica escondido
 * dentro de algo recolhido.
 */
import React from 'react';
import { Plus } from 'lucide-react';
import { cueWarnings, positioningWarnings } from '@/modules/training/domain/aiTemplate';
import {
  EQUIPMENT, EQUIPMENT_LABELS, METRIC_TYPES, METRIC_TYPE_LABELS, MOTOR_ABILITIES, MOTOR_ABILITY_LABELS,
  PLACES, PLACE_LABELS, PRACTICE_MODES, PRACTICE_MODE_LABELS, STUDY_TYPES, STUDY_TYPE_LABELS, TECHNIQUE_PARTS,
  TECHNIQUE_PART_LABELS, rpeLabel,
} from '@/modules/training/domain/taxonomy';
import { ITEM_LIMITS } from '@/modules/training/domain/trainingItem';
import { V2Button, V2Field, V2Input, V2Select, V2Textarea } from '@/v2/ui/primitives';
import BlocksEditor from './BlocksEditor';
import DiagramEditor from './DiagramEditor';
import MediaInput from './MediaInput';
import { Avisos, EditorSection, ErroDoCampo, ListEditor, MultiChips, SkillPicker } from './editorFields';
import {
  campoId, campoVisivel, formatLevel, levelOptions, secaoPreenchida, secoesVisiveis,
} from './editorForm';
import { t } from '@/core/i18n';

const NIVEIS = levelOptions();
const numOuNulo = (v) => (v === '' ? null : Number(v));

/** Liga o campo ao seu erro (leitor de tela anuncia o erro junto do campo). */
const comErro = (key, erros) => (erros[key]
  ? { 'aria-invalid': true, 'aria-describedby': `${campoId(key)}-erro` }
  : {});

export default function TrainingItemForm({
  form, setField, errors = {}, identity, settings, currentItemId = null, onUploadBusy, onUploaded,
}) {
  const kind = form.kind;
  const ve = (campo) => campoVisivel(kind, campo, form);
  const erro = (key) => errors[key] || '';
  const setIn = (key, sub, v) => setField(key, { ...form[key], [sub]: v });

  const campoTexto = ({ key, label, max, rows = 0, hint, placeholder, required }) => {
    const Comp = rows ? V2Textarea : V2Input;
    return (
      <V2Field label={label} htmlFor={campoId(key)} hint={hint} error={erro(key)} required={required}>
        <Comp
          id={campoId(key)}
          {...(rows ? { rows } : {})}
          maxLength={max}
          placeholder={placeholder}
          value={form[key] ?? ''}
          onChange={(e) => setField(key, e.target.value)}
          {...comErro(key, errors)}
        />
      </V2Field>
    );
  };

  const conteudo = {
    basico: () => (
      <>
        {campoTexto({ key: 'title', label: t('Nome'), max: ITEM_LIMITS.title, required: true, placeholder: t('Ex.: Dink cruzado no pé de dentro') })}
        {campoTexto({ key: 'summary', label: t('Resumo'), max: ITEM_LIMITS.summary, rows: 2, required: true, hint: t('Uma ou duas frases: o que é e para quem serve.') })}
        {campoTexto({ key: 'objective', label: t('Objetivo'), max: ITEM_LIMITS.objective, rows: 2, hint: t('Uma frase que dá para observar: "Ao final, o atleta consegue…".') })}
        <SkillPicker id={campoId('skills')} value={form.skills} onChange={(v) => setField('skills', v)} max={ITEM_LIMITS.skills} />
        <div className="grid gap-3 sm:grid-cols-2">
          <V2Field label={t('Nível mínimo')} htmlFor={campoId('level_min')}>
            <V2Select id={campoId('level_min')} value={form.level_min ?? ''} onChange={(e) => setField('level_min', numOuNulo(e.target.value))}>
              <option value="">{t('Qualquer')}</option>
              {NIVEIS.map((n) => <option key={n} value={n}>{formatLevel(n)}</option>)}
            </V2Select>
          </V2Field>
          <V2Field label={t('Nível máximo')} htmlFor={campoId('level_max')}>
            <V2Select id={campoId('level_max')} value={form.level_max ?? ''} onChange={(e) => setField('level_max', numOuNulo(e.target.value))}>
              <option value="">{t('Qualquer')}</option>
              {NIVEIS.map((n) => <option key={n} value={n}>{formatLevel(n)}</option>)}
            </V2Select>
          </V2Field>
          {ve('players_min') && (
            <>
              <V2Field label={t('Jogadores (mínimo)')} htmlFor={campoId('players_min')}>
                <V2Input id={campoId('players_min')} type="number" inputMode="numeric" min={1} max={8} value={form.players_min ?? ''} onChange={(e) => setField('players_min', numOuNulo(e.target.value))} />
              </V2Field>
              <V2Field label={t('Jogadores (máximo)')} htmlFor={campoId('players_max')}>
                <V2Input id={campoId('players_max')} type="number" inputMode="numeric" min={1} max={8} value={form.players_max ?? ''} onChange={(e) => setField('players_max', numOuNulo(e.target.value))} />
              </V2Field>
            </>
          )}
          <V2Field label={t('Duração (minutos)')} htmlFor={campoId('duration_min')}>
            <V2Input id={campoId('duration_min')} type="number" inputMode="numeric" min={0} max={240} value={form.duration_min ?? ''} onChange={(e) => setField('duration_min', numOuNulo(e.target.value))} />
          </V2Field>
          {ve('intensity') && (
            <V2Field label={t('Esforço (0 a 10)')} htmlFor={campoId('intensity')} hint={t('Quanto o exercício cansa, na escala de esforço percebido.')}>
              <V2Select id={campoId('intensity')} value={form.intensity ?? ''} onChange={(e) => setField('intensity', numOuNulo(e.target.value))}>
                <option value="">{t('Não informar')}</option>
                {Array.from({ length: 11 }, (_, n) => <option key={n} value={n}>{n} · {rpeLabel(n)}</option>)}
              </V2Select>
            </V2Field>
          )}
          {ve('practice_mode') && (
            <V2Field label={t('Como a prática é organizada')} htmlFor={campoId('practice_mode')} className="sm:col-span-2">
              <V2Select id={campoId('practice_mode')} value={form.practice_mode || ''} onChange={(e) => setField('practice_mode', e.target.value)}>
                <option value="">{t('Não informar')}</option>
                {PRACTICE_MODES.map((m) => <option key={m} value={m}>{t(PRACTICE_MODE_LABELS[m])}</option>)}
              </V2Select>
            </V2Field>
          )}
        </div>
        {ve('place') && (
          <MultiChips
            id={campoId('place')}
            legend={t('Onde dá para fazer')}
            options={PLACES.map((p) => ({ value: p, label: t(PLACE_LABELS[p]) }))}
            value={form.place}
            onChange={(v) => setField('place', v)}
          />
        )}
        {ve('equipment') && (
          <MultiChips
            id={campoId('equipment')}
            legend={t('Equipamento')}
            options={EQUIPMENT.map((e) => ({ value: e, label: t(EQUIPMENT_LABELS[e]) }))}
            value={form.equipment}
            onChange={(v) => setField('equipment', v)}
            max={ITEM_LIMITS.equipment}
          />
        )}
      </>
    ),

    como: () => (
      <>
        {ve('setup') && campoTexto({ key: 'setup', label: t('Montagem'), max: ITEM_LIMITS.setup, rows: 3, hint: t('Onde cada jogador fica, onde vão cones e alvos, quem começa.') })}
        {ve('steps') && (
          <div className="space-y-2">
            <p className="text-sm font-semibold text-ink">{t('Passo a passo')}</p>
            <p className="text-xs text-gray-500">{t('Um verbo por passo, na ordem. O último diz quando trocar de lado ou de papel.')}</p>
            <ListEditor
              id={campoId('steps')}
              items={form.steps}
              onChange={(v) => setField('steps', v)}
              max={ITEM_LIMITS.steps}
              addLabel={t('Adicionar passo')}
              makeNew={() => ''}
              itemLabel={t('passo')}
              renderItem={(s, i, set) => (
                <V2Textarea
                  rows={2}
                  aria-label={t('Passo {n}', { n: i + 1 })}
                  maxLength={ITEM_LIMITS.step}
                  value={s}
                  onChange={(e) => set(e.target.value)}
                  className="min-h-[4rem]"
                />
              )}
            />
            <ErroDoCampo id={`${campoId('steps')}-erro`} erro={erro('steps')} />
          </div>
        )}
        {ve('cues') && (
          <div className="space-y-2">
            <p className="text-sm font-semibold text-ink">{t('Dicas curtas')}</p>
            <p className="text-xs text-gray-500">{t('Até 8 palavras, apontando para fora do corpo: a bola, o alvo, a raquete.')}</p>
            <ListEditor
              id={campoId('cues')}
              items={form.cues}
              onChange={(v) => setField('cues', v)}
              max={ITEM_LIMITS.cues}
              addLabel={t('Adicionar dica')}
              makeNew={() => ''}
              itemLabel={t('dica')}
              renderItem={(c, i, set) => (
                <V2Input aria-label={t('Dica {n}', { n: i + 1 })} maxLength={ITEM_LIMITS.cue} value={c} onChange={(e) => set(e.target.value)} />
              )}
            />
            <Avisos itens={cueWarnings(form.cues)} />
          </div>
        )}
      </>
    ),

    blocos: () => (
      <BlocksEditor
        blocks={form.blocks}
        onChange={(v) => setField('blocks', v)}
        identity={identity}
        currentItemId={currentItemId}
        erro={erro('blocks')}
        duration={form.duration_min}
        onUseTotal={(total) => setField('duration_min', total)}
      />
    ),

    fisico: () => (
      <div className="grid gap-3 sm:grid-cols-2">
        <V2Field label={t('Séries')} htmlFor={campoId('sets')}>
          <V2Input id={campoId('sets')} type="number" inputMode="numeric" min={0} max={20} value={form.sets ?? ''} onChange={(e) => setField('sets', numOuNulo(e.target.value))} />
        </V2Field>
        {campoTexto({ key: 'reps', label: t('Repetições'), max: ITEM_LIMITS.reps, placeholder: t('Ex.: 12 ou 30 s') })}
        <V2Field label={t('Descanso (segundos)')} htmlFor={campoId('rest_sec')}>
          <V2Input id={campoId('rest_sec')} type="number" inputMode="numeric" min={0} max={600} value={form.rest_sec ?? ''} onChange={(e) => setField('rest_sec', numOuNulo(e.target.value))} />
        </V2Field>
        {campoTexto({ key: 'tempo', label: t('Ritmo'), max: ITEM_LIMITS.tempo, placeholder: t('Ex.: 2 s descendo, 1 s subindo') })}
      </div>
    ),

    estudo: () => (
      <>
        <div className="grid gap-3 sm:grid-cols-2">
          <V2Field label={t('Tipo de estudo')} htmlFor={campoId('study_type')}>
            <V2Select
              id={campoId('study_type')}
              value={form.study_type || 'leitura'}
              onChange={(e) => setField('study_type', e.target.value)}
              options={STUDY_TYPES.map((tipo) => ({ value: tipo, label: t(STUDY_TYPE_LABELS[tipo]) }))}
            />
          </V2Field>
          {campoTexto({ key: 'rules_edition', label: t('Edição do regulamento'), max: ITEM_LIMITS.rulesEdition, placeholder: t('Ex.: USA Pickleball 2026'), required: form.study_type === 'regra' })}
          {campoTexto({ key: 'rules_section', label: t('Seção da regra'), max: ITEM_LIMITS.rulesSection, placeholder: t('Ex.: 9.B') })}
          {campoTexto({ key: 'link', label: t('Link'), max: ITEM_LIMITS.link, placeholder: 'https://', hint: t('O texto ou o vídeo original. Só https://.') })}
        </div>
        <div className="space-y-2">
          <p className="text-sm font-semibold text-ink">{t('Perguntas para fixar')}</p>
          <p className="text-xs text-gray-500">{t('Situações de jogo: “a bola quicou na linha da cozinha; pode volear?”')}</p>
          <ListEditor
            id={campoId('questions')}
            items={form.questions}
            onChange={(v) => setField('questions', v)}
            max={ITEM_LIMITS.questions}
            addLabel={t('Adicionar pergunta')}
            makeNew={() => ''}
            itemLabel={t('pergunta')}
            renderItem={(q, i, set) => (
              <V2Input aria-label={t('Pergunta {n}', { n: i + 1 })} maxLength={ITEM_LIMITS.question} value={q} onChange={(e) => set(e.target.value)} />
            )}
          />
        </div>
      </>
    ),

    quando: () => campoTexto({ key: 'when_to_use', label: t('Quando usar'), max: ITEM_LIMITS.whenToUse, rows: 3, hint: t('A situação de jogo: "quando o adversário devolve alto na cozinha…".') }),

    certo: () => (
      <div className="space-y-2">
        <ListEditor
          id={campoId('positioning')}
          items={form.positioning}
          onChange={(v) => setField('positioning', v)}
          max={ITEM_LIMITS.positioning}
          addLabel={t('Adicionar certo')}
          makeNew={() => ({ type: 'certo', text: '' })}
          itemLabel={t('item')}
          extraActions={(
            <V2Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={form.positioning.length >= ITEM_LIMITS.positioning}
              onClick={() => setField('positioning', [...form.positioning, { type: 'errado', text: '' }])}
            >
              <Plus className="h-4 w-4" aria-hidden="true" />{' '}{t('Adicionar errado')}
            </V2Button>
          )}
          renderItem={(p, i, set) => (
            <div className="grid gap-2 sm:grid-cols-[9rem_minmax(0,1fr)]">
              <V2Select
                aria-label={t('Certo ou errado {n}', { n: i + 1 })}
                value={p.type === 'errado' ? 'errado' : 'certo'}
                onChange={(e) => set({ ...p, type: e.target.value })}
                options={[{ value: 'certo', label: t('Certo') }, { value: 'errado', label: t('Errado') }]}
              />
              <V2Textarea
                rows={2}
                aria-label={t('Texto {n}', { n: i + 1 })}
                maxLength={ITEM_LIMITS.positioningText}
                value={p.text || ''}
                placeholder={p.type === 'errado' ? t('O que se vê e o porquê: "… → a bola sobe".') : t('Como é a forma certa.')}
                onChange={(e) => set({ ...p, text: e.target.value })}
                className="min-h-[4rem]"
              />
            </div>
          )}
        />
        <Avisos itens={positioningWarnings(form.positioning)} />
      </div>
    ),

    erros: () => (
      <ListEditor
        id={campoId('common_errors')}
        items={form.common_errors}
        onChange={(v) => setField('common_errors', v)}
        max={ITEM_LIMITS.errors}
        addLabel={t('Adicionar erro')}
        makeNew={() => ({ error: '', fix: '' })}
        itemLabel={t('erro')}
        renderItem={(e, i, set) => (
          <div className="grid gap-2">
            <V2Field label={t('Erro {n}: o que se vê', { n: i + 1 })} htmlFor={`erro-${i}`}>
              <V2Input id={`erro-${i}`} maxLength={ITEM_LIMITS.error} value={e.error || ''} onChange={(ev) => set({ ...e, error: ev.target.value })} />
            </V2Field>
            <V2Field label={t('Correção')} htmlFor={`erro-${i}-fix`}>
              <V2Input id={`erro-${i}-fix`} maxLength={ITEM_LIMITS.fix} value={e.fix || ''} onChange={(ev) => set({ ...e, fix: ev.target.value })} />
            </V2Field>
          </div>
        )}
      />
    ),

    tecnica: () => {
      const tec = form.technique || { checkpoints: [], self_check: [] };
      const setTec = (sub, v) => setField('technique', { ...tec, [sub]: v });
      const proximaParte = () => TECHNIQUE_PARTS.find((pt) => !tec.checkpoints.some((c) => c.part === pt)) || TECHNIQUE_PARTS[0];
      return (
        <>
          <div className="space-y-2">
            <p className="text-sm font-semibold text-ink">{t('Ponto a ponto')}</p>
            <p className="text-xs text-gray-500">{t('Ex.: Pernas — “joelhos flexionados, quadril baixo; a força sobe das pernas, não do braço”.')}</p>
            <ListEditor
              id={campoId('technique')}
              items={tec.checkpoints}
              onChange={(v) => setTec('checkpoints', v)}
              max={ITEM_LIMITS.checkpoints}
              addLabel={t('Adicionar parte do corpo')}
              makeNew={() => ({ part: proximaParte(), text: '' })}
              itemLabel={t('ponto')}
              renderItem={(c, i, set) => (
                <div className="grid gap-2 sm:grid-cols-[11rem_minmax(0,1fr)]">
                  <V2Select
                    aria-label={t('Parte do corpo {n}', { n: i + 1 })}
                    value={c.part}
                    onChange={(e) => set({ ...c, part: e.target.value })}
                    options={TECHNIQUE_PARTS.map((pt) => ({ value: pt, label: t(TECHNIQUE_PART_LABELS[pt]) }))}
                  />
                  <V2Textarea
                    rows={2}
                    aria-label={t('O que {parte} faz', { parte: t(TECHNIQUE_PART_LABELS[c.part]) || t('esta parte') })}
                    maxLength={ITEM_LIMITS.checkpoint}
                    value={c.text || ''}
                    onChange={(e) => set({ ...c, text: e.target.value })}
                    className="min-h-[4rem]"
                  />
                </div>
              )}
            />
          </div>
          <div className="space-y-2">
            <p className="text-sm font-semibold text-ink">{t('Como saber se fez certo')}</p>
            <p className="text-xs text-gray-500">{t('O que a pessoa vê ou sente quando acerta: “a bola passa a um palmo da fita e cai na cozinha”.')}</p>
            <ListEditor
              id={campoId('self_check')}
              items={tec.self_check}
              onChange={(v) => setTec('self_check', v)}
              max={ITEM_LIMITS.selfChecks}
              addLabel={t('Adicionar sinal')}
              makeNew={() => ''}
              itemLabel={t('sinal')}
              renderItem={(sinal, i, set) => (
                <V2Input aria-label={t('Sinal de acerto {n}', { n: i + 1 })} maxLength={ITEM_LIMITS.selfCheck} value={sinal} onChange={(e) => set(e.target.value)} />
              )}
            />
          </div>
        </>
      );
    },

    movimento: () => (
      <>
        {[
          ['preparacao', t('Preparação')],
          ['execucao', t('Execução')],
          ['finalizacao', t('Finalização')],
        ].map(([fase, label]) => (
          <V2Field key={fase} label={label} htmlFor={`fase-${fase}`}>
            <V2Textarea
              id={`fase-${fase}`}
              rows={2}
              maxLength={ITEM_LIMITS.phase}
              value={form.motor?.phases?.[fase] || ''}
              onChange={(e) => setField('motor', { ...form.motor, phases: { ...form.motor.phases, [fase]: e.target.value } })}
              className="min-h-[4rem]"
            />
          </V2Field>
        ))}
        <MultiChips
          id={campoId('abilities')}
          legend={t('Capacidades que treina')}
          options={MOTOR_ABILITIES.map((a) => ({ value: a, label: t(MOTOR_ABILITY_LABELS[a]) }))}
          value={form.motor?.abilities}
          onChange={(v) => setField('motor', { ...form.motor, abilities: v })}
          max={ITEM_LIMITS.abilities}
          hint={t('Até {n}.', { n: ITEM_LIMITS.abilities })}
        />
      </>
    ),

    variacoes: () => (
      <>
        <V2Field label={t('Mais fácil')} htmlFor="variacao-facil" hint={t('Comece pela alavanca: "Espaço:", "Tarefa:", "Equipamento:" ou "Pessoas:".')}>
          <V2Textarea id="variacao-facil" rows={2} maxLength={ITEM_LIMITS.variation} value={form.variations?.easier || ''} onChange={(e) => setIn('variations', 'easier', e.target.value)} className="min-h-[4rem]" />
        </V2Field>
        <V2Field label={t('Mais difícil')} htmlFor="variacao-dificil">
          <V2Textarea id="variacao-dificil" rows={2} maxLength={ITEM_LIMITS.variation} value={form.variations?.harder || ''} onChange={(e) => setIn('variations', 'harder', e.target.value)} className="min-h-[4rem]" />
        </V2Field>
      </>
    ),

    meta: () => (
      <>
        <div className="grid gap-3 sm:grid-cols-2">
          <V2Field label={t('Tipo de meta')} htmlFor="meta-tipo">
            <V2Select id="meta-tipo" value={form.metric?.type || ''} onChange={(e) => setIn('metric', 'type', e.target.value)}>
              <option value="">{t('Sem meta numérica')}</option>
              {METRIC_TYPES.map((m) => <option key={m} value={m}>{t(METRIC_TYPE_LABELS[m])}</option>)}
            </V2Select>
          </V2Field>
          <V2Field label={t('Alvo')} htmlFor="meta-alvo" hint={form.metric?.type ? t('Algo que a pessoa conta sozinha: "10 seguidos".') : t('Escolha o tipo primeiro.')}>
            <V2Input id="meta-alvo" maxLength={ITEM_LIMITS.metricTarget} disabled={!form.metric?.type} value={form.metric?.target || ''} onChange={(e) => setIn('metric', 'target', e.target.value)} />
          </V2Field>
        </div>
        {campoTexto({ key: 'success_criteria', label: t('Critério de sucesso'), max: ITEM_LIMITS.success, rows: 2, hint: t('O que conta como acerto e quando subir de nível.') })}
      </>
    ),

    seguranca: () => campoTexto({ key: 'safety', label: t('Cuidados'), max: ITEM_LIMITS.safety, rows: 2, hint: t('O risco real e o que fazer para evitar. Deixe em branco se não houver.') }),

    diagramas: () => <DiagramEditor value={form.diagrams} onChange={(v) => setField('diagrams', v)} />,

    midia: () => (
      <MediaInput
        value={form.media}
        onChange={(v) => setField('media', v)}
        identity={identity}
        settings={settings}
        onBusyChange={onUploadBusy}
        onUploaded={onUploaded}
      />
    ),
  };

  return (
    <div className="space-y-6">
      {secoesVisiveis(kind, form).map((s) => (
        <EditorSection
          key={s.id}
          id={s.id}
          titulo={t(s.titulo)}
          porque={t(s.porque)}
          feito={secaoPreenchida(s, form)}
          dica={s.dica}
        >
          {conteudo[s.id]?.()}
        </EditorSection>
      ))}
    </div>
  );
}
