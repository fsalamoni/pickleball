/**
 * Treino → BIBLIOTECA INICIAL: instalar/atualizar a semente PickleRush
 * (mostrando ANTES o que vai acontecer), restaurar o que foi apagado de
 * propósito, importar itens em lote (JSON colado, com prévia por item) e
 * montar o pedido para uma IA criar em lote.
 *
 * Sem a configuração lida não se instala: é ela que diz quais itens o admin
 * apagou de propósito (`seed_removed`) — instalar sem saber os recriaria.
 */
import React, { useState } from 'react';
import { toast } from 'sonner';
import {
  CheckCircle2, ClipboardPaste, Copy, Download, FileJson, RotateCcw, Sparkles, TriangleAlert,
} from 'lucide-react';
import { useSeedPlan, useTrainingAdminActions } from '@/modules/training/hooks/useTrainingAdmin';
import { buildAiPrompt, itemJsonTemplate, MAX_IMPORT_ITEMS, parseItemsJson } from '@/modules/training/domain/aiTemplate';
import { ITEM_KINDS, ITEM_KIND_LABELS } from '@/modules/training/domain/taxonomy';
import { useClipboard } from '@/core/lib/useClipboard';
import {
  V2Badge, V2Button, V2ErrorState, V2Field, V2Input, V2Select, V2Skeleton, V2Surface, V2Textarea, V2Toggle,
} from '@/v2/ui/primitives';
import { ConfirmDialog, mensagemDeErro } from '@/v2/components/training/item/ItemActionDialogs';
import { quandoFoi } from '@/v2/components/training/questions/questionsView';
import { SkillPicker } from '@/v2/components/training/editor/editorFields';
import { formatLevel, levelOptions } from '@/v2/components/training/editor/editorForm';

const NIVEIS = levelOptions();

function Grupo({ titulo, itens, tom }) {
  if (!itens.length) return null;
  return (
    <details className="rounded-3xl border border-gray-100 p-3">
      <summary className="flex cursor-pointer items-center gap-2 text-sm font-semibold text-ink">
        <V2Badge tone={tom}>{itens.length}</V2Badge> {titulo}
      </summary>
      <ul className="mt-2 space-y-0.5 text-sm text-gray-600">
        {itens.map((it) => <li key={it.slug}>{it.title} <span className="text-xs text-gray-400">· {ITEM_KIND_LABELS[it.kind] || it.kind}</span></li>)}
      </ul>
    </details>
  );
}

function Resultado({ r }) {
  if (!r) return null;
  return (
    <div className="rounded-3xl bg-gray-50 p-3 text-sm" role="status">
      <p className="flex items-center gap-1.5 font-semibold text-ink">
        <CheckCircle2 className="h-4 w-4 text-emerald-600" aria-hidden="true" />
        {[r.created !== undefined && `${r.created} criado${r.created === 1 ? '' : 's'}`, r.updated !== undefined && `${r.updated} atualizado${r.updated === 1 ? '' : 's'}`].filter(Boolean).join(' · ')}
      </p>
      {r.failed?.length > 0 && (
        <>
          <p className="mt-2 font-semibold text-red-700">{r.failed.length} não entraram:</p>
          <ul className="mt-1 space-y-0.5 text-gray-700">
            {r.failed.map((x) => <li key={x.slug || x.title}>{x.slug || x.title}: {x.error}</li>)}
          </ul>
        </>
      )}
    </div>
  );
}

