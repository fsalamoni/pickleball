/**
 * Treino → CONFIGURAÇÕES (`platform_settings/training`). Cada campo diz o que
 * muda para quem usa. Só se salva com a leitura em mãos: com a leitura
 * falhando, salvar gravaria os padrões por cima do que a equipe decidiu.
 *
 * A regra do Firestore usa os MESMOS padrões (`trainingSetting`), e o
 * armazenamento tem tetos próprios que a configuração só consegue baixar.
 */
import React, { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { RotateCcw, Save } from 'lucide-react';
import { useSaveTrainingSettings } from '@/modules/training/hooks/useTrainingSettings';
import { DEFAULT_TRAINING_SETTINGS, settingsPatch } from '@/modules/training/domain/settings';
import { HARD_LIMITS } from '@/modules/training/domain/media';
import { cn } from '@/core/lib/utils';
import {
  V2Button, V2ErrorState, V2Field, V2Input, V2Skeleton, V2Surface, V2Toggle,
} from '@/v2/ui/primitives';
import { mensagemDeErro } from '@/v2/components/training/item/ItemActionDialogs';

/** Os campos, por grupo, com o efeito de cada um. Faixas = as de `normalizeTrainingSettings`. */
export const GRUPOS_DE_CONFIG = Object.freeze([
  {
    titulo: 'Publicação na biblioteca',
    campos: [
      { key: 'public_review_atleta', label: 'Revisar o que atletas publicam', hint: 'Ligado: o item público de um atleta só entra na biblioteca depois que a equipe aprova na aba Revisão. Desligado: entra na hora.' },
      { key: 'public_review_professor', label: 'Revisar o que professores publicam', hint: 'Ligado: professores também passam pela fila de revisão. Desligado: o item público do professor entra na hora.' },
      { key: 'allow_public_athlete', label: 'Atletas podem publicar na biblioteca', hint: 'Desligado: atletas só criam itens “Só eu” e compartilham com quem escolherem. Os já publicados continuam na biblioteca.' },
      { key: 'max_pending_per_user', min: 1, max: 50, step: 1, unidade: 'itens', label: 'Itens em revisão ao mesmo tempo, por pessoa', hint: 'Protege a fila: passando disso, a pessoa espera a equipe revisar antes de mandar outro.' },
    ],
  },
  {
    titulo: 'Imagens e vídeos enviados',
    campos: [
      { key: 'allow_uploads', label: 'Permitir enviar arquivos', hint: 'Desligado: só dá para usar mídia por link (YouTube, Instagram, imagem na web). Os arquivos já enviados continuam aparecendo.' },
      { key: 'allow_video_upload', label: 'Permitir enviar vídeos', hint: 'Desligado: só imagens podem ser enviadas; vídeo, por link. Menores de idade nunca enviam arquivo.' },
      { key: 'max_image_mb', min: 0.5, max: HARD_LIMITS.imageMb, step: 0.5, unidade: 'MB', label: 'Tamanho máximo da imagem', hint: 'A foto é comprimida no aparelho antes de subir; acima disso, a pessoa escolhe outra.' },
      { key: 'max_video_mb', min: 5, max: HARD_LIMITS.videoMb, step: 5, unidade: 'MB', label: 'Tamanho máximo do vídeo', hint: 'Vídeo maior é recusado antes de subir.' },
      { key: 'max_video_seconds', min: 10, max: HARD_LIMITS.videoSeconds, step: 5, unidade: 's', label: 'Duração máxima do vídeo', hint: 'Conferida no aparelho de quem envia.' },
      { key: 'max_uploads_per_user', min: 0, max: 500, step: 1, unidade: 'arquivos', label: 'Arquivos por pessoa', hint: 'Quantos arquivos cada pessoa pode ter guardados no treino. 0 impede novos envios.' },
    ],
  },
  {
    titulo: 'Compartilhamento',
    campos: [
      { key: 'allow_sharing', label: 'Indicar itens a outros atletas', hint: 'Desligado: ninguém indica item a outra pessoa. Professores continuam enviando aos próprios alunos.' },
    ],
  },
]);

const NUM = new Set(GRUPOS_DE_CONFIG.flatMap((g) => g.campos).filter((c) => c.max !== undefined).map((c) => c.key));
const paraFormulario = (s) => Object.fromEntries(Object.keys(DEFAULT_TRAINING_SETTINGS).map((k) => [k, NUM.has(k) ? String(s[k]) : s[k]]));
const fmt = (n) => String(n).replace('.', ',');

/** Quantas chaves mudam se salvar `form` sobre `atual` (já normalizados). */
export function settingsChanges(form, atual) {
  const a = settingsPatch(form);
  const b = settingsPatch(atual);
  return Object.keys(a).filter((k) => a[k] !== b[k]);
}

function Formulario({ atual, identity }) {
  const salvar = useSaveTrainingSettings(identity);
  const [form, setForm] = useState(() => paraFormulario(atual));
  const mudancas = useMemo(() => settingsChanges(form, atual), [form, atual]);
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  const enviar = () => salvar.mutate({ input: form, current: atual }, {
    onSuccess: () => toast.success('Configurações salvas.'),
    onError: (err) => toast.error(mensagemDeErro(err, 'Não foi possível salvar agora.')),
  });

  return (
    <div className="space-y-4 pb-24" data-dica="admin-treino-config">
      {GRUPOS_DE_CONFIG.map((g) => (
        <V2Surface key={g.titulo} className="space-y-5">
          <h2 className="font-display text-lg font-bold text-ink">{g.titulo}</h2>
          {g.campos.map((c) => {
            const id = `treino-cfg-${c.key}`;
            const mudou = mudancas.includes(c.key);
            if (c.max === undefined) {
              return (
                <div key={c.key} className={cn('rounded-2xl', mudou && 'bg-acid/20 p-2 -m-2')}>
                  <V2Toggle id={id} checked={!!form[c.key]} onChange={(v) => set(c.key, v)} label={c.label} hint={c.hint} />
                </div>
              );
            }
            return (
              <V2Field key={c.key} label={c.label} htmlFor={id} hint={`${c.hint} Entre ${fmt(c.min)} e ${fmt(c.max)} ${c.unidade}; padrão ${fmt(DEFAULT_TRAINING_SETTINGS[c.key])}.`}>
                <div className="flex items-center gap-2">
                  <V2Input
                    id={id}
                    type="number"
                    inputMode="decimal"
                    min={c.min}
                    max={c.max}
                    step={c.step}
                    value={form[c.key]}
                    onChange={(e) => set(c.key, e.target.value)}
                    className={cn('max-w-[10rem]', mudou && 'border-ink')}
                  />
                  <span className="text-sm text-gray-500">{c.unidade}</span>
                </div>
              </V2Field>
            );
          })}
        </V2Surface>
      ))}
      <p className="text-xs text-gray-500">
        O armazenamento recusa imagem acima de {HARD_LIMITS.imageMb} MB e vídeo acima de {HARD_LIMITS.videoMb} MB, seja qual for a configuração; aqui só dá para baixar esses tetos. Valor fora da faixa é ajustado ao salvar.
      </p>

      <div className="sticky bottom-3 z-10 flex flex-wrap items-center justify-between gap-3 rounded-3xl border border-gray-100 bg-paper-pure p-3 shadow-organic-sm">
        <p className="text-sm font-semibold text-ink" aria-live="polite">
          {mudancas.length ? `${mudancas.length} ${mudancas.length === 1 ? 'alteração' : 'alterações'} a salvar` : 'Nada alterado'}
        </p>
        <div className="flex flex-wrap gap-2">
          <V2Button variant="ghost" onClick={() => setForm(paraFormulario(DEFAULT_TRAINING_SETTINGS))}>
            <RotateCcw className="h-4 w-4" aria-hidden="true" /> Padrões de fábrica
          </V2Button>
          {mudancas.length > 0 && <V2Button variant="ghost" onClick={() => setForm(paraFormulario(atual))}>Desfazer</V2Button>}
          <V2Button disabled={!mudancas.length || salvar.isPending} onClick={enviar}>
            <Save className="h-4 w-4" aria-hidden="true" /> {salvar.isPending ? 'Salvando…' : 'Salvar'}
          </V2Button>
        </div>
      </div>
    </div>
  );
}

export default function AdminTrainingSettings({ identity, settingsQ }) {
  if (settingsQ.isPending) return <V2Skeleton className="h-72 rounded-4xl" />;
  if (settingsQ.isError) {
    return (
      <V2Surface>
        <V2ErrorState
          title="As configurações do treino não carregaram"
          description="Para não gravar os padrões por cima do que a equipe já decidiu, salvar só volta quando a leitura der certo."
          onRetry={() => settingsQ.refetch()}
        />
      </V2Surface>
    );
  }
  // `key`: depois de salvar, o formulário recomeça do que está gravado.
  return <Formulario key={JSON.stringify(settingsPatch(settingsQ.data))} atual={settingsQ.data} identity={identity} />;
}
