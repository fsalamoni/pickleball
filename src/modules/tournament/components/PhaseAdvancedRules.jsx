/**
 * REGRAS AVANÇADAS DE UMA FASE — o controle total do organizador.
 *
 * Tudo o que decide como a fase se forma, quem passa e como se compara vive
 * aqui, editável, com a explicação ao lado de cada controle. A tela fica
 * fechada por padrão de propósito: quem só quer "4 grupos, passam 2" não
 * precisa ver nada disto, e quem precisa de um regulamento próprio encontra
 * tudo num lugar só.
 *
 * Nenhum campo aqui é obrigatório. Todos são aditivos: em branco, a fase se
 * comporta exatamente como se comportava antes de eles existirem.
 */

import React, { useState } from 'react';
import { ChevronDown, ChevronRight, ArrowUp, ArrowDown, RotateCcw, Sparkles } from 'lucide-react';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  TIEBREAK_CRITERIA, TIEBREAK_PRESETS, DEFAULT_TIEBREAK_ORDER, normalizeTiebreakOrder,
} from '@/modules/tournament/domain/tiebreak';
import {
  CROSS_GROUP_METHOD, CROSS_GROUP_METHOD_LABELS, CROSS_GROUP_METHOD_HELP,
} from '@/modules/tournament/domain/crossGroup';
import {
  DIRECT_ENTRY_MODE, DIRECT_ENTRY_MODE_LABELS, DIRECT_ENTRY_MODE_HELP,
} from '@/modules/tournament/domain/directEntry';

function Help({ children }) {
  return <p className="mt-1 text-[11px] leading-snug text-gray-500">{children}</p>;
}

/** "6, 5, 5" ⇄ [6,5,5] — o jeito mais direto de escrever uma lista de números. */
function parseNumberList(texto) {
  return String(texto || '')
    .split(/[\s,;/+]+/)
    .map((p) => Math.floor(Number(p)))
    .filter((n) => Number.isFinite(n) && n > 0);
}
const formatNumberList = (lista) => (Array.isArray(lista) ? lista.join(', ') : '');

/**
 * Editor da ORDEM dos critérios de desempate. Ligar/desligar e subir/descer —
 * sem arrastar, que não funciona no celular da beira da quadra.
 */