function Semente({ settingsQ, acoes }) {
  const [ver, setVer] = useState(false);
  const [progresso, setProgresso] = useState(null);
  const [resultado, setResultado] = useState(null);
  const [restaurar, setRestaurar] = useState(false);
  const plano = useSeedPlan(settingsQ.data, { enabled: ver && settingsQ.isSuccess });

  if (settingsQ.isPending) return <V2Skeleton className="h-40 rounded-4xl" />;
  if (settingsQ.isError) {
    return (
      <V2Surface>
        <V2ErrorState
          title="A configuração do treino não carregou"
          description="Sem ela não dá para saber quais itens da biblioteca foram apagados de propósito — instalar agora poderia recriá-los."
          onRetry={() => settingsQ.refetch()}
        />
      </V2Surface>
    );
  }
  const s = settingsQ.data;
  const instalar = (opts = {}) => {
    setResultado(null);
    setProgresso({ n: 0, total: 0 });
    acoes.installSeed.mutate({ ...opts, onProgress: (n, total) => setProgresso({ n, total }) }, {
      onSuccess: (r) => { setResultado(r); toast.success('Biblioteca inicial atualizada.'); },
      onError: (err) => toast.error(mensagemDeErro(err, 'Não foi possível instalar agora.')),
      onSettled: () => { setProgresso(null); setRestaurar(false); },
    });
  };
  const p = plano.data;
  const aFazer = p ? p.create.length + p.update.length : 0;

  return (
    <V2Surface className="space-y-4" data-dica="admin-treino-biblioteca">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="font-display text-xl font-bold text-ink">Biblioteca inicial PickleRush</h2>
          <p className="mt-1 max-w-2xl text-sm text-gray-500">
            Os drills, treinos, fundamentos e estudos que a plataforma oferece a todos, com a autoria “Equipe PickleRush”.
            Instalar é seguro de repetir: cria o que falta, atualiza o que tem versão nova e não mexe no que a equipe editou nem recria o que foi apagado.
          </p>
        </div>
        <V2Badge tone={s.seed_installed_version ? 'green' : 'amber'}>
          {s.seed_installed_version ? `Instalada: v${s.seed_installed_version}` : 'Ainda não instalada'}
        </V2Badge>
      </div>
      {s.seed_installed_at && <p className="text-xs text-gray-500">Última instalação: {quandoFoi(s.seed_installed_at)}</p>}

      {!ver ? (
        <V2Button variant="secondary" onClick={() => setVer(true)}>Ver o que a instalação faria</V2Button>
      ) : plano.isPending ? <V2Skeleton lines={3} />
        : plano.isError ? <V2ErrorState inline title="Não deu para montar a prévia" onRetry={() => plano.refetch()} />
          : (
            <div className="space-y-3">
              <p className="text-sm text-gray-700">Versão disponível: <span className="font-semibold text-ink">v{p.version}</span></p>
              <div className="space-y-2">
                <Grupo titulo="a criar" itens={p.create} tom="green" />
                <Grupo titulo="a atualizar (versão nova)" itens={p.update} tom="blue" />
                <Grupo titulo="ficam como estão" itens={p.keep} tom="neutral" />
                <Grupo titulo="apagados de propósito (não serão recriados)" itens={p.removed} tom="red" />
              </div>
              {progresso && (
                <div role="status" aria-live="polite" className="space-y-1">
                  <p className="text-sm text-gray-600">Instalando… {progresso.total ? `${progresso.n} de ${progresso.total}` : ''}</p>
                  <div className="h-2 overflow-hidden rounded-full bg-gray-100">
                    <div className="h-full bg-ink transition-all" style={{ width: progresso.total ? `${Math.round((progresso.n / progresso.total) * 100)}%` : '5%' }} />
                  </div>
                </div>
              )}
              <Resultado r={resultado} />
              <div className="flex flex-wrap gap-2">
                <V2Button disabled={!aFazer || acoes.installSeed.isPending} onClick={() => instalar()}>
                  <Download className="h-4 w-4" aria-hidden="true" />
                  {aFazer ? `Instalar (${p.create.length} novos, ${p.update.length} atualizados)` : 'Nada a instalar'}
                </V2Button>
                {p.removed.length > 0 && (
                  <V2Button variant="secondary" disabled={acoes.installSeed.isPending} onClick={() => setRestaurar(true)}>
                    <RotateCcw className="h-4 w-4" aria-hidden="true" /> Restaurar os removidos ({p.removed.length})
                  </V2Button>
                )}
              </div>
            </div>
          )}
      <ConfirmDialog
        open={restaurar}
        onOpenChange={setRestaurar}
        title="Restaurar os itens apagados?"
        description={`Os ${p?.removed.length || 0} itens da biblioteca inicial que a equipe apagou voltam a ser criados, públicos, junto com o resto da instalação.`}
        confirmLabel="Restaurar"
        pending={acoes.installSeed.isPending}
        onConfirm={() => instalar({ restoreRemoved: true })}
      />
    </V2Surface>
  );
}

