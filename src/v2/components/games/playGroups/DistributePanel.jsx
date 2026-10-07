/**
 * "DISTRIBUIR POR NÍVEL" — a prévia, inline, antes de gravar qualquer coisa.
 *
 * Distribuir mexe na vida de várias pessoas de uma vez, então nunca grava
 * direto: mostra para onde cada um iria, quem não deu para classificar e por
 * quê, e só aplica quando quem organiza confirma. É sugestão, nunca imposição.
 */
import React, { useMemo, useState } from 'react';
import { V2Button } from '@/v2/ui/primitives';
import { suggestPlayGroupAssignments } from '@/modules/games/domain/playGroups';
import { PlayGroupBadge } from './PlayGroupBadge';
import GroupSelect from './GroupSelect';

const MOSTRAR = 8;

function nomes(lista) {
  const vistos = lista.slice(0, MOSTRAR).join(', ');
  return lista.length > MOSTRAR ? `${vistos} e mais ${lista.length - MOSTRAR}` : vistos;
}

/**
 * @param {{
 *   participants: Array, config: { groups: object[] }, applying?: boolean,
 *   onApply: (assignments: Array<{pid:string, groupId:string}>) => void, onCancel: () => void,
 * }} props
 */
export default function DistributePanel({ participants, config, applying = false, onApply, onCancel }) {
  const [escopo, setEscopo] = useState('ungrouped');
  const [reserva, setReserva] = useState(null); // grupo para quem não deu para classificar

  const sugestao = useMemo(
    () => suggestPlayGroupAssignments({ participants, config, scope: escopo }),
    [participants, config, escopo],
  );
  const porGrupo = useMemo(() => config.groups
    .map((g) => ({ g, gente: sugestao.assignments.filter((a) => a.groupId === g.id).map((a) => a.name) }))
    .filter((x) => x.gente.length > 0), [config.groups, sugestao]);

  const finais = [
    ...sugestao.assignments.map((a) => ({ pid: a.pid, groupId: a.groupId })),
    ...(reserva ? sugestao.unmatched.map((u) => ({ pid: u.pid, groupId: reserva })) : []),
  ];
  const nada = sugestao.assignments.length === 0 && sugestao.unmatched.length === 0;

  return (
    <section aria-label="Distribuir por nível" className="space-y-4 rounded-lg border border-gray-200 bg-paper p-4">
      <div>
        <h4 className="text-sm font-bold text-ink">Distribuir por nível</h4>
        <p className="mt-1 text-xs leading-5 text-gray-500">
          Cada pessoa vai para o grupo da faixa do seu nível (e do sexo, quando o grupo pede). Confira
          abaixo antes de aplicar — nada é gravado até você confirmar.
        </p>
      </div>

      <div role="radiogroup" aria-label="Quem distribuir" className="space-y-2">
        {[
          ['ungrouped', 'Só quem está sem grupo', 'Quem já foi colocado num grupo fica onde está.'],
          ['all', 'Todo mundo', 'Refaz a distribuição inteira — inclusive de quem você já tinha movido.'],
        ].map(([valor, titulo, ajuda]) => (
          <label key={valor} className="flex cursor-pointer items-start gap-2.5 text-sm">
            <input
              type="radio"
              name="distribuir-escopo"
              checked={escopo === valor}
              onChange={() => setEscopo(valor)}
              className="mt-1 h-4 w-4 accent-[#0B0F19]"
            />
            <span>
              <span className="font-semibold text-ink">{titulo}</span>
              <span className="block text-xs text-gray-500">{ajuda}</span>
            </span>
          </label>
        ))}
      </div>

      {nada ? (
        <p className="rounded-lg bg-white px-3 py-2 text-sm text-gray-600">
          Nada a mudar: {escopo === 'ungrouped' ? 'todo mundo já está num grupo.' : 'ninguém precisa trocar de grupo.'}
        </p>
      ) : (
        <ul className="space-y-2">
          {porGrupo.map(({ g, gente }) => (
            <li key={g.id} className="flex flex-wrap items-baseline gap-x-2 gap-y-1 text-sm">
              <PlayGroupBadge name={g.name} color={g.color} />
              <span className="font-semibold text-ink">{gente.length}</span>
              <span className="min-w-0 text-xs text-gray-500">{nomes(gente)}</span>
            </li>
          ))}
        </ul>
      )}

      {sugestao.unmatched.length > 0 && (
        <div className="space-y-2 rounded-lg border border-amber-200 bg-amber-50/70 p-3">
          <p className="text-sm font-semibold text-amber-900">
            {sugestao.unmatched.length} {sugestao.unmatched.length === 1 ? 'pessoa não deu' : 'pessoas não deram'} para classificar
          </p>
          <ul className="space-y-0.5 text-xs text-amber-900">
            {sugestao.unmatched.slice(0, MOSTRAR).map((u) => (
              <li key={u.pid}><strong className="font-semibold">{u.name}</strong> — {u.reason}</li>
            ))}
            {sugestao.unmatched.length > MOSTRAR && <li>e mais {sugestao.unmatched.length - MOSTRAR}…</li>}
          </ul>
          <label className="flex flex-wrap items-center gap-2 text-xs text-amber-900">
            Colocar essas pessoas em:
            <GroupSelect
              value={reserva}
              groups={config.groups}
              onChange={setReserva}
              label="Grupo para quem não deu para classificar"
              noneLabel="Deixar sem grupo"
            />
          </label>
        </div>
      )}

      <div className="flex flex-wrap items-center justify-end gap-2">
        <V2Button variant="ghost" size="sm" onClick={onCancel} disabled={applying}>Cancelar</V2Button>
        <V2Button size="sm" onClick={() => onApply(finais)} disabled={applying || finais.length === 0}>
          {applying ? 'Aplicando…' : `Aplicar a ${finais.length} ${finais.length === 1 ? 'pessoa' : 'pessoas'}`}
        </V2Button>
      </div>
    </section>
  );
}
