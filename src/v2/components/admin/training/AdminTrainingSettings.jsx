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
import { BadgeCheck, RotateCcw, Save } from 'lucide-react';
import { useSaveTrainingSettings, useSetProfessorVerified } from '@/modules/training/hooks/useTrainingSettings';
import { useCoach } from '@/modules/coaches/hooks/useCoaches';
import { DEFAULT_TRAINING_SETTINGS, settingsPatch } from '@/modules/training/domain/settings';
import { HARD_LIMITS } from '@/modules/training/domain/media';
import { cn } from '@/core/lib/utils';
import {
  V2Button, V2ErrorState, V2Field, V2Input, V2Skeleton, V2Surface, V2Toggle,
} from '@/v2/ui/primitives';
import { mensagemDeErro } from '@/v2/components/training/item/ItemActionDialogs';
import { fmtNumero, t, tk, tn } from '@/core/i18n';

/** Os campos, por grupo, com o efeito de cada um. Faixas = as de `normalizeTrainingSettings`. */
export const GRUPOS_DE_CONFIG = Object.freeze([
  {
    titulo: tk('Publicação na biblioteca'),
    campos: [
      { key: 'public_review_atleta', label: tk('Revisar o que atletas publicam'), hint: tk('Ligado: o item público de um atleta só entra na biblioteca depois que a equipe aprova na aba Revisão. Desligado: entra na hora.') },
      { key: 'public_review_professor', label: tk('Revisar o que professores publicam'), hint: tk('Ligado (padrão): professor ainda não verificado passa pela fila; o verificado (lista abaixo) publica direto. Desligado: todo professor publica na hora — e qualquer conta pode se declarar professor.') },
      { key: 'allow_public_athlete', label: tk('Atletas podem publicar na biblioteca'), hint: tk('Desligado: atletas só criam itens “Só eu” e compartilham com quem escolherem. Os já publicados continuam na biblioteca.') },
      { key: 'max_pending_per_user', min: 1, max: 50, step: 1, unidade: tk('itens'), label: tk('Itens em revisão ao mesmo tempo, por pessoa'), hint: tk('Protege a fila: passando disso, a pessoa espera a equipe revisar antes de mandar outro.') },
    ],
  },
  {
    titulo: tk('Imagens e vídeos enviados'),
    campos: [
      { key: 'allow_uploads', label: tk('Permitir enviar arquivos'), hint: tk('Desligado: só dá para usar mídia por link (YouTube, Instagram, imagem na web). Os arquivos já enviados continuam aparecendo.') },
      { key: 'allow_video_upload', label: tk('Permitir enviar vídeos'), hint: tk('Desligado: só imagens podem ser enviadas; vídeo, por link. Menores de idade nunca enviam arquivo.') },
      { key: 'max_image_mb', min: 0.5, max: HARD_LIMITS.imageMb, step: 0.5, unidade: 'MB', label: tk('Tamanho máximo da imagem'), hint: tk('A foto é comprimida no aparelho antes de subir; acima disso, a pessoa escolhe outra.') },
      { key: 'max_video_mb', min: 5, max: HARD_LIMITS.videoMb, step: 5, unidade: 'MB', label: tk('Tamanho máximo do vídeo'), hint: tk('Vídeo maior é recusado antes de subir.') },
      { key: 'max_video_seconds', min: 10, max: HARD_LIMITS.videoSeconds, step: 5, unidade: 's', label: tk('Duração máxima do vídeo'), hint: tk('Conferida no aparelho de quem envia.') },
      { key: 'max_uploads_per_user', min: 0, max: 500, step: 1, unidade: tk('arquivos'), label: tk('Arquivos por pessoa'), hint: tk('Quantos arquivos cada pessoa pode ter guardados no treino. 0 impede novos envios.') },
    ],
  },
  {
    titulo: tk('Compartilhamento'),
    campos: [
      { key: 'allow_sharing', label: tk('Indicar itens a outros atletas'), hint: tk('Desligado: ninguém indica item a outra pessoa. Professores continuam enviando aos próprios alunos.') },
    ],
  },
]);

const NUM = new Set(GRUPOS_DE_CONFIG.flatMap((g) => g.campos).filter((c) => c.max !== undefined).map((c) => c.key));
const paraFormulario = (s) => Object.fromEntries(Object.keys(DEFAULT_TRAINING_SETTINGS).map((k) => [k, NUM.has(k) ? String(s[k]) : s[k]]));
const fmt = (n) => fmtNumero(n, { maximumFractionDigits: 1, useGrouping: false });

/** Quantas chaves mudam se salvar `form` sobre `atual` (já normalizados). */
export function settingsChanges(form, atual) {
  const a = settingsPatch(form);
  const b = settingsPatch(atual);
  return Object.keys(a).filter((k) => a[k] !== b[k]);
}

function ProfessorVerificado({ uid, remover }) {
  const coach = useCoach(uid);
  const nome = coach.data?.display_name || coach.data?.name || '';
  return (
    <li className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-gray-100 p-3">
      <span className="flex min-w-0 items-center gap-2 text-sm text-ink">
        <BadgeCheck className="h-4 w-4 shrink-0 text-green-600" aria-hidden="true" />
        <span className="truncate font-semibold">
          {nome || (coach.isPending ? t('Carregando…') : coach.isError ? t('Professor (o nome não carregou)') : t('Conta sem perfil de professor'))}
        </span>
      </span>
      <V2Button size="sm" variant="ghost" disabled={remover.isPending} onClick={() => remover.mutate({ uid, verified: false, name: nome }, {
        onSuccess: () => toast.success(t('Verificação retirada. O próximo item público dessa pessoa passa pela revisão.')),
        onError: (err) => toast.error(mensagemDeErro(err, t('Não foi possível salvar agora.'))),
      })}
      >
        {t('Remover')}
      </V2Button>
    </li>
  );
}

