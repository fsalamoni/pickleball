/**
 * O editor de UM grupo, INLINE — abre no lugar da linha do grupo, sem modal.
 *
 * Quem organiza está de pé na beira da quadra, com o celular na mão: um
 * formulário comprido num modal rola por dentro de outra rolagem e some o
 * contexto (quem está em cada grupo). Aqui ele cresce na própria lista, e o
 * "Salvar" e o "Cancelar" estão no fim dele.
 *
 * As configurações vêm em DUAS famílias com títulos diferentes, porque fazem
 * coisas diferentes: o PERFIL (quem é do grupo — sugere, nunca barra) e as
 * REGRAS DA PARTIDA (como o grupo joga — valem no sorteio).
 */
import React, { useState } from 'react';
import { Check } from 'lucide-react';
import { cn } from '@/core/lib/utils';
import { V2Button, V2Field, V2FilterChip, V2Input, V2Select, V2Toggle } from '@/v2/ui/primitives';
import {
  GROUP_FORMATION, GROUP_FORMATION_HINTS, GROUP_FORMATION_LABELS, GROUP_GENDER, GROUP_GENDER_LABELS,
  GROUP_JOIN, PLAY_GROUP_COLORS, PLAY_GROUP_GAP_OPTIONS, PLAY_GROUP_LEVEL_STEPS, PLAY_GROUP_LIMITS,
  normalizePlayGroup,
} from '@/modules/games/domain/playGroups';
import { themeOf } from './playGroupTheme';

const nivelTxt = (n) => Number(n).toFixed(1);
const toNum = (v) => (v === '' || v == null ? null : Number(v));

function Secao({ titulo, children }) {
  return (
    <fieldset className="space-y-3">
      <legend className="text-sm font-bold text-ink">{titulo}</legend>
      {children}
    </fieldset>
  );
}

/**
 * @param {{
 *   group: object, courts: number, otherNames: string[], isNew?: boolean,
 *   saving?: boolean, onSave: (group: object) => void, onCancel: () => void,
 * }} props
 */