function Importar({ acoes }) {
  const [texto, setTexto] = useState('');
  const [daIa, setDaIa] = useState(true);
  const [visibilidade, setVisibilidade] = useState('privado');
  const [lido, setLido] = useState(null);
  const [resultado, setResultado] = useState(null);
  const validos = lido?.ok ? lido.items.filter((x) => x.valid) : [];

  const importar = () => acoes.importItems.mutate(
    { values: validos.map((x) => x.value), asPlatform: true, visibility: visibilidade, aiAssisted: daIa },
    {
      onSuccess: (r) => { setResultado(r); setLido(null); setTexto(''); toast.success(`${r.created} importado${r.created === 1 ? '' : 's'}.`); },
      onError: (err) => toast.error(mensagemDeErro(err, 'Não foi possível importar agora.')),
    },
  );

  return (
    <V2Surface className="space-y-4">
      <div>
        <h2 className="flex items-center gap-2 font-display text-xl font-bold text-ink"><FileJson className="h-5 w-5" aria-hidden="true" /> Importar em lote</h2>
        <p className="mt-1 max-w-2xl text-sm text-gray-500">
          Cole um item, uma lista ou {'{ "items": [...] }'} (até {MAX_IMPORT_ITEMS} por vez). Nada é gravado antes da prévia; os itens entram como Equipe PickleRush.
        </p>
      </div>
      <V2Field label="JSON" htmlFor="treino-importar-json">
        <V2Textarea id="treino-importar-json" rows={8} className="font-mono text-xs" value={texto} onChange={(e) => { setTexto(e.target.value); setLido(null); }} />
      </V2Field>
      <V2Toggle
        id="treino-importar-ia"
        checked={daIa}
        onChange={setDaIa}
        label="Veio de uma IA"
        hint="Descarta mídia e links (a IA inventa) e marca os itens como “criado com ajuda de IA”."
      />
      <V2Button variant="secondary" disabled={!texto.trim()} onClick={() => { setResultado(null); setLido(parseItemsJson(texto, { fromAi: daIa })); }}>
        <ClipboardPaste className="h-4 w-4" aria-hidden="true" /> Ler e conferir
      </V2Button>

      {lido && !lido.ok && <p role="alert" className="text-sm font-medium text-red-600">{lido.error}</p>}
      {lido?.ok && (
        <div className="space-y-3">
          <p className="text-sm text-gray-700">
            {lido.items.length} lido{lido.items.length === 1 ? '' : 's'} · <span className="font-semibold text-ink">{validos.length} válido{validos.length === 1 ? '' : 's'}</span>
            {lido.items.length > validos.length ? ` · ${lido.items.length - validos.length} com erro (não entram)` : ''}
          </p>
          <ul className="space-y-2">
            {lido.items.map((x, i) => (
              <li key={`${i}-${x.value.title}`} className="rounded-3xl border border-gray-100 p-3 text-sm">
                <div className="flex flex-wrap items-center gap-2">
                  <V2Badge tone={x.valid ? 'green' : 'red'}>{x.valid ? 'OK' : 'Com erro'}</V2Badge>
                  <span className="font-semibold text-ink">{x.value.title || '(sem título)'}</span>
                  <span className="text-xs text-gray-500">{ITEM_KIND_LABELS[x.value.kind] || x.value.kind} · qualidade {x.quality.score}/{x.quality.total}</span>
                </div>
                {!x.valid && <ul className="mt-1 list-disc pl-5 text-red-700">{Object.values(x.errors).map((e) => <li key={e}>{e}</li>)}</ul>}
                {x.warnings.length > 0 && (
                  <p className="mt-1 flex items-start gap-1.5 text-xs text-amber-800"><TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" /> {x.warnings.join(' ')}</p>
                )}
              </li>
            ))}
          </ul>
          <V2Field label="Entram como" htmlFor="treino-importar-vis" hint="Rascunho é o seguro: revise cada item e publique depois, na aba Conteúdo (Editar).">
            <V2Select id="treino-importar-vis" value={visibilidade} onChange={(e) => setVisibilidade(e.target.value)}>
              <option value="privado">Rascunho da equipe (só admins veem)</option>
              <option value="publico">Público (entra na biblioteca na hora)</option>
            </V2Select>
          </V2Field>
          <V2Button disabled={!validos.length || acoes.importItems.isPending} onClick={importar}>
            {acoes.importItems.isPending ? 'Importando…' : `Importar ${validos.length} ${validos.length === 1 ? 'item' : 'itens'}`}
          </V2Button>
        </div>
      )}
      <Resultado r={resultado} />
    </V2Surface>
  );
}

