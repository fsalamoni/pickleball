/**
 * SetupGuide — "Como você vai montar?": os quatro kits do controle de linhas
 * (`domain/setupKits.js`), do celular no alambrado ao estúdio com OBS e câmeras
 * sem fio. Mostra o passo a passo do kit, o que ESTE aparelho aguenta e, para
 * quem organiza, "Usar este arranjo". A escolha fica no navegador, por pessoa.
 */

import React, { useMemo, useState } from 'react';
import { Smartphone, TabletSmartphone as Phones, Laptop, Clapperboard, Check, AlertTriangle, Cpu } from 'lucide-react';
import { toast } from 'sonner';
import { V2Surface, V2Badge, V2Button } from '@/v2/ui/primitives';
import { useAuth } from '@/core/lib/FirebaseAuthContext';
import { readViewPreference, writeViewPreference } from '@/core/lib/viewPreference';
import { useUpdateGameDay } from '@/modules/games/hooks/useGameDays';
import { layoutById } from '@/modules/linecall/domain/cameraLayouts';
import {
  SETUP_KITS, KIT_ORDER, CONNECTION_LABEL, deviceProfile, kitWarnings, KIT_WARNING_TEXT,
} from '@/modules/linecall/domain/setupKits';
import { cn } from '@/core/lib/utils';
import { t } from '@/core/i18n';

const ICON = { basico: Smartphone, celulares: Phones, computador: Laptop, estudio: Clapperboard };
const PREF = 'linhas:kit';

/** O aparelho, pelo que o navegador conta (nada sai daqui). */
export function useDeviceProfile() {
  return useMemo(() => {
    if (typeof navigator === 'undefined') return deviceProfile();
    return deviceProfile({
      userAgent: navigator.userAgent,
      maxTouchPoints: navigator.maxTouchPoints || 0,
      cores: navigator.hardwareConcurrency || null,
      memoryGb: navigator.deviceMemory || null,
      screenW: typeof window !== 'undefined' ? window.screen?.width : null,
    });
  }, []);
}

const KIND_LABEL = { phone: 'Celular', tablet: 'Tablet', computer: 'Computador' };

export function DeviceCard({ profile }) {
  return (
    <p className="flex items-start gap-2 rounded-2xl bg-paper p-3 text-sm text-ink">
      <Cpu className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
      <span>
        {t('Este aparelho: {k}.', { k: t(KIND_LABEL[profile.kind]) })}{' '}
        {profile.kind === 'computer'
          ? (profile.known
            ? t('Deve aguentar analisar até {n} câmera(s) ao mesmo tempo, uma por aba.', { n: profile.maxCams })
            : t('O navegador não diz o processador: comece com uma câmera e veja os quadros por segundo antes de abrir outra.'))
          : t('Ele analisa uma câmera: a dele mesmo, ou uma câmera USB ligada nele.')}
      </span>
    </p>
  );
}

export default function SetupGuide({ gameDay, podeConfigurar }) {
  const { user } = useAuth();
  const uid = user?.uid;
  const profile = useDeviceProfile();
  const update = useUpdateGameDay();
  const sugerido = profile.kind === 'computer' ? 'computador' : 'basico';
  const [kitId, setKitId] = useState(() => {
    const salvo = readViewPreference(uid, PREF);
    return SETUP_KITS[salvo] ? salvo : sugerido;
  });
  const kit = SETUP_KITS[kitId];
  const escolher = (id) => { setKitId(id); writeViewPreference(uid, PREF, id); };
  const avisos = kitWarnings(kitId, profile);
  const atual = gameDay?.line_control_layout || null;
  const usar = (id) => update.mutate(
    { id: gameDay.id, patch: { line_control_layout: id } },
    { onSuccess: () => toast.success(t('Arranjo trocado.')), onError: (e) => toast.error(e?.message || t('Não foi possível salvar.')) },
  );

  return (
    <V2Surface
      collapsible
      collapseId="linhas-montagem"
      title={t('Como você vai montar?')}
      description={t(kit.label)}
      className="p-4"
      data-dica="linhas-montagem"
    >
      <div className="space-y-4">
        <DeviceCard profile={profile} />
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4" role="radiogroup" aria-label={t('Montagem')}>
          {KIT_ORDER.map((id) => {
            const k = SETUP_KITS[id];
            const Icon = ICON[id];
            const on = id === kitId;
            return (
              <button type="button" key={id} role="radio" aria-checked={on}
                onClick={() => escolher(id)}
                className={cn(
                  'flex flex-col gap-1 rounded-2xl border p-3 text-left transition-colors coarse:min-h-11',
                  on ? 'border-ink bg-ink text-white' : 'border-gray-100 bg-white hover:border-ink',
                )}
              >
                <span className="flex items-center gap-2 text-sm font-semibold"><Icon className="h-4 w-4" aria-hidden="true" />{t(k.label)}</span>
                <span className={cn('text-xs', on ? 'text-white/70' : 'text-gray-500')}>{t(k.level)} · {k.cams[0] === k.cams[1] ? k.cams[0] : `${k.cams[0]}–${k.cams[1]}`} {t('câmera(s)')}</span>
              </button>
            );
          })}
        </div>

        <div className="space-y-3">
          <p className="text-sm text-ink">{t(kit.who)}</p>
          <div className="flex flex-wrap gap-2">
            <V2Badge tone="neutral">{t(CONNECTION_LABEL[kit.connection])}</V2Badge>
            {kit.computer && <V2Badge tone="amber">{t('Precisa de notebook ou PC')}</V2Badge>}
          </div>
          {avisos.map((a) => (
            <p key={a} role="alert" className="flex items-start gap-2 rounded-2xl bg-amber-50 p-3 text-sm text-amber-900">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />{t(KIT_WARNING_TEXT[a], { n: profile.maxCams })}
            </p>
          ))}
          <p className="text-sm text-gray-600"><span className="font-semibold text-ink">{t('O que precisa:')}</span> {t(kit.devices)}</p>
          <ol className="space-y-2">
            {kit.steps.map((s, i) => (
              <li key={s} className="flex gap-3 text-sm text-ink">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-acid text-xs font-bold text-ink" aria-hidden="true">{i + 1}</span>
                <span className="pt-0.5">{t(s)}</span>
              </li>
            ))}
          </ol>
          <div className="grid gap-3 sm:grid-cols-2">
            <ul className="space-y-1 text-sm text-gray-600">
              {kit.pros.map((p) => <li key={p} className="flex gap-2"><Check className="mt-0.5 h-4 w-4 shrink-0 text-green-700" aria-hidden="true" />{t(p)}</li>)}
            </ul>
            <ul className="space-y-1 text-sm text-gray-600">
              {kit.limits.map((p) => <li key={p} className="flex gap-2"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-700" aria-hidden="true" />{t(p)}</li>)}
            </ul>
          </div>
          <div className="space-y-2">
            <p className="text-sm font-semibold text-ink">{t('Arranjos que combinam')}</p>
            <ul className="flex flex-wrap gap-2">
              {kit.layouts.map((id) => {
                const l = layoutById(id);
                const ativo = id === atual;
                return (
                  <li key={id}>
                    {podeConfigurar && !ativo ? (
                      <V2Button size="sm" variant="secondary" disabled={update.isPending} onClick={() => usar(id)}>{t('Usar: {l}', { l: t(l.label) })}</V2Button>
                    ) : (
                      <V2Badge tone={ativo ? 'green' : 'neutral'}>{ativo ? t('Em uso: {l}', { l: t(l.label) }) : t(l.label)}</V2Badge>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        </div>
      </div>
    </V2Surface>
  );
}