export default function GroupEditor({ group, courts, otherNames, isNew = false, saving = false, onSave, onCancel }) {
  const [rascunho, setRascunho] = useState(group);
  const [erro, setErro] = useState('');
  const set = (campo, valor) => { setRascunho((r) => ({ ...r, [campo]: valor })); setErro(''); };

  const temRegra = rascunho.formation !== GROUP_FORMATION.FREE || rascunho.max_level_gap != null;
  const nomeEmUso = (n) => otherNames.some((o) => o.trim().toLowerCase() === n.trim().toLowerCase());

  const salvar = (e) => {
    e.preventDefault();
    const nome = String(rascunho.name || '').trim();
    if (!nome) { setErro('Dê um nome ao grupo.'); return; }
    if (nomeEmUso(nome)) { setErro('Já existe um grupo com esse nome.'); return; }
    onSave(normalizePlayGroup({ ...rascunho, name: nome }, 0));
  };

  const alternarQuadra = (n) => {
    const atual = new Set(rascunho.courts);
    if (atual.has(n)) atual.delete(n); else atual.add(n);
    set('courts', Array.from(atual).sort((a, b) => a - b));
  };

  return (
    <form onSubmit={salvar} className="space-y-5" aria-label={isNew ? 'Novo grupo' : `Editar o grupo ${group.name}`}>
      <V2Field label="Nome do grupo" htmlFor="grupo-nome" error={erro || undefined}>
        <V2Input
          id="grupo-nome"
          value={rascunho.name}
          maxLength={PLAY_GROUP_LIMITS.NAME_MAX}
          placeholder="Ex.: Iniciantes, Turma da manhã"
          onChange={(e) => set('name', e.target.value)}
          autoFocus={isNew}
        />
      </V2Field>

      <div role="radiogroup" aria-label="Cor do grupo" className="flex flex-wrap items-center gap-2">
        <span className="mr-1 text-sm font-semibold text-ink">Cor</span>
        {PLAY_GROUP_COLORS.map((cor) => {
          const ativa = rascunho.color === cor;
          return (
            <button
              key={cor}
              type="button"
              role="radio"
              aria-checked={ativa}
              aria-label={`Cor ${cor}`}
              onClick={() => set('color', cor)}
              className={cn(
                'flex h-8 w-8 items-center justify-center rounded-full border-2 transition-transform focus:outline-none focus-visible:ring-4 focus-visible:ring-acid/40',
                ativa ? 'scale-110 border-ink' : 'border-transparent hover:scale-105',
              )}
            >
              <span className={cn('flex h-6 w-6 items-center justify-center rounded-full', themeOf(cor).dot)}>
                {ativa && <Check aria-hidden="true" className="h-3.5 w-3.5 text-[#fff]" />}
              </span>
            </button>
          );
        })}
      </div>

      <Secao titulo="Quem é do grupo">
        <p className="text-xs leading-5 text-gray-500">
          Serve para sugerir e conferir — distribuir por nível, receber quem chega. Quem organiza pode
          pôr qualquer pessoa em qualquer grupo.
        </p>
        <div className="grid grid-cols-2 gap-3">
          <V2Field label="Nível de" htmlFor="grupo-nivel-min">
            <V2Select
              id="grupo-nivel-min"
              value={rascunho.level_min ?? ''}
              onChange={(e) => set('level_min', toNum(e.target.value))}
            >
              <option value="">Qualquer</option>
              {PLAY_GROUP_LEVEL_STEPS.map((n) => <option key={n} value={n}>{nivelTxt(n)}</option>)}
            </V2Select>
          </V2Field>
          <V2Field label="até" htmlFor="grupo-nivel-max">
            <V2Select
              id="grupo-nivel-max"
              value={rascunho.level_max ?? ''}
              onChange={(e) => set('level_max', toNum(e.target.value))}
            >
              <option value="">Qualquer</option>
              {PLAY_GROUP_LEVEL_STEPS.map((n) => <option key={n} value={n}>{nivelTxt(n)}</option>)}
            </V2Select>
          </V2Field>
        </div>
        <V2Field label="Quem entra" htmlFor="grupo-sexo">
          <V2Select id="grupo-sexo" value={rascunho.gender} onChange={(e) => set('gender', e.target.value)}>
            {Object.values(GROUP_GENDER).map((g) => <option key={g} value={g}>{GROUP_GENDER_LABELS[g]}</option>)}
          </V2Select>
        </V2Field>
        <V2Toggle
          id="grupo-aberto"
          checked={rascunho.join === GROUP_JOIN.OPEN}
          onChange={(v) => set('join', v ? GROUP_JOIN.OPEN : GROUP_JOIN.CLOSED)}
          label="A pessoa pode escolher este grupo"
          hint={rascunho.join === GROUP_JOIN.OPEN
            ? 'Quem chega cai aqui pelo nível e pode trocar de grupo sozinho.'
            : 'Só a organização coloca gente neste grupo.'}
        />
      </Secao>

      <Secao titulo="Como as partidas se formam">
        <V2Field label="Duplas" htmlFor="grupo-formacao" hint={GROUP_FORMATION_HINTS[rascunho.formation]}>
          <V2Select id="grupo-formacao" value={rascunho.formation} onChange={(e) => set('formation', e.target.value)}>
            {Object.values(GROUP_FORMATION).map((f) => <option key={f} value={f}>{GROUP_FORMATION_LABELS[f]}</option>)}
          </V2Select>
        </V2Field>
        <V2Field
          label="Diferença máxima de nível na partida"
          htmlFor="grupo-gap"
          hint="Entre o jogador mais forte e o mais fraco da partida. Quem não tem nível informado não conta."
        >
          <V2Select
            id="grupo-gap"
            value={rascunho.max_level_gap ?? ''}
            onChange={(e) => set('max_level_gap', toNum(e.target.value))}
          >
            <option value="">Sem limite</option>
            {PLAY_GROUP_GAP_OPTIONS.map((n) => <option key={n} value={n}>até {nivelTxt(n)}</option>)}
          </V2Select>
        </V2Field>
        <V2Toggle
          id="grupo-exigir"
          checked={rascunho.strict && temRegra}
          onChange={(v) => set('strict', v)}
          label="Exigir essas regras"
          hint={!temRegra
            ? 'Escolha uma formação ou um limite de nível para poder exigir.'
            : (rascunho.strict
              ? 'A partida só sai se respeitar as regras — o grupo pode ficar esperando.'
              : 'O sorteio tenta respeitar; se não der, completa com quem há — a quadra não fica parada.')}
        />
      </Secao>

      <Secao titulo="Quadras e fila">
        <div>
          <p className="mb-2 text-xs leading-5 text-gray-500">
            {rascunho.courts.length === 0
              ? 'Qualquer quadra. Marque para deixar este grupo só nas quadras escolhidas.'
              : `Só ${rascunho.courts.length === 1 ? 'a quadra' : 'as quadras'} ${rascunho.courts.join(', ')}.`}
          </p>
          <div className="flex flex-wrap gap-2">
            {Array.from({ length: courts }, (_, i) => i + 1).map((n) => (
              <V2FilterChip
                key={n}
                active={rascunho.courts.includes(n)}
                aria-pressed={rascunho.courts.includes(n)}
                onClick={() => alternarQuadra(n)}
                className="px-4 py-1.5"
              >
                Quadra {n}
              </V2FilterChip>
            ))}
          </div>
        </div>
        <V2Toggle
          id="grupo-completar"
          checked={rascunho.fill}
          onChange={(v) => set('fill', v)}
          label="Completar com quem está sem grupo"
          hint="Faltando gente para a partida, quem está sem grupo entra para completar — o grupo vem primeiro."
        />
      </Secao>

      <div className="flex flex-wrap items-center justify-end gap-2 border-t border-gray-100 pt-4">
        <V2Button type="button" variant="ghost" size="sm" onClick={onCancel} disabled={saving}>Cancelar</V2Button>
        <V2Button type="submit" size="sm" disabled={saving}>
          {saving ? 'Salvando…' : (isNew ? 'Criar grupo' : 'Salvar grupo')}
        </V2Button>
      </div>
    </form>
  );
}