function PedidoParaIa() {
  const [kind, setKind] = useState('drill');
  const [quantos, setQuantos] = useState('5');
  const [nivel, setNivel] = useState('');
  const [skills, setSkills] = useState([]);
  const [notas, setNotas] = useState('');
  const { copy, copied } = useClipboard();
  const copiarPedido = () => copy(
    buildAiPrompt({ kind, count: Number(quantos) || 1, level: nivel === '' ? null : Number(nivel), skills, notes: notas }),
    'Pedido copiado. Cole na IA e traga a resposta para “Importar em lote”.',
    'Não deu para copiar. Tente de novo.',
  );
  return (
    <V2Surface className="space-y-4">
      <div>
        <h2 className="flex items-center gap-2 font-display text-xl font-bold text-ink"><Sparkles className="h-5 w-5" aria-hidden="true" /> Pedido para IA criar em lote</h2>
        <p className="mt-1 max-w-2xl text-sm text-gray-500">
          A plataforma não chama IA nenhuma: ela monta o pedido com o modelo padrão (passo a passo, dicas de foco externo, certo ao lado do errado, variações), você cola na IA que usa e traz a resposta para cima.
        </p>
      </div>
      <p className="flex items-start gap-2 rounded-3xl bg-amber-50 p-3 text-sm text-amber-800">
        <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
        A IA erra técnica e inventa fontes. Importe como rascunho e revise cada item antes de publicar.
      </p>
      <div className="grid gap-3 sm:grid-cols-3">
        <V2Field label="Tipo" htmlFor="treino-ia-tipo">
          <V2Select id="treino-ia-tipo" value={kind} onChange={(e) => setKind(e.target.value)} options={ITEM_KINDS.map((k) => ({ value: k, label: ITEM_KIND_LABELS[k] }))} />
        </V2Field>
        <V2Field label="Quantos itens" htmlFor="treino-ia-quantos" hint="Até 20 por pedido rende melhor.">
          <V2Input id="treino-ia-quantos" type="number" inputMode="numeric" min={1} max={20} value={quantos} onChange={(e) => setQuantos(e.target.value)} />
        </V2Field>
        <V2Field label="Nível" htmlFor="treino-ia-nivel">
          <V2Select id="treino-ia-nivel" value={nivel} onChange={(e) => setNivel(e.target.value)}>
            <option value="">Variado</option>
            {NIVEIS.map((n) => <option key={n} value={String(n)}>{formatLevel(n)}</option>)}
          </V2Select>
        </V2Field>
      </div>
      <SkillPicker id="treino-ia-habilidades" value={skills} onChange={setSkills} max={3} />
      <V2Field label="Observações" htmlFor="treino-ia-notas" hint="Público, dificuldade, o que evitar.">
        <V2Textarea id="treino-ia-notas" rows={3} maxLength={500} value={notas} onChange={(e) => setNotas(e.target.value)} />
      </V2Field>
      <div className="flex flex-wrap gap-2">
        <V2Button onClick={copiarPedido}><Copy className="h-4 w-4" aria-hidden="true" /> {copied ? 'Pedido copiado' : 'Copiar o pedido'}</V2Button>
        <V2Button
          variant="ghost"
          onClick={() => copy(JSON.stringify(itemJsonTemplate(kind), null, 2), 'Modelo copiado.', 'Não deu para copiar. Tente de novo.')}
        >
          <FileJson className="h-4 w-4" aria-hidden="true" /> Copiar o modelo JSON vazio
        </V2Button>
      </div>
    </V2Surface>
  );
}

export default function AdminTrainingSeed({ identity, settingsQ }) {
  const acoes = useTrainingAdminActions(identity, settingsQ.settings);
  return (
    <div className="space-y-6">
      <Semente settingsQ={settingsQ} acoes={acoes} />
      <Importar acoes={acoes} />
      <PedidoParaIa />
    </div>
  );
}