/**
 * Quem publica sem fila. Fica fora do formulário: muda na hora, um por vez,
 * e o "Salvar"/"Padrões de fábrica" de cima não toca a lista.
 */
function ProfessoresVerificados({ lista, identity }) {
  const remover = useSetProfessorVerified(identity);
  return (
    <V2Surface className="space-y-3" aria-label={t('Professores verificados')}>
      <div>
        <h2 className="font-display text-lg font-bold text-ink">{t('Professores verificados ({n})', { n: lista.length })}</h2>
        <p className="mt-1 text-sm text-gray-500">
          {t('O item público deles entra na biblioteca sem passar pela fila. Para verificar alguém, use “Aprovar e verificar o professor” na aba Revisão. Remover não tira da biblioteca o que já foi aprovado.')}
        </p>
      </div>
      {lista.length ? (
        <ul className="space-y-2">
          {lista.map((uid) => <ProfessorVerificado key={uid} uid={uid} remover={remover} />)}
        </ul>
      ) : (
        <p className="text-sm text-gray-500">{t('Nenhum professor verificado ainda.')}</p>
      )}
    </V2Surface>
  );
}

function Formulario({ atual, identity }) {
  const salvar = useSaveTrainingSettings(identity);
  const [form, setForm] = useState(() => paraFormulario(atual));
  const mudancas = useMemo(() => settingsChanges(form, atual), [form, atual]);
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  const enviar = () => salvar.mutate({ input: form, current: atual }, {
    onSuccess: () => toast.success(t('Configurações salvas.')),
    onError: (err) => toast.error(mensagemDeErro(err, t('Não foi possível salvar agora.'))),
  });

  return (
    <div className="space-y-4 pb-24" data-dica="admin-treino-config">
      {GRUPOS_DE_CONFIG.map((g, i) => (
        <React.Fragment key={g.titulo}>
          <V2Surface className="space-y-5">
            <h2 className="font-display text-lg font-bold text-ink">{t(g.titulo)}</h2>
            {g.campos.map((c) => {
              const id = `treino-cfg-${c.key}`;
              const mudou = mudancas.includes(c.key);
              if (c.max === undefined) {
                return (
                  <div key={c.key} className={cn('rounded-2xl', mudou && 'bg-acid/20 p-2 -m-2')}>
                    <V2Toggle id={id} checked={!!form[c.key]} onChange={(v) => set(c.key, v)} label={t(c.label)} hint={t(c.hint)} />
                  </div>
                );
              }
              return (
                <V2Field key={c.key} label={t(c.label)} htmlFor={id} hint={`${t(c.hint)} ${t('Entre {min} e {max} {unidade}; padrão {padrao}.', { min: fmt(c.min), max: fmt(c.max), unidade: t(c.unidade), padrao: fmt(DEFAULT_TRAINING_SETTINGS[c.key]) })}`}>
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
                    <span className="text-sm text-gray-500">{t(c.unidade)}</span>
                  </div>
                </V2Field>
              );
            })}
          </V2Surface>
          {i === 0 && <ProfessoresVerificados lista={atual.verified_professors || []} identity={identity} />}
        </React.Fragment>
      ))}
      <p className="text-xs text-gray-500">
        {t('O armazenamento recusa imagem acima de {imagem} MB e vídeo acima de {video} MB, seja qual for a configuração; aqui só dá para baixar esses tetos. Valor fora da faixa é ajustado ao salvar.', { imagem: HARD_LIMITS.imageMb, video: HARD_LIMITS.videoMb })}
      </p>

      <V2Surface variant="compacto" className="sticky bottom-3 z-10 flex flex-wrap items-center justify-between gap-3 p-3">
        <p className="text-sm font-semibold text-ink" aria-live="polite">
          {mudancas.length ? tn(mudancas.length, '{n} alteração a salvar', '{n} alterações a salvar') : t('Nada alterado')}
        </p>
        <div className="flex flex-wrap gap-2">
          <V2Button variant="ghost" onClick={() => setForm(paraFormulario(DEFAULT_TRAINING_SETTINGS))}>
            <RotateCcw className="h-4 w-4" aria-hidden="true" />{' '}{t('Padrões de fábrica')}
          </V2Button>
          {mudancas.length > 0 && <V2Button variant="ghost" onClick={() => setForm(paraFormulario(atual))}>{t('Desfazer')}</V2Button>}
          <V2Button disabled={!mudancas.length || salvar.isPending} onClick={enviar}>
            <Save className="h-4 w-4" aria-hidden="true" /> {salvar.isPending ? t('Salvando…') : t('Salvar')}
          </V2Button>
        </div>
      </V2Surface>
    </div>
  );
}

export default function AdminTrainingSettings({ identity, settingsQ }) {
  if (settingsQ.isPending) return <V2Skeleton className="h-72 rounded-4xl" />;
  if (settingsQ.isError) {
    return (
      <V2Surface>
        <V2ErrorState
          title={t('As configurações do treino não carregaram')}
          description={t('Para não gravar os padrões por cima do que a equipe já decidiu, salvar só volta quando a leitura der certo.')}
          onRetry={() => settingsQ.refetch()}
        />
      </V2Surface>
    );
  }
  // `key`: depois de salvar, o formulário recomeça do que está gravado.
  return <Formulario key={JSON.stringify(settingsPatch(settingsQ.data))} atual={settingsQ.data} identity={identity} />;
}
