/**
 * Painel admin → Avatares → Criador (docs/58).
 *
 * O que o admin decide: se o criador está ligado, a chave do provedor de
 * imagens, o modelo, a qualidade e os limites (por pessoa e o teto do mês da
 * plataforma, que é o que segura o gasto).
 *
 * A chave é SÓ DE ESCRITA: vai para o servidor (callable `avatarAi`, ação
 * `config_save`), fica em `platform_secrets` e nunca volta — a tela mostra só
 * que existe uma e os 4 últimos caracteres. Quem confere e grava tudo é o
 * servidor; aqui é só o formulário.
 */
import React, { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { KeyRound, Save, Trash2 } from 'lucide-react';
import { t } from '@/core/i18n';
import { FEATURE_FLAG } from '@/core/featureFlags';
import { useFeatureFlag } from '@/core/lib/FeatureFlagsContext';
import {
  V2Badge, V2Button, V2ErrorState, V2Field, V2Input, V2Select, V2Skeleton, V2Surface, V2Toggle,
} from '@/v2/ui/primitives';
import { V2NumberInput } from '@/v2/ui/V2NumberInput';
import { useAvatarAiConfig, useSaveAvatarAiConfig } from '@/modules/avatar/hooks/useAvatarAi';
import { AI_QUALITIES, AI_QUALITY_LABEL } from '@/modules/avatar/domain/aiConfig.js';

export default function AdminAvatarAiTab() {
  const flagOn = useFeatureFlag(FEATURE_FLAG.AVATAR_CREATOR);
  const q = useAvatarAiConfig();
  const save = useSaveAvatarAiConfig();
  const [form, setForm] = useState(null);
  const [key, setKey] = useState('');
  const [confirmClear, setConfirmClear] = useState(false);

  useEffect(() => {
    if (q.data?.config && form === null) setForm(q.data.config);
  }, [q.data, form]);

  if (q.isError) return <V2ErrorState onRetry={() => q.refetch()} />;
  if (!form) return <V2Skeleton className="h-64 rounded-3xl" />;

  const { has_key: hasKey, key_hint: keyHint, month_count: monthCount = 0 } = q.data;
  const set = (patch) => setForm((f) => ({ ...f, ...patch }));
  const num = (k) => (e) => set({ [k]: e.target.value === '' ? '' : Number(e.target.value) });

  const send = async (payload, message) => {
    try {
      const out = await save.mutateAsync(payload);
      setForm(out.config);
      setKey('');
      toast.success(message);
    } catch (err) {
      toast.error(err?.message || t('Não deu para salvar agora. Tente de novo.'));
    }
  };

  return (
    <div className="space-y-5">
      <V2Surface variant="compacto" className="space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-display text-lg font-bold text-ink">{t('Criador de avatar')}</h2>
          <V2Badge tone={form.enabled && hasKey ? 'green' : 'neutral'}>{form.enabled && hasKey ? t('Ligado') : t('Desligado')}</V2Badge>
        </div>
        <p className="text-sm text-gray-500">
          {t('A pessoa escolhe as partes do avatar e a imagem é criada por um serviço de inteligência artificial. O pedido da imagem é escrito pela plataforma a partir das escolhas: nenhum texto, foto ou dado da pessoa é enviado. O provedor cobra por imagem criada.')}
        </p>
        {!flagOn && (
          <p role="status" className="rounded-2xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
            {t('A funcionalidade "Avatares" está desligada em Funcionalidades: as pessoas só veem o criador depois que ela for ligada.')}
          </p>
        )}
      </V2Surface>

      <V2Surface variant="compacto" className="space-y-4">
        <h3 className="flex items-center gap-2 text-sm font-bold text-ink"><KeyRound className="h-4 w-4" />{t('Chave do provedor')}</h3>
        <p className="text-sm text-gray-500">
          {hasKey ? t('Há uma chave salva, terminada em {fim}. Ela não aparece mais na tela.', { fim: keyHint }) : t('Nenhuma chave salva.')}
        </p>
        <V2Field label={hasKey ? t('Trocar a chave') : t('Chave da API de imagens (OpenAI)')} htmlFor="av-ai-key" hint={t('Cole a chave inteira. Ela fica guardada no servidor e ninguém consegue ler de volta.')}>
          <V2Input id="av-ai-key" type="password" autoComplete="off" spellCheck={false} value={key} onChange={(e) => setKey(e.target.value)} />
        </V2Field>
        {hasKey && (
          <V2Button
            variant={confirmClear ? 'danger' : 'ghost'}
            size="sm"
            disabled={save.isPending}
            onClick={() => {
              if (!confirmClear) { setConfirmClear(true); return; }
              setConfirmClear(false);
              send({ config: { ...form, enabled: false }, clear_key: true }, t('Chave apagada. O criador ficou desligado.'));
            }}
            onBlur={() => setConfirmClear(false)}
          >
            <Trash2 className="h-4 w-4" />{confirmClear ? t('Toque de novo para apagar') : t('Apagar a chave')}
          </V2Button>
        )}
      </V2Surface>

      <V2Surface variant="compacto" className="space-y-4">
        <V2Toggle
          id="av-ai-enabled"
          checked={form.enabled}
          onChange={(v) => set({ enabled: v })}
          label={t('Criador ligado')}
          hint={t('Só liga com uma chave salva.')}
        />
        <div className="grid gap-3 sm:grid-cols-2">
          <V2Field label={t('Modelo de imagem')} htmlFor="av-ai-model" hint={t('O nome do modelo no provedor. Troque só se o provedor mudar.')}>
            <V2Input id="av-ai-model" value={form.model} maxLength={60} spellCheck={false} onChange={(e) => set({ model: e.target.value.trim() })} />
          </V2Field>
          <V2Field label={t('Qualidade')} htmlFor="av-ai-quality" hint={t('Quanto maior, mais bonito e mais caro por imagem.')}>
            <V2Select id="av-ai-quality" value={form.quality} onChange={(e) => set({ quality: e.target.value })}>
              {AI_QUALITIES.map((x) => <option key={x} value={x}>{t(AI_QUALITY_LABEL[x])}</option>)}
            </V2Select>
          </V2Field>
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          <V2Field label={t('Por pessoa, por dia')} htmlFor="av-ai-day">
            <V2NumberInput id="av-ai-day" min={1} max={50} value={form.per_day} onChange={num('per_day')} rotulo={t('Por pessoa, por dia')} />
          </V2Field>
          <V2Field label={t('Por pessoa, por mês')} htmlFor="av-ai-month">
            <V2NumberInput id="av-ai-month" min={1} max={1000} value={form.per_month} onChange={num('per_month')} rotulo={t('Por pessoa, por mês')} />
          </V2Field>
          <V2Field label={t('Teto da plataforma no mês')} htmlFor="av-ai-platform" hint={t('É o que limita o gasto. Zero pausa as criações.')}>
            <V2NumberInput id="av-ai-platform" min={0} max={1000000} step={100} value={form.platform_month} onChange={num('platform_month')} rotulo={t('Teto da plataforma no mês')} />
          </V2Field>
        </div>
        <p className="text-sm text-gray-500">
          {t('Criados neste mês: {n} de {m}.', { n: monthCount, m: q.data.config.platform_month })}
        </p>
        <V2Button onClick={() => send({ config: form, ...(key.trim() ? { api_key: key.trim() } : {}) }, t('Configuração do criador salva.'))} disabled={save.isPending}>
          <Save className="h-4 w-4" />{t('Salvar')}
        </V2Button>
      </V2Surface>
    </div>
  );
}