function TiebreakOrderEditor({ value, onChange }) {
  const ordem = normalizeTiebreakOrder(value);
  const porChave = new Map(TIEBREAK_CRITERIA.map((c) => [c.key, c]));
  const foraDaOrdem = TIEBREAK_CRITERIA.filter((c) => !ordem.includes(c.key));

  const mover = (i, delta) => {
    const nova = ordem.slice();
    const j = i + delta;
    if (j < 0 || j >= nova.length) return;
    [nova[i], nova[j]] = [nova[j], nova[i]];
    onChange(nova);
  };
  const remover = (chave) => {
    const nova = ordem.filter((k) => k !== chave);
    onChange(nova.length > 0 ? nova : [...DEFAULT_TIEBREAK_ORDER]);
  };

  return (
    <div className="space-y-2 md:col-span-2">
      <Label className="text-xs">Ordem dos critérios de desempate (dentro do grupo)</Label>
      <Help>
        Aplicados nesta ordem, de cima para baixo. Quando um critério separa os empatados, os
        que continuam empatados são comparados de novo <strong>a partir do primeiro critério,
        só entre eles</strong> — é o que faz &quot;eu ganhei dele&quot; continuar valendo depois
        que um terceiro sai da conta.
      </Help>

      <div className="flex flex-wrap gap-1.5">
        {TIEBREAK_PRESETS.map((p) => (
          <Button
            key={p.id}
            type="button"
            size="sm"
            variant="outline"
            className="h-7 text-[11px]"
            title={p.help}
            onClick={() => onChange([...p.order])}
          >
            <Sparkles className="mr-1 h-3 w-3" /> {p.label}
          </Button>
        ))}
        <Button
          type="button"
          size="sm"
          variant="ghost"
          className="h-7 text-[11px]"
          onClick={() => onChange([])}
        >
          <RotateCcw className="mr-1 h-3 w-3" /> Voltar ao padrão
        </Button>
      </div>

      <ol className="space-y-1">
        {ordem.map((chave, i) => {
          const c = porChave.get(chave);
          return (
            <li key={chave} className="flex items-start gap-2 rounded-md border border-gray-200 bg-white p-2">
              <span className="mt-0.5 w-5 shrink-0 text-center text-xs font-bold text-gray-400">{i + 1}º</span>
              <div className="min-w-0 flex-1">
                <div className="text-xs font-semibold text-ink">{c?.label || chave}</div>
                {c?.help && <Help>{c.help}</Help>}
              </div>
              <div className="flex shrink-0 gap-1">
                <Button type="button" size="icon" variant="ghost" className="h-6 w-6" aria-label="Subir"
                  disabled={i === 0} onClick={() => mover(i, -1)}>
                  <ArrowUp className="h-3 w-3" />
                </Button>
                <Button type="button" size="icon" variant="ghost" className="h-6 w-6" aria-label="Descer"
                  disabled={i === ordem.length - 1} onClick={() => mover(i, 1)}>
                  <ArrowDown className="h-3 w-3" />
                </Button>
                <Button type="button" size="sm" variant="ghost" className="h-6 px-1.5 text-[10px]"
                  disabled={ordem.length <= 1} onClick={() => remover(chave)}>
                  tirar
                </Button>
              </div>
            </li>
          );
        })}
      </ol>

      {foraDaOrdem.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-[11px] text-gray-500">Acrescentar:</span>
          {foraDaOrdem.map((c) => (
            <Button key={c.key} type="button" size="sm" variant="outline" className="h-6 text-[10px]"
              title={c.help} onClick={() => onChange([...ordem, c.key])}>
              + {c.label}
            </Button>
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * @param {{
 *   phase: object,
 *   index: number,
 *   isFirst: boolean,
 *   isLast: boolean,
 *   grouped: boolean,
 *   unit: string,
 *   onChange: (patch: object) => void,
 * }} props
 */
export default function PhaseAdvancedRules({
  phase, index, isFirst, isLast, grouped, unit = 'atletas', onChange,
}) {
  const [aberto, setAberto] = useState(false);
  const direct = phase.direct_entry || { mode: DIRECT_ENTRY_MODE.NONE, count: 0, ids: [] };

  const ativos = [
    (phase.custom_group_sizes || []).length > 0 && 'tamanhos manuais',
    (phase.qualifiers_by_group || []).length > 0 && 'classificados por grupo',
    (phase.tiebreak_order || []).length > 0 && 'desempate próprio',
    phase.cross_group_method && phase.cross_group_method !== CROSS_GROUP_METHOD.RATE && 'comparação própria',
    direct.mode !== DIRECT_ENTRY_MODE.NONE && 'entrada direta',
    Number(phase.wildcard_from_position) > 0 && 'repescagem fixa',
  ].filter(Boolean);

  return (
    <div className="rounded-md border border-dashed border-gray-300 bg-gray-50/60">
      <button
        type="button"
        onClick={() => setAberto((v) => !v)}
        className="flex w-full items-center justify-between gap-2 p-2 text-left"
      >
        <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-gray-700">
          {aberto ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
          Regras avançadas desta fase
        </span>
        <span className="truncate text-[11px] text-gray-500">
          {ativos.length > 0 ? ativos.join(' · ') : 'tudo no padrão'}
        </span>
      </button>

      {aberto && (
        <div className="grid grid-cols-1 gap-3 border-t border-gray-200 p-2 md:grid-cols-2">
          {/* ---------------- formação dos grupos ---------------- */}
          {grouped && (
            <div className="md:col-span-2">
              <Label className="text-xs">Tamanhos dos grupos, escritos à mão</Label>
              <Input
                className="h-9"
                placeholder="Ex.: 6, 5, 5 — em branco, a plataforma equilibra sozinha"
                defaultValue={formatNumberList(phase.custom_group_sizes)}
                onBlur={(e) => onChange({ custom_group_sizes: parseNumberList(e.target.value) })}
              />
              <Help>
                Manda nos tamanhos exatos, na ordem dos grupos (A, B, C…). Em branco, a divisão é
                equilibrada automaticamente, com diferença máxima de 1 entre os grupos. Se o número
                de inscritos mudar até a véspera, a lista é <strong>ajustada</strong> para caber —
                ninguém fica de fora e ninguém é sorteado sem existir.
              </Help>
            </div>
          )}

          {(grouped || phase.type === 'round_robin') && (
            <TiebreakOrderEditor
              value={phase.tiebreak_order}
              onChange={(v) => onChange({ tiebreak_order: v })}
            />
          )}

          {/* ---------------- quem passa ---------------- */}
          {!isLast && (
            <>
              {grouped && (
                <div>
                  <Label className="text-xs">Classificados de cada grupo</Label>
                  <Input
                    className="h-9"
                    placeholder="Ex.: 2, 2, 1 — em branco, o mesmo para todos"
                    defaultValue={formatNumberList(phase.qualifiers_by_group)}
                    onBlur={(e) => onChange({ qualifiers_by_group: parseNumberList(e.target.value) })}
                  />
                  <Help>
                    Um número por grupo, na ordem A, B, C… Serve para grupos de tamanhos diferentes:
                    passam 2 do grupo de 5 e 1 do de 3. Em branco, vale o número único configurado
                    acima para todos.
                  </Help>
                </div>
              )}

              <div>
                <Label className="text-xs">Repescagem: de qual colocação</Label>
                <Input
                  type="number"
                  min={0}
                  className="h-9"
                  value={phase.wildcard_from_position ?? 0}
                  onChange={(e) => onChange({ wildcard_from_position: e.target.value })}
                />
                <Help>
                  0 = automático (a colocação logo abaixo do corte: os &quot;melhores terceiros&quot;
                  quando passam 2). Outro número fixa a colocação que concorre às vagas de
                  repescagem — útil quando o seu regulamento repesca de outro lugar.
                </Help>
              </div>

              {grouped && (
                <div className="md:col-span-2">
                  <Label className="text-xs">Como comparar quem veio de grupos diferentes</Label>
                  <select
                    className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
                    value={phase.cross_group_method || CROSS_GROUP_METHOD.RATE}
                    onChange={(e) => onChange({ cross_group_method: e.target.value })}
                  >
                    {Object.entries(CROSS_GROUP_METHOD_LABELS).map(([k, v]) => (
                      <option key={k} value={k}>{v}</option>
                    ))}
                  </select>
                  <Help>{CROSS_GROUP_METHOD_HELP[phase.cross_group_method || CROSS_GROUP_METHOD.RATE]}</Help>
                </div>
              )}
            </>
          )}

          {/* ---------------- entrada direta (pular fases) ---------------- */}
          {!isFirst && (
            <div className="md:col-span-2 space-y-2 rounded-md border border-acid/40 bg-acid/5 p-2">
              <div className="text-xs font-semibold text-ink">
                Quem entra direto nesta fase (pulando as anteriores)
              </div>
              <select
                className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
                value={direct.mode}
                onChange={(e) => onChange({ direct_entry: { ...direct, mode: e.target.value } })}
              >
                {Object.entries(DIRECT_ENTRY_MODE_LABELS).map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
              </select>
              <Help>{DIRECT_ENTRY_MODE_HELP[direct.mode]}</Help>

              {direct.mode === DIRECT_ENTRY_MODE.SEEDS && (
                <div>
                  <Label className="text-xs">Quantos entram direto</Label>
                  <Input
                    type="number"
                    min={0}
                    className="h-9"
                    value={direct.count ?? 0}
                    onChange={(e) => onChange({ direct_entry: { ...direct, count: e.target.value } })}
                  />
                  <Help>
                    Os mais fortes ({unit}) pelo nível usado no sorteio. Eles <strong>não jogam</strong> as
                    fases anteriores: entram aqui como cabeças, à frente dos classificados. A 1ª fase
                    precisa continuar com ao menos 2 — a tela avisa se não sobrar gente.
                  </Help>
                </div>
              )}

              {direct.mode === DIRECT_ENTRY_MODE.MANUAL && (
                <div>
                  <Label className="text-xs">Inscrições que entram direto (uma por linha ou separadas por vírgula)</Label>
                  <Input
                    className="h-9"
                    placeholder="Cole aqui os identificadores das inscrições"
                    defaultValue={(direct.ids || []).join(', ')}
                    onBlur={(e) => onChange({
                      direct_entry: {
                        ...direct,
                        ids: String(e.target.value || '')
                          .split(/[\s,;]+/).map((x) => x.trim()).filter(Boolean),
                      },
                    })}
                  />
                  <Help>
                    Escolha nome por nome, para campeão defendendo título, convidado da organização
                    ou qualquer critério que não seja o ranking. Quem for listado em duas fases
                    entra na <strong>mais cedo</strong>, e a tela avisa.
                  </Help>
                </div>
              )}
            </div>
          )}

          <p className="md:col-span-2 text-[11px] italic text-gray-500">
            Fase {index + 1}. Todo campo em branco aqui significa &quot;faça como sempre fez&quot; —
            nada nesta área muda o comportamento de um torneio que não a usa.
          </p>
        </div>
      )}
    </div>
  );
}
